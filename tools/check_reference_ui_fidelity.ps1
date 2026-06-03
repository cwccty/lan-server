param(
  [string]$ReferenceSrc = "C:\Users\ty\Downloads\联机助手 (1)\src",
  [string]$CurrentSrc = "src\reference-ui"
)

$ErrorActionPreference = 'Stop'

$files = @(
  'App.tsx',
  'components\Header.tsx',
  'components\HomeView.tsx',
  'components\GameScanView.tsx',
  'components\SolutionsView.tsx',
  'components\UniversalNetworkView.tsx',
  'components\TerrariaGuideView.tsx',
  'components\DiagnosticsView.tsx',
  'components\Sidebar.tsx',
  'components\RecommendProtocolView.tsx',
  'components\SettingsView.tsx',
  'index.css',
  'data.ts',
  'types.ts'
)

if (-not (Test-Path -LiteralPath $ReferenceSrc)) {
  Write-Error "参考前端目录不存在：$ReferenceSrc"
}
if (-not (Test-Path -LiteralPath $CurrentSrc)) {
  Write-Error "当前 reference-ui 目录不存在：$CurrentSrc"
}

$diffs = @()
foreach ($file in $files) {
  $referenceFile = Join-Path $ReferenceSrc $file
  $currentFile = Join-Path $CurrentSrc $file

  if (-not (Test-Path -LiteralPath $referenceFile)) {
    $diffs += "参考文件缺失：$file"
    continue
  }
  if (-not (Test-Path -LiteralPath $currentFile)) {
    $diffs += "当前文件缺失：$file"
    continue
  }

  git diff --no-index --ignore-space-at-eol --ignore-blank-lines --quiet -- $referenceFile $currentFile | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $diffs += "视觉源码差异：$file"
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
