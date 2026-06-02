#!/usr/bin/env bash
# 321 installer for macOS / Linux / Git Bash.
#
# Lays the 321 skeleton into a target project: init -> register -> doctor -> git init.
# Run it from a clone of the 321 repo (the engine ships in the repo), or pipe the
# published one-liner, which clones the repo into a temp dir first.
#
#   Local (you have the repo):
#     ./install.sh --target ../my-project --name MyProject
#   Remote (one line):
#     curl -fsSL <raw-install-url> | bash -s -- --target . --name MyProject
#
# Options / env (all optional):
#   --target DIR  / STD321_TARGET   where to install. Default: current directory.
#   --name NAME   / STD321_NAME     project name (letter, then letters / digits / _ / -).
#                                   Default: target directory basename.
#   --repo URL    / STD321_REPO     engine repo to clone when no local engine is found.
#   --privacy M   / STD321_PRIVACY  tracking mode: private (default - tracks the project's
#                                   memory / auto-memory / WDDOCS) or public (gates them
#                                   local, the engine is tracked either way).

set -eu

NAME="${STD321_NAME:-}"
TARGET="${STD321_TARGET:-.}"
REPO="${STD321_REPO:-https://github.com/WillyDrucker/321_STD.git}"
PRIVACY="${STD321_PRIVACY:-}"

require_value() { if [ -z "${2:-}" ] || [ "${2#--}" != "$2" ]; then echo "Missing value for $1" >&2; exit 1; fi; }
while [ $# -gt 0 ]; do
  case "$1" in
    --name)    require_value "$1" "${2:-}"; NAME="$2"; shift 2 ;;
    --target)  require_value "$1" "${2:-}"; TARGET="$2"; shift 2 ;;
    --repo)    require_value "$1" "${2:-}"; REPO="$2"; shift 2 ;;
    --privacy) require_value "$1" "${2:-}"; PRIVACY="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

command -v node >/dev/null 2>&1 || { echo "Node.js required. Install from https://nodejs.org" >&2; exit 1; }
command -v git  >/dev/null 2>&1 || { echo "git required. Install from https://git-scm.com" >&2; exit 1; }

mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"
[ -z "$NAME" ] && NAME="$(basename "$TARGET")"
if ! [[ "$NAME" =~ ^[A-Za-z][A-Za-z0-9_-]*$ ]]; then
  echo "Invalid project name: '$NAME'. Start with a letter, then letters / digits / _ / - only." >&2
  echo "Pass --name <NAME> or rename the target directory." >&2
  exit 1
fi

# Did the target already hold project content (checked before init writes)? Then
# doctor's pre-migration findings are expected, and setup reconciles them, so they
# report without failing the install. A fresh scaffold must still pass cleanly.
existing=false
for marker in ".claude/skills/321" "AIDOCS" "AGENTS.md" "CLAUDE.md" "package.json" "src"; do
  if [ -e "$TARGET/$marker" ]; then existing=true; break; fi
done

# Distinguish an existing 321 install (registry present) from a generic existing project,
# so the install can point users at the lighter -UpdateSync path for an engine-only refresh.
existing321=false
if [ -f "$TARGET/AIDOCS/_index.json" ]; then existing321=true; fi

# Engine source: the repo this script ships in if it carries the engine,
# otherwise a shallow clone of REPO into a temp dir we remove afterward.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"
CLONE_TMP=""
trap 'if [ -n "$CLONE_TMP" ]; then rm -rf "$CLONE_TMP"; fi' EXIT
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/AIDOCS/tools/engine.mjs" ]; then
  ENGINE="$SCRIPT_DIR"
else
  CLONE_TMP="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/321-$$")"
  mkdir -p "$CLONE_TMP"
  echo "Fetching the 321 engine..."
  git clone --depth 1 --quiet "$REPO" "$CLONE_TMP"
  ENGINE="$CLONE_TMP"
fi

echo ""
echo "Installing 321"
echo "  Target: $TARGET"
echo "  Name:   $NAME"
echo ""

if [ "$existing321" = true ]; then
  echo "Note: an existing 321 install was detected at $TARGET."
  echo "  For an engine-only refresh, /321 -UpdateSync (from the project) is the lighter path."
  echo "  Continuing with the full install - it is write-if-missing, your data files are preserved."
  echo ""
fi

echo "Scaffolding..."
# Pass --upstream so init records the install source into engine.upstream (write-if-empty)
# in one pass, no post-init shell rewrite. A user-customized upstream (a fork URL) survives
# because init only writes when the current value is empty.
if [ -n "$PRIVACY" ]; then
  node "$ENGINE/AIDOCS/tools/engine.mjs" init "$TARGET" --name "$NAME" --privacy "$PRIVACY" --upstream "$REPO"
else
  node "$ENGINE/AIDOCS/tools/engine.mjs" init "$TARGET" --name "$NAME" --upstream "$REPO"
fi

cd "$TARGET"

echo ""
echo "Registering skills..."
node AIDOCS/tools/engine.mjs sync
echo ""
echo "Health check..."
if ! node AIDOCS/tools/engine.mjs doctor; then
  if [ "$existing" = true ]; then
    echo "doctor reports pre-migration issues - expected for an existing project, setup reconciles them."
  else
    echo "doctor failed" >&2
    exit 1
  fi
fi
if [ "$existing" = false ] && [ ! -d ".git" ]; then
  echo ""
  echo "Initializing git..."
  git init --quiet
fi

echo ""
echo "321 engine installed at $TARGET"
echo ""
echo "Next: setup (fresh fill or migration) finishes onboarding and is part of the install."
echo "  An assistant driving this install continues into INSTALL/setup.md now."
echo "  Standalone: open the project and have your assistant run INSTALL/setup.md."
# Explicit success exit so a downstream harness sees 0. Doctor's exit was already
# consumed by the `if ! ... doctor` guard above on the existing-project path.
exit 0
