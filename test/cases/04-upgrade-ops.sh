# 04-upgrade-ops.sh - the upgrade command's manifest operation surface, one isolated
# project per operation kind. Covers the apply path (registry_extend, file_add_template,
# registry_rename, skill_rename + skill_delete end-to-end, file_delete), the safety
# perimeter (customizations[] opt-out, --dry-run is read-only, fail-fast on a thrown
# handler, refuses while reconcile_pending is set, all containment guards), the
# manifest-less engine fallback, and idempotency on every re-run. The upgrade FLOW
# tests (cleanup, fetch defaults, router quick-ref, snapshot, recent hardening) live in
# 05-upgrade-flow.sh; this file is operations-only.

echo "=== T31: upgrade applies missing manifest operations (registry_extend, file_add_template), records names, bumps version ==="
UP="$BASE/upgrade"
node "$RENG" init "$UP" --name UpProj >/dev/null 2>&1
UPENG="$UP/AIDOCS/tools/engine.mjs"
# Build a tweaked source: copy the real engine into a sibling dir, write a custom
# MANIFEST.json with two ops, bump engine.version.
UPSRC="$BASE/upgradesrc"
mkdir -p "$UPSRC/AIDOCS" "$UPSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$UPSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$UPSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$UPSRC/AIDOCS/automemory"
cp "$REAL/.claude/skills/321/SKILL.md" "$UPSRC/.claude/skills/321/SKILL.md"
node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1]));j.engine.version="9.9.9";fs.writeFileSync(process.argv[2],JSON.stringify(j,null,2)+"\n")' "$REAL/AIDOCS/_index.json" "$UPSRC/AIDOCS/_index.json"
cat > "$UPSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "extend_test_key", "type": "registry_extend", "path": "sizes.test_key", "value": { "cap": 100, "prune_to": 50 } },
    { "name": "add_template_file", "type": "file_add_template", "file": "AIDOCS/PROJECTNAME_TEST.md", "body": "# PROJECTNAME - TEST\n\n**Purpose:** test template.\n" }
  ]
}
EOF
node "$UPENG" fetch-engine --from "$UPSRC" >/dev/null 2>&1
UCOUT="$(node "$UPENG" upgrade 2>&1)"; UCC=$?
[ "$UCC" = "0" ] && pass "upgrade exits 0" || fail "upgrade failed (exit $UCC): $UCOUT"
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).sizes?.test_key?.cap === 100 ? 0 : 1)' "$UP/AIDOCS/_index.json" && pass "registry_extend op set sizes.test_key" || fail "registry_extend op did not set sizes.test_key"
[ -f "$UP/AIDOCS/UpProj_TEST.md" ] && pass "file_add_template wrote AIDOCS/UpProj_TEST.md" || fail "file_add_template did not write the file"
grep -q 'UpProj - TEST' "$UP/AIDOCS/UpProj_TEST.md" 2>/dev/null && pass "PROJECTNAME substituted to UpProj in template body" || fail "PROJECTNAME not substituted"
node -e 'const a=JSON.parse(require("fs").readFileSync(process.argv[1])).engine.operations_applied;process.exit((a.includes("extend_test_key")&&a.includes("add_template_file"))?0:1)' "$UP/AIDOCS/_index.json" && pass "operations_applied[] records both op names" || fail "operations_applied missing op names"
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.version === "9.9.9" ? 0 : 1)' "$UP/AIDOCS/_index.json" && pass "engine.version bumped to source value (9.9.9)" || fail "engine.version not bumped"

echo "=== T32: upgrade is idempotent (a re-run applies no new ops) ==="
APPLIED_BEFORE=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.operations_applied.length)' "$UP/AIDOCS/_index.json")
node "$UPENG" upgrade >/dev/null 2>&1
APPLIED_AFTER=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.operations_applied.length)' "$UP/AIDOCS/_index.json")
[ "$APPLIED_BEFORE" = "$APPLIED_AFTER" ] && pass "re-run upgrade did not duplicate ops (still $APPLIED_AFTER applied)" || fail "ops duplicated on re-run (before=$APPLIED_BEFORE after=$APPLIED_AFTER)"

