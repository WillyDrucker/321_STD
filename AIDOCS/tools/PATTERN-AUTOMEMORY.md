# Auto-memory pattern

**Purpose:** State the file-prefix convention and the seed-vs-runtime responsibility split for the auto-memory layer, so the reconcile pass routes each rule to the right home without re-deriving the system every time. Loaded on demand when the reconcile pass merges the captured external snapshot against the canonical seed, or when adding a project-specific rule for the first time. Not loaded at session start.

## Two homes, one runtime

Auto-memory has two physical homes that the install + reconcile chain keeps in sync.

- **Seed** at `AIDOCS/automemory/` (in-repo, tracked by the project under non-public privacy). The template that travels with the project. A fresh-machine install reads this to populate the external runtime.
- **External runtime** at `auto_memory.path` (resolved per project, typically under the user's Claude home like `~/.claude/projects/<encoded>/memory/`). Claude Code's actual memory layer at runtime. Never tracked by the project, machine-local.

`init` copies the seed into the runtime write-if-missing on every install, so a fresh-machine install restores the seed-tracked rules automatically.

**`upgrade` refreshes BOTH, in both directions.** `AIDOCS/automemory` is engine-class, so the copy step overwrites the shared rule bodies in the seed, and `syncAutoMemory` then mirrors them into the runtime. **The runtime step is not optional plumbing** - the copy step resolves every path against the project root, and the runtime lives outside it, so without the mirror an upstream rule fix would land in the repo and change nothing the model actually loads at session start. The same step carries the project's own rules the other way: a rule written in the runtime is promoted into the seed, so git versions it and a fresh machine restores it, and a seed-only project rule is laid into the runtime write-if-missing. The step also runs on its own, `node AIDOCS/tools/engine.mjs sync-automemory` (`--dry-run` to preview), for the reconcile pass and for any moment the two homes have drifted apart between syncs.

## Ownership, and what upgrade will and will not touch

| Class | Owner | On upgrade |
|---|---|---|
| `feedback_*` / `reference_*` that upstream ships | **upstream** | **Overwritten.** Upstream just rewrote the rule, so upstream's body is the correct one. The run names each rule it replaced. |
| A rule file upstream does not ship | the project | **Kept in step across both homes.** The runtime's body is promoted into the seed, a seed-only copy is laid into the runtime write-if-missing. Nothing is ever deleted. |
| `MEMORY.md` (the rule index) | the project | **Reconciled, never overwritten.** Upstream's hook text wins for the rules it ships, a shipped rule whose seed path is in `customizations[]` keeps the seed's own line in both homes (as the copy step keeps its body), the project's pointers to its own rules are preserved, and a promoted rule brings its pointer along. Overwriting it would delete those pointers. |
| `user_*.md` (the profile) | the project | **Promoted from the runtime, never overwritten by the copy step.** A filled profile reaches the seed on upgrade and retires the seed's `user_name.md` placeholder once the runtime has retired it too, the one removal the sync makes. The placeholder is laid only into a runtime that has no profile at all, never beside a filled one. |

**There is no addenda seam.** An older convention let a project append project-specific text under a `**Project-specific addenda below this line.**` marker inside a shared rule. The force-copy destroys that, so the marker is gone. **To add a project-specific authoring rule, write a new rule file** (it survives by absence). Project-specific *code* contracts belong in `<PROJECT>_DEV-AUDIT.md`, not here.

## File-prefix taxonomy

The prefix carries the meaning. The frontmatter `name:` is the filename in kebab-case (`feedback_naming.md` carries `name: feedback-naming`), so a `[[name]]` link can be derived from the file it points at.

| Prefix | Seed? | Runtime? | Example | What it captures |
|---|---|---|---|---|
| `feedback_*` | yes (canonical) | yes (mirrored from seed) | `feedback_no_em_dashes.md` | An always-on authoring rule: **how you write.** Comment discipline, naming, casing, house voice. Upstream ships the shared set and refreshes it on `-UpdateSync`. |
| `reference_*` | yes when durable | yes | `reference_metro_logging.md` | An operational pointer: how to reach a long-running service, a device, a dashboard. Distinct from `feedback_*` because it states a fact rather than a preference. |
| `project_*` | yes (durable facts) | yes (mirrored from seed) | `project_canonical_brand_spelling.md` | A project-specific fact, durable across machines. |
| `user_*` | yes (one file, project-named) | yes (filled in place) | `user_willy.md` | The user profile. The seed ships `user_name.md` as the placeholder. Setup renames it to `user_<name>.md` once filled. Project-owned. Upgrade promotes the filled profile from the runtime into the seed and retires the placeholder, never the reverse. |

The single decision rule: **if losing this rule on a fresh-machine install would be a regression, it belongs in the seed**. Otherwise runtime-only.

**What does NOT belong in auto-memory:** anything measurable against the source. File-size targets, layer boundaries, dead-export rules, quality gates. Those are code contracts and they live in `<PROJECT>_DEV-AUDIT.md`. A rule lives in exactly one of the two, never both, because the copy is always the one that rots.

## Reconcile responsibilities

The capture leaves two snapshots in `<PROJECT>_SETUP_ARCHIVE/`.

- **Seed snapshot** at `<PROJECT>_SETUP_ARCHIVE/AIDOCS/automemory/` (the in-repo seed as it was, captured by `migrate-archive`).
- **External runtime snapshot** at `<PROJECT>_SETUP_ARCHIVE/external-automemory/` (the live runtime as it was, also captured by `migrate-archive`).

The reconcile pass compares both against the post-install state and:

1. **Leaves the shared rules alone.** `upgrade` already force-copied them into the seed and mirrored them into the runtime. There is nothing to merge, and hand-merging one would be reverted by the next sync.
2. **Leaves the project's own rules and the profile to `upgrade` as well.** It promotes a runtime-only rule or filled profile into the seed, retires the seed's placeholder behind a filled profile, and lays a seed-only rule into the runtime. A rule found in one home and not the other means the sync has not run since it was written, not a decision to make by hand: run `sync-automemory` and it is resolved.
3. Confirms the `MEMORY.md` index carries a pointer for every rule in the directory. A genuinely-uncovered rule from the snapshot becomes **its own new file**, never text appended inside a shared rule (there is no addenda seam, and the next force-copy would destroy it).

## Conflict resolution

- **A shared rule the project has diverged on.** **Upstream wins, mechanically, on the next `upgrade`.** A project that believes its variant is right does not keep it locally, because the next sync silently reverts it and restarts the drift. **Land the fix upstream.** That is what the shared rule set is for, and every rule in it got there this way.
- **A project rule that differs between the homes.** The runtime wins, since it is what the model has been loading, and the next `upgrade` carries it into the seed.

The reconcile pass and `upgrade` are the two sanctioned places that touch the seed. Routine `-Update` touches neither - it surfaces a rule suggestion as a MEMORY LIFO bullet for the user to action.

## The AGENTS mirror is opt-in, and off by default

`AGENTS.md` does **not** carry a copy of the rule inventory. A restated rule drifts from its original, and this one did. The rules load from the runtime automatically, so the mirror bought nothing for the model that reads them.

A project that needs the mirror anyway - to feed a model that cannot load Claude's native memory, such as a cross-model bridge reading only `AGENTS.md` - sets `auto_memory.agents_mirror: true` and doctor then checks both directions. **A dangling link from AGENTS.md to a rule file that does not exist is reported either way**, because that is a real bug regardless of whether the mirror is in use.
