---
name: feedback-docs-code-independent
description: Design and reference docs never name code, and code never names them. Each side changes alone.
metadata:
  type: feedback
---

A design or reference doc (WDDOCS and its kin) names no file, function, component, script, path, or field that the code owns, and carries no number that is still being tuned. No code, comment, test, or generated output names a design doc. Schema vocabulary in a database design doc (a table, a column) is the design itself, not code.

**Why:** the user's ruling: the docs are the internal reference for the rules and the why, and a doc that leans on code names drifts the moment the code moves, then the code starts leaning on the doc. Kept independent, either side can change alone, and the doc stays the overview that holds direction if it is lost.

**How to apply:** before writing a doc line, strip the identifiers and say the thing in the product's words ("the catalog data layer", or for a tunable "a share of the section, kept gentle, changed only on deliberate review" with the number living only in code). A code change that seems to force a design-doc edit is a design change for review, or a sign the rule was written too specific. Locked design numbers may stay. On a doc pass, grep the docs for backticked paths and identifiers. Related: [[feedback-audit-never-in-code]], [[feedback-lean-docs]].
