# 10-targeted-ops.sh - the 0.1.19 targeted ops absorbed from LIFT321-app.
#
#   T111-T112 amend_bullet rewrites ONE bullet in place (seat and marker kept), and an
#             ambiguous or missing match refuses before any write.
#   T113-T114 drop_bullet removes one bullet and archives the line (move, not delete).
#             A [+] bullet needs its EXTENDED drop in the same staging (exit 18).
#   T115-T117 changelog_insert lands under the newest block newest-first, opens
#             [Unreleased] on a fresh file, and the firewall keeps every other op off the
#             changelog key.
#   T118      dictionary_extend adds a dotted files key once and preserves a present one.
#   T119-T120 the index reconcile never carries upstream's placeholder-profile pointer into
#             a project that renamed the profile, and doctor reads the rule index for
#             pointers to missing files.
#
# Sourced after 09.

echo "=== T111: amend_bullet rewrites one bullet in place, seat kept ==="
TO="$BASE/targeted"
TOENG="$(mk_proj "$TO" Targeted)"
printf '# Targeted - SESSION\n\n**Purpose:** t.\n\n## Current State\n\n- Branch: main\n- Tests: 10 across 2 suites\n- Focus: the thing\n\n---\n\n## LIFO\n\n- newest event\n- middle event that was wrong\n- oldest event\n' > "$TO/AIDOCS/Targeted_SESSION.md"
printf '{"actions":[{"op":"amend_bullet","file":"updatesession.session","section":"Current State","match":"Tests:","bullet":"Tests: 12 across 3 suites"},{"op":"amend_bullet","file":"updatesession.session","section":"LIFO","match":"middle event","bullet":"middle event, corrected"}]}\n' > "$TO/AIDOCS/tools/staging/updatesession.json"
node "$TOENG" commit --skill updatesession >/dev/null 2>&1
grep -q "Tests: 12 across 3 suites" "$TO/AIDOCS/Targeted_SESSION.md" && pass "the Current State bullet was rewritten" || fail "amend_bullet did not rewrite the Current State bullet"
grep -q "Tests: 10" "$TO/AIDOCS/Targeted_SESSION.md" && fail "the old bullet survived" || pass "the old text is gone"
sed -n '/## Current State/,/^---/p' "$TO/AIDOCS/Targeted_SESSION.md" | grep "^- " | sed -n '2p' | grep -q "Tests: 12" && pass "the amended bullet kept its seat" || fail "the amended bullet moved"
sed -n '/## LIFO/,$p' "$TO/AIDOCS/Targeted_SESSION.md" | grep "^- " | sed -n '2p' | grep -q "middle event, corrected" && pass "the LIFO bullet was amended in place (not prepended)" || fail "the LIFO amend did not land in its seat"
grep -q "middle-event-corrected" "$TO/AIDOCS/tools/state.json" && pass "an amended bullet counts as captured in the watermark" || fail "amend_bullet left no watermark fingerprint"

echo "=== T112: an ambiguous or missing match refuses before any write ==="
printf '# Targeted - BACKLOG\n\n**Purpose:** t.\n\n## Features\n\n- **Fix A.** one _(source: user)_\n- **Fix B.** two _(source: user)_\n\n## Ideas\n\n- an idea\n' > "$TO/AIDOCS/Targeted_BACKLOG.md"
printf '{"actions":[{"op":"amend_bullet","file":"updatememory.backlog","section":"Features","match":"**Fix","bullet":"**Fix C.** three"}]}\n' > "$TO/AIDOCS/tools/staging/updatememory.json"
node "$TOENG" commit --skill updatememory >/dev/null 2>&1; RC=$?
[ "$RC" = "16" ] && pass "two matching bullets refuse (exit 16)" || fail "an ambiguous match did not refuse (exit $RC)"
grep -q "Fix C" "$TO/AIDOCS/Targeted_BACKLOG.md" && fail "an ambiguous amend wrote anyway" || pass "nothing written on the ambiguous match"
printf '{"actions":[{"op":"amend_bullet","file":"updatememory.backlog","section":"Features","match":"**Nope","bullet":"**Fix C.** three"}]}\n' > "$TO/AIDOCS/tools/staging/updatememory.json"
node "$TOENG" commit --skill updatememory >/dev/null 2>&1; RC=$?
[ "$RC" = "16" ] && pass "a match with no bullet refuses (exit 16)" || fail "a missing match did not refuse (exit $RC)"

