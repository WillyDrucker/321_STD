// origin.mjs - read or update the upstream pointer in _index.json. Steady-tier.
// `-Sync` writes engine_version here after a refresh so the next drift compare is
// against the new baseline. A version in a manifest is fine (like package.json).
//
//   origin                                  print the current pointer
//   origin --version <v> [--repo <r>] [--ref <f>]   update the named fields

import { writeFile } from "node:fs/promises";

import { err, parseFlags } from "../cli.mjs";
import { INDEX_PATH } from "../paths.mjs";

export async function cmdOrigin(index, args) {
  const opts = parseFlags(args, ["version", "repo", "ref"]);
  const current = index.origin || { repo: "", ref: "main", engine_version: "unknown" };

  const updating = opts.version !== undefined || opts.repo !== undefined || opts.ref !== undefined;
  if (!updating) {
    console.log(JSON.stringify(current, null, 2));
    return;
  }

  const next = {
    repo: opts.repo !== undefined ? opts.repo : current.repo,
    ref: opts.ref !== undefined ? opts.ref : current.ref,
    engine_version: opts.version !== undefined ? opts.version : current.engine_version,
  };
  index.origin = next;
  try {
    await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  } catch (e) {
    err(`origin: failed to write _index.json: ${e.message}`);
    process.exit(5);
  }
  console.log(`origin: updated -> ${next.engine_version} (${next.ref})`);
}
