# Auto-memory pattern

**Purpose:** State the file-prefix convention and the seed-vs-runtime responsibility split for the auto-memory layer, so the reconcile pass routes each rule to the right home without re-deriving the system every time. Loaded on demand when the reconcile pass merges the captured external snapshot against the canonical seed, or when adding a project-specific rule for the first time. Not loaded at session start.

## Two homes, one runtime

Auto-memory has two physical homes that the install + reconcile chain keeps in sync.

- **Seed** at `AIDOCS/automemory/` (in-repo, tracked by the project under non-public privacy). The template that travels with the project. A fresh-machine install reads this to populate the external runtime.
- **External runtime** at `auto_memory.path` (resolved per project, typically under the user's Claude home like `~/.claude/projects/<encoded>/memory/`). Claude Code's actual memory layer at runtime. Never tracked by the project, machine-local.

`init` copies the seed into the runtime write-if-missing on every install, so a fresh-machine install restores the seed-tracked rules automatically. A divergence between the two is a reconcile-pass call: the project may have added a runtime-only rule worth promoting to the seed, or the seed may carry an upstream rule the project intentionally overrides.

## File-prefix taxonomy

The prefix carries the meaning. The reconcile pass uses it to decide what belongs in the seed vs runtime-only, and what the AGENTS Hard-rules block points at.

| Prefix | Seed? | Runtime? | Example | What it captures |
|---|---|---|---|---|
| `feedback_*` | yes (canonical) | yes (copied from seed) | `feedback_no_em_dashes.md` | Generic rule the framework ships. Refreshes from upstream on `-UpdateSync` via `automemory_add` manifest ops. |
| `project_*` | yes (durable facts) | yes (copied from seed) | `project_canonical_brand_spelling.md` | Project-specific fact, durable across machines. Belongs in the seed so a fresh-machine install restores it. |
| `user_*` | yes (one file, project-named) | yes (filled in place) | `user_willy.md` | The user profile. The seed ships `user_name.md` as the placeholder. The first reconcile renames the seed file to `user_<name>.md` once filled. |
| `reference_*` | usually no | yes | `reference_grafana_dashboard.md` | Pointer to an external system the user happens to use on this machine. Machine-specific, so the seed adds no value. |

The single decision rule: **if losing this rule on a fresh-machine install would be a regression, it belongs in the seed**. Otherwise runtime-only.

## Reconcile responsibilities

The capture leaves two snapshots in `<PROJECT>_SETUP_ARCHIVE/`.

- **Seed snapshot** at `<PROJECT>_SETUP_ARCHIVE/AIDOCS/automemory/` (the in-repo seed as it was, captured by `migrate-archive`).
- **External runtime snapshot** at `<PROJECT>_SETUP_ARCHIVE/external-automemory/` (the live runtime as it was, also captured by `migrate-archive`).

The reconcile pass compares both against the post-install state and:

1. Refreshes the seed's canonical `feedback_*` files from the upstream version that just landed (the engine-class copy already wrote them, this step confirms the runtime carries the same wording).
2. Replaces the seed's `user_name.md` placeholder with the filled `user_<name>.md` body when the runtime carries one, so a fresh-machine install restores the filled profile. Updates the AGENTS Hard-rules pointer to the filled filename in the same edit.
3. Keeps the project's `project_*` rules in **both** the seed and the runtime, so a fresh-machine install restores the fact. A `project_*` rule that lives only in the runtime is a missed promotion, not a steady state.
4. Leaves `reference_*` runtime-only unless promotion to the seed is intentional (rare, the value is usually machine-specific).
5. Rebuilds the runtime's `MEMORY.md` index from whatever ends up in the runtime directory.

## Conflict resolution

- **`feedback_*` collision** (the project's prior body diverges from the upstream seed). The upstream wins. Land the project's variant as a backlog note for the project to argue separately, do not silently merge.
- **`project_*` runtime-only** (the runtime carries a fact the seed does not). Promote to the seed. Fresh-machine installs restore it.
- **`user_*` seed placeholder + runtime filled.** Replace the seed file with the filled body, rename the seed file to `user_<name>.md`, update the AGENTS Hard-rules pointer to match. Doctor's auto-memory pointer check confirms the seed pointer resolves in both directions.

The reconcile pass is the one sanctioned place that touches the seed directly. Routine `-Update` only touches the runtime.
