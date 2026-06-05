param(
  [switch]$SkipFrontendBuild,
  [switch]$SkipSensitiveScan
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Join-Flags {
  param([string[]]$Flags)
  return ($Flags | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join " "
}

function Test-BinaryContainsText {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Pattern
  )

  if ([string]::IsNullOrWhiteSpace($Pattern) -or -not (Test-Path -LiteralPath $Path)) {
    return $false
  }

  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path))
  $encodings = @(
    [System.Text.Encoding]::UTF8,
    [System.Text.Encoding]::Unicode,
    [System.Text.Encoding]::ASCII
  )
  foreach ($encoding in $encodings) {
    $needle = $encoding.GetBytes($Pattern)
    if ($needle.Length -eq 0 -or $needle.Length -gt $bytes.Length) {
      continue
    }
    for ($i = 0; $i -le $bytes.Length - $needle.Length; $i++) {
      $matched = $true
      for ($j = 0; $j -lt $needle.Length; $j++) {
        if ($bytes[$i + $j] -ne $needle[$j]) {
          $matched = $false
          break
        }
      }
      if ($matched) {
        return $true
      }
    }
  }
  return $false
}

Write-Host "Lan Helper clean Tauri release build" -ForegroundColor Green
Write-Host "Repo: $repoRoot"

$existingRustFlags = $env:RUSTFLAGS
$userProfile = $env:USERPROFILE
$cargoHome = if ([string]::IsNullOrWhiteSpace($env:CARGO_HOME)) {
  if ([string]::IsNullOrWhiteSpace($userProfile)) { "" } else { Join-Path $userProfile ".cargo" }
} else {
  $env:CARGO_HOME
}
$rustupHome = if ([string]::IsNullOrWhiteSpace($env:RUSTUP_HOME)) {
  if ([string]::IsNullOrWhiteSpace($userProfile)) { "" } else { Join-Path $userProfile ".rustup" }
} else {
  $env:RUSTUP_HOME
}

$remapFlags = @(
  "--remap-path-prefix=$repoRoot=lan-helper-src"
)
if (-not [string]::IsNullOrWhiteSpace($userProfile)) {
  $remapFlags += "--remap-path-prefix=$userProfile=user-home"
}
if (-not [string]::IsNullOrWhiteSpace($cargoHome)) {
  $remapFlags += "--remap-path-prefix=$cargoHome=cargo-home"
}
if (-not [string]::IsNullOrWhiteSpace($rustupHome)) {
  $remapFlags += "--remap-path-prefix=$rustupHome=rustup-home"
}

$env:RUSTFLAGS = Join-Flags @($existingRustFlags, ($remapFlags -join " "))
Write-Host "RUSTFLAGS: $env:RUSTFLAGS"

if (-not $SkipFrontendBuild) {
  Write-Host "`n==> npm run build" -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed with exit code $LASTEXITCODE"
  }
}

Write-Host "`n==> npm run tauri:build:raw" -ForegroundColor Cyan
npm run tauri:build:raw
if ($LASTEXITCODE -ne 0) {
  throw "npm run tauri:build:raw failed with exit code $LASTEXITCODE"
}

$releaseExe = Join-Path $repoRoot "src-tauri\target\release\lan-helper.exe"
if (-not (Test-Path -LiteralPath $releaseExe)) {
  throw "Missing release EXE after build: $releaseExe"
}

if (-not $SkipSensitiveScan) {
  Write-Host "`n==> release EXE sensitive path scan" -ForegroundColor Cyan
  $forbiddenPatterns = @(
    [string]$repoRoot,
    [string]$userProfile
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

  $hits = @()
  foreach ($pattern in $forbiddenPatterns) {
    if (Test-BinaryContainsText -Path $releaseExe -Pattern $pattern) {
      $hits += $pattern
    }
  }

  if ($hits.Count -gt 0) {
    throw "Release EXE still contains sensitive local path(s): $($hits -join ', ')"
  }
  Write-Host "PASS: no configured sensitive local paths found in release EXE." -ForegroundColor Green
}

Write-Host "`nPASS: clean Tauri release build completed." -ForegroundColor Green
