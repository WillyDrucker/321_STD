# 07-sync-judgment.sh - the read + AI-judgment surface of -UpdateSync: compare reports the
# version and pending-op delta (T79), merge-status classifies customizations[] entries
# against the fetched upstream (T67), --auto-drop-clean trims only the mechanically safe
# classes (T72, T73 five-class safety), and orphans surfaces the target-only classes with
# --auto-drop-safe handling just the safe one (T75, T76 seed-path regression, T77 the
# import-aware brick guard). These commands produce the punch lists the AI walks during
# -UpdateSync. The scripts stay mechanical, the judgment stays with the AI. The apply
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

echo "=== T77: orphans holds a still-imported engine module out of the safe class (the camelCase-rename brick guard) ==="
# Reproduces the 0.1.15 rename hazard: a downstream engine still imports a module under a
# name absent upstream (kebab fetch-engine.mjs vs camel fetchEngine.mjs). The pre-upgrade
# sweep must NOT drop a module the running engine imports, or the next engine call dies
# with ERR_MODULE_NOT_FOUND before upgrade can land the new tree. Here a project-only lib
# imported by the engine stands in for the not-yet-renamed module (HELD), and a second
# project-only lib imported by nobody is the genuine dead orphan (DROPPED).
GUARD="$BASE/orphan-guard"
GUARDENG="$(mk_proj "$GUARD" GuardProj)"
GUARDSRC="$BASE/orphan-guard-src"
mk_src "$GUARDSRC" --empty-manifest
# still-imported.mjs: a live module (the engine imports it) absent upstream -> must be HELD.
printf '// planted live module for the orphan guard test\nexport const planted = true;\n' > "$GUARD/AIDOCS/tools/lib/still-imported.mjs"
printf '\nimport "./lib/still-imported.mjs";\n' >> "$GUARD/AIDOCS/tools/engine.mjs"
# dyn-imported.mjs: referenced only via a dynamic import() in a never-called function -> must
# be HELD too (the scan covers the import() form, not just static from/side-effect imports).
printf '// planted dynamically-imported module\nexport const dyn = true;\n' > "$GUARD/AIDOCS/tools/lib/dyn-imported.mjs"
printf '\nexport function _dynRef() { return import("./lib/dyn-imported.mjs"); }\n' >> "$GUARD/AIDOCS/tools/engine.mjs"
# truly-dead.mjs: a module imported by nobody, absent upstream -> genuine safe orphan.
printf '// planted dead module\n' > "$GUARD/AIDOCS/tools/lib/truly-dead.mjs"
node "$GUARDENG" fetch-engine --from "$GUARDSRC" >/dev/null 2>&1
# Read-only walk: still-imported is live-import, truly-dead is safe.
GOUT="$(node "$GUARDENG" orphans 2>&1)"
echo "$GOUT" | grep -q "live-import (2)" && pass "orphans surfaces the live-import class for both held modules (static + dynamic)" || fail "no live-import (2) class (output: $GOUT)"
echo "$GOUT" | grep -q "still-imported.mjs" && pass "orphans names the static-import held module" || fail "static-import module not named (output: $GOUT)"
echo "$GOUT" | grep -q "dyn-imported.mjs" && pass "orphans holds a dynamically-imported module too (import() coverage)" || fail "dynamic-import module not held (output: $GOUT)"
echo "$GOUT" | grep -q "safe (1)" && pass "orphans keeps the genuinely-dead module in the safe class" || fail "dead module not in safe class (output: $GOUT)"
echo "$GOUT" | grep -q "truly-dead.mjs" && pass "orphans names the dead safe orphan" || fail "dead orphan not named (output: $GOUT)"
# --auto-drop-safe: drops the dead one, HOLDS the live ones.
GDROP="$(node "$GUARDENG" orphans --auto-drop-safe 2>&1)"
[ ! -f "$GUARD/AIDOCS/tools/lib/truly-dead.mjs" ] && pass "auto-drop-safe removed the genuinely-dead module" || fail "dead module not removed"
[ -f "$GUARD/AIDOCS/tools/lib/still-imported.mjs" ] && pass "auto-drop-safe HELD the still-imported module (brick prevented)" || fail "still-imported module wrongly dropped (would brick the engine)"
[ -f "$GUARD/AIDOCS/tools/lib/dyn-imported.mjs" ] && pass "auto-drop-safe HELD the dynamically-imported module" || fail "dynamic-import module wrongly dropped"
echo "$GDROP" | grep -q "held in live-import" && pass "auto-drop-safe summary reports the live-import holds (not silently omitted)" || fail "post-drop summary did not mention the live-import holds (output: $GDROP)"
# The money check: the engine still loads after the sweep (no ERR_MODULE_NOT_FOUND).
node "$GUARDENG" help >/dev/null 2>&1 && pass "engine still loads after the sweep (import-aware guard prevented the brick)" || fail "engine failed to load after auto-drop-safe (brick not prevented)"

