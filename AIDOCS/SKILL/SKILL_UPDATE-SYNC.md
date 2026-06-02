---
name: updatesync
description: Refresh the project's engine code, skill bodies, router, manifest-driven structural changes, and canonical sections of project data file templates from its configured upstream. Reads engine.upstream, fetches, applies the manifest delta, copies engine-class paths with customization preservation, rebuilds dispatch, and runs doctor. Project-authored content is preserved. Canonical sections may update via section_text_diff manifest ops unless the file is in customizations[]. Offline or no upstream is a clean no-op.
---

# /321 -UpdateSync

**Purpose:** Refresh the project's engine and engine-managed canonical content from its configured upstream. The only sanctioned upgrade path, separate from the daily-driver `-Update` chain. Engine code, skill bodies, the router, the manifest operations, the auto-memory seed, and the canonical sections of project data file templates all refresh from upstream. Project data (memory, session, backlog content, custom skill bodies, project specifics in templates) stays untouched. `customizations[]` and `engine.operations_applied[]` in `_index.json` are the two project-side bookkeeping arrays this flow honors.

## Run

1. **Read the pointer and the gate.** Read `engine.version` and `engine.upstream` from `_index.json`. Empty `upstream` reports "no upstream configured, nothing to sync" and stops. A project sets `upstream` to the repo it pulls its engine from. Also read `node AIDOCS/tools/engine.mjs state` - if it reports `reconcile_pending: true`, stop. The reconcile pass owns the project's surface until it clears the gate (`/321 -Update` runs that pass), and an engine refresh mid-reconcile can overwrite in-flight hand edits via `section_text_diff` or the engine-class copy. The engine itself refuses `upgrade` while the gate is set unless `--force` is passed - this stop honors that contract from the AI side too.

2. **Fetch.**
   ```bash
   node AIDOCS/tools/engine.mjs fetch-engine --repo <engine.upstream>
   ```
   Lands the upstream engine in `INSTALL/engine`. A clone failure (offline, bad ref) is a non-zero exit. Report it and stop. The local engine keeps working.

3. **Compare.** Read `engine.version` from `INSTALL/engine/AIDOCS/_index.json`. Same as the local version with an empty manifest delta means already current. Clean up `INSTALL/` and stop. Anything else continues.

4. **Apply the upgrade.** Preview first when uncertain:
   ```bash
   node AIDOCS/tools/engine.mjs upgrade --dry-run
   ```
   Reports the operations list, file counts, version bump, and `customizations[]` skip list without writing. If anything is unexpected, hold and resolve before applying.

   Then apply for real:
   ```bash
   node AIDOCS/tools/engine.mjs upgrade
   ```
   Reads `INSTALL/engine/AIDOCS/MANIFEST.json`, diffs against the project's `engine.operations_applied[]`, runs each missing operation, copies the engine-class paths with customization preservation, and writes a summary. See Operations and Customizations below for the rules.

5. **Rebuild dispatch and verify.**
   ```bash
   node AIDOCS/tools/engine.mjs sync
   node AIDOCS/tools/engine.mjs doctor
   ```
   `sync` re-registers every skill body present in `AIDOCS/SKILL/`. `doctor` confirms the surface is clean. Read the doctor output. Real findings on project content (banned prose, oversized buckets) are pre-existing project debt for `-Update` / `scrub --fix` to handle, not sync failures.

6. **Verify the cleanup.** `upgrade` already bumped `engine.version` and cleaned up the fetched source: `INSTALL/engine/` is removed on success, and `INSTALL/` itself is removed if it became empty (the steady-state case on a graduated project). A graduated project keeps `-Setup` deregistered, and the engine already deletes `SKILL_SETUP.md` post-copy if it slipped in. Mid-migration `INSTALL/` survives with its runbooks plus `INSTALL.log` waiting for `graduate`. No manual `rm` needed in either case.

7. **Report.** Summarize: operations applied (from the `upgrade` summary), files copied, doctor verdict. Anything left as a manual note (post-graduation cleanup, customized sections that were skipped) bubbles up to the user.

## Operations

A manifest operation is a named structural change. The list is append-only and lives in `AIDOCS/MANIFEST.json` in the engine source. The project records which operation names it has applied under `engine.operations_applied[]`. New names in the source manifest that are not in the project list run on the next `-UpdateSync`.

