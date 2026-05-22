// mutatorsExtended.mjs - pure mutators for the EXTENDED files (SESSION_EXTENDED /
// MEMORY_EXTENDED). Owns the `### sub-section`-under-`## LIFO` CRUD: add (newest
// first, placeholder-aware), drop, and replace (drop then add). A sub-section
// heading slugifies to the anchor a main-file [+] bullet derives, so the two pair
// without a written link. Pure - commit simulates every op, then writes.

import { bulletExtendedAnchor, findLifoSubsectionBounds, findSectionBounds, headingFromSlug, isPlaceholderBody, slugify } from "./markdown.mjs";

export function applyExtendedAction(content, action) {
  if (action.op === "add") return addLifoSubsection(content, action.anchor, action.heading, action.body_md);
  if (action.op === "drop") return dropLifoSubsection(content, action.anchor);
  if (action.op === "replace") return replaceLifoSubsection(content, action.anchor, action.heading, action.body_md);
  throw new Error(`unknown extended op "${action.op}"`);
}

// Insert a `### heading` sub-section at the top of ## LIFO (newest first),
// replacing a placeholder body on the first add. Throws if the anchor exists.
function addLifoSubsection(content, anchor, heading, body) {
  const headingText = heading || headingFromSlug(anchor);
  const lines = content.split("\n");
  const lifo = findSectionBounds(lines, "lifo");
  if (!lifo) throw new Error('add: EXTENDED file is missing the "## LIFO" heading');
  if (findLifoSubsectionBounds(lines, anchor)) throw new Error(`add: anchor "${anchor}" already exists under ## LIFO - use replace`);
  const bodyText = lines.slice(lifo.startIdx + 1, lifo.endIdx).join("\n").trim();
  const block = [`### ${headingText}`, "", body, ""];
  if (isPlaceholderBody(bodyText)) {
    return [...lines.slice(0, lifo.startIdx + 1), "", ...block, ...lines.slice(lifo.endIdx)].join("\n");
  }
  let insertIdx = lifo.startIdx + 1;
  while (insertIdx < lifo.endIdx && lines[insertIdx].trim() === "") insertIdx++;
  return [...lines.slice(0, insertIdx), ...block, ...lines.slice(insertIdx)].join("\n");
}

function dropLifoSubsection(content, anchor) {
  const lines = content.split("\n");
  const bounds = findLifoSubsectionBounds(lines, anchor);
  if (!bounds) throw new Error(`drop: anchor "${anchor}" not found under ## LIFO`);
  return [...lines.slice(0, bounds.startIdx), ...lines.slice(bounds.endIdx)].join("\n");
}

function replaceLifoSubsection(content, anchor, heading, body) {
  return addLifoSubsection(dropLifoSubsection(content, anchor), anchor, heading, body);
}

// Every `[+]` bullet in the main file must have a matching `### sub-section` under
// the EXTENDED file's `## LIFO`. Returns an error per [+] bullet whose anchor has
// no sub-section. Run on the simulated (post-op) content so a bullet and its
// sub-section added in the same commit pair cleanly.
export function findOrphanBullets(mainContent, extendedContent) {
  const used = [];
  for (const line of mainContent.split("\n")) {
    const anchor = bulletExtendedAnchor(line);
    if (anchor) used.push(anchor);
  }
  if (used.length === 0) return [];
  const available = new Set();
  const extLines = extendedContent.split("\n");
  const lifo = findSectionBounds(extLines, "lifo");
  if (lifo) {
    for (let i = lifo.startIdx + 1; i < lifo.endIdx; i++) {
      const m = extLines[i].match(/^###\s+(.+?)\s*$/);
      if (m) available.add(slugify(m[1]));
    }
  }
  const errors = [];
  for (const anchor of used) {
    if (!available.has(anchor)) errors.push(`orphan [+] bullet: anchor "${anchor}" has no matching ### sub-section`);
  }
  return errors;
}
