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
