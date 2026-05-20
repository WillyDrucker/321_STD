---
name: dev-audit
description: Code audit against <PROJECT>_DEV-AUDIT.md. Modes - default, -READ, -FULL. No build / test gates here. AutoPush owns those.
---

# /321 -DevAudit

**Purpose:** Code audit. Loads `<PROJECT>_DEV-AUDIT.md` and walks source against its dimensions. Runnable at any cadence - no build, test, or type-check gates inside this skill.

**Manual invocation only.** Never runs at session start. Frequent use is expected and supported.

## You drive the audit

DEV-AUDIT is the rules source. You read it cold each run, walk the source, classify findings. Severity is your judgment. Confidence-gate every deletion.

## Modes

| Mode | What it does | When to use |
|---|---|---|
| default | Walk + classify + fix. | Routine audit. After a feature lands. |
| `-READ` | Walk + classify + report. No fixes applied. | Onboarding. Resuming after a gap. Dry-run audit. |
| `-FULL` | Default + cohesion-aware refactor. Applies clear splits, flags broad or risky ones. | After major surface changes. Before a release. |

Script side: none. Build / test / type-check gates live in `/321 -AutoPush`.

## Step 0: Parse flag + load reference

Determine mode. Output it at start.

Read `AIDOCS/<PROJECT>_DEV-AUDIT.md` in full. Verify auto-memory inventory is in context (cold-start load order). DEV-AUDIT is authoritative. If a rule needs to change, edit it there first. The skill picks it up next run.

## Step 1: Walk source

Walk the source tree. For each file, apply every Audit dimension in DEV-AUDIT. Classify findings by severity: blocker (ship-stopper), smell (worth fixing), note (acceptable, log it).

Sweeps that span multiple files run once per audit per DEV-AUDIT direction.

On `-READ`: stop here. Output Step 5 summary. Apply nothing.

## Step 2: Apply fixes (default + `-FULL`)

| Severity | default | `-FULL` |
|---|---|---|
| Blocker | fix | fix |
| Smell | fix if safe, propose otherwise | fix |
| Note | log | log |

Safe fixes: unused imports, obvious dedup, local rename, history / narration comment strip, magic-number extraction. Skip anything uncertain - flag instead.

Confidence-gate deletions. Unsure if dead means leave and flag.

## Step 3: External lookups (targeted)

When the walk surfaces uncertain API usage, deprecated patterns, or modern alternatives worth applying, query the relevant docs (Context7, MDN, platform SDK). Targeted only. Do not pre-emptively scan.

If a modern pattern improves a file meaningfully, apply it. Otherwise surface it in Step 5 suggestions.

## Step 4: Cohesion-aware refactor (`-FULL` only)

Identify files over 300 lines (the `-FULL` cohesion sweep threshold defined in DEV-AUDIT Code structure). For each:

1. Single clear purpose? Yes - leave it.
2. Concerns genuinely independent (no shared state, no cross-imports)? Yes - split candidate.
3. Would splitting reduce or increase cognitive load? Reduce - propose.

Never split to hit a number. Cohesion wins. Apply a split when the cohesion case is clear, flag the broad or uncertain ones for the user instead of executing blind. Skip on any "no". Output a per-file verdict for every file above threshold.

## Step 5: Output + suggestions

```
/321 -DevAudit <MODE> complete.

Findings:
  Blockers:  <count> (<file:line list>)
  Smells:    <count>
  Notes:     <count>

Fixes applied:    <count> (<file list>)
Fixes proposed:   <count> (<list>)
Files refactored: <list, empty unless -FULL>
External lookups: <count> (<libraries queried>)
```

DEV-AUDIT update suggestions (compile, do not auto-edit):

```
DEV-AUDIT suggestions (not applied):
- <suggestion 1>
- <suggestion 2>
```

No cross-track flags. DevAudit scans the codebase independently. If this run surfaces architecture or project work alongside code findings, the user invokes `/321 -Update` separately - DevAudit does not gate or signal other skills.

## Rules (skill operation)

- **DEV-AUDIT is the source of truth.** Rules, thresholds, dimensions live there. This skill is operational.
- **No build / test gates here.** AutoPush owns ship-pipeline gates.
- **Audit is a gate, not workflow.** Mid-iteration finds flag, do not fix.
- **Confidence-gate deletions.** Unsure means leave and flag.
- **No staging pipeline.** Direct Edit / Write for code. AI judgment owns severity.
