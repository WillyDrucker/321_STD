---
name: 321
description: Router for the /321 skill family. Dispatches by flag - -Setup, -SessionUpdate, -MemoryUpdate, -Update, -DevAudit, -AutoPush. Loads the matching sub-skill body from AIDOCS/_index.json.
---

# /321

**Purpose:** Single entry point for the /321 skill family. The user invokes `/321 -<Flag>` and this router resolves the flag against `AIDOCS/_index.json -> skills.dispatch`, then loads the sub-skill body and executes it.

## How to invoke

```
/321 -Setup                      fresh-install wizard, or migration (archives + captures the prior project raw, sets reconcile_pending for /321 -Update)
/321 -SessionUpdate              refresh SESSION (Current State + LIFO) + SESSION_EXTENDED
/321 -SessionUpdate -FULL        also verify Current State against project state
/321 -MemoryUpdate               append durable observations to MEMORY LIFO + BACKLOG
/321 -MemoryUpdate -FULL         also run Big 6 maintenance (gap-fill / refine / replace) + LIFO-to-static promotion
/321 -Update                     chain SessionUpdate then MemoryUpdate (mode flag passes through to each)
/321 -DevAudit                   audit source against DEV-AUDIT (default)
/321 -DevAudit -READ             load DEV-AUDIT + walk codebase, no fixes
/321 -DevAudit -FULL             audit + cohesion-aware refactor
/321 -AutoPush                   release pipeline. Delegates to SessionUpdate. Sole writer of CHANGELOG (composed at release)
/321 -AutoPush -SKIM | -FULL     release pipeline with SessionUpdate in that mode
```

`/321` alone prints this usage block.

## Dispatch

1. Parse the flag. First token after `/321` is the primary flag. Subsequent tokens (`-READ`, `-FULL`, `-SKIM`) pass through.
2. Look up `skills.dispatch.<skill>.body` in `AIDOCS/_index.json`.
3. Load the body. Treat as inlined.
4. Execute. The body owns its own flag parsing for sub-modes.

Unknown flag -> list available sub-skills and exit. Do not guess.

## Registry (canonical: `AIDOCS/_index.json -> skills.dispatch`)

| Flag | Body | Modes |
|---|---|---|
| `-Setup` | `AIDOCS/SKILL/SKILL_SETUP.md` | default |
| `-SessionUpdate` | `AIDOCS/SKILL/SKILL_SESSION-UPDATE.md` | default, `-SKIM`, `-FULL` |
| `-MemoryUpdate` | `AIDOCS/SKILL/SKILL_MEMORY-UPDATE.md` | default, `-SKIM`, `-FULL` |
| `-Update` | `AIDOCS/SKILL/SKILL_UPDATE.md` | default, `-SKIM`, `-FULL` |
| `-DevAudit` | `AIDOCS/SKILL/SKILL_DEV-AUDIT.md` | default, `-READ`, `-FULL` |
| `-AutoPush` | `AIDOCS/SKILL/SKILL_AUTO-PUSH.md` | default, `-SKIM`, `-FULL` |

Downstream projects customize a skill by editing its `AIDOCS/SKILL/SKILL_<NAME>.md` body and recording it in `_index.json customizations[]` (with `applies_to` naming the body). That entry tells `init` to preserve the customized body on an engine update instead of overwriting it.

## Rules (router operation)

- **Resolve and load.** The router does not duplicate sub-skill logic.
- **Pass through flags verbatim.** Each body owns its mode parsing.
- **Body paths come from `_index.json`.** Do not hardcode here.
