---
name: long-scripts-via-write-tool
description: Long patch or log scripts go to the scratchpad through the Write tool, never an inline Bash heredoc. The heredoc path hits ENAMETOOLONG and the wrapper rewrites backticks and backslashes.
metadata:
  type: reference
---

A patch script longer than a screen goes through the Write tool into the session scratchpad, then runs by its absolute path. An inline Bash heredoc fails two ways: a long one dies with ENAMETOOLONG, and the wrapper processes backticks and backslashes inside the quoted body (a template literal becomes a command substitution, an escaped Windows path loses its backslashes).

**Why:** a full DevAudit ran a dozen batches this way with zero mangled edits, after an early heredoc attempt lost its backticks.

**How to apply:** Write the script, run it by absolute path, keep short one-off scripts (under about 15 lines, no backticks) inline. The script itself reads bytes, matches on normalized line endings, and restores each file's own ending, since a worktree can be LF while an editor saved CRLF.
