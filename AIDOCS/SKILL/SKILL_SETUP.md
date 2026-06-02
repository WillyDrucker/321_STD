---
name: setup
description: Make a project usable. Auto-detects fresh-install vs migration. Fresh fills the Big 6 from code signals through the normal skills. Migration archives existing content, reinstalls the canonical structure, captures it back, and sets the reconcile gate for -Update. Deregistered at graduation.
---

# /321 -Setup

**Purpose:** Make a project usable after install. The onboarding runner reads `INSTALL/setup.md` and executes it. Depth lives in the runbook, this body just drives it. Deregistered when the project graduates.

## Run

1. Read `INSTALL/setup.md`. Treat it as inlined.
2. Execute it step by step - detect mode (fresh vs migration), then follow that path.
3. Stop where the runbook stops, at the reconcile gate. Migration sets `reconcile_pending` and hands off to `/321 -Update`. Do not distill or graduate here.

If `INSTALL/setup.md` is absent, the project has graduated (onboarding torn down). Report that and stop.

## Rules

- **The runbook is the source of truth.** This body does not duplicate its steps - read and follow `INSTALL/setup.md`.
- **Hard stop at the gate.** Setup captures, it does not distill. Reconcile and graduation are the `-Update` pass.
- **Migration biases safe.** Archive first, nothing deleted - the `SETUP_ARCHIVE` is the recovery net.
