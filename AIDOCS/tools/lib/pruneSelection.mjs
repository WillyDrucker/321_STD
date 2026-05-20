// pruneSelection.mjs - pure algorithms that decide WHICH LIFO bullets and
// EXTENDED sub-sections a prune drops. No I/O. The prune command (prune.mjs)
// owns file reads / writes / archive; this module owns the bottom-up drop walk.
//
// Four strategies:
//   prunePaired              - main + EXTENDED together (memory / session). Drops
//                              bottom-most main bullets and pulls their anchored
//                              EXTENDED sub-section alongside.
//   pruneExtendedReverseOrphan - EXTENDED sub-sections with no inbound main
//                              reference, after the paired pass.
//   pruneTopLevel            - main-file only (no EXTENDED partner).
//   pruneExtended            - EXTENDED-only bottom-up drop.
//
// Protected from every strategy: static MEMORY sections, SESSION Current State,
// the `**Last State:**` marker, `<!-- LOAD_BEARING -->` sub-sections, and the
// top-N freshest items from the triggering commit (protectedTop* counts).

import {
  bulletExtendedAnchor, enumerateLifoSubsections, enumerateTopLevelSections,
  escapeRegExp, normalizeForMatch, slugify,
} from "./markdown.mjs";
import { STATIC_SECTIONS } from "./paths.mjs";

const STATIC_PROTECTED = new Set(STATIC_SECTIONS.map(s => normalizeForMatch(s)));

export function prunePaired(mainContent, extendedContent, mainPruneTo, extPruneTo, allowedSlugs, extendedFilename, protectedTopMain, protectedTopExt) {
  const allowed = new Set(allowedSlugs.map(s => normalizeForMatch(s)));
  const dropped = [];

  const workingMain = mainContent.split("\n");
  const workingExtended = extendedContent.split("\n");

  // Drops pairs until BOTH files reach their prune_to. Two cases per iteration:
  //   main over  - drop the bottom-most prunable main bullet (pulling its
  //                anchored extended sub-section when droppable). Reduces main,
  //                and reduces extended whenever the bullet was anchored.
  //   extended-only over - the only way the pair link reduces extended is by
  //                dropping an anchored bullet whose sub-section can drop. So
  //                skip unanchored / protected-anchor bullets here: archiving
  //                them would lose a main bullet without shrinking extended.
  //                Walk up to the bottom-most bullet that DOES help; if none,
  //                stop and let the caller's reverse-orphan pass handle the rest.
  const sections = enumerateTopLevelSections(workingMain);
  for (const section of [...sections].reverse()) {
    const slug = normalizeForMatch(section.name);
    if (STATIC_PROTECTED.has(slug)) continue;
    if (slug === "current_state") continue;
    if (!allowed.has(slug)) continue;

    while (workingMain.length > mainPruneTo || workingExtended.length > extPruneTo) {
      const mainOver = workingMain.length > mainPruneTo;
      const sec = enumerateTopLevelSections(workingMain).find(s => s.name === section.name);
      if (!sec) break;
      const protectedLines = topNBulletLineIndices(workingMain, sec, protectedTopMain);

      // Pick the bullet to drop. When main is over, the bottom-most prunable
      // bullet wins outright. When only extended is over, walk up past bullets
      // that would not reduce extended until one whose sub-section can drop.
      let bullet = null;
      let target = null;
      const skip = new Set(protectedLines);
      for (;;) {
        const candidate = findBottomBullet(workingMain, sec, skip);
        if (!candidate) break;
        const candAnchor = bulletExtendedAnchor(workingMain[candidate.start], extendedFilename);
        const candTarget = candAnchor ? resolveDroppableSub(workingExtended, candAnchor, protectedTopExt) : null;
        if (mainOver || candTarget) {
          bullet = candidate;
          target = candTarget;
          break;
        }
        for (let i = candidate.start; i <= candidate.end; i++) skip.add(i);
      }
      if (!bullet) break;

      const removedBullet = workingMain.splice(bullet.start, bullet.end - bullet.start + 1);
      const entry = {
        section: section.name,
        label: removedBullet[0].slice(0, 80),
        mainLines: removedBullet,
        extendedAnchor: null,
        extendedHeading: null,
        extendedLines: null,
      };

      if (target) {
        const removedSub = workingExtended.splice(target.start, target.end - target.start + 1);
        entry.extendedAnchor = slugify(target.heading);
        entry.extendedHeading = target.heading;
        entry.extendedLines = removedSub;
      }
      // Main-over case with an unanchored / protected-anchor bullet: bullet
      // still drops (it reduces main), sub-section stays untouched.

      dropped.push(entry);
    }
    if (workingMain.length <= mainPruneTo && workingExtended.length <= extPruneTo) break;
  }

  return { dropped, keptMain: workingMain.join("\n"), keptExtended: workingExtended.join("\n") };
}

export function pruneExtendedReverseOrphan(content, prune_to, referencedAnchors, protectedTopExt) {
  const dropped = [];
  const working = content.split("\n");

  while (working.length > prune_to) {
    const subSections = enumerateLifoSubsections(working);
    if (subSections.length === 0) break;
    const protectedLines = topNSubsectionLineIndices(working, protectedTopExt);

    let droppedThisPass = false;
    for (const section of [...subSections].reverse()) {
      if (section.loadBearing) continue;
      if (rangeIntersects(section.start, section.end, protectedLines)) continue;
      const slug = slugify(section.heading);
      if (referencedAnchors.has(slug)) continue;

      const removed = working.splice(section.start, section.end - section.start + 1);
      dropped.push({
        section: section.heading,
        label: `(reverse-orphan) ${section.heading.slice(0, 60)}`,
        mainLines: null,
        extendedAnchor: slug,
        extendedHeading: section.heading,
        extendedLines: removed,
      });
      droppedThisPass = true;
      break;
    }
    if (!droppedThisPass) break;
  }

  return { dropped, kept: working.join("\n") };
}

