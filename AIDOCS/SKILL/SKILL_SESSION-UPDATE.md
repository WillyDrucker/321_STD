---
name: session-update
description: Refresh SESSION (Current State + LIFO) and SESSION_EXTENDED. Project-history backbone log. Auto-applies. BACKLOG and CHANGELOG belong to other skills.
---

# /321 -SessionUpdate

**Purpose:** Refresh `<PROJECT>_SESSION.md` and `<PROJECT>_SESSION_EXTENDED.md` from this conversation. SESSION is the project's backbone log: the running history of everything project-significant. Standalone or delegated from `/321 -AutoPush` / `/321 -Update`. Auto-applies.

Canonical shape lives in `<PROJECT>_SESSION.md`. Engine spec: `AIDOCS/tools/staging/SCHEMA.json` + `AIDOCS/tools/lib/README.md`.

## You drive the log

You're logging project history for future sessions. For each turn of the conversation ask: **would a future contributor want to find this when reading SESSION as the project's record?**

Suggests capture:
- Something changed on the project (files, schema, behavior, structure)
- A decision was made or reversed
- A finding worth keeping (audit result, review outcome, external fact)
- Friction notable enough to inform future work
- A milestone hit
- User said "remember this" or signaled significance
- A pattern emerged across iterations worth marking

Suggests drop:
- Pure formatting / typo / whitespace fixes
- Exploration without commitment
- Conversation acknowledgments and tool-load confirmations
- One-off info-gathering with no lasting effect
- Already captured (dedupe)

Scale with significance, not raw event count. Many iterations on one feature collapse to a few entries (the key arc). Many unrelated changes produce proportionally more. Judge by what a future reader needs, not a target number.

## Granularity (arc-level, not iteration-level)

RAW doesn't mean log everything. SESSION captures arcs:

- **Aggregate the related** into one entry, not many.
- **End-state captures the journey.** Intermediate "started X" entries are redundant once "finished X" lands.
- **So-what test.** Would a future session reading this say "so what?" or "noted"? Drop on "so what."

Detail vs bullet split: LIFO bullet = headline. EXTENDED `### sub-section` = technical narrative (why, how, what surprised us). If a bullet needs more than two lines of context to read, that context belongs in EXTENDED.

## Event vs state (the duplication rule)

SESSION captures events as they happen. MEMORY captures the timeless state events imply. The same fact often produces entries in both, but framings stay distinct:

| SESSION (event lens) | MEMORY (state lens) |
|---|---|
| "Picked X over Y after testing Z" | "We use X for Z-shaped problems" |
| "Friction with Y on Windows path separators" | "Y has cross-platform path issues - use Z instead" |

**Capture SESSION raw.** Don't pre-filter to avoid overlap with MEMORY. Log the event. MemoryUpdate's distillation handles the abstracted lesson later when it earns it.

Crossing lanes looks like a SESSION entry stating a timeless rule with no event narrative, or a MEMORY entry narrating a moment with no abstracted lesson. When uncertain, default SESSION raw.

## Friction routing

- Active right now = state observation -> SESSION (here)
- Pattern of recurring friction across multiple SESSION entries = durable lesson -> MEMORY (other skill picks it up)
- One-off process noise = drop

## Structural rules

SESSION shape:

- **Current State** - operational snapshot. Overwritten on update. Branch, deploy status, gate status, active focus, stack names, local dev. Flat bullets.
- **LIFO** - running history of project-significant events. Newest-first.

**Last State marker.** On every Current State overwrite, the engine demotes prior Current State bullets to LIFO with `**Last State:** <text>` prefix on the first one. Any prior marker has its prefix stripped (content stays as plain history). Exactly one marker exists once any overwrite has happened. Above the marker = "since last SessionUpdate," at and below = older history. First-ever overwrite creates no marker. AI doesn't write the marker - the engine does it on `overwrite_section` of `current_state`.

