// prose.mjs - the house-voice linter shared by doctor (the gate) and scrub (gate
// plus fix). Owns three things: which files count as authored prose, how to find
// banned characters in them (em dashes and semicolons, skipping code fences and
// inline code), and how to mechanically fix the safe case. Em dashes rewrite to
// " - ". Semicolons are flagged, never auto-removed, because removing one changes
// the sentence.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { fromRoot } from "./paths.mjs";

// The authored-prose files: AGENTS, CHANGELOG, the router, every registered data
// file, the skill bodies, and the INSTALL runbooks while they exist. Skips the rule
// file that documents the characters and anything not on disk. Code comments are not
// scanned (this is a markdown-prose scanner) - the audit enforces the rule there.
export function authoredTargets(index) {
  const set = new Set();
  if (index.paths?.agents_md) set.add(fromRoot(index.paths.agents_md));
  if (index.paths?.changelog) set.add(fromRoot(index.paths.changelog));
  if (index.paths?.skills_router) set.add(fromRoot(index.paths.skills_router));
  for (const p of Object.values(index.files || {})) set.add(fromRoot(p));
  const bodiesRel = index.paths?.skills_bodies;
  if (bodiesRel) {
    const dir = fromRoot(bodiesRel);
    if (existsSync(dir)) for (const f of readdirSync(dir).filter((f) => /^SKILL_.+\.md$/.test(f))) set.add(join(dir, f));
  }
  const installDir = fromRoot("./INSTALL");
  if (existsSync(installDir)) for (const f of readdirSync(installDir).filter((f) => /\.md$/.test(f))) set.add(join(installDir, f));
  return [...set].filter((abs) => existsSync(abs) && !/feedback_no_em_dashes\.md$/.test(abs));
}

// Banned characters in authored prose, skipping code fences and inline code.
export function scanBanned(content) {
  const out = [];
  let inFence = false;
  content.split("\n").forEach((line, i) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    const prose = line.replace(/`[^`]*`/g, "");
    if (prose.includes("—")) out.push({ line: i + 1, kind: "em dash" });
    if (prose.includes(";")) out.push({ line: i + 1, kind: "semicolon" });
  });
  return out;
}

// Rewrite em dashes to " - " in prose, never inside code fences or inline code.
// Returns the new content and the count rewritten. Semicolons are left alone -
// removing one changes meaning, so scrub flags them for a human instead.
export function fixEmDashes(content) {
  let count = 0;
  let inFence = false;
  const lines = content.split("\n").map((line) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return line; }
    if (inFence || !line.includes("—")) return line;
    return line.replace(/(`[^`]*`)|\s*—\s*/g, (m, code) => (code ? code : (count++, " - ")));
  });
  return { content: lines.join("\n"), count };
}
