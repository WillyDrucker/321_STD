# 321_STD Setup Runbook

**Purpose:** The full onboarding procedure - fresh Big 6 fill or migration of an existing project. This is the body that used to live in `SKILL_SETUP.md`. It is onboarding-tier: it ships with the fetched engine at `INSTALL/engine/AIDOCS/runbooks/SETUP.md`, is invoked read-and-execute (the thin `-Setup` skill reads this file and runs it), and is removed with `INSTALL/` when the reconcile pass graduates the project. Not copied into a steady install.

## Where this runs

- **Invoked read-and-execute.** The `-Setup` skill body is a thin pointer that reads this runbook and executes it. No router logic lives here. A user typing `/321 -Setup` during onboarding lands here.
- **Engine source.** Steady commands (`sync`, `doctor`, `validate`, `commit`, `state`) run from the project engine `node AIDOCS/tools/memory.mjs`. The migration path lays the full engine into the project (`init --with-onboarding`), so the onboarding commands (`migrate-*`, `import-skills`) also run from `node AIDOCS/tools/memory.mjs` during migration. The one exception is the migration reinstall itself, which runs from the fetched `INSTALL/engine`.
- **Graduation.** The reconcile pass (`/321 -Update`) removes `INSTALL/`, deregisters `-Setup`, and carves a migrated project's engine back to the steady tier. After that the project carries no onboarding machinery.

## The A / B / C lens

Every step is one of: **A** scripted (deterministic, the bulk), **B** AI-steered (judgment a script cannot do), **C** hybrid (AI emits a verdict, a script executes). Every B and C has an A backstop so a no-steer run still completes. Bucket tags appear on each step below.

## Two modes, auto-selected

- **Fresh-install mode.** `init` produced an empty scaffold. Setup walks Big 6 fill, release_profile, auto_memory.path, optional ENV starter, optional first commit. Per-section confirmation, idempotent re-runs.
- **Migration mode.** Setup detects an existing project (filled Big 6, populated LIFO, user docs in WDDOCS, etc.). Archives the project's content to `AIDOCS/<X>_SETUP_ARCHIVE/`, runs `init --with-onboarding` to land the canonical structure on top, fresh-scans the code for current Big 6 reality, then backfills the archive with legacy naming normalization (DEV-STANDARDS -> DEV-AUDIT, SKILLS -> SKILL, etc.).

**Invocation:** Once, immediately after install. Subsequent runs at any time refresh sync and pick up where left off. Re-running on a migrated project is safe - it sees the project as filled and just refreshes sync.

## You drive the wizard (B)

The script cannot decide the project's Stack, or `npm-package` vs `static-site`, or which archived bullets are still load-bearing. Setup is where AI judgment meets project context. Fresh-install Big 6 drafts use per-section confirmation (accept / edit / skip). Migration is a "run end-to-end, review the result" flow - the canonical skill pipeline (SessionUpdate, MemoryUpdate -FULL) auto-applies through its own staging rules.

**Fresh path (Steps 1-7):** sync + doctor -> Big 6 fill (the judgment step) -> release_profile -> auto_memory.path -> ENV starters -> first commit -> summary. Step 0 (detect) is shared.

**Migration path (Steps 1-11):** archive + artifact sweep -> reinstall (`init --with-onboarding`) -> sync + doctor -> load context -> SESSION capture -> MEMORY capture -> restore user content -> voice scrub -> doctor -> set the gate -> summary.

**Migration captures raw, then hands off.** Steps 1-9 are mechanical. Step 10 sets the `reconcile_pending` gate and STOPS - distillation is the judgment-heavy `/321 -Update`, run with fresh context. Past Step 0, Steps 1-11 chain with no prompts (only a validate/commit failure in Steps 5-6 stops for review). The archive is the safety net throughout, reversible until the user deletes it.

## Step 0: Detect state (A)

