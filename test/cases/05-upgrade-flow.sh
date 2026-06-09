# 05-upgrade-flow.sh - the upgrade lifecycle around the operations layer (covered in
# 04-upgrade-ops.sh): post-upgrade INSTALL/ cleanup (mid-migration keeps the runbooks,
# graduated removes the empty INSTALL/, dry-run mutates nothing), init --upstream
# recording + the recall path through SETUP_ARCHIVE, fetch-engine's upstream-defaulting
# behavior, the user-facing rename summary, the router quick-ref reconciler (on upgrade,
# for new upstream flags, and on graduate), and the pre-upgrade engine snapshot to TEMP/
# (taken before handlers run so it is a complete rollback target).

echo "=== T46: upgrade cleans up INSTALL/engine after success; removes INSTALL/ if it becomes empty ==="
CL="$BASE/cleanup"
CLENG="$(mk_proj "$CL" ClProj)"
CLSRC="$BASE/cleanupsrc"
mk_src "$CLSRC" --empty-manifest
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
CLGENG="$(mk_proj "$CLG" ClGradProj)"
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

echo "=== T47: init --upstream records engine.upstream (explicit wins, write-if-missing preserves user fork URL on reinstall) ==="
UP47="$BASE/initupstream"
mk_proj "$UP47" UpInit --upstream "https://example.com/fork.git" >/dev/null
[ "$(reg_get "$UP47" engine.upstream)" = "https://example.com/fork.git" ] && pass "init --upstream recorded the URL into engine.upstream" || fail "init --upstream did not record the URL"
# Reinstall (write-if-missing init): the recorded upstream should survive a different --upstream flag.
mk_proj "$UP47" UpInit --upstream "https://other.example.com/elsewhere.git" >/dev/null
[ "$(reg_get "$UP47" engine.upstream)" = "https://example.com/fork.git" ] && pass "reinstall preserves user-customized engine.upstream (write-if-empty contract)" || fail "reinstall overwrote engine.upstream"
# init without --upstream on a fresh target leaves engine.upstream empty (the source dogfood state).
UPN="$BASE/initnoupstream"
mk_proj "$UPN" UpNoInit >/dev/null
[ -z "$(reg_get "$UPN" engine.upstream)" ] && pass "init without --upstream leaves engine.upstream empty (no surprise)" || fail "init without --upstream wrote a value to engine.upstream"
# STD321_UPSTREAM env var also works (the env-fallback path).
UPE="$BASE/initenvupstream"
STD321_UPSTREAM="https://env.example.com/fork.git" node "$RENG" init "$UPE" --name UpEnvInit >/dev/null 2>&1
[ "$(reg_get "$UPE" engine.upstream)" = "https://env.example.com/fork.git" ] && pass "STD321_UPSTREAM env var records engine.upstream when --upstream absent" || fail "STD321_UPSTREAM env var did not record engine.upstream"
# Migration reinstall: original install recorded an upstream, then migrate-archive moves
# _index.json into SETUP_ARCHIVE, then init re-runs without --upstream. The recall path
# must pull the original upstream from the archive so it is not lost.
UPM="$BASE/initupstreamrecall"
mk_proj "$UPM" UpRecall --upstream "https://recall.example.com/origin.git" >/dev/null
# Simulate migrate-archive moving _index.json into the archive.
mkdir -p "$UPM/AIDOCS/UpRecall_SETUP_ARCHIVE/AIDOCS"
mv "$UPM/AIDOCS/_index.json" "$UPM/AIDOCS/UpRecall_SETUP_ARCHIVE/AIDOCS/_index.json"
# Reinstall (no --upstream this time) - recall must pull from the archive.
mk_proj "$UPM" UpRecall >/dev/null
[ "$(reg_get "$UPM" engine.upstream)" = "https://recall.example.com/origin.git" ] && pass "migration reinstall recalls engine.upstream from SETUP_ARCHIVE (no loss)" || fail "migration reinstall lost engine.upstream"
# Forked source with a non-empty engine.upstream still honors an explicit --upstream
# (the previous "write-if-source-empty" check would have silently ignored the flag).
UPF="$BASE/initupstreamfork"
FORK="$BASE/forksrc"
mkdir -p "$FORK"
cp -r "$REAL/." "$FORK/" 2>/dev/null
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.engine.upstream="https://forked-source.example.com/fork.git";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$FORK/AIDOCS/_index.json"
node "$FORK/AIDOCS/tools/engine.mjs" init "$UPF" --name UpFork --upstream "https://user-explicit.example.com/wanted.git" >/dev/null 2>&1
[ "$(reg_get "$UPF" engine.upstream)" = "https://user-explicit.example.com/wanted.git" ] && pass "explicit --upstream overrides a non-empty source engine.upstream (fork-source case)" || fail "explicit --upstream silently ignored when source had a value"