export function pruneTopLevel(content, prune_to, allowedSlugs, protectedTopMain = 0) {
  const allowed = new Set(allowedSlugs.map(s => normalizeForMatch(s)));
  const dropped = [];
  const working = content.split("\n");

  const sections = enumerateTopLevelSections(working);
  for (const section of [...sections].reverse()) {
    const slug = normalizeForMatch(section.name);
    if (STATIC_PROTECTED.has(slug)) continue;
    if (slug === "current_state") continue;
    if (!allowed.has(slug)) continue;
    while (working.length > prune_to) {
      const sec = enumerateTopLevelSections(working).find(s => s.name === section.name);
      if (!sec) break;
      const protectedLines = topNBulletLineIndices(working, sec, protectedTopMain);
      const bullet = findBottomBullet(working, sec, protectedLines);
      if (!bullet) break;
      const removed = working.splice(bullet.start, bullet.end - bullet.start + 1);
      dropped.push({ section: section.name, label: removed[0].slice(0, 80), lines: removed });
    }
    if (working.length <= prune_to) break;
  }

  return { dropped, kept: working.join("\n") };
}

export function pruneExtended(content, prune_to, protectedTopExt = 0) {
  const dropped = [];
  const working = content.split("\n");

  while (working.length > prune_to) {
    const subSections = enumerateLifoSubsections(working);
    if (subSections.length === 0) break;
    const protectedLines = topNSubsectionLineIndices(working, protectedTopExt);

    let droppedThisPass = false;
    for (const section of [...subSections].reverse()) {
      if (section.loadBearing) continue;
      if (rangeIntersects(section.start, section.end, protectedLines)) continue;
      const removed = working.splice(section.start, section.end - section.start + 1);
      dropped.push({ section: section.heading, label: section.heading.slice(0, 80), lines: removed });
      droppedThisPass = true;
      break;
    }
    if (!droppedThisPass) break;
  }

  return { dropped, kept: working.join("\n") };
}

// Walk a section's bullets bottom-up, returning the first prunable one. Skips
// the `**Last State:**` marker (boundary anchor, engine-protected) and any
// fresh-protected line.
function findBottomBullet(lines, section, protectedLines) {
  for (let i = Math.min(section.end, lines.length - 1); i >= section.start; i--) {
    if (!lines[i].startsWith("- ")) continue;
    if (lines[i].startsWith("- **Last State:** ")) continue;
    if (protectedLines?.has(i)) continue;
    let end = i;
    while (end + 1 < lines.length) {
      const next = lines[end + 1];
      if (next.startsWith("- ") || next.startsWith("#") || next.trim() === "") break;
      end++;
    }
    return { start: i, end };
  }
  return null;
}

// Line indices covering the top N bullets (each `- ...` line + continuations).
function topNBulletLineIndices(lines, section, n) {
  const protected_ = new Set();
  if (!n || n <= 0) return protected_;
  let count = 0;
  let i = section.start + 1;
  while (i <= section.end && count < n) {
    if (lines[i].startsWith("- ")) {
      protected_.add(i);
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (next.startsWith("- ") || next.startsWith("#") || next.trim() === "") break;
        protected_.add(j);
        j++;
      }
      count++;
      i = j;
    } else {
      i++;
    }
  }
  return protected_;
}

// Line indices covering the top N `### sub-section`s under `## LIFO`.
function topNSubsectionLineIndices(lines, n) {
  const protected_ = new Set();
  if (!n || n <= 0) return protected_;
  const subSections = enumerateLifoSubsections(lines);
  const limit = Math.min(n, subSections.length);
  for (let k = 0; k < limit; k++) {
    const s = subSections[k];
    for (let i = s.start; i <= s.end; i++) protected_.add(i);
  }
  return protected_;
}

function rangeIntersects(start, end, lineSet) {
  if (!lineSet || lineSet.size === 0) return false;
  for (let i = start; i <= end; i++) {
    if (lineSet.has(i)) return true;
  }
  return false;
}

// Resolve an anchor to its EXTENDED sub-section bounds, or null when it cannot
// drop (missing, load-bearing, or inside the fresh-protected top N). Used to
// decide whether dropping a main bullet would actually reduce extended.
function resolveDroppableSub(workingExtended, anchor, protectedTopExt) {
  const protectedExtLines = topNSubsectionLineIndices(workingExtended, protectedTopExt);
  const target = enumerateLifoSubsections(workingExtended).find(s => slugify(s.heading) === anchor);
  if (!target || target.loadBearing) return null;
  if (rangeIntersects(target.start, target.end, protectedExtLines)) return null;
  return target;
}

// Collect anchors still referenced by main-file bullets, so reverse-orphan
// cleanup spares any EXTENDED sub-section that a surviving bullet points to.
export function collectReferencedAnchors(mainContent, extendedFilename) {
  const anchors = new Set();
  for (const line of mainContent.split("\n")) {
    const a = bulletExtendedAnchor(line, extendedFilename);
    if (a) anchors.add(a);
  }
  // Legacy inline links anywhere (not only at bullet start) - backward compat.
  const re = new RegExp(`\\(${escapeRegExp(extendedFilename)}#([a-z0-9-]+)\\)`, "g");
  for (const match of mainContent.matchAll(re)) anchors.add(match[1]);
  return anchors;
}
