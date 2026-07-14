# UPDATE reconciliation reference

**Purpose:** The post-migration reconciliation pass that `/321 -Update` routes to when `reconcile_pending: true`. The skill body stays lean - the substance lives here. A one-time pass per project's lifetime: capture-to-steady-state distillation, then graduate. Routine updates never load this file.

## When this runs

`/321 -Update` reads the state gate once. `reconcile_pending: true` on a pre-graduation project routes here. A `graduated: true` project skips the gate read entirely and runs the default chain - the reconciliation here cannot apply again.

Announce the pass once ("Post-migration reconciliation - distilling the raw capture."), then follow the sections in order. Default chain rules do not apply here - this pass is direct curated edits, gated by doctor.

## Roles: AI leads, scripts back it, the AI verifies

Reconcile is the high-judgment phase, the inverse of install and setup. The AI owns the calls a script cannot make - which captured bullets still matter, how each lane is finally shaped, what folds where. The scripts own the mechanical backend: `migrate-import --audit` diffs the archive against the distilled result, `doctor` gates structure and house-voice, `commit` applies any staged odds-and-ends, `graduate` tears the tier down. The close is an explicit AI verification (the acceptance checks plus the archive-alignment walk below), so nothing the capture held is dropped without a decision. The backstop: with no AI, none of this runs and the capture stays parked at the gate, losslessly, until an AI session distills it.

## What the capture looks like

Setup captured the prior project additively with the gate holding auto-prune, so every lane is over cap, often over-split (several entries where one would do), and cross-source duplicated (the same fact from more than one swept doc). The depth lanes carry one extra layer: `migrate-import` scavenged the archived EXTENDED files 1:1, so they hold import residue - code blocks elided to a marker, the odd positional `(import N)` title where a heading had no slug-able text, `(N)` suffixes on repeated titles, and any structureless doc imported as a single blob. Everything is in house format (`[+]` bullets paired with `### sub-section` headings, no dates), so the job is to distill the over-capture and resolve that residue together.

**Fresh-existing fast-path.** The above describes a project with real accumulated state. On a never-used-321 project (a clean existing codebase onboarded through migration), the archived 321 docs are empty scaffolds, so the EXTENDED lanes import nothing (`migrate-import` no-ops on the placeholder) and the import-residue, over-split, and cross-source-dedup work below is all no-op. The pass then reduces to filling the Big 6 from the code scan, capturing this session's events, and folding the archived AGENTS / CLAUDE plus any swept design docs. Read the rest for the lanes that do apply, but do not hunt for residue a fresh-existing capture never produced.

The archive carries a `MANIFEST.json` (`AIDOCS/<PROJECT>_SETUP_ARCHIVE/MANIFEST.json`) recording each moved path with its detected role (`memory_extended`, `session_extended`, `dev_standards`, `root_doc`, `registry`, `automemory_seed`, `wddocs`, `legacy_skills`, etc), the source project's prefix, and any legacy-naming variant (a `SESSION_HANDOFF` infix, a `DEV_STANDARDS` underscore). The reconcile pass and the audit commands below read it instead of re-deriving from filenames. A pre-engine project that predates the manifest will not have one, and the bullets below note the fall-back when that happens.

## Before you distill (what to load)

Read these in one sweep so the distillation has the full picture without a project tour. Order is by leverage, not strict.

1. **Both lanes' current state** - `<PROJECT>_MEMORY.md`, `<PROJECT>_MEMORY_EXTENDED.md`, `<PROJECT>_SESSION.md`, `<PROJECT>_SESSION_EXTENDED.md`, `<PROJECT>_BACKLOG.md`. The post-capture, pre-reconcile shape the pass reshapes.
2. **The lane caps** - `_index.json` `sizes` block. Each lane's gating cap, plus the advisory sub-section budgets.
3. **The archive subtree** - `AIDOCS/<PROJECT>_SETUP_ARCHIVE/` end to end. Root docs, AIDOCS data + skill snapshot + automemory seed snapshot, external runtime snapshot, WDDOCS, swept files. The archive is what the close walk audits against.
4. **Auto-memory current state and seed** - `auto_memory.path` directory contents (the runtime), plus `AIDOCS/automemory/` (the seed). The merge below compares both against the snapshots.
5. **Canonical orchestrator state** - `AGENTS.md`, `CLAUDE.md`. The post-install lean skeleton the lanes fold archived content back into.
6. **The capture's source-of-truth scan** - the project's actual code, configs, package.json, build files. The canonical that drives every "drop the duplicate, keep the divergence" call.

