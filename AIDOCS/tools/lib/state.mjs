// state.mjs - the engine's mutable-state I/O. Owns the two machine-local files:
// the staging file a skill writes before commit, and state.json's per-skill
// watermarks. Both live under the active root's AIDOCS/tools, so an engine driven
// with --root reads and writes the target's state, not its own.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { fromRoot, indexPath, stagingDir, statePath } from "./paths.mjs";

// The skill domains that own a staging lane plus a state watermark.
export const SKILLS = ["updatesession", "updatememory"];

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

// The rolling fingerprint window for a skill's state entry, with the legacy key
// honored: an older state.json carries last_captured, the current schema
// recent_captured. Readers treat them as one field through this accessor, and the
// next commit writes the canonical key, so the legacy name migrates forward on its own.
export function recentCaptured(entry) {
  if (Array.isArray(entry?.recent_captured)) return entry.recent_captured;
  if (Array.isArray(entry?.last_captured)) return entry.last_captured;
  return [];
}

// A cross-project doc ref (an un-renamed <Other>_MEMORY.md after a rename migration)
// or an unresolved import marker is the signature of an incomplete reconcile. The
// data lanes are scanned, the project's own name is the baseline, so any other
// project's doc ref is residue. Returns human-readable lines, empty when clean.
// The prefix group must accept the same [A-Za-z0-9] leader as validName so a
// digit-leading project name (321DONE-web, 9to5) is matched whole, not stripped at
// the digits and misread as a cross-project ref.
const DOC_REF = /\b([A-Za-z0-9][A-Za-z0-9_-]*)_(MEMORY|SESSION|BACKLOG|DEV-AUDIT|AUTO-PUSH)(?:_EXTENDED|_ARCHIVE)?\.md\b/g;
function scanReconcileResidue() {
  const out = [];
  let index;
  try { index = JSON.parse(readFileSync(indexPath(), "utf8")); } catch { return out; }
  const current = index.project_name;
  for (const key of ["updatememory.memory", "updatememory.memory_extended", "updatesession.session", "updatesession.session_extended"]) {
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
    if (value) { state.reconcile_pending = true; saveState(state); console.log("state: reconcile_pending = true."); return; }
    // Clearing the gate ends the reconciliation pass, whose direct-edit reshape bypasses
    // commit's watermark stamp. Stamp both lanes current, and reduce to the canonical
    // shape so a legacy migration's pre-rebuild watermark keys (session_update /
    // memory_update) do not linger beside the new ones. Preserve recent_captured if a
    // commit had stamped fingerprints before the reconcile pass, so the AI's "did I
    // capture this arc?" lookup survives the gate flip. Fall back to the legacy
    // last_captured key so an older state.json still carries forward.
    const now = new Date().toISOString();
    const normalized = { reconcile_pending: false };
    for (const skill of SKILLS) {
      const entry = { runs: state[skill]?.runs || 0, last_committed_at: now };
      const recent = recentCaptured(state[skill]);
      if (recent.length) entry.recent_captured = recent;
      normalized[skill] = entry;
    }
    saveState(normalized);
    console.log("state: reconcile_pending = false. Lanes stamped current.");
    return;
  }
  console.log(JSON.stringify(loadState(), null, 2));
}
