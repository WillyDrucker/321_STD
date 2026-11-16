# 09-state-automemory.sh - the fleet findings on Current State and auto-memory.
#
#   T99-T101  Current State OVERWRITES. The old engine demoted the outgoing snapshot into
#             LIFO under a **Last State:** marker, which turned overwritten state into
#             permanent history and made SESSION assert a dead stack forever.
#   T102-T105 Auto-memory reaches the RUNTIME, not just the seed. The copy step resolves
#             against the project root, so on its own it would refresh the repo and leave
#             the rules the model actually loads untouched. Project-owned files (the rule
#             index, the user profile) survive, project-authored rules survive.
#   T106      The dispatch description drifts from its skill body with no detector.
#   T122      A project rule written in the runtime is promoted into the tracked seed,
#             pointer included, and a filled profile retires the seed's placeholder.
#   T132-T134 sync-automemory runs the two-way step on demand, a seed outside the root is
#             refused, the placeholder reaches an empty runtime only, and a replaced
#             runtime body is snapshotted.
#   T135      Big-6 drift reads a Cargo subtable as one package, an emptied manifest as
#             drift, and a legacy mark as what it is.
#   T137      A seed at a registry path of its own is refreshed from upstream with the
#             customizations[] opt-out, and a pyproject optional group names its packages.
#   T140      A shipped rule listed in customizations[] keeps the seed's own index line in
#             both homes, as the copy step keeps its body.
#   T142      A dry upgrade reports the auto-memory step the real one makes. It measured
#             against the seed before the copy, so it undercounted every rule the copy refreshes.
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
AMOUT="$(node "$AMENG" upgrade 2>&1)"

grep -q "STALE RULE BODY" "$AM/AIDOCS/automemory/feedback_code_comments.md" && fail "the seed kept the stale rule" || pass "seed rule refreshed from upstream"
grep -q "STALE RULE BODY" "$AMRT/feedback_code_comments.md" && fail "THE RUNTIME KEPT THE STALE RULE - the fix landed in the repo and changed nothing the AI reads" || pass "RUNTIME rule refreshed from upstream (the whole point)"

echo "=== T103: a project-authored rule survives the force-copy (no upstream counterpart) ==="
grep -q "PROJECT OWN RULE" "$AMRT/reference_project_thing.md" && pass "project-authored rule survived" || fail "the force-copy deleted a project-authored rule"

