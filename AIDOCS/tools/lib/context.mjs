// context.mjs - one read for the routine -Update pass: the repository's branch, short
// status and recent subjects (or "none" for a project that is not a repository), then
// each lane's watermark and recent slugs. One command keeps the path the prime goal
// protects lean. Read-only. Backs the `context` CLI command.

import { gitRead } from "./gitDrift.mjs";
import { repoRoot } from "./paths.mjs";
import { loadState } from "./state.mjs";
import { lanesFromArgs, printWatermark } from "./watermark.mjs";

const STATUS_LINES = 20;
const LOG_LINES = 10;

function repositoryLines(root) {
  try { gitRead(root, ["rev-parse", "--is-inside-work-tree"]); }
  catch { return ["repository: none (measure from the project's own instruments)"]; }
  let branch = "detached or unborn";
  try { branch = gitRead(root, ["symbolic-ref", "--short", "HEAD"]).trim(); } catch { /* best-effort */ }
  const status = gitRead(root, ["status", "--porcelain"]).trimEnd().split("\n").filter(Boolean);
  const out = [`repository: branch ${branch}, ${status.length} uncommitted path(s)`];
  for (const line of status.slice(0, STATUS_LINES)) out.push(`  ${line}`);
  if (status.length > STATUS_LINES) out.push(`  (+${status.length - STATUS_LINES} more)`);
  let log = "(no commits yet)";
  try { log = gitRead(root, ["log", "--oneline", `-${LOG_LINES}`]).trimEnd() || log; } catch { /* unborn branch */ }
  out.push("recent commits:");
  for (const line of log.split("\n")) out.push(`  ${line}`);
  return out;
}

export function cmdContext(_index, args) {
  for (const line of repositoryLines(repoRoot())) console.log(line);
  printWatermark(loadState(), lanesFromArgs("context", args));
}
