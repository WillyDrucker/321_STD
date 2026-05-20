// validator.mjs - In-script validator for staging files against SCHEMA.json.
// Catches enum/required/oneOf shape errors plus unknown fields. Enforces two
// protection rules as hard gates (commit aborts pre-write): static-section
// writes (promote/gap-fill/update_section_text) require mode=full, and no
// fenced code in any EXTENDED-bound prose field (the code lives in the source).
// Returns an array of error strings; empty means clean.

import { BACKLOG_SECTIONS, ROUTINE_SECTIONS_BY_SKILL, STATIC_SECTIONS } from "./paths.mjs";

// No fenced code in EXTENDED. EXTENDED carries the summarized takeaway, the code
// lives in the source. Detection matches lint.mjs (a line trimmed-starting ```).
function hasFencedCode(text) {
  return typeof text === "string" && text.split("\n").some(l => l.trim().startsWith("```"));
}

const TOP_FIELDS = ["skill", "mode", "actions", "extended_actions", "backlog_actions"];
const ACTION_FIELDS = [
  "op", "section", "bullets", "bullet", "match", "extended_anchor",
  "target_section", "target_decisions",
  "body_md", "decisions_md", "extended_body_md", "extended_decisions_md",
  "find", "replace", "extended_find", "extended_replace", "rationale",
];
const EXT_FIELDS = ["op", "anchor", "heading", "body_md", "find", "replace"];
const BL_FIELDS = ["op", "section", "bullet", "match"];

const ROUTINE_OPS = ["overwrite_section", "lifo_insert", "remove", "replace"];
const STATIC_OPS = ["promote_to_section", "gap_fill_section", "update_section_text"];
const BACKLOG_OPS = ["lifo_insert", "remove", "replace"];

