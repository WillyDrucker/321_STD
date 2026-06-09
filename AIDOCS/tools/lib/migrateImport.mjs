// migrateImport.mjs - the mechanical 1:1 scavenge of an archived doc into a staging
// file the standard commit pipeline applies, backing the `migrate-import` CLI
// command. The migration capture uses this so depth
// content lands verbatim (one anchored ### sub-section per entry, with its paired [+]
// main bullet) instead of distilled at capture. It is the script half of a hybrid:
// the script grabs the text and emits a landing report, the AI verifies what landed
// and re-feeds any gap through -UpdateSession / -UpdateMemory using the archived text.
// Deep verification, including the --audit diff of archive-vs-distilled, is the
// reconciliation pass (the gated /321 -Update).
//
// Robust by design - it handles the common blockers so a scavenge does not stall:
// BOM and CRLF, fenced code (elided to a one-line marker, since the validator rejects
// fences in body_md), a heading with no slug-able text (a positional fallback anchor),
// and a structureless doc (imported as one blob). Both sides derive from one slug
// list, so the commit orphan check passes by construction.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { flag } from "./args.mjs";
import { installLog } from "./installLog.mjs";
import { slugify } from "./markdown.mjs";
import { auditImport } from "./migrateImportAudit.mjs";
import { normalizeLegacy, normalizeNames } from "./migrateNormalize.mjs";
import { isContained, repoRoot, stagingDir } from "./paths.mjs";
import { loadStaging } from "./state.mjs";

