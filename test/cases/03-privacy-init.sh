# 03-privacy-init.sh - privacy modes and the .gitignore tiers they generate (public gates
# AIDOCS/automemory and pruned *_ARCHIVE.md, private tracks them, full is the template
# repo exemption), runtime privacy flips with custom-ignore preservation, drift detection
# (public-without-gate is a leak error, private-with-gate is a drift warning), the init
# --force data-loss guard, --name validation across the migrate commands, fetch-engine
# recreating INSTALL/ post-graduation, the auto-prune machinery (main-triggered + the
# paired extended-triggered drop sharing a timestamp), the external-memory seed + the
# migrate-archive snapshot + the automemory_add seed-present-external-missing path,
# legacy auto_memory.source schema, and validName's leading-digit / leading-separator
# acceptance bands. Every test spins its own isolated project under $BASE.

echo "=== T14: init --privacy generates a tier-aware .gitignore (public gates, private tracks) ==="
PUB="$BASE/pub"; PRIV="$BASE/priv"
node "$RENG" init "$PUB"  --name PubProj  --privacy public  >/dev/null 2>&1
node "$RENG" init "$PRIV" --name PrivProj --privacy private >/dev/null 2>&1
grep -q '"privacy": "public"' "$PUB/AIDOCS/_index.json" && pass "public install records privacy public" || fail "public privacy not recorded"
grep -q 'Privacy gate (public) - BEGIN' "$PUB/.gitignore" && pass "public .gitignore carries the gate" || fail "public .gitignore missing the gate"
grep -q 'AIDOCS/automemory/\*' "$PUB/.gitignore" && pass "public gates auto-memory" || fail "public does not gate auto-memory"
grep -q 'AIDOCS/\*_ARCHIVE\.md' "$PUB/.gitignore" && pass "public gates pruned <doc>_ARCHIVE.md" || fail "public does not gate the pruned archive files"
[ -f "$PUB/AIDOCS/automemory/.gitkeep" ] && pass "public lays automemory/.gitkeep skeleton" || fail "no automemory/.gitkeep on public"
grep -q '"privacy": "private"' "$PRIV/AIDOCS/_index.json" && pass "private install records privacy private" || fail "private privacy not recorded"
grep -q 'Privacy gate (public) - BEGIN' "$PRIV/.gitignore" && fail "private .gitignore wrongly carries the gate" || pass "private .gitignore has no gate"
grep -qE '^TEMP/$' "$PRIV/.gitignore" && pass "private still ignores TEMP (Tier C)" || fail "private dropped the Tier C TEMP ignore"
grep -qE '/WDDOCS/RELEASES/\*' "$PRIV/.gitignore" && pass "private keeps RELEASES always-local" || fail "private dropped the always-local RELEASES ignore"

echo "=== T14b: init with no --privacy defaults to private ==="
DEF="$BASE/def"
node "$RENG" init "$DEF" --name DefProj >/dev/null 2>&1
grep -q '"privacy": "private"' "$DEF/AIDOCS/_index.json" && pass "no-flag install defaults private" || fail "default privacy is not private"

echo "=== T15: privacy --set flips the gate, preserves custom ignores, updates the registry ==="
printf '\nCUSTOM_USER_IGNORE/\n' >> "$PRIV/.gitignore"
node "$PRIV/AIDOCS/tools/engine.mjs" privacy --set public >/dev/null 2>&1
grep -q 'Privacy gate (public) - BEGIN' "$PRIV/.gitignore" && pass "privacy --set public adds the gate" || fail "set public did not add the gate"
grep -q '"privacy": "public"' "$PRIV/AIDOCS/_index.json" && pass "set public updates the registry" || fail "set public did not update the registry"
node "$PRIV/AIDOCS/tools/engine.mjs" privacy --set private >/dev/null 2>&1
grep -q 'Privacy gate (public) - BEGIN' "$PRIV/.gitignore" && fail "set private left the gate behind" || pass "privacy --set private removes the gate"
grep -q 'CUSTOM_USER_IGNORE' "$PRIV/.gitignore" && pass "custom ignore survived the flip" || fail "custom ignore lost on flip"