## Distillation (the AI lane)

Treat the canonical scan of the project as the source of truth and the captured content as supplemental. Reshape the additive raw into a steady state:

- **Resolve the import residue first.** Replace every elided-code marker with a one-line prose takeaway, rename the positional `(import N)` titles, merge the `(N)` duplicates, and re-split any blob entry into real sub-sections. `doctor` warns while an elided marker survives, so the gate holds until they are all gone.
- **Merge** the entries that cover one thing into a single one, keeping the clearest wording.
- **Drop** exact duplicates and entries whose code no longer exists.
- **Rewrite** any raw or over-long `[+]` headline into a descriptive bullet whose text matches its `### heading`. The engine slugifies the bullet text to resolve the anchor, so the two must read the same.
- **Bring both lanes under cap by judgment**, not by leaning on auto-prune, which drops the bottom-most rather than the least valuable. Re-merging loses nothing, it reshapes the additive raw into a curated steady state.
- **Sweep BACKLOG.** `migrate-restore` carried the archived Features + Ideas in verbatim - dedupe and prune that real content against the restored `WDDOCS` (`RELEASES/`, `DESIGN/`, and the rest). A non-321 source carries no BACKLOG, so there it is derived from `WDDOCS` instead.
- **Sort migration content to the bottom** of each LIFO. Captured history is older than the project's live history, so it sits below it. Routine updates after the migration land on top as usual.
- **Refresh SESSION Current State.** The capture wrote it before this pass, so it still describes the project as awaiting reconcile (the gate, the "run `/321 -Update`" note). Rewrite it to the reconciled, steady reality - the project is migrated and about to graduate, not parked at the gate.
- **Capture this session's own events too.** The first reconcile after install is also the first time the install + setup + reconcile session's own events can land in LIFO. Add them at the top of each lane the same way a routine `-Update` would, above the migration content that sorts to the bottom. The pass is both a distillation of the captured archive and a normal capture of the conversation that ran it.

Distill both EXTENDED lanes evenly - `SESSION_EXTENDED` carries the same over-split as `MEMORY_EXTENDED`, so give it the same sweep. **Body length cap: target 3-6 non-blank body lines per entry (normal), soft cap 10 (critical that earns the depth).** Doctor warns at >10 body lines per entry, and a genuinely load-bearing entry (a catalog, an exception list) marks itself `<!-- LOAD_BEARING -->` to opt out of the cap forever. Give a `MEMORY_EXTENDED` entry a `Decision:` line where there is a resolution.

## Mechanism: direct curated edits, doctor as the gate

A wholesale reshape (dozens of sub-sections down to a handful) is far more reliable authored directly than as hundreds of staging ops, since the staging pipeline is built for incremental bullets, not a full reshape. Edit `MEMORY`, `MEMORY_EXTENDED`, `SESSION`, `SESSION_EXTENDED`, and `BACKLOG` directly, then verify with `node AIDOCS/tools/engine.mjs doctor`. The hardened doctor is the mechanical gate: it fails (errors) on a broken `[+]`/`### ` pair and on the shape and house-voice checks (registry, memory and session shape, auto-memory pointers, banned prose), and it warns while a lane is over cap or an elided-import marker survives. Those over-cap and import-residue warnings are the reconcile targets - clearing them is the signal the distillation is done. WDDOCS is user authorship and outside doctor's prose scan entirely, so nothing there holds the pass. Cross-source dedup and migration-content ordering are judgment doctor cannot see, so verify those by eye. Bullet-shaped odds and ends (a BACKLOG sweep, a single Big-6 touch-up) can still ride the staging pipeline where that is cleaner, keeping the orphan and cap checks. This is the one sanctioned exception to "everything routes through staging," and it applies only to the gated reconciliation pass, never to a routine update.

