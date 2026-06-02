// prune.mjs - post-commit auto-prune. Either side of a main + EXTENDED pair over its
// line cap drops bullet/sub-section pairs bottom-up (oldest first) until BOTH lanes
// sit at or under their prune_to, or only protected bullets remain. Pairs are archived
// together under one timestamp into AIDOCS/<NAME>_<LANE>_ARCHIVE/ - the bullets land in
// <YYYYMMDD-HHMM>_<NAME>_<LANE>.md, the matching sub-sections in the paired _EXTENDED.md,
// so the archive reads one pass as one event. This commit's fresh bullets and the
// **Last State:** marker are protected, so new entries never archive on landing.
// The folder is created on the fly. Existing flat-file archives from earlier engines are
// not migrated - they stay on disk as part of the recovery net.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { bulletExtendedAnchor, findLifoSubsectionBounds, findSectionBounds } from "./markdown.mjs";
import { resolveFile } from "./paths.mjs";

// YYYYMMDD-HHMM in local time, the user-readable canonical archive stamp. Local time
// because humans read these filenames, not UTC. Same stamp is shared by the main +
// extended files written in one prune pass so the pair is rejoinable by filename.
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// Remove a `### sub-section` by anchor, returning the new content and the removed
// block (trimmed) for the archive, or removed: null when the anchor is absent.
function removeSubsection(content, anchor) {
  const lines = content.split("\n");
  const b = findLifoSubsectionBounds(lines, anchor);
  if (!b) return { content, removed: null };
  const removed = lines.slice(b.startIdx, b.endIdx).join("\n").trim();
  return { content: [...lines.slice(0, b.startIdx), ...lines.slice(b.endIdx)].join("\n"), removed };
}

// Pure: drop bullet/sub-section pairs bottom-up until BOTH main and extended sit at or
// below their prune_to (or only protected bullets remain). Either side over its cap
// triggers the loop. extended is null for a lane with no paired _extended file, and
// extCap/extPruneTo may be absent (the OR clause then short-circuits on main only).
// Returns { main, extended, bullets, subsections } - bullets in archive order, the
// matching sub-sections in the same order. null when nothing needed pruning.
function trim(main, extended, mainCap, mainPruneTo, extCap, extPruneTo, isProtected) {
  const mainStart = main.split("\n").length;
  const extStart = extended != null ? extended.split("\n").length : 0;
  const mainOver = mainStart > mainCap;
  const extOver = extended != null && extCap != null && extStart > extCap;
  if (!mainOver && !extOver) return null;

  const lines = main.split("\n");
  let ext = extended;
  const bullets = [];
  const subsections = [];
  while (true) {
    const stillMainOver = lines.length > mainPruneTo;
    const stillExtOver = extended != null && extPruneTo != null && ext != null && ext.split("\n").length > extPruneTo;
    if (!stillMainOver && !stillExtOver) break;
    const lifo = findSectionBounds(lines, "lifo");
    if (!lifo) break;
    // When only extended is over cap, dropping a main bullet that has no anchor would
    // shrink main without reducing extended at all - the prune would never converge on
    // extended. Target the bottom-most anchored ([+]) bullet so the paired sub-section
    // comes with it. When main is over cap, any unprotected bullet reduces main, so the
    // anchor filter is dropped.
    const extOnly = !stillMainOver && stillExtOver;
    let dropIdx = -1;
    for (let i = lifo.endIdx - 1; i > lifo.startIdx; i--) {
      if (!lines[i].startsWith("- ") || isProtected(lines[i])) continue;
      if (extOnly && !bulletExtendedAnchor(lines[i])) continue;
      dropIdx = i;
      break;
    }
    if (dropIdx === -1) break;
    const bullet = lines[dropIdx];
    lines.splice(dropIdx, 1);
    bullets.push(bullet);
    const anchor = bulletExtendedAnchor(bullet);
    if (anchor && ext != null) {
      const r = removeSubsection(ext, anchor);
      ext = r.content;
      if (r.removed) subsections.push(r.removed);
    }
  }
  if (bullets.length === 0) return null;
  return { main: lines.join("\n"), extended: ext, bullets, subsections };
}

const ARCHIVE_HEADER = "# Archive\n\n**Purpose:** Pruned LIFO overflow paired with its extended counterpart, kept as the recovery net. Each datestamped file in this folder is one auto-prune pass - main bullets in one file, the matching sub-sections in its _EXTENDED twin under the same stamp.\n";

// Write a fresh archive file with the header, or append a new dated section when the
// same timestamp file already exists (a same-minute re-prune, rare but supported).
function appendOrCreate(path, stamp, body) {
  if (existsSync(path)) appendFileSync(path, `\n## ${stamp} (additional)\n\n${body}\n`, "utf8");
  else writeFileSync(path, `${ARCHIVE_HEADER}\n## ${stamp}\n\n${body}\n`, "utf8");
}

export function autoPrune(index, editedKeys, fresh) {
  const isProtected = (line) => line.startsWith("- **Last State:**") || fresh.has(line);
  // Either lane being edited brings the pair under scrutiny - an extended edit can push
  // the pair over its cap even when main is untouched, so its main key still gets a check.
  const mainKeys = new Set();
  for (const key of editedKeys) {
    if (key.endsWith("_extended")) {
      const m = key.replace(/_extended$/, "");
      if (index.files?.[m] && index.sizes?.[m]) mainKeys.add(m);
    } else if (index.sizes?.[key]) {
      mainKeys.add(key);
    }
  }
  const stamp = timestamp();
  for (const key of mainKeys) {
    const size = index.sizes[key];
    if (!size?.cap) continue;
    const mainPath = resolveFile(index, key);
    const extKey = `${key}_extended`;
    const extPath = index.files?.[extKey] ? resolveFile(index, extKey) : null;
    const extSize = index.sizes?.[extKey];
    const ext = extPath && existsSync(extPath) ? readFileSync(extPath, "utf8") : null;
    const r = trim(
      readFileSync(mainPath, "utf8"),
      ext,
      size.cap,
      size.prune_to,
      extSize?.cap,
      extSize?.prune_to,
      isProtected,
    );
    if (!r) continue;
    // Archive before removing from the live files - same "move, not delete" recovery-net
    // contract as migrate-archive. A failed write leaves the over-cap content in place
    // (a warning, never a loss), and a write failure after a good archive at worst
    // duplicates into the recovery file, which is recoverable.
    const archiveDir = mainPath.replace(/\.md$/, "_ARCHIVE");
    mkdirSync(archiveDir, { recursive: true });
    const mainArchive = join(archiveDir, `${stamp}_${basename(mainPath)}`);
    appendOrCreate(mainArchive, stamp, r.bullets.join("\n"));
    if (extPath && r.subsections.length) {
      const extArchive = join(archiveDir, `${stamp}_${basename(extPath)}`);
      appendOrCreate(extArchive, stamp, r.subsections.join("\n\n"));
    }
    writeFileSync(mainPath, r.main, "utf8");
    if (extPath && r.extended != null) writeFileSync(extPath, r.extended, "utf8");
    const folderName = archiveDir.split(/[\\/]/).pop();
    console.log(`commit: pruned ${r.bullets.length} entr${r.bullets.length === 1 ? "y" : "ies"} from ${key} into ${folderName}/${stamp}_* (move, not delete).`);
  }
}
