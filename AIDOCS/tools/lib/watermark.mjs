// watermark.mjs - read-only lookup over state.json's per-skill watermark fields.
// The two update skill bodies tell the AI to "scope the read to conversation since
// the watermark." This command surfaces the stamp without forcing the AI to read
// state.json itself, and surfaces last_captured (the slugs of the last run's
// lifo_insert bullets) so the AI can answer "did I capture this arc?" without
// re-reading SESSION / MEMORY. Outside the routine path it is also a quick "when
// was the last refresh?" health check.

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
    if (!entry || !entry.last_committed_at) {
      console.log(`${name}: never committed.`);
      continue;
    }
    const captured = Array.isArray(entry.last_captured) ? entry.last_captured : [];
    console.log(`${name}:`);
    console.log(`  last_committed_at: ${entry.last_committed_at}`);
    console.log(`  runs: ${entry.runs || 0}`);
    if (captured.length === 0) {
      console.log("  last_captured: (none recorded yet - older commit predates fingerprint stamping)");
    } else {
      console.log(`  last_captured (newest first, up to ${captured.length}):`);
      for (const slug of captured) console.log(`    - ${slug}`);
    }
  }
}
