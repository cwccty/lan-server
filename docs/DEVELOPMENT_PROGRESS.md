# 开发进度快照

更新时间：2026-06-02

## 联机方式规划

| 联机方式 | 定位 | 当前进度 | 发布状态 |
|---|---|---|---|
| n2n / EasyN2N | 长期核心内置组网方案，客户端管理 edge，VPS 运行 supernode | 已能检测 edge.exe、保存配置、启动/停止 edge、指定 static 虚拟 IP、识别 TAP 虚拟 IP；已完成官方源码 Windows edge 构建；VPS supernode 已跑通；房主侧 10.10.10.2:7777 测试通过 | 接近可用，但仍需状态面板、日志、权限提示、重复注册/IP 冲突处理和朋友侧实测 |
| Radmin VPN | 外部组网工具辅助检测与引导 | 已检测安装路径和 Radmin 虚拟 IP；不会自动创建或加入 Radmin 网络 | 辅助可用，非内置核心；适合已有 Radmin 用户 |
| Manual LAN / 手动 IP | 兜底模式，适用于同一局域网、已有 VPN、ZeroTier、Tailscale 等 | 已有手动目标 IP/端口 TCP 测试 | 基础可用，但需要更清晰 UI 和诊断解释 |
| 游戏向导：Terraria | 第一个游戏辅助场景，负责服务端参数、世界、端口、邀请文本 | 已有联机向导、服务端启动、内嵌控制台、自检、复制邀请；但服务端生命周期仍需稳定 | 发布阻断：监听后退出问题必须彻底定位 |
| 自动下载/安装 n2n | 未来降低门槛 | 已写入未来方向：固定版本、白名单 URL、SHA256、用户确认 | 未实现，不进第一版默认流程 |
| 官方/自建 supernode 服务 | 未来降低门槛 | 当前由用户 VPS 部署；已有部署文档 | 未产品化，不进第一版默认承诺 |

## 当前开发进度百分比，粗略估计

- 项目骨架 / Tauri 桌面端：70%
- 游戏扫描 / Steam 路径识别：60%
- 通用组网中心：45%
- n2n 内置组网：65%
- Radmin 辅助检测：35%
- Manual LAN 兜底测试：45%
- Terraria 一键开服向导：55%
- 发布级诊断 / 状态统一：30%
- 打包发布体验：35%

## 下一步建议

1. 修复并验证 TerrariaServer 监听后退出问题，记录 exit code 和最后日志。
2. 把 n2n 状态做成真实运行态面板：edge PID、虚拟 IP、TAP 名、supernode、最近错误。
3. 完成通用组网中心 UI，使用户不需要先选择 Terraria 也能组网。
4. 保留 Terraria 向导为“可选游戏辅助”，不再把 n2n 配置理解为 Terraria 专属配置。
5. 做朋友侧真实加入测试，验证 10.10.10.3 加入 10.10.10.2:7777。

## 2026-06-02 状态更新

服务端生命周期发布阻断项已完成第一轮产品级修复：后端会记录真实退出码、退出时间和是否曾经监听端口；前端会显示退出诊断，并且自检不会再把已退出服务端误判为通过。

n2n 状态也补充了运行态说明：检测结果会包含 edge 路径、记录 PID、当前虚拟 IP 和最近 supernode。

注意：该阻断项是否“完全解决”仍需要 release 客户端真实运行验证。如果 TerrariaServer 仍在 Listening 后退出，新增诊断信息将作为下一轮定位依据。

## 2026-06-02 关键记忆写入

本轮确认并写入项目文件的关键内容：

1. n2n 是通用组网层，不应绑定 Terraria；组网成功后，支持 LAN/IP 的游戏原则上都连接房主虚拟 IP。
2. 除 n2n 外，规划中的联机方式包括 Radmin 辅助检测、Manual LAN 兜底、未来 ZeroTier/Tailscale 检测、未来官方/自建 supernode 服务和未来 n2n 自动下载。
3. 当前 MVP 的发布判断必须依赖结构化诊断 `release_checks`，不能依赖口头判断或单纯 UI 颜色。
4. `Listening on port 7777` 后几秒变灰属于服务端生命周期发布阻断项，必须以 exit code、exited_at、ever_ready、uptime_seconds 和最后日志定位。
5. 本轮已修复诊断报告生成代码中的中文乱码，避免发布前检查不可读。

