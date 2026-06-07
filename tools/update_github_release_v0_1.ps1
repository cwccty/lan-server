param(
  [string]$Owner = "cwccty",
  [string]$Repo = "lan-server",
  [string]$Tag = "v0.1.0",
  [string]$ZipPath = "release-artifacts\LanHelper-v0.1.0-windows-x64.zip",
  [string]$ReleaseBodyPath = "docs\GITHUB_RELEASE_DRAFT.md",
  [switch]$SkipAsset,
  [switch]$SkipBody,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$token = if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_TOKEN)) {
  $env:GITHUB_TOKEN
} elseif (-not [string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
  $env:GH_TOKEN
} else {
  ""
}

if ([string]::IsNullOrWhiteSpace($token) -and -not $DryRun) {
  throw "Missing GitHub token. Set GITHUB_TOKEN or GH_TOKEN with repo release permission, then rerun this script."
}

$headers = @{
  "User-Agent" = "lan-helper-release-updater"
  "Accept" = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}
if (-not [string]::IsNullOrWhiteSpace($token)) {
  $headers["Authorization"] = "Bearer $token"
}

function Invoke-GitHubJson {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -TimeoutSec 60
  }
  $json = $Body | ConvertTo-Json -Depth 20 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType "application/json; charset=utf-8" -Body $bytes -TimeoutSec 60
}

$zipFullPath = Resolve-Path -LiteralPath $ZipPath
$assetName = Split-Path $zipFullPath -Leaf
$zipHash = (Get-FileHash -LiteralPath $zipFullPath -Algorithm SHA256).Hash.ToLowerInvariant()

$releaseUri = "https://api.github.com/repos/$Owner/$Repo/releases/tags/$Tag"
$release = Invoke-GitHubJson -Method "GET" -Uri $releaseUri

Write-Host "GitHub Release updater" -ForegroundColor Green
Write-Host "Release: $Owner/$Repo $Tag"
Write-Host "Release id: $($release.id)"
Write-Host "Asset: $assetName"
Write-Host "Local SHA256: $zipHash"
Write-Host "DryRun: $DryRun"

if (-not $SkipBody) {
  if (-not (Test-Path -LiteralPath $ReleaseBodyPath)) {
    throw "Release body file not found: $ReleaseBodyPath"
  }
  $body = Get-Content -LiteralPath $ReleaseBodyPath -Raw -Encoding UTF8
  $body = $body.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine + "## Release package checksum" + [Environment]::NewLine + [Environment]::NewLine + "SHA256: ``$zipHash``" + [Environment]::NewLine
  if ($DryRun) {
    Write-Host "DRY RUN: would update release body from $ReleaseBodyPath"
  } else {
    $null = Invoke-GitHubJson -Method "PATCH" -Uri "https://api.github.com/repos/$Owner/$Repo/releases/$($release.id)" -Body @{
      body = $body
      prerelease = $true
    }
    Write-Host "Updated release body." -ForegroundColor Green
  }
}

if (-not $SkipAsset) {
  $existingAsset = @($release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1)
  if ($existingAsset.Count -gt 0) {
    Write-Host "Existing asset digest: $($existingAsset[0].digest)"
    Write-Host "Existing downloads: $($existingAsset[0].download_count)"
    if ($DryRun) {
      Write-Host "DRY RUN: would delete existing asset id $($existingAsset[0].id)"
    } else {
      Invoke-GitHubJson -Method "DELETE" -Uri "https://api.github.com/repos/$Owner/$Repo/releases/assets/$($existingAsset[0].id)" | Out-Null
      Write-Host "Deleted old asset." -ForegroundColor Yellow
    }
  }

  $encodedName = [uri]::EscapeDataString($assetName)
  $uploadUri = "https://uploads.github.com/repos/$Owner/$Repo/releases/$($release.id)/assets?name=$encodedName"
  if ($DryRun) {
    Write-Host "DRY RUN: would upload $zipFullPath to $uploadUri"
  } else {
    $uploadHeaders = $headers.Clone()
    $uploadHeaders["Content-Type"] = "application/zip"
    $uploaded = Invoke-RestMethod -Method "POST" -Uri $uploadUri -Headers $uploadHeaders -InFile $zipFullPath -ContentType "application/zip" -TimeoutSec 300
    Write-Host "Uploaded asset: $($uploaded.name)" -ForegroundColor Green
    Write-Host "Uploaded digest: $($uploaded.digest)"
  }
}

$updatedRelease = Invoke-GitHubJson -Method "GET" -Uri $releaseUri
$updatedAsset = @($updatedRelease.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1)
if ($updatedAsset.Count -gt 0) {
  Write-Host "Remote asset after update:"
  Write-Host "name=$($updatedAsset[0].name)"
  Write-Host "size=$($updatedAsset[0].size)"
  Write-Host "digest=$($updatedAsset[0].digest)"
  Write-Host "downloads=$($updatedAsset[0].download_count)"
  if (-not $DryRun -and $updatedAsset[0].digest -ne "sha256:$zipHash") {
    throw "Remote digest mismatch. expected=sha256:$zipHash actual=$($updatedAsset[0].digest)"
  }
}

Write-Host "PASS: GitHub release update script completed." -ForegroundColor Green
