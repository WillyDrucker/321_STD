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

1. **Read the audit file** (`devaudit.audit` in `_index.json`). It states its own anchors, contracts, and sanctioned exceptions. **Apply what it says, not what you remember it saying.**
2. **Walk the source** with Read / Grep / Glob (no subagents - that is a hard rule). Scope to what changed in default mode, sweep broadly in `-FULL`.
3. **Report** each finding as file, the contract it violates, and the fix. In `-FULL`, apply the clear ones and flag the judgment calls for the user.

## Rules

- **The file is the source of truth.** If a rule is not in the audit file, it is not in scope for this skill. **Never audit from memory of an older version.**
- **A sanctioned exception is not a finding.** The audit file lists them explicitly, precisely so a sweep stops re-flagging them every pass. A finding examined and declined belongs in its Open findings section, not in the next report.
- **A gate, not iteration guidance.** The audit judges the result, it does not narrate the process.
