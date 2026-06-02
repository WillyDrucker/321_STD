// upgrade.mjs - drive the project up to the engine's manifest plus refresh the
// engine-class paths in one pass. Reads INSTALL/engine/AIDOCS/MANIFEST.json, diffs
// the operations against engine.operations_applied[], applies each missing op
// through the HANDLERS dispatcher (idempotent), copies the engine-class paths into
// the project skipping any path in customizations[], bumps engine.version from the
// source, and writes the registry. -UpdateSync drives fetch + this + sync + doctor
// in sequence (the run order lives in AIDOCS/SKILL/SKILL_UPDATE-SYNC.md).
//
// --dry-run gates every disk-mutating call (handler writes, the copy step, the
// version bump's index write, the install log). Any handler that throws aborts
// the run before the copy step, the version bump, and the index write - the
// index write is the commit point for the upgrade's bookkeeping. Earlier
// successful ops in the same run may have already touched files (handler writes
// are not transactional across ops); re-run resumes where the failure landed
// because every op is idempotent.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { installLog } from "./installLog.mjs";
import { indexPath, installEngineDir, repoRoot } from "./paths.mjs";
import { reconcilePending } from "./state.mjs";
import { HANDLERS } from "./upgradeOperations.mjs";

// Paths the copy step refreshes, project-relative. Engine code, canonical skill
// bodies, router. A project-custom skill body (no source counterpart) survives by
// virtue of not appearing in the source tree. A path listed in customizations[] is
// skipped entirely (user opt-out).
const ENGINE_CLASS = [
  "AIDOCS/tools",
  "AIDOCS/SKILL",
  ".claude/skills/321/SKILL.md",
];

