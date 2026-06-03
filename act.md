# 联机助手开发行动记录

更新时间：2026-06-02

## 当前阶段

阶段 1：MVP 发布阻断项收敛。目标是先把“通用组网 + Terraria 首个游戏向导”做成真实可验证的发布级闭环，而不是只修界面显示。

## 当前产品定位

联机助手不是“每个游戏都单独配置一套 n2n”的工具，而是：

```text
通用组网中心（n2n / Radmin / Manual LAN）
  → 建立一个像局域网一样的虚拟网络
  → 支持 LAN/IP 的游戏直接连接房主虚拟 IP
  → 游戏向导只负责游戏特有的开服、端口、世界、邀请文本和诊断
```

核心原则：

- n2n、Radmin、Manual LAN 是通用组网层，不属于 Terraria 专属配置。
- Terraria 向导只是第一个游戏辅助层，用于验证“开服 + 组网 + 邀请 + 自检”的完整体验。
- 世界上支持 LAN/IP 的游戏很多，不能为每个游戏重复做一套 n2n；后续游戏适配只在能明显降低配置成本时才做。
- UI 状态必须来自真实进程、真实端口、真实虚拟网卡、真实 supernode 注册和真实连通性。
- 不能通过隐藏错误、改颜色、改文案来掩盖内部状态混乱。

## 已规划的联机方式

| 方式 | 定位 | 当前进度 | MVP 状态 |
|---|---|---|---|
| n2n / EasyN2N | 长期核心内置组网方案；客户端管理 edge，VPS 运行 supernode | 已支持 edge 检测、保存配置、启动/停止、static 虚拟 IP、TAP IP 检测；官方源码 Windows edge 已编译；VPS supernode 已跑通 | 接近可用，仍需朋友侧实测、异常诊断和发布检查全通过 |
| Radmin VPN | 外部工具辅助检测与引导 | 已能检测安装和虚拟 IP；不自动创建/加入网络 | 辅助可用，不作为内置核心 |
| Manual LAN / 手动 IP | 兜底模式，适用于同一局域网、已有 VPN、ZeroTier、Tailscale 等 | 已有手动 IP/端口 TCP 测试 | 基础可用，后续需要更友好的解释 |
| ZeroTier / Tailscale | 规划中的外部组网方案 | 目前仅作为 Manual LAN 场景被用户手动使用 | 不进入当前 MVP 内置管理 |
| 官方/自建 supernode 服务 | 未来降低门槛 | 当前使用用户 VPS；已有部署文档 | 不进入当前 MVP 默认承诺 |
| 自动下载/安装 n2n | 未来降低门槛 | 已记录要求：固定版本、白名单 URL、SHA256、用户确认 | 不进入当前 MVP |

## 当前开发进度粗估

- 项目骨架 / Tauri 桌面端：70%
- 游戏扫描 / Steam 路径识别：60%
- 通用组网中心：45%
- n2n 内置组网：65%
- Radmin 辅助检测：35%
- Manual LAN 兜底测试：45%
- Terraria 一键开服向导：55%
- 发布级诊断 / 状态统一：35%
- 打包发布体验：35%

## 当前已验证基线

```text
VPS supernode：154.64.231.137:7777
房主虚拟 IP：10.10.10.2
Terraria 端口：7777
Test-NetConnection 10.10.10.2 -Port 7777 => True
InterfaceAlias：cfw-tap
SourceAddress：10.10.10.2
```

这说明房主侧 n2n + TAP + Terraria 端口已经能打通。但发布级完成还需要：朋友侧使用不同虚拟 IP 加入，并确认服务端 30 秒以上稳定运行。

## 当前发布阻断项

1. Terraria 服务端曾出现 `Listening on port 7777` 后几秒退出，UI 变灰。
2. 该问题不能只改显示，必须记录真实退出码、退出时间、是否曾经 ready、运行时长和最后日志。
3. 诊断报告必须输出结构化 `release_checks`，明确 MVP 必需项是否通过。
4. 只有所有必需项通过，并完成朋友侧真实加入测试，才允许说 MVP 完成。

## 最近完成

- `server_session` 已改为通过真实进程状态和运行时长判断服务端状态。
- `ServerSessionStatus` 已包含 `started_at`、`uptime_seconds`、`exit_code`、`exited_at`、`ever_ready`。
- 联机向导已显示服务端运行时长，并加入 30 秒稳定性门禁。
- 诊断报告已升级为结构化发布检查：n2n edge、n2n 虚拟 IP、n2n 运行状态、Terraria 30 秒稳定性、服务端退出诊断、隐私边界。
- 本轮修复了 `src-tauri/src/core/diagnostic_logger.rs` 的中文乱码，避免发布报告出现不可读内容。

## 下一步

1. 构建新版 release 客户端。
2. 用户用新版客户端执行：启动 n2n → 启动 Terraria 服务端 → 等待 30 秒 → 生成诊断报告。
3. 若 `Terraria 服务端 30 秒稳定性` 未通过，继续根据 exit code、exited_at、ever_ready、日志定位根因。
4. 完成朋友侧真实加入测试：朋友使用不同虚拟 IP，例如 `10.10.10.3`，加入房主 `10.10.10.2:7777`。
5. 通过后再进入 MVP 收尾：通用组网中心 UI 梳理、邀请文本优化、错误提示和打包说明。

## 开发约束

- 关键决策必须写入项目文件，不能只存在聊天记录。
- 修改 API、数据结构、目录、文件命名或产品结构时，必须同步更新文档。
- 不提交 n2n 二进制；`tools/n2n/*.exe` 继续由 `.gitignore` 排除。
- 不把无关格式化改动混进提交。
- 第一版不做 Steam API 模拟、Hook、注入、破解、绕过反作弊。

## 2026-06-02 发布阻断项继续推进：Terraria 后台启动方式修正

本轮继续处理“监听端口后几秒变灰 / 服务端可能启动后退出”的发布阻断项。当前判断：仅用 `CREATE_NO_WINDOW` 启动 TerrariaServer 风险较高，因为 TerrariaServer 是控制台程序，部分版本会访问 Console API；如果进程没有有效控制台，可能触发控制台句柄无效并退出。

已调整：

- Windows 下内嵌 Terraria 服务端改为 `CreateProcessW + CREATE_NEW_CONSOLE + STARTF_USESHOWWINDOW/SW_HIDE`。
- 目的：给 TerrariaServer 一个有效控制台环境，同时隐藏外部白色命令框。
- 状态判断继续以真实进程状态、`127.0.0.1:端口` 探测、运行时长、退出码、退出时间、是否曾经监听端口为准。
- 当前 Windows 隐藏控制台模式已重定向 stdin/stdout/stderr，因此内嵌控制台和命令按钮应对应真实服务端进程。
- 修复 `server_session.rs` 中遗留中文乱码，避免用户看到不可读错误信息。

这一步不是纯 UI 修改，而是改变服务端创建方式，目标是降低“后台隐藏后服务端立即退出”的真实风险。

## 2026-06-02 发布阻断项补强：隐藏控制台 + 标准输入输出重定向

上一轮隐藏控制台方案解决了“需要有效控制台”的问题，但如果不重定向标准输入输出，`help/save/exit` 等按钮无法证明发送到了真实服务端。为满足发布清单，本轮继续补强：

- Windows 下 `CreateProcessW` 启动 TerrariaServer 时创建匿名管道。
- 将 stdin/stdout/stderr 传给子进程，同时继续使用隐藏的新控制台。
- 内嵌控制台现在应能显示服务端 stdout/stderr。
- `help` / `save` / `exit` 会写入真实服务端 stdin，不再只是界面按钮。
- 状态仍以真实进程句柄、端口探测、退出码、退出时间、运行时长和是否曾经监听端口为准。

这一步进一步把“服务端托管”从表面控制台面板推进为可验证的真实进程控制闭环。

- 诊断报告新增 `server_io_bridge` 必需检查，用于证明内嵌控制台和 help/save/exit 不是 UI 伪装，而是已连接真实服务端 stdin/stdout/stderr。

## 2026-06-02 n2n 后端发布级清理

继续收敛 MVP 发布质量：n2n 后端用户可见文案已恢复为正常中文，并统一配置/ PID 文件定位逻辑。

已完成：

- `n2n_backend` 的检测、保存、启动、停止错误信息不再出现乱码。
- `last_config.json` 与 `n2n.pid` 会优先写入实际发现的 `tools/n2n` 目录，避免 release exe 工作目录变化导致配置和 edge.exe 分离。
- 诊断报告中用于判断 `n2n_running` 的“正在运行 / PID”证据现在来自可读中文 notes。

这项改动直接服务于发布清单 A 和 E：n2n 状态必须可读、可解释、可复制到诊断报告。

## 2026-06-02 通用组网中心 UI 收敛

继续推进 MVP 收尾：通用组网中心不再把 n2n 操作结果只显示成 JSON，而是显示面向发布验证的状态面板：

- 是否检测到 edge.exe / n2n.exe。
- 当前虚拟 IP。
- 后端 notes，包括 PID、supernode、配置路径等。
- 保存配置结果。
- 启动/停止运行态结果。
- 可一键复制通用组网配置给朋友。

这使发布清单 A 中“显示 n2n edge 检测路径、PID、虚拟 IP、最近 supernode”的验证更接近普通用户可理解的产品体验。

## 2026-06-02 诊断报告升级为发布前一键汇总

诊断报告现在不只列出检查项，还会输出：

- `release_ready`：MVP 必需项是否全部通过。
- `required_passed` / `required_total`：必需项通过数量。
- `next_actions`：未通过项的下一步处理建议。

