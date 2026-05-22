---
name: devaudit
description: Audit the source against DEV-AUDIT.md - anchor principles, hard rules, audit dimensions, project specifics. The skill is thin, with the substance in the audit file, which setup / reconcile enrich over time. Default reports findings, -FULL audits and refactors.
---

# /321 -DevAudit

**Purpose:** Audit the source against `<PROJECT>_DEV-AUDIT.md` (registry key `devaudit.audit`). The skill is deliberately thin - it loads the audit file and applies it. The substance lives in that file: anchor principles, the hard-rules inventory mirrored from auto-memory, the audit dimensions, and the project's own `## Project specifics`, which the setup and reconcile phases enrich as conventions settle.

## Modes

- **default** - audit the changed / relevant source against the file, report findings, no edits.
- **-FULL** - audit, then apply cohesion-aware refactors where they clearly improve the code.

## Step 1: Load the audit

Read the DEV-AUDIT file (`devaudit.audit` in `_index.json`). Its anchor principles override the individual rules. The hard-rules block mirrors the auto-memory inventory - apply it whether or not auto-memory loaded.

## Step 2: Walk the source

Inspect manually with Read / Grep / Glob (no subagents - that is a hard rule). Check against the audit dimensions in the file: code structure (sizes, cohesion, dead exports), file organization (one-way deps), naming (domain-owned, no dumping grounds), comments policy, modern patterns. Scope to what changed in default mode. Sweep broadly in -FULL.

## Step 3: Report, or fix in -FULL

Report each finding as file, the dimension violated, and the fix. In -FULL, apply the fixes that clearly improve cohesion / naming / structure and flag the judgment calls for the user. Never split a cohesive file just to hit a line count - the anchor principles win.

## Rules

- **The file is the source of truth.** The skill stays thin. The rules live in `DEV-AUDIT.md`, enriched at setup / reconcile.
- **Manual inspection only.** Read / Grep / Glob, never Explore / general-purpose agents.
- **Anchor principles override.** Cohesion over count, a name is a contract, one canonical home per concern.
- **A gate, not iteration guidance.** The audit judges the result, it does not narrate the process.
