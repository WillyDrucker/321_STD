// syncBacklogIssue.mjs - mirrors <PROJECT>_BACKLOG.md into a tracker issue.
//
// OPT-IN. With no integrations.backlog_issue in _index.json this is a clean no-op, so a
// project with no tracker workflow never has to think about it. The engine never invents
// an issue number - a wrong one would publish the backlog into somebody else's thread.
//
// TARGETING IS EXPLICIT. `gh` resolves the repo from its working directory, and the engine
// can be driven at another project with --root, so this runs gh with cwd = repoRoot() and
// passes --repo when the project declares one. Without that, a --root run from one checkout
// would edit the issue belonging to the CALLER's repo. That is the "somebody else's thread"
// failure the opt-in was supposed to prevent.
//
// The file is the source of truth and the issue is a copy, so this REGENERATES the body
// wholesale rather than diffing or appending. LIFO ordering is already the file's shape,
// so mirroring inherits it and there is no merge logic to drift.
//
// Fails SOFT. A missing or unauthenticated gh must never break the commit pipeline that
// just persisted the real artifact. Warn, exit 0.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readRegisteredFile, repoRoot } from "./paths.mjs";

const PURPOSE = (project) => `**Purpose:** Long-term forward-looking direction only - items ${project} may pursue eventually, not immediate items marked for review. **Not a dumping ground.** Follow-ups, cross-track flags, and the next step of in-flight work do NOT belong here, those live in the SESSION track. A task is not a BACKLOG item just because it is not done yet. It is a BACKLOG item only when it is a "don't forget this at some point" rather than a "store these here for now".

**Entries are added ONLY by the Update process** (\`/321 -Update\` / \`-UpdateMemory\`), never ad-hoc mid-task. This issue is a **generated mirror** of the project's BACKLOG file, which is the source of truth. Do not hand-edit this body - the next Update run overwrites it. To change an entry, change the file.

Both sections are LIFO, newest on top.`;

const warn = (m) => console.warn(`sync-backlog: ${m}`);

// Everything from the first "## " heading onward. The file's own Purpose header is
// replaced by the issue's, which says the things only the issue needs to say.
function sectionsOf(md) {
  const start = md.indexOf("\n## ");
  return start === -1 ? "" : md.slice(start + 1).trimEnd();
}

// integrations.backlog_issue is either a bare number or { number, repo }. Anything else is
// a misconfiguration, and a misconfiguration must never reach `gh` - a truthy-but-wrong
// value (a string, an array, a negative) would target an arbitrary issue.
function resolveTarget(cfg) {
  if (cfg == null || cfg === false || cfg === "") return { off: true };
  const number = typeof cfg === "object" ? cfg.number : cfg;
  const repo = typeof cfg === "object" ? cfg.repo : undefined;
  if (!Number.isInteger(number) || number <= 0) {
    return { error: `integrations.backlog_issue must be a positive integer issue number (got ${JSON.stringify(cfg)})` };
  }
  if (repo !== undefined && (typeof repo !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(repo))) {
    return { error: `integrations.backlog_issue.repo must be "owner/name" (got ${JSON.stringify(repo)})` };
  }
  return { number, repo };
}

export function cmdSyncBacklog(index) {
  const target = resolveTarget(index.integrations?.backlog_issue);
  if (target.off) {
    console.log("sync-backlog: no integrations.backlog_issue in _index.json, mirror is off. Nothing to do.");
    return;
  }
  if (target.error) return warn(target.error);

  const md = readRegisteredFile(index, "updatememory.backlog");
  if (md == null) return warn("no updatememory.backlog registered, nothing to mirror");

  const sections = sectionsOf(md);
  if (!sections) return warn("the BACKLOG file has no ## sections, refusing to publish an empty body");

  const body = `${PURPOSE(index.project_name || "the project")}\n\n---\n\n${sections}\n`;
  // A private temp DIR, not a shared filename. Two projects mirroring the same issue number
  // would otherwise race on one path and unlink each other's body mid-write.
  const dir = mkdtempSync(join(tmpdir(), "321-backlog-"));
  const tmp = join(dir, "body.md");
  const args = ["issue", "edit", String(target.number), "--body-file", tmp];
  if (target.repo) args.push("--repo", target.repo);

  try {
    writeFileSync(tmp, body, "utf8");
    // cwd is the PROJECT, not wherever the engine was invoked from.
    execFileSync("gh", args, { stdio: "pipe", cwd: repoRoot() });
    console.log(`sync-backlog: mirrored BACKLOG -> issue #${target.number}${target.repo ? ` in ${target.repo}` : ""}`);
  } catch (err) {
    warn(`could not update issue #${target.number} (${err.message.split("\n")[0]})`);
    warn("the BACKLOG file is committed and correct. Re-run `sync-backlog` to retry the mirror.");
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
