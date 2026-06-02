// graduate.mjs - tear down the onboarding surface once a project is steady:
// deregister -Setup (drop its body + dispatch entry), remove INSTALL/, and mark
// the project graduated so a later -SYNC does not re-add -Setup. The
// onboarding lib modules init laid stay in place, inert without INSTALL/ and the
// -Setup skill. Gated on reconcile not pending - no graduation before distillation.

import { existsSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fromRoot, indexPath, repoRoot } from "./paths.mjs";
import { reconcilePending } from "./state.mjs";

export function cmdGraduate(index, args) {
  if (reconcilePending() && !args.includes("--force")) {
    console.error("graduate: refusing while reconcile_pending is set. Run /321 -Update to distill first, or --force for manual recovery.");
    process.exit(18);
  }
  const setupBody = fromRoot("./AIDOCS/SKILL/SKILL_SETUP.md");
  const removedSetup = existsSync(setupBody);
  if (removedSetup) unlinkSync(setupBody);
  if (index.skills?.dispatch?.setup) delete index.skills.dispatch.setup;
  index.graduated = true;
  writeFileSync(indexPath(), `${JSON.stringify(index, null, 2)}\n`, "utf8");

  const install = join(repoRoot(), "INSTALL");
  const removedInstall = existsSync(install);
  if (removedInstall) rmSync(install, { recursive: true, force: true });

  console.log(`graduate: -Setup ${removedSetup ? "deregistered" : "absent"}, INSTALL/ ${removedInstall ? "removed" : "absent"}, marked graduated.`);
  console.log("  run sync + doctor to confirm the steady surface.");
}
