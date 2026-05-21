---
name: update
description: Optimized chain of session-track + memory-track in one shared-context pass. Mode passes through. -FULL: SessionUpdate verifies project state, MemoryUpdate auto-applies Big 6 maintenance + promotion.
---

# /321 -Update

**Purpose:** Update both tracks in a single pass when the session moved both. Shares the conversation walk, context gather, and mode detection across the two lanes (vs naive sub-skill re-invocation which would pay 2x reads). Sub-skill specs: `SKILL_SESSION-UPDATE.md` (session lane) and `SKILL_MEMORY-UPDATE.md` (memory lane + BACKLOG). Engine spec: `AIDOCS/tools/staging/SCHEMA.json` + `AIDOCS/tools/lib/README.md`.

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

The DEV-AUDIT Project specifics dedup and AGENTS / CLAUDE classification are a separate manual follow-up Setup points the user at - they are outside Update's SESSION / MEMORY / BACKLOG write lane and stay out of this gate.

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

- Session lane: see `SKILL_SESSION-UPDATE.md` Step 2.
- Memory lane (including BACKLOG): see `SKILL_MEMORY-UPDATE.md` Step 4.

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
  Doctor:    0 structural, <N> content/prose (all pre-existing user WDDOCS,
             migration-written files clean: 0 over-length anchors / markers)

Still pending (manual, outside this lane): DEV-AUDIT Project specifics dedup +
AGENTS / CLAUDE classification. See the /321 -Setup summary deferred follow-ups.
```

## Rules (skill operation)

- **Reconciliation gate first, silent when off.** Read `reconcile_pending` before Step 0. Set -> this run is the post-migration distillation pass (force `-FULL`, apply the framing, distill via direct edits, clear the gate after doctor verifies). Off -> normal chain, never mention the gate.
- **Single shared pass.** One conversation walk, one context gather. Per-lane commits stay separate for independent recovery.
- **Session before Memory.** Session commits first so partial failures stay contained.
- **`-FULL` auto-applies gap-fill + promotion.** No per-entry confirms.
- **BACKLOG belongs to the memory lane.** Session does not route to BACKLOG.
- **Never touches CHANGELOG.** AutoPush owns CHANGELOG composition at release.
