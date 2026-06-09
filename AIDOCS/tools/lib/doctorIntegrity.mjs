// doctorIntegrity.mjs - the structural-integrity arm of doctor: registry pointers
// resolve, declared files exist as regular files, memory and session docs hold the
// expected shape (Purpose, Big-6, divider, LIFO, no code fences in EXTENDED), every
// main-file [+] bullet pairs with its EXTENDED sub-section, skill bodies carry a
// frontmatter contract, auto-memory pointers mirror the seed, the upgrade
// bookkeeping arrays are well-formed, and the privacy gate matches the registry's
// declared mode. "Is the project structurally what the spec says it should be?"

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { hasPrivacyBlock } from "./gitignore.mjs";
import { findOrphanBullets } from "./mutatorsExtended.mjs";
import { fromRoot, readRegisteredFile } from "./paths.mjs";
import { isFile } from "./prose.mjs";

const BIG6 = ["Overview", "Stack", "Architecture", "Environment", "Pipeline", "Conventions"];

// The integrity arm groups its checks into the doctor's two tiers: errors fail the
// run (structural mismatch the AI must address) and warns survive it (drift the AI
// can fix but the project is still usable).
export function runIntegrityChecks(index) {
  return {
    errors: {
      "Registry":             checkRegistry(index),
      "Memory shape":         checkMemoryShape(index),
      "Session shape":        checkSessionShape(index),
      "Skill bodies":         checkSkillBodies(index),
      "Orphan pairs":         checkOrphans(index),
      "Auto-memory pointers": checkAutoMemory(index),
      "Privacy gate":         checkPrivacyLeak(index),
      "Upgrade schema":       checkUpgradeSchema(index),
    },
    warns: {
      "Privacy drift": checkPrivacyDrift(index),
    },
  };
}

function needPurpose(content, label, issues) {
  if (!/^\*\*Purpose:\*\*/m.test(content)) issues.push(`${label}: missing **Purpose:** callout`);
}

// Code never belongs in EXTENDED - it lives in the source, and the 1:1 import elides
// it to a marker. The staging gate blocks a fenced body, but a direct-edit reconcile
// bypasses staging, so doctor catches a fence the hand-edit path would let through.
function needNoFence(content, label, issues) {
  if (/^\s*```/m.test(content)) issues.push(`${label}: contains a fenced code block (code lives in source - summarize the takeaway to prose)`);
}

// Every registered path and file resolves on disk, the auto-memory seed exists,
// and every bucket / size key points at a real file key (no drift).
function checkRegistry(index) {
  const issues = [];
  for (const [k, p] of Object.entries(index.paths || {})) {
    if (!existsSync(fromRoot(p))) issues.push(`path "${k}" -> ${p} does not exist`);
  }
  for (const [k, p] of Object.entries(index.files || {})) {
    const abs = fromRoot(p);
    if (!existsSync(abs)) issues.push(`file "${k}" -> ${p} does not exist`);
    else if (!isFile(abs)) issues.push(`file "${k}" -> ${p} is not a regular file`);
  }
  const seed = index.auto_memory?.seed ?? index.auto_memory?.source;   // legacy key honored
  if (seed && !existsSync(fromRoot(seed))) issues.push(`auto_memory seed -> ${seed} does not exist`);
  const fileKeys = new Set(Object.keys(index.files || {}));
  for (const k of Object.keys(index.buckets || {})) if (!fileKeys.has(k)) issues.push(`bucket key "${k}" has no matching file`);
  for (const k of Object.keys(index.sizes || {})) if (!fileKeys.has(k)) issues.push(`size key "${k}" has no matching file`);
  for (const [k, s] of Object.entries(index.skills?.dispatch || {})) {
    if (!s.body) issues.push(`dispatch "${k}" has no body path`);
    else if (!existsSync(fromRoot(s.body))) issues.push(`dispatch "${k}" body -> ${s.body} does not exist`);
  }
  return issues;
}

function checkMemoryShape(index) {
  const issues = [];
  const mem = readRegisteredFile(index, "updatememory.memory");
  if (mem === null) { issues.push("updatememory.memory not found"); }
  else {
    needPurpose(mem, "MEMORY", issues);
    for (const s of BIG6) if (!mem.includes(`## ${s}`)) issues.push(`MEMORY: missing Big-6 section "## ${s}"`);
    if (!mem.includes("\n---")) issues.push("MEMORY: missing --- divider");
    if (!mem.includes("## LIFO")) issues.push("MEMORY: missing ## LIFO");
  }
  const ext = readRegisteredFile(index, "updatememory.memory_extended");
  if (ext === null) issues.push("updatememory.memory_extended not found");
  else { needPurpose(ext, "MEMORY_EXTENDED", issues); if (!ext.includes("## LIFO")) issues.push("MEMORY_EXTENDED: missing ## LIFO"); needNoFence(ext, "MEMORY_EXTENDED", issues); }
  return issues;
}

