# SYNC reference

**Purpose:** The full flow for `/321 -SYNC`, separated from the skill body so the body stays lean. The AI loads this file at step 3 of the skill and runs it. Engine code, skill bodies, the router, the manifest operations, the auto-memory seed, and the canonical sections of project data file templates all refresh from upstream. Project data (memory, session, backlog content, custom skill bodies, project specifics in templates) stays untouched. `customizations[]` and `engine.operations_applied[]` in `_index.json` are the two project-side bookkeeping arrays this flow honors.

## Run

1. **Read the pointer.** Read `engine.version` and `engine.upstream` from `_index.json`. Empty `upstream` reports "no upstream configured, nothing to sync" and stops. A project sets `upstream` to the repo it pulls its engine from.

2. **Fetch.**
   ```bash
   node AIDOCS/tools/engine.mjs fetch-engine --repo <engine.upstream>
   ```
   Lands the upstream engine in `INSTALL/engine`. A clone failure (offline, bad ref) is a non-zero exit. Report it and stop. The local engine keeps working.

3. **Compare.** Read `engine.version` from `INSTALL/engine/AIDOCS/_index.json`. Same as the local version with an empty manifest delta means already current. Clean up `INSTALL/` and stop. Anything else continues.

4. **Apply the upgrade.**
   ```bash
   node AIDOCS/tools/engine.mjs upgrade
   ```
   This command does the work. It reads `INSTALL/engine/AIDOCS/MANIFEST.json`, diffs against the project's `engine.operations_applied[]`, runs each missing operation, copies the engine-class paths with customization preservation, section-merges canonical content in data file templates, and writes a summary. See Operations and Customizations below for the rules.

5. **Rebuild dispatch and verify.**
   ```bash
   node AIDOCS/tools/engine.mjs sync
   node AIDOCS/tools/engine.mjs doctor
   ```
   `sync` re-registers every skill body present in `AIDOCS/SKILL/`. `doctor` confirms the surface is clean. Read the doctor output. Real findings on project content (banned prose, oversized buckets) are pre-existing project debt for `-Update` / `scrub --fix` to handle, not sync failures.

6. **Bump and clean.** `upgrade` already bumped `engine.version` to the fetched version. Remove `INSTALL/`. A graduated project (the `graduated` flag in `_index.json`) keeps `-Setup` deregistered. If `SKILL_SETUP.md` reappeared in the copy, delete it.

## Operations

A manifest operation is a named structural change. The list is append-only and lives in `AIDOCS/MANIFEST.json` in the engine source. The project records which operation names it has applied under `engine.operations_applied[]`. New names in the source manifest that are not in the project list run on the next `-SYNC`.

| Type                 | Fields                                    | What it does                                                                                                |
|----------------------|-------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `skill_delete`       | `file` (basename in `AIDOCS/SKILL/`)      | Removes the skill body from the project. Subsequent `sync` drops it from the dispatch.                      |
| `skill_rename`       | `from`, `to` (basenames), `flag_to`       | Deletes the old skill body, lets the new one arrive via the copy step. The new body's `flag:` frontmatter owns the displayed flag. |
| `registry_extend`    | `path` (dotted), `value`                  | Adds or sets the path in `_index.json` only if absent. Never overwrites a present value (caps and other project-tuned numbers stay project-owned). |
| `file_add_template`  | `file` (relative to root), `body`         | Creates the file with the body if absent. Never overwrites an existing file. For new project template files like `<NAME>_BACKLOG_EXTENDED.md`. The body uses `PROJECTNAME` which gets substituted to the project's name on apply. |
| `automemory_add`     | `file` (basename in `AIDOCS/automemory/`) | Writes the seed file from `INSTALL/engine/AIDOCS/automemory/<file>` if absent in the project's seed. The runtime `auto_memory.path` is left to the user's `-Update` step (the seed is the source of truth, the runtime is reseeded on demand). |
| `section_text_diff`  | `file` (relative), `section`, `body`      | Replaces the named `## <section>` body in the project file with the given body, unless the project-relative `file` path is listed in `customizations[]`. Section-level customization (one section edited inside an otherwise-canonical file) is not detected - mark the whole file customized to opt out. A future drift check (Phase B) will compare against a prior-canonical baseline and skip on a real user edit. |

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

`customizations[]` in `_index.json` is the project's opt-out list. Each entry is a project-relative path the user has deliberately edited and wants preserved across upgrades. The `upgrade` command:

- Skips listed paths in the copy step.
- Skips `section_text_diff` operations whose `file` is listed, and reports the skip.

A drift check (doctor flags when a non-listed canonical file diverges from what the upstream ships) is Phase B work, not built yet. Until it lands, an un-customized file that the user has nonetheless edited will be overwritten on `-SYNC`. Mark a customized file in `customizations[]` before running `-SYNC` to protect it.

When the user wants a one-time override for a single operation (apply it even though the file is customized), they edit the file by hand and add the operation name to `operations_applied[]` manually.

## Rules

- **Engine + canonical content, never project content.** Engine code, skill bodies, router, canonical sections of templates, and auto-memory seed refresh. Project content (LIFO bullets, custom skills, project specifics in templates, cap values, project-edited canonical sections) is left alone.
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
