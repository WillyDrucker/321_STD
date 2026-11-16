// syncAutoMemory.mjs - keeps auto-memory's two homes in step. The seed (auto_memory.seed, in
// the repo) and the runtime (auto_memory.path, outside the root, what the model loads) both
// refresh: upstream's rules flow seed to runtime, and the project's own rules flow runtime
// to seed so git versions them and a fresh machine restores them. The copy step resolves
// against the root, so it cannot reach the runtime on its own. Upstream owns the rule files
// it ships, the project owns MEMORY.md (its index) and user_*.md, and the one removal here
// is the seed's profile placeholder once the runtime carries a filled profile and has
// retired the placeholder itself. Every runtime body this overwrites is copied into the
// pre-upgrade snapshot first. `upgrade` runs it after the copy, and `sync-automemory` runs
// it on demand, since the migration lifecycle never runs upgrade.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { canonicalPath, fromHomeRef, fromRoot, installEngineDir, isContained, isExternalRef, isProjectOwned, repoRoot } from "./paths.mjs";

const RULE = /^(feedback_|reference_|project_).+\.md$/;
const PROFILE = /^user_.+\.md$/;
const PLACEHOLDER_PROFILE = "user_name.md";
const SNAPSHOT = ["TEMP", "engine-backup-pre-upgrade", "runtime-automemory"];

// A pointer line's link target, normalized so "./x.md" and "x.md" are one target.
function linkTarget(line) {
  const hit = line.match(/\]\(([^)]+\.md)\)/);
  return hit ? hit[1].replace(/^\.\//, "") : null;
}

function bullets(md) {
  return md.split(/\r?\n/).filter((l) => l.trim().startsWith("- "));
}

// Every read and write of the two homes goes through this view. A dry run writes nothing,
// so it records each write it would make and later steps read those records, which keeps
// its counts equal to the real run's. Without it each step measured the disk as it stood
// before the steps ahead of it, and a dry upgrade undercounted what the copy step changes.
function makeView(dryRun) {
  const over = new Map(); // absolute path -> { text } | { gone: true }
  const key = (p) => resolve(p);
  const has = (p) => { const o = over.get(key(p)); return o ? !o.gone : existsSync(p); };
  const text = (p) => { const o = over.get(key(p)); if (o) return o.gone ? "" : o.text; return existsSync(p) ? readFileSync(p, "utf8") : ""; };
  const list = (dir) => {
    const names = new Set(existsSync(dir) ? readdirSync(dir) : []);
    for (const [p, o] of over) if (dirname(p) === key(dir)) (o.gone ? names.delete(basename(p)) : names.add(basename(p)));
    return [...names];
  };
  return {
    has, text, list,
    same: (a, b) => has(a) && has(b) && text(a) === text(b),
    copy: (from, to) => { if (dryRun) over.set(key(to), { text: text(from) }); else copyFileSync(from, to); },
    write: (to, t) => { if (dryRun) over.set(key(to), { text: t }); else writeFileSync(to, t, "utf8"); },
    remove: (p) => { if (dryRun) over.set(key(p), { gone: true }); else rmSync(p, { force: true }); },
  };
}

// A runtime body about to be replaced lands in the pre-upgrade snapshot, the same net the
// engine-class copy has. Best-effort: a failed snapshot never blocks the sync.
function snapshotRuntimeFile(file) {
  try {
    const dst = join(fromRoot(SNAPSHOT.join("/")), file.name);
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(file.path, dst);
  } catch { /* best-effort */ }
}

// Rebuild an index in upstream order (upstream's hook text wins for the rules it ships,
// except a rule whose seed path sits in customizations[]: the copy step kept its body, so
// the seed's own line stands in for upstream's in both homes), then the project's own
// lines: those already in this home's index, plus any from the other home whose file now
// sits here, so a promoted or mirrored rule brings its pointer along. Deduped by target,
// nothing dropped. An upstream pointer whose target is absent is left out: the placeholder
// profile is project-owned and never copied, so on a project that renamed it the line
// would dangle beside the real profile's own pointer.
function reconcileIndex(upstreamMd, ownMd, otherMd, eol, dir, customizedHooks, v) {
  const here = (l) => { const t = linkTarget(l); return !t || v.has(join(dir, t)); };
  const upstream = bullets(upstreamMd).filter(here).map((l) => customizedHooks.get(linkTarget(l)) ?? l);
  const shipped = new Set(bullets(upstreamMd).map(linkTarget).filter(Boolean));
  const seen = new Set();
  const own = [];
  const take = (line, mustExist) => {
    const t = linkTarget(line);
    if (!t || shipped.has(t) || seen.has(t) || (mustExist && !here(line))) return;
    seen.add(t);
    own.push(line);
  };
  for (const line of bullets(ownMd)) take(line, false);
  for (const line of bullets(otherMd)) take(line, true);
  return [...upstream, ...own].join(eol) + eol;
}

