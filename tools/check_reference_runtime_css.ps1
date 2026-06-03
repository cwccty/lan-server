param(
  [string]$DistAssets = "dist\assets"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if (-not (Test-Path $DistAssets)) {
  Write-Error "Missing dist assets directory: $DistAssets. Run npm run build first."
  exit 1
}

$cssFiles = Get-ChildItem $DistAssets -Filter "*.css" -File | Sort-Object LastWriteTime -Descending
if (-not $cssFiles -or $cssFiles.Count -eq 0) {
  Write-Error "No built CSS file found under $DistAssets. Run npm run build first."
  exit 1
}

$combinedCss = ($cssFiles | ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 }) -join "`n"
$requiredUtilities = @(
  ".flex",
  ".fixed",
  ".grid",
  ".min-h-screen",
  ".bg-slate-50",
  ".text-slate-800",
  ".rounded-2xl",
  ".shadow-sm"
)

$missing = @()
foreach ($utility in $requiredUtilities) {
  if (-not $combinedCss.Contains($utility)) {
    $missing += $utility
  }
}

if ($missing.Count -gt 0) {
  Write-Error ("Reference runtime CSS sentinel: FAIL. Missing Tailwind utilities: " + ($missing -join ", "))
  exit 1
}

Write-Host "Reference runtime CSS sentinel: PASS"
Write-Host ("css_files=" + (($cssFiles | Select-Object -ExpandProperty Name) -join ","))
Write-Host ("required_utilities=" + ($requiredUtilities -join ","))
