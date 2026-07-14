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

// Overwrite Current State. OVERWRITE MEANS OVERWRITE - the outgoing snapshot is
// discarded, never demoted into LIFO. Current State is operational reality, replaced
// each pass. Demoting it turned a snapshot into permanent history, so every fact that
// was ever true became a claim the file made forever (SESSION asserted a dead stack
// through an entire framework migration). A state snapshot is not an event. When a
// fact genuinely BECAME one, the skill emits it as a lifo_insert by judgment.
export function overwriteCurrentState(content, body) {
  return overwriteSection(content, "Current State", body);
}
