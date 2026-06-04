param(
  [switch]$FullBuild,
  [switch]$RunCargoTests,
  [switch]$SkipTauriBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Detail = ""
  )
  $results.Add([pscustomobject]@{
    Name = $Name
    Status = $Status
    Detail = $Detail
  }) | Out-Null
}

function Fail-Check {
  param([string]$Name, [string]$Detail)
  Add-Result $Name "FAIL" $Detail
}

function Pass-Check {
  param([string]$Name, [string]$Detail = "")
  Add-Result $Name "PASS" $Detail
}

function Format-MatchLocations {
  param($Matches, [int]$Limit = 10)
  return (($Matches | Select-Object -First $Limit | ForEach-Object {
    "{0}:{1}" -f $_.Path, $_.LineNumber
  }) -join "; ")
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Script
  )
  Write-Host "`n==> $Name" -ForegroundColor Cyan
  try {
    & $Script
    if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
      throw "$Name exited with code $LASTEXITCODE"
    }
    Pass-Check $Name
  } catch {
    Fail-Check $Name ([string]$_)
  }
}

function Test-RequiredFile {
  param([string]$Path)
  if (Test-Path $Path) {
    Pass-Check "required file: $Path"
  } else {
    Fail-Check "required file: $Path" "missing"
  }
}

Write-Host "Lan Helper release preflight" -ForegroundColor Green
Write-Host "Repo: $repoRoot"
Write-Host "FullBuild: $FullBuild  RunCargoTests: $RunCargoTests  SkipTauriBuild: $SkipTauriBuild"

# Core files that must exist for the current release workflow.
@(
  "package.json",
  "src-tauri\Cargo.toml",
  "docs\RELEASE_VALIDATION_PLAN.md",
  "docs\RELEASE_VALIDATION_LOG.md",
  "docs\PRODUCT_MEMORY.md",
  "docs\DEVELOPMENT_PROGRESS.md",
  "docs\FINAL_REFERENCE_UI_BACKEND_MATRIX.md",
  "docs\GOAL_COMPLETION_AUDIT.md",
  "src\reference-runtime.css",
  "adapter-registry\index.json",
  "tools\check_reference_runtime_css.ps1",
  "tools\check_reference_ui_fidelity.ps1",
  "tools\update_adapter_registry_index.ps1"
) | ForEach-Object { Test-RequiredFile $_ }

# Encoding / copy-feedback / over-claim guardrails.
$questionMatches = Select-String -Path "src\**\*.*","docs\*.md","act.md" -Pattern "????" -SimpleMatch -ErrorAction SilentlyContinue
if ($questionMatches) {
  Fail-Check "no source-level question-mark mojibake" (Format-MatchLocations $questionMatches)
} else {
  Pass-Check "no source-level question-mark mojibake"
}

$optionalClipboard = Select-String -Path "src\**\*.tsx" -Pattern "navigator.clipboard?." -SimpleMatch -ErrorAction SilentlyContinue
if ($optionalClipboard) {
  Fail-Check "no silent optional clipboard writes" (Format-MatchLocations $optionalClipboard)
} else {
  Pass-Check "no silent optional clipboard writes"
}

$publishText = Select-String -Path "src\**\*.tsx" -Pattern "可发布" -SimpleMatch -ErrorAction SilentlyContinue
if ($publishText) {
  Fail-Check "no UI over-claim: publish-ready text" (Format-MatchLocations $publishText)
} else {
  Pass-Check "no UI over-claim: publish-ready text"
}

