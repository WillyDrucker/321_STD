// verdict.mjs - the C-hybrid contract for migration. The AI scans the project and
// writes a verdict (a JSON array of {path, type, confidence, action}). This module
// validates that contract strictly, then applies it - move or copy a path into the
// SETUP_ARCHIVE, or leave it in place. The fixed vocab and path containment are the
// gate - an unknown type or action, a path that escapes the project root, or one
// that targets a protected location (.git, the engine, ENV, the archive, INSTALL) is
// rejected before any file is touched (DEV-AUDIT: fail at gates). It is the shared spine the
// discovery sweep writes through. Skill / auto-memory lanes extend the vocab when
// they land.

import { cpSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

import { installLog } from "./installLog.mjs";
import { repoRoot } from "./paths.mjs";

const TYPES = ["handoff", "design", "memory", "notes", "scratch", "env", "other"];
const ACTIONS = ["move", "copy", "leave"];
// Top-level roots the sweep must never relocate.
const PROTECTED_TOP = new Set([".git", ".claude", "node_modules", "TEMP", "INSTALL"]);
// AIDOCS subtrees the migration must never sweep: the engine, the rule files, the
// skill bodies, and ENV (may hold secrets). setup.md promises these stay in place,
// so the gate enforces that promise against an AI-written verdict.
const PROTECTED_AIDOCS = ["tools", "automemory", "SKILL", "ENV"];

// A verdict path stays inside the project and never targets the project root, a
// container tree, the engine / router / rule / ENV roots, the migration archive, the
// git dir, the onboarding tier, or transient roots. The sweep is AI-written, so the
// gate enforces what the runbook only asks for. Returns an error string or null.
function containmentError(p, root) {
  const norm = p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (norm === "" || norm === ".") return `path "${p}" targets the project root`;
  const top = norm.split("/")[0];
  if (PROTECTED_TOP.has(top)) return `path "${p}" targets a protected location (${top})`;
  if (norm === "AIDOCS") return `path "${p}" targets the whole AIDOCS tree`;
  for (const d of PROTECTED_AIDOCS) {
    if (norm === `AIDOCS/${d}` || norm.startsWith(`AIDOCS/${d}/`)) return `path "${p}" targets a protected location (AIDOCS/${d})`;
  }
  if (/^AIDOCS\/[^/]+_SETUP_ARCHIVE(\/|$)/.test(norm)) return `path "${p}" targets the migration archive`;
  const abs = resolve(root, p);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (!abs.startsWith(prefix)) return `path "${p}" escapes the project root`;
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
    else { const pc = containmentError(e.path, root); if (pc) errors.push(`${at}: ${pc}`); }
    if (!TYPES.includes(e?.type)) errors.push(`${at}: unknown type ${JSON.stringify(e?.type)} (one of ${TYPES.join(" / ")})`);
    if (!ACTIONS.includes(e?.action)) errors.push(`${at}: unknown action ${JSON.stringify(e?.action)} (one of ${ACTIONS.join(" / ")})`);
    if (typeof e?.confidence !== "number" || e.confidence < 0 || e.confidence > 1) errors.push(`${at}: confidence required (number 0 to 1)`);
  });
  return errors;
}

function flag(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }

// verdict --validate <file>            check the contract, read-only.
// verdict --apply <file> --name <P>    execute it - move / copy into the archive, or leave.
export function cmdVerdict(args) {
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
  if (!name || name.startsWith("--")) { console.error("verdict --apply needs --name <PROJECT>"); process.exit(5); }
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