**Two kinds of cap, do not conflate them.** The `_index.json` `sizes` block carries two thresholds per lane. The **lane cap** (`updatememory.memory.cap`, `updatesession.session.cap`, and their `_extended` counterparts) gates closure. The **sub-section budget** (`subsections` on each lane) is advisory, a hint that summary may help on an oversize entry. Doctor reports both as warnings, but only the lane cap is a reconcile target. A genuinely load-bearing sub-section (a catalog, an exception list) marked with `<!-- LOAD_BEARING -->` rides the budget warning forever, on purpose. Distilling it just to clear the hint would lose the content.

## Auto-memory merge (Claude's native memory is the source of truth)

Auto-memory lives in Claude Code's native external memory (`auto_memory.path`, loaded by the harness each session), seeded by `init` from the in-repo seed (`auto_memory.seed` = `AIDOCS/automemory`). Setup snapshotted the project's prior external memory into `<PROJECT>_SETUP_ARCHIVE/external-automemory` (and any scattered memory-like files the sweep routed in). This pass reconciles the external memory against that snapshot - the one sanctioned write to auto-memory (routine `-UpdateMemory` never touches it), scoped to this gated pass.

The file-prefix taxonomy and the seed-vs-runtime split are stated once in `AIDOCS/tools/PATTERN-AUTOMEMORY.md`. Load it on first reconcile or whenever the prefix system is unclear, the bullets below assume it.