echo "=== T122: a project rule written in the runtime is promoted into the tracked seed, pointer included ==="
grep -q "PROJECT OWN RULE" "$AM/AIDOCS/automemory/reference_project_thing.md" && pass "the runtime-only rule now sits in the seed (versioned, restored on a fresh machine)" || fail "a runtime-only project rule never reached the seed"
grep -q "reference_project_thing.md" "$AM/AIDOCS/automemory/MEMORY.md" && pass "the seed index gained the promoted rule's pointer" || fail "the seed index has no pointer to the promoted rule"
echo "$AMOUT" | grep -q "1 promoted to the seed" && pass "the run reports the promotion" || fail "the promotion was not reported (output: $AMOUT)"
grep -q "REAL USER" "$AMRT/user_real.md" && pass "a seed-only profile is laid into the runtime write-if-missing (the fresh-machine case)" || fail "the seed-only profile did not reach the runtime"
# A filled profile in the runtime retires the seed's placeholder, the one removal the sync makes.
PF="$BASE/profilefill"
PFENG="$(mk_proj "$PF" ProfileFill)"
PFRT="$BASE/profilefill-runtime"; mkdir -p "$PFRT"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"./AIDOCS/automemory",path:process.argv[2]};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$PF/AIDOCS/_index.json" "$PFRT"
printf -- '---\nname: user-profile-real\ndescription: real\n---\n\nFILLED USER\n' > "$PFRT/user_real.md"
printf -- '- [User profile](user_real.md) - filled.\n' > "$PFRT/MEMORY.md"
mkdir -p "$PF/INSTALL"; cp -r "$SRC_AM" "$PF/INSTALL/engine"
PFOUT="$(node "$PFENG" upgrade 2>&1)"
grep -q "FILLED USER" "$PF/AIDOCS/automemory/user_real.md" && pass "the filled profile was promoted into the seed" || fail "the filled profile did not reach the seed"
[ ! -f "$PF/AIDOCS/automemory/user_name.md" ] && pass "the seed's placeholder profile retired" || fail "the seed still carries user_name.md beside the filled profile"
echo "$PFOUT" | grep -q "placeholder retired" && pass "the retirement is reported" || fail "the retirement was silent (output: $PFOUT)"
grep -q "user_name.md" "$PF/AIDOCS/automemory/MEMORY.md" && fail "the seed index still points at the retired placeholder" || pass "the seed index dropped the placeholder pointer"
grep -q "user_real.md" "$PF/AIDOCS/automemory/MEMORY.md" && pass "the seed index points at the filled profile" || fail "the seed index has no pointer to the filled profile"
PFDOC="$(node "$PFENG" doctor 2>&1)"
echo "$PFDOC" | grep -q "^doctor:" || fail "doctor reached no verdict after the promotion (output: $PFDOC)"
echo "$PFDOC" | grep -q "rule index points at" && fail "doctor reports a dangling pointer after the promotion" || pass "doctor reads both indexes clean after the promotion"

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
DDDOC="$(node "$DDENG" doctor 2>&1)"
echo "$DDDOC" | grep -q "^doctor:" || fail "doctor reached no verdict on a fresh project (output: $DDDOC)"
echo "$DDDOC" | grep -q "has drifted from its skill body" && fail "a fresh project already reports description drift" || pass "a freshly synced project reports no description drift"
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
grep -q "HOMEGROWN CASE RULE" "$CO/TEMP/engine-backup-pre-upgrade/AIDOCS/automemory/feedback_case_convention.md" && pass "the prior seed body is recoverable from the pre-upgrade snapshot" || fail "no recovery net for the overwritten seed rule"
grep -q "HOMEGROWN CASE RULE" "$CO/TEMP/engine-backup-pre-upgrade/runtime-automemory/feedback_case_convention.md" && pass "the prior runtime body is in the snapshot too" || fail "the runtime body was replaced with no snapshot"

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
node "$B6ENG" commit --skill updatememory >/dev/null 2>&1; B6C=$?
[ "$B6C" = "0" ] || fail "the one-section commit itself failed (exit $B6C)"
grep -q "bigsix" "$B6/AIDOCS/tools/state.json" && fail "a ONE-section write stamped the whole Big-6 as current" || pass "a partial Big-6 write does not stamp the mark"
printf '{"actions":[{"op":"overwrite_section","file":"updatememory.memory","section":"Stack","body":"- s"},{"op":"overwrite_section","file":"updatememory.memory","section":"Architecture","body":"- a"},{"op":"overwrite_section","file":"updatememory.memory","section":"Environment","body":"- e"},{"op":"overwrite_section","file":"updatememory.memory","section":"Pipeline","body":"- p"}]}\n' > "$B6/AIDOCS/tools/staging/updatememory.json"
node "$B6ENG" commit --skill updatememory >/dev/null 2>&1
grep -q "bigsix" "$B6/AIDOCS/tools/state.json" && pass "a full four-section re-derivation stamps the mark" || fail "a complete Big-6 write did not stamp"
grep -q '"hash"' "$B6/AIDOCS/tools/state.json" && fail "the Big-6 mark records a hash (no recorded fingerprints, anywhere)" || pass "the Big-6 mark is the dependency-name list, no hash"
grep -q '"left-pad"' "$B6/AIDOCS/tools/state.json" && pass "the mark names the dependency it was derived against" || fail "the mark does not carry the dependency names"
node "$B6ENG" doctor 2>&1 | grep -A1 "Big-6 drift" | grep -q "ok" && pass "the fresh mark clears the drift warning" || fail "drift still warns right after a full derivation"
# A version bump must be SILENT. An added package must be LOUD.
printf '{"name":"bigsix","dependencies":{"left-pad":"9.9.9"}}\n' > "$B6/package.json"
node "$B6ENG" doctor 2>&1 | grep -A1 "Big-6 drift" | grep -q "ok" && pass "a version bump does NOT trip drift (names only)" || fail "a version bump falsely tripped Big-6 drift"
printf '{"name":"bigsix","dependencies":{"left-pad":"9.9.9","react":"19.0.0"}}\n' > "$B6/package.json"
node "$B6ENG" doctor 2>&1 | grep -q "added: react" && pass "an added package trips drift" || fail "an added package did not trip drift"
printf '{"name":"bigsix","dependencies":{"react":"19.0.0"}}\n' > "$B6/package.json"
node "$B6ENG" doctor 2>&1 | grep -q "removed: left-pad" && pass "a removed package is named, which a hash could never do" || fail "a removed package was not named"

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