诊断页会直接显示下一步处理列表，避免用户只看到红叉但不知道该做什么。该结果仍来自真实后端状态，不是手工勾选。

## 2026-06-02 发布阻断项修正：避免健康检查副作用

本轮根据用户实测日志确认：`Saving world data` 和 `127.0.0.1:<random> is connecting...` 是联机助手的端口健康检查主动 TCP 连接造成的副作用。已将 Windows 下服务端 ready 判断改为读取 TCP LISTEN 表，不再连接 TerrariaServer 本身。

另外，隐藏后台模式下 `help/save/exit` 交互输入未达到发布级可靠性。MVP 不再把这些按钮作为功能暴露，诊断报告也不再把 `server_io_bridge` 作为“命令按钮可用”的必需项；改为检查内嵌服务端日志可观察、真实监听状态、退出诊断和 30 秒稳定性。

## 2026-06-02 发布阻断项二次修正：不再重定向 Terraria 标准输入输出

用户截图证明：服务端在 `Listening on port 7777` 后以 `exit_code=0` 退出，根因不是端口探测，而是隐藏后台模式下的 stdin/stdout/stderr 重定向会干扰 TerrariaServer。已改为 Windows 隐藏控制台 + 不重定向标准输入输出；MVP 以真实进程和 PID 对应监听端口作为状态来源，优先保证后台服务端稳定运行。

同时补充易用性：通用组网中心和联机向导会读取 n2n 最近一次配置，将 supernode 自动填入空输入框。

## 2026-06-02 发布阻断项第三次修正：Shell 托管 TerrariaServer

直接 `CreateProcessW + CREATE_NEW_CONSOLE` 仍会出现 `exit_code=0` 自动退出。本轮改用 PowerShell `Start-Process -WindowStyle Hidden -PassThru` 启动 TerrariaServer，并读取返回 PID 转为联机助手托管进程句柄；ready 判断仍来自 PID 对应端口监听表，而不是 UI 或 TCP 探测副作用。

## 2026-06-02 发布阻断项第四次修正：ConPTY 伪终端托管

Shell hidden 方式仍会 `exit_code=0` 自动退出。本轮改用 Windows ConPTY：创建 Pseudo Console，将 TerrariaServer 作为伪终端进程启动，并保留输入/输出管道用于内嵌控制台观察。目标是在不弹出白色命令框的前提下提供接近真实控制台的运行环境。

## 2026-06-02 发布阻断项第五次修正：ConPTY 回退到隐藏 cmd 托管

ConPTY 方案出现 `0xc0000142`。本轮回退为隐藏 `cmd.exe` 托管 TerrariaServer，利用 cmd/console host 提供普通控制台环境，联机助手继续通过进程生命周期和端口监听判断 ready。

## 2026-06-02 发布阻断项第六次修正：接管端口监听 PID

隐藏 cmd 托管后出现“cmd 退出但 TerrariaServer 仍监听端口”的状态冲突。本轮在状态刷新时读取 TCP LISTEN 表，发现目标端口监听 PID 后会自动接管该真实 PID，避免 UI 显示未运行而自检却通过。

## 2026-06-02 下一阶段规划：多方式联机入口

用户希望联机助手最终支持主要联机方式。当前决策：方向合适，但必须做成“多后端可选择”的产品，而不是把所有方案堆成一个不可诊断的万能按钮。

短期执行顺序：

1. 稳住现有 n2n 主线和 Terraria 验证闭环。
2. 把通用组网中心升级为“选择联机方式”：n2n、Radmin、手动 IP/已有 VPN。
3. 借鉴 connecttool-qt 的房间体验，增加“房间配置摘要/复制给朋友/成员检查”而不是引入 Steamworks。
4. 规划 TCP/UDP 单端口转发模式，作为未来轻量联机方式。
5. Steam Networking 只作为研究项或可选插件，默认不进入 MVP。

## 2026-06-02 房间与聊天第一版实现

已在通用组网中心增加本地“房间与聊天”面板：房间摘要、成员列表、置顶配置、聊天记录和一键复制房间包。第一版不做实时同步，只做本地协作记录和邀请信息整理；后续再评估信令/中继服务。

## 2026-06-02 Steam 中继入口预留

用户要求在当前多方式联机规划中，预留之前提到的 connecttool-qt 类项目入口，即“借助 Steam 服务器 / Steam Networking / Steam Relay”的联机方式。

本次已完成：

- 在通用组网中心新增“Steam 中继联机入口（预留）”。
- 入口包含 AppID、房间名、中继模式、制作备注。
- 入口可复制一份制作草案，方便后续作为插件/后端任务继续推进。
- 新增 `docs/STEAM_RELAY_ENTRY.md`，把定位、边界、PoC 顺序写入项目文件。

当前状态：只是发布级可见的预留入口，不是真实 Steamworks 后端。真实开发仍需独立 PoC 和诊断闭环。

## 2026-06-02 推荐启动项语义修正

用户确认推荐页含义：扫描到游戏后点击推荐启动项，不等于直接完成本地联机。

已修正：

- 推荐页新增提示卡片：说明推荐方案只是流程匹配，不是一键联机完成。
- 推荐卡片新增说明：启动项只会启动客户端或服务端。
- 按钮文案从“执行推荐启动项”改为更具体的“启动游戏客户端 / 启动本地服务端”。
- 推荐引擎的步骤中补充 client/server 启动项的边界说明。

产品记忆：未来所有状态必须区分“已启动游戏/服务端”和“已完成组网/可联机”，不能用一个按钮暗示联机已经成功。

## 2026-06-02 联机能力转换系统第一版 + 取消房间聊天

本次按用户要求执行两件事：

1. 推荐页升级为“联机能力转换判断页”：新增 `multiplayer_conversion` 模型，展示游戏是否能转换成本地联机、需要哪些方式/组件、风险等级和判断说明。
2. 取消本地“房间与聊天”功能：移除房间成员、聊天记录、置顶聊天包，只保留通用组网配置复制。

修改范围：

- `src/types/game.ts`：新增 `MultiplayerCapability`、`ConversionMethod`、`MultiplayerConversionProfile`。
- `src-tauri/src/models/game.rs`：同步新增转换画像模型。
- `src-tauri/src/core/capability_engine.rs`：分析结果返回转换画像；未知 Steam 游戏标记为需要人工适配。
- `src-tauri/src/core/game_detector.rs`：扫描结果携带适配器中的转换画像。
- `adapters/games/*.json`：为 Terraria、Minecraft Java、Stardew Valley 填写转换画像。
- `src/pages/RecommendationPage.tsx`：展示“联机能力转换判断”。
- `src/pages/NetworkSetupPage.tsx`：移除房间与聊天面板。
- `src/styles/globals.css`：删除聊天/成员样式，新增转换标签样式。

验证：`npm run build` 和 `cargo check --manifest-path src-tauri\\Cargo.toml` 均通过。

## 2026-06-02 适配器共享库方案记录

用户提出：由用户或管理员用适配器功能认定游戏类型，保存后其他用户再次遇到这个游戏就不再需要手动判断。

已记录为正式产品方向：

- 新增 `docs/ADAPTER_REGISTRY.md`。
- 适配器管理定位为管理员/高级功能，不是普通玩家必经流程。
- 后续应支持内置适配器、本地自定义适配器、远程共享适配器库、用户提交与管理员审核。
- 普通用户扫描游戏时自动按 Steam AppID / exe / 路径特征命中共享适配器。

下一步如果继续开发，应先做“本地适配器管理 + 导入/导出”，再做远程 registry 拉取。

## 2026-06-02 本地适配器管理第一版

本次开始落地共享适配器库路线的第一步：本地适配器管理 + 导入/导出。

修改范围：

- 新增 `src/pages/AdapterManagerPage.tsx`。
- 导航新增“适配器管理”。
- 前端 API 新增适配器列表、保存、导入、导出调用。
- Rust 后端新增适配器读写命令。
- `adapter_store` 新增本地保存、导入、导出逻辑。
- 样式新增 textarea 和适配器表格样式。

验证：`npm run build` 和 `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。

后续：远程共享适配器库拉取、hash 校验、在线提交和审核。

## 2026-06-02 远程共享适配器库同步第一版

本次实现共享适配器库拉取：

- `adapter_store` 新增 registry index 解析、适配器下载、可选 sha256 校验、保存 `registry_<game_id>.json`。
- 新增后端命令 `sync_adapter_registry`。
- 前端 API 新增 `syncAdapterRegistry`。
- 适配器管理页新增“远程共享适配器库”卡片，可填写 index URL 并同步。
- 适配器加载优先级调整为：custom > registry > builtin。
- 新增依赖：`reqwest` 用于 HTTPS 拉取，`sha2` 用于 hash 校验。

验证：`npm run build` 和 `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。

## 2026-06-02 本地 adapter-registry 示例目录

按用户要求新增本地 `adapter-registry/` 示例目录，用于后续上传 VPS 或 GitHub Pages 测试远程同步。

已生成：

- `adapter-registry/index.json`
- `adapter-registry/games/terraria.json`
- `adapter-registry/games/minecraft_java.json`
- `adapter-registry/games/stardew_valley.json`
- `adapter-registry/README.md`

`index.json` 已包含每个适配器的 sha256。可通过 `python -m http.server 8088` 本地启动静态服务，然后在客户端同步 `http://127.0.0.1:8088/adapter-registry/index.json`。

## 2026-06-02 本地示例库同步按钮