- **Keep the user profile, replace the seed placeholder.** A filled `user_<name>.md` in the runtime is project data, not a canonical rule. The decision rule: if the seed still carries `user_name.md` (the placeholder) and the runtime carries a filled `user_<name>.md`, replace the seed file with the filled body and rename it to match, so a fresh-machine install restores the filled profile. The rename reaches the runtime too, not just the seed: rename the copy at `auto_memory.path` and update its `MEMORY.md` index entry to the filled filename. `user_*.md` is project-owned, so `upgrade` never touches it afterwards. If neither the runtime nor the snapshot carries a filled profile (a wipe predated both), the reconcile AI may reconstruct a minimal profile from project identity (`git config user.name`, the repo remote, the user's role on the project) and write `user_<name>.md` directly, or leave the placeholder for the user to fill on the next pass - judgment call, not a script step.
- **The shared rules refresh mechanically now. Do not hand-merge them.** `upgrade` force-copies the seed's shared rule files from upstream and mirrors them into the runtime, so the canonical wording lands without a reconcile step. **A project that believes its variant of a shared rule is right does not keep it locally** - the next sync reverts it and restarts the drift. Land the fix upstream instead. The pre-upgrade snapshot in `TEMP/` and the `SETUP_ARCHIVE` snapshot are the recovery nets if a body needs recovering.
- **Promote durable project rules to the seed.** A `project_*` rule that lives only in the runtime is a missed promotion - a fresh-machine install would lose it. Copy each runtime-only `project_*` into the seed so the next install restores it.
- **Weigh each snapshotted rule against the canonical set, default drop.** If a canonical rule already covers the point, drop it. A genuinely-uncovered one becomes **its own new rule file**, never an addendum inside a shared rule - there is no addenda seam, and text appended inside a canonical body is destroyed by the next force-copy. If it finds no home, drop it.
- **AGENTS carries a POINTER, not a mirror.** The rules load from the runtime, so `AGENTS.md` names the rule index (`AIDOCS/automemory/MEMORY.md`) for agents that cannot load native memory, and does not restate the inventory. Doctor's mirror check is opt-in (`auto_memory.agents_mirror: true`) and off by default. A dangling AGENTS link to a rule file that does not exist is always reported.

## Config docs lane (DEV-AUDIT, AUTO-PUSH, CHANGELOG)

`migrate-restore` copied these back verbatim at setup, normalized for legacy tokens and the project rename. This pass finalizes each by direct edit:

- **DEV-AUDIT `## Project specifics`.** Walk each restored entry against the canonical baseline above the `---` (the split, anchor principles, contracts, sanctioned exceptions, audit dimensions, which `init` writes identically everywhere). Drop what duplicates the baseline, restates MEMORY (MEMORY owns codebase-identity rules), or **restates an auto-memory rule** (auto-memory owns how you write, this file owns what the project contracts to, and a rule lives in exactly one of them). Keep what is genuinely project-specific (build / lint commands, language version, framework gotchas) or extends the baseline, surface contradictions. A deliberate choice the audit keeps re-flagging belongs under `## Sanctioned exceptions`, not in a comment. Never touch the baseline above the divider.
- **AUTO-PUSH `## Project release steps`.** Confirm the restored steps are the project's real cycle (version bump, CHANGELOG, build, deploy / publish), dropping generic restatement the baseline already covers. When nothing real was restored (only generic boilerplate, or a non-321 source with no AUTO-PUSH doc), derive the steps from any of: real shell scripts under `scripts/` (a `push-live.sh` / `release.sh` / `deploy.sh` often encodes the actual pipeline - **prefer this when present, it is the live truth**), the archived release skill body (`<PROJECT>_SETUP_ARCHIVE/AIDOCS/SKILL/SKILL_AUTO-PUSH.md`, see the skill-body fold below), the CHANGELOG history, and the build config. Leave the placeholder when there is no signal. When both `scripts/` and the legacy skill body describe the same pipeline (a common case), the `scripts/` version is authoritative - read the skill body only to confirm the script is current, not to derive new steps.
- **DEV-AUDIT legacy source.** A pre-engine project archived its standards as `<OLD>_DEV_STANDARDS.md` (legacy underscore form) or `<OLD>_DEV-STANDARDS.md` (legacy hyphen form, the more common pre-engine 321 shape) rather than the canonical `<NEW>_DEV-AUDIT.md`. The MANIFEST records both as `role: dev_standards` with `legacy_naming` set to whichever form was found. Use that entry as the source for the `## Project specifics` fill above when no restored entry covers a convention. Same fold rule: project-specific only, never duplicate the baseline.
- **CHANGELOG.** Voice-scrub to house style (`scrub --fix`) and confirm the canonical structure. Invent no entries - AutoPush owns CHANGELOG composition at release, this pass only reformats what migrated. The canonical empty state (a header plus the unreleased anchor, no entries) is the expected shape on a project that has not yet shipped a release through AutoPush, so an empty file passes without action. When updating renamed skill-token refs (an old `/lift321-web -MemoryUpdate` to current `/321 -UpdateMemory`), leave dated `## [x.y.z]` version blocks untouched (history, what shipped at the time) and update only the unreleased / current-process sections.

## Skill-body fold (legacy in-place customizations)

`migrate-archive` snapshots `AIDOCS/SKILL` into `<PROJECT>_SETUP_ARCHIVE/AIDOCS/SKILL` (the snapshot of the canonical state) and sweeps any pre-engine `AIDOCS/SKILLS/` (plural) into `<PROJECT>_SETUP_ARCHIVE/AIDOCS/SKILLS_legacy/` (the snapshot of the legacy target-first state). Diff each archived body against the freshly-laid canonical (`AIDOCS/SKILL/SKILL_<NAME>.md`) - an identical body is a no-op, the common case. A legacy project (the pre-data-doc model) may have edited a skill body in place. Fold that project-specific content into its data doc, never back into the engine body, which an engine update reverts. The prime case is `SKILL_AUTO-PUSH.md` - lift the real release pipeline into `<PROJECT>_AUTO-PUSH.md` `## Project release steps` (the AUTO-PUSH lane above). Surface any divergence that is genuine skill logic rather than data for the user to decide.

For a pre-engine archive in `SKILLS_legacy/`, map each legacy body to its canonical counterpart using the table in `AIDOCS/tools/PATTERN-SKILL.md` (Legacy to canonical mapping). The fold rule is the same: data into the canonical body's data doc, not back into the engine body. A legacy body the table does not cover is a project-custom skill the user named themselves.

## AGENTS / CLAUDE classification lane

`migrate-archive` set the archived orchestrator files aside and `init` wrote the lean canonical skeleton over them. Fold each archived block into its right home, keeping `AGENTS.md` a lean index. Cold-start orientation, read-order, and the auto-memory pointer stay in the canonical `AGENTS.md`. **An archived Hard-rules block does NOT come back** - the rules live in auto-memory and AGENTS points at the index rather than copying it. On a doc-heavy project (a substantial `WDDOCS/` design corpus), a MEMORY-first cold-start under-serves: add the design corpus as an optional load-order item in AGENTS and point the Big-6 sections into it, so a fresh session finds the real orientation rather than a thin MEMORY. Project conventions and durable architecture go to `<PROJECT>_MEMORY.md`. Code-applicable rules go to `<PROJECT>_DEV-AUDIT.md` `## Project specifics`. AGENTS keeps its own short `## Project Specifics` for the few cold-start must-knows a session needs before it reads anything else - a forever-fixed bundle ID, a hard "never run X" gate. The decision rule: a rule belongs in `AGENTS.md ## Project Specifics` when a fresh session needs it in the FIRST tool call and violating it is silent (no doctor catch, no runtime error). A convention DEV-AUDIT can catch on the next pass belongs in MEMORY or DEV-AUDIT, not here. This is a bounded visibility surface: the full convention lives once in MEMORY or DEV-AUDIT and AGENTS carries the one-line flag, so the brief overlap is by design, not drift to reconcile away. Keep it to a handful, never a second copy of DEV-AUDIT. A duplicate of the canonical skeleton drops, and a contradiction surfaces for the user. `CLAUDE.md` stays the `@AGENTS.md` pointer - route any substantive archived CLAUDE content the same way.

These lanes are direct curated edits gated by doctor, the same mechanism as the distillation. Routine (non-gated) updates touch none of them.

## Project rename (instance name vs codebase identity)

When the migration took a `--name` different from the prior name, two things are renamed differently - keep them separate. The **321 instance name** (the data-doc prefix and prose mentions) is renamed to the new name: the capture's normalize did the mechanical pass, so just confirm the reconciled docs read consistently as the new name with no stale doc-refs to the old one. The **codebase identity** (repo and remote URL, branch convention, bundle and package IDs, env-var and code-constant names) is left as it was, on purpose - it is the project's real identity, not the 321 instance name, and rewriting it would break the build. Surface that split rather than acting on it: list where the old name still lives as a real identifier (`package.json` name, the bundle IDs, the repo / remote, the branch convention, ENV doc names, code constants) so the user can decide. A genuine full rename of the codebase is a separate, deliberate code-level change the user drives, not something the reconcile attempts. When the names match (the common re-onboard), there is nothing to separate.

## Acceptance checks (the reconciled steady state)

A capable pass meets these naturally. They give a lighter pass concrete targets:

1. **Both lanes are under cap.** MEMORY and SESSION LIFO sit at or below their `_index.json` `sizes` cap, reached by merge and drop, not by auto-prune.
2. **Every `[+]` bullet is clean prose** matching its `### heading`, so the slugified anchor resolves. No raw or over-long headlines.
3. **EXTENDED carries one sub-section per surviving `[+]` bullet** - no orphans, no over-split leftovers. Doctor's orphan-pairs check is an error, so a clean doctor confirms the pairing survived the reshape.
4. **No import residue.** Every elided-code marker is resolved to prose, no `(import N)` or `(N)` titles remain, and no blob entry is left unsplit. Doctor warns on a surviving marker.
5. **Cross-source duplicates are merged** into one entry. This is judgment, so whenever the capture drew from more than the canonical files, scan for repeats.
6. **Migration content sits at the bottom** of each LIFO, below live project history.
7. **Auto-memory is canonical plus the kept profile** - shared rules at their upstream wording (the copy step handles this, do not hand-merge), a genuinely-uncovered rule stands as its own file rather than an addendum inside a canonical one, and the profile is filled and renamed.
8. **Config docs are reconciled.** DEV-AUDIT Project specifics deduped against the baseline, AUTO-PUSH release steps are the project's real cycle (or on placeholder when there is no signal), CHANGELOG in house voice.
9. **AGENTS stays lean.** Archived orchestrator content folded into MEMORY / DEV-AUDIT, no routed block bloating the index, and no restored Hard-rules block (AGENTS points at the auto-memory index, it does not copy it).
10. **Every filled Big-6 section carries its rationale inline.** MEMORY holds the Big 6 with the why woven into each section, not as a separate sub-section (EXTENDED is LIFO depth only, no Big-6 mirror). This is a confirm pass - a filled Overview / Stack / Architecture / Environment / Pipeline / Conventions that gives the what without the why gets the rationale folded in, so the two travel together. Doctor does not gate this, so check it by eye.

## Close the pass

First audit each distilled lane against its archive - the verify of what took and what did not. Point `--audit` at the archive - the `--from-archive` mode reads `MANIFEST.json` and resolves the right `--from` / `--old` / `--new` for the skill, so the AI does not hand-walk legacy naming variants:

```bash
node AIDOCS/tools/engine.mjs migrate-import --from-archive AIDOCS/<PROJECT>_SETUP_ARCHIVE --skill updatesession --audit
node AIDOCS/tools/engine.mjs migrate-import --from-archive AIDOCS/<PROJECT>_SETUP_ARCHIVE --skill updatememory  --audit
```

Each run lists the archived entries with no surviving `### sub-section` and surfaces fuzzy candidates for any that look like a merged / rewritten survivor (a trimmed headline, a partial rewrite). Confirm every one is a deliberate merge or drop, not a lost entry, and re-derive any that should have stayed. A pre-engine archive with no `MANIFEST.json` (no manifest support at the time it was archived) falls back to the explicit form: `--from AIDOCS/<PROJECT>_SETUP_ARCHIVE/AIDOCS/<OLD>_SESSION_EXTENDED.md --skill updatesession --old <OLD> --new <PROJECT> --audit` and similarly for the memory lane.

Then run the full **archive-alignment check**: walk `AIDOCS/<PROJECT>_SETUP_ARCHIVE/` and confirm every archived source is accounted for - landed in the live structure or deliberately dropped. The `--audit` above covers the SESSION / MEMORY EXTENDED lanes mechanically. For the config docs, CHANGELOG, the archived AGENTS / CLAUDE, the archived skill snapshot, and any swept docs, confirm each by eye against the lanes above. A source that is neither reflected nor consciously dropped means the pass is unfinished - resolve it before clearing.

Once doctor's errors are zero and its reconcile warnings are cleared (no import residue, every lane under cap), and the archive is accounted for:

```bash
node AIDOCS/tools/engine.mjs state --clear-reconcile
```

This clears the gate and stamps both lane watermarks current (the direct-edit reshape bypassed `commit`, which would otherwise stamp them). If doctor still reports a reconcile warning (a surviving import marker or an over-cap lane) or an error, or an audit surfaces a lost entry, leave the gate set so the next `/321 -Update` resumes the reconciliation. Then run the graduation steps below.

## Graduate (onboarding teardown)

Runs only after reconciliation verifies - the gate is cleared and doctor's errors are zero. The project is steady, so tear down the onboarding tier it no longer needs:

```bash
node AIDOCS/tools/engine.mjs graduate
node AIDOCS/tools/engine.mjs sync
node AIDOCS/tools/engine.mjs doctor
```

`graduate` deregisters `-Setup` (drops its body and dispatch entry), removes `INSTALL/`, and marks the project `graduated` so a later `-UpdateSync` does not re-add `-Setup`. It refuses while `reconcile_pending` is set, so a project never loses its onboarding tier before it has distilled. `sync` rebuilds dispatch without `-Setup`, and `doctor` confirms the steady surface is clean. The onboarding lib modules `init` laid stay in place, unused once `INSTALL/` and `-Setup` are gone - no skill invokes them after graduation (the `--root` model carries no engine carve).

**Confirm the router quick-ref.** `graduate` itself reconciles the router prose (it drops any quick-ref line whose flag has no matching `SKILL_*.md` body, so the deregistered `-Setup` is removed in the same pass). Confirm visually that `.claude/skills/321/SKILL.md` shows no `-Setup` line and every registered skill is listed. If something looks off, the reconciler is idempotent - re-run it via the next upgrade (or hand-edit the router).

After this the project carries no onboarding machinery. The `<PROJECT>_SETUP_ARCHIVE/` holds project content that is not re-fetchable, so deleting it stays the user's separate call.
