// mutators.mjs - pure section mutations for the memory / session / backlog files.
// Each takes file content plus the op's fields and returns new content. No I/O:
// commit simulates every op in memory first, then writes (DEV-AUDIT: pure
// functions, I/O at boundaries). Four ops cover both skills - lifoInsert (LIFO
// lists and BACKLOG, newest on top), overwriteSection (Current State and the
// Big-6 static sections), and amendBullet / dropBullet (one bullet, in place).

import { slugify } from "./markdown.mjs";

// Locate a "## <heading>" section. Returns the heading line index and the index
// of the first line after its body (the next "## " heading or "---" divider, or
// end of file). null when the heading is absent.
function sectionLines(lines, heading) {
  const head = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (head < 0) return null;
  let end = lines.length;
  for (let i = head + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i]) || lines[i].trim() === "---") { end = i; break; }
  }
  return { head, end };
}

// Insert a bullet at the top of a LIFO list (newest on top), dropping any
// "(no entries yet ...)" placeholder. A bullet with EXTENDED detail renders with
// the [+] marker (- [+] <text>), whose anchor is slugify(text) with no link.
// Serves SESSION / MEMORY LIFO and BACKLOG.
export function lifoInsert(content, heading, bullet, extended = false) {
  const lines = content.split("\n");
  const sec = sectionLines(lines, heading);
  if (!sec) throw new Error(`section "## ${heading}" not found`);
  const existing = lines.slice(sec.head + 1, sec.end).filter((l) => l.startsWith("- "));
  const block = ["", extended ? `- [+] ${bullet}` : `- ${bullet}`, ...existing, ""];
  return [...lines.slice(0, sec.head + 1), ...block, ...lines.slice(sec.end)].join("\n");
}

// Replace a section's whole body with new prose. Serves Current State and Big-6
// gap-fill (which is just overwriting the "(fill in ...)" placeholder).
export function overwriteSection(content, heading, body) {
  const lines = content.split("\n");
  const sec = sectionLines(lines, heading);
  if (!sec) throw new Error(`section "## ${heading}" not found`);
  const block = ["", ...body.split("\n"), ""];
  return [...lines.slice(0, sec.head + 1), ...block, ...lines.slice(sec.end)].join("\n");
}

// Find ONE bullet in a section by `match`: the bullet's text (after "- " or
// "- [+] ") starts with it verbatim, or its slug starts with slugify(match).
// Zero or several hits throw, so a targeted edit can never land on the wrong line.
function findBullet(lines, sec, heading, match) {
  const want = slugify(match);
  const hits = [];
  for (let i = sec.head + 1; i < sec.end; i++) {
    if (!lines[i].startsWith("- ")) continue;
    const text = lines[i].replace(/^- (\[\+\] )?/, "");
    if (text.startsWith(match) || (want && slugify(text).startsWith(want))) hits.push(i);
  }
  if (hits.length === 1) return hits[0];
  const how = hits.length === 0 ? "matched no bullet" : `matched ${hits.length} bullets`;
  throw new Error(`"${match}" ${how} in "## ${heading}"`);
}

// Rewrite one bullet in place, keeping its seat and its [+] marker: the fix for a
// bullet the run proved wrong, so a correction never re-emits its section or
// buries the old text under a newer bullet. Serves LIFO, Current State, BACKLOG.
export function amendBullet(content, heading, match, bullet) {
  const lines = content.split("\n");
  const sec = sectionLines(lines, heading);
  if (!sec) throw new Error(`section "## ${heading}" not found`);
  const at = findBullet(lines, sec, heading, match);
  lines[at] = lines[at].startsWith("- [+] ") ? `- [+] ${bullet}` : `- ${bullet}`;
  return lines.join("\n");
}

// Remove one bullet, handing the removed line back so commit can archive it
// (move, not delete). A [+] bullet's sub-section leaves by its own EXTENDED drop
// in the same staging - commit refuses the drop without it.
export function dropBullet(content, heading, match) {
  const lines = content.split("\n");
  const sec = sectionLines(lines, heading);
  if (!sec) throw new Error(`section "## ${heading}" not found`);
  const at = findBullet(lines, sec, heading, match);
  const [removed] = lines.splice(at, 1);
  return { content: lines.join("\n"), removed };
}

// Overwrite Current State. OVERWRITE MEANS OVERWRITE - the outgoing snapshot is
// discarded, never demoted into LIFO. Current State is operational reality, replaced
// each pass. Demoting it turned a snapshot into permanent history, so every fact that
// was ever true became a claim the file made forever (SESSION asserted a dead stack
// through an entire framework migration). A state snapshot is not an event. When a
// fact genuinely BECAME one, the skill emits it as a lifo_insert by judgment.
export function overwriteCurrentState(content, body) {
  return overwriteSection(content, "Current State", body);
}
