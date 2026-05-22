// installLog.mjs - append-only onboarding audit trail. The mechanical onboarding
// commands record what they did and where content went into INSTALL/INSTALL.log, so the
// -Setup AI can read the history (what was archived, where it landed, what was relaid)
// before it judges content. Scoped to the onboarding window by design: it writes only
// while INSTALL/ exists, so once graduate removes INSTALL/ at steady state the call goes
// silent on its own - no steady-state noise, nothing to clean up. Append order is the
// time signal, so the lines carry no dates.

import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function installLog(root, line) {
  const dir = join(root, "INSTALL");
  if (!existsSync(dir)) return;   // post-graduation, or an install with no runbooks: no-op
  appendFileSync(join(dir, "INSTALL.log"), line.endsWith("\n") ? line : `${line}\n`, "utf8");
}
