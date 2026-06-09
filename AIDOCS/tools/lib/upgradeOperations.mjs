// upgradeOperations.mjs - the dispatch table for the named manifest operations the
// upgrade command applies. Each handler takes the uniform (op, index, source, root,
// dryRun) shape and returns { applied, deferred?, note }: applied=true did the change,
// deferred=true is a customization-skip that stays in missing[] for the next run, and
// applied=false (no deferred) is a clean no-op (idempotent: already-effective).
// dryRun=true computes the decision without writing. Registry-mutating ops live in
// upgradeOpsRegistry.mjs, project-tree ops in upgradeOpsFiles.mjs. A new op type
// lands in its seam file and registers here.

import {
  applyAutoMemoryAdd,
  applyFileAddTemplate,
  applyFileDelete,
  applySectionTextDiff,
  applySkillDelete,
  applySkillRename,
} from "./upgradeOpsFiles.mjs";
import {
  applyDictionaryRename,
  applyRegistryExtend,
  applyRegistryRename,
} from "./upgradeOpsRegistry.mjs";

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
