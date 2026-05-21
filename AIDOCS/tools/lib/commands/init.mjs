// init.mjs - scaffold a 321_STD project at <target-dir>.
//
// File classes:
//   engine    - the router, skill bodies, engine code, schema. Always overwritten.
//               These define how 321_STD works and must stay current.
//   scaffold  - generated project files (AGENTS.md, _index.json, MEMORY.md, etc.).
//               Written only if missing, so re-runs never clobber user content.
//               --force overrides this and rewrites scaffold files too.
//   dir-only  - empty scaffolds (TEMP, AIDOCS/ENV, archives). Created if missing,
//               contents never touched.
//
// Auto-memory setup is included: resolves <home>/.claude/projects/<key>/memory,
// writes the resolved path into _index.json, creates the dir if missing, and
// merge-copies AIDOCS/automemory/* contents (existing files preserved).
//
// release_profile is auto-detected from project signals (package.json,
// wrangler.toml, framework configs) when --release-profile is omitted.
//
// Flags:
//   --name <PROJECT>                 project name (required)
//   [--release-profile <profile>]    overrides auto-detect
//   [--force]                        rewrite scaffold files even if they exist
//   [--dry-run]                      print the write plan + install contract, write nothing

import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { err, parseFlags, requireOpt } from "../cli.mjs";
import { REPO_ROOT } from "../paths.mjs";
import {
  agentsTemplate, backlogTemplate, changelogTemplate, devAuditStarter,
  gitignoreTemplate, indexTemplate, memoryExtendedTemplate, memoryTemplate,
  sessionExtendedTemplate, sessionTemplate,
} from "../scaffoldTemplates.mjs";

const VALID_PROFILES = ["standards", "npm-package", "vscode-extension", "cloudflare-worker", "cloudflare-pages", "static-site", "none"];

