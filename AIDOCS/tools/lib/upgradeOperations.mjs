// upgradeOperations.mjs - the named manifest operations the upgrade command
// applies. Each handler takes (op, index, source, root, dryRun) and returns
// { applied, note }. applied=false means the op was inapplicable (already
// effective, or skipped by customizations) and the call was a clean no-op
// (idempotent). dryRun=true means the handler computes its decision (existence
// checks, customization gate, section lookup) but never writes to disk - the
// caller still gets a faithful applied / note pair to report. The HANDLERS table
// maps op.type to its handler so the driver dispatches uniformly. New op types
// land in this file - the driver's loop does not need to change.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";

import { overwriteSection } from "./mutators.mjs";
import { fromHomeRef, isContained } from "./paths.mjs";

export const HANDLERS = {
  skill_delete: applySkillDelete,
  skill_rename: applySkillRename,
  registry_extend: applyRegistryExtend,
  registry_rename: applyRegistryRename,
  dictionary_rename: applyDictionaryRename,
  file_add_template: applyFileAddTemplate,
  file_delete: applyFileDelete,
  automemory_add: applyAutoMemoryAdd,
  section_text_diff: applySectionTextDiff,
};

// Resolve a manifest-supplied project-relative path against the project root, and
// reject anything that escapes via `..` or an absolute path. Upstream is trusted in
// the normal case, but a typo or a hostile manifest cannot be allowed to write
// outside the project tree. Reuses paths.isContained, which compares on canonical
// (symlink-resolved) paths so a symlink in the existing prefix cannot redirect the
// target outside the intended root.
function resolveContained(opName, root, relPath) {
  if (typeof relPath !== "string" || relPath === "") {
    throw new Error(`${opName}: relative path is required (got ${JSON.stringify(relPath)})`);
  }
  if (isAbsolute(relPath)) {
    throw new Error(`${opName}: "${relPath}" must be project-relative, not absolute`);
  }
  const target = join(root, relPath);
  if (!isContained(root, target)) {
    throw new Error(`${opName}: "${relPath}" escapes the project root`);
  }
  return target;
}

// Handlers share a uniform (op, index, source, root, dryRun) shape so HANDLERS
// dispatches uniformly. An unused parameter on a specific handler is by design.

// Reject anything that is not a bare skill-body basename. op.file (skill_delete) and
// op.from / op.to (skill_rename) must be `SKILL_<DOMAIN>[-<SUB>].md` with no path
// separators, so a manifest cannot reach outside AIDOCS/SKILL with `../`. The naming
// convention is enforced by sync.mjs flagFromFilename downstream, this is the
// upstream gate.
function requireSkillBasename(opName, field, value) {
  if (!value || value !== basename(value) || !/^SKILL_.+\.md$/.test(value)) {
    throw new Error(`${opName}: "${field}" must be a bare SKILL_*.md basename (got ${JSON.stringify(value)})`);
  }
}

function applySkillDelete(op, index, _source, root, dryRun) {
  requireSkillBasename("skill_delete", "file", op.file);
  const relPath = `AIDOCS/SKILL/${op.file}`;
  const customizations = new Set(index.customizations || []);
  if (customizations.has(relPath)) {
    return { applied: false, note: `${op.file} skipped (customizations[]) - remove from customizations[] to apply` };
  }
  const target = join(root, "AIDOCS", "SKILL", op.file);
  if (!existsSync(target)) return { applied: false, note: `${op.file} already absent` };
  if (!dryRun) rmSync(target, { force: true });
  return { applied: true, note: `removed ${relPath}` };
}

function applySkillRename(op, index, _source, root, dryRun) {
  // skill_rename is delete-old. The new body arrives via the engine-class copy step
  // (it is present in the source AIDOCS/SKILL/ tree). The op only needs the old name.
  // customizations[] on the OLD path skips the delete (the user's local edits stay).
  // The new body still lands via the copy step, so two bodies coexist until the user
  // removes the customizations[] entry and re-runs -UpdateSync.
  requireSkillBasename("skill_rename", "from", op.from);
  requireSkillBasename("skill_rename", "to", op.to);
  const oldRel = `AIDOCS/SKILL/${op.from}`;
  const customizations = new Set(index.customizations || []);
  if (customizations.has(oldRel)) {
    return { applied: false, note: `${op.from} skipped (customizations[]) - remove from customizations[] to apply (new ${op.to} still arrives via copy)` };
  }
  const oldTarget = join(root, "AIDOCS", "SKILL", op.from);
  if (!existsSync(oldTarget)) {
    return { applied: false, note: `${op.from} already absent (new ${op.to} arrives via copy)` };
  }
  if (!dryRun) rmSync(oldTarget, { force: true });
  return { applied: true, note: `removed ${oldRel} (new ${op.to} arrives via copy)` };
}

