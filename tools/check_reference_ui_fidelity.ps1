param(
  [string]$ReferenceSrc = $env:LAN_HELPER_REFERENCE_UI_SRC,
  [string]$CurrentSrc = "src\reference-ui",
  [switch]$AllowSkip
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ReferenceSrc)) {
  $repoLocalReference = Join-Path $repoRoot "reference-ui-source\src"
  if (Test-Path -LiteralPath $repoLocalReference) {
    $ReferenceSrc = $repoLocalReference
  }
}

if ([string]::IsNullOrWhiteSpace($ReferenceSrc) -or -not (Test-Path -LiteralPath $ReferenceSrc)) {
  Write-Host "Reference UI fidelity check: SKIP" -ForegroundColor Yellow
  Write-Host "reason=reference source not configured"
  Write-Host "set LAN_HELPER_REFERENCE_UI_SRC to run strict source comparison"
  exit 0
}

$files = @(
  'App.tsx',
  'components\Header.tsx',
  'components\HomeView.tsx',
  'components\GameScanView.tsx',
  'components\SolutionsView.tsx',
  'components\UniversalNetworkView.tsx',
  'components\AdvancedToolsView.tsx',
  'components\TerrariaGuideView.tsx',
  'components\DiagnosticsView.tsx',
  'components\Sidebar.tsx',
  'components\RecommendProtocolView.tsx',
  'components\SettingsView.tsx',
  'index.css',
  'data.ts',
  'types.ts'
)

# Product Mode is migrating from DOM patchers to controlled React pages.
# App.tsx mounts controlled pages, so it is excluded from strict source diff.
$controlledMigrationFiles = @(
  'App.tsx'
)

if (-not (Test-Path -LiteralPath $CurrentSrc)) {
  Write-Error "Current reference-ui directory does not exist: $CurrentSrc"
}

$diffs = @()
foreach ($file in $files) {
  if ($controlledMigrationFiles -contains $file) {
    continue
  }

  $referenceFile = Join-Path $ReferenceSrc $file
  $currentFile = Join-Path $CurrentSrc $file

  if (-not (Test-Path -LiteralPath $referenceFile)) {
    $diffs += "reference file missing: $file"
    continue
  }
  if (-not (Test-Path -LiteralPath $currentFile)) {
    $diffs += "current file missing: $file"
    continue
  }

  git diff --no-index --ignore-space-at-eol --ignore-blank-lines --quiet -- $referenceFile $currentFile | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $diffs += "visual source differs: $file"
  }
}

if ($diffs.Count -gt 0) {
  Write-Host "Reference UI fidelity check: FAIL" -ForegroundColor Red
  $diffs | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
  Write-Host "visual_diff_count=$($diffs.Count)"
  exit 1
}

Write-Host "Reference UI fidelity check: PASS" -ForegroundColor Green
Write-Host "visual_diff_count=0"
exit 0
