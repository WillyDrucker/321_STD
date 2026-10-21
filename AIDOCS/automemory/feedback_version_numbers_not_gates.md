---
name: feedback-version-numbers-not-gates
description: A version number labels what shipped, it never defers work. A decided change goes into the open version now, not a parked next one.
metadata:
  type: feedback
---

A version number on a tool, a document, or a release is a label for the history entry, not a stop sign. When a change is decided it goes into the file now, under the version that is open. Never park a decided change as "for the next version" or wait on a bump before doing the work.

**Why:** the user has watched models treat a version string as a gate and stall on "that is for the next release" while doing nothing. The number is for the record. He wants it there, and never as a control.

**How to apply:** one version string per shipping unit, at its single source ([[feedback-no-versions-in-code]]), changed when the unit ships. Say what the version holds in its history entry. If a change is a separate decision, ask the question, then put the answer into the same file.