// What the engine-class copy lays into the canonical seed, recorded on a dry upgrade so the
// sync reads the seed the real run would read. Same skips as the copy: customizations[] and
// the project-owned files.
function projectCopyStep(srcDir, seedDir, customizations, v) {
  for (const f of readdirSync(srcDir)) {
    const from = join(srcDir, f);
    if (!statSync(from).isFile()) continue;
    const rel = `AIDOCS/automemory/${f}`;
    if (customizations.has(rel) || isProjectOwned(rel)) continue;
    if (!v.same(from, join(seedDir, f))) v.copy(from, join(seedDir, f));
  }
}

// A seed at a non-canonical path is outside the engine-class copy, so upstream's rules
// land in it here, with the same customizations[] opt-out the copy honors. Returns the
// count refreshed.
function refreshCustomSeed(srcDir, seedDir, seedRel, customizations, v) {
  let refreshed = 0;
  for (const f of readdirSync(srcDir).filter((n) => RULE.test(n))) {
    if (customizations.has(`${seedRel}/${f}`)) continue;
    const from = join(srcDir, f);
    const to = join(seedDir, f);
    if (v.same(from, to)) continue;
    v.copy(from, to);
    refreshed++;
  }
  return refreshed;
}

// Seed to runtime. Every rule upstream ships lands with upstream's body (the replaced ones
// are named and snapshotted first), a project rule or profile the seed holds but the runtime
// lacks is laid write-if-missing (the fresh-machine case), and the shipped placeholder
// profile is laid only into a runtime that has no profile at all (the fresh-runtime case).
function mirrorToRuntime(srcDir, seedDir, runtimeDir, dryRun, v) {
  let mirrored = 0;
  const overwritten = [];
  if (!dryRun && !existsSync(runtimeDir)) mkdirSync(runtimeDir, { recursive: true });
  const shipped = new Set(readdirSync(srcDir));
  const runtimeHasProfile = v.list(runtimeDir).some((n) => PROFILE.test(n));
  for (const f of v.list(seedDir).filter((n) => RULE.test(n) || PROFILE.test(n)).sort()) {
    const from = join(seedDir, f);
    const to = join(runtimeDir, f);
    if (v.same(from, to)) continue;
    if (shipped.has(f)) {
      if (PROFILE.test(f) && runtimeHasProfile) continue;
      if (v.has(to)) { overwritten.push(f); if (!dryRun) snapshotRuntimeFile({ name: f, path: to }); }
    } else if (v.has(to)) {
      continue;                                // a project file the runtime already has: the runtime's body wins
    }
    v.copy(from, to);
    mirrored++;
  }
  return { mirrored, overwritten };
}

// Runtime to seed. A rule or profile the project wrote that upstream does not ship is
// unversioned while it lives only in the runtime, so the seed takes a copy, the runtime's
// body winning. A filled profile retires the seed's placeholder.
function promoteToSeed(srcDir, seedDir, runtimeDir, v) {
  let promoted = 0;
  const notes = [];
  if (!existsSync(runtimeDir)) return { promoted, notes };
  const shipped = new Set(readdirSync(srcDir));
  const own = v.list(runtimeDir).filter((n) => (RULE.test(n) || PROFILE.test(n)) && !shipped.has(n));
  for (const f of own) {
    const from = join(runtimeDir, f);
    const to = join(seedDir, f);
    if (v.same(from, to)) continue;
    v.copy(from, to);
    promoted++;
  }
  const placeholder = join(seedDir, PLACEHOLDER_PROFILE);
  const filled = own.some((n) => PROFILE.test(n));
  if (filled && v.has(placeholder) && !v.has(join(runtimeDir, PLACEHOLDER_PROFILE))) {
    v.remove(placeholder);
    notes.push(`the seed's ${PLACEHOLDER_PROFILE} placeholder retired, the runtime carries the filled profile`);
  }
  return { promoted, notes };
}

