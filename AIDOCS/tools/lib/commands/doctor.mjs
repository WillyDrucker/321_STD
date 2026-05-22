// doctor.mjs - cmdDoctor. Health check across the standards system.
//
// Runs a battery of independent checks (see the buckets map in cmdDoctor for the
// live list). Each returns an issues[] array; any non-empty array fails the run.
// Add a check by writing a function and adding one bucket entry.
//
// Exits non-zero if any check fails. Use as a pre-flight or CI gate.

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

import { lintFile, scanBannedProse } from "../lint.mjs";
import { findDecisionsSubsectionBounds, findSectionBounds, isPlaceholderBody, parseFrontmatter } from "../markdown.mjs";
import { decisionsHeadingFor, REPO_ROOT, STATIC_SECTIONS } from "../paths.mjs";
import { loadState, scanReconcileResidue } from "../state.mjs";

// `structuralOnly` runs only the wiring checks (paths, state, skill bodies,
// auto-memory pointers, router quick-ref, manifests) and skips the content /
// prose checks (lint, Big-6 Decisions, migration markers, banned prose).
// Install uses it: a migration over an existing project inherits that project's
// lint debt (legacy CHANGELOG, WDDOCS docs), which is not an install fault and
// is reconciled later by /321 -Setup then -Update. Full doctor (the default)
// still gates everything. Buckets build in fixed order so output stays stable.
export async function cmdDoctor(index, opts = {}) {
  const structuralOnly = opts.structuralOnly === true;

  const buckets = {
    ...(structuralOnly ? {} : { "Lint": await runLint(index) }),
    "Paths":                   checkPaths(index),
    "State":                   await checkState(),
    "Skill bodies":            await checkSkills(index),
    "Legacy skills":           checkLegacySkills(),
    "Reconcile residue":       await checkReconcileResidue(index),
    ...(structuralOnly ? {} : {
      "Big-6 Decisions":       await checkBig6Decisions(index),
      "Migration markers":     await checkMigrationMarkers(index),
      "Banned prose":          await checkBannedProse(index),
    }),
    "Auto-memory pointers":    await checkAutoMemoryPointers(index),
    "Router quick-ref":        await checkRouterQuickRef(index),
    "Customization manifest":  checkCustomizations(index),
    "Release profile":         checkReleaseProfile(index),
    "Origin pointer":          checkOrigin(index),
  };

  // Content / prose checks vs structural wiring checks. Splitting the count lets
  // the summary tell a reader (or a lower-capability driver) that a non-zero exit
  // is pre-existing prose lint, not broken wiring. Same set as --structural-only.
  const CONTENT = new Set(["Lint", "Big-6 Decisions", "Migration markers", "Banned prose"]);
  let structuralCount = 0;
  let contentCount = 0;
  for (const [name, issues] of Object.entries(buckets)) {
    console.log(`\n[${name}]`);
    if (issues.length === 0) { console.log("  ok"); continue; }
    if (CONTENT.has(name)) contentCount += issues.length; else structuralCount += issues.length;
    for (const issue of issues) console.log(`  - ${issue}`);
  }
  const total = structuralCount + contentCount;

  if (structuralOnly) {
    console.log(`\ndoctor (structural-only): ${total === 0 ? "all checks passed." : `${total} structural issue(s) found.`}`);
  } else if (total === 0) {
    console.log(`\ndoctor: all checks passed.`);
  } else {
    console.log(`\ndoctor: ${total} issue(s) found - ${structuralCount} structural, ${contentCount} content/prose.`);
    if (structuralCount === 0) {
      console.log(`  Structural wiring is clean. The rest is content/prose lint, often pre-existing user content. Use --structural-only to gate on wiring alone.`);
    }
  }
  const reconcileResidue = buckets["Reconcile residue"]?.length || 0;
  if (reconcileResidue > 0) {
    console.log(`  Reconcile incomplete: ${reconcileResidue} item(s) of migrate-import residue (LIFO anchors / dates, or un-renamed cross-project file refs). The gate is closed but the distillation / rename did not finish - re-run /321 -Update.`);
  }
  if (total > 0) process.exit(20);
}

