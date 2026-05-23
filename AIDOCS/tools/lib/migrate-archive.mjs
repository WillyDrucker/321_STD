// migrate-archive.mjs - the deterministic A backstop for migration: move a
// project's existing 321-shape content aside into AIDOCS/<NAME>_SETUP_ARCHIVE/ so
// init can lay a clean structure on top. Move, never delete - the archive is the
// recovery net. Operates on the active root (--root). Known-shape paths only - the
// AI discovery sweep (verdict.mjs) covers the rest, routing into the same archive.
// Idempotent, so the sweep can lean on it as needed: it skips what is already
// moved, making re-runs safe.

import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { flag, validName } from "./args.mjs";
import { installLog } from "./installLog.mjs";
import { repoRoot } from "./paths.mjs";

// Known 321-shape paths moved aside (relative to the root). The engine scripts
// (tools), the router, and ENV stay in place. Auto-memory is archived too - its
// project copy (a filled profile, an edited or custom rule) would otherwise be lost
// to the reinstall overwrite, so it moves aside for the reconcile merge. The skill
// bodies (SKILL) are snapshotted separately below. README and source are never touched.
const KNOWN = ["AGENTS.md", "CLAUDE.md", "CHANGELOG.md", ".gitignore", "AIDOCS/_index.json", "AIDOCS/automemory", "WDDOCS"];

export function cmdMigrateArchive(args) {
  const name = flag(args, "--name");
  if (!validName(name)) { console.error("migrate-archive needs --name <PROJECT> (letter, then letters / digits / _ / - only)"); process.exit(5); }
  const root = repoRoot();
  const archive = join(root, "AIDOCS", `${name}_SETUP_ARCHIVE`);
  let moved = 0;

  for (const rel of KNOWN) {
    const src = join(root, rel);
    if (!existsSync(src)) continue;
    const dst = join(archive, rel);
    if (existsSync(dst)) continue;   // already archived - keep the first copy (idempotent re-run)
    mkdirSync(dirname(dst), { recursive: true });
    renameSync(src, dst);
    moved++;
  }

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
      moved++;
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

  const tail = skillSnapshot ? " + snapshotted AIDOCS/SKILL" : "";
  console.log(`migrate-archive: moved ${moved} path(s)${tail} into ${archive} (move, not delete - the recovery net).`);
  installLog(root, `migrate-archive: moved ${moved} path(s)${tail} into AIDOCS/${name}_SETUP_ARCHIVE.`);
}
