// doctor.mjs - validate a 321 project against its registry. Pulls results from
// doctorIntegrity (structure matches the spec?) and doctorContent (content within
// bounds?), prints them as tier-grouped sections, and exits by worst error class:
// 20 for a structural break (a sync must stop), 10 for content-only debt (banned
// prose / shape, structure intact) so a wrapper tells the two apart, 0 otherwise.
// The rules live in the two check modules - this file owns the run and report shape.

import { runContentChecks } from "./doctorContent.mjs";
import { runIntegrityChecks } from "./doctorIntegrity.mjs";

// Warnings split two ways: reconcile warnings clear as the reconcile pass distills
// (size caps, import residue), advisory warnings are steady-state and gate nothing
// (privacy drift, sub-section budget). The summary counts the two classes apart so
// "warnings present" does not misread as "reconcile pending" on a graduated project.
const RECONCILE_WARN = new Set(["Size caps", "Import residue", "Banned prose in historical (reconcile target)"]);

export function cmdDoctor(index) {
  const integrity = runIntegrityChecks(index);
  const content = runContentChecks(index);
  const warnChecks = { ...integrity.warns, ...content.warns };

  // Count structural (integrity) and content errors apart, but print both tiers in the
  // same grouped report (integrity first, then content) so the operator's view is
  // unchanged. The split feeds the exit code: 20 for a structural break, 10 for content-
  // only debt with the structure intact, so a sync wrapper can tell the two apart.
  const integrityErrors = printErrorTier(integrity.errors);
  const contentErrors = printErrorTier(content.errors);
  const errors = integrityErrors + contentErrors;

  let reconcileWarns = 0, otherWarns = 0;
  for (const [name, issues] of Object.entries(warnChecks)) {
    console.log(`[${name}]`);
    if (issues.length === 0) { console.log("  ok"); continue; }
    if (RECONCILE_WARN.has(name)) reconcileWarns += issues.length; else otherWarns += issues.length;
    for (const i of issues) console.log(`  - ${i} (warning)`);
  }
  if (errors === 0 && reconcileWarns === 0 && otherWarns === 0) {
    console.log("\ndoctor: all checks passed.");
    return;
  }
  if (errors === 0) {
    // A graduated project has no migration in flight, so its reconcile-class warnings
    // (an over-cap lane, residue) are plain distillation targets - "mid-migration"
    // phrasing would misread as an unfinished onboarding.
    const reconcileHint = index.graduated === true
      ? "distillation targets (run /321 -Update to distill)"
      : "expected mid-migration, cleared by distillation";
    const msgs = [];
    if (reconcileWarns) msgs.push(`${reconcileWarns} reconcile warning(s) - ${reconcileHint}`);
    if (otherWarns) msgs.push(`${otherWarns} advisory warning(s) - steady-state (privacy drift, sub-section budget), not a reconcile target`);
    console.log(`\ndoctor: structure clean. ${msgs.join(". ")}.`);
    return;
  }

  // Errors present. A structural (integrity) error means the engine surface is wrong, so
  // exit 20 and a sync wrapper stops. Content-only errors (banned prose, shape debt) with
  // the structure intact exit 10, so the wrapper can tell "the upgrade broke the structure"
  // from "the project carries pre-existing content debt" by exit code alone.
  const warnTail = reconcileWarns + otherWarns ? `, ${reconcileWarns + otherWarns} warning(s)` : "";
  if (integrityErrors > 0) {
    console.log(`\ndoctor: ${errors} issue(s)${warnTail} found (${integrityErrors} structural). Exit 20.`);
    process.exit(20);
  }
  console.log(`\ndoctor: ${contentErrors} content issue(s)${warnTail} found, structure clean - pre-existing content debt, not a structural failure. Exit 10.`);
  process.exit(10);
}

// Print one error-tier check group, return its total issue count. Errors fail the run; the
// caller maps the structural vs content split onto the exit code (20 vs 10).
function printErrorTier(checks) {
  let count = 0;
  for (const [name, issues] of Object.entries(checks)) {
    console.log(`[${name}]`);
    if (issues.length === 0) { console.log("  ok"); continue; }
    count += issues.length;
    for (const i of issues) console.log(`  - ${i}`);
  }
  return count;
}
