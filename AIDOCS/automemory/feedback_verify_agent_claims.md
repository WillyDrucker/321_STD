---
name: verify-agent-claims
description: Agent and reviewer findings are candidates, not facts. Re-verify any non-obvious claim against the source yourself before acting on it or reporting it.
metadata:
  type: feedback
---

Subagent and reviewer findings are candidates, not facts. Before acting on one or repeating it to the user, verify any claim that is not directly visible in code already in context - read the flagged line, the library source under its package folder, the config flag, the file on disk.

**Why:** the user's ruling: verify any claim outside the obvious, agents are not fully trusted. The same sessions proved it both ways - a verifier refuted a plausible-sounding bug by reading the library's source, and a spot check of a config flag and a file's bytes caught an exposure the agents missed.

**How to apply:** claims that are self-evident from in-context code need no ceremony. Everything else gets one direct look at the primary source before it drives an edit or a conclusion. A second reader's pass (as in [[feedback-no-subagents-for-review]], the lead owns the review) satisfies this only when the reader quotes the decisive line and the quote checks out.
