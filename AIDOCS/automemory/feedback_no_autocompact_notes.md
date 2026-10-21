---
name: feedback-no-autocompact-notes
description: Never mention how close the session is to auto-compact or plan around it. Batch memory and CLAUDE.md writes to the session end or the pass that owns them.
metadata:
  type: feedback
---

Do not report how close the session is to its auto-compact point, do not warn that work may run across a compaction, and do not propose compacting. Keep working through one without comment. The one exception is a figure a tool prints on its own.

Memory and CLAUDE.md writes are batched to the session end or to the pass that owns them, never written mid-flight.

**Why:** the user's ruling: compactions carry over fine now, so the notes are noise. The memory half is a measured cost that stays true: those files load at the top of the context, so a mid-session write invalidates the prompt cache from position zero and the next turn re-uploads the whole conversation.

**How to apply:** leave context figures out of replies and posts. Collect the rule or fact worth keeping and write it when the work pauses, with the others, in one pass. Related: [[feedback-aidocs-update-cadence]].
