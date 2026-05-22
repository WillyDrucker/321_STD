// installFetch.mjs - (re)create the ephemeral INSTALL/engine from a 321_STD
// source. Steady-tier: -Sync and re-setup call this to pull the onboarding tier
// back on demand without the project carrying it permanently. Shells out to git
// for a shallow clone, or copies a local source tree (offline / test path).
//
// Returns { ok: true, mode } on success, { ok: false, reason } on failure so the
// caller decides whether to proceed on the local engine (the offline backstop).

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// Top-level names never copied in local mode: the ephemeral root itself (which
// would recurse), version control, scratch, and installed deps.
const LOCAL_EXCLUDE = new Set(["INSTALL", ".git", "TEMP", "node_modules"]);

export async function fetchEngine({ repo, ref = "main", dest, from }) {
  const target = resolve(dest);
  if (existsSync(target)) await rm(target, { recursive: true, force: true });

  if (from) {
    const src = resolve(from);
    await cp(src, target, {
      recursive: true,
      filter: (p) => {
        const rel = relative(src, p);
        return rel === "" || !LOCAL_EXCLUDE.has(rel.split(/[\\/]/)[0]);
      },
    });
    return { ok: true, mode: "local" };
  }

  if (!repo) return { ok: false, reason: "no --repo or --from source given" };
  try {
    await run("git", ["clone", "--depth", "1", "--branch", ref, "--quiet", repo, target]);
    return { ok: true, mode: "git" };
  } catch (e) {
    return { ok: false, reason: `git clone failed (offline?): ${e.message}` };
  }
}