echo "=== T48: fetch-engine defaults --repo from engine.upstream when no flag given ==="
FE48="$BASE/fetchdefault"
FEENG="$(mk_proj "$FE48" FeProj --upstream "https://example.com/fedefault.git")"
# No --repo, no --from: should pick up engine.upstream from the registry and report it.
# The clone itself will fail (bogus URL), but the default-resolution log line and the
# clone-failure exit (21) prove the default path fired.
FEOUT="$(node "$FEENG" fetch-engine 2>&1)"; FECC=$?
echo "$FEOUT" | grep -q "defaulting --repo to engine.upstream (https://example.com/fedefault.git)" && pass "fetch-engine logs the defaulted --repo from engine.upstream" || fail "fetch-engine did not log the defaulted --repo"
[ "$FECC" = "21" ] && pass "fetch-engine still exits 21 on clone failure after defaulting" || fail "fetch-engine exit code after default-clone unexpected ($FECC)"
# Empty engine.upstream + no flag: the missing-args error still fires (no default available).
FEE="$BASE/fetchdefaultempty"
FEEENG="$(mk_proj "$FEE" FeeProj)"
FEEOUT="$(node "$FEEENG" fetch-engine 2>&1)"; FEECC=$?
[ "$FEECC" = "5" ] && pass "fetch-engine still errors when no upstream is recorded and no flag given" || fail "fetch-engine wrongly succeeded with empty registry and no flag (exit $FEECC)"
echo "$FEEOUT" | grep -q "needs --from <dir> or --repo <url>" && pass "fetch-engine empty-registry error message preserved" || fail "fetch-engine missing-args message changed"

echo "=== T57: upgrade prints command flag renames from skill_rename ops applied this run (W1) ==="
RN57="$BASE/renamesummary"
RNENG_57="$(mk_proj "$RN57" RnSummary)"
RNSRC_57="$BASE/renamesummary-src"
mk_src "$RNSRC_57"
# Manifest with a single skill_rename. Pre-place the "from" body so the op actually applies.
cp "$REAL/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" "$RN57/AIDOCS/SKILL/SKILL_MEMORY-UPDATE.md"
cat > "$RNSRC_57/AIDOCS/MANIFEST.json" <<'EOF'
{
  "operations": [
    { "name": "rename_skill_test", "type": "skill_rename", "from": "SKILL_MEMORY-UPDATE.md", "to": "SKILL_UPDATE-MEMORY.md", "flag_to": "-UpdateMemory" }
  ]
}
EOF
node "$RNENG_57" fetch-engine --from "$RNSRC_57" >/dev/null 2>&1
RNOUT_57="$(node "$RNENG_57" upgrade 2>&1)"
echo "$RNOUT_57" | grep -q "Command flag changes from this upgrade" && pass "upgrade prints command flag changes header" || fail "upgrade did not print rename summary"
echo "$RNOUT_57" | grep -q -- "-MemoryUpdate -> -UpdateMemory" && pass "upgrade maps old flag to new flag in rename summary" || fail "rename summary did not include the flag mapping"

echo "=== T58: upgrade reconciles router quick-ref against dispatch (W2) ==="
RQ="$BASE/routerquickref"
RQENG="$(mk_proj "$RQ" RqProj)"
# Graduate first to deregister -Setup, then run upgrade and verify the router quick-ref drops the orphan
node "$RQENG" graduate >/dev/null 2>&1
RQSRC="$BASE/routerquickrefsrc"
mk_src "$RQSRC" --empty-manifest
node "$RQENG" fetch-engine --from "$RQSRC" >/dev/null 2>&1
RQOUT="$(node "$RQENG" upgrade 2>&1)"
# The router copied verbatim from source carries the -Setup line; the reconciler should drop it on a graduated project
grep -q "^/321 -Setup" "$RQ/.claude/skills/321/SKILL.md" && fail "router still carries -Setup line after upgrade on graduated project" || pass "router quick-ref pruned the -Setup line on graduated project"
echo "$RQOUT" | grep -q "pruned 1 stale quick-ref line" && pass "upgrade reports the quick-ref pruning" || fail "upgrade did not report router prune"

