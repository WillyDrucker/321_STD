// gitignore.mjs - the privacy-aware .gitignore generator. One source of truth for
// what a downstream project tracks, shared by init (lay it), privacy (flip it), and
// doctor (drift-check it). Three tiers:
//
//   A (always tracked) - the engine (AIDOCS/tools), skills (AIDOCS/SKILL), router,
//     _index.json, INSTALL runbooks, root scaffolding. Never listed here: tracked is
//     the absence of an ignore. A public repo still ships the engine so the code is
//     usable - privacy gates the project's own knowledge, not the framework.
//   B (privacy-gated) - the project's own memory (AIDOCS/<NAME>_*.md), auto-memory,
//     and WDDOCS docs. private tracks them, public keeps them local (the folder
//     skeletons publish via .gitkeep, the content does not).
//   C (never tracked) - TEMP, ENV, secrets, staging, script state, the fetched
//     engine, build output, and the always-local WDDOCS lanes (RELEASES deploy
//     runbooks, SESSION_HANDOFF status). Ignored in every mode.
//
// 321_STD's own .gitignore is hand-maintained ("full" mode) and not generated here:
// it ships its memory + auto-memory as the product template, so it tracks Tier B on
// purpose while still hiding WDDOCS. privacy refuses to regenerate a "full" project.

export const PRIVACY_MODES = ["public", "private", "full"];

// Self-delimiting so privacy --set can strip and re-apply the block without touching
// custom ignores or the migrate-restore "preserved from" tail around it.
const BLOCK_BEGIN = "# Privacy gate (public) - BEGIN. Managed by `engine.mjs privacy`. Do not edit between the markers.";
const BLOCK_END = "# Privacy gate - END";

// Tier C + the always-local WDDOCS lanes: ignored in every generated mode.
const COMMON = `# Scratch / temp
TEMP/
*.tmp
*.log

# Onboarding: INSTALL/install.md + setup.md are tracked source - init copies them into
# a target. Ignore only the runtime artifacts (the fetched engine, plus INSTALL.log via
# the *.log rule above). graduate removes INSTALL/.
INSTALL/engine/

# Setup migration archive: keep the empty folder for reference, ignore captured contents.
AIDOCS/*_SETUP_ARCHIVE/*
!AIDOCS/*_SETUP_ARCHIVE/.gitkeep

# Environment docs: keep the folder, ignore contents (may hold secrets - local-only).
AIDOCS/ENV/*
!AIDOCS/ENV/.gitkeep

# Staging files (transient, written by the engine, cleared on commit). Keep the folder.
AIDOCS/tools/staging/*
!AIDOCS/tools/staging/.gitkeep

# Persistent script state (machine-local). Auto-bootstrapped on first run.
AIDOCS/tools/state.json

# WDDOCS always-local (every mode): deploy runbooks (machine paths / secrets) and the
# session handoff (live status). The rest of WDDOCS is privacy-gated (tracked when
# private, in the public block below when public).
/WDDOCS/RELEASES/*
!/WDDOCS/RELEASES/.gitkeep
/WDDOCS/SESSION_HANDOFF*.md

# OS
.DS_Store
Thumbs.db
desktop.ini

# Editors
.vscode/
.idea/
*.swp
*~

# Node
node_modules/
npm-debug.log*
pnpm-debug.log*
.pnpm-store/

# Secrets
.env
.env.local
.env.*.local

# Local MCP server config (machine-local paths / IDs / tokens). Never commit.
.mcp.json
.claude/settings.local.json

# Build artifacts
dist/
out/
build/
`;

// The Tier B ignore block, added only for public. Folder skeletons stay (.gitkeep) so
// the structure publishes without the content.
const PUBLIC_PATTERNS = `# Project memory + auto-memory + WDDOCS docs stay local. Flip to a private repo with
# \`node AIDOCS/tools/engine.mjs privacy --set private\` (then \`git add\` what you want tracked).
AIDOCS/*_MEMORY.md
AIDOCS/*_MEMORY_EXTENDED.md
AIDOCS/*_SESSION.md
AIDOCS/*_SESSION_EXTENDED.md
AIDOCS/*_BACKLOG.md
AIDOCS/*_DEV-AUDIT.md
AIDOCS/*_AUTO-PUSH.md
AIDOCS/automemory/*
!AIDOCS/automemory/.gitkeep
/WDDOCS/ARCHIVE/*
!/WDDOCS/ARCHIVE/.gitkeep
/WDDOCS/DESIGN/*
!/WDDOCS/DESIGN/.gitkeep
/WDDOCS/IDEAS/*
!/WDDOCS/IDEAS/.gitkeep`;

function publicBlock() {
  return `${BLOCK_BEGIN}\n${PUBLIC_PATTERNS}\n${BLOCK_END}\n`;
}

// True when a .gitignore already carries the public privacy block.
export function hasPrivacyBlock(text) {
  return text.includes(BLOCK_BEGIN);
}

// Remove the public privacy block (between the markers) wherever it sits, leaving
// every other line - custom ignores, the migrate-restore tail - untouched.
export function stripPrivacyBlock(text) {
  const lines = text.split("\n");
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (line === BLOCK_BEGIN) { inside = true; continue; }
    if (inside) { if (line === BLOCK_END) inside = false; continue; }
    out.push(line);
  }
  // Collapse the blank gap the removed block can leave.
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

// The full .gitignore body for a fresh lay (init). private / full track Tier B, so they
// get COMMON alone. public appends the gate block.
export function buildGitignore(mode) {
  if (mode === "public") return `${COMMON}\n${publicBlock()}`;
  return COMMON;
}

// Flip an existing .gitignore to a mode, preserving everything outside the block. Strips
// any existing public block first, then re-adds it for public. Returns the new text.
export function applyPrivacy(text, mode) {
  const base = stripPrivacyBlock(text).replace(/\n*$/, "\n");
  if (mode === "public") return `${base}\n${publicBlock()}`;
  return base;
}

// The glob patterns public hides, for privacy --set to `git rm --cached` so already-
// tracked Tier B content leaves the index when a project flips public.
export const TIER_B_TRACKED = [
  "AIDOCS/*_MEMORY.md",
  "AIDOCS/*_MEMORY_EXTENDED.md",
  "AIDOCS/*_SESSION.md",
  "AIDOCS/*_SESSION_EXTENDED.md",
  "AIDOCS/*_BACKLOG.md",
  "AIDOCS/*_DEV-AUDIT.md",
  "AIDOCS/*_AUTO-PUSH.md",
  "AIDOCS/automemory",
  "WDDOCS/ARCHIVE",
  "WDDOCS/DESIGN",
  "WDDOCS/IDEAS",
];