echo "=== T33: customizations[] preserves a project-edited canonical skill body across the copy ==="
CU="$BASE/customize"
node "$RENG" init "$CU" --name CuProj >/dev/null 2>&1
CUENG="$CU/AIDOCS/tools/engine.mjs"
printf '\nCUSTOM_MARKER_IN_SYNC: project-edited canonical body.\n' >> "$CU/AIDOCS/SKILL/SKILL_UPDATE-SYNC.md"
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.customizations=["AIDOCS/SKILL/SKILL_UPDATE-SYNC.md"];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$CU/AIDOCS/_index.json"
node "$CUENG" fetch-engine --from "$UPSRC" >/dev/null 2>&1
node "$CUENG" upgrade >/dev/null 2>&1
grep -q 'CUSTOM_MARKER_IN_SYNC' "$CU/AIDOCS/SKILL/SKILL_UPDATE-SYNC.md" && pass "customizations[] preserved the project-edited SKILL_UPDATE-SYNC.md" || fail "customized SKILL_UPDATE-SYNC.md was overwritten"

echo "=== T34: upgrade without a source MANIFEST.json runs the copy step cleanly (manifest-less engine is supported) ==="
NM="$BASE/nomanifest"
node "$RENG" init "$NM" --name NmProj >/dev/null 2>&1
NMENG="$NM/AIDOCS/tools/engine.mjs"
UPSRC2="$BASE/nomanifestsrc"
mkdir -p "$UPSRC2/AIDOCS" "$UPSRC2/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$UPSRC2/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$UPSRC2/AIDOCS/SKILL"
cp "$REAL/AIDOCS/_index.json" "$UPSRC2/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$UPSRC2/.claude/skills/321/SKILL.md"
node "$NMENG" fetch-engine --from "$UPSRC2" >/dev/null 2>&1
NMOUT="$(node "$NMENG" upgrade 2>&1)"; NMCC=$?
[ "$NMCC" = "0" ] && pass "upgrade with no source MANIFEST.json exits 0" || fail "upgrade with no manifest failed (exit $NMCC): $NMOUT"
echo "$NMOUT" | grep -q '0 applied' && pass "upgrade reports 0 applied on a manifest-less source" || fail "upgrade did not report 0 applied"

echo "=== T36: upgrade --dry-run writes nothing (no file mutations, no registry write, no install log) ==="
DR="$BASE/dryrun"
node "$RENG" init "$DR" --name DrProj >/dev/null 2>&1
DRENG="$DR/AIDOCS/tools/engine.mjs"
# Reuse the upgrade source built in T31 - carries a real two-op manifest.
node "$DRENG" fetch-engine --from "$UPSRC" >/dev/null 2>&1
BEFORE_INDEX=$(node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1]))))' "$DR/AIDOCS/_index.json")
DROUT="$(node "$DRENG" upgrade --dry-run 2>&1)"; DRCC=$?
[ "$DRCC" = "0" ] && pass "upgrade --dry-run exits 0" || fail "upgrade --dry-run failed (exit $DRCC): $DROUT"
echo "$DROUT" | grep -q "dry-run" && pass "upgrade --dry-run header carries the dry-run marker" || fail "no dry-run marker in header"
AFTER_INDEX=$(node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1]))))' "$DR/AIDOCS/_index.json")
[ "$BEFORE_INDEX" = "$AFTER_INDEX" ] && pass "_index.json byte-equal after --dry-run (no registry write)" || fail "_index.json changed during --dry-run"
[ ! -f "$DR/AIDOCS/DrProj_TEST.md" ] && pass "file_add_template wrote no file under --dry-run" || fail "file_add_template wrote a file under --dry-run"
if [ -f "$DR/INSTALL/INSTALL.log" ]; then
  grep -q '^upgrade:' "$DR/INSTALL/INSTALL.log" && fail "install log written during --dry-run" || pass "install log carries no upgrade line after --dry-run"
else
  pass "install log absent after --dry-run"
