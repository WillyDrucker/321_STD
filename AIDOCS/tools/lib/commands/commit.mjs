// commit.mjs - two-phase staging commit. Owns validate, simulate, preview,
// persist, state watermark, and staging cleanup. AI drafts intent, script
// protects file integrity.
//
// Phase 1 (simulate): read all source files, apply every op to in-memory
// copies, collect every error. Cross-reference check after simulation catches
// orphan EXTENDED links. Any error aborts with the full list. No files written.
//
// Phase 2 (persist): write files, update state.json, clear staging, run
// post-commit lint (informational only). Lockfile guards against concurrent
// commits. Staging is cleared last (after the writes and the state watermark)
// so a mid-flight failure leaves the staging file intact for retry.

import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import process from "node:process";

import { err, parseFlags, requireOpt } from "../cli.mjs";
import { printUnifiedDiff } from "../diff.mjs";
import { lintFile } from "../lint.mjs";
import { findSectionBounds } from "../markdown.mjs";
import { applyAction, applyBacklogAction, updateSectionText } from "../mutators.mjs";
import {
  applyExtendedAction, findOrphanLinks, gapFillSectionExtended,
} from "../mutatorsExtended.mjs";
import { LOCK_PATH, STAGING_DIR, VALID_SKILLS } from "../paths.mjs";
import { runPairedPrune, runStandalonePrune } from "../pruneRunners.mjs";
import {
  loadStaging, loadState, nowIsoUtc, resolveIndexFile,
  saveState, stagingPath,
} from "../state.mjs";
import { validateStaging } from "../validator.mjs";

