// prune.mjs - post-commit auto-prune. A main LIFO file over its line cap drops its
// oldest bullets (bottom of LIFO) down toward prune_to, pairing each dropped [+]
// bullet with its EXTENDED sub-section and archiving both to <file>_ARCHIVE.md
// (move, not delete - the recovery net). This commit's fresh bullets and the
// **Last State:** marker are protected, so new entries never archive on landing.
// Main-cap driven: the EXTENDED file shrinks with its paired bullets.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

import { bulletExtendedAnchor, findLifoSubsectionBounds, findSectionBounds } from "./markdown.mjs";
import { resolveFile } from "./paths.mjs";

// Remove a `### sub-section` by anchor, returning the new content and the removed
// block (trimmed) for the archive, or removed: null when the anchor is absent.
function removeSubsection(content, anchor) {
  const lines = content.split("\n");
  const b = findLifoSubsectionBounds(lines, anchor);
  if (!b) return { content, removed: null };
  const removed = lines.slice(b.startIdx, b.endIdx).join("\n").trim();
  return { content: [...lines.slice(0, b.startIdx), ...lines.slice(b.endIdx)].join("\n"), removed };
}

// Pure: drop oldest droppable bullets (bottom-up) until main is at or under
// prune_to or only protected bullets remain. Returns { main, extended, archived }
// or null when nothing pruned.
function trim(main, extended, cap, pruneTo, isProtected) {
  const lines = main.split("\n");
  if (lines.length <= cap) return null;
  let ext = extended;
  const archived = [];
  while (lines.length > pruneTo) {
    const lifo = findSectionBounds(lines, "lifo");
    if (!lifo) break;
    let dropIdx = -1;
    for (let i = lifo.endIdx - 1; i > lifo.startIdx; i--) {
      if (lines[i].startsWith("- ") && !isProtected(lines[i])) { dropIdx = i; break; }
    }
    if (dropIdx === -1) break;
    const bullet = lines[dropIdx];
    lines.splice(dropIdx, 1);
    const anchor = bulletExtendedAnchor(bullet);
    let body = null;
    if (anchor && ext != null) { const r = removeSubsection(ext, anchor); ext = r.content; body = r.removed; }
    archived.push(body ? `${bullet}\n\n${body}` : bullet);
  }
  if (archived.length === 0) return null;
  return { main: lines.join("\n"), extended: ext, archived };
}

export function autoPrune(index, editedKeys, fresh) {
  const isProtected = (line) => line.startsWith("- **Last State:**") || fresh.has(line);
  for (const key of editedKeys) {
    if (key.endsWith("_extended")) continue;
    const size = index.sizes?.[key];
    if (!size) continue;
    const mainPath = resolveFile(index, key);
    const extKey = `${key}_extended`;
    const extPath = index.files?.[extKey] ? resolveFile(index, extKey) : null;
    const ext = extPath && existsSync(extPath) ? readFileSync(extPath, "utf8") : null;
    const r = trim(readFileSync(mainPath, "utf8"), ext, size.cap, size.prune_to, isProtected);
    if (!r) continue;
    // Archive before removing from the live files, so a failed append leaves the over-cap
    // content in place (a warning, never a loss) - the "move, not delete" recovery-net
    // contract. A write failure after a good append at worst duplicates into the archive,
    // which is recoverable, where the reverse order would lose the dropped entries.
    const archivePath = mainPath.replace(/\.md$/, "_ARCHIVE.md");
    const header = existsSync(archivePath) ? "" : "# Archive\n\n**Purpose:** Pruned LIFO overflow, kept as the recovery net. Appended as files pass their cap.\n";
    appendFileSync(archivePath, `${header}\n${r.archived.join("\n\n")}\n`, "utf8");
    writeFileSync(mainPath, r.main, "utf8");
    if (extPath && r.extended != null) writeFileSync(extPath, r.extended, "utf8");
    console.log(`commit: pruned ${r.archived.length} entr${r.archived.length === 1 ? "y" : "ies"} from ${key} into ${archivePath.split(/[\\/]/).pop()} (move, not delete).`);
  }
}
