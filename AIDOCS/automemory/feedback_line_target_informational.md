---
name: line-target-informational
description: The file-size target and the audit census are information, never a gate that slows a change.
metadata:
  type: feedback
---

The source-file size target (DEV-AUDIT's anchor, around 300 lines) and the scan's over-target findings are informational. They are never a reason to stop, split, or trim mid-task.

**Why:** the user's ruling when a pass reported the known over-target files: being over target should not hold the work back, and a helper that slows a change to enforce it is the wrong helper.

**How to apply:** report the census when it changes, keep building. A file that grows past the target in the course of a feature is fine. Splitting is a cleanup-pass decision (a DevAudit), not a per-change ritual. Related: [[feedback-code-comments]].
