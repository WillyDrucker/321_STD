---
name: sync
description: Engine self-sync. Fetches the latest 321_STD release into INSTALL/engine, compares the project's installed engine_version against it, and brings the steady engine current - a minor update refreshes the engine + canonical skills (customizations preserved), a major update follows the release's upgrade notes and reruns the migrate-to-reconcile spine where needed. Updates the origin pointer and cleans up INSTALL/. Offline is a clean no-op on the local engine. Steady-tier, survives graduation.
---

# /321 -Sync

**Purpose:** Keep a project's steady engine current with the latest 321_STD release. Reuses the fetch-clone-cleanup spine. The latest release owns the upgrade path, keyed off the project's installed `engine_version`, so a project never carries upgrade logic - it fetches the release that knows how to upgrade it.

This is distinct from the `sync` engine command (which rebuilds `skills.dispatch`). `-Sync` updates the engine itself.

## Step 1: Read the pointer

```bash
node AIDOCS/tools/memory.mjs origin
```

Capture `repo`, `ref`, and the installed `engine_version`. If `origin` is absent (a pre-pointer install), proceed with the canonical defaults and write a pointer at the end.

## Step 2: Fetch the latest release

```bash
node AIDOCS/tools/memory.mjs fetch-engine
```

Defaults to the canonical repo/ref into `INSTALL/engine`. **Offline backstop:** a non-zero exit (21) means the fetch failed - report "offline, staying on local engine `<installed-version>`" and STOP. Steady work continues on the local engine. No error state.

## Step 3: Compare versions

```bash
git -C INSTALL/engine rev-parse --short HEAD
```

Compare the fetched commit to the installed `engine_version`:

- **Same** - already current. Print "engine current at `<version>`", remove `INSTALL/`, done.
- **Different** - an update is available. Decide minor vs major from the release's upgrade notes (Step 4).

## Step 4: Classify the update

Read the fetched release's upgrade signal: a `## Breaking` / upgrade section in `INSTALL/engine/CHANGELOG.md`, or an `INSTALL/engine/AIDOCS/runbooks/UPGRADE.md` if present, scoped to changes since the installed `engine_version`.

- **Minor** (additive engine fix, new optional field, doc change) - go to Step 5a.
- **Major** (schema change, structural rename, a moved contract) - go to Step 5b.

When in doubt, treat as minor (file refresh is non-destructive and customizations are preserved). Surface the decision and what you saw in the notes.

## Step 5a: Minor - refresh the steady engine

Re-run `init` from the fetched engine against the current project. `init` overwrites the engine and canonical skill bodies but **preserves any body flagged in `customizations[]`** (and prints a re-merge nudge when a customized body's canonical base has advanced):

```bash
node INSTALL/engine/AIDOCS/tools/memory.mjs init . --name <PROJECT> > /dev/null
node AIDOCS/tools/memory.mjs sync
node AIDOCS/tools/memory.mjs origin --version <fetched-version>
node AIDOCS/tools/memory.mjs doctor --structural-only
```

`<PROJECT>` is `_index.json -> project_name`. `init` writes scaffolds only where missing, so user content (MEMORY / SESSION / BACKLOG / WDDOCS / `_index.json`) is untouched - only the engine and non-customized skills refresh. If a re-merge nudge fired, fold the canonical advance into the customized body and update its `customizations[].base.hash`.

## Step 5b: Major - run the release's upgrade path

The release owns the upgrade. Follow its upgrade notes, keyed off the installed `engine_version`. Where the change is structural enough to need re-capture, rerun the migrate-to-reconcile spine: the fetched `INSTALL/engine/AIDOCS/runbooks/SETUP.md` re-captures, then `/321 -Update` reconciles. Update the pointer (`origin --version <fetched-version>`) when complete. B where judgment is needed, A for the mechanical apply.

## Step 6: Clean up

Remove `INSTALL/` once the engine is current (Step 5b may keep it until reconcile completes). The pointer makes it re-fetchable, so removal is not a one-way loss.

## Rules

- **The release owns the upgrade logic**, never the project. Always run the fetched release's path.
- **Customizations are preserved** across a refresh - `init` skips flagged bodies, and the re-merge nudge surfaces a drifted base.
- **Offline is a clean no-op.** Report and stay on the local engine. Never fail.
- **Minor refreshes, major migrates.** Default to minor when the signal is unclear - it is non-destructive.
