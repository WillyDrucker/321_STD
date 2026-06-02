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
import { dirname, join } from "node:path";

import { overwriteSection } from "./mutators.mjs";

export const HANDLERS = {
  skill_delete: applySkillDelete,
  skill_rename: applySkillRename,
  registry_extend: applyRegistryExtend,
  file_add_template: applyFileAddTemplate,
  automemory_add: applyAutoMemoryAdd,
  section_text_diff: applySectionTextDiff,
};

// Handlers share a uniform (op, index, source, root, dryRun) shape so HANDLERS
// dispatches uniformly. An unused parameter on a specific handler is by design.

function applySkillDelete(op, _index, _source, root, dryRun) {
  const target = join(root, "AIDOCS", "SKILL", op.file);
  if (!existsSync(target)) return { applied: false, note: `${op.file} already absent` };
  if (!dryRun) rmSync(target, { force: true });
  return { applied: true, note: `removed AIDOCS/SKILL/${op.file}` };
}

function applySkillRename(op, _index, _source, root, dryRun) {
  // skill_rename is delete-old. The new body arrives via the engine-class copy step
  // (it is present in the source AIDOCS/SKILL/ tree). The op only needs the old name.
  const oldTarget = join(root, "AIDOCS", "SKILL", op.from);
  if (!existsSync(oldTarget)) {
    return { applied: false, note: `${op.from} already absent (new ${op.to} arrives via copy)` };
  }
  if (!dryRun) rmSync(oldTarget, { force: true });
  return { applied: true, note: `removed AIDOCS/SKILL/${op.from} (new ${op.to} arrives via copy)` };
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
  // resolves to the live project name on apply).
  const name = index.project_name || "PROJECTNAME";
  const file = (op.file || "").replace(/PROJECTNAME/g, name);
  const target = join(root, file);
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

function applyAutoMemoryAdd(op, index, source, root, dryRun) {
  const seedDir = (index.auto_memory?.seed || "./AIDOCS/automemory").replace(/^\.\//, "");
  const target = join(root, seedDir, op.file);
  if (existsSync(target)) return { applied: false, note: `${op.file} already in seed` };
  const sourceFile = join(source, "AIDOCS", "automemory", op.file);
  if (!existsSync(sourceFile)) throw new Error(`source seed missing ${op.file}`);
  if (!dryRun) {
    const dir = dirname(target);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cpSync(sourceFile, target);
  }
  return { applied: true, note: `seeded automemory/${op.file}` };
}

function applySectionTextDiff(op, index, _source, root, dryRun) {
  const target = join(root, op.file);
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
