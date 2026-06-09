// migrateNormalize.mjs - the token rewrites applied to archived content as it
// enters the canonical structure during a migration. Shared by migrateImport (the
// EXTENDED scavenge) and migrateRestore (the config-section copy), so a legacy
// install and a project rename normalize the same way through both lanes.

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Legacy 321 token normalization: an old 321 install is a valid migration
// source, so its renamed skill flag, doc name, and SKILLS dir map to the canonical
// ones as the content lands.
export function normalizeLegacy(content) {
  return content
    .replace(/\/321 -DevStandards/g, "/321 -DevAudit")
    .replace(/DEV-STANDARDS/g, "DEV-AUDIT")
    .replace(/AIDOCS\/SKILLS\//g, "AIDOCS/SKILL/")
    .replace(/SKILLS_([A-Z])/g, "SKILL_$1");
}

// Project rename: rewrite OLD -> NEW. Doc-filename cross-refs first (the \b pass
// below misses "<old>_MEMORY" - no word boundary before the underscore), then
// whole-word prose mentions. Conservative: whole-word only, so real identifiers
// (env vars, branches, bundle IDs) that merely contain the old name are left alone.
export function normalizeNames(content, oldName, newName) {
  const docRef = new RegExp(`\\b${escapeRegExp(oldName)}_(MEMORY_EXTENDED|SESSION_EXTENDED|MEMORY|SESSION|BACKLOG|DEV-AUDIT|DEV-STANDARDS|AUTO-PUSH)\\.md\\b`, "g");
  content = content.replace(docRef, `${newName}_$1.md`);
  return content.replace(new RegExp(`\\b${escapeRegExp(oldName)}\\b`, "g"), newName);
}
