// sync.mjs - rebuild skills.dispatch in _index.json from the skill bodies in
// AIDOCS/SKILL/. The filename derives the flag (-SessionUpdate) and the domain
// key (sessionupdate). The frontmatter description rides along for the router.
// Registering a skill is file placement + sync, never a hand edit of the registry.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fromRoot, indexPath } from "./paths.mjs";

// "SKILL_SESSION-UPDATE.md" -> flag "-SessionUpdate", key "sessionupdate".
function flagFromFilename(file) {
  const stem = file.replace(/^SKILL_/, "").replace(/\.md$/, "");
  const camel = stem.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("");
  return { flag: `-${camel}`, key: camel.toLowerCase() };
}

function frontmatterDescription(content) {
  const block = content.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return "";
  const line = block[1].match(/^description:\s*(.+)$/m);
  return line ? line[1].trim() : "";
}

export function cmdSync(index, args) {
  const bodiesRel = index.paths?.skills_bodies;
  if (!bodiesRel) { console.error("sync: paths.skills_bodies not registered"); process.exit(10); }
  const dir = fromRoot(bodiesRel);
  const dispatch = {};
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => /^SKILL_.+\.md$/.test(f)).sort()) {
      const { flag, key } = flagFromFilename(file);
      const desc = frontmatterDescription(readFileSync(join(dir, file), "utf8"));
      dispatch[key] = { flag, body: `${bodiesRel.replace(/\/$/, "")}/${file}`, description: desc };
    }
  }
  index.skills = { router: index.skills?.router || "/321", dispatch };
  const dryRun = args.includes("--dry-run");
  if (!dryRun) writeFileSync(indexPath(), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  const flags = Object.values(dispatch).map((d) => d.flag).join(", ") || "(none)";
  console.log(`sync: ${Object.keys(dispatch).length} skill(s) registered${dryRun ? " (dry-run)" : ""}: ${flags}`);
}
