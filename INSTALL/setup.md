# Setup runbook (/321 -Setup)

**Purpose:** The read-and-execute runbook for onboarding a project. The install process runs it to finish onboarding (the assistant executes it directly once the engine is laid), and the `-Setup` skill re-runs it for a manual re-onboard. The depth lives here, not in the skill body. This file is ephemeral - it sits under `INSTALL/`, which `graduate` removes once the project is steady.

## Operating rule (run it through, do not stop to ask)

This is part of the install, not a menu. Execute it end to end on your own. Do not stop to ask the user how to proceed, which mode to run, or how to finish, and never offer a destructive "fresh overwrite" of an existing project - that is the data-loss path this runbook exists to avoid (`init --force` is refused on an existing project for the same reason).

The reason it is safe to run unattended: migration is **non-destructive**. Every archiving step moves content into `AIDOCS/<PROJECT>_SETUP_ARCHIVE` (move, never delete), so the archive is the recovery net and a missing git repo is **not** a blocker - nothing is lost even with no version control to fall back on. Mode auto-detects (see below), so you do not ask which one to run.

The only sanctioned stop is the end: the **reconcile gate** for a migration (hand off to `/321 -Update`), or the optional first-commit offer for a fresh fill. Run straight through to there.

**The carveout: unresolvable input blockers.** "Do not stop to ask" covers process choices (which mode, what to copy where, when to commit). It does NOT cover an input the engine refused (a `--name` that failed validation, a missing required file, a `--privacy` mode the engine does not accept). Surface those - they are the user's call, not yours, because they permanently shape the install (the name prefixes every doc file and the archive folder, the privacy mode gates what the repo tracks). Inventing a value for a hard validation failure is worse than asking once.

**Privacy: infer first, ask only if you genuinely cannot.** When `init` runs without `--privacy` and there is no recall from the registry / archive, the default is `private`. Before asking the user, check signals: a public git remote OR `AIDOCS/` already in the project's `.gitignore` suggests `public` is what they want, an existing pattern of committed AIDOCS suggests `private`. Pick from those when they read clearly. Only ask when the signals are absent or contradict each other.

## Roles (script first, AI for judgment)

Every step is one of three kinds, and each AI step has a script backstop so a no-AI run still completes:

- **A (script)** - deterministic, the bulk. Runs with no AI.
- **B (AI)** - judgment a script cannot do (final shape, relevance, prose quality).
- **C (hybrid)** - a script drafts or proposes, the AI reviews and supplements, a script executes.

| Phase | Script (the default) | AI (where it raises quality) |
|---|---|---|
| Archive known shape (A) | moves the known 321-shape + legacy archives into SETUP_ARCHIVE | - |
| Discovery sweep (C) | `verdict --suggest` drafts the candidate verdict from a heuristic scan | reviews the draft, adds what the scan missed, corrects a misclassification |
| Apply verdict (A) | `verdict --apply` moves / copies per the verdict | - |
| Reinstall + restore (A) | `init` relays the structure, `migrate-restore` layers content back | - |
| Capture (C) | `migrate-import` scavenges the EXTENDED depth 1:1, drafts the deterministic Big-6 sections | fills the rest of the Big 6, verifies what landed, adds what the import missed |
| Scrub + doctor (A) | the house-voice and structure gates | - |

The backstop rule: with no AI, the script default stands - the candidate verdict applies as-is, the Big 6 keep their script-drafted and placeholder sections, and the capture parks at the gate losslessly. The quality passes wait for AI.

## Detect mode

Read the target and pick fresh vs migration with no flag. **Fresh** when the Big 6 are still on their `(fill in ...)` placeholders and nothing else carries project content. **Migration** when any one signal below is present. A false-positive migration is safe (it archives a fresh scaffold and reinstalls the same), a false-negative would overwrite content, so any one signal flips to migration - bias safe.

`init` already printed the coarse, content-free recognition (existing-321 / generic-existing / fresh) as the headline. This is the content-level confirmation that drives the path.

