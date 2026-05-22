---
name: feedback-no-versions-in-code
description: No version numbers or date stamps in source code. Versions live in package.json. Dates live in git.
metadata:
  type: feedback
---

Never embed our own version numbers or date stamps in source code or comments. Specifically:

- No `// v1.4.8` or `// 2026-04-11` markers
- No `const VERSION = "..."` constants outside of `package.json` / build-time injection
- No "added in vX" or "deprecated in vX" comment trails

External platform versions are fine when load-bearing (e.g., `// Cloudflare Pages CLI 3.x`, `// Astro 6 only`).

**Why:** Stamps drift. Git log + CHANGELOG are authoritative for "when". package.json is authoritative for "what version we are". Stamps in code lie within a release and rot across releases.

**How to apply:** When writing or auditing code, strip our-version stamps. If a comment is dating itself ("recent", "now", "as of ..."), rewrite to a timeless statement of the constraint. The CHANGELOG is where versions get spoken about.
