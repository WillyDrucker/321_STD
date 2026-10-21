---
name: feedback-no-hashing
description: No recorded checksums or fingerprints anywhere, all projects. Git is identity for tracked files, the pinned release and source for fetched tools, and a byte comparison runs directly when equality matters.
metadata:
  type: feedback
---

Never record or verify a checksum or fingerprint (SHA-256 and kin) in a project file: no pin hashes in manifests, no fingerprints in records, state, or reports, no hash-addressed routes, no fetch-then-verify steps.

- Tracked files: git is the identity.
- Fetched third-party tools: the pinned release plus its source URL is the identity.
- A gate that needs equality (a byte-exact rebuild, a download check) compares the bytes directly and records pass or fail, never the digest.
- A sealed record keeps whatever it captured. A scrub never rewrites one.

**Why:** the user's ruling, account-wide: hash bookkeeping duplicates an identity git or the pinned source already carries, spreads hex noise through docs and records, and adds verification ceremony nobody needs at this scale. It was a mistake to add, and it was removed everywhere.

**How to apply:** manifests and records state versions, sources, sizes, and outcomes. When a comparison matters, do it and report the result. A drift check stores the thing it compares (a sorted list of names) so the report can say what moved. On an audit, strip recorded fingerprints and verify steps wherever they appear.
