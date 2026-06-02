// doctor.mjs - validate a 321 project against its registry. The driver: pulls
// check results from doctorIntegrity (does the structure match the spec?) and
// doctorContent (is the content within bounds?), prints them as tier-grouped
// sections, exits non-zero on errors so install and the reconcile gate gate on
// them. The actual rules live in the two check modules - this file owns the run
// and the report shape.

import { runContentChecks } from "./doctorContent.mjs";
import { runIntegrityChecks } from "./doctorIntegrity.mjs";

// Warnings split two ways: reconcile warnings clear as the reconcile pass distills
// (size caps, import residue), advisory warnings are steady-state and gate nothing
// (privacy drift, sub-section budget). The summary counts the two classes apart so
// "warnings present" does not misread as "reconcile pending" on a graduated project.
const RECONCILE_WARN = new Set(["Size caps", "Import residue"]);

export function cmdDoctor(index) {
  const integrity = runIntegrityChecks(index);
  const content = runContentChecks(index);
  const errorChecks = { ...integrity.errors, ...content.errors };
  const warnChecks = { ...integrity.warns, ...content.warns };

  let errors = 0, reconcileWarns = 0, otherWarns = 0;
  for (const [name, issues] of Object.entries(errorChecks)) {
    console.log(`[${name}]`);
    if (issues.length === 0) { console.log("  ok"); continue; }
    errors += issues.length;
    for (const i of issues) console.log(`  - ${i}`);
  }
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
    const msgs = [];
    if (reconcileWarns) msgs.push(`${reconcileWarns} reconcile warning(s) - expected mid-migration, cleared by distillation`);
    if (otherWarns) msgs.push(`${otherWarns} advisory warning(s) - steady-state (privacy drift, sub-section budget), not a reconcile target`);
    console.log(`\ndoctor: structure clean. ${msgs.join(". ")}.`);
    return;
  }
  console.log(`\ndoctor: ${errors} issue(s)${reconcileWarns + otherWarns ? `, ${reconcileWarns + otherWarns} warning(s)` : ""} found.`);
  process.exit(20);
}