fi
node "$DRENG" upgrade >/dev/null 2>&1
[ -f "$DR/AIDOCS/DrProj_TEST.md" ] && pass "a subsequent real upgrade after --dry-run still applies the ops" || fail "real upgrade after --dry-run failed"

echo "=== T37: upgrade aborts before copy + version bump when a handler throws (fail-fast) ==="
FF="$BASE/failfast"
node "$RENG" init "$FF" --name FfProj >/dev/null 2>&1
FFENG="$FF/AIDOCS/tools/engine.mjs"
FFSRC="$BASE/failfastsrc"
mkdir -p "$FFSRC/AIDOCS" "$FFSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$FFSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$FFSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$FFSRC/AIDOCS/automemory"
cp "$REAL/.claude/skills/321/SKILL.md" "$FFSRC/.claude/skills/321/SKILL.md"
node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1]));j.engine.version="9.9.99";fs.writeFileSync(process.argv[2],JSON.stringify(j,null,2)+"\n")' "$REAL/AIDOCS/_index.json" "$FFSRC/AIDOCS/_index.json"
# Manifest pairs one valid registry_extend with one automemory_add pointing at a seed
# file the source does not carry. The seed-missing handler throws, fail-fast aborts.
cat > "$FFSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "ff_extend_first", "type": "registry_extend", "path": "sizes.ff_first", "value": { "cap": 50, "prune_to": 25 } },
    { "name": "ff_missing_seed", "type": "automemory_add", "file": "feedback_does_not_exist.md" }
  ]
}
EOF
node "$FFENG" fetch-engine --from "$FFSRC" >/dev/null 2>&1
FFOUT="$(node "$FFENG" upgrade 2>&1)"; FFCC=$?
[ "$FFCC" = "20" ] && pass "upgrade exits 20 on a thrown handler" || fail "upgrade did not exit 20 (got $FFCC): $FFOUT"
echo "$FFOUT" | grep -q "FAIL ff_missing_seed" && pass "upgrade names the failing op" || fail "no FAIL ff_missing_seed in output"
echo "$FFOUT" | grep -q "aborting before copy step" && pass "upgrade reports the abort reason" || fail "no abort reason in output"
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.version === "9.9.99" ? 1 : 0)' "$FF/AIDOCS/_index.json" && pass "engine.version NOT bumped (abort before version write)" || fail "engine.version was bumped despite a failing op"
node -e 'const a=JSON.parse(require("fs").readFileSync(process.argv[1])).engine.operations_applied;process.exit(a.includes("ff_extend_first")?1:0)' "$FF/AIDOCS/_index.json" && pass "operations_applied stays empty (no partial commit on abort)" || fail "operations_applied carries the first op despite the abort"

echo "=== T38: registry_rename moves a dotted-path key and is idempotent on re-run ==="
RN38="$BASE/rename"
node "$RENG" init "$RN38" --name RnProj >/dev/null 2>&1
RNENG="$RN38/AIDOCS/tools/engine.mjs"
# Project carries the legacy auto_memory.source field (the WAT321 case).
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.auto_memory={source:"./AIDOCS/automemory",path:""};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$RN38/AIDOCS/_index.json"
# Source manifest carries the rename op.
RNSRC="$BASE/renamesrc"
mkdir -p "$RNSRC/AIDOCS" "$RNSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$RNSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$RNSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$RNSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$RNSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$RNSRC/.claude/skills/321/SKILL.md"
cat > "$RNSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "rename_auto_memory_source_to_seed", "type": "registry_rename", "from": "auto_memory.source", "to": "auto_memory.seed" }
  ]
}
EOF
node "$RNENG" fetch-engine --from "$RNSRC" >/dev/null 2>&1
RNOUT="$(node "$RNENG" upgrade 2>&1)"; RNCC=$?
[ "$RNCC" = "0" ] && pass "registry_rename upgrade exits 0" || fail "upgrade failed (exit $RNCC): $RNOUT"
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit((j.auto_memory.seed==="./AIDOCS/automemory" && j.auto_memory.source===undefined)?0:1)' "$RN38/AIDOCS/_index.json" && pass "registry_rename moved auto_memory.source to .seed" || fail "registry_rename did not move the key"
node -e 'const a=JSON.parse(require("fs").readFileSync(process.argv[1])).engine.operations_applied;process.exit(a.includes("rename_auto_memory_source_to_seed")?0:1)' "$RN38/AIDOCS/_index.json" && pass "registry_rename op name recorded in operations_applied[]" || fail "op name not in operations_applied"
# Re-run: from-absent + to-present is the post-migration state, should no-op clean.
node "$RNENG" fetch-engine --from "$RNSRC" >/dev/null 2>&1
RN2OUT="$(node "$RNENG" upgrade 2>&1)"; RN2CC=$?
[ "$RN2CC" = "0" ] && pass "registry_rename re-run exits 0" || fail "re-run failed (exit $RN2CC): $RN2OUT"
echo "$RN2OUT" | grep -q '0 applied' && pass "registry_rename re-run reports 0 applied (idempotent)" || fail "registry_rename re-run reported a non-zero applied count"