用户截图显示同步 `http://127.0.0.1:8088/adapter-registry/index.json` 失败。本机检查该 URL 无法连接，说明本地 HTTP 服务没有启动。

已改进：

- 新增后端命令 `sync_local_adapter_registry_example`。
- 适配器管理页新增按钮“同步本地示例库（无需 HTTP）”。
- 后端自动查找项目中的 `adapter-registry/index.json`，读取本地示例库并生成 `registry_*.json`。
- 远程 URL 输入继续用于 VPS / GitHub Pages / 本地 HTTP 服务测试。

验证：`npm run build` 和 `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。

## 2026-06-02 修复适配器同步完成仍显示加载图标

用户反馈本地示例库同步完成后仍显示 spinner。原因是完成消息复用了 `busy-banner`。

已改为：

- `busy === true` 时使用 `busy-banner`。
- `busy === false` 的完成消息使用 `status-banner`，不显示加载图标。

验证：`npm run build` 和 `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。

## 2026-06-02 忽略 registry 运行时缓存

按发布整理要求处理同步缓存：

- `.gitignore` 增加 `adapters/games/registry_*.json`。
- 删除当前未提交的 `registry_minecraft_java.json`、`registry_stardew_valley.json`、`registry_terraria.json`。
- 验证 `npm run build` 与 `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。

目的：避免用户运行同步功能后污染 Git 工作区。

## 2026-06-02 默认共享库地址与一键更新

按要求增加默认共享库 URL 配置和一键更新：

- 适配器管理页新增“一键更新共享适配器”。
- 新增“恢复默认地址”。
- registry URL 自动保存到 localStorage。
- 同步成功后记录上次同步时间和更新/跳过数量。
- 当前默认地址是本地开发测试 URL；一键更新在默认地址下会走无需 HTTP 的本地示例库同步，避免用户没启动 `python -m http.server` 时失败。

验证：`npm run build` 和 `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。

## 2026-06-02 默认适配器连接改为 GitHub raw

用户提供公开仓库 `https://github.com/cwccty/lan-server.git`。

已修改：

- 默认共享库地址改为 `https://raw.githubusercontent.com/cwccty/lan-server/master/adapter-registry/index.json`。
- 一键更新默认走公开 GitHub raw。
- 本地示例库按钮继续保留用于离线测试。

本机 `git ls-remote` 访问 GitHub 超时，后续 push 可能需要用户网络/GitHub Desktop 协助。

## 2026-06-02 适配器默认地址旧值迁移

用户反馈恢复默认地址仍是 `127.0.0.1:8088`。已增加旧 localStorage 地址迁移和页面版本提示：

- 旧地址 `http://127.0.0.1:8088/adapter-registry/index.json` 会自动替换成 GitHub raw 默认地址。
- 按钮改为“恢复 GitHub 默认地址”。
- 页面显示版本 `adapter-manager-2026-06-02-github-default`，便于确认是否打开最新 exe。

## 2026-06-02 适配器来源标识

按计划实现适配器来源标识：

- Rust `GameAdapter` / `GameSummary` / `GameAnalysis` 新增 `adapter_source`。
- `adapter_store` 根据文件名前缀推断来源：builtin / registry / custom。
- 未适配 Steam 扫描结果标记为 `steam_scan`。
- 适配器管理页表格新增“来源”列。
- 推荐页显示“适配器来源”。
- 样式新增不同来源 badge。

