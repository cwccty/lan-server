# 联机助手项目规划

## 1. 项目定位

联机助手是一款面向普通 Steam/PC 玩家的 Windows 一键小型游戏联机工具。它不承诺“让所有 Steam 游戏都能脱离 Steam 联机”，而是通过自动识别游戏能力、检测网络环境、推荐可行方案、辅助配置和启动，把原本复杂的 LAN/IP/虚拟局域网/服务端联机流程简化为可理解、可复现的步骤。

核心目标：

- 自动判断游戏适合哪种联机方式。
- 自动检测本机、对方、虚拟局域网、端口、防火墙与延迟。
- 自动推荐最稳定、最低风险的联机方案。
- 提供检测、配置、启动、诊断一条龙体验。

## 2. 目标用户

第一目标用户是普通 Windows Steam 玩家，尤其是 2-8 人小型合作游戏玩家。

典型场景：

- 游戏通过 Steam 联机卡顿，希望尝试 IP 直连或虚拟局域网。
- 游戏支持 LAN，但双方不在同一局域网。
- 游戏有 Dedicated Server，但用户不会启动和连接。
- 用户已经使用 Radmin VPN、EasyN2N、ZeroTier、Tailscale 等工具，但不会判断游戏怎么连。

## 3. 产品边界

第一版只做 Windows 桌面应用。

第一版支持：

- 游戏扫描与手动添加。
- 静态游戏适配库。
- 游戏联机能力分析。
- n2n/EasyN2N 方向的一键虚拟局域网基础能力。
- Radmin VPN 安装、网卡、IP、连通性检测。
- Manual LAN 兜底检测。
- 推荐方案生成。
- 游戏/服务端启动入口。
- 诊断报告。

第一版不做：

- Steam API 模拟。
- DLL 注入。
- Hook。
- 破解、绕过 DRM、绕过反作弊。
- 未授权修改游戏文件。
- 承诺所有 Steam 游戏可用。

## 4. 总体路线图

### 阶段 0：项目规划与骨架初始化

- 建立 `PROJECT.md` 和 `act.md`。
- 初始化 Tauri + React + TypeScript + Rust 项目骨架。
- 固定模块、接口、数据结构、文件命名。

### 阶段 1：第一版 MVP

- 本地游戏识别。
- 静态游戏适配库读取。
- Manual LAN、Radmin 检测、n2n 后端骨架。
- 连接测试和推荐引擎初版。
- UI 五步流程。
- Terraria 端到端验证。

### 阶段 2：第二版增强

- 完善游戏适配库。
- 增加远程适配库更新。
- 增加 ZeroTier/Tailscale 后端抽象实现。
- 做局域网发现辅助。
- 针对“Steam Lobby 只负责发现，实际可直连”的游戏增加专用适配。

### 阶段 3：长期实验能力

- Steam API 兼容层研究。
- 本地代理/Hook 研究。
- 游戏专用插件系统。
- 高级诊断、云端适配市场、社区配置分享。

所有高风险能力必须进入高级/实验模式，不进入普通用户默认流程。

## 5. 第一版 MVP 规划

第一版目标是证明：对支持 LAN/IP/Dedicated Server 的小型游戏，联机助手能显著降低配置难度。

MVP 范围：

- Windows 桌面客户端。
- Tauri + Rust + React + TypeScript。
- n2n 主实现，Radmin 辅助检测，Manual LAN 兜底。
- 固定适配 Terraria、Stardew Valley、Minecraft Java。
- 实现基础游戏扫描、能力分析、网络检测、推荐方案和诊断报告。

MVP 验收：

- 能读取适配库并显示游戏。
- 能对 Terraria 给出 IP 直连/Dedicated Server 推荐。
- 能检测 Radmin 是否安装和虚拟网卡 IP。
- 能执行 ping/TCP 连接测试。
- 能生成用户可复制的诊断报告。

## 6. 第二版规划

第二版在 MVP 可用基础上扩展“可持续适配能力”。

功能方向：

- 远程游戏适配库更新与版本校验。
- 更多游戏：Core Keeper、Valheim、Project Zomboid、Don't Starve Together、Palworld。
- ZeroTier/Tailscale 检测与辅助。
- 局域网广播发现辅助。
- 端口冲突检测与修复建议。
- Steam Lobby 可直连型游戏的专用适配。
- 用户反馈诊断包导出。

第二版仍不默认加入 Hook/注入/Steam API 模拟。

## 7. 后续长期规划

长期能力分为普通能力和实验能力。

普通能力：

- 游戏适配市场。
- 社区维护游戏配置。
- 多后端自动评分。
- 自动选择最低延迟方案。
- 网络质量历史记录。
- 房间码系统。