echo "=== T132: sync-automemory runs the two-way step on demand, so a reconcile pass does not wait for an upgrade ==="
printf -- '---\nname: project-newfact\ndescription: ours\n---\n\nNEW PROJECT FACT\n' > "$AMRT/project_newfact.md"
printf -- '- [New fact](project_newfact.md) - ours.\n' >> "$AMRT/MEMORY.md"
node "$AMENG" sync-automemory --dry-run 2>&1 | grep -q "1 promoted to the seed" && pass "the dry run reports the pending promotion" || fail "the dry run did not report the promotion"
[ ! -f "$AM/AIDOCS/automemory/project_newfact.md" ] && pass "the dry run wrote nothing" || fail "the dry run wrote to the seed"
SAOUT="$(node "$AMENG" sync-automemory 2>&1)"; SAE=$?
[ "$SAE" = "0" ] && grep -q "NEW PROJECT FACT" "$AM/AIDOCS/automemory/project_newfact.md" && pass "the runtime rule reached the seed without an upgrade" || fail "sync-automemory did not promote the rule (exit $SAE, output: $SAOUT)"
grep -q "project_newfact.md" "$AM/AIDOCS/automemory/MEMORY.md" && pass "the seed index carries the new pointer" || fail "the seed index has no pointer to the promoted rule"
node "$AMENG" sync-automemory 2>&1 | grep -q "already in step" && pass "a second run is a clean no-op" || fail "the second run was not a no-op"

echo "=== T133: an auto_memory.seed that escapes the project root is refused, since the registry is data ==="
ESC="$BASE/seedescape"
ESCENG="$(mk_proj "$ESC" SeedEscape)"
mkdir -p "$BASE/escape-target"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"../escape-target",path:""};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$ESC/AIDOCS/_index.json"
node "$ESCENG" sync-automemory 2>&1 | grep -q "escapes the project root" && pass "a seed outside the root is refused with its path named" || fail "a seed outside the root was synced"
[ -z "$(ls -A "$BASE/escape-target")" ] && pass "nothing was written outside the root" || fail "files were written outside the project root"

echo "=== T134: the placeholder profile reaches an empty runtime, never one with a profile, and a replaced runtime body is snapshotted ==="
PH="$BASE/placeholder"
PHENG="$(mk_proj "$PH" Placeholder)"
PHRT="$BASE/placeholder-runtime"; mkdir -p "$PHRT"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"./AIDOCS/automemory",path:process.argv[2]};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$PH/AIDOCS/_index.json" "$PHRT"
printf -- '---\nname: feedback-code-comments\ndescription: stale\n---\n\nSTALE RUNTIME BODY\n' > "$PHRT/feedback_code_comments.md"
node "$PHENG" sync-automemory >/dev/null 2>&1
[ -f "$PHRT/user_name.md" ] && pass "an empty runtime receives the placeholder profile (the fresh-runtime case)" || fail "the placeholder never reached an empty runtime"
grep -q "STALE RUNTIME BODY" "$PH/TEMP/engine-backup-pre-upgrade/runtime-automemory/feedback_code_comments.md" && pass "the runtime body upstream replaced is in the pre-upgrade snapshot" || fail "the replaced runtime body was not snapshotted"
grep -q "STALE RUNTIME BODY" "$PHRT/feedback_code_comments.md" && fail "the stale runtime body survived" || pass "the runtime body took upstream's"
rm -f "$PHRT/user_name.md"
printf -- '---\nname: user-filled\ndescription: real\n---\n\nFILLED\n' > "$PHRT/user_filled.md"
node "$PHENG" sync-automemory >/dev/null 2>&1
[ ! -f "$PHRT/user_name.md" ] && pass "a runtime with a filled profile never receives the placeholder" || fail "the placeholder was laid beside a filled profile"

