---
name: auto-push
description: Project release pipeline. Delegates to SessionUpdate, runs pre-flight, commits, composes CHANGELOG entry from git + SESSION_EXTENDED, builds, pushes, tags, creates GitHub release, deploys (project-specific), verifies, rolls over.
---

# /321 -AutoPush

**Purpose:** End-to-end release pipeline for the current branch. Orchestrates session sync, version pick, CHANGELOG composition, build, push, tag, GitHub release, deploy or publish (project-specific), verify, rollover.

**Invocation:** end of a working session when work is ship-ready. Use `-SKIM` or `-FULL` to control Step 1 (SessionUpdate).

**Project-specific deploy.** Step 7 is the only step that varies meaningfully. `AIDOCS/_index.json -> release_profile` names the shape (doctor validates). Supported: `standards` (GitHub release only), `npm-package`, `vscode-extension`, `cloudflare-worker`, `cloudflare-pages`, `static-site`, `none`. Step 7 below names the canonical command per profile. It is also the one irreversible, outward-facing step (it publishes or deploys), so a project whose publish or deploy diverges from the profile default must capture that as a project-local override, not lean on the generic command. Drop a `SKILL_AUTO-PUSH.md` into `AIDOCS/SKILL_LOCAL/` (`name: auto-push`, same filename), run `sync`, and the router loads your body instead - it survives engine reinstall, where an inline edit to this generic body would not. See `AIDOCS/SKILL_LOCAL/README.md`.

## You orchestrate the pipeline

The pipeline is a fixed sequence of gates and commands. You orchestrate the order, watch for failures, surface them with enough context to act. Scripts handle the mechanical work (build, push, tag, deploy). Your job is the gate decisions ("is this ready to advance?"), version-bump call, CHANGELOG composition prose, commit-message framing, and failure recovery story when a gate trips. Don't bypass gates. Don't skip steps. If a gate fails, stop and report.

## CHANGELOG ownership

AutoPush is the **sole writer** of CHANGELOG.md. SessionUpdate never touches it. The CHANGELOG entry for the new version composes at release time from:

- `git log <prev-tag>..HEAD` - what shipped on this branch
- `<PROJECT>_SESSION.md` LIFO - backbone-log headlines for events in the release window
- `<PROJECT>_SESSION_EXTENDED.md` `### sub-section` anchors - technical detail captured during dev
- conversation context - any in-flight detail or user-noticed effects not yet anchored

The composition pass shifts tone deliberately: technical SESSION content becomes user-readable CHANGELOG prose. The CHANGELOG file during dev simply doesn't have an `[Unreleased]` block to fill. AutoPush creates the new versioned block fresh at release. Rollover (Step 8) optionally seeds an empty `[Unreleased]` placeholder on the next branch if the project prefers Keep-a-Changelog convention.

## Pipeline (AI vs script)

| Step | Action | AI does | Script does |
|---|---|---|---|
| 1 | SessionUpdate (delegated) | Invoke sub-skill, wait | SessionUpdate's two-phase commit |
| 2 | Pre-flight gates | Decide pass / fail per gate | `git status`, build, tests |
| 3 | Stage + commit work | Pick files explicitly (no `git add -A`), write commit message | `git add <files>`, `git commit` |
| 4 | Compose CHANGELOG entry | Pick semver bump, read git log + SESSION_EXTENDED + conversation, draft user-readable entry | Direct file write via Edit |
| 5 | Local build + package | Decide pass / fail | Build, package, verify artifact version |
| 6 | Push to remote, create tag | Verify branch | `git push`, `git tag`, `git push <tag>` |
| 7 | GitHub release + deploy | Compose release notes (often verbatim from CHANGELOG) | `gh release create`, project-specific deploy |
| 8 | Verify + rollover | Check deploy URL, merge if needed, optionally seed `[Unreleased]` | Rollover commit on next branch |

AI handles gate judgment and prose. Scripts handle git, build, deploy. Never bypass a gate.

## Step 0: Parse flags + load context

Determine flags (`-SKIM`, `-FULL` pass through to SessionUpdate). Output start-of-pipeline header with target version.

Read:

- `package.json` (or equivalent project version file) for current version
- `CHANGELOG.md` - to know which version was last shipped
- Recent `git log` + `git log <prev-tag>..HEAD` for the new-work range
- `<PROJECT>_SESSION.md` LIFO - headlines for events in the release window
- `<PROJECT>_SESSION_EXTENDED.md` - technical detail for new shipped work

## Step 1: SessionUpdate (delegated)

Invoke `/321 -SessionUpdate` with any pass-through flag. Wait for completion. If SessionUpdate exits with no work to record, AutoPush continues. The release may not have new session-track items but still needs the pipeline run.

## Step 2: Pre-flight gates

All gates are hard. Stop and report if any fail.

- `git status --short` shows only intended changes
- Build clean (`npm run build`, `pnpm build`, or project equivalent)
- Tests pass (if the project has a test suite)
- Any project-specific pre-flight (quality-gate sweep, license check, manifest validation)

## Step 3: Stage + commit work

Stage relevant files explicitly. **Never use `git add -A`** to prevent accidental inclusion of TEMP/ or other unintended paths. Commit with a message that summarizes the release.

Commit message style:

- No version numbers in subjects (the tag carries the version)
- Bias what-changed-and-why over which-files-changed
- Follow the project's commit conventions

## Step 4: Compose + write CHANGELOG entry

