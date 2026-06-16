// gitDrift.mjs - surface a committed-vs-working engine.version mismatch (an applied but
// uncommitted -UpdateSync is the common case). compare / doctor / upgrade read the
// working-tree registry, so without this the tree can read "current" while HEAD lags and
// the bumped files sit unstaged for the next -AutoPush to sweep into an unrelated commit.
// Pure information: the caller prints the string, this never acts or changes an exit code.
// Every uncertain case falls back to null (silent) - not a git repo, no HEAD, untracked
// _index.json, git absent - mirroring the try-git-then-skip posture in privacy.mjs.

import { execFileSync } from "node:child_process";

import { ENGINE_CLASS, repoRoot } from "./paths.mjs";

// Paths whose uncommitted count rides along with the version mismatch: the engine-class set
// the copy step refreshes, plus AIDOCS/_index.json (where engine.version itself lives).
const WATCHED_PATHS = [...ENGINE_CLASS, "AIDOCS/_index.json"];

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

// Committed engine.version from HEAD, or null if unreadable. The "HEAD:./path" form
// resolves the path relative to root, so it works whether root is the git top level
// or a subdir of a larger repo.
function committedEngineVersion(root) {
  try {
    return JSON.parse(git(root, ["show", "HEAD:./AIDOCS/_index.json"])).engine?.version ?? null;
  } catch {
    return null;
  }
}

// Count uncommitted (modified / added / deleted / untracked) engine-class files.
// Best-effort: a git failure returns 0 so the note still prints its version halves.
function dirtyEngineFileCount(root) {
  try {
    const out = git(root, ["status", "--porcelain", "--", ...WATCHED_PATHS]).trim();
    return out ? out.split("\n").length : 0;
  } catch {
    return 0;
  }
}

// One-line note when the committed engine.version differs from the working tree, else null.
// Direction-neutral: the common case is an applied-but-uncommitted upgrade, but a local
// revert or downgrade (tree behind HEAD) trips it too, so the wording says "mismatch" and
// "commit or revert" rather than asserting an upgrade. Reads the active root from paths.mjs.
export function engineDriftNote(index) {
  const tree = index?.engine?.version;
  if (!tree) return null;
  const root = repoRoot();
  const head = committedEngineVersion(root);
  if (head === null || head === tree) return null;
  const dirty = dirtyEngineFileCount(root);
  const pending = dirty > 0 ? `, ${dirty} engine file(s) uncommitted` : "";
  return `engine version mismatch: HEAD ${head}, tree ${tree}${pending}. Commit or revert the engine change on its own before -AutoPush folds it into an unrelated commit.`;
}
