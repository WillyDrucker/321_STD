#!/usr/bin/env bash
# fixverify.sh - the 321 engine regression suite. Drives the engine against a scratch
# migration fixture (a legacy OLD321 project renamed to NEW321, the shape of a real
# migration) plus isolated per-feature projects, covering migrate-archive / restore /
# import, verdict containment, privacy gates, auto-prune, init validation, and the
# doctor prose tiers. Operate-on commands run through the SCRATCH engine (its
# SOURCE_ROOT is the scratch), so a run can never touch the real repo. init runs
# through the REAL engine with an explicit scratch target. Scratch output lands in
# TEMP/ (disposable). Run from the repo root: bash test/fixverify.sh
set -u
REAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RENG="$REAL/AIDOCS/tools/engine.mjs"
BASE="$REAL/TEMP/fixverify"
PROJ="$BASE/proj"
FRESH="$BASE/fresh"
ENG="$PROJ/AIDOCS/tools/engine.mjs"
# Redirect Claude Code's external-memory home under the scratch tree, so init's auto-memory
# seeding lands here (each scratch project gets its own key-derived folder) and never touches
# the real ~/.claude. Cleared with $BASE at the top of every run.
export STD321_MEMORY_HOME="$BASE/home"
FAILED=0
pass(){ echo "  PASS: $1"; }
fail(){ echo "  FAIL: $1"; FAILED=1; }

rm -rf "$BASE"; mkdir -p "$PROJ/AIDOCS/ENV" "$PROJ/WDDOCS"
cd "$PROJ"

# --- Build the legacy OLD321 fixture (pre-bootstrap) ---
mkdir -p AIDOCS/OLD321_MEMORY_ARCHIVE AIDOCS/OLD321_SESSION_ARCHIVE AIDOCS/OLD321_BACKLOG_ARCHIVE
printf 'pruned memory history\n' > AIDOCS/OLD321_MEMORY_ARCHIVE/pruned.md
printf 'pruned session history\n' > AIDOCS/OLD321_SESSION_ARCHIVE/pruned.md
printf 'pruned backlog history\n' > AIDOCS/OLD321_BACKLOG_ARCHIVE/pruned.md

cat > AIDOCS/OLD321_MEMORY.md <<'EOF'
# OLD321 - MEMORY

**Purpose:** identity.

## Overview
A real product overview.
## Stack
Node, ESM.
## Architecture
Engine in AIDOCS/tools.
## Environment
Local dev only.
## Pipeline
Manual deploy.
## Conventions
No em dashes.

---

## LIFO

- a durable note
EOF

cat > AIDOCS/OLD321_MEMORY_EXTENDED.md <<'EOF'
# OLD321 - MEMORY (Extended)

**Purpose:** longer prose for MEMORY static + LIFO detail.

## Overview
Deeper overview narrative that must NOT become a LIFO bullet.
## Stack
Deeper stack narrative that must NOT become a LIFO bullet.
## Architecture
Deeper architecture narrative.
## Environment
Deeper environment narrative.
## Pipeline
Deeper pipeline narrative.
## Conventions
Deeper conventions narrative.

---

## LIFO

### A Real Durable Decision
We chose ESM because the runtime is modern. This is real depth.
EOF

printf '# OLD321 - SESSION\n\n**Purpose:** events.\n\n## Current State\n\nidle.\n\n---\n\n## LIFO\n\n- an event\n' > AIDOCS/OLD321_SESSION.md
printf '# OLD321 - SESSION (Extended)\n\n**Purpose:** depth.\n\n## LIFO\n\n### Some Event\nbody\n' > AIDOCS/OLD321_SESSION_EXTENDED.md
printf '# OLD321 - BACKLOG\n\n**Purpose:** forward.\n\n## Features\n\n- MARKER_BACKLOG_FEATURE shipping item\n\n## Ideas\n\n- MARKER_BACKLOG_IDEA exploratory item\n' > AIDOCS/OLD321_BACKLOG.md

cat > AIDOCS/OLD321_DEV-AUDIT.md <<'EOF'
# OLD321 - DEV-AUDIT

**Purpose:** audit.

## Project specifics

MARKER_DEVAUDIT_REAL: build with `npm run build`, lint with eslint, 4-space indents.
EOF

cat > AIDOCS/OLD321_AUTO-PUSH.md <<'EOF'
# OLD321 - AUTO-PUSH

**Purpose:** release.

## Project release steps

