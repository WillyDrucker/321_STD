# 01-migration.sh - the migration arc that runs against the shared OLD321 -> NEW321
# fixture: bootstrap rename, archive lanes (data docs + legacy *_ARCHIVE dirs +
# auto-memory snapshot + SKILL snapshot + MANIFEST.json), reinstall, restore, and the
# 1:1 migrate-import scavenge with the audit fuzzy match. Tests T1-T5 mutate $PROJ in
# order, so they stay in one file - the post-T5 state is the baseline the migrate-import
# audit and the legacy SKILLS sweep build on. The isolated migrate-import / migrate-archive
# coverage (containment, pre-flight restore, MANIFEST classification, sub-label fold,
# DEV-STANDARDS hyphen) follows in the same file because the domain is the same.

echo "=== T1: init renaming - bootstrap over a foreign-named project skips data scaffolds ==="
node "$RENG" init "$PROJ" --name NEW321 >/dev/null 2>&1
[ ! -f AIDOCS/NEW321_MEMORY.md ] && pass "no NEW321_MEMORY.md laid at bootstrap rename" || fail "NEW321_MEMORY.md was laid at bootstrap (pollution)"
[ ! -f AIDOCS/NEW321_DEV-AUDIT.md ] && pass "no NEW321_DEV-AUDIT.md laid at bootstrap rename" || fail "NEW321_DEV-AUDIT.md was laid at bootstrap (pollution)"
[ -f AIDOCS/OLD321_MEMORY.md ] && pass "OLD321_MEMORY.md preserved at bootstrap" || fail "OLD321_MEMORY.md missing after bootstrap"
[ -f "$ENG" ] && pass "engine copied into scratch at bootstrap" || fail "engine not copied into scratch"

echo "=== T1c: bootstrap init preserves project auto-memory (write-if-missing, not overwrite) ==="
grep -q 'CUSTOM_RULE_MARKER' AIDOCS/automemory/feedback_code_comments.md && pass "edited canonical rule preserved at bootstrap" || fail "edited canonical rule overwritten by canonical (data loss)"
[ -f AIDOCS/automemory/feedback_project_custom.md ] && pass "custom-only rule preserved at bootstrap" || fail "custom-only rule lost at bootstrap"

echo "=== T1b: init fresh - empty project DOES get data scaffolds ==="
mkdir -p "$FRESH"
node "$RENG" init "$FRESH" --name NEW321 >/dev/null 2>&1
[ -f "$FRESH/AIDOCS/NEW321_MEMORY.md" ] && pass "fresh install lays NEW321_MEMORY.md" || fail "fresh install did not lay NEW321_MEMORY.md"

echo "=== T2: migrate-archive sweeps data docs AND legacy *_ARCHIVE dirs ==="
node "$ENG" migrate-archive --name NEW321 >/dev/null 2>&1
ARCH="AIDOCS/NEW321_SETUP_ARCHIVE/AIDOCS"
[ -z "$(ls AIDOCS | grep '^OLD321_' )" ] && pass "no OLD321_* left at AIDOCS root" || fail "OLD321_* still at AIDOCS root: $(ls AIDOCS | grep '^OLD321_')"
[ -d "$ARCH/OLD321_MEMORY_ARCHIVE" ] && pass "legacy OLD321_MEMORY_ARCHIVE dir swept to archive" || fail "OLD321_MEMORY_ARCHIVE dir not swept"
[ -d "$ARCH/OLD321_SESSION_ARCHIVE" ] && pass "legacy OLD321_SESSION_ARCHIVE dir swept" || fail "OLD321_SESSION_ARCHIVE dir not swept"
[ -d "$ARCH/OLD321_BACKLOG_ARCHIVE" ] && pass "legacy OLD321_BACKLOG_ARCHIVE dir swept" || fail "OLD321_BACKLOG_ARCHIVE dir not swept"
[ -f "$ARCH/OLD321_DEV-AUDIT.md" ] && pass "OLD321_DEV-AUDIT.md swept to archive" || fail "OLD321_DEV-AUDIT.md not in archive"
[ -d "AIDOCS/NEW321_SETUP_ARCHIVE" ] && [ ! -d "$ARCH/NEW321_SETUP_ARCHIVE" ] && pass "SETUP_ARCHIVE itself not swept into itself" || fail "SETUP_ARCHIVE recursed into itself"
[ -f AIDOCS/ENV/keys.md ] && pass "ENV/keys.md left in place (not archived)" || fail "ENV/keys.md was moved"
# Hardening: the old .gitignore is archived, but a canonical one is re-laid at root the
# same step, so there is no bare-root window before the reinstall's init where a concurrent
# `git add` could stage ignored content (node_modules, secrets).
[ -f .gitignore ] && pass "migrate-archive re-laid .gitignore (no bare-root window)" || fail "root left without a .gitignore after migrate-archive"
grep -qE '^node_modules/$' .gitignore && pass "re-laid .gitignore carries Tier C (node_modules ignored in the window)" || fail "re-laid .gitignore missing node_modules"
[ -f "AIDOCS/NEW321_SETUP_ARCHIVE/.gitignore" ] && grep -q 'OLD_CUSTOM_IGNORE' "AIDOCS/NEW321_SETUP_ARCHIVE/.gitignore" && pass "original .gitignore preserved in the archive for the union-merge" || fail "original .gitignore not archived"

