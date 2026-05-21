// sync.mjs - cmdSync. Rebuilds skills.dispatch in _index.json from skill body
// frontmatter. Skill bodies in AIDOCS/SKILL/SKILL_*.md are the source of truth;
// the index is derived.
//
// Filename derives the flag (SKILL_SESSION-UPDATE.md -> -SessionUpdate).
// Frontmatter `name` is the dispatch key (lowercase-kebab); `description` is
// the help-text summary. Both required - entries missing either are skipped.
//
// A project customizes a skill by editing its AIDOCS/SKILL/SKILL_*.md body in
// place and recording it in _index.json customizations[], which is what keeps
// init from overwriting it on an engine update. sync derives dispatch from the
// body either way - it does not need to know the body is customized.
//
// Preservation rules: prior `modes` arrays carry over by key; existing key
// order is preserved; new keys are appended alphabetically. Body paths are
// written forward-slash POSIX so the index is portable across platforms.
//
// The router skill at .claude/skills/321/SKILL.md is NOT touched - its
// frontmatter description is curated prose listing the flags, not generated.

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

  const entries = await readdir(skillBodiesDir);
  const files = entries.filter(f => /^SKILL_.+\.md$/.test(f)).sort();
  if (files.length === 0) {
    console.log(`sync: no SKILL_*.md files found in ${skillBodiesRel}.`);
    return;
  }

  const oldDispatch = index.skills?.dispatch || {};
  const fileMap = {};
  const skipped = [];

  for (const file of files) {
    const abs = join(skillBodiesDir, file);
    const content = await readFile(abs, "utf8");
    const fm = parseFrontmatter(content);

    if (fm.kind === "reference") {
      skipped.push(`${file}: reference doc (kind: reference), not dispatched`);
      continue;
    }
    if (!fm.name || !fm.description) {
      skipped.push(`${file}: missing name and/or description in frontmatter`);
      continue;
    }

    const flag = filenameToFlag(file);
    const bodyRel = toRelativePosix(REPO_ROOT, abs);
    const entry = { flag, body: bodyRel, description: fm.description };

    const prior = oldDispatch[fm.name];
    if (prior && Array.isArray(prior.modes) && prior.modes.length > 0) {
      entry.modes = prior.modes;
    }

    fileMap[fm.name] = entry;
  }

  // Preserve prior key order; append new keys alphabetically.
  const newDispatch = {};
  for (const key of Object.keys(oldDispatch)) {
    if (fileMap[key]) {
      newDispatch[key] = fileMap[key];
      delete fileMap[key];
    }
  }
  for (const key of Object.keys(fileMap).sort()) {
    newDispatch[key] = fileMap[key];
  }

  const updated = {
    ...index,
    skills: {
      ...(index.skills || {}),
      installed: Object.keys(newDispatch),
      dispatch: newDispatch,
    },
  };

  console.log(`sync: discovered ${Object.keys(newDispatch).length} skill(s):`);
  for (const [key, entry] of Object.entries(newDispatch)) {
    console.log(`  ${key} -> ${entry.flag}  (${entry.body})`);
  }
  for (const note of skipped) console.log(`  skipped: ${note}`);

  if (dryRun) {
    console.log("\nsync: --dry-run, not writing.");
    return;
  }

  await writeFile(INDEX_PATH, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`\nsync: wrote ${INDEX_PATH}`);
}
