param(
  [switch]$Apply,
  [string]$Output = "docs/acceptance-artifacts/v031-staging-manifest-2026-06-08.json"
)

$ErrorActionPreference = 'Stop'

function Normalize-PathForGit([string]$Path) {
  return ($Path -replace '\\', '/')
}

function Is-Excluded([string]$Path) {
  $p = Normalize-PathForGit $Path
  if ($p -like 'release-artifacts/*') { return $true }
  if ($p -like '.lan-helper/*') { return $true }
  if ($p -like 'backups/*') { return $true }
  if ($p -like 'src-tauri/target-ui-preview/*') { return $true }
  if ($p -match '^docs/V0_2_0_') { return $true }
  if ($p -match '(^|/)chrome-.*profile(/|$)') { return $true }
  if ($p -match '(^|/)v031-zip-launch-smoke(/|$)') { return $true }
  if ($p -match '\.(png|jpg|jpeg|webp)$') { return $true }
  if ($p -match '\.(pid|log)$') { return $true }
  if ($p -in @('tools/codex_first_screen_cleanup.cjs')) { return $true }
  return $false
}

function Is-AllowedAcceptanceArtifact([string]$Path) {
  $name = Split-Path -Leaf (Normalize-PathForGit $Path)
  if ($name -match '^v031-') { return $true }
  if ($name -match '^windows-zip-launch-smoke-v031-') { return $true }
  if ($name -match '^network-diagnostic-') { return $true }
  if ($name -match '^diagnostics-n2n-copy-actions-network-log-dom-') { return $true }
  if ($name -match '^n2n-(network-diagnostic-actions|two-machine-)') { return $true }
  if ($name -match '^friend-(retest|stuck)-') { return $true }
  if ($name -match '^dual-machine-regression-(evidence|plan)') { return $true }
  if ($name -match '^gh-release-v0\.3\.1-') { return $true }
  if ($name -match '^git-status-v031-') { return $true }
  if ($name -match '^status-center-n2n-fixtures-') { return $true }
  if ($name -match '^adapter-registry-method-category-nonempty-v0\.3\.1-') { return $true }
  if ($name -match '^supervision-(n2n|v031|v0\.3\.1|dual-machine)-') { return $true }
  return $false
}

function Is-AllowedUntracked([string]$Path) {
  $p = Normalize-PathForGit $Path
  if (Is-Excluded $p) { return $false }

  if ($p -match '^src/product-ui/[^/]+\.(ts|tsx)$') { return $true }
  if ($p -match '^tools/(run_v0_3_1_release_gate|verify_dual_machine_regression_evidence|verify_network_diagnostic_ui|verify_status_center_fixtures|verify_windows_zip_launch_smoke|triage_friend_retest_evidence)\.c?js$') { return $true }
  if ($p -match '^tools/(run_v0_3_1_release_gate|verify_windows_zip_launch_smoke|stage_v0_3_1_candidate)\.ps1$') { return $true }
  if ($p -match '^docs/V0_3_1_RELEASE_(DRAFT|CHECKLIST)\.md$') { return $true }
  if ($p -match '^docs/acceptance-artifacts/[^/]+\.(json|md|txt)$' -and (Is-AllowedAcceptanceArtifact $p)) { return $true }

  return $false
}

function Add-UntrackedPath([string]$Path) {
  $p = Normalize-PathForGit $Path

  if ((Test-Path -LiteralPath $p -PathType Container)) {
    $files = Get-ChildItem -LiteralPath $p -Recurse -File -Force |
      ForEach-Object { Normalize-PathForGit $_.FullName.Substring((Get-Location).Path.Length + 1) }

    $includedAny = $false
    foreach ($file in $files) {
      if (Is-AllowedUntracked $file) {
        $script:untrackedIncluded.Add($file)
        $includedAny = $true
      } else {
        $script:excluded.Add([ordered]@{ path = $file; reason = 'untracked file excluded by v0.3.1 staging policy' })
      }
    }

    if (-not $includedAny) {
      $script:excluded.Add([ordered]@{ path = $p; reason = 'untracked directory excluded by v0.3.1 staging policy' })
    }
    return
  }

  if (Is-AllowedUntracked $p) {
    $script:untrackedIncluded.Add($p)
  } else {
    $script:excluded.Add([ordered]@{ path = $p; reason = 'untracked excluded by v0.3.1 staging policy' })
  }
}

$statusLines = git status --porcelain=v1
$tracked = New-Object System.Collections.Generic.List[string]
$untrackedIncluded = New-Object System.Collections.Generic.List[string]
$excluded = New-Object System.Collections.Generic.List[object]

foreach ($line in $statusLines) {
  if ($line.Length -lt 4) { continue }
  $state = $line.Substring(0,2)
  $path = Normalize-PathForGit $line.Substring(3)

  if ($state -eq '??') {
    Add-UntrackedPath $path
    continue
  }

  if (Is-Excluded $path) {
    $excluded.Add([ordered]@{ path = $path; reason = 'tracked path matched v0.3.1 exclude policy; review manually before staging' })
  } else {
    $tracked.Add($path)
  }
}

$include = @($tracked + $untrackedIncluded) | Sort-Object -Unique
$manifest = [ordered]@{
  generated_at = (Get-Date).ToString('o')
  mode = if ($Apply) { 'apply' } else { 'dry-run' }
  warning = 'Do not use git add . for v0.3.1. Review this manifest before applying.'
  include_count = $include.Count
  tracked_modified_included_count = $tracked.Count
  untracked_included_count = $untrackedIncluded.Count
  excluded_count = $excluded.Count
  include = $include
  excluded_sample_limit = 200
  excluded_sample = @($excluded | Select-Object -First 200)
  suggested_commands = @(
    'powershell -ExecutionPolicy Bypass -File tools/stage_v0_3_1_candidate.ps1 -Apply',
    'git diff --cached --check',
    'npm.cmd run release:gate:v031'
  )
}

$parent = Split-Path -Parent $Output
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $Output -Encoding UTF8

if ($Apply) {
  if ($include.Count -gt 0) {
    git add -- $include
    if ($LASTEXITCODE -ne 0) { throw "git add failed for v0.3.1 manifest include set" }
  }
  Write-Host "Staged $($include.Count) paths from manifest."
} else {
  Write-Host "Dry-run only. Candidate paths: $($include.Count); excluded: $($excluded.Count). Manifest: $Output"
}