echo "=== T39: registry_rename no-ops when from is absent and to is absent ==="
RNAB="$BASE/renameabsent"
node "$RENG" init "$RNAB" --name RnAbProj >/dev/null 2>&1
RNABENG="$RNAB/AIDOCS/tools/engine.mjs"
# Strip auto_memory entirely so both from and to are absent.
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));delete j.auto_memory;fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$RNAB/AIDOCS/_index.json"
node "$RNABENG" fetch-engine --from "$RNSRC" >/dev/null 2>&1
RNABOUT="$(node "$RNABENG" upgrade 2>&1)"; RNABCC=$?
[ "$RNABCC" = "0" ] && pass "registry_rename with both keys absent exits 0" || fail "upgrade failed on both-absent (exit $RNABCC): $RNABOUT"
echo "$RNABOUT" | grep -q "nothing to rename" && pass "registry_rename reports 'nothing to rename' on both-absent" || fail "registry_rename did not report nothing-to-rename"

echo "=== T40: rename manifest end-to-end (skill bodies + registry keys, idempotent on re-run) ==="
LEG="$BASE/legacy-rename"
node "$RENG" init "$LEG" --name LegProj >/dev/null 2>&1
LEGENG="$LEG/AIDOCS/tools/engine.mjs"
# Synthesize a legacy project: revert the canonical SKILL bodies to old target-first naming,
# revert _index.json file/bucket/size keys to the legacy form, plant a SKILL_SYNC.md so the
# skill_delete op has something real to act on, and clear operations_applied so every op runs.
mv "$LEG/AIDOCS/SKILL/SKILL_UPDATE-SESSION.md" "$LEG/AIDOCS/SKILL/SKILL_SESSION-UPDATE.md"
mv "$LEG/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" "$LEG/AIDOCS/SKILL/SKILL_MEMORY-UPDATE.md"
cat > "$LEG/AIDOCS/SKILL/SKILL_SYNC.md" <<'EOF'
---
name: sync
description: legacy sync body for the rename test.
---

# /321 -SYNC

