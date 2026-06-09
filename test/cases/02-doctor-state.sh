# 02-doctor-state.sh - doctor's check dimensions (registry shape, prose tiers, sub-section
# budget, malformed schema, EISDIR safety), the state machine plus reconcile gate (set /
# clear / cross-project residue / legacy watermark normalize / digit-leading project /
# historical-prose downgrade), the discovery sweep (verdict containment, suggest, validate),
# and bigsix. The post-migration $PROJ tree from 01-migration is reused by T6-T13 (those
# checks need a populated NEW321 project); the rest spin isolated projects.

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

echo "=== T30: doctor reports sub-sections over the 10-line soft cap as advisory (sub-section budget) ==="
SB="$BASE/subbudget"
node "$RENG" init "$SB" --name SubBudget >/dev/null 2>&1
SBENG="$SB/AIDOCS/tools/engine.mjs"
{ printf '# SubBudget - MEMORY (Extended)\n\n**Purpose:** subsection budget test.\n\n## LIFO\n\n### Big Entry\n'; for n in $(seq 1 15); do printf -- 'body line %s\n' "$n"; done; } > "$SB/AIDOCS/SubBudget_MEMORY_EXTENDED.md"
DOUT="$(node "$SBENG" doctor 2>&1)"
echo "$DOUT" | grep -q "Sub-section budget" && pass "doctor reports the Sub-section budget category" || fail "no Sub-section budget category in doctor output"
echo "$DOUT" | grep -qi "Big Entry" && pass "doctor names the offending sub-section" || fail "offending sub-section not named in advisory"
echo "$DOUT" | grep -q "advisory warning" && pass "sub-section budget is advisory tier (not reconcile)" || fail "sub-section budget not advisory"
# Body-line counting (the user-facing metric is non-blank body lines, not heading + blanks + body)
echo "$DOUT" | grep -q "body has 15 lines" && pass "doctor reports body-line count (15), not total-line count" || fail "doctor not using body-line count in message"

echo "=== T66: <!-- LOAD_BEARING --> marker exempts a sub-section from the body cap (GLP321-web finding) ==="
LB="$BASE/loadbearing"
node "$RENG" init "$LB" --name LbProj >/dev/null 2>&1
LBENG="$LB/AIDOCS/tools/engine.mjs"
# Lay TWO over-cap sub-sections: one with the marker, one without. Doctor should warn
# only on the unmarked entry; the marker entry rides forever per the documented exemption.
{ printf '# LbProj - MEMORY (Extended)\n\n**Purpose:** load-bearing exemption test.\n\n## LIFO\n\n### Marked Catalog\n<!-- LOAD_BEARING -->\n'; for n in $(seq 1 15); do printf -- 'catalog row %s\n' "$n"; done; printf '\n### Unmarked Bloat\n'; for n in $(seq 1 15); do printf -- 'narrative line %s\n' "$n"; done; } > "$LB/AIDOCS/LbProj_MEMORY_EXTENDED.md"
LBOUT="$(node "$LBENG" doctor 2>&1)"
echo "$LBOUT" | grep -qi "Unmarked Bloat" && pass "doctor still warns on the unmarked over-cap entry" || fail "doctor missed the unmarked over-cap entry"
echo "$LBOUT" | grep -qi "Marked Catalog" && fail "doctor wrongly warned on the LOAD_BEARING-marked entry" || pass "LOAD_BEARING marker exempts the entry from the cap (no warning)"
# The marker can appear anywhere in the body, not just on the first line
{ printf '# LbProj - MEMORY (Extended)\n\n**Purpose:** load-bearing mid-body test.\n\n## LIFO\n\n### Mid Marker Entry\n'; for n in $(seq 1 7); do printf -- 'narrative line %s\n' "$n"; done; printf '<!-- LOAD_BEARING -->\n'; for n in $(seq 8 15); do printf -- 'narrative line %s\n' "$n"; done; } > "$LB/AIDOCS/LbProj_MEMORY_EXTENDED.md"
LBOUT2="$(node "$LBENG" doctor 2>&1)"
echo "$LBOUT2" | grep -qi "Mid Marker Entry" && fail "doctor wrongly warned when marker appears mid-body" || pass "LOAD_BEARING marker works anywhere in the body"

echo "=== T35: doctor flags malformed engine.operations_applied (non-array) ==="
BD="$BASE/baddoctor"
node "$RENG" init "$BD" --name BdProj >/dev/null 2>&1
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.engine.operations_applied="not-an-array";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$BD/AIDOCS/_index.json"
BDOUT="$(node "$BD/AIDOCS/tools/engine.mjs" doctor 2>&1)"; BDCC=$?
echo "$BDOUT" | grep -q "operations_applied is not an array" && pass "doctor reports malformed operations_applied" || fail "doctor missed malformed operations_applied"
[ "$BDCC" = "20" ] && pass "doctor exits 20 (error) on malformed schema" || fail "doctor did not exit 20 on malformed schema (exit $BDCC)"

