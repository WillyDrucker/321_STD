# 321 installer for Windows / PowerShell.
#
# Lays the 321 skeleton into a target project: init -> register -> doctor -> git init.
# Run it from a clone of the 321 repo (the engine ships in the repo), or pipe the
# published one-liner, which clones the repo into a temp dir first.
#
#   Local (you have the repo):
#     .\install.ps1 -Target ..\my-project -Name MyProject
#   Remote (one line):
#     iwr -useb <raw-install-url> | iex
#
# Options / env (all optional):
#   -Target DIR  / STD321_TARGET   where to install. Default: current directory.
#   -Name NAME   / STD321_NAME     project name (letter, then letters / digits / _ / -).
#                                  Default: target directory basename.
#   -Repo URL    / STD321_REPO     engine repo to clone when no local engine is found.
#   -Privacy M   / STD321_PRIVACY  tracking mode: private (default - tracks the project's
#                                  memory / auto-memory / WDDOCS) or public (gates them
#                                  local; the engine is tracked either way).

$ErrorActionPreference = "Stop"

$Name    = $env:STD321_NAME
$Target  = if ($env:STD321_TARGET) { $env:STD321_TARGET } else { "." }
$Repo    = if ($env:STD321_REPO)   { $env:STD321_REPO }   else { "https://github.com/WillyDrucker/321_STD.git" }
$Privacy = $env:STD321_PRIVACY

function Require-Value($flagName, $value) {
  if ($null -eq $value -or $value -like '-*') { Write-Host "Missing value for $flagName" -ForegroundColor Red; exit 1 }
}
for ($i = 0; $i -lt $args.Count; $i++) {
  switch ($args[$i]) {
    "-Name"    { $v = $args[++$i]; Require-Value "-Name"    $v; $Name    = $v }
    "-Target"  { $v = $args[++$i]; Require-Value "-Target"  $v; $Target  = $v }
    "-Repo"    { $v = $args[++$i]; Require-Value "-Repo"    $v; $Repo    = $v }
    "-Privacy" { $v = $args[++$i]; Require-Value "-Privacy" $v; $Privacy = $v }
    default    { Write-Host "Unknown argument: $($args[$i])" -ForegroundColor Red; exit 1 }
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is required. Install from https://nodejs.org and re-run." -ForegroundColor Red; exit 1
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "git is required. Install from https://git-scm.com and re-run." -ForegroundColor Red; exit 1
}

if (-not (Test-Path $Target)) { New-Item -ItemType Directory -Path $Target -Force | Out-Null }
$Target = (Resolve-Path $Target).Path
if (-not $Name) { $Name = Split-Path -Leaf $Target }
if (-not ($Name -match '^[A-Za-z][A-Za-z0-9_-]*$')) {
  Write-Host "Invalid project name: '$Name'. Start with a letter, then letters / digits / _ / - only." -ForegroundColor Red
  Write-Host "Pass -Name <NAME> or rename the target directory." -ForegroundColor Yellow
  exit 1
}

# Did the target already hold project content (checked before init writes)? Then
# doctor's pre-migration findings are expected - a legacy AGENTS without the canonical
# Hard-rules, unscrubbed CHANGELOG voice - and setup reconciles them, so they report
# without failing the install. A fresh scaffold must still pass doctor cleanly.
$existing = $false
foreach ($marker in @(".claude/skills/321", "AIDOCS", "AGENTS.md", "CLAUDE.md", "package.json", "src")) {
  if (Test-Path (Join-Path $Target $marker)) { $existing = $true; break }
}

# Engine source: the repo this script ships in if it carries the engine,
# otherwise a shallow clone of Repo into a temp dir we remove afterward.
$cloneTmp = $null
$engine = $null
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot "AIDOCS/tools/engine.mjs"))) {
  $engine = $PSScriptRoot
} else {
  $cloneTmp = Join-Path ([System.IO.Path]::GetTempPath()) ("321-" + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $cloneTmp -Force | Out-Null
  Write-Host "Fetching the 321 engine..."
  git clone --depth 1 --quiet $Repo $cloneTmp
  if ($LASTEXITCODE -ne 0) { Remove-Item -Recurse -Force $cloneTmp; Write-Host "Failed to clone $Repo." -ForegroundColor Red; exit 1 }
  $engine = $cloneTmp
}

Write-Host ""
Write-Host "Installing 321" -ForegroundColor Cyan
Write-Host "  Target: $Target"
Write-Host "  Name:   $Name"
Write-Host ""

Write-Host "Scaffolding..."
$initArgs = @((Join-Path $engine "AIDOCS/tools/engine.mjs"), "init", $Target, "--name", $Name)
if ($Privacy) { $initArgs += @("--privacy", $Privacy) }
& node @initArgs
if ($LASTEXITCODE -ne 0) {
  if ($cloneTmp) { Remove-Item -Recurse -Force $cloneTmp }
  Write-Host "Init failed." -ForegroundColor Red; exit 1
}
if ($cloneTmp) { Remove-Item -Recurse -Force $cloneTmp }

Push-Location $Target
$failed = $null
try {
  Write-Host ""; Write-Host "Registering skills..."
  & node "AIDOCS/tools/engine.mjs" sync
  if ($LASTEXITCODE -ne 0) { throw "sync failed" }
  Write-Host ""; Write-Host "Health check..."
  & node "AIDOCS/tools/engine.mjs" doctor
  if ($LASTEXITCODE -ne 0) {
    if ($existing) { Write-Host "doctor reports pre-migration issues - expected for an existing project, setup reconciles them." -ForegroundColor Yellow }
    else { throw "doctor failed" }
  }
  if (-not $existing -and -not (Test-Path ".git")) {
    Write-Host ""; Write-Host "Initializing git..."
    git init --quiet
    if ($LASTEXITCODE -ne 0) { throw "git init failed" }
  }
} catch {
  $failed = $_
} finally {
  Pop-Location
}
if ($failed) { Write-Host $failed -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "321 engine installed at $Target" -ForegroundColor Green
Write-Host ""
Write-Host "Next: setup (fresh fill or migration) finishes onboarding and is part of the install."
Write-Host "  An assistant driving this install continues into INSTALL/setup.md now."
Write-Host "  Standalone: open the project and have your assistant run INSTALL/setup.md."
