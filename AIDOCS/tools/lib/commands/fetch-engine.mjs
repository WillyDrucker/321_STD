// fetch-engine.mjs - (re)create INSTALL/engine from a 321_STD source. Steady
// command: -Sync and re-setup use it to pull the onboarding tier on demand.
// Pre-index (does not read _index.json). Defaults the destination to
// INSTALL/engine under the project root.

import { err, parseFlags } from "../cli.mjs";
import { fetchEngine } from "../installFetch.mjs";
import { INSTALL_ENGINE_DIR, ORIGIN_REF, ORIGIN_REPO } from "../paths.mjs";

export async function cmdFetchEngine(args) {
  const opts = parseFlags(args, ["repo", "ref", "from", "dest"]);
  const dest = opts.dest || INSTALL_ENGINE_DIR;
  // Default to the canonical upstream when no explicit source is given, so a
  // bare `fetch-engine` re-pulls the onboarding tier.
  const repo = opts.from ? undefined : (opts.repo || ORIGIN_REPO);
  const ref = opts.ref || ORIGIN_REF;
  const result = await fetchEngine({ repo, ref, from: opts.from, dest });
  if (!result.ok) {
    err(`fetch-engine: ${result.reason}. Offline backstop: continue on the local steady engine.`);
    process.exit(21);
  }
  console.log(`fetch-engine: ${result.mode} -> ${dest}`);
}