Read these signals in the target. **Any one flips Setup to migration mode** (false-positive migration is safe - it archives a fresh scaffold and reinstalls the same. False-negative is destructive). Otherwise fresh-install mode.

**321-shaped migration signals (any one triggers migration):**

- `AIDOCS/<X>_MEMORY.md` has any Big 6 section without a `(fill in` or `(no entries yet` placeholder, OR its LIFO has any bullet
- `AIDOCS/<X>_SESSION.md` has Current State content beyond the placeholder, OR its LIFO has any bullet
- `AIDOCS/<X>_BACKLOG.md` has any Features or Ideas entry beyond the placeholder
- `AIDOCS/<X>_DEV-AUDIT.md` or `AIDOCS/<X>_DEV-STANDARDS.md` has a non-empty Project specifics section
- `WDDOCS/` contains any `.md` file
- `AIDOCS/ENV/` contains any file beyond `.gitkeep`
- `CHANGELOG.md` contains any `## [X.Y.Z]` version block (not just the template placeholder)
- `AIDOCS/_index.json -> customizations` has at least one entry
- Legacy markers: `AIDOCS/SKILLS/` directory exists (plural), or `AIDOCS/<X>_DEV-STANDARDS.md` exists, or `_index.json` contains a `standards_version` field
- Existing archive dirs (`AIDOCS/<X>_MEMORY_ARCHIVE/`, `_SESSION_ARCHIVE/`, `_BACKLOG_ARCHIVE/`) contain any file
- Multiple `<NAME>_MEMORY.md` patterns coexist in `AIDOCS/` - the legacy files are migration source

**Standard-project AI-artifact signals (any one triggers migration too).** A project that never used 321 still accumulates AI working state in ad-hoc places:

- A substantive `CLAUDE.md` or `AGENTS.md` at root (the user actually wrote rules into it)
- A session-handoff-style file anywhere (`*HANDOFF*.md`, `SESSION_HANDOFF*`, `HANDOFF*`)
- Memory/session-named docs not in 321 layout: `MEMORY*.md`, `*_MEMORY.md`, `SESSION*.md`, `CONTEXT*.md`, `NOTES.md`, `PROJECT.md`, `TODO.md`
- An assistant-state folder with content: `.ai/`, `ai/`, `memory/`, `context/`, `.cursor/`, `.windsurf/`, `.aider*`, `.github/copilot-*`
- The auto-memory directory holds AI-written `feedback_*` / log files beyond the canonical scaffold
- AI-state markdown parked off the canonical layout (a `TEMP/` dump, a `.claude/` doc beyond config, memory / session / handoff `.md` files loose anywhere)

The **artifact discovery sweep** (Step 1) runs on **every** migration alongside the known-path list. When no 321 EXTENDED exists (a pure standard project), Steps 5/6 capture from the swept files plus the code scan instead.

**Branch decision (auto, no prompt):**

- **Migration triggered** -> resolve the project name (identity gate below), print the migration-mode banner, proceed to migration Step 1.
- **Fresh / refresh** -> print `Setup detected: fresh install.` (or `Setup detected: refresh (N of 6 Big 6 filled).`) and proceed to fresh Step 1.

**Identity-conflict gate (the ONE sanctioned migration prompt, B, fires here in Step 0 only).** Resolve the project name now, before anything is archived or `init` runs - `init` bakes `--name <X>` into `_index.json` and every scaffold filename. Resolution precedence: target basename wins by default.

Then check for a conflict: does the basename disagree with the project's strong identity signals (`package.json` `name`, the VCS branch prefix, the dominant `<NAME>_*.md` filename pattern)? If basename agrees (or they are absent), proceed silently. If basename DISAGREES with two or more strong signals, surface exactly one decision before Step 1:

> "The folder is named `<basename>` but the project's code identity is `<signal-name>` (package.json `<name>`, branch `<prefix>`, docs `<NAME>_*`). The docs scaffold will be named after whichever you pick, and it is upstream of everything Setup writes. Use `<basename>` (rename the docs to match the folder) or `<signal-name>` (keep the code identity)? Default if you do not answer: `<basename>`."

