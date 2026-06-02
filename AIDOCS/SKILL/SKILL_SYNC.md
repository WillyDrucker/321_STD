---
name: sync
flag: "-SYNC"
description: Refresh the project's engine code, skill bodies, and router from its configured upstream. Reads engine.upstream, fetches, compares versions, copies the engine-class paths when newer, bumps the local engine.version, then rebuilds dispatch and runs doctor. Project data (memory, session, backlog, registry, auto-memory, WDDOCS) is never touched. Offline or no upstream is a clean no-op.
---

# /321 -SYNC

**Purpose:** Refresh the project's engine code from its configured upstream. Pulls the latest engine, skill bodies, and router from `engine.upstream`, leaving every project data file untouched. This is the only sanctioned engine-self-update path, separate from the daily-driver `-Update` chain. Distinct from the `sync` engine command, which only rebuilds dispatch from the bodies already on disk.

## Run

1. **Read the pointer.** Read `engine.version` and `engine.upstream` from `_index.json`. If `upstream` is empty, report "no upstream configured, nothing to sync" and stop. A project sets `upstream` to the repo it pulls its engine from.

2. **Fetch.**
   ```bash
   node AIDOCS/tools/engine.mjs fetch-engine --repo <engine.upstream>
   ```
   Lands the upstream engine in `INSTALL/engine`. Offline or a clone failure is a non-zero exit - report it and stop. The local engine keeps working.

3. **Compare.** Read `engine.version` from the fetched `INSTALL/engine/AIDOCS/_index.json`. Same as the local version means already current - clean up `INSTALL/` and stop. Anything else is treated as newer and continues to step 4.

4. **Refresh engine-class paths.** Copy from `INSTALL/engine` into the project, overwriting only the engine-class paths:
   - `AIDOCS/tools/` - the engine. `staging/` and `state.json` are gitignored and absent from a cloned source, so the project's own staging and watermarks survive.
   - `AIDOCS/SKILL/` - the canonical skill bodies. A project-custom skill body (one with no counterpart in the source) is preserved across the copy.
   - `.claude/skills/321/SKILL.md` - the router.

   Do NOT copy the data files (`<PROJECT>_*.md`), `_index.json`, `automemory/`, or `WDDOCS/` - those belong to the project. A graduated project (the `graduated` flag in `_index.json`) keeps `-Setup` deregistered - do not re-add its body. Then set `engine.version` in `_index.json` to the fetched version.

5. **Rebuild dispatch and verify.**
   ```bash
   node AIDOCS/tools/engine.mjs sync
   node AIDOCS/tools/engine.mjs doctor
   ```
   `sync` re-registers every skill body present in `AIDOCS/SKILL/` (canonical and project-custom). `doctor` confirms the steady surface is clean. Then remove `INSTALL/`.

## Rules

- **Engine only, never project data.** Engine code, skill bodies, and the router refresh. Memory, session, backlog, registry data (paths, caps, dispatch), auto-memory, and WDDOCS are project-owned and untouched.
- **Offline or no upstream is a clean no-op.** A missing upstream stops with a report. A failed clone stops with the offline message. The local engine keeps working in both cases.
- **Upstream owns the version.** The project pulls, it does not invent. A same-version fetch is current and stops without writing.
- **Custom skills survive.** A project-custom skill body (one not present in the source `AIDOCS/SKILL/` tree) is preserved across the copy. A canonical skill body is refreshed.

## Deferred (land when their engine does)

Customization preservation (keeping a project's edited canonical engine module across a refresh) and a real semver-aware version-compare plus upgrade-migration path land with the customizations manifest and a published upstream. Today the compare is string-equality (same is current, anything else continues), and a custom canonical body is overwritten by the refresh.
