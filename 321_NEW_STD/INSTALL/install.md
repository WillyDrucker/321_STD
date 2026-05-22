# Install runbook (bootstrap)

**Purpose:** A short narration of how a project gets installed, for reading or recovering by hand. The bootstrap scripts `install.sh` (macOS / Linux / Git Bash) and `install.ps1` (Windows) are the source of truth - this file explains what they do and how to run the same steps manually. Ephemeral - it sits under `INSTALL/`, which `graduate` removes once the project is steady.

## Run the script

From a clone of the 321 repo (the engine ships in the repo):

```
./install.sh --target ../my-project --name MyProject     (macOS / Linux / Git Bash)
.\install.ps1 -Target ..\my-project -Name MyProject      (Windows)
```

`--name` defaults to the target directory basename. A name must start with a letter and use only letters, digits, `_`, or `-`. With no local engine, the script shallow-clones the repo into a temp dir and removes it afterward.

## What it does

1. **Check prerequisites.** Node.js and git must be on PATH.
2. **Resolve the target and name.** Create the target dir if missing, validate the name.
3. **Find the engine.** The repo this script ships in, or a temp clone of the repo.
4. **Scaffold.** `init <target> --name <NAME>` lays the skeleton - engine, skills, auto-memory, data files with the name substituted, and `INSTALL/` with these runbooks.
5. **Register and health-check.** `sync` builds the skill dispatch, `doctor` validates the shape.
6. **Init git.** `git init` if the target is not already a repo.

The project is usable immediately. `/321 -Setup` is the optional first-run step (fresh fill or migration), and it follows `INSTALL/setup.md`.

## Existing projects

The same command serves a fresh or an existing project, and it is non-destructive. `init` recognizes what is already there before it writes, and reports it:

- **Existing 321 project** (a `.claude/skills/321/`, an `_index.json`, or `*_MEMORY` / `*_SESSION` data docs, even malformed) - existing content is preserved in place. Migration runs next, in `/321 -Setup` (it follows `setup.md`: archive the known shape, sweep the rest, reinstall fresh, restore, then capture).
- **Existing project, no 321 yet** - your files are untouched, the canonical structure is laid around them, and `-Setup` captures the project into the Big 6.
- **Fresh** - the full skeleton is written and `-Setup` fills the Big 6 from your code.

`init` writes scaffold files only if missing - the engine and these runbooks always refresh, but data files (AGENTS, `_index.json`, MEMORY / SESSION / BACKLOG and the rest) are never clobbered. `--force` rewrites the scaffold anyway. Each mechanical step records to `INSTALL/INSTALL.log` (what ran, what moved where), an onboarding audit trail that `graduate` removes with `INSTALL/`.

## Manual / recovery drive

If the scripts cannot run, or you are recovering, run the engine steps directly from a target that already has the engine:

```
node AIDOCS/tools/engine.mjs sync
node AIDOCS/tools/engine.mjs doctor
```

To scaffold a fresh target from an engine you have locally:

```
node <engine>/AIDOCS/tools/engine.mjs init <target> --name <NAME>
```
