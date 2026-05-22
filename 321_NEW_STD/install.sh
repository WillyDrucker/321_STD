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
#   --target DIR / STD321_TARGET   where to install. Default: current directory.
#   --name NAME  / STD321_NAME     project name (letter, then letters / digits / _ / -).
#                                  Default: target directory basename.
#   --repo URL   / STD321_REPO     engine repo to clone when no local engine is found.

set -eu

NAME="${STD321_NAME:-}"
TARGET="${STD321_TARGET:-.}"
REPO="${STD321_REPO:-https://github.com/WillyDrucker/321_STD.git}"

require_value() { if [ -z "${2:-}" ] || [ "${2#--}" != "$2" ]; then echo "Missing value for $1" >&2; exit 1; fi; }
while [ $# -gt 0 ]; do
  case "$1" in
    --name)   require_value "$1" "${2:-}"; NAME="$2"; shift 2 ;;
    --target) require_value "$1" "${2:-}"; TARGET="$2"; shift 2 ;;
    --repo)   require_value "$1" "${2:-}"; REPO="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

command -v node >/dev/null 2>&1 || { echo "Node.js required. Install from https://nodejs.org" >&2; exit 1; }
command -v git  >/dev/null 2>&1 || { echo "git required. Install from https://git-scm.com" >&2; exit 1; }

mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"
[ -z "$NAME" ] && NAME="$(basename "$TARGET")"
if ! [[ "$NAME" =~ ^[A-Za-z][A-Za-z0-9_-]*$ ]]; then
  echo "Invalid project name: '$NAME'. Start with a letter; letters / digits / _ / - only." >&2
  echo "Pass --name <NAME> or rename the target directory." >&2
  exit 1
fi

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

echo "Scaffolding..."
node "$ENGINE/AIDOCS/tools/engine.mjs" init "$TARGET" --name "$NAME"

cd "$TARGET"
echo ""
echo "Registering skills..."
node AIDOCS/tools/engine.mjs sync
echo ""
echo "Health check..."
node AIDOCS/tools/engine.mjs doctor
if [ ! -d ".git" ]; then
  echo ""
  echo "Initializing git..."
  git init --quiet
fi

echo ""
echo "321 installed at $TARGET"
echo ""
echo "Next steps:"
echo "  cd '$TARGET'"
echo "  Open in your editor, then run /321 -Setup (optional first-run wizard or migration. The project is usable as-is)."
