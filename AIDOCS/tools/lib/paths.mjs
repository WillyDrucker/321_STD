// paths.mjs - shared constants for memory.mjs and its lib modules.
// All filesystem locations and skill vocabulary live here so other modules
// stay path-agnostic and the entry point doesn't carry import boilerplate.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// Internal-only: REPO_ROOT / STAGING_DIR / STATE_PATH derive from it below.
const TOOLS_DIR = resolve(HERE, "..");
// REPO_ROOT climbs two levels from TOOLS_DIR (AIDOCS/tools) to project root.
export const REPO_ROOT = resolve(TOOLS_DIR, "..", "..");
export const INDEX_PATH = join(REPO_ROOT, "AIDOCS", "_index.json");
export const STAGING_DIR = join(TOOLS_DIR, "staging");
export const STATE_PATH = join(TOOLS_DIR, "state.json");
export const LOCK_PATH = join(STAGING_DIR, ".lock");

// Canonical upstream for fetch-from-git. The default for the `origin` pointer
// and for fetch-engine when no explicit source is given. A version in a manifest
// is fine (like package.json), this is not memory.
export const ORIGIN_REPO = "https://github.com/WillyDrucker/321_STD.git";
export const ORIGIN_REF = "main";

// The ephemeral onboarding root. Created at bootstrap, it owns the fetched
// engine + runbooks + scratch through install -> setup -> the start of reconcile,
// and is removed at graduation (the reconcile pass). Gitignored, like TEMP.
// engine/ holds the fetched 321_STD release (the full onboarding tier), work/
// holds verdict JSON and setup scratch.
export const INSTALL_DIR = join(REPO_ROOT, "INSTALL");
export const INSTALL_ENGINE_DIR = join(INSTALL_DIR, "engine");
export const INSTALL_WORK_DIR = join(INSTALL_DIR, "work");

// Onboarding-tier engine modules. These ship with the fetched INSTALL/ engine
// and are NOT laid into a steady-state install: init excludes them when copying
// lib/, and memory.mjs resolves them lazily so a steady project (which carries
// only the steady tier) still loads for its daily commands. Absolute source
// paths - memory.mjs imports via file URL, init excludes by path match.
export const ONBOARDING_COMMAND_PATHS = {
  "init": join(TOOLS_DIR, "lib", "commands", "init.mjs"),
  "migrate-archive": join(TOOLS_DIR, "lib", "commands", "migrate-archive.mjs"),
  "migrate-import": join(TOOLS_DIR, "lib", "commands", "migrate-import.mjs"),
  "migrate-restore": join(TOOLS_DIR, "lib", "commands", "migrate-restore.mjs"),
  "import-skills": join(TOOLS_DIR, "lib", "commands", "import-skills.mjs"),
  "verdict": join(TOOLS_DIR, "lib", "commands", "verdict.mjs"),
};

// Onboarding-tier files with no command of their own (init's content templates).
export const ONBOARDING_FILE_PATHS = [
  join(TOOLS_DIR, "lib", "scaffoldTemplates.mjs"),
];

export const VALID_SKILLS = ["session-update", "memory-update"];

// Routine-op section slugs by skill. session-update lands in current_state
// (overwrite) or lifo. memory-update lands in lifo only via routine ops. The
// static six are reachable only via promote_to_section, gap_fill_section, and
// update_section_text - all mode=full.
export const ROUTINE_SECTIONS_BY_SKILL = {
  "session-update": ["current_state", "lifo"],
  "memory-update": ["lifo"],
};

// MEMORY static-section slugs. Only writable via promote_to_section /
// gap_fill_section / update_section_text in mode=full. Validator rejects any
// routine op targeting these.
export const STATIC_SECTIONS = [
  "overview",
  "stack",
  "architecture",
  "environment",
  "pipeline",
  "conventions",
];

// BACKLOG section slugs. Both are LIFO. memory-update is the only skill that
// writes to the backlog file via routine ops on backlog_actions[]. The
// validator rejects backlog_actions on session-update staging.
export const BACKLOG_SECTIONS = ["features", "ideas"];

// Display headings per slug. Internal-only: consumed by decisionsHeadingFor below.
const SECTION_HEADINGS = {
  current_state: "Current State",
  lifo: "LIFO",
  overview: "Overview",
  stack: "Stack",
  architecture: "Architecture",
  environment: "Environment",
  pipeline: "Pipeline",
  conventions: "Conventions",
  features: "Features",
  ideas: "Ideas",
};

// Qualified Decisions sub-section heading for a static section. e.g., decisionsHeadingFor("stack") -> "Stack Decisions".
export function decisionsHeadingFor(slug) {
  return `${SECTION_HEADINGS[slug]} Decisions`;
}
