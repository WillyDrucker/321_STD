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

**Roles (AI leads, the scripts back it, the AI verifies).** Reconcile is the high-judgment phase, the inverse of install and setup. The AI owns the calls a script cannot make - which captured bullets still matter, how each lane is finally shaped, what folds where. The scripts own the mechanical backend: `migrate-import --audit` diffs the archive against the distilled result, `doctor` gates structure and house-voice, `commit` applies any staged odds-and-ends, `graduate` tears the tier down. The close is an explicit AI verification (the acceptance checks plus the archive-alignment walk below), so nothing the capture held is dropped without a decision. The backstop: with no AI, none of this runs and the capture stays parked at the gate, losslessly, until an AI session distills it.

**What the capture looks like.** Setup captured the prior project additively with the gate holding auto-prune, so every lane is over cap, often over-split (several entries where one would do), and cross-source duplicated (the same fact from more than one swept doc). The depth lanes carry one extra layer: `migrate-import` scavenged the archived EXTENDED files 1:1, so they hold import residue - code blocks elided to a marker, the odd positional `(import N)` title where a heading had no slug-able text, `(N)` suffixes on repeated titles, and any structureless doc imported as a single blob. Everything is in house format (`[+]` bullets paired with `### sub-section` headings, no dates), so the job is to distill the over-capture and resolve that residue together.

**Distillation (the AI lane).** Treat the canonical scan of the project as the source of truth and the captured content as supplemental. Reshape the additive raw into a steady state:

- **Resolve the import residue first.** Replace every elided-code marker with a one-line prose takeaway, rename the positional `(import N)` titles, merge the `(N)` duplicates, and re-split any blob entry into real sub-sections. `doctor` warns while an elided marker survives, so the gate holds until they are all gone.
- **Merge** the entries that cover one thing into a single one, keeping the clearest wording.
- **Drop** exact duplicates and entries whose code no longer exists.
- **Rewrite** any raw or over-long `[+]` headline into a descriptive bullet whose text matches its `### heading`. The engine slugifies the bullet text to resolve the anchor, so the two must read the same.
- **Bring both lanes under cap by judgment**, not by leaning on auto-prune, which drops the bottom-most rather than the least valuable. Re-merging loses nothing, it reshapes the additive raw into a curated steady state.
- **Sweep BACKLOG** against the restored `WDDOCS` (`RELEASES/`, `DESIGN/`, and the rest).
- **Sort migration content to the bottom** of each LIFO. Captured history is older than the project's live history, so it sits below it. Routine updates after the migration land on top as usual.
- **Refresh SESSION Current State.** The capture wrote it before this pass, so it still describes the project as awaiting reconcile (the gate, the "run `/321 -Update`" note). Rewrite it to the reconciled, steady reality - the project is migrated and about to graduate, not parked at the gate.

Distill both EXTENDED lanes evenly - `SESSION_EXTENDED` carries the same over-split as `MEMORY_EXTENDED`, so give it the same sweep. Hold entries to about ten lines unless one is genuinely important, and give a `MEMORY_EXTENDED` entry a `Decision:` line where there is a resolution.

**Mechanism: direct curated edits, doctor as the gate.** A wholesale reshape (dozens of sub-sections down to a handful) is far more reliable authored directly than as hundreds of staging ops, since the staging pipeline is built for incremental bullets, not a full reshape. Edit `MEMORY`, `MEMORY_EXTENDED`, `SESSION`, `SESSION_EXTENDED`, and `BACKLOG` directly, then verify with `node AIDOCS/tools/engine.mjs doctor`. The hardened doctor is the mechanical gate: it fails (errors) on a broken `[+]`/`### ` pair and on the shape and house-voice checks (registry, memory and session shape, auto-memory pointers, banned prose), and it warns while a lane is over cap or an elided-import marker survives. Those warnings are the reconcile targets - a fully clean doctor, zero warnings, is the signal the distillation is done. Cross-source dedup and migration-content ordering are judgment doctor cannot see, so verify those by eye. Bullet-shaped odds and ends (a BACKLOG sweep, a single Big-6 touch-up) can still ride the staging pipeline where that is cleaner, keeping the orphan and cap checks. This is the one sanctioned exception to "everything routes through staging," and it applies only to the gated reconciliation pass, never to a routine update.

**Auto-memory merge (the archived rules).** Setup archived the project's `AIDOCS/automemory` and routed any scattered memory-like files into the same archive, then laid the canonical rules fresh. This pass decides what, if anything, from the archive earns a place back, and the default is nothing. It is the one sanctioned write to auto-memory (routine `-MemoryUpdate` never touches it), scoped to this gated pass.

