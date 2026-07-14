---
name: feedback-temp-folder-usage
description: When a task authorizes writes and needs a scratch file, it goes in the gitignored TEMP/ at the project root. Never at the repo root.
metadata:
  type: feedback
---

- **When you need a persisted scratch file and writes are in scope, put it in `TEMP/`.** Scratchpads, working drafts, one-off scripts, throwaway data, audit logs, intermediate output.
- **Never `TEMP/`** for source, project documentation (AIDOCS / WDDOCS), runtime config, or anything that should be committed. If a temporary file turns out to deserve committing, move it to its real home first.
- **This does not authorize writes on its own.** During a read-only task (a review, an audit, a comparison), do not create `TEMP/` and do not edit `.gitignore` to add it. If `TEMP/` is missing or ungitignored on a task that needs it, say so and let the user decide.
- **A project that publishes a bundle** (an extension, a package) also excludes `TEMP/` from its publish-ignore file (`.vscodeignore`, `.npmignore`).

**Why:** one predictable home keeps the repo root clean and keeps scratch out of commits. Loose files at the repo root have been staged and shipped before.

**How to apply:** before writing any non-shipping file, ask whether the task authorizes writes. If yes, `TEMP/`. If no, do not write it.
