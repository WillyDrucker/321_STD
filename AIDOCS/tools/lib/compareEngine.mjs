// compareEngine.mjs - the read-only "is there anything to sync" check. Reads local
// engine.version + operations_applied[] and the fetched upstream's version + MANIFEST.json,
// then prints the version delta and the names of manifest ops not yet applied. An update
// check, not an apply preview (that is upgrade --dry-run). Requires a prior fetch-engine,
// like orphans / merge-status / upgrade. Read-only: exits 0 with the report, 20 on a
// missing fetch. Backs the `compare` CLI command.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { installEngineDir } from "./paths.mjs";

function readJSON(path) { return JSON.parse(readFileSync(path, "utf8")); }

export function cmdCompare(index) {
  const source = installEngineDir();
  if (!existsSync(source)) {
    console.error(`compare: no fetched engine at ${source}. Run \`fetch-engine\` first.`);
    process.exit(20);
  }
  const sourceIndexPath = join(source, "AIDOCS", "_index.json");
  if (!existsSync(sourceIndexPath)) {
    console.error(`compare: fetched engine has no _index.json at ${sourceIndexPath}`);
    process.exit(20);
  }
  const localVersion = index.engine?.version || "(unset)";
  const upstreamVersion = readJSON(sourceIndexPath).engine?.version || "(unset)";

  const sourceManifestPath = join(source, "AIDOCS", "MANIFEST.json");
  const upstreamOps = existsSync(sourceManifestPath) ? readJSON(sourceManifestPath).operations || [] : [];
  const applied = new Set(index.engine?.operations_applied || []);
  const pending = upstreamOps.filter((op) => !applied.has(op.name));

  if (localVersion === upstreamVersion) console.log(`compare: local and upstream both ${localVersion}.`);
  else console.log(`compare: local ${localVersion} -> upstream ${upstreamVersion}.`);

  if (pending.length === 0) {
    if (localVersion === upstreamVersion) console.log("  up to date - no operations pending, nothing to sync.");
    else console.log("  engine-only refresh - the version bumped but no structural operations are pending. -UpdateSync copies the new engine code.");
    return;
  }
  console.log(`  ${pending.length} operation(s) pending (in the upstream manifest, not yet in engine.operations_applied[]):`);
  for (const op of pending) console.log(`    - ${op.name} (${op.type})`);
  console.log("  Run /321 -UpdateSync to apply.");
}