echo "=== T113: drop_bullet removes one bullet and archives the line (move, not delete) ==="
printf '{"actions":[{"op":"drop_bullet","file":"updatememory.backlog","section":"Features","match":"**Fix A."}]}\n' > "$TO/AIDOCS/tools/staging/updatememory.json"
node "$TOENG" commit --skill updatememory >/dev/null 2>&1; RC=$?
[ "$RC" = "0" ] && pass "drop_bullet commits" || fail "drop_bullet failed (exit $RC)"
grep -q "Fix A" "$TO/AIDOCS/Targeted_BACKLOG.md" && fail "the dropped item survived" || pass "the item left BACKLOG"
grep -q "Fix B" "$TO/AIDOCS/Targeted_BACKLOG.md" && pass "the sibling item stayed" || fail "drop_bullet took a sibling with it"
cat "$TO/AIDOCS/Targeted_BACKLOG_ARCHIVE/"*_Targeted_BACKLOG.md 2>/dev/null | grep -q "Fix A" && pass "the dropped line was archived" || fail "no archive of the dropped line"

echo "=== T114: a dropped [+] bullet needs its EXTENDED drop in the same staging ==="
printf '# Targeted - MEMORY\n\n**Purpose:** t.\n\n## Overview\n\n- o\n\n## Stack\n\n- s\n\n## Architecture\n\n- a\n\n## Environment\n\n- e\n\n## Pipeline\n\n- p\n\n## Conventions\n\n- c\n\n---\n\n## LIFO\n\n- [+] deep note\n- plain note\n' > "$TO/AIDOCS/Targeted_MEMORY.md"
printf '# Targeted - MEMORY (Extended)\n\n**Purpose:** t.\n\n## LIFO\n\n### deep note\n\nthe depth\n' > "$TO/AIDOCS/Targeted_MEMORY_EXTENDED.md"
printf '{"actions":[{"op":"drop_bullet","file":"updatememory.memory","section":"LIFO","match":"deep note"}]}\n' > "$TO/AIDOCS/tools/staging/updatememory.json"
node "$TOENG" commit --skill updatememory >/dev/null 2>&1; RC=$?
[ "$RC" = "18" ] && pass "an unpaired [+] drop refuses (exit 18)" || fail "an unpaired [+] drop did not refuse (exit $RC)"
grep -q "deep note" "$TO/AIDOCS/Targeted_MEMORY.md" && pass "nothing written on the refused drop" || fail "the refused drop wrote anyway"
printf '{"actions":[{"op":"drop_bullet","file":"updatememory.memory","section":"LIFO","match":"deep note"},{"op":"drop","file":"updatememory.memory_extended","anchor":"deep-note"}]}\n' > "$TO/AIDOCS/tools/staging/updatememory.json"
node "$TOENG" commit --skill updatememory >/dev/null 2>&1; RC=$?
[ "$RC" = "0" ] && pass "the paired drop commits" || fail "the paired drop failed (exit $RC)"
grep -q "deep note" "$TO/AIDOCS/Targeted_MEMORY.md" && fail "the [+] bullet survived the paired drop" || pass "the [+] bullet left MEMORY"
grep -q "### deep note" "$TO/AIDOCS/Targeted_MEMORY_EXTENDED.md" && fail "the sub-section survived" || pass "the sub-section left the EXTENDED"
grep -q "plain note" "$TO/AIDOCS/Targeted_MEMORY.md" && pass "the sibling bullet stayed" || fail "the paired drop took a sibling with it"

echo "=== T115: changelog_insert lands under the newest block, newest first ==="
printf '# Changelog\n\nComposed at release.\n\n## [1.1.0] - 2026-01-01\n\n### Added\n\n- **Older line.** It was first.\n\n### Fixed\n\n- **A fix.** Done.\n\n## [1.0.0] - 2025-12-01\n\n### Added\n\n- **Ancient.** Yes.\n' > "$TO/CHANGELOG.md"
printf '{"actions":[{"op":"changelog_insert","file":"updatesession.changelog","section":"Added","bullet":"**Newer line.** You will notice it."},{"op":"changelog_insert","file":"updatesession.changelog","section":"Changed","bullet":"**A change.** Felt."}]}\n' > "$TO/AIDOCS/tools/staging/updatesession.json"
node "$TOENG" commit --skill updatesession >/dev/null 2>&1; RC=$?
[ "$RC" = "0" ] && pass "changelog_insert commits" || fail "changelog_insert failed (exit $RC)"
sed -n '/## \[1.1.0\]/,/## \[1.0.0\]/p' "$TO/CHANGELOG.md" | grep "^- " | sed -n '1p' | grep -q "A change" && pass "the opened Changed section stands first in the newest block" || fail "the opened section did not land inside the newest block"
sed -n '/### Added/,/### /p' "$TO/CHANGELOG.md" | grep "^- " | sed -n '1p' | grep -q "Newer line" && pass "the new Added line sits above the older one (newest first)" || fail "the new line did not land newest-first"
sed -n '/## \[1.0.0\]/,$p' "$TO/CHANGELOG.md" | grep -q "Newer line\|A change" && fail "the older block was touched" || pass "the older block is untouched"

