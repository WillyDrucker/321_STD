// mutators.mjs - main-file mutators for MEMORY / SESSION / BACKLOG. Owns the
// LIFO + Current State bullet ops, the MEMORY Big-6 static-section ops (promote /
// gap-fill / update), and the BACKLOG ops. EXTENDED-file mutators live in
// mutatorsExtended.mjs. All functions are pure (content + intent -> content) and
// throw Error on irrecoverable conditions so the caller's two-phase commit can
// collect and report all simulation errors before any file write.

import {
  findDecisionsSubsectionBounds,
  findSectionBounds,
  isPlaceholderBody,
} from "./markdown.mjs";
import { BACKLOG_SECTIONS, decisionsHeadingFor, STATIC_SECTIONS } from "./paths.mjs";

// ---------- main file dispatcher ----------

export function applyAction(content, action) {
  // Presence of extended_anchor means the bullet has a paired EXTENDED
  // sub-section. It renders as a `[+]` marker (no link). The orphan check and
  // paired prune re-derive the anchor from the bullet text via slugify, so the
  // bullet text and its `### heading` must stay in sync.
  const hasExtended = !!action.extended_anchor;
  switch (action.op) {
    case "overwrite_section":
      if (action.section === "current_state") {
        return overwriteCurrentStateWithDemotion(content, action.bullets);
      }
      return overwriteSection(content, action.section, action.bullets);
    case "lifo_insert":           return lifoInsertBullet(content, action.section, action.bullet, hasExtended);
    case "remove":                return removeBullet(content, action.section, action.match);
    case "replace":               return replaceBulletText(content, action.section, action.match, action.bullet, hasExtended);
    case "promote_to_section":    return promoteLifoToSection(content, action.match, action.target_section, action.target_decisions === true);
    case "gap_fill_section":      return gapFillSection(content, action.target_section, action.body_md, action.decisions_md);
    case "update_section_text":   return updateSectionText(content, action.target_section, action.find, action.replace);
    default: throw new Error(`Unknown action op: ${action.op}`);
  }
}

// Current State demotion. On every overwrite of SESSION/Current State, the
// prior bullets demote into LIFO with a `**Last State:**` prefix on the first
// one. Any prior `**Last State:**` marker has its prefix stripped (content
// stays as a plain LIFO bullet for older history). Result: exactly one Last
// State marker in LIFO once any overwrite has happened, marking the boundary
// between "since last SessionUpdate" and earlier history. First-ever overwrite
// (placeholder body or empty Current State) skips demotion - no marker yet.
function overwriteCurrentStateWithDemotion(content, newBullets) {
  const lines = content.split("\n");
  const csBounds = findSectionBounds(lines, "current_state");
  if (!csBounds) throw new Error('Section "current_state" not found');

  const bodyText = lines.slice(csBounds.startIdx + 1, csBounds.endIdx).join("\n").trim();
  const hasLifo = findSectionBounds(lines, "lifo") !== null;
  if (isPlaceholderBody(bodyText) || !hasLifo) {
    return overwriteSection(content, "current_state", newBullets);
  }

  const priorBullets = [];
  for (let i = csBounds.startIdx + 1; i < csBounds.endIdx; i++) {
    if (lines[i].startsWith("- ")) priorBullets.push(lines[i].slice(2));
  }
  if (priorBullets.length === 0) {
    return overwriteSection(content, "current_state", newBullets);
  }

  let result = stripLastStateMarker(content);
  result = overwriteSection(result, "current_state", newBullets);
  for (let i = priorBullets.length - 1; i >= 0; i--) {
    const bullet = i === 0 ? `**Last State:** ${priorBullets[i]}` : priorBullets[i];
    result = lifoInsertBullet(result, "lifo", bullet, false);
  }
  return result;
}

// Removes the `**Last State:** ` prefix from every matching LIFO bullet.
// Called before a fresh demotion so the new marker takes its place. The prior
// bullets' content stays in LIFO as older history. Strips ALL occurrences
// (not just the first) so manual edits that left duplicate markers heal on
// the next demotion - design promises exactly one marker after any overwrite.
function stripLastStateMarker(content) {
  const lines = content.split("\n");
  const bounds = findSectionBounds(lines, "lifo");
  if (!bounds) return content;
  const PREFIX = "- **Last State:** ";
  for (let i = bounds.startIdx + 1; i < bounds.endIdx; i++) {
    if (lines[i].startsWith(PREFIX)) {
      lines[i] = `- ${lines[i].slice(PREFIX.length)}`;
    }
  }
  return lines.join("\n");
}

