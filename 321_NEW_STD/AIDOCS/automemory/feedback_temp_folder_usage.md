---
name: feedback-temp-folder-usage
description: TEMP/ at project root is the single home for ALL temporary working files. Always gitignored, never committed.
metadata:
  type: feedback
---

Every project using this standard has a gitignored `TEMP/` folder at its root. ALL temporary or working-only files belong there. Default to it for any non-shipping file: scratchpads, working drafts, one-off scripts, throwaway data, audit logs, intermediate analysis output.

Do NOT use TEMP/ for source code, project documentation (AIDOCS / WDDOCS), runtime configuration, or anything that should be committed.

**Gitignore is load-bearing.** If `TEMP/` doesn't exist, create it. Verify it's in `.gitignore` (`TEMP/` line). If not, add it. Never commit TEMP/ contents. If something temporary turns out to deserve committing, move it out of TEMP/ to its proper home first.

**Why:** A single predictable home keeps the project root clean, prevents accidental commits of scratch files, and gives any AI session a known place to drop working artifacts. Scratch at the repo root has previously been staged and shipped in build artifacts. Scattered in `%LOCALAPPDATA%\Temp\` makes it hard to find when continuing investigation later.

**Project-specific addenda below this line.** Projects that publish bundles (extensions, packages) should also exclude `TEMP/` from their publish-ignore file (e.g., `.vscodeignore`, `.npmignore`).