MARKER_AUTOPUSH_REAL: bump version, update CHANGELOG, npm run build, wrangler deploy.
EOF

printf 'local-only env note (fixture) - never archived or committed\n' > AIDOCS/ENV/keys.md
# A project-customized auto-memory: an edited canonical rule (marker) plus a custom-only rule.
mkdir -p AIDOCS/automemory
printf 'CUSTOM_RULE_MARKER: this project edited this canonical rule in place.\n' > AIDOCS/automemory/feedback_code_comments.md
printf 'a project-only custom rule\n' > AIDOCS/automemory/feedback_project_custom.md
printf '# OLD321\n\n@AGENTS.md\n' > CLAUDE.md
printf '# OLD321\n\nlegacy agents.\n' > AGENTS.md
printf '# Changelog\n\n## v1\n- legacy entry\n' > CHANGELOG.md
printf 'node_modules/\n.env\nOLD_CUSTOM_IGNORE/\n' > .gitignore
printf '# user doc\n\nkept verbatim.\n' > WDDOCS/userdoc.md
mkdir -p .cursor
printf 'ai rules\n' > .cursor/rules.md
printf '# notes\n\nstray knowledge.\n' > NOTES.md
printf '{"name":"old321","private":true,"engines":{"node":">=22"},"devDependencies":{"typescript":"^6"},"scripts":{"build":"tsc","lint":"eslint src"}}' > package.json

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

echo "=== T6: verdict allows leave on a protected path (ENV), still rejects move on it ==="
printf '[{"path":"AIDOCS/ENV/keys.md","type":"env","confidence":0.9,"action":"leave"}]\n' > "$BASE/v_leave.json"
node "$ENG" verdict --validate "$BASE/v_leave.json" >/dev/null 2>&1 && pass "leave on AIDOCS/ENV accepted" || fail "leave on AIDOCS/ENV wrongly rejected"
printf '[{"path":"AIDOCS/ENV/keys.md","type":"env","confidence":0.9,"action":"move"}]\n' > "$BASE/v_move.json"
node "$ENG" verdict --validate "$BASE/v_move.json" >/dev/null 2>&1 && fail "move on AIDOCS/ENV wrongly accepted" || pass "move on AIDOCS/ENV still rejected (containment holds)"

echo "=== T7: doctor does not crash (EISDIR) when a registry file resolves to a directory ==="
rm -f AIDOCS/NEW321_BACKLOG.md && mkdir -p AIDOCS/NEW321_BACKLOG.md
DOUT="$(node "$ENG" doctor 2>&1)"; DCODE=$?
echo "$DOUT" | grep -q 'is not a regular file' && pass "doctor reports 'is not a regular file'" || fail "doctor did not report the dir-as-file"
[ "$DCODE" = "20" ] && pass "doctor exits 20 (graceful), not 99 (crash)" || fail "doctor exit code was $DCODE (expected 20)"
echo "$DOUT" | grep -qi 'EISDIR' && fail "doctor output contains EISDIR (crash)" || pass "no EISDIR in doctor output"

echo "=== T8: verdict --suggest drafts stray AI-state, skips protected/source ==="
SUGG="$PROJ/TEMP/suggest.json"
node "$ENG" verdict --suggest --out "$SUGG" >/dev/null 2>&1
grep -q '"\.cursor"' "$SUGG" && pass "verdict --suggest flags .cursor (move)" || fail ".cursor not suggested"
grep -q 'NOTES.md' "$SUGG" && pass "verdict --suggest flags NOTES.md (copy)" || fail "NOTES.md not suggested"
grep -q 'AIDOCS/ENV' "$SUGG" && fail "AIDOCS/ENV wrongly suggested" || pass "AIDOCS/ENV not suggested (protected)"
grep -q 'package.json' "$SUGG" && fail "package.json wrongly suggested" || pass "package.json left unlisted (source/config)"
node "$ENG" verdict --validate "$SUGG" >/dev/null 2>&1 && pass "suggested verdict validates clean" || fail "suggested verdict invalid"

echo "=== T8b: verdict --suggest --out is contained to the project root ==="
node "$ENG" verdict --suggest --out "$BASE/escape.json" >/dev/null 2>&1 && fail "out-of-root --out wrongly accepted" || pass "out-of-root --out rejected (containment)"
[ ! -f "$BASE/escape.json" ] && pass "no draft written outside the root" || fail "escape.json written outside the root"

