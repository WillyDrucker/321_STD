// fetch-engine.mjs - fetch a 321 engine source into INSTALL/engine so an engine
// update or re-setup can run the latest tier without the steady project carrying
// it. git clone for a remote source, or copy a local tree (the offline / test
// path, excluding INSTALL / .git / TEMP / node_modules so it never recurses).

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { cp } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { installEngineDir } from "./paths.mjs";

const EXCLUDE = new Set(["INSTALL", ".git", "TEMP", "node_modules"]);

function flag(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }

export async function cmdFetchEngine(args) {
  const from = flag(args, "--from");
  const repo = flag(args, "--repo");
  const ref = flag(args, "--ref") || "main";
  const dest = installEngineDir();
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