echo "=== T79: compare reports the version delta and pending manifest ops (the read-only is-there-anything-to-sync check) ==="
# H3: answers "do I need to sync" without a hand-rolled manifest diff. Reads local
# engine.version + operations_applied[] and the fetched upstream version + MANIFEST.json,
# prints the version line and the names of ops present upstream but not yet applied.
CMP="$BASE/compare"
CMPENG="$(mk_proj "$CMP" CmpProj)"
CMPSRC="$BASE/compare-src"
mk_src "$CMPSRC" --version 9.9.9
# Lay a one-op manifest upstream (the project's operations_applied[] is empty after init).
cat > "$CMPSRC/AIDOCS/MANIFEST.json" <<'JSON'
{ "operations": [ { "name": "demo_pending_op", "type": "file_delete", "file": "AIDOCS/tools/nonexistent.md" } ] }
JSON
# Refuses cleanly without a fetch
CMPNF="$(node "$CMPENG" compare 2>&1)"; CMPNFCC=$?
echo "$CMPNF" | grep -q "no fetched engine" && pass "compare reports no fetched engine when INSTALL/engine is missing" || fail "no missing-fetch message (output: $CMPNF)"
[ "$CMPNFCC" = "20" ] && pass "compare exits 20 when fetch is missing" || fail "compare exit on missing fetch was $CMPNFCC (expected 20)"
node "$CMPENG" fetch-engine --from "$CMPSRC" >/dev/null 2>&1
# Version delta + pending op surfaced, exit 0 (read-only)
CMPOUT="$(node "$CMPENG" compare 2>&1)"; CMPCC=$?
[ "$CMPCC" = "0" ] && pass "compare exits 0 (read-only check)" || fail "compare exit was $CMPCC (expected 0)"
echo "$CMPOUT" | grep -q "upstream 9.9.9" && pass "compare prints the local-vs-upstream version delta" || fail "no version delta (output: $CMPOUT)"
echo "$CMPOUT" | grep -q "1 operation(s) pending" && pass "compare counts the pending manifest op" || fail "no pending-op count (output: $CMPOUT)"
echo "$CMPOUT" | grep -q "demo_pending_op (file_delete)" && pass "compare names the pending op with its type" || fail "pending op not named (output: $CMPOUT)"
# Apply the op: pending drops to 0 but the version still differs -> engine-only refresh
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.engine.operations_applied=["demo_pending_op"];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$CMP/AIDOCS/_index.json"
CMPDONE="$(node "$CMPENG" compare 2>&1)"
echo "$CMPDONE" | grep -q "no structural operations are pending" && pass "compare reports engine-only refresh when ops are applied but version differs" || fail "no engine-only-refresh message (output: $CMPDONE)"
# Match the version too -> fully up to date
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.engine.version="9.9.9";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$CMP/AIDOCS/_index.json"
CMPUTD="$(node "$CMPENG" compare 2>&1)"
echo "$CMPUTD" | grep -q "up to date" && pass "compare reports up-to-date when version matches and no ops pending" || fail "no up-to-date message (output: $CMPUTD)"
echo "$CMPUTD" | grep -q "both 9.9.9" && pass "compare prints the matched-version line" || fail "no matched-version line (output: $CMPUTD)"
