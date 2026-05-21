#!/usr/bin/env node
// memory.mjs - entry point + dispatch + short subcommands.
//
// Heavy logic lives in AIDOCS/tools/lib/: paths/cli/state/markdown/mutators/validator/
// diff/lint and the long commands (sync, commit, prune, archive, doctor). This
// file is intentionally small so the CLI surface is visible in one read.
//
// Subcommands: prune / lint / archive / sync / import-skills / validate / commit / clear / state / doctor / init / migrate-archive / migrate-import / migrate-restore / help.
// Routine writes go through the staging pipeline (validate -> commit) so the
// static-section protection rules apply. The legacy `add` subcommand was
// removed because it bypassed staging.
// Run `node AIDOCS/tools/memory.mjs --help` for usage details.

import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import { err, parseFlags, requireOpt } from "./lib/cli.mjs";
import { cmdArchive } from "./lib/commands/archive.mjs";
import { cmdCommit } from "./lib/commands/commit.mjs";
import { cmdDoctor } from "./lib/commands/doctor.mjs";
import { cmdImportSkills } from "./lib/commands/import-skills.mjs";
import { cmdInit } from "./lib/commands/init.mjs";
import { cmdMigrateArchive } from "./lib/commands/migrate-archive.mjs";
import { cmdMigrateImport } from "./lib/commands/migrate-import.mjs";
import { cmdMigrateRestore } from "./lib/commands/migrate-restore.mjs";
import { cmdPrune } from "./lib/commands/prune.mjs";
import { cmdSync } from "./lib/commands/sync.mjs";
import { lintFile } from "./lib/lint.mjs";
import { REPO_ROOT, VALID_SKILLS } from "./lib/paths.mjs";
import {
  bootstrapState, loadIndex, loadStaging, loadState,
  nowIsoUtc, saveState, scanReconcileResidue, stagingPath,
} from "./lib/state.mjs";
import { validateStaging } from "./lib/validator.mjs";

const COMMANDS = ["prune", "lint", "archive", "sync", "import-skills", "validate", "commit", "clear", "state", "doctor", "init", "migrate-archive", "migrate-import", "migrate-restore", "help"];

async function main() {
  const [, , cmd, ...args] = process.argv;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(cmd ? 0 : 1);
  }

  if (!COMMANDS.includes(cmd)) {
    err(`Unknown command: ${cmd}. Run \`node AIDOCS/tools/memory.mjs help\` for usage.`);
    process.exit(2);
  }

  // init runs before loadIndex - it scaffolds a new project from this repo
  // and has no source index to read from.
  if (cmd === "init") {
    await cmdInit(null, args);
    return;
  }

  // migrate-archive moves project content to SETUP_ARCHIVE before init runs, so it
  // globs the tree and runs pre-index like init.
  if (cmd === "migrate-archive") {
    await cmdMigrateArchive(args);
    return;
  }

  // migrate-import operates on a --from path and writes a staging file. It does
  // not read _index.json, so it runs pre-index like init.
  if (cmd === "migrate-import") {
    await cmdMigrateImport(args);
    return;
  }

  // migrate-restore moves user content back out of SETUP_ARCHIVE after init has
  // reinstalled the engine. It globs the archive dir, not _index.json, so it runs
  // pre-index like its archive sibling.
  if (cmd === "migrate-restore") {
    await cmdMigrateRestore(args);
    return;
  }

  const index = await loadIndex();

  switch (cmd) {
    case "prune":    await cmdPrune(index, args);    break;
    case "lint":     await cmdLint(index);           break;
    case "archive":  await cmdArchive(index, args);  break;
    case "sync":     await cmdSync(index, args);     break;
    case "import-skills": await cmdImportSkills(index, args); break;
    case "validate": await cmdValidate(args);        break;
    case "commit":   await cmdCommit(index, args);   break;
    case "clear":    await cmdClear(args);           break;
    case "state":    await cmdState(args, index);     break;
    case "doctor": {
      const dopts = parseFlags(args, ["structural-only"]);
      await cmdDoctor(index, { structuralOnly: dopts["structural-only"] === true });
      break;
    }
  }
}