// Overwrite a section body entirely. Used for SESSION/Current State (each pass).
// Preserves a trailing `---` divider (with surrounding blanks) immediately
// before the next ## section so the visual State/LIFO split survives overwrite.
function overwriteSection(content, section, bullets) {
  const lines = content.split("\n");
  const bounds = findSectionBounds(lines, section);
  if (!bounds) throw new Error(`Section "${section}" not found`);

  let bodyEnd = bounds.endIdx;
  for (let i = bounds.endIdx - 1; i > bounds.startIdx; i--) {
    if (lines[i].trim() === "") continue;
    if (lines[i].trim() === "---") bodyEnd = i;
    break;
  }

  const newBody = ["", ...bullets.map(b => `- ${b}`), ""];
  return [
    ...lines.slice(0, bounds.startIdx + 1),
    ...newBody,
    ...lines.slice(bodyEnd),
  ].join("\n");
}

// LIFO insert at top of named section. Handles placeholder-body replacement.
// hasExtended=true prefixes the bullet with the `[+]` marker (paired EXTENDED
// detail, found by matching the bullet text to its `### heading`). No URL.
function lifoInsertBullet(content, section, bullet, hasExtended) {
  const lines = content.split("\n");
  const bounds = findSectionBounds(lines, section);
  if (!bounds) throw new Error(`Section "${section}" not found`);
  const bodyText = lines.slice(bounds.startIdx + 1, bounds.endIdx).join("\n").trim();
  if (isPlaceholderBody(bodyText)) {
    const placeholder = hasExtended ? `[+] ${bullet}` : bullet;
    return overwriteSection(content, section, [placeholder]);
  }
  const bulletLine = hasExtended ? `- [+] ${bullet}` : `- ${bullet}`;
  let insertIdx = bounds.startIdx + 1;
  while (insertIdx < bounds.endIdx && lines[insertIdx].trim() === "") insertIdx++;
  return [
    ...lines.slice(0, insertIdx),
    bulletLine,
    ...lines.slice(insertIdx),
  ].join("\n");
}

// Strict-uniqueness bullet match within a section body. Returns the line index
// of the single `- ` bullet whose text contains matchText (case-insensitive).
// Throws with line-located hints on zero or many matches. `label` prefixes the
// error with the caller's context (op name / section). Shared by removeBullet
// and promoteLifoToSection so both produce identical match semantics.
function matchUniqueBulletIdx(lines, bounds, matchText, label) {
  const lower = matchText.toLowerCase();
  const matches = [];
  for (let i = bounds.startIdx + 1; i < bounds.endIdx; i++) {
    if (/^- /.test(lines[i]) && lines[i].toLowerCase().includes(lower)) matches.push(i);
  }
  if (matches.length === 0) {
    throw new Error(`${label}: no bullet matching "${matchText}"`);
  }
  if (matches.length > 1) {
    const locations = matches.map(i => {
      const snippet = lines[i].length > 70 ? `${lines[i].slice(0, 67)}...` : lines[i];
      return `    line ${i + 1}: ${snippet.trim()}`;
    });
    throw new Error(
      `${label}: "${matchText}" matched ${matches.length} bullets (expected 1). Locations:\n${locations.join("\n")}\nAdd more specific text to make the match unique.`
    );
  }
  return matches[0];
}

// Strict-uniqueness bullet removal. Substring must hit exactly one bullet.
function removeBullet(content, section, matchText) {
  const lines = content.split("\n");
  const bounds = findSectionBounds(lines, section);
  if (!bounds) throw new Error(`Section "${section}" not found`);
  const idx = matchUniqueBulletIdx(lines, bounds, matchText, `remove from "${section}"`);
  return [...lines.slice(0, idx), ...lines.slice(idx + 1)].join("\n");
}

function replaceBulletText(content, section, matchText, newBullet, hasExtended) {
  let updated = removeBullet(content, section, matchText);
  updated = lifoInsertBullet(updated, section, newBullet, hasExtended);
  return updated;
}

// ---------- promote_to_section ----------