echo "=== T135: a Cargo subtable names one package, an emptied manifest still reads as drift, and a legacy mark says what it is ==="
TM="$BASE/tomlsix"
TMENG="$(mk_proj "$TM" TomlSix)"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.bigsix={dep_manifest:"Cargo.toml"};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$TM/AIDOCS/_index.json"
printf '[package]\nname = "tomlsix"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1"\n' > "$TM/Cargo.toml"
printf '{"actions":[{"op":"overwrite_section","file":"updatememory.memory","section":"Stack","body":"- s"},{"op":"overwrite_section","file":"updatememory.memory","section":"Architecture","body":"- a"},{"op":"overwrite_section","file":"updatememory.memory","section":"Environment","body":"- e"},{"op":"overwrite_section","file":"updatememory.memory","section":"Pipeline","body":"- p"}]}\n' > "$TM/AIDOCS/tools/staging/updatememory.json"
node "$TMENG" commit --skill updatememory >/dev/null 2>&1
printf '[package]\nname = "tomlsix"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1"\n\n[dependencies.tokio]\nversion = "1"\nfeatures = ["full"]\n' > "$TM/Cargo.toml"
TMOUT="$(node "$TMENG" doctor 2>&1)"
echo "$TMOUT" | grep -q "added: tokio" && pass "a dependency subtable names its one package" || fail "the subtable package was not seen (output: $TMOUT)"
echo "$TMOUT" | grep -q "added: .*version\|added: .*features" && fail "the subtable's settings were read as packages" || pass "the subtable's settings are not packages"
printf '[package]\nname = "tomlsix"\nversion = "0.1.0"\n' > "$TM/Cargo.toml"
node "$TMENG" doctor 2>&1 | grep -q "removed: serde" && pass "a manifest emptied of dependencies reads as drift, not as silence" || fail "removing the last dependency went unseen"
node -e 'const fs=require("fs"),f=process.argv[1];const s=JSON.parse(fs.readFileSync(f));s.updatememory.bigsix={hash:"abc",derived_at:"x"};fs.writeFileSync(f,JSON.stringify(s,null,2)+"\n")' "$TM/AIDOCS/tools/state.json"
node "$TMENG" doctor 2>&1 | grep -q "predates the names-only schema" && pass "a mark laid by an older engine is named for what it is, not read as all-added" || fail "a legacy mark was misread"

