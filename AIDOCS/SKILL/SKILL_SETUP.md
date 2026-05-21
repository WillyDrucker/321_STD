---
name: setup
description: First-run wizard or migration for a 321_STD project. Detects fresh-install vs existing-project state. Fresh - walks Big 6 fill from project signals with per-section confirmation, sets release_profile, resolves auto_memory.path, optional ENV starter and first git commit. Migration - archives existing content (the known 321 layout plus scattered AI artifacts anywhere in the tree - TEMP dumps, .claude notes, loose memory or handoff files - via a confidence-graded discovery sweep that runs on every migration), reinstalls canonical 321_STD, captures depth losslessly via migrate-import, restores user content, then sets the reconcile_pending gate and stops for /321 -Update to distill. Idempotent.
---

# /321 -Setup

**Purpose:** Make a 321_STD project usable. Two modes, auto-selected by what Setup finds in the target.

- **Fresh-install mode.** `init` produced an empty scaffold. Setup walks Big 6 fill, release_profile, auto_memory.path, optional ENV starter, optional first commit. Per-section confirmation, idempotent re-runs.
- **Migration mode.** Setup detects an existing project (filled Big 6, populated LIFO, user docs in WDDOCS, etc.). Archives the project's content to `AIDOCS/<X>_SETUP_ARCHIVE/`, runs `init` to land the canonical 321_STD structure on top, fresh-scans the code for current Big 6 reality, then backfills the archive into the new structure with legacy naming normalization (DEV-STANDARDS -> DEV-AUDIT, SKILLS -> SKILL, etc.).

**Invocation:** Once, immediately after `node AIDOCS/tools/memory.mjs init <target> --name <PROJECT>`. Subsequent runs at any time refresh sync and pick up where left off. Re-running on a migrated project is safe - it sees the project as filled (post-migration) and just refreshes sync.

## You drive the wizard

The script can't decide what the project's Stack is, or whether the user prefers `npm-package` vs `static-site`, or which archived bullets are still load-bearing after a migration. Setup is the place where AI judgment meets project context and user preference. For fresh-install Big 6 drafts, per-section confirmation (accept / edit / skip) keeps the user in the loop. For migration, the canonical skill pipeline (SessionUpdate, MemoryUpdate -FULL) auto-applies through its own staging rules - migration is a "run end-to-end, review the result" flow, not a step-by-step approval flow.

**Fresh path (Steps 1-7):** sync + doctor -> Big 6 fill (the judgment step) -> release_profile -> auto_memory.path -> ENV starters -> first commit -> summary. Step 0 (detect) is shared with migration. Detailed below.

**Migration path (Steps 1-11):** archive + artifact sweep -> reinstall (`init`) -> sync + doctor -> load context -> SESSION capture -> MEMORY capture -> restore user content -> voice scrub -> doctor -> set the gate -> summary. Detailed below.

**Migration captures raw, then hands off.** Steps 1-9 are mechanical (capture + restore + scrub + doctor). Step 10 sets the `reconcile_pending` gate and STOPS - distillation is the judgment-heavy `/321 -Update`, run with fresh context. Past Step 0, Steps 1-11 chain with no prompts (only a validate/commit failure in Steps 5-6 stops for review). The archive is the safety net throughout, reversible until the user deletes it.

## Step 0: Detect state

Read these signals in the target. **Any one of them flips Setup to migration mode** (false-positive migration is safe because it archives a fresh scaffold and reinstalls the same. False-negative is destructive). Otherwise fresh-install mode.

**321-shaped migration signals (any one triggers migration):**

- `AIDOCS/<X>_MEMORY.md` has any Big 6 section without a `(fill in` or `(no entries yet` placeholder, OR its LIFO has any bullet
- `AIDOCS/<X>_SESSION.md` has Current State content beyond the placeholder, OR its LIFO has any bullet
- `AIDOCS/<X>_BACKLOG.md` has any Features or Ideas entry beyond the placeholder
- `AIDOCS/<X>_DEV-AUDIT.md` or `AIDOCS/<X>_DEV-STANDARDS.md` has a non-empty Project specifics section
- `WDDOCS/` contains any `.md` file (Designs, plans, archives)
- `AIDOCS/ENV/` contains any file beyond `.gitkeep`
- `CHANGELOG.md` contains any `## [X.Y.Z]` version block (not just the template placeholder)
- `AIDOCS/_index.json -> customizations` has at least one entry
- Legacy markers present: `AIDOCS/SKILLS/` directory exists (plural), or `AIDOCS/<X>_DEV-STANDARDS.md` exists, or `_index.json` contains a `standards_version` field (the schema dropped it - presence indicates an older install)
- Existing project's archive dirs (`AIDOCS/<X>_MEMORY_ARCHIVE/`, `_SESSION_ARCHIVE/`, `_BACKLOG_ARCHIVE/`) contain any file
- Multiple `<NAME>_MEMORY.md` patterns coexist in `AIDOCS/` (e.g., legacy `OldName_*.md` alongside fresh scaffolds from a prior install) - the legacy files are migration source

**Standard-project AI-artifact signals (any one triggers migration too).** A project that never used 321 still accumulates AI working state in ad-hoc places. If the target shows any of these, treat it as a migration (it has content worth capturing, and migration archives-first so capture is non-destructive):

