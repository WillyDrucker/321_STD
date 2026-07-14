---
name: feedback-no-dates-in-memory
description: No freshness stamps in memory or session files. LIFO carries the time signal. Live Current State versions are REQUIRED, not a stamp.
metadata:
  type: feedback
---

Never add freshness metadata to memory-track files, SESSION, CLAUDE.md, AGENTS.md, or auto-memory:

- No `[YYYY-MM-DD]` prefixes on bullets, no `Last Updated:` or `Updated By:` lines
- No "as of vX" or version-history label attached to an entry to date it
- LIFO ordering IS the freshness signal. Newest sits at the top of its section

**This does NOT reach live operational state.** SESSION's Current State exists to carry the version, the stack, the branch, and gate status. MEMORY's Big-6 exists to name the SDK and framework versions. **Those are current truth, not stamps on an entry. Strip them and you have destroyed the thing the section is for.**

**Why:** a stamp dates the ENTRY, and entries rot. A version in Current State describes the PROJECT, and it is overwritten every pass. Git carries the activity log.

**How to apply:** ask what the number is attached to. Attached to a bullet, to say when it was written, strip it. Attached to the project, to say what it currently is, keep it.