echo "=== T54: state DOC_REF regex accepts leading-digit project names (R1 propagation) ==="
DG="$BASE/digitname"
node "$RENG" init "$DG" --name "321DONE-web" >/dev/null 2>&1
DGENG="$DG/AIDOCS/tools/engine.mjs"
# Lay a self-reference in MEMORY pointing at the project's own data doc - the old
# regex would skip the leading "321DONE-" and match "web_MEMORY.md", flagging the
# correct self-ref as a stale cross-project ref to a project named "web".
MEMPATH="$DG/AIDOCS/321DONE-web_MEMORY.md"
node -e 'const fs=require("fs"),p=process.argv[1];const c=fs.readFileSync(p,"utf8")+"\nSelf-ref test: see 321DONE-web_MEMORY.md and 321DONE-web_SESSION_EXTENDED.md.\n";fs.writeFileSync(p,c)' "$MEMPATH"
node "$DGENG" state --set-reconcile >/dev/null 2>&1
DGOUT="$(node "$DGENG" state --clear-reconcile 2>&1)"; DGCC=$?
[ "$DGCC" = "0" ] && pass "state --clear-reconcile passes on a digit-leading name with valid self-refs" || fail "state --clear-reconcile wrongly flagged self-refs as residue (exit $DGCC): $DGOUT"

echo "=== T60: doctor downgrades historical banned prose during reconcile_pending (B1) ==="
DC="$BASE/doctorhist"
node "$RENG" init "$DC" --name DcProj >/dev/null 2>&1
DCENG="$DC/AIDOCS/tools/engine.mjs"
# Lay a semicolon in CHANGELOG (a restored historical file) - normally a doctor error
echo "Some history; with a semicolon." >> "$DC/CHANGELOG.md"
# Steady state: doctor sees the semicolon as an ERROR and exits 20
node "$DCENG" doctor >/dev/null 2>&1; DC1=$?
[ "$DC1" = "20" ] && pass "doctor errors on CHANGELOG semicolon in steady state (gate on)" || fail "doctor did not error on steady-state semicolon (exit $DC1)"
# Set reconcile_pending: doctor downgrades CHANGELOG semicolon to reconcile warning, exits 0
node "$DCENG" state --set-reconcile >/dev/null 2>&1
node "$DCENG" doctor >/dev/null 2>&1; DC2=$?
[ "$DC2" = "0" ] && pass "doctor passes (exit 0) on CHANGELOG semicolon during reconcile_pending" || fail "doctor still errored during reconcile_pending (exit $DC2)"
# Semicolon in an AI-authored file (MEMORY.md) is STILL an error during reconcile - not a historical file
echo "Some current state; with a semicolon." >> "$DC/AIDOCS/DcProj_MEMORY.md"
node "$DCENG" doctor >/dev/null 2>&1; DC3=$?
[ "$DC3" = "20" ] && pass "doctor still errors on MEMORY semicolon during reconcile (only historical files downgrade)" || fail "doctor wrongly downgraded MEMORY semicolon (exit $DC3)"

echo "=== T68: PATTERN-STAGING.md ships in a fresh init (engine-class refresh on -UpdateSync) ==="
# Trim of the duplicated staging contract out of the two update skill bodies. The shared
# reference lives in AIDOCS/tools/ so the routine -Update path does not re-read it.
PS="$BASE/patternstaging"
node "$RENG" init "$PS" --name PsProj >/dev/null 2>&1
[ -f "$PS/AIDOCS/tools/PATTERN-STAGING.md" ] && pass "PATTERN-STAGING.md present after init (engine-class file copies in)" || fail "PATTERN-STAGING.md missing after init"
grep -q '^# Staging contract' "$PS/AIDOCS/tools/PATTERN-STAGING.md" && pass "PATTERN-STAGING.md has the canonical H1" || fail "PATTERN-STAGING.md wrong H1"
# The update skill bodies should now point at it rather than duplicate the contract.
grep -q 'PATTERN-STAGING.md' "$PS/AIDOCS/SKILL/SKILL_UPDATE-SESSION.md" && pass "SKILL_UPDATE-SESSION.md references PATTERN-STAGING.md" || fail "SKILL_UPDATE-SESSION.md missing reference"
grep -q 'PATTERN-STAGING.md' "$PS/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" && pass "SKILL_UPDATE-MEMORY.md references PATTERN-STAGING.md" || fail "SKILL_UPDATE-MEMORY.md missing reference"

