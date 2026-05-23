// migrate-restore.mjs - the deterministic restore lane, the mirror of
// migrate-archive. After init relays a clean structure, this layers the project's
// own content back from AIDOCS/<NAME>_SETUP_ARCHIVE/: user docs (WDDOCS) verbatim, a
// union-merge of the archived .gitignore so custom ignores are never dropped, the
// section-shaped docs (DEV-AUDIT specifics, AUTO-PUSH release steps, the BACKLOG
// Features + Ideas lists) copied verbatim with legacy + rename normalization, and
// CHANGELOG verbatim. The knowledge files (MEMORY / SESSION / Big-6) are not restored
// here - they are captured and distilled through -Update instead, and so is the dedup
// / reformat of the sections this lane copies. ENV is left in place by migrate-archive.

import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { flag, validName } from "./args.mjs";
import { installLog } from "./installLog.mjs";
import { findSectionBounds, isPlaceholderBody } from "./markdown.mjs";
import { normalizeLegacy, normalizeNames } from "./migrate-normalize.mjs";
import { overwriteSection } from "./mutators.mjs";
import { repoRoot } from "./paths.mjs";

// The docs whose named section is copied back verbatim. Each names the archive
// filename suffixes to look for (DEV-STANDARDS is the legacy DEV-AUDIT), the live doc
// to write, and the section heading to replace. BACKLOG is two specs: Features and
// Ideas are both user-owned lists, carried whole so the reconcile sweep dedupes real
// content instead of re-deriving it from nothing.
const RESTORED_SECTIONS = [
  { archiveSuffixes: ["_DEV-AUDIT.md", "_DEV-STANDARDS.md"], live: "DEV-AUDIT", section: "Project specifics" },
  { archiveSuffixes: ["_AUTO-PUSH.md"], live: "AUTO-PUSH", section: "Project release steps" },
  { archiveSuffixes: ["_BACKLOG.md"], live: "BACKLOG", section: "Features" },
  { archiveSuffixes: ["_BACKLOG.md"], live: "BACKLOG", section: "Ideas" },
];
const OLD_NAME = /_(DEV-AUDIT|DEV-STANDARDS|AUTO-PUSH|BACKLOG)\.md$/;

// Keep every canonical line, append the archived lines the canonical set does not
// already have (under a header). Returns null when there is nothing new to add.
function mergeGitignore(canonical, archived, name) {
  const have = new Set(canonical.split("\n").map((l) => l.trim()));
  const add = archived.split("\n").filter((l) => l.trim() && !have.has(l.trim()));
  if (add.length === 0) return null;
  return `${canonical.replace(/\n*$/, "")}\n\n# preserved from ${name} (pre-migration)\n${add.join("\n")}\n`;
}

// Every archived file matching one of the suffixes, best candidate first. Suffixes
// are tried in order (DEV-AUDIT before the legacy DEV-STANDARDS), and within a suffix
// a legacy-named file sorts ahead of one already carrying the new name: a bootstrap
// rename can leave an empty <newname>_ scaffold beside the real <oldname>_ source, and
// the real one must win. restoreConfigSection walks these and takes the first with a
// non-placeholder section.
function findArchivedCandidates(aidocs, suffixes, name) {
  if (!existsSync(aidocs)) return [];
  const files = readdirSync(aidocs);
  const out = [];
  for (const suffix of suffixes) {
    const hits = files.filter((f) => f.endsWith(suffix));
    hits.sort((a, b) => Number(a.startsWith(`${name}_`)) - Number(b.startsWith(`${name}_`)));
    for (const h of hits) out.push(join(aidocs, h));
  }
  return out;
}

// Pull a section's body out of archived content, or null when the heading is absent
// or its body is just a placeholder (the source never filled it - nothing to copy).
function extractSection(content, section) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const bounds = findSectionBounds(lines, section);
  if (!bounds) return null;
  const body = lines.slice(bounds.startIdx + 1, bounds.endIdx).join("\n").trim();
  return body && !isPlaceholderBody(body) ? body : null;
}

