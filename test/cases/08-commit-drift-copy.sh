# 08-commit-drift-copy.sh - the 0.1.17 field findings: the commit-drift advisory
# (gitDrift.mjs, surfaced in compare / doctor / end-of-upgrade) and the hash-aware
# engine-class copy (copyFile content-compares, reports changed / identical / skipped
# apart). Drift cases use a throwaway nested git repo under the scratch tree, isolated
# from the parent checkout. The copy cases prove the report split and the
# skip-identical no-op. Scratch dirs carry a cd* prefix so they never collide with an
# earlier case's path (a reinstall over one would recall its privacy mode). Sourced
# after 07.

# Set engine.version in a project's _index.json (mirrors mk_src --version).
dc_set_version() {
  node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.engine.version=process.argv[2];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$1/AIDOCS/_index.json" "$2"
}
# Commit a project into a fresh nested git repo (isolated from the parent tree). Identity
# and gpgsign set inline so the commit lands in any environment, CI included.
dc_git_commit() {
  git -C "$1" init -q
  git -C "$1" add -A
  git -C "$1" -c user.email=t@t.t -c user.name=t -c commit.gpgsign=false commit -q -m baseline
}

echo "=== T90: doctor surfaces the commit-drift advisory when committed engine.version disagrees with the working tree, without changing its exit ==="
DD="$BASE/cdDrift"
DDENG="$(mk_proj "$DD" CdDriftProj)"
dc_git_commit "$DD"
DV="$(reg_get "$DD" engine.version)"             # committed (HEAD) version
node "$DDENG" doctor >/dev/null 2>&1; DE0=$?      # baseline exit, committed == tree (no advisory)
dc_set_version "$DD" 9.9.9                        # diverge the working tree
DDOUT="$(node "$DDENG" doctor 2>&1)"; DE1=$?      # exit with the advisory present
echo "$DDOUT" | grep -q "engine version mismatch" && pass "doctor surfaces the commit-drift advisory" || fail "doctor did not surface the drift advisory (output: $DDOUT)"
echo "$DDOUT" | grep -q "HEAD $DV, tree 9.9.9" && pass "drift advisory names both versions (HEAD $DV, tree 9.9.9)" || fail "drift advisory did not name HEAD/tree correctly (output: $DDOUT)"
echo "$DDOUT" | grep -q "file(s) uncommitted" && pass "drift advisory reports the uncommitted engine-file count" || fail "drift advisory missing the uncommitted count"
[ "$DE1" = "$DE0" ] && pass "drift advisory leaves doctor's exit unchanged (informational, not an error: $DE0 -> $DE1)" || fail "drift advisory changed doctor's exit ($DE0 -> $DE1)"

echo "=== T91: drift advisory stays silent when _index.json is not in HEAD (no commit yet - the fresh-repo / public-privacy fallback) ==="
NG="$BASE/cdNoHead"
NGENG="$(mk_proj "$NG" CdNoHeadProj)"
git -C "$NG" init -q                             # repo exists, nothing committed -> no HEAD
dc_set_version "$NG" 9.9.9
NGOUT="$(node "$NGENG" doctor 2>&1)"
echo "$NGOUT" | grep -q "engine version mismatch" && fail "drift advisory fired with no HEAD to compare against (output: $NGOUT)" || pass "drift advisory silent when _index.json is not committed (graceful fallback)"

echo "=== T92: drift advisory stays silent when committed == working tree (clean) ==="
CLN="$BASE/cdClean"
CLNENG="$(mk_proj "$CLN" CdCleanProj)"
dc_git_commit "$CLN"                             # commit, then leave the tree untouched
CLNOUT="$(node "$CLNENG" doctor 2>&1)"
echo "$CLNOUT" | grep -q "engine version mismatch" && fail "drift advisory fired on a clean tree (committed == working)" || pass "drift advisory silent when committed engine.version matches the working tree"