| Type                 | Fields                                    | What it does                                                                                                |
|----------------------|-------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `skill_delete`       | `file` (basename in `AIDOCS/SKILL/`)      | Removes the skill body from the project. Subsequent `sync` drops it from the dispatch.                      |
| `skill_rename`       | `from`, `to` (basenames), `flag_to`       | Deletes the old skill body. The new one arrives via the copy step. The dispatched flag is derived from the new filename, or pulled from a `flag:` frontmatter override if present. `flag_to` records the expected flag for manifest review. |
| `registry_extend`    | `path` (dotted), `value`                  | Adds or sets the path in `_index.json` only if absent. Never overwrites a present value (caps and other project-tuned numbers stay project-owned). |
| `registry_rename`    | `from`, `to` (dotted paths)               | Renames a key in `_index.json` by traversing the dotted path as nested-object access. Reads the value at `from`, writes it at `to`, deletes `from`. Idempotent: from-absent + to-present is a clean no-op (already migrated). Both present with equal values drops `from` cleanly (partial-run recovery). Both present with different values throws (operator resolves by hand). |
| `dictionary_rename`  | `dictionary` (dotted), `from`, `to` (literal keys) | Renames a flat key inside a single-level dictionary - `dictionary` is the dotted path to the parent (traversed), `from` and `to` are literal key names (not traversed). Use this when the keys themselves contain dots (e.g., `files["updatememory.memory"]`), which `registry_rename`'s dot-splitting cannot reach. Same idempotency cases as `registry_rename`. |
| `file_add_template`  | `file` (relative to root), `body`         | Creates the file with the body if absent. Never overwrites an existing file. For new project template files like `<NAME>_BACKLOG_EXTENDED.md`. The body uses `PROJECTNAME` which gets substituted to the project's name on apply. Path-contained against the project root - a `../` escape is rejected. |
| `file_delete`        | `file` (relative to root)                 | Removes the file from the project if present. For engine-class files removed upstream that linger downstream (e.g. a reference doc folded into a skill body). Idempotent: an already-absent file is a clean no-op. Path-contained against the project root. |
| `automemory_add`     | `file` (basename in `AIDOCS/automemory/`) | Writes the seed file from `INSTALL/engine/AIDOCS/automemory/<file>` if absent in the project's seed. Also seeds the external runtime memory at `auto_memory.path` write-if-missing, so the canonical rule reaches the harness without waiting for a re-install. The op rejects anything that is not a bare basename. |
| `section_text_diff`  | `file` (relative), `section`, `body`      | Replaces the named `## <section>` body in the project file with the given body, unless the project-relative `file` path is listed in `customizations[]`. Section-level customization (one section edited inside an otherwise-canonical file) is not detected. Mark the whole file customized to opt out. Path-contained against the project root. A future drift check (Phase B) will compare against a prior-canonical baseline and skip on a real user edit. |

Operations are idempotent. Re-running a `skill_delete` for an already-deleted file is a clean no-op. `registry_extend` for an already-present path is a no-op. Apply order is the manifest array order, so a later operation can build on an earlier one without coordinating across releases.

After all missing operations run, append their names to `engine.operations_applied[]` in the order they were applied.

## Copy step

After operations, the engine-class paths copy from `INSTALL/engine` into the project:

- `AIDOCS/tools/` (engine code)
- `AIDOCS/SKILL/` (canonical skill bodies)
- `.claude/skills/321/SKILL.md` (router)

A file in any of these is replaced if:
- It exists in `INSTALL/engine/<same path>`, AND
- Its project-relative path is NOT listed in `customizations[]`, AND
- For `AIDOCS/SKILL/`: the project has a matching canonical body (project-custom skill bodies, those with no counterpart in the source tree, are never touched).

A graduated project keeps `-Setup` deregistered. If the copy lands `SKILL_SETUP.md`, delete it after the copy.

## Customizations

Three things keep project edits from being overwritten on `-UpdateSync`:

- **Project-custom files survive by absence.** A skill body (or any file in an engine-class path) with no counterpart in the source tree is never touched, because the copy walks the source. Most project-specific skills live this way.
- **`customizations[]` opts a canonical file out.** Each entry is a project-relative path the user has deliberately edited and wants preserved. The `upgrade` command skips listed paths in the copy step, and skips `section_text_diff` operations whose `file` is listed (reporting the skip).
- **`--dry-run` previews everything without writing.** Run `upgrade --dry-run` first if uncertain. Same operations, same counts, no disk changes.

A drift check that flags an edited canonical file the user forgot to list is Phase B work. Until it lands, a canonical file edited without listing it in `customizations[]` will be overwritten on the next `-UpdateSync`. List it first.

For a one-time override on a single operation (apply it even though the file is customized), edit the file by hand and add the operation name to `operations_applied[]` manually.

## Rules

- **Engine + canonical content, never project content.** Engine code, skill bodies, router, canonical sections of templates, and auto-memory seed refresh. Project content (LIFO bullets, custom skills, project specifics in templates, cap values, project-edited canonical sections) is left alone.
- **Never run `-UpdateSession` or `-UpdateMemory` from here.** `-UpdateSync` is the upgrade path, not the daily driver. The daily-driver chain is `/321 -Update`.
- **Append-only manifest.** Operations are named and appended. The same name never appears twice. A bad operation in a past release stays in history with no recall mechanism (forward fix only).
- **Idempotent operations.** Re-applying any operation is safe. `operations_applied[]` is the journal, not the gate.
- **Offline / no upstream is a clean no-op.** A missing `upstream` stops with a report. A failed clone stops with the offline message. The local engine keeps working.
- **Upstream owns the version.** The project pulls, it does not invent. Same version with empty manifest delta is current.
- **Custom skills survive.** A project-custom skill body (no counterpart in the source tree) is preserved.
- **Customized canonical files survive.** A path in `customizations[]` is left alone on copy and on `section_text_diff`.

## Edge cases

- **First sync after manifest lands.** A project whose `engine.operations_applied[]` is empty and whose manifest is non-empty applies every operation in order. This is the normal catch-up, not a bootstrap shortcut. Each operation is idempotent so already-effective changes (a file already present, a key already set) report no-op.
- **Operations_applied missing entirely.** Treat as empty array, apply all operations.
- **Manifest missing in source.** Treat as empty operations, copy step only. Backwards-compatible with pre-manifest engines.
- **Graduated project.** Skip `-Setup` reregistration. After copy, if `SKILL_SETUP.md` exists, delete it.
- **`engine.version` mismatch with empty manifest delta.** A version bump with no operations to apply is the engine-only refresh path (engine code changed, no structural changes). Run the copy step and bump.
- **`engine.version` match with operations to apply.** Possible when the source version did not bump but the manifest grew (rare, but valid). Apply the operations.
