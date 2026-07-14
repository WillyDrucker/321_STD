---
name: feedback-code-comments
description: Comments state what the code cannot show. Four lines is the default. Prefer the why. Never narrate, and never mechanically truncate.
metadata:
  type: feedback
---

A comment earns its space by stating what the code cannot show: a responsibility, an invariant, a constraint, a failure mode. **Four lines is the default, module headers included.**

- **Module header** on every nontrivial file. Its job in present tense, plus the load-bearing invariants.
- **Prefer the why.** State the fact or constraint that made the code this way, rather than what the line does. A nudge, not a requirement - some comments are pure fact and that is fine.
- **Never narrate.** No history ("was previously", "replaced X"), no activity ("refactored", "cleaned up"), no restating the next line.

**A comment earns more than four lines only by stating a constraint that is still TRUE and that the code cannot show.** It never earns them by recording how the code got here, which git already owns. **Never mechanically truncate to hit the number.** The longest headers are usually the ones documenting the trap a passing test suite does not catch, and an automated trim deletes exactly those.

**Rewrite a long comment into a tight one. Deleting words IS the job.** Never relocate one into the memory track by hand. If real reasoning gets displaced, the next `/321 -Update` pass picks it up from the conversation while context is warm. A mid-task hand-write into MEMORY or SESSION is how the backbone fills with code detail nobody asked it to hold.

**Why:** stamps and narration rot, and git is already the activity log. A comment that survives is one a future reader would have been confused without.

**How to apply:** ask "does this help a future reader, or just narrate?" Help, keep it tight. Narrate, cut it. Project-specific comment contracts live in `<PROJECT>_DEV-AUDIT.md`, not here.
