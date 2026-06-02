# 321_STD

**Purpose:** AI-assisted project standards. A markdown memory / session / backlog system plus a zero-dependency Node engine that scaffolds into any project in one prompt and manages its memory over the project's life. The AI drives the workflow, the engine handles the bookkeeping.

## Install

Open Claude in your target folder and paste:

```
Install from 321done.ai/std as MY_PROJECT
```

Replace `MY_PROJECT` (omit `as ...` to use the folder name). Claude reads `321done.ai/std` and runs the install. The project is usable immediately, and setup runs as part of the install - it fills the Big 6 on a fresh project, or migrates an existing one.

**Existing project?** Same prompt, and your assistant runs it straight through without asking. Your files are preserved, and setup migrates what is already there, including a legacy or stale 321 install, by archiving first and never deleting. Then `/321 -Update` reconciles it into final shape.

**Already on 321 and just want the latest engine?** Run `/321 -UpdateSync` from the project. It pulls the engine, skill bodies, router, and any manifest-driven structural changes from your `engine.upstream` (the URL the install used). Project-authored content is preserved. Canonical project-data sections may update through manifest ops unless the file is listed in `customizations[]`. The full install above is the heavy path - reinstall only when the registry is gone or the project needs the full migration treatment.

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
- **`/321 -UpdateSession`** - refresh SESSION (Current State plus the LIFO event log).
- **`/321 -UpdateMemory`** - distill durable observations into MEMORY (LIFO plus the Big 6) and manage BACKLOG.
- **`/321 -Update`** - the daily driver: chain `-UpdateSession` then `-UpdateMemory` in one pass. `-FULL` propagates to both lanes.
- **`/321 -UpdateSync`** - upgrade the project from `engine.upstream`: engine code, skill bodies, router, and the manifest of structural changes (new files, registry shape additions, canonical content edits). Project-authored content is preserved. Canonical template sections may refresh via manifest ops unless the file is in `customizations[]`. Offline or no-upstream is a clean no-op.
- **`/321 -DevAudit`** - code-standards audit against your project's DEV-AUDIT. `-FULL` audits and refactors.
- **`/321 -AutoPush`** - release pipeline: capture, commit, and push to the anchored remote, with the project's release steps sourced from AUTO-PUSH.
- **`/321 -Compact`** - emit a ready-to-paste `/compact` block carrying the session's load-bearing state into the next conversation.

## Documentation

- **`AGENTS.md`** - the orchestrator: cold-start load order, hard rules, project specifics.
- **`INSTALL/install.md` + `INSTALL/setup.md`** - the install and setup runbooks: the fresh-fill and migration lifecycle, step by step.
- **`AIDOCS/_index.json`** - the registry: paths, file keys, buckets, size caps, and the canonical skill dispatch.
- **`node AIDOCS/tools/engine.mjs help`** - the engine command surface in one read.

## Common commands

A short reference for day-to-day use. The full command surface is in [the /321 skills](#the-321-skills) above.

| Command | What it does |
|---|---|
| `/321 -UpdateSession` | Refresh SESSION from this conversation (Current State + LIFO). |
| `/321 -UpdateMemory` | Distill MEMORY (LIFO + Big 6) + manage BACKLOG. Auto-invokes `-UpdateSession` first. |
| `/321 -Update` | The daily driver. Chains `-UpdateSession` then `-UpdateMemory`. |
| `/321 -Update -FULL` | Rebuild both lanes from the full conversation (not the incremental tail). For drifted SESSION/MEMORY. |
| `/321 -UpdateSession -FULL` | Rebuild only SESSION from the full conversation. Ignores the watermark. |
| `/321 -UpdateMemory -FULL` | Rebuild only MEMORY. Re-derives every Big-6 section against current evidence. |
| `/321 -UpdateSync` | Refresh the engine from `engine.upstream`. Project-authored content is preserved. Canonical sections may update via manifest ops unless the file is in `customizations[]`. |
| `/321 -DevAudit` | Audit the source against `DEV-AUDIT.md`. `-FULL` audits and refactors. |
| `/321 -AutoPush` | Capture, commit, and push to the anchored remote. Composes the CHANGELOG at release time. |
| `/321 -Compact` | Emit a ready-to-paste `/compact` block carrying the session's load-bearing state into the next conversation. |
