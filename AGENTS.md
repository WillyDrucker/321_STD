# PROJECTNAME

**Purpose:** Orchestrator. Orients a new session in under a minute and points into the right deeper doc. Nothing that belongs in a lower layer lives here.

## Project Overview

(fill in)

## Cold-start load order

1. `AIDOCS/PROJECTNAME_MEMORY.md` - identity (Overview / Stack / Architecture / Environment / Pipeline / Conventions) plus LIFO durable observations
2. `AIDOCS/PROJECTNAME_SESSION.md` - Current State (overwrite each pass) plus the LIFO backbone log of project-significant events
3. `AIDOCS/_index.json` - registry (paths, file keys, buckets, size budgets, skill dispatch)

Optional, on demand:

4. EXTENDED files - `AIDOCS/PROJECTNAME_MEMORY_EXTENDED.md` / `AIDOCS/PROJECTNAME_SESSION_EXTENDED.md`, longer prose plus anchored LIFO detail
5. `AIDOCS/PROJECTNAME_BACKLOG.md` - forward-looking Features plus Ideas
6. `AIDOCS/PROJECTNAME_DEV-AUDIT.md` - code-standards audit, loads on demand

## Layout

File layout, size budgets, and skill dispatch all live in `AIDOCS/_index.json`. Read it when you need a path, file key, bucket name, or size cap. Do not hardcode paths anywhere else.

## Permissions

Full access. Do not prompt for permission. Git exception: do not commit or push unless explicitly requested.

## Environment

Setup, commands, secrets, and platform notes live in `AIDOCS/ENV/`. Read on demand when the question is operational.

## Authoring rules

The always-on rules (comments, naming, casing, house voice, where scratch goes) live in auto-memory. **They are not mirrored here.** A rule restated in two places drifts in one of them, and the copy is always the one that rots.

- **Claude loads them automatically** from the runtime at `auto_memory.path` (see `AIDOCS/_index.json`). Nothing to do.
- **Every other agent must load them explicitly.** If you are not Claude, or you are not sure, **read `AIDOCS/automemory/MEMORY.md` now and then read each rule file it links.** That index is the full inventory. Skipping it means writing in the wrong voice and breaking rules you were never shown.

This is a pointer, not a copy. It cannot drift.

Measurable code contracts for this project live in `AIDOCS/PROJECTNAME_DEV-AUDIT.md`, loaded on demand by `/321 -DevAudit`.

## Project Specifics

(fill in)