**Purpose:** legacy.
EOF
node -e '
const f=process.argv[1],fs=require("fs");
const j=JSON.parse(fs.readFileSync(f));
const remap=(obj)=>{if(!obj)return;for(const k of Object.keys(obj)){let nk=k;if(k.startsWith("updatememory."))nk="memoryupdate."+k.slice("updatememory.".length);else if(k.startsWith("updatesession."))nk="sessionupdate."+k.slice("updatesession.".length);if(nk!==k){obj[nk]=obj[k];delete obj[k]}}};
for(const sec of ["files","buckets","sizes"]) remap(j[sec]);
j.engine={version:"0.1.1",upstream:"",operations_applied:[]};
fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n");
' "$LEG/AIDOCS/_index.json"
# Source carries the current REAL engine + the new manifest (17 ops).
LEGSRC="$BASE/legacy-rename-src"
mkdir -p "$LEGSRC/AIDOCS" "$LEGSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$LEGSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$LEGSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$LEGSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$LEGSRC/AIDOCS/_index.json"
cp "$REAL/AIDOCS/MANIFEST.json" "$LEGSRC/AIDOCS/MANIFEST.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$LEGSRC/.claude/skills/321/SKILL.md"
node "$LEGENG" fetch-engine --from "$LEGSRC" >/dev/null 2>&1
LEGOUT="$(node "$LEGENG" upgrade 2>&1)"; LEGCC=$?
[ "$LEGCC" = "0" ] && pass "rename manifest upgrade exits 0" || fail "upgrade failed (exit $LEGCC): $LEGOUT"
[ ! -f "$LEG/AIDOCS/SKILL/SKILL_SESSION-UPDATE.md" ] && pass "skill_rename removed legacy SKILL_SESSION-UPDATE.md" || fail "legacy SKILL_SESSION-UPDATE.md still present"
[ -f "$LEG/AIDOCS/SKILL/SKILL_UPDATE-SESSION.md" ] && pass "copy step landed new SKILL_UPDATE-SESSION.md" || fail "new SKILL_UPDATE-SESSION.md missing"
[ ! -f "$LEG/AIDOCS/SKILL/SKILL_MEMORY-UPDATE.md" ] && pass "skill_rename removed legacy SKILL_MEMORY-UPDATE.md" || fail "legacy SKILL_MEMORY-UPDATE.md still present"
[ -f "$LEG/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" ] && pass "copy step landed new SKILL_UPDATE-MEMORY.md" || fail "new SKILL_UPDATE-MEMORY.md missing"
[ ! -f "$LEG/AIDOCS/SKILL/SKILL_SYNC.md" ] && pass "skill_delete removed SKILL_SYNC.md (folded into UpdateSync)" || fail "SKILL_SYNC.md not deleted"
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(j.files["updatememory.memory"] && j.files["updatesession.session"] ? 0 : 1)' "$LEG/AIDOCS/_index.json" && pass "registry_rename added updatememory.memory and updatesession.session" || fail "new file keys missing after rename"
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(j.files["sessionupdate.session"]===undefined && j.files["memoryupdate.memory"]===undefined ? 0 : 1)' "$LEG/AIDOCS/_index.json" && pass "registry_rename removed legacy sessionupdate / memoryupdate file keys" || fail "legacy file keys still present after rename"
node "$LEGENG" doctor 2>&1 | grep -q "all checks passed" && pass "doctor passes after rename manifest applies" || fail "doctor failed after rename"
APPLIED_FIRST=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.operations_applied.length)' "$LEG/AIDOCS/_index.json")
node "$LEGENG" upgrade >/dev/null 2>&1
APPLIED_SECOND=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.operations_applied.length)' "$LEG/AIDOCS/_index.json")
[ "$APPLIED_FIRST" = "$APPLIED_SECOND" ] && pass "rename manifest is idempotent on re-run (applied count stable at $APPLIED_FIRST)" || fail "rename manifest re-applied ops (before=$APPLIED_FIRST after=$APPLIED_SECOND)"

