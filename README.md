# 321_STD

**Purpose:** AI-assisted project standards. A markdown memory / session / backlog system plus a zero-dependency Node engine that scaffolds into any project in one prompt and manages its memory over the project's life. The AI drives the workflow, the engine handles the bookkeeping.

## Install

Open Claude in your target folder and paste:

```
Install from 321done.ai/std as MY_PROJECT
```

Replace `MY_PROJECT` (omit `as ...` to use the folder name). Claude reads `321done.ai/std` and runs the install. The project is usable immediately, and setup runs as part of the install - it fills the Big 6 on a fresh project, or migrates an existing one.

**Existing project?** Same prompt, and your assistant runs it straight through without asking. Your files are preserved, and setup migrates what is already there, including a legacy or stale 321 install, by archiving first and never deleting. Then `/321 -Update` reconciles it into final shape.

### What the install writes

The install runs locally. The engine source is a normal git clone of the public repo (or used in place if you already have it), and `init` then writes only inside the target folder and executes no fetched code. The engine (the `/321` router, `AIDOCS/SKILL`, `AIDOCS/tools`) and the `INSTALL/` runbooks always refresh. Your data files (`AGENTS.md`, `_index.json`, MEMORY / SESSION / BACKLOG / DEV-AUDIT / AUTO-PUSH) are written only if missing, so a re-install never clobbers content. The hard-rule auto-memory ships in-project at `AIDOCS/automemory` and is mirrored in the `AGENTS.md` Hard rules. A direct `init ... --force` rewrites the scaffold anyway (a recovery flag the install scripts do not expose).

### No AI

```powershell
# Windows
iwr -useb https://raw.githubusercontent.com/WillyDrucker/321_STD/main/install.ps1 | iex
```

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/WillyDrucker/321_STD/main/install.sh | bash
```

Runs in the current directory and names the project after the folder. Override the name with `STD321_NAME` (or `-Name` / `--name`), the location with `STD321_TARGET` (or `-Target` / `--target`), and the tracking mode with `STD321_PRIVACY` (or `-Privacy` / `--privacy`) - `private` (default) tracks the project's own knowledge, `public` gates it local so only the framework ships. The script runs `init` + `sync` + `doctor`, runs `git init` on a fresh project, then points you to setup - an assistant runs `INSTALL/setup.md` to finish onboarding (fresh fill or migration).

## The /321 skills

- **`/321 -Setup`** - onboard a project: fresh fill or migration. Deregistered once the project graduates to steady state.
- **`/321 -SessionUpdate`** - refresh SESSION (Current State plus the LIFO event log).
- **`/321 -MemoryUpdate`** - distill durable observations into MEMORY (LIFO plus the Big 6) and manage BACKLOG.
- **`/321 -Update`** - the daily driver: chain SessionUpdate then MemoryUpdate in one pass.
- **`/321 -SYNC`** - upgrade the project from `engine.upstream`: engine code, skill bodies, router, and the manifest of structural changes (new files, registry shape additions, canonical content edits). Project content and any path listed in `customizations[]` are preserved. Offline or no-upstream is a clean no-op.
- **`/321 -DevAudit`** - code-standards audit against your project's DEV-AUDIT. `-FULL` audits and refactors.
- **`/321 -AutoPush`** - release pipeline: capture, commit, and push to the anchored remote, with the project's release steps sourced from AUTO-PUSH.
- **`/321 -Compact`** - emit a ready-to-paste `/compact` block carrying the session's load-bearing state into the next conversation.

## Documentation

- **`AGENTS.md`** - the orchestrator: cold-start load order, hard rules, project specifics.
- **`INSTALL/install.md` + `INSTALL/setup.md`** - the install and setup runbooks: the fresh-fill and migration lifecycle, step by step.
- **`AIDOCS/_index.json`** - the registry: paths, file keys, buckets, size caps, and the canonical skill dispatch.
- **`node AIDOCS/tools/engine.mjs help`** - the engine command surface in one read.
