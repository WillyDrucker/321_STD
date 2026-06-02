---
name: autopush
description: Commit and push the project's work to its anchored remote, with .gitignore as the public/private gate. The skill is thin - it loads the auto-push file (autopush.config) and runs it. The generic capture / commit / push baseline and the project's release steps (version, CHANGELOG, build, deploy) live in that file, enriched at -Setup / reconcile.
---

# /321 -AutoPush

**Purpose:** Get everything committed and pushed so the project stays current with its remote. The skill is thin - it loads the auto-push file (`autopush.config` in `_index.json`) and runs it. The substance lives there: the generic capture / commit / push baseline and the project's `## Project release steps`, which `-Setup` and reconcile enrich as the release cycle settles.

## Step 1: Load the auto-push file

Read the auto-push file (`autopush.config` in `_index.json`) and execute its steps in order - capture (`-Update`), review and stage, commit and push, then any project release steps the file carries.

## Rules

- **The file is the source of truth.** The skill stays thin. The release cycle lives in `AUTO-PUSH.md`, enriched at `-Setup` / reconcile, so an engine update never reverts a project's pipeline.
- **The .gitignore is the gate.** It controls public / private inclusion - trust it, never commit around it.
- **Capture before shipping.** Run `-Update` first so the committed memory is current.
- **Never commit secrets.** If review shows something sensitive staged, fix `.gitignore` first.