export function cmdUpgrade(index, args) {
  const root = repoRoot();
  const source = installEngineDir();
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  // Block upgrade during the reconcile window: a section_text_diff op or the engine-class
  // copy step can overwrite an in-flight hand edit unless customizations[] was prefilled,
  // and a graduating project may not have set those yet. Refuse, point at the right tool,
  // and let --force punch through for manual recovery (mirrors graduate's pattern).
  if (reconcilePending() && !force) {
    console.error("upgrade: refusing while reconcile_pending is set. Run /321 -Update to distill first, or --force for manual recovery.");
    process.exit(20);
  }

  if (!existsSync(source)) {
    console.error(`upgrade: no fetched engine at ${source}. Run \`fetch-engine\` first.`);
    process.exit(20);
  }

  const sourceIndexPath = join(source, "AIDOCS", "_index.json");
  if (!existsSync(sourceIndexPath)) {
    console.error(`upgrade: fetched engine has no _index.json at ${sourceIndexPath}`);
    process.exit(20);
  }
  const sourceIndex = readJSON(sourceIndexPath);

  const sourceManifestPath = join(source, "AIDOCS", "MANIFEST.json");
  const sourceManifest = existsSync(sourceManifestPath)
    ? readJSON(sourceManifestPath)
    : { operations: [] };

  // Project bookkeeping. Missing arrays are first-time-after-upgrade-landed, treat as empty.
  index.engine = index.engine || {};
  index.engine.operations_applied = index.engine.operations_applied || [];
  index.customizations = index.customizations || [];

  const applied = new Set(index.engine.operations_applied);
  const missing = (sourceManifest.operations || []).filter((op) => !applied.has(op.name));

  // Apply ops. A handler that throws is collected but does not break the loop, so the
  // operator sees every failure at once. We abort before the copy step on any failure.
  const opNotes = [];
  const counts = { applied: 0, noop: 0, opSkipped: 0, failed: 0 };
  for (const op of missing) {
    const handler = HANDLERS[op.type];
    if (!handler) {
      opNotes.push(`SKIP ${op.name} (unknown type "${op.type}", engine refresh needed)`);
      counts.opSkipped++;
      continue;
    }
    try {
      const result = handler(op, index, source, root, dryRun);
      opNotes.push(`${result.applied ? "APPLY" : "NO-OP"} ${op.name}: ${result.note}`);
      if (result.applied) counts.applied++; else counts.noop++;
      if (!dryRun) index.engine.operations_applied.push(op.name);
    } catch (e) {
      opNotes.push(`FAIL ${op.name}: ${e.message}`);
      counts.failed++;
    }
  }

  // Fail-fast: any thrown handler aborts before the copy + version-bump + index-write,
  // so a partial-state upgrade never reaches disk. Project content the prior ops touched
  // already landed (writes are not transactional across handlers), so the operator should
  // resolve the failures and re-run - the still-pending ops retry on the next pass.
  if (counts.failed > 0) {
    console.error(`upgrade${dryRun ? " (dry-run)" : ""}: ${counts.failed} operation(s) failed - aborting before copy step. Resolve and re-run.`);
    for (const n of opNotes) console.error(`  ${n}`);
    process.exit(20);
  }

  const copyReport = copyEngineClass(source, root, index.customizations, index.graduated, dryRun);

  const oldVersion = index.engine.version || "(unset)";
  const newVersion = sourceIndex.engine?.version;
  let versionNote = null;
  if (newVersion && newVersion !== oldVersion) {
    if (!dryRun) index.engine.version = newVersion;
    versionNote = `engine.version: ${oldVersion} -> ${newVersion}`;
  }

  if (!dryRun) {
    writeFileSync(indexPath(), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  }

  const tag = dryRun ? " (dry-run)" : "";
  console.log(`upgrade${tag}: ${counts.applied} applied, ${counts.noop} no-op, ${counts.opSkipped} unsupported, ${counts.failed} failed`);
  console.log(`copy${tag}: ${copyReport.copied} file(s) copied, ${copyReport.skipped} skipped`);
  for (const n of opNotes) console.log(`  ${n}`);
  for (const s of copyReport.skipList) console.log(`  SKIP ${s} (customizations[])`);
  if (versionNote) console.log(`  ${versionNote}`);

  // Install log is the persistent audit trail - dry-run leaves no trail. Cleanup
  // also lives in this block (dry-run pretends the writes did not happen, so it
  // pretends about cleanup too). A failed run was already aborted above by the
  // fail-fast process.exit(20), so reaching here means success.
  if (!dryRun) {
    installLog(root, `upgrade: ${counts.applied} applied, ${counts.noop} no-op, ${counts.opSkipped} unsupported, ${copyReport.copied} files copied, ${copyReport.skipped} skipped${versionNote ? `, ${versionNote}` : ""}`);
    // The fetched engine served its purpose - the copy step landed its files into
    // the project and the manifest ops applied. Leaving INSTALL/engine around is a
    // relic. On a graduated project, INSTALL/ itself should not persist either - it
    // was only recreated by fetch-engine for the upgrade. Mid-migration INSTALL/ still
    // has the runbooks plus INSTALL.log for the in-progress install/setup flow, so
    // it survives this cleanup and waits for graduate.
    cleanupInstallAfterUpgrade(root, index.graduated === true);
  }
}

function cleanupInstallAfterUpgrade(root, graduated) {
  const installDir = join(root, "INSTALL");
  if (!existsSync(installDir)) return;
  if (graduated) {
    // Post-graduation: fetch-engine recreated INSTALL/ purely for the upgrade. The
    // whole tree (engine, any log we just appended, anything else inside) is a relic.
    rmSync(installDir, { recursive: true, force: true });
    return;
  }
  // Pre-graduation: leave the runbooks plus INSTALL.log, only drop the engine dir.
  const installEngine = join(installDir, "engine");
  if (existsSync(installEngine)) rmSync(installEngine, { recursive: true, force: true });
}

function readJSON(path) { return JSON.parse(readFileSync(path, "utf8")); }

// Walks each engine-class path, replaces files whose project-relative path is NOT in
// customizations[]. A project-custom skill body (no source counterpart) is left alone
// by virtue of not appearing in the source tree. A graduated project drops
// SKILL_SETUP.md if a source copy lands. dryRun counts what would copy without writing.
function copyEngineClass(source, root, customizations, graduated, dryRun) {
  const skip = new Set(customizations || []);
  const counters = { copied: 0, skipped: 0, skipList: [] };

  for (const rel of ENGINE_CLASS) {
    const src = join(source, rel);
    const dst = join(root, rel);
    if (!existsSync(src)) continue;
    if (statSync(src).isDirectory()) {
      copyDirRecursive(src, dst, rel, skip, counters, dryRun);
    } else {
      copyFile(src, dst, rel, skip, counters, dryRun);
    }
  }

  if (graduated && !dryRun) {
    const setupBody = join(root, "AIDOCS", "SKILL", "SKILL_SETUP.md");
    if (existsSync(setupBody)) rmSync(setupBody, { force: true });
  }

  return counters;
}

function copyDirRecursive(srcDir, dstDir, relRoot, skip, counters, dryRun) {
  if (!dryRun && !existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcEntry = join(srcDir, entry);
    const dstEntry = join(dstDir, entry);
    const relEntry = `${relRoot}/${entry}`;
    if (statSync(srcEntry).isDirectory()) {
      copyDirRecursive(srcEntry, dstEntry, relEntry, skip, counters, dryRun);
    } else {
      copyFile(srcEntry, dstEntry, relEntry, skip, counters, dryRun);
    }
  }
}

function copyFile(srcFile, dstFile, relPath, skip, counters, dryRun) {
  if (skip.has(relPath)) {
    counters.skipList.push(relPath);
    counters.skipped++;
    return;
  }
  if (!dryRun) {
    const dir = dirname(dstFile);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cpSync(srcFile, dstFile);
  }
  counters.copied++;
}
