// prune.mjs - cmdPrune + auto-prune entry points. Reads the target file(s),
// runs the bottom-up drop walk (pure algorithms in pruneSelection.mjs), writes
// the trimmed files, and archives the dropped content.
//
// Each file has `cap` + `prune_to` in `_index.json -> sizes`. Prune fires when a
// file exceeds `cap` lines and drops it to `prune_to`. No derived values.
//
// Paired prune (session / memory): drops each main-file bullet with its anchored
// EXTENDED sub-section so the pair archives together, then a secondary
// reverse-orphan pass on EXTENDED if it is still over cap. Standalone prune
// (session_extended / memory_extended / backlog): operates on the named file.
//
// Auto-prune (called from commit.mjs after a successful commit) passes
// `protectedTopMain` / `protectedTopExt` so the freshest items from that commit
// are skipped - new content never archives immediately on landing.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";

import { err, parseFlags, requireOpt } from "../cli.mjs";
import { REPO_ROOT } from "../paths.mjs";
import {
  collectReferencedAnchors, pruneExtended, pruneExtendedReverseOrphan,
  prunePaired, pruneTopLevel,
} from "../pruneSelection.mjs";
import { assertFileExists, nowIsoUtc, nowStampUtc, resolveIndexFile, uniqueArchivePath } from "../state.mjs";

export async function cmdPrune(index, args) {
  const opts = parseFlags(args, ["file", "dry-run"]);
  const dryRun = opts["dry-run"] === true;
  requireOpt(opts, "file");

  if (opts.file === "session" || opts.file === "memory") {
    await runPairedPrune(index, opts.file, { dryRun });
    return;
  }
  await runStandalonePrune(index, opts.file, { dryRun });
}

