// doctor.mjs - validate a 321 project against its registry. Read-only: reports,
// never fixes. Errors (registry resolves, memory and session shapes intact, every
// [+] bullet paired with its EXTENDED sub-section, auto-memory pointers match, no
// banned prose) exit non-zero so install and the reconcile gate can gate on them.
// Warnings (LIFO over cap, unresolved import markers) are expected mid-migration
// and clear as the reconcile pass distills (DEV-AUDIT anchor: fail at gates).

import { existsSync, readdirSync, readFileSync } from "node:fs";

import { findOrphanBullets } from "./mutatorsExtended.mjs";
import { fromRoot } from "./paths.mjs";
import { authoredTargets, isFile, scanBanned } from "./prose.mjs";

const BIG6 = ["Overview", "Stack", "Architecture", "Environment", "Pipeline", "Conventions"];

export function cmdDoctor(index) {
  // Errors fail the run. Orphan pairs are an error because a capture never lands one
  // (migrate-import emits both sides), so a broken pair is always a real problem.
  const errorChecks = {
    "Registry":             checkRegistry(index),
    "Memory shape":         checkMemoryShape(index),
    "Session shape":        checkSessionShape(index),
    "Orphan pairs":         checkOrphans(index),
    "Auto-memory pointers": checkAutoMemory(index),
    "Banned prose":         checkProse(index),
  };
  // Warnings do not fail the run. A capture lands additively over cap with import
  // markers still in place, so these are expected mid-migration - the reconcile pass
  // drives them to zero by distilling, and a fully clean doctor is its gate.
  const warnChecks = {
    "Size caps":      checkCaps(index),
    "Import residue": checkResidue(index),
  };
  let errors = 0, warns = 0;
  for (const [name, issues] of Object.entries(errorChecks)) {
    console.log(`[${name}]`);
    if (issues.length === 0) { console.log("  ok"); continue; }
    errors += issues.length;
    for (const i of issues) console.log(`  - ${i}`);
  }
  for (const [name, issues] of Object.entries(warnChecks)) {
    console.log(`[${name}]`);
    if (issues.length === 0) { console.log("  ok"); continue; }
    warns += issues.length;
    for (const i of issues) console.log(`  - ${i} (warning)`);
  }
  if (errors === 0 && warns === 0) { console.log("\ndoctor: all checks passed."); return; }
  if (errors === 0) { console.log(`\ndoctor: structure clean, ${warns} reconcile warning(s) - expected mid-migration, cleared by distillation.`); return; }
  console.log(`\ndoctor: ${errors} issue(s)${warns ? `, ${warns} warning(s)` : ""} found.`);
  process.exit(20);
}

// Every registered path and file resolves on disk, the auto-memory source exists,
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
  const src = index.auto_memory?.source;
  if (src && !existsSync(fromRoot(src))) issues.push(`auto_memory.source -> ${src} does not exist`);
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
  else { needPurpose(ext, "MEMORY_EXTENDED", issues); if (!ext.includes("## LIFO")) issues.push("MEMORY_EXTENDED: missing ## LIFO"); }
  return issues;
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
  else { needPurpose(ext, "SESSION_EXTENDED", issues); if (!ext.includes("## LIFO")) issues.push("SESSION_EXTENDED: missing ## LIFO"); }
  return issues;
}

// AGENTS Hard-rules links resolve to auto-memory files, and every feedback /
// profile file has a pointer (both directions).
function checkAutoMemory(index) {
  const issues = [];
  const agentsRel = index.paths?.agents_md;
  const srcRel = index.auto_memory?.source;
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

// Em dashes and semicolons in authored prose (prose.mjs owns the target set and
// the scanner that skips code fences and inline code).
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
