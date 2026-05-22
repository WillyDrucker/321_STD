// bigsix.mjs - the deterministic pre-fill for the two Big-6 sections a script can
// read straight from the project: Stack (language, runtime, framework, key deps) and
// Pipeline (the build / test / release scripts). It drafts fact bullets from
// package.json and the obvious config files, never prose. The MemoryUpdate skill feeds
// the draft to the AI, which writes the house-voice section and fills the four judgment
// sections (Overview / Architecture / Environment / Conventions) itself. With no
// package.json the draft is empty and every section stays the AI's to fill.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./paths.mjs";

// Framework / host markers in dependencies, most specific first so a meta-framework
// wins over the library it sits on (Next over React).
const FRAMEWORKS = [
  ["next", "Next.js"], ["nuxt", "Nuxt"], ["astro", "Astro"], ["@sveltejs/kit", "SvelteKit"],
  ["@angular/core", "Angular"], ["react-native", "React Native"], ["react", "React"],
  ["vue", "Vue"], ["svelte", "Svelte"], ["express", "Express"], ["fastify", "Fastify"],
  ["@nestjs/core", "NestJS"], ["electron", "Electron"],
];
const BUNDLERS = [["vite", "Vite"], ["webpack", "webpack"], ["esbuild", "esbuild"], ["rollup", "Rollup"], ["@vscode/vsce", "vsce (VS Code extension)"], ["vsce", "vsce (VS Code extension)"]];

function stackFacts(pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const has = (k) => Object.hasOwn(deps, k);
  const out = [];
  if (has("typescript")) out.push("Language: TypeScript");
  else if (pkg.type) out.push(`Language: JavaScript (package.json type "${pkg.type}")`);
  if (pkg.engines?.node) out.push(`Runtime: Node ${pkg.engines.node}`);
  if (pkg.engines?.vscode) out.push(`Host: VS Code ${pkg.engines.vscode}`);
  const fw = FRAMEWORKS.filter(([k]) => has(k)).map(([, n]) => n);
  if (fw.length) out.push(`Framework: ${fw.join(", ")}`);
  const bundler = BUNDLERS.find(([k]) => has(k));
  out.push(bundler ? `Bundler / packager: ${bundler[1]}` : "Bundler: none detected (confirm against the build script)");
  const runtimeDeps = Object.keys(pkg.dependencies || {});
  if (runtimeDeps.length) out.push(`Runtime deps (${runtimeDeps.length}): ${runtimeDeps.slice(0, 8).join(", ")}${runtimeDeps.length > 8 ? ", ..." : ""}`);
  out.push("Versions live in package.json - point at it, do not copy them in.");
  return out;
}

function pipelineFacts(pkg, root) {
  const out = [];
  const scripts = pkg.scripts || {};
  for (const key of ["build", "test", "lint", "package", "deploy", "publish", "start", "dev"]) {
    if (scripts[key]) out.push(`\`npm run ${key}\` runs \`${scripts[key]}\``);
  }
  const wf = join(root, ".github", "workflows");
  if (existsSync(wf)) {
    try {
      const f = readdirSync(wf).filter((x) => /\.ya?ml$/.test(x));
      if (f.length) out.push(`CI: .github/workflows (${f.join(", ")})`);
    } catch { /* unreadable workflows dir, skip */ }
  }
  if (pkg.private === true) out.push("Publish: package.json private:true, so not an npm publish target");
  return out;
}

// bigsix --suggest    print a deterministic draft of the Stack + Pipeline sections.
export function cmdBigsix(args) {
  if (!args.includes("--suggest")) { console.error("bigsix needs --suggest. Usage: bigsix --suggest"); process.exit(5); }
  const root = repoRoot();
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    console.log("bigsix --suggest: no package.json - nothing to pre-fill. The AI fills all six sections from the code scan.");
    return;
  }
  let pkg;
  try { pkg = JSON.parse(readFileSync(pkgPath, "utf8")); }
  catch (e) { console.log(`bigsix --suggest: package.json is not valid JSON (${e.message}) - the AI fills all six sections.`); return; }

  const stack = stackFacts(pkg);
  const pipeline = pipelineFacts(pkg, root);
  console.log("bigsix --suggest: deterministic draft for the two script-readable Big-6 sections.");
  console.log("Refine each into house-voice prose, then stage it as overwrite_section. Overview / Architecture / Environment / Conventions stay yours to fill from the code and conversation.\n");
  console.log("## Stack (draft)");
  for (const s of stack) console.log(`- ${s}`);
  console.log("\n## Pipeline (draft)");
  if (pipeline.length) for (const p of pipeline) console.log(`- ${p}`);
  else console.log("- no build / release scripts in package.json - derive the pipeline from the code and configs.");
}
