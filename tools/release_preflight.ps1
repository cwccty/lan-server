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
  "docs\V0_1_RELEASE_READINESS.md",
  "docs\V0_1_RELEASE_CONSISTENCY_AUDIT.md",
  "docs\GITHUB_RELEASE_DRAFT.md",
  "docs\RELEASE_NOTES_DRAFT.md",
  "docs\REAL_EXE_MANUAL_VALIDATION_GUIDE.md",
  "docs\V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md",
  "docs\V0_1_USER_FEEDBACK_TEMPLATE.md",
  "docs\NEXT_BIG_DIRECTIONS.md",
  "docs\PRODUCT_MEMORY.md",
  "docs\DEVELOPMENT_PROGRESS.md",
  "docs\FINAL_REFERENCE_UI_BACKEND_MATRIX.md",
  "docs\GOAL_COMPLETION_AUDIT.md",
  "docs\SUBAGENT_REVIEW_PLAN.md",
  "src\reference-runtime.css",
  "src-tauri\src\core\process_util.rs",
  "src-tauri\src\storage\settings_store.rs",
  "src\product-ui\ProductBusyOverlay.tsx",
  "src\product-ui\productPageCache.ts",
  "src\product-ui\productStateConsistencyAudit.ts",
  "src\product-ui\realExeValidationChecklist.ts",
  "src\product-ui\realExeManualValidationGuide.ts",
  "src\product-ui\adapterQualityScore.ts",
  "src\product-ui\gameScanRecommendationExplanation.ts",
  "src\product-ui\connectionCapabilityMatrix.ts",
  "src\product-ui\conversionAssessmentEngine.ts",
  "src\product-ui\conversionAssessmentSamples.ts",
  "src\product-ui\conversionEngineClosureAudit.ts",
  "src\product-ui\diagnosticConversionAdvice.ts",
  "src\product-ui\diagnosticRepairCenterClosureAudit.ts",
  "src\product-ui\advancedToolIntent.ts",
  "src\product-ui\inviteDiagnosticContext.ts",
  "src\product-ui\inviteJoinFlow.ts",
  "src\product-ui\inviteJoinSuccess.ts",
  "src\product-ui\inviteJoinClosureAudit.ts",
  "src\product-ui\hostRoomClosureAudit.ts",
  "src\product-ui\hostDiagnosticContext.ts",
  "src\product-ui\adapterContribution.ts",
  "src\product-ui\adapterRegistryClosureAudit.ts",
  "src\product-ui\connectionMethodClosureAudit.ts",
  "adapter-registry\index.json",
  "tools\real_exe_smoke_test.ps1",
  "tools\build_tauri_release_clean.ps1",
  "tools\prepare_v0_1_release_package.ps1",
  "tools\verify_v0_1_release_package.ps1",
  "tools\prepare_windows_x64_zip.ps1",
  "tools\verify_windows_x64_zip.ps1",
  "tools\update_github_release_v0_1.ps1",
  "tools\run_v0_1_release_gate.ps1",
  "tools\validate_adapter_registry.ps1",
  "tools\verify_dual_machine_regression_evidence.cjs",
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

