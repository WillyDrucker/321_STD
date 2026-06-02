// sync.mjs - rebuild skills.dispatch in _index.json from the skill bodies in
// AIDOCS/SKILL/. The filename derives the flag (-UpdateSession) and the domain
// key (updatesession). The frontmatter description rides along for the router.
// Registering a skill is file placement + sync, never a hand edit of the registry.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fromRoot, indexPath } from "./paths.mjs";

// "SKILL_UPDATE-SESSION.md" -> flag "-UpdateSession", key "updatesession".
function flagFromFilename(file) {
  const stem = file.replace(/^SKILL_/, "").replace(/\.md$/, "");
  const camel = stem.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("");
  return { flag: `-${camel}`, key: camel.toLowerCase() };
}

// Pull one named frontmatter field, with quote-stripping for `flag: "-MySkill"`-style values.
// Empty string when the block or field is missing, so a skill without an override just
// falls through to the filename-derived default.
function frontmatterField(content, field) {
  const block = content.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return "";
  const line = block[1].match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return line ? line[1].trim().replace(/^["']|["']$/g, "") : "";
}

export function cmdSync(index, args) {
  const bodiesRel = index.paths?.skills_bodies;
  if (!bodiesRel) { console.error("sync: paths.skills_bodies not registered"); process.exit(10); }
  const dir = fromRoot(bodiesRel);
  const dispatch = {};
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((f) => /^SKILL_.+\.md$/.test(f)).sort()) {
      const { flag: derivedFlag, key } = flagFromFilename(file);
      const fm = readFileSync(join(dir, file), "utf8");
      // The skill body may pin an explicit display flag in frontmatter (e.g. flag: "-MySkill")
      // when the filename-derived camelCase form needs a casing override. The dispatch
      // key stays lowercased so the router still matches case-insensitively either way.
      const flag = frontmatterField(fm, "flag") || derivedFlag;
      const desc = frontmatterField(fm, "description");
      dispatch[key] = { flag, body: `${bodiesRel.replace(/\/$/, "")}/${file}`, description: desc };
    }
  }
  index.skills = { router: index.skills?.router || "/321", dispatch };
  const dryRun = args.includes("--dry-run");
  if (!dryRun) writeFileSync(indexPath(), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  const flags = Object.values(dispatch).map((d) => d.flag).join(", ") || "(none)";
  console.log(`sync: ${Object.keys(dispatch).length} skill(s) registered${dryRun ? " (dry-run)" : ""}: ${flags}`);
}
