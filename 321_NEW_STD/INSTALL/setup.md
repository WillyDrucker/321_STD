# Setup runbook (/321 -Setup)

**Purpose:** The read-and-execute runbook for onboarding a project. The `-Setup` skill (the runner) reads this file and executes it step by step. The depth lives here, not in the skill body. This file is ephemeral - it sits under `INSTALL/`, which `graduate` removes once the project is steady.

## Detect mode

Read the target. **Fresh** when the Big 6 are still on their `(fill in ...)` placeholders and there is no prior project content. **Migration** when there is existing content worth preserving (filled docs, a populated SESSION / MEMORY, user docs in WDDOCS, a hand-rolled CLAUDE.md). Any one migration signal flips to migration - a false-positive migration is safe (it archives a fresh scaffold and reinstalls the same), a false-negative would overwrite content.

## File classes (what gets shuffled vs replaced)

Migration shuffles the files that can hold project content and leaves the rest alone. Three classes, by whether a file carries data:

- **Engine (always replaced, never archived).** Scripts (`AIDOCS/tools`), skill bodies (`AIDOCS/SKILL`), auto-memory (`AIDOCS/automemory`), the router (`.claude/skills/321`), and these runbooks (`INSTALL/`). They hold no project data, so `init` always overwrites them and `migrate-archive` never touches them. They just refresh to current.
- **Data (archived, relaid, recaptured) - the shuffle.** `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `AIDOCS/_index.json`, and the data docs `AIDOCS/<PROJECT>_*.md` (MEMORY / SESSION / BACKLOG / DEV-AUDIT / AUTO-PUSH and their extendeds). `init` preserves these on install (write-if-missing), `migrate-archive` moves them aside by name, the reinstall lays them fresh, and the capture step re-derives their content from the archive. Pruned overflow (`*_ARCHIVE.md`) is swept the same way, so prior history is preserved too.
- **User-owned (archived, restored).** `WDDOCS` is restored verbatim and `.gitignore` is union-merged so custom ignores survive. `AIDOCS/ENV` is left in place the whole time (it may hold secrets) and is never archived.

The authoritative lists live in the engine, which needs them to run at any time: `init` derives the data docs from `_index.json`, and `migrate-archive` carries the known-shape list plus the `AIDOCS/*_*.md` sweep. The two sets match by design, so every file install preserves is one migration relays fresh - nothing is left stale. This section documents the split for the migration and is discarded with `INSTALL/` at graduation, while the engine keeps the mechanical truth.

## Fresh path

1. **Register + health.**
   ```bash
   node AIDOCS/tools/engine.mjs sync
   node AIDOCS/tools/engine.mjs doctor
   ```
2. **Fill the Big 6.** Run `/321 -MemoryUpdate` (read `AIDOCS/SKILL/SKILL_MEMORY-UPDATE.md` and execute). Its gap-fill step fills each empty Big-6 section from code, conversation, and SESSION through the staging pipeline. That is the judgment step where Setup earns its space.
3. **Optional first commit.** Offer to commit the scaffold (stage explicitly, never `git add -A` on an unreviewed tree).

## Migration path

The target holds content worth preserving. Land the canonical structure, then layer the project's knowledge back in. Two archiving lanes feed one `SETUP_ARCHIVE` - a deterministic backstop for the known shape, and an AI sweep for everything else. Each mechanical step below (archive, sweep apply, reinstall, restore) appends what it did and where content went to `INSTALL/INSTALL.log`, so you can read that trail to confirm the migration's mechanical history before judging content.

1. **Archive the known shape (deterministic backstop).**
   ```bash
   node AIDOCS/tools/engine.mjs migrate-archive --name <PROJECT>
   ```
   Known 321-shape paths move into `AIDOCS/<PROJECT>_SETUP_ARCHIVE/` (move, never delete - the recovery net). This always runs, so the canonical files are safe no matter what the sweep finds.
2. **Discovery sweep (AI judgement).** Scan the files the backstop does not cover and classify each into a verdict, a JSON array of `{path, type, confidence, action}` written to `TEMP/setup-verdict.json`. The vocab is fixed - type is one of handoff / design / memory / notes / scratch / env / other, action is one of move / copy / leave. See **Discovery sweep** below for scan breadth and the confidence bands that drive each action.
3. **Apply the verdict.**
   ```bash
   node AIDOCS/tools/engine.mjs verdict --validate TEMP/setup-verdict.json
   node AIDOCS/tools/engine.mjs verdict --apply TEMP/setup-verdict.json --name <PROJECT>
   ```
   Validate first (read-only, rejects unknown vocab before any file moves), then apply - the AI-judged paths move or copy into the same `SETUP_ARCHIVE`, or stay in place.
4. **Reinstall the canonical structure.** Lay fresh scaffolds over the now-empty shape with a fetched engine's `init`, keeping the engine and auto-memory in place. (`init` refuses to scaffold over its own source, so migration reinstalls from a fetched engine - `fetch-engine` then `init` from `INSTALL/engine` - not the project's own copy.)
5. **Restore the project's own content (deterministic).**
   ```bash
   node AIDOCS/tools/engine.mjs migrate-restore --name <PROJECT>
   ```
   Layers the archived content back over the fresh scaffold - user docs (`WDDOCS`) verbatim, and a union-merge of the archived `.gitignore` into the canonical one so the project's custom ignores survive (nothing dropped). ENV was left in place, not archived.
6. **Set the reconcile gate, then capture the knowledge back.**
   ```bash
   node AIDOCS/tools/engine.mjs state --set-reconcile
   ```
   The gate marks the migration in progress, and commit holds auto-prune the whole time it is set - so the capture stays additive and nothing is reaped, however oversized the import lands. Then read the archived MEMORY / SESSION / Big-6 content into context and run `/321 -Update` to capture the prior Current State, durable observations, and Big 6 into the fresh structure.
7. **Scrub the captured files to house voice.**
   ```bash
   node AIDOCS/tools/engine.mjs scrub --fix
   ```
   Capture is AI-written, so it can carry em dashes or semicolons. `scrub --fix` rewrites em dashes to ` - ` across the authored files and flags any semicolons for a quick manual pass, so the migration output matches the project voice before the gate.
8. **Stop and hand off.** Setup captures, it does not distill. The reconcile gate is already set (step 6), so it stops here. The reconciliation pass - the gated `-Update` that curates the capture under cap and clears the gate - is the next lifecycle phase and is not built yet. Until it lands the gate holds, so auto-prune stays off. To graduate before then, curate the capture and clear the gate by hand with `state --clear-reconcile`.

   **Tailor the handoff to the session.** Check whether `/321` is live in the current session (is the skill loaded and invocable right now?):
   - **If `/321` is available:** point the user at `/321 -Update` as the reconciliation pass for the capture (forthcoming, per step 8).
   - **If it is not** (a fresh install where the skill sits on disk at `.claude/skills/321/SKILL.md` but this session has not picked it up): say so, point at the installed skill, and note it becomes invocable once the editor or session reloads its skills. Then they run `/321 -Update`.

   Graduation (`graduate`) comes later, once the project is steady - it is refused while the gate is set.

## Discovery sweep (the graded judgement)

Step 2 of the migration path is where Setup's judgement lives, on top of the deterministic backstop. `migrate-archive` has already archived the known 321-shape (step 1), and it stays available to lean on - it is re-runnable, and the same `SETUP_ARCHIVE` is the safe destination for anything the sweep routes there. The sweep grades its own confidence so doubt fails safe.

**Scan breadth.** Walk the project for content that carries knowledge - `WDDOCS/`, root-level docs and notes, design / handoff / scratch files, stray markdown and text. Skip what is not project knowledge: `.git`, `node_modules`, `TEMP`, build output, and the engine (`AIDOCS/tools`), plus the canonical shape the backstop already moved. Source code stays in place - it is the project, not a doc to archive.

**Classify and grade.** For each path set `type` (handoff / design / memory / notes / scratch / env / other), choose an `action` (move / copy / leave), and grade `confidence` from 0 to 1. ENV is always `leave` - it stays in place, never archived.

**Confidence bands drive the action, biased so doubt is non-destructive:**

- **High (0.8 and up)** - act decisively. `move` content the fresh structure supersedes (old memory / session / handoffs) into the archive, and `leave` what clearly belongs in place.
- **Medium (0.5 to 0.8)** - prefer `copy`. The archive gets a snapshot and the working tree keeps the original, so nothing is lost either way.
- **Low (below 0.5)** - do not force a fine call. `copy` the path (archived and kept) or `leave` it and surface it to the user. Doubt should never delete or silently relocate.

**Using the backstop as needed.** The sweep never has to carry the whole load. Route anything you are unsure about into the archive through the verdict, and while archiving (before the reinstall) re-run `migrate-archive --name <PROJECT>` any time to re-secure the known shape - it is idempotent, skipping what is already moved. If judgement is not reliable on a large or unfamiliar tree, fall back to the backstop alone: the known shape is already safe, so leave the rest in place and surface the unsorted paths to the user. The migration is still complete and safe on that baseline.

`verdict --validate` runs before anything moves, so a malformed grade is caught at the gate, not mid-migration.

## Rules

- **Mode auto-detects.** No flag. Migration biases safe (archive first, nothing deleted).
- **Skills are the writer.** Setup orchestrates and delegates capture to `-MemoryUpdate` / `-SessionUpdate` through the staging pipeline.
- **Two lanes, one archive.** The deterministic backstop (`migrate-archive`) covers the known shape and is re-runnable, the AI sweep covers the rest, and the sweep can route anything into the same `SETUP_ARCHIVE` or fall back to the backstop when judgement is uncertain.
- **Migration captures, never distills.** It sets the reconcile gate (which holds auto-prune, so the capture stays additive) and stops. Distillation is the `-Update` reconcile pass, which curates under cap and clears the gate.
- **The install log is the mechanical record.** The archive / relay / restore commands append what they did and where content went to `INSTALL/INSTALL.log`. Read it to confirm what moved where before judging content. It rides in `INSTALL/`, so `graduate` removes it with the rest.
- **The archive is the recovery net**, kept until the user deletes it. Existing archived data is never overwritten - both archiving lanes (`migrate-archive` and `verdict`) keep the first copy, and `init` never writes into archive folders. Pruned history (`*_ARCHIVE.md`) and content from a prior migration survive a re-run intact.

## Deferred (land when their engine does)

The lossless EXTENDED import and `import-skills` (bringing a project's own `/321` skills across) are not yet built. This runbook archives the known shape, runs the graded discovery sweep, and captures through the normal skills. The deeper machinery is added when its engine support lands.

Two design lanes also run on their backstop for now:

- **Identity-resolution conflict gate.** The migration takes `--name <PROJECT>` as given (the basename backstop). The sanctioned prompt - escalating only when the basename disagrees with strong code-identity signals - is not built, so identity never blocks the run. Lands with the conflict-detection scan.
- **Judgement restore layers.** `migrate-restore` is the deterministic lane only (WDDOCS verbatim plus the `.gitignore` union-merge). The design's judgement layers (DEV-AUDIT Project specifics, CHANGELOG reformat, AGENTS pointers) are not copied back - the capture step re-derives them from the archive plus the code scan instead. A dedicated restore lands only if re-derivation proves lossy.
