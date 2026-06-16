---
name: updatesync
description: Refresh the project's engine code, skill bodies, router, manifest-driven structural changes, and canonical sections of project data file templates from its configured upstream. Reads engine.upstream, fetches, applies the manifest delta, copies engine-class paths with customization preservation, rebuilds dispatch, and runs doctor. Project-authored content is preserved. Canonical sections may update via section_text_diff manifest ops unless the file is in customizations[]. Offline or no upstream is a clean no-op.
---

# /321 -UpdateSync

**Purpose:** Refresh the project's engine and engine-managed canonical content from its configured upstream. The only sanctioned upgrade path, separate from the daily-driver `-Update` chain. Engine code, skill bodies, the router, the manifest operations, the auto-memory seed, and the canonical sections of project data file templates all refresh from upstream. Project-authored content stays untouched: LIFO bullets, the project-specifics sub-sections in templates, custom skill bodies (no source counterpart), and anything listed in `customizations[]`. Canonical sections in template files (DEV-AUDIT baseline, AUTO-PUSH baseline, CHANGELOG header) may refresh via `section_text_diff` manifest ops unless the file is in `customizations[]`. `customizations[]` and `engine.operations_applied[]` in `_index.json` are the two project-side bookkeeping arrays this flow honors.

## Run

1. **Read the pointer and the gate.** Read `engine.version` and `engine.upstream` from `_index.json`. Empty `upstream` reports "no upstream configured, nothing to sync" and stops. A project sets `upstream` to the repo it pulls its engine from. Also read `node AIDOCS/tools/engine.mjs state` - if it reports `reconcile_pending: true`, stop. The reconcile pass owns the project's surface until it clears the gate (`/321 -Update` runs that pass), and an engine refresh mid-reconcile can overwrite in-flight hand edits via `section_text_diff` or the engine-class copy. The engine itself refuses `upgrade` while the gate is set unless `--force` is passed - this stop honors that contract from the AI side too.

   **Crossing from a pre-0.1.x engine line.** If `engine.upstream` is unset and the project's local engine is older than 0.1.x (no `MANIFEST.json`, no `engine.operations_applied[]`, no `-UpdateSync` first-class skill), the steps below describe the modern path. The one-shot bootstrap from pre-0.1.x is: set `engine.upstream` to the upstream repo URL by hand, then run the modern flow (the old engine's `-Update -Sync` mode body cannot describe `upgrade` and the rename ops because they did not exist at its release).

   **Crossing a version boundary: drive from the upstream engine (`--root`).** When the local engine is far behind, or predates a guard (the import-aware orphan class, the post-copy reconcilers), the in-place flow means the OLD engine executes step 6, where the copy swaps both the engine code and this skill body underneath the run. The robust alternative is to point a known-good upstream engine at the target instead of upgrading in place. From a current engine checkout (your `321_STD` clone, or any project already on the target version):
   ```bash
   node <upstream>/AIDOCS/tools/engine.mjs fetch-engine --from <upstream> --root <project>
   node <upstream>/AIDOCS/tools/engine.mjs compare       --root <project>
   node <upstream>/AIDOCS/tools/engine.mjs upgrade       --root <project>
   ```
   The driving engine is the new version the whole time, so it knows every op type, never blind-drops a still-imported module, applies the upgrade in one pass, and never swaps the body mid-run. No pre-upgrade `orphans` dance, no second fetch. Verify by loading the project's OWN upgraded engine afterward: `node AIDOCS/tools/engine.mjs doctor` from the project root. This is the preferred path for any pre-guard or multi-version crossing. The in-place flow below stays the steady-state path once the project carries a current, guarded engine.

2. **Fetch.**
   ```bash
   node AIDOCS/tools/engine.mjs fetch-engine
   ```
   Lands the upstream engine in `INSTALL/engine`. With no flag, `fetch-engine` defaults `--repo` from `engine.upstream` (the registry already knows it). Pass `--repo <url>` to override or `--from <dir>` for a local checkout. A clone failure (offline, bad ref) is a non-zero exit. Report it and stop. The local engine keeps working.

