// privacy.mjs - flip a project between public and private tracking, the runtime mirror
// of init's --privacy. Rewrites .gitignore (toggles the Tier B gate block, preserving
// custom ignores and the migrate-restore tail around it), records the mode in
// _index.json, and on a flip to public removes the now-ignored Tier B content from the
// git index so it stops being tracked. Read-only when invoked with no --set.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { flag } from "./args.mjs";
import { applyPrivacy, buildGitignore, hasPrivacyBlock, TIER_B_TRACKED } from "./gitignore.mjs";
import { installLog } from "./installLog.mjs";
import { indexPath, repoRoot } from "./paths.mjs";

export function cmdPrivacy(index, args) {
  const root = repoRoot();
  const giPath = join(root, ".gitignore");
  const set = flag(args, "--set");

  if (!set) {
    const mode = index.privacy || "(unset - defaults private)";
    const gate = existsSync(giPath) && hasPrivacyBlock(readFileSync(giPath, "utf8")) ? "present" : "absent";
    console.log(`privacy: ${mode}. .gitignore public gate: ${gate}.`);
    return;
  }

  if (!["public", "private"].includes(set)) {
    console.error('privacy --set <public | private>. ("full" is the 321_STD template repo - set it by hand.)');
    process.exit(5);
  }
  // "full" ships its memory + auto-memory as the product template, so its .gitignore is
  // hand-maintained. Refuse to regenerate it - flipping it would untrack the template.
  if (index.privacy === "full") {
    console.error('privacy: this project is "full" (the template repo). Its .gitignore is hand-maintained - refusing to regenerate.');
    process.exit(5);
  }

  const before = existsSync(giPath) ? readFileSync(giPath, "utf8") : "";
  const after = before.trim() ? applyPrivacy(before, set) : buildGitignore(set);
  writeFileSync(giPath, after, "utf8");

  if (set === "public") {
    // Keep the auto-memory dir in the published skeleton, then untrack the gated content.
    const am = join(root, "AIDOCS", "automemory");
    if (existsSync(am)) { mkdirSync(am, { recursive: true }); writeFileSync(join(am, ".gitkeep"), "", "utf8"); }
    untrack(root, TIER_B_TRACKED);
  }

  // Record the mode in the registry (re-serialized 2-space, key order preserved).
  index.privacy = set;
  writeFileSync(indexPath(), `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log(`privacy: set ${set}. .gitignore ${set === "public" ? "now gates" : "no longer gates"} memory / auto-memory / WDDOCS docs.`);
  if (set === "private") console.log("  these are now trackable - `git add` the ones you want committed.");
  installLog(root, `privacy: set ${set}.`);
}

// git rm --cached the Tier B paths so a flip to public stops tracking already-committed
// content (the working tree is kept). --ignore-unmatch makes it idempotent - nothing
// tracked yet is fine. A non-git environment is reported, not fatal: the .gitignore did
// its job, and anything added later is ignored from the start.
function untrack(root, patterns) {
  try {
    execFileSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], { stdio: "ignore" });
  } catch {
    console.log("  (not a git repo - .gitignore updated, nothing to untrack)");
    return;
  }
  for (const p of patterns) {
    try { execFileSync("git", ["-C", root, "rm", "-r", "--cached", "--ignore-unmatch", "--quiet", p], { stdio: "ignore" }); }
    catch { /* pattern matched nothing or git refused - skip */ }
  }
  console.log("  untracked the public-gated paths from the git index (working tree kept).");
}
