---
name: feedback-no-subagents-for-review
description: On code reviews, audits, comparisons, or investigative research, inspect files manually with Read/Grep/Glob. Do not delegate to Explore / general-purpose / Plan agents.
metadata:
  type: feedback
---

When the user asks for a "code review", "codebase review", "full audit", "look at X", "compare X to Y", or any investigative task on one of their own projects, do the inspection yourself with Read/Grep/Glob. Do not spawn Explore, general-purpose, or Plan agents for the research work - even when the task spans multiple codebases or directories.

**Why:** Subagent reports are second-hand syntheses that abstract away the evidence and miss subtleties direct reads catch. The rule covers any investigative pass on the user's projects, not just code reviews.

**How to apply:** On any review / audit / inspect / compare / look-at / consider request touching one of the user's own repos, work from the main conversation with direct file-reading tools. Parallelize tool calls where possible for speed, but keep the analysis in-session. Subagents are still fine for narrow targeted lookups ("find where X is defined") where the answer is a location, not an analysis.
