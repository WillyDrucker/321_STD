# 11-exposure.sh - the publish gate: doctor reads what git tracks and what it would add on
# the next `add -A`, not what the .gitignore text promises, since an ignore rule never
# untracks a file added before it and a new unignored file is one commit from public.
#
#   T125  a secret-shaped string in a tracked file is a structural failure (exit 20)
#   T126  a privacy-gated path that is tracked anyway is reported, mode by mode
#   T127  a user home path in a published doc is an advisory warning, a fixture path is not
#   T130  an unignored untracked file is scanned too, a bare shell-style credential is
#         caught, and placeholders, shell expansions and the documented example key are not
#   T131  the dotfile gates match at any depth, and a tracked path that became a folder is
#         skipped rather than read
#   T128  off a repository the gate is silent, and a dash-led clone target is refused
#   T141  a kebab-case slug is not an API key, a mixed-case sk- token is, and a
#         .env.<name>.example is an example, not a gated .env
#
# Sourced after 10.

echo "=== T125: a secret-shaped string in a tracked file fails doctor with exit 20 ==="
EX="$BASE/exposure"
EXENG="$(mk_proj "$EX" Exposure)"
dc_git_commit "$EX"
node "$EXENG" doctor >/dev/null 2>&1; EX0=$?
[ "$EX0" = "0" ] && pass "a clean fresh repository passes the exposure gate" || fail "a fresh repository failed doctor (exit $EX0)"
# Built by concatenation so this lane never trips the gate on the engine's own tree.
TOKEN="AKIA$(printf 'Q%.0s' $(seq 1 16))"
printf 'The old deploy used %s for uploads.\n' "$TOKEN" > "$EX/NOTES.md"
git -C "$EX" add NOTES.md
EXOUT="$(node "$EXENG" doctor 2>&1)"; EX1=$?
[ "$EX1" = "20" ] && pass "a tracked secret is a structural failure (exit 20)" || fail "doctor exit was $EX1 with a tracked secret (output: $EXOUT)"
echo "$EXOUT" | grep -q 'NOTES.md" line 1 looks like an AWS access key' && pass "the finding names the file, the line, and the shape" || fail "finding text wrong (output: $EXOUT)"
git -C "$EX" rm -q --cached NOTES.md; rm -f "$EX/NOTES.md"
printf 'API_KEY="your-key-here"\n' > "$EX/.env.example"
git -C "$EX" add .env.example
EXPL="$(node "$EXENG" doctor 2>&1)"; EXPLE=$?
echo "$EXPL" | grep -q "looks like" && fail "a placeholder credential in .env.example was flagged" || pass "a placeholder credential in a tracked .env.example is not a finding"
[ "$EXPLE" = "0" ] && pass "and doctor ran to a clean exit on it" || fail "doctor exit was $EXPLE on the placeholder file (output: $EXPL)"

echo "=== T126: a privacy-gated path that is tracked anyway is reported, mode by mode ==="
printf 'METRO_PORT=8081\n' > "$EX/AIDOCS/ENV/Exposure_ENV_DEV.md"
git -C "$EX" add -f AIDOCS/ENV/Exposure_ENV_DEV.md
printf 'X=1\n' > "$EX/.env"
git -C "$EX" add -f .env
EXG="$(node "$EXENG" doctor 2>&1)"
echo "$EXG" | grep -q 'tracked an ENV doc "AIDOCS/ENV/Exposure_ENV_DEV.md"' && pass "a force-added ENV doc is caught (the ignore text was right, the leak was live)" || fail "tracked ENV doc not reported (output: $EXG)"
echo "$EXG" | grep -q 'tracked a .env file ".env"' && pass "a tracked .env is caught in every mode" || fail "tracked .env not reported"
echo "$EXG" | grep -q 'tracked a rule or profile' && fail "private mode flagged its own tracked rules" || pass "private mode tracks the rules and the profile without complaint"
git -C "$EX" rm -q --cached AIDOCS/ENV/Exposure_ENV_DEV.md .env; rm -f "$EX/AIDOCS/ENV/Exposure_ENV_DEV.md" "$EX/.env"
node "$EXENG" privacy --set public >/dev/null 2>&1
node "$EXENG" doctor >/dev/null 2>&1; EXP=$?
[ "$EXP" = "0" ] && pass "privacy --set public untracked the gated content, so the gate reads clean" || fail "the public flip left gated content tracked (exit $EXP)"
git -C "$EX" add -f AIDOCS/automemory/user_name.md AIDOCS/Exposure_MEMORY.md
EXPUB="$(node "$EXENG" doctor 2>&1)"
echo "$EXPUB" | grep -q 'tracked a rule or profile "AIDOCS/automemory/user_name.md"' && pass "public mode reports a tracked profile" || fail "public mode missed a tracked profile (output: $EXPUB)"
echo "$EXPUB" | grep -q 'tracked project knowledge "AIDOCS/Exposure_MEMORY.md"' && pass "public mode reports tracked project knowledge" || fail "public mode missed tracked knowledge"
git -C "$EX" rm -q --cached AIDOCS/automemory/user_name.md AIDOCS/Exposure_MEMORY.md

