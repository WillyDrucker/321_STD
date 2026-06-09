---
name: updatesession
description: Refresh SESSION (Current State + LIFO) from this conversation. The project-history backbone log. Writes through the staging pipeline (validate + commit). BACKLOG, MEMORY static, and CHANGELOG belong to other skills.
---

# /321 -UpdateSession

**Purpose:** Refresh `<PROJECT>_SESSION.md` from this conversation. SESSION is the project's backbone log - the running history of everything project-significant. Standalone or delegated from `-Update`. Writes only through the staging pipeline, never by direct edit.

## You drive the log

You are logging project history for future sessions. For each turn ask: **would a future contributor want to find this when reading SESSION as the project's record?**

Suggests capture:
- Something changed (files, schema, behavior, structure)
- A decision was made or reversed
- A finding worth keeping (audit result, review outcome, external fact)
- Friction notable enough to inform future work
- A milestone hit, or the user signaled significance

Suggests drop:
- Formatting / typo / whitespace fixes
- Exploration without commitment
- Conversation acknowledgments and tool-load confirmations
- One-off info-gathering with no lasting effect
- Already captured (dedupe)

Scale with significance, not raw event count. Many iterations on one feature collapse to a few entries (the key arc). Judge by what a future reader needs, not a target number.

## Granularity (arc-level, not iteration-level)

- **Aggregate the related** into one entry, not many.
- **End-state captures the journey.** Intermediate "started X" entries are redundant once "finished X" lands.
- **So-what test.** Would a future session say "so what?" Drop on "so what."

## Event vs state (the duplication rule)

SESSION captures events as they happen. MEMORY captures the timeless state events imply. The same fact often produces entries in both, framings stay distinct:

| SESSION (event lens) | MEMORY (state lens) |
|---|---|
| "Picked X over Y after testing Z" | "We use X for Z-shaped problems" |
| "Friction with Y on Windows paths" | "Y has cross-platform path issues - use Z" |

**Capture SESSION raw.** Do not pre-filter to avoid overlap with MEMORY. Log the event. `-UpdateMemory` distills the abstracted lesson later. When uncertain, default SESSION raw.

## SESSION shape

- **Current State** - operational snapshot, overwritten each pass. Branch, deploy / gate status, active focus, stack, local dev. Flat bullets or short prose.
- **LIFO** - running history of project-significant events, newest first.

## Step 0: Gather context (watermark scopes the read)

The conversation is the source of truth. SESSION.md is a write target and the dedupe reference. **The watermark is your starting point. Do NOT re-read the conversation prefix before it unless `-FULL` was passed.**

- `AIDOCS/<PROJECT>_SESSION.md` (the live file, the dedupe reference)
- Git: `git branch --show-current`, `git status --short`, `git log --oneline -10`
- `node AIDOCS/tools/engine.mjs watermark --skill updatesession` (prints `last_committed_at` plus the slugs of the last run's captured bullets, on demand)

The watermark answers "what did I capture last time?" The live SESSION.md shows the captured arcs as content. Both let you skip events the previous pass already logged.

## Step 1: Allocate each finding

| Item | Destination | Op |
|---|---|---|
| Current operational reality (branch, deploy, gates, focus, stack) | Current State | `overwrite_section` |
| Project-significant event (change, decision, finding, friction, milestone, failed attempt) | LIFO | `lifo_insert` |
| Forward-looking work, durable rule, code-applicable pattern | DROP - belongs in `-UpdateMemory` / `-DevAudit` | (n/a) |

**Migration exception:** when the `-Setup` migration capture drives this skill (migration mode), capture additively - the DROP row and arc-level aggregation are routine-run rules, not migration ones. Ambiguous-home content routes to SESSION LIFO rather than dropping. `migrate-import` has already scavenged the archived SESSION_EXTENDED depth 1:1, so do not re-derive those entries - add only Current State and the main LIFO bullets the import did not carry. The reconciliation pass distills the additive capture later.

## Step 2: Stage

Write `AIDOCS/tools/staging/updatesession.json`. The staging contract (action shapes, LIFO ordering, `[+]` paired bullets, `slugify`, body cap, `LOAD_BEARING`) lives in `AIDOCS/tools/PATTERN-STAGING.md`. Read it once per session if you do not already have it in context.

The skill-specific notes:

- **Domain firewall.** This skill writes only to `updatesession.session` and `updatesession.session_extended`.
- **Current State.** Use `overwrite_section` on `Current State`. Put it FIRST in `actions` so the engine demotes the prior snapshot's bullets to the top of LIFO and stamps the `**Last State:**` marker before this run's new events land above it. Never write the marker yourself.
- **LIFO events.** Use `lifo_insert` on section `LIFO`. List the run's events oldest-first in `actions` so the newest one lands on top.
- **Earned depth.** Pair a bullet with an `add` on `updatesession.session_extended` when it needs more than a line or two. Keep bullets short and punctuation-light (the `slugify` rule).

## Step 3: Commit

```bash
node AIDOCS/tools/engine.mjs commit --skill updatesession
```

`commit` validates, simulates, persists, stamps the watermark (timestamp + this run's bullet fingerprints), and clears staging. A standalone `validate` is optional - use it only while iterating on a draft you expect to fail.

## Lean execution path (one pass, no extra machinery)

1. Skim the conversation tail since the watermark. Do **not** re-read the prefix. Read this skill body plus the live `<PROJECT>_SESSION.md`. The PATTERN-STAGING reference loads on demand if you need the staging contract.
2. **Do NOT read SESSION_EXTENDED unless an op is `drop` / `replace` against an existing sub-section.** An `add` carries the heading, anchor, and body, so it needs no prior read.
3. Author the staging JSON directly at `AIDOCS/tools/staging/updatesession.json`. The staging file IS the artifact.
4. `commit` once. Skip standalone `validate`. Target: read 2 files, write 1 staging file, commit 1. Zero engine source, zero scratch scripts.

## -FULL mode

`-UpdateSession -FULL` widens the read past the watermark, but **uses the existing SESSION.md bullets as a starting reference, not a discard.** Most arcs are already captured. Walk the conversation against the existing bullets and look for: gaps (an arc that did not land), drift (a bullet whose framing is now stale), and over-cap EXTENDED bodies (a sub-section that grew past the cap and needs re-summarizing).

- Re-derive Current State from current operational reality, the prior snapshot is suspect under `-FULL`.
- Add missing arcs. Correct drift with `replace` (by anchor) rather than re-writing the whole LIFO.
- For over-cap EXTENDED entries, re-derive under cap and `replace` the sub-section. A genuinely load-bearing entry marks itself `<!-- LOAD_BEARING -->` and rides the warning forever.

Use `-FULL` when SESSION has drifted (a long pause, a context switch, an interrupted prior pass). The lean default appends from the conversation tail and trusts the prior snapshot.

## Rules

- **You are logging project history.** Future-session usefulness is the bar.
- **Capture SESSION raw.** `-UpdateMemory` distills the abstracted lesson later.
- **Arc-level, not iteration-level.** One entry per arc. End-state captures the journey.
- **Staging only.** Never edit SESSION by hand - validate then commit.
- **Project work only.** BACKLOG, MEMORY static, CHANGELOG, and code patterns route through their own skills.
