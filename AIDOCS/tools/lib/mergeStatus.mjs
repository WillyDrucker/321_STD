// mergeStatus.mjs - the merge punch list for customizations[] against the fetched
// upstream at INSTALL/engine. Classifies each entry as identical / diverged /
// both_absent / local_absent / upstream_absent. --auto-drop-clean drops only the
// two no-file-at-risk classes (identical, both_absent). The three judgment classes
// stay for AI review because dropping would let upgrade restore, delete, or
// overwrite a file the user has a position on.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { indexPath, installEngineDir, repoRoot } from "./paths.mjs";

function classify(index) {
  const root = repoRoot();
  const source = installEngineDir();
  const customizations = index.customizations || [];
  const identical = [], diverged = [], bothAbsent = [], localAbsent = [], upstreamAbsent = [];
  for (const rel of customizations) {
    const projectPath = join(root, rel);
    const upstreamPath = join(source, rel);
    const projectExists = existsSync(projectPath);
    const upstreamExists = existsSync(upstreamPath);
    if (!projectExists && !upstreamExists) { bothAbsent.push(rel); continue; }
    if (!projectExists) { localAbsent.push(rel); continue; }
    if (!upstreamExists) { upstreamAbsent.push(rel); continue; }
    if (readFileSync(projectPath, "utf8") === readFileSync(upstreamPath, "utf8")) identical.push(rel);
    else diverged.push(rel);
  }
  return { identical, diverged, bothAbsent, localAbsent, upstreamAbsent, source, total: customizations.length };
}

function plural(n, one, many) { return n === 1 ? one : many; }

export function cmdMergeStatus(index, args = []) {
  const source = installEngineDir();
  if (!existsSync(source)) {
    console.error(`merge-status: no fetched engine at ${source}. Run \`fetch-engine\` first.`);
    process.exit(20);
  }
  if ((index.customizations || []).length === 0) {
    console.log("merge-status: customizations[] is empty - nothing to merge.");
    return;
  }

  const result = classify(index);
  const { identical, diverged, bothAbsent, localAbsent, upstreamAbsent, total } = result;
  const autoDrop = args.includes("--auto-drop-clean");

  console.log(`merge-status: ${total} customizations[] ${plural(total, "entry", "entries")} against ${result.source}`);
  if (identical.length > 0) {
    console.log(`  identical (${identical.length}) - upstream matches local, safe to drop from customizations[]:`);
    for (const r of identical) console.log(`    - ${r}`);
  }
  if (diverged.length > 0) {
    console.log(`  diverged (${diverged.length}) - needs AI merge (preserve local intent + fold in upstream changes), then drop the entry if the merge result equals upstream:`);
    for (const r of diverged) console.log(`    - ${r}`);
  }
  if (bothAbsent.length > 0) {
    console.log(`  both-absent (${bothAbsent.length}) - no file in project or upstream, customization is a dead reference, safe to drop:`);
    for (const r of bothAbsent) console.log(`    - ${r}`);
  }
  if (localAbsent.length > 0) {
    console.log(`  local-absent (${localAbsent.length}) - upstream has the file, project does not. Dropping the customization would let the next upgrade restore it from upstream. Keep the entry if the local deletion was intentional, drop it if the file should come back:`);
    for (const r of localAbsent) console.log(`    - ${r}`);
  }
  if (upstreamAbsent.length > 0) {
    console.log(`  upstream-absent (${upstreamAbsent.length}) - project has the file, upstream does not. Check MANIFEST.json for a file_delete op covering each path. If covered: dropping the customization would let the next upgrade delete the local file - judge whether the local content is still worth keeping. If not covered: the file is a project-custom skill or doc mistakenly listed - drop the entry (project-custom files survive by absence):`);
    for (const r of upstreamAbsent) console.log(`    - ${r}`);
  }

  if (!autoDrop) return;

  // Mechanical sweep: identical and both_absent drop without AI judgment. Identical
  // matches upstream verbatim, both_absent leaves no file on either side. The other
  // three classes (local_absent, upstream_absent, diverged) all require AI judgment
  // because dropping the customization would let the next upgrade restore or delete
  // a file the user has a position on, or write over a meaningful local edit.
  const drops = new Set([...identical, ...bothAbsent]);
  if (drops.size === 0) {
    console.log("merge-status --auto-drop-clean: no clean entries to drop (all remaining need AI judgment: diverged, local-absent, or upstream-absent).");
    return;
  }
  const kept = (index.customizations || []).filter((rel) => !drops.has(rel));
  const updated = { ...index, customizations: kept };
  writeFileSync(indexPath(), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`merge-status --auto-drop-clean: dropped ${drops.size} ${plural(drops.size, "entry", "entries")} from customizations[]:`);
  for (const r of identical) console.log(`    - ${r} (identical to upstream)`);
  for (const r of bothAbsent) console.log(`    - ${r} (both-absent)`);
  const remaining = diverged.length + localAbsent.length + upstreamAbsent.length;
  if (remaining > 0) console.log(`merge-status --auto-drop-clean: ${remaining} ${plural(remaining, "entry", "entries")} left for AI judgment (${diverged.length} diverged, ${localAbsent.length} local-absent, ${upstreamAbsent.length} upstream-absent).`);
}