echo "=== T127: a user home path in a published doc is an advisory warning, a fixture path is not ==="
HP="C:"'\'"Users"'\'"someone"'\'"logs"
printf 'Logs land in %s.\n' "$HP" > "$EX/README.md"
git -C "$EX" add README.md
# The fixture shapes sit in their own file, so a false positive would show as a second warning.
printf 'The fixture lives under home/.claude/projects/x/ and /home/.claude/x/.\n' > "$EX/FIXTURE.md"
EXW="$(node "$EXENG" doctor 2>&1)"; EXWE=$?
echo "$EXW" | grep -q 'README.md" line 1 carries a user home path (warning)' && pass "a home path is warned, with the file and the line" || fail "home path not warned (output: $EXW)"
[ "$(echo "$EXW" | grep -c 'carries a user home path')" = "1" ] && pass "the dotted fixture paths in their own file are not read as a user home" || fail "a fixture path was read as a user home (output: $EXW)"
[ "$EXWE" = "0" ] && pass "a home path is advisory, the exit stays 0" || fail "a home path changed the exit to $EXWE"
rm -f "$EX/FIXTURE.md"

echo "=== T130: an unignored untracked file is scanned too, since the next add -A would publish it ==="
# With the ENV ignore rule gone, a new ENV doc is one `git add -A` from a commit.
cp "$EX/.gitignore" "$BASE/exposure-gitignore.keep"
sed -i '/^AIDOCS\/ENV\/\*$/d' "$EX/.gitignore"
printf 'DB_HOST=db.internal\n' > "$EX/AIDOCS/ENV/Exposure_ENV_LEAK.md"
EXU="$(node "$EXENG" doctor 2>&1)"; EXUE=$?
echo "$EXU" | grep -q 'unignored an ENV doc "AIDOCS/ENV/Exposure_ENV_LEAK.md"' && pass "an unignored ENV doc is reported before it is ever added" || fail "unignored ENV doc not reported (output: $EXU)"
[ "$EXUE" = "20" ] && pass "an unignored gated path is a structural failure (exit 20)" || fail "exit was $EXUE with an unignored gated path"
rm -f "$EX/AIDOCS/ENV/Exposure_ENV_LEAK.md"
mv "$BASE/exposure-gitignore.keep" "$EX/.gitignore"
printf 'export DB_PASSWORD=Pr0dS3cretValue99\n' > "$EX/deploy.sh"
EXS="$(node "$EXENG" doctor 2>&1)"; EXSE=$?
echo "$EXS" | grep -q 'deploy.sh" line 1 looks like an unquoted credential assignment' && pass "a bare shell-style credential is caught, in a file not yet added" || fail "unquoted credential missed (output: $EXS)"
[ "$EXSE" = "20" ] && pass "and it is a structural failure (exit 20)" || fail "exit was $EXSE with an untracked secret"
printf 'export DB_PASSWORD=changeme123\nPASSWORD=${PASSWORD}\nAKIAIOSFODNN7EXAMPLE is the documented sample key\n' > "$EX/deploy.sh"
EXN="$(node "$EXENG" doctor 2>&1)"; EXNE=$?
echo "$EXN" | grep -q "looks like" && fail "a placeholder value, a shell expansion or the documented example key was flagged (output: $EXN)" || pass "placeholder values, shell expansions and the documented example key are not findings"
[ "$EXNE" = "0" ] && pass "and doctor ran to a clean exit on them" || fail "doctor exit was $EXNE on the placeholder file (output: $EXN)"
rm -f "$EX/deploy.sh"

