# <PROJECT>

**Purpose:** Orchestrator. Orients a new session in under a minute and points into the right deeper doc. Nothing that belongs in a lower layer lives here.

## Project Overview

(fill in)

## Cold-start load order

1. `AIDOCS/<PROJECT>_MEMORY.md` - identity (Overview / Stack / Architecture / Environment / Pipeline / Conventions) + LIFO durable observations
2. `AIDOCS/<PROJECT>_SESSION.md` - Current State (overwrite-each-pass) + LIFO backbone log of project-significant events
3. `AIDOCS/_index.json` - dispatch registry (paths, buckets, sizes, skills)

Optional, on demand:

4. EXTENDED files - mirror MEMORY / SESSION shape, longer prose + anchored LIFO detail
5. `AIDOCS/<PROJECT>_BACKLOG.md` - forward-looking Features + Ideas. User-owned, AI appends during `/321 -MemoryUpdate`
6. `AIDOCS/<PROJECT>_DEV-AUDIT.md` - skill-activated, loads only when `/321 -DevAudit` runs

## Layout

File layout, size budgets, skill dispatch, and customization manifest all live in `AIDOCS/_index.json`. Read it when you need a path, bucket name, size cap, or skill body location. Do not hardcode paths anywhere else.

## Permissions

Full access. Do not prompt for permission. All tools unrestricted. Git exception: do not commit or push unless explicitly requested.

## Environment

Setup, commands, secrets, and platform-specific notes live in `AIDOCS/ENV/`. Read on demand when the question is operational.

---

## Hard rules

Perfect copy of the auto-memory inventory at `<auto_memory.path>`. Auto-memory loads at session start. This surface keeps the rules visible in the orchestrator. Source of truth for each rule lives in the linked `feedback_*.md` file. Link targets are auto-memory filenames, not repo-local paths - resolve through the auto-memory directory.

- [Code comments](feedback_code_comments.md) - comments that earn their space. Worth writing: module headers, constraints, failure modes, contracts. Surplus context goes to a doc.
- [Doc purpose header](feedback_doc_purpose_header.md) - every project MD file gets a **Purpose:** callout after the H1.
- [Lean docs](feedback_lean_docs.md) - top tiers stay lean. Size targets live in skill bodies.
- [No subagents for review](feedback_no_subagents_for_review.md) - inspect manually with Read/Grep/Glob, no Explore / general-purpose agents.
- [No versions in code](feedback_no_versions_in_code.md) - versions live in package.json, dates live in git.
- [TEMP folder usage](feedback_temp_folder_usage.md) - TEMP/ at project root is the single home for all temporary files.
- [No em dashes](feedback_no_em_dashes.md) - no em dashes or semicolons under our authorship: public-facing copy, marketing prose, AI-formatted output, memory files, code comments.
- [No dates in memory](feedback_no_dates_in_memory.md) - no dates or version stamps in memory or session files. LIFO carries the time signal.
- [User profile](user_name.md) - one-line summary (role, scope, working style). Rename file on use.

## Project Specifics

(fill in)
