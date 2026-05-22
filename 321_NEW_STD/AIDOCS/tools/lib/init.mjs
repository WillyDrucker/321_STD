// init.mjs - reproduce the source project's skeleton into a target directory. The
// source is this repo's own (dogfood) skeleton, so the template is real, formed
// files, not strings baked into code. The engine and auto-memory copy verbatim
// (project-agnostic). The project docs copy with the source project name
// substituted to the target name - this is where the <PROJECT> prefix is finally
// instantiated to a real name.

import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { SOURCE_ROOT } from "./paths.mjs";

const VERBATIM_ROOT = ["CLAUDE.md", ".gitignore"];   // no project name inside
const SUBSTITUTED_ROOT = ["AGENTS.md", "CHANGELOG.md"]; // project name in content
const STOCK_DIRS = ["WDDOCS/DESIGN", "WDDOCS/ARCHIVE", "AIDOCS/ENV", "AIDOCS/tools/staging", "TEMP"];

export async function cmdInit(args) {
  const targetArg = args[0];
  if (!targetArg || targetArg.startsWith("--")) {
    console.error("init requires a target directory as the first argument. Usage: init <target-dir> --name <PROJECT>");
    process.exit(5);
  }
  const nameIdx = args.indexOf("--name");
  const name = nameIdx >= 0 ? args[nameIdx + 1] : null;
  if (!name || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
    console.error("init requires --name <PROJECT> (start with a letter; letters / digits / _ / - only).");
    process.exit(5);
  }
  const target = resolve(process.cwd(), targetArg);
  if (SOURCE_ROOT === target) { console.error("init: refusing to scaffold over the source project."); process.exit(5); }

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

  // 2. Root files with no project name: copy verbatim.
  for (const f of VERBATIM_ROOT) {
    if (existsSync(join(SOURCE_ROOT, f))) await cp(join(SOURCE_ROOT, f), join(target, f));
  }

  // 3. Docs that carry the project name: substitute it.
  for (const f of SUBSTITUTED_ROOT) {
    await writeFile(join(target, f), sub(await readFile(join(SOURCE_ROOT, f), "utf8")), "utf8");
  }
  await writeFile(join(target, "AIDOCS", "_index.json"), sub(await readFile(sourceIndex, "utf8")), "utf8");

  // 4. The registered data files: rename (source name -> target name) + substitute.
  for (const rel of Object.values(source.files)) {
    const srcAbs = join(SOURCE_ROOT, rel.replace(/^\.\//, ""));
    const dstRel = sub(rel).replace(/^\.\//, "");
    const dstAbs = join(target, dstRel);
    await mkdir(dirname(dstAbs), { recursive: true });
    await writeFile(dstAbs, sub(await readFile(srcAbs, "utf8")), "utf8");
  }

  // 5. Stock empty dirs (kept by a .gitkeep so they survive a commit).
  for (const d of STOCK_DIRS) {
    await mkdir(join(target, d), { recursive: true });
    await writeFile(join(target, d, ".gitkeep"), "", "utf8");
  }

  console.log(`init: laid ${sourceName} skeleton into ${target} as "${name}".`);
  console.log(`  next: node "${join(target, "AIDOCS", "tools", "engine.mjs")}" doctor`);
}