// Paired auto-prune entry point. Used by commit.mjs and by cmdPrune for
// session / memory. Returns { fired, dropped, mainBefore, mainAfter,
// extBefore, extAfter, archivePath } so the caller can summarize.
export async function runPairedPrune(index, fileKey, opts = {}) {
  const {
    dryRun = false,
    protectedTopMain = 0,
    protectedTopExt = 0,
    logPrefix = "",
  } = opts;

  const mainPath = resolveIndexFile(index, fileKey);
  assertFileExists(mainPath, fileKey);
  const sizes = index.sizes?.[fileKey];
  if (!sizes) {
    err(`No size config (cap + prune_to) for "${fileKey}" in _index.json -> sizes.`);
    process.exit(3);
  }

  const extendedKey = `${fileKey}_extended`;
  const extendedPath = resolveIndexFile(index, extendedKey);
  assertFileExists(extendedPath, extendedKey);
  const extendedSizes = index.sizes?.[extendedKey];
  if (!extendedSizes) {
    err(`No size config (cap + prune_to) for "${extendedKey}" in _index.json -> sizes.`);
    process.exit(3);
  }

  const mainContent = await readFile(mainPath, "utf8");
  const extendedContent = await readFile(extendedPath, "utf8");
  const extendedFilename = basename(extendedPath);
  const initialMain = mainContent.split("\n").length;
  const initialExt = extendedContent.split("\n").length;

  const mainOver = initialMain > sizes.cap;
  const extOver = initialExt > extendedSizes.cap;

  if (!mainOver && !extOver) {
    console.log(`${logPrefix}not triggered (${fileKey} ${initialMain}/${sizes.cap}, ${extendedKey} ${initialExt}/${extendedSizes.cap}).`);
    return { fired: false };
  }

  console.log(`${logPrefix}${fileKey} ${initialMain}/${sizes.cap} (prune_to ${sizes.prune_to})`);
  console.log(`${logPrefix}${extendedKey} ${initialExt}/${extendedSizes.cap} (prune_to ${extendedSizes.prune_to})`);
  if (protectedTopMain > 0 || protectedTopExt > 0) {
    console.log(`${logPrefix}protecting top ${protectedTopMain} main bullet(s) + top ${protectedTopExt} extended sub-section(s) from this commit.`);
  }

  const allowedSlugs = prunableBucketsFor(index, fileKey);
  const paired = prunePaired(mainContent, extendedContent, sizes.prune_to, extendedSizes.prune_to, allowedSlugs, extendedFilename, protectedTopMain, protectedTopExt);

  let workingExtended = paired.keptExtended;
  const allDropped = [...paired.dropped];

  // Secondary pass: reverse-orphan cleanup on EXTENDED if it's still over its
  // cap. Skips load-bearing sub-sections AND anything referenced by main.
  // Protected top-N also still applies.
  const extLinesAfterPaired = workingExtended.split("\n").length;
  if (extLinesAfterPaired > extendedSizes.cap) {
    console.log(`${logPrefix}${extendedKey} still ${extLinesAfterPaired} lines after paired pass, running reverse-orphan cleanup.`);
    const referenced = collectReferencedAnchors(paired.keptMain, extendedFilename);
    const secondary = pruneExtendedReverseOrphan(workingExtended, extendedSizes.prune_to, referenced, protectedTopExt);
    workingExtended = secondary.kept;
    allDropped.push(...secondary.dropped);
  }

  if (allDropped.length === 0) {
    console.log(`${logPrefix}nothing prunable found (all sections protected, load-bearing, or fresh from this commit).`);
    return { fired: true, dropped: 0 };
  }

  const mainAfter = paired.keptMain.split("\n").length;
  const extAfter = workingExtended.split("\n").length;

  console.log(`${logPrefix}would drop ${allDropped.length} item(s):`);
  for (const d of allDropped) console.log(`${logPrefix}  - ${d.label}`);
  console.log(`${logPrefix}${fileKey} ${initialMain} -> ${mainAfter} lines.`);
  console.log(`${logPrefix}${extendedKey} ${initialExt} -> ${extAfter} lines.`);

  if (dryRun) {
    console.log(`${logPrefix}--dry-run, no writes.`);
    return { fired: true, dropped: allDropped.length, dryRun: true };
  }

  const archivePath = await archivePairedDropped(index, fileKey, allDropped);
  await writeFile(mainPath, paired.keptMain, "utf8");
  await writeFile(extendedPath, workingExtended, "utf8");
  console.log(`${logPrefix}wrote ${mainPath}`);
  console.log(`${logPrefix}wrote ${extendedPath}`);
  console.log(`${logPrefix}archived paired content to ${archivePath}`);

  return {
    fired: true,
    dropped: allDropped.length,
    mainBefore: initialMain,
    mainAfter,
    extBefore: initialExt,
    extAfter,
    archivePath,
  };
}

// Standalone auto-prune entry point. Used for backlog and for explicit
// EXTENDED-only invocations from the CLI (reverse-orphan cleanup).
export async function runStandalonePrune(index, fileKey, opts = {}) {
  const {
    dryRun = false,
    protectedTopMain = 0,
    logPrefix = "",
  } = opts;

  const filePath = resolveIndexFile(index, fileKey);
  assertFileExists(filePath, fileKey);
  const sizes = index.sizes?.[fileKey];
  if (!sizes) {
    err(`No size config (cap + prune_to) for "${fileKey}" in _index.json -> sizes.`);
    process.exit(3);
  }

  const content = await readFile(filePath, "utf8");
  const initialLines = content.split("\n").length;

  if (initialLines <= sizes.cap) {
    console.log(`${logPrefix}not triggered (${fileKey} ${initialLines}/${sizes.cap}).`);
    return { fired: false };
  }

  console.log(`${logPrefix}${fileKey} ${initialLines}/${sizes.cap} (prune_to ${sizes.prune_to})`);
  if (protectedTopMain > 0) {
    console.log(`${logPrefix}protecting top ${protectedTopMain} bullet(s) from this commit.`);
  }

  const isExtended = fileKey.endsWith("_extended");
  const result = isExtended
    ? pruneExtended(content, sizes.prune_to, protectedTopMain)
    : pruneTopLevel(content, sizes.prune_to, prunableBucketsFor(index, fileKey), protectedTopMain);

  if (result.dropped.length === 0) {
    console.log(`${logPrefix}nothing prunable found (all sections protected, load-bearing, or fresh from this commit).`);
    return { fired: true, dropped: 0 };
  }

  const after = result.kept.split("\n").length;

  console.log(`${logPrefix}would drop ${result.dropped.length} item(s):`);
  for (const d of result.dropped) console.log(`${logPrefix}  - ${d.label}`);
  console.log(`${logPrefix}file ${initialLines} -> ${after} lines.`);

  if (dryRun) {
    console.log(`${logPrefix}--dry-run, no writes.`);
    return { fired: true, dropped: result.dropped.length, dryRun: true };
  }

  const archivePath = await archiveDropped(index, fileKey, result.dropped);
  await writeFile(filePath, result.kept, "utf8");
  console.log(`${logPrefix}wrote ${filePath}`);
  console.log(`${logPrefix}archived dropped content to ${archivePath}`);

  return { fired: true, dropped: result.dropped.length, before: initialLines, after, archivePath };
}

