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
  const opts = parseFlags(args, ["name", "release-profile", "force"]);
  requireOpt(opts, "name");

  const project = opts.name;
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(project)) {
    err(`init: --name must start with a letter and contain only letters / digits / _ / - (got "${project}")`);
    process.exit(5);
  }

  const target = resolve(process.cwd(), targetArg);
  await mkdir(target, { recursive: true });

  const explicitProfile = opts["release-profile"];
  const profile = explicitProfile || await detectProfile(target);
  if (!VALID_PROFILES.includes(profile)) {
    err(`init: --release-profile must be one of: ${VALID_PROFILES.join(", ")} (got "${profile}")`);
    process.exit(5);
  }

  const force = opts.force === true;
  const autoMemoryPath = resolveAutoMemoryPath(target);

  console.log(`init: scaffolding "${project}" at ${target}`);
  console.log(`  release_profile: ${profile}${explicitProfile ? "" : " (auto-detected)"}`);
  console.log(`  auto_memory.path: ${autoMemoryPath}`);

  // Engine: always overwrite. Defines how 321_STD operates.
  const engineCopies = [
    ".claude/skills/321/SKILL.md",
    "AIDOCS/SKILL",
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
    await mkdir(join(dstPath, ".."), { recursive: true });
    await cp(srcPath, dstPath, { recursive: true, force: true });
    console.log(`  [engine] ${rel}`);
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
    if (existsSync(dstPath) && !force) {
      console.log(`  [scaffold] kept: ${dst} (already exists)`);
      continue;
    }
    await mkdir(join(dstPath, ".."), { recursive: true });
    const body = await content();
    if (body == null) {
      console.log(`  [scaffold] skipped: ${dst} (no source content)`);
      continue;
    }
    await writeFile(dstPath, body, "utf8");
    console.log(`  [scaffold] ${force && existsSync(dstPath) ? "rewrote" : "wrote"}: ${dst}`);
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
    await mkdir(path, { recursive: true });
    const gitkeep = join(path, ".gitkeep");
    if (!existsSync(gitkeep)) {
      await writeFile(gitkeep, "", "utf8");
    }
    if (created) console.log(`  [dir] created: ${d}`);
  }

  // Auto-memory: create dir + merge-copy template files (skip existing).
  await populateAutoMemory(autoMemoryPath);

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
async function populateAutoMemory(autoMemoryPath) {
  const src = join(REPO_ROOT, "AIDOCS", "automemory");
  if (!existsSync(src)) {
    console.log(`  [auto-memory] skipped: source missing (${src})`);
    return;
  }
  const created = !existsSync(autoMemoryPath);
  await mkdir(autoMemoryPath, { recursive: true });
  if (created) console.log(`  [auto-memory] created: ${autoMemoryPath}`);

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
    await cp(srcFile, dstFile);
    wrote++;
  }
  console.log(`  [auto-memory] merged: ${wrote} new, ${kept} preserved`);
}