function applyRegistryExtend(op, index, _source, _root, dryRun) {
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

function applyFileAddTemplate(op, index, _source, root, dryRun) {
  // The op.file path and op.body both carry the PROJECTNAME placeholder so a single
  // manifest entry serves every project (e.g. "AIDOCS/PROJECTNAME_BACKLOG_EXTENDED.md"
  // resolves to the live project name on apply). Containment check runs against the
  // resolved (post-substitution) path so a `../` cannot be hidden inside PROJECTNAME.
  const name = index.project_name || "PROJECTNAME";
  const file = (op.file || "").replace(/PROJECTNAME/g, name);
  const target = resolveContained("file_add_template", root, file);
  if (existsSync(target)) {
    return { applied: false, note: `${file} already present, preserved` };
  }
  if (!dryRun) {
    const body = (op.body || "").replace(/PROJECTNAME/g, name);
    const dir = dirname(target);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(target, body, "utf8");
  }
  return { applied: true, note: `wrote ${file}` };
}

// Remove an engine-class file the source no longer carries. The copy step in
// upgrade only writes source-present files, so a file removed upstream lingers
// in the project unless this op fires (the same shape as skill_delete, but for
// any project-relative path). Containment-checked so a manifest typo cannot
// reach outside the project root. Idempotent: an already-absent file is a no-op.
function applyFileDelete(op, index, _source, root, dryRun) {
  // Honor customizations[] - a path the user has deliberately edited may not be ours
  // to delete. The reversal pattern is documented (user removes the path from
  // customizations[], then re-runs -UpdateSync), but until they do, the op skips
  // cleanly. Without this, an upstream cleanup op could blow away a project's local
  // work in the same file the customizations[] entry was meant to preserve.
  const customizations = new Set(index.customizations || []);
  if (customizations.has(op.file)) {
    return { applied: false, note: `${op.file} skipped (customizations[]) - remove from customizations[] to apply` };
  }
  const target = resolveContained("file_delete", root, op.file);
  if (!existsSync(target)) return { applied: false, note: `${op.file} already absent` };
  if (!dryRun) rmSync(target, { force: true });
  return { applied: true, note: `removed ${op.file}` };
}

function applyAutoMemoryAdd(op, index, source, root, dryRun) {
  // op.file is a basename inside the auto-memory dir, not a path. A separator
  // (or `..`) or an empty value would let a manifest write outside the seed dir, or
  // reduce to a no-op that silently records as applied. Reject both.
  if (!op.file || op.file !== basename(op.file)) {
    throw new Error(`automemory_add: "${op.file}" must be a non-empty basename, not a path`);
  }
  const seedDir = (index.auto_memory?.seed || "./AIDOCS/automemory").replace(/^\.\//, "");
  const target = resolveContained("automemory_add", root, join(seedDir, op.file));
  const sourceFile = join(source, "AIDOCS", "automemory", op.file);
  if (!existsSync(sourceFile)) throw new Error(`source seed missing ${op.file}`);

  // Evaluate the seed and the external runtime independently so a previously-written
  // seed (write-if-missing on init, or a manual add) does not stop the runtime from
  // catching up. Either target missing means "applied", both present means no-op.
  const seedMissing = !existsSync(target);
  const externalRel = index.auto_memory?.path;
  const externalAbs = externalRel ? fromHomeRef(externalRel) : null;
  const externalFile = externalAbs ? join(externalAbs, op.file) : null;
  const externalMissing = externalFile != null && !existsSync(externalFile);

  if (!seedMissing && !externalMissing) {
    return { applied: false, note: `${op.file} already in seed${externalAbs ? " and external runtime" : ""}` };
  }

  if (!dryRun) {
    if (seedMissing) {
      const dir = dirname(target);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      cpSync(sourceFile, target);
    }
    if (externalMissing) {
      mkdirSync(externalAbs, { recursive: true });
      cpSync(sourceFile, externalFile);
    }
  }
  const parts = [];
  if (seedMissing) parts.push("seed");
  if (externalMissing) parts.push("external runtime");
  return { applied: true, note: `seeded automemory/${op.file} (${parts.join(" + ")})` };
}

function applySectionTextDiff(op, index, _source, root, dryRun) {
  const target = resolveContained("section_text_diff", root, op.file);
  if (!existsSync(target)) return { applied: false, note: `${op.file} absent, project may need init` };
  if ((index.customizations || []).includes(op.file)) {
    return { applied: false, note: `${op.file} in customizations[], section preserved` };
  }
  const content = readFileSync(target, "utf8");
  let updated;
  try {
    updated = overwriteSection(content, op.section, op.body || "");
  } catch {
    return { applied: false, note: `section "${op.section}" not found in ${op.file}` };
  }
  if (!dryRun) writeFileSync(target, updated, "utf8");
  return { applied: true, note: `replaced "${op.section}" in ${op.file}` };
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
function applyRegistryRename(op, index, _source, _root, dryRun) {
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
function applyDictionaryRename(op, index, _source, _root, dryRun) {
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

// Dotted-path helpers shared by applyRegistryRename. readNested returns undefined on
// any missing segment so the caller can distinguish presence from absent-value cases.
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
