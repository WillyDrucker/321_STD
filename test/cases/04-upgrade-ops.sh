# 04-upgrade-ops.sh - the upgrade command's manifest operation APPLY surface, one
# isolated project per operation kind: registry_extend + file_add_template (T31),
# re-run idempotency (T32), the manifest-less engine fallback (T34), registry_rename
# (T38/T39), the action-first rename manifest end-to-end (T40), and file_delete (T41,
# which keeps its containment rejection for self-containment). The safety perimeter
# (dry-run, fail-fast, reconcile gate, containment, customizations[] deferral) lives
# in 06-upgrade-guards.sh; the AI merge / orphan punch lists in 07-sync-judgment.sh.

echo "=== T31: upgrade applies missing manifest operations (registry_extend, file_add_template), records names, bumps version ==="
UP="$BASE/upgrade"
UPENG="$(mk_proj "$UP" UpProj)"
UPSRC="$BASE/upgradesrc"
mk_src "$UPSRC" --version 9.9.9
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
[ "$(reg_get "$UP" sizes.test_key.cap)" = "100" ] && pass "registry_extend op set sizes.test_key" || fail "registry_extend op did not set sizes.test_key"
[ -f "$UP/AIDOCS/UpProj_TEST.md" ] && pass "file_add_template wrote AIDOCS/UpProj_TEST.md" || fail "file_add_template did not write the file"
grep -q 'UpProj - TEST' "$UP/AIDOCS/UpProj_TEST.md" 2>/dev/null && pass "PROJECTNAME substituted to UpProj in template body" || fail "PROJECTNAME not substituted"
UPAPPLIED="$(reg_get "$UP" engine.operations_applied)"
echo "$UPAPPLIED" | grep -q '"extend_test_key"' && echo "$UPAPPLIED" | grep -q '"add_template_file"' && pass "operations_applied[] records both op names" || fail "operations_applied missing op names ($UPAPPLIED)"
[ "$(reg_get "$UP" engine.version)" = "9.9.9" ] && pass "engine.version bumped to source value (9.9.9)" || fail "engine.version not bumped"

echo "=== T32: upgrade is idempotent (a re-run applies no new ops) ==="
APPLIED_BEFORE="$(reg_get "$UP" engine.operations_applied)"
node "$UPENG" upgrade >/dev/null 2>&1
APPLIED_AFTER="$(reg_get "$UP" engine.operations_applied)"
[ "$APPLIED_BEFORE" = "$APPLIED_AFTER" ] && pass "re-run upgrade did not duplicate ops" || fail "ops changed on re-run (before=$APPLIED_BEFORE after=$APPLIED_AFTER)"

echo "=== T34: upgrade without a source MANIFEST.json runs the copy step cleanly (manifest-less engine is supported) ==="
NM="$BASE/nomanifest"
NMENG="$(mk_proj "$NM" NmProj)"
UPSRC2="$BASE/nomanifestsrc"
mk_src "$UPSRC2" --no-automemory
node "$NMENG" fetch-engine --from "$UPSRC2" >/dev/null 2>&1
NMOUT="$(node "$NMENG" upgrade 2>&1)"; NMCC=$?
[ "$NMCC" = "0" ] && pass "upgrade with no source MANIFEST.json exits 0" || fail "upgrade with no manifest failed (exit $NMCC): $NMOUT"
echo "$NMOUT" | grep -q '0 applied' && pass "upgrade reports 0 applied on a manifest-less source" || fail "upgrade did not report 0 applied"

echo "=== T38: registry_rename moves a dotted-path key and is idempotent on re-run ==="
RN38="$BASE/rename"
RNENG="$(mk_proj "$RN38" RnProj)"
# Project carries the legacy auto_memory.source field (the WAT321 case).
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.auto_memory={source:"./AIDOCS/automemory",path:""};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$RN38/AIDOCS/_index.json"
RNSRC="$BASE/renamesrc"
mk_src "$RNSRC"
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
[ "$(reg_get "$RN38" auto_memory.seed)" = "./AIDOCS/automemory" ] && [ -z "$(reg_get "$RN38" auto_memory.source)" ] && pass "registry_rename moved auto_memory.source to .seed" || fail "registry_rename did not move the key"
reg_get "$RN38" engine.operations_applied | grep -q '"rename_auto_memory_source_to_seed"' && pass "registry_rename op name recorded in operations_applied[]" || fail "op name not in operations_applied"
# Re-run: from-absent + to-present is the post-migration state, should no-op clean.
node "$RNENG" fetch-engine --from "$RNSRC" >/dev/null 2>&1
RN2OUT="$(node "$RNENG" upgrade 2>&1)"; RN2CC=$?
[ "$RN2CC" = "0" ] && pass "registry_rename re-run exits 0" || fail "re-run failed (exit $RN2CC): $RN2OUT"
echo "$RN2OUT" | grep -q '0 applied' && pass "registry_rename re-run reports 0 applied (idempotent)" || fail "registry_rename re-run reported a non-zero applied count"

echo "=== T39: registry_rename no-ops when from is absent and to is absent ==="
RNAB="$BASE/renameabsent"
RNABENG="$(mk_proj "$RNAB" RnAbProj)"
# Strip auto_memory entirely so both from and to are absent.
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));delete j.auto_memory;fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$RNAB/AIDOCS/_index.json"
node "$RNABENG" fetch-engine --from "$RNSRC" >/dev/null 2>&1
RNABOUT="$(node "$RNABENG" upgrade 2>&1)"; RNABCC=$?
[ "$RNABCC" = "0" ] && pass "registry_rename with both keys absent exits 0" || fail "upgrade failed on both-absent (exit $RNABCC): $RNABOUT"
echo "$RNABOUT" | grep -q "nothing to rename" && pass "registry_rename reports 'nothing to rename' on both-absent" || fail "registry_rename did not report nothing-to-rename"

echo "=== T40: rename manifest end-to-end (skill bodies + registry keys, idempotent on re-run) ==="
LEG="$BASE/legacy-rename"
LEGENG="$(mk_proj "$LEG" LegProj)"
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
# Source carries the current REAL engine plus the repo's live manifest.
LEGSRC="$BASE/legacy-rename-src"
mk_src "$LEGSRC" --real-manifest
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
LEGAPPLIED_FIRST="$(reg_get "$LEG" engine.operations_applied)"
node "$LEGENG" upgrade >/dev/null 2>&1
LEGAPPLIED_SECOND="$(reg_get "$LEG" engine.operations_applied)"
[ "$LEGAPPLIED_FIRST" = "$LEGAPPLIED_SECOND" ] && pass "rename manifest is idempotent on re-run (journal stable)" || fail "rename manifest re-applied ops (before=$LEGAPPLIED_FIRST after=$LEGAPPLIED_SECOND)"

echo "=== T41: file_delete op removes an existing engine-class file, idempotent on re-run ==="
FD="$BASE/filedelete"
FDENG="$(mk_proj "$FD" FdProj)"
# Plant a stale engine-class file the upstream no longer ships.
printf 'stale folded reference doc\n' > "$FD/AIDOCS/tools/STALE.md"
FDSRC="$BASE/filedeletesrc"
mk_src "$FDSRC"
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
# Path-escape: a manifest with a `..` target is rejected (kept with its op - the broader
# containment perimeter lives in 06-upgrade-guards.sh).
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
