// state.mjs - I/O surface for _index.json, AIDOCS/tools/state.json, and per-skill
// staging files. Plus small skill-key utilities (timestamp, flag formatter).

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";

import { err } from "./cli.mjs";
import { findCrossRefResidue, findLifoResidue } from "./markdown.mjs";
import { INDEX_PATH, REPO_ROOT, STAGING_DIR, STATE_PATH } from "./paths.mjs";

export async function loadIndex() {
  if (!existsSync(INDEX_PATH)) {
    err(`Index not found at ${INDEX_PATH}.`);
    process.exit(5);
  }
  const raw = await readFile(INDEX_PATH, "utf8");
  return JSON.parse(raw);
}

// Resolve a project-relative path and guarantee it stays inside REPO_ROOT.
// _index.json mappings and CLI path args are attacker-controllable when the
// engine runs on an untrusted project, so a `..` escape or an absolute path
// could read or write outside the project. Reject those instead of resolving.
export function resolveWithinRepo(rel, label) {
  const abs = resolve(REPO_ROOT, rel);
  const within = relative(REPO_ROOT, abs);
  if (within === "" || within.startsWith("..") || isAbsolute(within)) {
    err(`${label} "${rel}" resolves outside the project root - refusing (path traversal).`);
    process.exit(5);
  }
  return abs;
}

export function resolveIndexFile(index, key) {
  const rel = index.files?.[key];
  if (!rel) {
    err(`No file mapping for "${key}" in _index.json. Known keys: ${Object.keys(index.files || {}).join(", ")}`);
    process.exit(6);
  }
  return resolveWithinRepo(rel, `_index.json files.${key}`);
}

// Pre-flight: source files must exist before any mutating command runs. Exit 16
// is the canonical signal for "missing source file" (distinct from missing
// mapping at exit 6). Loud error vs Node's ENOENT crash; points the user at the
// two real recovery paths (init, or fix _index.json).
export function assertFileExists(path, key) {
  if (!existsSync(path)) {
    err(`Source file not found: ${key} at ${path}`);
    err(`Either the project has not been scaffolded (\`node AIDOCS/tools/memory.mjs init <target-dir>\`) or the path in _index.json -> files.${key} is wrong.`);
    process.exit(16);
  }
}

export function stagingPath(skill) {
  return join(STAGING_DIR, `${skill}.json`);
}

export async function loadStaging(skill) {
  const path = stagingPath(skill);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Staging file ${path} is not valid JSON: ${e.message}`);
  }
}

export async function loadState() {
  if (!existsSync(STATE_PATH)) return bootstrapState();
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    err(`state.json malformed: ${e.message}. Run \`node AIDOCS/tools/memory.mjs state --reset\` to bootstrap.`);
    process.exit(15);
  }
}

export function bootstrapState() {
  return {
    session_update: { run_count: 0, last_committed_at: null },
    memory_update: { run_count: 0, last_committed_at: null },
    reconcile_pending: false,
  };
}

export async function saveState(state) {
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

// Scan the engine-managed files for migrate-import residue the reconcile pass
// should have cleared: anchors / dates left on MAIN LIFO bullets (findLifoResidue),
// and un-renamed cross-project doc-file refs in MAIN or EXTENDED bodies
// (findCrossRefResidue). Returns [{ key, line, kind, snippet }] with kind one of
// anchor / date / cross-ref. Shared by doctor (reports a structural bucket) and the
// clear-reconcile gate (refuses to close on an incomplete reconcile). Only
// meaningful once reconcile_pending is false - callers own that gate check.
export async function scanReconcileResidue(index) {
  const out = [];
  // The live project's filename prefix (e.g. "TEST321"), to tell its own doc refs
  // from an un-renamed other-project ref. Derived from the memory file's basename.
  const memRel = index?.files?.memory;
  const currentName = memRel ? memRel.split(/[\\/]/).pop().replace(/_MEMORY\.md$/i, "") : null;
  for (const key of ["memory", "session"]) {
    const rel = index?.files?.[key];
    if (!rel) continue;
    const abs = resolve(REPO_ROOT, rel);
    if (!existsSync(abs)) continue;
    const content = await readFile(abs, "utf8");
    for (const hit of findLifoResidue(content.split("\n"))) out.push({ key, ...hit });
    for (const hit of findCrossRefResidue(content, currentName)) out.push({ key, ...hit });
  }
  for (const key of ["memory_extended", "session_extended"]) {
    const rel = index?.files?.[key];
    if (!rel) continue;
    const abs = resolve(REPO_ROOT, rel);
    if (!existsSync(abs)) continue;
    const content = await readFile(abs, "utf8");
    for (const hit of findCrossRefResidue(content, currentName)) out.push({ key, ...hit });
  }
  return out;
}

export function nowIsoUtc() {
  return new Date().toISOString();
}

// Archive-filename stamp: YYYY-MM-DD_HH-MM in UTC (minute precision). The
// in-file "Archived at:" header keeps full-precision nowIsoUtc. Same-minute
// filename clashes are resolved by uniqueArchivePath.
export function nowStampUtc() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}-${p(d.getUTCMinutes())}`;
}

// Non-colliding archive path under `dir`: `<base>.md`, else `<base>-2.md`,
// `<base>-3.md`, ... Keeps minute-precision stamps unique when one prune run
// writes more than one archive in the same minute.
export function uniqueArchivePath(dir, base) {
  let candidate = join(dir, `${base}.md`);
  let n = 2;
  while (existsSync(candidate)) {
    candidate = join(dir, `${base}-${n}.md`);
    n += 1;
  }
  return candidate;
}