echo "=== T131: the dotfile gates match at any depth, and a tracked path that became a folder does not crash the scan ==="
mkdir -p "$EX/tools"
printf '{"mcpServers":{}}\n' > "$EX/tools/.mcp.json"
git -C "$EX" add -f tools/.mcp.json
EXM="$(node "$EXENG" doctor 2>&1)"
echo "$EXM" | grep -q 'tracked the MCP config "tools/.mcp.json"' && pass "a nested .mcp.json is gated like the root one, as the ignore pattern is" || fail "nested .mcp.json escaped the gate (output: $EXM)"
git -C "$EX" rm -q --cached tools/.mcp.json; rm -rf "$EX/tools"
printf 'plain\n' > "$EX/SWAP.md"; git -C "$EX" add SWAP.md; rm "$EX/SWAP.md"; mkdir "$EX/SWAP.md"
EXD="$(node "$EXENG" doctor 2>&1)"; EXDE=$?
echo "$EXD" | grep -q "EISDIR\|fatal:" && fail "a tracked path that became a folder crashed the scan (output: $EXD)" || pass "a tracked path that became a folder is skipped, not read"
[ "$EXDE" = "0" ] && pass "and the exit is clean" || fail "exit was $EXDE after the folder swap (output: $EXD)"
git -C "$EX" rm -q --cached SWAP.md; rmdir "$EX/SWAP.md"

echo "=== T128: off a repository the gate is silent, and a clone target that begins with a dash is refused ==="
NR="$BASE/exposure-norepo"
NRENG="$(mk_proj "$NR" NoRepo)"
NRCEIL="$BASE"; command -v cygpath >/dev/null 2>&1 && NRCEIL="$(cygpath -m "$BASE")"
GIT_CEILING_DIRECTORIES="$NRCEIL" node "$NRENG" doctor 2>&1 | grep -A1 "\[Exposure\]" | grep -q "ok" && pass "no repository, nothing published, the gate reads ok" || fail "the gate did not read ok off a repository"
node "$NRENG" fetch-engine --repo --upload-pack=x >/dev/null 2>&1; NRX=$?
[ "$NRX" = "5" ] && pass "a --repo that begins with a dash is refused before git sees it (exit 5)" || fail "dash-led --repo exit was $NRX (expected 5)"

echo "=== T141: a kebab-case slug is not an API key, a mixed-case sk- token is, and a .env.<name>.example is an example ==="
printf 'the-desk-sync-landed-the-watcher-on-the-page-for-the-session\n' > "$EX/SLUGS.md"
git -C "$EX" add SLUGS.md
EXK="$(node "$EXENG" doctor 2>&1)"; EXKE=$?
echo "$EXK" | grep -q 'SLUGS.md" line 1 looks like' && fail "a kebab slug was read as an API key (output: $EXK)" || pass "a kebab-case slug is not a key"
[ "$EXKE" = "0" ] && pass "and the exit stays clean" || fail "exit was $EXKE on the slug file (output: $EXK)"
KEY="sk-$(printf 'Ab9%.0s' $(seq 1 8))"
printf 'OPENAI=%s\n' "$KEY" > "$EX/SLUGS.md"
node "$EXENG" doctor 2>&1 | grep -q 'SLUGS.md" line 1 looks like an API key' && pass "a mixed-case sk- token is still a key" || fail "a real-shaped sk- token was missed"
git -C "$EX" rm -q --cached SLUGS.md; rm -f "$EX/SLUGS.md"
printf 'TOKEN=replace-me\n' > "$EX/.env.scripts.example"
git -C "$EX" add .env.scripts.example
EXE="$(node "$EXENG" doctor 2>&1)"; EXEE=$?
echo "$EXE" | grep -q 'tracked a .env file ".env.scripts.example"' && fail "a .env.<name>.example was gated as a .env file" || pass "a .env.<name>.example is an example, not a gated .env"
[ "$EXEE" = "0" ] && pass "and the exit stays clean" || fail "exit was $EXEE with the example tracked (output: $EXE)"
git -C "$EX" rm -q --cached .env.scripts.example; rm -f "$EX/.env.scripts.example"