- **Keep the user profile.** A filled `user_*.md` is project data, not a canonical rule - restore it from the archive, drop the blank `user_name.md` template the reinstall laid, and point the AGENTS Hard-rules entry at the real filename (doctor checks the pointer both ways).
- **Weigh each archived or swept rule against the canonical set, default drop.** If a canonical rule already covers the point, drop it. Re-add only when the guidance is genuinely uncovered and earns its space, and then summarize it completely into an existing rule - never re-add a standalone rule file. If it finds no home, drop it.
- **Keep AGENTS and the pointers in sync.** Every auto-memory file the merge keeps or renames needs its matching AGENTS Hard-rules pointer in both directions, which `doctor` checks. The archived copy stays in `SETUP_ARCHIVE` as the recovery net.

**Config docs lane (DEV-AUDIT, AUTO-PUSH, CHANGELOG).** `migrate-restore` copied these back verbatim at setup, normalized for legacy tokens and the project rename. This pass finalizes each by direct edit:

- **DEV-AUDIT `## Project specifics`.** Walk each restored entry against the canonical baseline above the `---` (anchor principles, hard rules, audit dimensions, which `init` writes identically everywhere). Drop what duplicates the baseline or restates MEMORY (MEMORY owns codebase-identity rules), keep what is genuinely project-specific (build / lint commands, language version, framework gotchas) or extends the baseline, surface contradictions. Never touch the baseline above the divider.
- **AUTO-PUSH `## Project release steps`.** Confirm the restored steps are the project's real cycle (version bump, CHANGELOG, build, deploy / publish), dropping generic restatement the baseline already covers. When nothing was restored (a non-321 source had no AUTO-PUSH doc), derive the steps from the archived release skill body, the CHANGELOG, and the build config, or leave the placeholder when there is no signal.
- **CHANGELOG.** Voice-scrub to house style (`scrub --fix` rewrites em dashes and flags semicolons) and confirm the canonical structure. Invent no entries - AutoPush owns CHANGELOG composition at release, this pass only reformats what migrated.

**AGENTS / CLAUDE classification lane.** `migrate-archive` set the archived orchestrator files aside and `init` wrote the lean canonical skeleton over them. Fold each archived block into its right home, keeping `AGENTS.md` a lean index. Cold-start orientation, read-order, and Hard-rules pointers stay in the canonical `AGENTS.md`. Project conventions and durable architecture go to `<PROJECT>_MEMORY.md`. Code-applicable rules go to `<PROJECT>_DEV-AUDIT.md` `## Project specifics`. AGENTS keeps its own short `## Project Specifics` for the few cold-start must-knows a session needs before it reads anything else - a forever-fixed bundle ID, a hard "never run X" gate. This is a bounded visibility surface, like the Hard-rules copy: the full convention lives once in MEMORY or DEV-AUDIT and AGENTS carries the one-line flag, so the brief overlap is by design, not drift to reconcile away. Keep it to a handful, never a second copy of DEV-AUDIT. A duplicate of the canonical skeleton drops, and a contradiction surfaces for the user. `CLAUDE.md` stays the `@AGENTS.md` pointer - route any substantive archived CLAUDE content the same way. Doctor's auto-memory pointer check confirms the Hard-rules pointers still resolve.

These lanes are direct curated edits gated by doctor, the same mechanism as the distillation. Routine (non-gated) updates touch none of them.

**Project rename (instance name vs codebase identity).** When the migration took a `--name` different from the prior name, two things are renamed differently - keep them separate. The **321 instance name** (the data-doc prefix and prose mentions) is renamed to the new name: the capture's normalize did the mechanical pass, so just confirm the reconciled docs read consistently as the new name with no stale doc-refs to the old one. The **codebase identity** (repo and remote URL, branch convention, bundle and package IDs, env-var and code-constant names) is left as it was, on purpose - it is the project's real identity, not the 321 instance name, and rewriting it would break the build. Surface that split rather than acting on it: list where the old name still lives as a real identifier (`package.json` name, the bundle IDs, the repo / remote, the branch convention, ENV doc names, code constants) so the user can decide. A genuine full rename of the codebase is a separate, deliberate code-level change the user drives, not something the reconcile attempts. When the names match (the common re-onboard), there is nothing to separate.

**Acceptance checks (the reconciled steady state).** A capable pass meets these naturally. They give a lighter pass concrete targets:

