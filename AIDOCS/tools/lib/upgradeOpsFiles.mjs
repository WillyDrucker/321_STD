// upgradeOpsFiles.mjs - manifest ops that mutate the project tree: skill_delete and
// skill_rename (AIDOCS/SKILL bodies), file_add_template and file_delete (any
// project-relative path), automemory_add (seed + external runtime), section_text_diff
// (canonical section replace). Every target passes resolveContained or
// requireSkillBasename, so a hostile or typo'd manifest cannot reach outside the
// project root. customizations[] defers the destructive ops (deferred=true keeps them
// out of the journal so the reversal path retries). Contract: upgradeOperations.mjs.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";

import { overwriteSection } from "./mutators.mjs";
import { fromHomeRef, isContained } from "./paths.mjs";

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

export function applySkillDelete(op, index, _source, root, dryRun) {
  requireSkillBasename("skill_delete", "file", op.file);
  const relPath = `AIDOCS/SKILL/${op.file}`;
  const customizations = new Set(index.customizations || []);
  if (customizations.has(relPath)) {
    return { applied: false, deferred: true, note: `${op.file} deferred (customizations[]) - remove from customizations[] to apply` };
  }
  const target = join(root, "AIDOCS", "SKILL", op.file);
  if (!existsSync(target)) return { applied: false, note: `${op.file} already absent` };
  if (!dryRun) rmSync(target, { force: true });
  return { applied: true, note: `removed ${relPath}` };
}

export function applySkillRename(op, index, _source, root, dryRun) {
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
    return { applied: false, deferred: true, note: `${op.from} deferred (customizations[]) - remove from customizations[] to apply (new ${op.to} still arrives via copy)` };
  }
  const oldTarget = join(root, "AIDOCS", "SKILL", op.from);
  if (!existsSync(oldTarget)) {
    return { applied: false, note: `${op.from} already absent (new ${op.to} arrives via copy)` };
  }
  if (!dryRun) rmSync(oldTarget, { force: true });
  return { applied: true, note: `removed ${oldRel} (new ${op.to} arrives via copy)` };
}

export function applyFileAddTemplate(op, index, _source, root, dryRun) {
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
export function applyFileDelete(op, index, _source, root, dryRun) {
  // Honor customizations[] - a path the user has deliberately edited may not be ours
  // to delete. The reversal pattern is documented (user removes the path from
  // customizations[], then re-runs -UpdateSync). The deferred flag keeps the op out
  // of operations_applied[] so the re-run actually sees it in missing[] (without
  // deferred, the skip would journal as applied and the re-run would never retry).
  const customizations = new Set(index.customizations || []);
  if (customizations.has(op.file)) {
    return { applied: false, deferred: true, note: `${op.file} deferred (customizations[]) - remove from customizations[] to apply` };
  }
  const target = resolveContained("file_delete", root, op.file);
  if (!existsSync(target)) return { applied: false, note: `${op.file} already absent` };
  if (!dryRun) rmSync(target, { force: true });
  return { applied: true, note: `removed ${op.file}` };
}

export function applyAutoMemoryAdd(op, index, source, root, dryRun) {
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

export function applySectionTextDiff(op, index, _source, root, dryRun) {
  const target = resolveContained("section_text_diff", root, op.file);
  if (!existsSync(target)) return { applied: false, note: `${op.file} absent, project may need init` };
  if ((index.customizations || []).includes(op.file)) {
    return { applied: false, deferred: true, note: `${op.file} deferred (customizations[]) - section preserved, remove from customizations[] to apply` };
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