echo "=== T16: public-without-gate is a leak ERROR; private-with-gate is a drift warning ==="
DRIFT="$BASE/drift"
node "$RENG" init "$DRIFT" --name DriftProj --privacy private >/dev/null 2>&1
# leak: registry says public but the .gitignore has no gate, so Tier B would track
node -e 'const f=process.argv[1],fs=require("fs"),j=JSON.parse(fs.readFileSync(f));j.privacy="public";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$DRIFT/AIDOCS/_index.json"
DR="$(node "$DRIFT/AIDOCS/tools/engine.mjs" doctor 2>&1)"; DRC=$?
echo "$DR" | grep -qi "no public gate" && pass "doctor flags public-without-gate" || fail "doctor missed the public leak"
[ "$DRC" = "20" ] && pass "public-without-gate is an ERROR (leak fails doctor)" || fail "public leak did not fail doctor (exit $DRC)"
# drift: registry says private but a public gate lingers, so it over-gates (no leak)
node "$RENG" init "$BASE/drift2" --name Drift2 --privacy public >/dev/null 2>&1
node -e 'const f=process.argv[1],fs=require("fs"),j=JSON.parse(fs.readFileSync(f));j.privacy="private";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$BASE/drift2/AIDOCS/_index.json"
D2="$(node "$BASE/drift2/AIDOCS/tools/engine.mjs" doctor 2>&1)"; D2C=$?
echo "$D2" | grep -qi "still carries the public gate" && pass "doctor warns on private-with-gate drift" || fail "doctor missed the private drift"
[ "$D2C" = "0" ] && pass "private-with-gate drift is a warning, doctor still passes" || fail "private drift wrongly failed doctor (exit $D2C)"

echo "=== T17: a 'full' project (the template repo) is exempt from the drift check and refuses --set ==="
FULLP="$BASE/fullp"
node "$RENG" init "$FULLP" --name FullProj --privacy private >/dev/null 2>&1
node -e 'const f=process.argv[1],fs=require("fs"),j=JSON.parse(fs.readFileSync(f));j.privacy="full";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$FULLP/AIDOCS/_index.json"
node "$FULLP/AIDOCS/tools/engine.mjs" doctor 2>&1 | grep -A1 "Privacy gate" | grep -q "ok" && pass "full project: Privacy gate ok (exempt)" || fail "full project flagged by the privacy check"
node "$FULLP/AIDOCS/tools/engine.mjs" privacy --set public >/dev/null 2>&1 && fail "privacy --set wrongly flipped a full project" || pass "privacy --set refused on a full project"
grep -q '"privacy": "full"' "$FULLP/AIDOCS/_index.json" && pass "full registry unchanged after the refusal" || fail "full registry was modified"

echo "=== T18: init --force is refused on an existing 321 project (data-loss guard), allowed on fresh ==="
FRC="$BASE/forced"
node "$RENG" init "$FRC" --name ForcedProj >/dev/null 2>&1            # fresh -> becomes a 321 project
FOUT="$(node "$RENG" init "$FRC" --name ForcedProj --force 2>&1)"; FCODE=$?
[ "$FCODE" != "0" ] && pass "init --force refused on existing-321 (exit $FCODE)" || fail "init --force wrongly accepted on existing-321"
echo "$FOUT" | grep -qi "data-loss path" && pass "refusal explains the data-loss reason" || fail "refusal message unclear"
FRF="$BASE/forcefresh"; mkdir -p "$FRF"
node "$RENG" init "$FRF" --name FreshForce --force >/dev/null 2>&1 && pass "init --force still accepted on a fresh target" || fail "init --force wrongly refused on a fresh target"

echo "=== T20: --name validation rejects path-bearing names (migrate-archive / restore / verdict) ==="
NV="$BASE/namevalid"
node "$RENG" init "$NV" --name NameValid >/dev/null 2>&1
NVENG="$NV/AIDOCS/tools/engine.mjs"
node "$NVENG" migrate-archive --name "../evil" >/dev/null 2>&1; RC=$?; [ "$RC" = "5" ] && pass "migrate-archive rejects ../evil (exit 5)" || fail "migrate-archive accepted a path-bearing name (exit $RC)"
node "$NVENG" migrate-restore --name "a/b" >/dev/null 2>&1; RC=$?; [ "$RC" != "0" ] && pass "migrate-restore rejects a/b (exit $RC)" || fail "migrate-restore accepted a/b"
printf '[]' > "$NV/TEMP/v.json"; node "$NVENG" verdict --apply "$NV/TEMP/v.json" --name "x;y" >/dev/null 2>&1; RC=$?; [ "$RC" != "0" ] && pass "verdict --apply rejects x;y (exit $RC)" || fail "verdict --apply accepted x;y"

