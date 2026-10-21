---
name: stopwatcher
description: End the watch /321 -StartWatcher holds on the user's code page. Stops the running watcher with TaskStop and leaves the page as it is, the answer showing for the rest of its hour and the channel in the dropdown. -DELETE also takes the answer and the one before it down. -UNREGISTER takes the project off the page for good.
---

# /321 -StopWatcher

**Purpose:** Stop holding the conversation on the code page without touching what is on it. The watcher is a background task of this session, so ending it is a TaskStop, not a script. The channel stays registered, the answer showing stays for the rest of its hour, and input the user submits afterwards waits on the page for the next `/321 -StartWatcher`.

## Steps

1. **Find the watcher.** The background task running the watch command on this project's channel, as the ENV doc names it. None running: say so in one line, then go straight to the variant's step when `-DELETE` or `-UNREGISTER` was asked for, otherwise stop.
2. **Stop it** with TaskStop. One watcher per channel, so one stop.
3. **Leave the page.** No post, no delete, no register. Stop on the page is the user's button and is read by the loop. This skill stops the watcher itself.
4. **Say so in the terminal,** one line: the channel, and that input sent from now on waits for the next start.

## Variants

- **Default.** The steps above.
- **`-DELETE`.** After the stop (or at once when nothing was running), run the take-down command from the ENV doc, `code-post.mjs <channel> --delete`, which removes the answer and the one before it from the channel now. The channel stays in the dropdown.
- **`-UNREGISTER`.** After the stop (or at once when nothing was running), run the unregister command from the ENV doc, `code-unregister.mjs <channel>`, which takes the channel out of the dropdown with its answers, its waiting input and its stop flag, then delete the project's code page ENV doc. The project is off the page until a later `/321 -StartWatcher` installs it again, and nothing registers it in the meantime.

## Rules

- **Steps already taken stay taken.** A stop in the middle of an answer does not undo the work, and an answer already posted stays up.
- **Collected input is not lost.** A pickup folder on disk holds messages already taken off the page. Answer them before the stop, or say in the terminal that they wait unanswered in that folder.
- **Report as printed.** A take-down that fails is retried once, then reported with its output.
