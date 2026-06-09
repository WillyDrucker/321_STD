#!/usr/bin/env node
// engine.mjs - entry point for the 321 engine. Dispatches the reproducer
// commands (init lays the skeleton, doctor validates it) and the staging pipeline
// the skills write through (validate, commit). Kept small so the command surface
// is visible in one read. The logic lives in lib/.

import process from "node:process";

import { cmdBigsix } from "./lib/bigsix.mjs";
import { cmdCommit } from "./lib/commit.mjs";
import { cmdDoctor } from "./lib/doctor.mjs";
import { cmdFetchEngine } from "./lib/fetch-engine.mjs";
import { cmdGraduate } from "./lib/graduate.mjs";
import { cmdInit } from "./lib/init.mjs";
import { cmdMergeStatus } from "./lib/mergeStatus.mjs";
import { cmdMigrateArchive } from "./lib/migrate-archive.mjs";
import { cmdMigrateImport } from "./lib/migrate-import.mjs";
import { cmdMigrateRestore } from "./lib/migrate-restore.mjs";
import { loadIndex, setRoot } from "./lib/paths.mjs";
import { cmdPrivacy } from "./lib/privacy.mjs";
import { cmdScrub } from "./lib/scrub.mjs";
import { cmdState } from "./lib/state.mjs";
import { cmdSync } from "./lib/sync.mjs";
import { cmdUpgrade } from "./lib/upgrade.mjs";
import { cmdValidate } from "./lib/validate.mjs";
import { cmdVerdict } from "./lib/verdict.mjs";
import { cmdWatermark } from "./lib/watermark.mjs";

const COMMANDS = ["doctor", "scrub", "sync", "upgrade", "merge-status", "validate", "commit", "watermark", "state", "privacy", "fetch-engine", "migrate-archive", "migrate-restore", "migrate-import", "verdict", "bigsix", "graduate", "init", "help"];

async function main() {
  const [, , cmd, ...rawArgs] = process.argv;
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(cmd ? 0 : 1);
  }
  if (!COMMANDS.includes(cmd)) {
    console.error(`Unknown command: ${cmd}. Run \`node AIDOCS/tools/engine.mjs help\`.`);
    process.exit(2);
  }
  // Global --root <dir>: the project the operate-on commands act on. Lets a
  // fetched onboarding engine drive a target without being copied into it.
  const rootIdx = rawArgs.indexOf("--root");
  let args = rawArgs;
  if (rootIdx >= 0) {
    setRoot(rawArgs[rootIdx + 1]);
    args = rawArgs.filter((_, i) => i !== rootIdx && i !== rootIdx + 1);
  }
  // init runs pre-registry: it scaffolds a new project and has no index to read.
  if (cmd === "init") { await cmdInit(args); return; }
  // fetch-engine writes into the active root's INSTALL/, no registry needed.
  if (cmd === "fetch-engine") { await cmdFetchEngine(args); return; }
  // state reads state.json, and migrate-archive moves _index.json itself, so both
  // run pre-registry.
  if (cmd === "state") { cmdState(null, args); return; }
  if (cmd === "migrate-archive") { cmdMigrateArchive(args); return; }
  if (cmd === "migrate-restore") { cmdMigrateRestore(args); return; }
  if (cmd === "verdict") { cmdVerdict(args); return; }
  // bigsix reads package.json and the obvious configs, no registry needed.
  if (cmd === "bigsix") { cmdBigsix(args); return; }
  const index = loadIndex();
  switch (cmd) {
    case "doctor":   cmdDoctor(index); break;
    case "scrub":    cmdScrub(index, args); break;
    case "privacy":  cmdPrivacy(index, args); break;
    case "sync":     cmdSync(index, args); break;
    case "upgrade":  cmdUpgrade(index, args); break;
    case "merge-status": cmdMergeStatus(index, args); break;
    case "validate": cmdValidate(index, args); break;
    case "commit":   cmdCommit(index, args); break;
    case "watermark": cmdWatermark(index, args); break;
    case "migrate-import": await cmdMigrateImport(index, args); break;
    case "graduate": cmdGraduate(index, args); break;
  }
}

