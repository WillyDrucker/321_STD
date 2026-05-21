// markdown.mjs - pure utilities for slug derivation, frontmatter parsing,
// path normalization, and finding section / anchor bounds. No I/O, no side
// effects. Mutators, lint, and prune consume these.
//
// Two families of section finders: the find*Bounds helpers locate ONE section
// or sub-section by slug / anchor (used by mutators). The enumerate* helpers
// list ALL top-level sections or LIFO sub-sections (used by prune's bottom-up
// drop walk). Both live here so markdown-section parsing has one home.

import { createHash } from "node:crypto";
import { relative } from "node:path";

// "ai-script-driver" -> "Ai Script Driver". Used by mutators when deriving
// a sub-section heading from an anchor slug.
export function headingFromSlug(slug) {
  return slug
    .split(/[_-]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// "Memory Track Flags" -> "memory-track-flags". GitHub-style heading slug.
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Lowercase + collapse non-alphanumeric to dashes. Lets section slugs match
// hyphen / space / case variants in real headings.
export function normalizeForMatch(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Stable content hash of a skill body. A customized skill records the hash of the
// canonical body it was merged from (customizations[].base.hash). init compares it
// to the current canonical and prints a re-merge nudge when they diverge. CRLF is
// normalized to LF and trailing whitespace stripped so a Windows checkout or a
// stray final newline does not read as a real change. Truncated sha256 - this is
// drift detection, not integrity, so 16 hex chars is plenty and keeps the index
// readable. Pure (a deterministic digest), so it lives with the other utilities.
export function skillBodyHash(content) {
  const norm = content.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  return createHash("sha256").update(norm, "utf8").digest("hex").slice(0, 16);
}

// Anchor a main-file LIFO bullet points into the EXTENDED file, or null. Two
// forms: the `[+]` marker (anchor = slug of the bullet text after the marker)
// and the legacy inline link `[text](<extendedFilename>#anchor)`. Plain bullets
// (no marker, no link) return null. Lets the orphan check and paired prune pair
// a bullet to its sub-section without rendering a URL.
export function bulletExtendedAnchor(line, extendedFilename) {
  const plus = line.match(/^- \[\+\]\s+(.+?)\s*$/);
  if (plus) return slugify(plus[1]);
  const m = line.match(new RegExp(`^- \\[.+?\\]\\(${escapeRegExp(extendedFilename)}#([a-z0-9-]+)\\)`));
  return m ? m[1] : null;
}

// Parse simple YAML frontmatter at top of file. Returns key->value (strings only).
// Tolerates a leading UTF-8 BOM so Windows-authored files parse cleanly.
// Normalizes CRLF to LF up front because Windows git checkouts default to CRLF
// and the kv regex below uses `.` which does not match \r and `$` which does
// not tolerate \r before end-of-line. Without this normalization, sync would
// see every Windows-checked-out skill body's frontmatter as empty.
export function parseFrontmatter(content) {
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  content = content.replace(/\r\n/g, "\n");
  const m = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.+)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[kv[1].trim()] = val;
  }
  return out;
}

// "SKILL_SESSION-UPDATE.md" -> "-SessionUpdate". Used by sync to derive flags.
export function filenameToFlag(filename) {
  const m = filename.match(/^SKILL_(.+)\.md$/);
  if (!m) return null;
  const camel = m[1]
    .split("-")
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
  return `-${camel}`;
}

// Forward-slash relative path with "./" prefix. Used to keep _index.json
// portable across Windows/POSIX hosts.
export function toRelativePosix(from, to) {
  const rel = relative(from, to).split("\\").join("/");
  return `./${rel}`;
}

// Find `## <heading>` bounds where the heading slug normalizes to `sectionSlug`.
// Returns { startIdx, endIdx } where endIdx is exclusive (next `##` or EOF).
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

// Detects placeholder bodies like "(none recorded yet)", "(no entries yet)",
// or "(fill in - hint)". Triggers placeholder-replacement on the first insert
// into an empty section.
export function isPlaceholderBody(bodyText) {
  return /^\(\s*(none|no|fill in|optional)\b.*\)\s*$/is.test(bodyText);
}

// Find `## <heading>` bounds by anchor slug match. Used by legacy top-level
// anchored EXTENDED sections (pre-LIFO-sub-section model).
export function findExtendedBounds(lines, anchor) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(.+?)\s*$/);
    if (m && slugify(m[1]) === anchor) {
      let endIdx = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^##\s/.test(lines[j])) { endIdx = j; break; }
      }
      return { startIdx: i, endIdx };
    }
  }
  return null;
}

