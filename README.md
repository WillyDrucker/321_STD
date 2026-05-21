# 321_STD

**Purpose:** AI-assisted project standards. A markdown memory / session / backlog system plus a zero-dependency Node engine for two-phase staging commits. Scaffolds into any project in one prompt. The AI drives the workflow, scripts handle the bookkeeping.

## Install

Open Claude in your target folder and paste:

```
Install from 321done.ai/std as MY_PROJECT
```

Replace `MY_PROJECT` (omit `as ...` to use the folder name). Claude reads `321done.ai/std` and runs the install. The project is usable immediately. Restart Claude, then `/321 -Setup` fills the Big 6.

**Existing project?** Same prompt. Your files are preserved, and `/321 -Setup` migrates what is already there, including a legacy 321 install. It captures everything first, then `/321 -Update` reconciles it into final shape.

### What the install writes

The install is local and offline - no network calls, no fetched code executed. `init` writes only inside the target folder plus a merge-copy to the per-machine auto-memory dir (`<home>/.claude/projects/<key>/memory`), which never overwrites a file already there. Engine files (the `/321` router, `AIDOCS/SKILL`, `AIDOCS/tools`) are always replaced, except a skill body you have listed in `_index.json customizations[]`, which is preserved. Your `CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md`, `.gitignore`, and project docs are kept if they already exist. Preview the exact plan for your folder, writing nothing, by adding `--dry-run`:

```bash
node AIDOCS/tools/memory.mjs init <target> --name <NAME> --dry-run
```

### No AI

```powershell
# Windows
iwr -useb https://raw.githubusercontent.com/WillyDrucker/321_STD/main/install.ps1 | iex
```

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/WillyDrucker/321_STD/main/install.sh | bash
```

Runs in the current directory, names the project after the folder, auto-detects the release profile, and runs `init` + `sync` + `doctor`. Override with `STD321_NAME` / `--name` and `STD321_PROFILE` / `--profile` (`standards`, `npm-package`, `vscode-extension`, `cloudflare-worker`, `cloudflare-pages`, `static-site`, `none`).

## The /321 skills

- **`/321 -Setup`** - first-run wizard, or migration of an existing project.
- **`/321 -SessionUpdate`** - refresh SESSION (Current State + LIFO events) and SESSION_EXTENDED.
- **`/321 -MemoryUpdate`** - capture durable observations into MEMORY + BACKLOG. `-FULL` maintains the Big 6 schema.
- **`/321 -Update`** - both update tracks in one shared-context pass.
- **`/321 -DevAudit`** - code-standards audit against your project's DEV-AUDIT.
- **`/321 -AutoPush`** - release pipeline: CHANGELOG, build, push, tag, deploy.

## Documentation

- **`AGENTS.md`** - orchestrator: cold-start load order, hard rules, project specifics.
- **`WDDOCS/DESIGN/SYSTEM.md`** - system model plus the install / Setup / migration design.
- **`AIDOCS/tools/lib/README.md`** - engine reference.
- **`AIDOCS/tools/staging/SCHEMA.json`** - staging-file schema for two-phase commits.
- **`WDDOCS/RELEASES/DISTRIBUTION_PATHS.md`** - install path tradeoffs and roadmap.
