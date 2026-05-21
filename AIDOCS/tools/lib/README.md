# AIDOCS/tools/lib - Script Core Engine

**Purpose:** Reference for the modular script engine powering `node AIDOCS/tools/memory.mjs`. Documents module roles, contracts, and the command-implementation convention. Read before editing tooling. Not auto-loaded.

Zero runtime dependencies. Built on Node's standard library. Storage: markdown + `_index.json`.

## Roles

| Layer | What it owns | Where it lives |
|---|---|---|
| Entry point | CLI dispatch, help text, short subcommands (`validate`, `clear`, `state`, `lint`) | `AIDOCS/tools/memory.mjs` |
| Engine | Shared primitives - filesystem I/O, parsing, mutation, validation, diff, lint | `AIDOCS/tools/lib/*.mjs` |
| Commands | Multi-step operations composing engine primitives | `AIDOCS/tools/lib/commands/*.mjs` |

The entry point should not grow. New behavior either extends an engine module or lands as a new command.

## Engine modules

| Module | Purpose | Key exports |
|---|---|---|
| `paths.mjs` | Filesystem constants + skill / section vocabulary | `REPO_ROOT`, `INDEX_PATH`, `STAGING_DIR`, `STATE_PATH`, `LOCK_PATH`, `VALID_SKILLS`, `ROUTINE_SECTIONS_BY_SKILL`, `STATIC_SECTIONS`, `BACKLOG_SECTIONS`, `decisionsHeadingFor` |
| `cli.mjs` | CLI helpers | `err`, `parseFlags`, `requireOpt` |
| `state.mjs` | The I/O boundary. Reads / writes `_index.json`, `state.json`, staging files, resolves index-relative and within-repo paths, and runs the reconcile-residue scan (reads the memory / session files, delegates the pure detection to `markdown.mjs`). Plus `assertFileExists` pre-flight, a timestamp helper, and archive-filename helpers (`nowStampUtc` minute stamp, `uniqueArchivePath` collision guard). | `loadIndex`, `resolveIndexFile`, `resolveWithinRepo`, `assertFileExists`, `stagingPath`, `loadStaging`, `loadState`, `bootstrapState`, `saveState`, `nowIsoUtc`, `nowStampUtc`, `uniqueArchivePath`, `scanReconcileResidue` |
| `markdown.mjs` | Pure parsing utilities. No I/O, no side effects. The `find*Bounds` helpers locate one section / anchor, the `enumerate*` helpers list all sections / LIFO sub-sections (for prune), and the `find*Residue` helpers detect un-distilled migrate-import anchors / dates and un-renamed cross-project file refs (the reconcile gate), and `skillBodyHash` is the drift-detection digest a customized skill records as its canonical base. | `headingFromSlug`, `slugify`, `normalizeForMatch`, `escapeRegExp`, `parseFrontmatter`, `filenameToFlag`, `toRelativePosix`, `bulletExtendedAnchor`, `findSectionBounds`, `findExtendedBounds`, `findLifoSubsectionBounds`, `findDecisionsSubsectionBounds`, `isPlaceholderBody`, `enumerateTopLevelSections`, `enumerateLifoSubsections`, `findLifoResidue`, `findCrossRefResidue`, `skillBodyHash` |
| `mutators.mjs` | Main-file mutation for SESSION + MEMORY + BACKLOG: LIFO + Current State bullet ops, promote / gap-fill / update-section-text for the static six. | `applyAction`, `applyBacklogAction`, `updateSectionText` |
| `mutatorsExtended.mjs` | EXTENDED-file mutation: `### sub-section`-under-LIFO CRUD, EXTENDED Big-6 mirror gap-fill, and main-to-EXTENDED orphan-link detection. | `applyExtendedAction`, `gapFillSectionExtended`, `findOrphanLinks` |
| `pruneSelection.mjs` | Pure algorithms that pick which LIFO bullets / EXTENDED sub-sections a prune drops (paired, reverse-orphan, top-level, extended). No I/O. | `prunePaired`, `pruneExtendedReverseOrphan`, `pruneTopLevel`, `pruneExtended`, `collectReferencedAnchors` |
| `pruneRunners.mjs` | The I/O half of prune. Reads target files, calls `pruneSelection` to pick drops, writes the trimmed files, archives dropped content. Shared by the `prune` command and commit.mjs auto-prune, so it lives in lib (commands import it, not each other). | `runPairedPrune`, `runStandalonePrune` |
| `scaffoldTemplates.mjs` | The file-content templates `init` writes for a new project (AGENTS, `_index.json`, Big 6 + EXTENDED + BACKLOG + DEV-AUDIT starters, CHANGELOG, .gitignore). | `agentsTemplate`, `indexTemplate`, `memoryTemplate`, `memoryExtendedTemplate`, `sessionTemplate`, `sessionExtendedTemplate`, `backlogTemplate`, `devAuditStarter`, `changelogTemplate`, `gitignoreTemplate` |
| `validator.mjs` | Schema + op-shape validation against `AIDOCS/tools/staging/SCHEMA.json`. Enforces `additionalProperties: false`, field types, mode=full for static-section ops, and no fenced code in EXTENDED-bound prose. All hard gates (commit aborts pre-write). | `validateStaging` |
| `diff.mjs` | LCS-based unified diff renderer used by `commit --preview` | `printUnifiedDiff` |
| `lint.mjs` | File-level + per-bullet + per-anchor checks consumed by `lint` and `doctor` | `lintFile` |

