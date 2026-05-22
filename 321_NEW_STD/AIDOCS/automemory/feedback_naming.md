---
name: feedback-naming
description: Names state what a thing owns. Renames stay in-domain and propagate the name, its registry key, and every reference in one pass.
metadata:
  type: feedback
---

A name is a contract. It states what the thing owns - its domain - specifically enough that a reader predicts its shape before opening it.

Naming guidelines:

- **Own one domain.** One concept per name. If naming it needs an "and", it owns two things - that is a split, not a name.
- **No dumping grounds.** Never `utils`, `helpers`, `misc`, `common`. A generic name means the concept is not sharp yet - sharpen it first.
- **Folders carry domain too.** Parent plus filename together should let a reader predict the file's job where grep alone falls short.
- **Predict the signature.** A reader should guess inputs and outputs from the name. Booleans read as predicates (`isLoaded`, `hasAnchor`, `shouldPrune`).

Renaming guidelines:

- **Rename within the domain.** The new name still names what the thing owns. Never rename across domains - it breaks ownership.
- **One atomic pass.** The name, its `_index.json` key or path, and every reference move together. The index is the registry, so a half-applied rename leaves drift - a key pointing at an old path, a caller importing a gone symbol, a doc citing a stale file.

**Why:** Names are the cheapest documentation and the first thing a reader trusts. A vague name sends a reader to the wrong file. A half-finished rename lets the registry drift from the tree, and grep stops being honest.

**How to apply:** When you create or rename a file, function, or key, ask "does this name state what it owns, and does anything still point at the old name?"