EXTENDED uses `### sub-section` anchors under `## LIFO` with lowercase-kebab slugs. Each notable LIFO bullet can carry a sub-section. Commit simulation enforces forward orphan checks (a bullet linking to a non-existent anchor fails commit).

Per-entry caps (advisory, surfaced by `node AIDOCS/tools/memory.mjs lint`):

- **SESSION LIFO bullets: 2 physical lines.** A bullet with EXTENDED detail leads with the `[+]` marker (`- [+] <headline>`) and NO link - the headline must match its `### heading` in SESSION_EXTENDED (the engine derives the anchor by slugify). A bullet with no EXTENDED detail is plain `- <text>`.
- **SESSION_EXTENDED `### sub-section`s:** identify the PAINPOINT, not the process - a thing fought multiple times to fix earns a note, standard procedure does not. NO code snippets - the validator REJECTS a `` ``` `` fence in any EXTENDED body (commit aborts pre-write), so summarize the takeaway in prose, the code lives in the source. Aim ~10 lines (advisory), over-length only when genuinely important.

File size limits live in `_index.json -> sizes.session` / `sizes.session_extended` as `cap` + `prune_to`. **Auto-prune fires after every commit** when either file exceeds `cap`. It runs paired (drops bottom-most LIFO bullets alongside their anchored EXTENDED sub-sections, bundles both into one archive entry, drops the file down to `prune_to` lines). This commit's freshly-inserted bullets / sub-sections are skipped via fresh-content protection - new entries never archive on landing. The Last State marker is engine-protected from prune. No manual prune invocation is needed in normal use.

## Roles (AI vs script)

| Phase | AI | Script |
|---|---|---|
| Detect mode | Read state.json + git, pick mode | Provides `session_update.last_committed_at` |
| Classify + stage | Walk conversation, route per allocation table, write staging JSON | Validates schema on `validate` |
| Commit | Issue `commit` | Two-phase apply, engine handles Last State demotion |

## Step 0: Detect update mode

Three modes:

- `skim` - verify cross-refs, no rewrites
- `incremental` - read only new commits + conversation since last update
- `full` - read everything, summarize, allocate, prune

Override flags `-FULL` / `-SKIM` force the mode. Default bias: skim > incremental > full.

Signal hierarchy (cheap first):

1. Compaction boundary in conversation -> auto-escalate to full.
2. First run / bootstrap (`session_update.last_committed_at` is null) -> auto-escalate to full.
3. Commit-count gap (`git log main..HEAD --oneline`): 0 + clean tree -> skim, 1-3 -> incremental, 4+ or uncertainty -> full.
4. Last State cross-check: bullets above the LIFO marker count as "since last SessionUpdate." If this count and git's disagree, use the higher.

`-FULL` also unlocks:

- **Current State verification.** Each bullet cross-checked against project reality (`package.json`, `git status`, gates, `_index.json`).
- **More aggressive SESSION_EXTENDED prune.**

Use `-FULL` deliberately - after a big arc, before a release, when Current State looks stale.

Output the detected mode at start.

## Step 1: Gather context

Source of truth: the conversation. SESSION.md is a write target, not a source.

Re-read only if not in current context:

- `AIDOCS/<PROJECT>_SESSION.md`
- `AIDOCS/<PROJECT>_SESSION_EXTENDED.md`
- Git: `git branch --show-current`, `git status --short`, `git log --oneline -10`, `git log main..HEAD --oneline`

Review the conversation for new work since `session_update.last_committed_at`.

## Step 2: Allocate each finding

| Item | Destination | Mechanism |
|---|---|---|
| Current operational reality (branch, deploy, gates, focus, stack, local dev) | `SESSION/Current State` | `overwrite_section` (engine handles Last State demotion) |
| Project-significant event (change, decision, finding, friction, milestone, failed attempt) | `SESSION/LIFO` headline + optional `SESSION_EXTENDED ### <slug>` narrative | `lifo_insert` + matching `extended_action` |
| Operational fact about a sibling project | `SESSION_EXTENDED ### <slug>` mention only | `extended_action` add |
| Shipped on this branch | nothing - EXTENDED anchors retain technical detail. AutoPush composes CHANGELOG at release. | (n/a) |
| Forward-looking work (feature ask, idea, "we should...") | DROP - belongs in MemoryUpdate / BACKLOG | (n/a) |
| Durable observation / architectural shift / sticky rule | DROP - belongs in MemoryUpdate / MEMORY | (n/a) |
| Code-applicable pattern enforceable by lint or grep | DROP - belongs in DevAudit | (n/a) |
| Wishlist / speculation without intentionality | DROP - if it matters, it resurfaces | (n/a) |

