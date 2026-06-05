param(
  [string]$Version = "0.1.0",
  [string]$OutputRoot = "release-artifacts",
  [switch]$Clean,
  [switch]$Rebuild,
  [switch]$AppendLog
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$tag = "v$Version"
$outDir = Join-Path $repoRoot (Join-Path $OutputRoot $tag)
$exePath = Join-Path $repoRoot "src-tauri\target\release\lan-helper.exe"
$releaseLogPath = Join-Path $repoRoot "docs\RELEASE_VALIDATION_LOG.md"

function Get-RelativePathFrom {
  param(
    [string]$BasePath,
    [string]$TargetPath
  )

  $base = (Resolve-Path $BasePath).Path.TrimEnd("\") + "\"
  $target = (Resolve-Path $TargetPath).Path
  if ($target.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $target.Substring($base.Length)
  }
  return $target
}

Write-Host "Lan Helper release package"
Write-Host "Repo: $repoRoot"
Write-Host "Version: $Version"
Write-Host "Output: $outDir"

if ($Rebuild) {
  Write-Host "`n==> npm run tauri:build"
  npm run tauri:build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run tauri:build failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path $exePath)) {
  throw "Missing release EXE: $exePath. Run npm run tauri:build first."
}

if ($Clean -and (Test-Path $outDir)) {
  Remove-Item -LiteralPath $outDir -Recurse -Force
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$filesToCopy = @(
  @{
    Source = "src-tauri\target\release\lan-helper.exe"
    Target = "lan-helper-$tag.exe"
  },
  @{
    Source = "docs\GITHUB_RELEASE_DRAFT.md"
    Target = "RELEASE_BODY.md"
  },
  @{
    Source = "docs\RELEASE_NOTES_DRAFT.md"
    Target = "RELEASE_NOTES.md"
  },
  @{
    Source = "docs\V0_1_RELEASE_READINESS.md"
    Target = "V0_1_RELEASE_READINESS.md"
  },
  @{
    Source = "docs\REAL_EXE_MANUAL_VALIDATION_GUIDE.md"
    Target = "REAL_EXE_MANUAL_VALIDATION_GUIDE.md"
  },
  @{
    Source = "docs\V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md"
    Target = "V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md"
  },
  @{
    Source = "docs\V0_1_USER_FEEDBACK_TEMPLATE.md"
    Target = "V0_1_USER_FEEDBACK_TEMPLATE.md"
  },
  @{
    Source = "docs\RELEASE_VALIDATION_LOG.md"
    Target = "RELEASE_VALIDATION_LOG.md"
  },
  @{
    Source = "adapter-registry\index.json"
    Target = "adapter-registry\index.json"
  }
)

foreach ($item in $filesToCopy) {
  $source = Join-Path $repoRoot $item.Source
  if (-not (Test-Path $source)) {
    throw "Missing release package source: $($item.Source)"
  }
  $target = Join-Path $outDir $item.Target
  New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
}

$adapterGames = Join-Path $repoRoot "adapter-registry\games"
if (Test-Path $adapterGames) {
  $adapterGamesTarget = Join-Path $outDir "adapter-registry\games"
  New-Item -ItemType Directory -Path $adapterGamesTarget -Force | Out-Null
  Get-ChildItem -Path $adapterGames -File | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $adapterGamesTarget $_.Name) -Force
  }
}

$uploadReadme = @(
  "# Lan Helper $tag release package",
  "",
  "This directory is a local staging package for GitHub Release upload.",
  "",
  "## Suggested upload files",
  "",
  "- ``lan-helper-$tag.exe``",
  "- ``SHA256SUMS.txt``",
  "- Optional: ``RELEASE_NOTES.md``",
  "",
  "## Release body",
  "",
  "Copy ``RELEASE_BODY.md`` first, and keep its PENDING boundary notes.",
  "",
  "## Important boundaries",
  "",
  "- This package is not proof that all games support one-click online play.",
  "- Real dual-machine n2n, real friend join, real in-game join, and more adapter reviews still need manual validation.",
  "- Local couch co-op games should use Steam Remote Play / Sunshine + Moonlight routes, not be advertised as real LAN conversion.",
  "",
  "## Suggested pre-upload commands",
  "",
  "~~~powershell",
  "npm run build",
  "cargo check --manifest-path src-tauri\Cargo.toml",
  "npm run tauri:build",
  "powershell -ExecutionPolicy Bypass -File tools\real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog",
  "npm run release:preflight",
  "npm run release:package",
  "~~~"
) -join [Environment]::NewLine
Set-Content -Path (Join-Path $outDir "README_UPLOAD.md") -Value $uploadReadme -Encoding UTF8

$payloadFiles = Get-ChildItem -Path $outDir -File -Recurse |
  Where-Object { $_.Name -notin @("SHA256SUMS.txt", "release-manifest.json") } |
  Sort-Object FullName

$hashLines = New-Object System.Collections.Generic.List[string]
$manifestFiles = New-Object System.Collections.Generic.List[object]

foreach ($file in $payloadFiles) {
  $relative = Resolve-Path -Path $file.FullName -Relative
  $relative = $relative -replace '^\.\\', ''
  $relativeToOut = Get-RelativePathFrom -BasePath $outDir -TargetPath $file.FullName
  $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
  $hashLines.Add(("{0}  {1}" -f $hash.Hash.ToLowerInvariant(), $relativeToOut.Replace("\", "/"))) | Out-Null
  $manifestFiles.Add([pscustomobject]@{
    path = $relativeToOut.Replace("\", "/")
    size = $file.Length
    sha256 = $hash.Hash.ToLowerInvariant()
  }) | Out-Null
}

Set-Content -Path (Join-Path $outDir "SHA256SUMS.txt") -Value $hashLines -Encoding UTF8

$manifest = [pscustomobject]@{
  app = "lan-helper"
  tag = $tag
  version = $Version
  generated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz")
  release_exe = "lan-helper-$tag.exe"
  upload_body = "RELEASE_BODY.md"
  sha256sums = "SHA256SUMS.txt"
  pending_boundaries = @(
    "real dual-machine n2n connectivity",
    "real joiner connects to host virtual IP and game port",
    "Terraria dual-machine Join via IP",
    "more adapter reviews by real users"
  )
  files = $manifestFiles
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $outDir "release-manifest.json") -Encoding UTF8

$summary = @"
## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $tag local release package

~~~text
status: PASS
output: $outDir
exe: lan-helper-$tag.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: $($payloadFiles.Count)
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
"@

if ($AppendLog) {
  Add-Content -Path $releaseLogPath -Value $summary -Encoding UTF8
  Write-Host "Appended package summary to $releaseLogPath"
}

Write-Host "`nRelease package ready:"
Write-Host $outDir
Write-Host "`nFiles:"
Get-ChildItem -Path $outDir -File -Recurse |
  Sort-Object FullName |
  ForEach-Object {
    $relativeToOut = Get-RelativePathFrom -BasePath $outDir -TargetPath $_.FullName
    Write-Host ("- {0} ({1} bytes)" -f $relativeToOut, $_.Length)
  }