3. **Compare.** Run the read-only update check:
   ```bash
   node AIDOCS/tools/engine.mjs compare
   ```
   It prints the local-vs-upstream `engine.version` and the names of any manifest operations present upstream but not yet in `engine.operations_applied[]` - the answer to "is there anything to sync" without a hand-rolled diff. Three cases:

   - **Default mode, same version + empty manifest delta:** the engine is already current. Clean up `INSTALL/engine/` and stop here. The lean routine sync does not re-walk maintenance steps when there is nothing to upgrade.
   - **`-FULL` mode, same version + empty manifest delta:** the engine is current but `-FULL` is the comprehensive sweep, so fall through to step 4 (`merge-status --auto-drop-clean`) and step 5 (`orphans --auto-drop-safe`) to surface customization drift and stale files even when the engine itself has not changed. Steps 6-8 still execute (snapshot, copy of engine-class files, registry rewrite, sync rebuild, doctor). The manifest delta is empty, so the run is idempotent when the canonical content already matches upstream - but the copy step still refreshes any unlisted local edit to a canonical engine file, so list such a file in `customizations[]` first to preserve it.
   - **Any other state** (version changed, missing manifest ops, or both): continue to step 4 to run the full flow.

4. **Merge `customizations[]` (AI-driven, before the script upgrade).** `customizations[]` is not an opt-out from upstream - it is a merge hint. The script-level skip in copy / `file_delete` / `skill_delete` / `skill_rename` / `section_text_diff` is the fallback for headless runs. With AI present (the normal `-UpdateSync` invocation), merge first so each listed file picks up upstream improvements without losing local intent, and the entry self-cleans when no longer load-bearing.

   Get the punch list:
   ```bash
   node AIDOCS/tools/engine.mjs merge-status
   ```
   The output groups each `customizations[]` entry into one of five classes. Walk each:

   - **identical** - upstream content matches the project file. Drop the entry from `customizations[]`. The customization is no longer load-bearing.
   - **diverged** - both sides changed. Read the project file and `INSTALL/engine/<same path>`, author a merged version that preserves the local intent (the reason it was customized) AND folds in the upstream changes (new sections, tightened wording, structural fixes). Write the merged content to the project file. If the merged result happens to equal upstream, drop the entry. Otherwise keep it.
   - **both-absent** - neither side has the file. The customization is a dead reference. Drop the entry.
   - **local-absent** - upstream has the file, project does not. Dropping the customization would let the next upgrade restore the file from upstream. Judge whether the local deletion was intentional: keep the entry if so (the deletion is a customization), drop the entry if the file should come back.
   - **upstream-absent** - the project has the file, upstream does not. Check the upstream `INSTALL/engine/AIDOCS/MANIFEST.json` for a `file_delete` op covering the path. If covered: dropping the customization would let the next upgrade delete the local file - judge whether the local content is still worth keeping (keep it AND the entry, or delete it AND drop the entry). If not covered: the file is a project-custom skill or doc mistakenly listed - drop the entry, project-custom files survive by absence.

   After the merge pass, write the trimmed `customizations[]` back to `_index.json`. Continue to step 5.

   **`-FULL` shortcut.** When invoked as `/321 -UpdateSync -FULL`, replace this step's read-only walk with a one-shot pass that runs the mechanical sweep first:
   ```bash
   node AIDOCS/tools/engine.mjs merge-status --auto-drop-clean
   ```
   This drops the **identical** and **both-absent** entries from `customizations[]` without AI judgment (the file matches upstream verbatim, or no file exists on either side). The other three classes (**diverged**, **local-absent**, **upstream-absent**) survive the sweep because dropping the customization there would let the next upgrade restore, delete, or overwrite a file the user has a position on. Walk the survivors per the per-class rules above. The `--auto-drop-clean` flag is idempotent and read-only when no clean entries exist. On a project with no customizations or only judgment-required classes, it prints a no-op message and continues.

