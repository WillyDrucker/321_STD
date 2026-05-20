// mutatorsExtended.mjs - pure mutators for the EXTENDED files (MEMORY_EXTENDED /
// SESSION_EXTENDED). Owns the `### sub-section`-under-`## LIFO` CRUD, the
// EXTENDED Big-6 mirror gap-fill, and the main-to-EXTENDED orphan-link check.
// Split from mutators.mjs (which owns main-file MEMORY / SESSION / BACKLOG ops)
// so each file owns one mutation domain. All functions pure; throw on
// irrecoverable conditions for the two-phase commit to collect.

import {
  bulletExtendedAnchor,
  escapeRegExp,
  findDecisionsSubsectionBounds,
  findLifoSubsectionBounds,
  findSectionBounds,
  headingFromSlug,
  isPlaceholderBody,
  slugify,
} from "./markdown.mjs";
import { decisionsHeadingFor, STATIC_SECTIONS } from "./paths.mjs";

export function applyExtendedAction(content, ea) {
  switch (ea.op) {
    case "add":          return addLifoSubsection(content, ea.anchor, ea.heading, ea.body_md);
    case "drop":         return dropLifoSubsection(content, ea.anchor);
    case "replace":      return replaceLifoSubsection(content, ea.anchor, ea.heading, ea.body_md);
    case "replace_text": return replaceTextInLifoSubsection(content, ea.anchor, ea.find, ea.replace);
    default: throw new Error(`Unknown extended action op: ${ea.op}`);
  }
}

// Insert a new sub-section anchor at the TOP of the LIFO heading (newest-first).
// Handles the placeholder-body replacement on first add.
function addLifoSubsection(content, anchor, heading, body) {
  const headingText = heading || headingFromSlug(anchor);
  const lines = content.split("\n");
  const lifoBounds = findSectionBounds(lines, "lifo");
  if (!lifoBounds) {
    throw new Error('add: EXTENDED file is missing the "## LIFO" H2');
  }

  const existing = findLifoSubsectionBounds(lines, anchor);
  if (existing) {
    throw new Error(`add: sub-section anchor "${anchor}" already exists under ## LIFO. Use replace instead.`);
  }

  const bodyText = lines.slice(lifoBounds.startIdx + 1, lifoBounds.endIdx).join("\n").trim();
  const block = [`### ${headingText}`, "", body, ""];

  if (isPlaceholderBody(bodyText)) {
    return [
      ...lines.slice(0, lifoBounds.startIdx + 1),
      "",
      ...block,
      ...lines.slice(lifoBounds.endIdx),
    ].join("\n");
  }

  let insertIdx = lifoBounds.startIdx + 1;
  while (insertIdx < lifoBounds.endIdx && lines[insertIdx].trim() === "") insertIdx++;
  return [
    ...lines.slice(0, insertIdx),
    ...block,
    ...lines.slice(insertIdx),
  ].join("\n");
}

function dropLifoSubsection(content, anchor) {
  const lines = content.split("\n");
  const bounds = findLifoSubsectionBounds(lines, anchor);
  if (!bounds) throw new Error(`drop: sub-section anchor "${anchor}" not found under ## LIFO`);
  return [...lines.slice(0, bounds.startIdx), ...lines.slice(bounds.endIdx)].join("\n");
}

function replaceLifoSubsection(content, anchor, heading, body) {
  let updated = dropLifoSubsection(content, anchor);
  updated = addLifoSubsection(updated, anchor, heading, body);
  return updated;
}

// Strict-uniqueness substring swap within a sub-section anchor's body.
function replaceTextInLifoSubsection(content, anchor, find, replace) {
  const lines = content.split("\n");
  const bounds = findLifoSubsectionBounds(lines, anchor);
  if (!bounds) throw new Error(`replace_text: sub-section anchor "${anchor}" not found under ## LIFO`);

  const bodyLines = lines.slice(bounds.startIdx + 1, bounds.endIdx);
  const body = bodyLines.join("\n");

  const occurrences = [];
  let pos = body.indexOf(find);
  while (pos !== -1) {
    occurrences.push(pos);
    pos = body.indexOf(find, pos + find.length);
  }

  if (occurrences.length === 0) {
    throw new Error(`replace_text: "find" not found in anchor "${anchor}". Body has ${body.length} chars.`);
  }
  if (occurrences.length > 1) {
    const locations = occurrences.map(occPos => {
      const lineOffset = body.substring(0, occPos).split("\n").length - 1;
      const lineNo = bounds.startIdx + 2 + lineOffset;
      const lineText = bodyLines[lineOffset] || "";
      const snippet = lineText.length > 70 ? `${lineText.slice(0, 67)}...` : lineText;
      return `    line ${lineNo}: ${snippet.trim()}`;
    });
    throw new Error(
      `replace_text: "find" matched ${occurrences.length} times in anchor "${anchor}" (expected 1). Locations:\n${locations.join("\n")}\nAdd surrounding context to make the match unique.`
    );
  }

  const newBody = body.substring(0, occurrences[0]) + replace + body.substring(occurrences[0] + find.length);
  return [
    ...lines.slice(0, bounds.startIdx + 1),
    ...newBody.split("\n"),
    ...lines.slice(bounds.endIdx),
  ].join("\n");
}