function prunableBucketsFor(index, fileKey) {
  const buckets = index.buckets?.[fileKey];
  if (!Array.isArray(buckets)) return [];
  return buckets;
}

// ----- archive writers -----

async function archiveDropped(index, fileKey, dropped) {
  const archiveKey = fileKey.startsWith("memory") ? "memory_archive"
    : fileKey.startsWith("session") ? "session_archive"
    : fileKey === "backlog" ? "backlog_archive"
    : null;
  if (!archiveKey) {
    err(`No archive folder mapped for file "${fileKey}". Expected memory_archive, session_archive, or backlog_archive.`);
    process.exit(5);
  }

  const archiveRel = index.files?.[archiveKey];
  if (!archiveRel) {
    err(`No "${archiveKey}" mapping in _index.json -> files.`);
    process.exit(5);
  }

  const archiveDir = resolve(REPO_ROOT, archiveRel);
  if (!existsSync(archiveDir)) await mkdir(archiveDir, { recursive: true });

  const archivePath = uniqueArchivePath(archiveDir, nowStampUtc());

  const header = `# Archived from ${fileKey}\n\nArchived at: ${nowIsoUtc()}\n\n`;
  const blocks = dropped.map(d => `## ${d.section}\n\n${d.lines.join("\n")}\n`).join("\n---\n\n");
  await writeFile(archivePath, header + blocks, "utf8");

  return archivePath;
}

async function archivePairedDropped(index, fileKey, dropped) {
  const archiveKey = fileKey === "memory" ? "memory_archive" : "session_archive";
  const archiveRel = index.files?.[archiveKey];
  if (!archiveRel) {
    err(`No "${archiveKey}" mapping in _index.json -> files.`);
    process.exit(5);
  }

  const archiveDir = resolve(REPO_ROOT, archiveRel);
  if (!existsSync(archiveDir)) await mkdir(archiveDir, { recursive: true });

  const archivePath = uniqueArchivePath(archiveDir, nowStampUtc());

  const upper = fileKey.toUpperCase();
  const header = `# Archived from ${fileKey} (paired prune)\n\nArchived at: ${nowIsoUtc()}\n\n`;

  const blocks = dropped.map(d => {
    const parts = [`## ${d.section}\n`];

    if (d.mainLines && d.mainLines.length > 0) {
      parts.push(`**${upper} LIFO bullet:**\n\n${d.mainLines.join("\n")}\n`);
    }

    if (d.extendedLines && d.extendedLines.length > 0) {
      const reverseOrphan = d.mainLines === null;
      const label = reverseOrphan
        ? `**${upper}_EXTENDED reverse-orphan sub-section (anchor: \`${d.extendedAnchor}\`):**`
        : `**${upper}_EXTENDED anchored detail (anchor: \`${d.extendedAnchor}\`):**`;
      parts.push(`${label}\n\n${d.extendedLines.join("\n")}\n`);
    }

    return parts.join("\n");
  }).join("\n---\n\n");

  await writeFile(archivePath, header + blocks, "utf8");
  return archivePath;
}