## Commands

Each lives in `AIDOCS/tools/lib/commands/<name>.mjs` and exports a `cmd*` entrypoint. Most take the loaded index (`cmdName(index, args)`). Pre-index commands take args only (see "Command interface convention" below).

| Command | Purpose |
|---|---|
| `sync.mjs` | Rebuilds `_index.json -> skills.dispatch` from `AIDOCS/SKILL/SKILL_*.md` frontmatter. Skips `kind: reference`. A project customizes a skill by editing its body in place and flagging it in `customizations[]` (which keeps `init` from overwriting it). sync derives dispatch from the body either way. |
| `import-skills.mjs` | Copies a project's own skill bodies into `AIDOCS/SKILL/` under the canonical `SKILL_<FUNC>.md` name so sync can register them with the router (which dispatches from `_index.json`, so no router edit is needed). Never overwrites a canonical body - a name collision is reported with the canonical hash for `/321 -Update` to merge as canonical base + delta. Non-destructive. `--from <dir>` overrides the default `AIDOCS/SKILLS/` scan: the migration points it at the setup archive, the reconcile late-scan at foreign skill dirs. |
| `commit.mjs` | Two-phase apply of a staging file. Simulates all ops first, aborts on any error before writing. Updates `state.json` and clears staging on success. |
| `prune.mjs` | The `prune` CLI command. Thin wrapper that dispatches to the paired / standalone runner in `pruneRunners.mjs`. |
| `archive.mjs` | Surgical archive of a single EXTENDED anchor. Slug-based matching via `findExtendedBounds`. |
| `doctor.mjs` | Health check: a battery of independent checks (lint, paths, state, skill shapes, legacy-skills tree, reconcile residue, Big-6 Decisions, banned prose, auto-memory pointers, router quick-ref, customization manifest, release profile). The `buckets` map in `cmdDoctor` is the live list. The legacy-skills check flags a live `AIDOCS/SKILLS/` (plural) tree not yet imported into `AIDOCS/SKILL/`. Reconcile residue flags `{#anchor}` / leading-date survivors in MAIN LIFO bullets and un-renamed cross-project doc-file refs (`<old>_MEMORY.md`) once the gate clears (the incomplete-reconcile failure) and tallies as structural, not content, so it cannot hide among pre-existing prose lint. `--structural-only` skips the content / prose checks so install can verify wiring without failing on a migrated project's inherited lint debt. |
| `init.mjs` | Scaffolds a new project from this template at `<target-dir>`. Copies the router / engine / skill bodies / schema verbatim. Generates project-named MEMORY / SESSION / EXTENDED / DEV-AUDIT / AGENTS / `_index.json` from canonical sources. |
| `migrate-archive.mjs` | Deterministic Step 1 of a Setup migration. Moves project-owned content into `AIDOCS/<X>_SETUP_ARCHIVE/` (move, never delete): known 321-shape paths and clearly-stale swept AI-state automatically, borderline swept docs reported for the AI to adjudicate (`--move` / `--copy`, default leave). `--scan` reports both tiers without moving. Owns the find + move so the path lists and sweep patterns stay out of the skill prose. Exports `cmdMigrateArchive(args)` (no index). |
| `migrate-import.mjs` | Lossless structural import of an archived EXTENDED file into a staging file. One `### sub-section` per entry (bold-leads under an `## H2` split per-entry, `### H3` narratives kept whole) plus one anchored MAIN bullet each. Used by Setup migration Steps 5/6 to capture depth verbatim - distillation is deferred to the reconciliation pass (the gated `/321 -Update`). Exports `cmdMigrateImport(args)` (no index). |
| `migrate-restore.mjs` | Deterministic Step 7 of a Setup migration. Moves user-owned content back out of `AIDOCS/<X>_SETUP_ARCHIVE/`: `WDDOCS/` verbatim, the `*_ARCHIVE` history dirs, and `AIDOCS/ENV/` (renaming `<OLD>_ENV_*` basenames on a project rename). Move, so the archive drains as content returns. The judgment / network layers (`.gitignore` merge, DEV-AUDIT, CHANGELOG, auto-memory, AGENTS) stay in the skill. Exports `cmdMigrateRestore(args)` (no index). |

## Contract between modules

