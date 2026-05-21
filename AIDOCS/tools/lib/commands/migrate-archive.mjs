// migrate-archive.mjs - deterministic Step 1 archiving for the /321 -Setup
// migration. Moves project-owned content into AIDOCS/<X>_SETUP_ARCHIVE/. MOVE,
// never delete - the archive is the reversible safety net. Two tiers:
//   1. Known 321-shape paths + clearly-stale swept AI-state -> moved automatically.
//   2. Borderline swept docs (might be live user content) -> REPORTED for the AI to
//      adjudicate. The AI passes --move / --copy for those it judges; the rest stay.
// --scan reports both tiers without moving anything. Pre-index: runs before init in
// migration Step 1, so it globs the tree and does not read _index.json. The skill
// owns the judgment (adjudicate the borderline list); this command owns the
// deterministic find + move, which is what keeps the patterns out of the skill prose.

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, rename } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";

import { err, parseFlags } from "../cli.mjs";
import { REPO_ROOT } from "../paths.mjs";

// Dirs the sweep never walks: dependency / build / VCS output, and the canonical
// engine subdirs (init replaces those, they are not project content).
const EXCLUDE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", ".cxx", ".gradle",
  "Pods", "DerivedData", ".netlify", ".cache", ".turbo", "vendor",
]);
// Engine / already-archived relative dirs, skipped by exact path.
const EXCLUDE_RELS = new Set(["AIDOCS/tools", "AIDOCS/SKILL", "AIDOCS/SKILLS", "AIDOCS/automemory", ".claude/skills"]);
// Folders that collect AI working state - any `.md` inside is a sweep candidate.
const AI_DIRS = new Set(["TEMP", "tmp", "temp", ".claude", ".ai", "ai", "memory", "context", ".cursor", ".windsurf"]);
// Basenames that read as AI working state anywhere in the tree.
const AI_NAME = /^(CLAUDE.*|USERPROMPT.*|.*HANDOFF.*|.*RENAME.*|.*_MEMORY.*|MEMORY.*|.*_SESSION.*|SESSION.*|CONTEXT.*|.*_NOTES|NOTES|PROJECT.*|TODO|SCRATCH.*|.*_log)\.md$/i;
// Strong signals -> clearly stale AI state, safe to auto-move (vs borderline).
const AI_STRONG = /^(CLAUDE.*|USERPROMPT.*|.*HANDOFF.*|.*RENAME.*)\.md$/i;

export async function cmdMigrateArchive(args) {
  const opts = parseFlags(args, ["name", "scan", "move", "copy", "target"]);
  const positional = args.filter(a => !a.startsWith("--"));
  const root = resolve(opts.target || positional[0] || REPO_ROOT);
  if (!opts.name) { err("migrate-archive requires --name <X> (the resolved project name)."); process.exit(11); }
  if (!existsSync(root)) { err(`Target not found: ${root}`); process.exit(16); }

  const archiveRel = `AIDOCS/${opts.name}_SETUP_ARCHIVE`;
  const archiveDir = join(root, archiveRel);

  const known = await listKnownPaths(root);
  const knownSet = new Set(known.map(k => k.rel));
  const swept = await walkSweep(root, archiveRel, knownSet);
  const autoSwept = swept.filter(s => s.tier === "auto").map(s => s.rel).sort();
  const borderline = swept.filter(s => s.tier === "borderline").map(s => s.rel).sort();

  if (opts.scan === true) {
    console.log(`migrate-archive --scan: ${opts.name}  (target ${root})`);
    printList("Known-path content -> MOVE", known.map(k => `${k.rel}${k.type === "dir" ? "/" : ""}`));
    printList("Swept clearly-stale AI state -> MOVE", autoSwept);
    printList("Swept borderline -> REVIEW (adjudicate: --move <csv> / --copy <csv>, default leave)", borderline);
    console.log(`\nNothing else is touched - source, config, build, README, and unmatched docs stay in place. Nothing is deleted (MOVE into ${archiveRel}/).`);
    return;
  }

  // Execute. Validate AI adjudication against the borderline set (only reported
  // borderlines may be acted on - reject anything else as a safety check).
  const borderSet = new Set(borderline);
  const moveDecided = csv(opts.move).filter(r => assertBorderline(r, borderSet));
  const copyDecided = csv(opts.copy).filter(r => assertBorderline(r, borderSet));

  let moved = 0, copied = 0;
  for (const k of known) { await moveInto(root, archiveDir, k.rel); moved++; }
  for (const rel of autoSwept) { await moveInto(root, archiveDir, rel); moved++; }
  for (const rel of moveDecided) { await moveInto(root, archiveDir, rel); moved++; }
  for (const rel of copyDecided) { await copyInto(root, archiveDir, rel); copied++; }

  const left = borderline.filter(r => !moveDecided.includes(r) && !copyDecided.includes(r));
  console.log(`migrate-archive: ${moved} moved, ${copied} copied -> ${archiveRel}/`);
  console.log(`  known-path: ${known.length}, clear AI-state: ${autoSwept.length}, borderline moved: ${moveDecided.length}, copied: ${copied}, left in place: ${left.length}`);
  if (left.length) console.log(`  left (not adjudicated): ${left.join(", ")}`);
}

