---
name: feedback-no-versions-in-code
description: No release stamps in source. Schema versions and the project's single version source are exempt. Dates live in git.
metadata:
  type: feedback
---

Never embed our own **release** version or date stamps in source code or comments:

- No `// v1.4.8` or `// 2026-04-11` markers
- No "added in vX" or "deprecated in vX" comment trails
- Nothing in the source tree states the shipped version

External platform versions are fine when load-bearing (`// Expo SDK 57 only`, `// Astro 6 only`).

**Two things this rule does NOT reach:**

- **A persistence schema version.** The `v` in a `{v, data}` storage envelope, a migration version, a protocol version. Those are **data contracts, not release stamps**, and banning them breaks real code.
- **The project's single version source**, wherever the release tooling owns it (`package.json`, `app.json` `expo.version`, or whatever the platform mandates). Written only by that tooling, never by hand.

**Why:** stamps drift. Git and the CHANGELOG are authoritative for "when". The project's one version source is authoritative for "what version we are". A stamp in code lies within a release and rots across releases.

**How to apply:** strip our-release stamps on sight. If a comment dates itself ("recent", "now", "as of..."), rewrite it as a timeless statement of the constraint. Ask what the version describes: the release, strip it. The data shape, keep it.
