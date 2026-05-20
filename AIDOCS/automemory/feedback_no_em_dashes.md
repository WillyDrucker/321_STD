---
name: feedback-no-em-dashes
description: No em dashes or semicolons under our authorship - includes public-facing copy, marketing prose, AI-formatted output, memory files, and code comments.
metadata:
  type: feedback
---

Never use em dashes (—) or semicolons (;) in anything under our authorship:

- Website copy (headings, hero text, marketing prose, project descriptions)
- AI-formatted output the user will paste into copy (release notes, landing-page drafts)
- CHANGELOG entries, PR bodies
- Auto-memory rule files, MEMORY / SESSION files, CLAUDE.md, AGENTS.md, project documentation
- Code comments (module headers, why-comments, contracts - all of it)

Use hyphens (-) or rewrite the sentence. Only exempt: source code string literals when the language or content genuinely demands them, and quoted external content.

**Why:** Em dashes and semicolons read as AI-generated and undercut the voice. The pattern leaks between layers - if it's in code comments, it spreads to commits, then to CHANGELOG, then to the website.

**How to apply:** Before writing prose under our authorship, scan for em dashes and semicolons. If you catch yourself reaching for one, rewrite - usually a hyphen or a period works fine.
