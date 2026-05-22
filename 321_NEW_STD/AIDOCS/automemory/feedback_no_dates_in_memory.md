---
name: feedback-no-dates-in-memory
description: No dates or version stamps in memory, session, CLAUDE, or AGENTS files. LIFO carries the time signal.
metadata:
  type: feedback
---

Never embed dates, version numbers, or "Last Updated" metadata in memory-track files, SESSION files, CLAUDE.md, AGENTS.md, or any auto-memory file. Specifically:

- No `[YYYY-MM-DD]` prefixes on bullets
- No `Last Updated:` or `Updated By:` lines
- No `v1.X.Y` version stamps as metadata
- Branch names with version numbers (`<PROJECT>_v1.X.Y`) are AT RISK. Prefer abstract references like "active branch" or "branch ahead of main by N commits".

LIFO ordering carries the time signal. Newest entries sit at the top of their section. References inside bullet text to operational reality (a literal branch name when copy-paste matters, `[Unreleased]` CHANGELOG sections) are natural references, not metadata stamps.

**Why:** Date and version stamps tend to spread once they appear in one place. They show up in bullets, comments, and code without anyone asking. Git already carries the activity log. LIFO is the freshness signal.

**How to apply:** When writing or auditing memory or session files, scan for dates and version stamps. Strip them. Restructure if needed.
