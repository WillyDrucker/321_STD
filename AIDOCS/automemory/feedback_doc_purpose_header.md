---
name: feedback-doc-purpose-header
description: Every project Markdown file under our authorship has a **Purpose:** callout immediately after the H1. Scope covers AIDOCS, WDDOCS, CLAUDE.md, AGENTS.md, and skill bodies.
metadata:
  type: feedback
---

Every project Markdown file under our authorship has a `**Purpose:**` callout immediately after the H1 (the first `# Heading` at the top of the file). Scope: AIDOCS, WDDOCS, CLAUDE.md, AGENTS.md, and skill bodies under `.claude/skills/` and `AIDOCS/SKILL/`. For files with YAML frontmatter, the order is frontmatter -> H1 -> Purpose. Do not put Purpose inside the frontmatter - frontmatter `description:` is a separate tooling field with different semantics.

Format:

```markdown
# Title

**Purpose:** [What this file is. When to read it. What's NOT here that the reader might expect.]

...rest of file...
```

Purpose depth is a steering call - match it to the file's role:

- A short or config-like file may need one sentence
- A meta-layer doc (MEMORY, CLAUDE.md, a framework reference) often needs a paragraph or two with a what's-NOT-here clause
- The signal: a fresh reader (AI or human) should know whether to read this and what falls outside its scope

If a Purpose needs many paragraphs to convey, the file is probably overloaded - split rather than write a longer Purpose.

Do NOT add Purpose to:
- Source code, `package.json`, configs
- HTML or non-Markdown reference files
- `CHANGELOG.md` (historical, has its own format)
- A pure import-pointer file (e.g. `CLAUDE.md` when it only holds `@AGENTS.md`)
- Auto-memory rule files (`AIDOCS/automemory/*.md`) - the frontmatter `description:` serves this role
