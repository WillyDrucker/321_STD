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
// are not transactional across ops). Re-run resumes where the failure landed
// because every op is idempotent.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { engineDriftNote } from "./gitDrift.mjs";
import { installLog } from "./installLog.mjs";
import { ENGINE_CLASS, indexPath, installEngineDir, isProjectOwned, repoRoot } from "./paths.mjs";
import { syncAutoMemory } from "./syncAutoMemory.mjs";
import { reconcileRouterQuickRef } from "./routerQuickRef.mjs";
import { migrateLegacyWatermarkKeys, reconcilePending } from "./state.mjs";
import { flagFromFilename } from "./sync.mjs";
import { HANDLERS } from "./upgradeOperations.mjs";

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
    // Detect the common --root foot-gun: running the fetched engine from its own
    // location (`node INSTALL/engine/AIDOCS/tools/engine.mjs upgrade`) makes repoRoot()
    // resolve to the clone, so source becomes INSTALL/engine/INSTALL/engine - which is
    // never going to exist. Surface the missing-flag explicitly rather than leaving the
    // user to trace it back through paths.mjs.
    const rootBasenameLooksLikeEngine = /[\\/]INSTALL[\\/]engine[\\/]?$/.test(root);
    const hint = rootBasenameLooksLikeEngine
      ? ` It looks like you ran the fetched engine without --root. Try: \`node "${root}/AIDOCS/tools/engine.mjs" upgrade --root <project-root>\` (or just \`node AIDOCS/tools/engine.mjs upgrade\` from the project root, which uses the project's own engine to drive the upstream upgrade).`
      : "";
    console.error(`upgrade: no fetched engine at ${source}. Run \`fetch-engine\` first.${hint}`);
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

  // Snapshot the prior engine-class state BEFORE any handler runs - a skill_delete,
  // skill_rename, file_delete, or section_text_diff op mutates the project's engine-class
  // surface, so a post-handler snapshot would already be missing what the rollback wants
  // back. AIDOCS/ is gitignored under public privacy, so a bad upgrade has no git-revert
  // path on those projects (re-fetching only gives the newer version), which makes the
  // pre-mutation snapshot the only rollback target. Single-slot, overwritten each
  // upgrade. Dry-run skips it - no disk mutation, no rollback need.
  if (!dryRun) snapshotPriorEngine(root);

  // Apply ops. A handler that throws is collected but does not break the loop, so the
  // operator sees every failure at once. We abort before the copy step on any failure.
  // A handler that returns deferred=true (the customizations[] guard on destructive ops)
  // is NOT journaled - it stays in missing[] so the user can drop the customization and
  // re-run to actually apply it. Without this, the skip would record as applied and the
  // re-run would never retry.
  const opNotes = [];
  const counts = { applied: 0, noop: 0, deferred: 0, opSkipped: 0, failed: 0 };
  for (const op of missing) {
    const handler = HANDLERS[op.type];
    if (!handler) {
      opNotes.push(`SKIP ${op.name} (unknown type "${op.type}", engine refresh needed)`);
      counts.opSkipped++;
      continue;
    }
    try {
      const result = handler(op, index, source, root, dryRun);
      const label = result.applied ? "APPLY" : result.deferred ? "DEFER" : "NO-OP";
      opNotes.push(`${label} ${op.name}: ${result.note}`);
      if (result.applied) counts.applied++;
      else if (result.deferred) counts.deferred++;
      else counts.noop++;
      if (!dryRun && !result.deferred) index.engine.operations_applied.push(op.name);
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

  // Auto-memory has two homes and the copy step only reaches one. It refreshed the seed
  // (inside the project root). The runtime the model actually loads at session start lives
  // outside the root, so without this the corrected rules would land in the repo and change
  // nothing the AI reads. Also reconciles the rule index rather than overwriting it, which
  // would delete the project's pointers to its own rules.
  const autoMemoryReport = syncAutoMemory(source, index, dryRun);

  // Router quick-ref: the engine-class copy lands the upstream router verbatim, which
  // may advertise -Setup or another flag this project no longer registers (graduated).
  // Drop orphan lines so the user does not see a stale flag in the quick-ref. Pass the
  // root only - the reconciler derives the live flag set from AIDOCS/SKILL/ on disk, so
  // a brand-new upstream flag the project's stale dispatch does not know yet still survives.
  const routerReport = reconcileRouterQuickRef(root, dryRun);

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

  // Migrate legacy state.json watermark keys (sessionupdate -> updatesession, etc). The
  // registry rename ops moved files / buckets / sizes, but the runtime watermark keys live
  // in state.json, outside the manifest's reach. Fold them here so a synced project sheds
  // the dead keys. Dry-run leaves state.json untouched.
  const watermarkRenames = dryRun ? [] : migrateLegacyWatermarkKeys();

  const tag = dryRun ? " (dry-run)" : "";
  console.log(`upgrade${tag}: ${counts.applied} applied, ${counts.noop} no-op, ${counts.deferred} deferred, ${counts.opSkipped} unsupported, ${counts.failed} failed`);
  console.log(`copy${tag}: ${copyReport.changed} changed, ${copyReport.identical} identical, ${copyReport.skipped} skipped`);
  for (const n of opNotes) console.log(`  ${n}`);
  for (const s of copyReport.skipList) console.log(`  SKIP ${s}`);
  if (autoMemoryReport) console.log(`  ${autoMemoryReport}${tag}`);
  if (versionNote) console.log(`  ${versionNote}`);
  if (routerReport && routerReport.dropped.length > 0) {
    console.log(`  router${tag}: pruned ${routerReport.dropped.length} stale quick-ref line(s) (${routerReport.dropped.join(", ")})`);
  }
  if (watermarkRenames.length > 0) console.log(`  state${tag}: migrated legacy watermark key(s) (${watermarkRenames.join(", ")})`);

  // User-facing command flag changes from skill_rename ops this upgrade applied.
  // Without this, the user discovers their muscle-memory commands stopped working
  // only when they try to use them - the upgrade output reports internal op names
  // like "rename_skill_body_session_update" with no mapping to the actual flag.
  const renamedThisRun = missing.filter((op) => op.type === "skill_rename" && index.engine.operations_applied.includes(op.name));
  if (renamedThisRun.length > 0) {
    console.log("");
    console.log("Command flag changes from this upgrade:");
    for (const op of renamedThisRun) {
      const fromFlag = flagFromFilename(op.from).flag;
      const toFlag = op.flag_to || flagFromFilename(op.to).flag;
      console.log(`  ${fromFlag} -> ${toFlag}`);
    }
  }

  // Install log is the persistent audit trail under INSTALL/. Skip it on a graduated
  // project because the cleanup below removes INSTALL/ wholesale (the log would be a
  // ghost trail with no surviving home). Dry-run leaves no trail either. A failed run
  // was already aborted above by the fail-fast process.exit(20), so reaching here is
  // success. Cleanup is best-effort: if rmSync trips on a locked file (Windows AV,
  // editor handle), warn and keep the success exit so the upgrade itself is honored.
  if (!dryRun) {
    const graduated = index.graduated === true;
    if (!graduated) {
      installLog(root, `upgrade: ${counts.applied} applied, ${counts.noop} no-op, ${counts.opSkipped} unsupported, ${copyReport.changed} changed, ${copyReport.identical} identical, ${copyReport.skipped} skipped${versionNote ? `, ${versionNote}` : ""}`);
    }
    try {
      cleanupInstallAfterUpgrade(root, graduated);
    } catch (e) {
      console.warn(`upgrade: cleanup of INSTALL/ failed (${e.message}). The upgrade itself succeeded - remove INSTALL/engine by hand.`);
    }
  }

  // A real upgrade just bumped engine.version in the working tree while HEAD still
  // carries the old one, so this fires the commit reminder exactly when it is owed.
  // Silent on a non-git project or one that gitignores AIDOCS (nothing to commit there).
  const driftNote = engineDriftNote(index);
  if (driftNote) console.log(`  ${driftNote}`);
}

// Snapshot the engine-class paths to TEMP/engine-backup-pre-upgrade/ before any handler
// or copy mutates them, so a bad upgrade has a rollback target even under public privacy
// where AIDOCS/ is gitignored. Single-slot - keeping a history would hide the most-recent
// rollback target behind older ones, and tracking N backups adds surface for marginal
// value. Best-effort: a snapshot failure logs a warning but does not gate the upgrade
// (the operator can re-fetch as a fallback).
function snapshotPriorEngine(root) {
  const dst = join(root, "TEMP", "engine-backup-pre-upgrade");
  try {
    if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
    mkdirSync(dst, { recursive: true });
    for (const rel of ENGINE_CLASS) {
      const src = join(root, rel);
      if (!existsSync(src)) continue;
      const dstPath = join(dst, rel);
      mkdirSync(dirname(dstPath), { recursive: true });
      cpSync(src, dstPath, { recursive: true });
    }
  } catch (e) {
    console.warn(`upgrade: pre-upgrade engine snapshot failed (${e.message}). Continuing - re-fetch from upstream is the recovery if the upgrade misbehaves.`);
  }
}

function cleanupInstallAfterUpgrade(root, graduated) {
  const installDir = join(root, "INSTALL");
  if (!existsSync(installDir)) return;
  if (graduated) {
    // Post-graduation: fetch-engine recreated INSTALL/ purely for the upgrade. The
    // whole tree (engine, anything else inside) is a relic. installLog above was
    // skipped on graduated so no audit trail dies here.
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
  const counters = { changed: 0, identical: 0, skipped: 0, skipList: [] };

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
  // customizations[] is the user's opt-out. isProjectOwned is the engine's own: a file
  // that lives in an engine-class dir but belongs to the project (the rule index, the
  // user profile). Both are skipped, and neither is a finding.
  if (skip.has(relPath) || isProjectOwned(relPath)) {
    const reason = skip.has(relPath) ? "customizations[]" : "project-owned";
    counters.skipList.push(`${relPath} (${reason})`);
    counters.skipped++;
    return;
  }
  // Content-compare before writing. A byte-identical file is a no-op, so skip the
  // write (no mtime churn, no phantom git-dirty entry) and count it apart from a real
  // change. This keeps the copy report honest - a same-version -FULL sweep reads as
  // "0 changed, N identical" instead of "N copied" - and surfaces a silent overwrite
  // of an unlisted hand edit as a "changed" file. An unreadable dest falls through to
  // a copy counted as changed.
  if (sameContent(srcFile, dstFile)) {
    counters.identical++;
    return;
  }
  if (!dryRun) {
    const dir = dirname(dstFile);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cpSync(srcFile, dstFile);
  }
  counters.changed++;
}

// Byte-equal compare of two files. A missing or unreadable dest (or src) returns
// false, so the caller treats it as a change and copies. Engine-class files are small
// text, so reading both fully is cheap.
function sameContent(a, b) {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}
