param(
  [string]$Version = "0.1.0",
  [string]$OutputRoot = "release-artifacts"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$packageName = "LanHelper-v$Version-windows-x64"
$zipPath = Join-Path $repoRoot (Join-Path $OutputRoot "$packageName.zip")
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("lan-helper-zip-verify-" + [System.Guid]::NewGuid().ToString("N"))
$readmeName = "README_" + (-join ([char[]](0x4f7f, 0x7528, 0x8bf4, 0x660e))) + ".txt"
$errors = New-Object System.Collections.Generic.List[string]

function Add-Error {
  param([string]$Message)
  $errors.Add($Message) | Out-Null
}

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

Write-Host "Lan Helper Windows x64 ZIP verifier" -ForegroundColor Green
Write-Host "ZIP: $zipPath"

if (-not (Test-Path -LiteralPath $zipPath)) {
  throw "ZIP not found: $zipPath. Run npm run release:zip first."
}

try {
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  Expand-Archive -LiteralPath $zipPath -DestinationPath $tempRoot -Force
  $packageDir = Join-Path $tempRoot $packageName
  if (-not (Test-Path -LiteralPath $packageDir)) {
    Add-Error "ZIP does not contain expected top-level folder: $packageName"
    $packageDir = $tempRoot
  }

  $required = @(
    "$packageName.exe",
    $readmeName,
    "SHA256SUMS.txt",
    "release-manifest.json",
    "tools/n2n/edge.exe",
    "tools/n2n/README.md",
    "adapter-registry/index.json",
    "adapter-registry/games/cuphead.json",
    "adapter-registry/games/minecraft_java.json",
    "adapter-registry/games/palworld.json",
    "adapter-registry/games/stardew_valley.json",
    "adapter-registry/games/terraria.json",
    "adapters/games/cuphead.json",
    "adapters/games/minecraft_java.json",
    "adapters/games/palworld.json",
    "adapters/games/stardew_valley.json",
    "adapters/games/terraria.json"
  )

  foreach ($relative in $required) {
    $path = Join-Path $packageDir ($relative.Replace("/", "\"))
    if (-not (Test-Path -LiteralPath $path)) {
      Add-Error "missing file: $relative"
    }
  }

  $runtimeLeaks = Get-ChildItem -Path $packageDir -File -Recurse |
    Where-Object { $_.Name -in @("edge.log", "edge.stdout.log", "edge.stderr.log", "last_config.json", "n2n.pid") }
  foreach ($leak in $runtimeLeaks) {
    Add-Error "runtime file leaked: $(Get-RelativePathFrom -BasePath $packageDir -TargetPath $leak.FullName)"
  }

  $shaPath = Join-Path $packageDir "SHA256SUMS.txt"
  $shaEntries = @{}
  if (Test-Path -LiteralPath $shaPath) {
    foreach ($line in Get-Content -Path $shaPath -Encoding UTF8) {
      if ([string]::IsNullOrWhiteSpace($line)) { continue }
      if ($line -notmatch "^([a-fA-F0-9]{64})\s+(.+)$") {
        Add-Error "invalid SHA256SUMS line: $line"
        continue
      }
      $shaEntries[$Matches[2].Trim().Replace("\", "/")] = $Matches[1].ToLowerInvariant()
    }
  }

  $payloadFiles = Get-ChildItem -Path $packageDir -File -Recurse |
    Where-Object { $_.Name -notin @("SHA256SUMS.txt", "release-manifest.json") } |
    Sort-Object FullName
  foreach ($file in $payloadFiles) {
    $relative = Get-RelativePathFrom -BasePath $packageDir -TargetPath $file.FullName
    $actual = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if (-not $shaEntries.ContainsKey($relative)) {
      Add-Error "missing SHA entry: $relative"
      continue
    }
    if ($shaEntries[$relative] -ne $actual) {
      Add-Error "SHA mismatch: $relative"
    }
  }

  $forbiddenText = @([string]$env:USERPROFILE, [string]$repoRoot) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  $textFiles = Get-ChildItem -Path $packageDir -File -Recurse |
    Where-Object { $_.Extension -in @(".md", ".txt", ".json", ".ps1") }
  foreach ($file in $textFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    foreach ($pattern in $forbiddenText) {
      if ($content -and $content.Contains($pattern)) {
        Add-Error "sensitive text '$pattern' found in $(Get-RelativePathFrom -BasePath $packageDir -TargetPath $file.FullName)"
      }
    }
  }

  $zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Host "zip_sha256=$zipHash"
  Write-Host "payload_files=$($payloadFiles.Count)"
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}

if ($errors.Count -gt 0) {
  foreach ($err in $errors) {
    Write-Host "ERROR: $err" -ForegroundColor Red
  }
  exit 1
}

Write-Host "PASS: Windows x64 ZIP verification completed." -ForegroundColor Green
