// bigsixDrift.mjs - catches a MEMORY Big-6 that went stale against the code. The lean
// -UpdateMemory pass only fills EMPTY Big-6 sections, so a populated and wrong one is
// invisible to every routine run. The signal is the dependency-NAME set the code-bound
// sections were last written against: never versions (a bump is not drift), never prose
// (Stack legitimately says "there is no react-navigation"). A missing, unrecognized or
// unparseable manifest returns null and the check goes silent, since a missing check beats
// a lying one. A manifest that parses to no dependencies is an empty set, not silence, so
// removing the last package still reads as drift.

import { existsSync, readFileSync } from "node:fs";

import { fromRoot } from "./paths.mjs";

// The Big-6 sections that make factual claims about the toolchain. Overview and
// Conventions are narrative, so a dependency change says nothing about them.
const CODE_BOUND_SECTIONS = ["Stack", "Architecture", "Environment", "Pipeline"];

// package.json - the dependency maps, keys only.
function parsePackageJson(text) {
  const doc = JSON.parse(text);
  return [...Object.keys(doc.dependencies || {}), ...Object.keys(doc.devDependencies || {})];
}

// requirements.txt - one requirement per line. Strip comments, options (-r, --hash), and
// extras, then cut at the first comparator.
function parseRequirementsTxt(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter((l) => l && !l.startsWith("-"))
    .map((l) => l.split(/[[\s=<>~!;]/)[0].trim())
    .filter(Boolean);
}

// go.mod - the require directive in both forms: a parenthesized block, and single-line
// `require <module> <version>`. Everything else (module, go, replace, exclude) is metadata.
function parseGoMod(text) {
  const names = [];
  let inBlock = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\/\/.*$/, "").trim();
    if (!line) continue;
    if (inBlock) {
      if (line === ")") { inBlock = false; continue; }
      names.push(line.split(/\s+/)[0]);
      continue;
    }
    if (/^require\s*\($/.test(line)) { inBlock = true; continue; }
    const single = line.match(/^require\s+(\S+)/);
    if (single) names.push(single[1]);
  }
  return names.filter(Boolean);
}

// TOML (Cargo.toml, pyproject.toml). Three shapes carry dependency names. A dependency
// table ([dependencies], [dev-dependencies], [tool.poetry.dependencies], a poetry group)
// names them as keys. A dependency subtable ([dependencies.serde]) names ONE in its header
// and its keys are that package's settings. A PEP 621 array (dependencies = [...] under
// [project], or any group under [project.optional-dependencies]) names them as requirement
// strings. Nothing under [package] or [project] itself is ever a name.
const DEP_TABLE = /^\[(?:.*\.)?(?:dependencies|dev-dependencies|build-dependencies)\]$/;
const DEP_SUBTABLE = /^\[(?:.*\.)?(?:dependencies|dev-dependencies|build-dependencies)\.["']?([^\]"']+)["']?\]$/;
const REQUIREMENT_NAME = /["']([A-Za-z0-9][A-Za-z0-9_.-]*)/g;
const TABLE_KEY = /^["']?([A-Za-z0-9_.-]+)["']?\s*=/;

function parseToml(text) {
  const names = [];
  let mode = "none";          // keys | project | optional | none
  let inArray = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    if (inArray) {
      names.push(...[...line.matchAll(REQUIREMENT_NAME)].map((m) => m[1]));
      if (line.includes("]")) inArray = false;
      continue;
    }
    if (line.startsWith("[")) {
      const sub = line.match(DEP_SUBTABLE);
      if (sub) { names.push(sub[1]); mode = "none"; continue; }
      if (DEP_TABLE.test(line)) mode = "keys";
      else if (line === "[project]") mode = "project";
      else if (line === "[project.optional-dependencies]") mode = "optional";
      else mode = "none";
      continue;
    }
    const key = line.match(TABLE_KEY)?.[1];
    if (!key) continue;
    if (mode === "keys" && key !== "python") names.push(key);
    if ((mode === "project" && key === "dependencies") || mode === "optional") {
      const open = line.indexOf("[");
      if (open < 0) continue;
      const rest = line.slice(open + 1);
      names.push(...[...rest.matchAll(REQUIREMENT_NAME)].map((m) => m[1]));
      inArray = !rest.includes("]");
    }
  }
  return names;
}

const PARSERS = {
  "package.json": parsePackageJson,
  "requirements.txt": parseRequirementsTxt,
  "go.mod": parseGoMod,
  "Cargo.toml": parseToml,
  "pyproject.toml": parseToml,
};

// The sorted, unique dependency names the project's manifest declares (an empty list when it
// declares none), or null when there is no manifest, no parser for it, or it does not parse.
// Names only: an added or removed package changes the story the Big-6 tells, a version bump
// does not.
export function depNames(index) {
  const rel = index?.bigsix?.dep_manifest || "package.json";
  const abs = fromRoot(rel);
  if (!existsSync(abs)) return null;
  const parse = PARSERS[rel.split(/[\\/]/).pop()];
  if (!parse) return null;
  try {
    return [...new Set(parse(readFileSync(abs, "utf8")))].sort();
  } catch {
    return null; // an unparseable manifest is the project's problem, not a doctor error
  }
}

// True only when this run re-derived EVERY code-bound Big-6 section. Stamping on a single
// section would let a lean gap-fill of one empty section certify three populated (and
// possibly stale) ones as current, which is the exact blind spot this module exists to
// close. -FULL re-walks all four, and so does a fresh project's first gap-fill.
export function touchesCodeBoundBigSix(actions) {
  const written = new Set(
    (actions || [])
      .filter((a) => a.op === "overwrite_section" && a.file === "updatememory.memory")
      .map((a) => a.section),
  );
  return CODE_BOUND_SECTIONS.every((s) => written.has(s));
}

// Warnings, never errors. A stale Big-6 is a prompt to run -FULL, not a broken repo.
export function checkBigSixDrift(index, state) {
  const now = depNames(index);
  if (now === null) return [];

  const mark = state?.updatememory?.bigsix;
  if (!mark) {
    // A project with no dependencies has nothing to derive against, so no mark is not a gap.
    if (now.length === 0) return [];
    return [
      "MEMORY Big-6 has never been derived against a recorded dependency set, so drift cannot be detected yet. " +
        "Run `/321 -UpdateMemory -FULL` once to re-walk Stack / Architecture / Environment / Pipeline and lay the mark.",
    ];
  }
  if (!Array.isArray(mark.names)) {
    return [
      "the MEMORY Big-6 mark predates the names-only schema, so it cannot say what changed. " +
        "Run `/321 -UpdateMemory -FULL` once to re-walk Stack / Architecture / Environment / Pipeline and lay a current mark.",
    ];
  }
  const before = mark.names;
  const added = now.filter((n) => !before.includes(n));
  const removed = before.filter((n) => !now.includes(n));
  if (added.length === 0 && removed.length === 0) return [];

  const cap = (list) => `${list.slice(0, 6).join(", ")}${list.length > 6 ? ` (+${list.length - 6})` : ""}`;
  const detail = [added.length ? `added: ${cap(added)}` : null, removed.length ? `removed: ${cap(removed)}` : null]
    .filter(Boolean)
    .join(" | ");
  return [
    `dependencies changed since the Big-6 was last derived (${detail}). The lean pass will NOT re-check a populated ` +
      "Big-6, so run `/321 -UpdateMemory -FULL` to re-walk Stack / Architecture / Environment / Pipeline.",
  ];
}