**Migration exception:** when Setup migration capture (`SKILL_SETUP.md`) drives this skill, ambiguous-home archive content routes to SESSION LIFO instead of dropping - capture loses nothing, reconciliation re-homes it later. The DROP rows above apply to routine runs.

## Step 3: Prune before appending

Keep-test: would an AI starting cold benefit from this? Load-bearing or non-obvious? Yes -> keep. Re-derivable from code or git -> drop.

- SESSION LIFO: resolved blockers and stale observations drop. Current State is overwritten, not pruned.
- SESSION_EXTENDED: anchors whose parent LIFO bullet was dropped -> drop. Free-standing anchors past their useful window (3 shipped releases unless `<!-- LOAD_BEARING -->`) -> drop.

Size caps are hard limits per `_index.json -> sizes`. Prune harder if over.

## Step 4: Stage

Build `AIDOCS/tools/staging/session-update.json` per `AIDOCS/tools/staging/SCHEMA.json`. Never edit SESSION / SESSION_EXTENDED directly.

- Current State: `overwrite_section` on `section: "current_state"`. Engine demotes prior bullets to LIFO with marker.
- SESSION LIFO: `lifo_insert` / `replace` / `remove` on `section: "lifo"`. Use `replace` when an existing entry has fresh state to add (the arc moved forward, the friction got worse, the decision flipped) - the updated bullet floats to the top to signal progress. Use `lifo_insert` only when the event is genuinely new with no prior entry to update.
- SESSION_EXTENDED: `extended_actions[]`.

When a LIFO bullet has EXTENDED detail: set `extended_anchor: "<slug>"` on the action AND emit a matching `extended_actions` entry whose `### heading` slugifies to that anchor. The engine renders the bullet with a `[+]` marker (no link) and re-derives the anchor from the bullet text, so the bullet text and the `### heading` must read the same.

`backlog_actions[]` on this skill is rejected by the validator (cross-skill firewall).

## Step 5: Commit

```bash
node AIDOCS/tools/memory.mjs validate --skill session-update            # schema check
node AIDOCS/tools/memory.mjs commit   --skill session-update --preview  # simulate + diff
node AIDOCS/tools/memory.mjs commit   --skill session-update            # apply
```

Two-phase: simulate first, abort before any writes if any op fails. Auto-commits. Relay the script summary verbatim.

Common failures (all caught at simulation):

- Missing required field / unknown op -> fix staging shape
- Orphan `extended_anchor` -> ensure matching `extended_actions` entry
- Fenced code in an EXTENDED `body_md` / `replace` -> rejected, summarize the takeaway in prose
- `replace_text` no-match / multi-match -> adjust find text for uniqueness
- Static-section op or `backlog_actions` -> wrong skill, those belong in MemoryUpdate
- Lockfile present -> wait, or remove `AIDOCS/tools/staging/.lock` if confirmed stale

## Rules (skill operation)

- **You're logging project history.** Future-session usefulness is the bar.
- **Capture SESSION raw.** MEMORY's distillation handles the abstracted lesson later.
- **Arc-level, not iteration-level.** One entry per arc, end-state captures the journey.
- **Auto-applies.** Session work is operational, not consequential.
- **Project work only.** BACKLOG, MEMORY static, CHANGELOG, code patterns route elsewhere via their own skills.