5. **Walk orphans (AI-driven, before the upgrade).** Stale engine-class files left behind by older engine versions persist downstream unless an explicit `file_delete` manifest op removes them. The `orphans` command surfaces these for AI review so the cleanup is intentional, not accidental. Headless runs use `--auto-drop-safe` for the mechanically safe class.

   Get the punch list:
   ```bash
   node AIDOCS/tools/engine.mjs orphans
   ```
   The output groups orphans into four classes:

   - **safe** - engine-only paths (`AIDOCS/tools/lib/` + top-level `AIDOCS/tools/*.md`) the live engine no longer imports. No user file lives in these paths (`engine.mjs` is always present upstream so it never appears here). Mechanically safe to drop. Honors `customizations[]`.
   - **live-import** - engine-only paths absent upstream but STILL imported by the local engine (a rename whose new name lands on the upgrade copy step). Held back from the safe class and never auto-dropped: dropping one pre-upgrade would brick the running engine on its next call. The manifest `file_delete` ops clean these post-copy, at the point nothing imports them. Informational only - no action needed.
   - **review-skill** - files in `AIDOCS/SKILL/` with no upstream counterpart. Either a project-custom skill (the project authored it, keep) or an abandoned canonical (upstream deleted the file but no `skill_delete` / `file_delete` op was added, drop). Decide per file. Project-custom skills do NOT belong in `customizations[]` - the array is for edits to canonical files. Project-custom files survive by absence in the copy step and will re-appear in this class on each sync as a reminder.
   - **review-automemory** - files in `AIDOCS/automemory/` with no upstream counterpart. A `project_*`, `user_*`, or `reference_*` file is usually project-owned (keep). A `feedback_*` not in upstream is either an abandoned canonical (drop) or a project-custom feedback rule (keep). Auto-memory files are seeded write-if-missing by `init` and `automemory_add`, so project-custom rules survive without listing in `customizations[]`.

   After the review pass, drop or keep per entry. Continue to step 6.

   **`-FULL` shortcut.** When invoked as `/321 -UpdateSync -FULL`, replace this step's read-only walk with the one-shot mechanical sweep:
   ```bash
   node AIDOCS/tools/engine.mjs orphans --auto-drop-safe
   ```
   This drops the **safe** class only (engine-only paths with no risk of touching user files). The **safe** class is import-guarded - a module the running engine still imports is held in the **live-import** class instead, so the pre-upgrade sweep cannot brick the engine even across a rename. The two review classes (review-skill, review-automemory) survive the sweep because dropping there would risk deleting a project-custom skill body or a project-owned auto-memory rule. Walk the survivors by AI judgment, as in the default flow above. The flag is idempotent and read-only when no safe orphans exist.

   **Crossing from a pre-guard engine line.** The import guard lives in the engine, so a project whose LOCAL engine predates it (any engine that renamed lib modules without the live-import class) runs the OLD, unguarded sweep on its first sync. Driving that first pass, do NOT run the pre-upgrade `orphans --auto-drop-safe`: go straight from `merge-status` to the `upgrade`, let the manifest `file_delete` ops clean the renamed modules post-copy, then run `orphans` once the new engine is in place to sweep any genuinely dead leftovers. After that first pass the project carries the guarded engine and the normal flow is safe. Cleaner still for this exact case: drive the whole upgrade from an upstream engine via `--root` (step 1), which is guarded the whole time and sidesteps the boundary entirely.

6. **Apply the upgrade.** Preview first when uncertain:
   ```bash
   node AIDOCS/tools/engine.mjs upgrade --dry-run
   ```
   Reports the operations list, file counts, version bump, and `customizations[]` skip list without writing. If anything is unexpected, hold and resolve before applying.

   Then apply for real:
   ```bash
   node AIDOCS/tools/engine.mjs upgrade
   ```
   Reads `INSTALL/engine/AIDOCS/MANIFEST.json`, diffs against the project's `engine.operations_applied[]`, runs each missing operation, copies the engine-class paths with customization preservation, and writes a summary. See Operations and Customizations below for the rules.

   **The copy may replace this skill body.** The copy step refreshes `AIDOCS/SKILL/`, which includes this file. When `engine.version` changes, the procedure can be redefined mid-run - new commands, new steps, a flag you already passed gaining meaning it did not have at the start. After `upgrade`, if the version bumped, re-read `AIDOCS/SKILL/SKILL_UPDATE-SYNC.md` and finish per the freshly-copied body, not the one you started on. The `--root` driven path in step 1 sidesteps this entirely, since the driving engine never swaps underneath the run. The upgrade also prints a commit-state line when it runs in a git repo (`engine version mismatch: HEAD x, tree y`), the reminder to commit or revert the engine change on its own before `-AutoPush` folds it into an unrelated commit.