function checkSessionShape(index) {
  const issues = [];
  const ses = readRegisteredFile(index, "updatesession.session");
  if (ses === null) { issues.push("updatesession.session not found"); }
  else {
    needPurpose(ses, "SESSION", issues);
    if (!ses.includes("## Current State")) issues.push("SESSION: missing ## Current State");
    if (!ses.includes("\n---")) issues.push("SESSION: missing --- divider");
    if (!ses.includes("## LIFO")) issues.push("SESSION: missing ## LIFO");
  }
  const ext = readRegisteredFile(index, "updatesession.session_extended");
  if (ext === null) issues.push("updatesession.session_extended not found");
  else { needPurpose(ext, "SESSION_EXTENDED", issues); if (!ext.includes("## LIFO")) issues.push("SESSION_EXTENDED: missing ## LIFO"); needNoFence(ext, "SESSION_EXTENDED", issues); }
  return issues;
}

// Each registered skill body is well-formed: a frontmatter name + description (sync
// reads the description into the router, so a missing one ships an empty entry) and a
// Purpose callout. A legacy plural AIDOCS/SKILLS/ tree is a not-yet-imported pre-321
// skill set, flagged so the migration finishes bringing it into AIDOCS/SKILL/.
function checkSkillBodies(index) {
  const issues = [];
  if (existsSync(fromRoot("./AIDOCS/SKILLS"))) issues.push("legacy AIDOCS/SKILLS/ (plural) present - migrate it into AIDOCS/SKILL/");
  const bodiesRel = index.paths?.skills_bodies;
  if (!bodiesRel) return issues;
  const dir = fromRoot(bodiesRel);
  if (!existsSync(dir)) return issues;
  for (const f of readdirSync(dir).filter((n) => /^SKILL_.+\.md$/.test(n))) {
    const content = readFileSync(join(dir, f), "utf8");
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) { issues.push(`${f}: missing frontmatter block`); continue; }
    if (!/^name:\s*\S/m.test(fm[1])) issues.push(`${f}: frontmatter missing name`);
    if (!/^description:\s*\S/m.test(fm[1])) issues.push(`${f}: frontmatter missing description (sync reads it into the router)`);
    if (!/^\*\*Purpose:\*\*/m.test(content)) issues.push(`${f}: missing **Purpose:** callout`);
  }
  return issues;
}

// AGENTS Hard-rules links resolve to auto-memory files, and every feedback /
// profile file has a pointer (both directions). The mirror is checked against
// the in-repo seed (auto_memory.seed), the shippable canonical set. The runtime
// source of truth is the external Claude memory (auto_memory.path), which may
// carry extra project-custom rules - not a mirror concern. Legacy
// auto_memory.source (pre-seed/path schema) is honored so the rename is non-breaking.
function checkAutoMemory(index) {
  const issues = [];
  const agentsRel = index.paths?.agents_md;
  const srcRel = index.auto_memory?.seed ?? index.auto_memory?.source;
  if (!agentsRel || !srcRel) return issues;
  const agentsAbs = fromRoot(agentsRel);
  const dirAbs = fromRoot(srcRel);
  if (!existsSync(agentsAbs) || !existsSync(dirAbs)) return issues;
  const agents = readFileSync(agentsAbs, "utf8");
  const linked = [...agents.matchAll(/\]\(((?:feedback_|user_)[^)]+\.md)\)/g)].map((m) => m[1]);
  const onDisk = readdirSync(dirAbs).filter((f) => /^(feedback_|user_).+\.md$/.test(f));
  for (const l of linked) if (!onDisk.includes(l)) issues.push(`AGENTS Hard-rule link "${l}" has no auto-memory file`);
  for (const f of onDisk) if (!linked.includes(f)) issues.push(`auto-memory "${f}" has no AGENTS Hard-rule pointer`);
  return issues;
}