export function validateStaging(staging, skillName) {
  const errors = [];

  if (!staging || typeof staging !== "object") {
    errors.push("staging must be a JSON object");
    return errors;
  }
  for (const key of Object.keys(staging)) {
    if (!TOP_FIELDS.includes(key)) {
      errors.push(`unknown top-level field "${key}" (allowed: ${TOP_FIELDS.join(", ")})`);
    }
  }
  if (staging.skill !== skillName) {
    errors.push(`skill must be "${skillName}" (got "${staging.skill}")`);
  }
  if (!["skim", "incremental", "full"].includes(staging.mode)) {
    errors.push(`mode must be skim|incremental|full (got "${staging.mode}")`);
  }
  if (!Array.isArray(staging.actions)) {
    errors.push("actions must be an array");
    return errors;
  }

  const routineSections = ROUTINE_SECTIONS_BY_SKILL[skillName] || [];
  const isFullMode = staging.mode === "full";

  for (let i = 0; i < staging.actions.length; i++) {
    const a = staging.actions[i];
    const prefix = `actions[${i}]`;
    if (!a || typeof a !== "object") {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    for (const key of Object.keys(a)) {
      if (!ACTION_FIELDS.includes(key)) {
        errors.push(`${prefix} unknown field "${key}" (allowed: ${ACTION_FIELDS.join(", ")})`);
      }
    }

    const allOps = [...ROUTINE_OPS, ...STATIC_OPS];
    if (!allOps.includes(a.op)) {
      errors.push(`${prefix}.op must be one of: ${allOps.join(", ")}`);
      continue;
    }

    if (STATIC_OPS.includes(a.op)) {
      if (skillName !== "memory-update") {
        errors.push(`${prefix}.op ${a.op} is only valid for memory-update (got skill "${skillName}")`);
      }
      if (!isFullMode) {
        errors.push(`${prefix}.op ${a.op} requires mode=full (got mode="${staging.mode}"). Static-section writes are gated to full mode only.`);
      }
      if (!STATIC_SECTIONS.includes(a.target_section)) {
        errors.push(`${prefix}.target_section "${a.target_section}" not a valid static section (allowed: ${STATIC_SECTIONS.join(", ")})`);
      }
      if (a.op === "promote_to_section") {
        if (typeof a.match !== "string" || a.match.length === 0) {
          errors.push(`${prefix} promote_to_section requires match string (the LIFO bullet to promote)`);
        }
        if (a.target_decisions !== undefined && typeof a.target_decisions !== "boolean") {
          errors.push(`${prefix}.target_decisions must be a boolean if present`);
        }
      }
      if (a.op === "gap_fill_section") {
        if (typeof a.body_md !== "string" || a.body_md.length === 0) {
          errors.push(`${prefix} gap_fill_section requires body_md string`);
        }
        for (const fld of ["decisions_md", "extended_body_md", "extended_decisions_md"]) {
          if (a[fld] !== undefined && typeof a[fld] !== "string") {
            errors.push(`${prefix}.${fld} must be a string if present`);
          }
        }
        for (const fld of ["extended_body_md", "extended_decisions_md"]) {
          if (hasFencedCode(a[fld])) {
            errors.push(`${prefix}.${fld} contains a fenced code block (\`\`\`). No code in EXTENDED - summarize the takeaway in prose, the code lives in the source.`);
          }
        }
      }
      if (a.op === "update_section_text") {
        if (typeof a.find !== "string" || a.find.length === 0) {
          errors.push(`${prefix} update_section_text requires non-empty find string`);
        }
        if (typeof a.replace !== "string") {
          errors.push(`${prefix} update_section_text requires replace string (can be empty for deletion)`);
        }
        if (typeof a.rationale !== "string" || a.rationale.length === 0) {
          errors.push(`${prefix} update_section_text requires non-empty rationale string (the AI's decision why this update applies)`);
        }
        for (const fld of ["extended_find", "extended_replace"]) {
          if (a[fld] !== undefined && typeof a[fld] !== "string") {
            errors.push(`${prefix}.${fld} must be a string if present`);
          }
        }
        if (a.extended_find !== undefined && a.extended_replace === undefined) {
          errors.push(`${prefix} update_section_text: extended_find requires matching extended_replace`);
        }
        if (a.extended_replace !== undefined && a.extended_find === undefined) {
          errors.push(`${prefix} update_section_text: extended_replace requires matching extended_find`);
        }
        if (hasFencedCode(a.extended_replace)) {
          errors.push(`${prefix}.extended_replace contains a fenced code block (\`\`\`). No code in EXTENDED - summarize the takeaway in prose.`);
        }
      }
      continue;
    }

    // Routine ops below.
    if (!routineSections.includes(a.section)) {
      errors.push(`${prefix}.section "${a.section}" not valid for ${skillName} routine ops (allowed: ${routineSections.join(", ")}). Static sections require promote_to_section, gap_fill_section, or update_section_text in mode=full. BACKLOG sections live on backlog_actions.`);
    }
    if (a.op === "overwrite_section") {
      if (!Array.isArray(a.bullets)) {
        errors.push(`${prefix} overwrite_section requires bullets[] array`);
      } else {
        for (let j = 0; j < a.bullets.length; j++) {
          if (typeof a.bullets[j] !== "string") {
            errors.push(`${prefix}.bullets[${j}] must be a string`);
          }
        }
      }
      if (a.section !== "current_state") {
        errors.push(`${prefix} overwrite_section is only valid on section "current_state" (got "${a.section}")`);
      }
    }
    if (a.op === "lifo_insert") {
      if (typeof a.bullet !== "string" || a.bullet.length === 0) {
        errors.push(`${prefix} lifo_insert requires bullet string`);
      }
      if (a.section !== "lifo") {
        errors.push(`${prefix} lifo_insert is only valid on section "lifo" (got "${a.section}")`);
      }
    }
    if (a.op === "remove") {
      if (typeof a.match !== "string" || a.match.length === 0) {
        errors.push(`${prefix} remove requires match string`);
      }
      if (a.section !== "lifo") {
        errors.push(`${prefix} remove is only valid on section "lifo" (got "${a.section}")`);
      }
    }
    if (a.op === "replace") {
      if (typeof a.match !== "string" || a.match.length === 0 || typeof a.bullet !== "string" || a.bullet.length === 0) {
        errors.push(`${prefix} replace requires both match and bullet as non-empty strings`);
      }
      if (a.section !== "lifo") {
        errors.push(`${prefix} replace is only valid on section "lifo" (got "${a.section}")`);
      }
    }
    if (a.extended_anchor && !/^[a-z0-9-]+$/.test(a.extended_anchor)) {
      errors.push(`${prefix}.extended_anchor must be lowercase-kebab (got "${a.extended_anchor}")`);
    }
  }

  if (staging.extended_actions !== undefined) {
    if (!Array.isArray(staging.extended_actions)) {
      errors.push("extended_actions must be an array if present");
    } else {
      const validExtOps = ["add", "drop", "replace", "replace_text"];
      for (let i = 0; i < staging.extended_actions.length; i++) {
        const ea = staging.extended_actions[i];
        const prefix = `extended_actions[${i}]`;
        if (!ea || typeof ea !== "object") {
          errors.push(`${prefix} must be an object`);
          continue;
        }
        for (const key of Object.keys(ea)) {
          if (!EXT_FIELDS.includes(key)) {
            errors.push(`${prefix} unknown field "${key}" (allowed: ${EXT_FIELDS.join(", ")})`);
          }
        }
        if (!validExtOps.includes(ea.op)) {
          errors.push(`${prefix}.op must be one of: ${validExtOps.join(", ")}`);
        }
        if (!ea.anchor || !/^[a-z0-9-]+$/.test(ea.anchor)) {
          errors.push(`${prefix}.anchor must be lowercase-kebab`);
        }
        if ((ea.op === "add" || ea.op === "replace") && !ea.body_md) {
          errors.push(`${prefix} ${ea.op} requires body_md string`);
        }
        if ((ea.op === "add" || ea.op === "replace") && hasFencedCode(ea.body_md)) {
          errors.push(`${prefix} ${ea.op} body_md contains a fenced code block (\`\`\`). No code in EXTENDED - summarize the takeaway in prose, the code lives in the source.`);
        }
        if (ea.op === "replace_text" && (typeof ea.find !== "string" || typeof ea.replace !== "string")) {
          errors.push(`${prefix} replace_text requires find and replace strings`);
        }
        if (ea.op === "replace_text" && ea.find === "") {
          errors.push(`${prefix} replace_text find string must not be empty`);
        }
        if (ea.op === "replace_text" && hasFencedCode(ea.replace)) {
          errors.push(`${prefix} replace_text replace contains a fenced code block (\`\`\`). No code in EXTENDED - summarize the takeaway in prose.`);
        }
      }
    }
  }

  if (staging.backlog_actions !== undefined) {
    if (!Array.isArray(staging.backlog_actions)) {
      errors.push("backlog_actions must be an array if present");
    } else {
      if (skillName === "session-update" && staging.backlog_actions.length > 0) {
        errors.push("session-update does not support backlog_actions (memory-update only - BACKLOG is forward-looking work owned by the memory track)");
      }
      for (let i = 0; i < staging.backlog_actions.length; i++) {
        const ba = staging.backlog_actions[i];
        const prefix = `backlog_actions[${i}]`;
        if (!ba || typeof ba !== "object") {
          errors.push(`${prefix} must be an object`);
          continue;
        }
        for (const key of Object.keys(ba)) {
          if (!BL_FIELDS.includes(key)) {
            errors.push(`${prefix} unknown field "${key}" (allowed: ${BL_FIELDS.join(", ")})`);
          }
        }
        if (!BACKLOG_OPS.includes(ba.op)) {
          errors.push(`${prefix}.op must be one of: ${BACKLOG_OPS.join(", ")}`);
          continue;
        }
        if (!BACKLOG_SECTIONS.includes(ba.section)) {
          errors.push(`${prefix}.section "${ba.section}" not valid for backlog ops (allowed: ${BACKLOG_SECTIONS.join(", ")})`);
        }
        if (ba.op === "lifo_insert" && (typeof ba.bullet !== "string" || ba.bullet.length === 0)) {
          errors.push(`${prefix} lifo_insert requires bullet string`);
        }
        if (ba.op === "remove" && (typeof ba.match !== "string" || ba.match.length === 0)) {
          errors.push(`${prefix} remove requires match string`);
        }
        if (ba.op === "replace" && (typeof ba.match !== "string" || ba.match.length === 0 || typeof ba.bullet !== "string" || ba.bullet.length === 0)) {
          errors.push(`${prefix} replace requires both match and bullet as non-empty strings`);
        }
      }
    }
  }

  return errors;
}