echo "=== T137: a seed at a registry path of its own is refreshed from upstream with the customizations[] opt-out, and a pyproject optional group names its packages ==="
CSD="$BASE/customseed"
CSDENG="$(mk_proj "$CSD" CustomSeed)"
CSDRT="$BASE/customseed-runtime"; mkdir -p "$CSDRT"
mkdir -p "$CSD/AIDOCS/rules"
printf -- '---\nname: feedback-code-comments\ndescription: stale\n---\n\nSTALE CUSTOM SEED\n' > "$CSD/AIDOCS/rules/feedback_code_comments.md"
printf -- '---\nname: feedback-case-convention\ndescription: mine\n---\n\nKEPT BY CUSTOMIZATION\n' > "$CSD/AIDOCS/rules/feedback_case_convention.md"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"./AIDOCS/rules",path:process.argv[2]};j.customizations=["AIDOCS/rules/feedback_case_convention.md"];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$CSD/AIDOCS/_index.json" "$CSDRT"
SRC_CSD="$BASE/customseed-src"
mk_src "$SRC_CSD" --version 9.9.9 --empty-manifest >/dev/null 2>&1
mkdir -p "$CSD/INSTALL"; cp -r "$SRC_CSD" "$CSD/INSTALL/engine"
CSDOUT="$(node "$CSDENG" upgrade 2>&1)"
grep -q "STALE CUSTOM SEED" "$CSD/AIDOCS/rules/feedback_code_comments.md" && fail "the registry's seed kept the stale rule (only the canonical folder was refreshed)" || pass "the registry's seed took upstream's rule"
echo "$CSDOUT" | grep -q "refreshed in the seed at AIDOCS/rules" && pass "the run names the seed it refreshed" || fail "the custom-seed refresh was silent (output: $CSDOUT)"
grep -q "KEPT BY CUSTOMIZATION" "$CSD/AIDOCS/rules/feedback_case_convention.md" && pass "a seed rule listed in customizations[] is left alone" || fail "the custom-seed refresh ignored customizations[]"
grep -q "STALE CUSTOM SEED" "$CSDRT/feedback_code_comments.md" && fail "the runtime took the stale body" || pass "the runtime took upstream's body through the refreshed seed"
PY="$BASE/pysix"
PYENG="$(mk_proj "$PY" PySix)"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.bigsix={dep_manifest:"pyproject.toml"};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$PY/AIDOCS/_index.json"
printf '[project]\nname = "pysix"\nversion = "0.1.0"\ndependencies = [\n  "requests>=2",\n]\n' > "$PY/pyproject.toml"
printf '{"actions":[{"op":"overwrite_section","file":"updatememory.memory","section":"Stack","body":"- s"},{"op":"overwrite_section","file":"updatememory.memory","section":"Architecture","body":"- a"},{"op":"overwrite_section","file":"updatememory.memory","section":"Environment","body":"- e"},{"op":"overwrite_section","file":"updatememory.memory","section":"Pipeline","body":"- p"}]}\n' > "$PY/AIDOCS/tools/staging/updatememory.json"
node "$PYENG" commit --skill updatememory >/dev/null 2>&1
printf '[project]\nname = "pysix"\nversion = "0.1.0"\ndependencies = [\n  "requests>=2",\n]\n\n[project.optional-dependencies]\ntest = ["pytest", "coverage[toml]"]\n' > "$PY/pyproject.toml"
PYOUT="$(node "$PYENG" doctor 2>&1)"
echo "$PYOUT" | grep -q "added: coverage, pytest" && pass "an optional group names its packages, sorted" || fail "the optional group's packages were not seen (output: $PYOUT)"
echo "$PYOUT" | grep -q "added: .*\btest\b" && fail "the group name was read as a package" || pass "the group name is not a package"

