---
name: updatememory
description: Distill durable observations into MEMORY (LIFO + Big-6 static sections) and manage BACKLOG (Features + Ideas). Auto-invokes -UpdateSession first so SESSION is current. Fills empty Big-6 sections from code + conversation + SESSION. Writes through the staging pipeline. BACKLOG is written ONLY here, never ad-hoc.
---

# /321 -UpdateMemory

**Purpose:** Distill durable observations into `<PROJECT>_MEMORY.md` (LIFO plus the Big-6 static sections) and manage `<PROJECT>_BACKLOG.md` (forward-looking Features plus Ideas). Always auto-invokes `-UpdateSession` first so SESSION is current before this reads it. Writes only through the staging pipeline. **This skill is the sole writer of BACKLOG** - entries are added only on an Update run, never ad-hoc mid-task.

## MEMORY's two functions

- **Schema filler.** The Big 6 (Overview / Stack / Architecture / Environment / Pipeline / Conventions) give a cold-start session its orientation. Filled from codebase plus conversation plus SESSION distillation.
- **Decision distiller.** LIFO accumulates durable observations as they surface. Many stay there indefinitely as standalone durable notes - that is a destination, not a waiting room.

## What SESSION cannot reach

SESSION captures events. MEMORY captures four things events miss:

1. **Codebase facts** - what the stack actually is, what deploy does, the directory shape. The codebase IS state.
2. **Conversational identity** - audience, lineage, problem statement, founding constraint, stated in passing.
3. **Implicit decisions** - "we use TypeScript strict", never debated, no event marks it.
4. **Pre-history facts** - lineage and founding context that predate tracking.

## You drive the filter

Default is no change - most sessions produce project work, not memory-track work. Walk the conversation plus SESSION plus codebase for durable observations.

- **Pain-point test:** could a future reader open the code and its comments and know what to do? Yes -> no bullet. Needs context not derivable from code? -> bullet candidate. True in 6 months? -> LIFO. Transient state? -> drop (UpdateSession caught it).
- **Keep-test:** would an AI starting cold benefit? Re-derivable from code or git? Drop.

## Step 1: Auto-invoke -UpdateSession

Always run `/321 -UpdateSession` first, so SESSION is current before this skill reads it. If it fails, stop and report.

A Setup-driven capture skips this step and follows the migration exception in `AIDOCS/tools/PATTERN-UPDATE-FULL.md`, never a graduated project.

## Step 2: Gather context (watermark scopes the read)

SESSION (just refreshed) plus the conversation plus the codebase are the source of truth. MEMORY is the write target and the dedupe reference. **The watermark is your starting point. Do NOT re-read the conversation prefix before it unless `-FULL` was passed.**

- `<PROJECT>_MEMORY.md`, `<PROJECT>_BACKLOG.md` (the live files, the dedupe references)
- `node AIDOCS/tools/engine.mjs watermark --skill updatememory` (prints `last_committed_at` plus `recent_captured`, a rolling window of the slugs from the last few commits, on demand)
- For Big-6 gap-fill: `package.json`, `_index.json`, framework / deploy configs, and the top-level layout.

The watermark answers "did I capture this arc in the last few runs?" The live MEMORY.md and BACKLOG.md show the captured observations as content. Both let you skip work the previous passes already did.

## Step 3: Route each finding

| Item | Destination | Op |
|---|---|---|
| Durable observation (codebase, conversation, distilled from SESSION) | MEMORY LIFO | `lifo_insert` on `updatememory.memory`, section `LIFO` |
| An empty Big-6 section you can fill from evidence | that section | `overwrite_section` on `updatememory.memory`, section `<Section>` |
| Long-term feature direction (user-committed eventually, not immediate) | BACKLOG Features | `lifo_insert` on `updatememory.backlog`, section `Features` |
| Long-term exploratory or what-if direction | BACKLOG Ideas | `lifo_insert` on `updatememory.backlog`, section `Ideas` |
| A MEMORY LIFO bullet or BACKLOG item this run proved wrong or reframed | that bullet, in place | `amend_bullet` |
| A BACKLOG item that shipped or died | gone, the line archived by commit | `drop_bullet` on `updatememory.backlog` |
| Immediate follow-up, next step of in-flight work, cross-track flag | DROP - UpdateSession's lane | (n/a) |
| AGENTS / auto-memory suggestion | MEMORY LIFO, as a `**Suggested for ...:**` bullet | `lifo_insert` |
| Project-specific event or active state | DROP - UpdateSession's lane | (n/a) |
| Code-applicable pattern (lint / grep enforceable) | DROP - DevAudit's lane | (n/a) |

### BACKLOG capture filter

BACKLOG is long-term direction only - items the project may pursue eventually, not immediate items marked for review. The bar: a "don't forget this at some point" entry earns BACKLOG, a "store these here for now" entry does not. Follow-ups, cross-track flags, and the next step of in-flight work belong in SESSION, not here. Capture for BACKLOG only when one of these holds: explicit user future intent ("we should do X eventually"), user directional weight ("would be nice if..."), or AI-surfaced with user consent (tag `_(source: ai-surfaced)_`). Format: `**<title>.** <one-line description> _(source: user|ai-surfaced)_`. **One bullet per item, always.** Features = committed long-term direction. Ideas = exploratory, what-if. When in doubt -> Ideas. When still in doubt -> drop, the SESSION lane will catch it as an event.

**BACKLOG becomes a dumping ground the moment you stop guarding it.** It is the most-abused lane precisely because everything technically "fits" - resist that. **A quiet run that adds nothing to BACKLOG is the common, correct outcome.**

**BACKLOG is written ONLY here, only by this skill, only on an Update run.** Never add to it ad-hoc mid-task, and never treat it as a consideration outside `/321 -Update` / `-UpdateMemory`.