验证：`npm run build` 和 `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。


## 2026-06-02 Stitch 7 页面设计记录

已使用 Stitch 生成联机助手 7 个核心页面设计，并作为后续 React/Tauri 前端迁移参考。

- 设计覆盖首页、通用组网中心、Terraria 向导、游戏扫描、推荐方案、适配器管理、诊断报告；
- 7 个页面均要求使用简体中文文案，并为未来能力做入口占位；
- 页面不应表现成通用 VPN 客户端，而应突出游戏联机助手、n2n、适配器方案库和诊断能力；
- 适配器、共享库、推荐方案、邀请好友、诊断报告等功能需要在真实客户端内对接 Tauri 后端；
- 未来功能只做入口，不在第一版展开实现；
- Terraria 向导用于演示深度开服流程，但通用组网能力应服务于所有支持 LAN/IP/服务端/代理/广播桥的游戏；
- `.playwright-mcp/` 仅作为本地浏览器/设计验证辅助目录，不作为产品功能。

验证要求：每次给用户查看新版客户端前，都要运行 `npm run build`、`cargo check --manifest-path src-tauri\Cargo.toml`、`npm run tauri:build`，并使用 release exe：`src-tauri\target\release\lan-helper.exe`。


## 2026-06-02 修复前端中文显示为问号

用户反馈前端所有汉语显示为问号。定位结论：不是字体问题，而是上次通过 PowerShell/管道写入部分 TSX 文件时，中文在源码层被替换成了问号；同时 PowerShell 直接 Get-Content 会以错误编码显示乱码，不能作为唯一判断。

已修复：

- 改用 Node 以 UTF-8 写回关键前端文件，恢复中文文案：Layout、HomePage、GameScanPage、RecommendationPage、DiagnosticsPage、MultiplayerWizardPage。
- 修复 index.html 标题为“联机助手”。
- 修复 DiagnosticsPage 中日志 join 的换行转义问题。
- 用 UTF-8 读取构建产物验证：dist/assets 中包含“联机助手、首页、通用组网中心、Terraria 向导、游戏扫描、推荐方案、适配器管理、诊断报告”等中文，并且没有连续问号串。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-03 端口代理 MVP 架构设计

已新增 `docs/PORT_PROXY_MVP.md`，明确端口代理作为第一项“联机能力转换”功能的架构和实施路线。

- 端口代理定位：在 n2n/Radmin/已有局域网连通基础上，把朋友访问的 `房主虚拟 IP:端口` 转发到真实游戏服务端，例如 `127.0.0.1:端口`。
- MVP 第一版只做 TCP 代理，不和 UDP 广播桥混在一起。
- 后端规划：新增 `src-tauri/src/core/port_proxy.rs` 和 `src-tauri/src/models/port_proxy.rs`。
- 命令规划：`start_port_proxy`、`stop_port_proxy`、`list_port_proxies`、`get_port_proxy_status`、`test_port_proxy`。
- UI 规划：推荐页和通用组网中心增加端口代理卡片，默认使用 n2n 虚拟 IP、游戏默认端口和 `127.0.0.1` 目标地址。
- 执行清单规划：后续在推荐页新增“端口代理”步骤，区分本机端口监听、代理监听、好友连接。
- 安全边界：默认不监听公网地址、不自动开放防火墙、不代理敏感本地服务、不承诺绕过平台/反作弊。

下一步推荐：先实现 TCP 端口代理后端 MVP，暂时只支持一个代理实例，完成启动、停止、状态、日志和真实连通性测试后再接 UI。

## 2026-06-03 好友连接检测入口

已在推荐页的好友虚拟 IP 分配器中加入“检测好友连接”入口。

- 对当前选中的好友虚拟 IP 执行 `testConnectivity`，目标为 `好友虚拟 IP:游戏默认端口`，模式为 `n2n_game_port`。
- 页面会展示好友连接检测结果：可达 / 不可达 / 待确认，并显示后端返回的诊断说明。
- 检测结果会写入“游戏邀请好友包”的当前检测状态中。
- 如果好友不是房主，好友电脑通常不会监听游戏端口；因此不可达不直接等于 n2n 失败，页面已明确提示这一点。
- 检测期间复用全屏加载遮罩，避免重复点击。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-03 好友虚拟 IP 分配器

已在推荐页的“游戏邀请好友包”中加入好友虚拟 IP 分配器。

- 用户可以输入好友昵称，点击“分配 / 选择好友虚拟 IP”。
- 分配器会根据房主最近 n2n 配置中的 `local_ip` 或当前检测到的 n2n 虚拟 IP 推断网段，默认从同网段分配不重复地址。
- 自动避开 0、1、255、房主 IP 和已经分配给其他好友的地址。
- 分配记录保存在 localStorage：`lan-helper-friend-ip-allocations`。
- 可以从分配表中选择某个好友用于当前邀请，也可以删除分配记录。
- 游戏邀请好友包会写入“邀请对象”和“分配给你的虚拟 IP”，减少多人填写同一个虚拟 IP 造成 IP/MAC 冲突。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-03 推荐页读取最近 n2n 配置

已让推荐页可以读取最近一次保存的 n2n 配置，并把它用于“游戏邀请好友包”。

- 后端新增 `n2n_backend::last_config()`，读取 `tools/n2n/last_config.json`。
- Tauri 新增命令 `get_n2n_last_config`。
- 前端 API 新增 `getN2nLastConfig()`。
- 推荐页刷新执行清单时，会同时读取最近 n2n 配置。
- 游戏邀请好友包现在会带入：n2n community、supernode、房主虚拟 IP、默认端口和检测摘要。
- n2n 密钥默认隐藏，避免误复制泄露；用户可勾选“复制时包含 n2n 密钥”后生成完整邀请。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-03 推荐页游戏邀请好友包

已在推荐页新增“游戏邀请好友包”，作为现有“通用组网配置”的游戏层补充，而不是替代 n2n 邀请。

- 邀请包包含：游戏名、推荐判断、推荐方式、默认端口、房主虚拟 IP、n2n ACK/PONG 状态、本机端口状态、服务端状态、朋友加入步骤。
- 如果 n2n 或本机端口证据不足，邀请包会明确写“待确认 / 不可达”，不会假装已经可以联机。
- 由于推荐页目前无法读取 n2n community 和密钥，邀请包明确提示：community 和密钥仍从“通用组网中心 → 复制给朋友的通用组网配置”获取。
- 推荐页新增“复制游戏邀请好友包”和“先刷新检测状态”按钮。
- 该功能定位：把现有组网邀请与游戏加入说明串起来，减少朋友看到配置后不知道进哪个游戏端口/入口的问题。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-02 推荐页执行清单状态化

已把推荐页从单纯展示方案，升级为“执行清单”视角，帮助用户判断当前卡在哪一步。

- 推荐页新增“执行清单”卡片，包含 5 个状态：适配器判断、通用组网、游戏启动 / 服务端、本机端口监听、邀请好友。
- 状态来源尽量使用真实检测：
  - n2n 组网状态来自 `get_n2n_diagnostics` 和 edge 日志解析。
  - 服务端状态来自 `read_server_session`。
  - 本机端口监听来自 `test_connectivity(127.0.0.1:默认端口)`。
  - 适配器状态来自当前 `GameAnalysis`。
- 新增“刷新执行清单”按钮，会重新读取 n2n、服务端会话和本机端口状态。
- 推荐页源码已从单行压缩 JSX 整理为可维护结构，方便后续扩展端口代理、广播桥、Mod 和 Steam Relay 状态。
- 清单仍不把“推荐方案”包装成“一键已联机”；每一步只显示已经检测到的真实证据或待处理状态。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-02 组网成功后返回推荐方案继续

已补齐“推荐方案 → 通用组网 → 推荐方案继续”的流程闭环。

- 当用户从推荐方案带入参数进入通用组网中心后，如果 n2n 诊断检测到 supernode ACK/PONG，会显示“组网已连上，可以继续游戏步骤”卡片。
- 卡片提供“返回推荐方案继续”按钮，引导用户回到推荐页继续服务端启动、端口检测、邀请好友或其他游戏步骤。
- 页面底部按钮会根据是否存在推荐页预设自动切换文案：普通进入时是“生成推荐方案”，从推荐页进入时是“返回推荐方案继续执行游戏步骤”。
- 判断仍来自真实 `n2nDiagnostics.ok_link`，不是前端假成功。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-02 n2n 启动后自动刷新诊断

已在通用组网中心增加 n2n 自动刷新诊断状态，减少用户手动反复点击“刷新网络后端状态”。

- 点击“启动 n2n edge”后，前端会进入自动刷新状态。
- 每 2.5 秒读取一次真实后端状态和 `tools/n2n/edge.log` 诊断结果。
- 检测到 ACK/PONG、认证错误、IP/MAC 冲突、supernode 无响应、edge 停止，或 60 秒超时后自动停止刷新。
- 页面会显示“正在自动刷新 n2n 状态”，但不会弹出全屏遮罩，因为这是后台轮询，不应阻塞用户查看日志。
- 点击“停止 n2n edge”会立即取消自动刷新。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml 通过。第一次 npm run tauri:build 因旧的 release exe 正在运行导致拒绝覆盖；关闭 `lan-helper.exe` 后重新打包通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-02 推荐方案到通用组网参数联动

已把“推荐方案”页和“通用组网中心”打通，减少用户在不同页面之间重复填写游戏端口。

- 新增 `NetworkSetupPreset` 类型，用于跨页面传递游戏组网预设。
- 推荐页在识别到游戏分析结果后，新增“带入参数并进入通用组网”按钮。
- 传递内容包括：gameId、游戏显示名、默认端口、能力类型、推荐转换方式、适配器来源。
- 通用组网中心接收预设后，会自动填入“游戏端口”和“手动连接测试端口”，并显示“推荐方案参数已带入”的提示。
- 该功能只做参数联动，不宣称已经联机；页面仍提示用户需要填写 supernode、确认虚拟 IP 不重复、启动 n2n edge 并验证 ACK/PONG。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-02 全屏虚化加载遮罩

已为需要等待后端结果的按钮增加统一加载遮罩，避免用户误以为程序卡死或重复点击。

- 新增 `LoadingOverlay` 组件：全屏半透明遮罩、背景虚化、中央加载卡片、旋转指示器。
- 接入页面：通用组网中心、Terraria 向导、推荐方案、适配器管理、诊断报告。
- 遮罩只绑定已有真实 busy / isLaunching / busyAction 状态，不做假进度；耗时任务结束后自动消失。
- 适配器管理增加 `busyLabel`，同步/导入/导出/保存时显示当前正在处理的动作。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-02 n2n 管理员诊断摘要复制

已在通用组网中心的“supernode 响应诊断”区域增加“复制给管理员的诊断摘要”按钮。

- 摘要包含：生成时间、supernode、community、本机期望虚拟 IP、对方 / 房主虚拟 IP、edge 是否运行、supernode 是否配置、ACK、PONG、认证错误、IP / MAC 冲突、supernode 无响应、结论、最近错误、日志路径、最近 20 行 edge 日志。
- 摘要明确不包含 n2n 密钥，避免用户把房间密码误发到公开 issue 或群聊。
- 该功能用于把真实 edge 日志状态快速发给管理员或开发者排查，而不是只靠截图或前端颜色判断。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。


## 2026-06-02 通用组网中心真实状态卡

已按 Stitch 设计方向增强“通用组网中心”的顶部真实状态区：

- 新增 4 张状态卡：n2n edge、supernode、虚拟网卡、虚拟 IP。
- n2n edge 状态来自后端检测、记录 PID、启动/停止操作结果。
- 虚拟网卡和虚拟 IP 来自后端 Windows 网卡 IPv4 扫描。
- supernode 卡片只表示“是否填写 / 是否已被 edge 启动使用”，不伪装成“supernode 已响应”；ACK/响应需要后续通过 edge 日志或诊断确认。
- 页面顶部新增真实状态说明，避免用户误以为只是 UI 改绿。
- 用 Browser 打开本地 Vite 预览验证：通用组网页可见四个状态卡，中文正常。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。


## 2026-06-02 n2n edge 日志捕获与 supernode 响应诊断

已实现 n2n supernode 真实响应诊断，避免只显示“已填写 supernode”导致用户误判为可联机。

后端改动：

- n2n_backend::start() 启动 edge 时改为隐藏窗口 + stdout/stderr 管道捕获。
- 启动 edge 时增加 -v，确保可捕获 REGISTER_SUPER_ACK、PONG、认证错误等关键日志。
- 每次启动前重置 tools/n2n/edge.log，避免旧日志无限累积。
- 新增 n2n_backend::diagnose()，解析最近日志并输出 ack、pong、ok_link、auth_error、ip_mac_conflict、not_responding、summary、last_error、recent_logs、log_path。
- 新增 Tauri 命令 get_n2n_diagnostics。
- 诊断报告新增 MVP 检测项 n2n_supernode_response，用于区分 edge 已启动与 supernode 真正 ACK/PONG。

前端改动：

- 通用组网中心调用 getN2nDiagnostics()。
- supernode 状态卡现在显示：未配置 / 已填写 / 等待 ACK / ACK-PONG / 存在问题。
- 当前 n2n 状态区新增“supernode 响应诊断”和最近 edge 日志折叠面板。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml 通过。第一次 npm run tauri:build 因 release exe 正在运行导致拒绝覆盖，关闭 lan-helper.exe 后重新打包成功。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-02 n2n IP/MAC 冲突自动提示

已在通用组网中心增加 n2n IP/MAC 冲突自动提示与换 IP 建议。

- 触发条件：后端 n2n 诊断解析到 `ip_mac_conflict === true`，即 edge 日志出现 MAC 或 IP 已被占用相关错误。
- 前端会显示“检测到 IP / MAC 冲突”错误卡片，解释可能原因：同一个虚拟 IP 被另一台电脑使用，或旧注册尚未被 supernode 释放。
- 根据当前本机虚拟 IP 自动生成同网段候选地址，默认避开当前地址、0、1、255，例如 10.10.10.3、10.10.10.4 等。
- 用户可一键点击“改用 x.x.x.x”填入本机虚拟 IP，然后保存 n2n 配置、停止 edge、重新启动 edge。
- 该功能只基于真实 edge 日志诊断触发，不会在没有冲突证据时假提示。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-03 TCP 端口代理后端 MVP 实现

已实现端口代理后端 MVP，为后续“把房主真实游戏服务端映射到组网虚拟地址/端口”打基础。

- 新增 `PortProxyConfig` / `PortProxyStatus` 类型。
- 新增 `core::port_proxy`，当前只支持 TCP：监听、转发、停止、列表、状态、连接数、字节统计和最近日志。
- 新增 Tauri 命令：`start_port_proxy`、`stop_port_proxy`、`list_port_proxies`、`get_port_proxy_status`、`test_port_proxy`。
- 程序退出清理时会停止全部端口代理，避免后台残留监听端口。
- 前端补齐 `src/types/portProxy.ts` 和 `src/api/tauri.ts` API 封装。
- 当前尚未接入页面 UI；下一步推荐把它接到推荐方案页/通用组网中心，作为“房主端口转发”控制卡片。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。release exe：src-tauri\target\release\lan-helper.exe。

## 2026-06-03 TCP 端口代理 UI 接入与端到端验证

已把 TCP 端口代理从“只有后端 API”推进到用户可操作的通用组网中心功能。

- 通用组网中心新增“房主 TCP 端口代理”卡片。
- 默认参数：`0.0.0.0:7777 -> 127.0.0.1:7777`，用于房主把朋友访问虚拟 IP 的 TCP 流量转发到本机游戏服务端。
- 支持在 UI 中修改监听地址、监听端口、目标地址、目标端口。
- 支持启动、停止、刷新、测试代理监听。
- UI 显示真实代理状态：监听地址、目标地址、运行状态、当前连接数、历史连接数、上下行字节、最近错误、最近日志。
- 复制给朋友的通用组网邀请会带上当前端口代理摘要，避免用户不知道是否需要代理。
- 后端 `test_port_proxy` 对 `0.0.0.0` / `::` 监听做本地测试地址转换，避免测试连接不可用的通配监听地址。
- 新增 Rust 端到端测试 `tcp_proxy_forwards_bytes_end_to_end`，验证本地 TCP 服务端经代理可以真实收发字节。

验证：cargo test --manifest-path src-tauri\Cargo.toml tcp_proxy_forwards_bytes_end_to_end、npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。Browser 打开 http://127.0.0.1:1420 并进入通用组网，已确认“房主 TCP 端口代理”卡片、启动按钮和默认代理说明可见。

下一步推荐：做一次真实 Tauri 运行态手工测试：房主本机开一个临时 TCP 服务，使用页面启动代理，再用 Test-NetConnection 或另一台机器访问房主虚拟 IP:监听端口，确认 UI 连接数和字节统计增长。

## 2026-06-03 TCP 端口代理一键自测

已把手工 PowerShell Echo 测试固化成产品内的一键自测能力。

- 新增 `PortProxySelfTestReport`，返回自测是否通过、监听地址、目标地址、发送内容、收到内容、连接数、上下行字节、步骤说明和代理状态快照。
- 新增后端命令 `self_test_port_proxy`。
- 后端自测流程：自动分配临时端口、启动临时 Echo 服务、启动临时 TCP 端口代理、发送 `hello proxy`、读取 Echo 返回、校验连接数和字节统计、自测结束后清理临时代理和 Echo 服务。
- 新增 Rust 测试 `self_test_reports_success`，验证一键自测报告真实成功。
- 通用组网中心“房主 TCP 端口代理”卡片新增“一键自测 TCP 代理”按钮。
- 前端展示自测结果：通过/失败、链路、发送内容、收到内容、历史连接、上行字节、下行字节、自测步骤。

验证：cargo test --manifest-path src-tauri\Cargo.toml port_proxy、npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。Browser 复查时本地浏览器拦截了 http://127.0.0.1:1420，但不影响编译和后端自测验证结果。

下一步推荐：把“一键自测 TCP 代理”结果纳入诊断报告，让用户点击“开始诊断”时也能看到 TCP 代理自测是否通过。

## 2026-06-03 通用组网中心进入加载与缓存优化

已修复用户反馈的“点进通用组网中心会自动卡一段时间但没有明显加载提示”和“重复进入仍重新加载不合理”的产品体验问题。

- 首次进入通用组网中心，如果没有缓存，会显示全屏加载遮罩：正在加载通用组网状态。
- 后续再次进入会优先显示上次检测缓存，避免页面空白或明显卡顿。
- 后续进入时会在后台刷新 n2n、网卡、端口代理状态，并显示“正在后台刷新组网状态”的提示。
- 新增状态缓存：backends、n2nDiagnostics、portProxyStatus、savedAt，存入 localStorage。
- 页面显示最近刷新时间，让用户知道当前状态来自缓存还是刚刷新。
- 刷新失败或组网操作失败时，不再静默清空旧内容，会显示明确错误提示，例如“刷新网络后端失败 / 启动 n2n edge 失败 / 刷新 TCP 端口代理状态失败”。
- “刷新网络后端状态”调整为“刷新组网状态”，同时刷新 n2n 后端和 TCP 端口代理状态。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。第一次 tauri build 因 release 版 lan-helper.exe 正在运行导致拒绝覆盖，停止 PID 54676 后重新打包成功。

下一步推荐：把 n2n 启动失败原因进一步分类展示，例如 edge 未检测到、supernode 未填写、IP/MAC 冲突、supernode 无响应、认证错误，让用户不用看日志也能知道下一步该做什么。

## 2026-06-03 发布级诊断与失败分类第一步

已开始实现“发布级诊断与失败分类”大区块，先把 n2n 失败分类和 TCP 端口代理自测接入诊断报告。

- `DiagnosticReport` 新增 `issues` 和 `most_likely_cause`，不再只依赖 release_checks 列表。
- 新增 `DiagnosticIssue`：包含 id、severity、title、detail、next_actions、evidence。
- 诊断报告后端纳入 `n2n_backend::diagnose()` 的真实日志状态。
- 新增 n2n 失败分类：edge 缺失、supernode 未配置、edge 未运行、认证错误、IP/MAC 冲突、supernode 无响应、等待 ACK/PONG、虚拟 IP 缺失。
- 诊断报告纳入 TCP 端口代理一键自测，新增检查项 `tcp_port_proxy_self_test`。
- 诊断报告页升级为“问题定位中心”：显示最可能原因、失败分类、证据、下一步建议、检测项时间线和详细日志。
- 复制摘要会包含最可能原因，方便发给朋友或管理员。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。

下一步推荐：继续细化 n2n 失败分类 UI 的修复入口，例如从诊断页一键跳到通用组网中心并带入“要修复的项”；同时更新 MVP 发布清单，把 TCP 代理自测与失败分类纳入发布标准。

## 2026-06-03 游戏适配器体系升级第一步：游戏类型与连接方案沉淀

已开始实现“游戏适配器体系升级 / 游戏类型识别与方案沉淀”大区块。

- 后端 `GameAdapter` / `GameSummary` / `GameAnalysis` 新增 `network_type` 和 `connection_plan`。
- 新增 `GameNetworkType`：LAN/IP 直连、专用服务端、需要 TCP 端口代理、需要 UDP 广播桥、Steam Lobby 可直连、Steam Relay 插件、需要 Mod、仅官方、暂不支持、未知需审核。
- 新增 `GameConnectionPlan`：连接方案摘要、房主步骤、加入者步骤、默认加入主机/端口、是否需要虚拟局域网、TCP 端口代理、UDP 广播桥、专用服务端、邀请模板、排错建议。
- 旧适配器 JSON 兼容：新字段为可选，不会破坏已有 adapter。
- 扫描和分析接口会透传新字段，供推荐页和后续诊断使用。
- 适配器管理页新增“游戏网络类型 / 管理员认定”和连接方案编辑区，管理员可把一次判断沉淀为 adapter。
- 内置示例和本地 registry 示例已更新 Terraria、Minecraft Java、Stardew Valley 的 `network_type` / `connection_plan`，并重新生成 registry sha256。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。

下一步推荐：把 `connection_plan` 接入推荐方案页和邀请包，让用户看到的推荐不只是 methods，而是明确的“房主做什么 / 加入者做什么 / 是否需要 TCP 代理或 UDP 广播桥”。

## 2026-06-03 connection_plan 接入推荐方案页

已把适配器沉淀的 `connection_plan` 接入推荐方案页和好友邀请包：

- 推荐页显示游戏网络类型、沉淀连接方案、房主步骤、加入者步骤、默认连接主机/端口。
- 显示方案需求：虚拟局域网、专用服务端、TCP 端口代理、UDP 广播桥。
- 执行清单优先使用 `connection_plan` 的房主/加入者说明。
- 好友邀请包包含 `connection_plan` 的邀请模板和排错建议。
- 这让管理员认定过的游戏方案可以被后续用户直接复用，避免每个用户重复判断同一游戏该如何联机。

下一阶段继续做“游戏类型识别与方案沉淀”：把未知游戏的管理员认定、本地 adapter 保存、共享库同步、推荐页复用和诊断提示串成闭环。

## 2026-06-03 UDP 能力架构记录

新增 `docs/UDP_BRIDGE_MVP.md`：

- 明确 UDP 单播端口代理与 UDP 广播桥的区别。
- 决定下一步优先做 UDP 单播端口代理，因为它可以复用 TCP 代理的任务管理、自测和诊断模式。
- 广播桥作为后续能力，重点处理房间发现、广播/组播转发、防回环和可诊断计数。

## 2026-06-03 UDP 单播端口代理后端 MVP

已实现 UDP 单播端口代理后端 MVP：

- 新增 `src-tauri/src/core/udp_proxy.rs` 和 `src-tauri/src/models/udp_proxy.rs`。
- 支持启动、停止、列表、读取状态和一键 UDP Echo 自测。
- UDP 代理维护客户端来源地址映射和 TTL，能把目标 UDP 回包转发给活跃客户端。
- 状态包含活跃客户端数、收发包数、收发字节、最近错误和日志。
- 客户端关闭时会停止所有由联机助手管理的 UDP 代理。
- 前端 API 与类型已接入：`src/types/udpProxy.ts`、`src/api/tauri.ts`。

验证通过：

```powershell
cargo test --manifest-path src-tauri\Cargo.toml udp_proxy -- --nocapture
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
```

下一步：把 UDP 端口代理卡片接入通用组网中心，并把 `self_test_udp_proxy` 加入诊断报告检查项。

## 2026-06-03 UDP 端口代理 UI 与诊断接入

已把 UDP 单播端口代理接入通用组网中心和发布级诊断：

- 通用组网中心新增“房主 UDP 端口代理”卡片。
- 支持启动、停止、刷新状态和一键 UDP Echo 自测。
- UI 明确说明 UDP 单播代理只解决已知 IP/端口转发，不解决 LAN 广播/组播房间发现。
- 通用组网邀请文本加入“房主 UDP 端口代理”摘要。
- 诊断报告新增 `udp_port_proxy_self_test` 检查项。
- 如果 UDP 自测失败，会生成 `udp_proxy_self_test_failed` 失败分类和下一步建议。

验证通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
cargo test --manifest-path src-tauri\Cargo.toml udp_proxy -- --nocapture
npm run tauri:build
```