// Copy one archived doc's named section into the freshly-laid live doc, verbatim but
// for legacy + rename normalization. Walks the archive candidates and takes the first
// whose section has real content, so an empty same-name scaffold never shadows the
// real legacy-named source. Returns a report string, or null when no candidate had a
// section to copy (the reconcile pass derives it instead).
function restoreSection(archiveAidocs, root, name, spec) {
  const liveAbs = join(root, "AIDOCS", `${name}_${spec.live}.md`);
  if (!existsSync(liveAbs)) return null;
  for (const src of findArchivedCandidates(archiveAidocs, spec.archiveSuffixes, name)) {
    let content = readFileSync(src, "utf8");
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
    const oldName = basename(src).replace(OLD_NAME, "");
    content = normalizeLegacy(content);
    if (oldName && oldName !== name) content = normalizeNames(content, oldName, name);
    const body = extractSection(content, spec.section);
    if (body === null) continue;   // empty / placeholder section - try the next candidate
    try {
      writeFileSync(liveAbs, overwriteSection(readFileSync(liveAbs, "utf8"), spec.section, body), "utf8");
    } catch {
      return null;   // the live section heading is missing - leave it for the reconcile pass
    }
    return `${name}_${spec.live}.md ${spec.section} (from ${basename(src)})`;
  }
  return null;
}

export function cmdMigrateRestore(args) {
  const name = flag(args, "--name");
  if (!validName(name)) { console.error("migrate-restore needs --name <PROJECT> (letter, then letters / digits / _ / - only)"); process.exit(5); }
  const root = repoRoot();
  const archive = join(root, "AIDOCS", `${name}_SETUP_ARCHIVE`);
  if (!existsSync(archive)) { console.error(`migrate-restore: no archive at ${archive}`); process.exit(5); }
  const archiveAidocs = join(archive, "AIDOCS");

  const done = [];

  // WDDOCS verbatim (user-owned). cpSync overlays the stock scaffold init laid.
  const wddocsSrc = join(archive, "WDDOCS");
  if (existsSync(wddocsSrc)) { cpSync(wddocsSrc, join(root, "WDDOCS"), { recursive: true }); done.push("WDDOCS"); }

  // .gitignore union merge - canonical plus the project's unique lines, nothing dropped.
  const giArchived = join(archive, ".gitignore");
  const giRoot = join(root, ".gitignore");
  if (existsSync(giArchived) && existsSync(giRoot)) {
    const merged = mergeGitignore(readFileSync(giRoot, "utf8"), readFileSync(giArchived, "utf8"), name);
    if (merged) { writeFileSync(giRoot, merged, "utf8"); done.push(".gitignore (merged)"); }
    else done.push(".gitignore (no new lines)");
  }

  // Section-shaped docs (DEV-AUDIT specifics, AUTO-PUSH release steps, BACKLOG
  // Features + Ideas), copied verbatim. The -Update reconcile pass dedups / sweeps them.
  for (const spec of RESTORED_SECTIONS) {
    const note = restoreSection(archiveAidocs, root, name, spec);
    if (note) done.push(note);
  }

  // CHANGELOG verbatim (the project's real release history, the sanctioned dated
  // file). The reconcile pass scrubs its voice to house style.
  const clArchived = join(archive, "CHANGELOG.md");
  if (existsSync(clArchived)) { cpSync(clArchived, join(root, "CHANGELOG.md")); done.push("CHANGELOG (verbatim)"); }

  console.log(`migrate-restore: restored ${done.length ? done.join(", ") : "nothing"} from ${archive}.`);
  console.log("  knowledge files (MEMORY / SESSION / Big-6) are captured via /321 -Update, not restored here.");
  console.log("  the copied config sections are deduped / reformatted by the -Update reconcile pass.");
  installLog(root, `migrate-restore: restored ${done.length ? done.join(", ") : "nothing"} from AIDOCS/${name}_SETUP_ARCHIVE.`);
}
