// fetchEngine.mjs - fetch a 321 engine source into INSTALL/engine so an engine
// update or re-setup can run the latest tier without the steady project carrying
// it. git clone for a remote source, or copy a local tree (the offline / test
// path, excluding INSTALL / .git / TEMP / node_modules so it never recurses).
// Backs the `fetch-engine` CLI command (command names stay kebab-case).

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { flag } from "./args.mjs";
import { installEngineDir, repoRoot } from "./paths.mjs";

// Only what an engine command reads from the fetched tree travels. test/ is excluded
// because the suite runs from the source repo, WDDOCS because the user's docs are never
// templated (init lays the folders itself), and the machine-local MCP config because a
// fetch is not the place for it. Each would transit into INSTALL/engine just to have
// cleanup delete it.
const EXCLUDE = new Set(["INSTALL", ".git", "TEMP", "node_modules", "test", "WDDOCS", ".mcp.json"]);

export function cmdFetchEngine(args) {
  const from = flag(args, "--from");
  let repo = flag(args, "--repo");
  const ref = flag(args, "--ref") || "main";
  // Default --repo from engine.upstream when neither --from nor --repo was passed: the
  // registry already records the install source, asking the runbook to repeat it is a
  // foot-gun (the AI has to remember a URL the project already knows). An explicit flag
  // still wins for forks or test runs.
  if (!from && !repo) {
    try {
      const idxPath = join(repoRoot(), "AIDOCS", "_index.json");
      if (existsSync(idxPath)) {
        const up = JSON.parse(readFileSync(idxPath, "utf8")).engine?.upstream;
        if (up) { repo = up; console.log(`fetch-engine: defaulting --repo to engine.upstream (${repo}).`); }
      }
    } catch { /* malformed registry - the missing-args error below still fires */ }
  }
  const dest = installEngineDir();
  // graduate removes INSTALL/ entirely, so a post-graduation -UpdateSync has no
  // parent for INSTALL/engine. Recreate it (no-op when INSTALL/ already exists).
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });

  if (from) {
    const src = resolve(from);
    cpSync(src, dest, {
      recursive: true,
      filter: (p) => { const r = relative(src, p); return r === "" || !EXCLUDE.has(r.split(/[\\/]/)[0]); },
    });
    console.log(`fetch-engine: copied ${src} -> ${dest}`);
    return;
  }
  if (!repo) { console.error("fetch-engine needs --from <dir> or --repo <url>"); process.exit(5); }
  // A value that begins with "-" would read as a git option (an --upload-pack=<command>
  // runs it), and engine.upstream is registry data, so refuse the shape and end the option
  // list before the URL.
  if (repo.startsWith("-") || ref.startsWith("-")) { console.error("fetch-engine: --repo and --ref must not begin with '-'"); process.exit(5); }
  try {
    execFileSync("git", ["clone", "--depth", "1", "--branch", ref, "--quiet", "--", repo, dest], { stdio: ["ignore", "pipe", "ignore"] });
    console.log(`fetch-engine: cloned ${repo}@${ref} -> ${dest}`);
  } catch (e) {
    console.error(`fetch-engine: clone failed (offline?): ${e.message}`);
    process.exit(21);
  }
}