// Find `### <heading>` sub-section anchor inside the `## LIFO`. Returns
// { startIdx, endIdx, lifoStartIdx, lifoEndIdx } where endIdx is exclusive
// (next ### or ## or EOF, whichever first).
export function findLifoSubsectionBounds(lines, anchor) {
  const lifoBounds = findSectionBounds(lines, "lifo");
  if (!lifoBounds) return null;
  for (let i = lifoBounds.startIdx + 1; i < lifoBounds.endIdx; i++) {
    const m = lines[i].match(/^###\s+(.+?)\s*$/);
    if (m && slugify(m[1]) === anchor) {
      let endIdx = lifoBounds.endIdx;
      for (let j = i + 1; j < lifoBounds.endIdx; j++) {
        if (/^###\s/.test(lines[j]) || /^##\s/.test(lines[j])) { endIdx = j; break; }
      }
      return {
        startIdx: i,
        endIdx,
        lifoStartIdx: lifoBounds.startIdx,
        lifoEndIdx: lifoBounds.endIdx,
      };
    }
  }
  return null;
}

// Scan the `## LIFO` bullets of a MAIN memory / session file for migrate-import
// residue. A clean reconciled bullet is plain prose: pairing to the EXTENDED file
// is by slugified headline (see bulletExtendedAnchor), not an explicit `{#anchor}`,
// and dates are banned in memory / session (LIFO order carries the time signal).
// So a surviving `{#anchor}`, or a leading `YYYY-MM-DD`, is raw capture the
// reconcile pass failed to distill. Returns [{ line, kind, snippet }], one entry
// per bullet (anchor takes precedence); empty when distilled. Pure - callers own
// I/O and the reconcile_pending gate.
export function findLifoResidue(lines) {
  const bounds = findSectionBounds(lines, "lifo");
  if (!bounds) return [];
  const out = [];
  for (let i = bounds.startIdx + 1; i < bounds.endIdx; i++) {
    const line = lines[i];
    if (!/^\s*-\s+/.test(line)) continue;
    const snippet = line.trim().slice(0, 70);
    if (/\{#[^}]+\}/.test(line)) {
      out.push({ line: i + 1, kind: "anchor", snippet });
    } else if (/^\s*-\s+(?:\[\+\]\s+)?\d{4}-\d{2}-\d{2}\b/.test(line)) {
      out.push({ line: i + 1, kind: "date", snippet });
    }
  }
  return out;
}

// Scan file content for references to ANOTHER project's doc files (e.g. a
// surviving `OldName_MEMORY.md` link). currentName is the live project's filename
// prefix - any `<other>_<doc>.md` where <other> differs is migration residue the
// reconcile rename should have fixed. The migrate-import `\b<old>\b` rename skips
// these because `<old>_MEMORY` has no word boundary before the underscore, so they
// arrive un-renamed and dangle. Returns [{ line, kind: "cross-ref", snippet, ref }].
// Pure - callers own I/O and the reconcile_pending gate.
export function findCrossRefResidue(content, currentName) {
  const out = [];
  if (!currentName) return out;
  const re = /\b([A-Za-z0-9][A-Za-z0-9_-]*?)_(MEMORY_EXTENDED|SESSION_EXTENDED|MEMORY|SESSION|BACKLOG|DEV-AUDIT|DEV-STANDARDS)\.md\b/g;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(re)) {
      if (m[1] !== currentName) {
        out.push({ line: i + 1, kind: "cross-ref", snippet: lines[i].trim().slice(0, 70), ref: m[0] });
      }
    }
  }
  return out;
}

// Find `### <decisionsHeading>` sub-section inside the named static section. Used by
// promote_to_section when target_decisions is true and by gap_fill_section
// when decisions_md is provided. update_section_text edits section bodies
// directly via findSectionBounds, not this helper.
export function findDecisionsSubsectionBounds(lines, sectionSlug, decisionsHeading) {
  const sectionBounds = findSectionBounds(lines, sectionSlug);
  if (!sectionBounds) return null;
  for (let i = sectionBounds.startIdx + 1; i < sectionBounds.endIdx; i++) {
    const m = lines[i].match(/^###\s+(.+?)\s*$/);
    if (m && m[1].trim() === decisionsHeading) {
      let endIdx = sectionBounds.endIdx;
      for (let j = i + 1; j < sectionBounds.endIdx; j++) {
        if (/^###\s/.test(lines[j]) || /^##\s/.test(lines[j])) { endIdx = j; break; }
      }
      return {
        startIdx: i,
        endIdx,
        sectionStartIdx: sectionBounds.startIdx,
        sectionEndIdx: sectionBounds.endIdx,
      };
    }
  }
  return null;
}

// Enumerate every `## H2` block. Returns [{ name, start, end }] where end is the
// last line index of the section (inclusive, the line before the next `## ` or
// EOF). Used by prune to walk top-level sections bottom-up.
export function enumerateTopLevelSections(lines) {
  const sections = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith("## ")) {
      const name = lines[i].slice(3).trim();
      const start = i;
      let end = lines.length - 1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith("## ")) { end = j - 1; break; }
      }
      sections.push({ name, start, end });
      i = end + 1;
    } else {
      i++;
    }
  }
  return sections;
}

// Enumerate every `### sub-section` under the `## LIFO` heading. Returns
// [{ heading, start, end, loadBearing }] where loadBearing is true when the body
// carries a `<!-- LOAD_BEARING -->` marker (protected from prune).
export function enumerateLifoSubsections(lines) {
  const sections = [];
  let lifoStart = -1;
  let lifoEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## ") && /^##\s+LIFO\b/i.test(lines[i])) {
      lifoStart = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith("## ")) { lifoEnd = j; break; }
      }
      break;
    }
  }
  if (lifoStart === -1) return [];

  let i = lifoStart + 1;
  while (i < lifoEnd) {
    if (lines[i].startsWith("### ")) {
      const heading = lines[i].slice(4).trim();
      const start = i;
      let end = lifoEnd - 1;
      for (let j = i + 1; j < lifoEnd; j++) {
        if (lines[j].startsWith("### ") || lines[j].startsWith("## ")) { end = j - 1; break; }
      }
      const body = lines.slice(start, end + 1).join("\n");
      const loadBearing = body.includes("<!-- LOAD_BEARING -->");
      sections.push({ heading, start, end, loadBearing });
      i = end + 1;
    } else {
      i++;
    }
  }
  return sections;
}

