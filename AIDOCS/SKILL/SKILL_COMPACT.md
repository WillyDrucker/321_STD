---
name: compact
description: Generate the instruction block for a /compact of this conversation, carrying the session's load-bearing state into the next context. Walks the current session arc, files touched, open items, constraints, and prints the block inside a fenced code box, instructions only, to paste after the /compact the user types.
---

# /321 -Compact

**Purpose:** Generate the instruction block that carries this session's load-bearing state through a `/compact`. The skill composes the block, prints it inside a fenced code box, and stops. The user types `/compact` and pastes the block after it. The skill never runs `/compact` itself, and the block never contains the command: a pasted line that starts with `/compact` is not read as a command, so a box that carried it stopped working.

## What goes in the block

Walk this session and gather, in order:

1. **Arc summary.** One line, what was actually worked on - the journey, not iterations. What landed, what shifted direction, what changed.
2. **Critical state.** Active branch, in-flight gates, decisions made or reversed, anything time-sensitive (a paused run, a pending PR, a deploy window, a flag waiting on a date).
3. **Files touched.** Explicit paths edited or examined deeply this session, so the next session knows where to look without re-discovering.
4. **Open items.** Numbered, prioritized. Highest-priority unfinished first. One line each, concrete (name the file, function, or next call).
5. **Reread on resume.** The files to load first in the next session - SESSION + MEMORY for context plus anything edited that the next pass will keep working on.
6. **Next concrete step.** One line, the literal next action when the user resumes.
7. **Discussed, not decided.** The conversation texture that code state cannot carry: concerns the user raised, ideas parked for later, trade-offs weighed without a ruling, offers awaiting word. These shape the next session's judgment even though no file changed.
8. **Do not lose.** Constraints, rules, or "never X" learnings the user confirmed this session that are not yet in MEMORY or auto-memory and would be lost if the next session does not see them.

Scale length to session significance. A small fix gets a tight block, a marathon session expands each section to a few lines, never paragraphs. Drop a section that has nothing real rather than pad it.

## Output format

Lead with one short sentence telling the user to type `/compact` and paste the block after it, then print the block inside a fenced code block so it renders as a single copyable gray box. The block holds the instructions alone, no `/compact` anywhere in it, and lists the gathered sections as bullets (open items numbered). Example shape (your actual block fills the sections with real session content, not the placeholders):

    From this session, preserve:
    - What we did: <arc summary>
    - Critical state: <branch, gates, decisions in flight>
    - Files touched: <list>
    - Open items:
      1. <highest-priority unfinished>
      2. <next>
    - Reread on resume: <file list>
    - Next concrete step: <one line>
    - Discussed, not decided: <concerns raised, ideas parked, offers pending>
    - Do not lose: <constraints confirmed this session>

The user copies the whole box and pastes it after `/compact` in the prompt. Nothing follows the box: no recap, no second copy of its content.

## Rules

- **You write the block, the user runs the command.** Never invoke `/compact` yourself, and never put `/compact` inside the block. The command is typed, the block is pasted after it.
- **House voice.** The generated text follows the house voice so the pasted block does not flag as banned prose in the next session.
- **Scale to significance.** A trivial session does not earn six expanded sections. A marathon does not get four bullets. Match the block to the work.
- **Concrete over vague.** "Open items: finish migrateRestore.mjs union-merge edge case" beats "Open items: keep working on migration." Name the file, the function, the next call.
- **No invented state.** Only what actually happened this session goes in the block. Drop an empty section rather than pad it.