// Fill the MEMORY_EXTENDED mirror section + Decisions sub-section. Called by
// commit.mjs when a gap_fill_section action carries extended_body_md /
// extended_decisions_md.
export function gapFillSectionExtended(content, targetSection, extendedBodyMd, extendedDecisionsMd) {
  if (!STATIC_SECTIONS.includes(targetSection)) {
    throw new Error(`gap_fill_section_extended target "${targetSection}" not a valid static section`);
  }

  const lines = content.split("\n");
  const bounds = findSectionBounds(lines, targetSection);
  if (!bounds) {
    throw new Error(`gap_fill_section_extended: target section "${targetSection}" not found in EXTENDED file`);
  }

  let updated = content;
  if (extendedBodyMd?.trim()) {
    const bodyBlock = ["", extendedBodyMd.trim(), ""];
    updated = [
      ...lines.slice(0, bounds.startIdx + 1),
      ...bodyBlock,
      ...lines.slice(bounds.endIdx),
    ].join("\n");
  }

  if (extendedDecisionsMd?.trim()) {
    const decisionsHeading = decisionsHeadingFor(targetSection);
    const newLines = updated.split("\n");
    const refreshedBounds = findSectionBounds(newLines, targetSection);
    if (!refreshedBounds) throw new Error(`gap_fill_section_extended: target section "${targetSection}" lost after body write`);
    const existing = findDecisionsSubsectionBounds(newLines, targetSection, decisionsHeading);
    if (existing) {
      const headBlock = [newLines[existing.startIdx], ""];
      const bodyBlock = [extendedDecisionsMd.trim(), ""];
      updated = [
        ...newLines.slice(0, existing.startIdx),
        ...headBlock,
        ...bodyBlock,
        ...newLines.slice(existing.endIdx),
      ].join("\n");
    } else {
      const block = ["", `### ${decisionsHeading}`, "", extendedDecisionsMd.trim(), ""];
      let insertIdx = refreshedBounds.endIdx;
      while (insertIdx > refreshedBounds.startIdx + 1 && newLines[insertIdx - 1].trim() === "") insertIdx--;
      updated = [
        ...newLines.slice(0, insertIdx),
        ...block,
        ...newLines.slice(insertIdx),
      ].join("\n");
    }
  }

  return updated;
}

// Cross-reference check: every link from the main file into the EXTENDED file
// must resolve to a sub-section heading under the EXTENDED file's `## LIFO`.
// Scoped to the EXTENDED filename so unrelated cross-file links (e.g. WDDOCS,
// design docs) don't false-positive. Returns an array of error strings for
// orphan links; empty array if all links resolve.
export function findOrphanLinks(simMain, simExtended, extendedFilename) {
  const errors = [];
  const linksUsed = new Set();
  // `[+]` bullets (anchor = slug of bullet text) and line-start legacy links,
  // via the shared parser - the one canonical home for bullet-to-anchor logic.
  for (const line of simMain.split("\n")) {
    const anchor = bulletExtendedAnchor(line, extendedFilename);
    if (anchor) linksUsed.add(anchor);
  }
  // Legacy inline links `[text](<extended>#anchor)` mid-line too - backward compat.
  const linkRe = new RegExp(`\\[[^\\]]+\\]\\(${escapeRegExp(extendedFilename)}#([a-z0-9-]+)\\)`, "g");
  for (const m of simMain.matchAll(linkRe)) linksUsed.add(m[1]);

  const extLines = simExtended.split("\n");
  const lifoBounds = findSectionBounds(extLines, "lifo");
  const anchorsAvailable = new Set();
  if (lifoBounds) {
    for (let i = lifoBounds.startIdx + 1; i < lifoBounds.endIdx; i++) {
      const m = extLines[i].match(/^###\s+(.+?)\s*$/);
      if (m) anchorsAvailable.add(slugify(m[1]));
    }
  }

  for (const anchor of linksUsed) {
    if (!anchorsAvailable.has(anchor)) {
      errors.push(`orphan anchor: main-file bullet references EXTENDED anchor "${anchor}" but no matching ### sub-section exists under ## LIFO in the simulated EXTENDED file. Add an extended_actions entry (op:add) for "${anchor}", or drop the extended_anchor.`);
    }
  }
  return errors;
}
