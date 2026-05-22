// migrate-restore.mjs - the deterministic restore lane, the mirror of
// migrate-archive. After init relays a clean structure, this layers the project's
// own content back from AIDOCS/<NAME>_SETUP_ARCHIVE/: user docs (WDDOCS) verbatim,
// and a union-merge of the archived .gitignore into the canonical one so custom
// ignores are never dropped. The knowledge files (MEMORY / SESSION / Big-6) are
// not restored here - they are captured and distilled through -Update instead.
// ENV is left in place by migrate-archive, so there is nothing to restore.

import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { installLog } from "./installLog.mjs";
import { repoRoot } from "./paths.mjs";

// Keep every canonical line, append the archived lines the canonical set does not
// already have (under a header). Returns null when there is nothing new to add.
function mergeGitignore(canonical, archived, name) {
  const have = new Set(canonical.split("\n").map((l) => l.trim()));
  const add = archived.split("\n").filter((l) => l.trim() && !have.has(l.trim()));
  if (add.length === 0) return null;
  return `${canonical.replace(/\n*$/, "")}\n\n# preserved from ${name} (pre-migration)\n${add.join("\n")}\n`;
}

export function cmdMigrateRestore(args) {
  const name = args[args.indexOf("--name") + 1];
  if (!name || name.startsWith("--")) { console.error("migrate-restore needs --name <PROJECT>"); process.exit(5); }
  const root = repoRoot();
  const archive = join(root, "AIDOCS", `${name}_SETUP_ARCHIVE`);
  if (!existsSync(archive)) { console.error(`migrate-restore: no archive at ${archive}`); process.exit(5); }

  const done = [];

  // WDDOCS verbatim (user-owned). cpSync overlays the stock scaffold init laid.
  const wddocsSrc = join(archive, "WDDOCS");
  if (existsSync(wddocsSrc)) { cpSync(wddocsSrc, join(root, "WDDOCS"), { recursive: true }); done.push("WDDOCS"); }

  // .gitignore union merge - canonical plus the project's unique lines, nothing dropped.
  const giArchived = join(archive, ".gitignore");
  const giRoot = join(root, ".gitignore");
  if (existsSync(giArchived) && existsSync(giRoot)) {
    const merged = mergeGitignore(readFileSync(giRoot, "utf8"), readFileSync(giArchived, "utf8"), name);
    if (merged) { writeFileSync(giRoot, merged, "utf8"); done.push(".gitignore (merged)"); }
    else done.push(".gitignore (no new lines)");
  }

  console.log(`migrate-restore: restored ${done.length ? done.join(", ") : "nothing"} from ${archive}.`);
  console.log("  knowledge files (MEMORY / SESSION / Big-6) are captured via /321 -Update, not restored here.");
  installLog(root, `migrate-restore: restored ${done.length ? done.join(", ") : "nothing"} from AIDOCS/${name}_SETUP_ARCHIVE.`);
}
