# 09-state-automemory.sh - the 0.1.18 findings absorbed from the downstream fleet.
#
#   T99-T101  Current State OVERWRITES. The old engine demoted the outgoing snapshot into
#             LIFO under a **Last State:** marker, which turned overwritten state into
#             permanent history and made SESSION assert a dead stack forever.
#   T102-T105 Auto-memory reaches the RUNTIME, not just the seed. The copy step resolves
#             against the project root, so on its own it would refresh the repo and leave
#             the rules the model actually loads untouched. Project-owned files (the rule
#             index, the user profile) survive, project-authored rules survive.
#   T106      The dispatch description drifts from its skill body with no detector.
#
# Sourced after 08.

echo "=== T99: overwrite_section on Current State DISCARDS the prior snapshot (no demotion) ==="
CS="$BASE/curstate"
CSENG="$(mk_proj "$CS" CurState)"
# Lay a Current State with bullets, then overwrite it. The old engine demoted these into LIFO.
printf '# CurState - SESSION\n\n**Purpose:** t.\n\n## Current State\n\n- Stack: OldFramework 1.0\n- Branch: main\n\n---\n\n## LIFO\n\n- an existing real event\n' > "$CS/AIDOCS/CurState_SESSION.md"
printf '{"actions":[{"op":"overwrite_section","file":"updatesession.session","section":"Current State","body":"- Stack: NewFramework 2.0\\n- Branch: main"}]}\n' > "$CS/AIDOCS/tools/staging/updatesession.json"
node "$CSENG" commit --skill updatesession >/dev/null 2>&1
grep -q "NewFramework 2.0" "$CS/AIDOCS/CurState_SESSION.md" && pass "the new Current State landed" || fail "Current State was not overwritten"
grep -q "OldFramework 1.0" "$CS/AIDOCS/CurState_SESSION.md" && fail "THE DRIFT GENERATOR IS BACK: the outgoing snapshot survived into the file" || pass "the outgoing snapshot was DISCARDED, not demoted into LIFO"
grep -q "Last State:" "$CS/AIDOCS/CurState_SESSION.md" && fail "the **Last State:** marker was written" || pass "no **Last State:** marker anywhere"

echo "=== T100: a real LIFO event is untouched by a Current State overwrite ==="
grep -q "an existing real event" "$CS/AIDOCS/CurState_SESSION.md" && pass "existing LIFO history preserved" || fail "the Current State overwrite ate the LIFO"

echo "=== T101: first overwrite over the placeholder still works (no prior bullets) ==="
CS2="$BASE/curstate2"
CS2ENG="$(mk_proj "$CS2" CurState2)"
printf '{"actions":[{"op":"overwrite_section","file":"updatesession.session","section":"Current State","body":"- Stack: Fresh"}]}\n' > "$CS2/AIDOCS/tools/staging/updatesession.json"
node "$CS2ENG" commit --skill updatesession >/dev/null 2>&1
grep -q "Stack: Fresh" "$CS2/AIDOCS/CurState2_SESSION.md" && pass "placeholder Current State overwrites cleanly" || fail "first overwrite failed"

echo "=== T102: upgrade mirrors upstream rules into the EXTERNAL runtime, not just the seed ==="
AM="$BASE/automem"
AMENG="$(mk_proj "$AM" AutoMem)"
AMRT="$BASE/automem-runtime"          # stands in for ~/.claude/projects/<slug>/memory
mkdir -p "$AMRT"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"./AIDOCS/automemory",path:process.argv[2]};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$AM/AIDOCS/_index.json" "$AMRT"
# The project is running a STALE copy of a shared rule, in both homes.
printf -- '---\nname: feedback-code-comments\ndescription: stale\n---\n\nSTALE RULE BODY\n' > "$AM/AIDOCS/automemory/feedback_code_comments.md"
printf -- '---\nname: feedback-code-comments\ndescription: stale\n---\n\nSTALE RULE BODY\n' > "$AMRT/feedback_code_comments.md"
# A rule the project authored itself. Upstream has never heard of it.
printf -- '---\nname: reference-project-thing\ndescription: ours\n---\n\nPROJECT OWN RULE\n' > "$AMRT/reference_project_thing.md"
# The project's rule index points at its own rule alongside the shared ones.
printf -- '- [Code comments](feedback_code_comments.md) - stale hook.\n- [Project thing](reference_project_thing.md) - ours, upstream does not ship it.\n' > "$AMRT/MEMORY.md"
# The project renamed the seed's placeholder profile to its own, which is what a real
# project does at setup. Upgrade must not resurrect the placeholder alongside it.
rm -f "$AM/AIDOCS/automemory/user_name.md"
printf -- '---\nname: user-profile-real\ndescription: real\n---\n\nREAL USER\n' > "$AM/AIDOCS/automemory/user_real.md"