下一步：进入 UDP 广播桥 MVP，实现受控广播/组播发现包转发，并在 adapter 中对 `udp_broadcast_needed` 游戏显示能力状态。

## 2026-06-03 UDP 广播桥后端 MVP

已实现 UDP 广播桥后端 MVP：

- 新增 `src-tauri/src/core/udp_broadcast_bridge.rs` 和 `src-tauri/src/models/udp_broadcast_bridge.rs`。
- 支持启动、停止、列表、读取状态、一键自测。
- 支持监听指定 UDP 地址/端口，并把收到的发现包转发到一个或多个指定目标。
- 状态包含收到包数、转发包数、丢弃包数、收发字节、最近错误和日志。
- 加入简单防回环：对 payload 做签名，短 TTL 内重复包会丢弃。
- 前端 API 和类型已接入：`src/types/udpBroadcastBridge.ts`、`src/api/tauri.ts`。
- 客户端关闭时会停止由联机助手管理的 UDP 广播桥。

验证通过：

```powershell
cargo test --manifest-path src-tauri\Cargo.toml udp_broadcast_bridge -- --nocapture
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
```

下一步：把 UDP 广播桥接入通用组网中心 UI，并加入诊断报告 `udp_broadcast_bridge_self_test`。

## 2026-06-03 UDP 广播桥 UI 与诊断接入

