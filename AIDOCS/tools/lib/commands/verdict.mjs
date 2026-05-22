// verdict.mjs - validate and execute a C-hybrid verdict file. The AI writes the
// verdict (the shared schema in ../verdict.mjs) to INSTALL/work/, this validates
// it and, with --apply, runs the deterministic file ops. Onboarding-tier: used by
// the SETUP discovery sweep, auto-memory map, and skill-collision list.
//
//   verdict [--file <json>]                 validate + print the plan (no changes)
//   verdict --apply --archive <dir> [...]   execute move / copy / leave
//
// Non-destructive by default: move/copy land under the archive (the recovery net),
// leave is a no-op, import is reported for the runbook to route via import-skills.

import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { err, parseFlags } from "../cli.mjs";
import { INSTALL_WORK_DIR, REPO_ROOT } from "../paths.mjs";
import { validateVerdict } from "../verdict.mjs";

export async function cmdVerdict(args) {
  const opts = parseFlags(args, ["file", "archive", "name", "apply"]);
  const file = opts.file || join(INSTALL_WORK_DIR, "verdict.json");
  if (!existsSync(file)) {
    err(`verdict: no verdict file at ${file}. Write the AI's classification there first.`);
    process.exit(16);
  }

  let entries;
  try {
    entries = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    err(`verdict: ${file} is not valid JSON: ${e.message}`);
    process.exit(13);
  }

  const errors = validateVerdict(entries);
  if (errors.length > 0) {
    err(`verdict: ${errors.length} validation error(s):`);
    for (const e of errors) err(`  - ${e}`);
    process.exit(13);
  }

  const tally = { move: 0, copy: 0, leave: 0, import: 0 };
  for (const e of entries) tally[e.action]++;
  console.log(`verdict: ${entries.length} entrie(s) valid - move ${tally.move}, copy ${tally.copy}, leave ${tally.leave}, import ${tally.import}`);

  if (opts.apply !== true) {
    console.log(`  (plan only - re-run with --apply --archive <dir> to execute move/copy)`);
    return;
  }

  const archive = opts.archive
    ? resolve(opts.archive)
    : (opts.name ? join(REPO_ROOT, "AIDOCS", `${opts.name}_SETUP_ARCHIVE`) : null);
  if (!archive) {
    err(`verdict --apply needs --archive <dir> (or --name <X> for AIDOCS/<X>_SETUP_ARCHIVE).`);
    process.exit(5);
  }

  let moved = 0, copied = 0, left = 0, imports = 0, skipped = 0;
  for (const e of entries) {
    const src = resolve(REPO_ROOT, e.path);
    if (e.action === "leave") { left++; continue; }
    if (e.action === "import") { imports++; console.log(`  import: ${e.path} (type ${e.type}) - route via import-skills / migrate-import`); continue; }
    if (!existsSync(src)) { skipped++; console.log(`  skip (missing): ${e.path}`); continue; }
    const dest = join(archive, e.path);
    await mkdir(dirname(dest), { recursive: true });
    if (e.action === "move") { await rename(src, dest); moved++; }
    else if (e.action === "copy") { await cp(src, dest, { recursive: true }); copied++; }
  }
  console.log(`verdict: applied - ${moved} moved, ${copied} copied, ${left} left, ${imports} import(s) reported${skipped ? `, ${skipped} skipped (missing)` : ""}`);
}
