---
name: reports-carry-discussions
description: Session reports and compact blocks include discussed-but-undecided material, not just code state.
metadata:
  type: feedback
---

Session hand-off reports (the /321 -Compact block, and by extension any session summary) must carry the conversation texture alongside the code state: concerns the user raised, ideas parked for later, trade-offs weighed without a ruling, offers awaiting word.

**Why:** code state survives in git and AIDOCS, but a parked idea or an unresolved worry lives only in the conversation. Dropping it means the next session re-litigates or, worse, never knows the concern existed.

**How to apply:** `SKILL_COMPACT.md` carries a "Discussed, not decided" section for exactly this. Fill it from the session's actual back-and-forth, not from the diff. Related: [[verify-agent-claims]].