export async function cmdCommit(index, args) {
  const opts = parseFlags(args, ["skill", "preview", "no-prune"]);
  requireOpt(opts, "skill");
  const preview = opts.preview === true;
  if (!VALID_SKILLS.includes(opts.skill)) {
    err(`Unknown skill "${opts.skill}". Must be one of: ${VALID_SKILLS.join(", ")}`);
    process.exit(11);
  }

  const staging = await loadStaging(opts.skill);
  if (!staging) {
    err(`No staging file at ${stagingPath(opts.skill)}. Write a draft first.`);
    process.exit(12);
  }

  const validationErrors = validateStaging(staging, opts.skill);
  if (validationErrors.length > 0) {
    err(`Staging file has ${validationErrors.length} error(s):`);
    for (const e of validationErrors) err(`  - ${e}`);
    process.exit(13);
  }

  // session-update touches SESSION + SESSION_EXTENDED.
  // memory-update touches MEMORY + MEMORY_EXTENDED + BACKLOG. CHANGELOG is owned by AutoPush.
  const fileKeys = opts.skill === "memory-update"
    ? { main: "memory", extended: "memory_extended", backlog: "backlog" }
    : { main: "session", extended: "session_extended", backlog: null };

  const mainPath = resolveIndexFile(index, fileKeys.main);
  const extendedPath = resolveIndexFile(index, fileKeys.extended);
  const extendedFilename = basename(extendedPath);
  const backlogPath = fileKeys.backlog ? resolveIndexFile(index, fileKeys.backlog) : null;

  // Pre-flight: every source file must exist before we touch staging or simulate.
  // Collect every miss so the user sees the full list, not just the first.
  const missing = [];
  if (!existsSync(mainPath)) missing.push({ key: fileKeys.main, path: mainPath });
  if (!existsSync(extendedPath)) missing.push({ key: fileKeys.extended, path: extendedPath });
  if (backlogPath && !existsSync(backlogPath)) missing.push({ key: fileKeys.backlog, path: backlogPath });
  if (missing.length > 0) {
    err(`commit: ${missing.length} source file(s) missing; no files written.`);
    for (const m of missing) err(`  - ${m.key}: ${m.path}`);
    err("Either the project has not been scaffolded (`node AIDOCS/tools/memory.mjs init <target-dir>`) or the path in _index.json -> files.<key> is wrong.");
    process.exit(16);
  }

  const original = {
    main: await readFile(mainPath, "utf8"),
    extended: await readFile(extendedPath, "utf8"),
    backlog: backlogPath ? await readFile(backlogPath, "utf8") : null,
  };

  // PASS 1: simulate every op in memory; collect all errors before deciding to write.
  const sim = { main: original.main, extended: original.extended, backlog: original.backlog };
  const counts = { actions: 0, extended: 0, backlog: 0 };
  const opErrors = [];

  for (let i = 0; i < (staging.actions || []).length; i++) {
    const a = staging.actions[i];
    try {
      sim.main = applyAction(sim.main, a);
      // gap_fill_section optionally mirrors into MEMORY_EXTENDED. Apply the
      // extended-side fill here so simulation captures both sides before any write.
      if (a.op === "gap_fill_section" && (a.extended_body_md || a.extended_decisions_md)) {
        sim.extended = gapFillSectionExtended(sim.extended, a.target_section, a.extended_body_md, a.extended_decisions_md);
      }
      // update_section_text optionally mirrors the swap into MEMORY_EXTENDED via
      // extended_find / extended_replace. Same target section, different prose.
      if (a.op === "update_section_text" && a.extended_find !== undefined) {
        sim.extended = updateSectionText(sim.extended, a.target_section, a.extended_find, a.extended_replace);
      }
      counts.actions++;
    } catch (e) {
      opErrors.push(`actions[${i}] (op=${a.op}): ${e.message}`);
    }
  }
  for (let i = 0; i < (staging.extended_actions || []).length; i++) {
    try {
      sim.extended = applyExtendedAction(sim.extended, staging.extended_actions[i]);
      counts.extended++;
    } catch (e) {
      opErrors.push(`extended_actions[${i}] (op=${staging.extended_actions[i].op}): ${e.message}`);
    }
  }
  if (sim.backlog !== null) {
    for (let i = 0; i < (staging.backlog_actions || []).length; i++) {
      try {
        sim.backlog = applyBacklogAction(sim.backlog, staging.backlog_actions[i]);
        counts.backlog++;
      } catch (e) {
        opErrors.push(`backlog_actions[${i}] (op=${staging.backlog_actions[i].op}): ${e.message}`);
      }
    }
  }

  // Orphan-link check: every link from the main file into the EXTENDED file
  // must resolve to a `### sub-section` heading under `## LIFO` in the
  // simulated extended content. Scoped by EXTENDED filename so unrelated
  // cross-file links don't false-positive.
  for (const issue of findOrphanLinks(sim.main, sim.extended, extendedFilename)) opErrors.push(issue);

  if (opErrors.length > 0) {
    err(`commit: ${opErrors.length} simulation error(s); no files written.`);
    for (const e of opErrors) err(`  - ${e}`);
    process.exit(20);
  }

  // PREVIEW mode: print diffs and exit without writing.
  if (preview) {
    console.log(`=== preview --skill ${opts.skill} (no files written) ===\n`);
    if (sim.main !== original.main) printUnifiedDiff(basename(mainPath), original.main, sim.main);
    if (sim.extended !== original.extended) printUnifiedDiff(basename(extendedPath), original.extended, sim.extended);
    if (sim.backlog !== null && sim.backlog !== original.backlog) {
      printUnifiedDiff(basename(backlogPath), original.backlog, sim.backlog);
    }
    console.log(`preview summary: ${counts.actions} actions, ${counts.extended} extended_actions, ${counts.backlog} backlog_actions would apply.`);
    return;
  }

  // PASS 2: writes. Lockfile guards against concurrent commits. Atomic create
  // (flag wx) fails if the lock already exists, closing the check-then-write
  // race two concurrent commits could otherwise slip through.
  await mkdir(STAGING_DIR, { recursive: true });
  try {
    await writeFile(LOCK_PATH, String(process.pid), { flag: "wx" });
  } catch (e) {
    if (e.code === "EEXIST") {
      err("Another commit is in progress (lockfile present). If stale, delete AIDOCS/tools/staging/.lock and retry.");
      process.exit(14);
    }
    throw e;
  }

  try {
    if (sim.main !== original.main) await writeFile(mainPath, sim.main, "utf8");
    if (sim.extended !== original.extended) await writeFile(extendedPath, sim.extended, "utf8");
    if (sim.backlog !== null && sim.backlog !== original.backlog) {
      await writeFile(backlogPath, sim.backlog, "utf8");
    }

    const state = await loadState();
    const skillKey = opts.skill.replace("-", "_");
    const skillState = state[skillKey] || { run_count: 0, last_committed_at: null };
    skillState.run_count = (skillState.run_count || 0) + 1;
    skillState.last_committed_at = nowIsoUtc();
    state[skillKey] = skillState;
    await saveState(state);

    // Clear staging last, after the writes and the state watermark, so a failure
    // anywhere above leaves the staging file intact for retry.
    await unlink(stagingPath(opts.skill));

    console.log(`commit: ${opts.skill} applied successfully.`);
    console.log(`  mode:              ${staging.mode}`);
    console.log(`  actions:           ${counts.actions}`);
    console.log(`  extended_actions:  ${counts.extended}`);
    console.log(`  backlog_actions:   ${counts.backlog}`);
    console.log(`  state:             run_count ${skillState.run_count}, last_committed_at ${skillState.last_committed_at}`);
    console.log(`  staging cleared.`);

    // Big 6 update surface. Surface each update_section_text action with its
    // rationale so the user has a clear review trail at commit time.
    const big6Updates = (staging.actions || []).filter(a => a.op === "update_section_text");
    if (big6Updates.length > 0) {
      console.log(`  big 6 updates:`);
      for (const u of big6Updates) {
        const findSnippet = u.find.length > 50 ? `${u.find.slice(0, 47)}...` : u.find;
        const replaceSnippet = u.replace.length > 50 ? `${u.replace.slice(0, 47)}...` : u.replace;
        console.log(`    ${u.target_section}: "${findSnippet}" -> "${replaceSnippet}"`);
        console.log(`      rationale: ${u.rationale}`);
        if (u.extended_find !== undefined) {
          console.log(`      extended mirror: also applied`);
        }
      }
    }

    // Auto-prune. Fires when a file exceeds its configured cap. The protection counts
    // come from this commit's staging - top-N freshest bullets/sub-sections
    // are skipped so new content doesn't immediately archive. Failures here
    // print as warnings, never roll back the commit. Runs before lint so the
    // post-commit lint sees the post-prune file state.
    const protectedCounts = countProtectedFromStaging(staging, original);
    try {
      if (opts["no-prune"] === true) {
        console.log("  auto-prune:        suppressed (--no-prune, deferred to the reconciliation pass).");
      } else if (opts.skill === "session-update" && readyForAutoPrune(index, fileKeys.main, fileKeys.extended)) {
        console.log("  auto-prune:");
        await runPairedPrune(index, fileKeys.main, {
          protectedTopMain: protectedCounts.main,
          protectedTopExt: protectedCounts.ext,
          logPrefix: "    ",
        });
      } else if (opts.skill === "memory-update") {
        if (readyForAutoPrune(index, fileKeys.main, fileKeys.extended)) {
          console.log("  auto-prune (memory):");
          await runPairedPrune(index, fileKeys.main, {
            protectedTopMain: protectedCounts.main,
            protectedTopExt: protectedCounts.ext,
            logPrefix: "    ",
          });
        }
        if (fileKeys.backlog && readyForAutoPrune(index, fileKeys.backlog)) {
          console.log("  auto-prune (backlog):");
          await runStandalonePrune(index, fileKeys.backlog, {
            protectedTopMain: protectedCounts.backlog,
            logPrefix: "    ",
          });
        }
      }
    } catch (e) {
      console.log(`  auto-prune skipped (commit already applied): ${e.message}`);
    }

    // Post-commit lint: informational, does not fail the commit. Runs after
    // auto-prune so a clean post-prune file shows as clean.
    const touchedKeys = [fileKeys.main, fileKeys.extended];
    if (fileKeys.backlog) touchedKeys.push(fileKeys.backlog);
    const postLintIssues = [];
    for (const key of touchedKeys) {
      const abs = resolveIndexFile(index, key);
      const content = await readFile(abs, "utf8");
      for (const issue of lintFile(key, content, index)) postLintIssues.push(`${key}: ${issue}`);
    }
    if (postLintIssues.length === 0) {
      console.log("  post-commit lint:  clean.");
    } else {
      console.log(`  post-commit lint:  ${postLintIssues.length} issue(s) (informational, commit already applied):`);
      for (const issue of postLintIssues) console.log(`    - ${issue}`);
    }
  } finally {
    if (existsSync(LOCK_PATH)) await unlink(LOCK_PATH);
  }
}

