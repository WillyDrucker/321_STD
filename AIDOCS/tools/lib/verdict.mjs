// verdict.mjs - the C-hybrid contract for migration. The AI scans the project and
// writes a verdict (a JSON array of {path, type, confidence, action}). This module
// validates that contract strictly, then applies it - move or copy a path into the
// SETUP_ARCHIVE, or leave it in place. The fixed vocab and path containment are the
// gate - an unknown type or action, a path that escapes the project root, or one
// that targets a protected location (.git, the engine, ENV, the archive, INSTALL) is
// rejected before any file is touched (DEV-AUDIT: fail at gates). It is the shared spine the
// discovery sweep writes through. Skill / auto-memory lanes extend the vocab when
// they land.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { flag, validName } from "./args.mjs";
import { installLog } from "./installLog.mjs";
import { isContained, repoRoot } from "./paths.mjs";

const TYPES = ["handoff", "design", "memory", "notes", "scratch", "env", "other"];
const ACTIONS = ["move", "copy", "leave"];
// Top-level roots the sweep must never relocate.
const PROTECTED_TOP = new Set([".git", ".claude", "node_modules", "TEMP", "INSTALL"]);
// AIDOCS subtrees the migration must never sweep: the engine, the rule files, the
// skill bodies, and ENV (may hold secrets). setup.md promises these stay in place,
// so the gate enforces that promise against an AI-written verdict.
const PROTECTED_AIDOCS = ["tools", "automemory", "SKILL", "ENV"];

// A verdict path is relative and stays inside the project, never targeting the project
// root, a container tree, the engine / router / rule / ENV roots, the migration
// archive, the git dir, the onboarding tier, or transient roots. The sweep is
// AI-written, so the gate enforces what the runbook only asks for. An absolute path is
// rejected outright: validate would pass it (it resolves inside the repo) but apply
// joins it onto the root and addresses the wrong file. Returns an error string or null.
function containmentError(p, root) {
  if (isAbsolute(p)) return `path "${p}" must be relative to the project root`;
  const norm = p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (norm === "" || norm === ".") return `path "${p}" targets the project root`;
  const top = norm.split("/")[0];
  if (PROTECTED_TOP.has(top)) return `path "${p}" targets a protected location (${top})`;
  if (norm === "AIDOCS") return `path "${p}" targets the whole AIDOCS tree`;
  for (const d of PROTECTED_AIDOCS) {
    if (norm === `AIDOCS/${d}` || norm.startsWith(`AIDOCS/${d}/`)) return `path "${p}" targets a protected location (AIDOCS/${d})`;
  }
  if (/^AIDOCS\/[^/]+_SETUP_ARCHIVE(\/|$)/.test(norm)) return `path "${p}" targets the migration archive`;
  if (!isContained(root, resolve(root, p))) return `path "${p}" escapes the project root`;
  return null;
}

// Returns human-readable errors (empty when well-formed). Strict - every entry needs
// a path that resolves safely inside the project, a known type, a known action, and
// a confidence in the range 0 to 1.
function validateVerdict(entries, root) {
  if (!Array.isArray(entries)) return ["verdict must be a JSON array"];
  const errors = [];
  entries.forEach((e, i) => {
    const at = `entry ${i}`;
    if (typeof e?.path !== "string" || !e.path) errors.push(`${at}: path required (string)`);
    // Only move / copy relocate a file, so only they need containment. A leave is a
    // no-op, so a leave on a protected path (e.g. AIDOCS/ENV) is allowed, not an escape.
    else if (e?.action === "move" || e?.action === "copy") { const pc = containmentError(e.path, root); if (pc) errors.push(`${at}: ${pc}`); }
    if (!TYPES.includes(e?.type)) errors.push(`${at}: unknown type ${JSON.stringify(e?.type)} (one of ${TYPES.join(" / ")})`);
    if (!ACTIONS.includes(e?.action)) errors.push(`${at}: unknown action ${JSON.stringify(e?.action)} (one of ${ACTIONS.join(" / ")})`);
    if (typeof e?.confidence !== "number" || e.confidence < 0 || e.confidence > 1) errors.push(`${at}: confidence required (number 0 to 1)`);
  });
  return errors;
}

// --- verdict --suggest: the deterministic scan half of the discovery sweep --------
// migrate-archive has already moved the known shape, so this walks what remains and
// pre-classifies the certainties into a candidate verdict. The AI then reviews and
// supplements a draft instead of authoring one from scratch (the old error surface).
// Bias: a clear AI-state file or dir is moved, a gray-zone knowledge doc is copied
// (lossless, the working tree keeps it), everything else is left unlisted.

// Dirs never scanned, on top of what containmentError already blocks: the transient
// and build-output roots a project carries.
const SCAN_SKIP_DIRS = new Set([
  ".git", ".claude", "node_modules", "TEMP", "INSTALL",
  "dist", "out", "build", "coverage", ".next", ".nuxt", ".svelte-kit", ".turbo", "target", "vendor",
]);
// Whole-directory AI-assistant state, archived as one unit.
const AISTATE_DIRS = new Set([".cursor", ".ai", ".aider", ".continue", ".windsurf", ".codeium", ".clinerules", ".roo"]);
// A filename that is clearly AI working state.
const AISTATE_FILE = /handoff|(^|[._-])scratch([._-]|$)|_dump|\.cursorrules$|\.windsurfrules$|^copilot-instructions\.md$/i;
// Standard repo files that are not knowledge to archive, left unlisted.
const STD_REPO = /^(README|LICENSE|LICENCE|CHANGELOG|CONTRIBUTING|CODE_OF_CONDUCT|SECURITY|AUTHORS|NOTICE)\b/i;
// A knowledge-ish doc by extension.
const DOC_EXT = /\.(md|mdc|txt|rst|adoc)$/i;