echo "=== T41: file_delete op removes an existing engine-class file, idempotent on re-run ==="
FD="$BASE/filedelete"
node "$RENG" init "$FD" --name FdProj >/dev/null 2>&1
FDENG="$FD/AIDOCS/tools/engine.mjs"
# Plant a stale engine-class file the upstream no longer ships.
printf 'stale folded reference doc\n' > "$FD/AIDOCS/tools/STALE.md"
FDSRC="$BASE/filedeletesrc"
mkdir -p "$FDSRC/AIDOCS" "$FDSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$FDSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$FDSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$FDSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$FDSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$FDSRC/.claude/skills/321/SKILL.md"
cat > "$FDSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "delete_stale_engine_file", "type": "file_delete", "file": "AIDOCS/tools/STALE.md" }
  ]
}
EOF
node "$FDENG" fetch-engine --from "$FDSRC" >/dev/null 2>&1
FDOUT="$(node "$FDENG" upgrade 2>&1)"; FDCC=$?
[ "$FDCC" = "0" ] && pass "file_delete upgrade exits 0" || fail "upgrade failed (exit $FDCC): $FDOUT"
[ ! -f "$FD/AIDOCS/tools/STALE.md" ] && pass "file_delete removed the stale file" || fail "stale file still present"
# Re-run: from-absent is the post-deletion state, should no-op clean.
node "$FDENG" fetch-engine --from "$FDSRC" >/dev/null 2>&1
FD2OUT="$(node "$FDENG" upgrade 2>&1)"; FD2CC=$?
[ "$FD2CC" = "0" ] && pass "file_delete re-run exits 0" || fail "re-run failed (exit $FD2CC): $FD2OUT"
echo "$FD2OUT" | grep -q '0 applied' && pass "file_delete re-run reports 0 applied (idempotent)" || fail "file_delete re-run reported a non-zero applied count"
# Path-escape: a manifest with a `..` target is rejected.
cat > "$FDSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "delete_stale_engine_file", "type": "file_delete", "file": "AIDOCS/tools/STALE.md" },
    { "name": "evil_escape_attempt",      "type": "file_delete", "file": "../escape-target.md" }
  ]
}
EOF
node "$FDENG" fetch-engine --from "$FDSRC" >/dev/null 2>&1
FD3OUT="$(node "$FDENG" upgrade 2>&1)"; FD3CC=$?
[ "$FD3CC" = "20" ] && pass "file_delete rejects ../ escape with exit 20" || fail "file_delete accepted ../ escape (exit $FD3CC)"
echo "$FD3OUT" | grep -q 'escapes the project root' && pass "containment rejection names the cause" || fail "no 'escapes the project root' in output"

echo "=== T42: upgrade refuses while reconcile_pending is set, --force overrides ==="
RP="$BASE/reconcilepending"
node "$RENG" init "$RP" --name RpProj >/dev/null 2>&1
RPENG="$RP/AIDOCS/tools/engine.mjs"
node "$RPENG" state --set-reconcile >/dev/null 2>&1
node "$RPENG" fetch-engine --from "$FDSRC" >/dev/null 2>&1   # reuse the FDSRC tree
RPOUT="$(node "$RPENG" upgrade 2>&1)"; RPCC=$?
[ "$RPCC" = "20" ] && pass "upgrade refuses while reconcile_pending is set (exit 20)" || fail "upgrade did not refuse (exit $RPCC)"
echo "$RPOUT" | grep -q 'reconcile_pending' && pass "refusal names reconcile_pending" || fail "no reconcile_pending in refusal message"
# --force should still be rejected because of the path-escape op in the manifest above.
# Clean the manifest, then verify --force lets a valid upgrade through.
cat > "$FDSRC/AIDOCS/MANIFEST.json" <<'EOF'
{ "operations": [] }
EOF
node "$RPENG" fetch-engine --from "$FDSRC" >/dev/null 2>&1
RP2OUT="$(node "$RPENG" upgrade --force 2>&1)"; RP2CC=$?
[ "$RP2CC" = "0" ] && pass "upgrade --force overrides the reconcile guard" || fail "upgrade --force did not override (exit $RP2CC): $RP2OUT"

echo "=== T43: file_add_template rejects an escaping path (containment) ==="
PC="$BASE/pathcontain"
node "$RENG" init "$PC" --name PcProj >/dev/null 2>&1
PCENG="$PC/AIDOCS/tools/engine.mjs"
PCSRC="$BASE/pathcontainsrc"
mkdir -p "$PCSRC/AIDOCS" "$PCSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$PCSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$PCSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$PCSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$PCSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$PCSRC/.claude/skills/321/SKILL.md"
cat > "$PCSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "evil_template_escape", "type": "file_add_template", "file": "../escape.md", "body": "evil" }
  ]
}
EOF
node "$PCENG" fetch-engine --from "$PCSRC" >/dev/null 2>&1
PCOUT="$(node "$PCENG" upgrade 2>&1)"; PCCC=$?
[ "$PCCC" = "20" ] && pass "file_add_template rejects ../ escape with exit 20" || fail "file_add_template accepted escape (exit $PCCC)"
[ ! -f "$BASE/escape.md" ] && pass "no file written outside the project root" || fail "escape.md written outside the project root"
# Absolute paths are also rejected (resolveContained explicitly checks isAbsolute).
cat > "$PCSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "evil_absolute_path", "type": "file_add_template", "file": "/tmp/abs.md", "body": "evil" }
  ]
}
EOF
node "$PCENG" fetch-engine --from "$PCSRC" >/dev/null 2>&1
PCOUT2="$(node "$PCENG" upgrade 2>&1)"; PCCC2=$?
[ "$PCCC2" = "20" ] && pass "file_add_template rejects absolute path with exit 20" || fail "file_add_template accepted absolute path (exit $PCCC2)"
echo "$PCOUT2" | grep -q "must be project-relative" && pass "absolute path rejected with project-relative message" || fail "absolute path rejection lacks project-relative message"