实验能力：

- Steam API 兼容层。
- 本地代理。
- 针对单个游戏的协议适配插件。
- Hook/注入研究。

实验能力规则：

- 默认关闭。
- 必须展示风险说明。
- 不用于反作弊游戏。
- 不承诺兼容性。
- 不和 MVP 普通流程混杂。

## 8. 技术栈

- 桌面框架：Tauri。
- 核心语言：Rust。
- 前端框架：React。
- 前端语言：TypeScript。
- 构建工具：Vite。
- 包管理：npm。
- 配置格式：JSON。

选择理由：

- Rust 适合进程、网络、端口、防火墙、系统诊断等底层逻辑。
- Tauri 体积小，适合工具型桌面应用。
- React + TypeScript 适合构建普通玩家友好的现代 UI。

## 9. 总体架构

```text
Frontend UI
→ src/api/tauri.ts
→ Tauri Commands
→ Rust Core Services
→ Adapters / Network Backends / System Probes
```

架构原则：

- 前端只负责展示、引导和调用 API。
- Rust Core 负责真实检测、判断、启动和配置。
- 游戏适配通过 JSON 数据驱动。
- 网络后端必须通过统一接口接入。
- 推荐引擎不直接操作系统，只根据分析结果给出方案。

## 10. 模块设计

Rust Core 模块：

- `game_detector`：扫描 Steam 库、常见安装路径和手动游戏。
- `capability_engine`：根据适配库判断联机能力。
- `recommendation_engine`：生成推荐方案。
- `connectivity_tester`：ping、TCP、UDP、端口、延迟检测。
- `game_launcher`：启动游戏、服务端或打开连接说明。
- `diagnostic_logger`：生成诊断报告。
- `network/backend`：网络后端 trait。
- `network/n2n_backend`：n2n 后端。
- `network/radmin_backend`：Radmin 检测后端。
- `network/manual_lan_backend`：手动 LAN/IP 后端。
- `storage/adapter_store`：游戏适配库读取。
- `storage/settings_store`：用户设置读取。

## 11. 数据结构设计

核心模型：

```ts
type GameCapability =
  | "lan"
  | "ip_join"
  | "dedicated_server"
  | "steam_lobby"
  | "steam_p2p"
  | "official_server"
  | "unknown";

type RecommendationLevel = "recommended" | "tryable" | "unsupported" | "unknown";
```

必须定义：

- `GameSummary`
- `GameAnalysis`
- `GameAdapter`
- `LaunchProfile`
- `NetworkBackendKind`
- `BackendSummary`
- `NetworkConfig`
- `ConnectivityTarget`
- `ConnectivityReport`
- `Recommendation`
- `DiagnosticReport`

Rust 与 TypeScript 字段命名保持一致，序列化使用 `serde`。

## 12. Tauri API 设计

前端 API 使用 camelCase，Rust command 使用 snake_case。

```ts
scanGames(): Promise<GameSummary[]>
analyzeGame(gameId: string): Promise<GameAnalysis>
listNetworkBackends(): Promise<BackendSummary[]>
setupNetwork(backendId: string, config: NetworkConfig): Promise<SetupResult>
startNetwork(backendId: string): Promise<BackendRuntimeStatus>
stopNetwork(backendId: string): Promise<BackendRuntimeStatus>
testConnectivity(target: ConnectivityTarget): Promise<ConnectivityReport>
recommendPlans(gameId: string): Promise<Recommendation[]>
launchProfile(gameId: string, profileId: string): Promise<LaunchResult>
generateDiagnosticReport(): Promise<DiagnosticReport>
```

## 13. 前端页面设计

第一版页面：

- `HomePage`：入口与四个主行动按钮。
- `GameScanPage`：扫描结果与手动添加入口。
- `GameDetailPage`：游戏能力分析。
- `NetworkSetupPage`：选择 n2n、Radmin 或 Manual LAN。
- `RecommendationPage`：展示推荐方案与启动动作。
- `DiagnosticsPage`：诊断报告生成和复制。

普通用户默认只看简洁推荐；高级信息放入折叠区域。

## 14. 文件与目录命名规范

- 前端组件：PascalCase，例如 `GameCard.tsx`。
- 前端 API 和类型：camelCase 文件或领域名，例如 `tauri.ts`、`game.ts`。
- Rust 文件：snake_case，例如 `game_detector.rs`。
- 游戏适配文件：snake_case，例如 `stardew_valley.json`。
- 文档：根目录 Markdown。

固定目录见仓库结构，不得随意改名。确需调整时必须同步更新 `PROJECT.md` 和 `act.md`。

