// upgradeOpsRegistry.mjs - manifest ops that mutate the in-memory registry
// (_index.json): registry_extend (additive, never overwrites), registry_rename
// (dotted-path key move), dictionary_rename (flat key move where the key names
// themselves contain dots). Pure data-structure mutations, no filesystem writes.
// The driver persists the index at its single commit point (skipped in dry-run),
// so mutating in-memory during dry-run keeps later ops reading a consistent view.
// Handler contract and dispatch live in upgradeOperations.mjs.

export function applyRegistryExtend(op, index, _source, _root, dryRun) {
  // Additive only: never overwrite a present value. Project-tuned numbers (caps,
  // paths) stay project-owned. To force an overwrite, the user removes the key
  // by hand and re-runs. In-memory mutation is fine in dry-run because the index
  // is not persisted unless the caller writes _index.json (which dry-run skips).
  // Skipping the mutation in dry-run would let a later op read a stale view of the
  // index, which would misreport whether that later op would no-op or apply.
  const parts = op.path.split(".");
  let cursor = index;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cursor[parts[i]] === undefined || cursor[parts[i]] === null) cursor[parts[i]] = {};
    cursor = cursor[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (cursor[last] !== undefined) {
    return { applied: false, note: `${op.path} already set, preserved` };
  }
  cursor[last] = op.value;
  void dryRun;   // intentionally unused - see comment above
  return { applied: true, note: `set ${op.path}` };
}

// Renames a dotted-path key in _index.json. Same in-memory mutation rationale as
// applyRegistryExtend: the index is not persisted unless the driver writes it
// (dryRun gates that), so mutating in dryRun lets a later op read a consistent view.
// Idempotency cases (so a re-run after success, a partial run, or a non-applicable
// project all converge):
//   from-absent + to-present       -> no-op (migration already done)
//   from-absent + to-absent        -> no-op (nothing to rename)
//   from-present + to-absent       -> the rename (normal case)
//   both present, equal values     -> drop from (partial-run recovery)
//   both present, unequal values   -> throw (operator resolves by hand and re-runs)
export function applyRegistryRename(op, index, _source, _root, dryRun) {
  const fromVal = readNestedKey(index, op.from);
  const toVal = readNestedKey(index, op.to);
  const fromPresent = fromVal !== undefined;
  const toPresent = toVal !== undefined;
  if (!fromPresent && toPresent) return { applied: false, note: `${op.from} -> ${op.to} already migrated` };
  if (!fromPresent && !toPresent) return { applied: false, note: `${op.from} absent, nothing to rename` };
  if (fromPresent && toPresent) {
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      throw new Error(`${op.from} and ${op.to} both present with different values, resolve by hand and re-run`);
    }
    deleteNestedKey(index, op.from);
    void dryRun;
    return { applied: true, note: `dropped ${op.from} (already mirrored at ${op.to})` };
  }
  writeNestedKey(index, op.to, fromVal);
  deleteNestedKey(index, op.from);
  void dryRun;
  return { applied: true, note: `renamed ${op.from} to ${op.to}` };
}

// Renames a flat key within a single-level dictionary - the parent path is traversed
// as dotted, but op.from and op.to are LITERAL key names (no traversal). Use this when
// a dictionary's keys themselves contain dots (e.g., index.files["updatememory.memory"]),
// which the dot-splitting registry_rename cannot reach. Idempotency cases mirror
// registry_rename: from-absent + to-present is no-op, both-present-equal drops from,
// both-present-unequal throws.
export function applyDictionaryRename(op, index, _source, _root, dryRun) {
  const parent = readNestedKey(index, op.dictionary);
  if (parent == null || typeof parent !== "object") {
    return { applied: false, note: `${op.dictionary} not found, nothing to rename` };
  }
  const fromPresent = parent[op.from] !== undefined;
  const toPresent = parent[op.to] !== undefined;
  if (!fromPresent && toPresent) return { applied: false, note: `${op.dictionary}.${op.from} -> .${op.to} already migrated` };
  if (!fromPresent && !toPresent) return { applied: false, note: `${op.from} absent in ${op.dictionary}, nothing to rename` };
  if (fromPresent && toPresent) {
    if (JSON.stringify(parent[op.from]) !== JSON.stringify(parent[op.to])) {
      throw new Error(`${op.dictionary} has both ${op.from} and ${op.to} with different values, resolve by hand and re-run`);
    }
    delete parent[op.from];
    void dryRun;
    return { applied: true, note: `dropped ${op.dictionary}.${op.from} (already mirrored at .${op.to})` };
  }
  parent[op.to] = parent[op.from];
  delete parent[op.from];
  void dryRun;
  return { applied: true, note: `renamed ${op.dictionary}.${op.from} to .${op.to}` };
}

// Dotted-path helpers shared by the rename handlers. readNestedKey returns undefined
// on any missing segment so the caller can distinguish presence from absent-value cases.
function readNestedKey(obj, dottedPath) {
  let cursor = obj;
  for (const p of dottedPath.split(".")) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = cursor[p];
  }
  return cursor;
}

function writeNestedKey(obj, dottedPath, value) {
  const parts = dottedPath.split(".");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cursor[parts[i]] == null) cursor[parts[i]] = {};
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
}

function deleteNestedKey(obj, dottedPath) {
  const parts = dottedPath.split(".");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cursor == null || typeof cursor !== "object") return;
    cursor = cursor[parts[i]];
  }
  if (cursor != null && typeof cursor === "object") delete cursor[parts[parts.length - 1]];
}