export async function cmdInit(_index, args) {
  // Target is the first positional and must come first. Scanning for "any
  // non-flag token" would grab a flag value (the NAME in `init --name Foo
  // ./target`) and silently scaffold into the wrong path.
  const targetArg = args[0];
  if (!targetArg || targetArg.startsWith("--")) {
    err("init requires a target directory as the first argument. Usage: node AIDOCS/tools/memory.mjs init <target-dir> --name <PROJECT>");
    process.exit(5);
  }
  const opts = parseFlags(args, ["name", "release-profile", "force", "dry-run"]);
  requireOpt(opts, "name");

  const project = opts.name;
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(project)) {
    err(`init: --name must start with a letter and contain only letters / digits / _ / - (got "${project}")`);
    process.exit(5);
  }

  // --dry-run prints the full write plan + the install contract and writes
  // nothing, so an agent can confirm the exact effect (and trust the stated
  // guarantees) without auditing this source or running it for real.
  const dryRun = opts["dry-run"] === true;
  const force = opts.force === true;

  const target = resolve(process.cwd(), targetArg);
  if (!dryRun) await mkdir(target, { recursive: true });

  const explicitProfile = opts["release-profile"];
  const profile = explicitProfile || await detectProfile(target);
  if (!VALID_PROFILES.includes(profile)) {
    err(`init: --release-profile must be one of: ${VALID_PROFILES.join(", ")} (got "${profile}")`);
    process.exit(5);
  }

  const autoMemoryPath = resolveAutoMemoryPath(target);
  const verb = dryRun ? "would " : "";

  console.log(dryRun
    ? `init --dry-run: plan for "${project}" at ${target} (NO writes)`
    : `init: scaffolding "${project}" at ${target}`);
  console.log(`  release_profile: ${profile}${explicitProfile ? "" : " (auto-detected)"}`);
  console.log(`  auto_memory.path: ${autoMemoryPath}`);

  // Engine: always overwrite. Defines how 321_STD operates. Skill bodies
  // (AIDOCS/SKILL) are handled separately below - engine-class, but preserving
  // any body a project has flagged in customizations[].
  const engineCopies = [
    ".claude/skills/321/SKILL.md",
    "AIDOCS/tools/memory.mjs",
    "AIDOCS/tools/lib",
    "AIDOCS/tools/staging/SCHEMA.json",
    "AIDOCS/tools/staging/session-update.example.json",
    "AIDOCS/tools/staging/memory-update.example.json",
  ];
  const repoIsTarget = resolve(REPO_ROOT) === resolve(target);
  for (const rel of engineCopies) {
    const srcPath = join(REPO_ROOT, rel);
    const dstPath = join(target, rel);
    if (!existsSync(srcPath)) {
      console.log(`  [engine] skipped: ${rel} (not present in source)`);
      continue;
    }
    if (repoIsTarget) {
      console.log(`  [engine] in-place: ${rel}`);
      continue;
    }
    const replacing = existsSync(dstPath);
    if (!dryRun) {
      await mkdir(join(dstPath, ".."), { recursive: true });
      await cp(srcPath, dstPath, { recursive: true, force: true });
    }
    console.log(`  [engine] ${verb}${replacing ? "replace" : "write"}: ${rel}`);
  }

  // Skill bodies: engine-class, but a body flagged in the target's customizations[]
  // is preserved - a project's customized pipeline (its SKILL_AUTO-PUSH, say) must
  // survive an engine update. Fresh install has no customizations, so all write.
  const srcSkillDir = join(REPO_ROOT, "AIDOCS", "SKILL");
  const preservedSkills = repoIsTarget ? new Set() : await readPreservedSkills(target);
  if (repoIsTarget) {
    console.log(`  [skill] in-place: AIDOCS/SKILL`);
  } else if (existsSync(srcSkillDir)) {
    for (const file of await readdir(srcSkillDir)) {
      const rel = `AIDOCS/SKILL/${file}`;
      const dstPath = join(target, rel);
      if (preservedSkills.has(rel) && existsSync(dstPath)) {
        console.log(`  [skill] ${verb}preserve: ${rel} (customized, in customizations[])`);
        continue;
      }
      const replacing = existsSync(dstPath);
      if (!dryRun) {
        await mkdir(join(dstPath, ".."), { recursive: true });
        await cp(join(srcSkillDir, file), dstPath, { force: true });
      }
      console.log(`  [skill] ${verb}${replacing ? "replace" : "write"}: ${rel}`);
    }
  }

  // Scaffold: write if missing (or always if --force). User content protected.
  const scaffolds = [
    { dst: "CLAUDE.md", content: () => readFile(join(REPO_ROOT, "CLAUDE.md"), "utf8") },
    { dst: "AGENTS.md", content: () => agentsTemplate(project) },
    { dst: "AIDOCS/_index.json", content: () => indexTemplate(project, profile, autoMemoryPath) },
    { dst: `AIDOCS/${project}_MEMORY.md`, content: () => memoryTemplate(project) },
    { dst: `AIDOCS/${project}_MEMORY_EXTENDED.md`, content: () => memoryExtendedTemplate(project) },
    { dst: `AIDOCS/${project}_SESSION.md`, content: () => sessionTemplate(project) },
    { dst: `AIDOCS/${project}_SESSION_EXTENDED.md`, content: () => sessionExtendedTemplate(project) },
    { dst: `AIDOCS/${project}_DEV-AUDIT.md`, content: () => devAuditStarter(project) },
    { dst: `AIDOCS/${project}_BACKLOG.md`, content: () => backlogTemplate(project) },
    { dst: "CHANGELOG.md", content: () => changelogTemplate(project) },
    { dst: ".gitignore", content: () => gitignoreTemplate() },
  ];
  for (const { dst, content } of scaffolds) {
    const dstPath = join(target, dst);
    const exists = existsSync(dstPath);
    if (exists && !force) {
      console.log(`  [scaffold] ${verb}keep: ${dst} (already exists)`);
      continue;
    }
    if (dryRun) {
      console.log(`  [scaffold] ${verb}${exists ? "rewrite" : "write"}: ${dst}`);
      continue;
    }
    await mkdir(join(dstPath, ".."), { recursive: true });
    const body = await content();
    if (body == null) {
      console.log(`  [scaffold] skipped: ${dst} (no source content)`);
      continue;
    }
    await writeFile(dstPath, body, "utf8");
    console.log(`  [scaffold] ${exists ? "rewrote" : "wrote"}: ${dst}`);
  }

  // Dir-only: create if missing, never touch contents.
  const emptyDirs = [
    "TEMP", "AIDOCS/ENV",
    "WDDOCS", "WDDOCS/ARCHIVE", "WDDOCS/RELEASES", "WDDOCS/DESIGN", "WDDOCS/IDEAS",
    `AIDOCS/${project}_MEMORY_ARCHIVE`, `AIDOCS/${project}_SESSION_ARCHIVE`,
    `AIDOCS/${project}_BACKLOG_ARCHIVE`, `AIDOCS/${project}_SETUP_ARCHIVE`,
  ];
  for (const d of emptyDirs) {
    const path = join(target, d);
    const created = !existsSync(path);
    const gitkeep = join(path, ".gitkeep");
    const needsGitkeep = !existsSync(gitkeep);
    if (!dryRun) {
      await mkdir(path, { recursive: true });
      if (needsGitkeep) await writeFile(gitkeep, "", "utf8");
    }
    if (created) console.log(`  [dir] ${verb}create: ${d}`);
    else if (needsGitkeep) console.log(`  [dir] ${verb}write: ${d}/.gitkeep`);
  }

  // Auto-memory: create dir + merge-copy template files (skip existing).
  await populateAutoMemory(autoMemoryPath, dryRun);

  if (dryRun) {
    printInstallContract(target, autoMemoryPath);
    return;
  }

  console.log(`\ninit: done.`);
  console.log(`Next steps:`);
  console.log(`  cd "${target}"`);
  console.log(`  node AIDOCS/tools/memory.mjs sync      # populate skills.dispatch`);
  console.log(`  node AIDOCS/tools/memory.mjs doctor --structural-only   # verify the scaffold`);
  console.log(`  Open in your editor and run /321 -Setup (optional - first-run wizard or migration, auto-detected).`);
}

