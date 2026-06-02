// routerQuickRef.mjs - reconcile the router body's "How to invoke" quick-ref block
// against the actual skill bodies in AIDOCS/SKILL/. Drops lines whose `/321 -Flag`
// has no matching SKILL_*.md, so a deregistered skill (graduated -Setup, any
// skill_delete op) stops being advertised. Reads the live on-disk skill set, not
// the registry, so it stays correct when called between an engine-class copy and
// a sync (the upgrade flow) - the registry is one step behind the SKILL/ tree
// there, and using it would prune a brand-new upstream flag the project's stale
// dispatch does not know yet. Never invents lines for new skills (the upstream
// router copy lands those verbatim), only prunes orphans.
//
// Called from upgrade (after the engine-class copy step) and from graduate (after
// the -Setup deregistration). Idempotent.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { flagFromFilename, frontmatterField } from "./sync.mjs";

const BLOCK_RE = /(## How to invoke\s*\n+\s*```\n)([\s\S]*?)(\n?```\n)/;

export function reconcileRouterQuickRef(root, dryRun = false) {
  const routerPath = join(root, ".claude", "skills", "321", "SKILL.md");
  if (!existsSync(routerPath)) return null;
  const content = readFileSync(routerPath, "utf8");
  const m = content.match(BLOCK_RE);
  if (!m) return null;
  const skillDir = join(root, "AIDOCS", "SKILL");
  const registeredFlags = new Set();
  if (existsSync(skillDir)) {
    for (const file of readdirSync(skillDir)) {
      if (!/^SKILL_.+\.md$/.test(file)) continue;
      const fm = readFileSync(join(skillDir, file), "utf8");
      registeredFlags.add(frontmatterField(fm, "flag") || flagFromFilename(file).flag);
    }
  }
  const blockBody = m[2];
  const dropped = [];
  const keptLines = [];
  for (const line of blockBody.split("\n")) {
    const lm = line.match(/^\/321\s+(-\S+)/);
    if (!lm) { keptLines.push(line); continue; }
    if (registeredFlags.has(lm[1])) keptLines.push(line);
    else dropped.push(lm[1]);
  }
  if (dropped.length === 0) return { dropped: [] };
  const newBlock = keptLines.join("\n");
  if (!dryRun) {
    const newContent = content.slice(0, m.index) + m[1] + newBlock + m[3] + content.slice(m.index + m[0].length);
    writeFileSync(routerPath, newContent, "utf8");
  }
  return { dropped };
}
