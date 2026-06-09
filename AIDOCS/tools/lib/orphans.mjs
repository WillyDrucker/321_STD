// orphans.mjs - sweep for files in the project tree that no longer exist in the
// fetched upstream. Classes: safe (engine-only paths, mechanical drop), review-skill
// (custom vs abandoned, AI judges), review-automemory (project rule/profile vs
// abandoned canonical, AI judges). --auto-drop-safe drops only the safe class.

import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { installEngineDir, repoRoot } from "./paths.mjs";

// Engine canonical seed path. Hardcoded for the upstream scan because the upstream
// IS the engine canonical layout, and a project's customized seed path would
// otherwise redirect the upstream-side scan into a path the upstream never has.
const CANONICAL_SEED = "AIDOCS/automemory";

// Engine-only paths where no user file lives. AIDOCS/tools/lib enumerates flat
// (lib/ is one level today, a future subdir would warrant a recurse-or-justify call).
// AIDOCS/tools at the top level scans only *.md (PATTERN-*, UPDATE-RECONCILE.md),
// skipping engine.mjs (always present upstream, never an orphan), staging/ (project
// commit working area), and state.json (machine-local).
function listEngineOnlyFiles(root) {
  const out = new Set();
  const toolsLib = join(root, "AIDOCS", "tools", "lib");
  if (existsSync(toolsLib)) {
    for (const f of readdirSync(toolsLib)) {
      const abs = join(toolsLib, f);
      if (statSync(abs).isFile()) out.add(`AIDOCS/tools/lib/${f}`);
    }
  }
  const toolsRoot = join(root, "AIDOCS", "tools");
  if (existsSync(toolsRoot)) {
    for (const f of readdirSync(toolsRoot)) {
      const abs = join(toolsRoot, f);
      if (!statSync(abs).isFile()) continue;
      if (/\.md$/.test(f)) out.add(`AIDOCS/tools/${f}`);
    }
  }
  return out;
}

function listSkillFiles(root) {
  const out = new Set();
  const dir = join(root, "AIDOCS", "SKILL");
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!/^SKILL_.+\.md$/.test(f)) continue;
    if (!statSync(join(dir, f)).isFile()) continue;
    out.add(`AIDOCS/SKILL/${f}`);
  }
  return out;
}

function listAutoMemoryFiles(root, seedRel) {
  const out = new Set();
  const dir = join(root, seedRel);
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (f === "MEMORY.md") continue;   // runtime index, not a seed rule
    if (f === ".gitkeep") continue;
    if (!/\.md$/.test(f)) continue;
    if (!statSync(join(dir, f)).isFile()) continue;
    out.add(`${seedRel}/${f}`);
  }
  return out;
}

function classify(index) {
  const root = repoRoot();
  const source = installEngineDir();
  const customizations = new Set(index.customizations || []);
  // Project may have a customized seed path (rare); upstream always uses the canonical.
  const projectSeed = (index.auto_memory?.seed || `./${CANONICAL_SEED}`).replace(/^\.\//, "");
  const projectEngine = listEngineOnlyFiles(root);
  const projectSkill = listSkillFiles(root);
  const projectAuto = listAutoMemoryFiles(root, projectSeed);
  const upstreamEngine = listEngineOnlyFiles(source);
  const upstreamSkill = listSkillFiles(source);
  const upstreamAuto = listAutoMemoryFiles(source, CANONICAL_SEED);

  const safe = [];
  for (const rel of projectEngine) {
    if (upstreamEngine.has(rel)) continue;
    if (customizations.has(rel)) continue;
    safe.push(rel);
  }
  const reviewSkill = [];
  for (const rel of projectSkill) {
    if (upstreamSkill.has(rel)) continue;
    if (customizations.has(rel)) continue;
    reviewSkill.push(rel);
  }
  const reviewAuto = [];
  // Compare on basename for review-automemory so a project's customized seed path
  // does not cause spurious diffs against the canonical upstream layout.
  const upstreamAutoBasenames = new Set([...upstreamAuto].map((rel) => rel.split("/").pop()));
  for (const rel of projectAuto) {
    const base = rel.split("/").pop();
    if (upstreamAutoBasenames.has(base)) continue;
    if (customizations.has(rel)) continue;
    reviewAuto.push(rel);
  }
  return { safe, reviewSkill, reviewAuto, source };
}

function plural(n, one, many) { return n === 1 ? one : many; }

export function cmdOrphans(index, args = []) {
  const source = installEngineDir();
  if (!existsSync(source)) {
    console.error(`orphans: no fetched engine at ${source}. Run \`fetch-engine\` first.`);
    process.exit(20);
  }
  const result = classify(index);
  const { safe, reviewSkill, reviewAuto } = result;
  const autoDrop = args.includes("--auto-drop-safe");
  const total = safe.length + reviewSkill.length + reviewAuto.length;

  if (total === 0) {
    console.log("orphans: no project files outside the upstream tree - nothing to clean.");
    return;
  }

  console.log(`orphans: ${total} ${plural(total, "file", "file(s)")} in project not present in upstream at ${result.source}`);
  if (safe.length > 0) {
    console.log(`  safe (${safe.length}) - engine-only paths (AIDOCS/tools/lib/ + AIDOCS/tools/PATTERN-*.md + UPDATE-RECONCILE.md), mechanically safe to drop with --auto-drop-safe:`);
    for (const r of safe) console.log(`    - ${r}`);
  }
  if (reviewSkill.length > 0) {
    console.log(`  review-skill (${reviewSkill.length}) - in AIDOCS/SKILL/, decide per file. A project-custom skill body (the project authored it) keeps - these do NOT belong in customizations[] (the array is for edits to canonical files); project-custom files survive by absence in the copy step and will re-appear here each sync as a reminder. An abandoned canonical (deleted upstream without a file_delete / skill_delete op) drops:`);
    for (const r of reviewSkill) console.log(`    - ${r}`);
  }
  if (reviewAuto.length > 0) {
    console.log(`  review-automemory (${reviewAuto.length}) - in AIDOCS/automemory/, decide per file. A project_*, user_*, or reference_* file is usually project-owned (keep). A feedback_* not in upstream is either an abandoned canonical (drop) or a project-custom rule (keep). Auto-memory files are seeded write-if-missing by init and automemory_add, so project-custom rules survive without listing in customizations[]:`);
    for (const r of reviewAuto) console.log(`    - ${r}`);
  }

  if (!autoDrop) return;

  if (safe.length === 0) {
    console.log("orphans --auto-drop-safe: no safe orphans to drop (all remaining need AI judgment: review-skill, review-automemory).");
    return;
  }
  const root = repoRoot();
  for (const rel of safe) {
    const abs = join(root, rel);
    rmSync(abs, { force: true });
  }
  console.log(`orphans --auto-drop-safe: dropped ${safe.length} ${plural(safe.length, "file", "files")} from engine-only paths:`);
  for (const r of safe) console.log(`    - ${r}`);
  const remaining = reviewSkill.length + reviewAuto.length;
  if (remaining > 0) console.log(`orphans --auto-drop-safe: ${remaining} ${plural(remaining, "file", "files")} left for AI judgment (${reviewSkill.length} review-skill, ${reviewAuto.length} review-automemory).`);
}
