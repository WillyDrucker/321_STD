// initRecall.mjs - the three "recall N across a reinstall" helpers init leans on so a
// re-run preserves the values the first install recorded. Each one walks the same two
// lookup sites in order: the live `_index.json` first (a routine reinstall), then the
// post-archive copy at `<NAME>_SETUP_ARCHIVE/AIDOCS/_index.json` (a migration reinstall,
// where migrate-archive moved the live registry aside before init re-runs). The shared
// pattern is exactly the cohesion seam - init.mjs owns "lay the skeleton", these own
// "remember what the prior install recorded".
//
// Each returns the recalled value or a documented default: privacy defaults to "private"
// (the safe default tracks everything, so a missed call cannot silently hide a private
// project), the memory path returns null (caller falls back to claudeMemoryDir derivation),
// the upstream URL returns "" (matches the source dogfood template's empty value).

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Recall a project's recorded privacy across a reinstall so a migration keeps its mode.
// Default private - safe default tracks everything, so a missed call cannot silently
// hide a private project. A public repo passes --privacy.
export async function recallPrivacy(target, name) {
  for (const p of [
    join(target, "AIDOCS", "_index.json"),
    join(target, "AIDOCS", `${name}_SETUP_ARCHIVE`, "AIDOCS", "_index.json"),
  ]) {
    if (!existsSync(p)) continue;
    try { const v = JSON.parse(await readFile(p, "utf8")).privacy; if (v) return v; } catch { /* malformed - skip */ }
  }
  return "private";
}

// Recall a recorded external-memory path across a reinstall so a re-migration keeps the
// folder it already uses. A legacy project recorded it absolute, a rebuilt one
// home-relative - either is returned as stored and normalized to absolute by the caller.
export async function recallMemoryPath(target, name) {
  for (const p of [
    join(target, "AIDOCS", "_index.json"),
    join(target, "AIDOCS", `${name}_SETUP_ARCHIVE`, "AIDOCS", "_index.json"),
  ]) {
    if (!existsSync(p)) continue;
    try { const v = JSON.parse(await readFile(p, "utf8")).auto_memory?.path; if (v) return v; } catch { /* malformed - skip */ }
  }
  return null;
}

// Recall a recorded engine.upstream URL across a reinstall. Without this, a migration's
// reinstall (which moves the live registry into the archive before re-laying scaffolds)
// would silently drop the upstream the original install recorded, leaving the project
// unable to -UpdateSync. An explicit --upstream flag on the reinstall still wins via the
// caller's precedence.
export async function recallUpstream(target, name) {
  for (const p of [
    join(target, "AIDOCS", "_index.json"),
    join(target, "AIDOCS", `${name}_SETUP_ARCHIVE`, "AIDOCS", "_index.json"),
  ]) {
    if (!existsSync(p)) continue;
    try { const v = JSON.parse(await readFile(p, "utf8")).engine?.upstream; if (v) return v; } catch { /* malformed - skip */ }
  }
  return "";
}
