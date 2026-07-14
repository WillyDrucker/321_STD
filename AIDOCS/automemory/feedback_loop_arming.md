---
name: feedback-loop-arming
description: Unattended runs go through /loop via the Skill tool. Arm as the terminal action of the turn, and emit nothing after it.
metadata:
  type: feedback
---

To keep the agent re-invoking itself unattended (batch runs, any keep-going work), drive it through the `/loop` command via the Skill tool. The dynamic form (no interval token) self-paces.

**Do:**

- Arm through `/loop`, and keep batch state in a `TEMP/` progress file so each wake resumes at the next undone item.
- Make the arm the **terminal action of the turn.** Say everything you want to say BEFORE arming, then emit nothing.
- Re-arm on **every** turn while the loop is alive. A pending wake dies the moment any new turn starts, and both user messages and background task-notifications start turns.

**Do not:**

- Do not call `CronCreate`, and do not arm `ScheduleWakeup` outside the `/loop` flow.
- **Do not write anything after the arm.** No sign-off, no "armed for 05:35", no one-last-check. A turn that keeps producing output has not ended, and a wake cannot be delivered to a turn that never ended. Both instincts feel like courtesy and diligence, and both break it.

**Why:** delivery needs the session to reach idle, so anything that extends the turn-end path silently swallows the wake while the arming tool still reports success. A project `Stop` hook does the same thing, so if wakes never fire in a project that has one, suspect the hook before suspecting the session.
