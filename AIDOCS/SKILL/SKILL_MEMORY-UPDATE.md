---
name: memory-update
description: Capture durable observations into MEMORY LIFO + BACKLOG. Auto-invokes SessionUpdate first. -FULL auto-applies Big 6 maintenance (gap-fill / refine / replace) + LIFO-to-static promotion. AGENTS / auto-memory candidates surface as suggestive LIFO bullets.
---

# /321 -MemoryUpdate

**Purpose:** Distill durable observations into `<PROJECT>_MEMORY.md` (LIFO + Big 6 static sections) and manage `<PROJECT>_BACKLOG.md` (forward-looking Features + Ideas). Always auto-invokes `/321 -SessionUpdate` first so SESSION is current before reading. In `-FULL`, auto-applies gap-fill (drafts empty Big 6 sections from project + conversation + SESSION) and auto-promotes LIFO entries that clear the heuristic gate. AGENTS / auto-memory candidates surface as suggestive LIFO bullets the user acts on.

Canonical shape lives in `<PROJECT>_MEMORY.md` and `<PROJECT>_BACKLOG.md`. Engine spec: `AIDOCS/tools/staging/SCHEMA.json` + `AIDOCS/tools/lib/README.md`.

## MEMORY's two functions

**Schema filler.** Big 6 static sections (Overview / Stack / Architecture / Environment / Pipeline / Conventions, each with an always-present `### <Section> Decisions` sub-section for the why). Fills from codebase + conversation + SESSION distillation. Provides the cold-start orientation a fresh session needs.

**Decision distiller.** LIFO accumulates durable observations as they surface. `-FULL` reads LIFO + SESSION as a SET, identifies patterns that meet the heuristic gate, and auto-promotes them to Big 6 (fact-shaped) or Decisions sub-sections (rationale-shaped).

LIFO is also a destination on its own. Many entries stay there indefinitely as standalone durable observations without needing static placement. Promotion is selective by design.

## What SESSION cannot reach (MEMORY's gaps)

SESSION captures events. MEMORY captures four things SESSION inherently misses:

1. **Codebase facts.** What the stack actually is, what the deploy mechanism does, what the directory tree looks like. The codebase IS state - SESSION events don't capture it.
2. **Conversational identity.** Audience, lineage, problem statement, founding constraint. Users state these in passing, rarely as discrete events.
3. **Implicit decisions.** "We use TypeScript strict" - never debated, just done. No event marks the moment of choice.
4. **Pre-history facts.** Project lineage, founding context. Predates SESSION tracking.