echo "=== T59: upgrade auto-snapshots prior engine to TEMP/ before write (W3) ==="
SS="$BASE/snapshot"
SSENG="$(mk_proj "$SS" SsProj)"
SSSRC="$BASE/snapshotsrc"
mk_src "$SSSRC" --empty-manifest
node "$SSENG" fetch-engine --from "$SSSRC" >/dev/null 2>&1
node "$SSENG" upgrade >/dev/null 2>&1
[ -d "$SS/TEMP/engine-backup-pre-upgrade" ] && pass "upgrade wrote pre-upgrade engine snapshot to TEMP/" || fail "no engine snapshot written"
[ -f "$SS/TEMP/engine-backup-pre-upgrade/AIDOCS/tools/engine.mjs" ] && pass "snapshot contains AIDOCS/tools/engine.mjs" || fail "snapshot missing tools/engine.mjs"
[ -f "$SS/TEMP/engine-backup-pre-upgrade/.claude/skills/321/SKILL.md" ] && pass "snapshot contains the router body" || fail "snapshot missing router body"
# Dry-run must NOT snapshot
rm -rf "$SS/TEMP/engine-backup-pre-upgrade"
node "$SSENG" fetch-engine --from "$SSSRC" >/dev/null 2>&1
node "$SSENG" upgrade --dry-run >/dev/null 2>&1
[ ! -d "$SS/TEMP/engine-backup-pre-upgrade" ] && pass "dry-run upgrade does NOT write pre-upgrade snapshot" || fail "dry-run wrongly wrote snapshot"

echo "=== T61: upgrade snapshot is taken BEFORE manifest handlers run (Codex F1) ==="
# A manifest with a file_delete op for a sentinel must not see the sentinel deleted in the snapshot.
SO="$BASE/snaporder"
SOENG="$(mk_proj "$SO" SoProj)"
SOSRC="$BASE/snapordersrc"
mk_src "$SOSRC"
# Lay a sentinel that the manifest will file_delete; capture its content for the snapshot check
echo "sentinel-content-to-preserve-in-snapshot" > "$SO/AIDOCS/SKILL/SKILL_SENTINEL.md"
printf '{ "operations": [ { "name": "delete_sentinel", "type": "file_delete", "file": "AIDOCS/SKILL/SKILL_SENTINEL.md" } ] }\n' > "$SOSRC/AIDOCS/MANIFEST.json"
node "$SOENG" fetch-engine --from "$SOSRC" >/dev/null 2>&1
node "$SOENG" upgrade >/dev/null 2>&1
# Live tree: sentinel deleted by the handler
[ ! -f "$SO/AIDOCS/SKILL/SKILL_SENTINEL.md" ] && pass "file_delete handler removed the live sentinel" || fail "file_delete handler did not remove live sentinel"
# Snapshot: sentinel preserved because the snapshot ran before the handler
[ -f "$SO/TEMP/engine-backup-pre-upgrade/AIDOCS/SKILL/SKILL_SENTINEL.md" ] && pass "pre-upgrade snapshot preserves the file the handler later deleted" || fail "snapshot ran AFTER handler - rollback target is incomplete"

echo "=== T62: upgrade preserves a brand-new upstream flag line in the router quick-ref (Codex F2) ==="
# Source carries a new SKILL_FOOBAR.md plus a router line for it; project's stale dispatch
# does not know it yet. The reconciler must derive flags from the copied skill bodies on
# disk, NOT from the registry, so the new line survives.
NFLAG="$BASE/newflag"
NFENG_62="$(mk_proj "$NFLAG" NfProj)"
NFSRC_62="$BASE/newflagsrc"
mk_src "$NFSRC_62" --no-router --empty-manifest
# Lay a new upstream skill body. SKILL_FOO-BAR.md derives flag -FooBar via the hyphen-split rule.
printf -- '---\nname: foobar\ndescription: test skill for T62\n---\n\n# /321 -FooBar\n' > "$NFSRC_62/AIDOCS/SKILL/SKILL_FOO-BAR.md"
# Lay a router whose quick-ref has the new line
cat > "$NFSRC_62/.claude/skills/321/SKILL.md" <<'EOF'
# /321

## How to invoke

```
/321 -Update           the daily driver
/321 -FooBar           a brand new upstream flag
```

EOF
node "$NFENG_62" fetch-engine --from "$NFSRC_62" >/dev/null 2>&1
node "$NFENG_62" upgrade >/dev/null 2>&1
# The reconciler must keep the new line because SKILL_FOOBAR.md is on disk after the copy
grep -q "^/321 -FooBar" "$NFLAG/.claude/skills/321/SKILL.md" && pass "router quick-ref kept the new -FooBar line (reconciler derived from on-disk bodies, not stale registry)" || fail "router pruned the new upstream -FooBar line (reconciler still reading stale dispatch)"

echo "=== T63: graduate reconciles router quick-ref directly (no follow-up upgrade needed) (Codex F3) ==="
GR="$BASE/graduate"
GRENG="$(mk_proj "$GR" GrProj)"
# Before graduate: router carries the -Setup line
grep -q "^/321 -Setup" "$GR/.claude/skills/321/SKILL.md" && pass "router carries -Setup before graduate" || fail "router missing -Setup line in fresh project"
node "$GRENG" graduate >/dev/null 2>&1
# After graduate: router has no -Setup line (without any upgrade step)
grep -q "^/321 -Setup" "$GR/.claude/skills/321/SKILL.md" && fail "router still carries -Setup line after graduate (the reconciler did not run)" || pass "graduate pruned the -Setup quick-ref line directly"
