#!/usr/bin/env bash
# fixverify.sh - the 321 engine regression suite entry point. A thin orchestrator: sources
# the shared runner (globals + pass/fail), the upgrade fixture builders, builds the OLD321
# legacy fixture once, then runs each domain-focused case file in order so the migration
# arc in 01 sets up the $PROJ state the doctor / state checks in 02 reuse. Per-test
# isolated projects live under $BASE in each case file. Run from the repo root:
# bash test/fixverify.sh
# Each case file owns one cohesion lane:
#   01-migration.sh      - bootstrap rename, archive lanes, restore, 1:1 import + audit
#   02-doctor-state.sh   - doctor dimensions, state machine, discovery sweep, bigsix
#   03-privacy-init.sh   - privacy tiers + flips, init guards, auto-prune, auto-memory, validName
#   04-upgrade-ops.sh    - upgrade manifest operations: the APPLY surface + idempotency
#   05-upgrade-flow.sh   - upgrade lifecycle (cleanup, upstream defaults, router, snapshot)
#   06-upgrade-guards.sh - safety perimeter (dry-run, fail-fast, gates, containment, deferral)
#   07-sync-judgment.sh  - AI punch lists (merge-status classes, orphans classes)

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/lib/runner.sh"
. "$HERE/lib/upgrade-fixture.sh"
. "$HERE/lib/legacy-fixture.sh"

. "$HERE/cases/01-migration.sh"
. "$HERE/cases/02-doctor-state.sh"
. "$HERE/cases/03-privacy-init.sh"
. "$HERE/cases/04-upgrade-ops.sh"
. "$HERE/cases/05-upgrade-flow.sh"
. "$HERE/cases/06-upgrade-guards.sh"
. "$HERE/cases/07-sync-judgment.sh"

echo ""
if [ "$FAILED" = "0" ]; then echo "ALL CHECKS PASSED"; else echo "SOME CHECKS FAILED"; fi
exit $FAILED
