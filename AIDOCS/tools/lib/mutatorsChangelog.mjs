// mutatorsChangelog.mjs - the one CHANGELOG mutation. A user-facing line lands
// under the newest "## [version]" block's "### <section>" (Added, Changed, Fixed),
// newest first, and a missing section opens before the block's first "###". With no
// block yet, "## [Unreleased]" opens in the placeholder's seat. Pure, no I/O.

const PLACEHOLDER = /^\(no versions yet/;

// The newest block's bounds. A file with no "## [" block gets "## [Unreleased]" where
// the template's placeholder line stood, or at the end when there is none.
function newestBlock(lines) {
  const block = lines.findIndex((l) => /^## \[/.test(l));
  if (block >= 0) {
    let end = lines.length;
    for (let i = block + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i])) { end = i; break; }
    }
    return { lines, block, end };
  }
  const seat = lines.findIndex((l) => PLACEHOLDER.test(l.trim()));
  const out = seat >= 0
    ? [...lines.slice(0, seat), "## [Unreleased]", ...lines.slice(seat + 1)]
    : [...lines, "## [Unreleased]"];
  const at = seat >= 0 ? seat : out.length - 1;
  if (at > 0 && out[at - 1].trim() !== "") out.splice(at, 0, "");
  const head = out.indexOf("## [Unreleased]");
  if (out[head + 1] !== "") out.splice(head + 1, 0, "");
  return { lines: out, block: head, end: out.length };
}

export function changelogInsert(content, section, bullet) {
  const { lines, block, end } = newestBlock(content.split("\n"));
  const entry = `- ${bullet}`;
  const head = lines.findIndex((l, i) => i > block && i < end && l.trim() === `### ${section}`);
  if (head >= 0) {
    // Newest first: right under the heading, past its blank line. An empty
    // section keeps a blank line between the entry and whatever follows.
    let at = head + 1;
    while (at < end && lines[at].trim() === "") at++;
    const spacer = at === end || /^#/.test(lines[at]) ? [""] : [];
    return [...lines.slice(0, at), entry, ...spacer, ...lines.slice(at)].join("\n");
  }
  let at = end;
  for (let i = block + 1; i < end; i++) {
    if (/^### /.test(lines[i])) { at = i; break; }
  }
  return [...lines.slice(0, at), `### ${section}`, "", entry, "", ...lines.slice(at)].join("\n");
}
