// validate.mjs - schema check for a staging file. Read-only. Confirms every
// action has a known op, targets a registered file key, names a section, and
// carries the field its op needs. Shared by the `validate` command and commit's
// pre-write gate (DEV-AUDIT: fail at gates - a bad action never reaches disk).

import { flag } from "./args.mjs";
import { slugify } from "./markdown.mjs";
import { loadStaging, SKILLS } from "./state.mjs";

const OPS = ["lifo_insert", "overwrite_section", "amend_bullet", "drop_bullet", "changelog_insert", "add", "drop", "replace"];
const MAIN_OPS = ["lifo_insert", "overwrite_section", "amend_bullet", "drop_bullet", "changelog_insert"];   // carry a section - EXTENDED ops carry an anchor
// Keep a Changelog's section names: the only headings changelog_insert lands under.
const CHANGELOG_SECTIONS = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"];

// Returns a list of human-readable errors (empty when well-formed). When `skill`
// is given, enforces the domain firewall: every action must target a file the
// skill owns, i.e. whose key is prefixed with the skill domain (updatesession.* /
// updatememory.*). The domain-owned key names are the firewall.
export function validateStaging(index, staging, skill) {
  const errors = [];
  if (!staging || !Array.isArray(staging.actions)) return ["staging must have an actions array"];
  staging.actions.forEach((a, i) => {
    const at = `action ${i}`;
    if (!OPS.includes(a.op)) errors.push(`${at}: unknown op ${JSON.stringify(a.op)} (one of ${OPS.join(" / ")})`);
    if (!index.files?.[a.file]) errors.push(`${at}: unknown file key ${JSON.stringify(a.file)}`);
    else if (skill && !a.file.startsWith(`${skill}.`)) errors.push(`${at}: file "${a.file}" is not owned by ${skill} (domain firewall)`);
    if (MAIN_OPS.includes(a.op) && (typeof a.section !== "string" || a.section.length === 0)) errors.push(`${at}: section required (string)`);
    if (a.op === "lifo_insert" && typeof a.bullet !== "string") errors.push(`${at}: lifo_insert needs a bullet string`);
    if (a.op === "lifo_insert" && a.extended_anchor !== undefined) {
      if (typeof a.extended_anchor !== "string" || !a.extended_anchor) errors.push(`${at}: extended_anchor must be a non-empty string`);
      else if (typeof a.bullet === "string" && a.extended_anchor !== slugify(a.bullet)) errors.push(`${at}: extended_anchor "${a.extended_anchor}" must equal slugify(bullet) "${slugify(a.bullet)}"`);
    }
    if (a.op === "overwrite_section" && typeof a.body !== "string") errors.push(`${at}: overwrite_section needs a body string`);
    if (MAIN_OPS.includes(a.op) && a.op !== "changelog_insert" && /\.changelog$/.test(a.file)) errors.push(`${at}: ${a.op} cannot target the changelog - use changelog_insert`);
    if ((a.op === "amend_bullet" || a.op === "drop_bullet") && (typeof a.match !== "string" || !a.match)) errors.push(`${at}: ${a.op} needs a match string (the bullet's opening words or its slug)`);
    if ((a.op === "amend_bullet" || a.op === "drop_bullet") && /_extended$/.test(a.file)) errors.push(`${at}: ${a.op} works on a main file's bullets - EXTENDED sub-sections take drop / replace by anchor`);
    if (a.op === "amend_bullet" && typeof a.bullet !== "string") errors.push(`${at}: amend_bullet needs a bullet string (the whole rewritten bullet)`);
    if (a.op === "changelog_insert") {
      if (typeof a.bullet !== "string" || !a.bullet) errors.push(`${at}: changelog_insert needs a bullet string`);
      if (!CHANGELOG_SECTIONS.includes(a.section)) errors.push(`${at}: changelog_insert section must be one of ${CHANGELOG_SECTIONS.join(" / ")}`);
      if (!/\.changelog$/.test(a.file)) errors.push(`${at}: changelog_insert targets the changelog key (<domain>.changelog)`);
    }
    if (a.op === "add" || a.op === "drop" || a.op === "replace") {
      if (typeof a.anchor !== "string" || !a.anchor) errors.push(`${at}: ${a.op} needs an anchor string`);
      else if (typeof a.heading === "string" && a.heading && a.anchor !== slugify(a.heading)) errors.push(`${at}: anchor "${a.anchor}" must equal slugify(heading) "${slugify(a.heading)}"`);
    }
    if ((a.op === "add" || a.op === "replace") && typeof a.body_md !== "string") errors.push(`${at}: ${a.op} needs a body_md string`);
    if ((a.op === "add" || a.op === "replace") && typeof a.body_md === "string" && a.body_md.includes("```")) errors.push(`${at}: ${a.op} body_md must not contain a code fence - summarize in prose, code lives in source`);
  });
  return errors;
}

export function cmdValidate(index, args) {
  const skill = flag(args, "--skill");
  if (!SKILLS.includes(skill)) { console.error(`validate: --skill must be one of ${SKILLS.join(" / ")}`); process.exit(11); }
  const staging = loadStaging(skill);
  if (!staging) { console.error(`validate: no staging file for ${skill}. Nothing to validate.`); process.exit(12); }
  const errors = validateStaging(index, staging, skill);
  if (errors.length) {
    console.error(`validate: ${skill} has ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(13);
  }
  console.log(`validate: ${skill} staging is well-formed (${staging.actions.length} action(s)).`);
}