测试文档：

- `docs/TEST_TERRARIA.md`：Terraria 第一版端到端测试流程。

## 15. 游戏适配库设计

适配库位于 `adapters/games/`。

最小格式：

```json
{
  "game_id": "terraria",
  "display_name": "Terraria",
  "steam_appid": "105600",
  "capabilities": ["lan", "ip_join", "dedicated_server"],
  "executables": ["Terraria.exe", "TerrariaServer.exe"],
  "default_ports": [7777],
  "launch_profiles": [
    { "id": "client", "name": "启动游戏", "type": "client" },
    { "id": "server", "name": "启动本地服务端", "type": "server", "exe": "TerrariaServer.exe" }
  ]
}
```

## 16. 网络后端设计

统一接口：

```ts
NetworkBackend {
  detect(): BackendStatus
  setup(config): SetupResult
  start(): BackendRuntimeStatus
  stop(): BackendRuntimeStatus
  getVirtualIp(): IpResult
  testPeer(peer): ConnectivityReport
}
```

第一版后端：

- `manual_lan`：无需配置，只测试用户输入 IP/端口。
- `radmin`：检测安装、网卡、IP、连通性；不自动创建网络。
- `n2n`：管理 edge 进程；第一版允许用户填写 supernode。

当前 n2n 文件约定：

- `tools/n2n/edge.exe` 或 `tools/n2n/n2n.exe`：用户或后续安装器提供的 n2n edge 可执行文件。
- `tools/n2n/README.md`：本地 n2n 可执行文件放置说明。
- `tools/n2n/last_config.json`：最近一次保存的 n2n 配置。
- `tools/n2n/n2n.pid`：联机助手启动的 n2n edge 进程 PID。

n2n 运行策略：

- 启动前读取 `tools/n2n/n2n.pid` 并通过 `tasklist` 判断进程是否仍在运行。
- 若 PID 仍运行，直接返回当前运行状态，避免重复启动。
- 若 PID 已失效，清理旧 PID 后再尝试启动。
- 停止时只停止由联机助手记录 PID 的 n2n 进程。
- 虚拟 IP 识别优先使用 `Get-NetIPAddress`，失败后回退到 `ipconfig` 解析。

游戏启动策略：

- `launch_profile.type = client/server` 时，优先根据 Steam 安装检测结果定位游戏目录，再启动对应 `exe`。
- `launch_profile.args` 会原样传给可执行文件。
- `launch_profile.type = docs` 时，不启动进程，只返回连接说明。
- 第一版只启动用户本机已安装游戏或服务端，不下载、不修改游戏文件。

Steam 游戏检测优先级：

1. 读取 Windows 注册表中的 Steam 安装路径：`SteamPath` / `InstallPath`。
2. 扫描 Steam 默认安装目录。
3. 解析 `steamapps/libraryfolders.vdf` 获取额外库。
4. 若存在 `appmanifest_{steam_appid}.acf`，优先读取 `installdir`。
5. 使用适配库 `executables` 在 `steamapps/common/*` 中兜底匹配。

游戏适配库读取策略：

- 优先从当前工作目录及其父级查找 `adapters/games`。
- 同时从当前可执行文件所在目录及其父级查找 `adapters/games`，解决 release exe 从 `src-tauri/target/release` 启动时找不到适配库的问题。
- 如果外部适配库仍未找到，使用编译时内置的 Terraria、Stardew Valley、Minecraft Java 适配作为兜底，确保首页不会因路径问题显示空适配库。

适配库外游戏扫描策略：

- 通过 Steam `appmanifest_*.acf` 自动发现已安装但尚未适配的游戏。
- 未适配游戏以 `steam_{appid}` 作为 `game_id`，能力标记为 `unknown`。
- 未适配游戏可以显示名称、Steam AppID 和安装路径，但默认不提供 LAN/IP/Dedicated Server 判断。
- 推荐引擎对未适配游戏返回“不支持/未知”类提示，引导后续补充适配。

## 17. 推荐引擎设计

推荐规则：

- 游戏支持 `ip_join` 且网络后端互通：推荐虚拟局域网 IP 直连。
- 游戏支持 `dedicated_server`：推荐房主启动服务端，其他玩家连接虚拟 IP。
- 仅 `steam_lobby` 且无直连证据：标记为可尝试或未知。
- `steam_p2p` 强绑定：第一版标记不支持非 Steam 替代。
- `official_server` 强绑定：标记不支持。

## 18. 诊断与日志设计

诊断报告包含：

