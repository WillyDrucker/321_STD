---
name: updatememory
description: Distill durable observations into MEMORY (LIFO + Big-6 static sections) and manage BACKLOG (Features + Ideas). Auto-invokes -UpdateSession first so SESSION is current. Fills empty Big-6 sections from code + conversation + SESSION. Writes through the staging pipeline.
---

# /321 -UpdateMemory

**Purpose:** Distill durable observations into `<PROJECT>_MEMORY.md` (LIFO plus the Big-6 static sections) and manage `<PROJECT>_BACKLOG.md` (forward-looking Features plus Ideas). Always auto-invokes `-UpdateSession` first so SESSION is current before this reads it. Writes only through the staging pipeline.

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

**Migration exception:** when the `-Setup` migration capture drives this skill (migration mode), skip Step 1 - Setup's SESSION capture already ran this pass. `migrate-import` has already scavenged the archived MEMORY_EXTENDED depth 1:1, so do not re-derive those entries - fill the Big 6 from the code scan plus the archive (the initial project check), and add durable observations the import did not carry. Leave BACKLOG alone here: `migrate-restore` already carried it in and the reconciliation pass sweeps it. Capture additively, the reconciliation pass distills later.

## Step 2: Gather context (watermark scopes the read)

SESSION (just refreshed) plus the conversation plus the codebase are the source of truth. MEMORY is the write target and the dedupe reference. **The watermark is your starting point. Do NOT re-read the conversation prefix before it unless `-FULL` was passed.**

