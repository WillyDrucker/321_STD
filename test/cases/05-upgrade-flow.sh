# 05-upgrade-flow.sh - the upgrade lifecycle around the operations layer (covered in
# 04-upgrade-ops.sh): post-upgrade INSTALL/ cleanup (mid-migration keeps the runbooks,
# graduated removes the empty INSTALL/, dry-run mutates nothing), fetch-engine's
# upstream-defaulting behavior, init --upstream recording + the recall path through
# SETUP_ARCHIVE, the user-facing rename summary, the router quick-ref reconciler (on
# upgrade and on graduate), the pre-upgrade engine snapshot to TEMP/, and the three
# recent hardening fixes (snapshot-before-handlers, router preserves new upstream flags,
# graduate runs the reconciler directly).

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

echo "=== T47: init --upstream records engine.upstream (explicit wins, write-if-missing preserves user fork URL on reinstall) ==="
UP47="$BASE/initupstream"
node "$RENG" init "$UP47" --name UpInit --upstream "https://example.com/fork.git" >/dev/null 2>&1
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.upstream === "https://example.com/fork.git" ? 0 : 1)' "$UP47/AIDOCS/_index.json" && pass "init --upstream recorded the URL into engine.upstream" || fail "init --upstream did not record the URL"
# Reinstall (write-if-missing init): the recorded upstream should survive a different --upstream flag.
node "$RENG" init "$UP47" --name UpInit --upstream "https://other.example.com/elsewhere.git" >/dev/null 2>&1
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.upstream === "https://example.com/fork.git" ? 0 : 1)' "$UP47/AIDOCS/_index.json" && pass "reinstall preserves user-customized engine.upstream (write-if-empty contract)" || fail "reinstall overwrote engine.upstream"
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
# Forked source with a non-empty engine.upstream still honors an explicit --upstream
# (the previous "write-if-source-empty" check would have silently ignored the flag).
UPF="$BASE/initupstreamfork"
FORK="$BASE/forksrc"
mkdir -p "$FORK"
cp -r "$REAL/." "$FORK/" 2>/dev/null
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.engine.upstream="https://forked-source.example.com/fork.git";fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$FORK/AIDOCS/_index.json"
node "$FORK/AIDOCS/tools/engine.mjs" init "$UPF" --name UpFork --upstream "https://user-explicit.example.com/wanted.git" >/dev/null 2>&1
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1])).engine.upstream === "https://user-explicit.example.com/wanted.git" ? 0 : 1)' "$UPF/AIDOCS/_index.json" && pass "explicit --upstream overrides a non-empty source engine.upstream (fork-source case)" || fail "explicit --upstream silently ignored when source had a value"

echo "=== T48: fetch-engine defaults --repo from engine.upstream when no flag given ==="
FE48="$BASE/fetchdefault"
node "$RENG" init "$FE48" --name FeProj --upstream "https://example.com/fedefault.git" >/dev/null 2>&1
FEENG="$FE48/AIDOCS/tools/engine.mjs"
# No --repo, no --from: should pick up engine.upstream from the registry and report it.
# The clone itself will fail (bogus URL), but the default-resolution log line and the
# clone-failure exit (21) prove the default path fired.
FEOUT="$(node "$FEENG" fetch-engine 2>&1)"; FECC=$?
echo "$FEOUT" | grep -q "defaulting --repo to engine.upstream (https://example.com/fedefault.git)" && pass "fetch-engine logs the defaulted --repo from engine.upstream" || fail "fetch-engine did not log the defaulted --repo"
[ "$FECC" = "21" ] && pass "fetch-engine still exits 21 on clone failure after defaulting" || fail "fetch-engine exit code after default-clone unexpected ($FECC)"
# Empty engine.upstream + no flag: the missing-args error still fires (no default available).
FEE="$BASE/fetchdefaultempty"
node "$RENG" init "$FEE" --name FeeProj >/dev/null 2>&1
FEEOUT="$(node "$FEE/AIDOCS/tools/engine.mjs" fetch-engine 2>&1)"; FEECC=$?
[ "$FEECC" = "5" ] && pass "fetch-engine still errors when no upstream is recorded and no flag given" || fail "fetch-engine wrongly succeeded with empty registry and no flag (exit $FEECC)"
echo "$FEEOUT" | grep -q "needs --from <dir> or --repo <url>" && pass "fetch-engine empty-registry error message preserved" || fail "fetch-engine missing-args message changed"