echo "=== T44: skill_delete and skill_rename reject non-basename inputs (containment) ==="
SE44="$BASE/skillescape"
node "$RENG" init "$SE44" --name SeProj >/dev/null 2>&1
SEENG_44="$SE44/AIDOCS/tools/engine.mjs"
SESRC="$BASE/skillescapesrc"
mkdir -p "$SESRC/AIDOCS" "$SESRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$SESRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$SESRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$SESRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$SESRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$SESRC/.claude/skills/321/SKILL.md"
cat > "$SESRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "evil_skill_delete_escape", "type": "skill_delete", "file": "../escape.md" }
  ]
}
EOF
node "$SEENG_44" fetch-engine --from "$SESRC" >/dev/null 2>&1
SEOUT="$(node "$SEENG_44" upgrade 2>&1)"; SECC=$?
[ "$SECC" = "20" ] && pass "skill_delete rejects non-basename path with exit 20" || fail "skill_delete accepted non-basename (exit $SECC)"
echo "$SEOUT" | grep -q "must be a bare SKILL_\*.md basename" && pass "skill_delete rejection names the basename rule" || fail "no basename-rule message in output"
# skill_rename with a `from` that escapes
cat > "$SESRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "evil_skill_rename_escape", "type": "skill_rename", "from": "../escape.md", "to": "SKILL_UPDATE-NEW.md" }
  ]
}
EOF
node "$SEENG_44" fetch-engine --from "$SESRC" >/dev/null 2>&1
SE2OUT="$(node "$SEENG_44" upgrade 2>&1)"; SE2CC=$?
[ "$SE2CC" = "20" ] && pass "skill_rename rejects non-basename `from` with exit 20" || fail "skill_rename accepted non-basename from (exit $SE2CC)"
# skill_delete with a non-SKILL_*.md basename
cat > "$SESRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "evil_skill_delete_wrong_prefix", "type": "skill_delete", "file": "NOT_A_SKILL.md" }
  ]
}
EOF
node "$SEENG_44" fetch-engine --from "$SESRC" >/dev/null 2>&1
SE3OUT="$(node "$SEENG_44" upgrade 2>&1)"; SE3CC=$?
[ "$SE3CC" = "20" ] && pass "skill_delete rejects non-SKILL_*.md basename" || fail "skill_delete accepted non-SKILL basename (exit $SE3CC)"

