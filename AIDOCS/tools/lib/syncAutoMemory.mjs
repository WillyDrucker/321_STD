// syncAutoMemory.mjs - lands upstream rule changes in the place the AI actually reads.
//
// WHY THIS EXISTS SEPARATELY FROM THE COPY STEP: auto-memory has TWO homes. The seed
// (AIDOCS/automemory, in the repo) and the runtime (auto_memory.path, outside the project
// root, which is what the model loads at session start). copyEngineClass resolves every
// path against the project root, so on its own it would refresh the seed and leave the
// live rules untouched - the fix would land and change nothing the AI reads.
//
// Ownership: upstream owns the shared rule files, the project owns MEMORY.md (its rule
// index) and user_*.md (its identity). A project-authored rule survives by having no
// upstream counterpart, so nothing here deletes.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fromHomeRef, fromRoot, isExternalRef } from "./paths.mjs";

const RULE = /^(feedback_|reference_|project_).+\.md$/;

// A pointer line's link target, normalized so "./x.md" and "x.md" are one target.
function linkTarget(line) {
  const hit = line.match(/\]\(([^)]+\.md)\)/);
  return hit ? hit[1].replace(/^\.\//, "") : null;
}

// The index is a pointer list, one line per rule. Upstream owns the hook text for the rules
// it ships (it just rewrote them, so its one-liner is the accurate one), and the project
// owns any line pointing at a file upstream does not have. Rebuild in upstream order, then
// append the project's own lines, deduped by normalized target. Nothing is dropped.
function reconcileIndex(upstreamMd, projectMd, eol) {
  const bullets = (md) => md.split(/\r?\n/).filter((l) => l.trim().startsWith("- "));
  const upstream = bullets(upstreamMd);
  const shipped = new Set(upstream.map(linkTarget).filter(Boolean));

  const seen = new Set();
  const projectOnly = [];
  for (const line of bullets(projectMd)) {
    const t = linkTarget(line);
    if (!t || shipped.has(t) || seen.has(t)) continue;
    seen.add(t);
    projectOnly.push(line);
  }
  return [...upstream, ...projectOnly].join(eol) + eol;
}

// Mirror the freshly-copied seed into the external runtime, and reconcile both indexes.
// Returns a report line for the upgrade output, or null when there was nothing to do.
export function syncAutoMemory(source, index, dryRun) {
  const seedRel = (index.auto_memory?.seed || "./AIDOCS/automemory").replace(/^\.\//, "");
  const seedDir = fromRoot(seedRel);
  const srcDir = join(source, "AIDOCS", "automemory");
  if (!existsSync(srcDir) || !existsSync(seedDir)) return null;

  const pathRef = index.auto_memory?.path;
  let runtimeDir = null;
  const notes = [];
  if (pathRef) {
    if (isExternalRef(pathRef)) {
      runtimeDir = fromHomeRef(pathRef);
    } else {
      // Never resolve this against cwd. See paths.isExternalRef.
      notes.push(`auto_memory.path "${pathRef}" is not absolute or "~"-relative, refusing to guess. Runtime NOT synced.`);
    }
  }

  let mirrored = 0;
  const overwritten = [];
  if (runtimeDir) {
    if (!dryRun && !existsSync(runtimeDir)) mkdirSync(runtimeDir, { recursive: true });
    for (const f of readdirSync(srcDir).filter((name) => RULE.test(name))) {
      const from = join(seedDir, f);
      const to = join(runtimeDir, f);
      if (!existsSync(from)) continue;
      const had = existsSync(to);
      if (had && readFileSync(from, "utf8") === readFileSync(to, "utf8")) continue;
      if (had) overwritten.push(f);
      if (!dryRun) copyFileSync(from, to);
      mirrored++;
    }
  }

  // Index reconcile, in both homes. Never a wholesale copy - that would delete the project's
  // pointers to its own rules.
  const srcIndex = join(srcDir, "MEMORY.md");
  let indexes = 0;
  if (existsSync(srcIndex)) {
    const upstreamMd = readFileSync(srcIndex, "utf8");
    for (const dir of [seedDir, runtimeDir].filter(Boolean)) {
      const target = join(dir, "MEMORY.md");
      const current = existsSync(target) ? readFileSync(target, "utf8") : "";
      const eol = current.includes("\r\n") ? "\r\n" : "\n"; // do not churn a CRLF project
      const next = reconcileIndex(upstreamMd, current, eol);
      if (next === current) continue;
      if (!dryRun) writeFileSync(target, next, "utf8");
      indexes++;
    }
  }

  if (mirrored === 0 && indexes === 0 && notes.length === 0) return null;
  const lines = [`auto-memory: ${mirrored} rule(s) mirrored to runtime, ${indexes} index(es) reconciled`];
  // Name what was REPLACED. Force-copy means upstream wins on a basename collision, so a
  // project rule that happens to share a name with a newly-shipped upstream rule is
  // overwritten. The pre-upgrade snapshot in TEMP/ is the recovery net, but the user has to
  // know it happened to reach for it.
  if (overwritten.length > 0) lines.push(`  auto-memory: upstream replaced ${overwritten.join(", ")} (prior bodies are in the pre-upgrade snapshot)`);
  for (const n of notes) lines.push(`  auto-memory: ${n}`);
  return lines.join("\n");
}