echo "=== T57: upgrade prints command flag renames from skill_rename ops applied this run (W1) ==="
RN57="$BASE/renamesummary"
node "$RENG" init "$RN57" --name RnSummary >/dev/null 2>&1
RNENG_57="$RN57/AIDOCS/tools/engine.mjs"
RNSRC_57="$BASE/renamesummary-src"
mkdir -p "$RNSRC_57/AIDOCS" "$RNSRC_57/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$RNSRC_57/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$RNSRC_57/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$RNSRC_57/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$RNSRC_57/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$RNSRC_57/.claude/skills/321/SKILL.md"
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
node "$RENG" init "$RQ" --name RqProj >/dev/null 2>&1
RQENG="$RQ/AIDOCS/tools/engine.mjs"
# Graduate first to deregister -Setup, then run upgrade and verify the router quick-ref drops the orphan
node "$RQENG" graduate >/dev/null 2>&1
RQSRC="$BASE/routerquickrefsrc"
mkdir -p "$RQSRC/AIDOCS" "$RQSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$RQSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$RQSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$RQSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$RQSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$RQSRC/.claude/skills/321/SKILL.md"
printf '{ "operations": [] }\n' > "$RQSRC/AIDOCS/MANIFEST.json"
node "$RQENG" fetch-engine --from "$RQSRC" >/dev/null 2>&1
RQOUT="$(node "$RQENG" upgrade 2>&1)"
# The router copied verbatim from source carries the -Setup line; the reconciler should drop it on a graduated project
grep -q "^/321 -Setup" "$RQ/.claude/skills/321/SKILL.md" && fail "router still carries -Setup line after upgrade on graduated project" || pass "router quick-ref pruned the -Setup line on graduated project"
echo "$RQOUT" | grep -q "pruned 1 stale quick-ref line" && pass "upgrade reports the quick-ref pruning" || fail "upgrade did not report router prune"

echo "=== T59: upgrade auto-snapshots prior engine to TEMP/ before write (W3) ==="
SS="$BASE/snapshot"
node "$RENG" init "$SS" --name SsProj >/dev/null 2>&1
SSENG="$SS/AIDOCS/tools/engine.mjs"
SSSRC="$BASE/snapshotsrc"
mkdir -p "$SSSRC/AIDOCS" "$SSSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$SSSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$SSSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$SSSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$SSSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$SSSRC/.claude/skills/321/SKILL.md"
printf '{ "operations": [] }\n' > "$SSSRC/AIDOCS/MANIFEST.json"
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
node "$RENG" init "$SO" --name SoProj >/dev/null 2>&1
SOENG="$SO/AIDOCS/tools/engine.mjs"
SOSRC="$BASE/snapordersrc"
mkdir -p "$SOSRC/AIDOCS" "$SOSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$SOSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$SOSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$SOSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$SOSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$SOSRC/.claude/skills/321/SKILL.md"
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
node "$RENG" init "$NFLAG" --name NfProj >/dev/null 2>&1
NFENG_62="$NFLAG/AIDOCS/tools/engine.mjs"
NFSRC_62="$BASE/newflagsrc"
mkdir -p "$NFSRC_62/AIDOCS" "$NFSRC_62/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$NFSRC_62/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$NFSRC_62/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$NFSRC_62/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$NFSRC_62/AIDOCS/_index.json"
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
printf '{ "operations": [] }\n' > "$NFSRC_62/AIDOCS/MANIFEST.json"
node "$NFENG_62" fetch-engine --from "$NFSRC_62" >/dev/null 2>&1
node "$NFENG_62" upgrade >/dev/null 2>&1
# The reconciler must keep the new line because SKILL_FOOBAR.md is on disk after the copy
grep -q "^/321 -FooBar" "$NFLAG/.claude/skills/321/SKILL.md" && pass "router quick-ref kept the new -FooBar line (reconciler derived from on-disk bodies, not stale registry)" || fail "router pruned the new upstream -FooBar line (reconciler still reading stale dispatch)"