function printHelp() {
  process.stdout.write(`engine.mjs - the 321 engine.

Usage:
  node AIDOCS/tools/engine.mjs <command> [flags]

Global:
  --root <dir>   operate on the project at <dir> instead of this engine's own
                 (lets a fetched onboarding engine drive a target). Not used by init.

Commands:
  doctor    Validate this project against its registry: registry resolves, memory
            and session shapes, auto-memory pointers, banned prose. Read-only.
  scrub     House-voice gate over authored files. --check (default) reports banned
            prose, --fix auto-rewrites the safe cases (ambiguous ones flagged, not removed).
            [--path <file>]
  sync      Rebuild skills.dispatch in _index.json from the AIDOCS/SKILL/ bodies.
            [--dry-run]
  upgrade   Drive the project up to the fetched engine's manifest plus refresh the
            engine-class paths (AIDOCS/tools, AIDOCS/SKILL, .claude/skills/321/SKILL.md).
            Diffs MANIFEST.json operations against engine.operations_applied[], applies
            each missing op (idempotent), skips paths in customizations[], bumps
            engine.version. Requires a prior fetch-engine. Refuses while reconcile_pending
            is set ([--force] overrides). [--dry-run]
  merge-status  Print the merge punch list for customizations[] against the fetched
            upstream tree (identical / diverged / upstream-absent). Read-only by
            default; the AI walks the output during -UpdateSync to drop / merge /
            delete per entry, so customizations[] self-cleans as upstream catches up.
            --auto-drop-clean mechanically drops identical + upstream-absent entries
            from customizations[] (no AI judgment), leaving only diverged entries for
            the AI to merge (the script half of -UpdateSync -FULL). Requires fetch-engine.
            [--auto-drop-clean]
  validate  Check a staging file's actions are well-formed. Read-only.
            --skill <updatesession | updatememory>
  commit    Apply a staging file. Two-phase: simulate, then write. Stamps state,
            records this run's bullet fingerprints, clears staging on success.
            --skill <updatesession | updatememory>
  watermark Print the skill's watermark (last_committed_at + last_captured slugs).
            Read-only lookup over state.json. The lean -Update path scopes the AI to
            "conversation since the watermark"; the fingerprints answer "did I
            capture this arc?" without re-reading SESSION / MEMORY.
            [--skill <updatesession | updatememory>] (omit for both)
  fetch-engine  Fetch a 321 engine source into INSTALL/engine (for -UpdateSync / re-setup).
            [--from <dir>] copy a local tree, or [--repo <url> --ref <branch>] clone.
  state     Print state.json, or flip the reconcile gate (the Setup -> Update handoff).
            [--set-reconcile | --clear-reconcile [--force]]. Clear refuses on reconcile
            residue (stale cross-project refs / import markers) unless --force.
  privacy   Print the project's tracking mode, or flip it. private tracks the project's
            memory / auto-memory / WDDOCS docs. public gates them local (the engine is
            tracked either way). Flipping to public rewrites .gitignore and untracks the
            gated content from the git index (working tree kept). [--set <public | private>]
  migrate-archive  Move a project's known 321-shape content into
            AIDOCS/<NAME>_SETUP_ARCHIVE/ (move, not delete). --name <PROJECT>
  migrate-restore  Layer archived content back after reinstall: WDDOCS verbatim, a
            .gitignore union-merge, the DEV-AUDIT / AUTO-PUSH sections and BACKLOG
            lists (with legacy + rename normalization), and CHANGELOG (nothing dropped). --name <PROJECT>
  migrate-import  Lossless-import an archived EXTENDED file into a staging file the
            commit pipeline applies (paired [+] bullets + ### sub-sections), or --audit
            it against the distilled EXTENDED at reconcile.
            --from <file> --skill <updatesession | updatememory> [--old <N> --new <N>] [--append | --dry-run | --audit]
  verdict   Validate or apply a migration verdict (the AI's scan result), a JSON
            array of {path, type, confidence, action}: --validate <file>, or
            --apply <file> --name <PROJECT> (move / copy to the archive, or leave).
            --suggest [--out <file>] drafts a candidate verdict from a heuristic scan, for AI review.
  bigsix    --suggest    Draft the two script-readable Big-6 sections (Stack +
            Pipeline) from package.json, for the UpdateMemory fill to refine.
  graduate  Tear down onboarding: deregister -Setup, remove INSTALL/, mark graduated.
            Refuses while reconcile_pending is set ([--force] overrides).
  init      Lay the project skeleton into a target, substituting the name. --privacy
            sets the tracking mode (private default, public gates the project's own
            knowledge local). A reinstall recalls the mode from the registry / archive.
            --upstream records the install source into engine.upstream (write-if-empty,
            so a user-customized fork URL survives a reinstall).
            <target-dir> --name <PROJECT> [--privacy <public | private>]
              [--upstream <url>] [--force]
            (--force rewrites the scaffold; refused on an existing 321 project)
  help      Print this message.
`);
}

main().catch((e) => { console.error(`fatal: ${e.message}`); process.exit(99); });
