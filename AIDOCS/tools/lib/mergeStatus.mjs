// mergeStatus.mjs - the merge punch list for customizations[] against the fetched
// upstream tree at INSTALL/engine. Read-only inspection: classifies each entry as
// identical (upstream matches local, safe to drop), diverged (local + upstream both
// changed, needs AI merge), or upstream-absent (the upstream tree lacks the file -
// either a file_delete op landed for it or it was a project-custom file mistakenly
// listed). The AI walks this output during -UpdateSync to decide drop / merge /
// delete per entry, so customizations[] self-cleans as upstream catches up to local
// intent without the user editing _index.json by hand.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { installEngineDir, repoRoot } from "./paths.mjs";

export function cmdMergeStatus(index) {
  const root = repoRoot();
  const source = installEngineDir();
  if (!existsSync(source)) {
    console.error(`merge-status: no fetched engine at ${source}. Run \`fetch-engine\` first.`);
    process.exit(20);
  }
  const customizations = index.customizations || [];
  if (customizations.length === 0) {
    console.log("merge-status: customizations[] is empty - nothing to merge.");
    return;
  }
  const identical = [], diverged = [], absent = [];
  for (const rel of customizations) {
    const projectPath = join(root, rel);
    const upstreamPath = join(source, rel);
    if (!existsSync(projectPath) || !existsSync(upstreamPath)) {
      // project missing or upstream missing - either way the AI must judge. Group
      // both under upstream-absent since the file lacks an upstream counterpart to
      // merge against. The status text below names the two sub-cases for the AI.
      absent.push(rel);
      continue;
    }
    const projectContent = readFileSync(projectPath, "utf8");
    const upstreamContent = readFileSync(upstreamPath, "utf8");
    if (projectContent === upstreamContent) identical.push(rel);
    else diverged.push(rel);
  }
  console.log(`merge-status: ${customizations.length} customizations[] entr${customizations.length === 1 ? "y" : "ies"} against ${source}`);
  if (identical.length > 0) {
    console.log(`  identical (${identical.length}) - upstream matches local, safe to drop from customizations[]:`);
    for (const r of identical) console.log(`    - ${r}`);
  }
  if (diverged.length > 0) {
    console.log(`  diverged (${diverged.length}) - needs AI merge (preserve local intent + fold in upstream changes), then drop the entry if the merge result equals upstream:`);
    for (const r of diverged) console.log(`    - ${r}`);
  }
  if (absent.length > 0) {
    console.log(`  upstream-absent (${absent.length}) - the upstream tree lacks the file:`);
    for (const r of absent) console.log(`    - ${r}`);
    console.log("    Check MANIFEST.json for a file_delete op covering each path. If covered: judge whether the local file is still useful (keep + customizations[] entry, or delete + drop entry). If not covered: this is a project-custom file mistakenly listed - drop the entry (project-custom files survive by absence).");
  }
}
