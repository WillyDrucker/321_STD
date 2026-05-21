# SKILL_LOCAL - project-local skill overrides

**Purpose:** Home for project-specific `/321` skill bodies that must survive an engine reinstall. `init` always overwrites `AIDOCS/SKILL` (the generic engine bodies) but never touches this folder, so a customized pipeline lives here safely.

## How it works

- Drop a `SKILL_<NAME>.md` here using the **same filename** and the **same frontmatter `name`** as the generic skill it replaces (for example `SKILL_AUTO-PUSH.md` with `name: auto-push`). Run `node AIDOCS/tools/memory.mjs sync`. The local body takes precedence: `_index.json -> skills.dispatch.<name>.body` repoints here and the key is recorded in `skills.local_additions`.
- A `SKILL_<NAME>.md` with no generic counterpart adds a brand-new `/321` flag.
- The `/321` router loads whatever `dispatch.<name>.body` points at, so no router edit is needed.

## When to use

Override a skill only when its procedure is irreducibly project-specific and the generic body would do the wrong thing - most often a release pipeline (`-AutoPush`) with a non-standard publish or deploy, or a project-specific audit rule-set. The doc-distillation skills (`-SessionUpdate`, `-MemoryUpdate`, `-Update`) are usually better left generic: the engine drives them, so fold any genuine deviation into MEMORY or DEV-AUDIT rather than forking the body.

Record each override in `_index.json -> customizations[]` so drift tooling can tell an intentional deviation from accidental drift. During a migration, `/321 -Update` writes overrides here automatically from the archived custom bodies.