function csv(v) { return (typeof v === "string" ? v.split(",") : []).map(s => s.trim()).filter(Boolean); }

function assertBorderline(rel, borderSet) {
  if (!borderSet.has(rel)) {
    err(`Refusing --move/--copy "${rel}": not in the borderline list from --scan (only reported borderlines can be adjudicated).`);
    process.exit(17);
  }
  return true;
}

async function listKnownPaths(root) {
  const out = [];
  const fixedFiles = ["AGENTS.md", "CLAUDE.md", "CHANGELOG.md", ".gitignore", "AIDOCS/_index.json", ".claude/skills/321/SKILLS.md"];
  const fixedDirs = ["AIDOCS/ENV", "WDDOCS", "AIDOCS/SKILLS"];
  for (const f of fixedFiles) if (existsSync(join(root, f))) out.push({ rel: f, type: "file" });
  for (const d of fixedDirs) if (existsSync(join(root, d))) out.push({ rel: d, type: "dir" });
  const aidocs = join(root, "AIDOCS");
  if (existsSync(aidocs)) {
    for (const e of await readdir(aidocs, { withFileTypes: true })) {
      if (e.isFile() && /_(MEMORY|MEMORY_EXTENDED|SESSION|SESSION_EXTENDED|BACKLOG|DEV-AUDIT|DEV-STANDARDS)\.md$/.test(e.name)) {
        out.push({ rel: `AIDOCS/${e.name}`, type: "file" });
      } else if (e.isDirectory() && /_(MEMORY|SESSION|BACKLOG)_ARCHIVE$/.test(e.name)) {
        out.push({ rel: `AIDOCS/${e.name}`, type: "dir" });
      }
    }
  }
  return out;
}

async function walkSweep(root, archiveRel, knownSet) {
  const candidates = [];
  async function walk(absDir, relDir) {
    let entries;
    try { entries = await readdir(absDir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (EXCLUDE_DIRS.has(e.name) || EXCLUDE_RELS.has(rel) || rel === archiveRel) continue;
        await walk(join(absDir, e.name), rel);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".md") && !knownSet.has(rel)) {
        const segs = rel.split("/");
        const inAiDir = segs.slice(0, -1).some(s => AI_DIRS.has(s));
        if (!inAiDir && !AI_NAME.test(e.name)) continue;
        const inDump = segs.slice(0, -1).some(s => /_dump$/i.test(s));
        const tier = (inDump || AI_STRONG.test(e.name)) ? "auto" : "borderline";
        candidates.push({ rel, tier });
      }
    }
  }
  await walk(root, "");
  return candidates;
}

function safeWithin(root, rel) {
  const abs = resolve(root, rel);
  const within = relative(root, abs);
  if (within === "" || within.startsWith("..") || isAbsolute(within)) {
    err(`Refusing path outside the project: ${rel}`);
    process.exit(5);
  }
  return abs;
}

async function moveInto(root, archiveDir, rel) {
  const src = safeWithin(root, rel);
  const dest = join(archiveDir, rel);
  await mkdir(dirname(dest), { recursive: true });
  await rename(src, dest);
}

async function copyInto(root, archiveDir, rel) {
  const src = safeWithin(root, rel);
  const dest = join(archiveDir, rel);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

function printList(label, items) {
  console.log(`\n${label} (${items.length}):`);
  if (items.length === 0) { console.log("  (none)"); return; }
  for (const it of items) console.log(`  ${it}`);
}
