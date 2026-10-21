// upgradeCopy.mjs - the engine-class copy step of an upgrade, and the snapshot taken
// before anything mutates. The copy walks the SOURCE tree, so a project-custom file with
// no upstream counterpart is never touched, a path in customizations[] or a project-owned
// file is skipped and reported, and a byte-identical file is counted apart from a real
// change, so a same-version sweep reads "0 changed, N identical" and never churns mtimes.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { ENGINE_CLASS, isProjectOwned } from "./paths.mjs";

// Snapshot the engine-class paths to TEMP/engine-backup-pre-upgrade/ before any handler
// or copy mutates them, so a bad upgrade has a rollback target even under public privacy
// where AIDOCS/ is gitignored. Single-slot - keeping a history would hide the most-recent
// rollback target behind older ones, and tracking N backups adds surface for marginal
// value. Best-effort: a snapshot failure logs a warning but does not gate the upgrade
// (the operator can re-fetch as a fallback).
export function snapshotPriorEngine(root) {
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

// Walks each engine-class path, replaces files whose project-relative path is NOT in
// customizations[]. A project-custom skill body (no source counterpart) is left alone
// by virtue of not appearing in the source tree. A graduated project drops
// SKILL_SETUP.md if a source copy lands. dryRun counts what would copy without writing.
export function copyEngineClass(source, root, customizations, graduated, dryRun) {
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
