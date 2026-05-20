# 321_STD

**Purpose:** AI-assisted project standards. A self-contained markdown-based memory / session / backlog system plus a Node.js engine for two-phase staging commits. Scaffolds into any new project with one command. The AI drives the workflow, scripts handle the bookkeeping.

## What you get

- **`/321 -Setup`** - First-run wizard. Sync, doctor, Big 6 fill, release_profile, auto-memory path, optional first git commit.
- **`/321 -SessionUpdate`** - Refresh project's backbone-log SESSION (Current State + LIFO events) and SESSION_EXTENDED.
- **`/321 -MemoryUpdate`** - Capture durable observations into MEMORY LIFO + BACKLOG. `-FULL` maintains the Big 6 schema.
- **`/321 -Update`** - Chain both update tracks in one shared-context pass.
- **`/321 -DevAudit`** - Code-standards audit against your project's DEV-AUDIT.
- **`/321 -AutoPush`** - Release pipeline. Composes CHANGELOG, builds, pushes, tags, deploys.

## Install

### With Claude (recommended)

Open Claude in your empty target folder and paste:

```
Install from 321done.ai/std as MY_PROJECT
```

Replace `MY_PROJECT` with your actual project name. If you omit `as MY_PROJECT` the install defaults to the target folder's basename. Claude reads `321done.ai/std`, clones the repo to a system temp dir, runs `init` against your current directory (auto-detects `release_profile` from project signals, resolves the per-machine `auto_memory.path`, seeds the auto-memory directory), runs `sync` + `doctor`, runs `git init` if needed, cleans up the temp clone, and reports.

The project is usable immediately after install. To fill the Big 6 (Overview, Stack, Architecture, Environment, Pipeline, Conventions), restart Claude in the new project and run `/321 -Setup`. Setup also handles **migration**: invoke it on an existing project with content to preserve (a prior 321 install, or a standard project with a hand-rolled `CLAUDE.md` / session-handoff / loose memory docs) and it archives your accumulated content, reinstalls the canonical structure on top, captures it losslessly, then sets a gate and directs you to run `/321 -Update` for the distillation pass.

### Manual install scripts (no AI)

#### Windows / PowerShell

```powershell
iwr -useb https://raw.githubusercontent.com/WillyDrucker/321_STD/main/install.ps1 | iex
```

#### macOS / Linux / Git Bash

```bash
curl -fsSL https://raw.githubusercontent.com/WillyDrucker/321_STD/main/install.sh | bash
```

Both run in your current directory by default. The installer:

1. Shallow-clones 321_STD to a temp dir
2. Defaults `--name` to the target folder's basename (override with `--name`/`-Name`)
3. Auto-detects `release_profile` from project signals (`package.json`, `wrangler.toml`, framework configs)
4. Runs `init` (generates AGENTS / MEMORY / SESSION / DEV-AUDIT / `_index.json`, seeds the per-machine auto-memory directory)
5. Registers skills via `sync` and verifies with `doctor`
6. Runs `git init` if the target is not already a repo
7. Cleans up the temp clone

#### Configure non-interactively

Pass via env vars or flags:

```powershell
# Windows
$env:STD321_NAME = "MyProject"; iwr -useb URL | iex
.\install.ps1 -Name MyProject -Profile npm-package
```

```bash
# Unix
curl -fsSL URL | STD321_NAME=MyProject bash
# or: curl -fsSL URL | bash -s -- --name MyProject --profile npm-package
./install.sh --name MyProject --profile npm-package
```

Release profiles: `standards`, `npm-package`, `vscode-extension`, `cloudflare-worker`, `cloudflare-pages`, `static-site`, `none`. Profile is auto-detected when not passed. Pass it explicitly to override.

## After install

The project is usable as-is. To enable the `/321` skill family, restart Claude Code in the new project (skills load at session start) and optionally run `/321 -Setup` for the Big 6 prose fill (Overview, Stack, Architecture, Environment, Pipeline, Conventions) with per-section confirmation.

`/321 -Setup` auto-detects whether to run **fresh-install mode** (empty scaffold) or **migration mode** (an existing project with content to preserve - a prior 321 install, or a standard project with scattered AI artifacts). Migration archives accumulated content to `AIDOCS/<PROJECT>_SETUP_ARCHIVE/`, reinstalls the canonical structure, fresh-scans the codebase, and backfills with legacy naming normalization (DEV-STANDARDS to DEV-AUDIT, SKILLS to SKILL, project renames). EXTENDED depth files are imported losslessly by the engine. Setup then sets a `reconcile_pending` gate and stops - the user runs `/321 -Update` for the distillation pass.

## Manual install (no script)

If you prefer not to pipe `iwr` / `curl` through a shell. Clone the standards to a temp location outside the target, then init into the target:

```bash
# In the empty target dir
TMP="${TMPDIR:-/tmp}/321std-$$"
git clone --depth 1 https://github.com/WillyDrucker/321_STD.git "$TMP"
node "$TMP/AIDOCS/tools/memory.mjs" init . --name MyProject
rm -rf "$TMP"
node AIDOCS/tools/memory.mjs sync
node AIDOCS/tools/memory.mjs doctor
```

```powershell
# Windows / PowerShell
$tmp = Join-Path $env:TEMP "321std-$(Get-Random)"
git clone --depth 1 https://github.com/WillyDrucker/321_STD.git $tmp
node "$tmp/AIDOCS/tools/memory.mjs" init . --name MyProject
Remove-Item -Recurse -Force $tmp
node AIDOCS/tools/memory.mjs sync
node AIDOCS/tools/memory.mjs doctor
```

## Where the documentation lives

- **`AGENTS.md`** - Project orchestrator. Cold-start load order, hard rules, project specifics.
- **`AIDOCS/SKILL/`** - Skill body definitions. The dispatcher resolves these.
- **`AIDOCS/tools/lib/README.md`** - Engine reference.
- **`AIDOCS/tools/staging/SCHEMA.json`** - Staging-file schema for two-phase commits.
- **`WDDOCS/DESIGN/SYSTEM.md`** - System model + install/Setup design reference.
- **`WDDOCS/RELEASES/DISTRIBUTION_PATHS.md`** - Install path tradeoffs and roadmap.
