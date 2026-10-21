---
name: feedback-naming
description: Name it before you write it. A name states what the thing owns. Renames move the name and every reference in one atomic pass. No shim for the old name.
metadata:
  type: feedback
---

A name is a contract. It states what the thing owns, specifically enough that a reader predicts its shape before opening it.

- **Name it before you write it.** Ask "what does this file or function own?" If the honest answer needs "utility stuff" or "common helpers", the concept is not sharp yet. Sharpen it, then write.
- **Own one domain.** If naming it needs an "and", that is an inspection trigger, not an automatic split. Investigate, then decide.
- **No dumping grounds.** Never `utils`, `helpers`, `misc`, `common`.
- **Folders carry domain too.** Parent plus filename together should let a reader predict the file's job where grep alone falls short.
- **Predict the signature.** A reader should guess inputs and outputs from the name. Booleans read as predicates (`isLoaded`, `hasAnchor`, `shouldPrune`).

**Renames are one atomic pass.** The name and every reference move together, and the rename stays within the thing's domain. Update a registry **only when the renamed thing is actually registered in one.** `_index.json` registers AIDOCS paths and skill dispatch. It is NOT a source-module registry, so a source-file rename has no key there and inventing one is the bug.

**A rename leaves no shim for the old name.** No redirect from the old route, no alias kept for callers, no old-named storage key kept alive. The old name disappears from code, docs and storage in the same pass. A redirect the user asks for by name is a feature, not a shim.

**Why:** names are the cheapest documentation and the first thing a reader trusts. Naming first is a design gate - a thing you cannot name is a thing you have not thought through. A half-finished rename leaves a caller importing a gone symbol, and grep stops being honest. A shim keeps the old name alive, so the rename never finishes.

**How to apply:** before creating anything, name it. Before finishing a rename, ask what still points at the old name and what is still kept alive for it.
