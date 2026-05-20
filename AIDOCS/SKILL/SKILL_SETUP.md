---
name: setup
description: First-run wizard or migration for a 321_STD project. Detects fresh-install vs existing-project state. Fresh - walks Big 6 fill from project signals with per-section confirmation, sets release_profile, resolves auto_memory.path, optional ENV starter and first git commit. Migration - archives existing content (321-shaped, or a standard project's scattered AI artifacts via a confidence-graded discovery sweep), reinstalls canonical 321_STD, captures depth losslessly via migrate-import, restores user content, then sets the reconcile_pending gate and stops for /321 -Update to distill. Idempotent.
---

# /321 -Setup

**Purpose:** Make a 321_STD project usable. Two modes, auto-selected by what Setup finds in the target.

- **Fresh-install mode.** `init` produced an empty scaffold. Setup walks Big 6 fill, release_profile, auto_memory.path, optional ENV starter, optional first commit. Per-section confirmation, idempotent re-runs.
- **Migration mode.** Setup detects an existing project (filled Big 6, populated LIFO, user docs in WDDOCS, etc.). Archives the project's content to `AIDOCS/<X>_SETUP_ARCHIVE/`, runs `init` to land the canonical 321_STD structure on top, fresh-scans the code for current Big 6 reality, then backfills the archive into the new structure with legacy naming normalization (DEV-STANDARDS -> DEV-AUDIT, SKILLS -> SKILL, etc.).

**Invocation:** Once, immediately after `node AIDOCS/tools/memory.mjs init <target> --name <PROJECT>`. Subsequent runs at any time refresh sync and pick up where left off. Re-running on a migrated project is safe - it sees the project as filled (post-migration) and just refreshes sync.

## You drive the wizard

The script can't decide what the project's Stack is, or whether the user prefers `npm-package` vs `static-site`, or which archived bullets are still load-bearing after a migration. Setup is the place where AI judgment meets project context and user preference. For fresh-install Big 6 drafts, per-section confirmation (accept / edit / skip) keeps the user in the loop. For migration, the canonical skill pipeline (SessionUpdate, MemoryUpdate -FULL) auto-applies through its own staging rules - migration is a "run end-to-end, review the result" flow, not a step-by-step approval flow.

## Pipeline (fresh path)

| Step | Action | AI does | Script does |
|---|---|---|---|
| 0 | Detect state | Read signals, decide fresh vs migration | (none) |
| 1 | Sync + health | Decide pass / fail | `sync` + `doctor` |
| 2 | Big 6 fill | Read project, draft each section, prompt user, build staging | `memory-update` two-phase commit |
| 3 | release_profile | Confirm init's auto-detect | (file edit) |
| 4 | auto_memory.path | Confirm init's resolution | (file edit) |
| 5 | ENV starters | Optional, prompt for keys | (file write) |
| 6 | First commit | Stage relevant files, write commit message | `git commit` |
| 7 | Summary | Format + display | (none) |

## Pipeline (migration path)

| Step | Action | AI does | Script does |
|---|---|---|---|
| 1 | Archive existing | Move project content to `AIDOCS/<X>_SETUP_ARCHIVE/` | Bash / PowerShell `mv` |
| 2 | Reinstall canonical | (none) | `init` |
| 3 | Sync + health | Decide pass / fail | `sync` + `doctor` |
| 4 | Load archive into context | Read archive files, normalize legacy refs as they enter context | (none) |
| 5 | SESSION capture | SessionUpdate appends Current State + history LIFO to the import staging | `migrate-import` (lossless EXTENDED) + `session-update` commit |
| 6 | MEMORY capture | MemoryUpdate -FULL appends Big 6 + BACKLOG to the import staging | `migrate-import` (lossless EXTENDED) + `memory-update` commit |
| 7 | Restore verbatim user content | Restore + ENV rename + DEV-AUDIT insert + CHANGELOG voice + auto-memory + AGENTS Hard Rules extension | file ops + voice rules + auto-memory rules |
| 8 | Voice scrub | Strip em dashes + semicolons from migration-written files | regex in-place edit |
| 9 | Post-restore doctor | Categorize engine vs user-content findings | `doctor` |
| 10 | Mark reconciliation pending + stop | Set the gate, point user at `/321 -Update`, log deferred manual follow-ups | `state --set-reconcile` |
| 11 | Summary | Format + display | (none) |

**Migration captures raw, then hands off.** Steps 1-9 are mechanical (lossless capture + restore + scrub + doctor). Step 10 sets the `reconcile_pending` gate and STOPS - the distillation pass is judgment-heavy and runs with fresh context as `/321 -Update`, not crammed into the migration's exhausted tail. Step 0 decides the mode and resolves the project name. The only prompt migration may ever raise is the Step 0 identity-conflict gate (folder name disagrees with code identity), and it fires before any destructive step. Once past Step 0, Steps 1-11 chain through without asking the user to confirm between them. The only other stop conditions are validate or commit failures inside the skill invocations (migration Step 5 / migration Step 6), which surface for review. The archive at `AIDOCS/<X>_SETUP_ARCHIVE/` is the safety net throughout - migration is reversible until the user deletes it.

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

When a standard-project signal is what triggered migration (no 321-shaped signal present), the archive step runs the **artifact discovery sweep** (Step 1) instead of relying only on the known 321 path list, and Steps 5/6 capture from the discovered files plus the code scan rather than from a 321-structured EXTENDED. Everything else in the migration path is identical.

**Branch decision (auto, no prompt):**

- **Migration triggered** -> resolve the project name (identity gate below), print the migration-mode banner, and proceed to Step 1 of the migration path.
- **Fresh / refresh** -> print `Setup detected: fresh install.` (or `Setup detected: refresh (N of 6 Big 6 filled).`) and proceed to Step 1 of the fresh path.

**Identity-conflict gate (the ONE sanctioned migration prompt, fires here in Step 0 only).** Resolve the project name now, before anything is archived or `init` runs - because `init` bakes `--name <X>` into `_index.json` and every scaffold filename in migration Step 2, so a name decision made later means re-running init. Resolution precedence (see migration Step 1 for detail): target basename wins by default.

Then check for an identity conflict: does the basename disagree with the project's strong identity signals? Strong signals are `package.json` `name`, the VCS branch prefix (`git branch --show-current`), and the dominant `<NAME>_*.md` filename pattern in the archive. If basename agrees with them (or they are absent), proceed silently - basename wins, no prompt. If basename DISAGREES with two or more strong signals (e.g. folder is `MyProject` but `package.json` says `acme-app`, branch is `acme-app_v1.2.3`, files are `acme-app_*`), surface exactly one decision before Step 1:

> "The folder is named `<basename>` but the project's code identity is `<signal-name>` (package.json `<name>`, branch `<prefix>`, docs `<NAME>_*`). The docs scaffold will be named after whichever you pick, and it is upstream of everything Setup writes. Use `<basename>` (rename the docs to match the folder) or `<signal-name>` (keep the code identity)? Default if you do not answer: `<basename>`."

This is the only prompt migration is allowed to raise, and it fires in Step 0 before any destructive step. Every other case runs end-to-end with no mid-flow prompts. Record the resolved `<X>` and the chosen-vs-rejected names for the Step 11 summary.

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
```

## Migration path

The target already holds content worth preserving. Two shapes hit this path: a **321-shaped project** (a prior 321 install or legacy variant, with the known `<X>_MEMORY.md` / `_SESSION.md` / etc. structure) and a **standard project** that never used 321 but accumulated AI working state in ad-hoc places (a hand-rolled `CLAUDE.md`, a session-handoff file, loose memory/notes docs). Goal is the same for both: land the current canonical structure with our skills as source, then layer the project's accumulated knowledge back in. The difference is only in capture - 321-shaped projects feed the lossless `migrate-import`, standard projects feed the artifact discovery sweep (Step 1) and capture from discovered files plus the code scan (Steps 5/6 Part B).

### Step 1: Archive existing content

Create `AIDOCS/<X>_SETUP_ARCHIVE/` in the target. **Move** (not copy) the project-owned content into it. Engine files stay put - they get refreshed in migration Step 2.

**Archive these paths** (move from source -> `AIDOCS/<X>_SETUP_ARCHIVE/<same-relative-path>`):

- `AGENTS.md`
- `CLAUDE.md`
- `CHANGELOG.md`
- `.gitignore`
- `AIDOCS/_index.json`
- `AIDOCS/<X>_MEMORY.md`, `AIDOCS/<X>_MEMORY_EXTENDED.md`
- `AIDOCS/<X>_SESSION.md`, `AIDOCS/<X>_SESSION_EXTENDED.md`
- `AIDOCS/<X>_BACKLOG.md`
- `AIDOCS/<X>_DEV-AUDIT.md` OR `AIDOCS/<X>_DEV-STANDARDS.md` (legacy name)
- `AIDOCS/<X>_MEMORY_ARCHIVE/`, `AIDOCS/<X>_SESSION_ARCHIVE/`, `AIDOCS/<X>_BACKLOG_ARCHIVE/`
- `AIDOCS/ENV/`
- `WDDOCS/`

`<X>` was already resolved in Step 0 (the identity-conflict gate runs there, before `init`). The resolution precedence Step 0 uses:

1. **Target directory's basename** wins by default. The user controls naming by naming their folder.
2. If basename is invalid (does not match `^[A-Za-z][A-Za-z0-9_-]*$`), fall back to archived `_index.json -> project_name`.
3. If both fail, fall back to the dominant archived filename pattern (whichever `<NAME>_MEMORY.md` pattern has the most matching files).

Step 0 also raised the identity-conflict gate if the basename disagreed with strong code-identity signals. By the time migration Step 1 runs, `<X>` is fixed. The banner already showed `Project name: <X> (from <source>)`. Archive preserves old names verbatim. Legacy name normalization in migration Step 4 rewrites archived prose references to the new name (the `migrate-import` command takes `--old`/`--new` for the EXTENDED files, and other restores apply the rename inline).

**Dual-pattern AIDOCS state** (legacy `OldName_*.md` alongside fresh `NewName_*.md` from a prior install): archive the legacy files (the migration source - they hold the content). The fresh `NewName_*.md` scaffolds only need to move aside so the reinstall in migration Step 2 lands cleanly. Delete any that are byte-identical to the init template - they are regenerable, hold nothing to preserve, and archiving empty scaffolds just clutters the safety net by reading as migrated content when they are not. Archive a `NewName_*` scaffold only when it carries real content (the prior install was worked on before the re-run). After reinstall, only the fresh `<X>_*.md` scaffolds remain at the project root.

**Do NOT archive** (these are 321_STD engine, replaced wholesale in migration Step 2):

- `AIDOCS/SKILL/` (or `AIDOCS/SKILLS/` for legacy projects - delete after archive note below)
- `AIDOCS/tools/`
- `.claude/skills/321/SKILL.md` (or `SKILLS.md` for legacy)
- `AIDOCS/automemory/` (template - new install merge-copies. User's per-machine rules elsewhere preserved)

**Do NOT archive and never touch** (user owns these, 321_STD has no opinion):

- `README.md` (project's README - we ship no template, never replace)
- Any source code directories (`src/`, `lib/`, etc.)
- Build / dependency artifacts (`node_modules/`, `dist/`, `.next/`, etc.)
- Project config (`package.json`, `tsconfig.json`, `wrangler.toml`, `astro.config.*`, etc.)

**Artifact discovery sweep (projects not already shaped by 321).** The known-path list above covers 321-shaped projects. A standard project kept its AI working state somewhere else, so scan for it and route each find by confidence. This is judgment work - the lists are "including but not limited to," judge by content, not filename alone.

Where to look:

- Root, and docs-ish or assistant-state folders: `docs/`, `notes/`, `.ai/`, `ai/`, `memory/`, `context/`, `.cursor/`, `.windsurf/`, `.aider*`, `.github/`
- Files named like memory/session/handoff: `MEMORY*.md`, `*_MEMORY.md`, `SESSION*.md`, `*HANDOFF*.md`, `SESSION_HANDOFF*`, `CONTEXT*.md`, `NOTES.md`, `PROJECT.md`, `TODO.md`, `SCRATCH*`, `*_log.md`
- Hand-rolled assistant config: `CLAUDE.md`, `AGENTS.md`, `.clauderc`, `.cursorrules`, `*.mdc`
- The project's auto-memory directory, if one exists

Classify each find on two axes: **who owns it** (a user document the user reads and edits, vs AI-tracked working state the assistant wrote to remember things between sessions and the user rarely opens) and **confidence it is stale AI state** (how sure you are it is safe to lift out of the working tree). Then route by confidence - the rule is move when sure, copy when unsure, and the archive is the safety net either way since nothing is deleted:

- **High confidence AI-tracked and stale -> MOVE to `AIDOCS/<X>_SETUP_ARCHIVE/`** (it becomes migration source like the known-path list). Session-handoff files are the clearest case - they exist to bridge one session to the next and are throwaway once captured. Files plainly named as memory/session logs land here too.
- **Auto-memory directory -> MOVE most of it** (AI-tracked by definition), with two carve-outs that stay put: `MEMORY.md` (the auto-memory index init manages) and `user_*.md` profiles. Init's auto-memory merge handles canonical files, and preserved user rules stay.
- **Low confidence / might still be user content -> COPY into the archive, leave the original in place.** Ambiguous docs, anything half-user-half-AI, anything you cannot confidently call stale. The copy seeds the Big 6 fill and the capture passes (Steps 5/6) without disturbing the user's working tree.
- **`CLAUDE.md` / `AGENTS.md` bodies** are archived by the known-path list above (init must rewrite them), but do NOT treat them as throwaway - users bloat them with real project rules. Their content is classified in the deferred review (Step 11), not discarded.
- **Never sweep** user source, project config, build artifacts, or `README.md` - same exclusions as above.

Record what moved vs what was copied (with the confidence call for each) for the Step 11 summary, so the user can see what was lifted out of their tree and what was left in place.

**Legacy cleanup before init:**

- If `AIDOCS/SKILLS/` (plural) exists: **read each `SKILLS_<NAME>/<X>_SKILLS_<NAME>.md` in full, then move (do not delete) to `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/SKILLS/`** before init runs. These hold project-specific procedural customizations (custom publish steps, project audit rules, embedded Hard Rules) with no other home. Scavenge that content during Step 4 context loading: procedural skill overrides route to `<X>_DEV-AUDIT.md` Project specifics or `<X>_MEMORY.md > Pipeline`, path refs normalize in flight. After init writes canonical `AIDOCS/SKILL/` (singular), the archived plural dir is gone from the project root.
- If `.claude/skills/321/SKILLS.md` exists (plural): read it (may hold a custom router), then move to `AIDOCS/<X>_SETUP_ARCHIVE/.claude/skills/321/SKILLS.md`. Init writes the canonical singular `SKILL.md`.

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
- **Standard-project case:** also read every file the artifact discovery sweep moved or copied into the archive (session-handoff, loose memory/context/notes docs, swept assistant-state folders, the copied low-confidence files). For a standard project these ARE the project history - they replace the 321-structured files above, which will not exist. The session-handoff file especially: read it first, it is usually the densest single source of Current State and recent arc.

**Verification (do not skip):** after reading, list the H2 + H3 section headers you observed across all files. If MEMORY_EXTENDED, SESSION_EXTENDED, or any other file has zero sections in your list, you skipped it - read it now.

While reading, normalize legacy references on the fly so what enters context is canonical:

- `DEV-STANDARDS` -> `DEV-AUDIT`
- `/321 -DevStandards` -> `/321 -DevAudit`
- `AIDOCS/SKILLS/` -> `AIDOCS/SKILL/`
- `SKILLS_<NAME>.md` -> `SKILL_<NAME>.md`
- Project name renames: if migration Step 1 resolved the new install name differently from the archived `_index.json -> project_name`, rewrite the doc filename prefixes (`<OLD>_*.md` -> `<NEW>_*.md`) and the project's own scaffold references. **Preserve real identity verbatim, even when it contains the old name** - marketplace IDs, repo URLs, git branches (`<OLD>_v1.2.3`), code symbols / folders, env vars (`<OLD>_WORKSPACE_ID`), and filesystem paths (`~/.<old>/`) are not "the project name as a doc subject," they are real identifiers that break if rewritten. Only rewrite a bare prose project-name mention when the new name is genuinely the project's identity (the normal case, basename matches code identity). When the identity gate chose the basename OVER a disagreeing code identity, the content legitimately keeps describing the real product - lean to preserving it. Conservative on word-boundary matches.

State a one-line framing for the next skill invocations:

> "Setup migration in progress. The content above is accumulated project history from before this migration. The canonical pipeline (`/321 -SessionUpdate`, `/321 -MemoryUpdate -FULL`) will capture it into the current structure on the next two steps."

### Step 5: SESSION capture (lossless EXTENDED import + SessionUpdate)

Two parts share one commit. The engine does the lossless depth capture (EXTENDED). The skill does the history distillation (Current State + SESSION LIFO).

**Standard-project case (no 321-structured EXTENDED).** When migration was triggered by standard-project signals, there is no archived `<OLD>_SESSION_EXTENDED.md` to feed `migrate-import`. Skip Part A and let Part B do the capture from the discovered/copied artifacts plus the code scan. A session-handoff file is the highest-value source here - it usually IS the prior session's Current State and recent history. Loose memory/context files contribute LIFO events. Lossless depth import only applies when a 321-shaped EXTENDED exists. Otherwise SessionUpdate's judgment is the capture mechanism (acceptable, since there is no curated EXTENDED structure to preserve verbatim).

**Why split it this way.** Distillation at capture is irreversible loss - routing EXTENDED through a skill's judgment compresses it (sub-sections get dropped as "completed arcs"). So depth (EXTENDED sub-sections, the prior author's curated narratives) is captured VERBATIM by the engine, and only history (the SESSION LIFO event log) is distilled by the skill. The reconciliation pass (the gated `/321 -Update`) does any depth distillation later, against the complete import, auditable by diff.

**Part A - lossless EXTENDED import.** Run the engine command against the archived SESSION_EXTENDED:

```bash
node AIDOCS/tools/memory.mjs migrate-import \
  --from AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<OLD>_SESSION_EXTENDED.md \
  --skill session-update --old <OLD> --new <X>
```

This writes `staging/session-update.json` with one `### sub-section` per archived entry (one per `### H3` in-flight item, while flat `**bold-lead.**` entries under an `## H2` split one-per-entry) plus one anchored MAIN LIFO bullet per sub-section. The MAIN bullet's `extended_anchor` is the sub-section's slug, so the commit orphan check passes by construction. `--old`/`--new` apply the project rename, and legacy tokens (DEV-STANDARDS, SKILLS) normalize automatically. No content drops - the 10-line prose cap is advisory (post-write lint), never a reason to compress.

**Part B - SessionUpdate appends to the same staging.** Run SessionUpdate, but instead of writing its own fresh staging, **add its ops to the staging file Part A produced**:

- `overwrite_section current_state` - Current State drafted from archived SESSION Current State + current code reality
- `lifo_insert` for project-significant events distilled from the archived SESSION LIFO history and event-shaped bullets from archived MEMORY LIFO (history distillation is the skill's job and is allowed to compress - it is not depth)

Do NOT re-derive SESSION_EXTENDED sub-sections - Part A already captured them losslessly. Adding history LIFO bullets that are NOT anchored to an imported sub-section is fine.

**Capture-completeness (Setup only).** Source projects often embed content the 321 model splits across files - Known Issues / watch-lists, Next Steps, explicit memory-promotion flags, loose notes - directly in their SESSION or handoff file. Route what has a clear home (forward work to BACKLOG in Step 6, durable constraints to MEMORY in Step 6), but when a section's home is genuinely unclear, land it as a SESSION LIFO bullet rather than dropping it. During migration this overrides SessionUpdate's routine DROP rows (forward-looking work, durable observations, code patterns) - those assume the content already has another home, which at capture time it may not. Setup captures, it does not judge - the reconciliation pass (`/321 -Update`) re-homes or drops it against the full import. This catch-all is Setup-only: routine `/321` passes never demote uncertain content into SESSION (a promote-then-demote loop), they read session data and promote upward or leave it in place.

**One commit for both parts, auto-prune suppressed.** `--no-prune` keeps the whole migration purely additive - nothing is reaped until the separate reconciliation pass (the gated `/321 -Update`), so the lossless import is never pruned mid-flight:

```bash
node AIDOCS/tools/memory.mjs validate --skill session-update
node AIDOCS/tools/memory.mjs commit   --skill session-update --no-prune
```

**Failure recovery.** If validate fails, fix the staging file and re-validate. If commit fails after validate succeeded (rare - filesystem error, concurrent edit), inspect SESSION + SESSION_EXTENDED for partial writes, restore from `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<OLD>_SESSION.md` if needed, then re-run migration Step 5 from Part A. Archive is intact throughout - migration is recoverable up through migration Step 7.

### Step 6: MEMORY capture (lossless EXTENDED import + MemoryUpdate -FULL)

Same shape as Step 5: engine does lossless depth capture, skill does schema fill. One commit.

**Standard-project case (no 321-structured EXTENDED).** As in Step 5, skip Part A when there is no archived `<OLD>_MEMORY_EXTENDED.md`. MemoryUpdate -FULL (Part B) fills the Big 6 from the code scan plus the discovered/copied artifacts - hand-rolled `CLAUDE.md` / `AGENTS.md` rules, loose memory docs, and the copied low-confidence files are prime Big 6 and Decisions source. BACKLOG draws from any TODO/handoff/notes files swept in.

**Part A - lossless EXTENDED import.** Run the engine command against the archived MEMORY_EXTENDED:

```bash
node AIDOCS/tools/memory.mjs migrate-import \
  --from AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<OLD>_MEMORY_EXTENDED.md \
  --skill memory-update --old <OLD> --new <X>
```

This writes `staging/memory-update.json` with one `### sub-section` per archived entry plus one anchored MAIN LIFO bullet each. A dense flat section (an `## H2` holding many `**bold-lead.**` paragraphs) splits per bold-lead, one sub-section each, so no single entry collides with the 10-line cap. List-item bolds (`- **x**`) stay as body of their parent entry.

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

The skill pipeline owns MEMORY / SESSION / BACKLOG. The remaining archive contents are user-owned and restore in place. No skill flow for these.

1. **`WDDOCS/`.** Restore the entire archived `WDDOCS/` tree verbatim. Design docs, archives, plans are user-owned.

2. **`AIDOCS/<X>_MEMORY_ARCHIVE/`, `_SESSION_ARCHIVE/`, `_BACKLOG_ARCHIVE/`.** Restore archived contents. Historical snapshots stay frozen.

3. **`AIDOCS/ENV/`.** Restore archived contents. If the project was renamed (target basename differs from archived `_index.json -> project_name`), rename `<OLD>_ENV_*.md` files to `<NEW>_ENV_*.md` during the restore. File content stays verbatim - only the filename prefix gets updated to match the new project name.

4. **`.gitignore`.** Restore archived verbatim. Append a `# 321_STD additions` block at the bottom with any entries the new install needs that the archive lacks (TEMP/, staging files, state.json). Conservative on dedup - false positives are safer than dropping a real entry.

5. **DEV-AUDIT Project specifics.** Extract the `## Project specifics` section from archived `<X>_DEV-AUDIT.md` (or DEV-STANDARDS legacy). Insert into the new DEV-AUDIT's Project specifics section verbatim. The new DEV-AUDIT baseline (anchor principles, canonical Hard Rules) is untouched. **Do not dedup here.** The deferred manual DEV-AUDIT pass (see the deferred reconciliation surface) walks Project specifics against the canonical baseline and drops duplicates / surfaces contradictions then. Bias here is "preserve everything from archive". Reconciliation is the next pass's job.

6. **`CHANGELOG.md`.** Reformat archived entries to canonical structure and voice per `SKILL_AUTO-PUSH.md` Step 4 (Keep a Changelog + Semantic Versioning: `## [<VERSION>] - <YYYY-MM-DD>`, `### Added / Changed / Fixed / Removed`, standard preamble). AutoPush carries the voice cadence and canonical reference. Two operations, do not conflate them:

   - **Content fidelity.** Reformatting does NOT mean inventing facts. Sparse entries stay sparse. A missing date marks `<unknown>` for the user.
   - **Voice scrub (mechanical).** Strip em dashes and semicolons (`feedback_no_em_dashes.md`): semicolon to period (or comma for list continuations), em dash to space-dash-space. Deterministic substitution, not fact invention. Apply it even when the source skipped it - a voice template is not a license to inherit its violations.

   Reformat and move on - the voice scrub is deterministic and the archive keeps the originals, so the user reviews the reformatted CHANGELOG after the run rather than confirming each entry mid-migration.

7. **Auto-memory dir (per-machine).** The auto-memory dir at `_index.json -> auto_memory.path` was merge-copied by init (existing files preserved). For migration: refresh the canonical shared feedback rules to current versions, and preserve everything else (the index, profiles, references, project-specific rules).

    **Refresh to current canonical** (the shared feedback rules, plus AI-judged near-matches - a filename close to a canonical like `feedback_no_dashes.md` -> `feedback_no_em_dashes.md`, or content covering the same rule worded differently):
    - `feedback_code_comments.md`, `feedback_doc_purpose_header.md`, `feedback_lean_docs.md`, `feedback_no_subagents_for_review.md`, `feedback_no_versions_in_code.md`, `feedback_temp_folder_usage.md`, `feedback_no_em_dashes.md`, `feedback_no_dates_in_memory.md`

    **Preserve (never overwrite):**
    - `MEMORY.md` - the auto-memory INDEX. It lists the user's full rule set, including project-specific feedback, references, and profiles the canonical template lacks. Overwriting it drops those pointers. Keep it. If the canonical set added a feedback file the index does not list, append just that one pointer - never replace the index wholesale.
    - `user_*.md` (profiles, including `user_name.md` renamed to `user_<actual>.md`), `reference_*.md`, and any other non-feedback file
    - Any `feedback_*.md` not in the canonical list and not a near-match (project-specific rules)

    **Procedure:**
    1. Read each file. Categorize: canonical-feedback (or near-match), the `MEMORY.md` index, or preserve-as-is.
    2. For canonical-feedback + near-match: copy to `AIDOCS/<X>_SETUP_ARCHIVE/automemory_pre_migrate/`, then fetch current canonical from `https://raw.githubusercontent.com/WillyDrucker/321_STD/main/AIDOCS/automemory/<filename>` (or `gh api repos/WillyDrucker/321_STD/contents/AIDOCS/automemory/<filename>` as an authenticated fallback) and overwrite. If the dir file is already byte-identical to canonical, leave it (no-op).
    3. **Fetch failure (network / 404 / private without gh auth):** preserve the archived copy in place. Mark `unresolved - using archived version`. Never fail the migration on an auto-memory fetch error.
    4. For the index and preserve-as-is files: leave in place.

    Report: N canonical refreshed (or identical, left), index preserved, M profiles + K project-specific + references preserved, J unresolved.

8. **AGENTS.md Hard Rules extension.** When the auto-memory dir has project-specific `feedback_*.md` files preserved in step 7 (not canonical, not user profiles), append pointers for them to the new AGENTS.md Hard Rules block so they are surfaced at the orchestrator level. Without this, the rules exist on disk but aren't visible at cold-start.

    **Procedure:**
    1. List preserved `feedback_*.md` files (the ones NOT in the canonical filename list and NOT replaced).
    2. Read each file's first heading or frontmatter `description` for a one-line summary.
    3. Insert into AGENTS.md Hard Rules block as additional bullets (just before the `[User profile]` bullet at the end):

       ```markdown
       - [<filename without extension>](<filename>) - <one-line description from the file>
       ```

    4. Maintain alphabetical order within the inserted block. Doctor will then pass the "Auto-memory pointers" check on the next run.

### Step 8: Voice scrub on migration-written files

The canonical skill pipeline (Steps 5 + 6) and CHANGELOG normalization (Step 7 layer 6) walk archive content. AI judgment can preserve banned characters (em dashes `—`, semicolons `;`) when transferring archive prose into the canonical voice. This step is a deterministic catch-net.

Scrub these files in place after Steps 5, 6, and 7 have all committed:

- `AIDOCS/<X>_MEMORY.md` and `_MEMORY_EXTENDED.md`
- `AIDOCS/<X>_SESSION.md` and `_SESSION_EXTENDED.md`
- `AIDOCS/<X>_BACKLOG.md`
- `CHANGELOG.md`
- `AGENTS.md` (only if newly extended in step 7.8)

**Scrub rules** (line-by-line, skip fenced code blocks and inline code spans):

- **Em dash (`—`):** replace with ` - ` (space-dash-space). Trim resulting double-spaces.
- **Semicolon (`;`)** in prose: replace with `.` followed by capitalization fix of the next word if it starts a new sentence-shaped clause. If the clause after the semicolon does not form a sentence (e.g., a parenthetical list continuation), replace with `,` instead. AI uses judgment per-instance, but the deterministic default is `.` (most archive prose semicolons separate sentences).

**What NOT to scrub:**

- Code blocks (anything inside triple-backtick fences)
- Inline code spans (anything between single backticks)
- Filenames with semicolons (unlikely but possible on some platforms - leave alone)
- URL query strings (preserve `?key=value;other=value` if it appears)

After the scrub, re-validate the affected staging trees (none expected since Steps 5 and 6 already committed - this is a direct in-place edit pass).

### Step 9: Post-restore doctor

Run `doctor` after Steps 7 and 8. The scrub in Step 8 should have eliminated em dashes and semicolons from migration-written files. Doctor's remaining lint output should now flag only pre-existing prose in user-owned restored content (WDDOCS, README, .github, source code docs) plus the un-distilled raw import (over-cap MEMORY / MEMORY_EXTENDED, length warnings). Both are expected at this stage and get resolved by the reconciliation pass.

```bash
node AIDOCS/tools/memory.mjs doctor
```

Categorize the output:

- **Engine checks (Paths, State, Skill bodies, Auto-memory pointers, Router quick-ref, Customization manifest, Release profile):** must all pass. Failure here is a real structural issue and blocks migration completion.
- **Banned-prose violations in MEMORY / SESSION / BACKLOG / CHANGELOG / AGENTS.md:** must be zero. If any remain after Step 8, the scrub missed cases - inspect and rescrub before completing.
- **Size / length warnings on MEMORY / MEMORY_EXTENDED:** expected. The import is intentionally over-cap and over-split. The reconciliation pass (`/321 -Update`) brings it under cap through intelligent edits - do NOT hand-prune here.
- **Banned-prose violations in WDDOCS / restored ENV / README:** surface as "user-content lint warnings" in the Step 11 summary. Do not fail Setup. User owns these files and can scrub them later or accept them as-is.

### Step 10: Mark reconciliation pending, then stop

Capture (Steps 5 + 6) landed the EXTENDED depth as a lossless raw import - intentionally over-split (one sub-section per entry) and over-cap (dozens of anchored entries), with raw `[+]` headlines and the source project's migration trail intact. Restore (Step 7) layered user-owned content on top. **None of it has been distilled yet.** Distillation is the assess half of "capture raw, then assess," and it deserves a clean, judgment-heavy pass with fresh context - not the migration's exhausted tail. So Setup does not run it. It sets a gate and stops:

```bash
node AIDOCS/tools/memory.mjs state --set-reconcile
```

This sets `reconcile_pending: true` in `state.json`. The next `/321 -Update` reads the gate, runs the reconciliation pass (SESSION / MEMORY / BACKLOG distillation - the gate logic lives in `SKILL_UPDATE.md`), and clears it. Until then the migration is usable but un-distilled - the lossless import and `AIDOCS/<X>_SETUP_ARCHIVE/` are the recovery net. Auto-prune stays effectively off during the gap (Steps 5/6 committed `--no-prune`, and the reconciliation pass curates under cap by intelligent edit, not by mechanical bottom-drop).

**Stop after this step.** Print the Step 11 summary and end the run. Do not chain into reconciliation - it is a separate invocation. The user runs `/321 -Update` next.

**Two manual follow-ups stay outside the Update lane** (detailed in the deferred surface below, surfaced in the summary): the DEV-AUDIT Project specifics dedup and the AGENTS / CLAUDE classification. Both are judgment edits on files the skills do not own, so they are not part of the gated `/321 -Update` pass.

### Step 11: Summary

```
=== Migration captured (reconciliation pending) ===

Mode:              migration (<321-shaped | standard-project>)
Archive:           AIDOCS/<X>_SETUP_ARCHIVE/ (<N> paths, <M> files)
Artifact sweep:    <N> moved (high-confidence AI state), <M> copied (low-confidence, left in place)
                   (standard-project only - omit line for 321-shaped migrations)
Legacy normalized: <N> references (DEV-STANDARDS, SKILLS, project rename)
Sync:              <N> skills registered
Doctor:            <pass> | <N user-content lint warnings>, <K> import size warnings (expected)
SessionUpdate:     SESSION + SESSION_EXTENDED written, <N> LIFO entries
MemoryUpdate:      MEMORY Big 6 filled, <N> LIFO entries, BACKLOG <K> items (raw import, un-distilled)
DEV-AUDIT:         Project specifics restored (dedup deferred to manual review)
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
Migration is NOT complete until it runs.

Deferred manual follow-ups (outside the /321 -Update lane):

1. AGENTS.md / CLAUDE.md classification. Archived AGENTS.md (<N> bytes, <M> sections)
   and CLAUDE.md (<bytes> bytes, substantive=<Y/N>) hold orchestrator-level content
   Setup did NOT auto-classify. Open them side-by-side with the new AGENTS.md and route
   each substantive block:
   - Already captured by Steps 5/6? Skip.
   - Orchestrator-level fact (cold-start hint, project quirk)? -> new AGENTS.md > Project Specifics (lean).
   - Custom Permissions config? -> new AGENTS.md > Permissions.
   - Project-specific code rule / language convention? -> <X>_DEV-AUDIT.md > Project specifics.
   - History the skills missed? -> /321 -SessionUpdate or /321 -MemoryUpdate -FULL.
2. DEV-AUDIT Project specifics dedup. Walk the restored Project specifics against the
   canonical baseline using the reconciliation principle (deferred surface below).

Review needed (contradictions surfaced, not auto-resolved):
  - <file A> says X / <file B> says not-X
  (empty block if none)

3. Delete AIDOCS/<X>_SETUP_ARCHIVE/ ONLY after /321 -Update and the manual follow-ups
   are complete. The archive is the safety net - keep it until the project feels right.
```

### Deferred reconciliation surface (reference)

The migration defers all distillation. Two homes split the work:

- **SESSION / MEMORY / BACKLOG distillation -> `/321 -Update`** (gated by `reconcile_pending`). This is the primary reconciliation: it distills the raw import to a steady state. The mechanics live in `SKILL_UPDATE.md` (the reconciliation gate) and `SKILL_MEMORY-UPDATE.md` (the record conventions). Setup does not run it - it only sets the gate.
- **DEV-AUDIT Project specifics + AGENTS classification -> manual follow-up.** These files are outside the skills' write lane, so they are not part of the gated pass. The guidance below is for the user (or an AI acting on the user's behalf) to apply after `/321 -Update`.

**The reconciliation principle** (the nudge for the manual DEV-AUDIT / AGENTS pass):

> "Our canonical scan is the source of truth. Restored content is supplemental detail. When they overlap, the scan wins - drop or trim the restored copy. When they contradict, surface for review. When they complement (restored adds project specifics the scan couldn't derive), keep both."

**Scope guard - only `## Project specifics` is reconciled in DEV-AUDIT.** The baseline above the divider (Anchor principles, Hard rules, Audit dimensions) is canonical 321_STD content `init` wrote, identical across every project. Do NOT dedup, rewrite, or contradiction-scan it, and never pull it into MEMORY. The DEV-AUDIT "Hard rules" block is an intentional audit-facing copy of the auto-memory inventory (also surfaced in AGENTS.md Hard rules) - that triplication is by design for visibility, not drift to reconcile.

For each sub-section Step 7 inserted into DEV-AUDIT Project specifics:

- Duplicates canonical wording or intent -> DROP.
- Extends canonical with project specifics (e.g., canonical says "naming follows project conventions", the addendum says "TypeScript files use PascalCase for components, camelCase for utilities") -> KEEP as project addendum.
- Purely project-specific (build commands, ESLint config, invariants, language version) -> KEEP.
- Restates something already in MEMORY (Architecture Decisions, Conventions) -> DROP (MEMORY is the home for project-anchored rules).
- Contradicts canonical -> SURFACE for review, do not auto-resolve.

For AGENTS.md: verify every preserved feedback file in auto-memory has a Hard Rules pointer (Step 7 layer 8 should have added it), alphabetize the block, and remove pointers for files no longer present. Apply the lean test to any restored Project Specifics block - if a cold-start session would not be confused without it in the first 60 seconds, move it down the chain (DEV-AUDIT Project specifics for code rules, MEMORY Conventions for project conventions).

## Rules (skill operation)

- **Post-init only.** Won't bootstrap a missing scaffold. Init is the prerequisite for fresh mode. Init is invoked by Setup itself in migration mode (migration Step 2).
- **Mode auto-detects.** Step 0 picks the path. No flag. False-positive migration (running on a fresh scaffold) is safe - archive is empty, reinstall is a no-op.
- **Migration handles two shapes.** 321-shaped projects archive the known path list and feed `migrate-import`. Standard (non-321) projects run the artifact discovery sweep: AI classifies scattered AI state by confidence, MOVES high-confidence stale state (session-handoff files, plain memory/session logs, most of auto-memory except its `MEMORY.md` index and `user_*.md`), and COPIES low-confidence-maybe-user files into the archive while leaving the originals in place. Move when sure, copy when unsure - nothing is deleted.
- **Big 6 is the bar.** Sync + doctor are mechanical, Big 6 fill is where Setup earns its space.
- **Migration captures, it does not distill.** Migration ends at capture + restore + scrub + doctor, sets the `reconcile_pending` gate (`state --set-reconcile`), and stops. The distillation pass is `/321 -Update`'s gated job, run with fresh context. Setup never runs reconciliation itself. The DEV-AUDIT / AGENTS dedup is a separate manual follow-up outside the Update lane.
- **Capture loses nothing.** When a source section's 321 home is unclear (Known Issues, watch-lists, memory-promotion flags, loose notes embedded in a SESSION or handoff file), it lands in SESSION LIFO, never dropped. Reconciliation re-homes or drops it later against the full import. Setup-only catch-all: routine passes read session data and promote upward, they never demote uncertain content back into SESSION (that would cycle).
- **Per-section confirmation is fresh-install only.** Fresh-install Big 6 drafts (fresh-install Step 2) get per-section confirmation - that path is the interactive first-run wizard. Migration does NOT confirm between steps - it chains through per the no-prompt contract (the Step 0 identity gate is the only prompt, the archive is the safety net). The skill invocations in migration Step 5 (SessionUpdate) and Step 6 (MemoryUpdate -FULL) run the canonical staging pipeline and auto-apply per their own rules.
- **Canonical skill pipeline is the writer.** SessionUpdate owns SESSION + SESSION_EXTENDED writes (migration Step 5). MemoryUpdate owns MEMORY + MEMORY_EXTENDED + BACKLOG writes (migration Step 6). Setup does not directly write into these files - it loads archive content into context and delegates.
- **Archive is the safety net.** `AIDOCS/<X>_SETUP_ARCHIVE/` stays in place after migration. User deletes when verified.
- **Idempotent.** Re-runs skip filled sections, refresh sync, re-offer skipped sections. A migration-completed project re-running Setup sees "refresh" not "migration" and walks the fresh path harmlessly.
- **CHANGELOG is AutoPush's domain.** Setup does not compose new release entries. Migration Step 7 normalizes archived blocks to canonical structure and voice (Keep a Changelog + Semantic Versioning + AutoPush wording rules) without inventing facts.
- **SESSION LIFO from migration is intentional.** SessionUpdate at migration Step 5 writes archive-derived events to SESSION LIFO as part of the migration. That is the canonical capture mechanism. After Setup completes, the user does not need to run a separate SessionUpdate to log "the migration happened" - migration Step 5 already captured the project history.