已把 UDP 广播桥接入通用组网中心和发布级诊断：

- 通用组网中心新增“UDP 广播桥”卡片。
- 支持配置监听地址/端口、多个转发目标、启动、停止、刷新状态和一键自测。
- 状态来自真实后端广播桥：收到包数、转发包数、丢弃包数、收发字节、最近错误和日志。
- 通用组网邀请文本加入 UDP 广播桥摘要。
- 诊断报告新增 `udp_broadcast_bridge_self_test` 检查项。
- 如果广播桥自测失败，会生成 `udp_broadcast_bridge_self_test_failed` 失败分类和下一步建议。
- UI 明确提示：广播桥只辅助房间发现，不保证最终加入；如果游戏支持直接 IP，应优先连接房主虚拟 IP。

验证通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
cargo test --manifest-path src-tauri\Cargo.toml udp_broadcast_bridge -- --nocapture
npm run tauri:build
```

下一步：把适配器 `requires_udp_broadcast_bridge` 与推荐页/诊断联动，遇到需要广播桥的游戏时显示能力是否就绪。

## 2026-06-03 推荐页接入 TCP/UDP/广播桥能力状态

已把适配器 `connection_plan` 与当前真实能力状态联动：

- 推荐页刷新执行清单时会读取：TCP 端口代理、UDP 单播端口代理、UDP 广播桥的真实运行状态。
- “方案需求”不再只显示适配器声明，而是同时显示当前能力是否就绪。
- 执行清单新增“方案所需桥接/代理”检查：如果游戏需要 TCP 代理或 UDP 广播桥但未启动，会显示待启动。
- 好友邀请包加入当前 TCP 代理、UDP 代理、UDP 广播桥运行摘要。
- 如果 `requires_udp_broadcast_bridge=true`，邀请包会明确说明“需要 UDP 广播桥，但当前是否运行”。

验证通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
```

下一步：把同样的“适配器需求 vs 当前能力”检查扩展到诊断报告，生成更明确的失败分类。

## 2026-06-03 诊断报告接入适配器需求巡检

已把“适配器需求 vs 当前能力”纳入发布级诊断：

- 诊断报告会巡检已加载 adapter 的 `connection_plan`。
- 检查需要虚拟局域网的游戏是否有 n2n ACK/PONG。
- 检查需要 TCP 端口代理的游戏是否通过 TCP 代理自测。
- 检查端口代理候选游戏是否通过 UDP 单播代理自测。
- 检查需要 UDP 广播桥的游戏是否通过广播桥自测。
- 检查需要专用服务端的游戏是否观察到服务端会话 running/ready。
- 检查未知或缺少 `connection_plan` 的游戏，并生成 `adapter_unknown_need_review` 问题。
- 新增总检查 `adapter_requirement_alignment`，并把细分 adapter 检查并入 `release_checks`。

验证通过：

```powershell
cargo check --manifest-path src-tauri\Cargo.toml
npm run build
npm run tauri:build
```

下一步：继续完善“未知游戏认定 → 保存本地 adapter 草稿 → 同步共享库”的入口，让用户/管理员能把诊断中发现的 unknown_need_review 直接转成可复用方案。

## 2026-06-03 扫描页未知游戏创建适配器草稿入口

已在游戏扫描页加入“创建适配器草稿”入口：

- 对未匹配、`unknown_need_review` 或缺少 `connection_plan` 的游戏显示“创建适配器草稿”按钮。
- 点击后会把扫描到的游戏名、game_id、Steam AppID、扫描路径说明写入本地 custom adapter 草稿。
- 草稿默认标记为 `network_type=unknown_need_review`，不会伪装为已支持。
- 草稿自带待确认的 `connection_plan`，要求管理员后续认定 LAN/IP、专用服务端、TCP 代理、UDP 广播桥、Steam Relay、仅官方联机或暂不支持。
- 创建后会刷新扫描结果，并提供进入“适配器管理”继续认定的入口。
- 扫描页统计“需人工适配”现在会把 unknown/缺少 connection_plan 的游戏计入。

验证通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
```

下一步：在适配器管理页增加“按游戏网络类型自动应用推荐模板/需求”的能力，减少管理员手动勾选错误。

## 2026-06-03 适配器管理页按网络类型自动应用模板

已在适配器管理页实现“游戏网络类型 / 管理员认定”自动模板联动：

- 管理员选择 `lan_ip_direct`、`dedicated_server`、`tcp_port_proxy_needed`、`udp_broadcast_needed`、`steam_lobby_direct_possible`、`steam_relay_plugin`、`mod_required`、`official_only`、`not_supported`、`unknown_need_review` 后，会自动同步推荐字段。
- 自动同步内容包括：`capabilities`、`multiplayer_conversion`、`methods`、`connection_plan`、`requires_virtual_lan`、`requires_tcp_port_proxy`、`requires_udp_broadcast_bridge`、`requires_dedicated_server`。
- 模板不会覆盖已有 game_id、display_name、Steam AppID、executables；已有端口不为空时也不会覆盖端口。
- 页面提示管理员仍需人工确认默认端口、房主步骤、加入者步骤和具体游戏限制。

验证通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
```

下一步：把本地 custom adapter 草稿导出/同步流程再完善，便于把认定后的方案提交到共享 registry。

## 2026-06-03 适配器导出生成共享库提交说明

已完善 adapter 导出流程：

- 适配器管理页导出 adapter JSON 时，会同时生成“共享库提交说明”。
- 提交说明包含：`adapter-registry/games/xxx.json` 放置路径、SHA256、`adapter-registry/index.json` 需要加入/更新的 entry。
- SHA256 在前端用 WebCrypto 对导出 JSON 计算，便于提交到静态 registry 后被客户端校验。
- 提交说明会提醒审核边界：不要误导性一键联机，不允许未知 exe，不绕过正版验证/反作弊/官方账号服务。

验证通过：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
```

下一步：补充/更新 `docs/ADAPTER_REGISTRY.md` 的实际提交步骤，确保管理员知道如何把本地 custom adapter 放入 GitHub 共享库。

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

## 2026-06-03 Stitch 高级前端提示词与后端接口对接清单

本次没有直接改现有前端代码，而是为下一轮“重新构筑前端”准备两份关键文档：

- `docs/STITCH_PREMIUM_FRONTEND_PROMPT.md`
  - 可完整复制给 Stitch；
  - 要求一次性生成联机助手完整页面集合；
  - 风格定位为 iOS / macOS 高级清爽工具应用；
  - 明确减少深蓝色、避免游戏加速器霓虹风、避免只换色；
  - 覆盖首页、方案库、游戏扫描、推荐方案、通用组网中心、Terraria 向导、诊断报告、设置/帮助；
  - 对所有页面列出必须按钮、输入项、状态、交互和文案要求；
  - 强调中文不能乱码，普通用户不应直接看到过多 adapter / registry / MVP 等内部词。

- `docs/FRONTEND_BACKEND_API_MAP.md`
  - 整理新前端与现有 Tauri 后端的页面级对接关系；
  - 按首页、方案库、游戏扫描、推荐方案、通用组网中心、Terraria 向导、诊断报告、设置/帮助分别列出应调用 API；
  - 单独整理 TCP 端口代理、UDP 端口代理、UDP 广播桥的接口与 UI 展示要求；
  - 强调所有绿色成功状态必须来自真实 API 返回，不能 UI 假绿；
  - 明确首次进入/缓存/主动刷新策略，避免页面反复卡顿；
  - 建议后续封装 `useAsyncAction`、`useCachedResource`、`useToast`、`useN2nStatus`、`useServerSession` 等 hooks。

重要产品原则继续保持：

- Terraria 向导是“深度向导示例”，不是每个游戏都要单独做完整向导；
- 普通局域网游戏主流程应通过“共享游戏方案 + 推荐方案 + 通用组网 + 高级代理/广播桥”解决；
- 端口、服务端、n2n、诊断状态必须尊重真实后端结果；
- 新 UI 可以更高级、更清爽，但不能牺牲真实状态和可排障性。

下一步推荐：把 Stitch 生成的新界面先拆成 App Shell、通用组件、页面结构三层，再按 `docs/FRONTEND_BACKEND_API_MAP.md` 封装 hooks 接入真实 Tauri API。

## 2026-06-03 迁移下载前端的 App Shell 视觉但保留真实后端逻辑

用户提供了 `C:\Users\ty\Downloads\联机助手` 的新前端视觉稿，并要求先迁移 App Shell、Sidebar、Header、Toast、基础卡片样式，暂不替换当前项目后端逻辑。

本次改动：

- 重写 `src/components/Layout.tsx`：
  - 保留当前项目页面路由与导航目标；
  - 不引入下载前端的假状态和 `setTimeout` 业务逻辑；
  - 新增浅色 macOS 风左侧侧栏；
  - 新增顶部指挥栏；
  - 新增轻量全局 Toast，仅用于页面切换反馈；
  - 顶部状态显示为“待真实检测”，避免 UI 假绿。
- 扩展 `src/styles/globals.css`：
  - 增加 iOS/macOS 浅色玻璃视觉 token；
  - 覆盖基础按钮、输入框、卡片、状态卡、表格、Toast、Loading Overlay 的浅色样式；
  - 对首页已有专用 premium 类追加浅色兼容覆盖，提升可读性；
  - 保留当前页面组件和 Tauri API 调用不变。

验证：

- `npm run build` 通过；
- 使用浏览器打开 `http://127.0.0.1:5173` 检查首页；
- 中文显示正常；
- 侧栏、顶部栏、Toast 和基础卡片已呈现浅色高级风格；
- 未替换后端接口，当前真实功能调用路径仍保留。

