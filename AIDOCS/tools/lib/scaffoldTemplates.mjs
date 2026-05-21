// scaffoldTemplates.mjs - the file-content templates init writes for a new
// project (AGENTS, _index.json, the Big 6 + EXTENDED + BACKLOG + DEV-AUDIT
// starters, CHANGELOG, .gitignore). Split from init.mjs so the scaffold's
// "what the files say" lives apart from init's "how the scaffold is laid down".
// Pure string builders, except the three that read a canonical source from the
// repo (hard-rules block, DEV-AUDIT baseline).

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { REPO_ROOT } from "./paths.mjs";

export async function agentsTemplate(project) {
  const hardRules = await loadHardRulesBlock();
  return `# ${project}

**Purpose:** Orchestrator. Orients a new session in under a minute and points into the right deeper doc. Nothing that belongs in a lower layer lives here.

## Project Overview

(fill in: one paragraph - what this project is, who uses it, where it lives)

## Cold-start load order

1. \`AIDOCS/${project}_MEMORY.md\` - identity (Overview / Stack / Architecture / Environment / Pipeline / Conventions) + LIFO durable observations
2. \`AIDOCS/${project}_SESSION.md\` - Current State (overwrite-each-pass) + LIFO backbone log of project-significant events
3. \`AIDOCS/_index.json\` - dispatch registry (paths, buckets, sizes, skills)

Optional, on demand:

4. EXTENDED files - mirror MEMORY / SESSION shape, longer prose + anchored LIFO detail
5. \`AIDOCS/${project}_BACKLOG.md\` - forward-looking Features + Ideas. User-owned, AI appends during \`/321 -MemoryUpdate\`
6. \`AIDOCS/${project}_DEV-AUDIT.md\` - skill-activated, loads only when \`/321 -DevAudit\` runs

## Layout

File layout, size budgets, skill dispatch, and customization manifest all live in \`AIDOCS/_index.json\`. Read it when you need a path, bucket name, size cap, or skill body location. Do not hardcode paths anywhere else.

## Permissions

(fill in: agent permissions for this project)

## Environment

Setup, commands, secrets, and platform-specific notes live in \`AIDOCS/ENV/\`. Read on demand when the question is operational.

---

## Hard rules

Perfect copy of the auto-memory inventory at \`<auto_memory.path>\`. Auto-memory loads at session start. This surface keeps the rules visible in the orchestrator. Source of truth for each rule lives in the linked \`feedback_*.md\` file. Link targets are auto-memory filenames, not repo-local paths - resolve through the auto-memory directory.

${hardRules}

## Project Specifics

(none yet)
`;
}

async function loadHardRulesBlock() {
  const src = join(REPO_ROOT, "AIDOCS", "automemory", "MEMORY.md");
  if (!existsSync(src)) {
    return "(fill in: copy the rule list from your auto-memory MEMORY.md)";
  }
  return (await readFile(src, "utf8")).trim();
}

export function indexTemplate(project, profile, autoMemoryPath) {
  // No `paths.automemory` here: downstream auto-memory lives per-machine at
  // auto_memory.path (init populates the home dir, not a project-local copy), so
  // a `./AIDOCS/automemory` entry would be a dangling path doctor flags. The
  // 321_STD template repo keeps it in its own _index.json (the dir exists there).
  const obj = {
    project_name: project,
    project_type: "project",
    release_profile: profile,
    paths: {
      root: ".",
      claude_md: "./CLAUDE.md",
      agents_md: "./AGENTS.md",
      aidocs: "./AIDOCS",
      wddocs: "./WDDOCS",
      skills_router: "./.claude/skills/321/SKILL.md",
      skills_bodies: "./AIDOCS/SKILL",
      skills_local: "./AIDOCS/SKILL_LOCAL",
      changelog: "./CHANGELOG.md",
      temp: "./TEMP",
      tools: "./AIDOCS/tools",
    },
    files: {
      memory: `./AIDOCS/${project}_MEMORY.md`,
      memory_extended: `./AIDOCS/${project}_MEMORY_EXTENDED.md`,
      session: `./AIDOCS/${project}_SESSION.md`,
      session_extended: `./AIDOCS/${project}_SESSION_EXTENDED.md`,
      backlog: `./AIDOCS/${project}_BACKLOG.md`,
      dev_audit: `./AIDOCS/${project}_DEV-AUDIT.md`,
      changelog: "./CHANGELOG.md",
      memory_archive: `./AIDOCS/${project}_MEMORY_ARCHIVE`,
      session_archive: `./AIDOCS/${project}_SESSION_ARCHIVE`,
      backlog_archive: `./AIDOCS/${project}_BACKLOG_ARCHIVE`,
      env: "./AIDOCS/ENV",
    },
    buckets: {
      memory: ["lifo"],
      session: ["lifo"],
      backlog: ["features", "ideas"],
    },
    sizes: {
      memory: { cap: 150, prune_to: 75 },
      memory_extended: { cap: 400, prune_to: 200 },
      session: { cap: 100, prune_to: 50 },
      session_extended: { cap: 400, prune_to: 200 },
      backlog: { cap: 100, prune_to: 50 },
    },
    auto_memory: {
      path: autoMemoryPath,
      sync_from_template: false,
    },
    skills: {
      router: "/321",
      installed: [],
      dispatch: {},
      local_additions: [],
    },
    customizations: [],
  };
  return `${JSON.stringify(obj, null, 2)}\n`;
}