- 应用版本。
- 操作系统。
- 游戏 ID 与适配结果。
- 网络后端状态。
- 本机虚拟 IP。
- 目标 IP/端口测试结果。
- 推荐方案。
- 错误摘要。

诊断报告不得包含：

- Steam 登录凭据。
- 系统密码。
- SSH Key。
- 浏览器 Cookie。
- 无关用户目录内容。

## 19. 安全、权限与合规边界

- 第一版不得实现 Hook、注入、破解、绕过反作弊。
- 仅操作项目目录、应用配置目录、用户明确选择的游戏路径。
- 需要管理员权限的操作必须明确提示。
- 所有外部工具必须可追踪来源和版本。
- 高风险能力必须隔离到后续实验模式。

## 20. 测试计划

文档测试：

- `PROJECT.md` 覆盖所有固定章节。
- `act.md` 可恢复当前上下文。

骨架测试：

- `npm install` 成功。
- `npm run build` 成功。
- `cargo check` 成功，若本机无 Rust 工具链则在 `act.md` 记录阻塞。

功能测试：

- 能读取适配库。
- 能返回游戏列表。
- 能返回后端列表。
- 能生成推荐方案。
- 能生成诊断报告。

## 21. 开发流程约束

每次开发必须遵守：

1. 先读取 `PROJECT.md` 和 `act.md`。
2. 明确本次目标属于哪个阶段。
3. 开发完成后更新 `act.md`。
4. 若新增 API、数据结构、目录、文件命名或架构，必须更新 `PROJECT.md`。
5. 不得在第一版实现 Steam API 模拟、Hook、注入、破解或反作弊绕过。

## 22. 通用开服配置模型（2026-06-01 补充）

不同游戏的开服参数不应该通过“每个游戏一个前端页面”解决，而应该由游戏适配器声明，客户端使用统一表单渲染。

### 设计原则

- 前端只实现一套通用启动参数表单。
- 每个游戏在 `adapters/games/*.json` 的 `launch_profiles` 中声明自己的开服参数。
- Rust 启动器根据 `args`、`arg_templates`、`stdin_templates` 和用户填写的 `config_fields` 生成真实启动行为。
- 适配器负责表达差异，客户端负责统一展示和执行。

### LaunchProfile 扩展字段

```json
{
  "id": "server",
  "name": "启动本地服务端",
  "type": "server",
  "exe": "TerrariaServer.exe",
  "config_fields": [
    { "id": "world_choice", "label": "世界编号", "type": "number", "default_value": "1", "required": true },
    { "id": "max_players", "label": "最大人数", "type": "number", "default_value": "8", "required": true },
    { "id": "port", "label": "端口", "type": "number", "default_value": "7777", "required": true }
  ],
  "stdin_templates": ["{{world_choice}}", "{{max_players}}", "{{port}}"]
}
```

字段说明：

- `config_fields`：前端统一渲染的参数表单，支持 `text`、`number`、`password`、`select`、`checkbox`。
- `arg_templates`：用于命令行参数模板，例如 `--port {{port}}`。
- `stdin_templates`：用于控制台交互式服务端的输入模板，例如 Terraria Server 的世界编号、人数、端口、密码。
- `args`：固定启动参数，适用于不需要用户配置的场景。

### 当前落地

- Terraria 的服务端启动项已改为适配器驱动的通用开服参数。
- 推荐方案页会根据当前游戏的 `config_fields` 自动显示表单。
- `launch_profile` Tauri API 新增 `config` 参数，前端无需为 Terraria 写专用页面。

### Terraria Server 启动补充

Terraria 的服务端属于交互式控制台程序。实践中，直接在进程启动后立即写入 stdin 不稳定，可能导致控制台仍停留在世界选择界面。因此当前 Terraria 适配采用更稳定的命令行参数方式：

- `-world <世界文件路径>`
- `-players <最大人数>`
- `-port <端口>`
- `-pass <密码>`，仅密码非空时传入
- `-noupnp`，当用户选择不自动端口转发时传入

世界选择策略：

1. 如果用户填写 `world_path`，优先使用该 `.wld` 文件。
2. 否则扫描：
   - `%USERPROFILE%\Documents\My Games\Terraria\Worlds`
   - OneDrive Documents 下的 `My Games\Terraria\Worlds`
3. 按文件名排序后使用 `world_choice` 选择对应世界。

如果未来要完全匹配 Terraria 控制台中显示的世界顺序，需要增加“读取世界名称/世界元数据”的专用解析能力；第一版先以 `.wld` 文件发现和手动路径兜底保证可用。

## 23. n2n 作为核心内置组网方案（2026-06-01 补充）

第一版网络后端定位调整为：

