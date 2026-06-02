# legacy-fixture.sh - build the OLD321 legacy project fixture under $PROJ. The shape of a
# real pre-engine 321 migration: a populated MEMORY / SESSION / BACKLOG with paired
# EXTENDEDs, a DEV-AUDIT + AUTO-PUSH carrying markers the migrate-restore tests assert on,
# the legacy *_ARCHIVE auto-prune directories the old engine left behind, an edited
# canonical auto-memory rule plus a project-only custom rule, a stray .cursor/ + NOTES.md
# for the discovery sweep, and a package.json so bigsix has something to draft from.
# Sourced once before the 01-migration case file; the rename to NEW321 + archive lifecycle
# happens there.

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
