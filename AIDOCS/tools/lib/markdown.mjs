// markdown.mjs - pure markdown helpers shared by the mutators and the staging
// gate. No I/O. Starts with slug derivation: an EXTENDED anchor is the slugify of
// a main-file bullet's headline, never a written link. The section and sub-section
// finders land here as the EXTENDED mutators need them.

// "Memory Track Flags" -> "memory-track-flags". The anchor a main-file [+] bullet
// derives from its headline, and the slug an EXTENDED `### heading` matches.
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// "ai-script-driver" -> "Ai Script Driver". Derives a sub-section heading from an
// anchor slug when an add does not carry an explicit heading.
export function headingFromSlug(slug) {
  return slug.split(/[_-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Lowercase + collapse non-alphanumeric to dashes, so a section slug matches
// hyphen / space / case variants in a real heading.
function normalizeForMatch(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Detects a placeholder body like "(no entries yet ...)" or "(fill in - hint)", so
// the first insert into an empty section replaces it instead of stacking on it.
export function isPlaceholderBody(bodyText) {
  return /^\(\s*(none|no|fill in|optional)\b.*\)\s*$/is.test(bodyText);
}

// Find `## <heading>` bounds where the heading normalizes to sectionSlug. Returns
// { startIdx, endIdx } with endIdx exclusive (next `## ` or EOF), or null.
export function findSectionBounds(lines, sectionSlug) {
  const target = normalizeForMatch(sectionSlug);
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(.+?)\s*$/);
    if (m && normalizeForMatch(m[1]) === target) { startIdx = i; break; }
  }
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let j = startIdx + 1; j < lines.length; j++) {
    if (/^##\s/.test(lines[j])) { endIdx = j; break; }
  }
  return { startIdx, endIdx };
}

// Find a `### <heading>` sub-section under `## LIFO` whose heading slugifies to
// anchor. Returns { startIdx, endIdx } with endIdx exclusive (next ### or ## or
// the LIFO end), or null.
export function findLifoSubsectionBounds(lines, anchor) {
  const lifo = findSectionBounds(lines, "lifo");
  if (!lifo) return null;
  for (let i = lifo.startIdx + 1; i < lifo.endIdx; i++) {
    const m = lines[i].match(/^###\s+(.+?)\s*$/);
    if (m && slugify(m[1]) === anchor) {
      let endIdx = lifo.endIdx;
      for (let j = i + 1; j < lifo.endIdx; j++) {
        if (/^###\s/.test(lines[j]) || /^##\s/.test(lines[j])) { endIdx = j; break; }
      }
      return { startIdx: i, endIdx };
    }
  }
  return null;
}

// The EXTENDED anchor a main-file LIFO bullet points at, or null. A `[+]` bullet's
// anchor is the slugify of its text after the marker. Plain bullets return null.
export function bulletExtendedAnchor(line) {
  const m = line.match(/^- \[\+\]\s+(.+?)\s*$/);
  return m ? slugify(m[1]) : null;
}
