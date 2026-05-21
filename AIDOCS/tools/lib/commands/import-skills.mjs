// import-skills.mjs - cmdImportSkills. Bring a project's own (non-canonical) skill
// bodies into AIDOCS/SKILL/ under the canonical SKILL_<FUNC>.md name, so `sync` can
// register them with the /321 router. The router is data-driven (it dispatches off
// _index.json -> skills.dispatch), so registering an extra skill is purely a
// file-placement + sync problem - this command does the mechanical placement, sync
// does the registration. No router edit is ever needed.
//
// It is deliberately conservative:
//   - NEVER overwrites an existing canonical body. A name collision (the project's
//     skill shares a function with a canonical one, e.g. auto-push) is REPORTED with
//     the canonical body's hash, not applied - /321 -Update resolves it as
//     canonical-base + project delta and records that hash in customizations[].base.
//   - Net-new bodies (no canonical equivalent) are copied verbatim AND recorded in
//     customizations[] (provenance), so the no-conflict path is fully mechanical with
//     no AI edit of the body. A body missing name/description is copied but flagged -
//     sync skips it and it gets no provenance entry until the frontmatter is fixed.
//   - Non-destructive: the source is never moved or deleted. The migration archive
//     and git are the safety net. Reconcile removes the legacy tree once locked.
//
// One mechanism, two callers: the /321 -Setup migration points --from at the archived
// legacy tree to land the easy net-new imports, and the /321 -Update reconcile
// late-scan hands it specific candidate dirs found outside AIDOCS/SKILL/. Default
// scan (no --from) is the live legacy AIDOCS/SKILLS/ dir.

import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { parseFlags } from "../cli.mjs";
import { parseFrontmatter, skillBodyHash, toRelativePosix } from "../markdown.mjs";
import { INDEX_PATH, REPO_ROOT } from "../paths.mjs";