- A substantive `CLAUDE.md` or `AGENTS.md` at root (more than a few lines, i.e. the user actually wrote rules into it)
- A session-handoff-style file anywhere (`*HANDOFF*.md`, `SESSION_HANDOFF*`, `HANDOFF*`) - this pattern is becoming a commonplace cross-tool standard
- Memory/session-named docs not in 321 layout: `MEMORY*.md`, `*_MEMORY.md`, `SESSION*.md`, `CONTEXT*.md`, `NOTES.md`, `PROJECT.md`, `TODO.md` at root or in a docs-ish folder
- An assistant-state folder with content: `.ai/`, `ai/`, `memory/`, `context/`, `.cursor/`, `.windsurf/`, `.aider*`, `.github/copilot-*`
- The project's auto-memory directory holds AI-written `feedback_*` / log files beyond the canonical scaffold
- AI-state markdown parked off the canonical layout: a `TEMP/` (or `tmp/`) dump of memory / session / handoff / notes docs, a `.claude/` doc beyond config, a legacy system copied into a subfolder, or memory / session / handoff-named `.md` files loose anywhere in the tree

The **artifact discovery sweep** (Step 1) runs on **every** migration alongside the known-path list, not only standard projects - a 321-shaped project still hides AI state in non-canonical spots (a `TEMP/` dump, a `.claude/` note). When no 321 EXTENDED exists (a pure standard project), Steps 5/6 capture from the swept files plus the code scan instead.

**Branch decision (auto, no prompt):**

- **Migration triggered** -> resolve the project name (identity gate below), print the migration-mode banner, and proceed to Step 1 of the migration path.
- **Fresh / refresh** -> print `Setup detected: fresh install.` (or `Setup detected: refresh (N of 6 Big 6 filled).`) and proceed to Step 1 of the fresh path.

**Identity-conflict gate (the ONE sanctioned migration prompt, fires here in Step 0 only).** Resolve the project name now, before anything is archived or `init` runs - because `init` bakes `--name <X>` into `_index.json` and every scaffold filename in migration Step 2, so a name decision made later means re-running init. Resolution precedence (see migration Step 1 for detail): target basename wins by default.

Then check for an identity conflict: does the basename disagree with the project's strong identity signals? Strong signals are `package.json` `name`, the VCS branch prefix (`git branch --show-current`), and the dominant `<NAME>_*.md` filename pattern in the archive. If basename agrees with them (or they are absent), proceed silently - basename wins, no prompt. If basename DISAGREES with two or more strong signals (e.g. folder is `MyProject` but `package.json` says `acme-app`, branch is `acme-app_v1.2.3`, files are `acme-app_*`), surface exactly one decision before Step 1:

> "The folder is named `<basename>` but the project's code identity is `<signal-name>` (package.json `<name>`, branch `<prefix>`, docs `<NAME>_*`). The docs scaffold will be named after whichever you pick, and it is upstream of everything Setup writes. Use `<basename>` (rename the docs to match the folder) or `<signal-name>` (keep the code identity)? Default if you do not answer: `<basename>`."

Record the resolved `<X>` and the chosen-vs-rejected names for the Step 11 summary.

**Migration-mode entry banner.** When entering migration, print this as a clear announcement before doing any work. No confirmation prompt - this just makes the mode switch visible:

```
=== Migration mode ===
Setup detected an existing project with content to preserve at <target>.
Shape: <321-shaped (prior 321 install) | standard project with AI artifacts>
Project name: <X> (from <basename | _index.json | dominant filename pattern>)

Capturing existing content to AIDOCS/<X>_SETUP_ARCHIVE/, reinstalling canonical
321_STD, then capturing + restoring it into the new structure (Steps 1-9 below).
Setup stops at capture and hands the distillation pass to /321 -Update. The
archive is the safety net throughout. Continuing automatically.
```

Then immediately proceed to Step 1. **Do not pause or prompt for confirmation.** The user invoked Setup and expects it to run.

## Fresh-install path

### Step 1: Sync + health

```bash
node AIDOCS/tools/memory.mjs sync
node AIDOCS/tools/memory.mjs doctor
```

