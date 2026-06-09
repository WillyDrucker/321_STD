// watermark.mjs - read-only lookup over state.json's per-skill watermark fields.
// Surfaces last_committed_at (the timestamp scope) and recent_captured (a rolling
// window of the last ~8 lifo_insert slugs across recent commits) so the AI can
// answer "did I capture this arc?" without re-reading SESSION / MEMORY.

import { flag } from "./args.mjs";
import { loadState, SKILLS } from "./state.mjs";

export function cmdWatermark(_index, args) {
  const skill = flag(args, "--skill");
  if (skill && !SKILLS.includes(skill)) {
    console.error(`watermark: --skill must be one of ${SKILLS.join(" / ")}`);
    process.exit(11);
  }
  const state = loadState();
  const targets = skill ? [skill] : SKILLS;
  for (const name of targets) {
    const entry = state[name];
    if (!entry?.last_committed_at) {
      console.log(`${name}: never committed.`);
      continue;
    }
    // Fall back to the 0.1.9 / 0.1.10 last_captured key during the transition window.
    const captured = Array.isArray(entry.recent_captured) ? entry.recent_captured
      : Array.isArray(entry.last_captured) ? entry.last_captured
      : [];
    console.log(`${name}:`);
    console.log(`  last_committed_at: ${entry.last_committed_at}`);
    console.log(`  runs: ${entry.runs || 0}`);
    if (captured.length === 0) {
      console.log("  recent_captured: (none recorded yet - older commit predates fingerprint stamping)");
    } else {
      console.log(`  recent_captured (newest first, rolling window of ${captured.length}):`);
      for (const slug of captured) console.log(`    - ${slug}`);
    }
  }
}
