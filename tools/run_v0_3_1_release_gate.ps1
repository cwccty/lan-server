param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$steps = @()
function Add-StepResult([string]$Name, [string]$Status, [string]$Detail = '') {
  $script:steps += [pscustomobject]@{ Name = $Name; Status = $Status; Detail = $Detail }
}
function Invoke-GateStep([string]$Name, [scriptblock]$Script) {
  Write-Host "`n==> $Name" -ForegroundColor Cyan
  try {
    & $Script
    if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) { throw "$Name exited with code $LASTEXITCODE" }
    Add-StepResult $Name 'PASS'
  } catch {
    Add-StepResult $Name 'FAIL' ([string]$_)
  }
}

Write-Host 'Lan Helper v0.3.1 release candidate gate' -ForegroundColor Green
Write-Host "Repo: $repoRoot"

if (-not $SkipBuild) {
  Invoke-GateStep 'npm build' { npm.cmd run build }
  Invoke-GateStep 'cargo check' { cargo check --manifest-path 'src-tauri\Cargo.toml' }
  Invoke-GateStep 'n2n diagnostics fixtures' { cargo test --manifest-path 'src-tauri\Cargo.toml' n2n_diagnostics_fixture -- --nocapture }
}
Invoke-GateStep 'adapter registry validation' { powershell -ExecutionPolicy Bypass -File 'tools\validate_adapter_registry.ps1' }
Invoke-GateStep 'dual machine regression evidence gate' { npm.cmd run regression:dual-machine:verify }
Invoke-GateStep 'network stuck diagnostic UI gate' { npm.cmd run network:diagnostic:verify }
if (-not $SkipBuild) {
  Invoke-GateStep 'windows release package rebuild' { powershell -ExecutionPolicy Bypass -File 'tools\prepare_windows_x64_zip.ps1' -Version '0.3.1' -Rebuild }
}
Invoke-GateStep 'windows zip verification' { npm.cmd run release:zip:verify }
Invoke-GateStep 'windows zip launch smoke' { powershell -ExecutionPolicy Bypass -File 'tools\verify_windows_zip_launch_smoke.ps1' -Version '0.3.1' }

$zip = 'release-artifacts\LanHelper-v0.3.1-windows-x64.zip'
$exe = 'src-tauri\target\release\lan-helper.exe'
if (Test-Path $zip) {
  $zipHash = (Get-FileHash $zip -Algorithm SHA256).Hash
  Add-StepResult 'zip sha256' 'PASS' $zipHash
} else {
  Add-StepResult 'zip sha256' 'FAIL' "missing: $zip"
}
if (Test-Path $exe) {
  $exeHash = (Get-FileHash $exe -Algorithm SHA256).Hash
  Add-StepResult 'exe sha256' 'PASS' $exeHash
} else {
  Add-StepResult 'exe sha256' 'FAIL' "missing: $exe"
}

$externalMatches = @()
if (Test-Path $zip) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $zip))
  try {
    foreach ($entry in $archive.Entries) {
      if ($entry.FullName -match '(connecttool-qt\.exe|steam_api64\.dll|steamwebrtc64\.dll|wintun\.dll|steam_appid\.txt)$') {
        $externalMatches += $entry.FullName
      }
    }
  } finally {
    $archive.Dispose()
  }
}
if ($externalMatches.Count -eq 0) {
  Add-StepResult 'zip excludes external helper files' 'PASS' 'external_helper_matches=0'
} else {
  Add-StepResult 'zip excludes external helper files' 'FAIL' ($externalMatches -join '; ')
}

$outPath = if ($SkipBuild) {
  'docs\acceptance-artifacts\v031-release-candidate-gate-skipbuild-2026-06-08.json'
} else {
  'docs\acceptance-artifacts\v031-release-candidate-gate-2026-06-08.json'
}
$summary = [pscustomobject]@{
  generated_at = (Get-Date).ToString('o')
  repo = [string]$repoRoot
  skip_build = [bool]$SkipBuild
  steps = $steps
  passed = -not @($steps | Where-Object { $_.Status -ne 'PASS' }).Count
}
$summary | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $outPath

Write-Host "`nGate summary" -ForegroundColor Green
$steps | Format-Table -AutoSize
if (-not $summary.passed) {
  Write-Host "`nFAILED: v0.3.1 candidate gate failed" -ForegroundColor Red
  exit 1
}
Write-Host "`nPASS: v0.3.1 candidate gate completed." -ForegroundColor Green