// Every [+] bullet in a main file pairs with a ### sub-section in its EXTENDED. The
// commit gate enforces this on staged writes. Doctor enforces it on a direct-edit
// reconcile, which bypasses commit. The pairing is checked main-to-extended only.
function checkOrphans(index) {
  const issues = [];
  for (const key of Object.keys(index.files || {})) {
    if (!index.files[`${key}_extended`]) continue;
    const main = readRegisteredFile(index, key);
    const ext = readRegisteredFile(index, `${key}_extended`);
    if (main === null || ext === null) continue;
    for (const e of findOrphanBullets(main, ext)) issues.push(`${key}: ${e}`);
  }
  return issues;
}

// A public project not gating its own knowledge is a leak: Tier B (memory, auto-memory,
// WDDOCS, the pruned *_ARCHIVE.md overflow) would be committed to an open repo. A missing
// .gitignore leaks in any mode, since Tier C secrets would track too. Error-tier
// (DEV-AUDIT anchor: fail at the gate where the damage is real). "full" (the template
// repo) is hand-maintained and an unset mode is a legacy project - both skip.
function checkPrivacyLeak(index) {
  const mode = index.privacy;
  if (!mode || mode === "full") return [];
  const giAbs = fromRoot("./.gitignore");
  if (!existsSync(giAbs)) return ["privacy is set but .gitignore is missing - secrets and project knowledge would be tracked"];
  if (mode === "public" && !hasPrivacyBlock(readFileSync(giAbs, "utf8"))) {
    return ['privacy is "public" but .gitignore has no public gate - memory / auto-memory / WDDOCS / pruned archives would be tracked (run privacy --set public)'];
  }
  return [];
}

// A private project still carrying the public gate is drift, not a leak: it over-ignores
// its own knowledge (keeps Tier B local when private would track it), nothing is exposed.
// Warning-tier, fixed by `privacy --set private`.
function checkPrivacyDrift(index) {
  if (index.privacy !== "private") return [];
  const giAbs = fromRoot("./.gitignore");
  if (existsSync(giAbs) && hasPrivacyBlock(readFileSync(giAbs, "utf8"))) {
    return ['privacy is "private" but .gitignore still carries the public gate (run privacy --set private)'];
  }
  return [];
}

// The upgrade bookkeeping arrays are well-formed: engine.operations_applied is a list of
// unique names (the journal of applied manifest ops), customizations[] is a list of
// project-relative paths whose files exist (a stale entry would silently shield a
// missing file from a future upgrade). Both are optional - a pre-upgrade-aware project
// has neither field, and that is fine.
function checkUpgradeSchema(index) {
  const issues = [];
  const applied = index.engine?.operations_applied;
  if (applied !== undefined) {
    if (!Array.isArray(applied)) issues.push("engine.operations_applied is not an array");
    else {
      const seen = new Set();
      for (const name of applied) {
        if (typeof name !== "string") { issues.push(`engine.operations_applied has a non-string entry: ${JSON.stringify(name)}`); continue; }
        if (seen.has(name)) issues.push(`engine.operations_applied has duplicate operation "${name}"`);
        seen.add(name);
      }
    }
  }
  const custom = index.customizations;
  if (custom !== undefined) {
    if (!Array.isArray(custom)) issues.push("customizations is not an array");
    else {
      for (const path of custom) {
        if (typeof path !== "string") { issues.push(`customizations has a non-string entry: ${JSON.stringify(path)}`); continue; }
        if (!existsSync(fromRoot(path))) issues.push(`customizations entry "${path}" points to a missing file`);
      }
    }
  }
  return issues;
}