echo "=== T21: fetch-engine recreates INSTALL/ after a graduation-style removal ==="
FE21="$BASE/fetchgrad"
node "$RENG" init "$FE21" --name FetchGrad >/dev/null 2>&1
rm -rf "$FE21/INSTALL"
mkdir -p "$BASE/fesrc"; printf 'x' > "$BASE/fesrc/marker.txt"
node "$FE21/AIDOCS/tools/engine.mjs" fetch-engine --from "$BASE/fesrc" >/dev/null 2>&1
[ -d "$FE21/INSTALL/engine" ] && pass "fetch-engine recreated INSTALL/engine (post-graduation -UpdateSync)" || fail "fetch-engine did not recreate INSTALL/"

echo "=== T22: auto-prune creates <doc>_ARCHIVE/ folder with a datestamped file on demand ==="
PR="$BASE/prunetest"
node "$RENG" init "$PR" --name PruneTest >/dev/null 2>&1
PRENG="$PR/AIDOCS/tools/engine.mjs"
# Over-cap MEMORY.md (updatememory.memory cap is 150): a ## LIFO of 160 plain bullets.
{ printf '# PruneTest - MEMORY\n\n**Purpose:** prune test.\n\n## LIFO\n\n'; for n in $(seq 1 160); do printf -- '- legacy bullet %s\n' "$n"; done; } > "$PR/AIDOCS/PruneTest_MEMORY.md"
printf '{"actions":[{"op":"lifo_insert","file":"updatememory.memory","section":"LIFO","bullet":"a fresh protected bullet"}]}\n' > "$PR/AIDOCS/tools/staging/updatememory.json"
rm -rf "$PR/AIDOCS/PruneTest_MEMORY_ARCHIVE"
PCOUT="$(node "$PRENG" commit --skill updatememory 2>&1)"; PCC=$?
[ "$PCC" = "0" ] && pass "commit+auto-prune exits 0 with no pre-seeded archive folder" || fail "commit/prune failed (exit $PCC): $PCOUT"
[ -d "$PR/AIDOCS/PruneTest_MEMORY_ARCHIVE" ] && pass "auto-prune created PruneTest_MEMORY_ARCHIVE/ folder on demand" || fail "prune did NOT create the archive folder"
ARCH_FILE=$(ls "$PR/AIDOCS/PruneTest_MEMORY_ARCHIVE/" 2>/dev/null | grep -E '^[0-9]{8}-[0-9]{4}_PruneTest_MEMORY\.md$' | head -1)
[ -n "$ARCH_FILE" ] && pass "datestamped archive file landed (YYYYMMDD-HHMM_<doc>.md)" || fail "no YYYYMMDD-HHMM datestamped archive file found"
[ -n "$ARCH_FILE" ] && grep -q 'legacy bullet' "$PR/AIDOCS/PruneTest_MEMORY_ARCHIVE/$ARCH_FILE" 2>/dev/null && pass "pruned bullets archived (recovery net intact)" || fail "no pruned content in archive"
grep -q 'a fresh protected bullet' "$PR/AIDOCS/PruneTest_MEMORY.md" && pass "fresh bullet protected from prune" || fail "fresh bullet was wrongly pruned"

echo "=== T26: init seeds Claude's external memory from the seed and records auto_memory.path ==="
SE="$BASE/seedext"
node "$RENG" init "$SE" --name SeedExt >/dev/null 2>&1
grep -q '"seed": "./AIDOCS/automemory"' "$SE/AIDOCS/_index.json" && pass "auto_memory.seed recorded (the shippable seed)" || fail "auto_memory.seed missing"
grep -qE '"path": ".+"' "$SE/AIDOCS/_index.json" && pass "auto_memory.path recorded (the external home)" || fail "auto_memory.path empty or missing"
[ -f "$SE/AIDOCS/automemory/feedback_code_comments.md" ] && pass "in-project seed kept (rides in the repo)" || fail "in-project seed missing"
SEDIR="$(ls -d "$BASE"/home/.claude/projects/*seedext*/memory 2>/dev/null | head -1)"
[ -n "$SEDIR" ] && [ -f "$SEDIR/feedback_code_comments.md" ] && pass "canonical rules seeded into Claude's external memory" || fail "external memory not seeded"
[ -f "$SEDIR/MEMORY.md" ] && pass "external memory index (MEMORY.md) seeded" || fail "external MEMORY.md not seeded"

