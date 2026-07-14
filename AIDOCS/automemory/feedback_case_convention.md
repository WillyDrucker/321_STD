---
name: feedback-case-convention
description: Framework and established names win first. Otherwise UPPERCASE is human-facing documentation, lowercase is code. No generic files.
metadata:
  type: feedback
---

- **Framework and established names win first.** Framework routes, config files, language conventions, and any path already written by a script or read by a tool (`package.json`, `tsconfig.json`, `app.json`). **Never rename one of these to fit a convention**, and never rename a path a script writes to, which silently breaks the script.
- **In the space that leaves open:** UPPERCASE for human-facing documentation, lowercase for code and code-adjacent files.
- **No generic files.** Never a bare `README.md` in a subfolder and never a `utils.ts`. Every file owns its purpose in its own name, or carries its parent's (`ENV/<PROJECT>_ENV_METRO.md`). Prefer no folder doc at all. The root `README.md` is the single exception, and only because the host renders it by that exact name.

**Why:** case becomes a free signal, so a glance at a directory says what is documentation and what is code. A generic name says the concept was never sharpened, and it hides the real home.

**How to apply:** ask whether a framework or an existing tool already fixes the name. If so, that wins outright. If not, the name must say what the file owns.
