// migrate-archive.mjs - the deterministic A backstop for migration: move a
// project's existing 321-shape content aside into AIDOCS/<NAME>_SETUP_ARCHIVE/ so
// init can lay a clean structure on top. Move, never delete - the archive is the
// recovery net. Operates on the active root (--root). Known-shape paths only - the
// AI discovery sweep (verdict.mjs) covers the rest, routing into the same archive.
// Idempotent, so the sweep can lean on it as needed: it skips what is already
// moved, making re-runs safe. The one exception to move-only: it re-lays a canonical
// .gitignore at root right after archiving the old one, so the project is never without
// ignore rules during the reinstall (the old copy is preserved in the archive for the
// migrate-restore union-merge).
//
// Two hardenings the archive owns on top of the moves:
// 1. Pre-flight: detect tracked content deleted in the worktree but present in HEAD,
//    auto-restore it from HEAD before archiving. Without this, the archive captures
//    empty scaffolds and the reconcile pass has nothing real to fold.
// 2. Post-flight: write MANIFEST.json into the archive recording each moved path with
//    its detected role (memory_extended, session_extended, dev_standards, root_doc,
//    registry, automemory_seed, etc) and the old project-name prefix. The reconcile
//    pass and migrate-import read it instead of re-deriving from filenames.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { flag, validName } from "./args.mjs";
import { buildGitignore } from "./gitignore.mjs";
import { installLog } from "./installLog.mjs";
import { fromHomeRef, repoRoot } from "./paths.mjs";

// Known 321-shape paths moved aside (relative to the root). The engine scripts
// (tools), the router, and ENV stay in place. Auto-memory is archived too - its
// project copy (a filled profile, an edited or custom rule) would otherwise be lost
// to the reinstall overwrite, so it moves aside for the reconcile merge. The skill
// bodies (SKILL) are snapshotted separately below. README and source are never touched.
const KNOWN = ["AGENTS.md", "CLAUDE.md", "CHANGELOG.md", ".gitignore", "AIDOCS/_index.json", "AIDOCS/automemory", "WDDOCS"];

// Paths the pre-flight will auto-restore from HEAD if git reports them deleted in the
// worktree. Restricted to the migration's known surface so an unrelated worktree
// deletion (the user staged a code-file removal) is left alone.
function isMigrationRelevant(relPath) {
  if (relPath === "AGENTS.md" || relPath === "CLAUDE.md" || relPath === "CHANGELOG.md" || relPath === ".gitignore") return true;
  if (relPath.startsWith("AIDOCS/") || relPath.startsWith("WDDOCS/")) return true;
  return false;
}

