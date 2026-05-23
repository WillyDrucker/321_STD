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

## Hard rules

Mirror of the auto-memory inventory, so the rules stay visible in the orchestrator at session start and to agents without native memory loading. The runtime source of truth is Claude's native memory (the registry's `auto_memory.path`), seeded at install from `AIDOCS/automemory` (`auto_memory.seed`). Link targets are seed filenames - resolve them through `AIDOCS/automemory`.

- [Code comments](feedback_code_comments.md) - comments that earn their space. Worth writing: module headers, constraints, failure modes, contracts. Surplus context goes to a doc.
- [Doc purpose header](feedback_doc_purpose_header.md) - every project MD file gets a **Purpose:** callout after the H1.
- [Lean docs](feedback_lean_docs.md) - top tiers stay lean. Size targets live in skill bodies.
- [No subagents for review](feedback_no_subagents_for_review.md) - inspect manually with Read/Grep/Glob, no Explore / general-purpose agents.
- [No versions in code](feedback_no_versions_in_code.md) - versions live in package.json, dates live in git.
- [TEMP folder usage](feedback_temp_folder_usage.md) - TEMP/ at project root is the single home for all temporary files.
- [No em dashes](feedback_no_em_dashes.md) - no em dashes or semicolons under our authorship: public-facing copy, marketing prose, AI-formatted output, memory files, code comments.
- [No dates in memory](feedback_no_dates_in_memory.md) - no dates or version stamps in memory or session files. LIFO carries the time signal.
- [Naming and renaming](feedback_naming.md) - names state what a thing owns. Renames stay in-domain and move the name, its registry key, and every reference in one pass.
- [User profile](user_name.md) - one-line summary (role, scope, working style). Rename file on use.

## Project Specifics

(fill in)