echo "=== T116: a changelog with no version block opens [Unreleased] ==="
CL="$BASE/changelog"
CLENG="$(mk_proj "$CL" Changelog)"
printf '{"actions":[{"op":"changelog_insert","file":"updatesession.changelog","section":"Fixed","bullet":"**First fix.** Felt."}]}\n' > "$CL/AIDOCS/tools/staging/updatesession.json"
node "$CLENG" commit --skill updatesession >/dev/null 2>&1; RC=$?
[ "$RC" = "0" ] && pass "the first changelog line commits on a fresh file" || fail "fresh-file changelog_insert failed (exit $RC)"
grep -q "^## \[Unreleased\]" "$CL/CHANGELOG.md" && pass "an [Unreleased] block was opened" || fail "no [Unreleased] block"
grep -q "First fix" "$CL/CHANGELOG.md" && pass "the line landed" || fail "the line did not land"
grep -q "no versions yet" "$CL/CHANGELOG.md" && fail "the placeholder line survived" || pass "the placeholder line gave way to the block"
printf '{"actions":[{"op":"changelog_insert","file":"updatesession.changelog","section":"Fixed","bullet":"**Second fix.** Also felt."}]}\n' > "$CL/AIDOCS/tools/staging/updatesession.json"
node "$CLENG" commit --skill updatesession >/dev/null 2>&1
[ "$(grep -c '^## \[Unreleased\]' "$CL/CHANGELOG.md")" = "1" ] && pass "a second line reuses the one [Unreleased] block" || fail "a second [Unreleased] block was opened"
grep "^- " "$CL/CHANGELOG.md" | sed -n '1p' | grep -q "Second fix" && pass "the second line sits on top" || fail "the second line did not land newest-first"

echo "=== T117: the changelog key takes changelog_insert alone, and only from its domain ==="
printf '{"actions":[{"op":"lifo_insert","file":"updatesession.changelog","section":"Added","bullet":"sneaky"}]}\n' > "$CL/AIDOCS/tools/staging/updatesession.json"
node "$CLENG" validate --skill updatesession 2>&1 | grep -q "cannot target the changelog" && pass "lifo_insert on the changelog is refused" || fail "lifo_insert reached the changelog key"
printf '{"actions":[{"op":"changelog_insert","file":"updatesession.session","section":"Added","bullet":"x"}]}\n' > "$CL/AIDOCS/tools/staging/updatesession.json"
node "$CLENG" validate --skill updatesession 2>&1 | grep -q "targets the changelog key" && pass "changelog_insert off the changelog key is refused" || fail "changelog_insert accepted a non-changelog key"
printf '{"actions":[{"op":"changelog_insert","file":"updatesession.changelog","section":"Added","bullet":"x"}]}\n' > "$CL/AIDOCS/tools/staging/updatememory.json"
node "$CLENG" validate --skill updatememory 2>&1 | grep -q "domain firewall" && pass "updatememory cannot write the changelog (firewall)" || fail "the firewall let updatememory at the changelog"
printf '{"actions":[{"op":"changelog_insert","file":"updatesession.changelog","section":"Misc","bullet":"x"}]}\n' > "$CL/AIDOCS/tools/staging/updatesession.json"
node "$CLENG" validate --skill updatesession 2>&1 | grep -q "section must be one of" && pass "a non Keep-a-Changelog section is refused" || fail "an unknown changelog section was accepted"
rm -f "$CL/AIDOCS/tools/staging/updatesession.json" "$CL/AIDOCS/tools/staging/updatememory.json"

