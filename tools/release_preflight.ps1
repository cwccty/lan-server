param(
  [switch]$FullBuild,
  [switch]$RunCargoTests,
  [switch]$SkipTauriBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Detail = ""
  )
  $results.Add([pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
  }) | Out-Null
}

function Fail-Check {
  param([string]$Name, [string]$Detail)
  Add-Result $Name "FAIL" $Detail
}

function Pass-Check {
  param([string]$Name, [string]$Detail = "")
  Add-Result $Name "PASS" $Detail
}

function Format-MatchLocations {
  param($Matches, [int]$Limit = 10)
  return (($Matches | Select-Object -First $Limit | ForEach-Object {
    "{0}:{1}" -f $_.Path, $_.LineNumber
  }) -join "; ")
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Script
  )
  Write-Host "`n==> $Name" -ForegroundColor Cyan
  try {
    & $Script
    if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
      throw "$Name exited with code $LASTEXITCODE"
    }
    Pass-Check $Name
  } catch {
    Fail-Check $Name ([string]$_)
  }
}

function Test-RequiredFile {
  param([string]$Path)
  if (Test-Path $Path) {
    Pass-Check "required file: $Path"
  } else {
    Fail-Check "required file: $Path" "missing"
  }
}

Write-Host "Lan Helper release preflight" -ForegroundColor Green
Write-Host "Repo: $repoRoot"
Write-Host "FullBuild: $FullBuild  RunCargoTests: $RunCargoTests  SkipTauriBuild: $SkipTauriBuild"

# Core files that must exist for the current release workflow.
@(
  "package.json",
  "src-tauri\Cargo.toml",
  "docs\RELEASE_VALIDATION_PLAN.md",
  "docs\RELEASE_VALIDATION_LOG.md",
  "docs\PRODUCT_MEMORY.md",
  "docs\DEVELOPMENT_PROGRESS.md",
  "adapter-registry\index.json",
  "tools\update_adapter_registry_index.ps1"
) | ForEach-Object { Test-RequiredFile $_ }

# Encoding / copy-feedback / over-claim guardrails.
$questionMatches = Select-String -Path "src\**\*.*","docs\*.md","act.md" -Pattern "????" -SimpleMatch -ErrorAction SilentlyContinue
if ($questionMatches) {
  Fail-Check "no source-level question-mark mojibake" (Format-MatchLocations $questionMatches)
} else {
  Pass-Check "no source-level question-mark mojibake"
}

$optionalClipboard = Select-String -Path "src\**\*.tsx" -Pattern "navigator.clipboard?." -SimpleMatch -ErrorAction SilentlyContinue
if ($optionalClipboard) {
  Fail-Check "no silent optional clipboard writes" (Format-MatchLocations $optionalClipboard)
} else {
  Pass-Check "no silent optional clipboard writes"
}

$publishText = Select-String -Path "src\**\*.tsx" -Pattern "可发布" -SimpleMatch -ErrorAction SilentlyContinue
if ($publishText) {
  Fail-Check "no UI over-claim: publish-ready text" (Format-MatchLocations $publishText)
} else {
  Pass-Check "no UI over-claim: publish-ready text"
}

# Adapter registry consistency.
try {
  $index = Get-Content "adapter-registry\index.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $gameFiles = Get-ChildItem "adapter-registry\games" -Filter "*.json" -File
  $indexCount = @($index.games).Count
  if ($indexCount -eq $gameFiles.Count) {
    Pass-Check "adapter registry count" "games=$indexCount"
  } else {
    Fail-Check "adapter registry count" "index=$indexCount files=$($gameFiles.Count)"
  }
  foreach ($entry in $index.games) {
    if (-not $entry.game_id -or -not $entry.adapter_url -or -not $entry.sha256) {
      Fail-Check "adapter registry entry fields" "missing field in $($entry | ConvertTo-Json -Compress)"
      break
    }
  }
  if (-not ($results | Where-Object { $_.Name -eq "adapter registry entry fields" -and $_.Status -eq "FAIL" })) {
    Pass-Check "adapter registry entry fields"
  }
} catch {
  Fail-Check "adapter registry parse" ([string]$_)
}

# Release exe existence. FullBuild can regenerate it.
$releaseExe = "src-tauri\target\release\lan-helper.exe"
if (Test-Path $releaseExe) {
  Pass-Check "release exe exists" $releaseExe
} else {
  Fail-Check "release exe exists" "missing: $releaseExe"
}

if ($FullBuild) {
  Invoke-Step "npm run build" { npm run build }
  Invoke-Step "cargo check" { cargo check --manifest-path "src-tauri\Cargo.toml" }
  if ($RunCargoTests) {
    Invoke-Step "cargo test port_proxy" { cargo test --manifest-path "src-tauri\Cargo.toml" port_proxy }
    Invoke-Step "cargo test udp_proxy" { cargo test --manifest-path "src-tauri\Cargo.toml" udp_proxy }
    Invoke-Step "cargo test udp_broadcast" { cargo test --manifest-path "src-tauri\Cargo.toml" udp_broadcast }
  }
  if (-not $SkipTauriBuild) {
    Invoke-Step "npm run tauri:build" { npm run tauri:build }
  }
}

Write-Host "`nPreflight summary" -ForegroundColor Green
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status -ne "PASS" })
if ($failed.Count -gt 0) {
  Write-Host "`nFAILED: $($failed.Count) check(s)" -ForegroundColor Red
  exit 1
}

Write-Host "`nPASS: release preflight checks completed." -ForegroundColor Green
