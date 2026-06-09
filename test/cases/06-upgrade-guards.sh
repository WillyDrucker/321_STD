# 06-upgrade-guards.sh - the upgrade command's safety perimeter, one isolated project
# per guard: customizations[] preserves a project-edited body across the copy (T33),
# --dry-run is read-only (T36), fail-fast on a thrown handler (T37), the
# reconcile_pending gate + --force override (T42), path containment on
# file_add_template (T43) and the skill ops (T44), customizations[] deferral on
# file_delete (T64) and skill_delete (T65), and deferred ops staying out of the
# journal so the reversal path retries (T74). The APPLY surface lives in
# 04-upgrade-ops.sh; the AI merge / orphan punch lists in 07-sync-judgment.sh.

echo "=== T33: customizations[] preserves a project-edited canonical skill body across the copy ==="
CU="$BASE/customize"
CUENG="$(mk_proj "$CU" CuProj)"
printf '\nCUSTOM_MARKER_IN_SYNC: project-edited canonical body.\n' >> "$CU/AIDOCS/SKILL/SKILL_UPDATE-SYNC.md"
set_custom "$CU" "AIDOCS/SKILL/SKILL_UPDATE-SYNC.md"
CUSRC="$BASE/customizesrc"
mk_src "$CUSRC" --empty-manifest
node "$CUENG" fetch-engine --from "$CUSRC" >/dev/null 2>&1
node "$CUENG" upgrade >/dev/null 2>&1
grep -q 'CUSTOM_MARKER_IN_SYNC' "$CU/AIDOCS/SKILL/SKILL_UPDATE-SYNC.md" && pass "customizations[] preserved the project-edited SKILL_UPDATE-SYNC.md" || fail "customized SKILL_UPDATE-SYNC.md was overwritten"

echo "=== T36: upgrade --dry-run writes nothing (no file mutations, no registry write, no install log) ==="
DR="$BASE/dryrun"
DRENG="$(mk_proj "$DR" DrProj)"
DRSRC="$BASE/dryrunsrc"
mk_src "$DRSRC" --version 9.9.9
cat > "$DRSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "extend_test_key", "type": "registry_extend", "path": "sizes.test_key", "value": { "cap": 100, "prune_to": 50 } },
    { "name": "add_template_file", "type": "file_add_template", "file": "AIDOCS/PROJECTNAME_TEST.md", "body": "# PROJECTNAME - TEST\n\n**Purpose:** test template.\n" }
  ]
}
EOF
node "$DRENG" fetch-engine --from "$DRSRC" >/dev/null 2>&1
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
FFENG="$(mk_proj "$FF" FfProj)"
FFSRC="$BASE/failfastsrc"
mk_src "$FFSRC" --version 9.9.99
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
[ "$(reg_get "$FF" engine.version)" != "9.9.99" ] && pass "engine.version NOT bumped (abort before version write)" || fail "engine.version was bumped despite a failing op"
reg_get "$FF" engine.operations_applied | grep -qv '"ff_extend_first"' && pass "operations_applied stays empty (no partial commit on abort)" || fail "operations_applied carries the first op despite the abort"

echo "=== T42: upgrade refuses while reconcile_pending is set, --force overrides ==="
RP="$BASE/reconcilepending"
RPENG="$(mk_proj "$RP" RpProj)"
node "$RPENG" state --set-reconcile >/dev/null 2>&1
RPSRC="$BASE/reconcilependingsrc"
mk_src "$RPSRC" --empty-manifest
node "$RPENG" fetch-engine --from "$RPSRC" >/dev/null 2>&1
RPOUT="$(node "$RPENG" upgrade 2>&1)"; RPCC=$?
[ "$RPCC" = "20" ] && pass "upgrade refuses while reconcile_pending is set (exit 20)" || fail "upgrade did not refuse (exit $RPCC)"
echo "$RPOUT" | grep -q 'reconcile_pending' && pass "refusal names reconcile_pending" || fail "no reconcile_pending in refusal message"
RP2OUT="$(node "$RPENG" upgrade --force 2>&1)"; RP2CC=$?
[ "$RP2CC" = "0" ] && pass "upgrade --force overrides the reconcile guard" || fail "upgrade --force did not override (exit $RP2CC): $RP2OUT"

