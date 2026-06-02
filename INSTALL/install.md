# Install runbook (bootstrap)

**Purpose:** A short narration of how a project gets installed, for reading or recovering by hand. The bootstrap scripts `install.sh` (macOS / Linux / Git Bash) and `install.ps1` (Windows) are the source of truth - this file explains what they do and how to run the same steps manually. Ephemeral - it sits under `INSTALL/`, which `graduate` removes once the project is steady.

## Run the script

From a clone of the 321 repo (the engine ships in the repo):

```
./install.sh --target ../my-project --name MyProject     (macOS / Linux / Git Bash)
.\install.ps1 -Target ..\my-project -Name MyProject      (Windows)
```

`--name` defaults to the target directory basename. A name must start with a letter and use only letters, digits, `_`, or `-`. With no local engine, the script shallow-clones the repo into a temp dir and removes it afterward.

`--privacy <public | private>` sets the tracking mode (default `private`). `private` tracks the project's own knowledge - the MEMORY / SESSION / BACKLOG data docs, the auto-memory, and the WDDOCS design docs. `public` keeps that knowledge local and tracks only the framework (engine, skills, registry, runbooks) plus the folder skeletons, so a public repo ships the code without leaking the project's memory. The default is private because it tracks everything - a missed call cannot silently hide content, and a public project passes `--privacy public`. Flip it later with `node AIDOCS/tools/engine.mjs privacy --set <mode>`.

## What it does

The bootstrap script runs the mechanical steps 1-6, then the install continues into setup (step 7):

1. **Check prerequisites.** Node.js and git must be on PATH.
2. **Resolve the target and name.** Create the target dir if missing, validate the name.
3. **Find the engine.** The repo this script ships in, or a temp clone of the repo.
4. **Scaffold.** `init <target> --name <NAME> [--privacy <mode>]` lays the skeleton - engine, skills, auto-memory, data files with the name substituted, and `INSTALL/` with these runbooks. The `.gitignore` is generated for the privacy mode (not copied), so a public install gates the project's own knowledge from the start. A reinstall (the migration relay) recalls the mode from the registry, then the archive, so it is not lost.
5. **Register and health-check.** `sync` builds the skill dispatch, `doctor` validates the shape. On a fresh scaffold doctor must pass. On an existing project the install does not fail on doctor - a preserved legacy `AGENTS.md` or unscrubbed `CHANGELOG` makes pre-migration findings expected, and the migration reconciles them - so they report and the install continues.
6. **Init git (fresh only).** `git init` if a fresh target is not already a repo. An existing project is left as the user has it - its version control is the user's call, not the installer's.
7. **Run setup.** The assistant driving the install then executes `INSTALL/setup.md` to finish onboarding (fresh fill or migration, auto-detected). Setup is part of the install, not a separate step the user has to invoke - it never depends on the `/321 -Setup` skill being loaded, since the runbook is executed directly. Run it through automatically: do not stop to ask how to proceed or which mode to use, and never offer to overwrite an existing project. Migration is non-destructive (it archives, never deletes), so it is safe to run with no git backup, and the only stop is the reconcile gate at the end.

A migration runs the full capture and stops at the reconcile gate, where `/321 -Update` takes over. The project is usable throughout.

## Existing projects

The same command serves a fresh or an existing project, and it is non-destructive. `init` recognizes what is already there before it writes, and reports it:

- **Existing 321 project** (a `.claude/skills/321/`, an `_index.json`, or `*_MEMORY` / `*_SESSION` data docs, even malformed) - existing content is preserved in place. Migration runs next as part of the install (the assistant executes `setup.md`: archive the known shape, sweep the rest, reinstall fresh, restore, then capture). This is automatic and non-destructive - the assistant does not ask whether to migrate or offer a fresh overwrite, and `init --force` is refused here, because overwriting an existing project is the data-loss path migration is built to avoid.
- **Existing project, no 321 yet** - your files are untouched, the canonical structure is laid around them, and setup captures the project into the Big 6.
- **Fresh** - the full skeleton is written and setup fills the Big 6 from your code.

`init` writes scaffold files only if missing - the engine and these runbooks always refresh, but data files (AGENTS, `_index.json`, MEMORY / SESSION / BACKLOG and the rest) are never clobbered. A direct `init ... --force` rewrites the scaffold anyway (a recovery flag the install scripts do not expose). Each mechanical step records to `INSTALL/INSTALL.log` (what ran, what moved where), an onboarding audit trail that `graduate` removes with `INSTALL/`.

## Install vs update (the AI-side choice)

An AI assistant landed at a 321 project should distinguish two lifecycle paths and pick the lighter one when it applies:

- **Install** (this runbook + `setup.md`) - laying the structure on a fresh or pre-321 target, or migrating a stale legacy install. Heavyweight: archives, reinstalls, restores, captures, reconciles. The right path when the project has no `_index.json`, when the data docs are stale or malformed, or when the user explicitly asked to (re)install.
- **Update** (`/321 -UpdateSync`) - refreshing the engine code, skill bodies, router, and manifest-driven structural changes from `engine.upstream`. Lightweight: touches engine-class paths only, leaves project data alone, runs in seconds. The right path when the registry is healthy and the project just needs the latest engine.

The install scripts (`install.sh`, `install.ps1`) print a notice when they detect an existing 321 install (registry present), pointing at `/321 -UpdateSync` as the lighter alternative, and continue with the full install if the user proceeds. An AI invoked into an existing-and-healthy 321 project should prefer `-UpdateSync` over re-running install, unless the user explicitly asked for a reinstall or migration.

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
