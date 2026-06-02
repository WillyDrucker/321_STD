# Lifecycle and file classes

**Purpose:** Durable reference for what auto-syncs vs what stays project-owned across the install / update lifecycle. Names which files refresh on `-UpdateSync`, which are project data, and how `customizations[]` opts a canonical file out. Loaded on demand when adding a new file to the engine or deciding where a piece of content belongs. Lives in `AIDOCS/tools/` so it refreshes per the engine-class copy step, never removed at graduation.

## Four file classes

Every file in a 321 project falls into one of four classes by lifecycle ownership.

### 1. Engine (auto-refresh)

The engine-class paths refresh from upstream on every `-UpdateSync`. They hold no project data, so the engine owns them outright. The set is defined in `lib/upgrade.mjs` as `ENGINE_CLASS`:

- `AIDOCS/tools/` - engine code (the `.mjs` modules and these PATTERN-* references)
- `AIDOCS/SKILL/` - canonical skill bodies (the 8: `SKILL_UPDATE.md`, `SKILL_UPDATE-SESSION.md`, `SKILL_UPDATE-MEMORY.md`, `SKILL_UPDATE-SYNC.md`, `SKILL_SETUP.md`, `SKILL_DEV-AUDIT.md`, `SKILL_AUTO-PUSH.md`, `SKILL_COMPACT.md`)
- `.claude/skills/321/SKILL.md` - the router

`INSTALL/` (the install + setup runbooks) is engine-owned but **not** part of the auto-refresh class. It is written by `init` (at install time) and removed by `graduate` once the project is steady. A routine `-UpdateSync` does not touch it, so a graduated project never re-acquires the onboarding tier.

A project-custom skill body (any `SKILL_*.md` in `AIDOCS/SKILL/` with no counterpart in the source tree) survives by absence: the copy step walks the source, so files only in the project are untouched. Most project-specific skills live this way.

**Opt-out:** add the project-relative path to `customizations[]` in `_index.json`. The `upgrade` command skips listed paths in the copy step and in `section_text_diff` ops.

### 2. Data (write-if-missing on install, archived on re-install)

Data files carry project content. `init` lays them write-if-missing. `migrate-archive` moves them aside on a re-install for the migration capture. `migrate-restore` copies the verbatim parts back. Knowledge docs (MEMORY / SESSION) come back via capture, not restore.

- `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `.gitignore`
- `AIDOCS/_index.json` (the registry)
- `AIDOCS/<PROJECT>_*.md` (MEMORY, SESSION, BACKLOG, DEV-AUDIT, AUTO-PUSH, and their `_EXTENDED` twins)

The configs (DEV-AUDIT `## Project specifics`, AUTO-PUSH `## Project release steps`, BACKLOG, CHANGELOG) come back verbatim with legacy and rename normalization. The reconcile pass dedups and reformats them. MEMORY and SESSION re-derive from the conversation through `-UpdateMemory` / `-UpdateSession` so they reflect the current state, not a stale snapshot.

### 3. Auto-memory (hybrid: seed + external)

Auto-memory has two homes: the canonical seed in `AIDOCS/automemory/` (rides in the repo) and Claude Code's native external memory at `auto_memory.path` (the runtime source of truth, loaded by the harness each session).

- `AIDOCS/automemory/feedback_*.md`, `AIDOCS/automemory/user_*.md` - the seed
- `auto_memory.path` (e.g. `~/.claude/projects/<key>/memory/`) - the runtime

`init` records the external path in `_index.json` and seeds the canonical rules into it write-if-missing, so a project's live custom rules survive. New seed files arrive via the manifest `automemory_add` op (idempotent: write-if-missing in the project's seed, and write-if-missing in the external runtime in the same op so the canonical rule reaches the harness without waiting for a re-install). `migrate-archive` snapshots the external memory into the archive at re-install. The reconcile pass merges back the profile plus any unique guidance summarized into a canonical rule, default drop. The `AGENTS.md` Hard rules block mirrors the seed and points back at it both ways - `doctor` verifies the mirror.

### 4. User-owned (verbatim or in-place)

User content the engine never authors.

- `WDDOCS/` - design docs, release notes, ideas. Restored verbatim by `migrate-restore`.
- `AIDOCS/ENV/` - environment notes (may hold secrets). Left in place by `migrate-archive` - never archived.
- Source code, build output, lockfiles, `node_modules`, the project's own code tree - never touched.
- `TEMP/` - the project's single scratch dir, gitignored.

`migrate-restore` does a union-merge of the archived `.gitignore` so a project's custom ignore lines survive a reinstall (no manual lines are dropped).

## The structural-change journal: MANIFEST.json

`AIDOCS/MANIFEST.json` is the append-only list of named structural changes the engine has shipped. Each project's `_index.json -> engine.operations_applied[]` records which ops have been applied to that project. `-UpdateSync` diffs the source manifest against the project's journal and applies any missing ops in order. Operations are idempotent so a re-run is always safe.

