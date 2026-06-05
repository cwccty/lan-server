param(
  [string]$RegistryDir = "adapter-registry"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

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

function Get-ArrayValues {
  param($Value)
  if ($null -eq $Value) { return @() }
  return @($Value)
}

function Test-TextField {
  param(
    [string]$Name,
    $Value,
    [string]$Context
  )
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
    Add-Error "$Context missing text field: $Name"
    return $false
  }
  return $true
}

function Test-BoolField {
  param(
    [string]$Name,
    $Value,
    [string]$Context
  )
  if ($null -eq $Value -or $Value.GetType().Name -ne "Boolean") {
    Add-Error "$Context missing boolean field: $Name"
    return $false
  }
  return $true
}

function Test-Port {
  param(
    $Value,
    [string]$Context
  )
  if ($null -eq $Value) { return }
  try {
    $port = [int]$Value
    if ($port -lt 1 -or $port -gt 65535) {
      Add-Error "$Context invalid port: $Value"
    }
  } catch {
    Add-Error "$Context invalid port: $Value"
  }
}

function Get-Sha256Hex {
  param([string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$registryPath = if ([System.IO.Path]::IsPathRooted($RegistryDir)) { $RegistryDir } else { Join-Path $repoRoot $RegistryDir }
$indexPath = Join-Path $registryPath "index.json"
$gamesDir = Join-Path $registryPath "games"

if (-not (Test-Path $indexPath)) { Add-Error "missing index.json: $indexPath" }
if (-not (Test-Path $gamesDir)) { Add-Error "missing games directory: $gamesDir" }
if ($errors.Count -gt 0) {
  $errors | ForEach-Object { Write-Host "ERROR: $_" -ForegroundColor Red }
  exit 1
}

try {
  $index = Get-Content -Path $indexPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  Add-Error "invalid index json: $($_.Exception.Message)"
}

if ($null -eq $index.version) { Add-Error "index missing version" }
if (-not $index.updated_at) { Add-Error "index missing updated_at" }
if (-not $index.description) { Add-Error "index missing description" }

$entries = Get-ArrayValues $index.games
if ($entries.Count -eq 0) { Add-Error "index games is empty" }

$seenIds = @{}
$seenUrls = @{}
$validatedAdapters = 0

foreach ($entry in $entries) {
  $context = "index entry"
  if (-not (Test-TextField "game_id" $entry.game_id $context)) { continue }
  $gameId = [string]$entry.game_id
  $context = "index entry '$gameId'"

  if ($seenIds.ContainsKey($gameId)) {
    Add-Error "$context duplicated game_id"
  } else {
    $seenIds[$gameId] = $true
  }

  Test-TextField "adapter_url" $entry.adapter_url $context | Out-Null
  Test-TextField "sha256" $entry.sha256 $context | Out-Null

  $adapterUrl = [string]$entry.adapter_url
  if (-not $adapterUrl.StartsWith("games/")) {
    Add-Error "$context adapter_url must start with games/"
  }
  if ($seenUrls.ContainsKey($adapterUrl)) {
    Add-Error "$context duplicated adapter_url: $adapterUrl"
  } else {
    $seenUrls[$adapterUrl] = $true
  }

  if ([string]$entry.sha256 -notmatch "^[a-fA-F0-9]{64}$") {
    Add-Error "$context invalid sha256 format"
  }

  $relativePath = $adapterUrl.Replace("/", "\")
  $adapterPath = Join-Path $registryPath $relativePath
  if (-not (Test-Path $adapterPath)) {
    Add-Error "$context missing adapter file: $adapterUrl"
    continue
  }

  $actualSha = Get-Sha256Hex -Path $adapterPath
  if ($actualSha -ne ([string]$entry.sha256).ToLowerInvariant()) {
    Add-Error "$context sha256 mismatch: expected $($entry.sha256), actual $actualSha"
  }

  try {
    $adapter = Get-Content -Path $adapterPath -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    Add-Error "$context invalid adapter json: $($_.Exception.Message)"
    continue
  }

  $adapterContext = "adapter '$gameId'"
  if ([string]$adapter.game_id -ne $gameId) {
    Add-Error "$adapterContext game_id mismatch: $($adapter.game_id)"
  }

  Test-TextField "display_name" $adapter.display_name $adapterContext | Out-Null
  Test-TextField "network_type" $adapter.network_type $adapterContext | Out-Null

  $capabilities = Get-ArrayValues $adapter.capabilities
  if ($capabilities.Count -eq 0) {
    Add-Error "$adapterContext capabilities is empty"
  }

  $defaultPorts = Get-ArrayValues $adapter.default_ports
  foreach ($port in $defaultPorts) {
    Test-Port $port "$adapterContext default_ports"
  }

  $profiles = Get-ArrayValues $adapter.launch_profiles
  if ($profiles.Count -eq 0) {
    Add-Warning "$adapterContext has no launch_profiles"
  }
  foreach ($profile in $profiles) {
    if (-not $profile.id) { Add-Error "$adapterContext launch_profile missing id" }
    if (-not $profile.name) { Add-Error "$adapterContext launch_profile missing name" }
    if (-not $profile.type) { Add-Error "$adapterContext launch_profile missing type" }
    if ($profile.type -in @("client", "server") -and -not $profile.exe) {
      Add-Error "$adapterContext launch_profile '$($profile.id)' missing exe"
    }
  }

  if ($null -eq $adapter.multiplayer_conversion) {
    Add-Error "$adapterContext missing multiplayer_conversion"
    continue
  }
  if ($null -eq $adapter.connection_plan) {
    Add-Error "$adapterContext missing connection_plan"
    continue
  }

  $conversion = $adapter.multiplayer_conversion
  $plan = $adapter.connection_plan
  Test-TextField "multiplayer_conversion.capability" $conversion.capability $adapterContext | Out-Null
  Test-BoolField "multiplayer_conversion.can_convert_to_lan" $conversion.can_convert_to_lan $adapterContext | Out-Null
  Test-TextField "multiplayer_conversion.risk_level" $conversion.risk_level $adapterContext | Out-Null

  $methods = Get-ArrayValues $conversion.methods
  if ($methods.Count -eq 0) {
    Add-Error "$adapterContext multiplayer_conversion.methods is empty"
  }

  $notes = Get-ArrayValues $conversion.notes
  if ($notes.Count -eq 0) {
    Add-Warning "$adapterContext multiplayer_conversion.notes is empty"
  }

  Test-TextField "connection_plan.summary" $plan.summary $adapterContext | Out-Null
  Test-TextField "connection_plan.host_role" $plan.host_role $adapterContext | Out-Null
  Test-TextField "connection_plan.join_role" $plan.join_role $adapterContext | Out-Null
  Test-BoolField "connection_plan.requires_virtual_lan" $plan.requires_virtual_lan $adapterContext | Out-Null
  Test-BoolField "connection_plan.requires_tcp_port_proxy" $plan.requires_tcp_port_proxy $adapterContext | Out-Null
  Test-BoolField "connection_plan.requires_udp_broadcast_bridge" $plan.requires_udp_broadcast_bridge $adapterContext | Out-Null
  Test-BoolField "connection_plan.requires_dedicated_server" $plan.requires_dedicated_server $adapterContext | Out-Null
  Test-Port $plan.default_join_port "$adapterContext connection_plan.default_join_port"

  if ((Get-ArrayValues $plan.invite_template).Count -eq 0) {
    Add-Error "$adapterContext connection_plan.invite_template is empty"
  }
  if ((Get-ArrayValues $plan.troubleshooting).Count -eq 0) {
    Add-Error "$adapterContext connection_plan.troubleshooting is empty"
  }

  $isLocalCoopRoute =
    ([string]$adapter.network_type -eq "local_coop_remote_play") -or
    ([string]$conversion.capability -eq "local_coop_remote_play") -or
    ($capabilities -contains "local_coop")

  if ($isLocalCoopRoute) {
    if ($conversion.can_convert_to_lan -eq $true) {
      Add-Error "$adapterContext local_coop route must not set can_convert_to_lan=true"
    }
    if ($plan.requires_virtual_lan -eq $true) {
      Add-Error "$adapterContext local_coop route must not require virtual LAN"
    }
    if ($methods -contains "virtual_lan") {
      Add-Error "$adapterContext local_coop route must not recommend virtual_lan"
    }
    if (-not ($methods -contains "steam_remote_play") -and -not ($methods -contains "sunshine_moonlight")) {
      Add-Error "$adapterContext local_coop route must recommend remote-play or streaming"
    }
    if ($defaultPorts.Count -gt 0 -or $null -ne $plan.default_join_port) {
      Add-Error "$adapterContext local_coop route must not expose LAN/game join ports"
    }
  }

  if ($conversion.can_convert_to_lan -eq $true) {
    if ($isLocalCoopRoute) {
      Add-Error "$adapterContext local_coop cannot also be convertible to LAN"
    }
    if (($methods -notcontains "virtual_lan") -and ($methods -notcontains "port_proxy") -and ($methods -notcontains "udp_broadcast_bridge") -and ($methods -notcontains "dedicated_server_launcher")) {
      Add-Warning "$adapterContext can_convert_to_lan=true but no LAN-like method is listed"
    }
  }

  if ($plan.requires_udp_broadcast_bridge -eq $true -and $methods -notcontains "udp_broadcast_bridge") {
    Add-Error "$adapterContext requires UDP broadcast bridge but methods does not include udp_broadcast_bridge"
  }

  $validatedAdapters++
}

$gameFiles = Get-ChildItem -Path $gamesDir -Filter "*.json" -File
foreach ($file in $gameFiles) {
  $expectedUrl = "games/$($file.Name)"
  if (-not $seenUrls.ContainsKey($expectedUrl)) {
    Add-Error "adapter file not referenced by index: $expectedUrl"
  }
}

Write-Host "Adapter registry validation"
Write-Host "Registry: $registryPath"
Write-Host "Adapters: $validatedAdapters"
Write-Host "Warnings: $($warnings.Count)"
Write-Host "Errors: $($errors.Count)"

foreach ($warning in $warnings) {
  Write-Host "WARNING: $warning" -ForegroundColor Yellow
}

if ($errors.Count -gt 0) {
  foreach ($error in $errors) {
    Write-Host "ERROR: $error" -ForegroundColor Red
  }
  exit 1
}

Write-Host "PASS: adapter registry validation completed." -ForegroundColor Green