## 2026-06-02 进度补充：服务端隐藏控制台启动修正

- 修复 `src-tauri/src/core/server_session.rs` 用户可见中文乱码。
- Windows 下 TerrariaServer 不再使用单纯 `CREATE_NO_WINDOW`，改为 `CreateProcessW + 隐藏的新控制台`。
- 该改动用于真实解决后台启动时可能因无控制台句柄导致服务端退出的问题，而不是只改变 UI 显示。
- 仍需用户用 release 客户端验证：启动服务端后等待 30 秒，确认 `Terraria 服务端 30 秒稳定性` 检查通过。

## 2026-06-02 进度补充：内嵌控制台 IO 闭环

- Windows 下 TerrariaServer 启动逻辑增加 stdin/stdout/stderr 管道。
- 内嵌控制台可以接收服务端输出，命令按钮写入真实服务端 stdin。
- 继续保留隐藏新控制台，避免 `Console.Title` 或控制台句柄相关退出。
- 该项用于满足发布清单中 `help/save/exit` 按钮必须真实生效的要求。

- 诊断报告新增 `server_io_bridge` MVP 必需检查，发布前必须由 release 客户端启动服务端后生成证据。

## 2026-06-02 进度补充：n2n 状态可读性修复

- 修复 `src-tauri/src/network/n2n_backend.rs` 用户可见中文乱码。
- 统一 n2n 配置和 PID 文件定位到实际 `tools/n2n` 目录。
- 该项用于发布清单 A/E：通用组网中心和诊断报告必须显示可读、真实的 n2n 状态。

## 2026-06-02 进度补充：通用组网中心状态面板

- `NetworkSetupPage` 将 n2n 结果从 JSON 改为用户可读状态面板。
- 面板展示 edge 检测、虚拟 IP、后端 notes、保存配置结果和运行态结果。
- 增加复制通用组网配置按钮，方便朋友侧按同一 community/secret/supernode 加入。

## 2026-06-02 进度补充：发布前一键汇总

- `DiagnosticReport` 新增 `release_ready`、`required_passed`、`required_total`、`next_actions`。
- 诊断报告页显示未通过项的下一步处理建议。
- 修复 `commands.rs` 中未知网络后端错误的中文乱码。

## 2026-06-03 进度补充：发布级诊断与失败分类

- `DiagnosticReport` 已新增 `issues` 和 `most_likely_cause`。
- n2n 失败分类已结构化：edge 缺失、supernode 未配置、edge 未运行、认证错误、IP/MAC 冲突、supernode 无响应、等待 ACK/PONG、虚拟 IP 缺失。
- TCP 端口代理一键自测已纳入诊断报告，检查项为 `tcp_port_proxy_self_test`。
- 诊断报告页已升级为问题定位中心，展示最可能原因、失败分类、证据、下一步建议、检测项时间线和详细日志。
- MVP 发布清单已更新到 2026-06-03，把通用组网缓存、n2n 失败分类、TCP 端口代理、自测和诊断报告结构纳入验收标准。

下一阶段进入“游戏适配器体系升级 / 游戏类型识别与方案沉淀”：让管理员或用户能认定游戏联机类型，沉淀为可复用 adapter，并让后续用户自动获得推荐方案。

## 2026-06-03 进度补充：推荐页接入适配器连接方案

- `RecommendationPage` 已显示 `network_type` 和 `connection_plan`。
- 好友邀请包已包含游戏网络类型、沉淀方案、房主步骤、加入者步骤、方案需求、邀请模板和排错建议。
- 执行清单的房主/好友步骤优先使用 adapter 中沉淀的连接方案。
- 完整验证已通过：`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`npm run tauri:build`。

下一大块：游戏类型识别与方案沉淀工作流，把未知游戏认定、本地 adapter 保存、共享库同步、推荐复用和诊断提示做成闭环。