7. **Rebuild dispatch and verify.**
   ```bash
   node AIDOCS/tools/engine.mjs sync
   node AIDOCS/tools/engine.mjs doctor
   ```
   `sync` re-registers every skill body present in `AIDOCS/SKILL/`. `doctor` confirms the structural surface is clean. Read the doctor output **and its exit code**, which splits the two failure kinds: **20 is a structural break** (the engine surface is wrong - the upgrade did not land cleanly, investigate, do not accept the sync), **10 is content-only debt** with the structure intact (banned prose in CHANGELOG history, semicolons in over-long EXTENDED entries, sub-section budget hints, oversized buckets), and **0 is clean** (advisory warnings may still print). A content-debt exit (10) is project debt for `/321 -Update` / `scrub --fix` to handle, not a sync failure - report it as pre-existing, do not retry the upgrade. A structural exit (20) means the upgrade left the surface wrong - resolve it before the sync is done.

8. **Verify the cleanup.** `upgrade` already bumped `engine.version` and cleaned up the fetched source: `INSTALL/engine/` is removed on success, and `INSTALL/` itself is removed if it became empty (the steady-state case on a graduated project). A graduated project keeps `-Setup` deregistered, and the engine already deletes `SKILL_SETUP.md` post-copy if it slipped in. Mid-migration `INSTALL/` survives with its runbooks plus `INSTALL.log` waiting for `graduate`. No manual `rm` needed in either case.

9. **Report.** Summarize: merges applied and entries dropped (from step 4), orphans dropped or surfaced (from step 5), operations applied (from the `upgrade` summary), files changed / identical (from the copy report), the commit-drift advisory if it printed, doctor verdict. Anything left as a manual note bubbles up to the user.

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
| `file_delete`        | `file` (relative to root)                 | Removes the file from the project if present. For engine-class files removed upstream that linger downstream (e.g. a reference doc folded into a skill body, or an orphaned tree from an older engine generation). Idempotent: an already-absent file is a clean no-op. Path-contained against the project root. Honors `customizations[]` - a listed path is skipped with a note (the user removes from `customizations[]` to apply, mirroring the copy step's opt-out). |
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

`customizations[]` is a **merge hint**, not an opt-out. Each entry is a project-relative path with local edits worth preserving. The default `-UpdateSync` flow with AI present (step 4 above) merges each entry against upstream and self-cleans the array as upstream catches up. The script-level skip in `upgrade` (copy step + `section_text_diff` + `file_delete` + `skill_delete` + `skill_rename`) is the fallback for headless runs.

Three things keep project edits from being lost on `-UpdateSync`:

- **Project-custom files survive by absence.** A skill body (or any file in an engine-class path) with no counterpart in the source tree is never touched, because the copy walks the source. Most project-specific skills live this way - they do NOT belong in `customizations[]`, the array is for edits to canonical files.
- **AI-driven merge (the default).** Step 4 walks `customizations[]`, classifies each entry via `merge-status`, and either drops the entry (upstream caught up), merges (local + upstream → preserved local intent + new upstream content), or judges the upstream-absent case. Self-cleaning: the array shrinks as merges land and upstream catches up to local intent.
- **Script fallback (no AI present).** `upgrade` skips every path in `customizations[]` (copy + delete + rename + section_text_diff). The local file is preserved verbatim, no merge happens, and the entry stays. Surface the skipped paths so the user knows to re-run with AI later, or drop entries by hand if upstream already caught up.

A drift check that flags an edited canonical file the user forgot to list is Phase B work. Until it lands, a canonical file edited without listing it in `customizations[]` will be overwritten on the next `-UpdateSync`. List it first.

**`--dry-run` previews everything without writing.** Run `upgrade --dry-run` first if uncertain. Same operations, same counts, no disk changes. The merge step (4) is also safe to walk read-only: `merge-status` is read-only, and you can author the merge into a scratch file before deciding whether to commit.

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