说明：这一步只迁移外壳与基础视觉，不代表已经把下载前端的各页面完整一比一应用。后续如果用户认可风格，再逐页迁移页面结构，并按 `docs/FRONTEND_BACKEND_API_MAP.md` 接真实 Tauri API。

下一步推荐：让用户先人工查看客户端整体观感；如果认可，再迁移“方案库”和“游戏扫描”两个低风险页面的视觉结构，同时继续保留真实 API。

## 2026-06-03 继续迁移内容区样式：首页、方案库、游戏扫描

用户确认浅色外壳颜色满意，但指出里面内容样式还没有换。本次继续把内容层往下载前端的浅色高级风格迁移，同时继续保留真实后端逻辑。

本次改动：

- `src/pages/AdapterManagerPage.tsx`
  - 增加 `library-page modern-content-page` 页面 class；
  - 增加方案库内容 Hero 区，展示“游戏方案库”、本地方案数量、上次同步状态；
  - 给共享库同步、本地适配器、编辑器、导入导出区增加内容面板 class；
  - 保留 `listGameAdapters`、`syncAdapterRegistry`、`syncLocalAdapterRegistryExample`、`saveGameAdapter`、导入导出等真实 API 调用不变。
- `src/pages/GameScanPage.tsx`
  - 增加 `scan-page modern-content-page` 页面 class；
  - 增加游戏扫描内容 Hero 区，展示已发现数量和扫描状态；
  - 给扫描操作栏、筛选侧栏增加新版内容样式 class；
  - 保留 `scanGames` 由 App 层触发、`saveGameAdapter` 创建草稿等真实逻辑不变。
- `src/styles/globals.css`
  - 新增内容页 Hero、mini stats、内容面板、表格、过滤侧栏、游戏卡片等浅色高级样式；
  - 修复方案库页脚本替换时误写入的字面量 `` `r`n ``；
  - 把来源徽章 `builtin / registry / custom / steam_scan` 改成浅色风格，减少旧深色残留。

验证：

- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- 已重新生成新版 `src-tauri\target\release\lan-helper.exe`。

下一步推荐：继续迁移“推荐方案”和“通用组网中心”两个核心执行页面的内容结构，重点是邀请包、n2n 诊断卡、TCP/UDP/广播桥高级区的视觉一致性。

## 2026-06-03 新前端参考目录切换

用户提供新的前端参考目录：

```text
C:\Users\ty\Downloads\联机助手 (1)
```

从现在开始，后续页面视觉迁移优先参考这个新目录，而不是旧目录 `C:\Users\ty\Downloads\联机助手`。

初步检查结果：

- 新目录仍是独立 Vite/React 静态前端参考，不可直接覆盖当前 Tauri 项目；
- 但相对旧参考已补充大量用户要求的内容：
  - `SolutionsView.tsx` 扩展了共享方案/编辑器/缓存刷新相关区域；
  - `GameScanView.tsx` 扩展了上次扫描缓存、游戏详情/分析弹层、适配器要求和诊断证据；
  - `RecommendProtocolView.tsx` 扩展了好友 IP 分配与邀请包；
  - `UniversalNetworkView.tsx` 大幅扩展了 TCP 端口代理、UDP 端口代理、UDP 广播桥完整配置；
  - `TerrariaGuideView.tsx` 增加了 help / save / exit 服务端命令控制台；
  - `DiagnosticsView.tsx` 扩展了失败证据、可能原因、行动路径和刷新缓存概念。

后续迁移原则保持不变：

- 只吸收视觉结构和文案组织；
- 不使用参考前端中的假成功状态、写死 IP、写死延迟、setTimeout 模拟结果；
- 迁移到当前项目时必须接回 `src/api/tauri.ts` 的真实 Tauri API；
- 所有绿色状态仍必须来自真实检测。

下一步推荐：继续迁移“推荐方案”和“通用组网中心”，参考新目录中的 `RecommendProtocolView.tsx` 与 `UniversalNetworkView.tsx`，但保留当前项目真实后端逻辑。

## 2026-06-03 迁移推荐方案与通用组网中心内容样式

按用户要求继续使用新参考目录 `C:\Users\ty\Downloads\联机助手 (1)`，迁移“推荐方案”和“通用组网中心”的内容层视觉结构，但不替换后端逻辑。

本次改动：

- `src/pages/RecommendationPage.tsx`
  - 增加 `recommendation-page modern-content-page` 页面 class；
  - 推荐方案页头改为内容 Hero 风格；
  - 执行清单增加新版内容面板结构；
  - 游戏邀请好友包区域增加 `invite-panel`、`friend-ip-panel`、`invite-preview-panel`；
  - 游戏摘要、下一步通用组网等区域增加新版内容面板 class；
  - 保留 `analyzeGame`、`recommendPlans`、`getN2nDiagnostics`、`testConnectivity`、`launchProfile` 等真实 API 调用不变。
- `src/pages/NetworkSetupPage.tsx`
  - 增加 `network-page modern-content-page` 页面 class；
  - 通用组网中心页头改为内容 Hero 风格；
  - 当前网络后端、n2n 主配置、n2n 诊断、通用排查、手动测试增加新版内容面板 class；
  - TCP 端口代理、UDP 端口代理、UDP 广播桥、Steam 中继预留入口增加 `proxy-panel` 系列 class；
  - 保留 `setupNetwork`、`startNetwork`、`stopNetwork`、`getN2nDiagnostics`、`startPortProxy`、`startUdpProxy`、`startUdpBroadcastBridge`、自测和刷新等真实 API 调用不变。
- `src/styles/globals.css`
  - 新增推荐方案/通用组网页的浅色模块化内容样式；
  - 强化执行步骤、邀请包、n2n 诊断、代理配置、广播桥配置、排查测试的浅色卡片布局；
  - 参考新前端视觉，但没有引入假状态或写死结果。

验证：

- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- 已重新生成新版 `src-tauri\target\release\lan-helper.exe`。

说明：浏览器预览通用组网页时会出现 `Cannot read properties of undefined (reading 'invoke')`，这是因为普通浏览器没有 Tauri `invoke` 环境；打包后的 Tauri 客户端内不会因为这个原因缺少 invoke。

下一步推荐：继续迁移“Terraria 向导”和“诊断报告”的内容视觉，重点是服务端控制台 help/save/exit、诊断证据/可能原因/下一步建议。

## 2026-06-03 迁移 Terraria 向导与诊断报告内容样式

本次继续参考 `C:\Users\ty\Downloads\联机助手 (1)`，迁移 Terraria 向导和诊断报告的内容层视觉结构，仍然只吸收视觉和信息架构，不替换真实后端逻辑。

本次改动：

- `src/pages/MultiplayerWizardPage.tsx`
  - 增加 `terraria-page modern-content-page` 页面 class；
  - 增加 Terraria 向导内容 Hero 和状态 mini stats：当前身份、服务端状态、游戏端口、本机虚拟 IP；
  - 身份选择、n2n 房间配置、服务端配置、自检结果、邀请信息、内嵌控制台改为新版内容面板结构；
  - 新增真实服务端命令按钮 `help`、`save`、`exit`，通过 `sendServerCommand` 调用 Tauri 后端，不模拟日志；
  - 保留 `listNetworkBackends`、`readServerSession`、`setupNetwork`、`startNetwork`、`startGameServerSession`、`stopServerSession`、`testConnectivity` 等真实 API。
- `src/pages/DiagnosticsPage.tsx`
  - 增加 `diagnostics-page modern-content-page` 页面 class；
  - 诊断页头改为内容 Hero；
  - 操作按钮、最可能原因、失败分类、检测项时间线、详细日志改为新版内容面板结构；
  - 保留上次诊断缓存、复制摘要、复制完整报告、清空日志等现有真实逻辑；
  - 继续通过 `generateDiagnosticReport` / `generateDiagnosticReportForGame` 获取真实后端报告。