echo "=== T3 (defense-in-depth): plant an empty NEW321_DEV-AUDIT.md beside the real OLD321 one in the archive ==="
cat > "$ARCH/NEW321_DEV-AUDIT.md" <<'EOF'
# NEW321 - DEV-AUDIT

**Purpose:** audit.

## Project specifics

(fill in)
EOF

echo "=== reinstall (post-archive empty tree) ==="
node "$RENG" init "$PROJ" --name NEW321 >/dev/null 2>&1
[ -f AIDOCS/NEW321_MEMORY.md ] && pass "reinstall lays NEW321_MEMORY.md (renaming=false now)" || fail "reinstall did not lay NEW321_MEMORY.md"

echo "=== T1d: project auto-memory archived for reconcile; reinstall lays canonical fresh ==="
grep -q 'CUSTOM_RULE_MARKER' "$ARCH/automemory/feedback_code_comments.md" && pass "edited rule preserved in archive for reconcile merge" || fail "edited rule not in archive"
[ -f AIDOCS/automemory/feedback_code_comments.md ] && ! grep -q 'CUSTOM_RULE_MARKER' AIDOCS/automemory/feedback_code_comments.md && pass "reinstall laid canonical auto-memory fresh (marker gone)" || fail "reinstall did not lay canonical auto-memory"

echo "=== T5: reinstalled MEMORY_EXTENDED has no Big-6 mirror, has LIFO ==="
if grep -qE '^## (Overview|Stack|Architecture|Environment|Pipeline|Conventions)$' AIDOCS/NEW321_MEMORY_EXTENDED.md; then fail "NEW321_MEMORY_EXTENDED still has Big-6 sections"; else pass "NEW321_MEMORY_EXTENDED has no Big-6 sections"; fi
grep -q '^## LIFO' AIDOCS/NEW321_MEMORY_EXTENDED.md && pass "NEW321_MEMORY_EXTENDED has ## LIFO" || fail "NEW321_MEMORY_EXTENDED missing ## LIFO"
grep -qE '^## (Overview|Stack|Architecture)$' AIDOCS/NEW321_MEMORY.md && pass "NEW321_MEMORY keeps Big-6 (correct)" || fail "NEW321_MEMORY lost its Big-6"