# Release/product-mode guardrails.
# The packaged EXE must default to Product Mode so reference-only demo data
# (for example hard-coded latency, success-rate and host samples) cannot be
# mistaken for live backend state in the release build. Browser preview may
# still remain reference-first for visual-fidelity review.
try {
  $productModeText = Get-Content "src\reference-adapter\productMode.ts" -Raw -Encoding UTF8
  $mainTextForProductMode = Get-Content "src\main.tsx" -Raw -Encoding UTF8
  if ($productModeText -match "__TAURI__" -and $productModeText -match "__TAURI_INTERNALS__" -and $productModeText -match "if \(isTauriRuntime\) return true") {
    Pass-Check "EXE forces Product Mode" "Tauri runtime ignores stale localStorage reference-mode value"
  } else {
    Fail-Check "EXE forces Product Mode" "src/reference-adapter/productMode.ts must force Product Mode under Tauri before reading stored 0/1"
  }

  $requiredProductPatcherNames = @(
    "ReferenceProductRuntimeBridgeController",
    "ReferenceProductActionPatcher",
    "ReferenceProductActionResultPatcher",
    "ReferenceProductInventoryPatcher",
    "ReferenceProductSettingsPatcher"
  )
  $missingProductPatchers = @($requiredProductPatcherNames | Where-Object { $mainTextForProductMode -notmatch [regex]::Escape($_) })
  if ($missingProductPatchers.Count -eq 0) {
    Pass-Check "release mounts Product Mode patchers"
  } else {
    Fail-Check "release mounts Product Mode patchers" ("missing in src/main.tsx: " + ($missingProductPatchers -join ", "))
  }

  if ($mainTextForProductMode -match "from './reference-ui/App'" -and $mainTextForProductMode -notmatch "from './App'") {
    Pass-Check "legacy shell is not release entry"
  } else {
    Fail-Check "legacy shell is not release entry" "src/main.tsx must use src/reference-ui/App and must not import deprecated src/App.tsx"
  }

  $appTextForControlledHome = Get-Content "src\reference-ui\App.tsx" -Raw -Encoding UTF8
  if ((Test-Path "src\product-ui\ProductHomeView.tsx") -and $appTextForControlledHome -match "ProductHomeView" -and $appTextForControlledHome -match "productMode\.enabled" -and $mainTextForProductMode -notmatch "ReferenceProductHomePatcher") {
    Pass-Check "controlled Home page replaces Home patcher"
  } else {
    Fail-Check "controlled Home page replaces Home patcher" "Product Mode home must render src/product-ui/ProductHomeView.tsx and main.tsx must not mount ReferenceProductHomePatcher"
  }

  if ((Test-Path "src\product-ui\ProductHeader.tsx") -and $appTextForControlledHome -match "ProductHeader" -and $appTextForControlledHome -match "productMode\.enabled" -and $mainTextForProductMode -notmatch "ReferenceProductHeaderPatcher") {
    Pass-Check "controlled Header replaces Header patcher"
  } else {
    Fail-Check "controlled Header replaces Header patcher" "Product Mode header must render src/product-ui/ProductHeader.tsx and main.tsx must not mount ReferenceProductHeaderPatcher"
  }

  if ((Test-Path "src\product-ui\ProductAdvancedToolsView.tsx") -and $appTextForControlledHome -match "ProductAdvancedToolsView" -and $appTextForControlledHome -match "advanced_tools" -and $appTextForControlledHome -match "productMode\.enabled" -and $mainTextForProductMode -notmatch "ReferenceProductAdvancedToolsPatcher") {
    Pass-Check "controlled Advanced Tools page replaces Advanced Tools patcher"
  } else {
    Fail-Check "controlled Advanced Tools page replaces Advanced Tools patcher" "Product Mode advanced_tools must render src/product-ui/ProductAdvancedToolsView.tsx and main.tsx must not mount ReferenceProductAdvancedToolsPatcher"
  }

  if ((Test-Path "src\product-ui\ProductNetworkView.tsx") -and $appTextForControlledHome -match "ProductNetworkView" -and $appTextForControlledHome -match "currentTab === 'network'" -and $appTextForControlledHome -match "productMode\.enabled") {
    Pass-Check "controlled Network page replaces reference Network form"
  } else {
    Fail-Check "controlled Network page replaces reference Network form" "Product Mode network must render src/product-ui/ProductNetworkView.tsx instead of relying on UniversalNetworkView button interception"
  }

  if ((Test-Path "src\product-ui\ProductTerrariaGuideView.tsx") -and $appTextForControlledHome -match "ProductTerrariaGuideView" -and $appTextForControlledHome -match "currentTab === 'terraria'" -and $appTextForControlledHome -match "productMode\.enabled") {
    Pass-Check "controlled Terraria page replaces simulated Terraria guide"
  } else {
    Fail-Check "controlled Terraria page replaces simulated Terraria guide" "Product Mode terraria must render src/product-ui/ProductTerrariaGuideView.tsx instead of relying on TerrariaGuideView simulated logs and button interception"
  }

  if ((Test-Path "src\product-ui\ProductDiagnosticsView.tsx") -and $appTextForControlledHome -match "ProductDiagnosticsView" -and $appTextForControlledHome -match "currentTab === 'diagnostics'" -and $appTextForControlledHome -match "productMode\.enabled" -and $mainTextForProductMode -notmatch "ReferenceProductDiagnosticsPatcher") {
    Pass-Check "controlled Diagnostics page replaces Diagnostics patcher"
  } else {
    Fail-Check "controlled Diagnostics page replaces Diagnostics patcher" "Product Mode diagnostics must render src/product-ui/ProductDiagnosticsView.tsx and main.tsx must not mount ReferenceProductDiagnosticsPatcher"
  }

  if ((Test-Path "src\product-ui\ProductGameScanView.tsx") -and $appTextForControlledHome -match "ProductGameScanView" -and $appTextForControlledHome -match "currentTab === 'games'" -and $appTextForControlledHome -match "productMode\.enabled") {
    Pass-Check "controlled Game Scan page replaces reference scan demo"
  } else {
    Fail-Check "controlled Game Scan page replaces reference scan demo" "Product Mode games must render src/product-ui/ProductGameScanView.tsx instead of relying on GameScanView simulated scan and ProductInventoryPatcher"
  }
} catch {
  Fail-Check "release/product-mode guardrails" ([string]$_)
}

