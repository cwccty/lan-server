param(
  [string]$Owner = "cwccty",
  [string]$Repo = "lan-server",
  [string]$Version = "",
  [string]$Tag = "",
  [string]$ZipPath = "",
  [string]$ReleaseBodyPath = "docs\GITHUB_RELEASE_DRAFT.md",
  [switch]$SkipAsset,
  [switch]$SkipBody,
  [switch]$CreateIfMissing,
  [switch]$DryRun
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
if ([string]::IsNullOrWhiteSpace($Tag)) {
  $Tag = "v$Version"
}
if ([string]::IsNullOrWhiteSpace($ZipPath)) {
  $ZipPath = "release-artifacts\LanHelper-v$Version-windows-x64.zip"
}
$releaseName = "$([char]0x8054)$([char]0x673A)$([char]0x52A9)$([char]0x624B) $Tag"

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

function Test-GitHubNotFound {
  param([object]$ErrorRecord)
  $response = $ErrorRecord.Exception.Response
  if ($null -eq $response) {
    return $false
  }
  try {
    return ([int]$response.StatusCode -eq 404)
  } catch {
    return $false
  }
}

function Get-ReleaseBodyWithChecksum {
  param(
    [string]$Path,
    [string]$Sha256
  )
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Release body file not found: $Path"
  }
  $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  return $content.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine + "## Release package checksum" + [Environment]::NewLine + [Environment]::NewLine + "SHA256: ``$Sha256``" + [Environment]::NewLine
}

$zipFullPath = Resolve-Path -LiteralPath $ZipPath
$assetName = Split-Path $zipFullPath -Leaf
$zipHash = (Get-FileHash -LiteralPath $zipFullPath -Algorithm SHA256).Hash.ToLowerInvariant()

$releaseUri = "https://api.github.com/repos/$Owner/$Repo/releases/tags/$Tag"
$release = $null
$releaseWasMissing = $false
try {
  $release = Invoke-GitHubJson -Method "GET" -Uri $releaseUri
} catch {
  if (Test-GitHubNotFound -ErrorRecord $_) {
    $releaseWasMissing = $true
  } else {
    throw
  }
}

Write-Host "GitHub Release updater" -ForegroundColor Green
Write-Host "Release: $Owner/$Repo $Tag"
Write-Host "Asset: $assetName"
Write-Host "Local SHA256: $zipHash"
Write-Host "CreateIfMissing: $CreateIfMissing"
Write-Host "DryRun: $DryRun"

$body = $null
if (-not $SkipBody -or ($releaseWasMissing -and $CreateIfMissing)) {
  $body = Get-ReleaseBodyWithChecksum -Path $ReleaseBodyPath -Sha256 $zipHash
}

if ($releaseWasMissing) {
  if (-not $CreateIfMissing) {
    throw "GitHub release '$Tag' does not exist. Rerun with -CreateIfMissing to create it."
  }

  Write-Host "Release does not exist: $Tag" -ForegroundColor Yellow
  if ($DryRun) {
    Write-Host "DRY RUN: would create release tag_name=$Tag name=<product-name $Tag> prerelease=true body=$ReleaseBodyPath"
    $release = [pscustomobject]@{
      id = "<new-release-id>"
      assets = @()
    }
  } else {
    $createBody = @{
      tag_name = $Tag
      name = $releaseName
      body = $body
      prerelease = $true
    }
    $release = Invoke-GitHubJson -Method "POST" -Uri "https://api.github.com/repos/$Owner/$Repo/releases" -Body $createBody
    Write-Host "Created release id: $($release.id)" -ForegroundColor Green
  }
} else {
  Write-Host "Release id: $($release.id)"
  if (-not $SkipBody) {
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
    if ($releaseWasMissing) {
      Write-Host "DRY RUN: would upload $zipFullPath to the newly created release asset name=$assetName"
    } else {
      Write-Host "DRY RUN: would upload $zipFullPath to $uploadUri"
    }
  } else {
    $uploadHeaders = $headers.Clone()
    $uploadHeaders["Content-Type"] = "application/zip"
    $uploaded = Invoke-RestMethod -Method "POST" -Uri $uploadUri -Headers $uploadHeaders -InFile $zipFullPath -ContentType "application/zip" -TimeoutSec 300
    Write-Host "Uploaded asset: $($uploaded.name)" -ForegroundColor Green
    Write-Host "Uploaded digest: $($uploaded.digest)"
  }
}

if ($DryRun -and $releaseWasMissing) {
  Write-Host "DRY RUN: skipping remote post-update check because the release was not created."
  Write-Host "PASS: GitHub release update script completed." -ForegroundColor Green
  return
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