Record the resolved `<X>` and the chosen-vs-rejected names for the Step 11 summary.

**Migration-mode entry banner.** Print before doing any work (no confirmation prompt):

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

Then immediately proceed to Step 1. **Do not pause or prompt for confirmation.**

## Fresh-install path

### Step 1: Sync + health (A)

```bash
node AIDOCS/tools/memory.mjs sync
node AIDOCS/tools/memory.mjs doctor
```

Relay both summaries. Sync and the structural / engine doctor checks must pass - a failure stops Setup. Banned-prose lint on a pre-existing user-owned `README.md` is a warning, not a blocker.

### Step 2: Big 6 fill (B, backstop: auto-draft)

For each empty Big 6 section (Overview / Stack / Architecture / Environment / Pipeline / Conventions), in order:

1. **Read project signals.** `package.json`, top-level files, README, source layout. For empty projects the draft is allowed to be short ("New project, stack not yet chosen.").
2. **Draft body.** 2-4 lines of prose a cold-start session would use. Avoid placeholders.
3. **Optional Decisions sub-section.** If a non-obvious choice is in evidence, draft a `decisions_md` line.
4. **Prompt user.** Show the draft. Accept / edit / skip. On skip the placeholder stays. Backstop for an unattended run: auto-draft all six without the per-section prompt.

After all six, build one `memory-update` staging file with all accepted `gap_fill_section` actions (`mode: "full"`). Validate, optional preview, commit:

```bash
node AIDOCS/tools/memory.mjs validate --skill memory-update
node AIDOCS/tools/memory.mjs commit   --skill memory-update --preview
node AIDOCS/tools/memory.mjs commit   --skill memory-update
```

If all six were skipped, no commit fires.

### Step 3: release_profile (A, backstop: keep detected)

Read `_index.json -> release_profile`. If non-default, skip - `init` already auto-detected. Otherwise re-detect (same rules as `init`) and offer for confirmation:

- `package.json` with `bin` -> `npm-package`
- `package.json` with `engines.vscode` or `extension.json` -> `vscode-extension`
- `wrangler.toml` -> `cloudflare-worker`
- Pages-style config (`_redirects`, Pages CLI files) -> `cloudflare-pages`
- `astro.config.*`, `next.config.*`, `vite.config.*` -> `static-site`
- nothing -> `standards`

Write via direct Edit to `_index.json -> release_profile`.

**Non-standard release?** The profile gives the project the generic `/321 -AutoPush`, whose Step 7 runs that profile's publish / deploy. If this project diverges (a different target, extra gates, a manual marketplace upload instead of `vsce publish`), customize the body directly: edit `AIDOCS/SKILL/SKILL_AUTO-PUSH.md` and add a `customizations[]` entry in `_index.json` (`applies_to: ["AIDOCS/SKILL/SKILL_AUTO-PUSH.md"]`). That entry makes `init` preserve the body on a future engine update. Mention this only when the pipeline actually diverges.

### Step 4: auto_memory.path (A, backstop: keep resolved)

`init` already resolved and wrote the per-machine path. Read `_index.json -> auto_memory.path` and confirm it matches the current target. If different (project moved / cloned), prompt to confirm a re-resolution. This step never clobbers the auto-memory directory contents.

### Step 5: ENV starters (B, optional, backstop: skip)

Ask: "Does this project use environment variables?" If yes, prompt for key names + one-line purposes and write `AIDOCS/ENV/SETUP.md`:

```markdown
# <PROJECT> - Environment

**Purpose:** Environment variables and platform-specific setup notes. Read on demand.

## Required keys

| Key | Purpose | Where it's used |
|---|---|---|
| <KEY_NAME> | <one-line purpose> | (fill in) |
```

If no, skip.

### Step 6: First commit (A, optional, backstop: skip)

`init` already runs `git init` if the target was not a repo. Check `git status`:

