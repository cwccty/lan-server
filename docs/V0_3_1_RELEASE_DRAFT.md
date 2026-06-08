# v0.3.1 Release Draft

> 状态：本地候选包已通过当前门禁；截至 `2026-06-08 21:14:00 +08:00`，远端 `v0.3.1` GitHub Release 尚不存在。

## 版本定位

`v0.3.1` 是 `v0.3.0` 之后的候选修复版，重点补强普通用户路径、Steam Relay/P2P 兼容入口、Palworld/Minecraft 一键开服向导边界，以及真实用户反馈的“启动中 / 已配置未启动”组网诊断闭环。

本版本仍不是 v1.0，也不能宣称 Palworld / Minecraft / Stardew / Cuphead 已完成真实双机回归。

## 主要变化

### 普通用户 UI 与联机方式入口

- 高级连接工具默认不再突出 Steam Relay/P2P，四种方式同级展示：
  - Steam Relay / P2P
  - 端口代理
  - UDP 广播桥
  - 通用服务端 / 一键开服
- 游戏扫描和方案库增加按联机方式分类，并提供下一步入口。
- 服务端分类可定位到一键开服向导；Steam/远程分类可定位到 Steam/P2P 配置；桥接工具分类先给“地址+端口 / 房间列表看不到”二选一。
- 普通用户主路径避免显示 `MVP`、`adapter`、`registry` 等内部词。

### 组网卡住诊断闭环

针对真实用户反馈：一台电脑一直显示“启动中”，另一台显示“已配置未启动 / 组网服务未运行”，本版补强：

- `running && !ready` 不再显示单纯“启动中”，改为“组网程序已启动，但中继尚未确认”。
- “已配置未启动”和“中继尚未确认”拆成不同结论。
- 诊断和页面显示：组网程序文件是否找到、记录 PID、PID 是否存活、中继地址、房间名、联机地址、ACK/PONG、日志路径、最近日志、手动启动命令。
- 加入与组网页新增可复制入口：
  - 复制完整诊断报告
  - 复制手动启动命令
  - 复制组网日志
- 新增两台电脑对照 SOP：双方都复制报告和日志，对照中继地址、房间名、密钥、联机地址、PID 和最后错误。

### Steam Relay / P2P 兼容 MVP

- Steam/P2P 页面提供“房主 / 加入者配置单”。
- ConnectTool helper 目录不再有开发者私有默认路径；普通用户需要手动选择“Steam 连接工具文件夹”，自动化用户可用 `LAN_HELPER_CONNECTTOOL_DIR`。
- ZIP 不包含外部 ConnectTool helper、Steam DLL、WinTUN 或 `steam_appid.txt`。
- 本功能是 ConnectTool 兼容 MVP，不是原生 Steamworks 集成；真实双机 Steam Relay/P2P 回归仍未完成。

### Palworld / Minecraft 一键开服向导

- 新增 Palworld / Minecraft Java 服务端 profile：默认端口、协议、需要准备的文件、预检项、启动建议、邀请模板、失败排查建议。
- Palworld：重点提示 UDP 8211、Dedicated Server 文件、游戏内加入边界。
- Minecraft Java：重点提示 `server.jar`、`eula.txt`、TCP 25565、Java 可用性、端口监听、`IP:端口` 邀请。
- 未真实双机通过前，UI 仍标记“待实机验证”。

## 当前本地候选产物

- EXE：`src-tauri\target\release\lan-helper.exe`
  - SHA256：`75295FDB62187E75AB4A659647530F4F4A5F4824261ACAE49AC207C226645329`
- ZIP：`release-artifacts\LanHelper-v0.3.1-windows-x64.zip`
  - SHA256：`EE65491E725538DD482CCE96CD33F2A834A311A702DA6CB0691F2C5BDA9E2C96`

## 已通过的本地门禁

```powershell
cargo test --manifest-path src-tauri\Cargo.toml n2n_diagnostics_fixture -- --nocapture
cargo check --manifest-path src-tauri\Cargo.toml
npm.cmd run build
node tools\verify_status_center_fixtures.cjs
npm.cmd run tauri:build
npm.cmd run release:zip
npm.cmd run release:zip:verify
```

补充检查：

- ZIP payload_files=21。
- ZIP 外部 helper 扫描：未发现 `connecttool-qt.exe`、`steam_api64.dll`、`steamwebrtc64.dll`、`wintun.dll`、`steam_appid.txt`。
- release EXE smoke：启动 8 秒后仍存活。
- 默认 registry v3 远端 / 本地 / ZIP 已核对通过。

## 不能宣称的事项

- 不能宣称 v1.0 或最终完整交付。
- 不能宣称 Steam Relay/P2P 已真实双机通过。
- 不能宣称 Palworld / Minecraft / Stardew / Cuphead 已真实双机通过。
- 不能把“本机预检 / UI 路径 / 服务端启动尝试”说成“好友已能游戏内加入”。

## 建议 Release body

```markdown
## v0.3.1 prerelease

这是一个 Windows x64 预发布候选，重点修复普通用户组网卡住时的诊断闭环，并补强 Steam/P2P、Palworld/Minecraft 一键开服向导和多联机方式入口。

### 主要变化
- 高级连接工具四种方式同级展示：Steam Relay/P2P、端口代理、UDP 广播桥、通用服务端。
- Steam/P2P 改为 ConnectTool 兼容 MVP，用户需要手动提供 Steam 连接工具文件夹；发布包不包含外部 helper/DLL/WinTUN/steam_appid.txt。
- Palworld / Minecraft Java 增加一键开服向导 profile，但仍标记“待实机验证”。
- 修复“启动中 / 已配置未启动”用户卡住体验：新增中继未确认、PID 失效、虚拟网卡错误、密钥错误、IP 冲突等诊断分类，并支持复制完整报告、手动启动命令和组网日志。

### 候选包
- ZIP SHA256: EE65491E725538DD482CCE96CD33F2A834A311A702DA6CB0691F2C5BDA9E2C96

### 已知边界
- 本版本仍是 prerelease。
- Steam Relay/P2P 真实双机回归未完成。
- Palworld / Minecraft / Stardew / Cuphead 真实双机回归未完成。
- 真实游戏内加入结果仍以双机实测证据为准。
```
