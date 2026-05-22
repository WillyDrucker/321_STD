// state.mjs - the engine's mutable-state I/O. Owns the two machine-local files:
// the staging file a skill writes before commit, and state.json's per-skill
// watermarks. Both live under the active root's AIDOCS/tools, so an engine driven
// with --root reads and writes the target's state, not its own.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { stagingDir, statePath } from "./paths.mjs";

// The skill domains that own a staging lane plus a state watermark.
export const SKILLS = ["sessionupdate", "memoryupdate"];

function stagingPath(skill) {
  return join(stagingDir(), `${skill}.json`);
}

export function loadStaging(skill) {
  const p = stagingPath(skill);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

export function clearStaging(skill) {
  const p = stagingPath(skill);
  if (existsSync(p)) unlinkSync(p);
}

export function loadState() {
  const p = statePath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}

export function saveState(state) {
  const p = statePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function reconcilePending() {
  return loadState().reconcile_pending === true;
}

// state command: print state, or flip the reconcile_pending gate (the Setup ->
// reconcile handoff). Setup sets it before the migration capture, so commit holds
// auto-prune while it is set and the capture stays additive. The reconciliation
// pass (the gated -Update) curates the capture and clears the gate, or clear it by
// hand with --clear-reconcile. Steady-state auto-prune resumes once the gate is
// clear.
export function cmdState(_index, args) {
  if (args.includes("--set-reconcile") || args.includes("--clear-reconcile")) {
    const value = args.includes("--set-reconcile");
    const state = loadState();
    state.reconcile_pending = value;
    // Clearing the gate ends the reconciliation pass, whose direct-edit reshape
    // bypasses commit's watermark stamp. Stamp both lanes current here so a routine
    // -Update afterward does not re-walk from a pre-migration point.
    if (!value) {
      const now = new Date().toISOString();
      for (const skill of SKILLS) state[skill] = { runs: state[skill]?.runs || 0, last_committed_at: now };
    }
    saveState(state);
    console.log(`state: reconcile_pending = ${value}.${value ? "" : " Lanes stamped current."}`);
    return;
  }
  console.log(JSON.stringify(loadState(), null, 2));
}
