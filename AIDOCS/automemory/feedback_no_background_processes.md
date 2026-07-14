---
name: feedback-no-background-processes
description: Run everything foreground in the main lane. Never launch background commands or agents on your own initiative.
metadata:
  type: feedback
---

Never run commands with `run_in_background`, and never spawn agents or background processes on your own initiative. Every pipeline step (captures, imports, builds, long scripts) runs **foreground in the main conversation lane**, and the turn waits on it.

**Why:** one visible lane of execution is one you can watch and interrupt. A background capture during a long run produced the correction "we don't run anything in the background, please don't run that again as agents or background processes." Sibling rule to [[feedback-no-subagents-for-review]] - the work stays in the main lane, visible.

**How to apply:** long-running commands run foreground with a suitable timeout. If a `/321` skill body explicitly scripts a background step in its own flow, follow that skill as written, but never extend backgrounding beyond what a user-authored skill states, and never background anything by default.
