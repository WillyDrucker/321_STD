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

## Step 2: Gather context

SESSION (just refreshed) plus the conversation plus the codebase are the source of truth. MEMORY is the write target and dedupe reference. Re-read if not in context: `<PROJECT>_MEMORY.md`, `<PROJECT>_BACKLOG.md`, the watermark `updatememory.last_committed_at`. For Big-6 gap-fill, also read `package.json`, `_index.json`, framework / deploy configs, and the top-level layout.

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

Write `AIDOCS/tools/staging/updatememory.json`. Never edit MEMORY / BACKLOG directly. The domain firewall lets this skill touch only `updatememory.*` files.

```json
{
  "actions": [
    { "op": "overwrite_section", "file": "updatememory.memory", "section": "Stack", "body": "<2-4 lines>" },
    { "op": "lifo_insert", "file": "updatememory.memory", "section": "LIFO", "bullet": "<durable observation>" },
    { "op": "lifo_insert", "file": "updatememory.memory", "section": "LIFO", "bullet": "<observation that earns depth>", "extended_anchor": "<slug-of-the-bullet>" },
    { "op": "add", "file": "updatememory.memory_extended", "anchor": "<slug-of-the-bullet>", "heading": "<observation that earns depth>", "body_md": "<the why, the rationale, what was non-obvious>" },
    { "op": "lifo_insert", "file": "updatememory.backlog", "section": "Ideas", "bullet": "**<title>.** <desc> _(source: user)_" }
  ]
}
```

**Extended detail (the `[+]` pair).** When a durable observation needs more than a line or two of rationale, pair it: set `extended_anchor` on the `lifo_insert` (the engine renders `- [+] <bullet>`, no link) and emit an `add` on `updatememory.memory_extended` whose `heading` is the same bullet text. The `anchor` must equal `slugify` of both the bullet and the heading - that shared slug is how the engine pairs them. Use `drop` / `replace` (by anchor) to edit an existing sub-section. Keep `body_md` prose - no code fences (the validator rejects them, code lives in source). A `[+]` bullet with no matching sub-section fails commit (the orphan check), so always pair them.

## Step 6: Validate + commit

```bash
node AIDOCS/tools/engine.mjs validate --skill updatememory
node AIDOCS/tools/engine.mjs commit   --skill updatememory
```

Two-phase: simulate, abort before any write on failure, then persist, stamp the watermark, clear staging.

## -FULL mode

`-UpdateMemory -FULL` rebuilds MEMORY from the full conversation plus codebase plus SESSION rather than appending the incremental tail. Re-walk every Big-6 section against current evidence (re-derive filled ones, do not trust the prior prose), and re-walk LIFO from durable observations across the whole arc. Use when MEMORY has drifted, after a long pause, or when a Big-6 section needs fresh derivation.

The lean default appends from the conversation tail since the last watermark and only fills empty Big-6 sections. `-FULL` ignores the watermark and re-derives populated sections too.

## Rules

- **Default is no change.** Ruthless filter - most sessions produce project work, not memory-track.
- **Never write project events.** SESSION's lane. Code-applicable rules drop to DevAudit's lane.
- **Auto-invoke -UpdateSession first** so SESSION is current before reading.
- **Staging only**, and the firewall keeps this skill inside `updatememory.*`.
- **AGENTS / auto-memory stay user-scoped** - surface them as suggestive LIFO bullets, never auto-write them.

## Deferred

The LIFO-to-static promotion heuristic (taking a stabilized LIFO entry and folding it into a Big-6 section's prose) is not yet built. The lean default writes new observations to LIFO. Promotion of mature LIFO entries into Big-6 prose remains a future capability.
