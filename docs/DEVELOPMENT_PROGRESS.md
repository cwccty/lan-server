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
