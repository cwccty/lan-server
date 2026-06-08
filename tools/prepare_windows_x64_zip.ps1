param(
  [string]$Version = "",
  [string]$OutputRoot = "release-artifacts",
  [switch]$Clean,
  [switch]$Rebuild
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
  throw "Missing n2n edge.exe: $edgeSource. Put a verified edge.exe there before packaging v$Version."
}

$outRootFull = [System.IO.Path]::GetFullPath($outRoot).TrimEnd("\") + "\"
$outDirFull = [System.IO.Path]::GetFullPath($outDir)
if (-not $outDirFull.StartsWith($outRootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clean package directory outside output root: $outDir"
}

if (Test-Path -LiteralPath $outDir) {
  Remove-Item -LiteralPath $outDir -Recurse -Force
}
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

Copy-Item -LiteralPath $exeSource -Destination (Join-Path $outDir "$packageName.exe") -Force

$n2nOut = Join-Path $outDir "tools\n2n"
New-Item -ItemType Directory -Path $n2nOut -Force | Out-Null
Copy-Item -LiteralPath $edgeSource -Destination (Join-Path $n2nOut "edge.exe") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "tools\n2n\README.md") -Destination (Join-Path $n2nOut "README.md") -Force

Copy-DirectorySafe -Source (Join-Path $repoRoot "adapter-registry") -Destination (Join-Path $outDir "adapter-registry")
Copy-DirectorySafe -Source (Join-Path $repoRoot "adapters") -Destination (Join-Path $outDir "adapters")

$readme = @'
联机助手 v__VERSION__ Windows x64

使用方法：
1. 先解压整个文件夹，不要在压缩包里直接双击 EXE。
2. 运行 __PACKAGE_NAME__.exe。
3. 打开“加入与组网”，填写中继地址、房间名、密钥和本机联机地址。
4. 两台电脑的中继地址、房间名、密钥必须完全一致。
5. 两台电脑的本机联机地址必须不同，例如房主 10.10.10.2，加入者 10.10.10.3。
6. 先保存设置，再启动组网。组网确认后，加入者在游戏里连接房主的联机地址和游戏端口。

如果一直卡住：
- 不要只截图“启动中”。请在“加入与组网”或“诊断报告”里分别复制：完整诊断报告、手动启动命令、组网日志。
- 显示“已配置未启动”：优先检查本机权限、组网程序文件、PID、虚拟网卡、手动启动命令是否秒退。
- 显示“组网程序已启动，但中继尚未确认”：优先核对中继地址、房间名、密钥、联机地址是否一致/冲突，并尝试手机热点排除 UDP 被网络拦截。
- “注册修复”无效时，不要反复点击；请复制报告、手动命令和组网日志回传。

边界说明：
- v__VERSION__ 是公开测试候选包，不代表所有游戏都已一键联机通过。
- 原生局域网 / 直连 IP / 专用服务器类游戏优先使用通用组网路线。
- 本地同屏游戏优先使用 Steam Remote Play 或串流路线。
- 官方服限定或 Steam 大厅/P2P 游戏不会被强行改成局域网模式。
- Steam Relay / P2P ConnectTool 兼容模式只会检测和启动用户自行提供的工具；本 ZIP 不包含外部 helper、Steam DLL 或 Steamworks SDK。

包内文件说明：
- SHA256SUMS.txt 可用于校验文件完整性。
- tools/n2n/last_config.json、edge.log、n2n.pid 等运行时文件不会被打进包里。
- 如果安全软件拦截 tools/n2n/edge.exe，请先截图并确认来源/哈希后再决定是否放行。
- FRIEND_RETEST_GUIDE.txt 是给真实用户复测和回传问题用的步骤模板。
'@
$readme = $readme.Replace('__VERSION__', $Version).Replace('__PACKAGE_NAME__', $packageName)
Set-Content -Path (Join-Path $outDir $readmeName) -Value $readme -Encoding UTF8

$friendRetestGuide = @'
联机助手 v__VERSION__ 真实组网复测说明
================================

准备：
1. 两台电脑都使用同一个 ZIP 解压出来的 __PACKAGE_NAME__.exe。
2. 不要覆盖旧文件夹，建议解压到新目录。
3. 如果安全软件拦截 tools/n2n/edge.exe，请截图记录。

两台电脑都要填写：
- 中继地址：两边必须一致。
- 房间名：两边必须一致。
- 密钥：两边必须一致。
- 本机联机地址：两边必须不同。例如房主 10.10.10.2，加入者 10.10.10.3。

复测步骤：
1. 打开“加入与组网”。
2. 保存设置。
3. 点击“启动组网”。
4. 等待 20 秒。
5. 如果仍不能联机，两台电脑都复制：完整诊断报告、手动启动命令、组网日志。

如何判断：
- 已配置未启动：本机组网程序没有跑起来，重点看权限、程序文件、PID、虚拟网卡、手动命令。
- 中继尚未确认：程序已启动但没连通，重点看中继地址、房间名、密钥、联机地址冲突、UDP/网络环境。
- 注册修复无效：不要反复点击，改为回传报告、手动命令和组网日志。

每台电脑回传格式：
【电脑身份】房主 / 加入者
【Windows 版本】
【网络环境】家用宽带 / 校园网 / 公司网 / 手机热点 / 其他
【是否管理员运行联机助手】是 / 否
【软件版本】v__VERSION__
【页面状态】已配置未启动 / 中继尚未确认 / 已连接 / 其他
【中继地址】
【房间名】
【本机联机地址】
【对方联机地址】
【注册修复是否有效】是 / 否 / 没点
【复制完整诊断报告】
【复制手动启动命令】
【复制组网日志】
【截图】组网页状态截图 + 诊断报告页截图
'@
$friendRetestGuide = $friendRetestGuide.Replace('__VERSION__', $Version).Replace('__PACKAGE_NAME__', $packageName)
Set-Content -Path (Join-Path $outDir "FRIEND_RETEST_GUIDE.txt") -Value $friendRetestGuide -Encoding UTF8

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
