param(
  [string]$RegistryDir = "adapter-registry",
  [int]$Version = 1,
  [string]$Description = "Lan Helper local adapter registry example. Can be hosted by VPS, static HTTP server, GitHub Pages, or any HTTPS static file hosting.",
  [switch]$NoWrite
)

$ErrorActionPreference = "Stop"

function Resolve-ProjectRoot {
  param([string]$StartDir)
  $dir = (Resolve-Path $StartDir).Path
  while ($true) {
    if ((Test-Path (Join-Path $dir ".git")) -or (Test-Path (Join-Path $dir "package.json"))) {
      return $dir
    }
    $parent = Split-Path $dir -Parent
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) {
      return (Resolve-Path $StartDir).Path
    }
    $dir = $parent
  }
}

function Get-Sha256Hex {
  param([Parameter(Mandatory=$true)][string]$Path)
  $hash = Get-FileHash -Path $Path -Algorithm SHA256
  return $hash.Hash.ToLowerInvariant()
}

function ConvertTo-JsonStringLiteral {
  param([AllowNull()]$Value)
  if ($null -eq $Value) { return "null" }
  return ($Value | ConvertTo-Json -Compress)
}

function ConvertTo-RegistryJson {
  param([Parameter(Mandatory=$true)]$Value)
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("{")
  $lines.Add("  `"version`": $($Value.version),")
  $lines.Add("  `"updated_at`": $(ConvertTo-JsonStringLiteral $Value.updated_at),")
  $lines.Add("  `"description`": $(ConvertTo-JsonStringLiteral $Value.description),")
  $lines.Add("  `"games`": [")
  for ($i = 0; $i -lt $Value.games.Count; $i++) {
    $game = $Value.games[$i]
    $suffix = if ($i -lt ($Value.games.Count - 1)) { "," } else { "" }
    $lines.Add("    {")
    $lines.Add("      `"game_id`": $(ConvertTo-JsonStringLiteral $game.game_id),")
    $lines.Add("      `"steam_appid`": $(ConvertTo-JsonStringLiteral $game.steam_appid),")
    $lines.Add("      `"adapter_url`": $(ConvertTo-JsonStringLiteral $game.adapter_url),")
    $lines.Add("      `"sha256`": $(ConvertTo-JsonStringLiteral $game.sha256)")
    $lines.Add("    }$suffix")
  }
  $lines.Add("  ]")
  $lines.Add("}")
  return ($lines -join "`n")
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

$projectRoot = Resolve-ProjectRoot -StartDir (Get-Location)
$registryPath = if ([System.IO.Path]::IsPathRooted($RegistryDir)) { $RegistryDir } else { Join-Path $projectRoot $RegistryDir }
$gamesDir = Join-Path $registryPath "games"
$indexPath = Join-Path $registryPath "index.json"

if (-not (Test-Path $gamesDir)) {
  throw "games directory not found: $gamesDir"
}

$gameFiles = Get-ChildItem -Path $gamesDir -Filter "*.json" -File | Sort-Object Name
if ($gameFiles.Count -eq 0) {
  throw "no adapter json files found in: $gamesDir"
}

$entries = New-Object System.Collections.Generic.List[object]
foreach ($file in $gameFiles) {
  $raw = Get-Content -Path $file.FullName -Raw -Encoding UTF8
  try {
    $adapter = $raw | ConvertFrom-Json
  } catch {
    throw "invalid adapter json: $($file.FullName) :: $($_.Exception.Message)"
  }

  if (-not $adapter.game_id) {
    throw "adapter missing game_id: $($file.FullName)"
  }

  $expectedName = "$($adapter.game_id).json"
  if ($file.Name -ne $expectedName) {
    Write-Warning "file name '$($file.Name)' differs from game_id '$($adapter.game_id)' expected '$expectedName'"
  }

  $steamAppId = $null
  if (($null -ne $adapter.steam_appid) -and -not [string]::IsNullOrWhiteSpace([string]$adapter.steam_appid)) {
    $steamAppId = [string]$adapter.steam_appid
  }

  $entries.Add([ordered]@{
    game_id = [string]$adapter.game_id
    steam_appid = $steamAppId
    adapter_url = "games/$($file.Name)"
    sha256 = Get-Sha256Hex -Path $file.FullName
  })
}

$index = [ordered]@{
  version = $Version
  updated_at = (Get-Date -Format "yyyy-MM-dd")
  description = $Description
  games = @($entries.ToArray())
}

$json = ConvertTo-RegistryJson -Value $index
if (-not $json.EndsWith("`n")) { $json = "$json`n" }

if ($NoWrite) {
  Write-Output $json
} else {
  New-Item -ItemType Directory -Path $registryPath -Force | Out-Null
  Write-Utf8NoBom -Path $indexPath -Content $json
  Write-Host "updated $indexPath"
  Write-Host "games: $($entries.Count)"
  foreach ($entry in $entries) {
    Write-Host ("- {0} {1}" -f $entry.game_id, $entry.sha256)
  }
}