# runner.sh - shared globals and pass/fail counter for the 321 regression suite. Sourced
# by test/fixverify.sh before the per-feature case files. Owns the working tree wipe and
# the external-memory redirect so a test run is isolated from the real ~/.claude.

set -u

REAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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
