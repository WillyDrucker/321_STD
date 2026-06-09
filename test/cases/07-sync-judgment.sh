# 07-sync-judgment.sh - the AI-judgment surface of -UpdateSync: merge-status classifies
# customizations[] entries against the fetched upstream (T67), --auto-drop-clean trims
# only the mechanically safe classes (T72, T73 five-class safety), and orphans surfaces
# the three target-only classes with --auto-drop-safe handling just the safe one (T75,
# T76 seed-path regression). These commands produce the punch lists the AI walks during
# -UpdateSync; the scripts stay mechanical, the judgment stays with the AI. The apply
# surface lives in 04-upgrade-ops.sh, the safety perimeter in 06-upgrade-guards.sh.

echo "=== T67: merge-status classifies customizations[] entries against the fetched upstream (AI merge punch list) ==="
# Three entries cover three representative classes of the five-class taxonomy
# (identical, diverged, upstream-absent). T73 covers the other two (both-absent,
# local-absent). The script provides the punch list, the AI walks it during
# -UpdateSync to drop / merge / delete per entry.
MS="$BASE/merge-status"
MSENG="$(mk_proj "$MS" MsProj)"
MSSRC="$BASE/merge-status-src"
mk_src "$MSSRC" --empty-manifest
# Identical case: local matches upstream verbatim (no customization in practice).
# Diverged case: local has an extra marker the upstream lacks.
printf '\nDIVERGED_LOCAL_MARKER\n' >> "$MS/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md"
# Upstream-absent case: local has a file the upstream tree never shipped.
printf 'project-only canonical edit\n' > "$MS/AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md"
set_custom "$MS" "AIDOCS/SKILL/SKILL_UPDATE-SESSION.md" "AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" "AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md"
# Refuses cleanly when fetch was not run
MSREFUSE="$(cd "$MS" && rm -rf INSTALL/engine && node "$MSENG" merge-status 2>&1)"; MSREFCC=$?
echo "$MSREFUSE" | grep -q "no fetched engine" && pass "merge-status reports no fetched engine when INSTALL/engine missing" || fail "no missing-fetch message"
[ "$MSREFCC" = "20" ] && pass "merge-status exits 20 when fetch is missing" || fail "merge-status exit code on missing fetch was $MSREFCC (expected 20)"
# Fetch for the real run
node "$MSENG" fetch-engine --from "$MSSRC" >/dev/null 2>&1
MSOUT="$(node "$MSENG" merge-status 2>&1)"
echo "$MSOUT" | grep -q "identical (1)" && pass "merge-status reports the identical case (SKILL_UPDATE-SESSION.md untouched locally)" || fail "merge-status missed the identical case (output: $MSOUT)"
echo "$MSOUT" | grep -q "AIDOCS/SKILL/SKILL_UPDATE-SESSION.md" && pass "merge-status names the identical entry" || fail "merge-status did not name the identical entry"
echo "$MSOUT" | grep -q "diverged (1)" && pass "merge-status reports the diverged case (local has the extra marker)" || fail "merge-status missed the diverged case"
echo "$MSOUT" | grep -q "AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" && pass "merge-status names the diverged entry" || fail "merge-status did not name the diverged entry"
echo "$MSOUT" | grep -q "upstream-absent (1)" && pass "merge-status reports the upstream-absent case (local file with no upstream)" || fail "merge-status missed the upstream-absent case"
echo "$MSOUT" | grep -q "AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md" && pass "merge-status names the upstream-absent entry" || fail "merge-status did not name the upstream-absent entry"
echo "$MSOUT" | grep -q "Check MANIFEST.json" && pass "merge-status surfaces the upstream-absent decision-tree hint" || fail "no MANIFEST.json hint for upstream-absent"
# Empty customizations[]: clean no-op
set_custom "$MS"
EMPTY="$(node "$MSENG" merge-status 2>&1)"
echo "$EMPTY" | grep -q "nothing to merge" && pass "merge-status no-ops cleanly on empty customizations[]" || fail "merge-status did not report nothing-to-merge"