// Headings that are an EXTENDED file's own authoring guide, not durable content - plus
// the Big-6 mirror headings a legacy EXTENDED carried at its top (overview ... conventions),
// which are schema scaffold, so a legacy import never lands them as new LIFO bullets.
const META_HEADING = /^(what goes in|what doesn't|what does not|pruning.*|purpose|lifo|overview|stack|architecture|environment|pipeline|conventions)$/i;
// Sub-label H3 patterns under a numbered H2 parent ("Why:", "What:", "Status:",
// "Files touched:"). A legacy EXTENDED that uses these as a fixed sub-structure
// would otherwise scavenge as one top-level LIFO bullet per label per parent,
// over-splitting a 4-arc SESSION into ~16 fragments most of which are meaningless
// ("Status:", "Why: (3)"). Folding them keeps the heading inline in the parent
// entry's body so the structure survives without polluting LIFO.
const SUB_LABEL = /^[A-Z][A-Za-z0-9\s/_-]{0,40}:$/;
// No code in EXTENDED. A fenced block becomes this marker so a code-only entry does
// not collapse to an empty body, and the validator's no-fence rule on body_md holds.
const CODE_MARKER = "(code example elided on import - summarize the takeaway in prose)";

function stripTrailingPeriod(s) { return s.endsWith(".") ? s.slice(0, -1) : s; }

// migrate-import --from <archived doc> --skill <updatesession | updatememory>
//   [--old <NAME> --new <NAME>] [--append] [--dry-run]
//   --audit re-reads the archive and diffs it against the distilled EXTENDED.
//   --from-archive <archive root> reads MANIFEST.json to resolve --from / --old / --new
//     from the recorded role mapping, so the AI does not re-derive them from filenames.
export function cmdMigrateImport(index, args) {
  let from = flag(args, "--from");
  const skill = flag(args, "--skill");
  let oldName = flag(args, "--old");
  let newName = flag(args, "--new");
  const append = args.includes("--append");
  const dryRun = args.includes("--dry-run");
  const audit = args.includes("--audit");
  const fromArchive = flag(args, "--from-archive");

  if (!skill) { console.error("migrate-import needs --skill <updatesession | updatememory>"); process.exit(5); }

  // --from-archive resolves --from / --old / --new from the archive's MANIFEST.json,
  // mapping the skill to its recorded role (updatesession -> session_extended,
  // updatememory -> memory_extended). Removes the AI guesswork for legacy naming
  // variants (a SESSION_HANDOFF infix, a WD_ prefix). An explicit --from still wins.
  if (fromArchive && !from) {
    const role = skill === "updatesession" ? "session_extended" : skill === "updatememory" ? "memory_extended" : null;
    if (!role) { console.error(`migrate-import --from-archive: skill "${skill}" has no manifest role mapping (expected updatesession or updatememory).`); process.exit(5); }
    const archiveRoot = resolve(repoRoot(), fromArchive);
    if (!isContained(repoRoot(), archiveRoot)) { console.error(`migrate-import --from-archive "${fromArchive}" escapes the project root.`); process.exit(5); }
    const mfPath = join(archiveRoot, "MANIFEST.json");
    if (!existsSync(mfPath)) { console.error(`migrate-import --from-archive: no MANIFEST.json at ${mfPath} (was the archive made by an older migrate-archive?)`); process.exit(16); }
    let mf;
    try { mf = JSON.parse(readFileSync(mfPath, "utf8")); } catch (e) { console.error(`migrate-import --from-archive: MANIFEST.json malformed (${e.message})`); process.exit(16); }
    // Prefer the entry whose old_prefix matches source_project_name (the legacy content
    // the migration exists to preserve). On a renamed-migration the archive also carries
    // the fresh target-name scaffolds the install laid before migrate-archive ran, and
    // we do NOT want to import from those.
    const candidates = (mf.moved || []).filter((m) => m.role === role);
    let entry = null;
    if (mf.source_project_name) entry = candidates.find((m) => m.old_prefix === mf.source_project_name);
    if (!entry) entry = candidates[0];
    if (!entry) { console.error(`migrate-import --from-archive: MANIFEST.json has no entry with role "${role}" (the archive may not carry that lane).`); process.exit(17); }
    from = join(fromArchive, entry.path);
    if (!oldName && mf.source_project_name) oldName = mf.source_project_name;
    if (!newName && mf.target_project_name) newName = mf.target_project_name;
    console.log(`migrate-import: resolved from manifest -> --from ${from} --old ${oldName || "(none)"} --new ${newName || "(none)"}`);
  }

  if (!from) { console.error("migrate-import needs --from <archived doc> or --from-archive <archive root>"); process.exit(5); }

  // Resolve the lane's main + EXTENDED file keys from the registry (the spine), so the
  // staging carries real keys the validator and commit accept.
  const extKey = Object.keys(index.files || {}).find((k) => k.startsWith(`${skill}.`) && k.endsWith("_extended"));
  const mainKey = extKey ? extKey.replace(/_extended$/, "") : null;
  if (!extKey || !mainKey || !index.files[mainKey]) {
    console.error(`migrate-import: --skill must be a lane with a main + _extended pair (got "${skill}").`);
    process.exit(11);
  }

  const root = repoRoot();
  const fromAbs = resolve(root, from);
  if (!isContained(root, fromAbs)) { console.error(`migrate-import: --from "${from}" escapes the project root.`); process.exit(5); }
  if (!existsSync(fromAbs)) { console.error(`migrate-import: source not found: ${from}`); process.exit(16); }

  let content = readFileSync(fromAbs, "utf8");
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);   // strip BOM
  content = content.replace(/\r\n/g, "\n");
  if (oldName && newName) content = normalizeNames(content, oldName, newName);
  content = normalizeLegacy(content);

  let entries = parseEntries(content);
  let blob = false;
  if (entries.length === 0) {
    // No headings or bold-leads to split on (a hand-written doc, loose notes). Import
    // the whole doc as one entry so nothing is lost - the AI re-splits it on verify or
    // the reconciliation pass distills it. Title from the H1, else the filename.
    const title = (content.match(/^#\s+(.+?)\s*$/m)?.[1] || basename(fromAbs).replace(/\.md$/i, "")).trim();
    const body = elideFences(content.replace(/^#\s+.+$/m, "")).trim();
    if (title && body) { entries = [{ title: stripTrailingPeriod(title), body }]; blob = true; }
  }
  if (entries.length === 0) { console.error(`migrate-import: no importable content in ${from}.`); process.exit(17); }

  if (audit) { auditImport(index, extKey, entries, from); return; }

  const stagingFile = join(stagingDir(), `${skill}.json`);
  const existing = append ? loadStaging(skill) : null;
  if (!append && existsSync(stagingFile)) {
    console.error(`migrate-import: staging already exists at ${stagingFile}. Commit it, remove the staging file, or pass --append to merge.`);
    process.exit(14);
  }

  // Seed used-anchors from existing staging so appended entries get collision-free -N
  // suffixes against what is already staged.
  const used = new Set();
  if (existing) for (const a of existing.actions || []) { if (a.op === "add" && a.anchor) used.add(a.anchor); }
  const actions = [];
  const report = { nonText: [], thin: [], elided: 0 };
  entries.forEach((entry, i) => {
    // A heading with no slug-able text (all symbols, non-Latin) would yield an empty
    // anchor the validator rejects. Fall back to a positional anchor and re-title so
    // the bullet still reads, and flag it for the AI to verify.
    let baseSlug = slugify(entry.title);
    let baseHeading = entry.title;
    if (!baseSlug) { baseSlug = `import-${i + 1}`; baseHeading = `${entry.title} (import ${i + 1})`.trim(); report.nonText.push(baseSlug); }
    // Disambiguate slug and heading together when a title repeats - a " (N)" suffix on
    // the heading yields the matching "-N" anchor, keeping the pair resolvable.
    let slug = baseSlug, heading = baseHeading, n = 2;
    while (used.has(slug)) { slug = `${baseSlug}-${n}`; heading = `${baseHeading} (${n})`; n++; }
    used.add(slug);
    actions.push({ op: "lifo_insert", file: mainKey, section: "LIFO", bullet: heading, extended_anchor: slug });
    actions.push({ op: "add", file: extKey, anchor: slug, heading, body_md: entry.body });
    report.elided += entry.body.split(CODE_MARKER).length - 1;
    if (entry.body.split(CODE_MARKER).join("").trim().length < 15) report.thin.push(slug);
  });

  const staging = existing ? { skill, actions: [...(existing.actions || []), ...actions] } : { skill, actions };

  if (dryRun) {
    console.log(`migrate-import (dry run): ${entries.length} entr${entries.length === 1 ? "y" : "ies"} from ${from}`);
    for (const a of actions) if (a.op === "add") console.log(`  ### ${a.heading}  (#${a.anchor})`);
    reportLanding(report, blob);
    return;
  }
  writeFileSync(stagingFile, `${JSON.stringify(staging, null, 2)}\n`, "utf8");
  installLog(root, `migrate-import: ${entries.length} entr${entries.length === 1 ? "y" : "ies"} from ${from} into ${skill} staging.`);
  console.log(`migrate-import: ${existing ? "appended" : "wrote"} ${entries.length} entr${entries.length === 1 ? "y" : "ies"} (${actions.length} actions) -> ${stagingFile}`);
  reportLanding(report, blob);
  console.log(`  next: validate --skill ${skill}, then commit --skill ${skill}, then verify what landed.`);
}

// The hybrid handoff - what the script could not land cleanly, for the AI to verify
// and re-feed through the normal skill using the archived text. Silent-clean when the
// scavenge was uneventful.
function reportLanding(report, blob) {
  const notes = [];
  if (blob) notes.push("the source had no headings or bold-leads - imported as one blob entry, verify it reads coherently or re-split it");
  if (report.nonText.length) notes.push(`${report.nonText.length} heading(s) had no slug-able text - a fallback anchor was used (${report.nonText.join(", ")}), check the bullet reads well`);
  if (report.thin.length) notes.push(`${report.thin.length} entr${report.thin.length === 1 ? "y" : "ies"} captured little body (${report.thin.join(", ")}) - check the source for detail that did not land`);
  if (report.elided) notes.push(`${report.elided} code block(s) elided - summarize the takeaway in prose at reconcile`);
  if (notes.length === 0) { console.log("  landing report: clean - every entry captured with a body, no anomalies."); return; }
  console.log("  landing report (verify these, re-feed any gap via -UpdateSession / -UpdateMemory from the archived text):");
  for (const note of notes) console.log(`  - ${note}`);
}

// Replace each fenced code block with a one-line marker. Used for the blob fallback,
// where parseEntries' line walk does not run.
function elideFences(text) {
  let inFence = false;
  return text.split("\n").map((line) => {
    if (/^```/.test(line.trim())) { const opening = !inFence; inFence = !inFence; return opening ? CODE_MARKER : null; }
    return inFence ? null : line;
  }).filter((l) => l !== null).join("\n");
}

// Walk the normalized content. Emit one entry per archive heading (##/###) with a
// body, and one per H2-child bold-lead ("**Title.** body"). List-item bolds and inline
// bold stay in the current entry's body. Meta headings and the H1 are skipped. Fenced
// code is elided so a "**" inside a fence never starts an entry.
function parseEntries(content) {
  const lines = content.split("\n");
  const entries = [];
  let current = null, skipping = false, inFence = false, currentDepth = 0;

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
      if (opening && current && !skipping) current.bodyLines.push(CODE_MARKER);
      continue;
    }
    if (inFence) continue;

    const h1 = line.match(/^#\s+/);
    const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    const boldLead = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);

    if (h1) { flush(); skipping = true; continue; }
    if (heading) {
      const depth = heading[1].length;
      const title = heading[2].trim();
      // Fold sub-label H3s (Why:, Status:, Files touched:) under their H2 parent
      // instead of promoting them to their own LIFO bullets. Recognized only when
      // we are inside a non-skipped H2 entry, so a structured EXTENDED with real H3
      // topics is unaffected. The heading line is kept verbatim in the parent body
      // so the structure reads when the entry renders.
      if (current && !skipping && depth === 3 && currentDepth === 2 && SUB_LABEL.test(title)) {
        current.bodyLines.push(line);
        continue;
      }
      flush();
      currentDepth = depth;
      if (META_HEADING.test(title)) { skipping = true; continue; }
      skipping = false;
      current = { title: stripTrailingPeriod(title), bodyLines: [] };
      continue;
    }
    if (line.trim() === "---") continue;

    // A bold-lead becomes its own entry only as a direct child of an H2 (a flat
    // multi-entry section). Under an H3 the ### sub-section is the coherent unit, so
    // bold-leads inside it stay as body and the narrative holds.
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

  // Drop contentless group headers (a heading with no prose of its own) - their
  // bold-lead children were captured as their own entries, so no detail is lost.
  return entries.filter((e) => e.title.length > 0 && e.body.length > 0);
}
