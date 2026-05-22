# 321_STD Install Runbook

**Purpose:** The canonical bootstrap procedure - lay the 321_STD file shape into a target directory. The `install.sh` / `install.ps1` scripts implement this, and the AI-driven path (`321done.ai/std`) follows the same steps by hand. Onboarding-tier: ships in the fetched engine at `INSTALL/engine/AIDOCS/runbooks/INSTALL.md`, removed with `INSTALL/` at graduation. Install is pure A (scripted) - no judgment needed. The judgment lives in `SETUP.md`, which runs next.

## What install does

Fetch the latest release into the ephemeral `INSTALL/engine`, lay the steady engine + scaffolds into the target, register skills, health-check, and init git. The target is usable immediately. Setup (`/321 -Setup`) is the optional next step that fills the Big 6 or migrates an existing project.

## Prerequisites (A)

- **Node.js** (the engine is zero-dependency, standard library only).
- **git** (the fetch is a shallow clone, and install runs `git init` if the target is not already a repo).

If either is missing, stop and tell the user where to install it. Offline with no cached engine is the one hard stop - there is nothing to lay down.

## Steps

### 1. Resolve the target and name (A)

- Target defaults to the current directory. Create it if missing.
- Name defaults to the target's basename. Must match `^[A-Za-z][A-Za-z0-9_-]*$`.
- Release profile is optional - `init` auto-detects from project signals (`package.json`, `wrangler.toml`, framework configs) when omitted.

### 2. Fetch the engine into INSTALL/engine (A)

Shallow-clone the release into the target's ephemeral `INSTALL/engine`:

```bash
git clone --depth 1 --quiet https://github.com/WillyDrucker/321_STD.git <target>/INSTALL/engine
```

`INSTALL/` is gitignored and removed by the reconcile pass at graduation. It owns the onboarding engine + runbooks + setup scratch through install -> setup -> the start of reconcile. Post-install, `node AIDOCS/tools/memory.mjs fetch-engine` re-creates it on demand (used by `-Sync` and re-setup).

### 3. Lay the steady engine and scaffolds (A)

Run `init` from the fetched engine against the target:

```bash
node <target>/INSTALL/engine/AIDOCS/tools/memory.mjs init <target> --name <NAME> [--release-profile <profile>]
```

Plain `init` lays only the **steady tier** - the daily engine carries no onboarding machinery. (The migration path in `SETUP.md` re-runs `init --with-onboarding` to lay the full engine, which the reconcile pass carves back to steady at graduation.) `init` also resolves and seeds the per-machine auto-memory path, and writes scaffolds only where missing so it never clobbers user content.

### 4. Register skills and health-check (A)

```bash
cd <target>
node AIDOCS/tools/memory.mjs sync
node AIDOCS/tools/memory.mjs doctor --structural-only
```

`sync` rebuilds `_index.json -> skills.dispatch` from the skill bodies. `doctor --structural-only` verifies wiring without failing on a migrated project's inherited prose lint.

### 5. Init git (A)

```bash
git init --quiet   # only if the target is not already a repo
```

Do not create a remote or push - that is a user-initiated step.

### 6. Hand off to Setup

Print the completion summary and point the user to `/321 -Setup` (optional - fresh-install wizard or migration, auto-detected). The project is usable as-is. `INSTALL/` stays in place for the setup phase.

## Why fetch-from-git is the default

- **Every run executes the latest logic.** Install, setup, and upgrade always run the current release's scripts and runbooks, never stale local code.
- **No manual propagation.** A project pulls what it needs instead of having the engine hand-copied in.
- **Minimal persistent footprint.** Steady state carries the steady engine plus a small `origin` pointer, not the onboarding machinery.

The split that makes it safe: the steady engine stays local and self-contained (daily work needs no network), and only the onboarding tier is fetched on demand. Offline or no-git is a clean fallback for steady work - only an explicit update or re-setup needs the fetch.
