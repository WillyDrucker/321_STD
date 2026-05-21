// sync.mjs - cmdSync. Rebuilds skills.dispatch in _index.json from skill body
// frontmatter. Generic bodies in AIDOCS/SKILL/SKILL_*.md are the source of
// truth; project-local bodies in AIDOCS/SKILL_LOCAL/SKILL_*.md take precedence.
//
// Filename derives the flag (SKILL_SESSION-UPDATE.md -> -SessionUpdate).
// Frontmatter `name` is the dispatch key (lowercase-kebab); `description` is
// the help-text summary. Both required - entries missing either are skipped.
//
// Local precedence: a SKILL_LOCAL body with the same filename as a generic one
// OVERRIDES it (same flag + dispatch key, the local body path wins), so a
// project's customized pipeline survives an engine reinstall - init always
// overwrites AIDOCS/SKILL, never AIDOCS/SKILL_LOCAL. A SKILL_LOCAL body with no
// generic counterpart ADDS a new skill. Both land in skills.local_additions so
// doctor and drift tooling can see what is served locally. With no SKILL_LOCAL
// dir (the common case), behavior is identical to a generic-only sync.
//
// Preservation rules: prior `modes` arrays carry over by key; existing key
// order is preserved; new keys are appended alphabetically. Body paths are
// written forward-slash POSIX so the index is portable across platforms.
//
// The router skill at .claude/skills/321/SKILL.md is NOT touched - its
// frontmatter description is curated prose listing the flags, not generated.

import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

import { err, parseFlags } from "../cli.mjs";
import { filenameToFlag, parseFrontmatter, toRelativePosix } from "../markdown.mjs";
import { INDEX_PATH, REPO_ROOT } from "../paths.mjs";

export async function cmdSync(index, args) {
  const opts = parseFlags(args, ["dry-run"]);
  const dryRun = opts["dry-run"] === true;

  const skillBodiesRel = index.paths?.skills_bodies;
  if (!skillBodiesRel) {
    err("No skills_bodies path in _index.json -> paths. Cannot sync.");
    process.exit(10);
  }
  const skillBodiesDir = resolve(REPO_ROOT, skillBodiesRel);
  if (!existsSync(skillBodiesDir)) {
    err(`skills_bodies dir not found: ${skillBodiesDir}`);
    process.exit(10);
  }

  const skipped = [];
  const generic = await readSkillDir(skillBodiesDir, skipped);

  // Project-local overrides / additions (optional). Precedence over generic.
  const skillLocalRel = index.paths?.skills_local || "./AIDOCS/SKILL_LOCAL";
  const skillLocalDir = resolve(REPO_ROOT, skillLocalRel);
  const local = existsSync(skillLocalDir) ? await readSkillDir(skillLocalDir, skipped) : [];

  if (generic.length === 0 && local.length === 0) {
    console.log(`sync: no SKILL_*.md files found in ${skillBodiesRel}.`);
    return;
  }

  const oldDispatch = index.skills?.dispatch || {};
  const genericByFlag = new Map(generic.map(e => [e.flag, e]));

  // Merge: generic first, then local overrides / additions layered on top.
  const entries = new Map(); // dispatch key (name) -> entry
  const localKeys = new Set();
  for (const e of generic) entries.set(e.name, dispatchEntry(e, oldDispatch));
  for (const e of local) {
    const base = genericByFlag.get(e.flag);
    if (base && e.name !== base.name) {
      err(`Local override ${e.file} (${e.flag}) must use frontmatter name "${base.name}" to override the standard skill - found "${e.name}". Match the name or remove the flag collision.`);
      process.exit(10);
    }
    entries.set(e.name, dispatchEntry(e, oldDispatch));
    localKeys.add(e.name);
  }

  // Preserve prior key order; append new keys alphabetically.
  const newDispatch = {};
  for (const key of Object.keys(oldDispatch)) {
    if (entries.has(key)) { newDispatch[key] = entries.get(key); entries.delete(key); }
  }
  for (const key of [...entries.keys()].sort()) newDispatch[key] = entries.get(key);

  const localAdditions = [...localKeys].sort();
  const updated = {
    ...index,
    skills: {
      ...(index.skills || {}),
      installed: Object.keys(newDispatch),
      dispatch: newDispatch,
      local_additions: localAdditions,
    },
  };

  console.log(`sync: discovered ${Object.keys(newDispatch).length} skill(s)${localAdditions.length ? `, ${localAdditions.length} from SKILL_LOCAL` : ""}:`);
  for (const [key, entry] of Object.entries(newDispatch)) {
    let tag = "";
    if (localKeys.has(key)) tag = genericByFlag.has(entry.flag) ? "  [local override]" : "  [local add]";
    console.log(`  ${key} -> ${entry.flag}  (${entry.body})${tag}`);
  }
  for (const note of skipped) console.log(`  skipped: ${note}`);

  if (dryRun) {
    console.log("\nsync: --dry-run, not writing.");
    return;
  }

  await writeFile(INDEX_PATH, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`\nsync: wrote ${INDEX_PATH}`);
}

// Read a dir of SKILL_*.md bodies -> [{file, flag, name, body, description}].
// Skips reference docs and files missing name/description (noted in `skipped`).
async function readSkillDir(dir, skipped) {
  const out = [];
  const files = (await readdir(dir)).filter(f => /^SKILL_.+\.md$/.test(f)).sort();
  for (const file of files) {
    const abs = join(dir, file);
    const fm = parseFrontmatter(await readFile(abs, "utf8"));
    if (fm.kind === "reference") { skipped.push(`${file}: reference doc (kind: reference), not dispatched`); continue; }
    if (!fm.name || !fm.description) { skipped.push(`${file}: missing name and/or description in frontmatter`); continue; }
    out.push({ file, flag: filenameToFlag(file), name: fm.name, body: toRelativePosix(REPO_ROOT, abs), description: fm.description });
  }
  return out;
}

// Build a dispatch entry, carrying any prior `modes` array forward by key.
function dispatchEntry(e, oldDispatch) {
  const entry = { flag: e.flag, body: e.body, description: e.description };
  const prior = oldDispatch[e.name];
  if (prior && Array.isArray(prior.modes) && prior.modes.length > 0) entry.modes = prior.modes;
  return entry;
}
