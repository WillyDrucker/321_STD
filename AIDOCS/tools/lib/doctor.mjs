// doctor.mjs - validate a 321 project against its registry. Read-only: reports,
// never fixes. Errors (registry resolves, memory and session shapes intact, every
// [+] bullet paired with its EXTENDED sub-section, auto-memory pointers match, no
// banned prose) exit non-zero so install and the reconcile gate can gate on them.
// Warnings split two ways: reconcile warnings (LIFO over cap, unresolved import
// markers) clear as the reconcile pass distills, advisory warnings (privacy drift,
// WDDOCS prose) are steady-state and gate nothing (DEV-AUDIT anchor: fail at gates).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { hasPrivacyBlock } from "./gitignore.mjs";
import { findOrphanBullets } from "./mutatorsExtended.mjs";
import { fromRoot } from "./paths.mjs";
import { authoredTargets, isFile, scanBanned, wddocsTargets } from "./prose.mjs";

const BIG6 = ["Overview", "Stack", "Architecture", "Environment", "Pipeline", "Conventions"];

export function cmdDoctor(index) {
  // Errors fail the run. Orphan pairs are an error because a capture never lands one
  // (migrate-import emits both sides), so a broken pair is always a real problem.
  const errorChecks = {
    "Registry":             checkRegistry(index),
    "Memory shape":         checkMemoryShape(index),
    "Session shape":        checkSessionShape(index),
    "Skill bodies":         checkSkillBodies(index),
    "Orphan pairs":         checkOrphans(index),
    "Auto-memory pointers": checkAutoMemory(index),
    "Banned prose":         checkProse(index),
    "Privacy gate":         checkPrivacyLeak(index),
  };
  // Warnings do not fail the run. A capture lands additively over cap with import
  // markers still in place, so these are expected mid-migration - the reconcile pass
  // drives them to zero by distilling, and a fully clean doctor is its gate.
  const warnChecks = {
    "Size caps":      checkCaps(index),
    "Import residue": checkResidue(index),
    "Privacy drift":  checkPrivacyDrift(index),
    "WDDOCS prose":   checkWddocsProse(index),
  };
  // Caps and import residue are reconcile targets - a migration capture distills them
  // to zero. Privacy drift and WDDOCS prose are steady-state advisories no distillation
  // clears, so the summary counts the two classes apart instead of calling every warning
  // a reconcile leftover (which misreads on a graduated project).
  const RECONCILE_WARN = new Set(["Size caps", "Import residue"]);
  let errors = 0, reconcileWarns = 0, otherWarns = 0;
  for (const [name, issues] of Object.entries(errorChecks)) {
    console.log(`[${name}]`);
    if (issues.length === 0) { console.log("  ok"); continue; }
    errors += issues.length;
    for (const i of issues) console.log(`  - ${i}`);
  }
  for (const [name, issues] of Object.entries(warnChecks)) {
    console.log(`[${name}]`);
    if (issues.length === 0) { console.log("  ok"); continue; }
    if (RECONCILE_WARN.has(name)) reconcileWarns += issues.length; else otherWarns += issues.length;
    for (const i of issues) console.log(`  - ${i} (warning)`);
  }
  if (errors === 0 && reconcileWarns === 0 && otherWarns === 0) { console.log("\ndoctor: all checks passed."); return; }
  if (errors === 0) {
    const msgs = [];
    if (reconcileWarns) msgs.push(`${reconcileWarns} reconcile warning(s) - expected mid-migration, cleared by distillation`);
    if (otherWarns) msgs.push(`${otherWarns} advisory warning(s) - steady-state (privacy / WDDOCS prose), not a reconcile target`);
    console.log(`\ndoctor: structure clean. ${msgs.join(". ")}.`);
    return;
  }
  console.log(`\ndoctor: ${errors} issue(s)${reconcileWarns + otherWarns ? `, ${reconcileWarns + otherWarns} warning(s)` : ""} found.`);
  process.exit(20);
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

function readReg(index, key) {
  const rel = index.files?.[key];
  if (!rel) return null;
  const abs = fromRoot(rel);
  return isFile(abs) ? readFileSync(abs, "utf8") : null;
}

function needPurpose(content, label, issues) {
  if (!/^\*\*Purpose:\*\*/m.test(content)) issues.push(`${label}: missing **Purpose:** callout`);
}

function checkMemoryShape(index) {
  const issues = [];
  const mem = readReg(index, "memoryupdate.memory");
  if (mem === null) { issues.push("memoryupdate.memory not found"); }
  else {
    needPurpose(mem, "MEMORY", issues);
    for (const s of BIG6) if (!mem.includes(`## ${s}`)) issues.push(`MEMORY: missing Big-6 section "## ${s}"`);
    if (!mem.includes("\n---")) issues.push("MEMORY: missing --- divider");
    if (!mem.includes("## LIFO")) issues.push("MEMORY: missing ## LIFO");
  }
  const ext = readReg(index, "memoryupdate.memory_extended");
  if (ext === null) issues.push("memoryupdate.memory_extended not found");
  else { needPurpose(ext, "MEMORY_EXTENDED", issues); if (!ext.includes("## LIFO")) issues.push("MEMORY_EXTENDED: missing ## LIFO"); needNoFence(ext, "MEMORY_EXTENDED", issues); }
  return issues;
}

// Code never belongs in EXTENDED - it lives in the source, and the 1:1 import elides
// it to a marker. The staging gate blocks a fenced body, but a direct-edit reconcile
// bypasses staging, so doctor catches a fence the hand-edit path would let through.
function needNoFence(content, label, issues) {
  if (/^\s*```/m.test(content)) issues.push(`${label}: contains a fenced code block (code lives in source - summarize the takeaway to prose)`);
}

function checkSessionShape(index) {
  const issues = [];
  const ses = readReg(index, "sessionupdate.session");
  if (ses === null) { issues.push("sessionupdate.session not found"); }
  else {
    needPurpose(ses, "SESSION", issues);
    if (!ses.includes("## Current State")) issues.push("SESSION: missing ## Current State");
    if (!ses.includes("\n---")) issues.push("SESSION: missing --- divider");
    if (!ses.includes("## LIFO")) issues.push("SESSION: missing ## LIFO");
  }
  const ext = readReg(index, "sessionupdate.session_extended");
  if (ext === null) issues.push("sessionupdate.session_extended not found");
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
// profile file has a pointer (both directions).
function checkAutoMemory(index) {
  const issues = [];
  const agentsRel = index.paths?.agents_md;
  // The AGENTS Hard-rules mirror is checked against the in-repo seed (auto_memory.seed),
  // the shippable canonical set. The runtime source of truth is the external Claude memory
  // (auto_memory.path), which may carry extra project-custom rules - not a mirror concern.
  // Legacy auto_memory.source (pre-seed/path schema) is honored so the rename is non-breaking.
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
    const main = readReg(index, key);
    const ext = readReg(index, `${key}_extended`);
    if (main === null || ext === null) continue;
    for (const e of findOrphanBullets(main, ext)) issues.push(`${key}: ${e}`);
  }
  return issues;
}

// LIFO files sit under their registered cap. Steady state stays under via auto-prune,
// so over cap means a migration capture not yet distilled (warning, not a failure).
function checkCaps(index) {
  const issues = [];
  for (const [key, size] of Object.entries(index.sizes || {})) {
    if (!size?.cap) continue;
    const content = readReg(index, key);
    if (content === null) continue;
    const lines = content.split("\n").length;
    if (lines > size.cap) issues.push(`${key}: ${lines} lines over the ${size.cap} cap (distill, do not hand-prune)`);
  }
  return issues;
}

// No unresolved migrate-import marker. The 1:1 scavenge elides code to a marker the
// reconcile pass must replace with a prose takeaway, so a survivor is under-distillation.
function checkResidue(index) {
  const issues = [];
  for (const key of Object.keys(index.files || {})) {
    const content = readReg(index, key);
    if (content === null) continue;
    content.split("\n").forEach((line, i) => {
      if (line.includes("elided on import")) issues.push(`${key}:${i + 1} unresolved import marker (summarize the takeaway in prose)`);
    });
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

// Em dashes and semicolons in our authored prose (prose.mjs owns the target set and
// the scanner that skips code fences and inline code). Error-tier: this is the output
// the engine and the AI write, so banned glyphs here are a real house-voice miss.
function checkProse(index) {
  const issues = [];
  for (const abs of authoredTargets(index)) {
    const name = abs.split(/[\\/]/).pop();
    let text;
    try { text = readFileSync(abs, "utf8"); } catch { continue; }
    for (const v of scanBanned(text)) issues.push(`${name}:${v.line} ${v.kind}`);
  }
  return issues;
}

// Banned prose in user-owned WDDOCS (design / business / working docs). Warning-tier,
// not error: it is the user's authorship, not ours, so the no-em-dash / no-semicolon
// rule does not gate on it. A migration restores these verbatim, so without this split
// a project with user docs that use semicolons could never reach a clean doctor.
function checkWddocsProse(index) {
  const issues = [];
  for (const abs of wddocsTargets(index)) {
    const name = abs.split(/[\\/]/).pop();
    let text;
    try { text = readFileSync(abs, "utf8"); } catch { continue; }
    for (const v of scanBanned(text)) issues.push(`${name}:${v.line} ${v.kind}`);
  }
  return issues;
}