function classifySuggest(name, relDir) {
  if (AISTATE_FILE.test(name)) return { type: /handoff/i.test(name) ? "handoff" : "scratch", action: "move", confidence: 0.8, note: "AI working-state file" };
  if (STD_REPO.test(name)) return null;   // a standard repo file, left in place
  if (DOC_EXT.test(name)) {
    const top = (relDir.split("/")[0] || "").toLowerCase();
    if (relDir === "" || ["docs", "doc", "notes", ".notes", "design"].includes(top)) {
      return { type: top === "design" ? "design" : "notes", action: "copy", confidence: 0.4, note: "gray-zone knowledge doc - confirm or leave" };
    }
  }
  return null;   // source, config, or asset, left in place
}

function suggestEntries(root) {
  const out = [];
  const walk = (absDir, relDir, depth) => {
    let names;
    try { names = readdirSync(absDir); } catch { return; }
    for (const name of names) {
      const rel = relDir ? `${relDir}/${name}` : name;
      if (containmentError(rel, root)) continue;   // protected or escaping, never suggested
      let st; try { st = statSync(join(absDir, name)); } catch { continue; }
      if (st.isDirectory()) {
        if (SCAN_SKIP_DIRS.has(name)) continue;
        if (AISTATE_DIRS.has(name)) { out.push({ path: rel, type: "memory", action: "move", confidence: 0.85, note: "AI-assistant state directory" }); continue; }
        if (depth < 3) walk(join(absDir, name), rel, depth + 1);
      } else if (st.isFile()) {
        const cls = classifySuggest(name, relDir);
        if (cls) out.push({ path: rel, ...cls });
      }
    }
  };
  walk(root, "", 0);
  return out;
}

// verdict --suggest [--out <file>]     draft a candidate verdict from a heuristic scan.
function suggestVerdict(args) {
  const root = repoRoot();
  // The draft lands under the project (default TEMP/). An explicit --out is contained
  // the same way verdict entries are - it must not escape the root.
  const outArg = flag(args, "--out");
  const outFile = outArg ? resolve(root, outArg) : join(root, "TEMP", "setup-verdict.json");
  if (!isContained(root, outFile)) { console.error(`verdict --suggest: --out "${outArg}" escapes the project root`); process.exit(5); }
  const entries = suggestEntries(root);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  const n = (a) => entries.filter((e) => e.action === a).length;
  console.log(`verdict --suggest: ${entries.length} candidate(s) - ${n("move")} move, ${n("copy")} copy -> ${outFile}`);
  for (const e of entries) console.log(`  ${e.action.padEnd(4)} ${e.path}  (${e.type}, conf ${e.confidence})`);
  console.log("  this is a draft. Confirm each, add anything the scan missed, then: verdict --validate <file>, then --apply <file> --name <P>.");
}

// verdict --suggest [--out <file>]     draft a candidate verdict (deterministic scan).
// verdict --validate <file>            check the contract, read-only.
// verdict --apply <file> --name <P>    execute it - move / copy into the archive, or leave.
export function cmdVerdict(args) {
  if (args.includes("--suggest")) { suggestVerdict(args); return; }
  const apply = args.includes("--apply");
  const file = flag(args, apply ? "--apply" : "--validate");
  if (!file) { console.error("verdict needs --validate <file> or --apply <file>"); process.exit(5); }
  if (!existsSync(file)) { console.error(`verdict: file not found: ${file}`); process.exit(5); }

  let entries;
  try { entries = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { console.error(`verdict: ${file} is not valid JSON: ${e.message}`); process.exit(6); }

  const root = repoRoot();
  const errors = validateVerdict(entries, root);
  if (errors.length) {
    console.error(`verdict: ${errors.length} error(s) - nothing applied:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(13);
  }
  if (!apply) { console.log(`verdict: well-formed (${entries.length} entr${entries.length === 1 ? "y" : "ies"}).`); return; }

  const name = flag(args, "--name");
  if (!validName(name)) { console.error("verdict --apply needs --name <PROJECT> (letter, then letters / digits / _ / - only)"); process.exit(5); }
  const archive = join(root, "AIDOCS", `${name}_SETUP_ARCHIVE`);
  const counts = { move: 0, copy: 0, leave: 0, kept: 0, missing: 0 };
  for (const e of entries) {
    if (e.action === "leave") { counts.leave++; continue; }
    const src = join(root, e.path);
    if (!existsSync(src)) { counts.missing++; continue; }
    const dst = join(archive, e.path);
    if (existsSync(dst)) { counts.kept++; continue; }   // recovery net keeps the first copy - never overwrite archived data
    mkdirSync(dirname(dst), { recursive: true });
    if (e.action === "move") { renameSync(src, dst); counts.move++; }
    else { cpSync(src, dst, { recursive: true }); counts.copy++; }
  }
  console.log(`verdict: moved ${counts.move}, copied ${counts.copy}, left ${counts.leave}${counts.kept ? `, ${counts.kept} kept (already archived)` : ""}${counts.missing ? `, ${counts.missing} missing` : ""} -> ${archive} (move, not delete).`);
  installLog(root, `verdict: moved ${counts.move}, copied ${counts.copy}, left ${counts.leave}${counts.kept ? `, ${counts.kept} kept (already archived)` : ""}${counts.missing ? `, ${counts.missing} missing` : ""} into AIDOCS/${name}_SETUP_ARCHIVE.`);
}