echo "=== T43: file_add_template rejects an escaping path (containment) ==="
PC="$BASE/pathcontain"
PCENG="$(mk_proj "$PC" PcProj)"
PCSRC="$BASE/pathcontainsrc"
mk_src "$PCSRC"
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
SEENG_44="$(mk_proj "$SE44" SeProj)"
SESRC="$BASE/skillescapesrc"
mk_src "$SESRC"
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
[ "$SE2CC" = "20" ] && pass "skill_rename rejects non-basename \`from\` with exit 20" || fail "skill_rename accepted non-basename from (exit $SE2CC)"
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
FDCENG="$(mk_proj "$FDC" FdcProj)"
mkdir -p "$FDC/AIDOCS/tools/staging"
printf 'project-local customized content\n' > "$FDC/AIDOCS/tools/staging/SCHEMA.json"
set_custom "$FDC" "AIDOCS/tools/staging/SCHEMA.json"
FDCSRC="$BASE/filedelete-customize-src"
mk_src "$FDCSRC"
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
echo "$FDCOUT" | grep -q "deferred (customizations" && pass "upgrade report names the deferral reason (customizations[])" || fail "no customizations deferral note in output"
# Reversal: user removes the entry from customizations[], re-runs, file is deleted
set_custom "$FDC"
node "$FDCENG" fetch-engine --from "$FDCSRC" >/dev/null 2>&1
node "$FDCENG" upgrade >/dev/null 2>&1
[ ! -f "$FDC/AIDOCS/tools/staging/SCHEMA.json" ] && pass "after removing from customizations[], file_delete applies (reversal path - no manual journal reset needed)" || fail "file_delete did not apply after customizations[] cleared"

echo "=== T65: skill_delete also honors customizations[] (consistency with file_delete) ==="
# Same blast-radius concern: blindly deleting a customized skill body would lose work.
SDC="$BASE/skilldelete-customize"
SDCENG="$(mk_proj "$SDC" SdcProj)"
# Plant a project-customized skill body (a copy of a canonical with project edits)
cp "$REAL/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" "$SDC/AIDOCS/SKILL/SKILL_LEGACY-CUSTOM.md"
printf '\nLOCAL_CUSTOM_BODY_MARKER\n' >> "$SDC/AIDOCS/SKILL/SKILL_LEGACY-CUSTOM.md"
set_custom "$SDC" "AIDOCS/SKILL/SKILL_LEGACY-CUSTOM.md"
SDCSRC="$BASE/skilldelete-customize-src"
mk_src "$SDCSRC"
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
echo "$SDCOUT" | grep -q "deferred (customizations" && pass "upgrade report names the deferral reason (skill_delete + customizations[])" || fail "no customizations deferral note for skill_delete"

echo "=== T74: customization-deferred ops stay out of operations_applied[] so the reversal path actually retries ==="
# The fix for the Codex finding: previously a customization-skipped op was journaled
# as applied, so removing the entry from customizations[] and re-running would still
# see the op in operations_applied[] and skip it as already-done. The deferred flag
# keeps the op name out of the journal so the re-run finds it in missing[] and applies.
DEF="$BASE/deferred-journal"
DEFENG="$(mk_proj "$DEF" DefProj)"
mkdir -p "$DEF/AIDOCS/tools/staging"
printf 'project-local content\n' > "$DEF/AIDOCS/tools/staging/SCHEMA.json"
set_custom "$DEF" "AIDOCS/tools/staging/SCHEMA.json"
DEFSRC="$BASE/deferred-journal-src"
mk_src "$DEFSRC"
cat > "$DEFSRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "delete_deferred_schema", "type": "file_delete", "file": "AIDOCS/tools/staging/SCHEMA.json" }
  ]
}
EOF
node "$DEFENG" fetch-engine --from "$DEFSRC" >/dev/null 2>&1
DEFOUT1="$(node "$DEFENG" upgrade 2>&1)"
echo "$DEFOUT1" | grep -q "1 deferred" && pass "first upgrade reports 1 deferred in the counts line" || fail "no deferred count in summary (output: $DEFOUT1)"
echo "$DEFOUT1" | grep -q "^  DEFER delete_deferred_schema" && pass "first upgrade tags the op DEFER (not APPLY / NO-OP)" || fail "no DEFER tag for the customization-deferred op"
# Verify the op is NOT in operations_applied[] (the actual fix)
reg_get "$DEF" engine.operations_applied | grep -qv "delete_deferred_schema" && pass "deferred op stays OUT of operations_applied[] (fix: no longer journaled as done)" || fail "deferred op was journaled despite the fix"
# Reversal: drop customization, re-run, op should now find the file and apply WITHOUT manually clearing operations_applied[]
set_custom "$DEF"
node "$DEFENG" fetch-engine --from "$DEFSRC" >/dev/null 2>&1
DEFOUT2="$(node "$DEFENG" upgrade 2>&1)"
[ ! -f "$DEF/AIDOCS/tools/staging/SCHEMA.json" ] && pass "after removing customization, the deferred op retries and applies on the next run (no manual journal reset)" || fail "deferred op did not retry after customization removal"
reg_get "$DEF" engine.operations_applied | grep -q "delete_deferred_schema" && pass "op IS journaled into operations_applied[] after the successful retry" || fail "op missing from operations_applied[] after successful apply"
