// doctor.mjs - validate a 321 project against its registry. Read-only:
// reports, never fixes. Checks the registry resolves on disk, the memory and
// session shapes are intact, the auto-memory pointers match both ways, and
// authored prose carries no banned characters. Any issue exits non-zero so
// install can gate on it (DEV-AUDIT anchor: fail at gates).

import { existsSync, readFileSync, readdirSync } from "node:fs";

import { fromRoot } from "./paths.mjs";
import { authoredTargets, scanBanned } from "./prose.mjs";

const BIG6 = ["Overview", "Stack", "Architecture", "Environment", "Pipeline", "Conventions"];

export function cmdDoctor(index) {
  const checks = {
    "Registry":             checkRegistry(index),
    "Memory shape":         checkMemoryShape(index),
    "Session shape":        checkSessionShape(index),
    "Auto-memory pointers": checkAutoMemory(index),
    "Banned prose":         checkProse(index),
  };
  let total = 0;
  for (const [name, issues] of Object.entries(checks)) {
    console.log(`[${name}]`);
    if (issues.length === 0) { console.log("  ok"); continue; }
    total += issues.length;
    for (const i of issues) console.log(`  - ${i}`);
  }
  if (total === 0) { console.log("\ndoctor: all checks passed."); return; }
  console.log(`\ndoctor: ${total} issue(s) found.`);
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
    if (!existsSync(fromRoot(p))) issues.push(`file "${k}" -> ${p} does not exist`);
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
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
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

// Em dashes and semicolons in authored prose (prose.mjs owns the target set and
// the scanner that skips code fences and inline code).
function checkProse(index) {
  const issues = [];
  for (const abs of authoredTargets(index)) {
    const name = abs.split(/[\\/]/).pop();
    for (const v of scanBanned(readFileSync(abs, "utf8"))) issues.push(`${name}:${v.line} ${v.kind}`);
  }
  return issues;
}