echo "=== T8c: validate rejects an absolute verdict path on move ==="
printf '[{"path":"%s/NOTES.md","type":"notes","confidence":0.6,"action":"move"}]\n' "$PROJ" > "$PROJ/TEMP/v_abs.json"
node "$ENG" verdict --validate "$PROJ/TEMP/v_abs.json" >/dev/null 2>&1 && fail "absolute verdict path wrongly accepted" || pass "absolute verdict path rejected (must be relative)"

echo "=== T9: bigsix drafts Stack/Pipeline from package.json ==="
BS="$(node "$ENG" bigsix --suggest 2>&1)"
echo "$BS" | grep -q 'Language: TypeScript' && pass "bigsix detects TypeScript" || fail "bigsix missed TypeScript"
echo "$BS" | grep -q 'npm run build' && pass "bigsix lists the build script" || fail "bigsix missed the build script"

echo "=== T10: doctor flags a skill body missing frontmatter description ==="
SK="$PROJ/AIDOCS/SKILL/SKILL_UPDATE-SESSION.md"
cp "$SK" "$SK.bak"
grep -v '^description:' "$SK.bak" > "$SK"
node "$ENG" doctor 2>&1 | grep -q "frontmatter missing description" && pass "doctor flags missing skill description" || fail "missing skill description not flagged"
mv "$SK.bak" "$SK"

echo "=== T11: doctor flags a fenced code block in EXTENDED (direct-edit hole) ==="
EXT="$PROJ/AIDOCS/NEW321_MEMORY_EXTENDED.md"
cp "$EXT" "$EXT.bak"
printf '\n### Stray Code\n```js\nconst x = 1\n```\n' >> "$EXT"
node "$ENG" doctor 2>&1 | grep -q "fenced code block" && pass "doctor flags code fence in EXTENDED" || fail "code fence in EXTENDED not flagged"
mv "$EXT.bak" "$EXT"

echo "=== T12: clear-reconcile refuses on a stale cross-project ref, --force overrides ==="
node "$ENG" state --set-reconcile >/dev/null 2>&1
MEM="$PROJ/AIDOCS/NEW321_MEMORY.md"
cp "$MEM" "$MEM.bak"
printf '\n- see OLD321_MEMORY.md for prior context\n' >> "$MEM"
node "$ENG" state --clear-reconcile >/dev/null 2>&1 && fail "clear-reconcile wrongly cleared on cross-project ref" || pass "clear-reconcile refused on stale OLD321 ref"
node "$ENG" state 2>&1 | grep -q '"reconcile_pending": true' && pass "gate stays set after refusal" || fail "gate did not stay set"
node "$ENG" state --clear-reconcile --force >/dev/null 2>&1 && pass "clear-reconcile --force overrides" || fail "--force did not override"
mv "$MEM.bak" "$MEM"

echo "=== T13: doctor leaves WDDOCS prose alone (user authorship is out of scope) ==="
WD="$PROJ/WDDOCS/userdoc.md"
cp "$WD" "$WD.bak"
printf '\nThis line has an em dash \xe2\x80\x94 right here.\n' >> "$WD"
node "$ENG" doctor 2>&1 | grep -q "em dash" && fail "doctor flagged em dash in WDDOCS (user authorship should not gate)" || pass "doctor does not scan WDDOCS prose (em dash ignored)"
mv "$WD.bak" "$WD"

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

echo "=== T19: doctor scans core authored prose only (WDDOCS is user authorship, ignored) ==="
TP="$BASE/prosetier"
node "$RENG" init "$TP" --name ProseTier >/dev/null 2>&1
TPENG="$TP/AIDOCS/tools/engine.mjs"
node "$TPENG" doctor >/dev/null 2>&1 && pass "fresh project doctor clean (baseline)" || fail "fresh project doctor not clean at baseline"
mkdir -p "$TP/WDDOCS/DESIGN"
printf '# Design notes\n\nA user design line with a semicolon; in it.\n' > "$TP/WDDOCS/DESIGN/notes.md"
WOUT="$(node "$TPENG" doctor 2>&1)"; WCODE=$?
echo "$WOUT" | grep -q "WDDOCS prose" && fail "WDDOCS prose section wrongly reported (should be removed)" || pass "WDDOCS prose section absent from doctor output"
[ "$WCODE" = "0" ] && pass "WDDOCS prose ignored, doctor exits 0" || fail "doctor wrongly failed on WDDOCS prose (exit $WCODE)"
printf '\nA capture line with a semicolon; here.\n' >> "$TP/AIDOCS/ProseTier_MEMORY.md"
CCODE=0; node "$TPENG" doctor >/dev/null 2>&1 || CCODE=$?
[ "$CCODE" != "0" ] && pass "core authored semicolon is error-tier (doctor exits $CCODE)" || fail "core authored semicolon did not fail doctor"
node "$TPENG" doctor 2>&1 | grep -A3 "\[Banned prose\]" | grep -q "ProseTier_MEMORY" && pass "core semicolon listed under Banned prose (error)" || fail "core semicolon not under Banned prose"

