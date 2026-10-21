// watermark.mjs - read-only lookup over state.json's per-skill watermark: last_committed_at
// (the timestamp scope) and recent_captured (a rolling window of the last ~8 lifo_insert
// slugs across recent commits), so the AI can answer "did I capture this arc?" without
// re-reading SESSION / MEMORY. The printer is shared with the context command.

import { flag } from "./args.mjs";
import { loadState, recentCaptured, SKILLS } from "./state.mjs";

// The lanes --skill names, or both when it is absent. An unknown name exits 11.
export function lanesFromArgs(cmd, args) {
  const skill = flag(args, "--skill");
  if (skill && !SKILLS.includes(skill)) {
    console.error(`${cmd}: --skill must be one of ${SKILLS.join(" / ")}`);
    process.exit(11);
  }
  return skill ? [skill] : SKILLS;
}

export function printWatermark(state, lanes) {
  for (const name of lanes) {
    const entry = state[name];
    if (!entry?.last_committed_at) {
      console.log(`${name}: never committed.`);
      continue;
    }
    const captured = recentCaptured(entry);
    console.log(`${name}:`);
    console.log(`  last_committed_at: ${entry.last_committed_at}`);
    console.log(`  runs: ${entry.runs || 0}`);
    if (captured.length === 0) {
      console.log("  recent_captured: (none recorded yet - the last commit predates slug stamping)");
    } else {
      console.log(`  recent_captured (newest first, rolling window of ${captured.length}):`);
      for (const slug of captured) console.log(`    - ${slug}`);
    }
  }
}

export function cmdWatermark(_index, args) {
  printWatermark(loadState(), lanesFromArgs("watermark", args));
}
