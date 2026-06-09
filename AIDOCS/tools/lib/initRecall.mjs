// initRecall.mjs - the three "recall N across a reinstall" helpers init leans on so a
// re-run preserves the values the first install recorded. All three walk the same two
// lookup sites in order: the live `_index.json` first (a routine reinstall), then the
// post-archive copy at `<NAME>_SETUP_ARCHIVE/AIDOCS/_index.json` (a migration reinstall,
// where migrate-archive moved the live registry aside before init re-runs). recallField
// owns the walk, each recall names its field and its documented default: privacy
// defaults to "private" (the safe default tracks everything, so a missed call cannot
// silently hide a private project), the memory path to null (caller falls back to
// claudeMemoryDir derivation), the upstream URL to "" (the source dogfood template's
// empty value).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Walk the two lookup sites and return the first truthy plucked value, or undefined.
function recallField(target, name, pluck) {
  for (const p of [
    join(target, "AIDOCS", "_index.json"),
    join(target, "AIDOCS", `${name}_SETUP_ARCHIVE`, "AIDOCS", "_index.json"),
  ]) {
    if (!existsSync(p)) continue;
    try { const v = pluck(JSON.parse(readFileSync(p, "utf8"))); if (v) return v; } catch { /* malformed - skip */ }
  }
  return undefined;
}

// Recall a project's recorded privacy across a reinstall so a migration keeps its mode.
// A public repo passes --privacy explicitly.
export function recallPrivacy(target, name) {
  return recallField(target, name, (j) => j.privacy) ?? "private";
}

// Recall a recorded external-memory path across a reinstall so a re-migration keeps the
// folder it already uses. A legacy project recorded it absolute, a rebuilt one
// home-relative - either is returned as stored and normalized to absolute by the caller.
export function recallMemoryPath(target, name) {
  return recallField(target, name, (j) => j.auto_memory?.path) ?? null;
}

// Recall a recorded engine.upstream URL across a reinstall. Without this, a migration's
// reinstall (which moves the live registry into the archive before re-laying scaffolds)
// would silently drop the upstream the original install recorded, leaving the project
// unable to -UpdateSync. An explicit --upstream flag still wins via the caller's precedence.
export function recallUpstream(target, name) {
  return recallField(target, name, (j) => j.engine?.upstream) ?? "";
}
