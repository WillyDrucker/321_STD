// migrate-import.mjs - lossless structural import of an archived EXTENDED file
// into a staging file the standard commit pipeline applies. Migration Steps 5/6
// use this so depth content is captured VERBATIM (one anchored sub-section per
// bold-lead entry) instead of distilled at capture. Distillation is deferred to
// the reconciliation pass (the gated /321 -Update), which can diff
// copied-vs-reconciled to audit exactly what the lossy step removed.
//
// Uniform split: every paragraph-leading bold-lead and every archive heading
// with a body becomes its own ### sub-section under ## LIFO. List-item bolds
// (`- **x**`) stay as body. The only thing skipped is a contentless group
// header (a heading with no prose of its own) - its bold-lead children are
// captured as their own entries, so no detail is lost. The ~10-line anchor cap
// is advisory (post-write lint), never a reason to compress here. Fenced code
// blocks are elided to a one-line marker - no code in EXTENDED; the source keeps
// the code and reconciliation summarizes the takeaway into prose.
//
// Output is a staging file (session-update.json or memory-update.json) with one
// extended_action `add` per entry plus one matching MAIN `lifo_insert` whose
// extended_anchor is the entry's slug. Because both sides derive from the same
// slug list, the commit orphan check passes by construction.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import process from "node:process";

import { err, parseFlags, requireOpt } from "../cli.mjs";
import { escapeRegExp, slugify } from "../markdown.mjs";
import { resolveWithinRepo, stagingPath } from "../state.mjs";

const VALID_SKILLS = ["session-update", "memory-update"];

