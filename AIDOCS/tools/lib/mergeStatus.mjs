// mergeStatus.mjs - the merge punch list for customizations[] against the fetched
// upstream tree at INSTALL/engine. Read-only by default: classifies each entry as
// identical (upstream matches local, safe to drop), diverged (local + upstream both
// changed, needs AI merge), or upstream-absent (the upstream tree lacks the file -
// either a file_delete op landed for it or it was a project-custom file mistakenly
// listed). The AI walks this output during -UpdateSync to decide drop / merge /
// delete per entry, so customizations[] self-cleans as upstream catches up to local
// intent without the user editing _index.json by hand.
//
// --auto-drop-clean adds a mechanical sweep: identical and upstream-absent entries
// drop from customizations[] in one pass (no AI judgment required - the file either
// matches upstream verbatim or has no upstream counterpart). Diverged entries are
// left for the AI to merge. This is the script half of -UpdateSync -FULL.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { indexPath, installEngineDir, repoRoot } from "./paths.mjs";

function classify(index) {
  const root = repoRoot();
  const source = installEngineDir();
  const customizations = index.customizations || [];
  const identical = [], diverged = [], absent = [];
  for (const rel of customizations) {
    const projectPath = join(root, rel);
    const upstreamPath = join(source, rel);
    if (!existsSync(projectPath) || !existsSync(upstreamPath)) {
      // Either side missing: no merge target. Both sub-cases (file_delete already
      // landed, or project-custom file mistakenly listed) drop the customizations[]
      // entry. Per-file disposition stays the AI's call - this command only edits
      // the registry list.
      absent.push(rel);
      continue;
    }
    if (readFileSync(projectPath, "utf8") === readFileSync(upstreamPath, "utf8")) identical.push(rel);
    else diverged.push(rel);
  }
  return { identical, diverged, absent, source, total: customizations.length };
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
  const { identical, diverged, absent, total } = result;
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
  if (absent.length > 0) {
    console.log(`  upstream-absent (${absent.length}) - the upstream tree lacks the file:`);
    for (const r of absent) console.log(`    - ${r}`);
    console.log("    Check MANIFEST.json for a file_delete op covering each path. If covered: judge whether the local file is still useful (keep + customizations[] entry, or delete + drop entry). If not covered: this is a project-custom file mistakenly listed - drop the entry (project-custom files survive by absence).");
  }

  if (!autoDrop) return;

  // Mechanical sweep: identical + upstream-absent drop without AI judgment. The
  // file either matches upstream verbatim or has no upstream counterpart, so the
  // customizations[] entry carries no information either way.
  const drops = new Set([...identical, ...absent]);
  if (drops.size === 0) {
    console.log("merge-status --auto-drop-clean: no clean entries to drop (all remaining are diverged).");
    return;
  }
  const kept = (index.customizations || []).filter((rel) => !drops.has(rel));
  const updated = { ...index, customizations: kept };
  writeFileSync(indexPath(), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`merge-status --auto-drop-clean: dropped ${drops.size} ${plural(drops.size, "entry", "entries")} from customizations[]:`);
  for (const r of identical) console.log(`    - ${r} (identical to upstream)`);
  for (const r of absent) console.log(`    - ${r} (upstream-absent)`);
  if (diverged.length > 0) console.log(`merge-status --auto-drop-clean: ${diverged.length} diverged ${plural(diverged.length, "entry", "entries")} left for AI merge.`);
}