// README shipped into AIDOCS/SKILL_LOCAL/ so the override mechanism is
// discoverable from the folder itself. Written as a scaffold (write-if-missing),
// which also creates the dir. Kept generic - no project-specific skill names.
export function skillLocalReadme() {
  return `# SKILL_LOCAL - project-local skill overrides

**Purpose:** Home for project-specific \`/321\` skill bodies that must survive an engine reinstall. \`init\` always overwrites \`AIDOCS/SKILL\` (the generic engine bodies) but never touches this folder, so a customized pipeline lives here safely.

## How it works

- Drop a \`SKILL_<NAME>.md\` here using the **same filename** and the **same frontmatter \`name\`** as the generic skill it replaces (for example \`SKILL_AUTO-PUSH.md\` with \`name: auto-push\`). Run \`node AIDOCS/tools/memory.mjs sync\`. The local body takes precedence: \`_index.json -> skills.dispatch.<name>.body\` repoints here and the key is recorded in \`skills.local_additions\`.
- A \`SKILL_<NAME>.md\` with no generic counterpart adds a brand-new \`/321\` flag.
- The \`/321\` router loads whatever \`dispatch.<name>.body\` points at, so no router edit is needed.

## When to use

Override a skill only when its procedure is irreducibly project-specific and the generic body would do the wrong thing - most often a release pipeline (\`-AutoPush\`) with a non-standard publish or deploy, or a project-specific audit rule-set. The doc-distillation skills (\`-SessionUpdate\`, \`-MemoryUpdate\`, \`-Update\`) are usually better left generic: the engine drives them, so fold any genuine deviation into MEMORY or DEV-AUDIT rather than forking the body.

Record each override in \`_index.json -> customizations[]\` so drift tooling can tell an intentional deviation from accidental drift. During a migration, \`/321 -Update\` writes overrides here automatically from the archived custom bodies.
`;
}

export function memoryTemplate(project) {
  return `# ${project} - MEMORY

**Purpose:** Project identity, durable decisions, and distilled learnings. Six static sections at the top hold the schema, each with qualified Decisions sub-sections for rationale. Below the divider, LIFO (newest on top) holds durable observations plus suggestive bullets for AGENTS / auto-memory. A LIFO bullet with deeper detail leads with a \`[+]\` marker whose headline matches a \`###\` heading in \`${project}_MEMORY_EXTENDED.md\`.

## Overview

(fill in - product, audience, problem, lineage)

## Stack

(fill in - framework, language, key tech. Use \`see <file>\` pointers for versions and paths - the code is authoritative)

## Architecture

(fill in - how code and docs organize, key flows, what loads when. \`_index.json\` owns canonical paths)

## Environment

(fill in - env files, required keys, local dev. Or note "none yet")

## Pipeline

(fill in - build, deploy, release flow, CHANGELOG behavior)

## Conventions

(fill in - branching, version policy, skill router, quality gates, code-review posture)

---

## LIFO

(no entries yet - routine \`/321 -MemoryUpdate\` lands here)
`;
}

export function memoryExtendedTemplate(project) {
  return `# ${project} - MEMORY (Extended)

**Purpose:** Longer-form prose and anchored detail for \`${project}_MEMORY.md\`. Six static sections at the top mirror MEMORY with deeper narrative, each with qualified Decisions sub-sections for longer rationale. Below the divider, LIFO (newest on top) holds anchored detail, one per MEMORY LIFO bullet that earns depth.

## Overview

(longer-form prose of the facts in MEMORY > Overview)

## Stack

(longer-form prose of the facts in MEMORY > Stack)

## Architecture

(longer-form prose of the facts in MEMORY > Architecture)

## Environment

(longer-form prose of the facts in MEMORY > Environment)

## Pipeline

(longer-form prose of the facts in MEMORY > Pipeline)

## Conventions

(longer-form prose of the facts in MEMORY > Conventions)

---

## LIFO

(no extended entries yet - anchored sub-sections land here per LIFO bullet that needs depth)
`;
}

