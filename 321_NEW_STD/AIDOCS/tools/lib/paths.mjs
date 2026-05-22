// paths.mjs - filesystem locations and registry resolution. Owns "where things
// live". Two roots: SOURCE_ROOT is the engine's own location (what init copies
// the skeleton FROM), and the active root is the project the operate-on commands
// act ON. The active root defaults to SOURCE_ROOT - a steady project runs its own
// engine - and is overridable with --root, so a fetched onboarding engine can
// operate on a separate target without being copied into it.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
