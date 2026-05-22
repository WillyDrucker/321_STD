---
name: setup
description: First-run wizard or migration for a 321_STD project, auto-detecting fresh-install vs existing-project. Thin pointer - reads and executes the onboarding runbook at INSTALL/engine/AIDOCS/runbooks/SETUP.md (fetched at install, removed by the reconcile pass at graduation). Fresh - Big 6 fill from code signals, release_profile, auto_memory.path, optional ENV + first commit. Migration - archive existing content, reinstall canonical 321_STD, capture losslessly, restore, set reconcile_pending and stop for /321 -Update. Idempotent.
---

# /321 -Setup

**Purpose:** Make a 321_STD project usable. Setup is a runbook owned by the ephemeral `INSTALL/` folder, not a steady skill - this body is a thin pointer that loads and runs it. The reconcile pass removes `INSTALL/` and deregisters `-Setup` once the project is steady.

## Run the onboarding runbook

1. **Locate the runbook.** The full Setup procedure lives at `INSTALL/engine/AIDOCS/runbooks/SETUP.md` (laid down by the install fetch).
2. **If it is missing** (a graduated project re-running Setup), re-fetch the onboarding engine first, then locate it again:

   ```bash
   node AIDOCS/tools/memory.mjs fetch-engine --repo https://github.com/WillyDrucker/321_STD.git
   ```

   Offline with no fetch available is a hard stop - report it. There is no local onboarding tier in a steady install by design.
3. **Read the runbook in full** with the `Read` tool, treat it as inlined, and **execute it** end-to-end. It owns mode detection (fresh vs migration), all step logic, and its own command sequences.

## Rules

- **No logic here.** This body must not duplicate the runbook. Read it and execute it.
- **The runbook is the source of truth** for every step, command, and backstop.
- **Graduation removes this.** After `/321 -Update` reconciles a migrated project, `-Setup` is deregistered and `INSTALL/` is gone. Re-setup later is a re-fetch.
