// doctorContent.mjs - the content-quality arm of doctor: LIFO files sit under their
// registered caps, no unresolved migrate-import markers survive distillation, the
// authored prose targets hold to the house voice, and EXTENDED sub-sections stay
// within the 6-line target / 10-line soft cap. "Is the content within bounds?"
// Distinct from doctorIntegrity, which validates structure.

import { readFileSync } from "node:fs";

import { readRegisteredFile } from "./paths.mjs";
import { authoredTargets, scanBanned } from "./prose.mjs";
import { reconcilePending } from "./state.mjs";

// Banned prose splits two ways. In steady state every authored doc is a hard error -
// the engine and the AI write to house voice. During the reconcile window, prose in
// files that the migration RESTORED VERBATIM (CHANGELOG) or IMPORTED 1:1 (the depth
// _EXTENDED files) is historical content the reconcile pass will distill - keeping it
// as a hard error blocks the gate on exactly the prose UPDATE-RECONCILE.md says to
// defer. So during reconcile_pending those findings ride as reconcile warnings (they
// clear naturally as distillation lands), while everything else stays a hard error.
const HISTORICAL_PROSE_PATTERNS = [
  /(^|[\\/])CHANGELOG\.md$/,
  /_EXTENDED\.md$/,
];
function isHistoricalProseTarget(absPath) {
  return HISTORICAL_PROSE_PATTERNS.some((re) => re.test(absPath));
}

export function runContentChecks(index) {
  const prose = checkProse(index);
  return {
    errors: {
      "Banned prose": prose.errors,
    },
    warns: {
      "Size caps":          checkCaps(index),
      "Import residue":     checkResidue(index),
      "Sub-section budget": checkSubsectionBudget(index),
      "Banned prose in historical (reconcile target)": prose.historical,
    },
  };
}

// LIFO files sit under their registered cap. Steady state stays under via auto-prune,
// so over cap means a migration capture not yet distilled (warning, not a failure).
function checkCaps(index) {
  const issues = [];
  for (const [key, size] of Object.entries(index.sizes || {})) {
    if (!size?.cap) continue;
    const content = readRegisteredFile(index, key);
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
    const content = readRegisteredFile(index, key);
    if (content === null) continue;
    content.split("\n").forEach((line, i) => {
      if (line.includes("elided on import")) issues.push(`${key}:${i + 1} unresolved import marker (summarize the takeaway in prose)`);
    });
  }
  return issues;
}

// House-voice scan of our authored prose (prose.mjs owns the target set and the
// scanner that skips code fences and inline code). Returns errors vs historical
// reconcile-warns. The historical bucket is non-empty only while reconcile_pending
// is set, so a steady-state project still gates on every banned-prose finding.
function checkProse(index) {
  const out = { errors: [], historical: [] };
  const inReconcile = reconcilePending();
  for (const abs of authoredTargets(index)) {
    const name = abs.split(/[\\/]/).pop();
    let text;
    try { text = readFileSync(abs, "utf8"); } catch { continue; }
    const bucket = inReconcile && isHistoricalProseTarget(abs) ? out.historical : out.errors;
    for (const v of scanBanned(text)) bucket.push(`${name}:${v.line} ${v.kind}`);
  }
  return out;
}

// EXTENDED sub-sections target 6 lines, soft cap 10. A long sub-section bloats EXTENDED
// independent of the main LIFO bullet count, so it is the structural lever to keep
// EXTENDED and main autoprune timing in sync. Advisory-tier - the AI summarizes
// oversized entries on the next pass, the rule does not gate steady-state runs.
function checkSubsectionBudget(index) {
  const TARGET = 6, SOFT_CAP = 10;
  const issues = [];
  for (const key of Object.keys(index.files || {})) {
    if (!key.endsWith("_extended")) continue;
    const content = readRegisteredFile(index, key);
    if (content === null) continue;
    const lines = content.split("\n");
    let subStart = -1, subTitle = "";
    const finalize = (endIdx) => {
      if (subStart === -1) return;
      const subLen = endIdx - subStart;
      if (subLen > SOFT_CAP) issues.push(`${key}: "${subTitle}" runs ${subLen} lines (target ${TARGET}, soft cap ${SOFT_CAP} - summarize)`);
    };
    for (let i = 0; i < lines.length; i++) {
      if (/^###\s+/.test(lines[i])) {
        finalize(i);
        subStart = i;
        subTitle = lines[i].replace(/^###\s+/, "").trim();
      }
    }
    finalize(lines.length);
  }
  return issues;
}
