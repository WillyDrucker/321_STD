// commit.mjs - apply a staging file to the project. Two-phase: simulate every op
// against in-memory copies first (any error aborts before a single write), then
// persist, stamp the skill's state watermark, and clear the staging. This is the
// safety the skills write through (DEV-AUDIT: compute fully before mutating).

import { readFileSync, writeFileSync } from "node:fs";

import { flag } from "./args.mjs";
import { slugify } from "./markdown.mjs";
import { lifoInsert, overwriteCurrentState, overwriteSection } from "./mutators.mjs";
import { applyExtendedAction, findOrphanBullets } from "./mutatorsExtended.mjs";
import { resolveFile } from "./paths.mjs";
import { autoPrune } from "./prune.mjs";
import { clearStaging, loadStaging, loadState, recentCaptured, reconcilePending, saveState, SKILLS } from "./state.mjs";
import { validateStaging } from "./validate.mjs";

// recent_captured rolling-window size. The AI uses it to answer "did I capture
// this arc?" - a handful of recent slugs is enough, more would just bloat state.json.
const FINGERPRINT_LIMIT = 8;

const EXTENDED_OPS = ["add", "drop", "replace"];

function applyOp(content, action) {
  if (action.op === "lifo_insert") return lifoInsert(content, action.section, action.bullet, Boolean(action.extended_anchor));
  if (action.op === "overwrite_section") {
    return action.section?.trim().toLowerCase() === "current state"
      ? overwriteCurrentState(content, action.body)
      : overwriteSection(content, action.section, action.body);
  }
  if (EXTENDED_OPS.includes(action.op)) return applyExtendedAction(content, action);
  throw new Error(`unknown op "${action.op}"`);
}

export function cmdCommit(index, args) {
  const skill = flag(args, "--skill");
  if (!SKILLS.includes(skill)) { console.error(`commit: --skill must be one of ${SKILLS.join(" / ")}`); process.exit(11); }
  const staging = loadStaging(skill);
  if (!staging) { console.error(`commit: no staging file for ${skill}. Nothing to commit.`); process.exit(12); }

  const errors = validateStaging(index, staging, skill);
  if (errors.length) {
    console.error(`commit: ${skill} staging has ${errors.length} error(s) - aborting before any write:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(13);
  }

  // Phase 1: simulate. Apply every op to in-memory copies, keyed by file. Any
  // throw (missing section, bad op) aborts here, before disk is touched.
  const edited = {};
  staging.actions.forEach((a, i) => {
    if (!(a.file in edited)) edited[a.file] = readFileSync(resolveFile(index, a.file), "utf8");
    try { edited[a.file] = applyOp(edited[a.file], a); }
    catch (e) { console.error(`commit: action ${i} failed: ${e.message} - no files written.`); process.exit(16); }
  });

  // Orphan-pair check on the simulated state: every [+] bullet in a main file
  // needs a matching ### sub-section in its paired EXTENDED file. Covers any pair
  // where either side was edited, reading the unedited side from disk.
  const orphanErrors = [];
  const mainKeys = new Set();
  for (const key of Object.keys(edited)) {
    const mainKey = key.replace(/_extended$/, "");
    if (index.files?.[`${mainKey}_extended`]) mainKeys.add(mainKey);
  }
  for (const mainKey of mainKeys) {
    const extKey = `${mainKey}_extended`;
    const mainContent = mainKey in edited ? edited[mainKey] : readFileSync(resolveFile(index, mainKey), "utf8");
    const extContent = extKey in edited ? edited[extKey] : readFileSync(resolveFile(index, extKey), "utf8");
    for (const e of findOrphanBullets(mainContent, extContent)) orphanErrors.push(`${mainKey}: ${e}`);
  }
  if (orphanErrors.length) {
    console.error(`commit: ${orphanErrors.length} orphan error(s) - no files written:`);
    for (const e of orphanErrors) console.error(`  - ${e}`);
    process.exit(17);
  }

  // Phase 2: persist, stamp the watermark, record this run's bullet fingerprints,
  // clear staging. recent_captured is a rolling window of the last FINGERPRINT_LIMIT
  // lifo_insert slugs across recent commits (newest first). The AI reads them via
  // `watermark` to answer "did I capture this arc?" without re-reading SESSION /
  // MEMORY. recentCaptured honors the legacy last_captured key, so a state.json
  // laid by an older engine migrates forward on this commit.
  for (const [key, content] of Object.entries(edited)) writeFileSync(resolveFile(index, key), content, "utf8");
  const state = loadState();
  const captured = [];
  for (const a of staging.actions) if (a.op === "lifo_insert") captured.push(slugify(a.bullet));
  const merged = [...captured.reverse(), ...recentCaptured(state[skill])].slice(0, FINGERPRINT_LIMIT);
  state[skill] = {
    runs: (state[skill]?.runs || 0) + 1,
    last_committed_at: new Date().toISOString(),
    recent_captured: merged,
  };
  saveState(state);
  clearStaging(skill);
  console.log(`commit: ${skill} applied ${staging.actions.length} action(s) to ${Object.keys(edited).length} file(s).`);

  // Post-commit auto-prune: trim over-cap LIFO files, protecting this commit's
  // fresh bullets (by rendered line) and the Last State marker. Held whenever a
  // reconcile is pending, so a migration capture stays additive - nothing is
  // reaped until the reconcile pass curates under cap and clears the gate.
  if (reconcilePending()) {
    console.log("commit: auto-prune held - reconcile pending (capture stays additive until reconcile clears the gate).");
    return;
  }
  const fresh = new Set();
  for (const a of staging.actions) if (a.op === "lifo_insert") fresh.add(a.extended_anchor ? `- [+] ${a.bullet}` : `- ${a.bullet}`);
  autoPrune(index, Object.keys(edited), fresh);
}
