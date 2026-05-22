---
name: feedback-code-comments
description: Comments explain things the code can't show on its own. Write what helps a future reader. Route surplus context to the right doc layer.
metadata:
  type: feedback
---

Write comments that earn their space. They help a future reader (AI or human) understand the code in ways the code can't show on its own: a constraint, an invariant, a contract, a forward-facing warning. The bar is "would removing this confuse a careful reader?" If yes, the comment earns its space.

Worth writing, header first:

- **Module header** at the top of a file (4-6 lines). State the file's job in present tense and the load-bearing invariants. The first thing any reader sees and the highest-leverage comment surface in the file.
- **Constraint or decision** at a non-obvious code shape. Explain the trade-off or constraint that made the code this way.
- **Current failure mode** in present tense, forward-facing. Example: `// stale cache can override active config, refresh on read`. Not historical ("we hit a bug last sprint and had to add the refresh").
- **Contract** that spans files or modules. Name it at both ends so a reader navigating either side sees the contract.

Delete comments that narrate:

- History ("was previously", "used to be", "replaced X")
- Our version numbers or dates (any literal version or date in source)
- Activity ("refactored", "cleaned up", "removed dead code")
- What the next line literally does

When a comment wants to grow - a why-comment turning into multiple paragraphs, a module header swelling past 6 lines - keep only the terse forward-facing fact in the comment. The surplus reasoning belongs in the backbone, not in source:

- **Architecture deep-dives, pitfall root-causes** -> `<PROJECT>_MEMORY_EXTENDED.md`
- **In-flight work, recent debugging context** -> `<PROJECT>_SESSION_EXTENDED.md`

You don't hand-file or tag it: writing the lean comment is the only in-the-moment step, and the next `/321 -Update` pass lifts the reasoning into the right layer from the conversation while context is warm. This is for oversized comments only, not a tag on every comment.

**Why:** Stamps and history rot. Git is the activity log. Comments earn their space by helping future-you avoid traps or understand constraints that aren't obvious from the code.

**How to apply:** When writing or auditing code, ask "does this comment help a future reader, or just narrate?" Help -> keep. Narrate -> delete. Code-applicable specifics (density targets, contract formats, TODO patterns, lint exceptions) live in `<PROJECT>_DEV-AUDIT.md`, loaded only when `/321 -DevAudit` runs. This rule is the always-loaded principle.

**Project-specific addenda below this line.**