echo "=== T3: migrate-restore picks the REAL OLD321 DEV-AUDIT content, not the empty NEW321 scaffold ==="
node "$ENG" migrate-restore --name NEW321 >/dev/null 2>&1
grep -q 'MARKER_DEVAUDIT_REAL' AIDOCS/NEW321_DEV-AUDIT.md && pass "DEV-AUDIT Project specifics restored from real source" || fail "DEV-AUDIT specifics NOT restored (empty scaffold shadowed it)"
grep -q 'MARKER_AUTOPUSH_REAL' AIDOCS/NEW321_AUTO-PUSH.md && pass "AUTO-PUSH release steps restored from real source" || fail "AUTO-PUSH steps NOT restored"
grep -q 'OLD_CUSTOM_IGNORE' .gitignore && pass ".gitignore union-merged (custom ignore preserved)" || fail ".gitignore custom ignore lost"
grep -q 'kept verbatim' WDDOCS/userdoc.md && pass "WDDOCS restored verbatim" || fail "WDDOCS not restored"
grep -q 'MARKER_BACKLOG_FEATURE' AIDOCS/NEW321_BACKLOG.md && pass "BACKLOG Features restored from archive" || fail "BACKLOG Features NOT restored"
grep -q 'MARKER_BACKLOG_IDEA' AIDOCS/NEW321_BACKLOG.md && pass "BACKLOG Ideas restored from archive" || fail "BACKLOG Ideas NOT restored"

echo "=== T4: migrate-import skips the legacy Big-6 mirror, keeps the real LIFO entry ==="
IMP="$(node "$ENG" migrate-import --from "$ARCH/OLD321_MEMORY_EXTENDED.md" --skill updatememory --old OLD321 --new NEW321 --dry-run 2>&1)"
echo "$IMP" | grep -q 'A Real Durable Decision' && pass "real LIFO entry imported" || fail "real LIFO entry NOT imported"
if echo "$IMP" | grep -qiE '#\s+(Overview|Stack|Architecture|Environment|Pipeline|Conventions)'; then fail "Big-6 mirror section was imported as a bullet"; else pass "Big-6 mirror sections skipped on import"; fi

echo "=== T24: migrate-import --from rejects a path escaping the root (isContained) ==="
node "$ENG" migrate-import --from "../../../etc/passwd" --skill updatememory >/dev/null 2>&1; RC=$?
[ "$RC" = "5" ] && pass "migrate-import --from rejects an escaping path (exit 5)" || fail "migrate-import --from accepted an escaping path (exit $RC)"

echo "=== T25: migrate-archive snapshots AIDOCS/SKILL (copy, not move) for in-place customization recovery ==="
SS_25="$BASE/skillsnap"
node "$RENG" init "$SS_25" --name SkillSnap >/dev/null 2>&1
SSENG_25="$SS_25/AIDOCS/tools/engine.mjs"
# customize a skill body in place (the legacy pre-data-doc model)
printf '\nCUSTOM_SKILL_MARKER: project-specific in-place edit.\n' >> "$SS_25/AIDOCS/SKILL/SKILL_AUTO-PUSH.md"
node "$SSENG_25" migrate-archive --name SkillSnap >/dev/null 2>&1
SARCH="$SS_25/AIDOCS/SkillSnap_SETUP_ARCHIVE/AIDOCS/SKILL"
[ -f "$SARCH/SKILL_AUTO-PUSH.md" ] && pass "SKILL snapshotted into the archive" || fail "SKILL not snapshotted into archive"
grep -q 'CUSTOM_SKILL_MARKER' "$SARCH/SKILL_AUTO-PUSH.md" 2>/dev/null && pass "in-place customization preserved in the snapshot" || fail "customization not in the snapshot"
[ -f "$SS_25/AIDOCS/SKILL/SKILL_AUTO-PUSH.md" ] && grep -q 'CUSTOM_SKILL_MARKER' "$SS_25/AIDOCS/SKILL/SKILL_AUTO-PUSH.md" && pass "live SKILL kept (copy, not move)" || fail "live SKILL was moved, not copied"

