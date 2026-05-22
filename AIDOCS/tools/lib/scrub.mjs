// scrub.mjs - the house-voice freshness gate. Reuses the prose linter: --check
// (default) reports banned characters across the authored files, or one --path.
// --fix mechanically rewrites em dashes to " - " and flags any semicolons for a
// human. Migration runs --fix on what it captured so the content lands in voice
// before the reconcile gate.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { flag } from "./args.mjs";
import { authoredTargets, fixEmDashes, scanBanned } from "./prose.mjs";

export function cmdScrub(index, args) {
  const fix = args.includes("--fix");
  const one = flag(args, "--path");
  if (one && !existsSync(one)) { console.error(`scrub: file not found: ${one}`); process.exit(5); }
  const files = one ? [one] : authoredTargets(index);

  let rewrote = 0;
  const flags = [];
  for (const abs of files) {
    const name = abs.split(/[\\/]/).pop();
    let content = readFileSync(abs, "utf8");
    if (fix) {
      const res = fixEmDashes(content);
      if (res.count) { content = res.content; writeFileSync(abs, content, "utf8"); rewrote += res.count; }
    }
    for (const v of scanBanned(content)) flags.push({ name, ...v });
  }

  if (fix && rewrote) console.log(`scrub: rewrote ${rewrote} em dash(es) to " - ".`);
  if (flags.length === 0) { console.log(`scrub: ${fix ? "clean after fix" : "clean"}.`); return; }
  console.log(`scrub: ${flags.length} item(s) ${fix ? "need a human (semicolons are not auto-removed)" : "found"}:`);
  for (const f of flags) console.log(`  - ${f.name}:${f.line} ${f.kind}`);
  process.exit(20);
}
