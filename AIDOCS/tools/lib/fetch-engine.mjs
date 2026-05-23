// fetch-engine.mjs - fetch a 321 engine source into INSTALL/engine so an engine
// update or re-setup can run the latest tier without the steady project carrying
// it. git clone for a remote source, or copy a local tree (the offline / test
// path, excluding INSTALL / .git / TEMP / node_modules so it never recurses).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { cp } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { flag } from "./args.mjs";
import { installEngineDir } from "./paths.mjs";

const EXCLUDE = new Set(["INSTALL", ".git", "TEMP", "node_modules"]);

export async function cmdFetchEngine(args) {
  const from = flag(args, "--from");
  const repo = flag(args, "--repo");
  const ref = flag(args, "--ref") || "main";
  const dest = installEngineDir();
  // graduate removes INSTALL/ entirely, so a post-graduation -Update -Sync has no
  // parent for INSTALL/engine. Recreate it (no-op when INSTALL/ already exists).
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });

  if (from) {
    const src = resolve(from);
    await cp(src, dest, {
      recursive: true,
      filter: (p) => { const r = relative(src, p); return r === "" || !EXCLUDE.has(r.split(/[\\/]/)[0]); },
    });
    console.log(`fetch-engine: copied ${src} -> ${dest}`);
    return;
  }
  if (!repo) { console.error("fetch-engine needs --from <dir> or --repo <url>"); process.exit(5); }
  try {
    execFileSync("git", ["clone", "--depth", "1", "--branch", ref, "--quiet", repo, dest], { stdio: ["ignore", "pipe", "ignore"] });
    console.log(`fetch-engine: cloned ${repo}@${ref} -> ${dest}`);
  } catch (e) {
    console.error(`fetch-engine: clone failed (offline?): ${e.message}`);
    process.exit(21);
  }
}