echo "=== T20: --name validation rejects path-bearing names (migrate-archive / restore / verdict) ==="
NV="$BASE/namevalid"
node "$RENG" init "$NV" --name NameValid >/dev/null 2>&1
NVENG="$NV/AIDOCS/tools/engine.mjs"
node "$NVENG" migrate-archive --name "../evil" >/dev/null 2>&1; RC=$?; [ "$RC" = "5" ] && pass "migrate-archive rejects ../evil (exit 5)" || fail "migrate-archive accepted a path-bearing name (exit $RC)"
node "$NVENG" migrate-restore --name "a/b" >/dev/null 2>&1; RC=$?; [ "$RC" != "0" ] && pass "migrate-restore rejects a/b (exit $RC)" || fail "migrate-restore accepted a/b"
printf '[]' > "$NV/TEMP/v.json"; node "$NVENG" verdict --apply "$NV/TEMP/v.json" --name "x;y" >/dev/null 2>&1; RC=$?; [ "$RC" != "0" ] && pass "verdict --apply rejects x;y (exit $RC)" || fail "verdict --apply accepted x;y"

echo "=== T21: fetch-engine recreates INSTALL/ after a graduation-style removal ==="
FE="$BASE/fetchgrad"
node "$RENG" init "$FE" --name FetchGrad >/dev/null 2>&1
rm -rf "$FE/INSTALL"
mkdir -p "$BASE/fesrc"; printf 'x' > "$BASE/fesrc/marker.txt"
node "$FE/AIDOCS/tools/engine.mjs" fetch-engine --from "$BASE/fesrc" >/dev/null 2>&1
[ -d "$FE/INSTALL/engine" ] && pass "fetch-engine recreated INSTALL/engine (post-graduation -UpdateSync)" || fail "fetch-engine did not recreate INSTALL/"

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

echo "=== T23: clear-reconcile drops legacy watermark keys, keeps the canonical shape ==="
SN="$BASE/statenorm"
node "$RENG" init "$SN" --name StateNorm >/dev/null 2>&1
SNENG="$SN/AIDOCS/tools/engine.mjs"
node "$SNENG" state --set-reconcile >/dev/null 2>&1
# plant a pre-rebuild engine's underscored watermark keys beside the gate
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.session_update={run_count:1};j.memory_update={run_count:1};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$SN/AIDOCS/tools/state.json"
node "$SNENG" state --clear-reconcile --force >/dev/null 2>&1
SJ="$(cat "$SN/AIDOCS/tools/state.json")"
echo "$SJ" | grep -q 'session_update' && fail "legacy session_update survived clear-reconcile" || pass "legacy session_update dropped on clear-reconcile"
echo "$SJ" | grep -q 'memory_update' && fail "legacy memory_update survived clear-reconcile" || pass "legacy memory_update dropped on clear-reconcile"
echo "$SJ" | grep -q '"updatesession"' && pass "canonical updatesession kept" || fail "canonical updatesession missing after normalize"
echo "$SJ" | grep -q '"reconcile_pending": false' && pass "reconcile_pending cleared" || fail "reconcile_pending not false after clear"

echo "=== T24: migrate-import --from rejects a path escaping the root (isContained) ==="
node "$ENG" migrate-import --from "../../../etc/passwd" --skill updatememory >/dev/null 2>&1; RC=$?
[ "$RC" = "5" ] && pass "migrate-import --from rejects an escaping path (exit 5)" || fail "migrate-import --from accepted an escaping path (exit $RC)"