Relay both summaries. Sync and the structural / engine doctor checks must pass - a failure there stops Setup, so surface the issues and bail. Banned-prose lint on a pre-existing user-owned `README.md` is a warning, not a blocker (it predates the install and is the user's to scrub).

### Step 2: Big 6 fill

For each empty Big 6 section (Overview / Stack / Architecture / Environment / Pipeline / Conventions), in order:

1. **Read project signals.** `package.json`, top-level files, README, source layout, anything that hints at the section. For empty projects, the draft is allowed to be short ("New project, stack not yet chosen.").
2. **Draft body.** 2-4 lines of prose, the kind a cold-start session would actually use. Avoid placeholders.
3. **Optional Decisions sub-section.** If a non-obvious choice is in evidence (e.g., "Astro chosen over Next for X reason"), draft a `decisions_md` line.
4. **Prompt user.** Show the draft. Accept three responses: accept / edit / skip. On skip, the placeholder stays for a future Setup run.

After all six are visited, build a single `memory-update` staging file with all accepted `gap_fill_section` actions (`mode: "full"`). Validate, preview if the user wants to see the diff, commit. All confirmed sections land atomically:

```bash
node AIDOCS/tools/memory.mjs validate --skill memory-update
node AIDOCS/tools/memory.mjs commit   --skill memory-update --preview
node AIDOCS/tools/memory.mjs commit   --skill memory-update
```

If the user skipped all six, no commit fires.

### Step 3: release_profile

Read `_index.json -> release_profile`. If non-default (anything other than `standards`), skip - `init` already auto-detected and the user is free to override later.

Otherwise re-detect using the same rules `init` uses and offer the result for confirmation:

- `package.json` with `bin` field -> `npm-package`
- `package.json` with `engines.vscode` or `extension.json` -> `vscode-extension`
- `wrangler.toml` -> `cloudflare-worker`
- Pages-style config (`_redirects`, Pages CLI files) -> `cloudflare-pages`
- `astro.config.*`, `next.config.*`, `vite.config.*` -> `static-site`
- nothing detected -> `standards`

Show suggestion plus full list. Ask user to confirm or override. Write via direct Edit to `_index.json -> release_profile`.

**Non-standard release?** The profile gives the project the generic `/321 -AutoPush`, whose Step 7 runs that profile's canonical publish / deploy. If this project diverges - a different publish target, extra release gates, a project version invariant, or (common for `vscode-extension`) a manual marketplace upload instead of `vsce publish` - customize the body directly: edit `AIDOCS/SKILL/SKILL_AUTO-PUSH.md` with the project's pipeline and add a `customizations[]` entry in `_index.json` (`applies_to: ["AIDOCS/SKILL/SKILL_AUTO-PUSH.md"]`). That entry is what makes `init` preserve the body on a future engine update instead of overwriting it - without it, the next update reverts the pipeline to generic. The same approach customizes any skill. Mention this only when the project's pipeline actually diverges - most projects use the profile default as-is. (A migration needs no mention here: its `/321 -Update` skills-lane does this automatically from the archived bodies.)

### Step 4: auto_memory.path

`init` already resolved and wrote the per-machine path (`<userprofile>/.claude/projects/<derived>/memory` where `<derived>` is the project's absolute path with drive letter lowercased and `/ \ : _` all collapsed to `-`). Read `_index.json -> auto_memory.path` and confirm it matches the current target. If different (project was moved / cloned to a new machine), prompt the user to confirm a re-resolution.

This step does NOT clobber the per-machine auto-memory directory contents. `init` merge-copied the template feedback files on install (skipping existing). The user's personal rules at that path are preserved.

### Step 5: ENV starters (optional)

Ask: "Does this project use environment variables (API keys, DB URLs, secrets)?" If yes, prompt for key names and a one-line purpose for each. Write `AIDOCS/ENV/SETUP.md`:

```markdown
# <PROJECT> - Environment

**Purpose:** Environment variables and platform-specific setup notes. Read on demand.

## Required keys

| Key | Purpose | Where it's used |
|---|---|---|
| <KEY_NAME> | <one-line purpose> | (fill in) |
```

If no, skip. The user can fill `AIDOCS/ENV/` later.

### Step 6: First commit (optional)

`init` already runs `git init` if the target was not a repo. Check `git status` in the target. Three cases:

- **Repo with the scaffold uncommitted.** Ask "Create the first commit?" If yes, stage scaffolded files explicitly (AGENTS.md, CLAUDE.md, AIDOCS/ contents, .gitignore, CHANGELOG.md), never `git add -A`. Commit message: `Initial 321_STD scaffold.`
- **Repo with the scaffold already committed.** Skip.
- **Not a repo (rare - means `init` couldn't init).** Surface the reason and skip.

Don't push or create a remote - that's a user-initiated step.

### Step 7: Summary

```
Setup complete.

Mode:              fresh
Sync:              <N> skills registered
Doctor:            passed
Big 6:             <N> of 6 filled (<M> skipped, re-run Setup to revisit)
Release profile:   <profile>
Auto-memory path:  <resolved path>
ENV:               <SETUP.md written | skipped>
Git:               <initial commit <hash> | existing repo | skipped>

Next:
- Start working. Drop /321 -SessionUpdate at the first checkpoint.
- Fill remaining Big 6 by re-running /321 -Setup or /321 -MemoryUpdate -FULL.
- Edit AIDOCS/<PROJECT>_DEV-AUDIT.md to add your Stack / Commands / Language conventions.
- Non-standard release pipeline (or any skill needing project-specific steps)? Edit the
  body in AIDOCS/SKILL/ and add a customizations[] entry so init preserves it on updates.
```

## Migration path

The target already holds content worth preserving. Two shapes hit this path: a **321-shaped project** (a prior 321 install or legacy variant, with the known `<X>_MEMORY.md` / `_SESSION.md` / etc. structure) and a **standard project** that never used 321 but accumulated AI working state in ad-hoc places (a hand-rolled `CLAUDE.md`, a session-handoff file, loose memory/notes docs). Goal is the same for both: land the current canonical structure with our skills as source, then layer the project's accumulated knowledge back in. The difference is only in capture - 321-shaped projects feed the lossless `migrate-import`, standard projects feed the artifact discovery sweep (Step 1) and capture from discovered files plus the code scan (Steps 5/6 Part B).

### Step 1: Archive existing content

`migrate-archive` does the deterministic find + move - it is what keeps the path lists and sweep patterns out of this prose. It moves (never deletes) project-owned content into `AIDOCS/<X>_SETUP_ARCHIVE/` in two tiers. **Known 321-shape paths** move automatically: the `<X>_MEMORY/SESSION/BACKLOG/DEV-AUDIT` files (and EXTENDED), the `_MEMORY/SESSION/BACKLOG_ARCHIVE/` dirs, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `.gitignore`, `AIDOCS/_index.json`, `AIDOCS/ENV/`, `WDDOCS/`, plus legacy `AIDOCS/SKILLS/` and `.claude/skills/321/SKILLS.md`. **Clearly-stale swept AI-state** (handoff / rename / `_dump/` docs anywhere in the tree) moves automatically too. **Borderline swept docs** (a loose memory / notes file that might be live user content) are reported for you to adjudicate. Engine dirs (`AIDOCS/tools`, `AIDOCS/SKILL`, `automemory`), source, config, build artifacts, and `README.md` are never touched. Nothing is deleted - the archive is the reversible safety net. `<X>` was resolved in Step 0.

**Scan first, adjudicate, then execute:**

```bash
node AIDOCS/tools/memory.mjs migrate-archive <target> --name <X> --scan
```

Read the borderline list. Judge each by **content, not filename** (open it if unsure): clear AI working state -> `--move`, possibly-live user content -> `--copy` (the original stays in place), nothing worth keeping -> leave it (the default). Then execute with your decisions (omit both flags to leave every borderline):

```bash
node AIDOCS/tools/memory.mjs migrate-archive <target> --name <X> --move <csv> --copy <csv>
```

**Read legacy SKILLS content before executing.** If the scan lists `AIDOCS/SKILLS/` (plural), `.claude/skills/321/SKILLS.md`, or any project-customized `SKILL_*.md` bodies, read each in full first - they hold project-specific procedural customizations (custom publish or deploy steps, release invariants, audit rules, embedded Hard Rules) with no other home. The command archives them verbatim. **Capture only here, do NOT distill them into prose** - an executable pipeline scavenged into docs loses its executability. Their fate is decided by the reconcile skills-lane in `/321 -Update` (deferred surface below): an irreducibly project-specific pipeline is merged into its `AIDOCS/SKILL/SKILL_*.md` body and flagged in `customizations[]` (so `init` preserves it), one the generic engine now supersedes folds into `<X>_DEV-AUDIT.md` Project specifics or `<X>_MEMORY.md > Pipeline`. Count them for the loud Step 11 flag.

Archive preserves old filenames verbatim - legacy normalization (`DEV-STANDARDS` -> `DEV-AUDIT`, `<OLD>_*` -> `<X>_*`) happens at capture (Step 4 / `migrate-import --old/--new`), not here. A legacy `OldName_*.md` and a fresh `NewName_*.md` can coexist - both move aside so reinstall lands clean, and the archive keeps the legacy file as the migration source.

### Step 2: Reinstall canonical 321_STD

The standard `init` flow already covers the scaffold lay-down. Re-invoke it against the target:

```bash
node <tmp>/AIDOCS/tools/memory.mjs init <target> --name <X>
```

Where `<tmp>` is the freshly-cloned source (the same temp dir used by the public install scripts, or the standards repo if running locally). `<X>` is the project name resolved in migration Step 1.

Why this works without `--force`: archive in migration Step 1 moved all scaffold-class files into `AIDOCS/<X>_SETUP_ARCHIVE/`. The target's scaffold paths are now empty, so `init`'s "write if missing" semantics write fresh. Engine paths get rewritten (always-replace). Auto-memory dir gets merge-copied (preserves any personal rules already there).

### Step 3: Sync + health

```bash
node AIDOCS/tools/memory.mjs sync
node AIDOCS/tools/memory.mjs doctor
```

Categorize doctor output (same split as Step 9). Structural / engine checks (Paths, State, Skill bodies, Big-6 Decisions, Auto-memory pointers, Router quick-ref, Customization manifest, Release profile) must pass - a failure there is real, so surface and bail. Migration is reversible at this point: the archive is intact, the user can restore from `AIDOCS/<X>_SETUP_ARCHIVE/`. Banned-prose lint in a user-owned file still in the tree (notably `README.md`, which migration never touches) is a WARNING, not a bail - it predates the install and is the user's to scrub. Sync must succeed.

### Step 4: Load archive into AI context

Read the archived files into the AI's working context. **No edits yet.** The goal is to give the next skill invocations (migration Step 5, migration Step 6) the archive as available context, framed as accumulated project history that needs to be captured through the canonical pipeline.

**FULL READ required, not `wc -l`.** Known failure mode: the AI checks file size, judges it "long," and skips reading. Use the `Read` tool on each file below, paginating through large files. Do NOT skip based on size.

**Note on EXTENDED files:** Steps 5/6 capture EXTENDED depth via the `migrate-import` engine command (lossless by construction), so preservation no longer depends on the AI reading them. Reading them here is still useful context for the Big 6 distillation.

Files to read into context (verify each by quoting at least one section header back to yourself before moving on):

- `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<X>_MEMORY.md` and `_MEMORY_EXTENDED.md` (Big 6, Decisions, LIFO, all anchored sub-sections)
- `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<X>_SESSION.md` and `_SESSION_EXTENDED.md` (Current State, LIFO history, all anchored sub-sections)
- `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<X>_BACKLOG.md` (Features, Ideas)
- `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<X>_DEV-AUDIT.md` or `<X>_DEV-STANDARDS.md` (Project specifics, all sub-sections)
- `AIDOCS/<X>_SETUP_ARCHIVE/AGENTS.md` and `CLAUDE.md` (orchestrator-level content if substantive)
- **Swept artifacts (every migration):** also read every file the artifact discovery sweep moved or copied into the archive (session-handoff, loose memory/context/notes docs, a `TEMP/` legacy dump, swept assistant-state folders, the copied low-confidence files). For a standard project these ARE the project history (the 321-structured files above will not exist). For a 321-shaped project they are supplemental scavenge layered on top of the EXTENDED import - do not skip them because the canonical files exist. Read any session-handoff file first, it is usually the densest single source of Current State and recent arc. Read for Big-6 context - the EXTENDED depth is captured by the engine in Steps 5-6 regardless of what you read here.

While reading, normalize legacy tokens so context is canonical (`DEV-STANDARDS` -> `DEV-AUDIT`, `/321 -DevStandards` -> `/321 -DevAudit`, `AIDOCS/SKILLS/` -> `AIDOCS/SKILL/`, `SKILLS_<NAME>` -> `SKILL_<NAME>`), and apply the project rename (`<OLD>_*.md` doc prefixes -> `<NEW>_*.md`). **Preserve real identifiers verbatim even when they contain the old name** - branches (`<OLD>_v1.2.3`), env vars (`<OLD>_WORKSPACE_ID`), bundle / marketplace IDs, repo URLs, code symbols, paths (`~/.<old>/`). Only rewrite a bare prose project-name mention, and only when the new name is the project's real identity (when the identity gate kept a disagreeing code identity, lean to preserving). Conservative on word boundaries.

State a one-line framing for the next skill invocations:

> "Setup migration in progress. The content above is accumulated project history from before this migration. The canonical pipeline (`/321 -SessionUpdate`, `/321 -MemoryUpdate -FULL`) will capture it into the current structure on the next two steps."

### Step 5: SESSION capture (lossless EXTENDED import + SessionUpdate)

Two parts share one commit. The engine does the lossless depth capture (EXTENDED). The skill does the history distillation (Current State + SESSION LIFO).

**Standard-project case (no 321-structured EXTENDED).** When migration was triggered by standard-project signals, there is no archived `<OLD>_SESSION_EXTENDED.md` to feed `migrate-import`. Skip Part A and let Part B do the capture from the discovered/copied artifacts plus the code scan. A session-handoff file is the highest-value source here - it usually IS the prior session's Current State and recent history. Loose memory/context files contribute LIFO events. Lossless depth import only applies when a 321-shaped EXTENDED exists. Otherwise SessionUpdate's judgment is the capture mechanism (acceptable, since there is no curated EXTENDED structure to preserve verbatim).

**Why split it this way.** Distillation at capture is irreversible loss. So the engine captures depth (EXTENDED sub-sections) VERBATIM, and only the SESSION LIFO event log is distilled by the skill. Reconciliation distills depth later against the complete import, auditable by diff.

**Part A - lossless EXTENDED import.** Run the engine command against the archived SESSION_EXTENDED:

```bash
node AIDOCS/tools/memory.mjs migrate-import \
  --from AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<OLD>_SESSION_EXTENDED.md \
  --skill session-update --old <OLD> --new <X>
```

`--old`/`--new` apply the project rename (legacy tokens normalize automatically). Lossless by construction, one `### sub-section` + one anchored MAIN bullet per entry - the engine README has the mechanics.

**Part A2 - append the swept session-lane scavenge docs (lossless, never dropped).** The Step 1 sweep archived AI-state docs (a `TEMP/` legacy dump, `.claude/` notes, loose handoff / session files). Import each session-shaped one onto the SAME staging with `--append` - do NOT fold it through judgment or drop one as "not authoritative" or "git history covers it", which is a reconcile decision, not a capture one:

```bash
node AIDOCS/tools/memory.mjs migrate-import \
  --from AIDOCS/<X>_SETUP_ARCHIVE/<swept-doc> --skill session-update --append --old <OLD> --new <X>
```

One run per session-shaped swept doc (handoff, active session, in-flight notes). `--append` merges and re-uniquifies slugs against what is already staged, and a doc with no headings imports as a single entry (the engine falls back). Memory / project-notes / standards-shaped docs go to the Step 6 memory lane, user reference docs (setup guides, style maps) restore to WDDOCS in Step 7. Unsure which lane -> memory. The over-import is intentional - reconciliation distills and dedups all of it.

**Part B - SessionUpdate appends to the same staging.** Run SessionUpdate, but instead of writing its own fresh staging, **add its ops to the staging file Part A produced**:

- `overwrite_section current_state` - Current State drafted from archived SESSION Current State + current code reality
- `lifo_insert` for project-significant events distilled from the archived SESSION LIFO history and event-shaped bullets from archived MEMORY LIFO (history distillation is the skill's job and is allowed to compress - it is not depth)

Do NOT re-derive SESSION_EXTENDED sub-sections - Part A already captured them losslessly. Adding history LIFO bullets that are NOT anchored to an imported sub-section is fine.

**Capture-completeness (Setup only).** Whole swept docs are imported by Part A2. This catch-all is for content embedded INSIDE a file (Known Issues, Next Steps, memory-promotion flags, loose notes) that lacks a clear home: route what has one (forward work to BACKLOG, durable constraints to MEMORY in Step 6), and land the rest in SESSION LIFO rather than dropping it, even where SessionUpdate's routine rules would DROP it - at capture time it may have no other home. Setup captures, it does not judge: reconciliation re-homes or drops it later. Routine `/321` passes never do this (they promote upward, never demote into SESSION).

**One commit for both parts, auto-prune suppressed.** `--no-prune` keeps the whole migration purely additive - nothing is reaped until the separate reconciliation pass (the gated `/321 -Update`), so the lossless import is never pruned mid-flight:

```bash
node AIDOCS/tools/memory.mjs validate --skill session-update
node AIDOCS/tools/memory.mjs commit   --skill session-update --no-prune
```

**Failure recovery.** Validate fails -> fix staging, re-validate. Commit fails -> the archive is intact, re-run from Part A. Recoverable through Step 7.

### Step 6: MEMORY capture (lossless EXTENDED import + MemoryUpdate -FULL)

Same shape as Step 5: engine does lossless depth capture, skill does schema fill. One commit.

**Standard-project case (no 321-structured EXTENDED).** As in Step 5, skip Part A when there is no archived `<OLD>_MEMORY_EXTENDED.md`. MemoryUpdate -FULL (Part B) fills the Big 6 from the code scan plus the discovered/copied artifacts - hand-rolled `CLAUDE.md` / `AGENTS.md` rules, loose memory docs, and the copied low-confidence files are prime Big 6 and Decisions source. BACKLOG draws from any TODO/handoff/notes files swept in.

**Part A - lossless EXTENDED import.** Run the engine command against the archived MEMORY_EXTENDED:

```bash
node AIDOCS/tools/memory.mjs migrate-import \
  --from AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<OLD>_MEMORY_EXTENDED.md \
  --skill memory-update --old <OLD> --new <X>
```

Same lossless mechanics as Step 5 (the engine README has the detail).

**Part A2 - append the swept memory-lane scavenge docs.** Same as Step 5 Part A2, for memory-shaped docs (project notes, dev-standards / conventions, pitfall notes): `--append` each onto the memory staging, never dropped at capture as "git history covers it". Headless docs import as one entry. The raw over-import (321 EXTENDED plus every swept doc) is intentional - reconciliation distills and cross-dedups it.

**Part B - MemoryUpdate -FULL appends to the same staging.** Run MemoryUpdate -FULL for its classification + Big-6 fill, but skip its Step 1 (the SessionUpdate auto-invoke) - Step 5 already captured SESSION this run, and re-invoking it would re-walk the conversation and demote the fresh Current State. Add its ops to the staging file Part A produced:

- `gap_fill_section` for each Big 6 section, drafted from codebase + conversation + SESSION distillation
- Decisions sub-sections from archived MEMORY's Decisions content where it still applies to current state
- `lifo_insert` for any durable observation NOT already captured as an imported EXTENDED entry (do not duplicate the import)
- `backlog_actions` - BACKLOG swept against codebase + SESSION. Archived Features and Ideas surface as candidates, and the skill filters and either lands them or drops shipped items

Do NOT re-derive MEMORY_EXTENDED sub-sections - Part A captured them losslessly. The skill's job here is schema fill (Big 6) + BACKLOG, not depth.

**One commit for both parts, auto-prune suppressed:**

```bash
node AIDOCS/tools/memory.mjs validate --skill memory-update
node AIDOCS/tools/memory.mjs commit   --skill memory-update --no-prune
```

The import lands MEMORY oversized (dozens of anchored entries is the raw layer by design). That is expected and safe: `--no-prune` means nothing is reaped during migration. The separate reconciliation pass (the gated `/321 -Update`) curates the raw import back under cap intelligently. The originals stay in `AIDOCS/<X>_SETUP_ARCHIVE` throughout.

**Failure recovery.** If migration Step 6 fails after migration Step 5 committed successfully, SESSION is fresh but MEMORY is still on the empty scaffold init wrote. The user has two options: re-run `/321 -MemoryUpdate -FULL` standalone (which can succeed independently), or re-run `/321 -Setup` (which detects the project is now partially populated, treats it as `refresh` mode, and re-attempts the fill). Archive is intact through both paths.

### Step 7: Restore verbatim user content

The skill pipeline owns MEMORY / SESSION / BACKLOG. The rest of the archive is user-owned. `migrate-restore` moves the **deterministic** layers back out of `AIDOCS/<X>_SETUP_ARCHIVE/`: `WDDOCS/` verbatim, the `_MEMORY/SESSION/BACKLOG_ARCHIVE/` history dirs, and `AIDOCS/ENV/` (renaming `<OLD>_ENV_*` filenames on a rename). Pass `--old <OLD>` only when the project was renamed.

```bash
node AIDOCS/tools/memory.mjs migrate-restore <target> --name <X> [--old <OLD>]
```

The remaining layers need judgment or network, so they stay manual:

1. **`.gitignore`.** Restore archived verbatim, then append a `# 321_STD additions` block with any entries the new install needs that the archive lacks (TEMP/, staging files, state.json). Conservative on dedup - a false positive is safer than dropping a real entry.

2. **DEV-AUDIT Project specifics.** Extract `## Project specifics` from archived `<X>_DEV-AUDIT.md` (or DEV-STANDARDS legacy) and insert into the new DEV-AUDIT's Project specifics verbatim. The canonical baseline (anchor principles, Hard Rules) is untouched. **Do not dedup here** - `/321 -Update`'s DEV-AUDIT lane walks it against the baseline. Bias: preserve everything.

3. **`CHANGELOG.md`.** Reformat archived entries to canonical structure and voice per `SKILL_AUTO-PUSH.md` (its CHANGELOG composition: `## [<VERSION>] - <YYYY-MM-DD>`, `### Added / Changed / Fixed / Removed`). Two distinct operations: **content fidelity** (reformatting invents no facts - sparse stays sparse, a missing date marks `<unknown>`) and **voice scrub** (mechanical: semicolon -> period/comma, em dash -> space-dash-space, applied even if the source skipped it). The archive keeps originals, so the user reviews after the run.

4. **Auto-memory dir (per-machine, network).** Init merge-copied it (existing preserved). Refresh the shared canonical feedback rules to current, plus AI-judged near-matches (e.g. `feedback_no_dashes` -> `feedback_no_em_dashes`): `feedback_code_comments`, `_doc_purpose_header`, `_lean_docs`, `_no_subagents_for_review`, `_no_versions_in_code`, `_temp_folder_usage`, `_no_em_dashes`, `_no_dates_in_memory`. For each: back up to `_SETUP_ARCHIVE/automemory_pre_migrate/`, fetch from `https://raw.githubusercontent.com/WillyDrucker/321_STD/main/AIDOCS/automemory/<file>` (`gh api repos/WillyDrucker/321_STD/contents/...` fallback), overwrite (byte-identical -> skip). Fetch failure -> keep the archived copy, mark unresolved, never fail the migration. **Preserve, never overwrite:** the `MEMORY.md` index (append a pointer if canonical added one), `user_*.md` profiles (rename `user_name.md` -> `user_<actual>.md`), `reference_*.md`, and any project-specific `feedback_*.md` not in the canonical list.

5. **AGENTS.md Hard Rules extension.** For each project-specific `feedback_*.md` preserved above (not canonical, not a user profile), append a pointer to the new AGENTS.md Hard Rules block just before the `[User profile]` bullet, alphabetized, so it surfaces at cold-start: `- [<filename without .md>](<filename>) - <one-line summary from the file's first heading or frontmatter description>`. Doctor's "Auto-memory pointers" check then passes.

### Step 8: Voice scrub on migration-written files

Steps 5-7 transfer archive prose into the canonical voice, and judgment can let banned characters (em dashes `—`, semicolons `;`) through. Scrub them in place across the migration-written files - `<X>_MEMORY(_EXTENDED)`, `<X>_SESSION(_EXTENDED)`, `<X>_BACKLOG`, `CHANGELOG`, and `AGENTS.md` if extended in Step 7 - skipping fenced code and inline-code spans:

- Em dash -> ` - ` (space-dash-space), trim double spaces.
- Semicolon -> `.` (or `,` for a list continuation), capitalize the next word if it starts a sentence.

Leave code spans, filenames, and URL query strings (`?a=b;c=d`) alone. Step 9 doctor confirms the result.

### Step 9: Post-restore doctor

Run `doctor` after Steps 7-8 and categorize:

```bash
node AIDOCS/tools/memory.mjs doctor
```

- **Structural / engine checks** (Paths, State, Skill bodies, Reconcile residue, Auto-memory pointers, manifests) must pass - a failure blocks completion.
- **Banned prose in MEMORY / SESSION / BACKLOG / CHANGELOG / AGENTS.md** must be zero. A survivor means Step 8 missed a case - rescrub.
- **Size / length warnings on MEMORY(_EXTENDED)** are expected (the raw import is over-cap by design) - do NOT hand-prune, reconciliation handles it.
- **Banned prose in WDDOCS / restored ENV / README** is pre-existing user content - surface as a warning in the Step 11 summary, do not fail Setup.

### Step 10: Mark reconciliation pending, then stop

Capture (Steps 5 + 6) landed the EXTENDED depth as a lossless raw import - intentionally over-split (one sub-section per entry) and over-cap (dozens of anchored entries), with raw `[+]` headlines and the source project's migration trail intact. Restore (Step 7) layered user-owned content on top. **None of it has been distilled yet.** Distillation is the assess half of "capture raw, then assess," and it deserves a clean, judgment-heavy pass with fresh context - not the migration's exhausted tail. So Setup does not run it. It sets a gate and stops:

```bash
node AIDOCS/tools/memory.mjs state --set-reconcile
```

This sets `reconcile_pending: true` in `state.json`. The next `/321 -Update` reads the gate, runs the reconciliation pass (SESSION / MEMORY / BACKLOG distillation - the gate logic lives in `SKILL_UPDATE.md`), and clears it. Until then the migration is usable but un-distilled - the lossless import and `AIDOCS/<X>_SETUP_ARCHIVE/` are the recovery net. Auto-prune stays effectively off during the gap (Steps 5/6 committed `--no-prune`, and the reconciliation pass curates under cap by intelligent edit, not by mechanical bottom-drop).

**Stop after this step.** Print the Step 11 summary and end the run. Do not chain into reconciliation - it is a separate invocation. The user runs `/321 -Update` next.

**All reconciliation runs in the gated `/321 -Update` pass** - SESSION / MEMORY / BACKLOG distillation, custom skill bodies, AGENTS / CLAUDE classification, and DEV-AUDIT Project-specifics dedup (mechanics in `SKILL_UPDATE.md`). Setup captures everything raw and sets the gate, it does not distill. The one step that stays the user's is deleting the setup archive once satisfied.

### Step 11: Summary

```
=== Migration captured (reconciliation pending) ===

Mode:              migration (<321-shaped | standard-project>)
Archive:           AIDOCS/<X>_SETUP_ARCHIVE/ (<N> paths, <M> files)
Artifact sweep:    <N> moved (high-confidence AI state), <M> copied (low-confidence, left in place)
                   (every migration - covers TEMP / .claude / loose memory docs, both shapes)
Legacy normalized: <N> references (DEV-STANDARDS, SKILLS, project rename)
Sync:              <N> skills registered
Custom skills:     <N> custom /321 body(ies) archived (<list>). Generic profile applies
                   until /321 -Update builds overrides. DELTA: <e.g. AutoPush will run the
                   vscode-extension default `vsce publish` - archived body used manual upload>
Doctor:            <pass> | <N user-content lint warnings>, <K> import size warnings (expected)
SessionUpdate:     SESSION + SESSION_EXTENDED written, <N> LIFO entries
MemoryUpdate:      MEMORY Big 6 filled, <N> LIFO entries, BACKLOG <K> items (raw import, un-distilled)
DEV-AUDIT:         Project specifics restored (dedup deferred to /321 -Update)
WDDOCS:            <N> files restored
ENV:               <N> files restored (renamed <M> filenames if project was renamed)
CHANGELOG:         normalized to canonical voice, <N> version blocks
Auto-memory:       <N> canonical replaced, <M> user-profile preserved, <K> project-specific preserved
AGENTS Hard Rules: extended with <N> project-specific feedback pointers
Voice scrub:       <N> em dashes + <M> semicolons removed across migration-written files

Reconciliation:    PENDING - gate set (reconcile_pending: true)

>>> NEXT STEP: run /321 -Update <<<

The migration captured everything losslessly but did NOT distill it. The raw
import is over-split, over-cap, with raw [+] bullets and the source project's
migration trail intact. /321 -Update reads the gate and runs the distillation
pass (merge over-split, drop duplicates / dead code, rewrite to descriptive [+]
bullets, strip the trail, sweep BACKLOG against WDDOCS), then clears the gate.
It also runs the skills-lane (archived custom /321 bodies -> customized AIDOCS/SKILL/
body + customizations[] entry, or fold), the AGENTS / CLAUDE classification lane (archived orchestrator
content -> lean AGENTS / MEMORY / DEV-AUDIT), and the DEV-AUDIT Project-specifics
dedup. Until then the generic profile applies, so a custom release pipeline is not
yet in effect. Migration is NOT complete until it runs.

/321 -Update reconciles all of the above in-gate (SESSION / MEMORY / BACKLOG, custom
skill bodies, AGENTS / CLAUDE classification, DEV-AUDIT dedup), surfacing any
contradictions for you mid-run. One step stays yours afterward:

Delete AIDOCS/<X>_SETUP_ARCHIVE/ ONLY once /321 -Update has run and the result feels
right. The archive is the safety net - keep it until the project does.
```

### Deferred reconciliation surface (reference)

The migration defers all distillation to the gated `/321 -Update` pass, which reconciles everything it captured. Nothing is a manual follow-up:

- **SESSION / MEMORY / BACKLOG distillation** - the raw import distilled to a steady state. Mechanics in `SKILL_UPDATE.md` (the reconciliation gate) and `SKILL_MEMORY-UPDATE.md` (the record conventions).
- **Custom `/321` skill bodies** (skills-lane) - each archived custom body is merged into its `AIDOCS/SKILL/SKILL_<NAME>.md` and flagged in `customizations[]` (so `init` preserves it on updates) or folds its genuine deviations into `<X>_DEV-AUDIT.md` / `<X>_MEMORY.md`.
- **AGENTS / CLAUDE classification + DEV-AUDIT Project-specifics dedup** - archived orchestrator content folds into a lean `AGENTS.md` / MEMORY / DEV-AUDIT, and the restored DEV-AUDIT Project specifics dedup against the canonical baseline.

Setup only sets the gate. The full per-lane mechanics - the reconciliation principle (canonical scan wins on overlap, contradictions surface, complements keep), the DEV-AUDIT scope guard (only `## Project specifics`, never the baseline), and the AGENTS lean targets - all live in `SKILL_UPDATE.md`.

## Rules (skill operation)

- **Post-init only.** Won't bootstrap a missing scaffold (Setup invokes init itself in migration Step 2).
- **Mode auto-detects.** Step 0 picks fresh vs migration, no flag. False-positive migration on a fresh scaffold is safe (archive empty, reinstall a no-op).
- **Big 6 is the bar.** Sync + doctor are mechanical, Big 6 fill is where Setup earns its space.
- **Migration captures, never distills.** It ends at capture + restore + scrub + doctor, sets the gate, and stops. `/321 -Update` distills later with fresh context. Capture loses nothing - uncertain content lands in SESSION LIFO, never dropped (reconciliation re-homes it). The DEV-AUDIT / AGENTS dedup is a manual follow-up outside the Update lane.
- **No mid-flow prompts in migration.** The Step 0 identity gate is the only one, the archive is the safety net. Per-section confirmation is fresh-install only.
- **Skills are the writer.** SessionUpdate owns SESSION (Step 5), MemoryUpdate owns MEMORY + BACKLOG (Step 6). Setup loads context and delegates, it does not write these directly. CHANGELOG is AutoPush's domain (Step 7 only reformats, never invents).
- **Archive is the safety net**, kept until the user deletes it. Idempotent: a completed project re-running Setup sees "refresh", not "migration".
