# v0.3.1 发布前门禁清单

> 用途：发布 `v0.3.1` Windows x64 prerelease 前逐项确认。当前状态为“本地候选已通过当前门禁，远端 Release 尚未创建”。

## 1. 构建门禁

- [x] `npm.cmd run build`
- [x] `cargo check --manifest-path src-tauri\Cargo.toml`
- [x] `cargo test --manifest-path src-tauri\Cargo.toml n2n_diagnostics_fixture -- --nocapture`
- [x] `node tools\verify_status_center_fixtures.cjs`
- [x] `npm.cmd run tauri:build`
- [x] `npm.cmd run release:zip`
- [x] `npm.cmd run release:zip:verify`

## 2. 当前候选产物

- [x] EXE 路径：`src-tauri\target\release\lan-helper.exe`
- [x] EXE SHA256：`75295FDB62187E75AB4A659647530F4F4A5F4824261ACAE49AC207C226645329`
- [x] ZIP 路径：`release-artifacts\LanHelper-v0.3.1-windows-x64.zip`
- [x] ZIP SHA256：`EE65491E725538DD482CCE96CD33F2A834A311A702DA6CB0691F2C5BDA9E2C96`
- [x] ZIP 校验：`payload_files=21`
- [x] release EXE smoke：启动 8 秒后仍存活

## 3. 禁止打包项

发布 ZIP 不得包含以下外部文件：

- [x] `connecttool-qt.exe`
- [x] `steam_api64.dll`
- [x] `steamwebrtc64.dll`
- [x] `wintun.dll`
- [x] `steam_appid.txt`

说明：EXE 内出现这些字符串属于运行时检测文件名，不代表打包了外部文件。

## 4. UI / 普通用户路径门禁

- [x] 高级连接工具默认四方式同级，且默认不突出 Steam Relay/P2P。
- [x] 选中 Steam Relay/P2P 时只展开 Steam/P2P 配置单。
- [x] 选中端口代理时只展开端口代理配置。
- [x] 桥接工具分类进入后先显示“地址+端口 / 房间列表看不到”二选一。
- [x] 游戏扫描和方案库有联机方式分类，并显示“已收录 / 待补充”。
- [x] 服务端分类可定位到一键开服向导。
- [x] Palworld / Minecraft 一键开服向导显示“待实机验证”。
- [x] 普通用户主路径不显示 `MVP`、`adapter`、`registry` 等内部词。

## 5. 组网诊断门禁

- [x] `running && !ready` 不再显示单纯“启动中”。
- [x] 前端状态明确为“组网程序已启动，但中继尚未确认”。
- [x] 已配置未启动、运行无 ACK/PONG、中继无响应、TAP 错误、认证/密钥错误、IP/MAC 冲突均有 fixture 覆盖。
- [x] 诊断字段包含：组网程序文件、PID、PID 存活、中继地址、联机地址、ACK/PONG、日志路径、最近日志、手动启动命令。
- [x] 加入与组网页提供：复制完整诊断报告、复制手动启动命令、复制组网日志。
- [x] 诊断报告页提供同等级复制入口。
- [x] 两台电脑对照 SOP 已进入页面和诊断报告文本。

## 6. Steam Relay / P2P 门禁

- [x] ConnectTool helper 目录默认不再使用开发者私有路径。
- [x] 用户需要手动填写 Steam 连接工具文件夹，或通过 `LAN_HELPER_CONNECTTOOL_DIR` 提供。
- [x] 房主 / 加入者配置单已进入 UI。
- [x] 前端 `connecttool_dir` 会传到后端 P2P 预检。
- [ ] 房主 Windows + Steam 在线 + helper 实机验证。
- [ ] 加入者 Windows + Steam 在线 + helper 实机验证。
- [ ] 双机 Steam Relay/P2P 游戏内加入成功证据。

## 7. 多游戏真实回归门禁

- [ ] Palworld Dedicated Server 启动并完成好友游戏内加入。
- [ ] Minecraft Java `server.jar` / Open to LAN 完成好友游戏内加入。
- [ ] Stardew Valley 双机回归。
- [ ] Cuphead 双机回归。
- [ ] 每项均收集房主/加入者环境、组网报告、日志、游戏内截图和结论。

## 8. 远端发布门禁

截至 `2026-06-08 21:14:00 +08:00`，`v0.3.1` GitHub Release 尚不存在。证据：`docs/acceptance-artifacts/gh-release-v0.3.1-current-2026-06-08.json`。

发布前必须：

- [ ] 创建 `v0.3.1` prerelease。
- [ ] Release body 明确写清真实双机回归未完成。
- [ ] 上传 `LanHelper-v0.3.1-windows-x64.zip`。
- [ ] 发布后重新下载远端 asset，并校验 SHA256 等于 `EE65491E725538DD482CCE96CD33F2A834A311A702DA6CB0691F2C5BDA9E2C96`。

## 9. 发布后不得误导

- [ ] 不写“1.0”。
- [ ] 不写“真实双机已通过”。
- [ ] 不写“Palworld/Minecraft 已完成游戏内加入”。
- [ ] 不写“原生 Steamworks”。
- [ ] 明确本版本是 prerelease / 候选包。