echo "=== T25: migrate-archive snapshots AIDOCS/SKILL (copy, not move) for in-place customization recovery ==="
SS="$BASE/skillsnap"
node "$RENG" init "$SS" --name SkillSnap >/dev/null 2>&1
SSENG="$SS/AIDOCS/tools/engine.mjs"
# customize a skill body in place (the legacy pre-data-doc model)
printf '\nCUSTOM_SKILL_MARKER: project-specific in-place edit.\n' >> "$SS/AIDOCS/SKILL/SKILL_AUTO-PUSH.md"
node "$SSENG" migrate-archive --name SkillSnap >/dev/null 2>&1
SARCH="$SS/AIDOCS/SkillSnap_SETUP_ARCHIVE/AIDOCS/SKILL"
[ -f "$SARCH/SKILL_AUTO-PUSH.md" ] && pass "SKILL snapshotted into the archive" || fail "SKILL not snapshotted into archive"
grep -q 'CUSTOM_SKILL_MARKER' "$SARCH/SKILL_AUTO-PUSH.md" 2>/dev/null && pass "in-place customization preserved in the snapshot" || fail "customization not in the snapshot"
[ -f "$SS/AIDOCS/SKILL/SKILL_AUTO-PUSH.md" ] && grep -q 'CUSTOM_SKILL_MARKER' "$SS/AIDOCS/SKILL/SKILL_AUTO-PUSH.md" && pass "live SKILL kept (copy, not move)" || fail "live SKILL was moved, not copied"

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

echo "=== T30: doctor reports sub-sections over the 10-line soft cap as advisory (sub-section budget) ==="
SB="$BASE/subbudget"
node "$RENG" init "$SB" --name SubBudget >/dev/null 2>&1
SBENG="$SB/AIDOCS/tools/engine.mjs"
{ printf '# SubBudget - MEMORY (Extended)\n\n**Purpose:** subsection budget test.\n\n## LIFO\n\n### Big Entry\n'; for n in $(seq 1 15); do printf -- 'body line %s\n' "$n"; done; } > "$SB/AIDOCS/SubBudget_MEMORY_EXTENDED.md"
DOUT="$(node "$SBENG" doctor 2>&1)"
echo "$DOUT" | grep -q "Sub-section budget" && pass "doctor reports the Sub-section budget category" || fail "no Sub-section budget category in doctor output"
echo "$DOUT" | grep -qi "Big Entry" && pass "doctor names the offending sub-section" || fail "offending sub-section not named in advisory"
echo "$DOUT" | grep -q "advisory warning" && pass "sub-section budget is advisory tier (not reconcile)" || fail "sub-section budget not advisory"

echo "=== T28: legacy auto_memory.source still passes doctor (the seed rename is non-breaking) ==="
LG="$BASE/legacyam"
node "$RENG" init "$LG" --name LegacyAm >/dev/null 2>&1
# rewrite the registry to the pre-rebuild schema: auto_memory.source, no seed/path
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.auto_memory={source:"./AIDOCS/automemory"};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$LG/AIDOCS/_index.json"
node "$LG/AIDOCS/tools/engine.mjs" doctor >/dev/null 2>&1 && pass "doctor passes on legacy auto_memory.source" || fail "doctor failed on legacy source schema"
node "$LG/AIDOCS/tools/engine.mjs" doctor 2>&1 | grep -A1 "Auto-memory pointers" | grep -q "ok" && pass "auto-memory mirror check stays active on legacy source (fallback honored)" || fail "auto-memory check went inert on legacy source"

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

echo "=== T35: doctor flags malformed engine.operations_applied (non-array) ==="
BD="$BASE/baddoctor"
node "$RENG" init "$BD" --name BdProj >/dev/null 2>&1
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.engine.operations_applied="not-an-array";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$BD/AIDOCS/_index.json"
BDOUT="$(node "$BD/AIDOCS/tools/engine.mjs" doctor 2>&1)"; BDCC=$?
echo "$BDOUT" | grep -q "operations_applied is not an array" && pass "doctor reports malformed operations_applied" || fail "doctor missed malformed operations_applied"
[ "$BDCC" = "20" ] && pass "doctor exits 20 (error) on malformed schema" || fail "doctor did not exit 20 on malformed schema (exit $BDCC)"

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
RN="$BASE/rename"
node "$RENG" init "$RN" --name RnProj >/dev/null 2>&1
RNENG="$RN/AIDOCS/tools/engine.mjs"
# Project carries the legacy auto_memory.source field (the WAT321 case).
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.auto_memory={source:"./AIDOCS/automemory",path:""};fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$RN/AIDOCS/_index.json"
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
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1]));process.exit((j.auto_memory.seed==="./AIDOCS/automemory" && j.auto_memory.source===undefined)?0:1)' "$RN/AIDOCS/_index.json" && pass "registry_rename moved auto_memory.source to .seed" || fail "registry_rename did not move the key"
node -e 'const a=JSON.parse(require("fs").readFileSync(process.argv[1])).engine.operations_applied;process.exit(a.includes("rename_auto_memory_source_to_seed")?0:1)' "$RN/AIDOCS/_index.json" && pass "registry_rename op name recorded in operations_applied[]" || fail "op name not in operations_applied"
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

