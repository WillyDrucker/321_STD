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