// lint - walk every AIDOCS file. Check file-level size, em-dash / semicolon
// scan, anchor-link resolution, per-bullet caps, per-anchor prose caps.
async function cmdLint(index) {
  const issues = [];
  for (const [key, path] of Object.entries(index.files || {})) {
    const abs = resolve(REPO_ROOT, path);
    if (!existsSync(abs)) {
      issues.push(`missing file: ${key} -> ${path}`);
      continue;
    }
    if (key.endsWith("_archive") || key === "env") continue;

    const content = await readFile(abs, "utf8");
    for (const issue of lintFile(key, content, index)) issues.push(`${key}: ${issue}`);
  }

  if (issues.length === 0) {
    console.log("lint: clean.");
    return;
  }
  console.log(`lint: ${issues.length} issue${issues.length === 1 ? "" : "s"} found.`);
  for (const issue of issues) console.log(`  - ${issue}`);
  process.exit(4);
}

// validate --skill <name> - schema-validates the staging file. Read-only.
async function cmdValidate(args) {
  const opts = parseFlags(args, ["skill"]);
  requireOpt(opts, "skill");
  if (!VALID_SKILLS.includes(opts.skill)) {
    err(`Unknown skill "${opts.skill}". Must be one of: ${VALID_SKILLS.join(", ")}`);
    process.exit(11);
  }
  const staging = await loadStaging(opts.skill);
  if (!staging) {
    err(`No staging file at ${stagingPath(opts.skill)}. Nothing to validate.`);
    process.exit(12);
  }
  const errors = validateStaging(staging, opts.skill);
  if (errors.length === 0) {
    console.log(`validate: ${opts.skill} staging file is well-formed.`);
    console.log(`  actions:           ${(staging.actions || []).length}`);
    console.log(`  extended_actions:  ${(staging.extended_actions || []).length}`);
    console.log(`  backlog_actions:   ${(staging.backlog_actions || []).length}`);
    return;
  }
  console.log(`validate: ${opts.skill} staging file has ${errors.length} error(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(13);
}

// clear --skill <name> - delete the staging file without applying. Rollback path.
async function cmdClear(args) {
  const opts = parseFlags(args, ["skill"]);
  requireOpt(opts, "skill");
  if (!VALID_SKILLS.includes(opts.skill)) {
    err(`Unknown skill "${opts.skill}". Must be one of: ${VALID_SKILLS.join(", ")}`);
    process.exit(11);
  }
  const path = stagingPath(opts.skill);
  if (!existsSync(path)) {
    console.log(`clear: no staging file for ${opts.skill}. Nothing to do.`);
    return;
  }
  await unlink(path);
  console.log(`clear: removed ${path}`);
}

// state [--reset] [--skill <name>] [--set-reconcile] [--clear-reconcile]
// Print or reset AIDOCS/tools/state.json, or flip the reconcile_pending gate.
// The reconcile gate is the Setup -> Update handoff: Setup sets it after a
// migration import lands, Update reads it to choose reconciliation vs normal
// chain and clears it once reconciliation commits. Script-managed so the flow
// is deterministic, not narrated by the AI.
async function cmdState(args, index) {
  const opts = parseFlags(args, ["reset", "skill", "set-reconcile", "clear-reconcile", "force"]);
  const state = await loadState();

  if (opts["set-reconcile"] === true && opts["clear-reconcile"] === true) {
    err("Pass only one of --set-reconcile / --clear-reconcile, not both.");
    process.exit(5);
  }

  if (opts["set-reconcile"] === true || opts["clear-reconcile"] === true) {
    const value = opts["set-reconcile"] === true;
    // Residue gate: refuse to clear while MAIN LIFO bullets still carry
    // migrate-import anchors or dates. Clearing marks reconciliation complete, so
    // un-distilled residue would close the gate on a no-op reconcile (the lower-
    // model failure). This makes "did you distill" a mechanical check, not a
    // prose instruction the driver can skip. --force overrides for manual recovery.
    if (opts["clear-reconcile"] === true && opts.force !== true) {
      const residue = await scanReconcileResidue(index);
      if (residue.length > 0) {
        err(`Refusing to clear the reconcile gate: ${residue.length} unresolved migration residue item(s) (LIFO anchors / dates, un-renamed cross-project file refs).`);
        for (const r of residue.slice(0, 8)) err(`  - ${r.key}:${r.line} (${r.kind}) "${r.snippet}"`);
        if (residue.length > 8) err(`  ... and ${residue.length - 8} more.`);
        err(`Resolve them in the /321 -Update reconciliation pass (distill anchors / dates, rename <old>_*.md refs to the current project), then clear. Override with --force only for manual recovery.`);
        process.exit(17);
      }
    }
    state.reconcile_pending = value;
    // Clearing the gate marks the reconciliation pass complete. That pass does
    // its wholesale reshape as direct curated edits, not a staging commit, so
    // stamp both lane watermarks here - otherwise state.json would still read
    // migration time and the next routine update would re-walk the (already
    // distilled) reconciliation window.
    let stamped = false;
    if (opts["clear-reconcile"] === true) {
      const at = nowIsoUtc();
      for (const k of ["session_update", "memory_update"]) {
        state[k] = state[k] || { run_count: 0, last_committed_at: null };
        state[k].last_committed_at = at;
      }
      stamped = true;
    }
    await saveState(state);
    console.log(`state: reconcile_pending = ${value}.${stamped ? " session/memory watermarks stamped." : ""}`);
    return;
  }

  if (opts.reset === true) {
    if (opts.skill !== undefined) {
      if (!VALID_SKILLS.includes(opts.skill)) {
        err(`Unknown skill "${opts.skill}". Must be one of: ${VALID_SKILLS.join(", ")}`);
        process.exit(11);
      }
      state[opts.skill.replace("-", "_")] = { run_count: 0, last_committed_at: null };
      await saveState(state);
      console.log(`state: reset ${opts.skill}.`);
      return;
    }
    await saveState(bootstrapState());
    console.log("state: reset all skills to bootstrap.");
    return;
  }
  console.log(JSON.stringify(state, null, 2));
}

function printHelp() {
  process.stdout.write(`memory.mjs - LIFO helper for MEMORY / SESSION / BACKLOG project files. CHANGELOG is owned by /321 -AutoPush.

Usage:
  node AIDOCS/tools/memory.mjs <command> [flags]

Commands:
  prune     Trim a file to prune_to when over cap. Drops LIFO bullets / sections
            from the bottom. Archives dropped content.
            --file <key> [--dry-run]

  archive   Move a single EXTENDED anchor to the archive folder.
            --file <key> --anchor <slug> [--dry-run]

  lint      Walk every AIDOCS file. Check size, em dashes, anchor resolution,
            per-bullet caps, per-anchor prose caps.

  sync      Rebuild skills.dispatch in _index.json from skill body frontmatter.
            Walks paths.skills_bodies, reads YAML frontmatter.
            [--dry-run]

  import-skills  Copy a project's own skill bodies into AIDOCS/SKILL/ under the
            canonical SKILL_<FUNC>.md name so sync can register them with the
            router, recording each net-new body in customizations[] (provenance).
            Never overwrites a canonical body - a collision is reported (with the
            canonical hash) for /321 -Update to merge as canonical-base + delta.
            Non-destructive. Run sync afterwards to register imports.
            [--from <dir>]  default scans AIDOCS/SKILLS/ (the legacy tree). The
            migration points it at the setup archive, the -Update late-scan at
            specific candidate dirs outside AIDOCS/SKILL/.
            [--dry-run]

  validate  Validate a staging file against AIDOCS/tools/staging/SCHEMA.json.
            --skill <session-update | memory-update>

  commit    Apply a staging file. Two-phase: simulate, then write. Any error
            aborts before writes. Updates state.json, clears staging on success.
            --skill <session-update | memory-update> [--preview] [--no-prune]

  clear     Delete a staging file without applying.
            --skill <session-update | memory-update>

  state     Print or reset AIDOCS/tools/state.json, or flip the reconcile gate.
            [--reset] [--skill <session-update | memory-update>]
            [--set-reconcile | --clear-reconcile] [--force]
            reconcile_pending is the Setup -> Update handoff: Setup sets it,
            Update reads it (reconciliation vs normal chain) and clears it.
            --clear-reconcile also stamps both lane watermarks (the reconciliation
            reshape is direct edits, not a commit, so it brings them current here).
            --clear-reconcile refuses while migration residue remains (MAIN LIFO
            anchors / dates, or un-renamed cross-project file refs). --force
            overrides for manual recovery.

  doctor    Health check across the standards system. Runs lint + path / state /
            skill / reconcile-residue / banned-prose / migration-markers /
            auto-memory / router-quick-ref / manifests.
            Reconcile residue tallies as structural (an incomplete reconcile that
            left import anchors / dates in the LIFO, or un-renamed cross-project
            file refs), so it cannot hide among prose lint.
            [--structural-only]  Skip the content / prose checks (lint, Big-6
            Decisions, migration markers, banned prose) and verify only wiring.
            Install uses this so a migration over an existing project is not
            failed by that project's inherited lint debt.

  init      Scaffold a new project from this template. Copies engine + skills,
            generates project-specific AGENTS / MEMORY / SESSION / _index.json.
            <target-dir> --name <PROJECT> [--release-profile <profile>] [--force] [--dry-run]
            --dry-run prints the write plan + install contract and writes nothing.
            Profiles: standards | npm-package | vscode-extension |
                      cloudflare-worker | cloudflare-pages | static-site | none

  migrate-archive  Step 1 of a Setup migration: move project content to
            AIDOCS/<X>_SETUP_ARCHIVE/ (move, never delete). Known 321-shape paths and
            clearly-stale swept AI-state move automatically. Borderline swept docs
            are reported for the AI to adjudicate (--move / --copy, default leave).
            Pre-index (runs before init).
            <target> --name <X> [--scan] [--move <csv>] [--copy <csv>]

  migrate-import  Lossless structural import of an archived EXTENDED file into a
            staging file. One ### sub-section per bold-lead entry, plus a matching
            anchored MAIN bullet. Migration capture step - distillation deferred
            to the reconciliation pass (the gated /321 -Update).
            --from <archived EXTENDED path> --skill <session-update | memory-update>
            [--old <OLD_NAME> --new <NEW_NAME>] [--dry-run] [--append]
            --append merges into an existing lane staging (anchor-deduped) instead
            of refusing - used to pile swept scavenge docs onto the 321 import. A
            doc with no headings / bold-leads imports as a single entry.

  migrate-restore  Step 7 of a Setup migration: move user-owned content back out of
            AIDOCS/<X>_SETUP_ARCHIVE/ after init reinstalls the engine. WDDOCS verbatim,
            the *_ARCHIVE history dirs, and ENV (renaming <OLD>_ENV_* on a project
            rename). Move, so the archive shrinks as content returns. The judgment /
            network layers stay in the skill. Pre-index.
            <target> --name <X> [--old <OLD_NAME>]

  help      Print this message.

File keys: AIDOCS/_index.json -> files. Section slugs: -> buckets.
Engine surface: AIDOCS/tools/lib/README.md.
`);
}

main().catch(e => {
  err(`fatal: ${e.message}`);
  process.exit(99);
});