$personalEmailMatches = Select-String -Path "src\**\*.*","docs\*.md","README.md","PRODUCT.md","PROJECT.md","act.md" -Pattern "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" -ErrorAction SilentlyContinue
if ($personalEmailMatches) {
  Fail-Check "no hard-coded personal email in public files" (Format-MatchLocations $personalEmailMatches)
} else {
  Pass-Check "no hard-coded personal email in public files"
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

  if ($mainTextForProductMode -match "ReferenceProductRuntimeBridgeController") {
    Pass-Check "release mounts Product runtime bridge"
  } else {
    Fail-Check "release mounts Product runtime bridge" "src/main.tsx must mount ReferenceProductRuntimeBridgeController"
  }

  $forbiddenPagePatchers = @(
    "ReferenceProductHeaderPatcher",
    "ReferenceProductHomePatcher",
    "ReferenceProductDiagnosticsPatcher",
    "ReferenceProductActionPatcher",
    "ReferenceProductActionResultPatcher",
    "ReferenceProductAdvancedToolsPatcher",
    "ReferenceProductInventoryPatcher",
    "ReferenceProductSettingsPatcher"
  )
  $mountedPagePatchers = @($forbiddenPagePatchers | Where-Object { $mainTextForProductMode -match [regex]::Escape($_) })
  if ($mountedPagePatchers.Count -eq 0) {
    Pass-Check "release does not mount page DOM patchers"
  } else {
    Fail-Check "release does not mount page DOM patchers" ("mounted in src/main.tsx: " + ($mountedPagePatchers -join ", "))
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

  if ((Test-Path "src\product-ui\ProductSolutionsView.tsx") -and $appTextForControlledHome -match "ProductSolutionsView" -and $appTextForControlledHome -match "currentTab === 'solutions'" -and $appTextForControlledHome -match "productMode\.enabled" -and $mainTextForProductMode -notmatch "ReferenceProductInventoryPatcher") {
    $solutionsText = Get-Content "src\product-ui\ProductSolutionsView.tsx" -Raw -Encoding UTF8
    if ($solutionsText -match "listGameAdapters" -and $solutionsText -match "syncAdapterRegistry" -and $solutionsText -match "saveGameAdapter" -and $solutionsText -match "data-lan-helper-product-controlled=`"solutions`"") {
      Pass-Check "controlled Solutions page replaces Inventory patcher"
    } else {
      Fail-Check "controlled Solutions page replaces Inventory patcher" "ProductSolutionsView must wire real adapter APIs and mark itself product-controlled"
    }
  } else {
    Fail-Check "controlled Solutions page replaces Inventory patcher" "Product Mode solutions must render src/product-ui/ProductSolutionsView.tsx and main.tsx must not mount ReferenceProductInventoryPatcher"
  }

  if ((Test-Path "src\product-ui\ProductSidebar.tsx") -and $appTextForControlledHome -match "ProductSidebar" -and $appTextForControlledHome -match "productMode\.enabled") {
    $productSidebarText = Get-Content "src\product-ui\ProductSidebar.tsx" -Raw -Encoding UTF8
    if ($productSidebarText -match "高级工具" -and $productSidebarText -match "高级连接工具" -and $productSidebarText -match "advanced_tools") {
      Pass-Check "controlled Product Sidebar includes Advanced Tools section"
    } else {
      Fail-Check "controlled Product Sidebar includes Advanced Tools section" "ProductSidebar must expose a visible 高级工具 section with advanced_tools navigation"
    }
  } else {
    Fail-Check "controlled Product Sidebar includes Advanced Tools section" "Product Mode must render src/product-ui/ProductSidebar.tsx instead of relying only on the reference Sidebar"
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

  if ((Test-Path "src\product-ui\ProductRecommendationView.tsx") -and $appTextForControlledHome -match "ProductRecommendationView" -and $appTextForControlledHome -match "currentTab === 'protocol'" -and $appTextForControlledHome -match "productMode\.enabled") {
    Pass-Check "controlled Recommendation page replaces reference recommendation demo"
  } else {
    Fail-Check "controlled Recommendation page replaces reference recommendation demo" "Product Mode protocol must render src/product-ui/ProductRecommendationView.tsx instead of relying on RecommendProtocolView and ProductInventoryPatcher"
  }

  if ((Test-Path "src\product-ui\ProductSettingsView.tsx") -and $appTextForControlledHome -match "ProductSettingsView" -and $appTextForControlledHome -match "currentTab === 'settings'" -and $appTextForControlledHome -match "productMode\.enabled" -and $mainTextForProductMode -notmatch "ReferenceProductSettingsPatcher") {
    $settingsText = Get-Content "src\product-ui\ProductSettingsView.tsx" -Raw -Encoding UTF8
    if ($settingsText -match "getAppSettings" -and $settingsText -match "saveAppSettings" -and $settingsText -match "resetAppSettings" -and $settingsText -match "testEdgePath" -and $settingsText -match "data-lan-helper-product-controlled=`"settings`"") {
      Pass-Check "controlled Settings page replaces Settings patcher"
    } else {
      Fail-Check "controlled Settings page replaces Settings patcher" "ProductSettingsView must wire real settings APIs and mark itself product-controlled"
    }
  } else {
    Fail-Check "controlled Settings page replaces Settings patcher" "Product Mode settings must render src/product-ui/ProductSettingsView.tsx and main.tsx must not mount ReferenceProductSettingsPatcher"
  }

  $controlledPageMarkers = @{
    "home" = "src\product-ui\ProductHomeView.tsx"
    "solutions" = "src\product-ui\ProductSolutionsView.tsx"
    "games" = "src\product-ui\ProductGameScanView.tsx"
    "recommendation" = "src\product-ui\ProductRecommendationView.tsx"
    "network" = "src\product-ui\ProductNetworkView.tsx"
    "advanced_tools" = "src\product-ui\ProductAdvancedToolsView.tsx"
    "terraria" = "src\product-ui\ProductTerrariaGuideView.tsx"
    "diagnostics" = "src\product-ui\ProductDiagnosticsView.tsx"
    "settings" = "src\product-ui\ProductSettingsView.tsx"
  }
  $missingControlledMarkers = @()
  foreach ($marker in $controlledPageMarkers.Keys) {
    $path = $controlledPageMarkers[$marker]
    if (-not (Test-Path $path)) {
      $missingControlledMarkers += "$marker missing file"
      continue
    }
    $text = Get-Content $path -Raw -Encoding UTF8
    if ($text -notmatch "data-lan-helper-product-controlled=`"$([regex]::Escape($marker))`"") {
      $missingControlledMarkers += $marker
    }
  }
  if ($missingControlledMarkers.Count -eq 0) {
    Pass-Check "all Product pages declare controlled markers"
  } else {
    Fail-Check "all Product pages declare controlled markers" ("missing markers: " + ($missingControlledMarkers -join ", "))
  }

  $statusCenterText = if (Test-Path "src\product-ui\statusCenter.ts") { Get-Content "src\product-ui\statusCenter.ts" -Raw -Encoding UTF8 } else { "" }
  $productPageCacheText = if (Test-Path "src\product-ui\productPageCache.ts") { Get-Content "src\product-ui\productPageCache.ts" -Raw -Encoding UTF8 } else { "" }
  $productStateConsistencyAuditText = if (Test-Path "src\product-ui\productStateConsistencyAudit.ts") { Get-Content "src\product-ui\productStateConsistencyAudit.ts" -Raw -Encoding UTF8 } else { "" }
  $realExeValidationChecklistText = if (Test-Path "src\product-ui\realExeValidationChecklist.ts") { Get-Content "src\product-ui\realExeValidationChecklist.ts" -Raw -Encoding UTF8 } else { "" }
  $realExeManualValidationGuideProductText = if (Test-Path "src\product-ui\realExeManualValidationGuide.ts") { Get-Content "src\product-ui\realExeManualValidationGuide.ts" -Raw -Encoding UTF8 } else { "" }
  $homeProductText = Get-Content "src\product-ui\ProductHomeView.tsx" -Raw -Encoding UTF8
  $packageJsonText = if (Test-Path "package.json") { Get-Content "package.json" -Raw -Encoding UTF8 } else { "" }
  $cargoText = if (Test-Path "src-tauri\Cargo.toml") { Get-Content "src-tauri\Cargo.toml" -Raw -Encoding UTF8 } else { "" }
  $busyOverlayText = if (Test-Path "src\product-ui\ProductBusyOverlay.tsx") { Get-Content "src\product-ui\ProductBusyOverlay.tsx" -Raw -Encoding UTF8 } else { "" }
  $headerProductText = Get-Content "src\product-ui\ProductHeader.tsx" -Raw -Encoding UTF8
  $networkProductText = Get-Content "src\product-ui\ProductNetworkView.tsx" -Raw -Encoding UTF8
  $gameProductText = Get-Content "src\product-ui\ProductGameScanView.tsx" -Raw -Encoding UTF8
  $recommendationProductText = Get-Content "src\product-ui\ProductRecommendationView.tsx" -Raw -Encoding UTF8
  $terrariaProductText = Get-Content "src\product-ui\ProductTerrariaGuideView.tsx" -Raw -Encoding UTF8
  $advancedProductText = Get-Content "src\product-ui\ProductAdvancedToolsView.tsx" -Raw -Encoding UTF8
  $diagnosticsProductText = Get-Content "src\product-ui\ProductDiagnosticsView.tsx" -Raw -Encoding UTF8
  $solutionsProductText = Get-Content "src\product-ui\ProductSolutionsView.tsx" -Raw -Encoding UTF8
  $tauriApiText = Get-Content "src\api\tauri.ts" -Raw -Encoding UTF8
  $gameTypesText = Get-Content "src\types\game.ts" -Raw -Encoding UTF8
  $gameModelsText = Get-Content "src-tauri\src\models\game.rs" -Raw -Encoding UTF8
  $adapterStoreText = Get-Content "src-tauri\src\storage\adapter_store.rs" -Raw -Encoding UTF8
  $settingsStoreText = Get-Content "src-tauri\src\storage\settings_store.rs" -Raw -Encoding UTF8
  $commandsText = Get-Content "src-tauri\src\commands.rs" -Raw -Encoding UTF8
  $libText = Get-Content "src-tauri\src\lib.rs" -Raw -Encoding UTF8
  $processUtilText = if (Test-Path "src-tauri\src\core\process_util.rs") { Get-Content "src-tauri\src\core\process_util.rs" -Raw -Encoding UTF8 } else { "" }
  $gameLauncherText = if (Test-Path "src-tauri\src\core\game_launcher.rs") { Get-Content "src-tauri\src\core\game_launcher.rs" -Raw -Encoding UTF8 } else { "" }
  $invitePacketText = if (Test-Path "src\product-ui\invitePacket.ts") { Get-Content "src\product-ui\invitePacket.ts" -Raw -Encoding UTF8 } else { "" }
  $inviteDiagnosticContextText = if (Test-Path "src\product-ui\inviteDiagnosticContext.ts") { Get-Content "src\product-ui\inviteDiagnosticContext.ts" -Raw -Encoding UTF8 } else { "" }
  $inviteJoinFlowText = if (Test-Path "src\product-ui\inviteJoinFlow.ts") { Get-Content "src\product-ui\inviteJoinFlow.ts" -Raw -Encoding UTF8 } else { "" }
  $inviteJoinSuccessText = if (Test-Path "src\product-ui\inviteJoinSuccess.ts") { Get-Content "src\product-ui\inviteJoinSuccess.ts" -Raw -Encoding UTF8 } else { "" }
  $inviteJoinClosureAuditText = if (Test-Path "src\product-ui\inviteJoinClosureAudit.ts") { Get-Content "src\product-ui\inviteJoinClosureAudit.ts" -Raw -Encoding UTF8 } else { "" }
  $hostRoomClosureAuditText = if (Test-Path "src\product-ui\hostRoomClosureAudit.ts") { Get-Content "src\product-ui\hostRoomClosureAudit.ts" -Raw -Encoding UTF8 } else { "" }
  $hostDiagnosticContextText = if (Test-Path "src\product-ui\hostDiagnosticContext.ts") { Get-Content "src\product-ui\hostDiagnosticContext.ts" -Raw -Encoding UTF8 } else { "" }
  $errorActionsText = if (Test-Path "src\product-ui\errorActions.ts") { Get-Content "src\product-ui\errorActions.ts" -Raw -Encoding UTF8 } else { "" }
  $actionsText = if (Test-Path "src\reference-adapter\actions.ts") { Get-Content "src\reference-adapter\actions.ts" -Raw -Encoding UTF8 } else { "" }
  $adapterIntentText = if (Test-Path "src\product-ui\adapterCreationIntent.ts") { Get-Content "src\product-ui\adapterCreationIntent.ts" -Raw -Encoding UTF8 } else { "" }
  $adapterRouteText = if (Test-Path "src\product-ui\adapterRecommendationRoute.ts") { Get-Content "src\product-ui\adapterRecommendationRoute.ts" -Raw -Encoding UTF8 } else { "" }
  $connectionCatalogText = if (Test-Path "src\product-ui\connectionMethodCatalog.ts") { Get-Content "src\product-ui\connectionMethodCatalog.ts" -Raw -Encoding UTF8 } else { "" }
  $capabilityMatrixText = if (Test-Path "src\product-ui\connectionCapabilityMatrix.ts") { Get-Content "src\product-ui\connectionCapabilityMatrix.ts" -Raw -Encoding UTF8 } else { "" }
  $conversionAssessmentText = if (Test-Path "src\product-ui\conversionAssessmentEngine.ts") { Get-Content "src\product-ui\conversionAssessmentEngine.ts" -Raw -Encoding UTF8 } else { "" }
  $conversionAssessmentSamplesText = if (Test-Path "src\product-ui\conversionAssessmentSamples.ts") { Get-Content "src\product-ui\conversionAssessmentSamples.ts" -Raw -Encoding UTF8 } else { "" }
  $conversionEngineClosureAuditText = if (Test-Path "src\product-ui\conversionEngineClosureAudit.ts") { Get-Content "src\product-ui\conversionEngineClosureAudit.ts" -Raw -Encoding UTF8 } else { "" }
  $diagnosticConversionAdviceText = if (Test-Path "src\product-ui\diagnosticConversionAdvice.ts") { Get-Content "src\product-ui\diagnosticConversionAdvice.ts" -Raw -Encoding UTF8 } else { "" }
  $diagnosticRepairCenterClosureAuditText = if (Test-Path "src\product-ui\diagnosticRepairCenterClosureAudit.ts") { Get-Content "src\product-ui\diagnosticRepairCenterClosureAudit.ts" -Raw -Encoding UTF8 } else { "" }
  $advancedToolIntentText = if (Test-Path "src\product-ui\advancedToolIntent.ts") { Get-Content "src\product-ui\advancedToolIntent.ts" -Raw -Encoding UTF8 } else { "" }
  $remoteCoopGuideText = if (Test-Path "src\product-ui\remoteCoopGuide.ts") { Get-Content "src\product-ui\remoteCoopGuide.ts" -Raw -Encoding UTF8 } else { "" }
  $adapterSubmitText = if (Test-Path "src\product-ui\adapterRegistrySubmit.ts") { Get-Content "src\product-ui\adapterRegistrySubmit.ts" -Raw -Encoding UTF8 } else { "" }
  $adapterAuditText = if (Test-Path "src\product-ui\adapterPublishAudit.ts") { Get-Content "src\product-ui\adapterPublishAudit.ts" -Raw -Encoding UTF8 } else { "" }
  $adapterQualityText = if (Test-Path "src\product-ui\adapterQualityScore.ts") { Get-Content "src\product-ui\adapterQualityScore.ts" -Raw -Encoding UTF8 } else { "" }
  $adapterContributionText = if (Test-Path "src\product-ui\adapterContribution.ts") { Get-Content "src\product-ui\adapterContribution.ts" -Raw -Encoding UTF8 } else { "" }
  $adapterRegistryClosureAuditText = if (Test-Path "src\product-ui\adapterRegistryClosureAudit.ts") { Get-Content "src\product-ui\adapterRegistryClosureAudit.ts" -Raw -Encoding UTF8 } else { "" }
  $connectionMethodClosureAuditText = if (Test-Path "src\product-ui\connectionMethodClosureAudit.ts") { Get-Content "src\product-ui\connectionMethodClosureAudit.ts" -Raw -Encoding UTF8 } else { "" }
  $gameScanExplanationText = if (Test-Path "src\product-ui\gameScanRecommendationExplanation.ts") { Get-Content "src\product-ui\gameScanRecommendationExplanation.ts" -Raw -Encoding UTF8 } else { "" }
  $releaseReadinessText = if (Test-Path "docs\V0_1_RELEASE_READINESS.md") { Get-Content "docs\V0_1_RELEASE_READINESS.md" -Raw -Encoding UTF8 } else { "" }
  $releaseValidationLogText = if (Test-Path "docs\RELEASE_VALIDATION_LOG.md") { Get-Content "docs\RELEASE_VALIDATION_LOG.md" -Raw -Encoding UTF8 } else { "" }
  $githubReleaseDraftText = if (Test-Path "docs\GITHUB_RELEASE_DRAFT.md") { Get-Content "docs\GITHUB_RELEASE_DRAFT.md" -Raw -Encoding UTF8 } else { "" }
  $releaseNotesDraftText = if (Test-Path "docs\RELEASE_NOTES_DRAFT.md") { Get-Content "docs\RELEASE_NOTES_DRAFT.md" -Raw -Encoding UTF8 } else { "" }
  $realExeManualGuideText = if (Test-Path "docs\REAL_EXE_MANUAL_VALIDATION_GUIDE.md") { Get-Content "docs\REAL_EXE_MANUAL_VALIDATION_GUIDE.md" -Raw -Encoding UTF8 } else { "" }
  $releaseUploadChecklistText = if (Test-Path "docs\V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md") { Get-Content "docs\V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md" -Raw -Encoding UTF8 } else { "" }
  $userFeedbackTemplateText = if (Test-Path "docs\V0_1_USER_FEEDBACK_TEMPLATE.md") { Get-Content "docs\V0_1_USER_FEEDBACK_TEMPLATE.md" -Raw -Encoding UTF8 } else { "" }
  $goalCompletionAuditText = if (Test-Path "docs\GOAL_COMPLETION_AUDIT.md") { Get-Content "docs\GOAL_COMPLETION_AUDIT.md" -Raw -Encoding UTF8 } else { "" }
  $nextBigDirectionsText = if (Test-Path "docs\NEXT_BIG_DIRECTIONS.md") { Get-Content "docs\NEXT_BIG_DIRECTIONS.md" -Raw -Encoding UTF8 } else { "" }
  $realExeSmokeScriptText = if (Test-Path "tools\real_exe_smoke_test.ps1") { Get-Content "tools\real_exe_smoke_test.ps1" -Raw -Encoding UTF8 } else { "" }
  $cleanBuildScriptText = if (Test-Path "tools\build_tauri_release_clean.ps1") { Get-Content "tools\build_tauri_release_clean.ps1" -Raw -Encoding UTF8 } else { "" }
  $releasePackageScriptText = if (Test-Path "tools\prepare_v0_1_release_package.ps1") { Get-Content "tools\prepare_v0_1_release_package.ps1" -Raw -Encoding UTF8 } else { "" }
  $releasePackageVerifyScriptText = if (Test-Path "tools\verify_v0_1_release_package.ps1") { Get-Content "tools\verify_v0_1_release_package.ps1" -Raw -Encoding UTF8 } else { "" }
  $windowsZipScriptText = if (Test-Path "tools\prepare_windows_x64_zip.ps1") { Get-Content "tools\prepare_windows_x64_zip.ps1" -Raw -Encoding UTF8 } else { "" }
  $windowsZipVerifyScriptText = if (Test-Path "tools\verify_windows_x64_zip.ps1") { Get-Content "tools\verify_windows_x64_zip.ps1" -Raw -Encoding UTF8 } else { "" }
  $githubReleaseUpdateScriptText = if (Test-Path "tools\update_github_release_v0_1.ps1") { Get-Content "tools\update_github_release_v0_1.ps1" -Raw -Encoding UTF8 } else { "" }
  $releaseGateScriptText = if (Test-Path "tools\run_v0_1_release_gate.ps1") { Get-Content "tools\run_v0_1_release_gate.ps1" -Raw -Encoding UTF8 } else { "" }

  if ($releaseReadinessText -match "v0\.1" -and
      $releaseReadinessText -match "lan-helper\.exe" -and
      $releaseReadinessText -match "真实 EXE" -and
      $releaseReadinessText -match "PENDING" -and
      $releaseReadinessText -match "不宣传" -and
      $releaseReadinessText -match "所有游戏一键联机" -and
      $releaseReadinessText -match "GitHub Release" -and
      $releaseReadinessText -match "房主" -and
      $releaseReadinessText -match "好友" -and
      $releaseReadinessText -match "已知限制" -and
      $releaseValidationLogText -match "2026-06-05 v0\.1 发布准备自动化复测" -and
      $releaseValidationLogText -match "状态：PENDING" -and
      $releaseValidationLogText -match "自动化发布预检已通过；v0\.1 仍需要真实 EXE 人工验证记录后再发布" -and
      $githubReleaseDraftText -match "0\.1\.0 早期公开测试版" -and
      $githubReleaseDraftText -match "不是" -and
      $githubReleaseDraftText -match "所有游戏一键联机" -and
      $githubReleaseDraftText -match "房主" -and
      $githubReleaseDraftText -match "加入者" -and
      $releaseNotesDraftText -match "0\.1\.0" -and
      $releaseNotesDraftText -match "当前 5 个示例游戏" -and
      $releaseNotesDraftText -match "真实双机" -and
      $releaseNotesDraftText -match "不能替代真实双机" -and
      $nextBigDirectionsText -match "v0\.1 发布准备接入 preflight" -and
      $nextBigDirectionsText -match "真实 EXE 人工验证") {
    Pass-Check "v0.1 release readiness docs are wired"
  } else {
    Fail-Check "v0.1 release readiness docs are wired" "Release readiness docs must cover v0.1, lan-helper.exe, GitHub Release, host/friend flows, known limitations, no all-games-one-click overclaim, suggested follow-up validation, and the next direction order"
  }

  if ($releaseUploadChecklistText -match "v0\.1\.0" -and
      $releaseUploadChecklistText -match "lan-helper\.exe" -and
      $releaseUploadChecklistText -match "npm run tauri:build" -and
      $releaseUploadChecklistText -match "real_exe_smoke_test\.ps1" -and
      $releaseUploadChecklistText -match "release:preflight" -and
      $releaseUploadChecklistText -match "release:package" -and
      $releaseUploadChecklistText -match "release:zip" -and
      $releaseUploadChecklistText -match "release-artifacts\\v0\.1\.0" -and
      $releaseUploadChecklistText -match "LanHelper-v0\.1\.0-windows-x64\.zip" -and
      $releaseUploadChecklistText -match "SHA256SUMS\.txt" -and
      $releaseUploadChecklistText -match "release-manifest\.json" -and
      $releaseUploadChecklistText -match "REAL_EXE_MANUAL_VALIDATION_GUIDE\.md" -and
      $releaseUploadChecklistText -match "建议补测" -and
      $releaseUploadChecklistText -match "所有游戏一键联机" -and
      $releaseUploadChecklistText -match "V0_1_USER_FEEDBACK_TEMPLATE\.md" -and
      $userFeedbackTemplateText -match "游戏名称" -and
      $userFeedbackTemplateText -match "房主虚拟 IP" -and
      $userFeedbackTemplateText -match "加入者虚拟 IP" -and
      $userFeedbackTemplateText -match "ACK/PONG" -and
      $userFeedbackTemplateText -match "诊断报告" -and
      $userFeedbackTemplateText -match "本地同屏游戏不能真正变成 LAN" -and
      $githubReleaseDraftText -match "V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST" -and
      $githubReleaseDraftText -match "V0_1_USER_FEEDBACK_TEMPLATE") {
    Pass-Check "v0.1 github release upload checklist is wired"
  } else {
    Fail-Check "v0.1 github release upload checklist is wired" "GitHub Release upload checklist and feedback template must cover tag/title, lan-helper.exe, tauri build, smoke test, preflight, suggested follow-up validation boundaries, no all-games-one-click overclaim, and actionable tester feedback fields"
  }

  if ($realExeManualGuideText -match "真实 EXE 人工验证指南" -and
      $realExeManualGuideText -match "npm run adapter:validate" -and
      $realExeManualGuideText -match "tools\\real_exe_smoke_test\.ps1" -and
      $realExeManualGuideText -match "邀请包一键加入" -and
      $realExeManualGuideText -match "保存并启动 n2n" -and
      $realExeManualGuideText -match "房主虚拟 IP 和端口" -and
      $realExeManualGuideText -match "Terraria 服务端稳定" -and
      $realExeManualGuideText -match "Cuphead" -and
      $realExeManualGuideText -match "不能真正变成 LAN" -and
      $realExeManualGuideText -match "PASS / FAIL / PENDING" -and
      $realExeManualGuideText -match "RELEASE_VALIDATION_LOG\.md") {
    Pass-Check "real exe manual validation guide is wired"
  } else {
    Fail-Check "real exe manual validation guide is wired" "docs/REAL_EXE_MANUAL_VALIDATION_GUIDE.md must cover real EXE startup, invite one-click join, host room wizard, Terraria, adapter validation, non-LAN boundaries, diagnostics, and PASS/FAIL/PENDING logging"
  }

  if ($settingsStoreText -match "resolve_existing_open_path" -and
      $settingsStoreText -match "std::env::current_exe" -and
      $settingsStoreText -match "exe_path.parent" -and
      $settingsStoreText -match "cursor = dir.parent" -and
      $settingsStoreText -match "tried.join" -and
      $diagnosticsProductText -match "openPath\(REAL_EXE_MANUAL_VALIDATION_GUIDE_REPO_PATH\)" -and
      $diagnosticsProductText -match "openPath\(REAL_EXE_MANUAL_VALIDATION_GUIDE_PACKAGE_PATH\)") {
    Pass-Check "manual validation guide open path resolution is wired"
  } else {
    Fail-Check "manual validation guide open path resolution is wired" "open_path must resolve relative manual-guide paths from cwd and current_exe parent chain so docs/REAL_EXE_MANUAL_VALIDATION_GUIDE.md works from src-tauri/target/release and REAL_EXE_MANUAL_VALIDATION_GUIDE.md works from release-artifacts"
  }

  if ($packageJsonText -match "tauri:build:raw" -and
      $packageJsonText -match "build_tauri_release_clean\.ps1" -and
      $cleanBuildScriptText -match "--remap-path-prefix" -and
      $cleanBuildScriptText -match "RUSTFLAGS" -and
      $cleanBuildScriptText -match "sensitive local path" -and
      $cargoText -match "\[profile\.release\]" -and
      $cargoText -match "debug\s*=\s*0" -and
      $cargoText -match 'strip\s*=\s*"symbols"') {
    Pass-Check "clean release build strips local paths"
  } else {
    Fail-Check "clean release build strips local paths" "tauri:build must use tools/build_tauri_release_clean.ps1, Cargo release profile must strip symbols/debug info, and the build script must scan the EXE for local paths"
  }

  if ($packageJsonText -match "release:package" -and
      $packageJsonText -match "prepare_v0_1_release_package\.ps1" -and
      $releasePackageScriptText -match 'lan-helper-\$tag\.exe' -and
      $releasePackageScriptText -match "SHA256SUMS\.txt" -and
      $releasePackageScriptText -match "release-manifest\.json" -and
      $releasePackageScriptText -match "RELEASE_BODY\.md" -and
      $releasePackageScriptText -match "REAL_EXE_MANUAL_VALIDATION_GUIDE\.md" -and
      $releasePackageScriptText -match "V0_1_RELEASE_CONSISTENCY_AUDIT\.md" -and
      $releasePackageScriptText -match "V0_1_USER_FEEDBACK_TEMPLATE\.md" -and
      $releasePackageScriptText -match "adapter-registry" -and
      $releasePackageScriptText -match "AppendLog" -and
      $releasePackageScriptText -match "does not replace real dual-machine") {
    Pass-Check "v0.1 release package script is wired"
  } else {
    Fail-Check "v0.1 release package script is wired" "release:package must package lan-helper-v0.1.0.exe, release body/notes, feedback template, adapter registry, SHA256SUMS, manifest, and keep human-validation boundaries"
  }

  if ($packageJsonText -match "release:package:verify" -and
      $packageJsonText -match "verify_v0_1_release_package\.ps1" -and
      $releasePackageVerifyScriptText -match "SHA256SUMS\.txt" -and
      $releasePackageVerifyScriptText -match "release-manifest\.json" -and
      $releasePackageVerifyScriptText -match 'lan-helper-\$tag\.exe' -and
      $releasePackageVerifyScriptText -match "REAL_EXE_MANUAL_VALIDATION_GUIDE\.md" -and
      $releasePackageVerifyScriptText -match "V0_1_RELEASE_CONSISTENCY_AUDIT\.md" -and
      $releasePackageVerifyScriptText -match "adapter-registry/index\.json" -and
      $releasePackageVerifyScriptText -match "manifest file count mismatch" -and
      $releasePackageVerifyScriptText -match "runtime file leaked" -and
      $releasePackageVerifyScriptText -match "sensitive text" -and
      $releasePackageVerifyScriptText -match "does not replace real dual-machine") {
    Pass-Check "v0.1 release package verifier is wired"
  } else {
    Fail-Check "v0.1 release package verifier is wired" "release:package:verify must validate release-artifacts/v0.1.0 files, SHA256SUMS, manifest, manual guide, release body boundaries, and adapter registry without claiming to replace manual validation"
  }

  $zipChecks = [ordered]@{
    "package.json release:zip" = ($packageJsonText -match "release:zip")
    "package.json prepare zip script" = ($packageJsonText -match "prepare_windows_x64_zip\.ps1")
    "package.json verify zip script" = ($packageJsonText -match "verify_windows_x64_zip\.ps1")
    "zip package name" = ($windowsZipScriptText -match 'LanHelper-v\$Version-windows-x64')
    "zip includes edge" = ($windowsZipScriptText -match "edge\.exe")
    "zip writes readme" = ($windowsZipScriptText -match "README_")
    "zip excludes last_config" = ($windowsZipScriptText -match "last_config\.json")
    "zip compresses archive" = ($windowsZipScriptText -match "Compress-Archive")
    "zip verifier rejects runtime files" = ($windowsZipVerifyScriptText -match "runtime file leaked")
    "zip verifier checks sha" = ($windowsZipVerifyScriptText -match "SHA mismatch")
  }
  $failedZipChecks = @($zipChecks.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key })
  if ($failedZipChecks.Count -eq 0) {
    Pass-Check "Windows x64 ZIP package is reproducible"
  } else {
    Fail-Check "Windows x64 ZIP package is reproducible" ("missing: " + ($failedZipChecks -join ", "))
  }

  if ($packageJsonText -match "release:github:update" -and
      $githubReleaseUpdateScriptText -match "GITHUB_TOKEN" -and
      $githubReleaseUpdateScriptText -match "releases/tags" -and
      $githubReleaseUpdateScriptText -match "releases/assets" -and
      $githubReleaseUpdateScriptText -match "uploads\.github\.com" -and
      $githubReleaseUpdateScriptText -match "Remote digest mismatch") {
    Pass-Check "GitHub release asset updater is wired"
  } else {
    Fail-Check "GitHub release asset updater is wired" "release:github:update must use a token-backed GitHub REST flow to update body, replace the ZIP asset, and verify remote digest"
  }

  if ($packageJsonText -match "release:gate" -and
      $packageJsonText -match "run_v0_1_release_gate\.ps1" -and
      $releaseGateScriptText -match "npm run build" -and
      $releaseGateScriptText -match "cargo check" -and
      $releaseGateScriptText -match "npm run adapter:validate" -and
      $releaseGateScriptText -match "npm run tauri:build" -and
      $releaseGateScriptText -match "real_exe_smoke_test\.ps1" -and
      $releaseGateScriptText -match "npm run release:package" -and
      $releaseGateScriptText -match "npm run release:package:verify" -and
      $releaseGateScriptText -match "npm run release:zip" -and
      $releaseGateScriptText -match "npm run release:zip:verify" -and
      $releaseGateScriptText -match "npm run release:preflight" -and
      $releaseGateScriptText.Contains('``$($item.name)``') -and
      $releaseGateScriptText -match "real dual-machine n2n connectivity" -and
      $releaseGateScriptText -match "does not replace PASS / FAIL / PENDING manual validation") {
    Pass-Check "v0.1 automated release gate is wired"
  } else {
    Fail-Check "v0.1 automated release gate is wired" "release:gate must run build, cargo check, adapter validation, tauri build, real EXE smoke, package, package verifier, preflight, append a log summary, and keep manual validation boundaries"
  }

  if ($goalCompletionAuditText -match "当前长期目标完成证据审计" -and
      $goalCompletionAuditText -match "不调用 goal complete" -and
      $goalCompletionAuditText -match "邀请包一键加入闭环" -and
      $goalCompletionAuditText -match "房主开房向导闭环" -and
      $goalCompletionAuditText -match "游戏适配器与共享方案库增强" -and
      $goalCompletionAuditText -match "多联机方式支持" -and
      $goalCompletionAuditText -match "非局域网游戏转换方案引擎" -and
      $goalCompletionAuditText -match "诊断页问题修复中心" -and
      $goalCompletionAuditText -match "真实双机 n2n 互通" -and
      $goalCompletionAuditText -match "npm run release:preflight") {
    Pass-Check "current long-term goal audit is recorded"
  } else {
    Fail-Check "current long-term goal audit is recorded" "docs/GOAL_COMPLETION_AUDIT.md must record evidence for all six current goal areas and keep human dual-machine/game validation as PENDING instead of marking the goal complete"
  }

  if ($realExeSmokeScriptText -match "src-tauri\\target\\release\\lan-helper\.exe" -and
      $realExeSmokeScriptText -match "Start-Process" -and
      $realExeSmokeScriptText -match "msedgewebview2\.exe" -and
      $realExeSmokeScriptText -match "cmd\|conhost\|powershell\|pwsh\|edge\|n2n" -and
      $realExeSmokeScriptText -match "CloseMainWindow" -and
      $realExeSmokeScriptText -match "RELEASE_VALIDATION_LOG\.md" -and
      $realExeSmokeScriptText -match "不能替代 n2n ACK/PONG") {
    Pass-Check "real exe startup smoke script is wired"
  } else {
    Fail-Check "real exe startup smoke script is wired" "tools/real_exe_smoke_test.ps1 must launch lan-helper.exe, detect WebView readiness, flag console-like child processes, close the process safely, and optionally append to RELEASE_VALIDATION_LOG.md without claiming to replace manual n2n/Terraria validation"
  }

  if ($processUtilText -match "CREATE_NO_WINDOW" -and
      $processUtilText -match "creation_flags" -and
      $gameLauncherText -match "use crate::core::process_util::hide_console_window" -and
      $gameLauncherText -match "hide_console_window\(&mut command\)\.spawn\(\)") {
    Pass-Check "game launch console hiding is wired"
  } else {
    Fail-Check "game launch console hiding is wired" "Adapter/game launch commands must use hide_console_window before spawn so console-style helper/server executables do not create white command boxes in the release EXE"
  }

  if ($statusCenterText -match "ProductConnectionStage" -and
      $statusCenterText -match "not_configured" -and
      $statusCenterText -match "configured_not_started" -and
      $statusCenterText -match "starting" -and
      $statusCenterText -match "network_ready" -and
      $statusCenterText -match "server_missing" -and
      $statusCenterText -match "ready_to_invite" -and
      $statusCenterText -match "has_problem" -and
      $homeProductText -match "resolveProductStatusCenter" -and
      $headerProductText -match "resolveProductStatusCenter" -and
      $networkProductText -match "resolveProductStatusCenter" -and
      $recommendationProductText -match "resolveProductStatusCenter") {
    Pass-Check "Product status center covers core states"
  } else {
    Fail-Check "Product status center covers core states" "statusCenter.ts must define all product stages and Home/Header/Network/Recommendation must use resolveProductStatusCenter"
  }

  if ($productStateConsistencyAuditText -match "ProductStateConsistencyAuditItem" -and
      $productStateConsistencyAuditText -match "status-center-scenario-matrix" -and
      $productStateConsistencyAuditText -match "busy-priority" -and
      $productStateConsistencyAuditText -match "runtime-not-loaded" -and
      $productStateConsistencyAuditText -match "runtime-error-priority" -and
      $productStateConsistencyAuditText -match "server-required-before-invite" -and
      $productStateConsistencyAuditText -match "friend-slot-required-before-lan-invite" -and
      $productStateConsistencyAuditText -match "non-lan-route-guard" -and
      $productStateConsistencyAuditText -match "diagnostic-context-boundary" -and
      $productStateConsistencyAuditText -match "formatProductStateConsistencyAuditReport" -and
      $statusCenterText -match "friendSlotMissing" -and
      $diagnosticsProductText -match "buildProductStateConsistencyAudit" -and
      $diagnosticsProductText -match "data-product-state-consistency-audit=`"checklist`"" -and
      $diagnosticsProductText -match "copyProductStateConsistencyAudit" -and
      $diagnosticsProductText -match "复制状态一致性自检") {
    Pass-Check "product state consistency audit is wired"
  } else {
    Fail-Check "product state consistency audit is wired" "Diagnostics page must expose a copyable product state consistency audit covering busy priority, runtime loading, runtime errors, server gate, friend-IP gate, non-LAN route guard, diagnostic context boundaries, and shared status center adoption"
  }

  if ($busyOverlayText -match "ProductBusyOverlay" -and
      $busyOverlayText -match "data-product-busy-overlay=`"visible`"" -and
      $busyOverlayText -match "backdrop-blur" -and
      $busyOverlayText -match "delayMs" -and
      $busyOverlayText -match "请不要重复点击按钮" -and
      $gameProductText -match "ProductBusyOverlay" -and
      $networkProductText -match "ProductBusyOverlay" -and
      $recommendationProductText -match "ProductBusyOverlay" -and
      $advancedProductText -match "ProductBusyOverlay" -and
      $diagnosticsProductText -match "ProductBusyOverlay" -and
      $solutionsProductText -match "ProductBusyOverlay") {
    Pass-Check "product busy overlay is wired"
  } else {
    Fail-Check "product busy overlay is wired" "Main Product pages must use ProductBusyOverlay with real busy/loading state so long operations show a delayed blur overlay and discourage repeated clicks"
  }

  if ($productPageCacheText -match "readProductPageCache" -and
      $productPageCacheText -match "writeProductPageCache" -and
      $productPageCacheText -match "缓存只用于减少二次进入卡顿" -and
      $gameProductText -match "GAME_SCAN_CACHE_KEY" -and
      $gameProductText -match "initialCache" -and
      $gameProductText -match "data.games" -and
      $gameProductText -match "手动重扫以刷新缓存" -and
      $recommendationProductText -match "RECOMMENDATION_CACHE_KEY" -and
      $recommendationProductText -match "后台刷新推荐方案" -and
      $recommendationProductText -match "showBusy: false" -and
      $networkProductText -match "NETWORK_FORM_CACHE_KEY" -and
      $networkProductText -match "showBusy = !initialFormCache" -and
      $terrariaProductText -match "TERRARIA_FORM_CACHE_KEY" -and
      $terrariaProductText -match "再次进入会保留上次填写内容") {
    Pass-Check "product page cache and concise copy are wired"
  } else {
    Fail-Check "product page cache and concise copy are wired" "Game scan, Recommendation, Network, and Terraria pages must keep previous real results/form values on re-entry, refresh in the background where safe, and use concise player-facing copy instead of repeated blocking loads"
  }

  if ($realExeValidationChecklistText -match "RealExeValidationItem" -and
      $realExeValidationChecklistText -match "release-exe-entry" -and
      $realExeValidationChecklistText -match "startup-window-clean" -and
      $realExeValidationChecklistText -match "page-reentry-cache" -and
      $realExeValidationChecklistText -match "n2n-vps-ack-pong" -and
      $realExeValidationChecklistText -match "invite-one-click-join" -and
      $realExeValidationChecklistText -match "host-room-wizard" -and
      $realExeValidationChecklistText -match "terraria-30s-stability" -and
      $realExeValidationChecklistText -match "advanced-tools-self-test" -and
      $realExeValidationChecklistText -match "adapter-registry-sync" -and
      $realExeValidationChecklistText -match "non-lan-route-boundary" -and
      $realExeValidationChecklistText -match "diagnostic-repair-center" -and
      $realExeValidationChecklistText -match "game-internal-join" -and
      $realExeValidationChecklistText -match "REAL_EXE_VALIDATION_RESULTS_KEY" -and
      $realExeValidationChecklistText -match "REAL_EXE_RELEASE_CRITICAL_ITEM_IDS" -and
      $realExeValidationChecklistText -match "writeRealExeValidationManualResult" -and
      $realExeValidationChecklistText -match "summarizeRealExeManualValidationResults" -and
      $realExeValidationChecklistText -match "buildRealExeValidationPublishGate" -and
      $realExeValidationChecklistText -match "formatRealExeValidationChecklistReport" -and
      $realExeManualValidationGuideProductText -match "formatRealExeManualValidationGuideQuickCopy" -and
      $realExeManualValidationGuideProductText -match "REAL_EXE_MANUAL_VALIDATION_GUIDE_REPO_PATH" -and
      $realExeManualValidationGuideProductText -match "REAL_EXE_MANUAL_VALIDATION_GUIDE_PACKAGE_PATH" -and
      $realExeManualValidationGuideProductText -match "保存并启动 n2n" -and
      $realExeManualValidationGuideProductText -match "Cuphead" -and
      $diagnosticsProductText -match "buildRealExeValidationChecklist" -and
      $diagnosticsProductText -match "openRealExeManualValidationGuide" -and
      $diagnosticsProductText -match "copyRealExeManualValidationGuide" -and
      $diagnosticsProductText -match "data-real-exe-manual-validation-guide=`"open`"" -and
      $diagnosticsProductText -match "data-real-exe-manual-validation-guide=`"copy`"" -and
      $diagnosticsProductText -match "data-real-exe-validation-results=`"manual-recorder`"" -and
      $diagnosticsProductText -match "data-real-exe-publish-gate" -and
      $diagnosticsProductText -match "exportRealExeValidationChecklist" -and
      $diagnosticsProductText -match "markRealExeValidationResult" -and
      $diagnosticsProductText -match "clearRealExeValidationResults" -and
      $diagnosticsProductText -match "data-real-exe-validation-checklist=`"checklist`"" -and
      $diagnosticsProductText -match "copyRealExeValidationChecklist" -and
      $diagnosticsProductText -match "复制真实 EXE 验证清单") {
    Pass-Check "real exe validation checklist is wired"
  } else {
    Fail-Check "real exe validation checklist is wired" "Diagnostics page must expose a copyable real EXE validation checklist, manual validation guide entry, and PASS/FAIL/PENDING recorder covering startup cleanliness, page re-entry cache, n2n ACK/PONG, invite join, host wizard, Terraria stability, advanced tools, adapter sync, non-LAN boundaries, diagnostic repair, and game-internal join"
  }

  if ($invitePacketText -match "\[联机助手真实邀请包\]" -and
      $invitePacketText -match "parseLanInvitePacket" -and
      $invitePacketText -match "buildLanInvitePacket" -and
      $invitePacketText -match "validateLanInvitePacket" -and
      $invitePacketText -match "formatLanInviteMissingFields" -and
      $invitePacketText -match "房主虚拟 IP" -and
      $invitePacketText -match "好友预留 IP" -and
      $invitePacketText -match "游戏端口" -and
      $invitePacketText -match "房间密钥" -and
      $networkProductText -match "检测到其他玩家的邀请，是否进入" -and
      $networkProductText -match "parseLanInvitePacket" -and
      $networkProductText -match "validateLanInvitePacket" -and
      $networkProductText -match "invitePacketToNetworkConfig" -and
      $recommendationProductText -match "buildLanInvitePacket") {
    Pass-Check "invite packet paste flow is wired"
  } else {
    Fail-Check "invite packet paste flow is wired" "Network page must detect pasted invite packets and Recommendation page must build and validate the shared packet format including room key, host IP, friend IP, supernode, and game port"
  }

  if ($networkProductText -match "仅填入参数" -and
      $networkProductText -match "保存并启动 n2n" -and
      $networkProductText -match "startFromInvite" -and
      $networkProductText -match "saveReferenceN2nConfig" -and
      $networkProductText -match "startReferenceN2n" -and
      $networkProductText -match "inviteJoinResult" -and
      $networkProductText -match "已加入好友房间" -and
      $networkProductText -match "复制错误给房主" -and
      $networkProductText -match "邀请包不完整" -and
      $networkProductText -match "clearInviteDiagnosticContext" -and
      $networkProductText -match "classifyJoinFailure") {
    Pass-Check "invite one-click join flow is wired"
  } else {
    Fail-Check "invite one-click join flow is wired" "Network page must support fill-only, save-and-start n2n, join result cards, failure classification, and copy-error-to-host"
  }

  $startFromInviteIndex = $networkProductText.IndexOf("const startFromInvite")
  $startFromInviteValidationIndex = if ($startFromInviteIndex -ge 0) { $networkProductText.IndexOf("validateLanInvitePacket(packet)", $startFromInviteIndex) } else { -1 }
  $startFromInviteBusyIndex = if ($startFromInviteIndex -ge 0) { $networkProductText.IndexOf("setBusy('保存并启动邀请')", $startFromInviteIndex) } else { -1 }
  if ($startFromInviteIndex -ge 0 -and
      $startFromInviteValidationIndex -gt $startFromInviteIndex -and
      $startFromInviteBusyIndex -gt $startFromInviteValidationIndex -and
      $networkProductText -match "missing_fields=" -and
      $networkProductText -match "未启动 n2n") {
    Pass-Check "invite UI validates before starting n2n"
  } else {
    Fail-Check "invite UI validates before starting n2n" "Network page start-from-invite must validate packet completeness before showing joining/busy state or starting n2n"
  }

  $joinFlowValidationIndex = $inviteJoinFlowText.IndexOf("validateLanInvitePacket(packet)")
  $joinFlowSaveIndex = $inviteJoinFlowText.IndexOf("await saveReferenceN2nConfig(config)")
  $joinFlowStartIndex = $inviteJoinFlowText.IndexOf("await startReferenceN2n(config)")
  if ($joinFlowValidationIndex -ge 0 -and
      $joinFlowSaveIndex -gt $joinFlowValidationIndex -and
      $joinFlowStartIndex -gt $joinFlowValidationIndex -and
      $inviteJoinFlowText -match "missing_fields" -and
      $inviteJoinFlowText -match "formatLanInviteMissingFields") {
    Pass-Check "invite backend validates before save/start"
  } else {
    Fail-Check "invite backend validates before save/start" "joinFromInvitePacket must validate invite packet completeness before saving config or starting n2n"
  }

  if ($inviteDiagnosticContextText -match "INVITE_DIAGNOSTIC_CONTEXT_KEY" -and
      $inviteDiagnosticContextText -match "writeInviteDiagnosticContext" -and
      $inviteDiagnosticContextText -match "formatInviteDiagnosticContext" -and
      $networkProductText -match "buildInviteDiagnosticContext" -and
      $networkProductText -match "writeInviteDiagnosticContext" -and
      $networkProductText -match "带失败信息诊断" -and
      $diagnosticsProductText -match "readInviteDiagnosticContext" -and
      $diagnosticsProductText -match "targetFromInviteDiagnosticContext" -and
      $diagnosticsProductText -match "data-diagnostic-invite-failure-context=`"latest`"" -and
      $diagnosticsProductText -match "按邀请包生成诊断" -and
      $diagnosticsProductText -match "invite-failure-generate-diagnostic") {
    Pass-Check "invite failure diagnostic handoff is wired"
  } else {
    Fail-Check "invite failure diagnostic handoff is wired" "Invite join failures must persist packet/failure context, open diagnostics with that context, and let Diagnostics generate a targeted report from it"
  }

  if ($inviteDiagnosticContextText -match "invite_join_pending" -and
      $inviteDiagnosticContextText -match "pending_ack" -and
      $networkProductText -match "INVITE_PENDING_AUTO_RETEST_DELAY_MS" -and
      $networkProductText -match "scheduleInvitePendingAutoRetest" -and
      $networkProductText -match "自动复测 ACK/PONG" -and
      $networkProductText -match "data-invite-pending-auto-retest=`"status`"" -and
      $networkProductText -match "带等待信息诊断" -and
      $diagnosticsProductText -match "invite-pending-generate-diagnostic" -and
      $diagnosticsProductText -match "data-diagnostic-invite-join-context" -and
      $diagnosticsProductText -match "按等待状态生成诊断") {
    Pass-Check "invite pending auto retest is wired"
  } else {
    Fail-Check "invite pending auto retest is wired" "Pending invite joins must persist waiting-ACK context, auto refresh ACK/PONG once, and let Diagnostics generate a targeted report from pending state"
  }

  if ($inviteJoinSuccessText -match "INVITE_JOIN_SUCCESS_HISTORY_KEY" -and
      $inviteJoinSuccessText -match "buildInviteJoinSuccessRecord" -and
      $inviteJoinSuccessText -match "applyPortCheckToJoinSuccessRecord" -and
      $inviteJoinSuccessText -match "formatInviteJoinSuccessInstruction" -and
      $networkProductText -match "persistInviteJoinSuccess" -and
      $networkProductText -match "testInviteHostGamePort" -and
      $networkProductText -match "copyInviteGameConnectInstruction" -and
      $networkProductText -match "data-invite-joined-game-confirmation=`"latest`"" -and
      $networkProductText -match "检测房主游戏端口" -and
      $networkProductText -match "复制游戏内连接说明" -and
      $networkProductText -match "data-invite-join-success-history=`"recent`"") {
    Pass-Check "invite joined game confirmation is wired"
  } else {
    Fail-Check "invite joined game confirmation is wired" "Joined invite flow must record success, expose host game-port check, copy game connection instructions, and show recent join records"
  }

  if ($inviteJoinClosureAuditText -match "InviteJoinClosureAuditItem" -and
      $inviteJoinClosureAuditText -match "paste-detect-invite" -and
      $inviteJoinClosureAuditText -match "fill-only-parameters" -and
      $inviteJoinClosureAuditText -match "save-and-start-n2n" -and
      $inviteJoinClosureAuditText -match "failure-diagnostics-handoff" -and
      $inviteJoinClosureAuditText -match "pending-auto-retest" -and
      $inviteJoinClosureAuditText -match "success-game-instruction" -and
      $inviteJoinClosureAuditText -match "host-port-confirmation" -and
      $inviteJoinClosureAuditText -match "formatInviteJoinClosureAuditReport" -and
      $networkProductText -match "buildInviteJoinClosureAudit" -and
      $networkProductText -match "data-invite-join-closure-audit=`"checklist`"" -and
      $networkProductText -match "copyInviteClosureAudit" -and
      $networkProductText -match "复制自检") {
    Pass-Check "invite join closure audit is wired"
  } else {
    Fail-Check "invite join closure audit is wired" "Network page must expose a copyable audit checklist covering paste, fill-only, save/start, result cards, failed/pending/joined handling, diagnostics, copy error, port confirmation, and success history"
  }

  if ($recommendationProductText -match "房主开房向导" -and
      $recommendationProductText -match "hostSteps" -and
      $recommendationProductText -match "startHostNetwork" -and
      $recommendationProductText -match "launchHostEntity" -and
      $recommendationProductText -match "testHostGamePort" -and
      $recommendationProductText -match "ensureFriendSlot" -and
      $recommendationProductText -match "copyHostInvite" -and
      $recommendationProductText -match "lanInviteReady" -and
      $recommendationProductText -match "lanInviteBlockers" -and
      $recommendationProductText -match "暂不建议复制半成品邀请包" -and
      $recommendationProductText -match "startReferenceN2n" -and
      $recommendationProductText -match "startGameServerSession") {
    Pass-Check "host room wizard flow is wired"
  } else {
    Fail-Check "host room wizard flow is wired" "Recommendation page must expose a host wizard with game selection, n2n start, server/game launch, port test, friend allocation, and invite copy"
  }

  if ($recommendationProductText -match "const lanInvitePreview" -and
      $recommendationProductText -match "邀请包暂未生成完整正文" -and
      $recommendationProductText -match "避免好友复制半成品" -and
      $recommendationProductText -match "lanInviteReady\s*\?\s*lanInvite" -and
      $recommendationProductText -match "\{invitePreview\}") {
    Pass-Check "host invite preview hides incomplete packet"
  } else {
    Fail-Check "host invite preview hides incomplete packet" "Recommendation page must not render the full LAN invite packet preview until n2n, host port, and friend IP gates are ready"
  }

  if ($hostRoomClosureAuditText -match "HostRoomClosureAuditItem" -and
      $hostRoomClosureAuditText -match "select-game" -and
      $hostRoomClosureAuditText -match "recommendation-route" -and
      $hostRoomClosureAuditText -match "start-host-network" -and
      $hostRoomClosureAuditText -match "launch-host-entity" -and
      $hostRoomClosureAuditText -match "test-host-port" -and
      $hostRoomClosureAuditText -match "advanced-tools-route" -and
      $hostRoomClosureAuditText -match "friend-allocation" -and
      $hostRoomClosureAuditText -match "friend-connectivity-check" -and
      $hostRoomClosureAuditText -match "generate-invite-packet" -and
      $hostRoomClosureAuditText -match "copy-host-invite" -and
      $hostRoomClosureAuditText -match "non-lan-route-guard" -and
      $hostRoomClosureAuditText -match "formatHostRoomClosureAuditReport" -and
      $recommendationProductText -match "buildHostRoomClosureAudit" -and
      $recommendationProductText -match "data-host-room-closure-audit=`"checklist`"" -and
      $recommendationProductText -match "copyHostClosureAudit" -and
      $recommendationProductText -match "复制房主自检") {
    Pass-Check "host room closure audit is wired"
  } else {
    Fail-Check "host room closure audit is wired" "Recommendation page must expose a copyable audit checklist covering game selection, route recommendation, host n2n start, auto n2n state, server/game launch, host port test, advanced tools, friend allocation/check, invite copy, and non-LAN guardrails"
  }

  if ($hostDiagnosticContextText -match "HOST_DIAGNOSTIC_CONTEXT_KEY" -and
      $hostDiagnosticContextText -match "writeHostDiagnosticContext" -and
      $hostDiagnosticContextText -match "targetFromHostDiagnosticContext" -and
      $hostDiagnosticContextText -match "formatHostDiagnosticContext" -and
      $hostDiagnosticContextText -match "host_network_failure" -and
      $hostDiagnosticContextText -match "host_server_failure" -and
      $hostDiagnosticContextText -match "host_port_failure" -and
      $hostDiagnosticContextText -match "host_advanced_tools_needed" -and
      $hostDiagnosticContextText -match "host_friend_check_failure" -and
      $recommendationProductText -match "buildHostDiagnosticContext" -and
      $recommendationProductText -match "writeHostDiagnosticContext" -and
      $recommendationProductText -match "openAdvancedToolsForHost" -and
      $recommendationProductText -match "data-host-diagnostic-context=`"latest`"" -and
      $recommendationProductText -match "带失败信息诊断" -and
      $diagnosticsProductText -match "readHostDiagnosticContext" -and
      $diagnosticsProductText -match "data-diagnostic-host-failure-context=`"latest`"" -and
      $diagnosticsProductText -match "runHostFailureDiagnostic" -and
      $diagnosticsProductText -match "openAdvancedToolsWithHostContext" -and
      $diagnosticsProductText -match "host-failure-generate-diagnostic" -and
      $diagnosticsProductText -match "host-failure-open-advanced-tools") {
    Pass-Check "host failure diagnostic handoff is wired"
  } else {
    Fail-Check "host failure diagnostic handoff is wired" "Host wizard failures must persist game/route/supernode/port/server/friend context, show it on Recommendation and Diagnostics, generate targeted diagnostics, and prefill Advanced Tools when the route requires proxy or UDP broadcast bridge"
  }

  if ($adapterRouteText -match "buildAdapterRecommendationRoute" -and
      $adapterRouteText -match "udp_broadcast_bridge" -and
      $adapterRouteText -match "tcp_port_proxy" -and
      $adapterRouteText -match "remote_coop" -and
      $adapterRouteText -match "steam_p2p" -and
      $adapterRouteText -match "official_only" -and
      $recommendationProductText -match "adapterRoute" -and
      $recommendationProductText -match "自动套用 adapter" -and
      $recommendationProductText -match "advancedStep" -and
      $recommendationProductText -match "routeUsesLanInvite") {
    Pass-Check "recommendation auto-applies adapter route"
  } else {
    Fail-Check "recommendation auto-applies adapter route" "Recommendation page must map adapter network types to n2n, proxy/bridge, remote play, Steam, official-only, or review routes"
  }

  if ($connectionCatalogText -match "wireguard" -and
      $connectionCatalogText -match "zerotier" -and
      $connectionCatalogText -match "tailscale" -and
      $connectionCatalogText -match "steam_remote_play" -and
      $connectionCatalogText -match "sunshine_moonlight" -and
      $connectionCatalogText -match "steam_relay_plugin" -and
      $advancedProductText -match "多联机方式入口" -and
      $advancedProductText -match "connectionMethodCatalog" -and
      $recommendationProductText -match "methodsForAdapterRoute" -and
      $recommendationProductText -match "buildConnectionMethodGuide" -and
      $recommendationProductText -match "preferredKind" -and
      $recommendationProductText -match "method\.advancedToolKind" -and
      $recommendationProductText -match "kind: toolKind" -and
      $recommendationProductText -match "udp_port_proxy_required") {
    Pass-Check "multi connection method entries are exposed"
  } else {
    Fail-Check "multi connection method entries are exposed" "Advanced Tools and Recommendation must expose n2n, WireGuard, ZeroTier/Tailscale, proxy/bridge, Steam Remote Play, Sunshine/Moonlight, Steam Relay entries, and preserve clicked TCP/UDP/bridge tool type in advanced-tool prefill"
  }

  if ($capabilityMatrixText -match "ConnectionCapabilityDecisionRow" -and
      $capabilityMatrixText -match "connectionCapabilityMatrix" -and
      $capabilityMatrixText -match "buildConnectionCapabilityMatrixGuide" -and
      $capabilityMatrixText -match "原生 LAN / IP 直连" -and
      $capabilityMatrixText -match "局域网大厅发现" -and
      $capabilityMatrixText -match "只能本地同屏" -and
      $capabilityMatrixText -match "Steam 大厅 / Steam P2P" -and
      $capabilityMatrixText -match "官方服务器限定" -and
      $advancedProductText -match "联机方式能力矩阵 / 游戏类型决策表" -and
      $advancedProductText -match "copyDecisionMatrix" -and
      $advancedProductText -match "applyDecisionRow" -and
      $advancedProductText -match "data-connection-capability-matrix=`"decision-table`"") {
    Pass-Check "connection capability decision matrix is wired"
  } else {
    Fail-Check "connection capability decision matrix is wired" "Advanced Tools must expose a game-type decision table mapping LAN/IP, dedicated server, broadcast discovery, proxies, local co-op, Steam P2P, official-only, and review cases to connection methods"
  }

  if ($capabilityMatrixText -match "adapterDefaults" -and
      $capabilityMatrixText -match "buildAdapterEditorPresetFromDecision" -and
      $capabilityMatrixText -match "decisionRowForNetworkType" -and
      $solutionsProductText -match "connectionCapabilityMatrix" -and
      $solutionsProductText -match "applyCapabilityDecisionToEditor" -and
      $solutionsProductText -match "按游戏类型套用决策表" -and
      $solutionsProductText -match "data-adapter-editor-decision-matrix=`"preset`"" -and
      $solutionsProductText -match "network_type: preset\.network_type" -and
      $solutionsProductText -match "can_convert_to_lan: preset\.can_convert_to_lan") {
    Pass-Check "adapter editor uses capability decision matrix"
  } else {
    Fail-Check "adapter editor uses capability decision matrix" "Solutions adapter editor must apply the game-type decision table to network_type, conversion capability, notes, and review evidence"
  }

  if ($solutionsProductText -match "editorPreviewAdapter" -and
      $solutionsProductText -match "editorPreviewConfirmed" -and
      $solutionsProductText -match "editorPreviewDiffFields" -and
      $solutionsProductText -match "保存前真实预览" -and
      $solutionsProductText -match "data-adapter-save-preview=`"editor`"" -and
      $solutionsProductText -match "会生成 LAN 邀请包" -and
      $solutionsProductText -match "不会生成 LAN 邀请包" -and
      $solutionsProductText -match "buildLocalAdapterDiffFields" -and
      $solutionsProductText -match "请先查看保存前真实预览") {
    Pass-Check "adapter save preview confirmation is wired"
  } else {
    Fail-Check "adapter save preview confirmation is wired" "Solutions editor must preview generated adapter fields, LAN invite behavior, route flags, diff impact, and require confirmation before saving"
  }

  if ($solutionsProductText -match "SavedAdapterReview" -and
      $solutionsProductText -match "savedAdapterReviewQuality" -and
      $solutionsProductText -match "savedAdapterReviewAudit" -and
      $solutionsProductText -match "保存后自动复核" -and
      $solutionsProductText -match "data-adapter-post-save-review=`"summary`"" -and
      $solutionsProductText -match "一键生成共享库提交包" -and
      $solutionsProductText -match "copySavedAdapterReviewReport" -and
      $solutionsProductText -match "exportSavedAdapterSubmitPackage" -and
      $solutionsProductText -match "buildSavedAdapterReviewReport") {
    Pass-Check "adapter post-save review submit guidance is wired"
  } else {
    Fail-Check "adapter post-save review submit guidance is wired" "Saving a custom adapter must show quality score, publish audit, route impact, diff summary, copyable review report, and one-click submit package generation"
  }

  if ($gameTypesText -match "AdapterApplicabilityProfile" -and
      $gameTypesText -match "AdapterEvidenceProfile" -and
      $gameModelsText -match "AdapterApplicabilityProfile" -and
      $gameModelsText -match "AdapterEvidenceProfile" -and
      $solutionsProductText -match "data-adapter-structured-evidence=`"editor`"" -and
      $solutionsProductText -match "verification_status" -and
      $solutionsProductText -match "formatAdapterApplicability" -and
      $solutionsProductText -match "formatAdapterEvidence" -and
      $adapterQualityText -match "有结构化适用条件" -and
      $adapterAuditText -match "结构化验证证据" -and
      $adapterSubmitText -match "applicability 已填写" -and
      $adapterStoreText -match "format_applicability" -and
      $adapterStoreText -match "format_evidence") {
    Pass-Check "adapter structured applicability evidence is wired"
  } else {
    Fail-Check "adapter structured applicability evidence is wired" "Adapter schema, editor, quality score, publish audit, submit checklist, and backend diff must carry structured applicability/evidence fields"
  }

  if ($solutionsProductText -match "ReviewWorkbenchFilter" -and
      $solutionsProductText -match "adapterReviewWorkbenchItems" -and
      $solutionsProductText -match "reviewWorkbenchStats" -and
      $solutionsProductText -match "data-adapter-review-workbench=`"queue`"" -and
      $solutionsProductText -match "共享库审核工作台" -and
      $solutionsProductText -match "missing_evidence" -and
      $solutionsProductText -match "submit_ready" -and
      $solutionsProductText -match "copyReviewWorkbenchReport" -and
      $solutionsProductText -match "copyAdapterReviewOpinion" -and
      $solutionsProductText -match "复制当前筛选审核意见") {
    Pass-Check "adapter registry review workbench is wired"
  } else {
    Fail-Check "adapter registry review workbench is wired" "Solutions page must provide a review workbench with high-confidence/review/evidence/submit-ready filters, batch review report copy, and per-adapter review opinions"
  }

  if ($solutionsProductText -match "submitQueueGameIds" -and
      $solutionsProductText -match "submitQueueBatchText" -and
      $solutionsProductText -match "buildSubmitQueueBatch" -and
      $solutionsProductText -match "data-adapter-submit-queue=`"batch-export`"" -and
      $solutionsProductText -match "共享库提交队列" -and
      $solutionsProductText -match "加入全部可提交项" -and
      $solutionsProductText -match "批量生成提交说明" -and
      $solutionsProductText -match "批量导出 bundle JSON" -and
      $solutionsProductText -match "copySubmitQueueBatch") {
    Pass-Check "adapter submit queue batch export is wired"
  } else {
    Fail-Check "adapter submit queue batch export is wired" "Review workbench must support a submit queue with add/remove/clear, batch package generation, index entries, and copyable bundle JSON"
  }

  if ($solutionsProductText -match "SUBMIT_QUEUE_STORAGE_KEY" -and
      $solutionsProductText -match "readAdapterSubmitQueueSnapshot" -and
      $solutionsProductText -match "saveAdapterSubmitQueueSnapshot" -and
      $solutionsProductText -match "clearAdapterSubmitQueueSnapshot" -and
      $solutionsProductText -match "submitQueueRestoredAt" -and
      $solutionsProductText -match "已恢复上次队列" -and
      $solutionsProductText -match "清除本地队列记录" -and
      $solutionsProductText -match "data-adapter-submit-queue=`"batch-export`"") {
    Pass-Check "adapter submit queue persistence is wired"
  } else {
    Fail-Check "adapter submit queue persistence is wired" "Submit queue must persist game IDs and generated batch text to localStorage, restore them on page load, show the restored state, and provide a local-record clear action"
  }

  if ($adapterStoreText -match "AdapterRegistryLocalPublishResult" -and
      $adapterStoreText -match "publish_adapters_to_local_registry" -and
      $adapterStoreText -match "rebuild_local_adapter_registry_index" -and
      $adapterStoreText -match "verify_local_adapter_registry_index" -and
      $commandsText -match "publish_adapters_to_local_registry" -and
      $libText -match "commands::publish_adapters_to_local_registry" -and
      $tauriApiText -match "publishAdaptersToLocalRegistry" -and
      $solutionsProductText -match "publishSubmitQueueToLocalRegistry" -and
      $solutionsProductText -match "写入本地共享库示例" -and
      $solutionsProductText -match "data-adapter-local-registry-publish=`"result`"" -and
      $solutionsProductText -match "adapter-registry/index.json" -and
      $solutionsProductText -match "复制发布结果") {
    Pass-Check "adapter local registry publish helper is wired"
  } else {
    Fail-Check "adapter local registry publish helper is wired" "Submit queue must be able to write selected adapters into adapter-registry/games, rebuild and verify index.json, expose the Tauri command/API, and show/copy the local publish result"
  }

  if ($solutionsProductText -match "data-adapter-sync-source-guide=`"cards`"" -and
      $solutionsProductText -match "GitHub Pages 默认库" -and
      $solutionsProductText -match "VPS / 自建静态库" -and
      $solutionsProductText -match "本地示例库" -and
      $solutionsProductText -match "syncDefaultGithubRegistry" -and
      $solutionsProductText -match "syncCurrentRemoteRegistry" -and
      $solutionsProductText -match "activeRegistryKind" -and
      $solutionsProductText -match "syncPreviewDiffSummary" -and
      $solutionsProductText -match "syncResultAfterSummary" -and
      $solutionsProductText -match "data-adapter-sync-diff-summary=`"preflight`"" -and
      $solutionsProductText -match "data-adapter-sync-diff-summary=`"result`"") {
    Pass-Check "adapter registry sync source guide is wired"
  } else {
    Fail-Check "adapter registry sync source guide is wired" "Solutions sync UI must clearly separate GitHub Pages default, VPS/static registry, and local example flows, and show before/after sync diff summaries"
  }

  if ($adapterContributionText -match "AdapterContributionPackage" -and
      $adapterContributionText -match "lan-helper.adapter-contribution.v1" -and
      $adapterContributionText -match "buildAdapterContributionPackage" -and
      $adapterContributionText -match "parseAdapterContributionInput" -and
      $adapterContributionText -match "auditAdapterContributionPackage" -and
      $adapterContributionText -match "contributionPackageToForm" -and
      $adapterContributionText -match "contributionNetworkTypeOptions" -and
      $adapterContributionText -match "local_coop_remote_play" -and
      $adapterContributionText -match "udp_broadcast_needed" -and
      $solutionsProductText -match "contributionOpen" -and
      $solutionsProductText -match "data-adapter-user-contribution=`"wizard`"" -and
      $solutionsProductText -match "data-adapter-user-contribution=`"package`"" -and
      $solutionsProductText -match "生成用户贡献包" -and
      $solutionsProductText -match "复制贡献包" -and
      $solutionsProductText -match "转入管理员编辑器" -and
      $solutionsProductText -match "prefillContributionFromIntent" -and
      $solutionsProductText -match "contributionImportText" -and
      $solutionsProductText -match "parseContributionImport" -and
      $solutionsProductText -match "data-adapter-user-contribution=`"import-review`"" -and
      $solutionsProductText -match "data-adapter-user-contribution=`"review`"" -and
      $solutionsProductText -match "复制审核意见给用户" -and
      $solutionsProductText -match "要求补充证据" -and
      $solutionsProductText -match "转为 adapter 草稿" -and
      $solutionsProductText -match "CONTRIBUTION_REVIEW_QUEUE_STORAGE_KEY" -and
      $solutionsProductText -match "readContributionReviewQueue" -and
      $solutionsProductText -match "saveContributionReviewQueue" -and
      $solutionsProductText -match "ContributionReviewQueueStatus" -and
      $solutionsProductText -match "data-adapter-user-contribution=`"review-queue`"" -and
      $solutionsProductText -match "贡献包审核历史 / 本地待处理队列" -and
      $solutionsProductText -match "copyContributionQueueReport" -and
      $solutionsProductText -match "openContributionQueueItem" -and
      $solutionsProductText -match "updateContributionQueueStatus") {
    Pass-Check "adapter user contribution package is wired"
  } else {
    Fail-Check "adapter user contribution package is wired" "Solutions page must provide a non-JSON user contribution wizard, parse pasted contribution packages, show admin review/missing evidence, keep a local review queue/history, copy feedback, and hand accepted packages to the admin editor"
  }

  if ($solutionsProductText -match "pendingContributionDraftId" -and
      $solutionsProductText -match "sourceContributionId" -and
      $solutionsProductText -match "sourceContributionStatus" -and
      $solutionsProductText -match "来源：用户贡献包" -and
      $solutionsProductText -match "贡献包 → adapter 草稿 → 保存复核" -and
      $solutionsProductText -match "addSavedAdapterReviewToSubmitQueue" -and
      $solutionsProductText -match "addAdapterToSubmitQueue\(savedAdapterReview\.adapter\)" -and
      $solutionsProductText -match "加入共享库提交队列" -and
      $solutionsProductText -match "当前 adapter 暂不建议加入共享库提交队列" -and
      $solutionsProductText -match "contributionReviewQueueStatusLabel\(savedAdapterReview\.sourceContributionStatus") {
    Pass-Check "adapter contribution to submit queue handoff is wired"
  } else {
    Fail-Check "adapter contribution to submit queue handoff is wired" "Accepted contribution packages must keep source identity through adapter save review and provide a guarded one-click handoff into the shared-library submit queue"
  }

  if ($conversionAssessmentText -match "GameConversionAssessment" -and
      $conversionAssessmentText -match "buildGameConversionAssessment" -and
      $conversionAssessmentText -match "buildGameConversionAssessmentReport" -and
      $conversionAssessmentText -match "canBecomeLan" -and
      $conversionAssessmentText -match "Steam Remote Play Together" -and
      $conversionAssessmentText -match "Sunshine \+ Moonlight" -and
      $conversionAssessmentText -match "不要让好友连接虚拟 IP" -and
      $conversionAssessmentText -match "官方服限定不建议转换" -and
      $conversionAssessmentText -match "证据不足时不能把按钮做成" -and
      $recommendationProductText -match "data-non-lan-conversion-engine=`"assessment`"" -and
      $recommendationProductText -match "conversionAssessment" -and
      $recommendationProductText -match "copyConversionAssessment" -and
      $recommendationProductText -match "非 LAN 转换评估" -and
      $recommendationProductText -match "复制评估") {
    Pass-Check "non-LAN conversion assessment engine is wired"
  } else {
    Fail-Check "non-LAN conversion assessment engine is wired" "Recommendation page must expose a conversion assessment engine that distinguishes true LAN conversion, remote local-coop play, Steam P2P/plugin paths, official-only limits, and unknown review cases"
  }

  if ($adapterIntentText -match "conversion_assessment" -and
      $adapterIntentText -match "source: 'diagnostics' \| 'game_scan' \| 'recommendation' \| 'manual'" -and
      $adapterIntentText -match "admin_evidence" -and
      $adapterIntentText -match "assessment_report" -and
      $recommendationProductText -match "writeAdapterCreationIntent" -and
      $recommendationProductText -match "openSolutionsWithConversionAssessment" -and
      $recommendationProductText -match "data-conversion-assessment-handoff=`"solutions`"" -and
      $recommendationProductText -match "带评估去方案库" -and
      $solutionsProductText -match "adapterIntentIsConversionAssessment" -and
      $solutionsProductText -match "data-conversion-assessment-handoff=`"solutions-intent`"" -and
      $solutionsProductText -match "用评估生成贡献包" -and
      $solutionsProductText -match "用评估预填编辑器" -and
      $solutionsProductText -match "待补充证据") {
    Pass-Check "conversion assessment handoff to solutions is wired"
  } else {
    Fail-Check "conversion assessment handoff to solutions is wired" "Recommendation conversion assessments must be stored as an adapter creation intent and prefill the Solutions contribution/editor flow with evidence, steps, boundaries, and report context"
  }

  if ($conversionAssessmentSamplesText -match "conversionAssessmentValidationSamples" -and
      $conversionAssessmentSamplesText -match "validateConversionAssessmentSamples" -and
      $conversionAssessmentSamplesText -match "buildConversionAssessmentValidationReport" -and
      $conversionAssessmentSamplesText -match "cuphead-local-coop" -and
      $conversionAssessmentSamplesText -match "native-lan-ip-direct" -and
      $conversionAssessmentSamplesText -match "lan-and-local-coop-prioritizes-lan" -and
      $adapterRouteText -match "hasLanOrServerRoute" -and
      $conversionAssessmentSamplesText -match "dedicated-server-host" -and
      $conversionAssessmentSamplesText -match "udp-broadcast-discovery" -and
      $conversionAssessmentSamplesText -match "tcp-udp-port-proxy" -and
      $conversionAssessmentSamplesText -match "steam-p2p-lobby" -and
      $conversionAssessmentSamplesText -match "official-server-only" -and
      $conversionAssessmentSamplesText -match "unknown-needs-review" -and
      $conversionAssessmentSamplesText -match "canCreateLanInvite" -and
      $solutionsProductText -match "data-conversion-assessment-sample-validation=`"checklist`"" -and
      $solutionsProductText -match "copyConversionAssessmentValidationReport" -and
      $solutionsProductText -match "转换评估小样本验证" -and
      $solutionsProductText -match "复制验证清单") {
    Pass-Check "conversion assessment sample validation is wired"
  } else {
    Fail-Check "conversion assessment sample validation is wired" "Solutions page must expose sample conversion-assessment checks covering LAN/IP, dedicated server, UDP broadcast, port proxy, local co-op, Steam P2P, official-only, and unknown-review boundaries"
  }

  if ($conversionEngineClosureAuditText -match "ConversionEngineClosureAuditItem" -and
      $conversionEngineClosureAuditText -match "conversion-route-classifier-complete" -and
      $conversionEngineClosureAuditText -match "true-lan-invite-boundary" -and
      $conversionEngineClosureAuditText -match "native-lan-route" -and
      $conversionEngineClosureAuditText -match "dedicated-server-route" -and
      $conversionEngineClosureAuditText -match "udp-broadcast-route" -and
      $conversionEngineClosureAuditText -match "port-proxy-route" -and
      $conversionEngineClosureAuditText -match "local-coop-remote-play-boundary" -and
      $conversionEngineClosureAuditText -match "steam-p2p-plugin-boundary" -and
      $conversionEngineClosureAuditText -match "official-only-blocked" -and
      $conversionEngineClosureAuditText -match "unknown-review-handoff" -and
      $conversionEngineClosureAuditText -match "recommendation-assessment-handoff" -and
      $conversionEngineClosureAuditText -match "solutions-contribution-handoff" -and
      $conversionEngineClosureAuditText -match "diagnostic-route-correction" -and
      $conversionEngineClosureAuditText -match "copyable-conversion-reports" -and
      $conversionEngineClosureAuditText -match "formatConversionEngineClosureAuditReport" -and
      $solutionsProductText -match "buildConversionEngineClosureAudit" -and
      $solutionsProductText -match "data-conversion-engine-closure-audit=`"checklist`"" -and
      $solutionsProductText -match "copyConversionEngineClosureAudit" -and
      $solutionsProductText -match "复制转换引擎自检") {
    Pass-Check "conversion engine closure audit is wired"
  } else {
    Fail-Check "conversion engine closure audit is wired" "Solutions page must expose a copyable closure audit for the non-LAN conversion engine covering LAN, dedicated server, broadcast, port proxy, local co-op, Steam P2P, official-only, unknown review, recommendation handoff, solutions contribution, diagnostic correction, and copyable reports"
  }

  if ($diagnosticConversionAdviceText -match "buildDiagnosticConversionAdvice" -and
      $diagnosticConversionAdviceText -match "remote-coop-not-n2n" -and
      $diagnosticConversionAdviceText -match "steam-p2p-not-virtual-ip" -and
      $diagnosticConversionAdviceText -match "official-only-stop-conversion" -and
      $diagnosticConversionAdviceText -match "udp-broadcast-needs-bridge" -and
      $diagnosticConversionAdviceText -match "port-proxy-needed" -and
      $diagnosticConversionAdviceText -match "Steam Remote Play Together" -and
      $diagnosticsProductText -match "data-diagnostic-conversion-advice=`"route-correction`"" -and
      $diagnosticsProductText -match "diagnosticConversionAdvice" -and
      $diagnosticsProductText -match "copyDiagnosticConversionAdvice" -and
      $diagnosticsProductText -match "openSolutionsWithDiagnosticAssessment" -and
      $diagnosticsProductText -match "转换路线纠错" -and
      $diagnosticsProductText -match "带建议去方案库") {
    Pass-Check "diagnostic conversion route correction is wired"
  } else {
    Fail-Check "diagnostic conversion route correction is wired" "Diagnostics must use conversion assessment to correct wrong troubleshooting routes for local co-op, Steam P2P, official-only, UDP broadcast bridge, and port-proxy games"
  }

  if ($advancedToolIntentText -match "ADVANCED_TOOL_INTENT_KEY" -and
      $advancedToolIntentText -match "writeAdvancedToolIntent" -and
      $advancedToolIntentText -match "readAdvancedToolIntent" -and
      $advancedToolIntentText -match "clearAdvancedToolIntent" -and
      $advancedToolIntentText -match "udp_broadcast_bridge" -and
      $diagnosticsProductText -match "openAdvancedToolsWithDiagnosticIntent" -and
      $diagnosticsProductText -match "writeAdvancedToolIntent" -and
      $diagnosticsProductText -match "带参数去高级工具" -and
      $diagnosticsProductText -match "data-diagnostic-n2n-fixes-deprioritized=`"route-aware`"" -and
      $advancedProductText -match "data-advanced-tool-intent=`"diagnostic-prefill`"" -and
      $advancedProductText -match "readAdvancedToolIntent" -and
      $advancedProductText -match "applyAdvancedToolIntent" -and
      $advancedProductText -match "重新套用参数") {
    Pass-Check "diagnostic advanced-tool prefill is wired"
  } else {
    Fail-Check "diagnostic advanced-tool prefill is wired" "Diagnostics must prefill Advanced Tools for UDP broadcast bridge / port proxy routes and deprioritize n2n fixes when conversion assessment says n2n is the wrong route"
  }

  if ($advancedProductText -match "data-advanced-tool-risk-check=`"preflight`"" -and
      $advancedProductText -match "buildAdvancedToolRiskChecks" -and
      $advancedProductText -match "blockingRiskCount" -and
      $advancedProductText -match "启动后自动自测" -and
      $advancedProductText -match "appendDiagnosticFixHistoryFromAdvancedTool" -and
      $advancedProductText -match "DIAGNOSTIC_FIX_HISTORY_KEY" -and
      $advancedProductText -match "data-advanced-tool-self-test-recap=`"latest`"" -and
      $advancedProductText -match "copyAdvancedToolSelfTestRecap" -and
      $advancedProductText -match "复制自测复盘" -and
      $actionsText -match "target_port \?\? form\.listen_port") {
    Pass-Check "advanced tool risk self-test loop is wired"
  } else {
    Fail-Check "advanced tool risk self-test loop is wired" "Advanced Tools must show preflight parameter risks, use target_port for broadcast bridge targets, auto self-test after diagnostic-prefilled launch, record diagnostic history, and expose a copyable recap"
  }

  if ($advancedProductText -match "DIAGNOSTIC_FIX_HISTORY_UPDATED_EVENT" -and
      $advancedProductText -match "dispatchEvent" -and
      $diagnosticsProductText -match "FIX_HISTORY_UPDATED_EVENT" -and
      $diagnosticsProductText -match "isAdvancedToolHistoryEntry" -and
      $diagnosticsProductText -match "data-diagnostic-advanced-tool-self-test-history=`"latest`"" -and
      $diagnosticsProductText -match "复制高级工具复盘" -and
      $diagnosticsProductText -match "继续调整高级工具") {
    Pass-Check "advanced tool self-test history returns to diagnostics"
  } else {
    Fail-Check "advanced tool self-test history returns to diagnostics" "Diagnostics must refresh and display advanced tool self-test history written by Advanced Tools, with copy and continue-adjust actions"
  }

  if ($diagnosticsProductText -match "buildDiagnosticAutoNextStepDecision" -and
      $diagnosticsProductText -match "data-diagnostic-auto-next-step=`"decision`"" -and
      $diagnosticsProductText -match "runDiagnosticAutoNextStep" -and
      $diagnosticsProductText -match "最短修复路径" -and
      $diagnosticsProductText -match "generate_diagnostic" -and
      $diagnosticsProductText -match "open_advanced_tools" -and
      $diagnosticsProductText -match "run_fix_action" -and
      $diagnosticsProductText -match "preferredFixAction" -and
      $diagnosticsProductText -match "isFailedAdvancedToolHistoryEntry") {
    Pass-Check "diagnostic auto next-step decision is wired"
  } else {
    Fail-Check "diagnostic auto next-step decision is wired" "Diagnostics must synthesize report, conversion advice, advanced-tool history, and fix groups into one executable next-step button"
  }

  if ($remoteCoopGuideText -match "RemoteCoopChecklist" -and
      $remoteCoopGuideText -match "low_latency" -and
      $remoteCoopGuideText -match "steam_remote_play" -and
      $remoteCoopGuideText -match "sunshine_moonlight" -and
      $remoteCoopGuideText -match "buildRemoteCoopFriendGuide" -and
      $recommendationProductText -match "data-remote-coop-guide=`"steam-sunshine`"" -and
      $recommendationProductText -match "remoteCoopChecklist" -and
      $recommendationProductText -match "远程同屏说明已复制") {
    Pass-Check "remote coop guide is wired"
  } else {
    Fail-Check "remote coop guide is wired" "Recommendation page must expose Steam Remote Play / Sunshine guide with quality presets, input checklist, and copyable friend instructions"
  }

  if ($errorActionsText -match "classifyDiagnosticIssue" -and
      $errorActionsText -match "goto-network" -and
      $errorActionsText -match "copy-supernode-check" -and
      $errorActionsText -match "goto-terraria" -and
      $errorActionsText -match "goto-advanced" -and
      $diagnosticsProductText -match "classifyDiagnosticIssue" -and
      $diagnosticsProductText -match "onNavigateTab" -and
      $diagnosticsProductText -match "runFixAction") {
    Pass-Check "diagnostic issue fix actions are wired"
  } else {
    Fail-Check "diagnostic issue fix actions are wired" "Diagnostics page must classify issues and expose low-risk fix actions or navigation"
  }

  if ($errorActionsText -match "DiagnosticBackendFixOperation" -and
      $errorActionsText -match "detect_edge_path" -and
      $errorActionsText -match "start_n2n_last_config" -and
      $errorActionsText -match "restart_n2n_last_config" -and
      $errorActionsText -match "test_local_game_port" -and
      $errorActionsText -match "一键启动 n2n" -and
      $errorActionsText -match "一键检测本机端口" -and
      $errorActionsText -match "复制防火墙命令" -and
      $diagnosticsProductText -match "runBackendFix" -and
      $diagnosticsProductText -match "readReferenceN2nLastConfig" -and
      $diagnosticsProductText -match "startReferenceN2n" -and
      $diagnosticsProductText -match "testReferenceEdgePath" -and
      $diagnosticsProductText -match "testReferenceConnectivity" -and
      $diagnosticsProductText -match "data-diagnostic-one-click-fix-result=`"latest`"") {
    Pass-Check "diagnostic one-click backend fixes are wired"
  } else {
    Fail-Check "diagnostic one-click backend fixes are wired" "Diagnostics must offer backend-backed repair actions for edge detection, n2n start/restart, local port checks, and firewall command copy"
  }

  $manualCommandCoverageMarkerPresent =
    $diagnosticRepairCenterClosureAuditText -match "manualCommandCoverage" -or
    $diagnosticRepairCenterClosureAuditText -match "MANUAL_COMMAND_COVERAGE" -or
    $diagnosticRepairCenterClosureAuditText -match "manual-command-coverage" -or
    $diagnosticRepairCenterClosureAuditText -match "REQUIRED_ISSUE_ACTION_COVERAGE" -or
    $diagnosticRepairCenterClosureAuditText -match "missingManualActionCoverage"
  if ($errorActionsText -match "copy-n2n-manual-start" -and
      $errorActionsText -match "copy-ip-conflict-check" -and
      $errorActionsText -match "copy-game-port-proxy-check" -and
      $errorActionsText -match "copy-version-manual-check" -and
      $manualCommandCoverageMarkerPresent) {
    Pass-Check "diagnostic manual command coverage is guarded"
  } else {
    Fail-Check "diagnostic manual command coverage is guarded" "Diagnostic repair center must expose copyable manual commands for n2n start, IP/auth conflict, game port/proxy, and version mismatch, and audit them with a manualCommandCoverage matrix"
  }

  if ($diagnosticsProductText -match "DiagnosticFixRetestResult" -and
      $diagnosticsProductText -match "buildFixRetestResult" -and
      $diagnosticsProductText -match "autoRetestAfterFix" -and
      $diagnosticsProductText -match "generateAndStoreDiagnosticRecord" -and
      $diagnosticsProductText -match "等待自动复测" -and
      $diagnosticsProductText -match "自动复测诊断" -and
      $diagnosticsProductText -match "修复后自动复测" -and
      $diagnosticsProductText -match "修复前" -and
      $diagnosticsProductText -match "data-diagnostic-auto-retest=`"summary`"" -and
      $diagnosticsProductText -match "resolvedIssueIds" -and
      $diagnosticsProductText -match "remainingIssueIds") {
    Pass-Check "diagnostic auto retest after fix is wired"
  } else {
    Fail-Check "diagnostic auto retest after fix is wired" "One-click diagnostic fixes must wait, regenerate diagnostics, and show before/after issue counts and resolved/remaining/new issue IDs"
  }

  if ($diagnosticsProductText -match "DiagnosticFixHistoryEntry" -and
      $diagnosticsProductText -match "FIX_HISTORY_KEY" -and
      $diagnosticsProductText -match "readFixHistory" -and
      $diagnosticsProductText -match "saveFixHistory" -and
      $diagnosticsProductText -match "formatFixHistoryEntry" -and
      $diagnosticsProductText -match "copyFixHistoryEntry" -and
      $diagnosticsProductText -match "copyAllFixHistory" -and
      $diagnosticsProductText -match "诊断修复历史" -and
      $diagnosticsProductText -match "复制复盘" -and
      $diagnosticsProductText -match "data-diagnostic-fix-history=`"timeline`"") {
    Pass-Check "diagnostic fix history recap is wired"
  } else {
    Fail-Check "diagnostic fix history recap is wired" "Diagnostic auto retests must be saved as recent history and expose copyable recap text for friends/admins"
  }

  if ($diagnosticRepairCenterClosureAuditText -match "DiagnosticRepairCenterClosureAuditItem" -and
      $diagnosticRepairCenterClosureAuditText -match "issue-classification-complete" -and
      $diagnosticRepairCenterClosureAuditText -match "backend-one-click-fixes" -and
      $diagnosticRepairCenterClosureAuditText -match "manual-copy-commands" -and
      $diagnosticRepairCenterClosureAuditText -match "grouped-fix-center-ui" -and
      $diagnosticRepairCenterClosureAuditText -match "auto-retest-after-fix" -and
      $diagnosticRepairCenterClosureAuditText -match "fix-history-recap" -and
      $diagnosticRepairCenterClosureAuditText -match "invite-failure-handoff" -and
      $diagnosticRepairCenterClosureAuditText -match "host-failure-handoff" -and
      $diagnosticRepairCenterClosureAuditText -match "conversion-route-correction" -and
      $diagnosticRepairCenterClosureAuditText -match "advanced-tool-prefill-history" -and
      $diagnosticRepairCenterClosureAuditText -match "auto-next-step-decision" -and
      $diagnosticRepairCenterClosureAuditText -match "route-aware-n2n-deprioritized" -and
      $diagnosticRepairCenterClosureAuditText -match "version-mismatch-guide" -and
      $diagnosticRepairCenterClosureAuditText -match "copyable-diagnostic-report" -and
      $diagnosticRepairCenterClosureAuditText -match "formatDiagnosticRepairCenterClosureAuditReport" -and
      $errorActionsText -match "version_mismatch" -and
      $errorActionsText -match "复制版本手动核对清单" -and
      $diagnosticsProductText -match "DIAGNOSTIC_REPAIR_SUPPORTED_ISSUE_TYPES" -and
      $diagnosticsProductText -match "DIAGNOSTIC_REPAIR_BACKEND_OPERATIONS" -and
      $diagnosticsProductText -match "buildDiagnosticRepairCenterClosureAudit" -and
      $diagnosticsProductText -match "data-diagnostic-repair-center-closure-audit=`"checklist`"" -and
      $diagnosticsProductText -match "copyDiagnosticRepairCenterClosureAudit" -and
      $diagnosticsProductText -match "复制诊断修复自检") {
    Pass-Check "diagnostic repair center closure audit is wired"
  } else {
    Fail-Check "diagnostic repair center closure audit is wired" "Diagnostics page must expose a copyable closure audit covering issue classification, backend one-click fixes, manual commands, grouped repair UI, auto retest, repair history, invite/host handoff, conversion correction, advanced-tool history, auto next step, route-aware n2n deprioritization, version mismatch, and copyable reports"
  }

  if ($adapterIntentText -match "ADAPTER_CREATION_INTENT_KEY" -and
      $diagnosticsProductText -match "writeAdapterCreationIntent" -and
      $diagnosticsProductText -match "selected_game_adapter_missing" -and
      $solutionsProductText -match "readAdapterCreationIntent" -and
      $solutionsProductText -match "诊断建议创建适配器" -and
      $solutionsProductText -match "editorFromIntent" -and
      $solutionsProductText -match "同步共享库查找") {
    Pass-Check "adapter missing diagnostic opens creation flow"
  } else {
    Fail-Check "adapter missing diagnostic opens creation flow" "Diagnostics must pass missing-adapter intent to Solutions, and Solutions must prefill a reviewed adapter draft"
  }

  if ($adapterSubmitText -match "buildAdapterRegistrySubmitPackage" -and
      $adapterSubmitText -match "sha256Hex" -and
      $adapterSubmitText -match "canonicalizeRegistryAdapter" -and
      $adapterSubmitText -match "delete adapter\.adapter_source" -and
      $adapterSubmitText -match "adapter_version" -and
      $adapterSubmitText -match "indexEntryJson" -and
      $adapterSubmitText -match "GitHub Pages" -and
      $adapterSubmitText -match "VPS" -and
      $solutionsProductText -match "data-adapter-submit-wizard=`"registry-package`"" -and
      $solutionsProductText -match "生成提交包" -and
      $solutionsProductText -match "复制完整提交说明" -and
      $solutionsProductText -match "提交前审核清单") {
    Pass-Check "adapter registry submit package is wired"
  } else {
    Fail-Check "adapter registry submit package is wired" "Solutions page must generate canonical adapter JSON without runtime adapter_source, sha256, index.json snippet, and GitHub/VPS submit guide"
  }

  if ($adapterAuditText -match "auditAdapterForPublish" -and
      $adapterAuditText -match "summarizePublishAudits" -and
      $adapterAuditText -match "publish_ready" -and
      $adapterAuditText -match "needs_review" -and
      $adapterAuditText -match "incomplete" -and
      $adapterAuditText -match "registry_synced" -and
      $solutionsProductText -match "publishAuditSummary" -and
      $solutionsProductText -match "共享库发布审核状态" -and
      $solutionsProductText -match "可提交" -and
      $solutionsProductText -match "需复核" -and
      $solutionsProductText -match "草稿不完整" -and
      $solutionsProductText -match "已在共享库" -and
      $solutionsProductText -match "audit\.missing" -and
      $solutionsProductText -match "audit\.warnings" -and
      $solutionsProductText -match "audit\.review" -and
      $solutionsProductText -match "data-adapter-publish-audit=`"summary`"") {
    Pass-Check "adapter publish audit status is wired"
  } else {
    Fail-Check "adapter publish audit status is wired" "Solutions page must expose adapter publish audit summary, card badges, missing fields, warnings, review items, and synced/submit states"
  }

  if ($adapterStoreText -match "AdapterConflictReport" -and
      $adapterStoreText -match "list_adapter_conflicts" -and
      $adapterStoreText -match "promote_registry_adapter_to_custom" -and
      $adapterStoreText -match "pin_active_adapter_as_custom" -and
      $adapterStoreText -match "custom > registry > builtin" -and
      $tauriApiText -match "listAdapterConflicts" -and
      $tauriApiText -match "promoteRegistryAdapterToCustom" -and
      $tauriApiText -match "pinActiveAdapterAsCustom" -and
      $solutionsProductText -match "适配器版本与冲突处理" -and
      $solutionsProductText -match "data-adapter-version-conflicts=`"summary`"" -and
      $solutionsProductText -match "版本冲突" -and
      $solutionsProductText -match "导出当前备份" -and
      $solutionsProductText -match "保留当前为自建" -and
      $solutionsProductText -match "用共享库覆盖" -and
      $solutionsProductText -match "复制冲突报告") {
    Pass-Check "adapter version conflict workflow is wired"
  } else {
    Fail-Check "adapter version conflict workflow is wired" "Backend and Solutions page must list source variants, detect custom/registry/builtin conflicts, and expose backup/keep/overwrite actions"
  }

  if ($adapterStoreText -match "AdapterRegistrySyncPreview" -and
      $adapterStoreText -match "preview_adapter_registry_sync" -and
      $adapterStoreText -match "custom_conflict" -and
      $adapterStoreText -match "would_affect_active" -and
      $tauriApiText -match "previewAdapterRegistrySync" -and
      $tauriApiText -match "AdapterRegistrySyncPreview" -and
      $solutionsProductText -match "同步前预检共享库" -and
      $solutionsProductText -match "共享库同步前预检" -and
      $solutionsProductText -match "确认同步共享库" -and
      $solutionsProductText -match "复制预检报告" -and
      $solutionsProductText -match "data-adapter-sync-preflight=`"preview`"" -and
      $solutionsProductText -match "syncPreviewRequiresConfirm" -and
      $solutionsProductText -match "previewAdapterRegistrySync") {
    Pass-Check "adapter registry sync preflight is wired"
  } else {
    Fail-Check "adapter registry sync preflight is wired" "Remote registry sync must preview create/update/conflict/skipped effects before writing and require confirmation for risky changes"
  }

  if ($adapterStoreText -match "AdapterBackupEntry" -and
      $adapterStoreText -match "backup_existing_adapter_if_changed" -and
      $adapterStoreText -match "backup_existing_adapter_file" -and
      $adapterStoreText -match "list_adapter_backups" -and
      $adapterStoreText -match "restore_adapter_backup" -and
      $adapterStoreText -match "backups.+adapters" -and
      $tauriApiText -match "listAdapterBackups" -and
      $tauriApiText -match "restoreAdapterBackup" -and
      $solutionsProductText -match "适配器变更历史 / 备份恢复" -and
      $solutionsProductText -match "data-adapter-backup-history=`"restore`"" -and
      $solutionsProductText -match "刷新备份历史" -and
      $solutionsProductText -match "恢复此备份" -and
      $solutionsProductText -match "复制备份记录") {
    Pass-Check "adapter backup restore workflow is wired"
  } else {
    Fail-Check "adapter backup restore workflow is wired" "Adapter writes must create backups under backups/adapters and Solutions page must list/copy/restore them"
  }

  if ($adapterStoreText -match "AdapterChangeDiffField" -and
      $adapterStoreText -match "adapter_change_diff_fields" -and
      $adapterStoreText -match "diff_fields" -and
      $adapterStoreText -match "conversion_methods" -and
      $adapterStoreText -match "route_flags" -and
      $tauriApiText -match "AdapterChangeDiffField" -and
      $tauriApiText -match "diff_fields" -and
      $solutionsProductText -match "adapter 变更差异查看" -and
      $solutionsProductText -match "data-adapter-change-diff=`"panel`"" -and
      $solutionsProductText -match "查看差异" -and
      $solutionsProductText -match "影响推荐路线" -and
      $solutionsProductText -match "复制差异报告" -and
      $solutionsProductText -match "buildLocalAdapterDiffFields") {
    Pass-Check "adapter change diff viewer is wired"
  } else {
    Fail-Check "adapter change diff viewer is wired" "Import/sync flows must expose field-level adapter diffs for network_type, ports, conversion methods, route flags, and recommendation impact"
  }

  if ($adapterQualityText -match "AdapterQualityScore" -and
      $adapterQualityText -match "buildAdapterQualityScore" -and
      $adapterQualityText -match "summarizeAdapterQuality" -and
      $adapterQualityText -match "高可信" -and
      $adapterQualityText -match "中可信" -and
      $adapterQualityText -match "低可信" -and
      $adapterQualityText -match "canUseDirectly" -and
      $solutionsProductText -match "adapterQualitySummary" -and
      $solutionsProductText -match "推荐可信度" -and
      $solutionsProductText -match "data-adapter-quality-confidence=`"summary`"" -and
      $recommendationProductText -match "qualityScore" -and
      $recommendationProductText -match "可信度" -and
      $recommendationProductText -match "去方案库复核" -and
      $recommendationProductText -match "data-adapter-quality-confidence=`"recommendation`"") {
    Pass-Check "adapter quality confidence is wired"
  } else {
    Fail-Check "adapter quality confidence is wired" "Solutions and Recommendation pages must show adapter confidence levels, direct-use guidance, strengths, risks, and missing fields"
  }

  if ($adapterRegistryClosureAuditText -match "AdapterRegistryClosureAuditItem" -and
      $adapterRegistryClosureAuditText -match "game-scan-to-adapter-match" -and
      $adapterRegistryClosureAuditText -match "capability-decision-matrix" -and
      $adapterRegistryClosureAuditText -match "admin-create-adapter" -and
      $adapterRegistryClosureAuditText -match "user-contribution-package" -and
      $adapterRegistryClosureAuditText -match "contribution-to-admin-review" -and
      $adapterRegistryClosureAuditText -match "local-adapter-library" -and
      $adapterRegistryClosureAuditText -match "remote-registry-sync" -and
      $adapterRegistryClosureAuditText -match "registry-version-source" -and
      $adapterRegistryClosureAuditText -match "quality-and-publish-audit" -and
      $adapterRegistryClosureAuditText -match "version-conflict-workflow" -and
      $adapterRegistryClosureAuditText -match "backup-restore-workflow" -and
      $adapterRegistryClosureAuditText -match "change-diff-summary" -and
      $adapterRegistryClosureAuditText -match "registry-submit-package" -and
      $adapterRegistryClosureAuditText -match "conversion-sample-validation" -and
      $adapterRegistryClosureAuditText -match "formatAdapterRegistryClosureAuditReport" -and
      $solutionsProductText -match "buildAdapterRegistryClosureAudit" -and
      $solutionsProductText -match "data-adapter-registry-closure-audit=`"checklist`"" -and
      $solutionsProductText -match "copyAdapterRegistryClosureAudit" -and
      $solutionsProductText -match "复制共享库自检") {
    Pass-Check "adapter registry closure audit is wired"
  } else {
    Fail-Check "adapter registry closure audit is wired" "Solutions page must expose a copyable closure audit covering scan-to-adapter matching, capability decisions, admin creation, user contribution, local/remote registry sync, version/source/applicability, quality/publish audit, conflicts, backups, diffs, submit packages, and conversion sample validation"
  }

  if ($connectionMethodClosureAuditText -match "ConnectionMethodClosureAuditItem" -and
      $connectionMethodClosureAuditText -match "method-catalog-complete" -and
      $connectionMethodClosureAuditText -match "method-status-boundary" -and
      $connectionMethodClosureAuditText -match "capability-decision-matrix" -and
      $connectionMethodClosureAuditText -match "recommendation-method-handoff" -and
      $connectionMethodClosureAuditText -match "advanced-tools-real-backend" -and
      $connectionMethodClosureAuditText -match "advanced-tool-risk-self-test" -and
      $connectionMethodClosureAuditText -match "diagnostic-prefill-handoff" -and
      $connectionMethodClosureAuditText -match "remote-coop-route" -and
      $connectionMethodClosureAuditText -match "steam-p2p-plugin-reserved" -and
      $connectionMethodClosureAuditText -match "external-vpn-guides" -and
      $connectionMethodClosureAuditText -match "route-aware-diagnostics" -and
      $connectionMethodClosureAuditText -match "copyable-method-guides" -and
      $connectionMethodClosureAuditText -match "formatConnectionMethodClosureAuditReport" -and
      $advancedProductText -match "buildConnectionMethodClosureAudit" -and
      $advancedProductText -match "data-connection-method-closure-audit=`"checklist`"" -and
      $advancedProductText -match "copyConnectionMethodClosureAudit" -and
      $advancedProductText -match "复制联机方式自检") {
    Pass-Check "connection method closure audit is wired"
  } else {
    Fail-Check "connection method closure audit is wired" "Advanced Tools page must expose a copyable closure audit covering method catalog, status boundaries, game capability decisions, recommendation handoff, real proxy/bridge backend, risk self-test, diagnostics prefill, remote co-op, Steam P2P reserve, external VPN guides, route-aware diagnostics, and copyable method guides"
  }

  if ($gameScanExplanationText -match "GameScanRecommendationExplanation" -and
      $gameScanExplanationText -match "buildGameScanRecommendationExplanation" -and
      $gameScanExplanationText -match "可按虚拟局域网开房" -and
      $gameScanExplanationText -match "推荐远程同屏联机" -and
      $gameScanExplanationText -match "优先使用 Steam 大厅/P2P" -and
      $gameScanExplanationText -match "需要管理员复核" -and
      $gameScanExplanationText -match "buildAdapterQualityScore" -and
      $gameProductText -match "buildGameScanRecommendationExplanation" -and
      $gameProductText -match "data-game-scan-recommendation-explanation=`"card`"" -and
      $gameProductText -match "data-game-scan-recommendation-explanation=`"analysis`"" -and
      $gameProductText -match "openScanRecommendedNextStep" -and
      $gameProductText -match "自动推荐解释") {
    Pass-Check "game scan recommendation explanation is wired"
  } else {
    Fail-Check "game scan recommendation explanation is wired" "Game scan page must explain why each scanned game maps to n2n, remote co-op, Steam/P2P, official-only, or review routes before opening the wizard"
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
  $productSidebarTextForNav = if (Test-Path "src\product-ui\ProductSidebar.tsx") { Get-Content "src\product-ui\ProductSidebar.tsx" -Raw -Encoding UTF8 } else { "" }
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
    (($sidebarText + "`n" + $productSidebarTextForNav) -notmatch [regex]::Escape($_))
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
# The current visual shell can be compared with a local reference source
# through LAN_HELPER_REFERENCE_UI_SRC. Public scripts must not hard-code a
# developer-specific absolute path.
$referenceUiCheck = "tools\check_reference_ui_fidelity.ps1"
try {
  $referenceUiCheckText = Get-Content $referenceUiCheck -Raw -Encoding UTF8
  $currentUserProfile = [string]$env:USERPROFILE
  $containsPersonalReferencePath = -not [string]::IsNullOrWhiteSpace($currentUserProfile) -and $referenceUiCheckText.Contains($currentUserProfile)
  if ($referenceUiCheckText -match "LAN_HELPER_REFERENCE_UI_SRC" -and
      -not $containsPersonalReferencePath) {
    Pass-Check "reference UI source is configurable"
  } else {
    Fail-Check "reference UI source is configurable" "$referenceUiCheck must use LAN_HELPER_REFERENCE_UI_SRC or a repo-local source, not a personal absolute path"
  }
} catch {
  Fail-Check "reference design source guardrail" ([string]$_)
}
if (Test-Path $referenceUiCheck) {
  Invoke-Step "reference UI fidelity" {
    powershell -ExecutionPolicy Bypass -File $referenceUiCheck
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
  $metadataFailures = New-Object System.Collections.Generic.List[string]
  foreach ($file in $gameFiles) {
    $adapter = Get-Content $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $adapter.adapter_version) { $metadataFailures.Add("$($file.Name): missing adapter_version") | Out-Null }
    if (-not $adapter.description) { $metadataFailures.Add("$($file.Name): missing description") | Out-Null }
    if ($adapter.PSObject.Properties.Name -contains "adapter_source") { $metadataFailures.Add("$($file.Name): must not persist adapter_source") | Out-Null }
    if ($null -eq $adapter.applicability) { $metadataFailures.Add("$($file.Name): missing applicability") | Out-Null }
    else {
      foreach ($field in @("verification_status","tested_versions","tested_platforms","supported_os","network_conditions","known_limitations")) {
        $value = $adapter.applicability.$field
        if ($null -eq $value -or @($value).Count -eq 0) { $metadataFailures.Add("$($file.Name): missing applicability.$field") | Out-Null }
      }
    }
    if ($null -eq $adapter.evidence) { $metadataFailures.Add("$($file.Name): missing evidence") | Out-Null }
    else {
      foreach ($field in @("port_protocols","proof_items","test_steps","last_verified_at")) {
        $value = $adapter.evidence.$field
        if ($null -eq $value -or @($value).Count -eq 0 -or [string]::IsNullOrWhiteSpace([string]($value -join ""))) { $metadataFailures.Add("$($file.Name): missing evidence.$field") | Out-Null }
      }
    }
  }
  if ($metadataFailures.Count -eq 0) {
    Pass-Check "adapter registry enhanced metadata"
  } else {
    Fail-Check "adapter registry enhanced metadata" ($metadataFailures -join "; ")
  }
} catch {
  Fail-Check "adapter registry parse" ([string]$_)
}

if (Test-Path "tools\validate_adapter_registry.ps1") {
  Invoke-Step "adapter registry schema validation" {
    powershell -ExecutionPolicy Bypass -File "tools\validate_adapter_registry.ps1"
  }
} else {
  Fail-Check "adapter registry schema validation" "missing tools\validate_adapter_registry.ps1"
}

if (Test-Path "tools\verify_dual_machine_regression_evidence.cjs") {
  Invoke-Step "dual machine regression evidence gate" {
    node "tools\verify_dual_machine_regression_evidence.cjs"
  }
} else {
  Fail-Check "dual machine regression evidence gate" "missing tools\verify_dual_machine_regression_evidence.cjs"
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






