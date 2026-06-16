// scrub.mjs - the house-voice freshness gate. Reuses the prose linter: --check
// (default) reports banned characters across the authored files, or one --path.
// --fix rewrites em dashes to " - ". Add --semicolons to also rewrite a clause-
// joining "; " to " - ", leaving non-joining semicolons flagged. scrub is the
// sanctioned tool for a voice-only fix to any authored file, SESSION / MEMORY
// included - it changes voice, not captured content. Migration runs --fix at capture.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute } from "node:path";

import { flag } from "./args.mjs";
import { fromRoot } from "./paths.mjs";
import { authoredTargets, fixEmDashes, fixSemicolons, scanBanned } from "./prose.mjs";

export function cmdScrub(index, args) {
  const fix = args.includes("--fix");
  const semicolons = args.includes("--semicolons");
  // Resolve a relative --path against the active root (the same root every other command
  // honors), so a --root-driven run scrubs the target's file, not a same-named file under
  // the caller's cwd. An absolute --path is used verbatim.
  const oneRaw = flag(args, "--path");
  const one = oneRaw ? (isAbsolute(oneRaw) ? oneRaw : fromRoot(oneRaw)) : null;
  if (one && !existsSync(one)) { console.error(`scrub: file not found: ${one}`); process.exit(5); }
  const files = one ? [one] : authoredTargets(index);

  let rewroteEm = 0, rewroteSemi = 0;
  const flags = [];
  for (const abs of files) {
    const name = abs.split(/[\\/]/).pop();
    let content = readFileSync(abs, "utf8");
    if (fix) {
      let changed = false;
      const em = fixEmDashes(content);
      if (em.count) { content = em.content; rewroteEm += em.count; changed = true; }
      if (semicolons) {
        const semi = fixSemicolons(content);
        if (semi.count) { content = semi.content; rewroteSemi += semi.count; changed = true; }
      }
      if (changed) writeFileSync(abs, content, "utf8");
    }
    for (const v of scanBanned(content)) flags.push({ name, ...v });
  }

  if (fix && rewroteEm) console.log(`scrub: rewrote ${rewroteEm} em dash(es) to " - ".`);
  if (fix && rewroteSemi) console.log(`scrub: rewrote ${rewroteSemi} clause-joining semicolon(s) to " - ".`);
  if (flags.length === 0) { console.log(`scrub: ${fix ? "clean after fix" : "clean"}.`); return; }
  const hint = semicolons
    ? "non-joining semicolons or em dashes in code, by hand"
    : "semicolons - re-run with --semicolons to rewrite clause-joining ones";
  console.log(`scrub: ${flags.length} item(s) ${fix ? `need a human (${hint})` : "found"}:`);
  for (const f of flags) console.log(`  - ${f.name}:${f.line} ${f.kind}`);
  process.exit(20);
}
