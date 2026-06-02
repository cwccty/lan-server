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


## 2026-06-02 Stitch 7 ?????????

? Stitch ??? 7 ?????????????? React/Tauri ???

- ??????????????????????????????????????????
- 7 ????????????????????Terraria ????????????????????????
- ????????????? VPN ??????????????????????????????????
- ???????????????????????????????????
- ????????????????????????????????/??/??????????????????
- ??????????????????????????????????????????????
- Terraria ??????????Terraria ?????????????????n2n ????????
- `.playwright-mcp/` ????????????????

???`npm run build`?`cargo check --manifest-path src-tauri\Cargo.toml`?`npm run tauri:build` ????release exe ?? `src-tauri\target\release\lan-helper.exe`?


## 2026-06-02 修复前端中文显示为问号

用户反馈前端所有汉语显示为问号。定位结论：不是字体问题，而是上次通过 PowerShell/管道写入部分 TSX 文件时，中文在源码层被替换成了问号；同时 PowerShell 直接 Get-Content 会以错误编码显示乱码，不能作为唯一判断。

已修复：

- 改用 Node 以 UTF-8 写回关键前端文件，恢复中文文案：Layout、HomePage、GameScanPage、RecommendationPage、DiagnosticsPage、MultiplayerWizardPage。
- 修复 index.html 标题为“联机助手”。
- 修复 DiagnosticsPage 中日志 join 的换行转义问题。
- 用 UTF-8 读取构建产物验证：dist/assets 中包含“联机助手、首页、通用组网中心、Terraria 向导、游戏扫描、推荐方案、适配器管理、诊断报告”等中文，并且没有连续问号串。

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