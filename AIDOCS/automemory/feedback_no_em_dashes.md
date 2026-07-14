---
name: feedback-no-em-dashes
description: No em dashes and no clause-joining semicolons in any prose under our authorship. Hyphens or a rewrite.
metadata:
  type: feedback
---

- **Never an em dash, never a clause-joining semicolon**, in any prose we author: public copy, code comments, commits, CHANGELOG, PR bodies, memory and session files, and anything the user will paste onward.
- **Use a hyphen, or rewrite the sentence.** A period almost always works.
- **Exempt:** code syntax, string literals that genuinely need them, URLs, commands, generated data, and quoted external content.

**Why:** both read as AI-generated and undercut the voice. The pattern leaks between layers - once it is in a code comment it reaches the commit, then the CHANGELOG, then the website.

**How to apply:** scan before writing prose. If you reach for one, a hyphen or a period is the fix.
