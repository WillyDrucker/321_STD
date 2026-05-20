#!/usr/bin/env bash
# 321_STD installer for macOS / Linux / Git Bash.
#
# Usage (one-line, current directory):
#   curl -fsSL https://raw.githubusercontent.com/WillyDrucker/321_STD/main/install.sh | bash
#
# Configure via env vars (set them on the bash process, not curl):
#   curl -fsSL URL | STD321_NAME=MyProject bash
#
# Or pass args through to the script:
#   curl -fsSL URL | bash -s -- --name MyProject --profile standards
#
# Or download and run directly:
#   ./install.sh [--name MyProject] [--profile standards] [--target .] [--force]
#
# Env vars (all optional):
#   STD321_NAME     project name (letters/digits/underscore/hyphen, starts with letter)
#                   Defaults to the target directory's basename.
#   STD321_PROFILE  release profile - standards | npm-package | vscode-extension |
#                                       cloudflare-worker | cloudflare-pages | static-site | none
#                   Defaults to auto-detect (package.json / wrangler.toml / config files).
#   STD321_TARGET   target directory. Defaults to current directory.
#   STD321_FORCE    "true" to rewrite scaffold files even if they already exist
#                   (engine files are always rewritten; user content is preserved by default).

set -eu

NAME="${STD321_NAME:-}"
PROFILE="${STD321_PROFILE:-}"
TARGET="${STD321_TARGET:-.}"
FORCE="${STD321_FORCE:-false}"

require_value() {
  if [[ -z "${2:-}" || "${2:-}" == --* ]]; then
    echo "Missing value for $1" >&2; exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)    require_value "$1" "${2:-}"; NAME="$2"; shift 2 ;;
    --profile) require_value "$1" "${2:-}"; PROFILE="$2"; shift 2 ;;
    --target)  require_value "$1" "${2:-}"; TARGET="$2"; shift 2 ;;
    --force)   FORCE="true"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Sanity: node + git required
command -v node >/dev/null 2>&1 || { echo "Node.js required. Install from https://nodejs.org" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "git required. Install from https://git-scm.com" >&2; exit 1; }

# Resolve target (create if missing)
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"

# Default name to target dir's basename if not provided
if [[ -z "$NAME" ]]; then
  NAME="$(basename "$TARGET")"
fi
if [[ ! "$NAME" =~ ^[A-Za-z][A-Za-z0-9_-]*$ ]]; then
  echo "Invalid project name: '$NAME'. Must start with a letter and contain only letters / digits / underscore / hyphen." >&2
  echo "Pass --name <NAME> or rename the target directory." >&2
  exit 1
fi

# Validate profile only if explicitly set. Empty -> init.mjs auto-detects.
if [[ -n "$PROFILE" ]]; then
  case "$PROFILE" in
    standards|npm-package|vscode-extension|cloudflare-worker|cloudflare-pages|static-site|none) ;;
    *) echo "Invalid profile: '$PROFILE'." >&2; exit 1 ;;
  esac
fi

echo ""
echo "Installing 321_STD"
echo "  Target:  $TARGET"
echo "  Name:    $NAME"
if [[ -n "$PROFILE" ]]; then
  echo "  Profile: $PROFILE"
else
  echo "  Profile: (auto-detect)"
fi
echo ""

# Shallow clone to system temp
TMPDIR_BASE="${TMPDIR:-/tmp}"
TMP_DIR="$TMPDIR_BASE/321std-install-$$-$RANDOM"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Fetching 321_STD..."
git clone --depth 1 --quiet https://github.com/WillyDrucker/321_STD.git "$TMP_DIR"

# Build init args. Only pass --release-profile if user set it explicitly.
INIT_ARGS=("$TARGET" --name "$NAME")
if [[ -n "$PROFILE" ]]; then
  INIT_ARGS+=(--release-profile "$PROFILE")
fi
if [[ "$FORCE" == "true" ]]; then
  INIT_ARGS+=(--force)
fi

echo "Scaffolding..."
node "$TMP_DIR/AIDOCS/tools/memory.mjs" init "${INIT_ARGS[@]}"

# Sync + doctor in the new project. Also git init if not already a repo.
cd "$TARGET"
echo ""
echo "Registering skills..."
node AIDOCS/tools/memory.mjs sync

echo ""
echo "Health check..."
node AIDOCS/tools/memory.mjs doctor --structural-only

if [[ ! -d ".git" ]]; then
  echo ""
  echo "Initializing git..."
  git init --quiet
fi

echo ""
echo "321_STD installed at $TARGET"
echo ""
echo "Next steps:"
echo "  cd '$TARGET'"
echo "  Open in your editor"
echo "  Run /321 -Setup (optional - first-run wizard or migration, auto-detected. Project is usable as-is)"