echo "=== T63: graduate reconciles router quick-ref directly (no follow-up upgrade needed) (Codex F3) ==="
GR="$BASE/graduate"
node "$RENG" init "$GR" --name GrProj >/dev/null 2>&1
GRENG="$GR/AIDOCS/tools/engine.mjs"
# Before graduate: router carries the -Setup line
grep -q "^/321 -Setup" "$GR/.claude/skills/321/SKILL.md" && pass "router carries -Setup before graduate" || fail "router missing -Setup line in fresh project"
node "$GRENG" graduate >/dev/null 2>&1
# After graduate: router has no -Setup line (without any upgrade step)
grep -q "^/321 -Setup" "$GR/.claude/skills/321/SKILL.md" && fail "router still carries -Setup line after graduate (the reconciler did not run)" || pass "graduate pruned the -Setup quick-ref line directly"

echo "=== T67: merge-status classifies customizations[] entries against the fetched upstream (AI merge punch list) ==="
# Three entries cover all three states. The script provides the punch list; the AI
# walks it during -UpdateSync to drop / merge / delete per entry.
MS="$BASE/merge-status"
node "$RENG" init "$MS" --name MsProj >/dev/null 2>&1
MSENG="$MS/AIDOCS/tools/engine.mjs"
MSSRC="$BASE/merge-status-src"
mkdir -p "$MSSRC/AIDOCS" "$MSSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$MSSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$MSSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$MSSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$MSSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$MSSRC/.claude/skills/321/SKILL.md"
printf '{ "operations": [] }\n' > "$MSSRC/AIDOCS/MANIFEST.json"
# Identical case: local matches upstream verbatim (no customization in practice).
# Diverged case: local has an extra marker the upstream lacks.
printf '\nDIVERGED_LOCAL_MARKER\n' >> "$MS/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md"
# Upstream-absent case: local has a file the upstream tree never shipped.
printf 'project-only canonical edit\n' > "$MS/AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md"
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.customizations=["AIDOCS/SKILL/SKILL_UPDATE-SESSION.md","AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md","AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md"];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$MS/AIDOCS/_index.json"
node "$MSENG" fetch-engine --from "$MSSRC" >/dev/null 2>&1
# Refuses cleanly when fetch was not run
MSOUT_NOFETCH="$(node "$RENG" merge-status --root "$BASE/merge-status-bare" 2>&1)" || true
MSREFUSE="$(cd "$MS" && rm -rf INSTALL/engine && node "$MSENG" merge-status 2>&1)"; MSREFCC=$?
echo "$MSREFUSE" | grep -q "no fetched engine" && pass "merge-status reports no fetched engine when INSTALL/engine missing" || fail "no missing-fetch message"
[ "$MSREFCC" = "20" ] && pass "merge-status exits 20 when fetch is missing" || fail "merge-status exit code on missing fetch was $MSREFCC (expected 20)"
# Re-fetch for the real run
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
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.customizations=[];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$MS/AIDOCS/_index.json"
EMPTY="$(node "$MSENG" merge-status 2>&1)"
echo "$EMPTY" | grep -q "nothing to merge" && pass "merge-status no-ops cleanly on empty customizations[]" || fail "merge-status did not report nothing-to-merge"