echo "=== T72: merge-status --auto-drop-clean trims identical only, leaves diverged + upstream-absent for AI judgment (safety: dropping upstream-absent could let upgrade delete a customized file) ==="
# The mechanical sweep half of -UpdateSync -FULL. Only identical and both-absent
# drop without AI judgment (file matches upstream verbatim, or no file on either
# side). Diverged, local-absent, and upstream-absent survive the sweep because
# dropping the customization there would let the next upgrade restore, delete, or
# overwrite a file the user has a position on.
AD="$BASE/auto-drop"
ADENG="$(mk_proj "$AD" AdProj)"
ADSRC="$BASE/auto-drop-src"
mk_src "$ADSRC" --empty-manifest
# Same shape as T67: identical / diverged / upstream-absent
printf '\nDIVERGED_LOCAL_MARKER\n' >> "$AD/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md"
printf 'project-only canonical edit\n' > "$AD/AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md"
set_custom "$AD" "AIDOCS/SKILL/SKILL_UPDATE-SESSION.md" "AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" "AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md"
node "$ADENG" fetch-engine --from "$ADSRC" >/dev/null 2>&1
ADOUT="$(node "$ADENG" merge-status --auto-drop-clean 2>&1)"
echo "$ADOUT" | grep -q "dropped 1 entry" && pass "auto-drop-clean reports the one clean drop (identical only - upstream-absent now retained for AI judgment)" || fail "auto-drop-clean did not report 1 drop (output: $ADOUT)"
echo "$ADOUT" | grep -q "identical to upstream" && pass "auto-drop-clean labels the identical drop" || fail "no identical-to-upstream label"
echo "$ADOUT" | grep -q "2 entries left for AI judgment" && pass "auto-drop-clean reports the two-entry remainder grouped by class" || fail "no AI-judgment remainder summary"
echo "$ADOUT" | grep -q "1 diverged" && pass "auto-drop-clean reports the diverged remainder count" || fail "no diverged count in summary"
echo "$ADOUT" | grep -q "1 upstream-absent" && pass "auto-drop-clean reports the upstream-absent remainder count" || fail "no upstream-absent count in summary"
# _index.json keeps both diverged AND upstream-absent (safety: upstream-absent no longer auto-drops)
ADREMAIN="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).customizations.sort().join(","))' "$AD/AIDOCS/_index.json")"
[ "$ADREMAIN" = "AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md,AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" ] && pass "_index.json customizations[] retained both judgment-required entries (diverged + upstream-absent)" || fail "customizations[] left as: $ADREMAIN"
# Re-fetch (engine cleanup) for idempotency check
node "$ADENG" fetch-engine --from "$ADSRC" >/dev/null 2>&1
ADRERUN="$(node "$ADENG" merge-status --auto-drop-clean 2>&1)"
echo "$ADRERUN" | grep -q "no clean entries to drop" && pass "auto-drop-clean idempotent: second pass reports no clean drops left" || fail "second auto-drop-clean pass did not no-op cleanly (output: $ADRERUN)"
# Empty customizations[] short-circuits even with the flag
set_custom "$AD"
ADEMPTY="$(node "$ADENG" merge-status --auto-drop-clean 2>&1)"
echo "$ADEMPTY" | grep -q "nothing to merge" && pass "auto-drop-clean honors the empty-customizations short-circuit" || fail "auto-drop-clean did not short-circuit on empty array"

echo "=== T73: merge-status --auto-drop-clean five-class safety (both-absent drops, local-absent survives) ==="
# The safety check for the two new classes split out of the old "absent" bucket.
# both-absent: customization is a dead reference, auto-drop is safe.
# local-absent: upstream has the file, project does not. Dropping the customization
# would let the next upgrade restore the file. Survives auto-drop for AI judgment.
SC="$BASE/safety-classes"
SCENG="$(mk_proj "$SC" ScProj)"
SCSRC="$BASE/safety-classes-src"
mk_src "$SCSRC" --empty-manifest
# both-absent: no file in project, no file in upstream (the source repo never had it either)
# local-absent: upstream has the file, project deleted it
rm "$SC/AIDOCS/SKILL/SKILL_DEV-AUDIT.md"
set_custom "$SC" "AIDOCS/SKILL/SKILL_BOTH-ABSENT.md" "AIDOCS/SKILL/SKILL_DEV-AUDIT.md"
node "$SCENG" fetch-engine --from "$SCSRC" >/dev/null 2>&1
SCSTATUS="$(node "$SCENG" merge-status 2>&1)"
echo "$SCSTATUS" | grep -q "both-absent (1)" && pass "merge-status surfaces the both-absent class for SKILL_BOTH-ABSENT.md" || fail "no both-absent class in read-only output"
echo "$SCSTATUS" | grep -q "local-absent (1)" && pass "merge-status surfaces the local-absent class for SKILL_DEV-AUDIT.md" || fail "no local-absent class in read-only output"
SCOUT="$(node "$SCENG" merge-status --auto-drop-clean 2>&1)"
echo "$SCOUT" | grep -q "dropped 1 entry" && pass "auto-drop-clean drops both-absent without AI judgment" || fail "auto-drop-clean did not drop both-absent (output: $SCOUT)"
echo "$SCOUT" | grep -q "both-absent" && pass "auto-drop-clean labels the both-absent drop" || fail "no both-absent label"
# local-absent must survive: dropping would let upgrade copy the file back
[ "$(reg_get "$SC" customizations)" = '["AIDOCS/SKILL/SKILL_DEV-AUDIT.md"]' ] && pass "local-absent customization survived auto-drop-clean (safety: upgrade would restore the file otherwise)" || fail "local-absent class wrongly dropped (customizations[] left as: $(reg_get "$SC" customizations))"

