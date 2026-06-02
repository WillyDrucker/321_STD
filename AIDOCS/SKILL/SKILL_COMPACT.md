---
name: compact
description: Generate a ready-to-paste /compact instruction block that carries the session's load-bearing state into the next conversation. Walks the current session arc, files touched, open items, constraints, and prints the block inside a fenced code box for one-click copy.
---

# /321 -Compact

**Purpose:** Generate a ready-to-paste `/compact` instruction block that captures the current session's load-bearing state for the next conversation. The skill composes the block, prints it inside a fenced code block for one-click copy, and stops. The user pastes the block into the next prompt - this skill does not run `/compact` itself.

## What goes in the block

Walk this session and gather, in order:

1. **Arc summary.** One line, what was actually worked on - the journey, not iterations. What landed, what shifted direction, what changed.
2. **Critical state.** Active branch, in-flight gates, decisions made or reversed, anything time-sensitive (a paused run, a pending PR, a deploy window, a flag waiting on a date).
3. **Files touched.** Explicit paths edited or examined deeply this session, so the next session knows where to look without re-discovering.
4. **Open items.** Numbered, prioritized. Highest-priority unfinished first. One line each, concrete (name the file, function, or next call).
5. **Reread on resume.** The files to load first in the next session - SESSION + MEMORY for context plus anything edited that the next pass will keep working on.
6. **Next concrete step.** One line, the literal next action when the user resumes.
7. **Do not lose.** Constraints, rules, or "never X" learnings the user confirmed this session that are not yet in MEMORY or auto-memory and would be lost if the next session does not see them.

Scale length to session significance. A small fix gets a tight block, a marathon session expands each section to a few lines, never paragraphs. Drop a section that has nothing real rather than pad it.

## Output format

Lead with one short sentence telling the user what to do, then print the block inside a fenced code block so it renders as a single copyable gray box. The block starts with `/compact` and lists the gathered sections as bullets (open items numbered). Example shape (your actual block fills the sections with real session content, not the placeholders):

    /compact From this session, preserve:
    - What we did: <arc summary>
    - Critical state: <branch, gates, decisions in flight>
    - Files touched: <list>
    - Open items:
      1. <highest-priority unfinished>
      2. <next>
    - Reread on resume: <file list>
    - Next concrete step: <one line>
    - Do not lose: <constraints confirmed this session>

The user copies from `/compact` through the closing line and pastes that into the next prompt.

## Rules

- **You write the block, the user runs it.** Never invoke `/compact` yourself - the skill prints, the user paste-and-runs in the next conversation.
- **No em dashes, no semicolons.** The generated text follows the house rule so the pasted block does not flag as banned prose in the next session.
- **Scale to significance.** A trivial session does not earn six expanded sections. A marathon does not get four bullets. Match the block to the work.
- **Concrete over vague.** "Open items: finish migrate-restore.mjs union-merge edge case" beats "Open items: keep working on migration." Name the file, the function, the next call.
- **No invented state.** Only what actually happened this session goes in the block. Drop an empty section rather than pad it.
