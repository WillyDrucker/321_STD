// init.mjs - reproduce the source project's skeleton into a target directory. The
// source is this repo's own (dogfood) skeleton, so the template is real, formed
// files, not strings baked into code. The engine and auto-memory copy verbatim
// (project-agnostic). The project docs copy with the source project name
// substituted to the target name - this is where the <PROJECT> prefix is finally
// instantiated to a real name.

import { existsSync, readdirSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { installLog } from "./installLog.mjs";
import { SOURCE_ROOT } from "./paths.mjs";

const VERBATIM_ROOT = ["CLAUDE.md", ".gitignore"];   // no project name inside
const SUBSTITUTED_ROOT = ["AGENTS.md", "CHANGELOG.md"]; // project name in content
const STOCK_DIRS = ["WDDOCS/DESIGN", "WDDOCS/ARCHIVE", "WDDOCS/RELEASES", "WDDOCS/IDEAS", "AIDOCS/ENV", "AIDOCS/tools/staging", "TEMP"];

// Coarse, content-free recognition of what already sits at the target, so the install can
// report what it found and point at the right next step. Existence-only, never parses, so a
// malformed _index.json or a half-written data file still reads as "existing". The real
// per-file determination is the AI's job in -Setup, made safe there by migrate-archive.
function hasDataDoc(aidocsDir) {
  if (!existsSync(aidocsDir)) return false;
  try { return readdirSync(aidocsDir).some((f) => /_(MEMORY|SESSION)\.md$/.test(f)); }
  catch { return false; }
}
function recognizeTarget(target) {
  const has = (...p) => existsSync(join(target, ...p));
  if (has(".claude", "skills", "321") || has("AIDOCS", "_index.json") || hasDataDoc(join(target, "AIDOCS"))) {
    return "existing-321";
  }
  if (has("AGENTS.md") || has("CLAUDE.md") || has("README.md") || has("package.json") || has("src") || has("AIDOCS")) {
    return "generic-existing";
  }
  return "fresh";
}

export async function cmdInit(args) {
  const targetArg = args[0];
  if (!targetArg || targetArg.startsWith("--")) {
    console.error("init requires a target directory as the first argument. Usage: init <target-dir> --name <PROJECT>");
    process.exit(5);
  }
  const nameIdx = args.indexOf("--name");
  const name = nameIdx >= 0 ? args[nameIdx + 1] : null;
  if (!name || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
    console.error("init requires --name <PROJECT> (start with a letter, then letters / digits / _ / - only).");
    process.exit(5);
  }
  const force = args.includes("--force");
  const target = resolve(process.cwd(), targetArg);
  if (SOURCE_ROOT === target) { console.error("init: refusing to scaffold over the source project."); process.exit(5); }
  const kind = recognizeTarget(target);

  const sourceIndex = join(SOURCE_ROOT, "AIDOCS", "_index.json");
  const source = JSON.parse(await readFile(sourceIndex, "utf8"));
  const sourceName = source.project_name;
  const sub = (s) => s.split(sourceName).join(name);

  await mkdir(join(target, "AIDOCS"), { recursive: true });

  // 1. Project-agnostic, verbatim: the engine, the skill bodies + router, and the
  // auto-memory rules. Skill bodies reference files by domain-owned key, not by
  // project name, so they need no substitution.
  // The engine, minus machine-local runtime files: a dogfooded source may carry a
  // staging/ or state.json, which belong to the source project, not a fresh one.
  await cp(join(SOURCE_ROOT, "AIDOCS", "tools"), join(target, "AIDOCS", "tools"), {
    recursive: true,
    filter: (src) => { const b = src.split(/[\\/]/).pop(); return b !== "state.json" && b !== "staging"; },
  });
  await cp(join(SOURCE_ROOT, "AIDOCS", "automemory"), join(target, "AIDOCS", "automemory"), { recursive: true });
  await cp(join(SOURCE_ROOT, "AIDOCS", "SKILL"), join(target, "AIDOCS", "SKILL"), { recursive: true });
  const routerSrc = join(SOURCE_ROOT, ".claude", "skills", "321", "SKILL.md");
  if (existsSync(routerSrc)) {
    await mkdir(join(target, ".claude", "skills", "321"), { recursive: true });
    await cp(routerSrc, join(target, ".claude", "skills", "321", "SKILL.md"));
  }

  // The onboarding reference files (INSTALL/setup.md and friends): read-and-execute
  // runbooks the -Setup runner follows. Project-agnostic (they use the <PROJECT>
  // placeholder in command examples), and removed wholesale at graduation. Skip a
  // fetched engine if one is staged in the source - that is runtime, not template.
  const installSrc = join(SOURCE_ROOT, "INSTALL");
  if (existsSync(installSrc)) {
    await cp(installSrc, join(target, "INSTALL"), {
      recursive: true,
      filter: (src) => src.split(/[\\/]/).pop() !== "engine",
    });
  }

  // 2-4. Scaffold-class files: the root docs (verbatim plus name-substituted), the
  // registry, and the registered data files. Write-if-missing so an install over an
  // existing project never clobbers content - the engine and runbooks above always
  // overwrite because they hold no project data, but these may. --force rewrites the
  // scaffold too. An existing data file is left for the -Setup migration to archive.
  const scaffolds = [];
  for (const f of VERBATIM_ROOT) {
    const srcAbs = join(SOURCE_ROOT, f);
    if (existsSync(srcAbs)) scaffolds.push({ dst: join(target, f), body: await readFile(srcAbs, "utf8") });
  }
  for (const f of SUBSTITUTED_ROOT) {
    scaffolds.push({ dst: join(target, f), body: sub(await readFile(join(SOURCE_ROOT, f), "utf8")) });
  }
  scaffolds.push({ dst: join(target, "AIDOCS", "_index.json"), body: sub(await readFile(sourceIndex, "utf8")) });
  for (const rel of Object.values(source.files)) {
    const srcAbs = join(SOURCE_ROOT, rel.replace(/^\.\//, ""));
    scaffolds.push({ dst: join(target, sub(rel).replace(/^\.\//, "")), body: sub(await readFile(srcAbs, "utf8")) });
  }
  let wrote = 0, kept = 0;
  for (const { dst, body } of scaffolds) {
    if (!force && existsSync(dst)) { kept++; continue; }
    await mkdir(dirname(dst), { recursive: true });
    await writeFile(dst, body, "utf8");
    wrote++;
  }
  console.log(`  scaffold: ${wrote} written, ${kept} preserved${force ? " (--force)" : ""}.`);
  installLog(target, `init: ${kind} target, scaffold ${wrote} written, ${kept} preserved${force ? " (--force)" : ""}.`);

  // 5. Stock empty dirs (kept by a .gitkeep so they survive a commit). The
  // name-based SETUP_ARCHIVE is the migration recovery-net home, preseeded so
  // migrate-archive has a place to move content into.
  for (const d of [...STOCK_DIRS, `AIDOCS/${name}_SETUP_ARCHIVE`]) {
    await mkdir(join(target, d), { recursive: true });
    await writeFile(join(target, d, ".gitkeep"), "", "utf8");
  }

  console.log(`init: laid ${sourceName} skeleton into ${target} as "${name}".`);
  if (kind === "fresh") {
    console.log(`  fresh project. Next: /321 -Setup to fill the Big 6 from your code.`);
  } else if (kind === "existing-321") {
    console.log(`  recognized an existing 321 project. Existing content preserved. Next: /321 -Setup to migrate it.`);
  } else {
    console.log(`  recognized an existing project (no 321 yet). Your files are untouched. Next: /321 -Setup to capture it.`);
  }
  console.log(`  doctor: node "${join(target, "AIDOCS", "tools", "engine.mjs")}" doctor`);
}
