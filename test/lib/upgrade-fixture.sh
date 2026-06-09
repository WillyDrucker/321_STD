# upgrade-fixture.sh - shared builders for the upgrade-domain case files (04-07).
# Collapses the per-test boilerplate: every upgrade test inits a scratch project and
# builds a tweaked upstream source tree from the REAL repo. Sourced by fixverify.sh
# after runner.sh (REAL / RENG / BASE come from there). Functions only, no execution.

# mk_proj <dir> <Name> [extra init flags...] - init a scratch project quietly and echo
# its engine path, so call sites collapse init + engine-var to one line:
#   XENG="$(mk_proj "$BASE/x" XProj)"
mk_proj() {
  local dir="$1" name="$2"; shift 2
  node "$RENG" init "$dir" --name "$name" "$@" >/dev/null 2>&1
  echo "$dir/AIDOCS/tools/engine.mjs"
}

# mk_src <dir> [--version <v>] [--empty-manifest|--real-manifest] [--no-automemory] [--no-router]
# Build an upgrade-source tree from the REAL repo: engine code, skill bodies, auto-memory
# seed, _index.json, router. Writes NO MANIFEST.json by default - the caller lays its own
# heredoc (or omits it for the manifest-less case). --version rewrites engine.version in
# the source _index.json. --real-manifest copies the repo's live MANIFEST.json.
mk_src() {
  local dir="$1"; shift
  local version="" manifest="" automemory=1 router=1
  while [ $# -gt 0 ]; do
    case "$1" in
      --version) version="$2"; shift 2 ;;
      --empty-manifest) manifest="empty"; shift ;;
      --real-manifest) manifest="real"; shift ;;
      --no-automemory) automemory=0; shift ;;
      --no-router) router=0; shift ;;
      *) echo "mk_src: unknown flag $1" >&2; return 1 ;;
    esac
  done
  mkdir -p "$dir/AIDOCS" "$dir/.claude/skills/321"
  cp -r "$REAL/AIDOCS/tools" "$dir/AIDOCS/tools"
  cp -r "$REAL/AIDOCS/SKILL" "$dir/AIDOCS/SKILL"
  [ "$automemory" = "1" ] && cp -r "$REAL/AIDOCS/automemory" "$dir/AIDOCS/automemory"
  cp "$REAL/AIDOCS/_index.json" "$dir/AIDOCS/_index.json"
  [ "$router" = "1" ] && cp "$REAL/.claude/skills/321/SKILL.md" "$dir/.claude/skills/321/SKILL.md"
  if [ -n "$version" ]; then
    node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.engine.version=process.argv[2];fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$dir/AIDOCS/_index.json" "$version"
  fi
  [ "$manifest" = "empty" ] && printf '{ "operations": [] }\n' > "$dir/AIDOCS/MANIFEST.json"
  [ "$manifest" = "real" ] && cp "$REAL/AIDOCS/MANIFEST.json" "$dir/AIDOCS/MANIFEST.json"
  return 0
}

# set_custom <project-root> [path...] - overwrite customizations[] in the project's
# _index.json with exactly the given paths. No paths clears the array.
set_custom() {
  local root="$1"; shift
  node -e 'const fs=require("fs"),f=process.argv[1];const j=JSON.parse(fs.readFileSync(f));j.customizations=process.argv.slice(2);fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")' "$root/AIDOCS/_index.json" "$@"
}

# reg_get <project-root> <dot.path> - print the registry value at the dotted path.
# Arrays / objects print as JSON (grep-able), scalars print bare, absent prints empty.
# Dotted-path traversal only - a key that itself contains dots (files["a.b"]) needs a
# bespoke node -e at the call site.
reg_get() {
  node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=process.argv[2].split(".").reduce((o,k)=>(o==null?undefined:o[k]),j);process.stdout.write(v===undefined||v===null?"":typeof v==="object"?JSON.stringify(v):String(v))' "$1/AIDOCS/_index.json" "$2"
}
