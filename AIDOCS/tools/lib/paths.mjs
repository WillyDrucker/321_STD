// paths.mjs - filesystem locations and registry resolution. Owns "where things
// live". Two roots: SOURCE_ROOT is the engine's own location (what init copies
// the skeleton FROM), and the active root is the project the operate-on commands
// act ON. The active root defaults to SOURCE_ROOT - a steady project runs its own
// engine - and is overridable with --root, so a fetched onboarding engine can
// operate on a separate target without being copied into it.

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// The engine's own project root (AIDOCS/tools/lib climbs three to the root).
export const SOURCE_ROOT = resolve(HERE, "..", "..", "..");

let activeRoot = SOURCE_ROOT;
export function setRoot(dir) { activeRoot = resolve(dir); }
export function repoRoot() { return activeRoot; }

export function indexPath() { return join(activeRoot, "AIDOCS", "_index.json"); }
export function stagingDir() { return join(activeRoot, "AIDOCS", "tools", "staging"); }
export function statePath() { return join(activeRoot, "AIDOCS", "tools", "state.json"); }
// The ephemeral fetch target for an engine update / re-setup (gitignored).
export function installEngineDir() { return join(activeRoot, "INSTALL", "engine"); }

// Absolute path for a registry-relative value ("./AIDOCS/x") against the active root.
export function fromRoot(rel) { return join(activeRoot, rel.replace(/^\.\//, "")); }

// Read and parse the active project's _index.json. The registry is load-bearing,
// so a missing or malformed registry fails loud rather than limping on.
export function loadIndex() {
  const p = indexPath();
  if (!existsSync(p)) throw new Error(`registry not found at ${p}`);
  return JSON.parse(readFileSync(p, "utf8"));
}

// Absolute path of a registered file by its domain-owned key (e.g.
// "memoryupdate.memory"). Throws if the key is not registered.
export function resolveFile(index, key) {
  const rel = index.files?.[key];
  if (!rel) throw new Error(`no file registered under key "${key}"`);
  return fromRoot(rel);
}

// Read a registered file's text by its domain-owned key. Returns null when the
// key is unregistered or the resolved path is not a regular file (a directory
// where a file should be, a dangling symlink). Read-only convenience used by
// the doctor checks - the throwing variant is resolveFile + readFileSync.
export function readRegisteredFile(index, key) {
  const rel = index.files?.[key];
  if (!rel) return null;
  const abs = fromRoot(rel);
  try {
    if (!statSync(abs).isFile()) return null;
  } catch {
    return null;   // best-effort: missing path reads as null, not a throw
  }
  return readFileSync(abs, "utf8");
}

// Canonicalize a path: realpath its longest existing ancestor (resolving symlinks,
// junctions, and case) and re-append the not-yet-created tail lexically. A symlink in
// the existing part then cannot redirect the result outside an intended root, which a
// plain resolve (lexical only) would miss. Best-effort: an un-realpathable ancestor
// falls back to the lexical form.
export function canonicalPath(p) {
  let abs = resolve(p);
  const tail = [];
  while (!existsSync(abs)) {
    tail.unshift(basename(abs));
    const parent = dirname(abs);
    if (parent === abs) break;   // hit the filesystem root
    abs = parent;
  }
  try { abs = realpathSync(abs); } catch { /* best-effort */ }
  return tail.length ? join(abs, ...tail) : abs;
}

// True when candidate is root itself or contained within it, compared on canonical
// (symlink-resolved) paths. The containment gate the migration sweep and fetch write
// through, so a crafted path cannot escape the project via a symlink or junction.
export function isContained(root, candidate) {
  const rel = relative(canonicalPath(root), canonicalPath(candidate));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

// The home base for Claude Code's per-project memory. STD321_MEMORY_HOME overrides it so
// the test suite can redirect seeding into a scratch tree instead of the real ~/.claude.
function memoryHome() { return process.env.STD321_MEMORY_HOME || homedir(); }

// Claude Code's native per-project memory directory for a project root - the runtime
// source of truth, loaded by the harness each session (the in-project AIDOCS/automemory
// is only the shippable seed). The harness keys the folder off the project cwd with the
// drive letter lowercased and the colon, separators, and underscores collapsed to "-".
// Derived once at install and recorded in _index.json (auto_memory.path), so later
// passes read the recorded value rather than re-deriving against an encoding that can
// shift between Claude Code releases. Returns an absolute path (the dir need not exist
// yet).
export function claudeMemoryKey(root) {
  return resolve(root).replace(/^([A-Za-z]):/, (_, d) => `${d.toLowerCase()}:`).replace(/[:\\/_]/g, "-");
}
export function claudeMemoryDir(root) {
  return join(memoryHome(), ".claude", "projects", claudeMemoryKey(root), "memory");
}

// Store the external path home-relative ("~/.claude/...") so a tracked _index.json never
// bakes in an absolute home path (the username and machine layout). fromHomeRef expands
// it back to absolute for filesystem ops. A non-home path is passed through unchanged.
export function toHomeRef(abs) {
  const home = memoryHome();
  return abs.startsWith(home) ? `~${abs.slice(home.length)}`.replace(/\\/g, "/") : abs.replace(/\\/g, "/");
}
export function fromHomeRef(ref) {
  return ref?.startsWith("~") ? join(memoryHome(), ref.slice(1)) : ref;
}