async function runLint(index) {
  const issues = [];
  for (const [key, p] of Object.entries(index.files || {})) {
    const abs = resolve(REPO_ROOT, p);
    if (!existsSync(abs)) { issues.push(`missing file: ${key} -> ${p}`); continue; }
    if (key.endsWith("_archive") || key === "env") continue;
    const content = await readFile(abs, "utf8");
    for (const issue of lintFile(key, content, index)) issues.push(`${key}: ${issue}`);
  }
  return issues;
}

function checkPaths(index) {
  const issues = [];
  for (const [key, p] of Object.entries(index.paths || {})) {
    if (!existsSync(resolve(REPO_ROOT, p))) issues.push(`missing path: ${key} -> ${p}`);
  }
  return issues;
}

async function checkState() {
  const issues = [];
  try {
    const state = await loadState();
    if (typeof state !== "object" || state === null) {
      issues.push("state.json is not an object");
    }
  } catch (e) {
    issues.push(`state.json error: ${e.message}`);
  }
  return issues;
}

async function checkSkills(index) {
  const issues = [];
  const bodiesRel = index.paths?.skills_bodies;
  if (!bodiesRel) {
    issues.push("paths.skills_bodies missing from _index.json");
    return issues;
  }
  const dir = resolve(REPO_ROOT, bodiesRel);
  if (!existsSync(dir)) {
    issues.push(`skill bodies dir missing: ${dir}`);
    return issues;
  }
  const files = (await readdir(dir)).filter(f => /^SKILL_.+\.md$/.test(f));
  for (const file of files) {
    const content = await readFile(join(dir, file), "utf8");
    const fm = parseFrontmatter(content);
    if (fm.kind === "reference") continue;
    if (!fm.name) issues.push(`${file}: missing frontmatter name`);
    if (!fm.description) issues.push(`${file}: missing frontmatter description`);
    if (!/^\*\*Purpose:\*\*/m.test(content)) issues.push(`${file}: missing **Purpose:** callout under H1`);
  }
  return issues;
}

// A top-level AIDOCS/SKILLS/ (plural) is a pre-321 / legacy skill tree not yet
// imported. The migration moves it into the setup archive, and import-skills +
// /321 -Update bring the bodies into AIDOCS/SKILL/ (singular). Its presence here
// means that import / reconcile has not finished. The archived copy under
// _SETUP_ARCHIVE/ is not flagged - only the live top-level tree.
function checkLegacySkills() {
  const issues = [];
  if (existsSync(resolve(REPO_ROOT, "AIDOCS", "SKILLS"))) {
    issues.push("legacy AIDOCS/SKILLS/ (plural) present - run /321 -Setup (migration), or `import-skills` then /321 -Update, to bring these into AIDOCS/SKILL/, then remove the legacy tree");
  }
  return issues;
}

// Every FILLED Big-6 section in MEMORY must carry a `### <Section> Decisions`
// sub-section (the why). Unfilled placeholder sections are skipped - the block
// lands on gap-fill. Even a straightforward section keeps a "(none yet)"
// Decisions block, so absence on a filled section is a real gap.
async function checkBig6Decisions(index) {
  const issues = [];
  const memRel = index.files?.memory;
  if (!memRel) return issues;
  const memPath = resolve(REPO_ROOT, memRel);
  if (!existsSync(memPath)) return issues;
  const lines = (await readFile(memPath, "utf8")).split("\n");
  for (const slug of STATIC_SECTIONS) {
    const bounds = findSectionBounds(lines, slug);
    if (!bounds) continue;
    const decisionsHeading = decisionsHeadingFor(slug);
    const decisions = findDecisionsSubsectionBounds(lines, slug, decisionsHeading);
    const bodyEnd = decisions ? decisions.startIdx : bounds.endIdx;
    // The last static section's bounds run to `## LIFO`, pulling in the `---`
    // divider before it. Strip a trailing divider so a placeholder body reads
    // as a placeholder, not as filled content.
    const bodyText = lines.slice(bounds.startIdx + 1, bodyEnd).join("\n").replace(/\n*---\s*$/, "").trim();
    if (bodyText.length === 0 || isPlaceholderBody(bodyText)) continue;
    if (!decisions) {
      issues.push(`MEMORY ${slug}: filled section has no "### ${decisionsHeading}" sub-section (every filled Big-6 needs one, even "(none yet)")`);
    }
  }
  return issues;
}