// Returns a report for the caller's output, or null when there was nothing to do. `source`
// is the tree whose AIDOCS/automemory defines what upstream ships. `afterCopy` says the
// engine-class copy ran first, so a dry run lays that copy into its view before measuring.
export function syncAutoMemory(source, index, dryRun, { afterCopy = false } = {}) {
  const seedRel = (index.auto_memory?.seed || "./AIDOCS/automemory").replace(/^\.\//, "");
  const seedDir = fromRoot(seedRel);
  const srcDir = join(source, "AIDOCS", "automemory");
  if (!existsSync(srcDir) || !existsSync(seedDir)) return null;
  // A registry value is data. One with a ".." in it would read and write another tree.
  if (!isContained(repoRoot(), seedDir)) return `auto-memory: auto_memory.seed "${seedRel}" escapes the project root, refusing to sync`;

  const v = makeView(dryRun);
  const customizations = new Set(index.customizations || []);
  const notes = [];
  if (canonicalPath(seedDir) !== canonicalPath(fromRoot("AIDOCS/automemory"))) {
    const refreshed = refreshCustomSeed(srcDir, seedDir, seedRel, customizations, v);
    if (refreshed) notes.push(`${refreshed} upstream rule(s) refreshed in the seed at ${seedRel}, which the copy step does not reach`);
  } else if (dryRun && afterCopy) {
    projectCopyStep(srcDir, seedDir, customizations, v);
  }

  const pathRef = index.auto_memory?.path;
  let runtimeDir = null;
  if (pathRef) {
    if (isExternalRef(pathRef)) runtimeDir = fromHomeRef(pathRef);
    // Never resolve this against cwd. See paths.isExternalRef.
    else notes.push(`auto_memory.path "${pathRef}" is not absolute or "~"-relative, refusing to guess. Runtime NOT synced.`);
  }

  let mirrored = 0, promoted = 0, overwritten = [];
  if (runtimeDir) {
    ({ mirrored, overwritten } = mirrorToRuntime(srcDir, seedDir, runtimeDir, dryRun, v));
    const up = promoteToSeed(srcDir, seedDir, runtimeDir, v);
    promoted = up.promoted;
    notes.push(...up.notes);
  }

  // Index reconcile, in both homes. Never a wholesale copy, which would delete the
  // project's pointers to its own rules.
  const srcIndex = join(srcDir, "MEMORY.md");
  let indexes = 0;
  if (existsSync(srcIndex)) {
    const upstreamMd = readFileSync(srcIndex, "utf8");
    const customized = new Set([...customizations].filter((p) => p.startsWith(`${seedRel}/`)).map((p) => p.slice(seedRel.length + 1)));
    const customizedHooks = new Map(bullets(v.text(join(seedDir, "MEMORY.md"))).filter((l) => customized.has(linkTarget(l))).map((l) => [linkTarget(l), l]));
    for (const [dir, other] of [[seedDir, runtimeDir], [runtimeDir, seedDir]]) {
      if (!dir) continue;
      const target = join(dir, "MEMORY.md");
      const current = v.text(target);
      const eol = current.includes("\r\n") ? "\r\n" : "\n"; // do not churn a CRLF project
      const next = reconcileIndex(upstreamMd, current, other ? v.text(join(other, "MEMORY.md")) : "", eol, dir, customizedHooks, v);
      if (next === current) continue;
      v.write(target, next);
      indexes++;
    }
  }

  if (mirrored === 0 && promoted === 0 && indexes === 0 && notes.length === 0) return null;
  const lines = [`auto-memory: ${mirrored} rule(s) mirrored to runtime, ${promoted} promoted to the seed, ${indexes} index(es) reconciled`];
  if (overwritten.length > 0) lines.push(`  auto-memory: upstream replaced ${overwritten.join(", ")} (prior bodies are in the pre-upgrade snapshot)`);
  for (const n of notes) lines.push(`  auto-memory: ${n}`);
  return lines.join("\n");
}

// The sync on demand: the fetched engine defines what upstream ships when one is present
// (a migration keeps INSTALL/engine until graduation), otherwise the project's own seed does
// and wins for every rule it holds. Backs the `sync-automemory` CLI command.
export function cmdSyncAutoMemory(index, args) {
  const dryRun = args.includes("--dry-run");
  const source = existsSync(installEngineDir()) ? installEngineDir() : repoRoot();
  const report = syncAutoMemory(source, index, dryRun);
  console.log(report ? `${report}${dryRun ? " (dry-run)" : ""}` : "auto-memory: both homes already in step.");
}