- `src/styles/globals.css`
  - 新增 Terraria/诊断页浅色 iOS/macOS 内容样式；
  - 强化服务端控制台、邀请包预览、诊断时间线、失败证据、右侧问题定位面板的视觉层级；
  - 没有新增假延迟、假在线、假成功数据。

验证：

- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- 已重新生成新版 `src-tauri\target\release\lan-helper.exe`。

下一步推荐：做全页面“前后端真实状态审查”，逐页检查是否还存在假绿、普通浏览器 invoke 报错误导、按钮点击无反馈、加载缓存不一致、以及中文乱码风险。

## 2026-06-03 全页面真实状态审查首轮修复

本轮开始进入“前后端真实状态审查 + 发布级 UI 体验检查”。已修复首批明确问题：

- `src/api/tauri.ts`
  - 所有 Tauri invoke 现在经过统一错误归一化；
  - 普通浏览器预览导致的 `invoke` 缺失错误会显示中文提示：请使用打包后的 `lan-helper.exe`，避免用户误以为后端功能本身坏了。
- `src/App.tsx` / `src/pages/GameScanPage.tsx`
  - 游戏扫描失败不再静默清空列表；
  - 扫描错误会传给游戏扫描页展示，并提供“重新扫描”入口；
  - 扫描状态从“空列表”区分为“扫描失败 / 暂未发现游戏”。
- `src/pages/HomePage.tsx`
  - 移除首页写死的 62% / 48% 准备度，避免假状态误导；
  - 改成当前身份的推荐步骤数量，明确它是流程提示，不是真实检测。
- `act.md` / `docs/PRODUCT_MEMORY.md`
  - 修复历史 Stitch 记录中的问号乱码块，保证关键记忆可读。

验证：

- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\\Cargo.toml` 通过；
- `npm run tauri:build` 通过。

下一步推荐：继续第二轮真实状态审查，重点检查 `GameDetailPage`、`Layout` 顶部状态、推荐页和组网页中是否还有“待真实检测/可发布/可联机”等状态没有接真实后端，必要时改为真实诊断入口或中性文案。

## 2026-06-03 真实状态审查第二轮修复

本轮继续审查 Layout、GameDetail、Recommendation 等页面，修复弱反馈和可能误导用户的状态：

- `src/pages/GameDetailPage.tsx`
  - 新增真实加载遮罩，调用 `analyzeGame` 时显示“正在分析游戏”；
  - 分析失败不再静默清空，而是显示“分析失败”错误；
  - 详情页改为统一浅色内容 Hero / 内容面板；
  - “继续配置网络”按钮只有拿到真实分析结果后才可点击。
- `src/pages/RecommendationPage.tsx`
  - 执行清单中“游戏启动 / 服务端”不再把 `serverSession.running` 直接当成绿色可用；
  - 只有 `serverSession.ready` 或本机端口真实可连才显示“端口已确认”；
  - `running` / `launchOk` 只显示为“启动中”警告态，避免假绿。
- `src/components/Layout.tsx`
  - 顶部按钮从“启动组网”改成“打开组网”，避免导航按钮暗示已经启动后端服务。
- `src/styles/globals.css`
  - 新增 GameDetail 页面浅色内容样式。

验证：

- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `git diff --check` 通过。

下一步推荐：继续第三轮审查通用组网页和推荐页剩余状态，包括顶部 shell 状态是否需要接诊断缓存、组网页刷新失败提示、以及代理/广播桥停止按钮在未运行时的用户反馈。

## 2026-06-03 通用组网页真实状态审查第三轮修复

本轮聚焦 `NetworkSetupPage` 的 n2n、TCP/UDP 代理、UDP 广播桥真实状态反馈。

修复内容：

- 新增 `actionMessage` 操作结果提示；
  - 成功执行启动、停止、刷新、自测等动作后，会显示“操作结果”；
  - 如果后端返回 `message`，会直接展示后端真实消息；
  - 失败仍进入 `networkLoadError`，不会显示假成功。
- 停止按钮改为只有真实运行时可点：
  - n2n edge 未运行时禁用“停止 n2n edge”；
  - TCP 端口代理未运行时禁用“停止 TCP 端口代理”；
  - UDP 端口代理未运行时禁用“停止 UDP 端口代理”；
  - UDP 广播桥未运行时禁用“停止 UDP 广播桥”。
- 单项刷新按钮现在走 `runAction`：
  - 刷新 TCP 端口代理状态；
  - 刷新 UDP 端口代理状态；
  - 刷新 UDP 广播桥状态；
  - 用户能看到加载遮罩、成功提示或失败提示，而不是点了以后没反馈。

验证：

- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `git diff --check` 通过。

下一步推荐：做第四轮审查 AdapterManager 和 Diagnostics 的按钮反馈与真实状态，包括复制按钮异常、同步失败信息、诊断缓存清空后状态是否准确。

## 2026-06-03 方案库与诊断页真实反馈第四轮修复

本轮审查 `AdapterManagerPage` 和 `DiagnosticsPage` 的按钮反馈、复制异常和缓存状态。

修复内容：

- `src/pages/AdapterManagerPage.tsx`
  - 导出 JSON 的复制按钮改为走统一 `copyToClipboard`；
  - 共享库提交说明复制按钮也改为统一反馈；
  - 复制成功显示成功消息，复制失败显示剪贴板错误；
  - 没有可复制内容时显示明确失败提示。
- `src/pages/DiagnosticsPage.tsx`
  - 诊断报告缓存现在按 `selectedGameId` 匹配；
  - 切换游戏上下文时，不再展示不匹配的旧诊断报告，而是提示用户重新生成当前上下文报告；
  - 生成报告成功后显示“诊断报告已生成”；
  - 复制完整报告、复制摘要加入成功/失败反馈；
  - 清空日志后显示“诊断报告已清空”；
  - 修复本轮修改过程中出现的问号乱码风险，并重新检查无连续问号残留。

验证：

- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `git diff --check` 通过。

下一步推荐：做第五轮总体验收审查，检查所有核心页面是否仍存在直接 `navigator.clipboard` 无反馈、按钮无 disabled、普通浏览器 invoke 误导、以及“可发布/可联机/已就绪”状态没有真实来源的问题。

## 2026-06-03 总体验收第五轮修复

本轮做全项目总体验收搜索，重点检查直接剪贴板调用、假绿状态和强承诺文案。

修复内容：

- `src/pages/AdapterManagerPage.tsx`
  - 统一复制函数不再使用可选链静默跳过；
  - `navigator.clipboard` 不存在时会抛出并显示“剪贴板不可用”，避免误报已复制。
- `src/pages/MultiplayerWizardPage.tsx`
  - 复制邀请信息、复制自检结果均显式检查剪贴板可用性；
  - Terraria 服务端控制台不再把 `running` 显示为绿色成功；
  - 只有 `session.ready` 才显示绿色，`running` 改为警告/待确认态，避免“进程启动中”被误认为“端口已就绪”。
- `src/pages/NetworkSetupPage.tsx`
  - 复制通用组网配置、n2n 管理员摘要、Steam 中继草案均加入剪贴板失败反馈。
- `src/pages/RecommendationPage.tsx`
  - 复制游戏邀请好友包加入剪贴板失败反馈。
- `src/pages/DiagnosticsPage.tsx`
  - “总体状态：可发布”改为“核心通过”；
  - 补充说明“来自后端报告；不等于已经完成发布”，避免诊断通过被误解为产品可发布。
- `act.md` / `docs/PRODUCT_MEMORY.md`
  - 去掉用于说明的 连续问号 字面量，避免后续乱码搜索误报。

验证：

- 全项目搜索直接剪贴板调用，剩余调用均有成功/失败反馈；
- 全项目搜索连续问号，无源码乱码残留；
- `npm run build` 通过；
- `cargo check --manifest-path src-tauri\\Cargo.toml` 通过；
- `npm run tauri:build` 通过；
- `git diff --check` 通过。

下一步推荐：做一次发布级人工验收清单回放：按首页 → 方案库 → 游戏扫描 → 推荐方案 → 通用组网 → Terraria 向导 → 诊断报告逐页在 release exe 中点击主要按钮，记录任何真实运行问题。

## 2026-06-03 新增发布预检入口

为了让发布验收不只靠口头检查，新增 `tools/release_preflight.ps1` 和 npm 脚本：

- `npm run release:preflight`
- `npm run release:preflight:full`

预检会自动检查关键文档、release exe、adapter registry、连续问号乱码、静默剪贴板调用、强承诺文案等。已确认 `npm run release:preflight` 通过。

下一步推荐：打开 release exe，按 `docs/RELEASE_VALIDATION_PLAN.md` 做逐页人工回放，并把真实结果记录到 `docs/RELEASE_VALIDATION_LOG.md`。

## 2026-06-03 启动 release exe 人工回放验收

本轮已执行 `npm run release:preflight`，结果 PASS，工作区无未提交变更。

当前阶段正式进入 release exe 人工回放验收，不继续盲目新增功能。验收目标是确认当前产品作为 0.1.0 MVP 测试版是否足够稳定：

- 页面按钮是否真实可用；
- 加载/耗时操作是否有遮罩或状态反馈；
- 成功/运行/就绪是否来自真实后端状态；
- 失败是否明确提示原因；
- 中文是否正常；
- 诊断、组网、Terraria、推荐方案等页面是否保留合理缓存；
- 是否还存在白框、透明框、假绿、卡顿无反馈等发布级问题。

下一步推荐：打开 `src-tauri\target\release\lan-helper.exe`，按首页、方案库、游戏扫描、推荐方案、通用组网中心、Terraria 向导、诊断报告逐页人工回放。