- **Repo with the scaffold uncommitted.** Ask "Create the first commit?" If yes, stage scaffolded files explicitly (AGENTS.md, CLAUDE.md, AIDOCS/ contents, .gitignore, CHANGELOG.md), never `git add -A`. Message: `Initial 321_STD scaffold.`
- **Scaffold already committed.** Skip.
- **Not a repo.** Surface the reason and skip.

Don't push or create a remote.

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
- Non-standard release pipeline? Edit the body in AIDOCS/SKILL/ and add a customizations[] entry.
```

## Migration path

Two shapes hit this path: a **321-shaped project** (a prior 321 install, with the known `<X>_MEMORY.md` / `_SESSION.md` structure) and a **standard project** that accumulated AI state in ad-hoc places. Goal is the same: land the current canonical structure with our skills as source, then layer the project's knowledge back in. The difference is only in capture - 321-shaped feeds the lossless `migrate-import`, standard feeds the artifact discovery sweep (Step 1) and capture from discovered files plus the code scan (Steps 5/6 Part B).

### Step 1: Archive existing content (A known paths + C discovery sweep)

`migrate-archive` does the deterministic find + move - it keeps the path lists and sweep patterns out of this prose. It moves (never deletes) project-owned content into `AIDOCS/<X>_SETUP_ARCHIVE/` in two tiers. **Known 321-shape paths** move automatically. **Clearly-stale swept AI-state** (handoff / rename / `_dump/` docs anywhere) moves automatically too. **Borderline swept docs** are reported for you to adjudicate. Engine dirs, source, config, build artifacts, and `README.md` are never touched. Nothing is deleted.

**Scan first, adjudicate, then execute (the C verdict loop):**

```bash
node AIDOCS/tools/memory.mjs migrate-archive <target> --name <X> --scan
```

Read the borderline list. Judge each by **content, not filename** (open it if unsure): clear AI working state -> `--move`, possibly-live user content -> `--copy` (the original stays), nothing worth keeping -> leave it (the default). Then execute (omit both flags to leave every borderline):

```bash
node AIDOCS/tools/memory.mjs migrate-archive <target> --name <X> --move <csv> --copy <csv>
```

**The verdict contract (the shared C-hybrid handoff).** For a richer classification than the `--move` / `--copy` CSVs, write a verdict file to `INSTALL/work/verdict.json` - a JSON array of `{ path, type, action, confidence? }` (`type` in handoff/design/memory/notes/scratch/skill/env/other, `action` in move/copy/leave/import) - and let the engine validate and execute it:

```bash
node AIDOCS/tools/memory.mjs verdict                                  # validate + plan
node AIDOCS/tools/memory.mjs verdict --apply --name <X>               # execute move/copy
```

Unknown `type` / `action` values are rejected, so a typo never silently mis-routes. This is the **same shape** used by the auto-memory near-match map (Step 7.4) and the skill-collision list (Step 3) - one contract for every "AI decides, script moves" handoff. `move`/`copy` land under the archive (the recovery net), `leave` is a no-op, `import` is reported for you to route via `import-skills` / `migrate-import`.

**Read legacy SKILLS content before executing.** If the scan lists `AIDOCS/SKILLS/` (plural), `.claude/skills/321/SKILLS.md`, or any project-customized `SKILL_*.md` bodies, read each in full first - they hold project-specific procedural customizations with no other home. The command archives them verbatim. **Capture only here, do NOT distill them into prose.** Their fate is decided by the reconcile skills-lane in `/321 -Update`. Count them for the loud Step 11 flag.

Archive preserves old filenames verbatim - legacy normalization happens at capture (Step 4 / `migrate-import --old/--new`), not here.

### Step 2: Reinstall canonical 321_STD (A)

Re-invoke `init` against the target from the fetched onboarding engine, with `--with-onboarding` so the migrate-* / import-skills commands and the steady commit share one engine and staging dir:

```bash
node INSTALL/engine/AIDOCS/tools/memory.mjs init <target> --name <X> --with-onboarding
```

`<X>` is the project name resolved in Step 0. Why this works without `--force`: Step 1 moved all scaffold-class files into the archive, so `init`'s "write if missing" writes fresh. Engine paths get rewritten. Auto-memory merge-copies (preserves personal rules).

**Engine freshness gate (prevents skill / engine skew).** `init` lays the engine, so a stale `INSTALL/engine` can leave the project missing commands this migration depends on. Catch it here, immediately after init:

```bash
node AIDOCS/tools/memory.mjs help
```

Confirm the Commands list includes `import-skills`, `migrate-import`, and `migrate-restore`. If any is missing, `INSTALL/engine` was stale - STOP. Re-fetch it (`node AIDOCS/tools/memory.mjs fetch-engine` or re-run install), then re-verify. The runbook and the engine must be the same version before Step 3.

### Step 3: Import easy skills, then sync + health (A net-new + C collisions)

The migration archived the project's legacy skill tree in Step 1. Bring its own skills forward mechanically before sync. `import-skills` copies each legacy body into `AIDOCS/SKILL/` under the canonical `SKILL_<FUNC>.md` name. It NEVER overwrites a canonical body - net-new skills land, collisions are reported for `/321 -Update` to merge.

```bash
node AIDOCS/tools/memory.mjs import-skills --from AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/SKILLS
node AIDOCS/tools/memory.mjs sync
node AIDOCS/tools/memory.mjs doctor
```

Net-new skills register on this sync and `import-skills` records each one's `customizations[]` provenance (verbatim copy, no rewrite). Collisions and malformed-frontmatter bodies are reported, not applied. A project with no legacy skills gets a clean no-op. The collision list is a consumer of the verdict contract (Step 1): each collision is a `{ type: skill, action: import | leave }` entry the reconcile skills-lane resolves.

Categorize doctor output (same split as Step 9). Structural / engine checks must pass. Banned-prose lint in a user-owned file (notably `README.md`) is a WARNING. Sync must succeed.

### Step 4: Load archive into AI context (B)

Read the archived files into context. **No edits yet.** The goal is to give the next skill invocations the archive as available context, framed as accumulated project history.

**FULL READ required, not `wc -l`.** Known failure mode: the AI checks file size, judges it "long," skips reading. Use the `Read` tool on each file, paginating large files.

Files to read (verify each by quoting a section header back to yourself):

- `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<X>_MEMORY.md` and `_MEMORY_EXTENDED.md`
- `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<X>_SESSION.md` and `_SESSION_EXTENDED.md`
- `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<X>_BACKLOG.md`
- `AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<X>_DEV-AUDIT.md` or `<X>_DEV-STANDARDS.md`
- `AIDOCS/<X>_SETUP_ARCHIVE/AGENTS.md` and `CLAUDE.md` (if substantive)
- **Swept artifacts (every migration):** every file the discovery sweep moved or copied. For a standard project these ARE the project history. Read any session-handoff file first - it is usually the densest single source of Current State.

While reading, normalize legacy tokens (`DEV-STANDARDS` -> `DEV-AUDIT`, `AIDOCS/SKILLS/` -> `AIDOCS/SKILL/`, `SKILLS_<NAME>` -> `SKILL_<NAME>`) and apply the project rename. **Preserve real identifiers verbatim even when they contain the old name** (branches, env vars, bundle / marketplace IDs, repo URLs, code symbols, paths). Only rewrite a bare prose project-name mention.

State a one-line framing for the next skill invocations:

> "Setup migration in progress. The content above is accumulated project history. The canonical pipeline (`/321 -SessionUpdate`, `/321 -MemoryUpdate -FULL`) will capture it into the current structure on the next two steps."

### Step 5: SESSION capture (A lossless import + B SessionUpdate)

Two parts share one commit. The engine does lossless depth capture (EXTENDED). The skill distills history (Current State + SESSION LIFO).

**Standard-project case (no 321-structured EXTENDED).** Skip Part A and let Part B capture from the discovered artifacts plus the code scan. A session-handoff file is the highest-value source.

**Part A - lossless EXTENDED import:**

```bash
node AIDOCS/tools/memory.mjs migrate-import \
  --from AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<OLD>_SESSION_EXTENDED.md \
  --skill session-update --old <OLD> --new <X>