echo "=== T75: orphans surfaces three classes (safe / review-skill / review-automemory) and --auto-drop-safe only drops the safe class ==="
# The AI-steered cleanup half: read-only by default so the AI walks each class and
# decides per file. --auto-drop-safe handles the mechanically safe class only
# (AIDOCS/tools/lib + AIDOCS/tools/*.md - no user files live there). The two review
# classes always need AI judgment because a project-custom skill or auto-memory rule
# could be there.
ORP="$BASE/orphans"
ORPENG="$(mk_proj "$ORP" OrpProj)"
ORPSRC="$BASE/orphans-src"
mk_src "$ORPSRC" --empty-manifest
# Plant orphans in each class (these files exist in project, not in upstream)
printf '// legacy engine helper\n' > "$ORP/AIDOCS/tools/lib/legacy-helper.mjs"
printf '# Legacy pattern\n**Purpose:** stale.\n' > "$ORP/AIDOCS/tools/PATTERN-LEGACY.md"
printf -- '---\nname: projectcustom\ndescription: project-only skill\n---\n# /321 -ProjectCustom\n**Purpose:** project-owned skill body.\n' > "$ORP/AIDOCS/SKILL/SKILL_PROJECT-CUSTOM.md"
printf '# Project rule\n' > "$ORP/AIDOCS/automemory/project_local_rule.md"
# Refuses without a fetch
ORPNOFETCH="$(node "$ORPENG" orphans 2>&1)"; ORPNFCC=$?
echo "$ORPNOFETCH" | grep -q "no fetched engine" && pass "orphans reports no fetched engine when INSTALL/engine is missing" || fail "no missing-fetch message (output: $ORPNOFETCH)"
[ "$ORPNFCC" = "20" ] && pass "orphans exits 20 when fetch is missing" || fail "orphans exit code on missing fetch was $ORPNFCC (expected 20)"
node "$ORPENG" fetch-engine --from "$ORPSRC" >/dev/null 2>&1
# Read-only walk: surfaces all three classes
ORPOUT="$(node "$ORPENG" orphans 2>&1)"
echo "$ORPOUT" | grep -q "safe (2)" && pass "orphans surfaces 2 safe orphans (legacy-helper.mjs + PATTERN-LEGACY.md)" || fail "no safe count (output: $ORPOUT)"
echo "$ORPOUT" | grep -q "AIDOCS/tools/lib/legacy-helper.mjs" && pass "orphans names the lib/ orphan" || fail "lib orphan not named"
echo "$ORPOUT" | grep -q "AIDOCS/tools/PATTERN-LEGACY.md" && pass "orphans names the tools/*.md orphan" || fail "pattern orphan not named"
echo "$ORPOUT" | grep -q "review-skill (1)" && pass "orphans surfaces the review-skill class for SKILL_PROJECT-CUSTOM.md" || fail "no review-skill count (output: $ORPOUT)"
echo "$ORPOUT" | grep -q "AIDOCS/SKILL/SKILL_PROJECT-CUSTOM.md" && pass "orphans names the review-skill orphan" || fail "review-skill orphan not named"
echo "$ORPOUT" | grep -q "review-automemory (1)" && pass "orphans surfaces the review-automemory class for project_local_rule.md" || fail "no review-automemory count (output: $ORPOUT)"
echo "$ORPOUT" | grep -q "project_local_rule.md" && pass "orphans names the review-automemory orphan" || fail "review-automemory orphan not named"
# customizations[] guard: list a safe orphan, verify it gets filtered out
set_custom "$ORP" "AIDOCS/tools/PATTERN-LEGACY.md"
ORPGUARDED="$(node "$ORPENG" orphans 2>&1)"
echo "$ORPGUARDED" | grep -q "safe (1)" && pass "customizations[] guard filters the listed orphan out of the safe class" || fail "customizations[] not honored in safe-class scan"
echo "$ORPGUARDED" | grep -q "PATTERN-LEGACY.md" && fail "the customized orphan still appears in safe (guard broken)" || pass "customized orphan absent from safe class output"
# Clear customizations for the drop test
set_custom "$ORP"
# --auto-drop-safe: drops the 2 safe orphans, leaves the review classes
ORPDROP="$(node "$ORPENG" orphans --auto-drop-safe 2>&1)"
echo "$ORPDROP" | grep -q "dropped 2 files" && pass "auto-drop-safe drops the 2 safe orphans" || fail "auto-drop-safe count wrong (output: $ORPDROP)"
[ ! -f "$ORP/AIDOCS/tools/lib/legacy-helper.mjs" ] && pass "lib/legacy-helper.mjs removed by auto-drop-safe" || fail "lib orphan not removed"
[ ! -f "$ORP/AIDOCS/tools/PATTERN-LEGACY.md" ] && pass "PATTERN-LEGACY.md removed by auto-drop-safe" || fail "pattern orphan not removed"
# Review classes preserved
[ -f "$ORP/AIDOCS/SKILL/SKILL_PROJECT-CUSTOM.md" ] && pass "review-skill orphan PRESERVED (AI judgment required)" || fail "review-skill orphan wrongly deleted"
[ -f "$ORP/AIDOCS/automemory/project_local_rule.md" ] && pass "review-automemory orphan PRESERVED (AI judgment required)" || fail "review-automemory orphan wrongly deleted"
echo "$ORPDROP" | grep -q "2 files left for AI judgment" && pass "auto-drop-safe summary names the review-class remainder count" || fail "no review-class remainder summary"
# Idempotency: re-running with no safe orphans is a clean no-op
node "$ORPENG" fetch-engine --from "$ORPSRC" >/dev/null 2>&1
ORPRERUN="$(node "$ORPENG" orphans --auto-drop-safe 2>&1)"
echo "$ORPRERUN" | grep -q "no safe orphans to drop" && pass "auto-drop-safe idempotent: no safe orphans left after first sweep" || fail "second auto-drop-safe pass did not no-op cleanly"
# Clean project (no orphans at all): friendly no-op message
CLEAN="$BASE/orphans-clean"
CLEANENG="$(mk_proj "$CLEAN" CleanProj)"
node "$CLEANENG" fetch-engine --from "$ORPSRC" >/dev/null 2>&1
ORPCLEAN="$(node "$CLEANENG" orphans 2>&1)"
echo "$ORPCLEAN" | grep -q "nothing to clean" && pass "orphans reports nothing-to-clean on a freshly synced project" || fail "no nothing-to-clean message on clean project (output: $ORPCLEAN)"