// Residual migrate-import elided-code markers in an EXTENDED file mean a
// reconciliation pass left raw import behind. The marker is migrate-import's
// stand-in for a stripped code fence (no code in EXTENDED), meant to become
// one-line prose. Expected while reconcile_pending is set (the import window);
// once the gate clears, any survivor is an incomplete reconcile, so flag it.
async function checkMigrationMarkers(index) {
  const issues = [];
  let state;
  try { state = await loadState(); } catch { return issues; }
  if (state?.reconcile_pending === true) return issues;
  const marker = "elided on import";
  for (const key of ["memory_extended", "session_extended"]) {
    const rel = index.files?.[key];
    if (!rel) continue;
    const abs = resolve(REPO_ROOT, rel);
    if (!existsSync(abs)) continue;
    const lines = (await readFile(abs, "utf8")).split("\n");
    const hits = [];
    lines.forEach((l, i) => { if (l.includes(marker)) hits.push(i + 1); });
    if (hits.length) {
      issues.push(`${key}: ${hits.length} residual migrate-import marker(s) at line(s) ${hits.join(", ")} - reconciliation should summarize each to one-line prose`);
    }
  }
  return issues;
}

// The engine-managed files must be fully reconciled once the gate clears: MAIN LIFO
// bullets distilled to plain prose, and no cross-project doc-file refs left un-renamed.
// A surviving migrate-import `{#anchor}`, leading date, or `<old>_MEMORY.md`-style ref
// means -Update closed the gate without finishing - the incomplete reconcile a
// lower-capability driver falls into (clears the gate, leaves the raw capture).
// Expected while reconcile_pending is set (the capture window), so gate on it,
// same lifecycle as checkMigrationMarkers. Tallies as structural, not content:
// a real "reconcile did not run" signal must suppress the "wiring is clean"
// all-clear, not hide among dismissible WDDOCS prose lint.
async function checkReconcileResidue(index) {
  const issues = [];
  let state;
  try { state = await loadState(); } catch { return issues; }
  if (state?.reconcile_pending === true) return issues;
  for (const hit of await scanReconcileResidue(index)) {
    const msg = hit.kind === "cross-ref"
      ? "references another project's doc file, rename it to the current project"
      : `LIFO bullet still carries a migrate-import ${hit.kind}, distill to plain prose`;
    issues.push(`${hit.key}: line ${hit.line} ${msg}: "${hit.snippet}"`);
  }
  return issues;
}

async function checkBannedProse(index) {
  // Prose gate. Scan authored markdown for em dashes and semicolons. Skip
  // fenced code blocks and inline code spans. JS source comments are out of
  // scope here - DEV-AUDIT handles those.
  // Covers: skill bodies, live router, AGENTS.md, CLAUDE.md, engine README,
  // and WDDOCS design docs.
  const issues = [];
  const targets = [];

  const bodiesRel = index.paths?.skills_bodies;
  if (bodiesRel) {
    const dir = resolve(REPO_ROOT, bodiesRel);
    if (existsSync(dir)) {
      const files = (await readdir(dir)).filter(f => /\.md$/.test(f));
      for (const f of files) targets.push(join(dir, f));
    }
  }

  const routerRel = index.paths?.skills_router;
  if (routerRel) targets.push(resolve(REPO_ROOT, routerRel));

  for (const rel of ["agents_md", "claude_md"]) {
    const p = index.paths?.[rel];
    if (p) targets.push(resolve(REPO_ROOT, p));
  }

  const enginePath = resolve(REPO_ROOT, "AIDOCS", "tools", "lib", "README.md");
  if (existsSync(enginePath)) targets.push(enginePath);

  const repoReadme = resolve(REPO_ROOT, "README.md");
  if (existsSync(repoReadme)) targets.push(repoReadme);

  // Walk WDDOCS - both root .md files (SESSION_HANDOFF, etc.) and every
  // subdir (DESIGN, RELEASES). ARCHIVE excluded as frozen history.
  const wddocsDir = resolve(REPO_ROOT, "WDDOCS");
  if (existsSync(wddocsDir)) {
    const entries = await readdir(wddocsDir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(wddocsDir, e.name);
      if (e.isFile() && /\.md$/.test(e.name)) {
        targets.push(p);
      } else if (e.isDirectory() && e.name !== "ARCHIVE") {
        const files = (await readdir(p)).filter(f => /\.md$/.test(f));
        for (const f of files) targets.push(join(p, f));
      }
    }
  }

  for (const path of targets) {
    if (!existsSync(path)) continue;
    const content = await readFile(path, "utf8");
    const violations = scanBannedProse(content);
    for (const v of violations) {
      issues.push(`${path.split(/[\\/]/).slice(-2).join("/")}:${v.line} ${v.char} in prose: "${v.snippet}"`);
    }
  }
  return issues;
}