```

**Part A2 - append the swept session-lane scavenge docs (lossless, never dropped).** Import each session-shaped swept doc onto the SAME staging with `--append` - do NOT fold through judgment or drop one as "git history covers it" (a reconcile decision, not a capture one):

```bash
node AIDOCS/tools/memory.mjs migrate-import \
  --from AIDOCS/<X>_SETUP_ARCHIVE/<swept-doc> --skill session-update --append --old <OLD> --new <X>
```

**Part B - SessionUpdate appends to the same staging:**

- `overwrite_section current_state` - drafted from archived Current State + current code reality
- `lifo_insert` for project-significant events distilled from the archived SESSION LIFO + event-shaped MEMORY LIFO bullets

Do NOT re-derive SESSION_EXTENDED sub-sections - Part A captured them.

**Capture-completeness (Setup only).** Content embedded INSIDE a file (Known Issues, Next Steps, loose notes) with no clear home lands in SESSION LIFO rather than being dropped, even where SessionUpdate's routine rules would drop it. Setup captures, reconcile re-homes or drops.

**One commit for both parts, auto-prune suppressed:**

```bash
node AIDOCS/tools/memory.mjs validate --skill session-update
node AIDOCS/tools/memory.mjs commit   --skill session-update --no-prune
```

### Step 6: MEMORY capture (A lossless import + B MemoryUpdate -FULL)

Same shape as Step 5. One commit.

**Standard-project case.** Skip Part A when there is no archived `<OLD>_MEMORY_EXTENDED.md`. MemoryUpdate -FULL fills the Big 6 from the code scan plus the discovered artifacts (hand-rolled `CLAUDE.md` / `AGENTS.md` rules are prime Big 6 source).

**Part A - lossless EXTENDED import:**

```bash
node AIDOCS/tools/memory.mjs migrate-import \
  --from AIDOCS/<X>_SETUP_ARCHIVE/AIDOCS/<OLD>_MEMORY_EXTENDED.md \
  --skill memory-update --old <OLD> --new <X>
