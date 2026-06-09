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

## Step 0: Gather context

The conversation is the source of truth. SESSION.md is a write target, not a source. Re-read if not already in context:

- `AIDOCS/<PROJECT>_SESSION.md`
- Git: `git branch --show-current`, `git status --short`, `git log --oneline -10`
- The skill's watermark in `state.json` (`updatesession.last_committed_at`) marks the last refresh.

## Step 1: Allocate each finding

| Item | Destination | Op |
|---|---|---|
| Current operational reality (branch, deploy, gates, focus, stack) | Current State | `overwrite_section` |
| Project-significant event (change, decision, finding, friction, milestone, failed attempt) | LIFO | `lifo_insert` |
| Forward-looking work, durable rule, code-applicable pattern | DROP - belongs in `-UpdateMemory` / `-DevAudit` | (n/a) |

**Migration exception:** when the `-Setup` migration capture drives this skill (migration mode), capture additively - the DROP row and arc-level aggregation are routine-run rules, not migration ones. Ambiguous-home content routes to SESSION LIFO rather than dropping. `migrate-import` has already scavenged the archived SESSION_EXTENDED depth 1:1, so do not re-derive those entries - add only Current State and the main LIFO bullets the import did not carry. The reconciliation pass distills the additive capture later.

## Step 2: Stage

Write `AIDOCS/tools/staging/updatesession.json`. Never edit SESSION directly. Actions use the project's domain-owned file keys:

```json
{
  "actions": [
    { "op": "overwrite_section", "file": "updatesession.session", "section": "Current State", "body": "<operational snapshot>" },
    { "op": "lifo_insert", "file": "updatesession.session", "section": "LIFO", "bullet": "<one project-significant event>" },
    { "op": "lifo_insert", "file": "updatesession.session", "section": "LIFO", "bullet": "<event that earns depth>", "extended_anchor": "<slug-of-the-bullet>" },
    { "op": "add", "file": "updatesession.session_extended", "anchor": "<slug-of-the-bullet>", "heading": "<event that earns depth>", "body_md": "<why / how / what surprised us>" }
  ]
}
```

**LIFO ordering rule.** Each `lifo_insert` PREPENDS to the section, so the LAST insert in `actions` ends up on top. **List this run's events oldest-first** in the actions array so the newest one (last in list) lands on top of LIFO. `overwrite_section` replaces the whole Current State body.

**`slugify` for `[+]` anchors.** The validator pairs a `[+]` bullet with its extended sub-section by comparing `slugify(bullet)` to `slugify(heading)`. `slugify` lowercases, strips every character except `[a-z0-9\s-]`, trims, and collapses whitespace runs to single hyphens. Existing hyphens survive. So a punctuation-heavy bullet ("Decision: pick X (over Y)") slugifies to "decision-pick-x-over-y". **Keep `[+]` bullets short and punctuation-light** - put the detail in `body_md` instead.

**Extended detail (the `[+]` pair).** When a bullet needs more than a line or two of narrative, pair it: set `extended_anchor` on the `lifo_insert` (the engine renders `- [+] <bullet>`, no link) and emit an `add` on `updatesession.session_extended` whose `heading` is the same bullet text. The `anchor` must equal `slugify` of both the bullet and the heading - that shared slug is how the engine pairs them. Use `drop` / `replace` (by anchor) to edit an existing sub-section. Keep `body_md` prose - no code fences (the validator rejects them, code lives in source). A `[+]` bullet with no matching sub-section fails commit (the orphan check), so always pair them.

**Body length (the maximum, not the target).** Aim for **3-6 non-blank lines of body prose** for a normal entry. The hard ceiling is **10 lines for a critical entry** that genuinely earns the depth. These are caps, not targets - if you can summarize the why in 3 lines, do that. Doctor's sub-section budget check warns at >10 body lines. A genuinely load-bearing entry (a catalog, an exception list, content where compression would lose the point) marks itself with `<!-- LOAD_BEARING -->` anywhere in the body to opt out of the cap forever. Use the marker rarely - it is for content that cannot summarize, not for narrative you do not feel like trimming.

**Last State (engine-written).** On an `overwrite_section` of Current State, the engine demotes the prior snapshot's bullets to the top of LIFO and marks the first `**Last State:**` (stripping any prior marker, so exactly one exists). Put the Current State overwrite first in `actions` so this run's new LIFO events land above the marker. Never write the marker yourself.

## Step 3: Commit (validate is optional)

```bash
node AIDOCS/tools/engine.mjs commit --skill updatesession
```

`commit` runs the validator AND simulates every op first, aborting before any write on failure. So a standalone `validate` is optional - skip it on a confident draft. Use `validate --skill updatesession` only while iterating on a draft you expect to fail. The two-phase commit then persists, stamps the watermark, and clears staging. Relay the summary.

## Lean execution path (one pass, no extra machinery)

1. Skim the conversation tail since the watermark. Read only this skill body plus the live `<PROJECT>_SESSION.md`. **Do NOT read SESSION_EXTENDED unless an op is `drop` / `replace` against an existing sub-section** - an `add` needs no prior read.
2. Author the staging JSON directly with the file writer at `AIDOCS/tools/staging/updatesession.json`. Do not build a generator script to emit it - the staging file IS the artifact.
3. `commit` once. Skip standalone `validate` - `commit` re-validates and simulates and fails safe.
4. Target: read 2 files, write 1 staging file, commit 1. Zero engine source, zero scratch scripts.

## -FULL mode

`-UpdateSession -FULL` rebuilds SESSION from the full conversation rather than the incremental tail. Re-derive Current State from current operational reality, do not trust the prior snapshot, and re-walk LIFO from significant events rather than appending. Use when SESSION has drifted (a long pause, a context switch, an interrupted prior pass).

The lean default appends from the conversation tail since the last watermark. `-FULL` ignores the watermark and re-derives from the whole conversation.

**Re-summarize over-cap EXTENDED entries.** When `-FULL` re-walks an existing `[+]` entry whose EXTENDED body exceeds the cap (>6 normal lines, >10 critical), re-derive the entry under cap and `replace` its sub-section (by anchor) - do not let pre-existing bloat carry through. Doctor's sub-section budget warns at >10 body lines, and the warning is the trigger to summarize on the next pass. A genuinely load-bearing entry marks itself `<!-- LOAD_BEARING -->` and rides the warning forever.

## Rules

- **You are logging project history.** Future-session usefulness is the bar.
- **Capture SESSION raw.** `-UpdateMemory` distills the abstracted lesson later.
- **Arc-level, not iteration-level.** One entry per arc. End-state captures the journey.
- **Staging only.** Never edit SESSION by hand - validate then commit.
- **Project work only.** BACKLOG, MEMORY static, CHANGELOG, and code patterns route through their own skills.