echo "=== T27: migrate-archive snapshots the external memory (source of truth) into SETUP_ARCHIVE ==="
ME="$BASE/memext"
node "$RENG" init "$ME" --name MemExt >/dev/null 2>&1
MEDIR="$(ls -d "$BASE"/home/.claude/projects/*memext*/memory 2>/dev/null | head -1)"
printf 'a project-only external rule\n' > "$MEDIR/feedback_project_custom.md"
node "$ME/AIDOCS/tools/engine.mjs" migrate-archive --name MemExt >/dev/null 2>&1
SNAP="$ME/AIDOCS/MemExt_SETUP_ARCHIVE/external-automemory"
[ -f "$SNAP/feedback_project_custom.md" ] && pass "external custom rule snapshotted into the archive" || fail "external memory not snapshotted"
[ -f "$MEDIR/feedback_project_custom.md" ] && pass "external memory left in place (copy, not move - live global state)" || fail "external memory was moved/deleted"

echo "=== T28: legacy auto_memory.source still passes doctor (the seed rename is non-breaking) ==="
LG="$BASE/legacyam"
node "$RENG" init "$LG" --name LegacyAm >/dev/null 2>&1
# rewrite the registry to the pre-rebuild schema: auto_memory.source, no seed/path
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.auto_memory={source:"./AIDOCS/automemory"};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$LG/AIDOCS/_index.json"
node "$LG/AIDOCS/tools/engine.mjs" doctor >/dev/null 2>&1 && pass "doctor passes on legacy auto_memory.source" || fail "doctor failed on legacy source schema"
node "$LG/AIDOCS/tools/engine.mjs" doctor 2>&1 | grep -A1 "Auto-memory pointers" | grep -q "ok" && pass "auto-memory mirror check stays active on legacy source (fallback honored)" || fail "auto-memory check went inert on legacy source"

echo "=== T29: extended-triggered prune drops a paired bullet+sub-section, both files archived under one timestamp ==="
EP="$BASE/extprune"
node "$RENG" init "$EP" --name ExtPrune >/dev/null 2>&1
EPENG="$EP/AIDOCS/tools/engine.mjs"
# Main has 5 paired [+] bullets, well under the 150 cap. Extended carries 5 ### sub-sections
# at 250 lines each (1250+ total), over the 1200 cap. Extended triggers, paired drop fires.
{ printf '# ExtPrune - MEMORY\n\n**Purpose:** ext prune test.\n\n## Overview\n(fill in)\n## Stack\n(fill in)\n## Architecture\n(fill in)\n## Environment\n(fill in)\n## Pipeline\n(fill in)\n## Conventions\n(fill in)\n\n---\n\n## LIFO\n\n'; for n in $(seq 1 5); do printf -- '- [+] Entry %s body\n' "$n"; done; } > "$EP/AIDOCS/ExtPrune_MEMORY.md"
{ printf '# ExtPrune - MEMORY (Extended)\n\n**Purpose:** ext.\n\n## LIFO\n\n'; for n in $(seq 1 5); do printf -- '### Entry %s body\n' "$n"; for m in $(seq 1 250); do printf -- 'filler line %s\n' "$m"; done; done; } > "$EP/AIDOCS/ExtPrune_MEMORY_EXTENDED.md"
printf '{"actions":[{"op":"lifo_insert","file":"updatememory.memory","section":"LIFO","bullet":"fresh head"}]}\n' > "$EP/AIDOCS/tools/staging/updatememory.json"
rm -rf "$EP/AIDOCS/ExtPrune_MEMORY_ARCHIVE"
EPCOUT="$(node "$EPENG" commit --skill updatememory 2>&1)"; EPCC=$?
[ "$EPCC" = "0" ] && pass "commit+extended-triggered prune exits 0" || fail "extended-triggered prune failed (exit $EPCC): $EPCOUT"
[ -d "$EP/AIDOCS/ExtPrune_MEMORY_ARCHIVE" ] && pass "extended-triggered prune created the archive folder" || fail "extended-triggered prune did not create the folder"
PAIR_MAIN=$(ls "$EP/AIDOCS/ExtPrune_MEMORY_ARCHIVE/" 2>/dev/null | grep -E '^[0-9]{8}-[0-9]{4}_ExtPrune_MEMORY\.md$' | head -1)
PAIR_EXT=$(ls "$EP/AIDOCS/ExtPrune_MEMORY_ARCHIVE/" 2>/dev/null | grep -E '^[0-9]{8}-[0-9]{4}_ExtPrune_MEMORY_EXTENDED\.md$' | head -1)
[ -n "$PAIR_MAIN" ] && [ -n "$PAIR_EXT" ] && pass "both bullets file and sub-sections file archived as a pair" || fail "paired archive files missing (main=$PAIR_MAIN ext=$PAIR_EXT)"
MAIN_STAMP="${PAIR_MAIN%_ExtPrune_MEMORY.md}"
EXT_STAMP="${PAIR_EXT%_ExtPrune_MEMORY_EXTENDED.md}"
[ "$MAIN_STAMP" = "$EXT_STAMP" ] && [ -n "$MAIN_STAMP" ] && pass "paired files share the same timestamp ($MAIN_STAMP)" || fail "timestamp drift between paired files (main=$MAIN_STAMP ext=$EXT_STAMP)"