echo "=== T64: file_delete skips a path listed in customizations[] (GLP321-web finding) ==="
# An upstream cleanup op should not blow away a project's local work in a file the
# customizations[] entry was meant to preserve. The op no-ops with a clear note; user
# removes the path from customizations[] to apply.
FDC="$BASE/filedelete-customize"
node "$RENG" init "$FDC" --name FdcProj >/dev/null 2>&1
FDCENG="$FDC/AIDOCS/tools/engine.mjs"
# Plant a project-customized file the user wants to keep
mkdir -p "$FDC/AIDOCS/tools/staging"
printf 'project-local customized content\n' > "$FDC/AIDOCS/tools/staging/SCHEMA.json"
# Register it in customizations[]
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.customizations=["AIDOCS/tools/staging/SCHEMA.json"];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$FDC/AIDOCS/_index.json"
# Source manifest: file_delete the same path
FDCSRC="$BASE/filedelete-customize-src"
mkdir -p "$FDCSRC/AIDOCS" "$FDCSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$FDCSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$FDCSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$FDCSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$FDCSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$FDCSRC/.claude/skills/321/SKILL.md"
cat > "$FDCSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "delete_customized_schema", "type": "file_delete", "file": "AIDOCS/tools/staging/SCHEMA.json" }
  ]
}
EOF
node "$FDCENG" fetch-engine --from "$FDCSRC" >/dev/null 2>&1
FDCOUT="$(node "$FDCENG" upgrade 2>&1)"; FDCCC=$?
[ "$FDCCC" = "0" ] && pass "upgrade exits 0 when file_delete hits a customized path" || fail "upgrade failed (exit $FDCCC): $FDCOUT"
[ -f "$FDC/AIDOCS/tools/staging/SCHEMA.json" ] && pass "customized file PRESERVED across the file_delete op" || fail "customized file was deleted despite customizations[]"
grep -q 'project-local customized content' "$FDC/AIDOCS/tools/staging/SCHEMA.json" 2>/dev/null && pass "customized file content intact (not overwritten)" || fail "customized file content lost"
echo "$FDCOUT" | grep -q "skipped (customizations" && pass "upgrade report names the skip reason (customizations[])" || fail "no customizations skip note in output"
# Reversal: user removes the entry from customizations[], re-runs, file is deleted
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.customizations=[];j.engine.operations_applied=[];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$FDC/AIDOCS/_index.json"
node "$FDCENG" fetch-engine --from "$FDCSRC" >/dev/null 2>&1
node "$FDCENG" upgrade >/dev/null 2>&1
[ ! -f "$FDC/AIDOCS/tools/staging/SCHEMA.json" ] && pass "after removing from customizations[], file_delete applies (reversal path)" || fail "file_delete did not apply after customizations[] cleared"

echo "=== T65: skill_delete also honors customizations[] (consistency with file_delete) ==="
# Same blast-radius concern: blindly deleting a customized skill body would lose work.
SDC="$BASE/skilldelete-customize"
node "$RENG" init "$SDC" --name SdcProj >/dev/null 2>&1
SDCENG="$SDC/AIDOCS/tools/engine.mjs"
# Plant a project-customized skill body (a copy of a canonical with project edits)
cp "$REAL/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" "$SDC/AIDOCS/SKILL/SKILL_LEGACY-CUSTOM.md"
printf '\nLOCAL_CUSTOM_BODY_MARKER\n' >> "$SDC/AIDOCS/SKILL/SKILL_LEGACY-CUSTOM.md"
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.customizations=["AIDOCS/SKILL/SKILL_LEGACY-CUSTOM.md"];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$SDC/AIDOCS/_index.json"
# Source manifest: skill_delete for that body
SDCSRC="$BASE/skilldelete-customize-src"
mkdir -p "$SDCSRC/AIDOCS" "$SDCSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$SDCSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$SDCSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$SDCSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$SDCSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$SDCSRC/.claude/skills/321/SKILL.md"
cat > "$SDCSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "delete_customized_skill", "type": "skill_delete", "file": "SKILL_LEGACY-CUSTOM.md" }
  ]
}
EOF
node "$SDCENG" fetch-engine --from "$SDCSRC" >/dev/null 2>&1
SDCOUT="$(node "$SDCENG" upgrade 2>&1)"; SDCCC=$?
[ "$SDCCC" = "0" ] && pass "upgrade exits 0 when skill_delete hits a customized body" || fail "upgrade failed (exit $SDCCC): $SDCOUT"
[ -f "$SDC/AIDOCS/SKILL/SKILL_LEGACY-CUSTOM.md" ] && pass "customized skill body PRESERVED across skill_delete op" || fail "customized skill body was deleted despite customizations[]"
grep -q 'LOCAL_CUSTOM_BODY_MARKER' "$SDC/AIDOCS/SKILL/SKILL_LEGACY-CUSTOM.md" 2>/dev/null && pass "customized skill body content intact" || fail "customized skill body content lost"
echo "$SDCOUT" | grep -q "skipped (customizations" && pass "upgrade report names the skip reason (skill_delete + customizations[])" || fail "no customizations skip note for skill_delete"