export async function cmdImportSkills(index, args) {
  const opts = parseFlags(args, ["from", "dry-run"]);
  const dryRun = opts["dry-run"] === true;

  const targetDirRel = index.paths?.skills_bodies || "./AIDOCS/SKILL";
  const targetDir = resolve(REPO_ROOT, targetDirRel);

  const fromRel = typeof opts.from === "string" ? opts.from : "AIDOCS/SKILLS";
  const fromDir = resolve(REPO_ROOT, fromRel);

  if (!existsSync(fromDir)) {
    console.log(`import-skills: nothing to import - no source dir at ${fromRel}.`);
    return;
  }

  const sources = await collectSkillFiles(fromDir);
  if (sources.length === 0) {
    console.log(`import-skills: no skill bodies found under ${fromRel}.`);
    return;
  }

  const verb = dryRun ? "would " : "";
  const imported = [], collisions = [], already = [], malformed = [];

  for (const src of sources) {
    const func = deriveFunc(src);
    const destPath = join(targetDir, `SKILL_${func}.md`);
    const destRel = toRelativePosix(REPO_ROOT, destPath);
    const srcRel = toRelativePosix(REPO_ROOT, src);

    const content = await readFile(src, "utf8");
    const fm = parseFrontmatter(content);
    const fmOk = Boolean(fm.name && fm.description);

    if (existsSync(destPath)) {
      const existing = await readFile(destPath, "utf8");
      if (skillBodyHash(existing) === skillBodyHash(content)) {
        already.push({ destRel });
      } else {
        collisions.push({ destRel, srcRel, hash: skillBodyHash(existing) });
      }
      continue;
    }

    if (!dryRun) {
      await mkdir(targetDir, { recursive: true });
      await cp(src, destPath, { force: false });
    }
    imported.push({ destRel, srcRel, fmOk, func, description: fm.description });
    if (!fmOk) malformed.push({ destRel });
  }

  console.log(`import-skills: scanned ${fromRel} (${sources.length} body/bodies) -> ${targetDirRel}`);
  for (const i of imported) {
    console.log(`  [import] ${verb}write: ${i.destRel}  (from ${i.srcRel})${i.fmOk ? "" : "  [!] missing frontmatter name/description"}`);
  }
  for (const c of collisions) {
    console.log(`  [collision] keep canonical: ${c.destRel} (hash ${c.hash}) - project delta at ${c.srcRel} - resolve in /321 -Update`);
  }
  for (const a of already) {
    console.log(`  [already] identical: ${a.destRel} (no-op)`);
  }

  // Provenance: record each net-new (well-formed) import in customizations[] so the
  // project keeps one list of every skill it added, and the no-conflict path is fully
  // mechanical - the body is copied verbatim and registered with no AI edit. Idempotent
  // (skip a path already flagged), net-new only - a collision gets its base-bearing
  // entry from the /321 -Update merge, not here.
  let provenance = 0;
  if (!dryRun) {
    const customs = Array.isArray(index.customizations) ? index.customizations : [];
    const flagged = new Set();
    for (const c of customs) {
      for (const p of (Array.isArray(c?.applies_to) ? c.applies_to : [])) {
        flagged.add(String(p).replace(/^\.\//, "").replace(/\\/g, "/"));
      }
    }
    for (const i of imported) {
      if (!i.fmOk) continue;
      const rel = i.destRel.replace(/^\.\//, "");
      if (flagged.has(rel)) continue;
      customs.push({
        id: `skill-${i.func.toLowerCase()}`,
        description: i.description,
        rule: "Project-authored /321 skill with no canonical 321_STD equivalent.",
        applies_to: [rel],
      });
      flagged.add(rel);
      provenance++;
    }
    if (provenance > 0) {
      index.customizations = customs;
      await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
    }
  }

  console.log(`\nimport-skills: ${imported.length} imported, ${collisions.length} collision(s), ${already.length} already present, ${malformed.length} malformed.`);
  if (dryRun) {
    console.log("import-skills: --dry-run, nothing written.");
    return;
  }
  if (provenance > 0) {
    console.log(`  recorded ${provenance} customizations[] provenance entr${provenance === 1 ? "y" : "ies"} (net-new, no base).`);
  }
  if (imported.length > 0) {
    console.log(`Next: node AIDOCS/tools/memory.mjs sync   (register the imported skill[s])`);
  }
  if (collisions.length > 0) {
    console.log(`Then: /321 -Update   (merge each collision as canonical base + delta, with its base hash)`);
  }
}

// Walk a source dir for skill bodies. The legacy 321 layout names them by the
// SKILL/SKILLS_<FUNC> pattern (folder and file), so those match by name. A foreign
// dir (a real .claude/skills tree handed in by the reconcile late-scan) holds bare
// SKILL.md files - include those, and any other .md only when it carries skill
// frontmatter, so a stray README is not imported.
async function collectSkillFiles(dir) {
  const out = [];
  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) { await walk(p); continue; }
      if (!e.isFile() || !/\.md$/i.test(e.name)) continue;
      if (/(?:^|_)SKILLS?_.+\.md$/i.test(e.name) || /^SKILL\.md$/i.test(e.name)) { out.push(p); continue; }
      const fm = parseFrontmatter(await readFile(p, "utf8"));
      if (fm.name) out.push(p);
    }
  }
  await walk(dir);
  return out.sort();
}

// Derive the canonical <FUNC> (uppercase-kebab) from a source path. Prefer the
// explicit SKILL/SKILLS_<FUNC> token in the filename, then in the containing folder
// (covers the legacy SKILLS_<FUNC>/<PROJECT>_SKILLS_<FUNC>.md layout). Fall back to
// the folder or filename stem for a foreign bare SKILL.md.
function deriveFunc(absPath) {
  const base = basename(absPath);
  const fileM = base.match(/(?:^|_)SKILLS?_([A-Za-z0-9][A-Za-z0-9-]*)\.md$/i);
  if (fileM) return fileM[1].toUpperCase();
  const folder = basename(dirname(absPath));
  const folderM = folder.match(/(?:^|_)SKILLS?_([A-Za-z0-9][A-Za-z0-9-]*)$/i);
  if (folderM) return folderM[1].toUpperCase();
  const stem = (folder && folder !== "." && !/^skills?$/i.test(folder)) ? folder : base.replace(/\.md$/i, "");
  return stem.replace(/[_\s]+/g, "-").toUpperCase();
}