// Move a LIFO bullet's text into a static section. Removes the LIFO bullet,
// inserts the content at the top of the target section's body (or under the
// qualified Decisions sub-section if target_decisions is true).
function promoteLifoToSection(content, matchText, targetSection, targetDecisions) {
  if (!STATIC_SECTIONS.includes(targetSection)) {
    throw new Error(`promote_to_section target "${targetSection}" not a valid static section (allowed: ${STATIC_SECTIONS.join(", ")})`);
  }

  const lines = content.split("\n");
  const lifoBounds = findSectionBounds(lines, "lifo");
  if (!lifoBounds) throw new Error('promote_to_section requires a "## LIFO" section in MEMORY');

  const matchIdx = matchUniqueBulletIdx(lines, lifoBounds, matchText, "promote_to_section");
  // Strip the `[+]` LIFO marker - it flags "has EXTENDED detail" in LIFO and has
  // no meaning in a static Big-6 section. Any EXTENDED sub-section stays as
  // free-standing depth (not a forward orphan).
  const bulletLine = lines[matchIdx].replace(/^(\s*)- \[\+\] /, "$1- ");
  const linesWithoutLifo = [...lines.slice(0, matchIdx), ...lines.slice(matchIdx + 1)];

  if (targetDecisions) {
    return insertIntoDecisionsSubsection(linesWithoutLifo, targetSection, bulletLine);
  }
  return insertIntoStaticSectionBody(linesWithoutLifo, targetSection, bulletLine);
}

function insertIntoStaticSectionBody(lines, sectionSlug, bulletLine) {
  const bounds = findSectionBounds(lines, sectionSlug);
  if (!bounds) {
    throw new Error(`promote_to_section: target section "${sectionSlug}" not found`);
  }
  const bodyText = lines.slice(bounds.startIdx + 1, bounds.endIdx).join("\n").trim();
  if (isPlaceholderBody(bodyText)) {
    const newBody = ["", bulletLine, ""];
    return [
      ...lines.slice(0, bounds.startIdx + 1),
      ...newBody,
      ...lines.slice(bounds.endIdx),
    ].join("\n");
  }
  let insertIdx = bounds.startIdx + 1;
  while (insertIdx < bounds.endIdx && lines[insertIdx].trim() === "") insertIdx++;
  return [
    ...lines.slice(0, insertIdx),
    bulletLine,
    ...lines.slice(insertIdx),
  ].join("\n");
}

function insertIntoDecisionsSubsection(lines, sectionSlug, bulletLine) {
  const decisionsHeading = decisionsHeadingFor(sectionSlug);
  const existing = findDecisionsSubsectionBounds(lines, sectionSlug, decisionsHeading);
  if (existing) {
    let insertIdx = existing.startIdx + 1;
    while (insertIdx < existing.endIdx && lines[insertIdx].trim() === "") insertIdx++;
    return [
      ...lines.slice(0, insertIdx),
      bulletLine,
      ...lines.slice(insertIdx),
    ].join("\n");
  }
  const sectionBounds = findSectionBounds(lines, sectionSlug);
  if (!sectionBounds) {
    throw new Error(`promote_to_section: target section "${sectionSlug}" not found`);
  }
  const block = ["", `### ${decisionsHeading}`, "", bulletLine, ""];
  let insertIdx = sectionBounds.endIdx;
  while (insertIdx > sectionBounds.startIdx + 1 && lines[insertIdx - 1].trim() === "") insertIdx--;
  return [
    ...lines.slice(0, insertIdx),
    ...block,
    ...lines.slice(insertIdx),
  ].join("\n");
}

// ---------- gap_fill_section ----------

// Fill an empty MEMORY static section. body_md becomes the section body.
// decisions_md, if provided, becomes the `### <Section> Decisions` sub-section body.
//
// The last static section (conventions) is bounded by `## LIFO`, so its region
// includes the `---` divider that sits before LIFO. Split that divider (and the
// blanks around it) off as a tail: the emptiness check then reads only the real
// body, the rewrite re-emits the divider instead of swallowing it, and the
// Decisions block lands before it. Mirrors the trailing-divider strip in
// doctor.mjs checkBig6Decisions. Non-last sections have an empty tail.
function gapFillSection(content, targetSection, bodyMd, decisionsMd) {
  if (!STATIC_SECTIONS.includes(targetSection)) {
    throw new Error(`gap_fill_section target "${targetSection}" not a valid static section (allowed: ${STATIC_SECTIONS.join(", ")})`);
  }

  const lines = content.split("\n");
  const bounds = findSectionBounds(lines, targetSection);
  if (!bounds) {
    throw new Error(`gap_fill_section: target section "${targetSection}" not found`);
  }

  // Find the real body end by walking back past trailing blanks and a `---`.
  let bodyEnd = bounds.endIdx;
  while (bodyEnd > bounds.startIdx + 1 && lines[bodyEnd - 1].trim() === "") bodyEnd--;
  if (bodyEnd > bounds.startIdx + 1 && lines[bodyEnd - 1].trim() === "---") {
    bodyEnd--;
    while (bodyEnd > bounds.startIdx + 1 && lines[bodyEnd - 1].trim() === "") bodyEnd--;
  }
  const tail = lines.slice(bodyEnd, bounds.endIdx);
  while (tail.length && tail[0].trim() === "") tail.shift(); // the block below supplies the separating blank

  const bodyText = lines.slice(bounds.startIdx + 1, bodyEnd).join("\n").trim();
  if (!isPlaceholderBody(bodyText) && bodyText.length > 0) {
    throw new Error(`gap_fill_section: target section "${targetSection}" is not empty. Use a different op for non-empty sections.`);
  }

  const block = ["", bodyMd.trim(), ""];
  if (decisionsMd?.trim()) {
    block.push(`### ${decisionsHeadingFor(targetSection)}`, "", decisionsMd.trim(), "");
  }

  return [
    ...lines.slice(0, bounds.startIdx + 1),
    ...block,
    ...tail,
    ...lines.slice(bounds.endIdx),
  ].join("\n");
}

