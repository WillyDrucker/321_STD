// lint.mjs - file-level, per-bullet, and per-anchor lint checks. Called by
// memory.mjs's `lint` subcommand (sweeps every AIDOCS file) and by commit's
// post-write pass (informational only, doesn't fail the commit).

import { slugify } from "./markdown.mjs";

export function lintFile(key, content, index) {
  const issues = [];
  const lines = content.split("\n");

  // Gate: file-level cap. Auto-prune fires post-commit when over cap. If lint
  // runs after auto-prune and still sees over-cap, it means auto-prune couldn't
  // reduce enough (fresh-content protection or load-bearing content blocked
  // it). Reflag for the user to review.
  const sizes = index.sizes?.[key];
  if (sizes?.cap) {
    if (lines.length > sizes.cap) {
      issues.push(`over cap (${lines.length} > ${sizes.cap}).`);
    }
  }

  // Gate: em-dash + semicolon scan in prose, via the canonical scanBannedProse
  // below. doctor's banned-prose check calls the same function, so the AIDOCS
  // files and the skill / doc surface apply the rule the same way.
  for (const v of scanBannedProse(content)) issues.push(`line ${v.line}: ${v.char} in prose`);

  // Gate: local anchor links resolve to a heading in the same file.
  // Cross-file anchors warn but don't fail - commit's orphan check covers those.
  const anchorRe = /\[[^\]]+\]\(#([a-z0-9-]+)\)/g;
  const headings = new Set();
  for (const line of lines) {
    const m = line.match(/^#{1,6}\s+(.+)$/);
    if (m) headings.add(slugify(m[1]));
  }
  for (let i = 0; i < lines.length; i++) {
    for (const match of lines[i].matchAll(anchorRe)) {
      if (!headings.has(match[1])) {
        issues.push(`line ${i + 1}: anchor #${match[1]} not found in this file (may be cross-file)`);
      }
    }
  }

  // Gate: top-tier bullet density (MEMORY / SESSION / BACKLOG, 2 physical lines per bullet).
  if (key === "memory" || key === "session" || key === "backlog") {
    for (const issue of checkBulletLengths(lines, 2)) issues.push(issue);
  }

  // Gate: EXTENDED density (~10 lines per anchored section) + no fenced code.
  // Advisory: over-length is allowed for genuinely important entries, but code
  // never belongs in EXTENDED (it lives in the source) and counts toward the cap.
  if (key === "memory_extended" || key === "session_extended") {
    for (const issue of checkAnchorProseLengths(lines, 10)) issues.push(issue);
  }

  return issues;
}

// Each bullet runs from a `- ` line to the next bullet, blank line, or heading.
// Continuation lines must be indented (markdown list continuation convention).
function checkBulletLengths(lines, cap) {
  const issues = [];
  let bulletStart = -1;
  let bulletLines = 0;

  const flush = () => {
    if (bulletStart >= 0 && bulletLines > cap) {
      issues.push(`bullet at line ${bulletStart + 1}: ${bulletLines} lines, max ${cap}`);
    }
    bulletStart = -1;
    bulletLines = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^- /.test(line);
    const isBlank = line.trim() === "";
    const isHeader = /^#{1,6}\s/.test(line);
    const isContinuation = /^\s{2,}\S/.test(line);

    if (isBullet) {
      flush();
      bulletStart = i;
      bulletLines = 1;
    } else if (bulletStart >= 0) {
      if (isContinuation) bulletLines++;
      else if (isBlank || isHeader) flush();
    }
  }
  flush();
  return issues;
}

// Each section runs from `## ` or `### ` to the next heading (or EOF). Flags any
// fenced code block (no code in EXTENDED) and counts body lines toward the ~cap
// (code body counts; heading, fence delimiters, blanks, and table rows do not).
function checkAnchorProseLengths(lines, cap) {
  const issues = [];
  let sectionStart = -1;
  let sectionHeading = "";
  let buffer = [];

  const flush = () => {
    if (sectionStart < 0) return;
    if (buffer.some(l => l.trim().startsWith("```"))) {
      issues.push(`anchor "${sectionHeading}" at line ${sectionStart + 1}: contains a fenced code block - summarize the takeaway in prose, the code lives in the source`);
    }
    const count = countProseLines(buffer);
    if (count > cap) {
      issues.push(`anchor "${sectionHeading}" at line ${sectionStart + 1}: ${count} lines (target ~${cap}) - tighten, or keep over-length only when genuinely important`);
    }
    sectionStart = -1;
    sectionHeading = "";
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,3})\s+(.+?)\s*$/);
    if (m) {
      flush();
      sectionStart = i;
      sectionHeading = m[2];
    } else if (sectionStart >= 0) {
      buffer.push(lines[i]);
    }
  }
  flush();
  return issues;
}

// Counts every body line toward the cap except blanks, fence delimiters, and
// table rows. Code BODY lines DO count - no code belongs in EXTENDED, so a
// code-bearing entry should read as over-length until summarized into prose.
function countProseLines(sectionLines) {
  let count = 0;
  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("```")) continue;
    if (trimmed.startsWith("|")) continue;
    count++;
  }
  return count;
}

// Canonical banned-character prose scan. Em dashes and semicolons are banned in
// authored prose (auto-memory feedback_no_em_dashes). Skips fenced code blocks,
// indented code (4+ leading spaces), and inline code spans. Returns one entry
// per hit ({ line, char, snippet }). Single home for the rule so `lint` (AIDOCS
// files) and `doctor` (skill bodies / docs / WDDOCS) scan identically.
export function scanBannedProse(content) {
  const out = [];
  const lines = content.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^ {0,3}```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^ {4,}\S/.test(line)) continue;
    // Mask inline code spans with same-length blanks, so a hit's index still
    // lines up with the original line for the reported snippet.
    const masked = line.replace(/`[^`]*`/g, m => " ".repeat(m.length));
    for (const [char, glyph] of [["em dash", "—"], ["semicolon", ";"]]) {
      const idx = masked.indexOf(glyph);
      if (idx !== -1) out.push({ line: i + 1, char, snippet: line.slice(Math.max(0, idx - 20), idx + 20) });
    }
  }
  return out;
}
