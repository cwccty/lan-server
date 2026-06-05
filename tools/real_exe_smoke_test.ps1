param(
  [int]$StartupSeconds = 8,
  [switch]$KeepOpen,
  [switch]$AppendLog
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$exePath = Join-Path $repoRoot "src-tauri\target\release\lan-helper.exe"
$logPath = Join-Path $repoRoot "docs\RELEASE_VALIDATION_LOG.md"

function Get-ChildProcessTree {
  param([int]$ParentPid)

  $directChildren = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentPid" -ErrorAction SilentlyContinue)
  foreach ($child in $directChildren) {
    $child
    Get-ChildProcessTree -ParentPid ([int]$child.ProcessId)
  }
}

if (-not (Test-Path $exePath)) {
  throw "release exe 不存在：$exePath。请先运行 npm run tauri:build。"
}

$startedAt = Get-Date
Write-Host "Real EXE smoke test" -ForegroundColor Green
Write-Host "EXE: $exePath"
Write-Host "StartupSeconds: $StartupSeconds  KeepOpen: $KeepOpen  AppendLog: $AppendLog"

$process = Start-Process -FilePath $exePath -WorkingDirectory (Split-Path $exePath) -PassThru
Start-Sleep -Seconds $StartupSeconds

$liveProcess = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
$children = @(Get-ChildProcessTree -ParentPid $process.Id)
$consoleLikeChildren = @(
  $children | Where-Object {
    $_.Name -match '^(cmd|conhost|powershell|pwsh|edge|n2n)\.exe$'
  }
)
$webViewChildren = @(
  $children | Where-Object {
    $_.Name -ieq 'msedgewebview2.exe'
  }
)

$windowReady = $false
$mainWindowTitle = ""
$mainWindowHandle = 0
if ($liveProcess) {
  $liveProcess.Refresh()
  $mainWindowTitle = $liveProcess.MainWindowTitle
  $mainWindowHandle = [int64]$liveProcess.MainWindowHandle
  $windowReady = $mainWindowHandle -ne 0 -or $webViewChildren.Count -gt 0
}

$status = if ($liveProcess -and $windowReady -and $consoleLikeChildren.Count -eq 0) { "PASS" } else { "FAIL" }

$childSummary = if ($children.Count -eq 0) {
  "无子进程"
} else {
  ($children | ForEach-Object { "$($_.Name)#$($_.ProcessId)" }) -join ", "
}

$consoleSummary = if ($consoleLikeChildren.Count -eq 0) {
  "未发现 cmd/conhost/powershell/edge/n2n 启动期子进程"
} else {
  ($consoleLikeChildren | ForEach-Object { "$($_.Name)#$($_.ProcessId)" }) -join ", "
}

$report = @"

## $($startedAt.ToString("yyyy-MM-dd HH:mm:ss")) 真实 EXE 启动烟测

~~~text
status: $status
exe: $exePath
pid: $($process.Id)
startup_seconds: $StartupSeconds
process_alive: $([bool]$liveProcess)
window_ready: $windowReady
main_window_handle: $mainWindowHandle
main_window_title: $mainWindowTitle
webview_children: $($webViewChildren.Count)
console_like_children: $($consoleLikeChildren.Count)
console_like_detail: $consoleSummary
child_processes: $childSummary
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。
"@

Write-Host $report

if ($AppendLog) {
  Add-Content -Path $logPath -Value $report -Encoding UTF8
  Write-Host "已追加到 $logPath" -ForegroundColor Cyan
}

if (-not $KeepOpen -and $liveProcess) {
  $closed = $liveProcess.CloseMainWindow()
  Start-Sleep -Seconds 2
  $stillLive = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
  if ($stillLive) {
    Stop-Process -Id $process.Id -Force
  }
}

if ($status -ne "PASS") {
  exit 1
}


