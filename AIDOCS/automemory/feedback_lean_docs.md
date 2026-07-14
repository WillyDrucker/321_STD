---
name: feedback-lean-docs
description: Top-tier docs stay lean and detail cascades one tier down. AGENTS.md owns the read order. One coherent concern per auto-memory file.
metadata:
  type: feedback
---

Every tier holds only what that tier is for. Detail that does not carry forward belongs one tier down, not crowding the entry point. **AGENTS.md owns the read order** - do not restate it elsewhere.

- **AGENTS.md** is the orchestrator. Read order and permissions. Nothing that belongs lower.
- **MEMORY / SESSION** hold identity and the event backbone. Their EXTENDED files hold the depth that earns an anchor.
- **DEV-AUDIT** holds this project's measurable code contracts. **Auto-memory holds the always-on authoring rules.** A rule lives in exactly one of them, never both.
- **Auto-memory files** hold one coherent concern each.

Exact size targets and pruning policy live in the relevant skill bodies, not here.

**Why:** session start has a budget. A tier that balloons makes every cold start re-read stale specifics, and duplication across tiers is what lets a doc rot unnoticed while its copy stays right. A restated rule always drifts from its original.

**How to apply:** when an entry feels too long, ask "does this belong one tier down?" Then the keep-test: could a fresh session re-derive this from the code or from git? If yes, drop it.
