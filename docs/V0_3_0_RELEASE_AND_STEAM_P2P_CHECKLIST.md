# v0.3.0 发布与 Steam Relay/P2P 回归检查清单

日期：2026-06-08

本文用于继续推进 `v0.3.0`：把本地已经通过的 ConnectTool 兼容 MVP，按可复现证据发布并进入真实双机 Steam Relay/P2P 回归。

## 1. 当前可发布资产

- tag：`v0.3.0`
- commit：以 `git rev-parse "v0.3.0^{commit}"` 的输出为准
- ZIP：`release-artifacts\LanHelper-v0.3.0-windows-x64.zip`
- ZIP SHA256：`97525924f16bb8abafa772abca288f7eaaae026688ae4f7408d7e8a2a27abb7e`
- Release 草稿：`docs\GITHUB_RELEASE_DRAFT.md`

## 2. 发布前本地门禁

发布前重新运行以下命令，所有命令必须通过：

```powershell
git status -sb
git log --oneline -5 --decorate
git ls-remote --heads origin master
git ls-remote --tags origin "v0.3.0*"
cargo check --manifest-path src-tauri\Cargo.toml
npm.cmd run build
npm.cmd run tauri:build
npm.cmd run release:zip
npm.cmd run release:zip:verify
```

预期：

- `origin/master` 指向计划发布提交；
- `refs/tags/v0.3.0^{}` 指向同一提交；
- `release:zip:verify` 输出 `PASS`；
- ZIP SHA256 等于本文第 1 节记录值；
- 不允许出现 staged 文件；
- 本地历史工作树改动不能被混入发布提交。

## 3. GitHub Release 创建

只允许使用本机安全环境变量或已登录发布工具，不允许把真实 token 写入命令历史、日志、文档或提交。

推荐命令：

```powershell
powershell -ExecutionPolicy Bypass -File tools\update_github_release_v0_1.ps1 -CreateIfMissing -DryRun
powershell -ExecutionPolicy Bypass -File tools\update_github_release_v0_1.ps1 -CreateIfMissing
```

发布脚本应显示：

- Release：`cwccty/lan-server v0.3.0`
- Asset：`LanHelper-v0.3.0-windows-x64.zip`
- Local SHA256：`97525924f16bb8abafa772abca288f7eaaae026688ae4f7408d7e8a2a27abb7e`

## 4. 发布后远端核对

```powershell
$r = Invoke-RestMethod -Uri 'https://api.github.com/repos/cwccty/lan-server/releases/tags/v0.3.0' -Headers @{ 'User-Agent'='lan-helper-release-check' }
$r.tag_name
$r.prerelease
$r.assets | Select-Object name,size,digest,browser_download_url
```

必须满足：

- tag 是 `v0.3.0`；
- release 是 prerelease；
- asset 名称是 `LanHelper-v0.3.0-windows-x64.zip`；
- 远端 digest 是 `sha256:97525924f16bb8abafa772abca288f7eaaae026688ae4f7408d7e8a2a27abb7e`。

下载远端 ZIP 后重新计算 SHA256：

```powershell
Invoke-WebRequest -Uri '<browser_download_url>' -OutFile .\LanHelper-v0.3.0-windows-x64.remote.zip
Get-FileHash .\LanHelper-v0.3.0-windows-x64.remote.zip -Algorithm SHA256
```

## 5. Steam Relay/P2P 本地 smoke

不需要双账号即可完成：

1. 启动 `src-tauri\target\release\lan-helper.exe`，确认 5 秒内进程存在；
2. 打开“特殊连接工具”；
3. 确认出现“Steam 中继 / P2P（ConnectTool 兼容）”；
4. 检测 ConnectTool helper 目录；
5. 启动 helper；
6. 确认 `connecttool-qt.exe` 进程存在；
7. 停止 helper；
8. 确认 helper 进程退出。

需保留：

- 命令输出；
- 页面截图；
- 复制的诊断报告。

## 6. 真实双机 TCP 转发回归

需要两台 Windows、两个 Steam 账号、同一版本 ConnectTool helper、目标游戏。

### 房主机器

1. 登录 Steam；
2. 启动联机助手；
3. 打开目标游戏或专用服务端；
4. 确认游戏端口；
5. 在联机助手中启动 ConnectTool helper；
6. 在 helper 中选择 TCP 转发；
7. 填写游戏端口；
8. 创建房间或复制 Steam ID/邀请；
9. 保存联机助手诊断报告。

### 加入者机器

1. 登录另一个 Steam 账号；
2. 启动联机助手；
3. 启动 ConnectTool helper；
4. 输入房主 Steam ID 或接受邀请；
5. 连接成功后，在游戏里连接 `127.0.0.1:<本地绑定端口>`；
6. 记录是否进入房间、延迟、掉线、重连情况；
7. 保存联机助手诊断报告。

### 每个游戏至少记录

| 游戏 | 端口 | 路线 | 房主结果 | 加入者结果 | 延迟/稳定性 | 证据 |
| --- | --- | --- | --- | --- | --- | --- |
| Palworld | 待填写 | TCP 转发 | 待填写 | 待填写 | 待填写 | 待填写 |
| Minecraft Java | 待填写 | TCP 转发 | 待填写 | 待填写 | 待填写 | 待填写 |
| Stardew Valley | 待填写 | TCP 转发或替代路线 | 待填写 | 待填写 | 待填写 | 待填写 |
| Cuphead | 待填写 | 远程同屏或替代路线 | 待填写 | 待填写 | 待填写 | 待填写 |

## 7. 真实双机 TUN 回归

TUN 路线只能作为实验项，不作为 v0.3.0 必过项。

前置：

- `wintun.dll` 存在；
- 管理员权限；
- Windows 防火墙放行；
- 双机都能启动 helper。

需记录：

- 虚拟网卡是否创建；
- 两端虚拟 IP；
- 是否能 ping 通；
- 游戏是否能发现局域网房间；
- 失败时防火墙/权限/驱动错误。

## 8. 对外口径

可以说：

- `v0.3.0` 提供 Steam Relay/P2P 的 ConnectTool 兼容 MVP；
- 联机助手可以检测、启动、停止用户自备 helper，并给出 TCP/TUN 使用说明和诊断报告；
- 发布包不包含 ConnectTool、Steam DLL 或 Steamworks SDK。

不能说：

- 原生 Steamworks 已内置；
- 所有 Steam P2P 游戏都能一键联机；
- Palworld/Minecraft/Stardew/Cuphead 已完成真实双机回归；
- 可以规避 Steam、游戏拥有权、官方服务器、反作弊或 DRM。

## 9. 当前阻塞

截至本文创建时：

- GitHub Release `v0.3.0` 仍未创建；
- 本机没有可用 `gh` CLI；
- 未使用聊天中出现过的明文 token；
- 真实双机/双账号 Steam Relay/P2P 回归未执行。