These are MEMORY-only material. Rationale-shaped content (domain reasoning, project-specific don'ts, reverted-decision lessons) routes through qualified `### <Section> Decisions` sub-sections, not a separate category.

## You drive the filter

Default is no change. Most sessions produce project work, not memory-track work. Walk the conversation + SESSION + codebase for durable observations. Findings that belong to SESSION (events / state) or DEV-AUDIT (code patterns) drop here - those skills scan independently.

**Pain-point test** for every candidate: could a future reader open the code, read its comments, and know what to do? Yes -> no bullet. Would they need context that isn't derivable from the code? -> bullet candidate. Durable (true in 6 months)? -> LIFO candidate. Transient (active state)? -> drop, SessionUpdate captured it via Step 1.

**Keep-test:** would an AI starting cold benefit from this? Re-derivable from code or git? Drop.

## Mode behavior

| Mode | What runs | Touches Big 6 |
|---|---|---|
| default / `-SKIM` | Step 1 SessionUpdate + routine MEMORY LIFO + BACKLOG ops | no |
| `-FULL` | All routine + Big 6 maintenance (gap-fill / refine / replace) + promotion (auto-promotes LIFO entries that clear the gate) | yes (auto-applied, mechanically gated to `-FULL` only) |

The validator rejects `promote_to_section`, `gap_fill_section`, and `update_section_text` outside `mode: "full"`. Routine modes are mechanically incapable of writing the Big 6.

## Bootstrap behavior

At the edges, the skill has procedural fallback. Once MEMORY is populated, the procedural behavior stops and `-FULL` is required to re-evaluate.

| State | Behavior |
|---|---|
| Empty MEMORY + empty SESSION + no conversation context | Fill Big 6 from codebase + project info |
| Empty MEMORY + empty SESSION + conversation has content | Step 1 captures conversation into SESSION. Then fill Big 6 from codebase + fresh SESSION. |
| Empty MEMORY + SESSION exists | Fill Big 6 from SESSION + codebase + project info |
| Filled MEMORY + stale SESSION | Step 1 brings SESSION current. No static changes - routine LIFO only. |
| Filled MEMORY (Big 6 satisfied) | No auto-update of static. Routine writes LIFO only. `-FULL` to re-evaluate. |

**Mixed-priority schema check** determines "filled" vs "empty":

- **Load-bearing sections** (Stack, Architecture, Pipeline) require schema match. Stack names framework + language + build mode. Architecture names layout + flow + reading order. Pipeline names build + deploy + release flow.
- **Looser sections** (Overview, Environment, Conventions) need any non-placeholder content.

A section that doesn't meet its threshold is "empty" for gap-fill purposes.

## Structural rules

- **LIFO bullets: 2 physical lines max.** A bullet with EXTENDED detail leads with the `[+]` marker (`- [+] <descriptive headline>`) and NO link - the headline text must match its `### heading` in `<PROJECT>_MEMORY_EXTENDED.md` (the engine derives the anchor by slugify). A bullet with no EXTENDED detail is plain `- <text>`.
- **Big 6 static sections** are mechanically protected. Only `promote_to_section`, `gap_fill_section`, and `update_section_text` write them, all requiring `-FULL`. Every FILLED Big 6 section keeps a `### <Section> Decisions` sub-section (the why), even when the answer is "(none yet)". doctor flags a filled section that lacks one.
- **EXTENDED `### sub-section`s:** identify the PAINPOINT, not the process - a thing fought multiple times to fix earns a note, standard procedure does not (the code shows the what, EXTENDED carries the why). NO code snippets - the validator REJECTS a `` ``` `` fence in any EXTENDED body, so commit aborts pre-write. Summarize the takeaway in prose, the code lives in the source. Aim ~10 lines, over-length only when genuinely important. Each entry carries a `Decision:` line (the resolution) when there is one. Commit simulation also enforces forward orphan checks.
- File size limits live in `_index.json -> sizes.memory` / `sizes.memory_extended` / `sizes.backlog` as `cap` + `prune_to`. **Auto-prune fires after every commit** when memory, memory_extended, or backlog exceeds its `cap`. Memory pair runs paired (bullets + anchored sub-sections together), backlog runs standalone. Fresh-content protection skips this commit's just-inserted bullets / sub-sections so new entries never archive on landing.

## Roles (AI vs script)

| Phase | AI | Script |
|---|---|---|
| Detect mode + bootstrap state | Read state.json + MEMORY for schema check, pick mode | Provides `memory_update.last_committed_at` |
| Auto-invoke SessionUpdate | Issue chain | SessionUpdate's two-phase commit |
| Filter + stage | Walk conversation + SESSION + codebase, apply pain-point test, write staging JSON | Validates schema on `validate` |
| Commit | Issue `commit` | Two-phase apply, enforces static-section gates |

## Step 1: Auto-invoke SessionUpdate

Always invoke `/321 -SessionUpdate` first (with pass-through `-FULL` if set). Ensures SESSION is current before this skill reads it. SessionUpdate's skim mode is the safety valve - nothing changed means it verifies and exits cheap.

If SessionUpdate fails: chain stops, MemoryUpdate reports the failure and exits. User fixes, re-invokes.

**Migration exception:** when Setup migration capture (`SKILL_SETUP.md` Step 6) drives this skill, skip this Step 1. Setup Step 5 already captured SESSION in the same migration run, so re-invoking SessionUpdate here would re-walk the conversation and demote the just-written Current State. In that path this lane also appends its ops to the migrate-import staging Setup Step 6 Part A produced, rather than building a fresh staging file.

## Step 2: Detect mode + bootstrap state

After Step 1 returns, detect mode for this skill. Three modes (skim / incremental / full). Override flags `-FULL` / `-SKIM` force. Default bias: skim > incremental > full. Output mode before any Step 3 work begins.

Signal hierarchy:

1. Compaction boundary in conversation -> auto-escalate to full.
2. First run / bootstrap (`memory_update.last_committed_at` is null) -> auto-escalate to full.
3. Empty Big 6 (per the mixed-priority schema check below) -> auto-escalate to full so gap-fill can run.
4. New-findings count in conversation + SESSION: 0 -> skim, 1-3 -> incremental, 4+ -> full.

Also run the mixed-priority schema check against MEMORY to determine "filled" vs "empty" per section. The result feeds the bootstrap behavior table for Big 6 routing in Step 4. Empty sections that need gap-fill are why rule 3 auto-escalates - routine modes are mechanically barred from `gap_fill_section`.

Memory-track updates are rare by design once MEMORY is populated. Skim is the expected default. `-FULL` unlocks gap-fill + promotion - use it deliberately, after a big architectural change, before a release, when the Big 6 looks stale.

## Step 3: Gather context

Source of truth: SESSION (just refreshed by Step 1) + the conversation + the codebase. MEMORY is the write target + dedupe reference, not the source.

Re-read only if not in current context:

- `AIDOCS/<PROJECT>_SESSION.md` and `_SESSION_EXTENDED.md` (just refreshed)
- `AIDOCS/<PROJECT>_MEMORY.md` and `_MEMORY_EXTENDED.md`
- `AIDOCS/<PROJECT>_BACKLOG.md`
- `AGENTS.md`, auto-memory index (`MEMORY.md` at the path in `_index.json -> auto_memory.path`)

In `-FULL`, also gather project context for gap-fill: `package.json`, `_index.json`, framework / deploy configs, top-level layout.

## Step 4: Route findings

| Item | Destination | Mechanism |
|---|---|---|
| Durable observation (codebase, conversation, distilled from SESSION) | `MEMORY/LIFO` headline + optional `MEMORY_EXTENDED ### <slug>` narrative | `lifo_insert` + matching `extended_action` |
| Big 6 schema-fill candidate (bootstrap path) | corresponding static section | `gap_fill_section` (mode=full only) |
| Specific feature ask (user-named, ready-to-implement) | `BACKLOG/Features` | `lifo_insert` in `backlog_actions[]` |
| Anything-else-future (refactor candidate, polish, exploratory, deferred bug) | `BACKLOG/Ideas` | `lifo_insert` in `backlog_actions[]` |
| AGENTS / auto-memory suggestion pattern | `MEMORY/LIFO` as suggestive bullet | `lifo_insert` with `**Suggested for ...:**` prefix |
| Project-specific event or active state | DROP - SessionUpdate captured it via Step 1 | (n/a) |
| Code-applicable pattern enforceable by lint or grep | DROP - DevAudit scans independently | (n/a) |
| Already in LIFO or static | update if stale, don't duplicate | `replace` (LIFO: edits the bullet AND floats it to top, signaling the rationale was just sharpened or related pattern surfaced) |

### BACKLOG capture filter

Capture only when ONE of these holds:

1. **Explicit user future intent** ("we should do X", "remind me to consider Y", "long-term we want Z")
2. **User directional weight** ("would be nice if...", "eventually...", "future version could...")
3. **AI-surfaced + user-implied consent** (AI proposed "worth considering later" AND user didn't reject). Tag `_(source: ai-surfaced)_`.

Format: `**<title>.** <one-line description> _(source: user|ai-surfaced)_`

Features = specific, ready-to-implement once committed. Ideas = everything else worth remembering. When in doubt -> Ideas.

### BACKLOG sweep

Walk existing BACKLOG against SESSION + codebase + conversation. Drop only on high-confidence shipped / declined evidence (codebase reflects the change, SESSION LIFO confirms it shipped, or user explicitly declined).

**Sweep removes are destructive.** The commit pipeline does not archive `remove` ops. Recovery posture: BACKLOG content gets archived only when `prune` runs at cap (bulk archive of dropped entries to `backlog_archive`). The surgical `archive` command does not apply (EXTENDED-files-only). Be conservative - ambiguous cases stay in BACKLOG.

## Step 5: Gap-fill (`-FULL` only)

Skip in default / `-SKIM`.

For each empty Big 6 section (per the mixed-priority schema check), gather evidence:

- **Codebase scan.** `package.json`, framework config, `_index.json`, deploy config.
- **Conversation context.** Anything the user has stated about this section.
- **SESSION distillation.** Patterns across LIFO entries that hint at section content.
- **Sibling MEMORY files.** When the project is part of a family, mirror conventions where they match.

Auto-apply via `gap_fill_section` with `target_section`, `body_md`, and `decisions_md`. **Always include `decisions_md`** - the whys, or "(none yet)" for a straightforward section - so every Big 6 keeps its Decisions sub-section. Optional `extended_body_md` / `extended_decisions_md` add the EXTENDED Big 6 mirror with deeper rationale where the depth is earned. Skip sections where evidence is genuinely missing - empty sections that can't be filled responsibly stay empty.

### Conflict resolution

- **Code and config win for Stack and Pipeline facts.**
- **Conversation wins for audience, intent, and lineage.**
- **SESSION distillation wins for Decisions sub-sections.**
- **Genuine conflict with no precedence rule** -> no auto-resolve. Candidate stays in LIFO with both readings noted. Static stays untouched.

When a fresh LIFO entry contradicts existing Big 6 / Decisions sub-section content, the contradiction blocks promotion. AI surfaces the conflict in the run summary.

### Updates to filled Big 6 sections (event-driven, no schema walk)

`-FULL` does NOT walk Big 6 looking for drift. That would be expensive and noisy. Instead, update detection is event-driven:

1. **Trigger source.** SESSION LIFO entries and the current conversation surface signals: "migrated to X", "switched from Y to Z", "now on N.N.N", "dropped X", "added Y alongside Z". If you spot a phrase like this referring to something in Big 6, it's a candidate.
2. **Classify the change** (judgment, three options):
   - **Refine** an existing fact - same thing, different value (`Astro 4` -> `Astro 5.1.0`).
   - **Replace** an existing fact - thing no longer holds (`uses Astro` -> `uses React` after the framework swap).
   - **Append** a related fact - new info alongside existing (`Stack is Astro` becomes `Stack is Astro + React`).
3. **Verify** with one targeted check before applying:
   - Codebase-verifiable (framework versions, deps, deploy configs): read the single relevant file (`package.json`, `astro.config.mjs`, `_index.json`, etc.). High confidence on match.
   - SESSION-distilled (decisions, conventions): re-read the SESSION entry that surfaced the signal. Medium-high confidence if pattern recurs.
   - Conversation-stated (identity, audience): re-read the conversation context. Medium confidence.
4. **Apply** or **fall back**:
   - Confirmed with high confidence -> auto-apply via `update_section_text` (refine / replace) or `promote_to_section` (append). Required `rationale` field gets the one-line explanation.
   - Ambiguous or unverifiable -> stage a suggestive LIFO bullet instead:
     ```
     - **Suggested Big 6 update:** `<section>` may need refresh - <signal>. Verify and edit MEMORY.<section> manually.
     ```

**Cost discipline.** No routine schema walk. AI investigates only when SESSION/conversation surfaces a signal, and verifies only the one specific delta. Cost scales with actual drift, not section count.

**Op details.** `update_section_text` needs strict-unique `find` + `replace` + required `rationale`. Optional `extended_find`/`extended_replace` mirror the swap into MEMORY_EXTENDED. `promote_to_section` prepends a new bullet to the section body.

## Step 6: Promotion (`-FULL` only)

Skip in default / `-SKIM`.

A LIFO entry promotes when **the rationale recurs, the user reinforces it, or it shapes how the next session should approach the project.** Auto-apply when the heuristic clears. If unsure, leave it in LIFO for next time.

Heuristic gate:

- Rationale surfaced in 2+ separate LIFO entries or SESSION events?
- User stated as a rule, not just a one-time choice?
- Would removing this knowledge make a fresh session redo work?

Shape determines target:

- **Fact-shaped** ("stack is X", "deploy goes to Y") -> Big 6 body
- **Rationale-shaped** ("chose X because Y", "always do Z because of W") -> qualified `### <Section> Decisions` sub-section

Auto-apply via `promote_to_section` with `target_section` and optional `target_decisions: true`. Anchored EXTENDED sub-section detail moves alongside if it still applies. Low volume by design - most `-FULL` runs auto-apply zero to three promotions.

Wrong promotions are corrected by user editing MEMORY directly. `-FULL` only adds content - it does not demote or undo prior static placements.

## Step 7: Commit

```bash
node AIDOCS/tools/memory.mjs validate --skill memory-update            # schema check
node AIDOCS/tools/memory.mjs commit   --skill memory-update --preview  # simulate + diff
node AIDOCS/tools/memory.mjs commit   --skill memory-update            # apply
```

Two-phase: simulate first, abort before any writes if any op fails. Auto-commits.

Common failures (all caught at simulation):

- Missing required field / unknown op -> fix staging shape
- `update_section_text` find no-match or multi-match -> adjust `find` for uniqueness, or pick a more specific surrounding context
- `update_section_text` missing rationale -> required - state the why
- Orphan `extended_anchor` -> ensure matching `extended_actions` entry
- Fenced code in an EXTENDED body (`body_md` / `extended_body_md` / `extended_decisions_md` / `extended_replace`) -> rejected, summarize the takeaway in prose
- `promote_to_section` / `gap_fill_section` / `update_section_text` outside `-FULL` -> mode mismatch (drop the attempt or escalate to `-FULL`)
- `target_section` outside the Big 6 -> check spelling
- Lockfile present -> wait, or remove `AIDOCS/tools/staging/.lock` if confirmed stale

## Step 8: AGENTS / auto-memory suggestion surface

AGENTS.md hard rules and auto-memory `feedback_*.md` files are user-scoped, not project-scoped. This skill never auto-writes them. When AI notices a pattern that suggests one should change, surface as a suggestive bullet in MEMORY LIFO (staged via the routine `lifo_insert` in Step 4):

```
- **Suggested for auto-memory:** `feedback_<name>.md` - <one-line rationale>
- **Suggested for AGENTS.md hard rules:** add link to `feedback_<name>.md` - <one-line rationale>
```

These bullets behave like any LIFO entry. User reads them and either acts (manually edits the target file) or lets them age out via standard LIFO prune. If the pattern keeps surfacing, AI re-emits the suggestion. If user consistently ignores, the bullet falls off the bottom of LIFO during prune.

**Auto-memory threshold (high bar):** would this preference plausibly still apply in a clean new session next week, on a different repo? If unclear, skip the suggestion. Lean toward writing when the user states a forward-time rule or repeatedly asks for a pattern that contradicts AI defaults.

**Acceptance signal:** when the user manually edits the target file, the next run notices the edit and removes the corresponding suggestion bullet. "User accepted" means "user took the action," not "user said yes in conversation."

## Rules (skill operation)

- **Default is no change.** Ruthless filter. Most sessions produce project work, not memory-track.
- **Auto-applies in `-FULL`.** No per-entry confirms for gap-fill or promotion. The heuristic gate is the decision gate. Wrong calls are corrected by user editing MEMORY directly.
- **User-confirm only for AGENTS / auto-memory.** Those surface as suggestive LIFO bullets. User edits the target file to accept.
- **Always-run chain.** Step 1 auto-invokes SessionUpdate. No "is SESSION stale?" heuristic.
- **Never write project-specific events.** SESSION's lane.
- **Code-applicable rules drop here.** DevAudit's lane.