echo "=== T49: migrate-archive sweeps legacy AIDOCS/SKILLS/ (plural) into the archive ==="
LS="$BASE/legacyskills"
node "$RENG" init "$LS" --name LsProj >/dev/null 2>&1
LSENG="$LS/AIDOCS/tools/engine.mjs"
# Lay the legacy plural directory the pre-engine 321 shape carried.
mkdir -p "$LS/AIDOCS/SKILLS"
printf 'legacy plural skill body\n' > "$LS/AIDOCS/SKILLS/SKILL_LEGACY.md"
node "$LSENG" migrate-archive --name LsProj >/dev/null 2>&1
[ ! -d "$LS/AIDOCS/SKILLS" ] && pass "migrate-archive swept the legacy AIDOCS/SKILLS/ out of the project tree" || fail "legacy AIDOCS/SKILLS/ left in the project tree"
[ -d "$LS/AIDOCS/LsProj_SETUP_ARCHIVE/AIDOCS/SKILLS_legacy" ] && pass "legacy SKILLS landed in the archive as SKILLS_legacy/" || fail "legacy SKILLS not in SKILLS_legacy/"
[ -f "$LS/AIDOCS/LsProj_SETUP_ARCHIVE/AIDOCS/SKILLS_legacy/SKILL_LEGACY.md" ] && pass "legacy SKILLS contents preserved in the archive" || fail "legacy SKILLS contents lost"
# Idempotent re-run: second invocation must not error even though there is nothing left to move.
node "$LSENG" migrate-archive --name LsProj >/dev/null 2>&1 && pass "migrate-archive re-run is idempotent (legacy SKILLS already moved)" || fail "migrate-archive re-run failed"

echo "=== T52: migrate-archive pre-flight auto-restores tracked files deleted in the worktree ==="
PF="$BASE/preflight"
node "$RENG" init "$PF" --name PfProj >/dev/null 2>&1
# Make it a real git repo so ls-files works
( cd "$PF" && git init --quiet && git config user.email t@t.t && git config user.name t && git add -A 2>/dev/null && git commit -q -m initial 2>/dev/null ) >/dev/null 2>&1
# Delete a tracked, migration-relevant file from the worktree only (still in HEAD)
rm "$PF/AGENTS.md"
[ ! -f "$PF/AGENTS.md" ] && pass "AGENTS.md deleted from worktree pre-archive" || fail "test setup: AGENTS.md not gone"
# Also delete a non-relevant tracked file - the pre-flight must NOT restore it
echo "stub" > "$PF/IRRELEVANT.txt"
( cd "$PF" && git add IRRELEVANT.txt && git commit -q -m irrelevant ) >/dev/null 2>&1
rm "$PF/IRRELEVANT.txt"
PFOUT="$(node "$PF/AIDOCS/tools/engine.mjs" migrate-archive --name PfProj 2>&1)"
echo "$PFOUT" | grep -q "pre-flight restored 1 tracked file" && pass "pre-flight reports the restored count" || fail "pre-flight did not report restore (output: $PFOUT)"
echo "$PFOUT" | grep -q "+ AGENTS.md" && pass "pre-flight names the restored file" || fail "pre-flight did not name AGENTS.md"
[ -f "$PF/AIDOCS/PfProj_SETUP_ARCHIVE/AGENTS.md" ] && pass "restored AGENTS.md got archived (not the empty scaffold)" || fail "restored AGENTS.md not archived"
[ ! -f "$PF/IRRELEVANT.txt" ] && pass "pre-flight left the non-migration deletion alone" || fail "pre-flight wrongly restored IRRELEVANT.txt"

echo "=== T53: migrate-archive writes MANIFEST.json; migrate-import --from-archive reads it ==="
MF="$BASE/manifest"
node "$RENG" init "$MF" --name MfProj >/dev/null 2>&1
# Lay a legacy-named data doc (the WD_ prefix + SESSION_HANDOFF infix) to test classification
mkdir -p "$MF/AIDOCS"
cat > "$MF/AIDOCS/WD_OLDPROJ_SESSION_HANDOFF_EXTENDED.md" <<'EOF'
# WD_OLDPROJ SESSION (depth)

## LIFO

### Archived legacy session entry one

Body of the legacy entry one.

### Archived legacy session entry two

Body of the legacy entry two.
EOF
cat > "$MF/AIDOCS/WD_OLDPROJ_MEMORY_EXTENDED.md" <<'EOF'
# WD_OLDPROJ MEMORY (depth)

## LIFO

### Archived legacy memory entry