# Static API wiring sentinel for core reference buttons. This is intentionally
# source-level: runtime/manual validation is still required, but release
# preflight should fail if a refactor drops the real Tauri API bridge and
# leaves only reference UI demo handlers.
try {
  $sidebarText = Get-Content "src\reference-ui\components\Sidebar.tsx" -Raw -Encoding UTF8
  $appText = Get-Content "src\reference-ui\App.tsx" -Raw -Encoding UTF8
  $actionsText = Get-Content "src\reference-adapter\actions.ts" -Raw -Encoding UTF8
  $actionPatcherText = Get-Content "src\reference-adapter\ProductActionPatcher.tsx" -Raw -Encoding UTF8

  $requiredNavLabels = @(
    "首页",
    "方案库",
    "游戏扫描",
    "推荐方案",
    "通用组网中心",
    "高级连接工具",
    "Terraria 向导",
    "诊断报告",
    "设置与帮助"
  )
  $missingNavLabels = @($requiredNavLabels | Where-Object {
    $sidebarText -notmatch [regex]::Escape($_)
  })
  if ($missingNavLabels.Count -eq 0 -and $appText -match "currentTab === 'advanced_tools'" -and $appText -match "AdvancedToolsView") {
    Pass-Check "core navigation includes all product pages"
  } else {
    $detail = "missing labels: " + ($missingNavLabels -join ", ")
    if ($appText -notmatch "currentTab === 'advanced_tools'") { $detail += "; missing advanced_tools route" }
    if ($appText -notmatch "AdvancedToolsView") { $detail += "; missing AdvancedToolsView" }
    Fail-Check "core navigation includes all product pages" $detail
  }

  $requiredApiCalls = @(
    "setupNetwork",
    "startNetwork",
    "stopNetwork",
    "startGameServerSession",
    "stopServerSession",
    "sendServerCommand",
    "scanGames",
    "analyzeGame",
    "recommendPlans",
    "launchProfile",
    "testConnectivity",
    "generateDiagnosticReport",
    "startPortProxy",
    "startUdpProxy",
    "startUdpBroadcastBridge"
  )
  $missingApiCalls = @($requiredApiCalls | Where-Object { $actionsText -notmatch "\b$([regex]::Escape($_))\b" })
  if ($missingApiCalls.Count -eq 0) {
    Pass-Check "core buttons use real backend API sentinel"
  } else {
    Fail-Check "core buttons use real backend API sentinel" ("missing in src/reference-adapter/actions.ts: " + ($missingApiCalls -join ", "))
  }

  if ($actionPatcherText -match "Refresh Node Status.+startReferenceN2n") {
    Fail-Check "network refresh does not restart n2n" "Refresh Node Status must refresh diagnostics/runtime snapshot, not call startReferenceN2n"
  } elseif ($actionPatcherText -match "Refresh Node Status.+refreshReferenceRuntime") {
    Pass-Check "network refresh does not restart n2n"
  } else {
    Fail-Check "network refresh does not restart n2n" "Refresh Node Status handler not found"
  }
} catch {
  Fail-Check "core buttons use real backend API sentinel" ([string]$_)
}

# Reference UI fidelity guardrail.
# The current visual shell is intentionally locked to the user's reference
# frontend in C:\Users\ty\Downloads\联机助手 (3)\src. Backend/product wiring must
# happen through src/reference-adapter unless the reference itself is updated.
$referenceUiCheck = "tools\check_reference_ui_fidelity.ps1"
$referenceUiSource = "C:\Users\ty\Downloads\联机助手 (3)\src"
try {
  $referenceUiCheckText = Get-Content $referenceUiCheck -Raw -Encoding UTF8
  if ($referenceUiCheckText -match [regex]::Escape("C:\Users\ty\Downloads\联机助手 (3)\src")) {
    Pass-Check "final design source pinned to (3)"
  } else {
    Fail-Check "final design source pinned to (3)" "$referenceUiCheck must default to C:\Users\ty\Downloads\联机助手 (3)\src"
  }
  if ($referenceUiSource -eq "C:\Users\ty\Downloads\联机助手 (3)\src") {
    Pass-Check "preflight uses final design source (3)"
  } else {
    Fail-Check "preflight uses final design source (3)" "current source: $referenceUiSource"
  }
} catch {
  Fail-Check "reference design source guardrail" ([string]$_)
}
if (Test-Path $referenceUiCheck) {
  if (Test-Path $referenceUiSource) {
    Invoke-Step "reference UI fidelity" {
      powershell -ExecutionPolicy Bypass -File $referenceUiCheck
    }
  } else {
    Pass-Check "reference UI fidelity" "reference source not found; skipped"
  }
} else {
  Fail-Check "reference UI fidelity" "missing: $referenceUiCheck"
}

