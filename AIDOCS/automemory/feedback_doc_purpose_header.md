---
name: feedback-doc-purpose-header
description: Every project Markdown file we author gets a **Purpose:** callout immediately after the H1.
metadata:
  type: feedback
---

- **Every project Markdown file under our authorship** gets a `**Purpose:**` callout immediately after the H1. Scope: AIDOCS, WDDOCS, AGENTS.md, and skill bodies. With frontmatter the order is frontmatter, then H1, then Purpose. Never put Purpose inside the frontmatter - `description:` is a separate tooling field with different semantics.
- **Say what the file is, when to read it, and what is NOT in it** that a reader might expect. One sentence for a small file, a short paragraph for a meta-layer doc.
- **Exempt:** source and configs, CHANGELOG (its own format), pointer-only files (a `CLAUDE.md` holding just `@AGENTS.md`), legal documents with a governed format, and auto-memory files, whose frontmatter `description:` already serves this role.

**Why:** a fresh reader, human or AI, should know whether to read the file, and what falls outside it, before spending context on it.

**How to apply:** if the Purpose needs several paragraphs, the file is overloaded. Split it rather than write a longer Purpose.