Body of the legacy memory entry.
EOF
node "$MF/AIDOCS/tools/engine.mjs" migrate-archive --name MfProj >/dev/null 2>&1
MFMF="$MF/AIDOCS/MfProj_SETUP_ARCHIVE/MANIFEST.json"
[ -f "$MFMF" ] && pass "migrate-archive wrote MANIFEST.json into the archive" || fail "MANIFEST.json missing"
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit(j.target_project_name==="MfProj" && j.source_project_name==="WD_OLDPROJ" && Array.isArray(j.moved) ? 0 : 1)' "$MFMF" && pass "MANIFEST.json carries target + detected source prefix (prefers non-target prefix)" || fail "MANIFEST.json missing target / source (heuristic picked the wrong prefix?)"
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));const s=j.moved.find(m=>m.role==="session_extended"&&m.legacy_naming==="SESSION_HANDOFF");process.exit(s && s.old_prefix==="WD_OLDPROJ" ? 0 : 1)' "$MFMF" && pass "MANIFEST records SESSION_HANDOFF legacy_naming + WD_OLDPROJ prefix" || fail "MANIFEST classifyMove failed on legacy naming"
# Re-init the relay: migrate-archive carried _index.json into the archive, so init lays a
# fresh one (and the canonical scaffolds) before migrate-import can run against the registry.
node "$RENG" init "$MF" --name MfProj >/dev/null 2>&1
# migrate-import --from-archive resolves --from from MANIFEST
MFIOUT="$(node "$MF/AIDOCS/tools/engine.mjs" migrate-import --from-archive "AIDOCS/MfProj_SETUP_ARCHIVE" --skill updatesession --dry-run 2>&1)"
echo "$MFIOUT" | grep -q "resolved from manifest" && pass "migrate-import --from-archive reports resolution from manifest" || fail "migrate-import did not resolve from manifest (output: $MFIOUT)"
echo "$MFIOUT" | grep -q "WD_OLDPROJ_SESSION_HANDOFF_EXTENDED" && pass "migrate-import resolved the legacy-named source file via manifest" || fail "migrate-import did not pick the SESSION_HANDOFF file"

echo "=== T50: migrate-import --audit surfaces fuzzy candidates for entries not found verbatim ==="
FZ="$BASE/fuzzy"
node "$RENG" init "$FZ" --name FzProj >/dev/null 2>&1
FZENG="$FZ/AIDOCS/tools/engine.mjs"
mkdir -p "$FZ/AIDOCS/FzProj_SETUP_ARCHIVE/AIDOCS"
# Archived EXTENDED carries four entries: one trimmed in distillation (fuzzy candidate),
# one merged into Big-6 (no candidate), one deliberately dropped (no candidate), one
# survives verbatim.
cat > "$FZ/AIDOCS/FzProj_SETUP_ARCHIVE/AIDOCS/FzProj_SESSION_EXTENDED.md" <<'EOF'
# FzProj SESSION (depth)

## Recent

### 16 architectural patterns preserved from pre-rename APD CLAUDE SESSION HANDOFF

Detail body for the patterns entry that the reconcile pass plans to fold under a shorter heading.

### Vanilla JS plus native ES modules plus no build

Detail body for the stack entry that the reconcile pass plans to merge into a Big-6 Stack section.

### Old session entry that was deliberately dropped

Detail body for the dropped entry. The reconcile pass intentionally removes it because it is resolved.

### Exact match entry that survived verbatim

Detail body for the entry whose heading survives unchanged after distillation.
EOF
# Distilled EXTENDED keeps a trimmed version of the first heading plus the verbatim survivor.
EXT_REL=$(node -e 'const j=require(process.argv[1]);process.stdout.write(j.files["updatesession.session_extended"])' "$FZ/AIDOCS/_index.json")
EXT_PATH="$FZ/${EXT_REL#./}"
mkdir -p "$(dirname "$EXT_PATH")"
cat > "$EXT_PATH" <<'EOF'
# FzProj SESSION (depth)

## What goes in

LIFO depth, ten lines each.

