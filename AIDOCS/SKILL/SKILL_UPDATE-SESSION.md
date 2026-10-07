---
name: updatesession
description: Refresh SESSION (Current State + LIFO) from this conversation. The project-history backbone log. Writes through the staging pipeline (validate + commit). BACKLOG and MEMORY static belong to -UpdateMemory. A user-facing change lands its CHANGELOG line here.
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
- `node AIDOCS/tools/engine.mjs watermark --skill updatesession` (prints `last_committed_at` plus `recent_captured`, a rolling window of the slugs from the last few commits, on demand)
- **MEASURE, do not remember.** Every number in Current State that a command can produce comes from the command on THIS run - never carried forward from the prior snapshot and never retyped from memory. Suite and case counts, file counts, the largest file, and the doctor score all drift at once precisely when they are hand-maintained. Where the project has them: its audit scan for the static census, its gate command for the real pass/fail, its doctor for the dependency verdict. A number you did not measure this run does not go in the snapshot.

The watermark answers "did I capture this arc in the last few runs?" The live SESSION.md shows the captured arcs as content. Both let you skip events the previous passes already logged.

## Step 1: Allocate each finding

| Item | Destination | Op |
|---|---|---|
| Current operational reality (branch, deploy, gates, focus, stack) | Current State | `overwrite_section` |
| Project-significant event (change, decision, finding, friction, milestone, failed attempt) | LIFO | `lifo_insert` |
| A Current State or LIFO bullet this run proved wrong, with the rest of its section still true | that bullet, in place | `amend_bullet` |
| A user-facing change the project's users would notice (a new verb, a changed face, a fix they felt) | CHANGELOG, the newest block's Added, Changed, or Fixed | `changelog_insert` |
| Forward-looking work, durable rule, code-applicable pattern | DROP - belongs in `-UpdateMemory` / `-DevAudit` | (n/a) |

**Migration exception (Setup-driven capture only, never on a graduated project):** capture additively (the DROP row and arc-level aggregation are routine-run rules), route ambiguous content to SESSION LIFO, and do not re-derive the SESSION_EXTENDED entries `migrate-import` already scavenged - add only Current State and the bullets the import missed. Full steps in `INSTALL/setup.md`.

## Step 2: Stage

Write `AIDOCS/tools/staging/updatesession.json`. The staging contract (action shapes, LIFO ordering, `[+]` paired bullets, `slugify`, body cap, `LOAD_BEARING`) lives in `AIDOCS/tools/PATTERN-STAGING.md`. Read it once per session if you do not already have it in context.

The skill-specific notes:

- **Domain firewall.** This skill writes only to `updatesession.session`, `updatesession.session_extended`, and `updatesession.changelog`.
- **Current State.** Use `overwrite_section` on `Current State`. **Overwrite means overwrite - the outgoing snapshot is DISCARDED, never demoted into LIFO.** Measured values are re-measured, not copied across (see Step 0): the fastest way to write a lie is to carry a number forward because the sentence around it still reads true. State that was true once is not an event, and demoting it is what made SESSION assert a dead stack through an entire framework migration. If a fact in the outgoing snapshot genuinely BECAME an event ("moved off the dual version source"), emit that as one `lifo_insert` **by judgment**. Never the raw snapshot.
- **LIFO events.** Use `lifo_insert` on section `LIFO`. List the run's events oldest-first in `actions` so the newest one lands on top.
- **Earned depth.** Pair a bullet with an `add` on `updatesession.session_extended` when it needs more than a line or two. Keep bullets short and punctuation-light (the `slugify` rule).
- **Targeted edits.** `amend_bullet` rewrites ONE bullet in place, found by its opening words or its slug (`match`), keeping its seat and its `[+]` marker. Reach for it when one bullet is wrong and the section is right: a re-emitted Current State is the expensive way to fix one line, and a newer LIFO bullet over an older wrong one is no fix at all. Amending a `[+]` bullet changes its anchor, so pair a `drop` and an `add` on the EXTENDED sub-section.
- **CHANGELOG.** `changelog_insert` lands a line under the newest `## [version]` block's `### Added`, `### Changed`, or `### Fixed` (opening `## [Unreleased]` when the file has no block yet), newest first, in the voice the file's header states (you and your, a bold lead, no version or file names). One line per change a user would notice, in the same pass that logs it, so the release lane dates the block and never reconstructs the lines.

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
- Add missing arcs with `lifo_insert` as the lean default would. A main-LIFO bullet that drifted takes `amend_bullet` (one bullet, in place), and `overwrite_section` rewrites the whole LIFO. Reach for `overwrite_section` only when the LIFO has genuinely diverged enough to justify the full rewrite. Otherwise leave drifted bullets alone, since the depth content is where `-FULL`'s real value lands.
- For depth drift (`### sub-section` body bloated or stale) and over-cap EXTENDED entries, re-derive under cap and `replace` the sub-section by anchor (this is where `replace` belongs - EXTENDED only). A genuinely load-bearing entry marks itself `<!-- LOAD_BEARING -->` and rides the warning forever.

Use `-FULL` when SESSION has drifted (a long pause, a context switch, an interrupted prior pass). The lean default appends from the conversation tail and trusts the prior snapshot.

## Rules

- **You are logging project history.** Future-session usefulness is the bar.
- **Capture SESSION raw.** `-UpdateMemory` distills the abstracted lesson later.
- **Arc-level, not iteration-level.** One entry per arc. End-state captures the journey.
- **Staging only.** Never hand-edit SESSION content - validate then commit. The sole exception is a mechanical house-voice fix (an em dash, a clause-joining semicolon) via `scrub --fix --semicolons`, which rewrites voice without touching captured content or the watermark.
- **Project work only.** BACKLOG, MEMORY static, and code patterns route through their own skills. CHANGELOG's user-facing lines land here through `changelog_insert`, and the release lane dates the block.