1. **Both lanes are under cap.** MEMORY and SESSION LIFO sit at or below their `_index.json` `sizes` cap, reached by merge and drop, not by auto-prune.
2. **Every `[+]` bullet is clean prose** matching its `### heading`, so the slugified anchor resolves. No raw or over-long headlines.
3. **EXTENDED carries one sub-section per surviving `[+]` bullet** - no orphans, no over-split leftovers. Doctor's orphan-pairs check is an error, so a clean doctor confirms the pairing survived the reshape.
4. **No import residue.** Every elided-code marker is resolved to prose, no `(import N)` or `(N)` titles remain, and no blob entry is left unsplit. Doctor warns on a surviving marker.
5. **Cross-source duplicates are merged** into one entry. This is judgment, so whenever the capture drew from more than the canonical files, scan for repeats.
6. **Migration content sits at the bottom** of each LIFO, below live project history.
7. **Auto-memory is canonical plus the kept profile** - no re-added standalone rules, every pointer matched. Doctor's auto-memory check confirms the pointers both ways.
8. **Config docs are reconciled.** DEV-AUDIT Project specifics deduped against the baseline, AUTO-PUSH release steps are the project's real cycle (or on placeholder when there is no signal), CHANGELOG in house voice.
9. **AGENTS stays lean.** Archived orchestrator content folded into MEMORY / DEV-AUDIT, no routed block bloating the index, the Hard-rules pointers resolve (doctor confirms).
10. **Every filled Big-6 section carries its `### <Section> Decisions` sub-section.** The capture fills these, so this is a confirm pass - a filled Overview / Stack / Architecture / Environment / Pipeline / Conventions whose Decisions block is missing gets one (even "(none yet)"), so the why travels with the what. Doctor does not gate this, so check it by eye.

**Close the pass.** First audit each distilled lane against its archive - the verify of what took and what did not. Point `--audit` at the same archived EXTENDED Setup imported from:

```bash
node AIDOCS/tools/engine.mjs migrate-import --from AIDOCS/<PROJECT>_SETUP_ARCHIVE/AIDOCS/<OLD>_SESSION_EXTENDED.md --skill sessionupdate --audit
node AIDOCS/tools/engine.mjs migrate-import --from AIDOCS/<PROJECT>_SETUP_ARCHIVE/AIDOCS/<OLD>_MEMORY_EXTENDED.md  --skill memoryupdate  --audit
```

Each run lists the archived entries with no surviving `### sub-section`. Confirm every one is a deliberate merge or drop, not a lost entry, and re-derive any that should have stayed. (Add the same `--old <OLD> --new <PROJECT>` the import used if the project was renamed, so the archive titles normalize before the diff.)

Then run the full **archive-alignment check**: walk `AIDOCS/<PROJECT>_SETUP_ARCHIVE/` and confirm every archived source is accounted for - landed in the live structure or deliberately dropped. The `--audit` above covers the SESSION / MEMORY EXTENDED lanes mechanically. For the config docs, CHANGELOG, the archived AGENTS / CLAUDE, and any swept docs, confirm each by eye against the lanes above. A source that is neither reflected nor consciously dropped means the pass is unfinished - resolve it before clearing.

Once doctor is fully clean (zero warnings) and the archive is accounted for:

```bash
node AIDOCS/tools/engine.mjs state --clear-reconcile
```

This clears the gate and stamps both lane watermarks current (the direct-edit reshape bypassed `commit`, which would otherwise stamp them). If doctor still warns, or an audit surfaces a lost entry, leave the gate set so the next `/321 -Update` resumes the reconciliation. Then run Phase 2 below.

## Phase 2: Graduate (onboarding teardown)

Runs only after reconciliation verifies - the gate is cleared and doctor is clean. The project is steady, so tear down the onboarding tier it no longer needs:

```bash
node AIDOCS/tools/engine.mjs graduate
node AIDOCS/tools/engine.mjs sync
node AIDOCS/tools/engine.mjs doctor
```

`graduate` deregisters `-Setup` (drops its body and dispatch entry), removes `INSTALL/`, and marks the project `graduated` so a later `-Update -Sync` does not re-add `-Setup`. It refuses while `reconcile_pending` is set, so a project never loses its onboarding tier before it has distilled. `sync` rebuilds dispatch without `-Setup`, and `doctor` confirms the steady surface is clean. The onboarding lib modules `init` laid stay in place, unused once `INSTALL/` and `-Setup` are gone - no skill invokes them after graduation (the `--root` model carries no engine carve).

**Confirm the router quick-ref.** `sync` rewrites the `_index.json` registry but not the router prose, so verify they agree: every skill in `skills.dispatch` has a row in the `.claude/skills/321/SKILL.md` How-to-invoke / Registry block, and the deregistered `-Setup` no longer appears there. Edit the router by hand to close any drift, since nothing else does.

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

The `-FULL` mode pass-through (flowing to each lane on a routine run) is not yet built - it arrives with the update modes. The reconciliation pass above distills the core lanes (SESSION / MEMORY / BACKLOG and their EXTENDED), merges auto-memory, reconciles the config docs (DEV-AUDIT / AUTO-PUSH / CHANGELOG), and classifies the archived AGENTS / CLAUDE. The skills lane (a project's own `/321` skill bodies) lands with `import-skills`. For `-Sync`, customization preservation (keeping a project's edited skill body across a refresh) and a real version-compare plus upgrade-migration path land with the customizations manifest and a published upstream.
