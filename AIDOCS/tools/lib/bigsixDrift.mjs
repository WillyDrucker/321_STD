// bigsixDrift.mjs - detects a MEMORY Big-6 that has gone stale against the code.
//
// THE FAILURE THIS EXISTS TO CATCH: the lean -UpdateMemory pass only FILLS EMPTY Big-6
// sections. It never re-derives a populated one, so a Big-6 that is populated and WRONG
// is invisible to every routine run, forever, and only -FULL re-walks it. That is how a
// MEMORY keeps describing a framework the project migrated off, which in turn pushes the
// true facts up into AGENTS.md where they do not belong.
//
// The signal is deliberately NOT prose parsing. Stack legitimately reads "there is no
// react-navigation" and a naive scan would flag its own negation. Instead we fingerprint
// the DEPENDENCY SET that Stack claims to describe. Deps changed and the Big-6 did not?
// That is drift, and it is the exact shape of the bug.
//
// NAMES ONLY, NEVER VERSIONS. Every parser below must scope itself to real dependency
// declarations. A parser that also swallows `name`, `version`, or `edition` would turn a
// routine version bump into a false drift warning, which is precisely the noise this check
// promises not to make. An unrecognized manifest returns null and the check goes silent -
// a missing check beats a lying one.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { fromRoot } from "./paths.mjs";

// The Big-6 sections that make factual claims about the toolchain. Overview / Conventions
// are narrative and do not track the dependency manifest, so a dep change says nothing
// about them.
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

// TOML (Cargo.toml, pyproject.toml). Only keys inside a DEPENDENCY table count, so
// [package] name/version/edition never reach the fingerprint. Also picks up PEP 621's
// `dependencies = [...]` array, which is a list of requirement strings rather than a table.
const TOML_DEP_TABLE = /^\[(?:.*\.)?(?:dependencies|dev-dependencies|build-dependencies|project\.optional-dependencies|tool\.poetry\.dependencies|tool\.poetry\.dev-dependencies)(?:\..*)?\]$/;

function parseToml(text) {
  const names = [];
  let inDepTable = false;
  let inDepArray = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;

    if (inDepArray) {
      if (line.startsWith("]")) { inDepArray = false; continue; }
      const dep = line.match(/^["']([^"'[\s=<>~!;]+)/);
      if (dep) names.push(dep[1]);
      continue;
    }
    // PEP 621: dependencies = ["httpx>=0.27", ...]
    if (/^(?:dependencies|optional-dependencies)\s*=\s*\[/.test(line)) {
      const inline = [...line.matchAll(/["']([^"'[\s=<>~!;]+)/g)].map((m) => m[1]);
      names.push(...inline);
      if (!line.includes("]")) inDepArray = true;
      continue;
    }
    if (line.startsWith("[")) { inDepTable = TOML_DEP_TABLE.test(line); continue; }
    if (!inDepTable) continue;
    const key = line.match(/^["']?([A-Za-z0-9_.-]+)["']?\s*=/);
    if (key) names.push(key[1]);
  }
  return names.filter(Boolean);
}

const PARSERS = {
  "package.json": parsePackageJson,
  "requirements.txt": parseRequirementsTxt,
  "go.mod": parseGoMod,
  "Cargo.toml": parseToml,
  "pyproject.toml": parseToml,
};

// Names only, never versions. A version bump is not Big-6 drift - a lockfile refresh moves
// those constantly and the Big-6 correctly points at the manifest rather than restating
// them. An ADDED or REMOVED package is what changes the story the Big-6 tells.
export function depFingerprint(index) {
  const rel = index?.bigsix?.dep_manifest || "package.json";
  const abs = fromRoot(rel);
  if (!existsSync(abs)) return null;

  // An unrecognized manifest goes silent rather than guessing. A wrong fingerprint would
  // warn forever, and a check that always cries wolf is worse than no check at all.
  const parse = PARSERS[rel.split(/[\\/]/).pop()];
  if (!parse) return null;

  let names;
  try {
    names = parse(readFileSync(abs, "utf8"));
  } catch {
    return null; // an unparseable manifest is the project's problem, not a doctor error
  }
  names = [...new Set(names)].sort();
  if (names.length === 0) return null;
  return { hash: createHash("sha256").update(names.join("\n")).digest("hex").slice(0, 16), names };
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
  const now = depFingerprint(index);
  if (!now) return [];

  const mark = state?.updatememory?.bigsix;
  if (!mark) {
    return [
      "MEMORY Big-6 has never been derived against a recorded dependency set, so drift cannot be detected yet. " +
        "Run `/321 -UpdateMemory -FULL` once to re-walk Stack / Architecture / Environment / Pipeline and lay the mark.",
    ];
  }
  if (mark.hash === now.hash) return [];

  const before = new Set(mark.names || []);
  const added = now.names.filter((n) => !before.has(n));
  const removed = (mark.names || []).filter((n) => !now.names.includes(n));
  const cap = (list) => `${list.slice(0, 6).join(", ")}${list.length > 6 ? ` (+${list.length - 6})` : ""}`;
  const detail = [added.length ? `added: ${cap(added)}` : null, removed.length ? `removed: ${cap(removed)}` : null]
    .filter(Boolean)
    .join(" | ");

  return [
    `dependencies changed since the Big-6 was last derived (${detail}). The lean pass will NOT re-check a populated ` +
      "Big-6, so run `/321 -UpdateMemory -FULL` to re-walk Stack / Architecture / Environment / Pipeline.",
  ];
}
