// migrate-import-audit.mjs - the --audit feature of migrate-import: diff the parsed
// archived entries against the distilled EXTENDED's surviving headings, and for each
// archived entry with no verbatim survivor surface fuzzy candidates from those headings.
// The shared parseEntries in migrate-import.mjs hands the entries in already-parsed.
// The reconcile pass
// runs this read-only to confirm every archived entry is either accounted for or
// deliberately dropped, with the fuzzy candidates flagging likely merges/rewrites so the
// AI is not hand-walking every archived title against every survivor. Separate file
// because the import flow (parse + stage + write) and the audit feature (read + diff +
// surface) are distinct concerns sharing only the parsed entries shape.

import { existsSync, readFileSync } from "node:fs";

import { slugify } from "./markdown.mjs";
import { resolveFile } from "./paths.mjs";

// --audit (read-only): re-parse the archive and diff it against the distilled EXTENDED,
// surfacing archived entries with no surviving ### sub-section. A rewrite (kept under a
// new title) shows up alongside true merges and drops, so this lists candidates to
// confirm, not a clean loss list - the AI judges each. For each "gone" entry, fuzzy-match
// against surviving slugs and surface the top 1-2 candidates so the AI sees a likely
// merge / rewrite target alongside the loss list, rather than hand-walking every gone
// title against every surviving heading.
export function auditImport(index, extKey, entries, from) {
  const extPath = resolveFile(index, extKey);
  if (!existsSync(extPath)) { console.error(`migrate-import --audit: ${extKey} not found on disk`); process.exit(16); }
  const surviving = new Set();
  for (const line of readFileSync(extPath, "utf8").split("\n")) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m) surviving.add(slugify(m[1]));
  }
  const goneEntries = entries.filter((e) => !surviving.has(slugify(e.title)));
  const survived = entries.length - goneEntries.length;
  console.log(`migrate-import --audit: ${entries.length} archived entr${entries.length === 1 ? "y" : "ies"} from ${from}, ${survived} survive verbatim, ${goneEntries.length} not found.`);
  if (goneEntries.length === 0) { console.log("  every archived entry has a verbatim survivor."); return; }
  console.log("  not found verbatim (merged, rewritten, or intentionally dropped) - confirm each:");
  const survivingArr = [...surviving];
  for (const e of goneEntries) {
    console.log(`  - ${e.title}`);
    for (const match of fuzzyMatches(slugify(e.title), survivingArr)) {
      console.log(`      possible match: ${match}`);
    }
  }
}

// Token fuzzy match: split each slug on hyphens, ignore tokens shorter than three
// chars (the / a / of / etc). Score by the better of Jaccard (good for similar-length
// rewrites) and containment of the smaller side (good for headline trims where the
// distilled survivor is much shorter than the archive). A noise gate requires at
// least two meaningful tokens overlap, so a single common word does not match. Returns
// the top candidates at or above either threshold, capped at two so a noisy mid-score
// match does not crowd the report.
function fuzzyMatches(goneSlug, survivingSlugs, jaccardThreshold = 0.4, containmentThreshold = 0.7, limit = 2) {
  const goneTokens = tokensOf(goneSlug);
  if (goneTokens.size === 0) return [];
  const scored = [];
  for (const surv of survivingSlugs) {
    const survTokens = tokensOf(surv);
    if (survTokens.size === 0) continue;
    let inter = 0;
    for (const t of goneTokens) if (survTokens.has(t)) inter++;
    if (inter < 2) continue;
    const union = goneTokens.size + survTokens.size - inter;
    const jaccard = union === 0 ? 0 : inter / union;
    const containment = inter / Math.min(goneTokens.size, survTokens.size);
    if (jaccard >= jaccardThreshold || containment >= containmentThreshold) {
      scored.push({ slug: surv, score: Math.max(jaccard, containment) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.slug);
}

function tokensOf(slug) {
  const out = new Set();
  for (const t of slug.split("-")) if (t.length >= 3) out.add(t);
  return out;
}
