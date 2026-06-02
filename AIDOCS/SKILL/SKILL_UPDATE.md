---
name: update
description: The daily driver. Chains -UpdateSession then -UpdateMemory in one pass so SESSION and MEMORY both refresh from this conversation. -FULL propagates to each lane's full-rebuild mode. A thin orchestrator on a routine run - each lane owns its own logic and its own staging commit. When the post-migration reconcile gate is set, the default run hands off to AIDOCS/tools/UPDATE-RECONCILE.md instead. The engine self-update path lives in /321 -UpdateSync, separate from this skill.
---

# /321 -Update

**Purpose:** Refresh the project's whole memory surface in one pass - SESSION (the event backbone) then MEMORY plus BACKLOG (the durable distillation). The flag to run at a checkpoint. A thin orchestrator: invokes the two lane skills and relays their summaries, holding no logic of its own. The engine self-update path is `/321 -UpdateSync`, separate from this skill.

## Routing (decide first, run silently)

Choose the pass before anything else and do not narrate the choice. The routing is plumbing, not output.

1. **`graduated: true` in `_index.json`** - onboarding is over and reconciliation can never apply again. Go straight to [The chain](#the-chain), silently. No gate read. The router already loaded `_index.json`, so this check costs nothing, and it is the steady state for nearly every run over a project's life.
2. **Otherwise, read the gate once** - `node AIDOCS/tools/engine.mjs state`. `reconcile_pending: true` hands off to the reconciliation reference below. `false` or absent routes to the default chain, run silently.

## Reconciliation pass (post-migration gate)

When routing detects `reconcile_pending: true` on a pre-graduation project, load `AIDOCS/tools/UPDATE-RECONCILE.md` and follow it. That reference owns the full pass: roles, distillation, mechanism, auto-memory merge, config docs, skill-body fold, AGENTS / CLAUDE classification, project rename, acceptance checks, the close, and graduation. The skill body does not duplicate it - the substance lives in the reference.

## The chain

1. **Run `-UpdateSession`.** Read `AIDOCS/SKILL/SKILL_UPDATE-SESSION.md` and execute it. SESSION lands first so the memory lane reads a current backbone. If it fails, stop and report - do not proceed to the memory lane on a failed session commit.

2. **Run `-UpdateMemory`, skipping its Step 1.** Read `AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md` and execute it, but skip its Step 1 auto-invoke of `-UpdateSession` - this chain already ran it, and re-running would re-walk the conversation against an already-current SESSION. Begin the memory lane at its context-gather step.

Each lane stages and commits independently through the validate -> commit pipeline. `-Update` writes nothing itself.

## -FULL mode

`-Update -FULL` propagates the switch to both lanes. Step 1 runs `-UpdateSession -FULL` (rebuild SESSION from the full conversation, ignore the watermark, do not trust the prior snapshot). Step 2 runs `-UpdateMemory -FULL` (re-derive every Big-6 section against current evidence, re-walk LIFO from durable observations across the whole arc). Use when both halves of the surface have drifted - a long pause, a context switch, an interrupted prior pass. The routing decisions above are unchanged: graduated still skips the gate, the reconciliation gate still takes priority.

A mixed-mode run (one lane `-FULL`, the other default) is not supported here. Run the single lane standalone if that is what you need: `/321 -UpdateSession -FULL` or `/321 -UpdateMemory -FULL`.

## Rules

- **Route silently, graduated skips the gate.** A `graduated: true` project (the steady state) goes straight to the default chain - no gate read, no mention of reconciliation. Only a pre-graduation project reads `reconcile_pending`: set hands off to the reconciliation reference, off routes to the normal chain. The routing is never narrated either way.
- **Thin orchestrator.** No staging, no ops here - the lanes own their writes.
- **Order is fixed.** SESSION first (events), then MEMORY (the state events imply), so the memory lane distills against a fresh backbone.
- **Stop on a failed lane.** A failed SESSION commit halts the chain before MEMORY runs.
- **`-FULL` propagates to both lanes.** No mixed-mode runs from `-Update`.

## Deferred

The skills lane (reconciling a project's own custom `/321` skill bodies after migration) lands with `import-skills`. Until then, `-UpdateScraper` and other project-owned skill bodies stay manually authored.