// ---------- update_section_text ----------

// Surgical substring replacement inside a Big 6 section body (or its qualified
// Decisions sub-section) in MEMORY.md. Strict uniqueness on `find` - errors
// when 0 or >1 matches. Mode=full only (gated by validator). Used for refine
// ("Astro 4" -> "Astro 5") or replace ("uses Astro" -> "uses React") of named
// facts when SESSION / conversation surfaces a drift signal.
//
// The same function works on MEMORY_EXTENDED top-level static section bodies
// (same `## <Section>` heading structure). commit.mjs calls it on the EXTENDED
// content when extended_find / extended_replace are present on the action.
export function updateSectionText(content, sectionSlug, find, replace) {
  if (!STATIC_SECTIONS.includes(sectionSlug)) {
    throw new Error(`update_section_text: target "${sectionSlug}" not a valid static section (allowed: ${STATIC_SECTIONS.join(", ")})`);
  }
  if (typeof find !== "string" || find.length === 0) {
    throw new Error(`update_section_text: find must be a non-empty string`);
  }
  if (typeof replace !== "string") {
    throw new Error(`update_section_text: replace must be a string`);
  }

  const lines = content.split("\n");
  const bounds = findSectionBounds(lines, sectionSlug);
  if (!bounds) {
    throw new Error(`update_section_text: target section "${sectionSlug}" not found`);
  }

  const sectionText = lines.slice(bounds.startIdx + 1, bounds.endIdx).join("\n");
  const occurrences = countOccurrences(sectionText, find);
  if (occurrences === 0) {
    throw new Error(`update_section_text: find "${truncate(find, 60)}" not found in section "${sectionSlug}"`);
  }
  if (occurrences > 1) {
    throw new Error(`update_section_text: find "${truncate(find, 60)}" matched ${occurrences} times in section "${sectionSlug}" (expected 1). Add more surrounding context to make the match unique.`);
  }

  const updatedSection = sectionText.replace(find, replace);
  return [
    ...lines.slice(0, bounds.startIdx + 1),
    ...updatedSection.split("\n"),
    ...lines.slice(bounds.endIdx),
  ].join("\n");
}

function countOccurrences(text, find) {
  if (find.length === 0) return 0;
  let count = 0;
  let idx = text.indexOf(find);
  while (idx !== -1) {
    count++;
    idx = text.indexOf(find, idx + find.length);
  }
  return count;
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 3)}...` : s;
}

// ---------- BACKLOG (Features / Ideas LIFO sections) ----------

// BACKLOG has two LIFO H2 sections (Features, Ideas). Both behave like SESSION
// / MEMORY LIFO buckets - newest on top, placeholder-body replacement on first
// insert. No EXTENDED file for BACKLOG, so no extended_anchor support. The
// validator gates the section slug to BACKLOG_SECTIONS before this runs.
export function applyBacklogAction(content, ba) {
  if (!BACKLOG_SECTIONS.includes(ba.section)) {
    throw new Error(`backlog action section "${ba.section}" not valid (allowed: ${BACKLOG_SECTIONS.join(", ")})`);
  }
  switch (ba.op) {
    case "lifo_insert": return lifoInsertBullet(content, ba.section, ba.bullet, false);
    case "remove":      return removeBullet(content, ba.section, ba.match);
    case "replace":     return replaceBulletText(content, ba.section, ba.match, ba.bullet, false);
    default: throw new Error(`Unknown backlog action op: ${ba.op}`);
  }
}
