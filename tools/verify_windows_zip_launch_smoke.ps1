param(
  [string]$Version = "",
  [string]$OutputRoot = "release-artifacts",
  [int]$TimeoutSeconds = 10
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Get-ProjectVersion {
  $packageJsonPath = Join-Path $repoRoot "package.json"
  if (-not (Test-Path -LiteralPath $packageJsonPath)) {
    throw "Missing package.json: $packageJsonPath"
  }
  $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace($packageJson.version)) {
    throw "package.json version is empty."
  }
  return [string]$packageJson.version
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = Get-ProjectVersion
}

$packageName = "LanHelper-v$Version-windows-x64"
$zipPath = Join-Path $repoRoot (Join-Path $OutputRoot "$packageName.zip")
$artifactRoot = Join-Path $repoRoot "docs\acceptance-artifacts\v031-zip-launch-smoke"
$extractRoot = Join-Path $artifactRoot "extracted"
$resultPath = Join-Path $repoRoot "docs\acceptance-artifacts\windows-zip-launch-smoke-v031-2026-06-08.json"

Write-Host "Lan Helper Windows ZIP launch smoke" -ForegroundColor Green
Write-Host "ZIP: $zipPath"

if (-not (Test-Path -LiteralPath $zipPath)) {
  throw "Missing ZIP: $zipPath"
}

$artifactRootFull = [System.IO.Path]::GetFullPath($artifactRoot).TrimEnd("\") + "\"
$extractRootFull = [System.IO.Path]::GetFullPath($extractRoot)
if (-not $extractRootFull.StartsWith($artifactRootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clean extract directory outside artifact root: $extractRoot"
}

if (Test-Path -LiteralPath $extractRoot) {
  Remove-Item -LiteralPath $extractRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null

Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

$packageDir = Join-Path $extractRoot $packageName
$exePath = Join-Path $packageDir "$packageName.exe"
if (-not (Test-Path -LiteralPath $exePath)) {
  throw "Missing packaged EXE after extract: $exePath"
}

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
$exeHash = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash
$started = $false
$stillRunningAfterTimeout = $false
$exitCode = $null
$processId = $null
$errorMessage = $null

try {
  $proc = Start-Process -FilePath $exePath -WorkingDirectory $packageDir -PassThru -WindowStyle Hidden
  $started = $true
  $processId = $proc.Id
  Start-Sleep -Seconds $TimeoutSeconds
  $proc.Refresh()
  if ($proc.HasExited) {
    $exitCode = $proc.ExitCode
  } else {
    $stillRunningAfterTimeout = $true
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
} catch {
  $errorMessage = [string]$_
}

$passed = $started -and $stillRunningAfterTimeout -and [string]::IsNullOrWhiteSpace($errorMessage)
$result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  package = $packageName
  zip_path = "release-artifacts\$packageName.zip"
  zip_sha256 = $zipHash
  extracted_exe = "docs\acceptance-artifacts\v031-zip-launch-smoke\extracted\$packageName\$packageName.exe"
  extracted_exe_sha256 = $exeHash
  process_id = $processId
  timeout_seconds = $TimeoutSeconds
  started = $started
  still_running_after_timeout = $stillRunningAfterTimeout
  exit_code = $exitCode
  error = $errorMessage
  passed = $passed
}

$result | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $resultPath
$result | ConvertTo-Json -Depth 5

if (-not $passed) {
  throw "Packaged EXE launch smoke failed. See $resultPath"
}

Write-Host "PASS: packaged EXE launched and stayed running for $TimeoutSeconds seconds." -ForegroundColor Green
