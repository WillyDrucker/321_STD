---
name: sync
flag: "-SYNC"
description: Refresh the project's engine code, skill bodies, router, manifest-driven structural changes, and canonical sections of project data file templates from its configured upstream. Reads engine.upstream, fetches, applies the manifest delta, copies engine-class paths with customization preservation, rebuilds dispatch, and runs doctor. Project content is never touched. Offline or no upstream is a clean no-op. The body is thin - load AIDOCS/tools/SYNC.md and run it.
---

# /321 -SYNC

**Purpose:** Refresh the project's engine and engine-managed canonical content from its configured upstream. This is the only sanctioned upgrade path, separate from the daily-driver `-Update` chain. The body is a thin dispatcher: the full flow lives in `AIDOCS/tools/SYNC.md` so the skill stays small and the substance is in the engine reference.

## Run

1. **Load the reference.** Read `AIDOCS/tools/SYNC.md`. That file owns the run order, operation types, customization rules, and edge cases.

2. **Execute it.** Follow the Run section there in order. Each step is a single engine command or a small decision. The reference is canonical (engine-managed), so a `-SYNC` run uses whatever version of SYNC.md is on disk at the start of the run.

3. **Report.** The reference ends with cleanup. After it completes, report what changed: operations applied (from the `upgrade` summary), files copied, doctor verdict. Anything the reference left as a manual note (post-graduation cleanup, customized sections it skipped) bubbles up to the user.

## Rules

- **Thin dispatcher.** This file does not duplicate the SYNC.md flow. If the flow changes, the change lands in SYNC.md and rides on the next upgrade. The skill body stays generic.
- **One reference, one engine command per step.** The flow there is a sequence of `engine.mjs` commands. The AI runs them and reads their output, not re-implements them.
- **Never run `-SessionUpdate` or `-MemoryUpdate` from here.** `-SYNC` is the upgrade path, not the daily driver. The daily-driver chain is `/321 -Update`.