- **`markdown.mjs` is pure.** No I/O, no module-level state.
- **`paths.mjs` is constants-only.** Filesystem locations and skill vocabulary. No logic.
- **`state.mjs` is the I/O boundary** for shared resources (`_index.json`, `state.json`, staging files). Resolve through `state.mjs` helpers where practical. Commands resolving project-local paths from the index plus `REPO_ROOT` directly (e.g., `prune` resolving its archive folder) are acceptable for non-shared resources.
- **`mutators.mjs` returns new strings.** Mutators take content + an action and return mutated content. They never write to disk. `commit.mjs` does the disk write after simulation.
- **`validator.mjs` is read-only.** Schema check only.
- **Commands are top-level orchestrators.** They compose engine primitives. They own flag parsing (via `cli.mjs`), file I/O, console output.

## Command interface convention

Most commands take the loaded index: `cmdName(index, args)`. Pre-index commands that run before (or instead of) reading `_index.json` take args only: `cmdInit(_index, args)` (called with a null index), `cmdMigrateArchive(args)`, `cmdMigrateImport(args)`, and `cmdMigrateRestore(args)`. `memory.mjs` dispatches those ahead of `loadIndex`.

```js
export async function cmdName(index, args) {
  // 1. parseFlags + requireOpt
  // 2. resolve paths via index
  // 3. read files (via state.mjs helpers where possible)
  // 4. compose engine primitives in memory
  // 5. write files
  // 6. print summary
}
```

Exit codes:
- `0` - success
- `2` - unknown command
- `3` - missing size / bucket config
- `4` - lint failure
- `5` - missing file / bad config (also: init target-dir / name / release-profile invalid)
- `10` - sync misconfiguration
- `11` - unknown skill
- `12` - missing staging file
- `13` - validation failure
- `14` - lockfile present or staging-write race
- `15` - malformed state.json
- `16` - source file missing (commit / prune / archive pre-flight)
- `20` - doctor failure
- `99` - fatal/unexpected

When adding a command, claim an unused code in this range and document it in `memory.mjs` help text.

## Two-phase commit pattern

`commit.mjs` is the reference. The pattern:

1. **Simulate.** Apply every op to in-memory copies. Catch errors (orphan anchors, ambiguous matches, schema violations). On any error, exit non-zero with the failing action index. No file writes happened.
2. **Persist.** Once simulation passes, write each file. Update `state.json`. Clear the staging file. Print summary.

Lockfile at `AIDOCS/tools/staging/.lock` (per `LOCK_PATH`). Held during persist to prevent overlapping writes.

`prune.mjs` and `archive.mjs` are simpler - compute kept content in memory, then write once. Same "compute fully before mutating" philosophy without the simulation loop.

## Extension points

Prefer:
- A new function in an existing engine module if it fits semantically
- A new command in `commands/` if it's a new operation
- A new lib module only if the concern is distinct and non-overlapping

Avoid:
- Growing `memory.mjs` past its short-dispatch role
- Putting I/O in `markdown.mjs`
- Putting orchestration in `mutators.mjs`
- Runtime dependencies (zero-dep stance is load-bearing for the cross-tool template)

## `_index.json` manifests

Beyond paths and dispatch, `AIDOCS/_index.json` carries two optional manifests that doctor validates:

**`release_profile`** (string) names the project's deploy / publish shape so AutoPush picks the right command at Step 7. One of: `standards`, `npm-package`, `vscode-extension`, `cloudflare-worker`, `cloudflare-pages`, `static-site`, `none`. Absent means AutoPush falls back to its template guidance.

**`customizations[]`** (array of objects) declares intentional deviations from the standards. Future drift tooling reads this to distinguish drift from override. Each entry:

```json
{
  "id": "kebab-case-id",
  "description": "What the deviation is",
  "rule": "name of the auto-memory or DEV-AUDIT rule being deviated from",
  "applies_to": ["AIDOCS/SKILL/SKILL_AUTO-PUSH.md"],
  "reason": "why this deviation is intentional",
  "base": { "skill": "auto-push", "hash": "a3b5708224ab00b3" }
}
```

`id`, `description`, `rule` are required. `applies_to`, `reason`, and `base` are optional.

`applies_to` doubles as the **preserve signal for a customized skill body**: `init` skips any `AIDOCS/SKILL/SKILL_*.md` named there instead of overwriting it on an engine update, so a project's customized pipeline (its `SKILL_AUTO-PUSH.md`, say) survives. That is how a project keeps a custom skill while non-customized skills still receive engine updates. doctor checks that each `applies_to` path exists, since a stale path silently drops that protection.

`base` is the **re-merge signal for a skill customized as canonical base + delta**: it records the canonical skill key and a `skillBodyHash` of the canonical body the customization was merged from. When `init` preserves the body it compares that hash to the current canonical and prints a re-merge nudge if the canonical has advanced, so a customized pipeline can be refreshed against an improved spine at the next `/321 -Update` instead of drifting. Net-new project skills (no canonical equivalent) carry no `base`. doctor checks the `{ skill, hash }` shape when present.