// Counts of bullets/sub-sections this commit landed at the TOP of the
// relevant LIFO sections. Auto-prune uses these to skip the freshest content
// when walking bottom-up.
function countProtectedFromStaging(staging, original) {
  const counts = { main: 0, ext: 0, backlog: 0 };

  for (const action of (staging.actions || [])) {
    if (action.section === "lifo") {
      if (action.op === "lifo_insert") counts.main++;
      if (action.op === "replace") counts.main++;
    }
    if (action.op === "overwrite_section" && action.section === "current_state") {
      const lines = (original.main || "").split("\n");
      const bounds = findSectionBounds(lines, "current_state");
      if (bounds) {
        for (let i = bounds.startIdx + 1; i < bounds.endIdx; i++) {
          if (lines[i].startsWith("- ")) counts.main++;
        }
      }
    }
  }

  for (const ea of (staging.extended_actions || [])) {
    if (ea.op === "add" || ea.op === "replace") counts.ext++;
  }

  for (const ba of (staging.backlog_actions || [])) {
    if (ba.op === "lifo_insert" || ba.op === "replace") counts.backlog++;
  }

  return counts;
}

function readyForAutoPrune(index, ...keys) {
  for (const key of keys) {
    const sizes = index.sizes?.[key];
    if (!sizes || typeof sizes.cap !== "number" || typeof sizes.prune_to !== "number") return false;
  }
  return true;
}
