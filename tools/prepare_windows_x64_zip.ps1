param(
  [string]$Version = "0.1.0",
  [string]$OutputRoot = "release-artifacts",
  [switch]$Clean,
  [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$packageName = "LanHelper-v$Version-windows-x64"
$outRoot = Join-Path $repoRoot $OutputRoot
$outDir = Join-Path $outRoot $packageName
$zipPath = Join-Path $outRoot "$packageName.zip"
$exeSource = Join-Path $repoRoot "src-tauri\target\release\lan-helper.exe"
$edgeSource = Join-Path $repoRoot "tools\n2n\edge.exe"
$readmeName = "README_" + (-join ([char[]](0x4f7f, 0x7528, 0x8bf4, 0x660e))) + ".txt"

function Get-RelativePathFrom {
  param(
    [string]$BasePath,
    [string]$TargetPath
  )
  $base = (Resolve-Path $BasePath).Path.TrimEnd("\") + "\"
  $target = (Resolve-Path $TargetPath).Path
  if ($target.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $target.Substring($base.Length).Replace("\", "/")
  }
  return $target.Replace("\", "/")
}

function Copy-DirectorySafe {
  param(
    [string]$Source,
    [string]$Destination
  )
  if (-not (Test-Path -LiteralPath $Source)) {
    throw "Missing directory: $Source"
  }
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  Get-ChildItem -Path $Source -File -Recurse | ForEach-Object {
    $relative = Get-RelativePathFrom -BasePath $Source -TargetPath $_.FullName
    if ($relative -match '(^|/)(edge\.log|edge\.stdout\.log|edge\.stderr\.log|last_config\.json|n2n\.pid)$') {
      return
    }
    $target = Join-Path $Destination ($relative.Replace("/", "\"))
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
  }
}

Write-Host "Lan Helper Windows x64 ZIP package" -ForegroundColor Green
Write-Host "Repo: $repoRoot"
Write-Host "Version: $Version"
Write-Host "Output: $zipPath"

if ($Rebuild) {
  Write-Host "`n==> npm run tauri:build" -ForegroundColor Cyan
  npm run tauri:build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run tauri:build failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path -LiteralPath $exeSource)) {
  throw "Missing release EXE: $exeSource. Run npm run tauri:build first."
}
if (-not (Test-Path -LiteralPath $edgeSource)) {
  throw "Missing n2n edge.exe: $edgeSource. Put a verified edge.exe there before packaging v0.1.0."
}

if ($Clean) {
  if (Test-Path -LiteralPath $outDir) {
    Remove-Item -LiteralPath $outDir -Recurse -Force
  }
  if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

Copy-Item -LiteralPath $exeSource -Destination (Join-Path $outDir "$packageName.exe") -Force

$n2nOut = Join-Path $outDir "tools\n2n"
New-Item -ItemType Directory -Path $n2nOut -Force | Out-Null
Copy-Item -LiteralPath $edgeSource -Destination (Join-Path $n2nOut "edge.exe") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "tools\n2n\README.md") -Destination (Join-Path $n2nOut "README.md") -Force

Copy-DirectorySafe -Source (Join-Path $repoRoot "adapter-registry") -Destination (Join-Path $outDir "adapter-registry")
Copy-DirectorySafe -Source (Join-Path $repoRoot "adapters") -Destination (Join-Path $outDir "adapters")

$readme = @(
  "Lan Helper v$Version Windows x64",
  "",
  "Usage:",
  "1. Extract the whole folder. Do not run the exe from inside the zip.",
  "2. Run $packageName.exe.",
  "3. Open Settings first and confirm edge.exe is detected.",
  "4. Open Network Center and fill supernode, room name, room key, and local virtual IP.",
  "5. Host creates an invite packet from Recommendation. Joiner pastes the packet to join.",
  "",
  "Boundaries:",
  "- v$Version is an early public test build, not an all-games-one-click promise.",
  "- Native LAN / direct IP / dedicated-server games should use the n2n virtual LAN route.",
  "- Local couch co-op games should use Steam Remote Play or Sunshine/Moonlight routes.",
  "- Official-server-only or Steam lobby/P2P games are not forced into LAN mode.",
  "",
  "Package notes:",
  "- SHA256SUMS.txt can be used to verify file integrity.",
  "- Runtime files such as tools/n2n/last_config.json, edge.log, and n2n.pid are intentionally excluded.",
  "- If security software blocks edge.exe, verify the n2n source and file hash before allowing it."
) -join [Environment]::NewLine
Set-Content -Path (Join-Path $outDir $readmeName) -Value $readme -Encoding UTF8

$payloadFiles = Get-ChildItem -Path $outDir -File -Recurse |
  Where-Object { $_.Name -notin @("SHA256SUMS.txt", "release-manifest.json") } |
  Sort-Object FullName

$hashLines = New-Object System.Collections.Generic.List[string]
$manifestFiles = New-Object System.Collections.Generic.List[object]
foreach ($file in $payloadFiles) {
  $relative = Get-RelativePathFrom -BasePath $outDir -TargetPath $file.FullName
  $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
  $hashLines.Add(("{0}  {1}" -f $hash.Hash.ToLowerInvariant(), $relative)) | Out-Null
  $manifestFiles.Add([pscustomobject]@{
    path = $relative
    size = $file.Length
    sha256 = $hash.Hash.ToLowerInvariant()
  }) | Out-Null
}
Set-Content -Path (Join-Path $outDir "SHA256SUMS.txt") -Value $hashLines -Encoding UTF8

$manifest = [pscustomobject]@{
  app = "lan-helper"
  version = $Version
  package = $packageName
  generated_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz")
  runtime_files_excluded = @("tools/n2n/edge.log", "tools/n2n/edge.stdout.log", "tools/n2n/edge.stderr.log", "tools/n2n/last_config.json", "tools/n2n/n2n.pid")
  files = $manifestFiles
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $outDir "release-manifest.json") -Encoding UTF8

$forbiddenRuntimeFiles = Get-ChildItem -Path $outDir -File -Recurse |
  Where-Object { $_.Name -in @("edge.log", "edge.stdout.log", "edge.stderr.log", "last_config.json", "n2n.pid") }
if ($forbiddenRuntimeFiles.Count -gt 0) {
  throw "Runtime files leaked into package: $($forbiddenRuntimeFiles.FullName -join ', ')"
}

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -Path $outDir -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "`nPASS: Windows x64 ZIP package ready." -ForegroundColor Green
Write-Host $zipPath
