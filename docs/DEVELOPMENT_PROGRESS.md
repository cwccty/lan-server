﻿﻿﻿﻿﻿﻿# 开发进度快照

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

## 2026-06-03 UDP 能力规划补充

已新增 `docs/UDP_BRIDGE_MVP.md`，明确区分 UDP 单播端口代理与 UDP 广播桥：

- UDP 单播端口代理用于 `朋友 -> 房主虚拟 IP:UDP端口 -> 本机游戏UDP端口` 的转发，下一步优先实现，并加入一键 UDP echo 自测。
- UDP 广播桥用于局域网房间发现广播/组播转发，不等同于端口代理，也不保证加入成功。
- 声明 `udp_broadcast_needed` 的游戏，在广播桥未实现前必须显示“能力待实现”，不能暗示已经支持。
- 实现顺序：UDP 端口代理后端、自测、UI、诊断，然后再做广播桥 MVP。

## 2026-06-03 进度补充：UDP 单播端口代理后端 MVP

- 新增 UDP 代理后端、模型、Tauri 命令和前端 API 类型。
- 支持启动/停止/列表/状态/一键自测。
- 一键自测使用真实 UDP Echo 服务验证代理收发链路。
- Rust 单元测试已覆盖 UDP 端到端转发和自测报告。
- 已验证：`cargo test --manifest-path src-tauri\Cargo.toml udp_proxy -- --nocapture`、`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`。

下一步：把 UDP 端口代理接入通用组网中心 UI，并纳入发布级诊断报告。

## 2026-06-03 进度补充：UDP 端口代理 UI 与诊断

- 通用组网中心新增 UDP 端口代理卡片。
- 支持配置、启动、停止、刷新、一键自测。
- 通用组网邀请文本新增 UDP 代理摘要。
- 诊断报告新增 `udp_port_proxy_self_test`，并在失败时输出 `udp_proxy_self_test_failed` 分类。
- 验证通过：`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`cargo test --manifest-path src-tauri\Cargo.toml udp_proxy -- --nocapture`、`npm run tauri:build`。

下一步：实现 UDP 广播桥 MVP，解决依赖 LAN 广播/组播发现的游戏“组网已通但列表看不到房间”的问题。

## 2026-06-03 进度补充：UDP 广播桥后端 MVP

- 新增 UDP 广播桥后端、模型、Tauri 命令和前端 API 类型。
- 支持启动/停止/列表/状态/一键自测。
- 一键自测使用真实 UDP 接收器验证发现包转发链路。
- Rust 单元测试已覆盖 UDP 广播桥转发和自测报告。
- 已验证：`cargo test --manifest-path src-tauri\Cargo.toml udp_broadcast_bridge -- --nocapture`、`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`npm run tauri:build`。

下一步：把 UDP 广播桥接入通用组网中心 UI，并纳入发布级诊断报告。

## 2026-06-03 进度补充：UDP 广播桥 UI 与诊断

- 通用组网中心新增 UDP 广播桥卡片。
- 支持配置、启动、停止、刷新、一键自测。
- 通用组网邀请文本新增广播桥摘要。
- 诊断报告新增 `udp_broadcast_bridge_self_test`，并在失败时输出 `udp_broadcast_bridge_self_test_failed` 分类。
- 验证通过：`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`cargo test --manifest-path src-tauri\Cargo.toml udp_broadcast_bridge -- --nocapture`、`npm run tauri:build`。

下一步：把游戏适配器中的 `requires_udp_broadcast_bridge` 与推荐页/诊断报告联动，明确告诉用户“这个游戏需要广播桥，当前能力是否就绪”。

## 2026-06-03 进度补充：推荐页能力状态联动

- 推荐页刷新执行清单时会读取 TCP 端口代理、UDP 端口代理、UDP 广播桥状态。
- `connection_plan.requires_tcp_port_proxy` 和 `connection_plan.requires_udp_broadcast_bridge` 已与真实运行状态联动。
- 执行清单新增“方案所需桥接/代理”项。
- 好友邀请包新增 TCP/UDP/广播桥状态摘要。
- 验证通过：`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`npm run tauri:build`。

下一步：诊断报告增加“适配器需求 vs 当前能力”检查，形成发布级失败分类。

## 2026-06-03 进度补充：适配器需求进入诊断报告

- 诊断报告新增 adapter requirement 巡检。
- `connection_plan` 中的虚拟局域网、TCP 代理、UDP 广播桥、专用服务端需求会和当前真实能力/自测结果对比。
- 未知或缺少 `connection_plan` 的游戏会产生 `adapter_unknown_need_review` 失败分类。
- 细分 adapter 检查已进入 `release_checks`。
- 验证通过：`cargo check --manifest-path src-tauri\Cargo.toml`、`npm run build`、`npm run tauri:build`。

下一步：做“未知游戏认定入口”，把待认定游戏快速生成本地 adapter 草稿。

## 2026-06-03 进度补充：未知游戏创建 adapter 草稿

- 扫描页对未适配、unknown_need_review、缺少 connection_plan 的游戏显示“创建适配器草稿”。
- 草稿保存为本地 custom adapter，默认 network_type 为 unknown_need_review。
- 创建后刷新扫描结果，并可跳转适配器管理继续认定。
- “需人工适配”统计已纳入 unknown 和缺少 connection_plan 的游戏。
- 验证通过：`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`npm run tauri:build`。

下一步：在适配器管理页按网络类型自动同步推荐模板，降低管理员配置成本。

## 2026-06-03 进度补充：适配器网络类型模板联动

- 适配器管理页选择游戏网络类型时会自动应用对应模板。
- 覆盖 LAN/IP、专用服务端、TCP 代理、UDP 广播桥、Steam Lobby/Relay、Mod、仅官方、暂不支持、未知待判断。
- 自动同步 capabilities、multiplayer_conversion、methods、connection_plan 和 requires_* 字段。
- 保留原有 game_id、display_name、steam_appid、executables；已有端口不为空时不覆盖端口。
- 验证通过：`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`npm run tauri:build`。

下一步：完善认定后的 adapter 导出/共享库提交说明，让本地沉淀方案更容易进入共享 registry。

## 2026-06-03 进度补充：adapter 共享库提交说明