echo "=== T69: watermark command surfaces last_committed_at + last_captured (AI's where-did-I-leave-off lookup) ==="
WM="$BASE/watermark"
node "$RENG" init "$WM" --name WmProj >/dev/null 2>&1
WMENG="$WM/AIDOCS/tools/engine.mjs"
# Before any commit: both lanes report 'never committed'
WMOUT0="$(node "$WMENG" watermark 2>&1)"
echo "$WMOUT0" | grep -q "updatesession: never committed" && pass "watermark reports never-committed for updatesession on fresh init" || fail "watermark did not report never-committed (output: $WMOUT0)"
echo "$WMOUT0" | grep -q "updatememory: never committed" && pass "watermark reports never-committed for updatememory on fresh init" || fail "watermark did not report never-committed for memory"
# Stage and commit a lifo_insert; watermark should now print the timestamp + the slug
printf '{"actions":[{"op":"lifo_insert","file":"updatesession.session","section":"LIFO","bullet":"First watermark fingerprint"}]}\n' > "$WM/AIDOCS/tools/staging/updatesession.json"
node "$WMENG" commit --skill updatesession >/dev/null 2>&1
WMOUT1="$(node "$WMENG" watermark --skill updatesession 2>&1)"
echo "$WMOUT1" | grep -q "last_committed_at:" && pass "watermark prints last_committed_at after a commit" || fail "watermark missing last_committed_at (output: $WMOUT1)"
echo "$WMOUT1" | grep -q "first-watermark-fingerprint" && pass "watermark surfaces the slug of the committed lifo bullet" || fail "watermark missing the bullet slug (output: $WMOUT1)"
# --skill filter restricts output
echo "$WMOUT1" | grep -q "updatememory:" && fail "watermark --skill updatesession leaked updatememory output" || pass "watermark --skill restricts output to the named lane"
# Bad --skill rejects
node "$WMENG" watermark --skill bogus >/dev/null 2>&1; WMBAD=$?
[ "$WMBAD" = "11" ] && pass "watermark rejects bad --skill with exit 11" || fail "watermark bad-skill exit was $WMBAD (expected 11)"

echo "=== T70: commit stamps last_captured (newest first), older fingerprints survive a second run ==="
FP="$BASE/fingerprints"
node "$RENG" init "$FP" --name FpProj >/dev/null 2>&1
FPENG="$FP/AIDOCS/tools/engine.mjs"
# First commit lays one slug
printf '{"actions":[{"op":"lifo_insert","file":"updatesession.session","section":"LIFO","bullet":"Alpha entry"}]}\n' > "$FP/AIDOCS/tools/staging/updatesession.json"
node "$FPENG" commit --skill updatesession >/dev/null 2>&1
node "$FPENG" state 2>&1 | grep -q '"alpha-entry"' && pass "first commit records the slug in last_captured" || fail "alpha-entry slug missing from state after first commit"
# Second commit (different bullet) - newer slug ends up first, older one survives
printf '{"actions":[{"op":"lifo_insert","file":"updatesession.session","section":"LIFO","bullet":"Beta event"}]}\n' > "$FP/AIDOCS/tools/staging/updatesession.json"
node "$FPENG" commit --skill updatesession >/dev/null 2>&1
FP_STATE="$(node "$FPENG" state 2>&1)"
# Newer slug ordered before the older one
NEWPOS=$(echo "$FP_STATE" | grep -n 'beta-event' | head -1 | cut -d: -f1)
OLDPOS=$(echo "$FP_STATE" | grep -n 'alpha-entry' | head -1 | cut -d: -f1)
[ -n "$NEWPOS" ] && [ -n "$OLDPOS" ] && [ "$NEWPOS" -lt "$OLDPOS" ] && pass "second commit prepends the new slug (newest first), older slug survives" || fail "fingerprint ordering wrong (alpha at $OLDPOS, beta at $NEWPOS)"

echo "=== T71: state --clear-reconcile preserves last_captured across the gate flip ==="
CR="$BASE/clearreconcile"
node "$RENG" init "$CR" --name CrProj >/dev/null 2>&1
CRENG="$CR/AIDOCS/tools/engine.mjs"
printf '{"actions":[{"op":"lifo_insert","file":"updatesession.session","section":"LIFO","bullet":"Reconcile survivor"}]}\n' > "$CR/AIDOCS/tools/staging/updatesession.json"
node "$CRENG" commit --skill updatesession >/dev/null 2>&1
node "$CRENG" state 2>&1 | grep -q "reconcile-survivor" && pass "slug stamped before reconcile gate flip" || fail "slug missing pre-reconcile (commit did not stamp)"
node "$CRENG" state --set-reconcile >/dev/null 2>&1
node "$CRENG" state --clear-reconcile >/dev/null 2>&1
node "$CRENG" state 2>&1 | grep -q "reconcile-survivor" && pass "last_captured survives state --clear-reconcile normalize" || fail "last_captured wiped by clear-reconcile (regression on the AI's lookup)"