SRC_AM="$BASE/automem-src"
mk_src "$SRC_AM" --version 9.9.9 --empty-manifest >/dev/null 2>&1
mkdir -p "$AM/INSTALL"; cp -r "$SRC_AM" "$AM/INSTALL/engine"
node "$AMENG" upgrade >/dev/null 2>&1

grep -q "STALE RULE BODY" "$AM/AIDOCS/automemory/feedback_code_comments.md" && fail "the seed kept the stale rule" || pass "seed rule refreshed from upstream"
grep -q "STALE RULE BODY" "$AMRT/feedback_code_comments.md" && fail "THE RUNTIME KEPT THE STALE RULE - the fix landed in the repo and changed nothing the AI reads" || pass "RUNTIME rule refreshed from upstream (the whole point)"

echo "=== T103: a project-authored rule survives the force-copy (no upstream counterpart) ==="
grep -q "PROJECT OWN RULE" "$AMRT/reference_project_thing.md" && pass "project-authored rule survived" || fail "the force-copy deleted a project-authored rule"

echo "=== T104: project-owned files are NOT overwritten (rule index, user profile) ==="
grep -q "reference_project_thing.md" "$AMRT/MEMORY.md" && pass "the rule index kept the project's own pointer" || fail "the index overwrite deleted the project's pointer to its own rule"
grep -q "feedback_case_convention.md" "$AMRT/MEMORY.md" && pass "the rule index gained the new upstream rule" || fail "index reconcile did not add the new upstream rule"
grep -q "stale hook" "$AMRT/MEMORY.md" && fail "the index kept the stale upstream hook text" || pass "upstream hook text refreshed in the index"
grep -q "REAL USER" "$AM/AIDOCS/automemory/user_real.md" && pass "the project's user profile survived" || fail "the user profile was clobbered"
[ ! -f "$AM/AIDOCS/automemory/user_name.md" ] && pass "the placeholder user profile was NOT injected" || fail "upgrade injected the seed's placeholder user_name.md"

echo "=== T105: the copy report names project-owned skips apart from customizations[] ==="
# upgrade removes INSTALL/ when it finishes, so re-lay the source for a second (dry) run.
mkdir -p "$AM/INSTALL"; cp -r "$SRC_AM" "$AM/INSTALL/engine"
node "$AMENG" upgrade --dry-run 2>&1 | grep -q "project-owned" && pass "project-owned skips are labelled as such, not as customizations[]" || fail "project-owned skip mislabelled in the copy report"

echo "=== T106: a dispatch description that drifts from its skill body is reported ==="
DD="$BASE/dispdrift"
DDENG="$(mk_proj "$DD" DispDrift)"
node "$DDENG" doctor 2>&1 | grep -q "has drifted from its skill body" && fail "a fresh project already reports description drift" || pass "a freshly synced project reports no description drift"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.skills.dispatch.devaudit.description="a stale description nobody updated";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$DD/AIDOCS/_index.json"
node "$DDENG" doctor 2>&1 | grep -q 'dispatch "devaudit" description has drifted' && pass "registry description drift is caught" || fail "description drift went undetected"
node "$DDENG" sync >/dev/null 2>&1
node "$DDENG" doctor 2>&1 | grep -q "has drifted from its skill body" && fail "sync did not repair the drift" || pass "sync repairs the drift and doctor goes quiet"

echo "=== T107: a project rule whose basename NOW EXISTS upstream is overwritten, and SAID SO ==="
# The honest edge of force-copy, and the one T103 does not reach: "survives by absence" only
# holds while upstream has no file of that name. When upstream ships one, upstream wins (the
# chosen model), but the run must NAME what it replaced so the user can reach for the
# snapshot. A silent clobber is the unacceptable version.
CO="$BASE/collide"
COENG="$(mk_proj "$CO" Collide)"
CORT="$BASE/collide-runtime"; mkdir -p "$CORT"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"./AIDOCS/automemory",path:process.argv[2]};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$CO/AIDOCS/_index.json" "$CORT"
# The project invented its OWN rule under a name upstream is about to ship.
printf -- '---\nname: feedback-case-convention\ndescription: ours\n---\n\nHOMEGROWN CASE RULE\n' > "$CO/AIDOCS/automemory/feedback_case_convention.md"
printf -- '---\nname: feedback-case-convention\ndescription: ours\n---\n\nHOMEGROWN CASE RULE\n' > "$CORT/feedback_case_convention.md"
SRC_CO="$BASE/collide-src"
mk_src "$SRC_CO" --version 9.9.9 --empty-manifest >/dev/null 2>&1
mkdir -p "$CO/INSTALL"; cp -r "$SRC_CO" "$CO/INSTALL/engine"
COOUT="$(node "$COENG" upgrade 2>&1)"
grep -q "HOMEGROWN CASE RULE" "$CORT/feedback_case_convention.md" && fail "upstream did NOT win the basename collision (force-copy is not in effect)" || pass "upstream wins the basename collision (the chosen model)"
echo "$COOUT" | grep -q "upstream replaced feedback_case_convention.md" && pass "the run NAMED the replaced rule (not a silent clobber)" || fail "a project rule was overwritten SILENTLY - the user has no idea to reach for the snapshot"
[ -f "$CO/TEMP/engine-backup-pre-upgrade/AIDOCS/automemory/feedback_case_convention.md" ] && pass "the prior body is recoverable from the pre-upgrade snapshot" || fail "no recovery net for the overwritten rule"

