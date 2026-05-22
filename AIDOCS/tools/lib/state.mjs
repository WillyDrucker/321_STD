// state.mjs - the engine's mutable-state I/O. Owns the two machine-local files:
// the staging file a skill writes before commit, and state.json's per-skill
// watermarks. Both live under the active root's AIDOCS/tools, so an engine driven
// with --root reads and writes the target's state, not its own.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { fromRoot, indexPath, stagingDir, statePath } from "./paths.mjs";

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

// A cross-project doc ref (an un-renamed <Other>_MEMORY.md after a rename migration)
// or an unresolved import marker is the signature of an incomplete reconcile. The
// data lanes are scanned, the project's own name is the baseline, so any other
// project's doc ref is residue. Returns human-readable lines, empty when clean.
const DOC_REF = /\b([A-Za-z][A-Za-z0-9_-]*)_(MEMORY|SESSION|BACKLOG|DEV-AUDIT|AUTO-PUSH)(?:_EXTENDED|_ARCHIVE)?\.md\b/g;
function scanReconcileResidue() {
  const out = [];
  let index;
  try { index = JSON.parse(readFileSync(indexPath(), "utf8")); } catch { return out; }
  const current = index.project_name;
  for (const key of ["memoryupdate.memory", "memoryupdate.memory_extended", "sessionupdate.session", "sessionupdate.session_extended"]) {
    const rel = index.files?.[key];
    if (!rel) continue;
    const abs = fromRoot(rel);
    if (!existsSync(abs)) continue;
    readFileSync(abs, "utf8").split("\n").forEach((line, i) => {
      if (line.includes("elided on import")) out.push(`${key}:${i + 1} unresolved import marker`);
      for (const m of line.matchAll(DOC_REF)) {
        if (current && m[1] !== current) out.push(`${key}:${i + 1} stale cross-project ref "${m[0]}" (rename to ${current})`);
      }
    });
  }
  return out;
}

// state command: print state, or flip the reconcile_pending gate (the Setup ->
// reconcile handoff). Setup sets it before the migration capture, so commit holds
// auto-prune while it is set and the capture stays additive. The reconciliation
// pass (the gated -Update) curates the capture and clears the gate, or clear it by
// hand with --clear-reconcile. Steady-state auto-prune resumes once the gate is
// clear. Clearing refuses on reconcile residue (an incomplete distillation) unless
// --force is passed, so a half-finished reconcile cannot quietly graduate.
export function cmdState(_index, args) {
  if (args.includes("--set-reconcile") || args.includes("--clear-reconcile")) {
    const value = args.includes("--set-reconcile");
    const state = loadState();
    if (!value && !args.includes("--force")) {
      const residue = scanReconcileResidue();
      if (residue.length) {
        console.error(`state: ${residue.length} reconcile residue item(s) - the gate stays set (distill / rename, or --force to override):`);
        for (const r of residue) console.error(`  - ${r}`);
        process.exit(13);
      }
    }
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