echo "=== T93: end-of-upgrade prints the drift advisory after a version-crossing upgrade ==="
UDR="$BASE/cdUpgrade"
UDRENG="$(mk_proj "$UDR" CdUpProj)"
dc_git_commit "$UDR"
UDRSRC="$BASE/cdUpgradeSrc"
mk_src "$UDRSRC" --version 0.2.0 --empty-manifest
node "$UDRENG" fetch-engine --from "$UDRSRC" >/dev/null 2>&1
UDROUT="$(node "$UDRENG" upgrade 2>&1)"
echo "$UDROUT" | grep -q "engine version mismatch" && pass "upgrade tail surfaces the drift advisory after bumping the version uncommitted" || fail "upgrade did not surface the drift advisory (output: $UDROUT)"
echo "$UDROUT" | grep -q "tree 0.2.0" && pass "upgrade drift advisory reports the freshly-bumped tree version (0.2.0)" || fail "upgrade drift advisory missing the new tree version (output: $UDROUT)"

echo "=== T94: hash-aware copy reports the changed / identical / skipped split (not a flat 'copied') ==="
HC="$BASE/cdHashCopy"
HCENG="$(mk_proj "$HC" CdHashCopyProj)"
HCSRC="$BASE/cdHashCopySrc"
mk_src "$HCSRC" --empty-manifest
# Diverge exactly one engine-class file in the source so the copy has one real change.
printf '\n// T94 source divergence sentinel\n' >> "$HCSRC/AIDOCS/tools/lib/markdown.mjs"
node "$HCENG" fetch-engine --from "$HCSRC" >/dev/null 2>&1
HCOUT="$(node "$HCENG" upgrade 2>&1)"
echo "$HCOUT" | grep -qE "copy: [0-9]+ changed, [0-9]+ identical, [0-9]+ skipped" && pass "copy report uses the changed/identical/skipped triple" || fail "copy report not in the new triple format (output: $HCOUT)"
echo "$HCOUT" | grep -qE "copy: [0-9]+ changed, [1-9][0-9]* identical" && pass "copy report counts byte-identical files apart from changes (identical >= 1)" || fail "copy report did not report any identical files (output: $HCOUT)"

echo "=== T95: re-running the same upgrade is a true no-op (0 changed, identical-only) ==="
node "$HCENG" fetch-engine --from "$HCSRC" >/dev/null 2>&1
HCOUT2="$(node "$HCENG" upgrade 2>&1)"
echo "$HCOUT2" | grep -q "copy: 0 changed," && pass "second upgrade reports 0 changed (skip-identical no-op, no churn)" || fail "second upgrade re-copied identical files (output: $HCOUT2)"

echo "=== T96: a changed file is actually written (skip-identical never drops a real change) ==="
grep -q "T94 source divergence sentinel" "$HC/AIDOCS/tools/lib/markdown.mjs" && pass "the diverged source file landed in the project on the first upgrade" || fail "the changed file was not written into the project"

echo "=== T97: compare surfaces the drift advisory even with no fetched engine (local check precedes the missing-fetch exit) ==="
CMP="$BASE/cdCompare"
CMPENG="$(mk_proj "$CMP" CdCompareProj)"
dc_git_commit "$CMP"
dc_set_version "$CMP" 9.9.9
# No fetch-engine: compare exits 20 for the missing fetch, but must print the local drift advisory first.
CMPOUT="$(node "$CMPENG" compare 2>&1)"
echo "$CMPOUT" | grep -q "engine version mismatch" && pass "compare prints the drift advisory before the missing-fetch exit (local-only check)" || fail "compare hid the drift advisory on the no-fetch path (output: $CMPOUT)"

echo "=== T98: drift advisory works when the project is a SUBDIR of a larger git repo (HEAD:./path resolution) ==="
PARENT="$BASE/cdParent"
mkdir -p "$PARENT"
git -C "$PARENT" init -q
SUB="$PARENT/nested/proj"
SUBENG="$(mk_proj "$SUB" CdSubProj)"
git -C "$PARENT" add -A
git -C "$PARENT" -c user.email=t@t.t -c user.name=t -c commit.gpgsign=false commit -q -m baseline
dc_set_version "$SUB" 9.9.9
# The engine's own root is the subdir (no nested .git of its own); gitDrift must resolve
# HEAD:./AIDOCS/_index.json and the status pathspec relative to the subdir within PARENT.
SUBOUT="$(node "$SUBENG" doctor 2>&1)"
echo "$SUBOUT" | grep -q "engine version mismatch" && pass "drift advisory fires for a project nested in a larger repo (subdir HEAD:./ resolution)" || fail "drift advisory failed on a subdir-of-larger-repo project (output: $SUBOUT)"