echo "=== T44: skill_delete and skill_rename reject non-basename inputs (containment) ==="
SE="$BASE/skillescape"
node "$RENG" init "$SE" --name SeProj >/dev/null 2>&1
SEENG="$SE/AIDOCS/tools/engine.mjs"
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
node "$SEENG" fetch-engine --from "$SESRC" >/dev/null 2>&1
SEOUT="$(node "$SEENG" upgrade 2>&1)"; SECC=$?
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
node "$SEENG" fetch-engine --from "$SESRC" >/dev/null 2>&1
SE2OUT="$(node "$SEENG" upgrade 2>&1)"; SE2CC=$?
[ "$SE2CC" = "20" ] && pass "skill_rename rejects non-basename `from` with exit 20" || fail "skill_rename accepted non-basename from (exit $SE2CC)"
# skill_delete with a non-SKILL_*.md basename
cat > "$SESRC/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "evil_skill_delete_wrong_prefix", "type": "skill_delete", "file": "NOT_A_SKILL.md" }
  ]
}
EOF
node "$SEENG" fetch-engine --from "$SESRC" >/dev/null 2>&1
SE3OUT="$(node "$SEENG" upgrade 2>&1)"; SE3CC=$?
[ "$SE3CC" = "20" ] && pass "skill_delete rejects non-SKILL_*.md basename" || fail "skill_delete accepted non-SKILL basename (exit $SE3CC)"

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

echo "=== T47: init --upstream records engine.upstream (write-if-empty, preserves user fork URL on reinstall) ==="
UP="$BASE/initupstream"
node "$RENG" init "$UP" --name UpInit --upstream "https://example.com/fork.git" >/dev/null 2>&1
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.upstream === "https://example.com/fork.git" ? 0 : 1)' "$UP/AIDOCS/_index.json" && pass "init --upstream recorded the URL into engine.upstream" || fail "init --upstream did not record the URL"
# Reinstall (write-if-missing init): the recorded upstream should survive a different --upstream flag.
node "$RENG" init "$UP" --name UpInit --upstream "https://other.example.com/elsewhere.git" >/dev/null 2>&1
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.upstream === "https://example.com/fork.git" ? 0 : 1)' "$UP/AIDOCS/_index.json" && pass "reinstall preserves user-customized engine.upstream (write-if-empty contract)" || fail "reinstall overwrote engine.upstream"
# init without --upstream on a fresh target leaves engine.upstream empty (the source dogfood state).
UPN="$BASE/initnoupstream"
node "$RENG" init "$UPN" --name UpNoInit >/dev/null 2>&1
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.upstream === "" ? 0 : 1)' "$UPN/AIDOCS/_index.json" && pass "init without --upstream leaves engine.upstream empty (no surprise)" || fail "init without --upstream wrote a value to engine.upstream"
# STD321_UPSTREAM env var also works (the env-fallback path).
UPE="$BASE/initenvupstream"
STD321_UPSTREAM="https://env.example.com/fork.git" node "$RENG" init "$UPE" --name UpEnvInit >/dev/null 2>&1
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.upstream === "https://env.example.com/fork.git" ? 0 : 1)' "$UPE/AIDOCS/_index.json" && pass "STD321_UPSTREAM env var records engine.upstream when --upstream absent" || fail "STD321_UPSTREAM env var did not record engine.upstream"
# Migration reinstall: original install recorded an upstream, then migrate-archive moves
# _index.json into SETUP_ARCHIVE, then init re-runs without --upstream. The recall path
# must pull the original upstream from the archive so it is not lost.
UPM="$BASE/initupstreamrecall"
node "$RENG" init "$UPM" --name UpRecall --upstream "https://recall.example.com/origin.git" >/dev/null 2>&1
# Simulate migrate-archive moving _index.json into the archive.
mkdir -p "$UPM/AIDOCS/UpRecall_SETUP_ARCHIVE/AIDOCS"
mv "$UPM/AIDOCS/_index.json" "$UPM/AIDOCS/UpRecall_SETUP_ARCHIVE/AIDOCS/_index.json"
# Reinstall (no --upstream this time) - recall must pull from the archive.
node "$RENG" init "$UPM" --name UpRecall >/dev/null 2>&1
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.upstream === "https://recall.example.com/origin.git" ? 0 : 1)' "$UPM/AIDOCS/_index.json" && pass "migration reinstall recalls engine.upstream from SETUP_ARCHIVE (no loss)" || fail "migration reinstall lost engine.upstream"

