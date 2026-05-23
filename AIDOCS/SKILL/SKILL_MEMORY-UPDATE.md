---
name: memoryupdate
description: Distill durable observations into MEMORY (LIFO + Big-6 static sections) and manage BACKLOG (Features + Ideas). Auto-invokes SessionUpdate first so SESSION is current. Fills empty Big-6 sections from code + conversation + SESSION. Writes through the staging pipeline.
---

# /321 -MemoryUpdate

**Purpose:** Distill durable observations into `<PROJECT>_MEMORY.md` (LIFO plus the Big-6 static sections) and manage `<PROJECT>_BACKLOG.md` (forward-looking Features plus Ideas). Always auto-invokes `-SessionUpdate` first so SESSION is current before this reads it. Writes only through the staging pipeline.

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

- **Pain-point test:** could a future reader open the code and its comments and know what to do? Yes -> no bullet. Needs context not derivable from code? -> bullet candidate. True in 6 months? -> LIFO. Transient state? -> drop (SessionUpdate caught it).
- **Keep-test:** would an AI starting cold benefit? Re-derivable from code or git? Drop.

## Step 1: Auto-invoke SessionUpdate

Always run `/321 -SessionUpdate` first, so SESSION is current before this skill reads it. If it fails, stop and report.

**Migration exception:** when the `-Setup` migration capture drives this skill (migration mode), skip Step 1 - Setup's SESSION capture already ran this pass. `migrate-import` has already scavenged the archived MEMORY_EXTENDED depth 1:1, so do not re-derive those entries - fill the Big 6 from the code scan plus the archive (the initial project check), and add durable observations the import did not carry. Leave BACKLOG alone here: `migrate-restore` already carried it in and the reconciliation pass sweeps it. Capture additively, the reconciliation pass distills later.

## Step 2: Gather context

SESSION (just refreshed) plus the conversation plus the codebase are the source of truth. MEMORY is the write target and dedupe reference. Re-read if not in context: `<PROJECT>_MEMORY.md`, `<PROJECT>_BACKLOG.md`, the watermark `memoryupdate.last_committed_at`. For Big-6 gap-fill, also read `package.json`, `_index.json`, framework / deploy configs, and the top-level layout.

## Step 3: Route each finding

| Item | Destination | Op |
|---|---|---|
| Durable observation (codebase, conversation, distilled from SESSION) | MEMORY LIFO | `lifo_insert` on `memoryupdate.memory`, section `LIFO` |
| An empty Big-6 section you can fill from evidence | that section | `overwrite_section` on `memoryupdate.memory`, section `<Section>` |
| Specific feature ask (user-named, ready to implement) | BACKLOG Features | `lifo_insert` on `memoryupdate.backlog`, section `Features` |
| Other future work (refactor, polish, exploratory, deferred bug) | BACKLOG Ideas | `lifo_insert` on `memoryupdate.backlog`, section `Ideas` |
| AGENTS / auto-memory suggestion | MEMORY LIFO, as a `**Suggested for ...:**` bullet | `lifo_insert` |
| Project-specific event or active state | DROP - SessionUpdate's lane | (n/a) |
| Code-applicable pattern (lint / grep enforceable) | DROP - DevAudit's lane | (n/a) |

### BACKLOG capture filter

Capture only when one holds: explicit user future intent ("we should do X"), user directional weight ("would be nice if..."), or AI-surfaced with user consent (tag `_(source: ai-surfaced)_`). Format: `**<title>.** <one-line description> _(source: user|ai-surfaced)_`. Features = specific and ready. Ideas = everything else worth remembering. When in doubt -> Ideas.

## Step 4: Big-6 gap-fill (empty sections only)

For the two script-readable sections, start from the deterministic draft: `node AIDOCS/tools/engine.mjs bigsix --suggest` prints fact bullets for **Stack** and **Pipeline** straight from package.json (language, runtime, framework, deps, the build / test / release scripts). Refine that draft into house-voice prose rather than re-deriving the facts. For each remaining Big-6 section still on its `(fill in ...)` placeholder, gather evidence (codebase scan, conversation, SESSION distillation) and draft 2-4 lines a cold-start session would use. Stage each as `overwrite_section` on that section. Conflict precedence: code and config win for Stack / Pipeline facts, conversation wins for audience / intent / lineage. Where evidence is genuinely missing, leave the placeholder.

## Step 5: Stage

Write `AIDOCS/tools/staging/memoryupdate.json`. Never edit MEMORY / BACKLOG directly. The domain firewall lets this skill touch only `memoryupdate.*` files.

```json
{
  "actions": [
    { "op": "overwrite_section", "file": "memoryupdate.memory", "section": "Stack", "body": "<2-4 lines>" },
    { "op": "lifo_insert", "file": "memoryupdate.memory", "section": "LIFO", "bullet": "<durable observation>" },
    { "op": "lifo_insert", "file": "memoryupdate.memory", "section": "LIFO", "bullet": "<observation that earns depth>", "extended_anchor": "<slug-of-the-bullet>" },
    { "op": "add", "file": "memoryupdate.memory_extended", "anchor": "<slug-of-the-bullet>", "heading": "<observation that earns depth>", "body_md": "<the why, the rationale, what was non-obvious>" },
    { "op": "lifo_insert", "file": "memoryupdate.backlog", "section": "Ideas", "bullet": "**<title>.** <desc> _(source: user)_" }
  ]
}
```

**Extended detail (the `[+]` pair).** When a durable observation needs more than a line or two of rationale, pair it: set `extended_anchor` on the `lifo_insert` (the engine renders `- [+] <bullet>`, no link) and emit an `add` on `memoryupdate.memory_extended` whose `heading` is the same bullet text. The `anchor` must equal `slugify` of both the bullet and the heading - that shared slug is how the engine pairs them. Keep `body_md` prose, no code fences (the validator rejects them, the code lives in source). A `[+]` bullet with no matching sub-section fails commit (the orphan check), so always pair them. Use `drop` / `replace` (by anchor) to edit an existing sub-section.

## Step 6: Validate + commit

```bash
node AIDOCS/tools/engine.mjs validate --skill memoryupdate
node AIDOCS/tools/engine.mjs commit   --skill memoryupdate
```

Two-phase: simulate, abort before any write on failure, then persist, stamp the watermark, clear staging.

## Rules

- **Default is no change.** Ruthless filter - most sessions produce project work, not memory-track.
- **Never write project events.** SESSION's lane. Code-applicable rules drop to DevAudit's lane.
- **Auto-invoke SessionUpdate first** so SESSION is current before reading.
- **Staging only**, and the firewall keeps this skill inside `memoryupdate.*`.
- **AGENTS / auto-memory stay user-scoped** - surface them as suggestive LIFO bullets, never auto-write them.

## Deferred (land when their engine does)

The `-FULL` update mode, surgical Big-6 edits, and the LIFO-to-static promotion heuristic (refining a *filled* Big-6 section, vs. filling an empty one) are not yet built. This lean body fills empty Big-6 sections and appends LIFO (with optional `[+]` EXTENDED depth, orphan-checked and auto-pruned at commit, the prune held while a reconcile is pending) plus BACKLOG through the pipeline.
