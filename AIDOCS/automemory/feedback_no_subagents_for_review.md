---
name: feedback-no-subagents-for-review
description: Review and audit work stays with the lead. Read the files yourself. A cross-model bridge is NOT a subagent and is encouraged.
metadata:
  type: feedback
---

- **Any investigative pass stays with you.** Reviews, audits, comparisons, "look at X" - read the files yourself with Read, Grep, and Glob. This holds even when the task spans several repos.
- **Do not delegate the analysis to a subagent.** No Explore, general-purpose, or Plan agents for review work, and **no narrow-lookup exception once the task is a review** - a location fetched blind still costs you the surrounding evidence, which is the whole point of the rule.
- **A cross-model bridge is NOT a subagent.** Asking Codex or another vendor's model to read the same evidence is a second independent reader, not a delegation, and it is encouraged on anything load-bearing. It has caught real defects the lead missed. Use it sparingly, and never block on it.

**Why:** a subagent hands back a second-hand synthesis that has already abstracted away the evidence, and the subtleties a direct read catches are exactly the ones that matter. A cross-model review is the opposite: a genuinely independent look at the same evidence.

**How to apply:** do the reading yourself, then send the bridge the same question and reconcile the two.