async function checkRouterQuickRef(index) {
  // Every dispatchable skill in _index.json should have a corresponding row in
  // the live router's quick-reference block (or registry table). Catches drift
  // after sync. Narrowed to the invocation / registry section so passing
  // mentions in prose elsewhere don't satisfy the check.
  const issues = [];
  const dispatch = index.skills?.dispatch || {};
  const routerRel = index.paths?.skills_router;
  if (!routerRel) return issues;
  const routerPath = resolve(REPO_ROOT, routerRel);
  if (!existsSync(routerPath)) return issues;
  const router = await readFile(routerPath, "utf8");

  // Pull the "How to invoke" fenced block + the "Registry" table for matching.
  const invokeMatch = router.match(/##\s+How to invoke\s*([\s\S]*?)(?=\n##|$)/);
  const registryMatch = router.match(/##\s+Registry[^\n]*\n([\s\S]*?)(?=\n##|$)/);
  const quickRefMatch = router.match(/##\s+Quick reference\s*([\s\S]*?)(?=\n##|$)/);
  const scanZone = [
    invokeMatch?.[1] || "",
    registryMatch?.[1] || "",
    quickRefMatch?.[1] || "",
  ].join("\n");

  for (const [key, entry] of Object.entries(dispatch)) {
    const flag = entry?.flag;
    if (!flag) continue;
    if (!scanZone.includes(flag)) {
      issues.push(`router skill at ${routerRel} is missing a How-to-invoke / Registry / Quick reference row for ${flag} (dispatch key: ${key})`);
    }
  }
  return issues;
}

function checkCustomizations(index) {
  // Customization manifest declares intentional deviations from the standards
  // (a project's local rules / patterns that don't match this template). Shape:
  //   { id, description, rule, applies_to?, reason? }
  // Future drift tooling reads this to distinguish drift from override.
  const issues = [];
  const customs = index.customizations;
  if (customs === undefined) return issues;
  if (!Array.isArray(customs)) {
    issues.push("customizations must be an array if present");
    return issues;
  }
  for (let i = 0; i < customs.length; i++) {
    const c = customs[i];
    const prefix = `customizations[${i}]`;
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof c.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(c.id)) {
      issues.push(`${prefix}.id required, lowercase-kebab`);
    }
    if (typeof c.description !== "string" || c.description.length === 0) {
      issues.push(`${prefix}.description required`);
    }
    if (typeof c.rule !== "string" || c.rule.length === 0) {
      issues.push(`${prefix}.rule required (names the standard rule being deviated from)`);
    }
    if (c.applies_to !== undefined) {
      if (!Array.isArray(c.applies_to) || c.applies_to.some(s => typeof s !== "string")) {
        issues.push(`${prefix}.applies_to must be an array of strings if present`);
      } else {
        // applies_to is the preserve signal for a customized skill body (init
        // skips it on update), so a stale path silently drops that protection.
        for (const p of c.applies_to) {
          if (!existsSync(resolve(REPO_ROOT, p))) issues.push(`${prefix}.applies_to path not found: ${p}`);
        }
      }
    }
    if (c.reason !== undefined && typeof c.reason !== "string") {
      issues.push(`${prefix}.reason must be a string if present`);
    }
    if (c.base !== undefined) {
      // base records the canonical skill + the hash of the body the customization
      // was merged from, so init can nudge a re-merge once the canonical advances.
      if (typeof c.base !== "object" || c.base === null || Array.isArray(c.base)) {
        issues.push(`${prefix}.base must be an object { skill, hash } if present`);
      } else {
        if (typeof c.base.skill !== "string" || c.base.skill.length === 0) issues.push(`${prefix}.base.skill required (string) when base is present`);
        if (typeof c.base.hash !== "string" || c.base.hash.length === 0) issues.push(`${prefix}.base.hash required (string) when base is present`);
      }
    }
  }
  return issues;
}

function checkReleaseProfile(index) {
  // Release profile names the deploy / publish shape AutoPush should use.
  // One of: standards, npm-package, vscode-extension, cloudflare-worker,
  // cloudflare-pages, static-site, none. Optional - AutoPush falls back to
  // its template when absent.
  const VALID = ["standards", "npm-package", "vscode-extension", "cloudflare-worker", "cloudflare-pages", "static-site", "none"];
  const issues = [];
  const profile = index.release_profile;
  if (profile === undefined) return issues;
  if (typeof profile !== "string" || !VALID.includes(profile)) {
    issues.push(`release_profile must be one of: ${VALID.join(", ")} (got "${profile}")`);
  }
  return issues;
}

// The upstream pointer for fetch-from-git. Optional (older installs lack it), but
// when present must carry string repo / ref / engine_version so -Sync can re-fetch
// and drift-compare. A version here is a manifest field, not memory.
function checkOrigin(index) {
  const issues = [];
  const origin = index.origin;
  if (origin === undefined) return issues;
  if (typeof origin !== "object" || Array.isArray(origin)) {
    issues.push("origin must be an object { repo, ref, engine_version } if present");
    return issues;
  }
  for (const k of ["repo", "ref", "engine_version"]) {
    if (typeof origin[k] !== "string") issues.push(`origin.${k} must be a string`);
  }
  return issues;
}

async function checkAutoMemoryPointers(index) {
  const issues = [];
  // Prefer the in-repo path (resolves cleanly under AIDOCS/automemory in the
  // standards repo); fall back to the per-machine auto_memory.path for a
  // scaffolded project (where automemory is per-machine, not project-local).
  const repoLocal = index.paths?.automemory ? resolve(REPO_ROOT, index.paths.automemory) : null;
  const machineLocal = index.auto_memory?.path;
  const autoMemPath = (repoLocal && existsSync(repoLocal)) ? repoLocal
    : (machineLocal && existsSync(machineLocal)) ? machineLocal
    : null;
  if (!autoMemPath) return issues;

  const files = (await readdir(autoMemPath)).filter(f => f.startsWith("feedback_") && f.endsWith(".md"));

  const agentsPath = resolve(REPO_ROOT, index.paths?.agents_md || "./AGENTS.md");
  if (!existsSync(agentsPath)) return issues;

  const agents = await readFile(agentsPath, "utf8");
  const hardRulesMatch = agents.match(/## Hard rules\s*([\s\S]*?)(?=\n##|\n---|$)/);
  if (!hardRulesMatch) return issues;

  const pointers = [];
  // Markdown link syntax: [text](feedback_X.md)
  for (const m of hardRulesMatch[1].matchAll(/\]\((feedback_[^)]+\.md)\)/g)) {
    if (!m[1].includes("*")) pointers.push(m[1]);
  }
  // Backtick syntax: (`feedback_X.md`) - the safer non-link form when the file
  // doesn't resolve from the AGENTS.md directory.
  for (const m of hardRulesMatch[1].matchAll(/`(feedback_[^`]+\.md)`/g)) {
    if (m[1].includes("*")) continue;
    if (!pointers.includes(m[1])) pointers.push(m[1]);
  }

  for (const ptr of pointers) {
    if (!files.includes(ptr)) {
      issues.push(`AGENTS.md Hard rules pointer "${ptr}" does not match any auto-memory feedback file`);
    }
  }
  for (const f of files) {
    if (!pointers.includes(f)) {
      issues.push(`auto-memory "${f}" has no pointer in AGENTS.md Hard rules`);
    }
  }
  return issues;
}
