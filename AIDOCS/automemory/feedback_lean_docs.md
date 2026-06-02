---
name: feedback-lean-docs
description: Top-tier docs stay lean. Details cascade through tiers. Size targets live in the relevant skill bodies, not here.
metadata:
  type: feedback
---

Read-order tiers, top to bottom:

- `CLAUDE.md` / `AGENTS.md` - tight orchestrator + read order + hard rules. No detail.
- `AIDOCS/<PROJECT>_MEMORY.md` - identity static six + LIFO durable observations. Bullets only. No code rules.
- `AIDOCS/<PROJECT>_MEMORY_EXTENDED.md` - H3 anchored detail for MEMORY LIFO bullets that earn depth.
- `AIDOCS/<PROJECT>_SESSION.md` - Current State (overwrite-each-pass) + LIFO backbone log of project-significant events.
- `AIDOCS/<PROJECT>_SESSION_EXTENDED.md` - H3 anchored detail for SESSION LIFO bullets that earn depth.
- `AIDOCS/<PROJECT>_BACKLOG.md` - Features + Ideas LIFO. Forward-looking, user-owned.
- `AIDOCS/<PROJECT>_DEV-AUDIT.md` - code-applicable rules only (language conventions, comment specifics, lint patterns).
- Auto-memory files - one rule per file.

Exact size targets + pruning policy live in the relevant skill bodies (`/321 -UpdateSession`, `/321 -UpdateMemory`). This memory just states the tier ordering.

**Why:** Session start has to fit a budget. If a tier balloons beyond its window with detail that doesn't carry forward, a cold-start session re-reads pages of stale specifics. Detail belongs where it's still useful but doesn't crowd the entry point.

**How to apply:** When updating any tier, if an entry feels too long, ask "does this belong one tier down?" Fresh-session keep-test (applies to all tiers): would an AI starting cold on this project benefit from this content - is it load-bearing, critical context, or a non-obvious pain point? If yes, keep. If a fresh session can re-derive it from code or git, drop it.