echo "=== T108: a relative auto_memory.path is REFUSED, never resolved against cwd ==="
# A stale or hand-edited relative value would otherwise write a project's memory into
# whatever directory the engine was launched from, which under --root is another repo.
RP="$BASE/relpath"
RPENG="$(mk_proj "$RP" RelPath)"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"./AIDOCS/automemory",path:".claude-memory"};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$RP/AIDOCS/_index.json"
SRC_RP="$BASE/relpath-src"
mk_src "$SRC_RP" --version 9.9.9 --empty-manifest >/dev/null 2>&1
mkdir -p "$RP/INSTALL"; cp -r "$SRC_RP" "$RP/INSTALL/engine"
RPOUT="$(cd "$BASE" && node "$RPENG" upgrade --root "$RP" 2>&1)"
echo "$RPOUT" | grep -q "refusing to guess" && pass "a relative auto_memory.path is refused with a warning" || fail "a relative auto_memory.path was silently resolved"
[ ! -d "$BASE/.claude-memory" ] && pass "nothing was written into the caller's cwd" || fail "the runtime mirror wrote into the CALLER's directory, not the project's"

echo "=== T109: Big-6 stamp requires ALL FOUR code-bound sections, not any one ==="
# Stamping on one section would let a lean gap-fill of a single empty section certify three
# populated (and possibly stale) ones as current - the exact blind spot the check exists for.
B6="$BASE/bigsix"
B6ENG="$(mk_proj "$B6" BigSix)"
printf '{"name":"bigsix","dependencies":{"left-pad":"1.0.0"}}\n' > "$B6/package.json"
printf '{"actions":[{"op":"overwrite_section","file":"updatememory.memory","section":"Stack","body":"- just one section"}]}\n' > "$B6/AIDOCS/tools/staging/updatememory.json"
node "$B6ENG" commit --skill updatememory >/dev/null 2>&1
grep -q "bigsix" "$B6/AIDOCS/tools/state.json" && fail "a ONE-section write stamped the whole Big-6 as current" || pass "a partial Big-6 write does not stamp the mark"
printf '{"actions":[{"op":"overwrite_section","file":"updatememory.memory","section":"Stack","body":"- s"},{"op":"overwrite_section","file":"updatememory.memory","section":"Architecture","body":"- a"},{"op":"overwrite_section","file":"updatememory.memory","section":"Environment","body":"- e"},{"op":"overwrite_section","file":"updatememory.memory","section":"Pipeline","body":"- p"}]}\n' > "$B6/AIDOCS/tools/staging/updatememory.json"
node "$B6ENG" commit --skill updatememory >/dev/null 2>&1
grep -q "bigsix" "$B6/AIDOCS/tools/state.json" && pass "a full four-section re-derivation stamps the mark" || fail "a complete Big-6 write did not stamp"
node "$B6ENG" doctor 2>&1 | grep -A1 "Big-6 drift" | grep -q "ok" && pass "the fresh mark clears the drift warning" || fail "drift still warns right after a full derivation"
# A version bump must be SILENT. An added package must be LOUD.
printf '{"name":"bigsix","dependencies":{"left-pad":"9.9.9"}}\n' > "$B6/package.json"
node "$B6ENG" doctor 2>&1 | grep -A1 "Big-6 drift" | grep -q "ok" && pass "a version bump does NOT trip drift (names only)" || fail "a version bump falsely tripped Big-6 drift"
printf '{"name":"bigsix","dependencies":{"left-pad":"9.9.9","react":"19.0.0"}}\n' > "$B6/package.json"
node "$B6ENG" doctor 2>&1 | grep -q "added: react" && pass "an added package trips drift" || fail "an added package did not trip drift"

echo "=== T110: sync-backlog is inert when unset, refuses garbage, never invents a target ==="
BK="$BASE/backlog"
BKENG="$(mk_proj "$BK" Backlog)"
node "$BKENG" sync-backlog 2>&1 | grep -q "mirror is off" && pass "unset backlog_issue is a clean no-op" || fail "sync-backlog was not inert when unset"
for BAD in '"5"' 'true' '-3' '[5]' '0'; do
  node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.integrations={backlog_issue:JSON.parse(process.argv[2])};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$BK/AIDOCS/_index.json" "$BAD"
  OUTB="$(node "$BKENG" sync-backlog 2>&1)"
  echo "$OUTB" | grep -qE "must be a positive integer|mirror is off" || fail "sync-backlog accepted a malformed target ($BAD) and may have reached gh"
done
pass "malformed backlog_issue values are refused, gh is never invoked"
