// archive.mjs - cmdArchive. Surgical archive of a single EXTENDED anchor.
// Cuts the named anchor's section from the EXTENDED file and writes it to the
// configured archive folder with a timestamped filename.
//
// Use when one specific entry needs to retire ahead of prune cycle.
//
// Flags: --file <key> --anchor <slug> [--dry-run]

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import { err, parseFlags, requireOpt } from "../cli.mjs";
import { findExtendedBounds, findLifoSubsectionBounds } from "../markdown.mjs";
import { REPO_ROOT } from "../paths.mjs";
import { assertFileExists, nowIsoUtc, nowStampUtc, resolveIndexFile, uniqueArchivePath } from "../state.mjs";

export async function cmdArchive(index, args) {
  const opts = parseFlags(args, ["file", "anchor", "dry-run"]);
  const dryRun = opts["dry-run"] === true;
  requireOpt(opts, "file");
  requireOpt(opts, "anchor");

  if (!opts.file.endsWith("_extended")) {
    err(`archive operates on EXTENDED files only. Got "${opts.file}".`);
    process.exit(5);
  }

  const filePath = resolveIndexFile(index, opts.file);
  assertFileExists(filePath, opts.file);
  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");

  const bounds = findAnchorBounds(lines, opts.anchor);
  if (!bounds) {
    err(`anchor "${opts.anchor}" not found in ${opts.file}.`);
    process.exit(5);
  }

  const removed = lines.slice(bounds.start, bounds.end + 1);
  const kept = [...lines.slice(0, bounds.start), ...lines.slice(bounds.end + 1)];

  console.log(`archive: would remove "${opts.anchor}" from ${opts.file} (${removed.length} lines).`);

  if (dryRun) {
    console.log("archive: --dry-run, no writes.");
    return;
  }

  const archiveKey = opts.file.includes("memory") ? "memory_archive" : "session_archive";
  const archiveRel = index.files?.[archiveKey];
  if (!archiveRel) {
    err(`No "${archiveKey}" mapping in _index.json -> files.`);
    process.exit(5);
  }
  const archiveDir = resolve(REPO_ROOT, archiveRel);
  if (!existsSync(archiveDir)) await mkdir(archiveDir, { recursive: true });

  const archivePath = uniqueArchivePath(archiveDir, `${nowStampUtc()}_${opts.anchor}`);

  const body = `# Archived: ${opts.anchor}\n\nFrom: ${opts.file}\nArchived at: ${nowIsoUtc()}\n\n${removed.join("\n")}\n`;
  await writeFile(archivePath, body, "utf8");
  await writeFile(filePath, kept.join("\n"), "utf8");

  console.log(`archive: wrote ${archivePath}`);
  console.log(`archive: updated ${filePath}`);
}

function findAnchorBounds(lines, anchor) {
  // Primary path: `### sub-section` under `## LIFO` - the current EXTENDED
  // shape written by the staging pipeline.
  const lifoMatch = findLifoSubsectionBounds(lines, anchor);
  if (lifoMatch) {
    return { start: lifoMatch.startIdx, end: lifoMatch.endIdx - 1 };
  }

  // Migration fallback: legacy top-level `## <heading>` anchors from the
  // pre-LIFO-sub-section EXTENDED shape. Slug resolves the same way.
  const slugMatch = findExtendedBounds(lines, anchor);
  if (slugMatch) {
    let start = slugMatch.startIdx;
    if (start > 0 && lines[start - 1].includes(`<a id="${anchor}"`)) start = start - 1;
    return { start, end: slugMatch.endIdx - 1 };
  }

  // Final fallback: an explicit `<a id="anchor"></a>` marker without a matching slug.
  // Used when viewers strip Pandoc-style {#id} heading syntax. The marker sits
  // above its heading, so the section extends through the heading it introduces
  // and ends before the NEXT heading.
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(`<a id="${anchor}"`)) continue;
    // Find the heading the marker introduces (first `## ` at or after marker).
    let headingIdx = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].startsWith("## ")) { headingIdx = j; break; }
    }
    // No following heading -> section runs to EOF.
    if (headingIdx === -1) return { start: i, end: lines.length - 1 };
    // End at the line before the NEXT heading.
    let end = lines.length - 1;
    for (let j = headingIdx + 1; j < lines.length; j++) {
      if (lines[j].startsWith("## ")) { end = j - 1; break; }
    }
    return { start: i, end };
  }
  return null;
}
