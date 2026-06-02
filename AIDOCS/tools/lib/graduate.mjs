// graduate.mjs - tear down the onboarding surface once a project is steady:
// deregister -Setup (drop its body + dispatch entry), remove INSTALL/, and mark
// the project graduated so a later -UpdateSync does not re-add -Setup. The
// onboarding lib modules init laid stay in place, inert without INSTALL/ and the
// -Setup skill. Gated on reconcile not pending - no graduation before distillation.

import { existsSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fromRoot, indexPath, repoRoot } from "./paths.mjs";
import { reconcileRouterQuickRef } from "./routerQuickRef.mjs";
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

  // Drop the now-orphan -Setup quick-ref line from the router prose. The router body is
  // never overwritten by graduate, only by the engine-class copy at upgrade, so without
  // this the post-graduate state advertises a flag that no longer resolves until the next
  // upgrade lands. The reconciler walks AIDOCS/SKILL/ on disk, so the just-deleted body
  // is correctly absent from the live flag set.
  const routerReport = reconcileRouterQuickRef(repoRoot(), false);

  const install = join(repoRoot(), "INSTALL");
  const removedInstall = existsSync(install);
  if (removedInstall) rmSync(install, { recursive: true, force: true });

  console.log(`graduate: -Setup ${removedSetup ? "deregistered" : "absent"}, INSTALL/ ${removedInstall ? "removed" : "absent"}, marked graduated.`);
  if (routerReport && routerReport.dropped.length > 0) {
    console.log(`  router: pruned ${routerReport.dropped.length} stale quick-ref line(s) (${routerReport.dropped.join(", ")})`);
  }
  console.log("  run sync + doctor to confirm the steady surface.");
}