```

**Part A2 - append the swept memory-lane scavenge docs.** Same as Step 5 Part A2 for memory-shaped docs.

**Part B - MemoryUpdate -FULL appends to the same staging.** Skip its Step 1 (the SessionUpdate auto-invoke) - Step 5 already captured SESSION this run:

- `gap_fill_section` for each Big 6 section
- Decisions sub-sections from archived MEMORY where still applicable
- `lifo_insert` for durable observations not already imported
- `backlog_actions` swept against codebase + SESSION

**One commit for both parts, auto-prune suppressed:**

```bash
node AIDOCS/tools/memory.mjs validate --skill memory-update
node AIDOCS/tools/memory.mjs commit   --skill memory-update --no-prune
```

The import lands MEMORY oversized by design. `--no-prune` means nothing is reaped during migration - the reconciliation pass curates under cap.

### Step 7: Restore verbatim user content (A deterministic + B judgment layers)

`migrate-restore` moves the **deterministic** layers back out of the archive: `WDDOCS/` verbatim, the `_MEMORY/SESSION/BACKLOG_ARCHIVE/` history dirs, and `AIDOCS/ENV/` (renaming `<OLD>_ENV_*` on a rename). Pass `--old <OLD>` only when renamed.

```bash
node AIDOCS/tools/memory.mjs migrate-restore <target> --name <X> [--old <OLD>]
```

The judgment layers stay manual:

1. **`.gitignore`.** Restore archived verbatim, then append a `# 321_STD additions` block with entries the new install needs (TEMP/, INSTALL/, staging files, state.json). Conservative on dedup.
2. **DEV-AUDIT Project specifics.** Extract `## Project specifics` from archived `<X>_DEV-AUDIT.md` (or DEV-STANDARDS legacy) and insert verbatim. **Do not dedup here** - `/321 -Update`'s DEV-AUDIT lane handles it.
3. **`CHANGELOG.md`.** Reformat archived entries to canonical structure and voice per `SKILL_AUTO-PUSH.md`. Content fidelity (invent no facts) plus voice scrub (semicolon -> period/comma, em dash -> space-dash-space).
4. **Auto-memory dir.** Refresh the shared canonical feedback rules to current, plus AI-judged near-matches. Back up to `_SETUP_ARCHIVE/automemory_pre_migrate/`, fetch from the canonical source, overwrite (byte-identical -> skip). **Preserve, never overwrite:** the `MEMORY.md` index, `user_*.md` profiles, `reference_*.md`, and project-specific `feedback_*.md`. The near-match map (which archived `feedback_*` aligns to which canonical rule) is a consumer of the verdict contract (Step 1) - a `{ type: memory, action: copy | leave }` entry per file.
5. **AGENTS.md Hard Rules extension.** For each project-specific `feedback_*.md` preserved above, append a pointer to AGENTS.md Hard Rules just before the `[User profile]` bullet, alphabetized.

