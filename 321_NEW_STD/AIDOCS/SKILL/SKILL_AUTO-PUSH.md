---
name: autopush
description: Generic commit-and-push baseline - get the project's work committed and pushed to its anchored git remote, with .gitignore as the public/private gate. Release specifics (version bump, CHANGELOG, build, deploy) are project fill-ins, set in this body to match the project's actual push cycle.
---

# /321 -AutoPush

**Purpose:** Get everything committed and pushed to the project's anchored git remote so the project stays current with its repo. This body is the **generic baseline** - capture, commit, push. A project's real release cycle (version policy, CHANGELOG, build, deploy / publish) is project-specific and is filled into the "Project release steps" section below to match how the project actually ships.

## What stays generic vs filled in

- **Generic (here):** capture the session, stage what `.gitignore` allows, commit, push to the remote.
- **Project fill-in:** version bump, CHANGELOG, build, deploy / publish target. A standards project pushes to its anchored repo and stops, an npm package also publishes, a site also deploys. Fill the project's steps below.

The `.gitignore` is the public/private control - it decides what is committed (secrets, machine-local state, and transient files stay out). AutoPush trusts it rather than re-deciding per file.

## Step 1: Capture the work

Run `/321 -Update` first (read `AIDOCS/SKILL/SKILL_UPDATE.md` and execute) so SESSION and MEMORY reflect this session before they are committed. Skip only when memory is already current.

## Step 2: Review and stage

```bash
git status --short
git add -A
git status --short
```

`git add -A` honors `.gitignore`, so transient / secret / machine files stay out. Confirm the staged set is what you expect. If anything sensitive appears staged, stop and fix `.gitignore` before committing - never commit around it.

## Step 3: Commit and push

```bash
git commit -m "<clear, user-readable summary of the work>"
git push
```

Push goes to the anchored remote (`origin`). If no remote exists yet, that is a one-time `git remote add origin <url>` the user runs before the first push.

## Project release steps (fill in)

Generic projects stop after the push. Fill in the project's real cycle here: the version-bump rule, the CHANGELOG block, the build command, the deploy / publish target. A project that diverges customizes this section, and a later phase records it so an engine update preserves the project's pipeline rather than reverting it to generic.

## Rules

- **Generic by default.** Capture, commit, push to the anchored remote. Everything project-specific is a fill-in.
- **The .gitignore is the gate.** It controls public/private inclusion - trust it, never commit around it.
- **Capture before shipping.** Run `-Update` first so the committed memory is current.
- **Never commit secrets.** If review shows something sensitive staged, fix `.gitignore` first.