echo "=== T72: merge-status --auto-drop-clean trims identical + upstream-absent, leaves diverged for AI merge ==="
# The mechanical sweep half of -UpdateSync -FULL. Identical and upstream-absent
# entries drop without AI judgment (file matches upstream verbatim, or has no
# upstream counterpart). Diverged entries survive for the AI to merge.
AD="$BASE/auto-drop"
node "$RENG" init "$AD" --name AdProj >/dev/null 2>&1
ADENG="$AD/AIDOCS/tools/engine.mjs"
ADSRC="$BASE/auto-drop-src"
mkdir -p "$ADSRC/AIDOCS" "$ADSRC/.claude/skills/321"
cp -r "$REAL/AIDOCS/tools" "$ADSRC/AIDOCS/tools"
cp -r "$REAL/AIDOCS/SKILL" "$ADSRC/AIDOCS/SKILL"
cp -r "$REAL/AIDOCS/automemory" "$ADSRC/AIDOCS/automemory"
cp "$REAL/AIDOCS/_index.json" "$ADSRC/AIDOCS/_index.json"
cp "$REAL/.claude/skills/321/SKILL.md" "$ADSRC/.claude/skills/321/SKILL.md"
printf '{ "operations": [] }\n' > "$ADSRC/AIDOCS/MANIFEST.json"
# Same shape as T67: identical / diverged / upstream-absent
printf '\nDIVERGED_LOCAL_MARKER\n' >> "$AD/AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md"
printf 'project-only canonical edit\n' > "$AD/AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md"
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.customizations=["AIDOCS/SKILL/SKILL_UPDATE-SESSION.md","AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md","AIDOCS/SKILL/SKILL_NEVER-UPSTREAM.md"];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$AD/AIDOCS/_index.json"
node "$ADENG" fetch-engine --from "$ADSRC" >/dev/null 2>&1
ADOUT="$(node "$ADENG" merge-status --auto-drop-clean 2>&1)"
echo "$ADOUT" | grep -q "dropped 2 entries" && pass "auto-drop-clean reports the two clean drops (identical + upstream-absent)" || fail "auto-drop-clean did not report 2 drops (output: $ADOUT)"
echo "$ADOUT" | grep -q "identical to upstream" && pass "auto-drop-clean labels the identical drop" || fail "no identical-to-upstream label"
echo "$ADOUT" | grep -q "upstream-absent" && pass "auto-drop-clean labels the upstream-absent drop" || fail "no upstream-absent label"
echo "$ADOUT" | grep -q "1 diverged entry left for AI merge" && pass "auto-drop-clean reports the diverged remainder for AI" || fail "no diverged-remainder summary"
# _index.json now has only the diverged entry
ADREMAIN="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).customizations.join(","))' "$AD/AIDOCS/_index.json")"
[ "$ADREMAIN" = "AIDOCS/SKILL/SKILL_UPDATE-MEMORY.md" ] && pass "_index.json customizations[] curated down to only the diverged entry" || fail "customizations[] left as: $ADREMAIN"
# Re-fetch (engine cleanup) for idempotency check
node "$ADENG" fetch-engine --from "$ADSRC" >/dev/null 2>&1
ADRERUN="$(node "$ADENG" merge-status --auto-drop-clean 2>&1)"
echo "$ADRERUN" | grep -q "no clean entries to drop" && pass "auto-drop-clean idempotent: second pass reports no clean drops left" || fail "second auto-drop-clean pass did not no-op cleanly (output: $ADRERUN)"
# Empty customizations[] short-circuits even with the flag
node -e 'const f=process.argv[1],fs=require("fs");const j=JSON.parse(fs.readFileSync(f));j.customizations=[];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$AD/AIDOCS/_index.json"
ADEMPTY="$(node "$ADENG" merge-status --auto-drop-clean 2>&1)"
echo "$ADEMPTY" | grep -q "nothing to merge" && pass "auto-drop-clean honors the empty-customizations short-circuit" || fail "auto-drop-clean did not short-circuit on empty array"
