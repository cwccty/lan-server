param(
  [string]$Version = "0.1.0",
  [string]$OutputRoot = "release-artifacts",
  [switch]$AppendLog
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$tag = "v$Version"
$packageDir = Join-Path $repoRoot (Join-Path $OutputRoot $tag)
$logPath = Join-Path $repoRoot "docs\RELEASE_VALIDATION_LOG.md"

$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Add-Error {
  param([string]$Message)
  $errors.Add($Message) | Out-Null
}

function Add-Warning {
  param([string]$Message)
  $warnings.Add($Message) | Out-Null
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

function Test-RequiredFile {
  param([string]$RelativePath)
  $path = Join-Path $packageDir ($RelativePath.Replace("/", "\"))
  if (-not (Test-Path $path)) {
    Add-Error "missing package file: $RelativePath"
    return $null
  }
  return Get-Item $path
}

Write-Host "Lan Helper release package verifier"
Write-Host "Repo: $repoRoot"
Write-Host "Package: $packageDir"

if (-not (Test-Path $packageDir)) {
  throw "release package directory not found: $packageDir. Run npm run release:package first."
}

$requiredFiles = @(
  "lan-helper-$tag.exe",
  "SHA256SUMS.txt",
  "release-manifest.json",
  "README_UPLOAD.md",
  "RELEASE_BODY.md",
  "RELEASE_NOTES.md",
  "RELEASE_VALIDATION_LOG.md",
  "REAL_EXE_MANUAL_VALIDATION_GUIDE.md",
  "V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md",
  "V0_1_RELEASE_READINESS.md",
  "V0_1_USER_FEEDBACK_TEMPLATE.md",
  "adapter-registry/index.json",
  "adapter-registry/games/cuphead.json",
  "adapter-registry/games/minecraft_java.json",
  "adapter-registry/games/palworld.json",
  "adapter-registry/games/stardew_valley.json",
  "adapter-registry/games/terraria.json"
)

foreach ($relative in $requiredFiles) {
  $null = Test-RequiredFile $relative
}

$manifestPath = Join-Path $packageDir "release-manifest.json"
$shaPath = Join-Path $packageDir "SHA256SUMS.txt"

$manifest = $null
if (Test-Path $manifestPath) {
  try {
    $manifest = Get-Content -Path $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    Add-Error "release-manifest.json is invalid JSON: $($_.Exception.Message)"
  }
}

if ($manifest) {
  if ($manifest.app -ne "lan-helper") { Add-Error "manifest app mismatch: $($manifest.app)" }
  if ($manifest.tag -ne $tag) { Add-Error "manifest tag mismatch: $($manifest.tag)" }
  if ($manifest.version -ne $Version) { Add-Error "manifest version mismatch: $($manifest.version)" }
  if ($manifest.release_exe -ne "lan-helper-$tag.exe") { Add-Error "manifest release_exe mismatch: $($manifest.release_exe)" }
  if ($manifest.upload_body -ne "RELEASE_BODY.md") { Add-Error "manifest upload_body mismatch: $($manifest.upload_body)" }
  if ($manifest.sha256sums -ne "SHA256SUMS.txt") { Add-Error "manifest sha256sums mismatch: $($manifest.sha256sums)" }
  if (@($manifest.pending_boundaries).Count -lt 4) {
    Add-Error "manifest pending_boundaries must keep human-validation boundaries"
  }
}

$shaEntries = @{}
if (Test-Path $shaPath) {
  $shaLines = Get-Content -Path $shaPath -Encoding UTF8
  foreach ($line in $shaLines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line -notmatch "^([a-fA-F0-9]{64})\s+(.+)$") {
      Add-Error "invalid SHA256SUMS line: $line"
      continue
    }
    $hash = $Matches[1].ToLowerInvariant()
    $relative = $Matches[2].Trim().Replace("\", "/")
    if ($shaEntries.ContainsKey($relative)) {
      Add-Error "duplicate SHA entry: $relative"
    } else {
      $shaEntries[$relative] = $hash
    }
  }
}

$payloadFiles = Get-ChildItem -Path $packageDir -File -Recurse |
  Where-Object { $_.Name -notin @("SHA256SUMS.txt", "release-manifest.json") } |
  Sort-Object FullName

foreach ($file in $payloadFiles) {
  $relative = Get-RelativePathFrom -BasePath $packageDir -TargetPath $file.FullName
  $actual = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  if (-not $shaEntries.ContainsKey($relative)) {
    Add-Error "missing SHA entry for $relative"
    continue
  }
  if ($shaEntries[$relative] -ne $actual) {
    Add-Error "SHA mismatch for $relative expected=$($shaEntries[$relative]) actual=$actual"
  }
}

foreach ($relative in $shaEntries.Keys) {
  $path = Join-Path $packageDir ($relative.Replace("/", "\"))
  if (-not (Test-Path $path)) {
    Add-Error "SHA entry points to missing file: $relative"
  }
}

if ($manifest) {
  $manifestFiles = @($manifest.files)
  if ($manifestFiles.Count -ne $payloadFiles.Count) {
    Add-Error "manifest file count mismatch: manifest=$($manifestFiles.Count) payload=$($payloadFiles.Count)"
  }
  foreach ($entry in $manifestFiles) {
    $relative = ([string]$entry.path).Replace("\", "/")
    $path = Join-Path $packageDir ($relative.Replace("/", "\"))
    if (-not (Test-Path $path)) {
      Add-Error "manifest entry points to missing file: $relative"
      continue
    }
    $file = Get-Item $path
    if ([int64]$entry.size -ne [int64]$file.Length) {
      Add-Error "manifest size mismatch for $relative expected=$($entry.size) actual=$($file.Length)"
    }
    $actual = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ([string]$entry.sha256 -ne $actual) {
      Add-Error "manifest SHA mismatch for $relative"
    }
  }
}

$exe = Test-RequiredFile "lan-helper-$tag.exe"
if ($exe) {
  if ($exe.Length -lt 1000000) {
    Add-Error "release exe is unexpectedly small: $($exe.Length)"
  }
}

$releaseBody = Join-Path $packageDir "RELEASE_BODY.md"
if (Test-Path $releaseBody) {
  $body = Get-Content $releaseBody -Raw -Encoding UTF8
  if ($body -notmatch "0\.1\.0") { Add-Error "RELEASE_BODY.md missing 0.1.0" }
  if ($body -notmatch "MVP" -or $body -notmatch "PENDING") { Add-Error "RELEASE_BODY.md missing MVP/PENDING boundary" }
  if ($body -notmatch "Steam Remote Play" -or $body -notmatch "Sunshine") { Add-Error "RELEASE_BODY.md missing remote-play boundary" }
}

$guide = Join-Path $packageDir "REAL_EXE_MANUAL_VALIDATION_GUIDE.md"
if (Test-Path $guide) {
  $guideText = Get-Content $guide -Raw -Encoding UTF8
  if ($guideText -notmatch "PASS / FAIL / PENDING") { Add-Error "manual validation guide missing PASS/FAIL/PENDING" }
  if ($guideText -notmatch "n2n" -or $guideText -notmatch "Terraria") { Add-Error "manual validation guide missing n2n/Terraria flow" }
  if ($guideText -notmatch "Cuphead") { Add-Error "manual validation guide missing non-LAN sample" }
}

$registryIndex = Join-Path $packageDir "adapter-registry\index.json"
if (Test-Path $registryIndex) {
  try {
    $index = Get-Content $registryIndex -Raw -Encoding UTF8 | ConvertFrom-Json
    if (@($index.games).Count -lt 5) {
      Add-Error "packaged adapter registry has too few games: $(@($index.games).Count)"
    }
  } catch {
    Add-Error "packaged adapter registry index is invalid JSON: $($_.Exception.Message)"
  }
}

Write-Host "Files checked: $($payloadFiles.Count)"
Write-Host "Warnings: $($warnings.Count)"
Write-Host "Errors: $($errors.Count)"

foreach ($warning in $warnings) {
  Write-Host "WARNING: $warning" -ForegroundColor Yellow
}

if ($errors.Count -gt 0) {
  foreach ($err in $errors) {
    Write-Host "ERROR: $err" -ForegroundColor Red
  }
  exit 1
}

$summary = @"
## $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $tag release package verification

~~~text
status: PASS
package: $packageDir
payload_files: $($payloadFiles.Count)
sha256sums: PASS
manifest: PASS
manual_guide: PASS
adapter_registry: PASS
~~~

Note: this verifies local release package integrity only. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
"@

if ($AppendLog) {
  Add-Content -Path $logPath -Value $summary -Encoding UTF8
  Write-Host "Appended verification summary to $logPath"
}

Write-Host "PASS: release package verification completed." -ForegroundColor Green
