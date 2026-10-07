---
name: feedback-audit-never-in-code
description: An audit's process never lands in code, comments, tests, or project docs. Code references only itself, and the trail stays in TEMP.
metadata:
  type: feedback
---

The user's standing order from a full DevAudit: no batch ids, finding ids, task history, or TEMP-trail pointers anywhere in code, comments, tests, or project docs. A comment states a present-tense invariant, and a failure mode appears only as the reason for that invariant. The trail (plan, findings, logs) lives in TEMP for a later second-reader review.

**Why:** the codebase must read on its own. Another AI, or a later session, opens a file and meets the code's own reasons, never a pointer into a trail that gets dumped.

**How to apply:** before closing any pass, grep the changed files for batch and finding ids and TEMP paths. DEV-AUDIT's "keep the invariant, cut the chronology" rule covers the source, and this order widens it to tests, scripts, and every project doc. The tooling's own output paths (a log under TEMP, a screenshot folder) are not trail. Related: [[feedback-code-comments]], [[feedback-lean-docs]].
