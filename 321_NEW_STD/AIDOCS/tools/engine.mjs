#!/usr/bin/env node
// engine.mjs - entry point for the 321 engine. Dispatches the reproducer
// commands (init lays the skeleton, doctor validates it) and the staging pipeline
// the skills write through (validate, commit). Kept small so the command surface
// is visible in one read. The logic lives in lib/.

import process from "node:process";

import { cmdCommit } from "./lib/commit.mjs";
import { cmdDoctor } from "./lib/doctor.mjs";
import { cmdFetchEngine } from "./lib/fetch-engine.mjs";
import { cmdGraduate } from "./lib/graduate.mjs";
import { cmdInit } from "./lib/init.mjs";
import { cmdMigrateArchive } from "./lib/migrate-archive.mjs";
import { cmdMigrateRestore } from "./lib/migrate-restore.mjs";
import { loadIndex, setRoot } from "./lib/paths.mjs";
import { cmdScrub } from "./lib/scrub.mjs";
import { cmdState } from "./lib/state.mjs";
import { cmdSync } from "./lib/sync.mjs";
import { cmdValidate } from "./lib/validate.mjs";
import { cmdVerdict } from "./lib/verdict.mjs";

const COMMANDS = ["doctor", "scrub", "sync", "validate", "commit", "state", "fetch-engine", "migrate-archive", "migrate-restore", "verdict", "graduate", "init", "help"];

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
  const index = loadIndex();
  switch (cmd) {
    case "doctor":   cmdDoctor(index); break;
    case "scrub":    cmdScrub(index, args); break;
    case "sync":     cmdSync(index, args); break;
    case "validate": cmdValidate(index, args); break;
    case "commit":   cmdCommit(index, args); break;
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
            prose, --fix rewrites em dashes to " - " (semicolons flagged, not removed).
            [--path <file>]
  sync      Rebuild skills.dispatch in _index.json from the AIDOCS/SKILL/ bodies.
            [--dry-run]
  validate  Check a staging file's actions are well-formed. Read-only.
            --skill <sessionupdate | memoryupdate>
  commit    Apply a staging file. Two-phase: simulate, then write. Stamps state,
            clears staging on success.
            --skill <sessionupdate | memoryupdate>
  fetch-engine  Fetch a 321 engine source into INSTALL/engine (for -Update -Sync / re-setup).
            [--from <dir>] copy a local tree, or [--repo <url> --ref <branch>] clone.
  state     Print state.json, or flip the reconcile gate (the Setup -> Update handoff).
            [--set-reconcile | --clear-reconcile]
  migrate-archive  Move a project's known 321-shape content into
            AIDOCS/<NAME>_SETUP_ARCHIVE/ (move, not delete). --name <PROJECT>
  migrate-restore  Layer archived content back after reinstall: WDDOCS verbatim and
            a .gitignore union-merge (nothing dropped). --name <PROJECT>
  verdict   Validate or apply a migration verdict (the AI's scan result), a JSON
            array of {path, type, confidence, action}: --validate <file>, or
            --apply <file> --name <PROJECT> (move / copy to the archive, or leave).
  graduate  Tear down onboarding: deregister -Setup, remove INSTALL/, mark graduated.
            Refuses while reconcile_pending is set ([--force] overrides).
  init      Lay the project skeleton into a target, substituting the name.
            <target-dir> --name <PROJECT>
  help      Print this message.
`);
}

main().catch((e) => { console.error(`fatal: ${e.message}`); process.exit(99); });