## Step 4: Big-6 gap-fill (empty sections, and a sentence the run falsified)

For the two script-readable sections, start from the deterministic draft: `node AIDOCS/tools/engine.mjs bigsix --suggest` prints fact bullets for **Stack** and **Pipeline** straight from package.json (language, runtime, framework, deps, the build / test / release scripts). Refine that draft into house-voice prose rather than re-deriving the facts. For each remaining Big-6 section still on its `(fill in ...)` placeholder, gather evidence (codebase scan, conversation, SESSION distillation) and draft 2-4 lines a cold-start session would use. Stage each as `overwrite_section` on that section. Conflict precedence: code and config win for Stack / Pipeline facts, conversation wins for audience / intent / lineage. Where evidence is genuinely missing, leave the placeholder.

**A populated section the run itself proved wrong gets its one sentence corrected in the lean pass.** `overwrite_section` on that section, the changed sentence and the rest carried verbatim, and the run's LIFO bullet names the correction. The lean pass never re-derives a populated section, and it never leaves a known lie standing either: the doctor's drift guard watches dependency names, not facts, so this is the only route a falsified sentence has short of `-FULL`.

## Step 5: Stage

Write `AIDOCS/tools/staging/updatememory.json`. The staging contract (action shapes, LIFO ordering, `[+]` paired bullets, `slugify`, body cap, `LOAD_BEARING`) lives in `AIDOCS/tools/PATTERN-STAGING.md`. Read it once per session if you do not already have it in context.

The skill-specific notes:

- **Domain firewall.** This skill writes only to `updatememory.memory`, `updatememory.memory_extended`, and `updatememory.backlog`.
- **Big-6.** Use `overwrite_section` on the Big-6 section name. The `Stack` and `Pipeline` drafts from `bigsix --suggest` go in here as refined prose.
- **LIFO observations.** Use `lifo_insert` on section `LIFO`. List the run's durable observations oldest-first in `actions` so the newest one lands on top.
- **BACKLOG.** Use `lifo_insert` on `updatememory.backlog`, section `Features` or `Ideas`. Same oldest-first rule.
- **Earned depth.** Pair a bullet with an `add` on `updatememory.memory_extended` when it needs more than a line or two of rationale.
- **Targeted edits.** `amend_bullet` rewrites one LIFO bullet or BACKLOG item in place by its opening words or slug (`match`), keeping its `[+]` marker (pair a `drop` and an `add` on the EXTENDED when the text changes, since the anchor moves with it). `drop_bullet` removes a shipped or dead BACKLOG item and commit archives the line under `<PROJECT>_BACKLOG_ARCHIVE/`, move not delete. A `[+]` item leaves with a `drop` on its sub-section in the same staging, or commit refuses.

## Step 6: Commit

```bash
node AIDOCS/tools/engine.mjs commit --skill updatememory
```

`commit` validates, simulates, persists, stamps the watermark (timestamp plus this run's bullet slugs), and clears staging. A standalone `validate` is optional - use it only while iterating on a draft you expect to fail.

## Step 7: Mirror BACKLOG to a tracker issue (only when the project set one)

```bash
node AIDOCS/tools/engine.mjs sync-backlog
```

Inert until `integrations.backlog_issue` is set in `_index.json`, and never invent the number. Once set, run it after `commit` on every pass. It is idempotent and fails soft. The mirror's rules live in `AIDOCS/tools/PATTERN-UPDATE-FULL.md`.

## Lean execution path (one pass, no extra machinery)

1. Skim the conversation tail since the watermark. Do **not** re-read the prefix. Read this skill body plus the live `<PROJECT>_MEMORY.md` and `<PROJECT>_BACKLOG.md` (the SESSION freshly written by Step 1 is already in context). The PATTERN-STAGING reference loads on demand if you need the staging contract.
2. **Do NOT read MEMORY_EXTENDED unless an op is `drop` / `replace` against an existing sub-section.** An `add` needs no prior read.
3. Author the staging JSON directly at `AIDOCS/tools/staging/updatememory.json`. The staging file IS the artifact.
4. `commit` once. Skip standalone `validate`. Target: read 3 files (plus the SESSION 1 file -UpdateSession already touched), write 1 staging file, commit 1. Zero engine source, zero scratch scripts.
5. `sync-backlog` once, only when the project has an issue configured. It is idempotent and fails soft.

## -FULL mode

`-UpdateMemory -FULL` re-walks every Big-6 section and the LIFO against current evidence, where the lean pass only fills an empty section and never re-derives a populated one. A `[Big-6 drift]` warning from `doctor` is the trigger, and the run stages all four code-bound sections even when a body came back unchanged, since the commit is what lays the mark. The pass, and the blind spot the guard closes, live in `AIDOCS/tools/PATTERN-UPDATE-FULL.md`, loaded on a `-FULL` run or a drift warning.

## Rules

- **Default is no change.** Ruthless filter - most sessions produce project work, not memory-track.
- **Never write project events.** SESSION's lane. Code-applicable rules drop to DevAudit's lane.
- **Auto-invoke -UpdateSession first** so SESSION is current before reading.
- **Staging only**, and the firewall keeps this skill inside `updatememory.*`. The sole hand-edit exception is a mechanical house-voice fix (em dash, clause-joining semicolon) via `scrub --fix --semicolons`, which rewrites voice without touching captured content or the watermark.
- **AGENTS / auto-memory stay user-scoped** - surface them as suggestive LIFO bullets, never auto-write them.
- **BACKLOG is written only on an Update run**, only by this skill, one bullet per item. Never ad-hoc, never a dumping ground.
- **Never hand-edit the mirrored issue.** It is a generated copy of the BACKLOG file. Step 7 overwrites it. Edit the file.