// Auto-detect release_profile from project signals when --release-profile is
// omitted. First match wins; falls back to "standards" when nothing is detected.
async function detectProfile(target) {
  const pkgPath = join(target, "package.json");
  if (existsSync(pkgPath)) {
    try {
      let raw = await readFile(pkgPath, "utf8");
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const pkg = JSON.parse(raw);
      if (pkg.engines?.vscode) return "vscode-extension";
      if (existsSync(join(target, "extension.json"))) return "vscode-extension";
      if (pkg.bin) return "npm-package";
    } catch {
      // Malformed package.json - fall through to other detectors.
    }
  }
  if (existsSync(join(target, "wrangler.toml")) || existsSync(join(target, "wrangler.jsonc"))) return "cloudflare-worker";
  if (existsSync(join(target, "_redirects")) || existsSync(join(target, "functions"))) return "cloudflare-pages";
  const staticSiteConfigs = ["astro.config.mjs", "astro.config.js", "astro.config.ts",
                             "next.config.mjs", "next.config.js", "next.config.ts",
                             "vite.config.mjs", "vite.config.js", "vite.config.ts"];
  for (const c of staticSiteConfigs) {
    if (existsSync(join(target, c))) return "static-site";
  }
  return "standards";
}

// Mirror Claude Code's per-machine project-key derivation: drive letter
// lowercased, then [/\\:_] -> "-". Example: C:\Dev\321_STD -> c--Dev-321-STD
function deriveClaudeProjectKey(absPath) {
  let s = absPath;
  s = s.replace(/^([A-Z]):/, (_, d) => `${d.toLowerCase()}:`);
  s = s.replace(/[/\\:_]/g, "-");
  return s;
}

