# MVP 发布验证清单

更新时间：2026-06-03

本清单用于判断“发布阻断项已解决、MVP 可发布”。不能只看 UI 显示，必须按真实状态验证。所有绿色状态都必须来自后端进程、端口、网卡、日志或自测结果。

## A. 通用组网中心

- [ ] 打开客户端后没有白色命令框、透明窗口或残留控制台。
- [ ] 首次进入通用组网中心时有加载遮罩，不会让用户感觉卡死。
- [ ] 后续进入通用组网中心会先显示上次缓存状态，再后台刷新真实状态。
- [ ] “通用组网中心”能显示 n2n edge 检测路径。
- [ ] 保存 n2n 配置不会卡死，按钮有等待反馈。
- [ ] 启动 n2n 后能显示：PID、虚拟 IP、最近 supernode。
- [ ] supernode 状态必须来自 edge 日志 ACK/PONG/[OK]，不能只因为填写了地址就显示正常。
- [ ] 本机 TAP 虚拟 IP 与填写 IP 一致，例如 `10.10.10.2`。
- [ ] 出现 n2n 失败时有明确提示：edge 缺失、supernode 未配置、edge 未运行、认证错误、IP/MAC 冲突、supernode 无响应、等待 ACK/PONG、虚拟 IP 缺失。
- [ ] 关闭/停止 n2n 后，不残留由联机助手启动的 edge 进程。

## B. TCP 端口代理

- [ ] 通用组网中心显示“房主 TCP 端口代理”卡片。
- [ ] 可配置 `监听地址:监听端口 -> 目标地址:目标端口`。
- [ ] 默认推荐 `0.0.0.0:游戏端口 -> 127.0.0.1:游戏端口`。
- [ ] 启动代理后真实监听端口，状态显示运行中、连接数、字节数、最近日志。
- [ ] 停止代理后监听释放，不残留后台代理。
- [ ] “一键自测 TCP 代理”通过：自动启动临时 Echo 服务、临时代理、发送 `hello proxy`、收到同样内容、连接数和上下行字节增长。
- [ ] 朋友邀请文本包含当前 TCP 端口代理摘要；若未启动也要明确显示未启动/不需要可忽略。
- [ ] 诊断报告包含 `tcp_port_proxy_self_test` 检查项。


## B2. UDP 端口代理

- [ ] 通用组网中心显示“房主 UDP 端口代理”卡片。
- [ ] 可配置 `监听地址:监听端口 -> 目标地址:目标端口`。
- [ ] 启动 UDP 代理后真实监听端口，状态显示运行中、活跃客户端、收发包数、收发字节和最近日志。
- [ ] 停止 UDP 代理后释放端口，不残留后台代理。
- [ ] “一键自测 UDP 代理”通过：自动启动临时 UDP Echo 服务、临时 UDP 代理、发送 `hello udp proxy`、收到同样内容、收发包数和字节数增长。
- [ ] 朋友邀请文本包含当前 UDP 端口代理摘要；若未启动也要明确显示未启动/不需要可忽略。
- [ ] 诊断报告包含 `udp_port_proxy_self_test` 检查项。
- [ ] UI 必须明确 UDP 端口代理不是 UDP 广播桥，不能把“房间列表发现”问题误导成单播代理可解决。


## B3. UDP 广播桥

- [ ] 通用组网中心显示“UDP 广播桥”卡片。
- [ ] 可配置监听 UDP 地址/端口和一个或多个转发目标。
- [ ] 启动广播桥后真实监听端口，状态显示运行中、收到包数、转发包数、丢弃包数、收发字节和最近日志。
- [ ] 停止广播桥后释放端口，不残留后台桥接任务。
- [ ] “一键自测 UDP 广播桥”通过：自动启动临时 UDP 接收器、临时广播桥、发送模拟发现包、确认转发目标收到同样内容。
- [ ] 诊断报告包含 `udp_broadcast_bridge_self_test` 检查项。
- [ ] UI 必须明确广播桥只辅助“房间发现”，不保证最终加入成功。
- [ ] 需要 `udp_broadcast_needed` 的游戏，在广播桥未启动或自测失败时必须显示能力未就绪。

## C. Terraria 向导发布阻断项

- [ ] 点击“在程序内启动服务端”后，不弹出额外命令框。
- [ ] 服务端显示 `Listening on port 7777` 后，等待 30 秒仍保持运行；界面显示“30 秒稳定性已通过”。
- [ ] 等待 2-3 分钟，不应周期性出现由联机助手健康检查触发的 `127.0.0.1:<random> is connecting...`、`Saving world data`、`Backing up world file`。
- [ ] 若服务端退出，内嵌控制台必须显示：最后日志、exit_code、退出时间、是否曾经监听端口。
- [ ] 服务端退出后，自检不能显示通过。
- [ ] MVP 阶段不展示不可验证的伪交互按钮；若存在 help/save/exit 等按钮，必须证明写入真实服务端 stdin/stdout/stderr。

## D. 房主侧联机自检

- [ ] `127.0.0.1:7777` 可达，证明房主本机游戏服务端正在监听。
- [ ] `10.10.10.2:7777` 可达，证明房主虚拟 IP 路径可访问。
- [ ] 如果游戏只监听 `127.0.0.1`，TCP 端口代理能把虚拟 IP 端口转发到本机服务端。
- [ ] 房主自检所有关键项通过。
- [ ] 复制给朋友的邀请信息包含 community、secret、supernode、房主 IP、加入者 IP、端口、必要的端口代理说明。

## E. 加入者侧最小验证

- [ ] 加入者使用不同虚拟 IP，例如 `10.10.10.3`。
- [ ] 加入者 n2n 启动后能看到自己的虚拟 IP。
- [ ] 加入者能连接房主 `10.10.10.2:7777`。
- [ ] Terraria Join via IP 使用 `10.10.10.2` 和 `7777` 成功进入。

## F. 诊断报告 / 失败分类

- [ ] “诊断报告”页可生成报告。
- [ ] 报告包含 `release_checks`、`issues`、`most_likely_cause`、`next_actions`。
- [ ] 报告包含 `adapter_requirement_alignment`，用于检查适配器声明需求是否被当前 n2n / TCP 代理 / UDP 代理 / UDP 广播桥 / 服务端能力满足。
- [ ] 报告包含 n2n edge、虚拟 IP、网络后端、supernode ACK/PONG、内嵌服务端 running/ready/ever_ready/uptime_seconds/exit_code、内嵌托管状态可观察性。
- [ ] 报告给出 Terraria 30 秒稳定性结论。
- [ ] 报告包含 TCP 端口代理自测结论。
- [ ] 最可能原因必须优先来自结构化失败分类，而不是泛泛提示“查看失败项”。
- [ ] 每个失败分类必须包含：标题、严重级别、说明、下一步建议、证据。
- [ ] 未知游戏或缺少 `connection_plan` 的 adapter 必须生成 `adapter_unknown_need_review`，不能伪装成已支持。
- [ ] 报告不包含 Cookie、SSH Key、系统凭据或无关用户目录内容。

## G. 适配器与推荐方案

- [ ] 扫描到游戏后能显示适配器来源：builtin / custom / registry / steam_scan。
- [ ] 未知游戏不能伪装成已支持，必须显示“需要管理员判断 / 需要适配”。
- [ ] 推荐方案必须明确该游戏需要：通用组网、专用服务端、TCP 端口代理、UDP 广播桥、未来 Steam Relay/插件，或暂不支持。
- [ ] 适配器库同步失败时有错误提示，不覆盖本地可用适配器。

只有以上项目通过，才能认为 MVP 达到可发布标准。

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

