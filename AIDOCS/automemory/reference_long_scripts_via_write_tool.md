---
name: reference-long-scripts-via-write-tool
description: Patch and log scripts go through the Write tool into the scratchpad and run by absolute path. Each replacement asserts its anchor count, uses a function replacer, and restores the file's own line ending.
metadata:
  type: reference
---

A patch script longer than a screen, or one that carries a backtick, a backslash, an apostrophe, or a dollar sign, goes through the Write tool into the session scratchpad and runs by its absolute path. An inline heredoc or `-e` string is for a short one-off only: under about 15 lines, none of those characters, the whole command under about 8K characters.

The script's shape, the same in Node or Python:

- **Read bytes, match on LF, restore the file's own ending.** Detect CRLF, normalize for matching, rejoin with what the file had. A text-mode write on Windows turns LF into CRLF and corrupts an LF file.
- **Assert the anchor count.** Each replacement checks its anchor appears exactly once and skips when the new text is already present, so a rerun after a partial failure is safe and a wrong assumption about the file surfaces before anything is written.
- **A function replacer, never a string.** `s.replace(a, () => b)`. A string replacement reads the dollar sequences in `b` and silently rewrites them.
- **No nested template literal in the patch text.** Build such lines by concatenation. A unicode escape typed into Write or Edit lands as the literal character, so build escape text from char codes when a file must carry it.
- **After a regex patch, scan for a stray backspace byte.** A heredoc once turned a word boundary into one, invisible in every normal read.

**Why:** a full audit ran a dozen batches this way with zero mangled edits, after an early heredoc attempt lost its backticks. The heredoc path also dies with ENAMETOOLONG past a few thousand characters, and bash misreads a long body as shell code with an unexpected-EOF error that looks like a quoting bug.

**How to apply:** Write the script, run it by absolute path, read the asserted count in its output, then confirm the edit with one grep. Short one-off commands stay inline. Related: [[feedback-temp-folder-usage]].
