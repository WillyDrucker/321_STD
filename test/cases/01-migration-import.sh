# 01-migration-import.sh - the isolated migrate-import coverage: the --audit fuzzy match,
# the honest no-op on an empty placeholder EXTENDED, the DEV-STANDARDS hyphen form in
# classifyMove, and the sub-label H3 fold. Each test lays its own scratch project, so the
# lane depends on nothing the archive lane left behind. Sourced after 01-migration-archive.

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

echo "=== T80: migrate-import no-ops on an empty placeholder EXTENDED instead of manufacturing a phantom entry ==="
# H4: a pre-321 project's archived EXTENDED is an empty scaffold (H1 + Purpose + empty
# ## LIFO + "(no entries yet)"). The blob fallback used to invent a phantom entry from the
# H1/Purpose, which --audit reported as "1 not found" on every fresh-existing migration.
# Now both import and --audit recognize the scaffold and no-op honestly.
PH="$BASE/placeholder"
node "$RENG" init "$PH" --name PhProj >/dev/null 2>&1
PHENG="$PH/AIDOCS/tools/engine.mjs"
mkdir -p "$PH/AIDOCS/PhProj_SETUP_ARCHIVE/AIDOCS"
# An empty-placeholder EXTENDED scaffold, the exact shape init lays.
cat > "$PH/AIDOCS/PhProj_SETUP_ARCHIVE/AIDOCS/PhProj_SESSION_EXTENDED.md" <<'EOF'
# PhProj - SESSION (Extended)

**Purpose:** Longer-form technical narrative for PhProj_SESSION.md. LIFO holds anchored sub-section detail.

## LIFO

(no extended entries yet - anchored sub-sections land here per LIFO bullet that needs depth)
EOF
# --audit: recognizes the empty placeholder, no phantom "not found"
PHAUDIT="$(node "$PHENG" migrate-import --from "AIDOCS/PhProj_SETUP_ARCHIVE/AIDOCS/PhProj_SESSION_EXTENDED.md" --skill updatesession --audit 2>&1)"; PHAC=$?
echo "$PHAUDIT" | grep -q "empty placeholder" && pass "migrate-import --audit recognizes the empty placeholder scaffold" || fail "audit did not recognize the placeholder (output: $PHAUDIT)"
echo "$PHAUDIT" | grep -q "not found" && fail "audit still reports a phantom 'not found' on the empty placeholder" || pass "audit no longer reports a phantom not-found entry"
[ "$PHAC" = "0" ] && pass "migrate-import --audit exits 0 on the empty placeholder" || fail "audit exit on placeholder was $PHAC (expected 0)"
# import: no-ops, no staging file written
PHIMPORT="$(node "$PHENG" migrate-import --from "AIDOCS/PhProj_SETUP_ARCHIVE/AIDOCS/PhProj_SESSION_EXTENDED.md" --skill updatesession 2>&1)"; PHIC=$?
echo "$PHIMPORT" | grep -q "nothing to import" && pass "migrate-import no-ops on the empty placeholder (import path)" || fail "import did not no-op on placeholder (output: $PHIMPORT)"
[ "$PHIC" = "0" ] && pass "migrate-import exits 0 on the empty placeholder" || fail "import exit on placeholder was $PHIC (expected 0)"
[ ! -f "$PH/AIDOCS/tools/staging/updatesession.json" ] && pass "no staging file written for the empty placeholder" || fail "staging file wrongly created for empty placeholder"
# Regression: a NON-empty archive still imports (the guard is scoped to true placeholders)
cat > "$PH/AIDOCS/PhProj_SETUP_ARCHIVE/AIDOCS/PhProj_MEMORY_EXTENDED.md" <<'EOF'
# PhProj - MEMORY (Extended)

**Purpose:** Anchored detail.

## LIFO

### A real captured entry

Body with genuine content that must import.
EOF
PHREAL="$(node "$PHENG" migrate-import --from "AIDOCS/PhProj_SETUP_ARCHIVE/AIDOCS/PhProj_MEMORY_EXTENDED.md" --skill updatememory 2>&1)"
echo "$PHREAL" | grep -q "wrote 1 entr" && pass "a non-empty archive still imports (placeholder guard is scoped)" || fail "non-empty archive did not import (output: $PHREAL)"
# A non-placeholder parenthetical line is REAL content, not a scaffold annotation - it must
# import, not no-op (the predicate matches only "(no ... yet ...)" / "(fill in ...)", not any paren).
cat > "$PH/AIDOCS/PhProj_SETUP_ARCHIVE/AIDOCS/PhProj_PAREN.md" <<'EOF'
# PhProj - depth

**Purpose:** test.

## LIFO

(a genuine captured note that must survive distillation)
EOF
PHPAREN="$(node "$PHENG" migrate-import --from "AIDOCS/PhProj_SETUP_ARCHIVE/AIDOCS/PhProj_PAREN.md" --skill updatesession 2>&1)"
echo "$PHPAREN" | grep -q "nothing to import" && fail "a real parenthetical-only doc was wrongly dropped as an empty placeholder" || pass "a non-placeholder parenthetical line imports (not misread as scaffold)"

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