This is the load-bearing prose step. AutoPush is the sole CHANGELOG writer. This is where the technical-to-user-readable tone shift happens.

### Gather

For the version-to-ship:

- `git log <prev-tag>..HEAD --oneline` enumerates shipped commits.
- `<PROJECT>_SESSION.md` LIFO bullets enumerate the project-significant events in the release window (above and including the relevant Last State marker, walking back to the previous release boundary).
- `<PROJECT>_SESSION_EXTENDED.md` `### sub-section` anchors under `## LIFO` carry the technical detail behind those events.
- The conversation carries any user-noticed effects, gotchas, or framings not yet anchored.

### Pick semver bump

Read the change set. Patch / minor / major per semver convention:

- patch: bug fixes, internal refactors, doc-only changes that don't change user behavior
- minor: new user-facing capability, backwards-compatible
- major: breaking change to the public surface

State the bump and rationale at the top of the step. Update `package.json` version (or equivalent project version file).

### Compose

Compose the CHANGELOG entry in user-readable tone. Group by `### Added` / `### Changed` / `### Fixed` / `### Removed` per Keep-a-Changelog convention.

**Tone rules (mandatory):**

- Bold one-liner first per bullet (what the user notices).
- Short prose explanation after the bolded title. Bias prose over lists.
- Single technical reference at the end max (file / commit / PR link).
- Never lead with version / file / PR / issue.
- Use "you" / "your" where it helps.
- Everyday verbs: "keeps showing", "no longer gets stuck", "shows up immediately".
- Avoid: "refactored", "extracted", "consolidated", "unified", "optimized".

Reference voice: the most recent versioned entries in this project's own `CHANGELOG.md` (once released entries exist). If you maintain a sibling project with an established CHANGELOG voice, a recent version block there is the canonical reference. Either way the cadence is a bold lead sentence + paragraph of context, every backend / failure mode / edge case spelled out, "you / your" voice throughout.

### Write

Insert the new versioned block at the top of `CHANGELOG.md` (immediately after the file header, above any prior version blocks):

```markdown
## [<NEW_VERSION>] - <YYYY-MM-DD>

### Added

- **<title>.** <user-readable prose>

### Changed

- **<title>.** <user-readable prose>

### Fixed

- **<title>.** <user-readable prose>

### Removed

(omit if empty, or leave the heading with no bullets if Keep-a-Changelog parity matters to the project)
```

Direct file write via Edit. No staging pipeline. The composition is judgment-heavy and the script doesn't add value.

Commit as `"changelog entry for <NEW_VERSION>"`.

## Step 5: Local build + package

Run final build and package commands. Verify output artifacts exist and have the expected version embedded (build-time injection, not source-coded).

## Step 6: Push to remote, create tag

- `git push origin <current-branch>`
- `git tag <version>`
- `git push origin <version>`

## Step 7: GitHub release + project-specific deploy/publish

Create a GitHub release for the tag with release notes drawn from the new CHANGELOG block. Lean user-facing tone (often verbatim from CHANGELOG).

**Project-specific deploy/publish runs here**, dispatched by `_index.json -> release_profile`:

| `release_profile` | Step 7 command |
|---|---|
| `standards` | no deploy beyond the GitHub release |
| `npm-package` | `npm publish` (after `npm login`) |
| `vscode-extension` | `vsce package && vsce publish` (marketplace token from `.env`) |
| `cloudflare-worker` | Git integration auto-deploys. Manual fallback `pnpm build && npx wrangler deploy` |
| `cloudflare-pages` | Git integration auto-deploys. Manual fallback via Pages CLI |
| `static-site` | platform-specific (Astro, Next, etc.) - project-local body specifies |
| `none` | no deploy step |

A project whose release flow needs more than the profile command (non-standard publish, extra gates, a project version invariant) keeps its full pipeline as a local override at `AIDOCS/SKILL_LOCAL/SKILL_AUTO-PUSH.md` rather than editing this generic body, which a reinstall overwrites. `sync` repoints the router to it. See `AIDOCS/SKILL_LOCAL/README.md`.

## Step 8: Verify + rollover

- Verify deploy succeeded (URL responds, marketplace listing updated, package available, etc.)
- Merge release branch to main if a branch workflow is in use
- Create rollover commit on the next branch with the next version's `package.json` bump

Optional CHANGELOG starter: if the project prefers Keep-a-Changelog convention with a live `[Unreleased]` placeholder, AutoPush can seed an empty block at the top of CHANGELOG on the rollover commit. The block stays empty during dev (SessionUpdate doesn't touch it) and AutoPush fills it at the next release. Most 321_STD projects skip this and let AutoPush write the versioned block fresh at release.

## Step 9: Display summary

```
auto-push complete.

Version:           <previous> -> <new>
Branch:            <branch> (pushed)
Tag:               <tag> (pushed)
CHANGELOG:         <NEW_VERSION> block composed and committed
GitHub release:    <URL>
Deploy:            <deploy result>
Next branch:       <new branch created>
```

## Rules (skill operation)

- **Sole CHANGELOG writer.** Tone shift to user-readable happens at Step 4.
- **Pre-flight gates are hard.** Stop on any fail.
- **No `git add -A`.** Stage relevant files explicitly to avoid TEMP/ pollution or accidental secrets.
- **No version numbers in commit subjects.** Tag carries the version.
- **Project-specific deploy at Step 7.** Universal pipeline through Step 6.
