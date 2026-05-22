// verdict.mjs - the shared C-hybrid contract. The AI classifies loose content and
// writes a verdict array to INSTALL/work/, the script validates and executes. One
// fixed vocabulary serves the discovery sweep, the auto-memory near-match map, and
// the skill-collision list, so every "AI decides, script moves" handoff is the
// same shape. Pure: parse + validate only, no I/O.

// What the content is. Drives where it lands when the AI is unsure.
export const VERDICT_TYPES = ["handoff", "design", "memory", "notes", "scratch", "skill", "env", "other"];

// What to do with it. move/copy/leave are deterministic file ops the executor runs;
// import routes a skill or doc through its importer.
export const VERDICT_ACTIONS = ["move", "copy", "leave", "import"];

// Confidence is optional. Either a 0..1 number or one of these levels.
export const VERDICT_LEVELS = ["high", "medium", "low"];

// Validate a parsed verdict array. Returns a list of human-readable errors (empty
// when well-formed). Unknown type / action and unknown keys are rejected so a
// typo can never silently no-op or mis-route.
export function validateVerdict(entries) {
  const errors = [];
  if (!Array.isArray(entries)) return ["verdict must be a JSON array of { path, type, action, confidence? }"];

  entries.forEach((e, i) => {
    const at = `entry ${i}`;
    if (typeof e !== "object" || e === null || Array.isArray(e)) {
      errors.push(`${at}: must be an object`);
      return;
    }
    if (typeof e.path !== "string" || e.path.length === 0) errors.push(`${at}: path required (non-empty string)`);
    if (!VERDICT_TYPES.includes(e.type)) errors.push(`${at}: type must be one of ${VERDICT_TYPES.join(" / ")} (got ${JSON.stringify(e.type)})`);
    if (!VERDICT_ACTIONS.includes(e.action)) errors.push(`${at}: action must be one of ${VERDICT_ACTIONS.join(" / ")} (got ${JSON.stringify(e.action)})`);
    if (e.confidence !== undefined) {
      const c = e.confidence;
      const okNum = typeof c === "number" && c >= 0 && c <= 1;
      const okLevel = typeof c === "string" && VERDICT_LEVELS.includes(c);
      if (!okNum && !okLevel) errors.push(`${at}: confidence must be a 0..1 number or one of ${VERDICT_LEVELS.join(" / ")}`);
    }
    for (const k of Object.keys(e)) {
      if (!["path", "type", "action", "confidence", "note"].includes(k)) errors.push(`${at}: unknown key "${k}"`);
    }
  });
  return errors;
}