// Headings that are the EXTENDED file's own authoring guide, not durable
// content. Skipped on import - the canonical Purpose header replaces them.
const META_HEADING = /^(what goes in|what doesn't|what does not|pruning|pruning rule|purpose|lifo|in-flight items.*)$/i;

export async function cmdMigrateImport(args) {
  const opts = parseFlags(args, ["from", "skill", "old", "new", "dry-run", "append"]);
  requireOpt(opts, "from");
  requireOpt(opts, "skill");
  if (!VALID_SKILLS.includes(opts.skill)) {
    err(`Unknown skill "${opts.skill}". Must be one of: ${VALID_SKILLS.join(", ")}`);
    process.exit(11);
  }

  const fromPath = resolveWithinRepo(opts.from, "--from");
  if (!existsSync(fromPath)) {
    err(`Source EXTENDED file not found: ${fromPath}`);
    process.exit(16);
  }

  let content = await readFile(fromPath, "utf8");
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  content = content.replace(/\r\n/g, "\n");
  if (opts.old && opts.new) content = normalizeNames(content, opts.old, opts.new);
  content = normalizeLegacy(content);

  let entries = parseEntries(content);
  if (entries.length === 0) {
    // No headings or bold-leads to split on. Import the whole doc as one entry so
    // a freeform scavenge file (loose notes with no structure) is still captured
    // losslessly - the reconciliation pass distills it later. Title from the H1,
    // else the filename stem.
    const title = (content.match(/^#\s+(.+?)\s*$/m)?.[1] || basename(fromPath).replace(/\.md$/i, "")).trim();
    const body = content.replace(/^#\s+.+$/m, "").trim();
    if (title && body) entries = [{ title: stripTrailingPeriod(title), body }];
  }
  if (entries.length === 0) {
    err(`No importable content found in ${opts.from} (empty after normalization).`);
    process.exit(17);
  }

  // --append merges into an existing lane staging. The Setup flow imports the 321
  // EXTENDED first, then appends each swept scavenge doc onto the same staging.
  // Seed the slug set with the existing anchors so appended entries get
  // collision-free -N suffixes against what is already staged.
  const append = opts.append === true;
  const existing = (append && existsSync(stagingPath(opts.skill)))
    ? JSON.parse(await readFile(stagingPath(opts.skill), "utf8"))
    : null;

  const used = new Set();
  if (existing) for (const ea of existing.extended_actions || []) { if (ea.anchor) used.add(ea.anchor); }
  const actions = [];
  const extendedActions = [];
  for (const entry of entries) {
    // Disambiguate slug AND heading together when an entry title repeats (the
    // archive can hold literal duplicates). The heading must slugify back to the
    // anchor, so a ` (N)` suffix on the heading produces the `-N` anchor suffix -
    // keeping both in sync so the commit orphan check resolves. Lossless: both
    // copies survive; the reconciliation pass drops the duplicate.
    const baseSlug = slugify(entry.title);
    let slug = baseSlug;
    let heading = entry.title;
    let n = 2;
    while (used.has(slug)) {
      slug = `${baseSlug}-${n}`;
      heading = `${entry.title} (${n})`;
      n++;
    }
    used.add(slug);
    extendedActions.push({ op: "add", anchor: slug, heading, body_md: entry.body });
    actions.push({ op: "lifo_insert", section: "lifo", bullet: heading, extended_anchor: slug });
  }

  const staging = existing
    ? {
        skill: opts.skill,
        mode: existing.mode || "full",
        actions: [...(existing.actions || []), ...actions],
        extended_actions: [...(existing.extended_actions || []), ...extendedActions],
        ...(existing.backlog_actions ? { backlog_actions: existing.backlog_actions } : {}),
      }
    : { skill: opts.skill, mode: "full", actions, extended_actions: extendedActions };
  const out = `${JSON.stringify(staging, null, 2)}\n`;

  if (opts["dry-run"] === true) {
    console.log(`migrate-import (dry run): ${entries.length} entries from ${opts.from}`);
    for (const e of extendedActions) console.log(`  ### ${e.heading}  (#${e.anchor})`);
    console.log(`\nStaging NOT written. Drop --dry-run to write ${stagingPath(opts.skill)}.`);
    return;
  }

  // Do not clobber existing staging unless --append was passed. In the Setup flow
  // migrate-import CREATES the lane staging the sub-skill then appends to, so a
  // pre-existing file (without --append) means a prior run is in flight -
  // overwriting would silently drop those ops. Make the caller decide: clear,
  // commit, or --append to merge.
  if (!append && existsSync(stagingPath(opts.skill))) {
    err(`Staging already exists at ${stagingPath(opts.skill)}. Clear it first (node AIDOCS/tools/memory.mjs clear --skill ${opts.skill}), commit it, or pass --append to merge into it, then re-run.`);
    process.exit(14);
  }
  await writeFile(stagingPath(opts.skill), out, "utf8");
  const verb = existing ? "appended" : "wrote";
  console.log(`migrate-import: ${verb} ${entries.length} entries -> ${stagingPath(opts.skill)}`);
  console.log(`  ${extendedActions.length} new extended_actions (### sub-sections), ${actions.length} new anchored MAIN bullets${existing ? ` (staging now ${staging.extended_actions.length} total)` : ""}.`);
  console.log(`Next: node AIDOCS/tools/memory.mjs validate --skill ${opts.skill} && node AIDOCS/tools/memory.mjs commit --skill ${opts.skill}`);
}

// Walk the normalized content. Emit one entry per archive heading (##/###) and
// one per paragraph-leading bold-lead (`**Title.** body`). List-item bolds
// (`- **x**`) and inline bold stay attached to the current entry's body. Meta
// headings and the H1 title are skipped. Fenced code blocks are elided to a
// one-line marker (a `**` or `#` inside a fence never starts an entry).
function parseEntries(content) {
  const lines = content.split("\n");
  const entries = [];
  let current = null;
  let skipping = false;
  let inFence = false;
  let currentDepth = 0;

  const flush = () => {
    if (current) {
      current.body = current.bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      delete current.bodyLines;
      entries.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      const opening = !inFence;
      inFence = !inFence;
      // No code in EXTENDED. Replace each fenced block with a one-line marker on
      // the opening fence and drop the code body. The source keeps the actual
      // code; reconciliation summarizes the takeaway into prose. The marker also
      // keeps a code-only entry from collapsing to an empty (dropped) body.
      if (opening && current && !skipping) {
        current.bodyLines.push("(code example elided on import - summarize the takeaway in prose)");
      }
      continue;
    }
    if (inFence) {
      continue;
    }

    const h1 = line.match(/^#\s+/);
    const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    const boldLead = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);

    if (h1) { flush(); skipping = true; continue; }

    if (heading) {
      flush();
      currentDepth = heading[1].length;
      const title = heading[2].trim();
      if (META_HEADING.test(title)) { skipping = true; continue; }
      skipping = false;
      current = { title: stripTrailingPeriod(title), bodyLines: [] };
      continue;
    }

    if (line.trim() === "---") { continue; }

    // Split a bold-lead into its own entry only when it is a direct child of an
    // H2 (a flat multi-entry section like MEMORY's "Carried Forward Pitfalls").
    // Under an H3 (SESSION in-flight item narratives), the ### sub-section is the
    // coherent unit - bold-leads inside it stay as body so the story holds.
    if (boldLead && !skipping && currentDepth === 2) {
      flush();
      currentDepth = 2;
      current = { title: stripTrailingPeriod(boldLead[1].trim()), bodyLines: [] };
      if (boldLead[2].trim()) current.bodyLines.push(boldLead[2].trim());
      continue;
    }

    if (current && !skipping) current.bodyLines.push(line);
  }
  flush();

  // Skip contentless group headers (a heading immediately followed by another
  // heading or a bold-lead, with no intro prose of its own). Its bold-lead
  // children are captured as their own entries, so no content is lost - only
  // the grouping label, which carries no durable detail.
  return entries.filter(e => e.title.length > 0 && e.body.length > 0);
}

function stripTrailingPeriod(s) {
  return s.endsWith(".") ? s.slice(0, -1) : s;
}

// Legacy 321_STD token normalization, applied as content enters the canonical
// structure. Mirrors the in-flight rules in SKILL_SETUP.md migration Step 4.
function normalizeLegacy(content) {
  return content
    .replace(/\/321 -DevStandards/g, "/321 -DevAudit")
    .replace(/DEV-STANDARDS/g, "DEV-AUDIT")
    .replace(/AIDOCS\/SKILLS\//g, "AIDOCS/SKILL/")
    .replace(/SKILLS_([A-Z])/g, "SKILL_$1");
}

// Project rename: rewrite OLD_NAME -> NEW_NAME on word boundaries. Covers
// `OLD_*.md` cross-references and standalone prose mentions. Conservative -
// only whole-word matches, so substrings of larger identifiers are left alone.
function normalizeNames(content, oldName, newName) {
  // Doc-filename cross-refs first: <old>_<doc>.md -> <new>_<doc>.md. The \b<old>\b
  // pass below does NOT catch these - `<old>_MEMORY` has no word boundary before the
  // underscore - so without this they survive as dangling refs to the old project's
  // files until a reconcile renames them. Safe to rename: these are doc filenames,
  // not real identifiers (env vars, branches, bundle IDs), which the \b pass also
  // leaves alone. Runs before normalizeLegacy, so DEV-STANDARDS is still in play here.
  const docRef = new RegExp(`\\b${escapeRegExp(oldName)}_(MEMORY_EXTENDED|SESSION_EXTENDED|MEMORY|SESSION|BACKLOG|DEV-AUDIT|DEV-STANDARDS)\\.md\\b`, "g");
  content = content.replace(docRef, `${newName}_$1.md`);
  return content.replace(new RegExp(`\\b${escapeRegExp(oldName)}\\b`, "g"), newName);
}
