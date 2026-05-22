// migrate-archive.mjs - the deterministic A backstop for migration: move a
// project's existing 321-shape content aside into AIDOCS/<NAME>_SETUP_ARCHIVE/ so
// init can lay a clean structure on top. Move, never delete - the archive is the
// recovery net. Operates on the active root (--root). Known-shape paths only - the
// AI discovery sweep (verdict.mjs) covers the rest, routing into the same archive.
// Idempotent, so the sweep can lean on it as needed: it skips what is already
// moved, making re-runs safe.

import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { installLog } from "./installLog.mjs";
import { repoRoot } from "./paths.mjs";

// Known 321-shape paths moved aside (relative to the root). Engine and
// auto-memory are left in place. README and source are never touched.
const KNOWN = ["AGENTS.md", "CLAUDE.md", "CHANGELOG.md", ".gitignore", "AIDOCS/_index.json", "WDDOCS"];

export function cmdMigrateArchive(args) {
  const name = args[args.indexOf("--name") + 1];
  if (!name || name.startsWith("--")) { console.error("migrate-archive needs --name <PROJECT>"); process.exit(5); }
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

  // The project's data docs: AIDOCS/*_*.md files (memory / session / backlog /
  // audit and their extendeds), whatever their project prefix.
  const aidocs = join(root, "AIDOCS");
  if (existsSync(aidocs)) {
    for (const f of readdirSync(aidocs)) {
      const p = join(aidocs, f);
      if (/_.+\.md$/.test(f) && statSync(p).isFile()) {
        const dst = join(archive, "AIDOCS", f);
        if (existsSync(dst)) continue;   // already archived - keep the first copy
        mkdirSync(join(archive, "AIDOCS"), { recursive: true });
        renameSync(p, dst);
        moved++;
      }
    }
  }

  console.log(`migrate-archive: moved ${moved} path(s) into ${archive} (move, not delete - the recovery net).`);
  installLog(root, `migrate-archive: moved ${moved} path(s) into AIDOCS/${name}_SETUP_ARCHIVE.`);
}