echo "=== T45: automemory_add writes external runtime when seed exists but external is missing ==="
AM="$BASE/automemextonly"
node "$RENG" init "$AM" --name AmProj >/dev/null 2>&1
AMENG="$AM/AIDOCS/tools/engine.mjs"
# Build a source that ships a new seed file.
AMSRC="$BASE/automemextonly-src"
mkdir -p "$AMSRC/AIDOCS/automemory" "$AMSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$AMSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$AMSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$AMSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$AMSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$AMSRC/.claude/skills/321/SKILL.md"
printf -- '---\nname: feedback-new-rule\ndescription: A brand-new canonical rule for the test.\nmetadata:\n  type: feedback\n---\n\nbody\n' > "$AMSRC/AIDOCS/automemory/feedback_new_rule.md"
cat > "$AMSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "add_feedback_new_rule", "type": "automemory_add", "file": "feedback_new_rule.md" }
  ]
}
EOF
# Pre-write the in-project seed (simulating a manual add or a prior partial run),
# then delete it from external runtime so only the external is missing.
printf -- '---\nname: feedback-new-rule\ndescription: A brand-new canonical rule for the test.\nmetadata:\n  type: feedback\n---\n\nbody\n' > "$AM/AIDOCS/automemory/feedback_new_rule.md"
AMEXT="$(ls -d "$BASE"/home/.claude/projects/*automemextonly*/memory 2>/dev/null | head -1)"
rm -f "$AMEXT/feedback_new_rule.md"
node "$AMENG" fetch-engine --from "$AMSRC" >/dev/null 2>&1
AMOUT="$(node "$AMENG" upgrade 2>&1)"; AMCC=$?
[ "$AMCC" = "0" ] && pass "automemory_add seed-present + external-missing succeeds" || fail "automemory_add failed (exit $AMCC): $AMOUT"
[ -f "$AMEXT/feedback_new_rule.md" ] && pass "external runtime got the new rule even though seed already existed" || fail "external runtime missing the new rule"
echo "$AMOUT" | grep -q "external runtime" && pass "report names external runtime as written" || fail "no external runtime in report"

echo "=== T51: validName accepts leading digit, rejects leading separator ==="
# Leading digit: 321DONE-web, 9to5
node "$RENG" init "$BASE/n321" --name "321DONE-web" >/dev/null 2>&1 && pass "init accepts name starting with a digit (321DONE-web)" || fail "init rejected name starting with a digit"
node "$RENG" init "$BASE/n9to5" --name "9to5" >/dev/null 2>&1 && pass "init accepts name 9to5" || fail "init rejected 9to5"
# Leading separator still rejected
NSOUT="$(node "$RENG" init "$BASE/nbad1" --name "_foo" 2>&1)"; NSCC=$?
[ "$NSCC" = "5" ] && echo "$NSOUT" | grep -q "start with a letter or digit" && pass "init rejects name starting with underscore" || fail "init wrongly accepted _foo or wrong error (exit $NSCC)"
NSOUT2="$(node "$RENG" init "$BASE/nbad2" --name "-foo" 2>&1)"; NSCC2=$?
[ "$NSCC2" = "5" ] && pass "init rejects name starting with hyphen" || fail "init wrongly accepted -foo (exit $NSCC2)"
