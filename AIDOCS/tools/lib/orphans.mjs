// orphans.mjs - sweep for files in the project tree that no longer exist in the
// fetched upstream. Classes: safe (engine-only paths not imported by the live engine,
// mechanical drop), live-import (engine-only but still imported locally, held back so a
// pending rename cannot brick the running engine pre-upgrade), review-skill (custom vs
// abandoned, AI judges), review-automemory (project rule/profile vs abandoned canonical,
// AI judges). --auto-drop-safe drops only the safe class.

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

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
  // Project may have a customized seed path (rare). Upstream always uses the canonical.
  const projectSeed = (index.auto_memory?.seed || `./${CANONICAL_SEED}`).replace(/^\.\//, "");

  // A project file is an orphan when its key is absent upstream and the path is not
  // customization-guarded. The key defaults to the rel path; review-automemory keys on
  // basename so a project's customized seed path does not cause spurious diffs against
  // the canonical upstream layout.
  const orphansIn = (project, upstreamKeys, keyOf = (rel) => rel) =>
    [...project].filter((rel) => !upstreamKeys.has(keyOf(rel)) && !customizations.has(rel));

  // Split the engine-only orphans by whether the LOCAL engine still imports them. A file
  // absent upstream but still reached by the live import graph (a camelCase rename whose
  // new name has not landed yet, before the upgrade copy) is held back from the safe
  // class: dropping it here, pre-upgrade, would brick the running engine on its next call.
  // The manifest file_delete ops clean those at the right point, post-copy.
  const live = liveImportedEngineFiles(root);
  const engineOrphans = orphansIn(listEngineOnlyFiles(root), listEngineOnlyFiles(source));
  const safe = engineOrphans.filter((rel) => !live.has(rel));
  const liveHeld = engineOrphans.filter((rel) => live.has(rel));

  const reviewSkill = orphansIn(listSkillFiles(root), listSkillFiles(source));
  const upstreamAutoBasenames = new Set([...listAutoMemoryFiles(source, CANONICAL_SEED)].map((rel) => basename(rel)));
  const reviewAuto = orphansIn(listAutoMemoryFiles(root, projectSeed), upstreamAutoBasenames, (rel) => basename(rel));
  return { safe, liveHeld, reviewSkill, reviewAuto, source };
}

// Build the set of engine module files the LOCAL import graph references, project-relative
// with forward slashes (the orphan-key format). Walks every .mjs under AIDOCS/tools, reads
// its relative imports - the from-bearing (`from "./x.mjs"`), the bare side-effect
// (`import "./x.mjs"`), and the dynamic (`import("./x.mjs")`) forms - and resolves each to
// a project path. Conservative by design: a file imported by ANY local engine module counts
// as live, even one engine.mjs does not transitively reach. A false positive only holds a
// dead file back from the safe class (it waits for a file_delete op), while a false negative
// would risk the brick, so the scan errs toward over-protecting.
function liveImportedEngineFiles(root) {
  const toolsDir = join(root, "AIDOCS", "tools");
  const live = new Set();
  if (!existsSync(toolsDir)) return live;
  const mjs = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const abs = join(dir, f);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (/\.mjs$/.test(f)) mjs.push(abs);
    }
  };
  walk(toolsDir);
  const FROM_RE = /\bfrom\s*["'](\.[^"']+)["']/g;       // import ... from "./x" / export ... from "./x"
  const SIDE_RE = /\bimport\s*["'](\.[^"']+)["']/g;     // bare side-effect: import "./x"
  const CALL_RE = /\bimport\s*\(\s*["'](\.[^"']+)["']/g; // dynamic: import("./x")
  for (const abs of mjs) {
    let src;
    try { src = readFileSync(abs, "utf8"); } catch { continue; }   // best-effort: unreadable file skips
    for (const re of [FROM_RE, SIDE_RE, CALL_RE]) {
      for (const m of src.matchAll(re)) {
        const target = resolve(dirname(abs), m[1]);
        live.add(relative(root, target).split(/[\\/]/).join("/"));
      }
    }
  }
  return live;
}

function plural(n, one, many) { return n === 1 ? one : many; }

export function cmdOrphans(index, args = []) {
  const source = installEngineDir();
  if (!existsSync(source)) {
    console.error(`orphans: no fetched engine at ${source}. Run \`fetch-engine\` first.`);
    process.exit(20);
  }
  const result = classify(index);
  const { safe, liveHeld, reviewSkill, reviewAuto } = result;
  const autoDrop = args.includes("--auto-drop-safe");
  const total = safe.length + liveHeld.length + reviewSkill.length + reviewAuto.length;

  if (total === 0) {
    console.log("orphans: no project files outside the upstream tree - nothing to clean.");
    return;
  }

  console.log(`orphans: ${total} ${plural(total, "file", "files")} in project not present in upstream at ${result.source}`);
  if (safe.length > 0) {
    console.log(`  safe (${safe.length}) - engine-only paths (AIDOCS/tools/lib/ + top-level AIDOCS/tools/*.md) the live engine no longer imports, mechanically safe to drop with --auto-drop-safe:`);
    for (const r of safe) console.log(`    - ${r}`);
  }
  if (liveHeld.length > 0) {
    console.log(`  live-import (${liveHeld.length}) - engine-only paths absent upstream but STILL imported by the local engine (a rename whose new name lands on the upgrade copy step). Held back from the safe class - dropping them pre-upgrade would brick the running engine. The manifest file_delete ops clean these post-copy. Not dropped:`);
    for (const r of liveHeld) console.log(`    - ${r}`);
  }
  if (reviewSkill.length > 0) {
    console.log(`  review-skill (${reviewSkill.length}) - in AIDOCS/SKILL/, decide per file. A project-custom skill body (the project authored it) keeps - these do NOT belong in customizations[] (the array is for edits to canonical files). Project-custom files survive by absence in the copy step and will re-appear here each sync as a reminder. An abandoned canonical (deleted upstream without a file_delete / skill_delete op) drops:`);
    for (const r of reviewSkill) console.log(`    - ${r}`);
  }
  if (reviewAuto.length > 0) {
    console.log(`  review-automemory (${reviewAuto.length}) - in AIDOCS/automemory/, decide per file. A project_*, user_*, or reference_* file is usually project-owned (keep). A feedback_* not in upstream is either an abandoned canonical (drop) or a project-custom rule (keep). These survive the copy step by absence, so they never need listing in customizations[]. --auto-drop-safe never drops this class:`);
    for (const r of reviewAuto) console.log(`    - ${r}`);
  }

  if (!autoDrop) return;

  if (safe.length === 0) {
    const held = liveHeld.length ? `${liveHeld.length} live-import held for the manifest ops` : "";
    const judge = reviewSkill.length + reviewAuto.length ? "review-skill / review-automemory need AI judgment" : "";
    const tail = [held, judge].filter(Boolean).join(", ");
    console.log(`orphans --auto-drop-safe: no safe orphans to drop${tail ? ` (${tail})` : ""}.`);
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
  if (liveHeld.length > 0) console.log(`orphans --auto-drop-safe: ${liveHeld.length} ${plural(liveHeld.length, "file", "files")} held in live-import (still imported by the local engine, cleaned post-upgrade by the manifest ops).`);
}
