---
name: update
description: The daily driver. Chains -SessionUpdate then -MemoryUpdate in one pass so SESSION and MEMORY both refresh from this conversation. The -Sync mode instead refreshes the engine itself from upstream, leaving project data untouched. A thin orchestrator on a routine run - each lane owns its own logic and its own staging commit. When the post-migration reconcile gate is set, the default run instead distills the raw capture into steady state and graduates.
---

# /321 -Update

**Purpose:** Refresh the project's whole memory surface in one pass - SESSION (the event backbone) then MEMORY plus BACKLOG (the durable distillation). This is the flag to run at a checkpoint. It is a thin orchestrator: it invokes the two lane skills and relays their summaries, holding no logic of its own. The `-Sync` mode is the separate engine-self-update path.

## Modes

- **default** - the two-lane memory chain.
- **reconciliation** - gate-triggered, not a flag. When the post-migration `reconcile_pending` gate is set, the default invocation runs the reconciliation pass instead of the chain.
- **-Sync** - update the engine itself from upstream, project data untouched.

## Reconciliation pass (post-migration gate)

Read the gate before anything else: `node AIDOCS/tools/engine.mjs state`. The `reconcile_pending` field is the Setup-to-Update handoff. A migration (`/321 -Setup`) captures the prior project additively and stops, setting this gate. Reconciliation is the distillation Setup deferred, and this pass is where it happens.

- **`reconcile_pending: true`** - this run is the reconciliation pass. Announce it ("Post-migration reconciliation - distilling the raw capture."), then follow this section instead of the default chain.
- **`reconcile_pending: false` (or absent)** - the normal chain. Do not mention the gate. Proceed to The chain (default) silently. The gate is plumbing, not something to narrate on a routine update.

**What the capture looks like.** Setup captured the archived project through the normal skills with the gate holding auto-prune, so the lanes are additive: over cap, often over-split (several entries where one would do), and cross-source duplicated (the same fact from more than one swept doc). It is already in house format - `[+]` bullets paired with `### sub-section` headings, no dates, no import markers - so the job is to distill, not to clean up an import.

**Distillation (the AI lane).** Treat the canonical scan of the project as the source of truth and the captured content as supplemental. Reshape the additive raw into a steady state:

- **Merge** the entries that cover one thing into a single one, keeping the clearest wording.
- **Drop** exact duplicates and entries whose code no longer exists.
- **Rewrite** any raw or over-long `[+]` headline into a descriptive bullet whose text matches its `### heading`. The engine slugifies the bullet text to resolve the anchor, so the two must read the same.
- **Bring both lanes under cap by judgment**, not by leaning on auto-prune, which drops the bottom-most rather than the least valuable. Re-merging loses nothing, it reshapes the additive raw into a curated steady state.
- **Sweep BACKLOG** against the restored `WDDOCS` (`RELEASES/`, `DESIGN/`, and the rest).
- **Sort migration content to the bottom** of each LIFO. Captured history is older than the project's live history, so it sits below it. Routine updates after the migration land on top as usual.

Distill both EXTENDED lanes evenly - `SESSION_EXTENDED` carries the same over-split as `MEMORY_EXTENDED`, so give it the same sweep. Hold entries to about ten lines unless one is genuinely important, give a `MEMORY_EXTENDED` entry a `Decision:` line where there is a resolution, and keep every filled Big-6 `### <Section> Decisions` sub-section present.

**Mechanism: direct curated edits, doctor as the gate.** A wholesale reshape (dozens of sub-sections down to a handful) is far more reliable authored directly than as hundreds of staging ops, since the staging pipeline is built for incremental bullets, not a full reshape. Edit `MEMORY`, `MEMORY_EXTENDED`, `SESSION`, `SESSION_EXTENDED`, and `BACKLOG` directly, then verify with `node AIDOCS/tools/engine.mjs doctor`. Doctor gates the structural shape and the house voice (registry, memory and session shape, banned prose). The cap, orphan-pairing, and dedup targets below ride `commit`, which a direct-edit reshape bypasses, so verify those yourself before clearing the gate. Bullet-shaped odds and ends (a BACKLOG sweep, a single Big-6 touch-up) can still ride the staging pipeline where that is cleaner, keeping the orphan and cap checks. This is the one sanctioned exception to "everything routes through staging," and it applies only to the gated reconciliation pass, never to a routine update.