**Existing 321 project (the strongest signal):**
- A data doc past its placeholder - `<PROJECT>_MEMORY` / `_SESSION` / `_BACKLOG` with a filled section or any LIFO bullet
- `AIDOCS/_index.json` carrying a populated `skills.dispatch`, or any `customizations[]` entry
- An existing `AIDOCS/*_SETUP_ARCHIVE/` or `*_ARCHIVE.md` holding content

**Accumulated AI state (a project that never used 321):**
- A substantive hand-written `CLAUDE.md` or `AGENTS.md`
- A session-handoff file anywhere (`*HANDOFF*`), or memory / session / context / notes docs off the canonical layout
- An assistant-state folder with content (`.ai/`, `.cursor/`, `.windsurf/`, `.aider*`, and the like)
- User docs in `WDDOCS/`, files in `AIDOCS/ENV/` beyond `.gitkeep`, or a `CHANGELOG.md` with a real `## [version]` block

## File classes (what gets shuffled vs replaced)

Migration shuffles the files that can hold project content and leaves the rest alone, sorted by whether a file carries data:

- **Engine (always replaced).** Scripts (`AIDOCS/tools`), skill bodies (`AIDOCS/SKILL`), the router (`.claude/skills/321`), and these runbooks (`INSTALL/`). They hold no project data, so `init` always overwrites them - they refresh to current. One recovery carve-out: `migrate-archive` snapshots `AIDOCS/SKILL` into the archive (copy, not move) because a legacy project may have customized a skill body in place (the pre-data-doc model), and the reconcile pass folds any such divergence into the right data doc (e.g. AUTO-PUSH steps into `<PROJECT>_AUTO-PUSH.md`). `AIDOCS/tools`, the router, and `INSTALL/` carry no project data and are never archived.
- **Data (archived, relaid, recaptured) - the shuffle.** `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `AIDOCS/_index.json`, and the data docs `AIDOCS/<PROJECT>_*.md` (MEMORY / SESSION / BACKLOG / DEV-AUDIT / AUTO-PUSH and their extendeds). `init` preserves these on install (write-if-missing), `migrate-archive` moves them aside by name, and the reinstall lays them fresh. Content returns two ways: `migrate-restore` copies the verbatim parts (the DEV-AUDIT and AUTO-PUSH project sections, the BACKLOG Features and Ideas lists, CHANGELOG), and the capture step re-derives the knowledge docs (MEMORY / SESSION). The reconcile pass then dedups and reformats both and folds the archived AGENTS / CLAUDE into the lean canonical ones. Pruned overflow (`*_ARCHIVE.md`) is swept the same way, so prior history is preserved too.
- **Auto-memory (Claude's native memory is the home, `AIDOCS/automemory` is the seed) - the hybrid.** The runtime source of truth is Claude Code's native external memory (`auto_memory.path`), which the harness loads each session. `AIDOCS/automemory` (`auto_memory.seed`) is the shippable canonical seed that rides in the repo. `init` records the external path and seeds the canonical rules into it (write-if-missing, so a project's live rules survive). **After install, `upgrade` owns the shared rules**: it force-copies them into the seed and mirrors them into the runtime, so an upstream rule fix reaches every project. Two files stay project-owned and are never overwritten - `MEMORY.md` (the rule index) and `user_*.md` (the profile) - and a rule the project authored itself survives by having no upstream counterpart. `migrate-archive` snapshots the prior external memory into the archive (`external-automemory`), and the reconcile pass merges it back into the external memory - the profile, plus any unique guidance summarized into a canonical rule, default drop. The AI sweep routes scattered memory-like files (a rules-laden `CLAUDE.md`, `.ai/` notes) into the same archive for that merge.
- **User-owned (archived, restored).** `WDDOCS` is restored verbatim and `.gitignore` is union-merged so custom ignores survive. `AIDOCS/ENV` is left in place the whole time (it may hold secrets) and is never archived.

The authoritative lists live in the engine, which needs them to run at any time: `init` derives the data docs from `_index.json`, and `migrate-archive` carries the known-shape list plus the `AIDOCS/*_*.md` sweep. The two sets match by design, so every file install preserves is one migration relays fresh - nothing is left stale. This section documents the split for the migration and is discarded with `INSTALL/` at graduation, while the engine keeps the mechanical truth.

## Fresh path

1. **Register + health (A).**
   ```bash
   node AIDOCS/tools/engine.mjs sync
   node AIDOCS/tools/engine.mjs doctor
   ```
2. **Fill the Big 6 (C - script drafts Stack / Pipeline, AI fills the rest).** Run `/321 -UpdateMemory` (read `AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md` and execute). Its gap-fill starts from `bigsix --suggest` (a deterministic draft of the two script-readable sections) and the AI refines that plus fills the four judgment sections from code, conversation, and SESSION through the staging pipeline. That is the judgment step where Setup earns its space.
3. **Optional first commit (A, optional).** Offer to commit the scaffold (stage explicitly, never `git add -A` on an unreviewed tree).

## Migration path

The target holds content worth preserving. Land the canonical structure, then layer the project's knowledge back in. Two archiving lanes feed one `SETUP_ARCHIVE` - a deterministic backstop for the known shape, and an AI sweep for everything else. Each mechanical step below (archive, sweep apply, reinstall, restore) appends what it did and where content went to `INSTALL/INSTALL.log`, so you can read that trail to confirm the migration's mechanical history before judging content.

1. **Archive the known shape (A - deterministic backstop).**
   ```bash
   node AIDOCS/tools/engine.mjs migrate-archive --name <PROJECT>
   ```
   Known 321-shape paths - the data docs, `_index.json`, the root docs, the project's `AIDOCS/automemory`, and any legacy `*_ARCHIVE` dirs (the old engine's auto-prune history) - move into `AIDOCS/<PROJECT>_SETUP_ARCHIVE/` (move, never delete - the recovery net). This always runs, so the canonical files and the project's own rules are safe no matter what the sweep finds.
2. **Discovery sweep (C - script drafts, AI has final say).** The script drafts the candidate verdict from a heuristic scan, then you review and supplement it:
   ```bash
   node AIDOCS/tools/engine.mjs verdict --suggest
   ```
   This writes a candidate `TEMP/setup-verdict.json` - secrets / ENV / source left unlisted, clear AI-state moved, gray-zone knowledge docs copied (lossless). Review it: confirm each entry, add anything the scan missed (open a file if unsure), and correct any misclassification. The vocab is fixed - type is one of handoff / design / memory / notes / scratch / env / other, action is one of move / copy / leave. See **Discovery sweep** below for the scan breadth and confidence bands that grade each call. With no AI in the loop, the candidate stands as-is - a lossless capture.
3. **Apply the verdict (A).**
   ```bash
   node AIDOCS/tools/engine.mjs verdict --validate TEMP/setup-verdict.json
   node AIDOCS/tools/engine.mjs verdict --apply TEMP/setup-verdict.json --name <PROJECT>
   ```
   Validate first (read-only, rejects unknown vocab before any file moves), then apply - the AI-judged paths move or copy into the same `SETUP_ARCHIVE`, or stay in place.
4. **Reinstall the canonical structure (A).** Lay fresh scaffolds over the now-empty shape, keeping the engine in place and re-laying the canonical auto-memory. `init` refuses to scaffold over its own source, so the reinstall runs from a fetched engine, not the project's own copy. **Note: `init` runs twice in a migration on purpose - once at install time to lay the engine + the project skeleton, once again here after archiving to relay the data scaffolds against the new structure. That double-init is the design, not a mistake, do not pause between them.**
   ```bash
   node AIDOCS/tools/engine.mjs fetch-engine   # defaults --repo from engine.upstream, or pass --from <local 321 checkout>
   node INSTALL/engine/AIDOCS/tools/engine.mjs init . --name <PROJECT>
   ```
   The fetched engine's `init` is write-if-missing for the data files, so it relays the archived-away docs as fresh scaffolds, lays the canonical auto-memory back, and leaves the engine in place. On a local install (the script ran from your own clone of the source repo), point `fetch-engine --from <that clone>` at it to skip the network round-trip - the result is identical. A remote one-liner install leaves no clone behind (`install.ps1` removes its temp clone on every path), so there `fetch-engine` defaults `--repo` from the recorded upstream and clones fresh.

   **Engine-skew guard (the runbook and the engine must match).** The reinstall ran `init` from the fetched engine, overwriting the project's `AIDOCS/tools`, so a stale fetched source can leave the project missing commands the rest of this migration calls. Verify before capture:
   ```bash
   node AIDOCS/tools/engine.mjs help
   ```
   Confirm the Commands list carries `migrate-archive`, `migrate-restore`, `migrate-import`, `verdict`, `state`, `scrub`, and `graduate`. If any is missing, the fetched engine was stale - STOP, re-fetch a current engine (`fetch-engine` defaults from the registry, or re-run install), re-run the `init` above, then re-verify before continuing.

   **Legacy custom skill names (B - AI judgement, optional).** Project-custom bodies (any `SKILL_*.md` not in the canonical inventory of 8: `SKILL_UPDATE.md`, `SKILL_UPDATE-SESSION.md`, `SKILL_UPDATE-MEMORY.md`, `SKILL_UPDATE-SYNC.md`, `SKILL_SETUP.md`, `SKILL_DEV-AUDIT.md`, `SKILL_AUTO-PUSH.md`, `SKILL_COMPACT.md`) survived the reinstall in `AIDOCS/SKILL/`. The naming convention is action-first (`SKILL_UPDATE-SCRAPER.md`, flag `-UpdateScraper`). If a custom body uses the older target-first shape - filename ending in `-UPDATE.md` / `-BACKUP.md` / `-RESTORE.md` with the verb second, or a frontmatter `flag:` styled `-<Target>Update` - surface the candidate rename before capture (`SKILL_SCRAPER-UPDATE.md` -> `SKILL_UPDATE-SCRAPER.md`, flag `-ScraperUpdate` -> `-UpdateScraper`, key `scraperupdate` -> `updatescraper`). The user approves or modifies. On approval, rename the body (filesystem rename plus the frontmatter `name:` field) and run `node AIDOCS/tools/engine.mjs sync` so dispatch picks up the new key. With no legacy customs present (the common case), this finishes silently.
5. **Restore the project's own content (A - deterministic).**
   ```bash
   node AIDOCS/tools/engine.mjs migrate-restore --name <PROJECT>
   ```
   Layers the archived content back over the fresh scaffold - user docs (`WDDOCS`) verbatim, a union-merge of the archived `.gitignore` so the project's custom ignores survive (nothing dropped), the config-doc project sections (DEV-AUDIT `## Project specifics`, AUTO-PUSH `## Project release steps`) copied verbatim with legacy and rename normalization, and `CHANGELOG.md` verbatim. It reports what landed and what had no archived source. The dedup of the specifics, the finalize of the release steps, and the CHANGELOG voice-scrub are the reconcile pass's job, not this step. ENV was left in place, not archived.
6. **Set the reconcile gate (A - capture stays additive).**
   ```bash
   node AIDOCS/tools/engine.mjs state --set-reconcile
   ```
   The gate marks the migration in progress, so `commit` holds auto-prune the whole time it is set - the capture stays additive and nothing is reaped, however oversized it lands. Set it before any capture commit. The capture below invokes the writer skills directly, not `/321 -Update` (with the gate set, `/321 -Update` runs the reconciliation pass instead of capturing).
7. **Load the archive into context (B).** Read the archived files in full - the data docs (`<PROJECT>_MEMORY` / `_SESSION` / `_BACKLOG` and their EXTENDEDs), the swept docs, a hand-rolled `CLAUDE.md` / `AGENTS.md`. A full read, never a size check (the known failure is "it looks long, skip it"). A session-handoff file is usually the densest single source. Frame the next steps to yourself: this is accumulated history, the pipeline now captures it into the current structure.
8. **SESSION capture (C - script 1:1, then AI verify).** Two parts.
   - **Part A - the 1:1 scavenge.** `migrate-import` grabs the archived SESSION_EXTENDED into staging verbatim (one `[+]` bullet plus `### sub-section` per entry, the orphan check satisfied by construction), then validate and commit:
     ```bash
     node AIDOCS/tools/engine.mjs migrate-import --from AIDOCS/<PROJECT>_SETUP_ARCHIVE/AIDOCS/<OLD>_SESSION_EXTENDED.md --skill updatesession --old <OLD> --new <PROJECT>
     node AIDOCS/tools/engine.mjs validate --skill updatesession
     node AIDOCS/tools/engine.mjs commit   --skill updatesession
     ```
     Append each session-shaped swept doc onto the same scavenge with `--append` before validating. Read the **landing report** `migrate-import` prints - it flags what to check (a structureless blob, a heading with no slug-able text, thin bodies, elided code).
   - **Part B - AI verify and fill.** Verify what landed against the report. For anything the script could not land cleanly, re-feed the archived text through `-UpdateSession` (read `AIDOCS/SKILL/SKILL_UPDATE-SESSION.md` and execute in migration mode): write Current State from the archive plus the code, and add the main SESSION LIFO bullets the import did not carry. Do not re-add the entries Part A already imported. Validate and commit again (the gate still holds prune).
   - **Standard project (no 321 EXTENDED).** Skip Part A. Part B captures from the swept docs plus the code scan, the handoff file first.
9. **MEMORY capture (C - script 1:1, then the initial project check).** Same shape.
   - **Part A - the 1:1 scavenge.** `migrate-import` the archived MEMORY_EXTENDED:
     ```bash
     node AIDOCS/tools/engine.mjs migrate-import --from AIDOCS/<PROJECT>_SETUP_ARCHIVE/AIDOCS/<OLD>_MEMORY_EXTENDED.md --skill updatememory --old <OLD> --new <PROJECT>
     node AIDOCS/tools/engine.mjs validate --skill updatememory
     node AIDOCS/tools/engine.mjs commit   --skill updatememory
     ```
   - **Part B - the initial project check.** Run `-UpdateMemory` (read `AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md` and execute in migration mode - skip its UpdateSession auto-invoke, step 8 already captured SESSION). It fills the Big 6 from the code scan plus the archive (a hand-rolled `CLAUDE.md` / `AGENTS.md` is prime Big-6 source) and adds durable observations the import did not carry. BACKLOG is already carried in by `migrate-restore` (step 5) and swept at reconcile, so leave it. Validate and commit.
   - **Standard project.** Skip Part A. UpdateMemory fills the Big 6 from code plus the discovered artifacts.
10. **Scrub and verify the capture (A).**
    ```bash
    node AIDOCS/tools/engine.mjs scrub --fix
    node AIDOCS/tools/engine.mjs doctor
    ```
    Capture is AI-written, so it can carry banned prose. `scrub --fix` auto-rewrites the safe cases across the authored files and flags the rest for a quick manual pass. Then `doctor` is the final mechanical gate before handoff, and it grades on two tiers. **Errors** must all pass: the registry resolves, the memory and session shapes survived the import (Purpose, the Big 6, Current State, the LIFO sections), the auto-memory pointers match, and no banned prose remains in AI-authored files. The per-lane orphan-pair check already ran at each capture commit. **Warnings are expected here - leave them.** The capture is deliberately additive, so both lanes land over cap, and `migrate-import` leaves elided-code markers in the depth, so doctor reports size-cap and import-residue warnings and still exits clean. Restored user WDDOCS docs (design / business notes) are outside doctor's prose scan entirely - that is the user's authorship, never rewrite it. Banned prose in restored CHANGELOG or in imported `*_EXTENDED.md` content surfaces as a reconcile warning (not an error) while the gate is set - that is historical content the reconcile pass will distill, not a Setup target. Those are the reconciliation pass's targets, not Setup's. Fix any error in AI-authored files before the gate (a banned-prose flag in MEMORY / SESSION / BACKLOG / DEV-AUDIT / AUTO-PUSH means scrub missed a case - rescrub or fix it by hand), and pass the warnings through untouched.
11. **Stop and hand off (A).** Setup captures, it does not distill. The gate is set (step 6), so it stops here. The reconciliation pass - the gated `/321 -Update` that distills the capture under cap, resolves the import residue, dedups the restored config docs, folds the archived AGENTS / CLAUDE into the lean canonical ones, audits what landed against the archive, and clears the gate - is the next lifecycle phase. The gate holds auto-prune until that pass clears it, so the capture stays additive in the meantime. To graduate without the gated pass, curate the capture by hand and clear the gate with `state --clear-reconcile`.

    Tell the user the capture is parked at the gate, and `/321 -Update` runs the reconciliation pass when they are ready. If `/321` in this session is still the pre-install version, executing the reconcile runbook (`AIDOCS/SKILL/SKILL_UPDATE.md`) directly does the same thing. Graduation (`graduate`) comes later, once the project is steady - it is refused while the gate is set.

    **Note on the uncommitted delta.** A migration leaves a large diff in the working tree (old framework paths removed, engine + archive added). Setup deliberately does not commit. After the reconcile pass clears the gate and the user has reviewed the result, `/321 -AutoPush` is the path to commit and push.

## Discovery sweep (the graded judgement)

Step 2 of the migration path is where Setup's judgement lives, on top of the deterministic backstop. `verdict --suggest` walks the tree first and drafts a candidate verdict by the rules below, so your job is to review and supplement that draft, not author one from scratch - confirm each call, add anything a filename heuristic cannot catch (open a file if unsure), and flip any misclassification. `migrate-archive` has already archived the known 321-shape (step 1), and it stays available to lean on - it is re-runnable, and the same `SETUP_ARCHIVE` is the safe destination for anything the sweep routes there. The grading below fails safe so doubt is non-destructive.

**Honest framing:** on a well-formed existing-321 project, `verdict --suggest` often returns zero candidates because `migrate-archive` already swept everything knowledge-bearing via the known-shape lane. That is the expected steady-state of a clean 321-shaped migration, not a bug. The sweep earns its keep on messy or never-used-321 trees - hand-rolled session files at non-canonical paths, AI scratch in `.ai/`, scattered design notes outside `WDDOCS/`. Run it anyway (it is cheap), but do not interpret a zero-candidate result as something missing.

**Scan breadth.** Walk the project for content that carries knowledge - `WDDOCS/`, root-level docs and notes, design / handoff / scratch files, stray markdown and text. Skip what is not project knowledge: `.git`, `node_modules`, `TEMP`, build output, the engine (`AIDOCS/tools`), and `AIDOCS/ENV` (protected - it may hold secrets and is auto-left in place, so it is never listed), plus the canonical shape the backstop already moved. Source code stays in place - it is the project, not a doc to archive.

**Classify and grade.** For each path set `type` (handoff / design / memory / notes / scratch / env / other), choose an `action` (move / copy / leave), and grade `confidence` from 0 to 1. ENV is always `leave` - it stays in place, never archived. A memory-like file - a rules-laden `CLAUDE.md`, `.ai/` or `.cursor/` notes, a hand-written conventions doc - types as `memory`, and archiving it feeds the auto-memory merge at reconcile, where its guidance is weighed against the canonical rules (default drop, summarized into an existing rule only if it earns a spot).

**Confidence bands drive the action, biased so doubt is non-destructive:**

- **High (0.8 and up)** - act decisively. `move` content the fresh structure supersedes (old memory / session / handoffs) into the archive, and `leave` what clearly belongs in place.
- **Medium (0.5 to 0.8)** - prefer `copy`. The archive gets a snapshot and the working tree keeps the original, so nothing is lost either way.
- **Low (below 0.5)** - do not force a fine call. `copy` the path (archived and kept) or `leave` it and surface it to the user. Doubt should never delete or silently relocate.

**Using the backstop as needed.** The sweep never has to carry the whole load. Route anything you are unsure about into the archive through the verdict, and while archiving (before the reinstall) re-run `migrate-archive --name <PROJECT>` any time to re-secure the known shape - it is idempotent, skipping what is already moved. If judgement is not reliable on a large or unfamiliar tree, fall back to the backstop alone: the known shape is already safe, so leave the rest in place and surface the unsorted paths to the user. The migration is still complete and safe on that baseline.

`verdict --validate` runs before anything moves, so a malformed grade is caught at the gate, not mid-migration.

## Rules

- **Confirm privacy before the first commit.** `init` defaults to `private` (tracks the project's MEMORY / SESSION / BACKLOG, auto-memory, and WDDOCS docs) and prints the mode it used. If this is a public repo, run `node AIDOCS/tools/engine.mjs privacy --set public` before any capture commit, so the project's own knowledge is gated local and only the framework ships. An AI-agent install that ran `init` without a privacy choice should ask the user once, here, before committing.
- **Mode auto-detects.** No flag. Migration biases safe (archive first, nothing deleted).
- **Two-part capture.** The 1:1 scavenge (`migrate-import`) grabs the archived depth verbatim into staging, then the writer skills (`-UpdateSession` / `-UpdateMemory`) verify what landed and fill the gaps. Both go through validate then commit, so nothing reaches a file unchecked.
- **Two lanes, one archive.** The deterministic backstop (`migrate-archive`) covers the known shape and is re-runnable, the AI sweep covers the rest, and the sweep can route anything into the same `SETUP_ARCHIVE` or fall back to the backstop when judgement is uncertain.
- **Migration captures, never distills.** It sets the reconcile gate (which holds auto-prune, so the capture stays additive) and stops. Distillation is the `-Update` reconcile pass, which curates under cap and clears the gate.
- **The install log is the mechanical record.** The archive / import / relay / restore commands append what they did and where content went to `INSTALL/INSTALL.log`. Read it to confirm what moved where before judging content. It rides in `INSTALL/`, so `graduate` removes it with the rest.
- **The archive is the recovery net**, kept until the user deletes it. Existing archived data is never overwritten - both archiving lanes (`migrate-archive` and `verdict`) keep the first copy, and `init` never writes into archive folders. Pruned history (`*_ARCHIVE.md`) and content from a prior migration survive a re-run intact.
- **Custom skills surface their names.** Project-custom skill bodies that predate the action-first naming convention get a rename candidate surfaced before capture (`SKILL_<TARGET>-UPDATE.md` -> `SKILL_UPDATE-<TARGET>.md` and parallel flag flip). The user approves or modifies, Setup never forces the rename. With no legacy customs, the check is silent.

## Deferred (land when their engine does)

`import-skills` (bringing a project's own `/321` skills across) is not yet built. This runbook archives the known shape, runs the graded discovery sweep, restores the project's own docs (DEV-AUDIT, AUTO-PUSH, BACKLOG, CHANGELOG) with `migrate-restore`, scavenges the archived EXTENDED depth 1:1 with `migrate-import`, and captures through the normal skills. The skills-import machinery is added when its engine support lands.

One design lane also runs on its backstop for now:

- **Identity-resolution conflict gate.** The migration takes `--name <PROJECT>` as given (the basename backstop). The sanctioned prompt - escalating only when the basename disagrees with strong code-identity signals - is not built, so identity never blocks the run. Lands with the conflict-detection scan.