- Radmin：检测、引导和辅助诊断，不作为可嵌入核心。
- n2n：作为联机助手长期核心内置组网方案。
- Manual LAN：作为本地局域网、已有 VPN 或手动 IP 场景的兜底。

已补充 `docs/N2N_GUIDE.md`，用于解释 edge、supernode、community、secret、local_ip 的含义和配置方式。

n2n 当前执行模型：

```text
每台玩家电脑运行 edge
↓
edge 连接同一个 supernode
↓
使用相同 community 和 secret 加入同一个虚拟网络
↓
每台电脑获得不同虚拟 IP
↓
游戏通过虚拟 IP + 端口连接
```

第一版暂不自动下载 n2n，也不自动部署 supernode；客户端只负责检测、配置、启动、停止、诊断和说明生成。

## 24. n2n edge 获取与 supernode 部署路线（2026-06-01 补充）

已决定优先采用 A 方案：从官方源码自行构建 n2n edge，避免第一版直接依赖来源不明的第三方 Windows 二进制。

新增 VPS supernode 部署文档：

- `docs/N2N_SUPERNODE_DEPLOY.md`

未来方向加入“n2n 自动下载/安装”能力，但不进入当前第一版默认流程。该能力必须满足：

- 固定 n2n 版本；
- 下载地址白名单；
- SHA256 校验；
- 用户明确确认；
- 下载失败、杀毒拦截、权限不足时给出解释；
- 不静默安装虚拟网卡或 VPN 组件；
- 在诊断报告中记录 n2n 版本和二进制哈希。

supernode 当前推荐：

- VPS 上运行 `supernode -l <udp_port>`；
- 云厂商安全组放行对应 UDP 端口；
- 用 systemd 常驻；
- 客户端填写 `公网IP或域名:端口`。

## 25. 联机向导与内嵌服务端控制台

为降低普通用户使用难度，新增联机向导作为第一版主流程：

```text
选择身份
→ 配置 n2n 房间
→ 房主启动服务端 / 加入者启动 n2n
→ 复制邀请信息 / Join via IP
```

内嵌控制台设计原则：

- 不直接嵌入系统 cmd/Terminal 窗口。
- 由 Rust 托管游戏服务端子进程。
- Windows 下隐藏外部控制台窗口。
- 捕获 stdout/stderr 并显示在前端日志面板。
- 第一版先支持 Terraria 服务端。
- 第一版先支持启动、读取日志、停止；后续再支持发送服务端命令。

新增 Tauri API：

```ts
startGameServerSession(gameId, profileId, config)
readServerSession()
stopServerSession()
```

新增 Rust 模块：

```text
src-tauri/src/core/server_session.rs
src-tauri/src/models/server_session.rs
```


## 26. 后台控制台隐藏与向导等待反馈（2026-06-01 补充）

针对用户反馈“打开后持续出现空白白色命令框、按钮点击后卡顿/无等待提示”，本轮调整：

- Terraria 服务端不再通过 PowerShell `Start-Process` 中转启动，改为 Windows `CreateProcessW`。
- 启动时创建一个隐藏的新控制台：既给 Terraria Server 有效 Console 句柄，避免 `Console.Title` 句柄无效；又通过 `STARTF_USESHOWWINDOW + SW_HIDE` 隐藏窗口。
- `read_server_session` 的 PID 检测在 Windows 下改用 `OpenProcess + GetExitCodeProcess`，避免每次轮询都执行 `tasklist`，减少卡顿来源。
- 联机向导增加全局 `busyAction`：执行保存 n2n、启动/停止服务端、复制邀请、发送命令时显示“正在处理，请稍等”，并临时禁用关键按钮，避免重复点击。
- 服务端状态轮询从 1.5 秒调整到 3 秒，并在操作进行中暂停轮询，减少前端和后端请求堆积。

说明：当前隐藏模式仍不是完整 ConPTY 伪终端，第一版主要保证“后台启动、PID 管理、端口就绪判断”。后续如果需要真正实时日志和可交互命令，再进入 Windows ConPTY 方案。


## 27. 主程序白色控制台窗口修复（2026-06-01 补充）

本轮确认“打开联机助手就出现的白色空窗口”不是 Terraria Server 或 n2n edge，而是 release 主程序缺少 Windows GUI 子系统标记导致。修复方式：

- 在 `src-tauri/src/main.rs` 增加 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`。
- release 构建后 `lan-helper.exe` 将作为 Windows GUI 程序启动，不再附带控制台窗口。
- 同时将 `tauri.conf.json` 的产品名和窗口标题改为 JSON Unicode escape，避免命令行编码导致中文再次被写成乱码。