**Acceptance checks (the reconciled steady state).** A capable pass meets these naturally. They give a lighter pass concrete targets:

1. **Both lanes are under cap.** MEMORY and SESSION LIFO sit at or below their `_index.json` `sizes` cap, reached by merge and drop, not by auto-prune.
2. **Every `[+]` bullet is clean prose** matching its `### heading`, so the slugified anchor resolves. No raw or over-long headlines.
3. **EXTENDED carries one sub-section per surviving `[+]` bullet** - no orphans, no over-split leftovers. Verify directly, since the commit orphan check does not run on a direct-edit reshape.
4. **Cross-source duplicates are merged** into one entry. This is judgment, so whenever the capture drew from more than the canonical files, scan for repeats.
5. **Migration content sits at the bottom** of each LIFO, below live project history.

**Close the pass.** When doctor is clean:

```bash
node AIDOCS/tools/engine.mjs state --clear-reconcile
```

This clears the gate and stamps both lane watermarks current (the direct-edit reshape bypassed `commit`, which would otherwise stamp them). If doctor does not pass, leave the gate set so the next `/321 -Update` resumes the reconciliation. Then run Phase 2 below.

## Phase 2: Graduate (onboarding teardown)

Runs only after reconciliation verifies - the gate is cleared and doctor is clean. The project is steady, so tear down the onboarding tier it no longer needs:

```bash
node AIDOCS/tools/engine.mjs graduate
node AIDOCS/tools/engine.mjs sync
node AIDOCS/tools/engine.mjs doctor
```

`graduate` deregisters `-Setup` (drops its body and dispatch entry), removes `INSTALL/`, and marks the project `graduated` so a later `-Update -Sync` does not re-add `-Setup`. It refuses while `reconcile_pending` is set, so a project never loses its onboarding tier before it has distilled. `sync` rebuilds dispatch without `-Setup`, and `doctor` confirms the steady surface is clean. The onboarding lib modules `init` laid stay in place, inert without `INSTALL/` and `-Setup` (the `--root` model carries no engine carve).

After this the project carries no onboarding machinery. The `<PROJECT>_SETUP_ARCHIVE/` holds project content that is not re-fetchable, so deleting it stays the user's separate call.

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

- **Reconciliation gate first, silent when off.** Read `reconcile_pending` before the chain. Set means this run is the post-migration reconciliation pass (direct-edit distillation, clear the gate, then graduate). Off means the normal chain, never mention the gate.
- **Thin orchestrator (default).** No staging, no ops here - the lanes own their writes.
- **Order is fixed.** SESSION first (events), then MEMORY (the state events imply), so the memory lane distills against a fresh backbone.
- **Stop on a failed lane.** A failed SESSION commit halts the chain before MEMORY runs.
- **-Sync touches only the engine.** Engine code, skills, and router refresh, never project data. Offline or no upstream is a clean no-op.
- **Upstream owns the version.** The project pulls, it does not invent.

## Deferred (land when their engine does)

The `-FULL` mode pass-through (flowing to each lane on a routine run) is not yet built - it arrives with the update modes. The reconciliation pass above distills the core lanes (SESSION / MEMORY / BACKLOG and their EXTENDED) - its skills, AGENTS / CLAUDE, and DEV-AUDIT lanes land with `import-skills` and the lossless capture. For `-Sync`, customization preservation (keeping a project's edited skill body across a refresh) and a real version-compare plus upgrade-migration path land with the customizations manifest and a published upstream.
