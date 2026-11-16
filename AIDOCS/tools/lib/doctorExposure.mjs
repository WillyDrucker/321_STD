// doctorExposure.mjs - what the repository would publish, read from git rather than from the
// .gitignore text. An ignore rule never untracks a file added before it, and a new unignored
// file is one `git add -A` from a commit, so the scan covers the index plus the untracked
// files git would add, reading each working copy (what the release lane stages first).
// Errors (structural tier, a sync or a push must stop): a secret-shaped string, or a
// privacy-gated path that is tracked or unignored. Warnings: a user home path, which pins a
// doc to one machine. Silent when the project is not a repository.

import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { gitRead } from "./gitDrift.mjs";
import { repoRoot } from "./paths.mjs";

const MAX_BYTES = 512 * 1024;

// The shapes a leaked credential takes. Every prefix is followed by a class bracket in this
// source, so the scan never matches its own definitions. A vendor shape is exempt only when
// the match reads as a documented example. A shape whose prefix is an everyday syllable
// (sk-) also needs a non-word left boundary and both a digit and a capital in the match, so
// a kebab-case slug ending a word in sk never reads as a key. An assignment's value is
// exempt when it reads as a placeholder, so a tracked .env.example passes, and a real value
// that happens to carry a placeholder word or a dollar sign is accepted as the price of that.
const MIXED = true;
const VENDOR_SHAPES = [
  ["an AWS access key", /AKIA[0-9A-Z]{16}/],
  ["a GitHub token", /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/],
  ["a Slack token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ["an API key", /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}/, MIXED],
  ["a private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["a JWT", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
];
// The value is always the last capture group. The unquoted form is the shell and .env
// style: an upper-case name at the line start, a bare value with a letter and a digit.
const ASSIGNMENT_SHAPES = [
  ["a credential assignment", /\b(password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)[a-z_]*["']?\s*[:=]\s*["']([^"'\s]{8,})["']/i],
  ["an unquoted credential assignment", /^\s*(?:export\s+)?[A-Z][A-Z0-9_]*(?:PASS(?:WORD)?|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY)[A-Z0-9_]*\s*=\s*(?=[^\s"']*[0-9])(?=[^\s"']*[A-Za-z])([A-Za-z0-9_\-+/=.]{8,})\s*$/],
];
const EXAMPLE = /example/i;
const PLACEHOLDER = /your|xxx|example|change|placeholder|dummy|todo|redacted|[<>$*]|\.\.\./i;

// A user home path names the machine's owner and breaks on every other machine. A dotted
// folder right after home (a fixture's home/.claude) is a test tree, not a user.
const HOME_PATH = /[A-Za-z]:[\\/]+Users[\\/]+[A-Za-z0-9_-][A-Za-z0-9_.-]*|\/(?:Users|home)\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\//;

// What every privacy mode keeps local, then what the public gate adds. Mirrors the blocks
// gitignore.mjs writes, checked against git's lists instead of the text. The dotfiles match
// at any depth, as the ignore patterns do.
const ALWAYS_LOCAL = [
  [/^AIDOCS\/ENV\/[^/]+_ENV_CODE\.md$/, "the code page ENV doc"],
  [/^AIDOCS\/ENV\/(?:.+\/)?(?:[^/]+\.(?:key|pem|p12|pfx|env)|id_rsa|id_ed25519)$/, "a credential file"],
  [/^AIDOCS\/tools\/staging\/(?!\.gitkeep$)/, "a staging file"],
  [/^AIDOCS\/tools\/state\.json$/, "the engine state"],
  [/^AIDOCS\/[^/]+_SETUP_ARCHIVE\/(?!\.gitkeep$)/, "a setup archive"],
  [/^WDDOCS\/SESSION_HANDOFF[^/]*\.md$/, "the session handoff"],
  [/^WDDOCS\/RELEASES\/(?!\.gitkeep$)/, "a release runbook"],
  [/^INSTALL\/engine\//, "the fetched engine"],
  [/^TEMP\//, "a scratch file"],
  [/(?:^|\/)\.env(?!(?:\..+)?\.(?:example|sample|template)$)(?:\..+)?$/, "a .env file"],
  [/(?:^|\/)\.mcp\.json$/, "the MCP config"],
  [/(?:^|\/)\.claude\/settings\.local\.json$/, "the local settings"],
];
const PUBLIC_LOCAL = [
  [/^AIDOCS\/[^/]+_(?:MEMORY|MEMORY_EXTENDED|SESSION|SESSION_EXTENDED|BACKLOG|DEV-AUDIT|AUTO-PUSH)\.md$/, "project knowledge"],
  [/^AIDOCS\/[^/]+_ARCHIVE(?:\/(?!\.gitkeep$)|\.md$)/, "a pruned archive"],
  [/^AIDOCS\/automemory\/(?!\.gitkeep$)/, "a rule or profile"],
  [/^AIDOCS\/ENV\/(?!\.gitkeep$)/, "an ENV doc"],
  [/^WDDOCS\/(?:ARCHIVE|DESIGN|IDEAS)\/(?!\.gitkeep$)/, "a WDDOCS doc"],
];

// The index plus the untracked files git would add on the next `add -A`, relative to the
// root, or null off a repository. Run at the root, so a project nested in a larger
// repository lists its own. `tracked` tells the two apart in the report.
function publishable(root) {
  try {
    const list = (args) => gitRead(root, ["ls-files", "-z", ...args]).split("\0").filter(Boolean);
    const tracked = list([]);
    return { files: [...tracked, ...list(["--others", "--exclude-standard"])], tracked: new Set(tracked) };
  } catch { return null; }
}

// The file's lines, or null when it is gone from the working tree, not a regular file (git
// publishes a symlink's target text, never what it points at), too large to be hand-written,
// or binary.
function textLines(abs) {
  let st;
  try { st = lstatSync(abs); } catch { return null; }
  if (!st.isFile() || st.size > MAX_BYTES) return null;
  let buf;
  try { buf = readFileSync(abs); } catch { return null; }
  if (buf.subarray(0, 8000).includes(0)) return null;
  return buf.toString("utf8").split(/\r?\n/);
}

// exposure.skip_secret_scan: path globs for third-party content, such as scraped pages that
// ship their own public keys. Git resolves them as pathspecs, so they match as its own rules
// do. The privacy gate still covers these paths, and a list git cannot resolve is reported
// and leaves the scan on every file.
function secretScanSkips(root, index, notes) {
  const globs = index.exposure?.skip_secret_scan;
  if (!Array.isArray(globs) || globs.length === 0) return new Set();
  const specs = globs.filter((g) => typeof g === "string" && g.trim()).map((g) => `:(glob)${g.trim()}`);
  if (specs.length !== globs.length) notes.push("exposure.skip_secret_scan holds an entry that is not a path glob, which is ignored");
  if (specs.length === 0) return new Set();
  try {
    return new Set(gitRead(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...specs]).split("\0").filter(Boolean));
  } catch {
    notes.push("exposure.skip_secret_scan did not resolve as git pathspecs, so the secret scan covers every file");
    return new Set();
  }
}

function secretShape(line) {
  for (const [label, re, mixed] of VENDOR_SHAPES) {
    const m = re.exec(line);
    if (!m || EXAMPLE.test(m[0])) continue;
    if (mixed && !(/[A-Z]/.test(m[0]) && /[0-9]/.test(m[0]))) continue;
    return label;
  }
  for (const [label, re] of ASSIGNMENT_SHAPES) {
    const m = re.exec(line);
    if (m && !PLACEHOLDER.test(m[m.length - 1])) return label;
  }
  return null;
}

export function runExposureChecks(index) {
  const root = repoRoot();
  const found = publishable(root);
  const errors = [];
  const warns = [];
  const skipNotes = [];
  if (found) {
    const gated = index.privacy === "public" ? [...ALWAYS_LOCAL, ...PUBLIC_LOCAL] : ALWAYS_LOCAL;
    const skip = secretScanSkips(root, index, skipNotes);
    for (const rel of found.files) {
      const tracked = found.tracked.has(rel);
      const gate = gated.find(([re]) => re.test(rel));
      if (gate) {
        errors.push(tracked
          ? `tracked ${gate[1]} "${rel}" - the privacy gate keeps it local (git rm --cached, then commit)`
          : `unignored ${gate[1]} "${rel}" - the next add -A would publish it (add the ignore rule)`);
      }
      const lines = textLines(join(root, rel));
      if (!lines) continue;
      let homePathNamed = false;
      const scanSecrets = !skip.has(rel);
      lines.forEach((line, i) => {
        const label = scanSecrets ? secretShape(line) : null;
        if (label) errors.push(`"${rel}" line ${i + 1} looks like ${label} - rotate it, and if it was ever committed purge the history, a published secret stays in every clone`);
        if (!homePathNamed && HOME_PATH.test(line)) {
          warns.push(`"${rel}" line ${i + 1} carries a user home path`);
          homePathNamed = true;
        }
      });
    }
  }
  const warnsOut = { "Machine paths": warns };
  if (skipNotes.length > 0) warnsOut["Secret scan skips"] = skipNotes;
  return { errors: { Exposure: errors }, warns: warnsOut };
}