echo "=== T140: a shipped rule listed in customizations[] keeps the seed's own index line in both homes ==="
CH="$BASE/customhook"
CHENG="$(mk_proj "$CH" CustomHook)"
CHRT="$BASE/customhook-runtime"; mkdir -p "$CHRT"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"./AIDOCS/automemory",path:process.argv[2]};j.customizations=["AIDOCS/automemory/feedback_case_convention.md"];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$CH/AIDOCS/_index.json" "$CHRT"
printf -- '---\nname: feedback-case-convention\ndescription: ours\n---\n\nOUR CASE RULE\n' > "$CH/AIDOCS/automemory/feedback_case_convention.md"
cp "$CH/AIDOCS/automemory/feedback_case_convention.md" "$CHRT/feedback_case_convention.md"
sed -i 's#^- \[Case convention\](feedback_case_convention.md) - .*#- [Case convention](feedback_case_convention.md) - OUR HOOK.#' "$CH/AIDOCS/automemory/MEMORY.md"
grep -q "OUR HOOK" "$CH/AIDOCS/automemory/MEMORY.md" || fail "fixture: the seed index did not take the project hook"
cp "$REAL/AIDOCS/automemory/MEMORY.md" "$CHRT/MEMORY.md"
SRC_CH="$BASE/customhook-src"
mk_src "$SRC_CH" --version 9.9.9 --empty-manifest >/dev/null 2>&1
mkdir -p "$CH/INSTALL"; cp -r "$SRC_CH" "$CH/INSTALL/engine"
node "$CHENG" upgrade >/dev/null 2>&1; CHX=$?
[ "$CHX" = "0" ] || fail "upgrade failed (exit $CHX)"
grep -q "OUR CASE RULE" "$CH/AIDOCS/automemory/feedback_case_convention.md" && pass "the customized body survived the copy" || fail "the copy step overwrote a customized rule"
grep -q "OUR HOOK" "$CH/AIDOCS/automemory/MEMORY.md" && pass "the seed index kept the project's own hook line" || fail "the seed index reverted to upstream's hook text"
grep -q "OUR HOOK" "$CHRT/MEMORY.md" && pass "the runtime index took the seed's line for the customized rule" || fail "the runtime index kept upstream's hook text for a customized rule"
[ "$(grep -c "feedback_case_convention.md" "$CHRT/MEMORY.md")" = "1" ] && pass "one line per rule in the runtime index" || fail "the runtime index carries two lines for the customized rule"

echo "=== T142: a dry upgrade reports the auto-memory step the real upgrade makes, and writes nothing ==="
DA="$BASE/dryautomem"
DAENG="$(mk_proj "$DA" DryAutoMem)"
DART="$BASE/dryautomem-runtime"; mkdir -p "$DART"
node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.auto_memory={seed:"./AIDOCS/automemory",path:process.argv[2]};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$DA/AIDOCS/_index.json" "$DART"
# A seed and a runtime both behind upstream: two stale shipped rules the copy refreshes, the
# rest of upstream's rules missing from the runtime, one project rule only the runtime holds.
for r in feedback_code_comments.md feedback_naming.md; do
  printf -- '---\nname: stale\ndescription: stale\n---\n\nSTALE\n' > "$DA/AIDOCS/automemory/$r"
  cp "$DA/AIDOCS/automemory/$r" "$DART/$r"
done
printf -- '---\nname: reference-own\ndescription: ours\n---\n\nOWN\n' > "$DART/reference_own.md"
printf -- '- [Own](reference_own.md) - ours.\n' > "$DART/MEMORY.md"
SRC_DA="$BASE/dryautomem-src"
mk_src "$SRC_DA" --version 9.9.9 --empty-manifest >/dev/null 2>&1
mkdir -p "$DA/INSTALL"; cp -r "$SRC_DA" "$DA/INSTALL/engine"
dahash() { (cd "$1" && find . -type f -exec md5sum {} + | sort); }
DABEFORE="$(dahash "$DA/AIDOCS/automemory"; dahash "$DART")"
DADRY="$(node "$DAENG" upgrade --dry-run 2>&1 | grep 'auto-memory:' | sed 's/ (dry-run)$//')"
DAAFTER="$(dahash "$DA/AIDOCS/automemory"; dahash "$DART")"
[ "$DABEFORE" = "$DAAFTER" ] && pass "the dry run wrote nothing to either home" || fail "the dry run changed a file in the seed or the runtime"
rm -rf "$DA/INSTALL"; mkdir -p "$DA/INSTALL"; cp -r "$SRC_DA" "$DA/INSTALL/engine"
DAREAL="$(node "$DAENG" upgrade 2>&1 | grep 'auto-memory:')"
[ -n "$DAREAL" ] || fail "fixture: the real upgrade reported no auto-memory step"
[ "$DADRY" = "$DAREAL" ] && pass "the dry run's auto-memory report matches the real run's" || fail "dry and real auto-memory reports differ. dry: [$DADRY] real: [$DAREAL]"
echo "$DAREAL" | grep -q "upstream replaced .*feedback_code_comments.md" && pass "the real run names the replaced runtime rules" || fail "the replaced rules were not named (output: $DAREAL)"
