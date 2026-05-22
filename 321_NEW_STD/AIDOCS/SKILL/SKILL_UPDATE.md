---
name: update
description: The daily driver. Chains -SessionUpdate then -MemoryUpdate in one pass so SESSION and MEMORY both refresh from this conversation. The -Sync mode instead refreshes the engine itself from upstream, leaving project data untouched. A thin orchestrator - each lane owns its own logic and its own staging commit.
---

# /321 -Update

**Purpose:** Refresh the project's whole memory surface in one pass - SESSION (the event backbone) then MEMORY plus BACKLOG (the durable distillation). This is the flag to run at a checkpoint. It is a thin orchestrator: it invokes the two lane skills and relays their summaries, holding no logic of its own. The `-Sync` mode is the separate engine-self-update path.

## Modes

- **default** - the two-lane memory chain.
- **-Sync** - update the engine itself from upstream, project data untouched.

## The chain (default)

1. **Run `-SessionUpdate`.** Read `AIDOCS/SKILL/SKILL_SESSION-UPDATE.md` and execute it. SESSION lands first so the memory lane reads a current backbone. If it fails, stop and report - do not proceed to the memory lane on a failed session commit.

2. **Run `-MemoryUpdate`, skipping its Step 1.** Read `AIDOCS/SKILL/SKILL_MEMORY-UPDATE.md` and execute it, but skip its Step 1 auto-invoke of `-SessionUpdate` - this chain already ran it, and re-running would re-walk the conversation against an already-current SESSION. Begin the memory lane at its context-gather step.

Each lane stages and commits independently through the validate -> commit pipeline. `-Update` writes nothing itself.

## -Sync (engine self-update)

Keep the project's engine current with its upstream. This refreshes engine code, skills, and the router, never project data. Distinct from the `sync` engine command, which only rebuilds dispatch.

1. **Read the pointer.** Read `engine.version` and `engine.upstream` from `_index.json`. If `upstream` is empty, report "no upstream configured, nothing to sync" and stop. A project sets `upstream` to the repo it pulls its engine from.

2. **Fetch.**
   ```bash
   node AIDOCS/tools/engine.mjs fetch-engine --repo <engine.upstream>
   ```
   This lands the upstream engine in `INSTALL/engine`. Offline means a non-zero exit - report it and stop. The local engine keeps working.

3. **Compare.** Read `engine.version` from the fetched `INSTALL/engine/AIDOCS/_index.json`. Same as the local version means already current - clean up and stop. Newer means continue.

4. **Refresh engine-class files.** Copy from `INSTALL/engine` into the project, overwriting only the engine-class paths:
   - `AIDOCS/tools/` - the engine. `staging/` and `state.json` are gitignored and absent from a cloned source, so the project's own staging and watermarks survive.
   - `AIDOCS/SKILL/` - the skill bodies.
   - `.claude/skills/321/SKILL.md` - the router.

   Do NOT copy the data files (`<PROJECT>_*.md`), `_index.json`, `automemory/`, or `WDDOCS/` - those belong to the project. A graduated project (the `graduated` flag in `_index.json`) keeps `-Setup` deregistered - do not re-add its body. Then set `engine.version` in `_index.json` to the fetched version.

5. **Verify and clean up.**
   ```bash
   node AIDOCS/tools/engine.mjs sync
   node AIDOCS/tools/engine.mjs doctor
   ```
   Re-register skills, confirm the surface is clean, then remove `INSTALL/`.

## Rules

- **Thin orchestrator (default).** No staging, no ops here - the lanes own their writes.
- **Order is fixed.** SESSION first (events), then MEMORY (the state events imply), so the memory lane distills against a fresh backbone.
- **Stop on a failed lane.** A failed SESSION commit halts the chain before MEMORY runs.
- **-Sync touches only the engine.** Engine code, skills, and router refresh, never project data. Offline or no upstream is a clean no-op.
- **Upstream owns the version.** The project pulls, it does not invent.

## Deferred (land when their engine does)

The `-FULL` mode pass-through (flowing to each lane) and the post-migration **reconciliation gate** (the gated distillation pass that turns a raw migration import into steady state) are not yet built - they arrive with update modes and the lifecycle phase. For `-Sync`, customization preservation (keeping a project's edited skill body across a refresh) and a real version-compare plus upgrade-migration path land with the customizations manifest and a published upstream.