- 适配器管理页导出 JSON 时会生成共享库提交说明。
- 说明包含 `adapter-registry/games/*.json` 路径、sha256、`index.json` entry 和审核边界。
- 验证通过：`npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`npm run tauri:build`。

下一步：更新共享库文档，补全实际 GitHub 提交流程和 sha256 校验说明。

## 2026-06-03 下一大块规划：适配器共享库与方案沉淀闭环

发布级诊断与失败分类完成后，下一大块不应继续优先堆单个联机按钮，而应进入“适配器共享库与方案沉淀闭环”。

原因：项目的核心差异不是单纯提供 n2n、TCP 代理、UDP 代理或广播桥，而是把“某个游戏到底属于哪种联机类型、需要什么转换方案、用户该怎么操作”沉淀成可复用 adapter。管理员或高级用户认定一次后，后续普通用户扫描到同一个游戏时不需要重新判断。

这一大块的目标：

1. 本地 adapter-registry 生成工具：扫描 `adapter-registry/games/*.json`，自动计算 sha256，生成 `adapter-registry/index.json`。
2. 共享库同步可信化：远程拉取 index，按 sha256 校验 adapter，失败不覆盖本地可用数据。
3. 适配器版本与来源展示：明确 builtin/custom/registry/steam_scan，避免用户误以为未知游戏已经完整支持。
4. 管理员提交闭环：本地认定 → 导出 JSON → 自动生成 index entry → 放到 GitHub Pages/VPS → 其他用户同步。
5. 发布前端到端验证：至少用 Terraria 和 1 个 unknown 草稿模拟完整流程，证明“认定一次、多人复用”真实成立。

阶段边界：这一阶段仍然只做数据化 adapter，不允许共享库携带任意脚本、未知 exe 自动下载、绕过正版验证/反作弊/官方账号服务。

下一步推荐：先新增 `tools/update_adapter_registry_index.ps1`，自动生成本地共享库 `index.json`，让 GitHub Pages/VPS 同步流程可测试。


## 2026-06-03 本地 adapter-registry index 自动生成工具

已新增 `tools/update_adapter_registry_index.ps1`：

- 扫描 `adapter-registry/games/*.json`。
- 读取 adapter 的 `game_id` / `steam_appid`。
- 计算每个 adapter JSON 的 SHA256。
- 自动生成 `adapter-registry/index.json`。
- 支持 `-NoWrite` 预览，支持 `-RegistryDir` 指定其他共享库目录。
- 输出使用 UTF-8 无 BOM，避免共享库 JSON 被额外 BOM 干扰。

已补充 `adapter-registry/README.md` 和 `docs/ADAPTER_REGISTRY.md` 的实际用法。

验证通过：

```powershell
powershell -ExecutionPolicy Bypass -File tools\update_adapter_registry_index.ps1
Get-Content adapter-registry\index.json -Raw -Encoding UTF8 | ConvertFrom-Json
```

下一步推荐：把共享库同步做成更强的“同步结果详情页/弹窗”，显示新增、更新、跳过、hash 失败、解析失败，方便发布前排查远程 registry 问题。

## 2026-06-03 共享库同步结果详情

已把 adapter registry 同步从一句“成功/失败”升级为结构化结果详情。

后端 `AdapterRegistrySyncResult` 现在返回：

- `total`：index 中总游戏数；
- `created`：本地新增的 registry adapter 数；
- `updated`：覆盖更新的 registry adapter 数；
- `skipped`：跳过数；
- `hash_failed` / `parse_failed` / `fetch_failed` / `validation_failed` / `write_failed`：失败分类计数；
- `items`：每个 adapter 的处理结果、原因、期望 hash、实际 hash、保存路径。

前端适配器管理页现在会显示同步详情表：

- 游戏；
- 新增/更新/读取失败/Hash 失败/解析失败/校验失败/写入失败；
- 失败原因；
- 期望与实际 hash；
- 写入路径；
- 原始同步日志。

这一步的产品意义：用户或管理员以后点“同步共享库”时，可以知道到底新增了什么、更新了什么、为什么某个游戏被跳过；失败时不会覆盖本地可用 adapter，也不会用一句泛泛错误掩盖内部混乱。

验证通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
```

下一步推荐：做“当前游戏上下文诊断”，让诊断报告不只全局巡检所有 adapter，也能针对用户当前选中的游戏输出更精准的能力缺口和下一步操作。

## 2026-06-03 当前游戏上下文诊断

诊断报告已从单纯全局巡检升级为支持“当前游戏上下文诊断”。

新增后端命令：

- `generate_diagnostic_report_for_game(game_id)`

当用户已经在扫描/详情/推荐流程中选中某个游戏后，诊断页会把该游戏传入后端，报告会额外生成当前游戏专属检查项：

- `selected_game_adapter_found`：当前游戏是否存在 adapter；
- `selected_game_connection_plan`：当前游戏是否已经沉淀 connection_plan；
- `selected_game_virtual_lan_ready`：该游戏所需虚拟局域网是否就绪；
- `selected_game_tcp_proxy_ready`：该游戏所需 TCP 端口代理是否就绪；
- `selected_game_udp_proxy_candidate`：该游戏是否属于 UDP 单播代理候选，以及 UDP 代理自测是否通过；
- `selected_game_udp_broadcast_bridge_ready`：该游戏所需 UDP 广播桥是否就绪；
- `selected_game_dedicated_server_ready`：该游戏所需专用服务端是否已观察到 running/ready。

新增当前游戏失败分类：

- `selected_game_adapter_missing`
- `selected_game_unknown_need_review`
- `selected_game_virtual_lan_not_ready`
- `selected_game_tcp_proxy_not_ready`
- `selected_game_udp_broadcast_bridge_not_ready`
- `selected_game_dedicated_server_not_observed`

这一步让诊断报告能回答“我现在选中的这个游戏为什么还不能联机”，而不只是回答“整个适配器库里有哪些能力缺口”。所有结论仍来自真实 n2n、代理自测、广播桥自测、服务端会话和 adapter connection_plan，不做 UI 假绿。

验证通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
```

下一步推荐：做一次发布目标完成度审计，逐项核对“发布级诊断与失败分类、适配器体系升级、游戏类型识别与方案沉淀、UDP 广播桥、UDP 端口代理”是否已有当前证据支撑；如无缺口，再考虑标记长期目标完成。

## H. 当前长期目标完成度审计（2026-06-03）

本节审计的是当前长期目标：

```text
完成发布级诊断与失败分类，游戏适配器体系升级，游戏类型识别与方案沉淀，UDP 广播桥 / UDP 端口代理
```

### H1. 发布级诊断与失败分类

当前证据：

- 后端报告模型包含 `release_checks`、`issues`、`most_likely_cause`、`next_actions`、`details`。
- `src-tauri/src/core/diagnostic_logger.rs` 已生成：
  - n2n edge / 虚拟 IP / edge 运行状态 / supernode ACK/PONG；
  - TCP 端口代理自测：`tcp_port_proxy_self_test`；
  - UDP 端口代理自测：`udp_port_proxy_self_test`；
  - UDP 广播桥自测：`udp_broadcast_bridge_self_test`；
  - 适配器需求匹配：`adapter_requirement_alignment`；
  - 当前游戏上下文检查：`selected_game_*`。
- 已有结构化失败分类：
  - n2n：edge 缺失、supernode 未配置、edge 未运行、认证错误、IP/MAC 冲突、supernode 无响应、虚拟 IP 缺失等；
  - 代理/广播桥：`tcp_proxy_self_test_failed`、`udp_proxy_self_test_failed`、`udp_broadcast_bridge_self_test_failed`；
  - adapter 全局：`adapter_virtual_lan_not_ready`、`adapter_tcp_proxy_not_ready`、`adapter_udp_broadcast_bridge_not_ready`、`adapter_dedicated_server_not_observed`、`adapter_unknown_need_review`；
  - 当前游戏：`selected_game_adapter_missing`、`selected_game_unknown_need_review`、`selected_game_virtual_lan_not_ready`、`selected_game_tcp_proxy_not_ready`、`selected_game_udp_broadcast_bridge_not_ready`、`selected_game_dedicated_server_not_observed`。

结论：当前长期目标中的“发布级诊断与失败分类”已具备代码与构建证据。

### H2. 游戏适配器体系升级

当前证据：

- `GameAdapter` 已包含 `network_type` 与 `connection_plan`。
- 适配器管理页支持按网络类型自动套用模板，覆盖 LAN/IP、专用服务端、TCP 代理、UDP 广播桥、Steam Lobby、Steam Relay、Mod、仅官方、暂不支持、未知待认定。
- 适配器同步支持 builtin / custom / registry 优先级。
- 共享库同步现在返回结构化详情：新增、更新、跳过、读取失败、Hash 失败、解析失败、字段校验失败、写入失败。
- 本地 `adapter-registry/index.json` 可由 `tools/update_adapter_registry_index.ps1` 自动生成 sha256。

结论：当前长期目标中的“游戏适配器体系升级”已完成核心闭环。

### H3. 游戏类型识别与方案沉淀

当前证据：

- 游戏扫描页对未知、缺少 `connection_plan` 或 `unknown_need_review` 的游戏显示创建 adapter 草稿入口。
- 草稿默认不伪装为已支持，而是标记为 `unknown_need_review`。
- 管理员在适配器管理页选择网络类型后，会自动生成 `connection_plan` 骨架。
- 推荐页消费 `connection_plan`，显示方案摘要、房主/加入者步骤、默认主机/端口、所需能力和执行清单。
- 当前游戏上下文诊断会按选中游戏的 `connection_plan` 输出具体缺口。

结论：当前长期目标中的“游戏类型识别与方案沉淀”已形成“扫描未知 → 创建草稿 → 管理员认定 → 方案沉淀 → 推荐页/诊断页复用”的闭环。

### H4. UDP 端口代理

当前证据：

- 后端：`src-tauri/src/core/udp_proxy.rs`。
- 模型：`src-tauri/src/models/udp_proxy.rs`。
- 命令/API：`start_udp_proxy`、`stop_udp_proxy`、`list_udp_proxies`、`get_udp_proxy_status`、`self_test_udp_proxy`。
- UI：通用组网中心已有 UDP 端口代理卡片和自测入口。
- 诊断：`udp_port_proxy_self_test` 与 `udp_proxy_self_test_failed`。
- 单元测试通过：

```powershell
cargo test --manifest-path src-tauri\Cargo.toml udp_proxy -- --nocapture
```

结论：当前长期目标中的“UDP 端口代理”已完成 MVP 能力。

### H5. UDP 广播桥

当前证据：

- 后端：`src-tauri/src/core/udp_broadcast_bridge.rs`。
- 模型：`src-tauri/src/models/udp_broadcast_bridge.rs`。
- 命令/API：`start_udp_broadcast_bridge`、`stop_udp_broadcast_bridge`、`list_udp_broadcast_bridges`、`get_udp_broadcast_bridge_status`、`self_test_udp_broadcast_bridge`。
- UI：通用组网中心已有 UDP 广播桥卡片和自测入口。
- 诊断：`udp_broadcast_bridge_self_test` 与 `udp_broadcast_bridge_self_test_failed`。
- 单元测试通过：

```powershell
cargo test --manifest-path src-tauri\Cargo.toml udp_broadcast_bridge -- --nocapture
```

结论：当前长期目标中的“UDP 广播桥”已完成 MVP 能力。

### H6. 本轮验证命令

本轮已通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
cargo test --manifest-path src-tauri\Cargo.toml port_proxy -- --nocapture
cargo test --manifest-path src-tauri\Cargo.toml udp_proxy -- --nocapture
cargo test --manifest-path src-tauri\Cargo.toml udp_broadcast_bridge -- --nocapture
```

### H7. 不纳入本长期目标完成判定的后续人工项

以下属于后续发布前人工验证或产品增强，不阻塞本长期目标的代码完成判定：

- 两台真实电脑完整加入同一局游戏；
- 不同 NAT / 不同运营商下的延迟与丢包测试；
- 每个具体游戏的 adapter 人工审核；
- Steam Relay 插件入口的真实实现；
- 更漂亮的前端视觉重构。

下一步推荐：开始新的大方向——发布前端到端人工验证与首批游戏 adapter 审核，优先用 Terraria、Minecraft Java、Stardew Valley 三个示例验证“同步共享库 → 推荐方案 → 组网/代理/广播桥 → 邀请好友包 → 诊断报告”的完整用户链路。

## 2026-06-03 发布前端到端人工验证流程

已新增 `docs/RELEASE_VALIDATION_PLAN.md`，用于把发布前验证从口头流程变成可重复执行的测试方案。

文档覆盖：

- 发布验证目标链路：同步共享库 → 扫描/选择游戏 → 匹配 adapter → 推荐方案 → 组网/代理/广播桥/服务端 → 邀请好友包 → 诊断报告 → 游戏内加入验证。
- 验证环境分级：单机可测、VPS/supernode 可测、双机可测、游戏内人工验证。
- 单机验证步骤：启动窗口检查、共享库同步详情、registry index 生成工具、TCP/UDP/广播桥自测、当前游戏上下文诊断、Terraria 服务端稳定性。
- VPS/supernode 验证步骤。
- 双机验证步骤。
- 首批 adapter 审核标准：Terraria、Minecraft Java、Stardew Valley。
- 客户端内“发布验证”页面规划：当前只做文档规划，不立刻做页面，避免在流程未跑通前新增一组空按钮。
- 发布结论模板。

同时修正侧边栏“未来功能入口”：端口代理和 UDP 广播桥已经是现有能力，不再作为未来功能展示；未来入口改为发布验证页、Mod 管理、Steam Relay 插件、supernode 管理、adapter 审核后台。

下一步推荐：按 `docs/RELEASE_VALIDATION_PLAN.md` 先执行单机验证，并把真实结果写入 `docs/RELEASE_VALIDATION_LOG.md`。

## 2026-06-03 发布验证日志：单机自动化项

已新增 `docs/RELEASE_VALIDATION_LOG.md`，开始按 `docs/RELEASE_VALIDATION_PLAN.md` 记录真实验证结果。

本轮已完成的自动化单机验证：

- registry index 生成工具：PASS；
- `adapter-registry/index.json` 解析：PASS，当前 3 个游戏；
- 前端生产构建：PASS；
- Rust 后端检查：PASS；
- TCP 端口代理单元测试：PASS；
- UDP 端口代理单元测试：PASS；
- UDP 广播桥单元测试：PASS；
- Tauri release 打包：PASS；
- `src-tauri/target/release/lan-helper.exe` 存在性：PASS。

本轮仍明确保留为待人工验证：

- release 客户端实际启动后是否无白框/透明框；
- 页面逐项打开；
- 适配器管理页同步本地示例库与 GitHub 默认共享库的 UI 明细；
- 通用组网中心里的 TCP/UDP/广播桥按钮点击体验；
- 当前游戏上下文诊断 UI；
- Terraria 服务端 30 秒稳定性；
- VPS/supernode、双机互通、游戏内加入验证。

注意：日志只记录真实执行结果，未执行的人工项不能写成通过。

下一步推荐：让用户打开 `src-tauri/target/release/lan-helper.exe` 执行单机人工验证，把结果继续填入 `docs/RELEASE_VALIDATION_LOG.md`。

## 2026-06-03 单机人工验证反馈：加载与缓存体验修复

根据人工验证反馈，已修复几个发布体验问题：

- 游戏扫描：首次扫描和手动刷新时显示加载遮罩；“开始扫描/刷新 Steam 游戏”现在调用真实扫描，不再是无反馈按钮。
- 通用组网中心：首次进入仍自动读取真实状态；之后再次进入优先显示缓存，不再每次进入都自动刷新导致卡顿，用户可点击“刷新组网状态”主动刷新。
- Terraria 向导：首次进入读取最近 supernode 和服务端会话时显示加载遮罩；之后再次进入优先显示上次缓存状态，并提供“刷新向导状态”按钮。
- 诊断报告：生成过一次后，切到其他页面再回来会保留上次诊断界面内容；清空日志才会主动清除。

产品原则：这些改动不是把内部混乱改成 UI 假显示，而是把耗时后端读取改成明确的加载态、缓存态和手动刷新入口，让用户知道什么时候在读取真实状态、什么时候显示上次状态。

验证通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
```

下一步推荐：重新打开 release 客户端，优先复测游戏扫描、通用组网中心、Terraria 向导、诊断报告四个页面的卡顿与缓存表现，并把结果补入 `docs/RELEASE_VALIDATION_LOG.md`。

## 2026-06-03 单机人工复测通过：加载与缓存体验

用户已复测并确认 4 项通过：

- 游戏扫描加载动画；
- 通用组网中心缓存与主动刷新；
- Terraria 向导缓存与刷新入口；
- 诊断报告保留上次内容。

结果已写入 `docs/RELEASE_VALIDATION_LOG.md`。

下一步推荐：进入适配器管理页同步 UI 验证，以及通用组网中心 TCP/UDP/UDP 广播桥按钮验证。

## 2026-06-03 单机人工复测通过：适配器同步、代理/广播桥、Terraria 30 秒

用户已确认以下项目通过：

- 适配器管理页同步本地示例库；
- 适配器管理页同步 GitHub 默认共享库；
- 通用组网中心 TCP 端口代理自测；
- 通用组网中心 UDP 端口代理自测；
- 通用组网中心 UDP 广播桥自测；
- Terraria 服务端 30 秒稳定性测试。

结果已写入 `docs/RELEASE_VALIDATION_LOG.md`。

下一步推荐：进入 VPS / supernode / n2n 注册验证，然后再做双机或虚拟机加入验证。

## 2026-06-03 VPS / supernode / n2n 注册验证通过

用户已确认 VPS / supernode / n2n 注册验证通过。

该阶段结果已写入 `docs/RELEASE_VALIDATION_LOG.md`，包括：

- VPS supernode 监听；
- 客户端 n2n edge 注册；
- ACK/PONG/[OK] 日志判断；
- 诊断报告 n2n 状态。

下一步推荐：进入双机或虚拟机加入验证，确认加入者使用不同虚拟 IP 后能访问房主虚拟 IP 和游戏端口。

## 2026-06-03 单机房主侧最小链路验证完成

用户已确认完成单机房主侧最小链路测试。

记录结论：

- 房主侧 n2n / supernode 链路可用；
- 房主虚拟 IP 路径可用；
- Terraria 服务端 7777 可用；
- Terraria Join via IP 加自己可用；
- 当前游戏诊断链路可用。

该结果证明房主侧最小链路可用，但不能替代真实双机/虚拟机加入者验证。

下一步推荐：如果暂时没有第二台电脑，可以开始整理首版发布说明；如果能借到电脑或开虚拟机，再补做加入者侧验证。

## 2026-06-03 首版发布说明草稿

已新增 `docs/RELEASE_NOTES_DRAFT.md`，用于对外发布前整理当前能力、验证结果和边界。

草稿明确说明：

- 当前已验证：自动化构建/测试、单机人工验证、VPS/supernode/n2n 注册、单机房主侧最小链路；
- 当前未完成：真实双机互通、Terraria 双机 Join via IP、Minecraft Java 和 Stardew Valley adapter 真实审核；
- 当前可用能力：n2n、TCP 代理、UDP 单播代理、UDP 广播桥、Terraria 服务端托管、共享适配器库、诊断报告、邀请好友包；
- 当前不承诺：所有游戏一键联机、绕过正版/反作弊/官方账号、Steam Relay 插件已可用、单机验证等同双机验证。

同时修正了 `docs/RELEASE_VALIDATION_LOG.md` 中 VPS 小节插入导致表格被打断的问题。

下一步推荐：如果暂时没有第二台电脑，先补充 README 的“当前测试版说明”和下载/运行方式；如果能进行双机测试，则继续补齐真实加入者验证。

## 2026-06-03 README 测试版说明与游戏向导分层原则

已更新 `README.md`，将公开仓库首页从简短说明升级为测试版说明，补充：

- 项目定位；
- 当前已完成能力；
- 快速开始；
- n2n / supernode 准备；
- Terraria 当前流程；
- 当前验证状态；
- 当前能力边界；
- 下一步计划。

同时明确产品原则：Terraria 向导不是每个游戏都复制一套的模式。后续采用三层结构：

1. 通用组网能力：n2n、TCP 代理、UDP 代理、UDP 广播桥、邀请包、诊断报告；
2. 游戏 adapter：用于描述大多数游戏的端口、网络类型、推荐方案和说明；
3. 少量专用向导：只给流程复杂、确实需要服务端/世界文件/配置解析的高价值游戏使用。

结论：大多数游戏应通过 adapter + 通用组网中心解决，不应该每个游戏都做独立前端页面。专用向导只作为高级封装，用在 Terraria、未来可能的 Minecraft Java 服务端流程等复杂场景。

下一步推荐：把 `docs/RELEASE_NOTES_DRAFT.md` 精简成 GitHub Release 文案，或先继续补做真实双机/虚拟机加入者验证。

## 2026-06-03 GitHub Release 文案草稿

已新增 `docs/GITHUB_RELEASE_DRAFT.md`，用于 GitHub Release 页面直接复制或二次修改。

该文案从 `docs/RELEASE_NOTES_DRAFT.md` 精简而来，重点保留：

- 0.1.0 MVP 测试版定位；
- 当前版本是什么；
- 已完成能力；
- 当前验证状态；
- 房主/加入者快速开始；
- 当前不承诺的边界；
- Terraria 向导不是每个游戏都复制一套的架构说明；
- 推荐用户反馈内容；
- 下一步计划。

产品原则继续保持：公开发布文案必须诚实表达“已验证”和“待补测”的区别，不能写成所有游戏一键联机，也不能暗示可以绕过正版、反作弊、官方账号或平台限制。

下一步推荐：准备一次正式 release 前检查：确认 `README.md`、`docs/GITHUB_RELEASE_DRAFT.md`、`docs/RELEASE_VALIDATION_LOG.md` 三者表述一致，然后决定是否打 tag / 上传 release 包。

## 2026-06-03 第一版前端说明改为面向用户

已选择性删除第一版前端中偏“给开发者/产品规划看”的说明，改成普通玩家能理解的使用说明。

本次重点修改：

- 首页删除“产品分层/架构/真实检测原则”等内部展示，改为：第一次使用步骤、房主步骤、加入者步骤、常见失败情况；
- 侧边栏减少内部术语，将“未来功能入口”改为更轻量的“后续计划”；
- Terraria 向导介绍改为房主开服和朋友加入说明，不再强调“游戏辅助层示例/MVP”；
- 通用组网中心说明改为“先让双方进入同一个虚拟局域网，再连接房主虚拟 IP”；
- 推荐方案页说明改为“下一步该做什么”，减少适配器/内部判断口吻；
- 适配器管理页首屏改名为“游戏方案库”，普通用户只需一键更新共享方案。

保留原则：功能内部仍然基于真实检测，不做 UI 假绿；但面向用户的首屏文案不再展示过多开发规划和架构说明。

下一步推荐：启动客户端人工看一遍首页、方案库、通用组网、Terraria 向导、推荐方案五个页面，确认文案没有乱码、没有过多内部术语，并且按钮路径清晰。

## 2026-06-03 使用 impeccable 优化当前前端

已按 impeccable 产品型 UI 工作流补充 `PRODUCT.md`，明确本项目默认 register 为 product，并记录用户、目的、品牌语气、反参考、设计原则和可访问性要求。

本次前端优化重点：

- 重构 `src/styles/globals.css` 为更克制、清晰、可信的产品型深色界面；
- 统一 OKLCH 颜色 token、间距、圆角、状态色、focus、disabled、loading 和 reduced motion；
- 降低装饰性阴影和过度渐变，减少“AI 生成感”；
- 移除状态卡片/结果提示中的粗侧边条样式，改用完整边框和状态底色；
- 优化桌面和窄屏响应式布局；
- 给 `index.html` 增加内联 SVG favicon，消除浏览器 favicon 404；
- 配置 `.impeccable/live/config.json`，方便后续使用 impeccable live 进行可视化迭代。

已用浏览器检查首页桌面和移动宽度：页面可打开、控制台无错误、无明显横向溢出。

下一步推荐：继续做一次页面级 polish，把“通用组网中心”和“推荐方案”里的密集配置区域改成更清晰的步骤式布局，让用户更少迷路。

## 2026-06-03 页面级 polish：组网中心与推荐方案步骤化

继续使用 impeccable 产品型 UI 原则，对“通用组网中心”和“推荐方案”做页面级 polish。

本次改动：

- 新增步骤条组件，用于在页面顶部说明当前主线流程；
- 通用组网中心顶部增加 4 步：填写房间信息、启动 n2n、复制邀请、失败时诊断；
- 推荐方案顶部增加 4 步：先组网、开游戏服务、发邀请、失败诊断；
- 推荐方案删除大段说明卡，改成更短的“开始前确认”；
- n2n 配置卡突出为“主要步骤”，高级端口代理/广播桥区域前增加“高级辅助能力”分组说明；
- 给主配置卡、步骤条、紧凑说明卡补充统一样式，保持与 PRODUCT.md 的“下一步优先、状态可信、渐进展示”原则一致。

浏览器验证：

- 通用组网中心页面可打开，步骤条显示正常；
- 推荐方案页面可打开，步骤条和开始前确认显示正常；
- 浏览器控制台无新增错误。

下一步推荐：继续做“游戏扫描”和“方案库”的空状态/加载状态 polish，让首次使用者知道没有扫描结果或同步失败时该做什么。

## 2026-06-03 使用 frontend-app-builder 重做高级交互式前端

用户明确反馈：不想要简单换颜色，而是希望重新设计一套更高级、可交互更多的新前端，并减少深蓝色使用。

本次按 frontend-app-builder 的方向重做前端体验，而不是继续单纯换色：

- 重构 `Layout` 为新的高级 App Shell：
  - 左侧导航按“开始 / 准备 / 执行 / 排查”分组；
  - 增加顶部指挥栏，显示当前页面、说明和快速操作；
  - 增加侧栏建议路径卡；
  - 整体转为石墨黑 / 暖灰 / 香槟金方向，减少深蓝使用。
- 重构 `HomePage` 为交互式任务控制台：
  - 角色切换：我是房主 / 我是加入者；
  - 联机场景选择：直接 IP 联机 / 专用服务端 / 房间列表发现；
  - 准备度圆形面板；
  - 房主/加入者动态步骤；
  - 联机拓扑图：房主、supernode、好友；
  - 准备清单卡：方案库、游戏、组网、端口；
  - 诊断入口条。
- 全局样式新增高级交互层：
  - 页面入场动效；
  - hover/active 状态；
  - 高级卡片材质；
  - details 折叠区样式；
  - 表格 hover；
  - 全局按钮、状态卡、结果卡风格统一。
- 更新 favicon 为暖金/石墨方向。

说明：当前会话没有可调用的 image_gen 工具，因此无法先生成图片概念图再实现；本次以代码原生设计系统方式完成重设计，并通过浏览器截图检查桌面与移动端。

验证：

- `npm run build` 通过；
- 首页桌面截图检查通过；
- 推荐方案页面截图检查通过；
- 移动端 390px 宽度检查无明显横向溢出。

下一步推荐：继续把“方案库、游戏扫描、诊断报告”三个页面也改成同一套高级交互模式，例如增加命令面板、筛选切换、空状态操作引导和诊断时间线。

## 2026-06-03 Stitch 高级前端提示词与后端接口整理

完成内容：

- 新增 `docs/STITCH_PREMIUM_FRONTEND_PROMPT.md`，用于让 Stitch 一次性生成完整高级前端设计；
- 新增 `docs/FRONTEND_BACKEND_API_MAP.md`，用于新前端重构后的后端 API 对接；
- 接口文档已按页面整理现有能力：
  - 首页；
  - 方案库 / 适配器管理；
  - 游戏扫描；
  - 推荐方案；
  - 通用组网中心；
  - TCP 端口代理；
  - UDP 端口代理；
  - UDP 广播桥；
  - Terraria 向导；
  - 诊断报告；
  - 设置 / 帮助。

当前阶段定位：

- 设计准备已完成；
- 后端接口梳理已完成；
- 下一步可以进入“新前端落地”：先做 App Shell 和通用组件，再逐页对接真实 API。

下一步推荐：先实现新前端的基础设施：Toast、Loading Overlay、空状态、错误卡片、状态徽章、折叠高级区、页面缓存 hooks，然后再迁移各页面。

## 2026-06-03 App Shell 视觉迁移进度

完成：

- 从用户下载的新前端中吸收 App Shell / Sidebar / Header / Toast / 基础卡片视觉方向；
- 当前项目已实现浅色 iOS/macOS 风外壳；
- 当前页面和后端逻辑未替换；
- `npm run build` 验证通过。

当前状态：

- 可以让用户先看整体效果；
- 还没有逐页迁移下载前端的页面结构；
- 还没有引入下载前端依赖；
- 还没有使用下载前端的静态假数据。

下一步推荐：如果用户认可外壳风格，继续迁移“方案库”和“游戏扫描”的页面视觉，同时接现有 `listGameAdapters`、`syncAdapterRegistry`、`scanGames`、`analyzeGame` 等真实接口。

## 2026-06-03 内容页迁移进度

完成：

- 首页浅色内容兼容覆盖；
- 方案库页面增加新版内容 Hero 和内容面板结构；
- 游戏扫描页面增加新版内容 Hero、扫描操作栏和筛选侧栏样式；
- 来源徽章改成浅色风格；
- 修复误写入 JSX 的字面量 `` `r`n ``；
- 已重新打包 release exe。

当前状态：

- 外壳和部分内容页已经是浅色 iOS/macOS 方向；
- 方案库、游戏扫描内部观感已有明显变化；
- 推荐方案、通用组网中心、Terraria 向导、诊断报告还需要继续按同一套内容视觉迁移。

下一步推荐：迁移“推荐方案 + 通用组网中心”，因为这是用户使用联机助手时最核心的执行流程。

## 2026-06-03 参考前端更新进度

用户提供新参考目录 `C:\Users\ty\Downloads\联机助手 (1)`。已完成初步检查，确认相比旧参考新增了大量功能板块。后续迁移将以新参考为准。

下一步建议：迁移“推荐方案”和“通用组网中心”内容视觉，重点参考新参考中的好友 IP 分配、邀请包、n2n 状态、高级 TCP/UDP/广播桥配置区。

## 2026-06-03 推荐方案与通用组网中心迁移进度

完成：

- 推荐方案页内容 Hero、执行清单、好友 IP 分配、邀请包预览、游戏摘要、下一步组网区域样式迁移；
- 通用组网中心内容 Hero、网络后端、n2n 配置、n2n 诊断、TCP/UDP/广播桥高级区、通用排查和手动测试样式迁移；
- 已重新打包 release exe。

下一步推荐：迁移 Terraria 向导和诊断报告两个页面，使服务端控制台和失败证据页也统一到新视觉风格。

## 2026-06-03 Terraria 向导与诊断报告迁移进度

完成：

- Terraria 向导内容 Hero、身份选择、n2n 房间配置、服务端配置、自检、邀请信息、服务端控制台样式迁移；
- Terraria 服务端控制台增加真实 `help` / `save` / `exit` 命令按钮；
- 诊断报告内容 Hero、诊断工具栏、最可能原因、失败分类、检测项时间线、详细日志样式迁移；
- 新增 Terraria/诊断页专用浅色内容样式；
- 已重新打包 release exe。

当前状态：

- App Shell、方案库、游戏扫描、推荐方案、通用组网中心、Terraria 向导、诊断报告都已进入统一浅色 iOS/macOS 风格；
- 主要核心页面的前端视觉迁移已基本完成；
- 后端调用仍保留现有真实 Tauri API。

下一步推荐：做一次全页面“前后端真实状态审查 + 发布级 UI 体验检查”，确认所有按钮、加载遮罩、缓存、失败提示、中文显示和真实状态来源都符合发布产品要求。

## 2026-06-03 真实状态审查首轮进度

完成：

- Tauri API 错误归一化；
- 游戏扫描失败反馈；
- 首页假准备度移除；
- 历史 Stitch 文档乱码修复；
- 已重新打包 release exe。

下一步推荐：继续审查 GameDetail、Layout、Recommendation、Network 页面状态文案和按钮反馈，逐个消除假状态和弱反馈。

## 2026-06-03 第二轮真实状态审查进度

完成：

- GameDetail 页加载/错误/按钮可用性修复；
- Recommendation 执行清单服务端状态降级，避免 running 假绿；
- Layout 顶部“启动组网”改为“打开组网”；
- 已重新打包 release exe。

下一步推荐：继续第三轮审查 NetworkSetup 页，重点检查 n2n、TCP/UDP 代理、广播桥的停止/刷新/失败反馈是否都能准确反映真实后端状态。

## 2026-06-03 通用组网页第三轮审查进度

完成：

- NetworkSetup 操作成功提示；
- n2n / TCP 代理 / UDP 代理 / UDP 广播桥停止按钮真实 running 控制；
- TCP/UDP/广播桥单项刷新接入加载与结果反馈；
- 已重新打包 release exe。

下一步推荐：审查 AdapterManager 与 Diagnostics 的按钮反馈、失败提示、复制异常和缓存状态。

## 2026-06-03 第四轮真实反馈审查进度

完成：

- AdapterManager 复制导出 JSON / 共享库提交说明反馈；
- Diagnostics 按游戏上下文隔离缓存；
- Diagnostics 生成、复制、清空反馈；
- 已重新打包 release exe。

下一步推荐：进行全项目总体验收审查，搜索并修复剩余直接剪贴板调用、弱按钮反馈、假绿状态。

## 2026-06-03 总体验收第五轮进度

完成：

- 全项目剪贴板调用审查；
- AdapterManager、NetworkSetup、Recommendation、Terraria 向导复制失败反馈补齐；
- Terraria `running` 状态从绿色降级；
- Diagnostics “可发布”文案降级为“核心通过”；
- 连续问号乱码搜索清理；
- 已重新打包 release exe。

下一步推荐：在 release exe 中执行发布级人工验收清单，逐页确认按钮、加载、真实后端状态和错误提示。

## 2026-06-03 发布预检入口进度

完成：

- 新增 `tools/release_preflight.ps1`；
- 新增 npm 脚本：
  - `npm run release:preflight`；
  - `npm run release:preflight:full`；
- 预检覆盖关键文档、release exe、adapter registry、连续问号乱码、静默剪贴板调用、强承诺文案；
- 已确认 `npm run release:preflight` 可正常通过。

下一步推荐：使用 release exe 做人工回放，并把实际结果记录到 `docs/RELEASE_VALIDATION_LOG.md`。

## 2026-06-03 release exe 人工回放验收阶段

完成：

- 已确认 `npm run release:preflight` 通过；
- release exe 存在；
- 关键文档、adapter registry、乱码检查、剪贴板反馈检查、强承诺文案检查均通过；
- 当前进入人工回放验收阶段。

下一步推荐：打开 release exe，按核心页面逐项测试真实交互和后端连接，不再只看前端视觉。

## 2026-06-03 加入者邀请包导入入口

本轮补齐加入者流程中的一个前后端连接缺口：好友收到房主复制的邀请包后，不应再手动拆字段填写 n2n 表单。

改动：

- `src/types/networkPreset.ts`
  - `NetworkSetupPreset` 预留 roomName、secret、supernode、localIp、peerIp 字段，便于后续从推荐页、邀请包、深链或远程配置直接带入通用组网中心。
- `src/pages/NetworkSetupPage.tsx`
  - 新增“加入者：粘贴好友邀请包自动填入”区域；
  - 支持解析“通用组网邀请”和“游戏邀请好友包”中的 community、密钥、supernode、你的虚拟 IP、房主虚拟 IP、游戏端口；
  - 导入只填表，不自动启动 n2n，避免用户未确认前改变真实运行状态；
  - 导入后提示用户确认虚拟 IP 不重复，再保存 n2n 配置并启动 edge。

意义：

- 加入者从“看到邀请说明后手动复制字段”变成“粘贴邀请包 → 自动填表 → 保存并启动”；
- 这不是假连接，而是把前端导入流程连接到已有真实 `setupNetwork('n2n')` / `startNetwork('n2n')` 后端命令；
- 为后续一键邀请包、深链、二维码、远程 adapter registry 的加入者路径预留了统一入口。

验证：

- `npm run build` 通过；
- `npm run release:preflight` 通过。

下一步推荐：补充发布回放中“加入者粘贴邀请包导入”的人工测试项，并重新完整打包 release exe。

## 2026-06-03 房主邀请与好友导入闭环优化

本轮把推荐页“复制游戏邀请好友包”和通用组网中心“加入者粘贴邀请包自动填入”串成明确闭环。

改动：

- `src/pages/RecommendationPage.tsx`
  - 复制游戏邀请好友包后，明确提示好友去“通用组网中心 → 加入者：粘贴好友邀请包自动填入”；
  - 邀请区新增“把当前邀请参数带到通用组网”按钮；
  - 从推荐页进入通用组网时，会额外带入当前 n2n community、secret、supernode、房主虚拟 IP、已选择好友虚拟 IP；
  - 如果当前邀请包未包含 n2n 密钥，会提醒好友仍需房主单独告知密钥。

意义：

- 房主路径：推荐页分配好友 IP → 复制邀请包 → 告诉好友粘贴入口；
- 好友路径：通用组网中心粘贴邀请包 → 自动填表 → 保存 n2n 配置 → 启动 edge；
- 两个页面不再是孤立功能，前端操作可以自然连接到真实 `setupNetwork('n2n')` 和 `startNetwork('n2n')` 后端流程。

下一步推荐：人工回放“房主复制邀请包 → 好友粘贴导入 → 保存 n2n 配置”的完整路径，确认字段填入和提示符合预期。

## 2026-06-03 n2n 参数前端校验与保存启动一致性

本轮修复通用组网中心一个前后端连接风险：前端表单参数明显无效时不应继续调用真实 n2n 后端；用户改了表单后也不应直接用旧配置启动 edge。

改动：

- `src/pages/NetworkSetupPage.tsx`
  - 新增 n2n 表单校验：community、密钥、supernode、本机虚拟 IP 必填；
  - 校验本机虚拟 IP / 对方虚拟 IP 是否像 IPv4；
  - 阻止本机虚拟 IP 与对方 / 房主虚拟 IP 相同；
  - 有错误时显示“n2n 配置需要先修正”，并禁用保存/启动按钮；
  - “启动 n2n edge”改为“保存并启动 n2n edge”：先把当前表单提交给 `setupNetwork('n2n')`，再调用 `startNetwork('n2n')`；
  - 避免用户看到的是新参数，但后端实际启动旧配置。

意义：

- 前端不会把明显无效配置交给真实后端；
- 加入者从邀请包导入后，可以直接“保存并启动”，不会因为忘记先保存而启动旧 room/secret/supernode；
- 这提升了前端表单状态和 Tauri 后端运行状态的一致性。

下一步推荐：人工测试通用组网中心：清空 supernode、本机 IP 填错、本机 IP 和房主 IP 相同，确认保存/启动按钮禁用且提示准确；再填入正确配置测试“保存并启动 n2n edge”。

## 2026-06-03 游戏扫描页共享方案库入口修复

本轮修复一个前端假按钮/弱连接问题：游戏扫描页原本显示“同步共享库请到适配器管理”，但按钮处于禁用状态，用户看得到却不能点击。

改动：

- `src/pages/GameScanPage.tsx`
  - 将禁用的“同步共享库请到适配器管理”改为可点击的“去同步共享方案库”；
  - 点击后跳转到已有“方案库 / 适配器管理”页面；
  - 该页面已经连接真实后端 `syncAdapterRegistry` / `syncLocalAdapterRegistryExample`，所以扫描页不重复调用同步后端，只作为明确入口；
  - 增加说明：共享方案库的真实同步在方案库页面执行。

意义：

- 减少发布版中的“看起来能点但实际禁用”的假入口；
- 让“游戏扫描 → 方案库同步 → 回来重新扫描”的路径更顺；
- 保持单一真实后端入口，避免同一同步逻辑在多个页面重复实现。

下一步推荐：继续审查剩余禁用按钮，特别是“选择目录（规划中）”是否需要改成明确未来能力说明，避免用户误以为功能坏了。

## 2026-06-03 游戏扫描页手动目录占位清理

本轮继续清理发布版前端中的“看起来像按钮但没有真实后端支撑”的入口。

改动：

- `src/pages/GameScanPage.tsx`
  - 将禁用按钮“选择目录（规划中）”改为非按钮标签“手动选择目录：未来能力”；
  - 增加说明：当前版本扫描来自真实后端的 Steam 库、内置适配器、共享库和本地 custom adapter；
  - 明确手动选择任意目录尚未接入 Tauri 后端命令，所以不显示成可点击按钮。

意义：

- 避免用户误以为“选择目录”按钮坏了；
- 保持前端原则：没有真实后端支撑的功能不伪装成可操作按钮；
- 后续如果要做该能力，应新增 Tauri 目录选择/路径扫描命令后再恢复为真实按钮。

下一步推荐：继续扫描其他页面的“未来入口/预留入口”，保留说明型内容，但不要让它们像已经可用的主流程按钮。

## 2026-06-03 参考前端结构级迁移

本轮完成一轮面向发布版本的前端结构级重做。

完成范围：

- App Shell：
  - 浅色固定 Sidebar；
  - 顶部 Topbar；
  - 全局深色 Toast；
  - 中文导航和用户面向说明。
- 首页：
  - 桌面大厅；
  - Host / Joiner 角色切换；
  - 网络拓扑状态；
  - 主面板检查单。
- 游戏扫描：
  - 参考图式标题栏；
  - 搜索和快速分类视觉；
  - 扫描工具栏；
  - 游戏卡片画廊样式。
- 通用组网中心：
  - 左侧状态轨道；
  - 右侧 n2n 基础参数；
  - 下方高级辅助能力保留真实按钮和后端调用。
- 诊断报告：
  - 左侧失败分类和检测项时间线；
  - 右侧深色 N2N 监测卡；
  - 报告内容继续来自真实 Tauri 后端。

验证结果：

- `npm run build`：通过；
- `cargo check --manifest-path src-tauri\Cargo.toml`：通过；
- `npm run tauri:build`：通过；
- `npm run release:preflight`：通过；
- `git diff --check`：通过。

下一步推荐：继续把“推荐方案、适配器管理、Terraria 向导”的页面内部布局统一到新视觉系统；之后再做 release exe 人工七页走查。

## 2026-06-04 参考前端一比一复原接入

本轮调整开发路线：停止在旧页面上做“近似参考风格”的 CSS 修补，改为直接接入用户提供的参考前端源码。

完成内容：

- 新增 `src/reference-ui/`：
  - `App.tsx`
  - `components/*`
  - `data.ts`
  - `types.ts`
  - `index.css`
- 当前入口 `src/main.tsx` 改为渲染 `src/reference-ui/App`；
- `vite.config.ts` 接入 `@tailwindcss/vite`；
- `package.json` / `package-lock.json` 增加参考 UI 所需依赖：
  - `lucide-react`
  - `motion`
  - `@tailwindcss/vite`
- 保留原真实后端页面和 Tauri API，等待下一阶段映射到参考 UI。

验证结果：

- `npm run build`：通过；
- `cargo check --manifest-path src-tauri\Cargo.toml`：通过；
- `npm run tauri:build`：通过；
- `npm run release:preflight`：通过；
- `git diff --check`：通过。

当前状态：

- 当前项目已经显示参考项目的一比一前端；
- 与参考源码的唯一视觉无关差异是 `reference-ui/main.tsx` 的导入后缀兼容；
- 真实后端尚未接回参考 UI，参考 UI 里的模拟状态需要在下一阶段替换。

下一步推荐：做“参考 UI 后端适配层”，优先接入游戏扫描、适配器同步、n2n 状态、Terraria 服务端和诊断报告。

## 2026-06-04 参考 UI 真实后端适配第一轮

本轮继续用户要求的“完全实现参考前端效果”，不再只换颜色。

完成内容：

- 保持 `src/reference-ui/App` 作为当前真实入口，继续使用用户提供的参考前端结构、Sidebar、Header、Toast、卡片布局和动效；
- `src/reference-ui/App.tsx`
  - 接入真实 n2n 诊断、最近配置、后端列表和 Terraria 后台服务端会话；
  - 顶部状态不再默认 online/24ms，改为根据真实 `getN2nDiagnostics()` 派生；
  - 全局“启动/停止组网”走真实 `setupNetwork/startNetwork/stopNetwork`。
- `HomeView / Header`
  - 移除假就绪、假延迟和固定“环境就绪”类文案；
  - 首页显示真实 supernode、虚拟 IP 和诊断摘要，未知时显示待诊断。
- `GameScanView`
  - 从参考 UI 的假游戏列表改为真实 `scanGames()`；
  - 根据后端游戏分析/适配信息映射卡片状态。
- `SolutionsView`
  - 从假方案列表改为真实 `listGameAdapters()`；
  - 同步按钮接入 `syncAdapterRegistry()` 和本地示例同步；
  - 默认共享库地址使用当前 GitHub Pages/raw registry 地址。
- `UniversalNetworkView`
  - 去掉 `isRunning=true`、`24ms`、假保存、假代理规则；
  - n2n 启停和保存配置接入真实后端；
  - TCP 端口代理、UDP 端口代理、UDP 广播桥规则接入真实后端进程列表和启动/停止 API。
- `TerrariaGuideView`
  - 启动/停止服务端接入 `startGameServerSession/readServerSession/stopServerSession`；
  - 内嵌日志显示真实后台会话日志；
  - 控制台命令改为真实 `sendServerCommand()` 尝试发送，不再前端模拟 help/save/exit 成功；
  - 自检改为真实 `testConnectivity()` 端口检测；
  - 去掉固定 `12ms` 和 `0.0%`。
- `DiagnosticsView`
  - 去掉固定 `INITIAL_DIAGNOSTICS`、`RAW_JSON_REPORT` 和假“一键修复成功”；
  - 改为真实 `generateDiagnosticReport()` + `getN2nDiagnostics()`；
  - “修复”改成处理建议入口，避免假修复。

验证：

- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

下一步推荐：用 release 版 `src-tauri\target\release\lan-helper.exe` 做参考 UI 七页人工走查，重点点一遍组网中心、Terraria 向导和诊断页，确认真实 Tauri 后端环境下按钮、Toast、日志和状态变化符合预期。

## 2026-06-04 参考前端一比一复原路线修正

本轮根据用户目标重新校正路线：用户要求“完全按照 `C:\Users\ty\Downloads\联机助手 (1)` 一比一复原，完全复原之后再做前后端连接”。

问题发现：

- 上一轮虽然已经使用 `src/reference-ui/App` 作为入口，但为了接真实后端，直接修改了 `src/reference-ui` 内的 8 个视觉组件；
- 这导致当前项目已经不是参考源码级一比一，偏离文件包括：
  - `App.tsx`
  - `Header.tsx`
  - `HomeView.tsx`
  - `GameScanView.tsx`
  - `SolutionsView.tsx`
  - `UniversalNetworkView.tsx`
  - `TerrariaGuideView.tsx`
  - `DiagnosticsView.tsx`

本轮处理：

- 从 `C:\Users\ty\Downloads\联机助手 (1)\src` 重新复制上述 8 个文件到 `src/reference-ui`；
- 保留 `src/main.tsx` 使用 `src/reference-ui/App` 作为当前项目入口；
- 仅保留 `src/reference-ui/main.tsx` 的构建兼容差异：`./App.tsx` 改为 `./App`，该文件不是当前项目入口，不影响视觉；
- 清理参考源码带来的行尾空格和 EOF 空白行，保证 `git diff --check` 通过；
- 不再把真实后端逻辑直接写入参考视觉组件。

复核证据：

- 对 `src/reference-ui` 与 `C:\Users\ty\Downloads\联机助手 (1)\src` 做源码复核：
  - `App.tsx`、全部核心组件、`index.css`、`data.ts`、`types.ts` 均为视觉等价；
  - 仅 `main.tsx` 存在导入后缀兼容差异；
- 浏览器打开 `http://127.0.0.1:5177/` 后，实际渲染为参考 UI 首页：Sidebar、Header、Toast 结构和“桌面大厅 / 就绪: 24ms / 断开物理网”等参考文案均出现；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

后续原则：

- 当前阶段先保证前端一比一；
- 后端连接必须在视觉复原确认后再做；
- 后续接后端时优先新增 adapter/hook/state bridge，避免直接破坏 `src/reference-ui` 的 DOM、布局、类名和交互结构；
- 如果为了真实状态必须替换假文案，应先确认不会影响一比一视觉，或者单独建立“产品化版本”分支/阶段。

下一步推荐：给 `src/reference-ui` 建立一个“参考 UI 锁定清单”和后端适配方案文档，明确哪些文件必须保持视觉等价，后端数据从哪里注入，避免再次把一比一参考前端改乱。

## 2026-06-04 Reference UI 锁定清单与一致性检查脚本

本轮在“一比一复原参考前端”的基础上新增保护机制，防止后续接后端时再次把参考 UI 改乱。

新增文件：

- `docs/REFERENCE_UI_LOCK_AND_BACKEND_PLAN.md`
  - 记录当前 reference-ui 的锁定边界；
  - 明确哪些文件是用户参考前端的视觉权威；
  - 明确后端连接不应直接污染 `src/reference-ui`；
  - 规划后续通过 `src/reference-adapter/` 做状态桥接和动作包装；
  - 给出后端接入顺序、风险点和发布验证要求。
- `tools/check_reference_ui_fidelity.ps1`
  - 自动对比 `C:\Users\ty\Downloads\联机助手 (1)\src` 与 `src/reference-ui`；
  - 忽略行尾空格和空白行；
  - 输出 `visual_diff_count=0` 时说明视觉源码等价；
  - 后续每次改前端或接后端前后都应运行。

验证：

- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，输出 `visual_diff_count=0`；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

关键原则：

- 当前阶段：优先保证参考前端一比一；
- 下一阶段：接后端时新增 adapter/hook/state bridge，不直接大改 reference-ui；
- 如果未来要把 `24ms`、`已连接`、假方案列表等替换成真实状态，需要作为“产品化阶段”处理，并重新确认是否允许偏离参考图。

下一步推荐：开始创建 `src/reference-adapter/` 最小桥接层，先只读取真实后端状态并在不改变参考 UI 视觉的前提下验证数据可用，然后再决定哪些参考文案进入产品化替换。

## 2026-06-04 Reference Adapter 最小后端桥接层

本轮开始执行“完全一比一复原后再做前后端连接”的下一阶段，但继续遵守 reference-ui 锁定规则：不直接修改 `src/reference-ui` 任何视觉组件。

新增目录：

- `src/reference-adapter/`

新增文件：

- `src/reference-adapter/types.ts`
  - 定义 `ReferenceRuntimeSnapshot` 和 `ReferenceStatusSummary`；
  - 用统一快照承载 n2n、后端列表、游戏扫描、适配器列表、Terraria 会话和诊断报告。
- `src/reference-adapter/runtimeStore.ts`
  - 读取真实 Tauri 后端：
    - `getN2nDiagnostics()`
    - `getN2nLastConfig()`
    - `listNetworkBackends()`
    - `scanGames()`
    - `listGameAdapters()`
    - `readServerSession()`
    - 可选 `generateDiagnosticReport()`
  - 每个调用独立捕获错误，避免普通浏览器预览时直接破坏界面。
- `src/reference-adapter/mappers.ts`
  - 将真实快照映射成摘要结构；
  - 提供调试输出 `snapshotForDebug()`。
- `src/reference-adapter/bootstrap.ts`
  - 提供 `startReferenceRuntimeBridge()`；
  - 后台每 5 秒读取一次真实后端快照；
  - 写入 `window.__LAN_HELPER_REFERENCE_RUNTIME__`；
  - 发出 `lan-helper:reference-runtime-updated` 事件；
  - 不改变页面视觉，不向用户显示任何状态。
- `src/reference-adapter/globals.d.ts`
  - 声明全局调试快照字段。
- `src/reference-adapter/index.ts`
  - 统一导出 adapter 能力。

入口改动：

- `src/main.tsx`
  - 在渲染参考 UI 前调用 `startReferenceRuntimeBridge()`；
  - 仍然渲染 `src/reference-ui/App`；
  - 不修改 reference-ui DOM、class、布局或文案。

验证：

- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，`visual_diff_count=0`；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

意义：

- 这是前后端连接的第一步，但目前是“不可见桥接”；
- 它证明真实后端数据可以在不破坏参考 UI 一比一视觉的情况下被读取；
- 后续可以逐步把参考 UI 的状态从 adapter 注入，但每一步都要先跑 reference-ui fidelity check。

下一步推荐：新增一个开发者专用的运行时调试入口，例如隐藏快捷键或设置页内部调试面板，用来查看 `window.__LAN_HELPER_REFERENCE_RUNTIME__`，仍不改变用户主界面；确认后再开始把 Header/首页状态接入真实数据。

## 2026-06-04 Reference Runtime 隐藏调试入口

本轮继续做“复原后再接后端”的准备工作：新增隐藏式 runtime 调试面板，用来查看上一轮 `src/reference-adapter/` 采集到的真实后端快照。

新增/修改：

- `src/reference-adapter/DebugPanel.tsx`
  - 默认返回 `null`，不会改变用户看到的参考前端；
  - 按 `Ctrl+Shift+D` 才显示调试面板；
  - 面板展示 `window.__LAN_HELPER_REFERENCE_RUNTIME__` 的摘要和调试 JSON；
  - 可查看 n2n running/ready、virtual_ip、supernode、Terraria session、game_count、adapter_count、release_ready、错误摘要等。
- `src/reference-adapter/index.ts`
  - 导出 `ReferenceRuntimeDebugPanel`。
- `src/main.tsx`
  - 在 `App` 后挂载 `<ReferenceRuntimeDebugPanel />`；
  - 不修改 `src/reference-ui` 的任何组件、DOM、class、布局、文案或数据。

验证：

- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，`visual_diff_count=0`；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

意义：

- 默认用户界面仍保持参考前端一比一；
- 开发时可以用隐藏入口确认真实后端快照是否存在；
- 下一步可以基于该快照开始做产品化状态注入，但必须逐项确认是否允许偏离参考图。

下一步推荐：先在 release 版里按 `Ctrl+Shift+D` 检查调试面板是否能看到真实 runtime 快照；确认后再开始做 Header/首页状态的产品化接入方案。

## 2026-06-04 Reference Adapter 后端动作层

本轮继续在不改动 `src/reference-ui` 的前提下推进前后端连接。

新增：

- `src/reference-adapter/actions.ts`
  - 封装真实后端动作：
    - `refreshReferenceRuntime()`
    - `saveReferenceN2nConfig()`
    - `startReferenceN2n()`
    - `stopReferenceN2n()`
    - `startReferenceTerrariaServer()`
    - `stopReferenceTerrariaServer()`
    - `readReferenceTerrariaServer()`
    - `sendReferenceTerrariaCommand()`
    - `testReferenceConnectivity()`
    - `generateReferenceDiagnostics()`
  - 每个动作执行后都会重新读取 `ReferenceRuntimeSnapshot`；
  - 动作结果统一为 `ReferenceActionResult`，方便后续 UI 接入。
- `src/reference-adapter/DebugPanel.tsx`
  - 隐藏调试面板新增“安全动作”区域；
  - 支持刷新快照、生成诊断、读取 Terraria 会话、停止 n2n、停止 Terraria 服务端；
  - 只在 `Ctrl+Shift+D` 打开的调试面板中可见，默认用户界面不变。
- `src/reference-adapter/index.ts`
  - 导出动作层 API。

验证：

- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，`visual_diff_count=0`；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

意义：

- 后端动作能力已经有统一 adapter，不再需要直接写进参考 UI 组件；
- 默认界面仍然完全保持参考前端视觉；
- 下一步可以选择从 Header 或首页开始做“产品化状态接入”，但需要明确接受会替换参考图里的假状态文案。

下一步推荐：先用 release 版 `Ctrl+Shift+D` 手动验证调试面板动作按钮，确认真实后端快照与安全动作可用；之后再决定是否进入 Header/首页真实状态替换阶段。

## 2026-06-04 Reference Runtime Hook 与 Selectors

本轮继续为“参考前端一比一复原之后再接后端”搭建可复用接口，仍不修改 `src/reference-ui`。

新增：

- `src/reference-adapter/selectors.ts`
  - `getCurrentReferenceRuntimeSnapshot()`
  - `getCurrentReferenceStatusSummary()`
  - `subscribeReferenceRuntime()`
  - `selectReferenceNetworkStatus()`
  - `selectReferenceTerrariaStatus()`
  - `selectReferenceLibraryStatus()`
- `src/reference-adapter/useReferenceRuntime.ts`
  - React hook，订阅 `lan-helper:reference-runtime-updated` 事件；
  - 输出 snapshot、summary、debug、network、terraria、library、loaded、source、errors；
  - 后续 Header/首页/诊断页产品化接入时，应优先使用该 hook，而不是把 Tauri API 直接写进 reference-ui 组件。
- `src/reference-adapter/index.ts`
  - 统一导出 hook 和 selectors。

验证：

- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，`visual_diff_count=0`；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

意义：

- 后端状态现在有了稳定的前端订阅接口；
- reference-ui 默认视觉仍然和用户参考目录保持等价；
- 下一步如果进入真实状态替换，可以先做 wrapper 或受控注入，避免直接污染 reference-ui。

下一步推荐：新增“产品化接入开关”设计，默认关闭以保持一比一参考 UI；开启后再让 Header/首页从 `useReferenceRuntime()` 读取真实状态。

## 2026-06-04 Reference Product Mode 产品化接入开关

本轮新增“产品化接入开关”，用于区分两个阶段：

- reference mode：默认模式，保持 `src/reference-ui` 与用户参考前端一比一；
- product mode：后续实验模式，允许 wrapper 或 adapter 读取真实 runtime 状态并逐步替换参考图里的模拟状态。

新增：

- `src/reference-adapter/productMode.ts`
  - `getReferenceProductMode()`
  - `setReferenceProductMode()`
  - `subscribeReferenceProductMode()`
  - `REFERENCE_PRODUCT_MODE_EVENT`
  - 使用 `localStorage` 持久化，key 为 `lan-helper.referenceProductMode`；
  - 默认关闭。
- `src/reference-adapter/useReferenceProductMode.ts`
  - React hook，返回 `enabled`、`updated_at`、`setEnabled()`、`toggle()`。
- `src/reference-adapter/globals.d.ts`
  - 增加 `window.__LAN_HELPER_REFERENCE_PRODUCT_MODE__` 类型声明。
- `src/reference-adapter/DebugPanel.tsx`
  - 在隐藏调试面板加入“产品化接入开关”；
  - 按 `Ctrl+Shift+D` 才能看到；
  - 默认关闭，不影响用户默认参考界面。
- `src/reference-adapter/index.ts`
  - 导出 product mode API。

验证：

- `npm run build` 通过；
- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，`visual_diff_count=0`；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

意义：

- 默认用户界面仍完全按参考前端显示；
- 后续真实状态接入必须先检查 product mode，避免无意中破坏“一比一复原”；
- 用户如果明确进入产品化阶段，再开启该开关并逐步接 Header/首页/诊断页真实数据。

下一步推荐：实现一个 product-mode wrapper 原型。默认 reference mode 下不改变 UI；product mode 开启时，先只替换 Header 顶部状态文字为真实 runtime 状态，验证这种接入方式是否可接受。

## 2026-06-04 Product Mode Header 状态 Patcher 原型

本轮实现第一个产品化接入原型：默认 reference mode 下完全不改界面；只有隐藏调试面板开启 product mode 后，才把 Header 顶部状态文字替换为真实 runtime 状态。

新增/修改：

- `src/reference-adapter/ProductHeaderPatcher.tsx`
  - 不修改 `src/reference-ui/components/Header.tsx`；
  - 默认 product mode 关闭时不改变任何视觉；
  - product mode 开启时，通过 DOM patch 找到 Header 状态 span；
  - 将参考图中的 `就绪: 24ms` / `网络连接中...` 替换为：
    - `真实状态: 读取中`
    - `真实状态: n2n 已连接`
    - `真实状态: n2n 运行中`
    - `真实状态: 需诊断`
    - `真实状态: 未组网`
  - 关闭 product mode 后恢复参考 UI 原文。
- `src/main.tsx`
  - 在 `<App />` 后挂载 `<ReferenceProductHeaderPatcher />`；
  - 仍不触碰 reference-ui 组件源码。
- `src/reference-adapter/index.ts`
  - 导出 `ReferenceProductHeaderPatcher`。

验证：

- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，`visual_diff_count=0`；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

边界：

- 默认 reference mode 仍然是用户要求的一比一前端；
- product mode 是实验/产品化通道，用于逐步接真实后端状态；
- 该方案刻意不改 reference-ui，避免破坏后续的一致性检查。

下一步推荐：在 release 版中按 `Ctrl+Shift+D` 开启 product mode，确认 Header 状态文字是否能根据真实 runtime 改变；确认后再考虑首页局部状态的 product-mode patcher。

## 2026-06-04 Product Mode 首页状态 Patcher 原型

本轮实现第二个产品化接入原型：默认 reference mode 下首页完全保持用户参考前端一比一；只有隐藏调试面板开启 product mode 后，才替换首页局部假状态文案。

新增/修改：

- `src/reference-adapter/ProductHomePatcher.tsx`
  - 不修改 `src/reference-ui/components/HomeView.tsx`；
  - 默认 product mode 关闭时恢复/保持参考 UI 原文；
  - product mode 开启时，通过 DOM patch 替换首页局部状态：
    - `虚拟服主在线` -> 真实组网状态；
    - `24ms` -> `ACK` / `RUN` / `待测`；
    - `n2n.edge.me:7777` -> 真实 supernode 或未配置；
    - 检查单中的网卡、网络、supernode 说明 -> 真实 runtime 摘要。
- `src/main.tsx`
  - 在 `<App />` 后挂载 `<ReferenceProductHomePatcher />`；
  - 仍不触碰 reference-ui 组件源码。
- `src/reference-adapter/index.ts`
  - 导出 `ReferenceProductHomePatcher`。

验证：

- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，`visual_diff_count=0`；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

边界：

- 默认 reference mode 仍是用户要求的一比一前端；
- product mode 是实验/产品化通道，用来验证真实状态接入是否可接受；
- 所有替换都在 adapter wrapper 层完成，不污染 `src/reference-ui`。

下一步推荐：在 release 版中开启 product mode，确认 Header 和首页状态替换是否符合预期；之后再考虑对“诊断页”做 product-mode 数据接入，而不是继续扩大 DOM patch 范围。

## 2026-06-04 Product Mode 诊断页状态 Patcher 原型

本轮实现第三个产品化接入原型：默认 reference mode 下诊断页完全保持用户参考前端一比一；只有隐藏调试面板开启 product mode 后，才把诊断页局部假状态/JSON 替换成真实 runtime 快照摘要。

新增/修改：

- `src/reference-adapter/ProductDiagnosticsPatcher.tsx`
  - 不修改 `src/reference-ui/components/DiagnosticsView.tsx`；
  - 默认 product mode 关闭时恢复/保持参考 UI 原文；
  - product mode 开启时，通过 DOM patch 替换诊断页局部内容：
    - `14.85 Mbps` -> `ACK/PONG OK` / `RUNNING` / `STOPPED`；
    - `24.5 ms` -> ACK 状态；
    - `1.22 ms` -> PONG 状态；
    - `0.00 %` -> 真实虚拟 IP；
    - `1400 bytes` -> supernode 配置状态；
    - n2n 客户端/节点说明 -> 真实运行状态和 supernode；
    - 原始 JSON `<pre>` -> `snapshotForDebug()` 的真实调试 JSON；
    - 检测代码和部分证据说明 -> runtime 摘要。
- `src/main.tsx`
  - 在 `<App />` 后挂载 `<ReferenceProductDiagnosticsPatcher />`；
  - 仍不触碰 reference-ui 组件源码。
- `src/reference-adapter/index.ts`
  - 导出 `ReferenceProductDiagnosticsPatcher`。

验证：

- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，`visual_diff_count=0`；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

边界：

- 默认 reference mode 仍是用户要求的一比一前端；
- product mode 是实验/产品化通道，用于逐步验证真实状态接入；
- 所有替换都在 adapter wrapper 层完成，不污染 `src/reference-ui`。

下一步推荐：停止继续扩大 DOM patch 范围，先用 release 版手动验证 product mode 下 Header、首页、诊断页三处状态替换。如果体验可接受，再正式决定是否进入“产品化 UI 状态接入”阶段；否则保持 reference mode 作为默认发布界面。

## 2026-06-04 Reference/Product Mode 手动验证文档

本轮停止继续扩大 DOM patch 范围，转入验证阶段。

新增：

- `docs/REFERENCE_PRODUCT_MODE_VALIDATION.md`

文档内容：

- release 版启动方式；
- 默认 reference mode 验证项：
  - Header 应保持 `就绪: 24ms` / `断开物理网`；
  - 首页应保持 `桌面大厅`、`75%`、`虚拟服主在线`、`24ms`、`n2n.edge.me:7777` 等参考文案；
  - 诊断页应保持 `14.85 Mbps`、`24.5 ms`、`1.22 ms`、`0.00 %`、`1400 bytes`、`N2N_D_CODE_301XT` 等参考文案。
- 隐藏调试面板打开方式：`Ctrl + Shift + D`；
- product mode 验证项：
  - Header 状态应替换为真实状态；
  - 首页拓扑和检查单应替换为真实 runtime 摘要；
  - 诊断页右侧 N2N 卡和 JSON 区域应替换为真实 runtime debug JSON；
- 关闭 product mode 后应恢复参考文案；
- 失败记录模板。

验证：

- `powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1` 通过，`visual_diff_count=0`；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `npm run release:preflight` 通过；
- `git diff --check` 通过。

下一步推荐：按 `docs/REFERENCE_PRODUCT_MODE_VALIDATION.md` 用 release 版做一次人工验证。只有 Header、首页、诊断页三处 product mode 替换体验确认可接受后，再进入正式产品化 UI 状态接入阶段。

## 2026-06-04 参考前端运行态样式修复

本轮继续审计用户目标“完全按照 `C:\Users\ty\Downloads\联机助手 (1)` 一比一复原”。发现关键差距：源码一致性通过，但运行态截图曾显示为裸 HTML，说明 Tailwind utility 没有生成，用户看到的界面仍会很丑。

修复内容：

- 新增 `src/reference-runtime.css`，显式让 Tailwind 扫描 `src/reference-ui/**/*.{ts,tsx}` 和 `src/reference-adapter/**/*.{ts,tsx}`；
- `src/main.tsx` 改为导入 `./reference-runtime.css`，不再直接导入 `./reference-ui/index.css`；
- `src/reference-ui` 本身不改，继续保持与参考源码一比一；
- `tools/release_preflight.ps1` 新增运行态样式防退化检查，避免再次出现“源码一比一但页面裸奔”。

运行态验证：浏览器打开本地 Vite 后，`.fixed.left-0` 已恢复 `position=fixed`，Sidebar 宽度为 `260px`，`.flex` 为 `display:flex`，截图已恢复参考前端侧栏、顶部栏、卡片布局和橙色高级感风格。

验证结果：`tools/check_reference_ui_fidelity.ps1`、`npm run build`、构建 CSS 哨兵、`cargo check`、`npm run tauri:build`、`npm run release:preflight`、`git diff --check` 均通过。

下一步推荐：用 release 版逐页人工验收视觉；确认满意后，再进入正式前后端连接阶段，优先继续使用 `src/reference-adapter` 的 product mode 接入方式。
## 2026-06-04 参考前端构建 CSS 哨兵

本轮继续加强“一比一复原”验证：源码一致和 `@source` 存在仍不足以证明用户看到的页面有样式，因此新增构建产物 CSS 哨兵。

已完成：

- 新增 `tools/check_reference_runtime_css.ps1`；
- 检查 `dist/assets/*.css` 中是否包含参考前端必需 Tailwind utility：`.flex`、`.fixed`、`.grid`、`.min-h-screen`、`.bg-slate-50`、`.text-slate-800`、`.rounded-2xl`、`.shadow-sm`；
- `tools/release_preflight.ps1` 已接入该哨兵；
- 如果以后 Tailwind 没扫描 `src/reference-ui`，导致页面再次变成裸 HTML，发布预检会失败。

验证结果：`tools/check_reference_ui_fidelity.ps1`、`npm run build`、`tools/check_reference_runtime_css.ps1`、`cargo check`、`npm run release:preflight`、`git diff --check` 均通过。

下一步推荐：继续做逐页运行态验收，确认首页、方案库、游戏扫描、推荐方案、通用组网中心、Terraria 向导、诊断报告、设置与帮助都不再出现裸 HTML 或旧前端残留。
## 2026-06-04 参考前端逐页运行态验收

本轮在修复 Tailwind 运行态样式后，继续用浏览器逐页验收参考前端，不只检查源码一致性。

验收页面：

- 首页；
- 方案库；
- 游戏扫描；
- 推荐方案；
- 通用组网中心；
- Terraria 向导；
- 诊断报告；
- 设置与帮助。

浏览器运行态检查结果：

- 每个页面 CSS 均包含 `.flex`、`.fixed`、`.grid`；
- Sidebar 均为 `position=fixed`，宽度 `260px`；
- `main` 区域左边距为 `260px`；
- 每页均存在参考前端卡片圆角结构；
- 隐藏调试面板没有外露；
- 未发现旧前端残留文案，例如“联机向导里的所有按钮”“好友连接检测入口”“n2nedge无检测到”。

结论：当前运行态已恢复为参考前端的侧栏、顶部栏、卡片布局和橙色高级感风格；“裸 HTML/只换颜色”的问题已消除。

下一步推荐：由用户打开 release 版做主观视觉确认。如果确认满意，再进入正式前后端连接阶段；默认仍应保持 reference mode 一比一，真实状态接入走 `src/reference-adapter`。
## 2026-06-04 Product Mode 首批真实动作接入

本轮在“一比一参考前端已恢复并通过运行态验收”的前提下，开始第二阶段前后端连接，但仍保持默认 reference mode 不破坏参考 UI。

已完成：

- 新增 `src/reference-adapter/ProductActionPatcher.tsx`；
- 默认 reference mode 下不拦截任何按钮，参考前端仍按原模拟交互运行；
- 只有开启 product mode 后，才把部分参考 UI 按钮拦截到真实 Tauri 后端动作；
- 挂载入口加入 `src/main.tsx`，导出加入 `src/reference-adapter/index.ts`。

首批接入按钮：

- 通用组网中心：
  - `保存基础参数` -> `saveReferenceN2nConfig()`；
  - `Start n2n Edge` -> `startReferenceN2n()`；
  - `Stop n2n Edge` -> `stopReferenceN2n()`；
  - `Refresh Node Status` -> 当前先触发真实 n2n 启动/刷新路径；
- Terraria 向导：
  - `启动自建服务` -> `startReferenceTerrariaServer()`；
  - `停止服务` -> `stopReferenceTerrariaServer()`；
  - `一键自检` -> `readReferenceTerrariaServer()`；
- 诊断报告：
  - `手动强制重扫 (刷新缓存)` -> `generateReferenceDiagnostics()`。

浏览器验证：

- reference mode 下：通用组网页面 `data-lan-helper-action-hooked` 数量为 0，未出现 Product Mode 提示，Sidebar 仍为 `position=fixed`；
- product mode 下：
  - 通用组网中心稳定挂载 `network-start-n2n`、`network-stop-n2n`、`network-refresh-runtime`、`network-save-config`；
  - Terraria 向导稳定挂载 `terraria-start-server`、`terraria-stop-server`、`terraria-read-server`；
  - 诊断报告稳定挂载 `diagnostics-generate`；
- 在普通浏览器预览中点击 `保存基础参数` 会显示真实后端失败/未连接 Tauri 后端提示，证明按钮已走真实后端路径，而不是继续执行参考 UI 的 setTimeout 模拟成功。

产品边界：product mode 仍是实验/产品化通道；默认发布界面必须保持 reference mode，一比一视觉优先。下一步如果用户确认视觉满意，可以继续扩展动作接入到游戏扫描、方案库同步、邀请包复制等功能。
## 2026-06-04 Product Mode 第二批真实动作接入

本轮继续“完全一比一复原之后再做前后端连接”的第二阶段：默认 reference mode 仍不改、不拦截、不破坏参考前端；仅在 product mode 下把更多按钮接入真实 Tauri 后端。

新增后端动作封装：

- `scanReferenceGames()` -> `scanGames()`；
- `syncReferenceLocalAdapterRegistry()` -> `syncLocalAdapterRegistryExample()`；
- `syncReferenceAdapterRegistry(url)` -> `syncAdapterRegistry(url)`；
- `readReferenceN2nLastConfig()` -> `getN2nLastConfig()`。

新增 product mode 按钮接入：

- 游戏扫描：
  - `手动重扫以刷新缓存` -> 真实扫描本地游戏；
  - `强同步 Steam 自适应映射` -> 真实扫描本地游戏缓存；
- 方案库：
  - `一键更新共享方案` -> 真实同步共享方案库 URL；
  - `恢复默认` -> 真实同步本地 adapter-registry 示例；
- 推荐方案：
  - `重新测试` -> 真实连通性测试；
  - `复制主IP` -> 读取最近 n2n 配置；
  - `一键拷制专属密信包` -> 生成真实诊断报告，用作后续邀请包真实摘要来源。

浏览器验证：

- reference mode 下：游戏扫描、方案库、推荐方案三个页面 `data-lan-helper-action-hooked` 均为空；
- product mode 下：
  - 游戏扫描挂载 `games-scan-local`、`games-scan-steam-cache`；
  - 方案库挂载 `solutions-read-local-example`、`solutions-sync-remote`；
  - 推荐方案挂载 `recommendation-test-connectivity`、`recommendation-read-n2n-config`、`recommendation-generate-diagnostics`；
- 三页 Sidebar 仍为 `position=fixed`，默认参考前端视觉不受影响。

下一步推荐：继续把 product mode 的真实动作结果写回页面局部文案/摘要区域，而不是只显示右下角 Product Mode toast；例如游戏扫描显示真实游戏数量，方案库显示真实同步结果，推荐页邀请包改为包含真实 n2n 配置和诊断摘要。
## 2026-06-04 Product Mode 真实结果回填

本轮继续“前后端连接”阶段：上一轮已经让按钮调用真实 Tauri 后端，本轮把真实动作结果回填到参考前端局部内容中，避免只显示右下角 toast。

已完成：

- `ProductActionPatcher` 发出的 `lan-helper:reference-product-action` 事件现在包含 `actionId`、`result`、`at`；
- 新增 `src/reference-adapter/ProductActionResultPatcher.tsx`；
- 默认 reference mode 下不改任何页面文本；
- product mode 下监听真实动作结果，并写回当前页面局部摘要；
- 关闭 product mode 后恢复原参考文案。

回填范围：

- 游戏扫描：把真实扫描结果数量/时间写回“上次全盘检索缓存”摘要行；
- 方案库：把真实同步结果数量/时间写回“同步列表结果”摘要；
- 推荐方案：
  - 连接测试结果写回虚拟网通透度测试区域；
  - n2n 配置/诊断结果写回邀请包 `pre` 区域，显示 `[真实后端摘要]`。

浏览器验证：

- product mode 下模拟 `games-scan-local`，页面出现 `真实后端成功: 扫描本地游戏｜数量 2`；
- product mode 下模拟 `solutions-sync-remote`，页面出现 `真实后端成功: 同步共享方案库｜数量 3`；
- product mode 下模拟 `recommendation-read-n2n-config`，推荐页邀请包区域出现 `[真实后端摘要]`，包含 supernode 与 local_ip；
- 关闭 product mode 并刷新后，`[真实后端摘要]` 消失，`data-lan-helper-action-hooked` 数量为 0，Sidebar 仍为 `position=fixed`。

下一步推荐：继续把真实结果回填从“事件模拟验证”推进到“真实 Tauri 环境点击验证”：在 release 版里开启 product mode，实际点击扫描、同步、连通性测试，确认真实后端返回能稳定写回页面。