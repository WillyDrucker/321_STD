---
name: update
description: The daily driver. Chains -SessionUpdate then -MemoryUpdate in one pass so SESSION and MEMORY both refresh from this conversation. A thin orchestrator on a routine run - each lane owns its own logic and its own staging commit. When the post-migration reconcile gate is set, the default run hands off to AIDOCS/tools/UPDATE-RECONCILE.md instead. The engine self-update path lives in /321 -SYNC, separate from this skill.
---

# /321 -Update

**Purpose:** Refresh the project's whole memory surface in one pass - SESSION (the event backbone) then MEMORY plus BACKLOG (the durable distillation). This is the flag to run at a checkpoint. It is a thin orchestrator: it invokes the two lane skills and relays their summaries, holding no logic of its own. The engine self-update path lives in `/321 -SYNC`, separate from this skill.

## Routing (decide first, run silently)

Choose the pass before anything else and do not narrate the choice. A routine run produces no "gate is clear, this is the normal chain" preamble - the routing is plumbing, not output.

1. **`graduated: true` in `_index.json`** - onboarding is over and reconciliation can never apply again. Go straight to [The chain (default)](#the-chain-default), silently. No gate read. The router already loaded `_index.json`, so this check costs nothing, and it is the steady state for nearly every run over a project's life.
2. **Otherwise, read the gate once** - `node AIDOCS/tools/engine.mjs state`. `reconcile_pending: true` hands off to the reconciliation reference below. `false` or absent routes to the default chain, run silently.

## Reconciliation pass (post-migration gate)

When routing detects `reconcile_pending: true` on a pre-graduation project, load `AIDOCS/tools/UPDATE-RECONCILE.md` and follow it. That reference owns the full pass: roles, distillation, mechanism, auto-memory merge, config docs, skill-body fold, AGENTS / CLAUDE classification, project rename, acceptance checks, the close, and graduation. The skill body does not duplicate it - the substance lives in the reference, the same pattern `-SYNC` uses with `AIDOCS/tools/SYNC.md`.

## The chain (default)

1. **Run `-SessionUpdate`.** Read `AIDOCS/SKILL/SKILL_SESSION-UPDATE.md` and execute it. SESSION lands first so the memory lane reads a current backbone. If it fails, stop and report - do not proceed to the memory lane on a failed session commit.

2. **Run `-MemoryUpdate`, skipping its Step 1.** Read `AIDOCS/SKILL/SKILL_MEMORY-UPDATE.md` and execute it, but skip its Step 1 auto-invoke of `-SessionUpdate` - this chain already ran it, and re-running would re-walk the conversation against an already-current SESSION. Begin the memory lane at its context-gather step.

Each lane stages and commits independently through the validate -> commit pipeline. `-Update` writes nothing itself.

## Rules

- **Route silently, graduated skips the gate.** A `graduated: true` project (the steady state) goes straight to the default chain - no gate read, no mention of reconciliation. Only a pre-graduation project reads `reconcile_pending`: set hands off to the reconciliation reference, off routes to the normal chain. The routing is never narrated either way.
- **Thin orchestrator (default).** No staging, no ops here - the lanes own their writes.
- **Order is fixed.** SESSION first (events), then MEMORY (the state events imply), so the memory lane distills against a fresh backbone.
- **Stop on a failed lane.** A failed SESSION commit halts the chain before MEMORY runs.

## Deferred (land when their engine does)

The `-FULL` mode pass-through (flowing to each lane on a routine run) is not yet built - it arrives with the update modes. The reconciliation reference at `AIDOCS/tools/UPDATE-RECONCILE.md` distills the core lanes (SESSION / MEMORY / BACKLOG and their EXTENDED), merges auto-memory, reconciles the config docs (DEV-AUDIT / AUTO-PUSH / CHANGELOG), and classifies the archived AGENTS / CLAUDE. The skills lane (a project's own `/321` skill bodies) lands with `import-skills`.
