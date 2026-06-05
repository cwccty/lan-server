param(
  [switch]$SkipTauriBuild,
  [switch]$SkipSmoke,
  [switch]$AppendLog
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$logPath = Join-Path $repoRoot "docs\RELEASE_VALIDATION_LOG.md"
$results = New-Object System.Collections.Generic.List[object]

function Invoke-GateStep {
  param(
    [string]$Name,
    [scriptblock]$Script
  )

  Write-Host "`n==> $Name" -ForegroundColor Cyan
  $startedAt = Get-Date
  try {
    & $Script
    if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
      throw "$Name exited with code $LASTEXITCODE"
    }
    $elapsed = [int]((Get-Date) - $startedAt).TotalSeconds
    $results.Add([pscustomobject]@{
      name = $Name
      status = "PASS"
      seconds = $elapsed
      detail = ""
    }) | Out-Null
  } catch {
    $elapsed = [int]((Get-Date) - $startedAt).TotalSeconds
    $results.Add([pscustomobject]@{
      name = $Name
      status = "FAIL"
      seconds = $elapsed
      detail = [string]$_
    }) | Out-Null
    throw
  }
}

Write-Host "Lan Helper v0.1 release gate" -ForegroundColor Green
Write-Host "Repo: $repoRoot"
Write-Host "SkipTauriBuild: $SkipTauriBuild  SkipSmoke: $SkipSmoke  AppendLog: $AppendLog"

try {
  Invoke-GateStep "npm run build" { npm run build }
  Invoke-GateStep "cargo check" { cargo check --manifest-path "src-tauri\Cargo.toml" }
  Invoke-GateStep "npm run adapter:validate" { npm run adapter:validate }

  if (-not $SkipTauriBuild) {
    Invoke-GateStep "npm run tauri:build" { npm run tauri:build }
  } else {
    $results.Add([pscustomobject]@{
      name = "npm run tauri:build"
      status = "SKIP"
      seconds = 0
      detail = "SkipTauriBuild"
    }) | Out-Null
  }

  if (-not $SkipSmoke) {
    Invoke-GateStep "real exe smoke test" {
      powershell -ExecutionPolicy Bypass -File "tools\real_exe_smoke_test.ps1" -StartupSeconds 5 -AppendLog
    }
  } else {
    $results.Add([pscustomobject]@{
      name = "real exe smoke test"
      status = "SKIP"
      seconds = 0
      detail = "SkipSmoke"
    }) | Out-Null
  }

  Invoke-GateStep "npm run release:package" { npm run release:package -- -Clean -AppendLog }
  Invoke-GateStep "npm run release:package:verify" { npm run release:package:verify -- -AppendLog }
  Invoke-GateStep "npm run release:preflight" { npm run release:preflight }
} catch {
  Write-Host "`nRelease gate failed." -ForegroundColor Red
}

$failed = @($results | Where-Object { $_.status -eq "FAIL" })
$passed = @($results | Where-Object { $_.status -eq "PASS" })
$skipped = @($results | Where-Object { $_.status -eq "SKIP" })
$status = if ($failed.Count -eq 0) { "PASS" } else { "FAIL" }

Write-Host "`nRelease gate summary" -ForegroundColor Green
$results | Format-Table name,status,seconds,detail -AutoSize

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') v0.1 automated release gate")
$lines.Add("")
$lines.Add("~~~text")
$lines.Add("status: $status")
$lines.Add("passed: $($passed.Count)")
$lines.Add("failed: $($failed.Count)")
$lines.Add("skipped: $($skipped.Count)")
$lines.Add("skip_tauri_build: $SkipTauriBuild")
$lines.Add("skip_smoke: $SkipSmoke")
$lines.Add("~~~")
$lines.Add("")
$lines.Add("### Step results")
$lines.Add("")
foreach ($item in $results) {
  $detail = if ([string]::IsNullOrWhiteSpace($item.detail)) { "" } else { " - $($item.detail)" }
  $lines.Add("- $($item.status) `$($item.name)` ($($item.seconds)s)$detail")
}
$lines.Add("")
$lines.Add("### Manual validation still required")
$lines.Add("")
$lines.Add("- real dual-machine n2n connectivity")
$lines.Add("- real joiner connects to host virtual IP and game port")
$lines.Add("- Terraria dual-machine Join via IP")
$lines.Add("- more adapter reviews by real users")
$lines.Add("")
$lines.Add("Note: this gate verifies automated release readiness only. It does not replace PASS / FAIL / PENDING manual validation in the real EXE diagnostics page.")

if ($AppendLog) {
  Add-Content -Path $logPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8
  Write-Host "Appended release gate summary to $logPath"
}

if ($status -ne "PASS") {
  exit 1
}

Write-Host "PASS: v0.1 automated release gate completed." -ForegroundColor Green