function resolveAutoMemoryPath(target) {
  const key = deriveClaudeProjectKey(target);
  return join(homedir(), ".claude", "projects", key, "memory");
}

// Create the auto-memory dir and merge-copy AIDOCS/automemory/* into it.
// Existing files at the destination are preserved (user's personal rules win).
async function populateAutoMemory(autoMemoryPath, dryRun = false) {
  const src = join(REPO_ROOT, "AIDOCS", "automemory");
  if (!existsSync(src)) {
    console.log(`  [auto-memory] skipped: source missing (${src})`);
    return;
  }
  const created = !existsSync(autoMemoryPath);
  if (!dryRun) await mkdir(autoMemoryPath, { recursive: true });
  if (created) console.log(`  [auto-memory] ${dryRun ? "would create" : "created"}: ${autoMemoryPath}`);

  const entries = await readdir(src, { withFileTypes: true });
  let wrote = 0, kept = 0;
  for (const e of entries) {
    if (!e.isFile()) continue;
    const srcFile = join(src, e.name);
    const dstFile = join(autoMemoryPath, e.name);
    if (existsSync(dstFile)) {
      kept++;
      continue;
    }
    if (!dryRun) await cp(srcFile, dstFile);
    wrote++;
  }
  console.log(`  [auto-memory] ${dryRun ? "would merge" : "merged"}: ${wrote} new, ${kept} preserved`);
}

// The install contract: what init touches and the guarantees it honors. Printed
// by --dry-run so an agent can trust these properties instead of auditing this
// source or running the install to find out.
function printInstallContract(target, autoMemoryPath) {
  console.log(`\ninit --dry-run: nothing was written. The contract a real run honors:`);
  console.log(`  - Scope: writes land only inside ${target} and the per-machine`);
  console.log(`    auto-memory dir (${autoMemoryPath}). Nothing else on the machine is touched.`);
  console.log(`  - Auto-memory is merge-copy: an existing file there is never overwritten.`);
  console.log(`  - Engine files (the /321 router, AIDOCS/tools) are always replaced.`);
  console.log(`  - Skill bodies (AIDOCS/SKILL) are replaced too, EXCEPT any body listed in`);
  console.log(`    _index.json customizations[] - a project's customized skill is preserved.`);
  console.log(`  - Scaffold files (CLAUDE.md, AGENTS.md, CHANGELOG.md, .gitignore, the project`);
  console.log(`    docs) are kept if they already exist - your content is preserved.`);
  console.log(`  - No network calls and no execution of fetched code. init is local and offline.`);
  console.log(`  Re-run without --dry-run to apply.`);
}

// Read the target's existing _index.json customizations[] and return the set of
// skill-body paths (AIDOCS/SKILL/SKILL_*.md, forward-slash) flagged "do not
// overwrite". A customized skill body is preserved across an engine update; a
// fresh target (or a malformed index) yields an empty set, so all generics write.
async function readPreservedSkills(target) {
  const set = new Set();
  const idxPath = join(target, "AIDOCS", "_index.json");
  if (!existsSync(idxPath)) return set;
  try {
    const idx = JSON.parse(await readFile(idxPath, "utf8"));
    const customs = Array.isArray(idx.customizations) ? idx.customizations : [];
    for (const c of customs) {
      for (const p of (Array.isArray(c?.applies_to) ? c.applies_to : [])) {
        const norm = String(p).replace(/^\.\//, "").replace(/\\/g, "/");
        if (/^AIDOCS\/SKILL\/SKILL_.+\.md$/.test(norm)) set.add(norm);
      }
    }
  } catch { /* malformed index: preserve nothing, init writes fresh generics */ }
  return set;
}
