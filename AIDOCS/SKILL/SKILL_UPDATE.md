---
name: update
description: Optimized chain of session-track + memory-track in one shared-context pass. Mode passes through. -FULL: SessionUpdate verifies project state, MemoryUpdate auto-applies Big 6 maintenance + promotion.
---

# /321 -Update

**Purpose:** Update both tracks in a single pass when the session moved both. Shares the conversation walk, context gather, and mode detection across the two lanes (vs naive sub-skill re-invocation which would pay 2x reads). This is the one intentional composition skill in the `/321` set: it reads the two lane bodies for their per-item allocation rules rather than restating them. Lane specs: `SKILL_SESSION-UPDATE.md` (session) and `SKILL_MEMORY-UPDATE.md` (memory + BACKLOG). Engine spec: `AIDOCS/tools/staging/SCHEMA.json` + `AIDOCS/tools/lib/README.md`.

**When to use which:**

- `/321 -SessionUpdate` - session-only checkpoint (memory hasn't moved)
- `/321 -MemoryUpdate` - memory is the primary focus (auto-chains SessionUpdate first as a precondition)
- `/321 -Update` - both tracks moved meaningfully and the run benefits from shared classification

## Reconciliation gate (post-migration)

Before anything else, read the gate: `node AIDOCS/tools/memory.mjs state`. The `reconcile_pending` field is the Setup -> Update handoff. A migration (`/321 -Setup`) captures the prior project as a lossless raw import and stops, setting this gate. Update is where the deferred distillation actually happens.

- **`reconcile_pending: true`** - this run is the reconciliation pass. Announce it ("Post-migration reconciliation - distilling the raw import."), force both lanes to `-FULL`, apply the reconciliation framing below, verify the reconciled files with `node AIDOCS/tools/memory.mjs doctor`, then clear the gate: `node AIDOCS/tools/memory.mjs state --clear-reconcile`. If reconciliation does not verify clean, leave the gate set so the next `/321 -Update` resumes it.
- **`reconcile_pending: false` (or the field absent)** - normal chain. **Do not mention the gate.** Proceed to Step 0 silently. The gate is plumbing, not something to narrate every routine update.

**Reconciliation framing (only when the gate is set).** Distillation is the assess half of "capture raw, then assess" - this is the ONLY pass that distills, everything Setup did preserved. Give both lanes this nudge before the conversation walk:

> "Reconciliation after a migration. The EXTENDED depth was imported losslessly - over-split (one sub-section per entry), over-cap (dozens of anchored entries), with raw `[+]` headlines and the source project's migration trail intact. Treat the canonical scan as source of truth and restored content as supplemental. Distill the raw import to a steady state per the record conventions in `SKILL_MEMORY-UPDATE.md` (rewrite raw headlines into descriptive `[+]` bullets whose text matches the `### heading`, merge sub-sections the import over-split from one owner, drop exact duplicates and entries whose code no longer exists, summarize any elided-code markers into one-line prose - no code in EXTENDED, hold entries to ~10 lines unless genuinely important, give each MEMORY_EXTENDED entry a `Decision:` line where there is a resolution, keep every filled Big 6 `### <Section> Decisions` sub-section present). Strip the source migration trail (version stamps, provenance headers, resolved-blocker narration) so each entry reads as present-tense durable state. Sweep BACKLOG against the now-restored WDDOCS (`RELEASES/`, `PROPOSALS/`, `IDEAS/`, `FUTURE/`, `DESIGN/`). The import-vs-reconciled diff is the audit trail."

Bring MEMORY + MEMORY_EXTENDED back under cap through these intelligent edits (merge / drop / tighten), not by leaning on mechanical auto-prune, which drops bottom-most rather than least-valuable. Re-merging never loses content - you reshape the lossless raw into a curated steady state. Report merged / dropped / rewritten counts in the Step 5 summary so the user can spot over-aggressive distillation.

**Mechanism: direct curated edits, doctor as the gate.** A wholesale merge (e.g. 63 sub-sections -> 20) is far more reliable authored directly than as a hundred hand-written staging ops - the staging model is built for incremental bullet changes, not a full reshape. So edit `MEMORY` / `MEMORY_EXTENDED` / `SESSION_EXTENDED` directly, then verify with `doctor` (orphan links, caps, banned prose, Big-6 Decisions, residual migration markers) - doctor is the gate the staging commit would otherwise be. Distill both EXTENDED lanes evenly: `SESSION_EXTENDED` carries the same over-split and `elided on import` code markers as `MEMORY_EXTENDED`, so give it the same sweep, not a token pass - doctor flags any marker that survives a cleared gate. Bullet-shaped odds and ends (a BACKLOG sweep, a single Big-6 touch-up) can still go through staging if cleaner. Clearing the gate (`state --clear-reconcile`) refuses while any MAIN LIFO bullet still carries a `{#anchor}` or date (acceptance check 2), so a no-op reconcile cannot close the gate silently. It also stamps both lane watermarks to now, so state.json shows reconciliation brought the lanes current even though the reshape bypassed commit. This is the one sanctioned exception to "everything routes through staging" - it applies only to the gated reconciliation pass, never to routine updates.

**Acceptance checks (the reconciled steady state, verified before clearing the gate).** These describe where a good distillation lands. A capable pass meets them naturally. They exist so a lighter pass has concrete targets, not just principles:

1. **SESSION shipped work collapses to release arcs.** The raw import is one entry per source ship record. In the reconciled `SESSION_EXTENDED`, fold the entries that shipped under the same version into a single arc (per-commit detail lives in git and CHANGELOG, not the session backbone). If `SESSION_EXTENDED` comes out near its imported size, it was not distilled. A genuinely standalone milestone may keep its own entry, which is the exception rather than the default.
2. **Every `[+]` bullet is clean prose.** Strip any `{#anchor}`, date, or version prefix from the bullet text. The engine slugifies the text to resolve the anchor, so the visible headline must read as a plain description that matches its `### heading`. This one is mechanically enforced: doctor reports any survivor as a structural `Reconcile residue` issue, and `state --clear-reconcile` refuses to close the gate while they remain. A refusal means the strip is unfinished, not a tooling error - fix the bullets and clear again.
3. **Your own EXTENDED files leave doctor clean.** After the reshape, the only content/prose lint doctor reports is pre-existing user content (WDDOCS). Aim for zero over-length-anchor or `elided on import` warnings in the migration-written `MEMORY_EXTENDED` / `SESSION_EXTENDED`. A surviving warning there means under-distillation, so tighten that entry before clearing the gate rather than attributing it to user content.
4. **No cross-project file refs survive.** The source project's doc-filename references (`<OldName>_MEMORY.md`, `_SESSION.md`, `_DEV-AUDIT.md`, and the rest) must be renamed to the current project. The migrate-import rename skips these `_`-joined refs by word-boundary, so they arrive as residue in MEMORY / SESSION and their EXTENDED files. Same enforcement as check 2: doctor flags each as a structural `Reconcile residue` issue and `state --clear-reconcile` refuses while any remain.
5. **Cross-source duplicates merged.** The raw import can hold several overlapping sources - the 321 EXTENDED plus every swept scavenge doc (a `TEMP/` legacy dump, a prior project copied in), and on a re-migration even multiple similar projects. The same pitfall, convention, or shipped event often appears in more than one. Merge each into a single entry, keeping the clearest wording, rather than leaving near-duplicate LIFO bullets. This is judgment, not a gate (semantic dedup cannot be mechanically enforced), so it is on you: whenever the Step 1 sweep imported more than the canonical files, scan for cross-source repeats.
6. **Imported-from-older-project content sorts to the bottom.** Migration content is older than the project's current processes, so in the reconciled LIFO it lands at the BOTTOM, below current-project history. Swept legacy docs (the oldest source) sort to the very bottom, beneath the more recent 321 import. Routine updates after the migration go on top as usual - the migration import never sits above live history.

**Skills lane (custom `/321` bodies).** The same gated pass re-homes any custom skill bodies the migration archived (legacy `AIDOCS/SKILLS/SKILLS_*/` or any project-customized `SKILL_*.md`, now under `AIDOCS/<X>_SETUP_ARCHIVE/`). Capture preserved them verbatim and did not distill - this lane decides each one's fate. For each archived body, diff it against the current generic `AIDOCS/SKILL/SKILL_<NAME>.md` and classify:

- **Customize in place** - the body is an irreducibly project-specific pipeline the generic cannot express and where the generic default would do the wrong thing (a release / deploy flow with a non-standard publish, project version invariants, project-specific gates, or a project audit rule-set). Merge it into the project's own `AIDOCS/SKILL/SKILL_<NAME>.md`: keep the generic body's universal spine and fold in the project-specific steps and gates, do not port verbatim. Apply the project rename and voice-scrub. Add a `customizations[]` entry (`id`, `description`, `rule`, `applies_to: ["AIDOCS/SKILL/SKILL_<NAME>.md"]`) - that entry is what makes `init` preserve the body on future engine updates instead of overwriting it.
- **Fold** - the generic engine now supersedes the body (it predates the staging engine and mostly restates what the generic skill plus the engine already do). The doc-distillation skills (`-SessionUpdate`, `-MemoryUpdate`, `-Update`) usually land here. Carry forward only genuine deviations - process rules into `<X>_MEMORY.md` (Pipeline / Conventions), code rules into `<X>_DEV-AUDIT.md` Project specifics - then drop the body. Do not fork a skill the engine drives.
- **Surface a decision** - the divergence is a real workflow choice, not a mechanical merge (for example whether SessionUpdate writes a `CHANGELOG [Unreleased]` block, or whether MemoryUpdate is manual-only). Present the divergence and let the user choose rather than silently adopting either side.

Then verify: `node AIDOCS/tools/memory.mjs sync` (refreshes dispatch from the edited bodies) then `node AIDOCS/tools/memory.mjs doctor` (its customization-manifest check confirms each `applies_to` path exists). These are direct curated edits gated by doctor, same mechanism as the rest of this pass. Report the outcome per body in the Step 5 summary.

**AGENTS / CLAUDE classification lane.** The migration archived the project's old `AGENTS.md` and `CLAUDE.md` and `init` wrote the canonical lean skeleton over them. This lane folds the archived orchestrator content into the right home, keeping `AGENTS.md` a lean index. For each block in the archived files, apply the reconciliation principle (canonical scan wins on overlap, contradictions surface, complements keep):

- Cold-start orientation / read-order / Hard-rules pointer -> the canonical `AGENTS.md` (target ~50 lines, 80 ceiling, no routed block over ~10 lines, prefer a one-line pointer over an inlined block). Keep the canonical spine intact: Purpose header, Cold-start load order, layout / `_index.json` pointer.
- Project conventions / product principles / durable architecture -> `<X>_MEMORY.md` (Conventions or the matching Big 6 section).
- Code-applicable rules -> `<X>_DEV-AUDIT.md` Project specifics.
- A duplicate of the canonical skeleton -> drop. A contradiction -> surface for the user.

`CLAUDE.md` stays the canonical `@AGENTS.md` import - route any substantive archived CLAUDE content the same way (the two orchestrator files are usually near-duplicates, so dedup them against each other). Confirm auto-memory Hard-rules pointers with doctor's Auto-memory pointers check.

**DEV-AUDIT Project-specifics dedup lane.** Setup restored the project's `## Project specifics` verbatim. Walk each restored sub-section against the canonical baseline (the Anchor principles / Hard rules / Audit dimensions above the divider, which `init` wrote identically across every project): DROP if it duplicates the baseline or restates MEMORY (MEMORY owns project-anchored rules), KEEP if it is purely project-specific (build / lint commands, language version, framework gotchas) or extends the baseline with real specifics, SURFACE contradictions. Only `## Project specifics` is reconciled - never dedup, rewrite, or contradiction-scan the baseline above the divider. The DEV-AUDIT Hard rules block is an intentional audit-facing copy of the auto-memory inventory (also surfaced in AGENTS Hard rules) - that triplication is by design for visibility, not drift to reconcile.

All lanes are direct curated edits gated by doctor, the same mechanism as the distillation. The one step that stays the user's is deleting `AIDOCS/<X>_SETUP_ARCHIVE/` once they are satisfied - the archive is the recovery net, so its removal is a human call, not part of the gate.

## What this skill does differently

A naive chain (SessionUpdate then MemoryUpdate) walks the conversation twice and gathers context twice. This skill folds those into a single pass:

| Concern | Naive chain | This skill |
|---|---|---|
| Conversation walk | 2x | 1x (shared classification, finding routes to session / memory / both / drop) |
| Context gather (SESSION + MEMORY + BACKLOG + AGENTS) | 2x reads | 1x reads, both lanes share the in-memory view |
| Mode detection | 2x | 1x per lane |
| Sub-skill commit | 2 separate two-phase commits | 2 separate two-phase commits (kept separate so a session-only or memory-only failure can be retried independently) |

Per-lane staging stays distinct so each lane's `state.json` watermark advances independently. Recovery is per-lane.

## Mode behavior

| Mode | What runs | Touches Big 6 |
|---|---|---|
| default | Both lanes at default | no |
| `-SKIM` | Both lanes at skim | no |
| `-FULL` | Both lanes at full: SessionUpdate verifies Current State + project state, MemoryUpdate auto-applies gap-fill + promotion | yes (auto-applied, mechanically gated to `-FULL` only) |

## Roles (AI vs script)

| Phase | AI | Script |
|---|---|---|
| Detect mode + gather context | One pass per lane, shared in-memory reads | Provides per-skill `last_committed_at` |
| Classify + stage | One conversation walk, route each finding | Validates each staging on `validate` |
| Commit | Issue commits sequentially (session then memory) | Two two-phase applies, separate state updates |

## Step 0: Parse flags + detect mode per lane

Each lane detects mode independently:

1. Compaction boundary in conversation -> auto-escalate to full.
2. First run / bootstrap (`<skill>.last_committed_at` is null) -> auto-escalate to full.
3. Per-skill signal:
   - **session-update**: `git log main..HEAD --oneline` count. 0 + clean tree -> skim, 1-3 -> incremental, 4+ or uncertainty -> full.
   - **memory-update**: durable-observation candidates in conversation + SESSION. 0 -> skim, 1-3 -> incremental, 4+ -> full.

Override flags `-FULL` / `-SKIM` force both lanes. The reconciliation gate (above) also forces both lanes to `-FULL` when `reconcile_pending` is set. Output `session=<mode>, memory=<mode>` at start (add `(reconciliation)` when the gate is set).

Null watermarks (`<skill>.last_committed_at` is null on first run / bootstrap) signal the full conversation is unread - already auto-escalated to full via rule 2 above.

## Step 1: Shared context gather

Read once, hold for both lanes. Skip files already in current conversation context:

- `AIDOCS/<PROJECT>_SESSION.md` and `_SESSION_EXTENDED.md`
- `AIDOCS/<PROJECT>_MEMORY.md` and `_MEMORY_EXTENDED.md`
- `AIDOCS/<PROJECT>_BACKLOG.md`
- `AGENTS.md`, auto-memory index (`MEMORY.md` at the path in `_index.json -> auto_memory.path`)
- Git: `git branch --show-current`, `git status --short`, `git log --oneline -10`, `git log main..HEAD --oneline`

In `-FULL`, also gather project context (`package.json`, `_index.json`, framework / deploy configs, top-level layout). SessionUpdate uses it for Current State verification. MemoryUpdate uses it for Big 6 gap-fill.

## Step 2: Shared conversation walk + classify

Walk the conversation since `min(session_update.last_committed_at, memory_update.last_committed_at)` (whichever is older). If either watermark is null, walk the full conversation - that lane is bootstrapping. Classify each finding per the sub-skill allocation tables:

- Session lane: see the allocation step in `SKILL_SESSION-UPDATE.md`.
- Memory lane (including BACKLOG): see the routing step in `SKILL_MEMORY-UPDATE.md`.

A finding can produce entries in both lanes when the rules call for it (rare). Findings matching neither lane drop here. Code-applicable patterns are DevAudit's lane.

## Step 3: Stage + commit session-track

In reconciliation mode these staging commits are replaced by the direct-edit reshape (see the Mechanism note above and Step 4's reconciliation clause). The normal chain runs Steps 3-4 as written.

Build `AIDOCS/tools/staging/session-update.json` from the session-lane classifications. Run:

```bash
node AIDOCS/tools/memory.mjs validate --skill session-update
node AIDOCS/tools/memory.mjs commit   --skill session-update
```

Auto-applies. Engine handles Last State demotion on `overwrite_section` of `current_state`. If commit fails, stop - memory-track does NOT run. Staging file preserved for retry.

## Step 4: Stage + commit memory-track

Build `AIDOCS/tools/staging/memory-update.json` from the memory-lane classifications + BACKLOG routing. In `-FULL`, also add gap-fill ops for empty Big 6 sections and promotion ops for LIFO entries that clear the heuristic gate. Run:

```bash
node AIDOCS/tools/memory.mjs validate --skill memory-update
node AIDOCS/tools/memory.mjs commit   --skill memory-update
```

Auto-applies. AGENTS / auto-memory suggestion bullets stage as `lifo_insert` ops with `**Suggested for ...:**` prefix. User edits the target file to accept.

If commit fails, SessionUpdate's commit already applied. Report MemoryUpdate failure with recovery guidance from `SKILL_MEMORY-UPDATE.md`.

**Reconciliation mode only:** the wholesale reshape is direct curated edits (see the Mechanism note above), not the staging commits of Steps 3-4. Make the edits, verify with `node AIDOCS/tools/memory.mjs doctor`, then clear the gate: `node AIDOCS/tools/memory.mjs state --clear-reconcile`. Small bullet-shaped ops may still ride staging. If doctor does not pass, leave the gate set so the next `/321 -Update` resumes the reconciliation.

## Step 5: Combined summary

```
/321 -Update session=<mode>, memory=<mode> complete.

session-update: <one-line summary>
memory-update:  <one-line summary>

Suggestions staged in MEMORY LIFO (user-confirm by editing the target file):
  - <suggestion 1>
  - <suggestion 2>
```

Empty suggestion list: omit the block entirely.

**Reconciliation mode** appends a distillation report and the gate-cleared status:

```
Post-migration reconciliation complete. Gate cleared (reconcile_pending: false).
  Distilled: <M> over-split merged, <D> duplicates / dead-code dropped,
             <R> headlines rewritten to descriptive [+], <Q> trail stamps stripped
  BACKLOG:   <K> items swept from WDDOCS
  Skills:    <N> custom body(ies) reconciled - <A> customized in AIDOCS/SKILL/ + flagged,
             <B> folded into MEMORY / DEV-AUDIT, <C> surfaced for your decision
  AGENTS:    <N> archived blocks classified (kept lean / -> MEMORY / -> DEV-AUDIT / dropped)
  DEV-AUDIT: <N> Project-specifics sub-sections kept, <D> dropped as baseline / MEMORY dupes
  Doctor:    0 structural, <N> content/prose (all pre-existing user WDDOCS,
             migration-written files clean: 0 over-length anchors / markers)

Only step left to you: delete AIDOCS/<X>_SETUP_ARCHIVE/ once satisfied (the recovery net).
```

## Rules (skill operation)

- **Reconciliation gate first, silent when off.** Read `reconcile_pending` before Step 0. Set -> this run is the post-migration distillation pass (force `-FULL`, apply the framing, distill via direct edits, clear the gate after doctor verifies). Off -> normal chain, never mention the gate.
- **Reconciliation re-homes everything the migration captured.** When the gate is set, beyond SESSION / MEMORY / BACKLOG it also runs the skills lane (custom `/321` bodies -> customized `AIDOCS/SKILL/` body + `customizations[]` entry, or fold), the AGENTS / CLAUDE classification lane (archived orchestrator content -> lean AGENTS / MEMORY / DEV-AUDIT), and the DEV-AUDIT Project-specifics dedup lane. All are direct edits gated by doctor. Routine (non-gated) updates touch none of these. The only manual step left is deleting the setup archive when satisfied.
- **Single shared pass.** One conversation walk, one context gather. Per-lane commits stay separate for independent recovery.
- **Session before Memory.** Session commits first so partial failures stay contained.
- **`-FULL` auto-applies gap-fill + promotion.** No per-entry confirms.
- **BACKLOG belongs to the memory lane.** Session does not route to BACKLOG.
- **Never touches CHANGELOG.** AutoPush owns CHANGELOG composition at release.