// Detect tracked content the user deleted in the worktree but still present in HEAD,
// and auto-restore it before the archive runs. Without this, migrate-archive's
// `if (!existsSync(src)) continue` silently skips the deleted content and the
// reconcile pass folds an empty scaffold. Auto-restore is the documented contract -
// the reconcile is downstream and cannot recover content the archive never saw.
// No-op when git is unavailable or the cwd is not a repo.
function preflightRestoreDeleted(root) {
  let out;
  try {
    out = execFileSync("git", ["ls-files", "--deleted"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return [];   // not a git repo, or git not on PATH
  }
  if (!out) return [];
  const relevant = out.split("\n").filter(Boolean).filter(isMigrationRelevant);
  if (relevant.length === 0) return [];
  try {
    execFileSync("git", ["restore", "--source=HEAD", "--", ...relevant], { cwd: root });
  } catch (e) {
    console.warn(`migrate-archive: pre-flight tried to restore ${relevant.length} deleted file(s) from HEAD but git restore failed (${e.message}). Continuing - the archive may capture less content than HEAD held.`);
    return [];
  }
  return relevant;
}

// Classify a moved path so the manifest carries its role. The reconcile pass uses this
// to find the right archive source per skill / per config doc, instead of re-deriving
// from filenames (which fails on legacy naming variants like SESSION_HANDOFF). Returns
// { role, old_prefix?, legacy_naming? }. Accepts both POSIX and Windows separators.
function classifyMove(relRaw) {
  const rel = relRaw.replace(/\\/g, "/");   // normalize Windows backslashes before pattern match
  if (rel === "AGENTS.md" || rel === "CLAUDE.md" || rel === "CHANGELOG.md") return { role: "root_doc" };
  if (rel === ".gitignore") return { role: "gitignore" };
  if (rel === "AIDOCS/_index.json") return { role: "registry" };
  if (rel === "AIDOCS/automemory" || rel.startsWith("AIDOCS/automemory/")) return { role: "automemory_seed" };
  if (rel === "WDDOCS" || rel.startsWith("WDDOCS/")) return { role: "wddocs" };
  if (rel.startsWith("AIDOCS/") && rel.endsWith(".md")) {
    const base = rel.slice("AIDOCS/".length, -3);
    const checks = [
      [/^(.+?)_(MEMORY)(_EXTENDED)?$/, (m) => ({ role: `memory${m[3] ? "_extended" : ""}`, old_prefix: m[1] })],
      [/^(.+?)_(SESSION)(_EXTENDED)?$/, (m) => ({ role: `session${m[3] ? "_extended" : ""}`, old_prefix: m[1] })],
      [/^(.+?)_BACKLOG$/, (m) => ({ role: "backlog", old_prefix: m[1] })],
      [/^(.+?)_DEV-AUDIT$/, (m) => ({ role: "dev_audit", old_prefix: m[1] })],
      [/^(.+?)_AUTO-PUSH$/, (m) => ({ role: "auto_push", old_prefix: m[1] })],
      // Legacy naming variants the pre-engine projects used:
      [/^(.+?)_SESSION_HANDOFF(_EXTENDED)?$/, (m) => ({ role: `session${m[2] ? "_extended" : ""}`, old_prefix: m[1], legacy_naming: "SESSION_HANDOFF" })],
      [/^(.+?)_DEV_STANDARDS$/, (m) => ({ role: "dev_standards", old_prefix: m[1], legacy_naming: "DEV_STANDARDS" })],
    ];
    for (const [re, build] of checks) {
      const m = base.match(re);
      if (m) return build(m);
    }
  }
  return { role: "other" };
}

export function cmdMigrateArchive(args) {
  const name = flag(args, "--name");
  if (!validName(name)) { console.error("migrate-archive needs --name <PROJECT> (letter or digit, then letters / digits / _ / - only)"); process.exit(5); }
  const root = repoRoot();
  const archive = join(root, "AIDOCS", `${name}_SETUP_ARCHIVE`);

  // Pre-flight: restore deleted-in-worktree content from HEAD so the archive captures
  // it. Loud-warn the user since they may not have realized the content was deleted in
  // the worktree but still tracked in HEAD - a common state after a manual cleanup that
  // leaned on git to hold the recovery copy.
  const restored = preflightRestoreDeleted(root);
  if (restored.length > 0) {
    console.warn(`migrate-archive: pre-flight restored ${restored.length} tracked file(s) deleted from the worktree (still in HEAD), so the archive captures the real content:`);
    for (const f of restored) console.warn(`  + ${f}`);
  }

  // Read the registry before the move loop carries _index.json into the archive: the
  // external memory path (auto_memory.path, the runtime source of truth) so the project's
  // live rules can be snapshotted below, and the privacy mode so the .gitignore re-lay
  // below matches it. Empty / unset (a pre-rebuild or path-less project) means nothing to
  // grab, and privacy defaults to the safe "private".
  let externalDir = null, privacy = "private";
  try {
    const idx = JSON.parse(readFileSync(join(root, "AIDOCS", "_index.json"), "utf8"));
    if (idx.privacy) privacy = idx.privacy;
    const ref = idx.auto_memory?.path;
    if (ref) { const ext = fromHomeRef(ref); if (existsSync(ext)) externalDir = ext; }
  } catch { /* no registry - default privacy, nothing to snapshot */ }

  const movedEntries = [];   // { path, role, old_prefix?, legacy_naming? } - feeds MANIFEST.json

  for (const rel of KNOWN) {
    const src = join(root, rel);
    if (!existsSync(src)) continue;
    const dst = join(archive, rel);
    if (existsSync(dst)) continue;   // already archived - keep the first copy (idempotent re-run)
    mkdirSync(dirname(dst), { recursive: true });
    renameSync(src, dst);
    movedEntries.push({ path: rel, ...classifyMove(rel) });
  }

  // Re-lay a canonical .gitignore the instant the old one is archived, so the project is
  // never left bare between here and the reinstall's init - a window that spans the
  // discovery sweep and a network engine fetch, where a concurrent `git add` would stage
  // ignored content (node_modules, TEMP, secrets). The reinstall's init is write-if-missing
  // so it preserves this file, and migrate-restore union-merges the archived custom lines
  // back. Every privacy mode's Tier C ignores are identical, so the gate holds either way.
  const giRoot = join(root, ".gitignore");
  let gitignoreRelaid = false;
  if (!existsSync(giRoot)) { writeFileSync(giRoot, buildGitignore(privacy), "utf8"); gitignoreRelaid = true; }

  // The project's data docs (AIDOCS/*_*.md - memory / session / backlog / audit and
  // their extendeds, whatever the prefix) and the legacy auto-prune archive dirs the old
  // engine left behind (<NAME>_MEMORY_ARCHIVE / _SESSION_ARCHIVE / _BACKLOG_ARCHIVE, which
  // are directories, not .md files). The current SETUP_ARCHIVE is the destination, so its
  // _SETUP_ARCHIVE suffix is deliberately outside the match.
  const aidocs = join(root, "AIDOCS");
  if (existsSync(aidocs)) {
    for (const f of readdirSync(aidocs)) {
      const p = join(aidocs, f);
      const st = statSync(p);
      const isDataDoc = /_.+\.md$/.test(f) && st.isFile();
      const isLegacyArchiveDir = /_(MEMORY|SESSION|BACKLOG)_ARCHIVE$/.test(f) && st.isDirectory();
      if (!isDataDoc && !isLegacyArchiveDir) continue;
      const dst = join(archive, "AIDOCS", f);
      if (existsSync(dst)) continue;   // already archived - keep the first copy
      mkdirSync(join(archive, "AIDOCS"), { recursive: true });
      renameSync(p, dst);
      const relForward = `AIDOCS/${f}`;   // POSIX-style in manifest, portable across platforms
      movedEntries.push({ path: relForward, ...classifyMove(relForward) });
    }
  }

  // The skill bodies are engine - init re-lays them canonical - but a legacy project may
  // have customized one in place (the pre-data-doc model, before project specifics moved
  // into data docs like AUTO-PUSH). Snapshot them (copy, not move: the live tree keeps
  // them for init to overwrite) so the reconcile pass can diff each against canonical and
  // fold any divergence into the right data doc, instead of losing it to the overwrite.
  let skillSnapshot = false;
  const skillSrc = join(root, "AIDOCS", "SKILL");
  const skillDst = join(archive, "AIDOCS", "SKILL");
  if (existsSync(skillSrc) && !existsSync(skillDst)) { cpSync(skillSrc, skillDst, { recursive: true }); skillSnapshot = true; }

  // Legacy AIDOCS/SKILLS/ (plural) is the pre-engine name for what is now AIDOCS/SKILL/
  // (singular). A project that predates the rename carries the plural dir, and migrate
  // must sweep it - otherwise the reinstall lays canonical SKILL/ alongside the stale
  // SKILLS/, doctor warns, and the AI has to improvise. Rename to SKILLS_legacy/ inside
  // the archive so it sits distinct from the canonical SKILL/ snapshot above.
  let legacySkillsMoved = false;
  const legacySkillsSrc = join(root, "AIDOCS", "SKILLS");
  const legacySkillsDst = join(archive, "AIDOCS", "SKILLS_legacy");
  if (existsSync(legacySkillsSrc) && !existsSync(legacySkillsDst)) {
    mkdirSync(dirname(legacySkillsDst), { recursive: true });
    renameSync(legacySkillsSrc, legacySkillsDst);
    legacySkillsMoved = true;
    movedEntries.push({ path: "AIDOCS/SKILLS", role: "legacy_skills" });
  }

  // Snapshot the external Claude memory (the runtime source of truth) into the archive so
  // the reconcile merge can weigh the project's real rules + profile. Copy, not move - it
  // is Claude Code's live global state: read it, never delete it.
  let externalSnapshot = false;
  if (externalDir) {
    const dst = join(archive, "external-automemory");
    if (!existsSync(dst)) { cpSync(externalDir, dst, { recursive: true }); externalSnapshot = true; }
  }

  // Write MANIFEST.json describing what moved, with detected roles + old prefix +
  // legacy-naming flags. The reconcile pass and migrate-import read this instead of
  // re-deriving from filenames, removing the AI's guesswork for legacy naming variants.
  // Idempotent: a re-run with an existing manifest keeps the first one (so the same
  // detection result survives a partial-run resume) and appends nothing.
  const manifestPath = join(archive, "MANIFEST.json");
  if (!existsSync(manifestPath) && movedEntries.length > 0) {
    // Detect the source project name from the data-doc prefixes. Prefer a prefix that
    // differs from the target `name` (the renamed-migration case), so a project moving
    // from WD_OLDPROJ to MfProj records WD_OLDPROJ as source, not MfProj. Fall back to
    // the most common prefix (the same-name re-install case) when no non-target prefix
    // exists. Ties go to the first encountered prefix.
    const counts = {};
    for (const e of movedEntries) { if (e.old_prefix) counts[e.old_prefix] = (counts[e.old_prefix] || 0) + 1; }
    let sourceProjectName = null, maxCount = 0;
    for (const [prefix, count] of Object.entries(counts)) {
      if (prefix !== name && count > maxCount) { sourceProjectName = prefix; maxCount = count; }
    }
    if (!sourceProjectName) {
      for (const [prefix, count] of Object.entries(counts)) {
        if (count > maxCount) { sourceProjectName = prefix; maxCount = count; }
      }
    }
    const manifest = {
      schema_version: 1,
      target_project_name: name,
      source_project_name: sourceProjectName,
      moved: movedEntries,
      skill_snapshot: skillSnapshot,
      legacy_skills_moved: legacySkillsMoved,
      external_snapshot: externalSnapshot,
      gitignore_relaid: gitignoreRelaid,
      preflight_restored: restored,
    };
    mkdirSync(archive, { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  const moved = movedEntries.length;
  const tail = `${skillSnapshot ? " + snapshotted AIDOCS/SKILL" : ""}${legacySkillsMoved ? " + swept legacy AIDOCS/SKILLS plural" : ""}${externalSnapshot ? " + captured external memory" : ""}`;
  console.log(`migrate-archive: moved ${moved} path(s)${tail} into ${archive} (move, not delete - the recovery net).`);
  if (gitignoreRelaid) console.log("migrate-archive: re-laid a canonical .gitignore at the project root (closes the no-ignore window before reinstall).");
  installLog(root, `migrate-archive: moved ${moved} path(s)${tail} into AIDOCS/${name}_SETUP_ARCHIVE${gitignoreRelaid ? ", re-laid root .gitignore" : ""}${restored.length > 0 ? `, pre-flight restored ${restored.length} deleted file(s) from HEAD` : ""}.`);
}
