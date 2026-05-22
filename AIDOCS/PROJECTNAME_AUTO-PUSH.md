# PROJECTNAME - Auto-Push

**Purpose:** Release reference. Loaded by `/321 -AutoPush` (registry key `autopush.config`). The generic commit-and-push baseline applies to every project. The project's real release cycle (version, CHANGELOG, build, deploy) is filled into `## Project release steps` at the bottom, which setup and reconcile enrich as the cycle settles. Not a workflow narration - the skill runs what is here.

## What stays generic vs filled in

- **Generic (here):** capture the session, stage what `.gitignore` allows, commit, push to the remote.
- **Project fill-in:** version bump, CHANGELOG, build, deploy / publish target. A standards project pushes to its anchored repo and stops, an npm package also publishes, a site also deploys. Fill the project's steps into `## Project release steps`.

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

## Project release steps

Generic projects stop after the push. Fill in the project's real cycle here: the version-bump rule, the CHANGELOG block, the build command, the deploy / publish target. A project that diverges customizes this section, and reconcile records it so an engine update preserves the project's pipeline rather than reverting it to generic.

(fill in)

## Rules

- **Generic by default.** Capture, commit, push to the anchored remote. Everything project-specific is a fill-in here.
- **The .gitignore is the gate.** It controls public/private inclusion - trust it, never commit around it.
- **Capture before shipping.** Run `-Update` first so the committed memory is current.
- **Never commit secrets.** If review shows something sensitive staged, fix `.gitignore` first.
