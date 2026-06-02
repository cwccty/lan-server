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