- `<PROJECT>_MEMORY.md`, `<PROJECT>_BACKLOG.md` (the live files, the dedupe references)
- `node AIDOCS/tools/engine.mjs watermark --skill updatememory` (prints `last_committed_at` plus the slugs of the last run's captured bullets, on demand)
- For Big-6 gap-fill: `package.json`, `_index.json`, framework / deploy configs, and the top-level layout.

The watermark answers "what did I capture last time?" The live MEMORY.md and BACKLOG.md show the captured observations as content. Both let you skip work the previous pass already did.

## Step 3: Route each finding

| Item | Destination | Op |
|---|---|---|
| Durable observation (codebase, conversation, distilled from SESSION) | MEMORY LIFO | `lifo_insert` on `updatememory.memory`, section `LIFO` |
| An empty Big-6 section you can fill from evidence | that section | `overwrite_section` on `updatememory.memory`, section `<Section>` |
| Long-term feature direction (user-committed eventually, not immediate) | BACKLOG Features | `lifo_insert` on `updatememory.backlog`, section `Features` |
| Long-term exploratory or what-if direction | BACKLOG Ideas | `lifo_insert` on `updatememory.backlog`, section `Ideas` |
| Immediate follow-up, next step of in-flight work, cross-track flag | DROP - UpdateSession's lane | (n/a) |
| AGENTS / auto-memory suggestion | MEMORY LIFO, as a `**Suggested for ...:**` bullet | `lifo_insert` |
| Project-specific event or active state | DROP - UpdateSession's lane | (n/a) |
| Code-applicable pattern (lint / grep enforceable) | DROP - DevAudit's lane | (n/a) |

### BACKLOG capture filter

BACKLOG is long-term direction only - items the project may pursue eventually, not immediate items marked for review. The bar: a "don't forget this at some point" entry earns BACKLOG, a "store these here for now" entry does not. Follow-ups, cross-track flags, and the next step of in-flight work belong in SESSION, not here. Capture for BACKLOG only when one of these holds: explicit user future intent ("we should do X eventually"), user directional weight ("would be nice if..."), or AI-surfaced with user consent (tag `_(source: ai-surfaced)_`). Format: `**<title>.** <one-line description> _(source: user|ai-surfaced)_`. Features = committed long-term direction. Ideas = exploratory, what-if. When in doubt -> Ideas. When still in doubt -> drop, the SESSION lane will catch it as an event.

## Step 4: Big-6 gap-fill (empty sections only)

For the two script-readable sections, start from the deterministic draft: `node AIDOCS/tools/engine.mjs bigsix --suggest` prints fact bullets for **Stack** and **Pipeline** straight from package.json (language, runtime, framework, deps, the build / test / release scripts). Refine that draft into house-voice prose rather than re-deriving the facts. For each remaining Big-6 section still on its `(fill in ...)` placeholder, gather evidence (codebase scan, conversation, SESSION distillation) and draft 2-4 lines a cold-start session would use. Stage each as `overwrite_section` on that section. Conflict precedence: code and config win for Stack / Pipeline facts, conversation wins for audience / intent / lineage. Where evidence is genuinely missing, leave the placeholder.

## Step 5: Stage

Write `AIDOCS/tools/staging/updatememory.json`. The staging contract (action shapes, LIFO ordering, `[+]` paired bullets, `slugify`, body cap, `LOAD_BEARING`) lives in `AIDOCS/tools/PATTERN-STAGING.md`. Read it once per session if you do not already have it in context.

The skill-specific notes:

- **Domain firewall.** This skill writes only to `updatememory.memory`, `updatememory.memory_extended`, and `updatememory.backlog`.
- **Big-6.** Use `overwrite_section` on the Big-6 section name. The `Stack` and `Pipeline` drafts from `bigsix --suggest` go in here as refined prose.
- **LIFO observations.** Use `lifo_insert` on section `LIFO`. List the run's durable observations oldest-first in `actions` so the newest one lands on top.
- **BACKLOG.** Use `lifo_insert` on `updatememory.backlog`, section `Features` or `Ideas`. Same oldest-first rule.
- **Earned depth.** Pair a bullet with an `add` on `updatememory.memory_extended` when it needs more than a line or two of rationale.

## Step 6: Commit

```bash
node AIDOCS/tools/engine.mjs commit --skill updatememory
```

`commit` validates, simulates, persists, stamps the watermark (timestamp + this run's bullet fingerprints), and clears staging. A standalone `validate` is optional - use it only while iterating on a draft you expect to fail.

## Lean execution path (one pass, no extra machinery)

1. Skim the conversation tail since the watermark. Do **not** re-read the prefix. Read this skill body plus the live `<PROJECT>_MEMORY.md` and `<PROJECT>_BACKLOG.md` (the SESSION freshly written by Step 1 is already in context). The PATTERN-STAGING reference loads on demand if you need the staging contract.
2. **Do NOT read MEMORY_EXTENDED unless an op is `drop` / `replace` against an existing sub-section.** An `add` needs no prior read.
3. Author the staging JSON directly at `AIDOCS/tools/staging/updatememory.json`. The staging file IS the artifact.
4. `commit` once. Skip standalone `validate`. Target: read 3 files (plus the SESSION 1 file -UpdateSession already touched), write 1 staging file, commit 1. Zero engine source, zero scratch scripts.

## -FULL mode

`-UpdateMemory -FULL` widens the read past the watermark and re-derives populated Big-6 sections, but **uses the existing MEMORY.md bullets and Big-6 prose as a starting reference, not a discard.** Most observations are already captured. Walk the codebase plus conversation plus SESSION against the existing bullets and look for: gaps (an observation that did not land), drift (a bullet or Big-6 line whose framing is now stale), and over-cap EXTENDED bodies (a sub-section that grew past the cap and needs re-summarizing).

- Re-walk every Big-6 section against current evidence. The lean default only fills placeholders. `-FULL` may `overwrite_section` a populated one when the prose has drifted.
- Add missing LIFO observations with `lifo_insert` as the lean default would. Main-LIFO bullets have no targeted replace - the only ops are `lifo_insert` (prepend) and `overwrite_section` (rewrite the whole LIFO). Reach for `overwrite_section` only when the LIFO has genuinely diverged enough to justify the full rewrite. Otherwise leave drifted bullets alone, since the depth content is where `-FULL`'s real value lands.
- For depth drift (`### sub-section` body bloated or stale) and over-cap EXTENDED entries, re-derive under cap and `replace` the sub-section by anchor (this is where `replace` belongs - EXTENDED only). A genuinely load-bearing entry marks itself `<!-- LOAD_BEARING -->` and rides the warning forever.

Use `-FULL` when MEMORY has drifted, after a long pause, or when a Big-6 section needs fresh derivation. The lean default appends from the conversation tail and only fills empty Big-6 sections.

## Rules

- **Default is no change.** Ruthless filter - most sessions produce project work, not memory-track.
- **Never write project events.** SESSION's lane. Code-applicable rules drop to DevAudit's lane.
- **Auto-invoke -UpdateSession first** so SESSION is current before reading.
- **Staging only**, and the firewall keeps this skill inside `updatememory.*`.
- **AGENTS / auto-memory stay user-scoped** - surface them as suggestive LIFO bullets, never auto-write them.

## Deferred

The LIFO-to-static promotion heuristic (taking a stabilized LIFO entry and folding it into a Big-6 section's prose) is not yet built. The lean default writes new observations to LIFO. Promotion of mature LIFO entries into Big-6 prose remains a future capability.