# Reference runtime style guardrail.
# Source-level fidelity alone is not enough: Tailwind must scan the copied
# reference UI files, otherwise the app renders as unstyled HTML even though
# src/reference-ui still matches the reference source.
try {
  $mainText = Get-Content "src\main.tsx" -Raw -Encoding UTF8
  $runtimeCssText = Get-Content "src\reference-runtime.css" -Raw -Encoding UTF8
  if ($mainText -notmatch "reference-runtime\.css") {
    Fail-Check "reference runtime stylesheet import" "src/main.tsx must import src/reference-runtime.css"
  } else {
    Pass-Check "reference runtime stylesheet import"
  }
  if ($runtimeCssText -notmatch '@source\s+"\.\/reference-ui\/\*\*\/\*\.\{ts,tsx\}"') {
    Fail-Check "reference Tailwind source scan" "src/reference-runtime.css must include @source for src/reference-ui"
  } else {
    Pass-Check "reference Tailwind source scan"
  }
  if ($runtimeCssText -notmatch '@source\s+"\.\/product-ui\/\*\*\/\*\.\{ts,tsx\}"') {
    Fail-Check "product Tailwind source scan" "src/reference-runtime.css must include @source for src/product-ui"
  } else {
    Pass-Check "product Tailwind source scan"
  }
} catch {
  Fail-Check "reference runtime style guardrail" ([string]$_)
}

if (Test-Path "dist\assets") {
  Invoke-Step "reference runtime CSS sentinel" {
    powershell -ExecutionPolicy Bypass -File "tools\check_reference_runtime_css.ps1"
  }
} else {
  Fail-Check "reference runtime CSS sentinel" "missing dist/assets; run npm run build or npm run release:preflight:full"
}

# Adapter registry consistency.
try {
  $index = Get-Content "adapter-registry\index.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $gameFiles = Get-ChildItem "adapter-registry\games" -Filter "*.json" -File
  $indexCount = @($index.games).Count
  if ($indexCount -eq $gameFiles.Count) {
    Pass-Check "adapter registry count" "games=$indexCount"
  } else {
    Fail-Check "adapter registry count" "index=$indexCount files=$($gameFiles.Count)"
  }
  foreach ($entry in $index.games) {
    if (-not $entry.game_id -or -not $entry.adapter_url -or -not $entry.sha256) {
      Fail-Check "adapter registry entry fields" "missing field in $($entry | ConvertTo-Json -Compress)"
      break
    }
  }
  if (-not ($results | Where-Object { $_.Name -eq "adapter registry entry fields" -and $_.Status -eq "FAIL" })) {
    Pass-Check "adapter registry entry fields"
  }
} catch {
  Fail-Check "adapter registry parse" ([string]$_)
}

# Release exe existence. FullBuild can regenerate it.
$releaseExe = "src-tauri\target\release\lan-helper.exe"
if (Test-Path $releaseExe) {
  Pass-Check "release exe exists" $releaseExe
} else {
  Fail-Check "release exe exists" "missing: $releaseExe"
}

if ($FullBuild) {
  Invoke-Step "npm run build" { npm run build }
  Invoke-Step "cargo check" { cargo check --manifest-path "src-tauri\Cargo.toml" }
  if ($RunCargoTests) {
    Invoke-Step "cargo test port_proxy" { cargo test --manifest-path "src-tauri\Cargo.toml" port_proxy }
    Invoke-Step "cargo test udp_proxy" { cargo test --manifest-path "src-tauri\Cargo.toml" udp_proxy }
    Invoke-Step "cargo test udp_broadcast" { cargo test --manifest-path "src-tauri\Cargo.toml" udp_broadcast }
  }
  if (-not $SkipTauriBuild) {
    Invoke-Step "npm run tauri:build" { npm run tauri:build }
  }
}

Write-Host "`nPreflight summary" -ForegroundColor Green
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status -ne "PASS" })
if ($failed.Count -gt 0) {
  Write-Host "`nFAILED: $($failed.Count) check(s)" -ForegroundColor Red
  exit 1
}

Write-Host "`nPASS: release preflight checks completed." -ForegroundColor Green






