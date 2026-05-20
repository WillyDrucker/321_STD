# 321_STD installer for Windows / PowerShell.
#
# Usage (one-line, current directory):
#   iwr -useb https://raw.githubusercontent.com/WillyDrucker/321_STD/main/install.ps1 | iex
#
# Configure via env vars before piping:
#   $env:STD321_NAME = "MyProject"; iwr -useb URL | iex
#
# Or save and run directly:
#   .\install.ps1 -Name MyProject [-Profile standards] [-Target .] [-Force]
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

$ErrorActionPreference = "Stop"

# Defaults from env. Profile left empty so init.mjs can auto-detect.
$Name    = $env:STD321_NAME
$ReleaseProfile = $env:STD321_PROFILE
$Target  = if ($env:STD321_TARGET)  { $env:STD321_TARGET }  else { "." }
$Force   = $env:STD321_FORCE -eq "true"

# Parse positional args (for saved-file invocation)
for ($i = 0; $i -lt $args.Count; $i++) {
  switch ($args[$i]) {
    "-Name"    { $Name    = $args[++$i] }
    "-Profile" { $ReleaseProfile = $args[++$i] }
    "-Target"  { $Target  = $args[++$i] }
    "-Force"   { $Force   = $true }
  }
}

# Sanity: Node + git required
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is required. Install from https://nodejs.org and re-run." -ForegroundColor Red
  exit 1
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "git is required. Install from https://git-scm.com and re-run." -ForegroundColor Red
  exit 1
}

# Resolve target (create if missing)
if (-not (Test-Path $Target)) {
  New-Item -ItemType Directory -Path $Target -Force | Out-Null
}
$Target = (Resolve-Path $Target).Path

# Default name to target dir's basename if not provided
if (-not $Name) {
  $Name = Split-Path -Leaf $Target
}
if (-not ($Name -match '^[A-Za-z][A-Za-z0-9_-]*$')) {
  Write-Host "Invalid project name: '$Name'. Must start with a letter and contain only letters / digits / underscore / hyphen." -ForegroundColor Red
  Write-Host "Pass -Name <NAME> or rename the target directory." -ForegroundColor Yellow
  exit 1
}

# Validate profile only if explicitly set. Empty -> init.mjs auto-detects.
$validProfiles = @("standards", "npm-package", "vscode-extension", "cloudflare-worker", "cloudflare-pages", "static-site", "none")
if ($ReleaseProfile -and ($validProfiles -notcontains $ReleaseProfile)) {
  Write-Host "Invalid profile: '$ReleaseProfile'. Must be one of: $($validProfiles -join ', ')" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Installing 321_STD" -ForegroundColor Cyan
Write-Host "  Target:  $Target"
Write-Host "  Name:    $Name"
if ($ReleaseProfile) {
  Write-Host "  Profile: $ReleaseProfile"
} else {
  Write-Host "  Profile: (auto-detect)"
}
Write-Host ""

# Shallow clone to a temp dir
$tempDir = Join-Path $env:TEMP "321std-install-$(Get-Random)"
Write-Host "Fetching 321_STD..."
git clone --depth 1 --quiet https://github.com/WillyDrucker/321_STD.git $tempDir
if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed to clone 321_STD repository." -ForegroundColor Red
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
  exit 1
}

# Build init args. Only pass --release-profile if user set it explicitly.
$initArgs = @($Target, "--name", $Name)
if ($ReleaseProfile) { $initArgs += @("--release-profile", $ReleaseProfile) }
if ($Force)   { $initArgs += "--force" }

Write-Host "Scaffolding..."
& node "$tempDir/AIDOCS/tools/memory.mjs" init @initArgs
if ($LASTEXITCODE -ne 0) {
  Write-Host "Init failed." -ForegroundColor Red
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
  exit 1
}

# Sync + doctor in the new project. Also git init if not already a repo.
Push-Location $Target
$failed = $null
try {
  Write-Host ""
  Write-Host "Registering skills..."
  & node "AIDOCS/tools/memory.mjs" sync
  if ($LASTEXITCODE -ne 0) { throw "sync failed" }

  Write-Host ""
  Write-Host "Health check..."
  & node "AIDOCS/tools/memory.mjs" doctor --structural-only
  if ($LASTEXITCODE -ne 0) { throw "doctor failed" }

  if (-not (Test-Path ".git")) {
    Write-Host ""
    Write-Host "Initializing git..."
    git init --quiet
    if ($LASTEXITCODE -ne 0) { throw "git init failed" }
  }
} catch {
  $failed = $_
} finally {
  Pop-Location
}
if ($failed) {
  Write-Host $failed -ForegroundColor Red
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
  exit 1
}

# Cleanup the temp clone
Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "321_STD installed at $Target" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  cd `"$Target`""
Write-Host "  Open in your editor"
Write-Host "  Run /321 -Setup (optional - first-run wizard or migration, auto-detected. Project is usable as-is)"