echo "=== T76: orphans seed-path regression - relocated project seed still compares against canonical upstream by basename ==="
# Codex caught a bug in the orphan scan: listAutoMemoryFiles used the project's
# auto_memory.seed for BOTH project and upstream scans. A project with a relocated
# seed would misclassify every canonical rule as review-automemory (upstream scan
# would look in the wrong path inside INSTALL/engine and find nothing). The fix
# hardcodes the canonical seed for the upstream scan and compares basenames so a
# relocated seed still recognizes canonical rules. T76 verifies the fix end-to-end.
SP="$BASE/seed-path"
SPENG="$(mk_proj "$SP" SpProj)"
# Relocate the project seed to a non-canonical path. Move the existing rules into it.
mkdir -p "$SP/AIDOCS/project-rules"
cp "$SP/AIDOCS/automemory/"feedback_*.md "$SP/AIDOCS/project-rules/" 2>/dev/null
cp "$SP/AIDOCS/automemory/user_name.md" "$SP/AIDOCS/project-rules/" 2>/dev/null
# Update the registry to point auto_memory.seed at the relocated path
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.auto_memory.seed="./AIDOCS/project-rules";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$SP/AIDOCS/_index.json"
# Plant a project-only rule in the relocated seed (this SHOULD show as review-automemory)
printf '# Project rule\n' > "$SP/AIDOCS/project-rules/project_relocated_only.md"
# Fetch upstream (the source has its canonical AIDOCS/automemory layout)
node "$SPENG" fetch-engine --from "$ORPSRC" >/dev/null 2>&1
SPOUT="$(node "$SPENG" orphans 2>&1)"
# The canonical rules (feedback_*.md, user_name.md) MUST NOT show as orphans even though
# they live at a non-canonical project path - the basename comparison handles this.
echo "$SPOUT" | grep -q "feedback_naming.md" && fail "canonical feedback_naming.md misclassified as review-automemory (basename comparison broken)" || pass "canonical feedback_naming.md recognized despite relocated project seed"
echo "$SPOUT" | grep -q "feedback_lean_docs.md" && fail "canonical feedback_lean_docs.md misclassified (basename comparison broken)" || pass "canonical feedback_lean_docs.md recognized despite relocated project seed"
echo "$SPOUT" | grep -q "user_name.md" && fail "canonical user_name.md misclassified (basename comparison broken)" || pass "canonical user_name.md recognized despite relocated project seed"
# The genuine project-only rule SHOULD show as review-automemory
echo "$SPOUT" | grep -q "project_relocated_only.md" && pass "project-only rule at relocated seed correctly flagged as review-automemory" || fail "project-only rule not flagged (output: $SPOUT)"
