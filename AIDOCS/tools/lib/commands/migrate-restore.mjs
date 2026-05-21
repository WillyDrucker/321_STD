// migrate-restore.mjs - deterministic Step 7 restore for the /321 -Setup migration.
// Moves user-owned content back out of AIDOCS/<X>_SETUP_ARCHIVE/ into the freshly
// reinstalled project: WDDOCS/ verbatim, the *_ARCHIVE history dirs, and AIDOCS/ENV/
// (renaming <OLD>_ENV_* -> <X>_ENV_* on a project rename). MOVE, the archive shrinks
// as content returns. The judgment / network layers stay in the skill - .gitignore
// merge, DEV-AUDIT Project specifics, CHANGELOG voice, auto-memory refresh, AGENTS
// Hard Rules. Pre-index: globs the archive, does not read _index.json.

import { existsSync } from "node:fs";
import { mkdir, readdir, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

import { err, parseFlags } from "../cli.mjs";
import { escapeRegExp } from "../markdown.mjs";
import { REPO_ROOT } from "../paths.mjs";

export async function cmdMigrateRestore(args) {
  const opts = parseFlags(args, ["name", "old", "target"]);
  const positional = args.filter(a => !a.startsWith("--"));
  const root = resolve(opts.target || positional[0] || REPO_ROOT);
  if (!opts.name) { err("migrate-restore requires --name <X>."); process.exit(11); }
  const oldName = opts.old || opts.name;
  const archiveDir = join(root, "AIDOCS", `${opts.name}_SETUP_ARCHIVE`);
  if (!existsSync(archiveDir)) {
    err(`No archive at AIDOCS/${opts.name}_SETUP_ARCHIVE - run migrate-archive first.`);
    process.exit(16);
  }

  // Rename a basename's <OLD>_ prefix to <X>_, only when the project was renamed.
  const renameBase = oldName === opts.name
    ? null
    : (base) => base.replace(new RegExp(`^${escapeRegExp(oldName)}_`), `${opts.name}_`);

  let wddocs = 0, archives = 0, env = 0;

  // 1. WDDOCS verbatim.
  wddocs = await moveTreeBack(join(archiveDir, "WDDOCS"), join(root, "WDDOCS"), null);

  // 2. *_ARCHIVE history dirs (prefix-renamed).
  const archAidocs = join(archiveDir, "AIDOCS");
  if (existsSync(archAidocs)) {
    for (const e of await readdir(archAidocs, { withFileTypes: true })) {
      if (e.isDirectory() && /_(MEMORY|SESSION|BACKLOG)_ARCHIVE$/.test(e.name)) {
        const destName = renameBase ? renameBase(e.name) : e.name;
        archives += await moveTreeBack(join(archAidocs, e.name), join(root, "AIDOCS", destName), null);
      }
    }
  }

  // 3. ENV (rename <OLD>_ENV_* basenames, subdir categories preserved).
  env = await moveTreeBack(join(archiveDir, "AIDOCS", "ENV"), join(root, "AIDOCS", "ENV"), renameBase);

  console.log(`migrate-restore: ${wddocs + archives + env} file(s) restored from AIDOCS/${opts.name}_SETUP_ARCHIVE/.`);
  console.log(`  WDDOCS: ${wddocs}, history archives: ${archives}, ENV: ${env}${renameBase ? " (ENV prefixes renamed)" : ""}.`);
  console.log(`  Still manual (judgment / network, stay in the skill): .gitignore merge, DEV-AUDIT Project specifics, CHANGELOG voice, auto-memory refresh, AGENTS Hard Rules.`);
}

// Move every file under srcDir into destDir, preserving sub-structure. renameBase
// (or null) rewrites each file's basename. destDir is constructed within the project
// root and renameBase only touches basenames, so no traversal is possible. Returns
// the count moved.
async function moveTreeBack(srcDir, destDir, renameBase) {
  if (!existsSync(srcDir)) return 0;
  let n = 0;
  async function walk(absSrc, absDest) {
    for (const e of await readdir(absSrc, { withFileTypes: true })) {
      if (e.isDirectory()) {
        await walk(join(absSrc, e.name), join(absDest, e.name));
      } else if (e.isFile()) {
        await mkdir(absDest, { recursive: true });
        await rename(join(absSrc, e.name), join(absDest, renameBase ? renameBase(e.name) : e.name));
        n++;
      }
    }
  }
  await walk(srcDir, destDir);
  return n;
}