## LIFO

### 16 architectural patterns

Trimmed body for the surviving entry.

### Exact match entry that survived verbatim

Body for the verbatim survivor entry.
EOF
# Run the audit. First archive heading fuzzy-matches the trimmed survivor, second and
# third have no candidate, fourth survives verbatim.
FZOUT="$(node "$FZENG" migrate-import --from "AIDOCS/FzProj_SETUP_ARCHIVE/AIDOCS/FzProj_SESSION_EXTENDED.md" --skill updatesession --audit 2>&1)"
echo "$FZOUT" | grep -q "1 survive verbatim, 3 not found" && pass "audit reports the expected surviving / not-found counts" || fail "audit counts wrong: $FZOUT"
echo "$FZOUT" | grep -q "possible match: 16-architectural-patterns" && pass "fuzzy match surfaces the trimmed-headline candidate" || fail "fuzzy match did not surface the trimmed-headline candidate"
echo "$FZOUT" | grep -q "Old session entry that was deliberately dropped" && pass "deliberately dropped entry still appears in the not-found list" || fail "deliberately dropped entry missing from not-found list"

echo "=== T55: classifyMove recognizes DEV-STANDARDS hyphen form (R3) ==="
DS="$BASE/devstd"
node "$RENG" init "$DS" --name DsProj >/dev/null 2>&1
# Lay the pre-engine 321 canonical hyphen form (DEV-STANDARDS, distinct from the newer DEV-AUDIT and the older underscore DEV_STANDARDS)
cat > "$DS/AIDOCS/DsProj_DEV-STANDARDS.md" <<'EOF'
# DsProj Dev Standards (legacy hyphen form)

Body of the standards.
EOF
node "$DS/AIDOCS/tools/engine.mjs" migrate-archive --name DsProj >/dev/null 2>&1
DSMF="$DS/AIDOCS/DsProj_SETUP_ARCHIVE/MANIFEST.json"
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));const e=j.moved.find(m=>m.path.endsWith("DsProj_DEV-STANDARDS.md"));process.exit(e && e.role==="dev_standards" && e.legacy_naming==="DEV-STANDARDS" ? 0 : 1)' "$DSMF" && pass "MANIFEST classifies DEV-STANDARDS hyphen form as role: dev_standards (not 'other')" || fail "DEV-STANDARDS hyphen form classified incorrectly"

echo "=== T56: migrate-import folds non-unique sub-label H3s under H2 parents (D1/R2) ==="
NFOLD="$BASE/nestedfold"
node "$RENG" init "$NFOLD" --name NfProj >/dev/null 2>&1
mkdir -p "$NFOLD/AIDOCS/NfProj_SETUP_ARCHIVE/AIDOCS"
cat > "$NFOLD/AIDOCS/NfProj_SETUP_ARCHIVE/AIDOCS/NfProj_SESSION_EXTENDED.md" <<'EOF'
# NfProj SESSION (depth)

## LIFO

## 1. First arc

### Why:

Why body for the first arc.

### Status:

Status body for the first arc.

### Files touched:

Files body for the first arc.

## 2. Second arc

### Why:

Why body for the second arc.

### Status:

Status body for the second arc.
EOF
NFOLDOUT="$(node "$NFOLD/AIDOCS/tools/engine.mjs" migrate-import --from "AIDOCS/NfProj_SETUP_ARCHIVE/AIDOCS/NfProj_SESSION_EXTENDED.md" --skill updatesession --dry-run 2>&1)"
# Expect 2 entries (the H2 arcs), NOT 5 (the H3 sub-labels promoted to entries)
NFOLDCNT="$(echo "$NFOLDOUT" | grep -c '^  ### ')"
[ "$NFOLDCNT" = "2" ] && pass "migrate-import produces 2 entries from 2 H2 arcs (folds 5 sub-label H3s into bodies)" || fail "migrate-import produced $NFOLDCNT entries (expected 2, sub-label fold failed)"
echo "$NFOLDOUT" | grep -q "First arc" && pass "first H2 arc entry present" || fail "first H2 arc missing"