### Step 8: Voice scrub on migration-written files (A)

Scrub banned characters (em dashes `—`, semicolons `;`) in place across the migration-written files (`<X>_MEMORY(_EXTENDED)`, `<X>_SESSION(_EXTENDED)`, `<X>_BACKLOG`, `CHANGELOG`, and `AGENTS.md` if extended), skipping fenced code and inline-code spans:

- Em dash -> ` - ` (space-dash-space), trim double spaces.
- Semicolon -> `.` (or `,` for a list continuation), capitalize the next word if it starts a sentence.

Leave code spans, filenames, and URL query strings alone.

### Step 9: Post-restore doctor (A)

```bash
node AIDOCS/tools/memory.mjs doctor
```

- **Structural / engine checks** must pass - a failure blocks completion.
- **Banned prose in MEMORY / SESSION / BACKLOG / CHANGELOG / AGENTS.md** must be zero. A survivor means Step 8 missed a case - rescrub.
- **Size / length warnings on MEMORY(_EXTENDED)** are expected (raw import over-cap) - do NOT hand-prune.
- **Banned prose in WDDOCS / restored ENV / README** is pre-existing user content - surface as a warning, do not fail Setup.

### Step 10: Mark reconciliation pending, then stop (A)

Capture landed the EXTENDED depth as a lossless raw import (over-split, over-cap, raw `[+]` headlines, the source project's migration trail intact). **None of it has been distilled.** Distillation deserves a clean, judgment-heavy pass with fresh context, so Setup sets a gate and stops:

```bash
node AIDOCS/tools/memory.mjs state --set-reconcile
```

This sets `reconcile_pending: true`. The next `/321 -Update` reads the gate, runs reconciliation (distillation + graduation), and clears it. Until then the migration is usable but un-distilled - the lossless import and `AIDOCS/<X>_SETUP_ARCHIVE/` are the recovery net.

**Stop after this step.** Print the Step 11 summary and end the run. The user runs `/321 -Update` next.

### Step 11: Summary

```
=== Migration captured (reconciliation pending) ===

Mode:              migration (<321-shaped | standard-project>)
Archive:           AIDOCS/<X>_SETUP_ARCHIVE/ (<N> paths, <M> files)
Artifact sweep:    <N> moved (high-confidence AI state), <M> copied (low-confidence, left in place)
Legacy normalized: <N> references (DEV-STANDARDS, SKILLS, project rename)
Sync:              <N> skills registered
Custom skills:     <I> net-new imported + registered (<list>), <C> collision(s) deferred to
                   /321 -Update (canonical base + delta).
                   DELTA: <e.g. AutoPush still runs the vscode-extension default until
                   -Update folds in the archived manual-upload steps>
Doctor:            <pass> | <N user-content lint warnings>, <K> import size warnings (expected)
SessionUpdate:     SESSION + SESSION_EXTENDED written, <N> LIFO entries
MemoryUpdate:      MEMORY Big 6 filled, <N> LIFO entries, BACKLOG <K> items (raw import)
DEV-AUDIT:         Project specifics restored (dedup deferred to /321 -Update)
WDDOCS:            <N> files restored
ENV:               <N> files restored (renamed <M> filenames if project was renamed)
CHANGELOG:         normalized to canonical voice, <N> version blocks
Auto-memory:       <N> canonical replaced, <M> user-profile preserved, <K> project-specific preserved
AGENTS Hard Rules: extended with <N> project-specific feedback pointers
Voice scrub:       <N> em dashes + <M> semicolons removed across migration-written files

Reconciliation:    PENDING - gate set (reconcile_pending: true)

>>> NEXT STEP: run /321 -Update <<<

The migration captured everything losslessly but did NOT distill it. /321 -Update reads
the gate and runs the distillation pass (merge over-split, drop duplicates / dead code,
rewrite to descriptive [+] bullets, strip the trail, sweep BACKLOG), then graduates the
project (removes INSTALL/, deregisters -Setup, carves the engine to steady), then clears
the gate. It also runs the skills-lane (net-new normalized + recorded, collisions merge as
canonical base + delta, engine-superseded ones fold, then a late scan offers any skills
found outside AIDOCS/SKILL/), the AGENTS / CLAUDE classification lane, and the DEV-AUDIT
dedup. Until then the generic profile applies. Migration is NOT complete until it runs.

One step stays yours afterward:

Delete AIDOCS/<X>_SETUP_ARCHIVE/ ONLY once /321 -Update has run and the result feels
right. The archive is the safety net - keep it until the project does.
```

### Deferred reconciliation surface (reference)

The migration defers all distillation to the gated `/321 -Update` pass. Nothing is a manual follow-up:

- **SESSION / MEMORY / BACKLOG distillation** - mechanics in `SKILL_UPDATE.md` and `SKILL_MEMORY-UPDATE.md`.
- **Project `/321` skill bodies** (skills-lane) - Setup imported net-new bodies. `/321 -Update` normalizes dispatch names, records every project skill in `customizations[]`, merges collisions as canonical base + delta (recording the base hash), folds engine-superseded ones into `<X>_DEV-AUDIT.md` / `<X>_MEMORY.md`, and late-scans for skills outside `AIDOCS/SKILL/`.
- **AGENTS / CLAUDE classification + DEV-AUDIT Project-specifics dedup** - archived orchestrator content folds into a lean `AGENTS.md` / MEMORY / DEV-AUDIT.
- **Graduation** - the reconcile pass removes `INSTALL/`, deregisters `-Setup`, and carves a migrated project's engine to the steady tier.

## Rules (runbook operation)

- **Post-init only.** Won't bootstrap a missing scaffold (the migration path invokes `init` itself in Step 2).
- **Mode auto-detects.** Step 0 picks fresh vs migration, no flag.
- **Big 6 is the bar.** Sync + doctor are mechanical, Big 6 fill is where Setup earns its space.
- **Migration captures, never distills.** It ends at capture + restore + scrub + doctor, sets the gate, and stops. Capture loses nothing - uncertain content lands in SESSION LIFO.
- **No mid-flow prompts in migration.** The Step 0 identity gate is the only one. Per-section confirmation is fresh-install only.
- **Skills are the writer.** SessionUpdate owns SESSION (Step 5), MemoryUpdate owns MEMORY + BACKLOG (Step 6). The runbook loads context and delegates.
- **Archive is the safety net**, kept until the user deletes it. Idempotent: a completed project re-running Setup sees "refresh", not "migration".