| Op type | Touches | Notes |
|---|---|---|
| `skill_delete` | engine | Removes a project's copy of a canonical skill body. |
| `skill_rename` | engine | Deletes the old skill body. The new arrives via the copy step. |
| `file_delete` | engine | Removes any project-relative file. For engine-class files removed upstream that linger (e.g. a reference doc folded into a skill body). Path-contained. |
| `registry_extend` | data (registry) | Adds a key to `_index.json` if absent. Never overwrites a present value. |
| `registry_rename` | data (registry) | Renames a dotted-path key (nested-object access). |
| `dictionary_rename` | data (registry) | Renames a literal flat key in a dictionary (when the key itself contains a dot). |
| `file_add_template` | data | Creates a new template file with `PROJECTNAME` substitution if absent. Path-contained. |
| `automemory_add` | auto-memory | Adds a new seed file from the engine to `AIDOCS/automemory/` if absent, and mirrors it into the external runtime memory (`auto_memory.path`) write-if-missing. Rejects anything that is not a bare basename. |
| `section_text_diff` | data | Replaces a `## <section>` body in a project file unless the file is in `customizations[]`. Path-contained. |

All file-writing ops resolve their target against `repoRoot()` and reject paths that escape via `..` or absolute form (`paths.isContained`). A typo or hostile manifest cannot write outside the project tree.

## Lifecycle map

| Phase | Trigger | Touches | What changes |
|---|---|---|---|
| Install (fresh) | `install.sh` / `install.ps1` | engine + data scaffolds | Lays the full skeleton. Empty project content. |
| Install (existing) | same | engine refresh, data preserved | Engine-class paths overwrite. Data files write-if-missing. |
| Setup (fresh fill) | `-Setup` | data (the Big 6) | Fills MEMORY's Big 6 from code + conversation. Light. |
| Setup (migration) | `-Setup` | archive + reinstall + restore + capture | Heavy: archives prior project, reinstalls fresh, restores user content, captures knowledge through `-UpdateSession` / `-UpdateMemory`, sets reconcile gate. |
| Update | `-Update` | data (MEMORY + SESSION) | Daily driver. Captures the conversation into the backbone log + distilled memory. Never touches engine. |
| UpdateSync | `-UpdateSync` | engine + manifest ops | Refreshes the engine from upstream, applies missing manifest ops. Project-authored content is preserved. Canonical sections of data templates can land via `section_text_diff` unless the file is in `customizations[]`. Refuses while `reconcile_pending` is set. |
| Graduate | reconcile pass or `engine.mjs graduate` | tears down onboarding | Deregisters `-Setup`, removes `INSTALL/`, marks `graduated: true`. After this, `-UpdateSync` is the steady-state engine refresh path. |

## Adding a new file to the engine

The right path depends on the file's class:

- **New skill body** (engine class): drop in `AIDOCS/SKILL/` with the action-first naming (`SKILL_UPDATE-<TARGET>.md`). `sync` registers it for dispatch. Downstream projects pick it up via the copy step on next `-UpdateSync`. No manifest op needed.
- **New engine code module** (engine class): drop in `AIDOCS/tools/lib/`. Copy step handles the rest. No manifest op needed.
- **New PATTERN reference** (engine class, like this file): drop in `AIDOCS/tools/`. Copy step handles it.
- **New canonical auto-memory rule** (hybrid class): add the file in `AIDOCS/automemory/`, then add an `automemory_add` op to `MANIFEST.json` with the basename. Downstream projects seed the new rule on next `-UpdateSync`.
- **New data template** (data class): add a `file_add_template` op to `MANIFEST.json`. The op carries the file path and body (with `PROJECTNAME` placeholders).
- **New registry key shape** (data class): add a `registry_extend` op to add the key if absent.
- **Rename or remove existing structure**: use the `skill_rename` / `skill_delete` / `file_delete` / `registry_rename` / `dictionary_rename` op types. `file_delete` covers non-skill engine files (a reference doc folded into a skill body, an obsolete tool module). The journal in `operations_applied[]` records the change so a re-run is a clean no-op.

## Rules

- **Engine refreshes, project-authored content is preserved.** The copy step touches engine-class only. Data files (MEMORY / SESSION / BACKLOG content, project-custom skill bodies, custom registry values) are write-if-missing on install, archived on re-install. The canonical sections of data templates (DEV-AUDIT baseline, AUTO-PUSH generic body) can refresh via `section_text_diff` unless the file is in `customizations[]`.
- **`customizations[]` is the opt-out.** Any canonical path listed there is left alone on copy and on `section_text_diff`.
- **The manifest is the journal.** Every structural change is a named op. The project's `operations_applied[]` records what has been applied. A re-run is always safe.
- **All file ops are path-contained.** `file_add_template`, `file_delete`, `automemory_add`, and `section_text_diff` resolve targets against the project root and reject `..` escapes - a hostile or mistaken upstream cannot write outside the project tree.
- **One canonical home per concern.** The seed is the engine's auto-memory canonical, the external memory is the runtime. The repo doc is the auto-push canonical, the in-conversation step is the runtime. Engine code is the engine canonical, project-custom skills live alongside untouched.
