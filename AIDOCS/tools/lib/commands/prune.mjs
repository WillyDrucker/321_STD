// prune.mjs - the `prune` CLI command. Thin wrapper: parses --file / --dry-run
// and dispatches to the paired (session / memory) or standalone runner. The
// prune logic and archive writers live in lib/pruneRunners.mjs, shared with
// commit.mjs auto-prune.

import { parseFlags, requireOpt } from "../cli.mjs";
import { runPairedPrune, runStandalonePrune } from "../pruneRunners.mjs";

export async function cmdPrune(index, args) {
  const opts = parseFlags(args, ["file", "dry-run"]);
  const dryRun = opts["dry-run"] === true;
  requireOpt(opts, "file");

  if (opts.file === "session" || opts.file === "memory") {
    await runPairedPrune(index, opts.file, { dryRun });
    return;
  }
  await runStandalonePrune(index, opts.file, { dryRun });
}