export function sessionTemplate(project) {
  return `# ${project} - SESSION

**Purpose:** Backbone log of project history. Current State at the top reflects live operational reality. On each refresh, the previous state moves down to LIFO (newest on top) as a \`**Last State:**\` marker. Below the divider, LIFO holds the running history of project-significant events - changes, decisions, findings, friction, milestones, failed attempts. A LIFO bullet with deeper detail leads with a \`[+]\` marker whose headline matches a \`###\` heading in \`${project}_SESSION_EXTENDED.md\`.

## Current State

(no state recorded yet - overwritten by \`/321 -SessionUpdate\`)

---

## LIFO

(no entries yet - project-significant events, changes, decisions, findings, friction, milestones, and failed attempts land here)
`;
}

export function backlogTemplate(project) {
  return `# ${project} - BACKLOG

**Purpose:** Forward-looking work the project intends to ship later. Features at the top (specific, ready-to-implement when committed). Ideas at the bottom (everything else - exploratory, refactor candidates, polish notes, what-if thinking). Both sections are LIFO (newest on top). User-owned for reordering and cleanup.

## Features

(no entries yet)

## Ideas

(no entries yet)
`;
}

export function sessionExtendedTemplate(project) {
  return `# ${project} - SESSION (Extended)

**Purpose:** Longer-form technical narrative for \`${project}_SESSION.md\`. LIFO (newest on top) holds anchored \`### sub-section\` detail, one per SESSION LIFO bullet that earns depth. Current State has no mirror here - it overwrites every pass on the main file and would not benefit from deeper narrative.

## LIFO

(no extended entries yet - anchored sub-sections land here per LIFO bullet that needs depth)
`;
}

export async function devAuditStarter(project) {
  const src = join(REPO_ROOT, "AIDOCS", "_PROJECT_DEV-AUDIT.md");
  if (!existsSync(src)) {
    return `# ${project} - Dev Audit\n\n**Purpose:** Active rules for code. Loaded by \`/321 -DevAudit\`. Audit baseline.\n\n(Fill in: anchor principles, stack, commands, language conventions, comments policy, file organization, refactor philosophy, modern patterns, linter sweeps, error messages, hard rules from auto-memory.)\n`;
  }
  const content = await readFile(src, "utf8");
  return content.replace(/<PROJECT>/g, project);
}

export function changelogTemplate(project) {
  return `# Changelog

All notable changes to ${project} will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Composed by \`/321 -AutoPush\` at release. User-readable tone, bold lead sentences, no jargon, no version numbers in subjects.

(no versions yet - \`/321 -AutoPush\` writes the first \`## [<VERSION>] - <YYYY-MM-DD>\` block at ship time)
`;
}

export function gitignoreTemplate() {
  return `# Scratch / temp
TEMP/

# Setup migration archive: keep the empty folder for reference, ignore captured contents (transient, deleted after review)
AIDOCS/*_SETUP_ARCHIVE/*
!AIDOCS/*_SETUP_ARCHIVE/.gitkeep

# Environment docs: keep the folder, ignore contents (may hold secrets / setup notes - local-only)
AIDOCS/ENV/*
!AIDOCS/ENV/.gitkeep

# Staging files (transient, cleared on commit). SCHEMA.json and *.example.json are committed.
AIDOCS/tools/staging/*.json
!AIDOCS/tools/staging/SCHEMA.json
!AIDOCS/tools/staging/session-update.example.json
!AIDOCS/tools/staging/memory-update.example.json
AIDOCS/tools/staging/.lock

# Persistent script state (machine-local). Auto-bootstrapped on first run.
AIDOCS/tools/state.json

# Local-only AI session handoff (working state, not committed project content)
WDDOCS/SESSION_HANDOFF.md

# Node (if tooling grows)
node_modules/

# Secrets
.env
.env.local
.env.*.local

# Local MCP server config (machine-local paths / IDs / tokens, written by MCP tooling). Never commit.
.mcp.json
.claude/settings.local.json

# Build artifacts
dist/
`;
}
