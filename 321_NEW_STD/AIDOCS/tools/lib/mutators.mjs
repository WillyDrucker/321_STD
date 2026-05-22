// mutators.mjs - pure section mutations for the memory / session / backlog files.
// Each takes file content plus the op's fields and returns new content. No I/O:
// commit simulates every op in memory first, then writes (DEV-AUDIT: pure
// functions, I/O at boundaries). Two ops cover both skills - lifoInsert (LIFO
// lists and BACKLOG, newest on top) and overwriteSection (Current State and the
// Big-6 static sections).

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

const LAST_STATE = "**Last State:** ";

// Overwrite Current State, demoting the prior snapshot's bullets to the top of
// LIFO. The first demoted bullet carries the **Last State:** marker - the boundary
// between "since last update" above and older history below. Any prior marker is
// stripped first, so exactly one exists. The first overwrite (placeholder, no
// bullets) writes plainly with no marker. The engine owns the marker, never the AI.
export function overwriteCurrentState(content, body) {
  const lines = content.split("\n");
  const cs = sectionLines(lines, "Current State");
  if (!cs) throw new Error('section "## Current State" not found');
  const prior = lines.slice(cs.head + 1, cs.end).filter((l) => l.startsWith("- "));
  if (prior.length === 0) return overwriteSection(content, "Current State", body);

  const demoted = prior.map((l, i) => (i === 0 ? l.replace(/^- /, `- ${LAST_STATE}`) : l));
  const updated = overwriteSection(content, "Current State", body).split("\n");
  const lifo = sectionLines(updated, "LIFO");
  if (!lifo) return updated.join("\n");
  const existing = updated.slice(lifo.head + 1, lifo.end)
    .filter((l) => l.startsWith("- "))
    .map((l) => l.replace(/^- \*\*Last State:\*\* /, "- "));
  const block = ["", ...demoted, ...existing, ""];
  return [...updated.slice(0, lifo.head + 1), ...block, ...updated.slice(lifo.end)].join("\n");
}