echo "=== T46: upgrade cleans up INSTALL/engine after success; removes INSTALL/ if it becomes empty ==="
CL="$BASE/cleanup"
node "$RENG" init "$CL" --name ClProj >/dev/null 2>&1
CLENG="$CL/AIDOCS/tools/engine.mjs"
CLSRC="$BASE/cleanupsrc"
mkdir -p "$CLSRC/AIDOCS" "$CLSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$CLSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$CLSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$CLSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$CLSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$CLSRC/.claude/skills/321/SKILL.md"
printf '{ "operations": [] }\n' > "$CLSRC/AIDOCS/MANIFEST.json"
# Mid-migration case: INSTALL/ has runbooks + INSTALL.log, cleanup should leave them.
[ -f "$CL/INSTALL/install.md" ] && pass "fresh init lays INSTALL/install.md (pre-upgrade state)" || fail "no INSTALL/install.md after init"
node "$CLENG" fetch-engine --from "$CLSRC" >/dev/null 2>&1
[ -d "$CL/INSTALL/engine" ] && pass "fetch-engine created INSTALL/engine" || fail "fetch-engine did not create INSTALL/engine"
node "$CLENG" upgrade >/dev/null 2>&1
[ ! -d "$CL/INSTALL/engine" ] && pass "upgrade removed INSTALL/engine after success (mid-migration)" || fail "upgrade left INSTALL/engine behind"
[ -d "$CL/INSTALL" ] && pass "upgrade kept INSTALL/ because runbooks still present (mid-migration)" || fail "upgrade removed INSTALL/ even though runbooks were present"
[ -f "$CL/INSTALL/install.md" ] && pass "INSTALL/install.md preserved through upgrade cleanup" || fail "INSTALL/install.md was wrongly removed"
# Graduated case: graduate removes INSTALL/. fetch-engine recreates it. upgrade should
# remove INSTALL/engine and then INSTALL/ since it became empty again.
CLG="$BASE/cleanupgrad"
node "$RENG" init "$CLG" --name ClGradProj >/dev/null 2>&1
CLGENG="$CLG/AIDOCS/tools/engine.mjs"
# Force graduation. graduate refuses while reconcile_pending is set, but a fresh init
# has no gate, so this runs clean.
node "$CLGENG" graduate >/dev/null 2>&1
[ ! -d "$CLG/INSTALL" ] && pass "graduate removed INSTALL/ entirely (baseline for the graduated case)" || fail "graduate did not remove INSTALL/"
node "$CLGENG" fetch-engine --from "$CLSRC" >/dev/null 2>&1
[ -d "$CLG/INSTALL/engine" ] && pass "post-graduate fetch-engine recreated INSTALL/engine" || fail "post-graduate fetch-engine did not recreate INSTALL/engine"
node "$CLGENG" upgrade >/dev/null 2>&1
[ ! -d "$CLG/INSTALL/engine" ] && pass "graduated upgrade removed INSTALL/engine" || fail "graduated upgrade left INSTALL/engine behind"
[ ! -d "$CLG/INSTALL" ] && pass "graduated upgrade removed empty INSTALL/ (no relics)" || fail "graduated upgrade left an empty INSTALL/ behind"
# Dry-run case: cleanup must not fire (pretends the writes did not happen).
node "$CLGENG" fetch-engine --from "$CLSRC" >/dev/null 2>&1
node "$CLGENG" upgrade --dry-run >/dev/null 2>&1
[ -d "$CLG/INSTALL/engine" ] && pass "dry-run upgrade does NOT clean up INSTALL/engine" || fail "dry-run upgrade wrongly cleaned up INSTALL/engine"

echo ""
if [ "$FAILED" = "0" ]; then echo "ALL CHECKS PASSED"; else echo "SOME CHECKS FAILED"; fi
exit $FAILED
