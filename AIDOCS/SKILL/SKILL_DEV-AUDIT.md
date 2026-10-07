---
name: devaudit
description: Audit the source against DEV-AUDIT.md. The skill is thin - the file is the contract. Default reports findings, -FULL applies fixes.
---

# /321 -DevAudit

**Purpose:** Audit the source against `<PROJECT>_DEV-AUDIT.md` (registry key `devaudit.audit`). **The skill is thin. The file is the contract.** This body deliberately does NOT describe the audit file's contents - a wrapper that restates its file drifts from it, and this one did: it promised a hard-rules inventory long after that block was deleted from the file.

## Modes

- **default** - audit the changed or relevant source, report findings, no edits.
- **-FULL** - audit broadly, then apply the fixes that clearly improve the code.

## Steps

1. **Measure first.** Run the project's scan when it has one (the audit file names the command): the size and folder census, the banned-pattern matrix, unreferenced exports, broken doc references, mojibake, byte-identical duplicates, and the house-voice scan over every authored doc. Never re-derive those by hand - the scan is faster, it does not miss, and a hand-grep has certified a sweep complete while missing relative paths. A project with no scan yet measures with the engine's `doctor` and `scrub` plus its gate command, and building the scan is the first `-FULL` pass's job.
2. **Read the audit file** (`devaudit.audit` in `_index.json`). It states its own anchors, contracts, and sanctioned exceptions. **Apply what it says, not what you remember it saying.** Its scope is the repo, not the source tree alone - docs break the anchor principles the same way code does.
3. **Walk what the scan cannot see.** The scan measures - it never judges. Correctness, invariant drift, duplicated rules, cohesion, and placement all need reading, with Read / Grep / Glob (no subagents - that is a hard rule). Scope to what changed in default mode: the diff from the last pass's base commit (the plan file names it) plus the working tree, since `git diff HEAD` reads empty the moment the work is committed. Sweep broadly in `-FULL`.
4. **Report** each finding as file, the contract it violates, and the fix. In `-FULL`, apply the clear ones and flag the judgment calls for the user.

## A second opinion (optional)

A pass may go out to a second reader through a cross-model bridge (not a subagent, and encouraged), and it need not. When it does: paste the scan output as the preamble and ask only for the layer no scan reaches (real defects, invariant drift, a rule living in two places, and anything you got wrong), name the sanctioned exceptions, and hand over the change list. Audit-only means the prompt names the ONE file it may write, under `TEMP/devaudit/`, created first and appended one `## ` section per area so a cut keeps the work, ending on `## Done`. Watch that file's headings, reuse the thread for a continuation, never re-issue a prompt after an abort, and read two payload-less turns as out of tokens. Its findings come back as CANDIDATES: one direct look at the primary source before acting on any.

## The trail

`TEMP/devaudit/` holds a pass's `AUDIT-PLAN.md` (the base commit and every batch), `AUDIT-FINDINGS.md`, the user's review file, and the second reader's file. Batch and finding ids never reach code, comments, tests, or project docs.

## Rules

- **The file is the source of truth.** If a rule is not in the audit file, it is not in scope for this skill. **Never audit from memory of an older version.**
- **A sanctioned exception is not a finding.** The audit file lists them explicitly, precisely so a sweep stops re-flagging them every pass. A finding examined and declined belongs in its Open findings section, not in the next report.
- **A gate, not iteration guidance.** The audit judges the result, it does not narrate the process.
