// graduate.mjs - the reconcile pass's Phase 2 cleanup. Once a project is steady
// (gate cleared, doctor clean), tear down the onboarding tier: deregister -Setup,
// carve the engine back to steady, remove INSTALL/, and mark the project graduated
// so a later -Sync refresh does not re-introduce the onboarding machinery.
//
// All A, idempotent. Gated: refuses while reconcile_pending is set, so a project
// never loses its onboarding tier before it has genuinely distilled. Removal is
// safe because the origin pointer makes INSTALL/ re-fetchable.

import { existsSync } from "node:fs";
import { rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { err } from "../cli.mjs";
import {
  INDEX_PATH, INSTALL_DIR, ONBOARDING_COMMAND_PATHS, ONBOARDING_FILE_PATHS, REPO_ROOT,
} from "../paths.mjs";
import { loadState } from "../state.mjs";

// The onboarding skills graduation deregisters (body file + dispatch entry).
const ONBOARDING_SKILLS = [{ flag: "setup", body: "AIDOCS/SKILL/SKILL_SETUP.md" }];

export async function cmdGraduate(index, args) {
  const force = args.includes("--force");

  const state = await loadState();
  if (state.reconcile_pending === true && !force) {
    err("graduate: refusing while reconcile_pending is set. Distill first (the /321 -Update reconcile pass clears the gate), then graduate. --force overrides for manual recovery.");
    process.exit(18);
  }

  const removed = { skills: [], engineFiles: 0, install: false };

  // Deregister the onboarding skills: delete the body, drop dispatch + installed.
  for (const s of ONBOARDING_SKILLS) {
    const bodyPath = join(REPO_ROOT, s.body);
    if (existsSync(bodyPath)) { await unlink(bodyPath); }
    if (index.skills?.dispatch?.[s.flag]) { delete index.skills.dispatch[s.flag]; removed.skills.push(s.flag); }
    if (Array.isArray(index.skills?.installed)) {
      index.skills.installed = index.skills.installed.filter((k) => k !== s.flag);
    }
  }

  // Carve the engine back to steady: delete the onboarding-tier modules a
  // migration laid in-project (--with-onboarding). Idempotent - a fresh install
  // never had them.
  for (const p of [...Object.values(ONBOARDING_COMMAND_PATHS), ...ONBOARDING_FILE_PATHS]) {
    if (existsSync(p)) { await rm(p, { force: true }); removed.engineFiles++; }
  }

  // Mark graduated so a later -Sync init refresh skips the onboarding skills.
  index.graduated = true;
  if (!index.origin || !index.origin.repo) {
    console.log("graduate: WARNING - origin pointer missing or empty. Re-fetch will need an explicit --repo.");
  }
  await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  // Remove the ephemeral onboarding root. Re-fetchable from origin.
  if (existsSync(INSTALL_DIR)) { await rm(INSTALL_DIR, { recursive: true, force: true }); removed.install = true; }

  console.log("graduate: project carved to steady state.");
  console.log(`  deregistered: ${removed.skills.length ? removed.skills.map((f) => `-${f}`).join(", ") : "none (already steady)"}`);
  console.log(`  engine carved: ${removed.engineFiles} onboarding module(s) removed`);
  console.log(`  INSTALL/: ${removed.install ? "removed" : "absent (already clean)"}`);
  console.log("  marked graduated. Run sync + doctor to confirm.");
}