echo "=== T118: dictionary_extend adds a dotted files key once and preserves a present one ==="
DE="$BASE/dictext"
DEENG="$(mk_proj "$DE" DictExt)"
# A project laid before the key existed: the key gone, the op not yet journaled.
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));delete j.files["updatesession.changelog"];j.engine.operations_applied=(j.engine.operations_applied||[]).filter(n=>n!=="extend_files_updatesession_changelog");fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$DE/AIDOCS/_index.json"
SRC_DE="$BASE/dictext-src"
mk_src "$SRC_DE" --version 9.9.9 >/dev/null 2>&1
printf '{ "operations": [\n  { "name": "extend_files_updatesession_changelog", "type": "dictionary_extend", "dictionary": "files", "key": "updatesession.changelog", "value": "./CHANGELOG.md" }\n] }\n' > "$SRC_DE/AIDOCS/MANIFEST.json"
mkdir -p "$DE/INSTALL"; cp -r "$SRC_DE" "$DE/INSTALL/engine"
node "$DEENG" upgrade >/dev/null 2>&1
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(j.files["updatesession.changelog"]==="./CHANGELOG.md"?0:1)' "$DE/AIDOCS/_index.json" && pass "the files key was added" || fail "dictionary_extend did not add the key"
reg_get "$DE" engine.operations_applied | grep -q "extend_files_updatesession_changelog" && pass "the op was journaled" || fail "the op was not journaled"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.files["updatesession.changelog"]="./docs/CHANGES.md";j.engine.operations_applied=j.engine.operations_applied.filter(n=>n!=="extend_files_updatesession_changelog");j.engine.version="0.0.1";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$DE/AIDOCS/_index.json"
mkdir -p "$DE/INSTALL"; cp -r "$SRC_DE" "$DE/INSTALL/engine"
node "$DEENG" upgrade >/dev/null 2>&1
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(j.files["updatesession.changelog"]==="./docs/CHANGES.md"?0:1)' "$DE/AIDOCS/_index.json" && pass "a present value is preserved, never overwritten" || fail "dictionary_extend overwrote a project value"

echo "=== T119: the reconciled index carries no pointer to the placeholder profile a project renamed ==="
PP="$BASE/profileptr"
PPENG="$(mk_proj "$PP" ProfilePtr)"
PPRT="$BASE/profileptr-runtime"; mkdir -p "$PPRT"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"./AIDOCS/automemory",path:process.argv[2]};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$PP/AIDOCS/_index.json" "$PPRT"
rm -f "$PP/AIDOCS/automemory/user_name.md"
printf -- '---\nname: user-profile-real\ndescription: real\n---\n\nREAL USER\n' > "$PP/AIDOCS/automemory/user_real.md"
cp "$PP/AIDOCS/automemory/user_real.md" "$PPRT/user_real.md"
printf -- '- [User profile](user_real.md) - the real one.\n' > "$PPRT/MEMORY.md"
grep -v "user_name.md" "$PP/AIDOCS/automemory/MEMORY.md" > "$PP/AIDOCS/automemory/MEMORY.tmp" && printf -- '- [User profile](user_real.md) - the real one.\n' >> "$PP/AIDOCS/automemory/MEMORY.tmp" && mv "$PP/AIDOCS/automemory/MEMORY.tmp" "$PP/AIDOCS/automemory/MEMORY.md"
SRC_PP="$BASE/profileptr-src"
mk_src "$SRC_PP" --version 9.9.9 --empty-manifest >/dev/null 2>&1
mkdir -p "$PP/INSTALL"; cp -r "$SRC_PP" "$PP/INSTALL/engine"
node "$PPENG" upgrade >/dev/null 2>&1
grep -q "user_name.md" "$PPRT/MEMORY.md" && fail "the RUNTIME index points at the placeholder profile the project renamed" || pass "runtime index carries no placeholder-profile pointer"
grep -q "user_name.md" "$PP/AIDOCS/automemory/MEMORY.md" && fail "the SEED index points at the placeholder profile" || pass "seed index carries no placeholder-profile pointer"
grep -q "user_real.md" "$PPRT/MEMORY.md" && pass "the project's own profile pointer survived" || fail "the project's profile pointer was lost"
grep -q "feedback_code_comments.md" "$PPRT/MEMORY.md" && pass "upstream rule pointers still arrive" || fail "upstream pointers did not arrive"
node "$PPENG" doctor 2>&1 | grep -q "rule index points at" && fail "doctor reports a dangling index pointer on the clean reconcile" || pass "doctor reads the reconciled index as clean"
FR="$BASE/freshidx"
FRENG="$(mk_proj "$FR" FreshIdx)"
grep -q "user_name.md" "$FR/AIDOCS/automemory/MEMORY.md" && pass "a fresh project keeps its placeholder-profile pointer (the file is there)" || fail "a fresh project lost its placeholder-profile pointer"

echo "=== T120: doctor reports a rule-index pointer to a missing file ==="
printf -- '- [Ghost](feedback_ghost_rule.md) - points at nothing.\n' >> "$FR/AIDOCS/automemory/MEMORY.md"
node "$FRENG" doctor 2>&1 | grep -q 'seed rule index points at "feedback_ghost_rule.md"' && pass "a dangling seed index pointer is reported" || fail "a dangling seed index pointer went undetected"
