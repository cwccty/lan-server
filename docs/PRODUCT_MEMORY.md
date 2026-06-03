# 产品记忆与关键决策

更新时间：2026-06-02

## 1. 产品级原则

联机助手按“可发布产品”标准推进，不把截图问题当成单纯的前端显示问题处理。

必须遵守：

- UI 状态必须来自真实运行状态：进程、端口、虚拟网卡、n2n edge、supernode 连接、实际连通性。
- 不能用“把红叉改绿勾”“隐藏错误”“只改文案”来掩盖内部状态混乱。
- 自检通过必须代表真实链路通过；自检失败必须能说明失败环节和下一步操作。
- 服务端如果曾经监听后退出，界面必须保留最后日志和退出状态，不能简单变灰且不给原因。
- 发布前必须测试重复点击、启动后退出、端口占用、n2n 重复注册、虚拟 IP 冲突、旧进程残留、管理员权限不足等场景。

## 2. 组网层与游戏层分离

n2n / Radmin / Manual LAN 是“通用组网层”，不应该绑定 Terraria 或任何单个游戏。

正确产品结构：

```text
联机助手
├─ 通用组网中心
│  ├─ n2n：内置 edge 启停、配置、虚拟 IP、supernode、互通测试
│  ├─ Radmin：检测、读取虚拟 IP、引导用户进入外部 Radmin 网络
│  └─ Manual LAN：已有局域网、已有 VPN、ZeroTier、Tailscale 等手动 IP/端口测试
│
├─ 通用局域网游戏流程
│  ├─ 我已经在游戏里开好房/服务端
│  ├─ 朋友连接我的虚拟 IP
│  └─ 输入指定端口做连通性测试
│
└─ 游戏向导，可选增值层
   ├─ Terraria：自动找服务端、选择世界、启动服务端、生成邀请
   ├─ Minecraft：未来可做一键服务端/端口提示
   └─ 其他游戏：只在能明确降低用户配置成本时适配
```

结论：世界上支持 LAN 的游戏很多，不应该为每个游戏单独做一套 n2n 配置。游戏适配只负责“开服、找路径、填端口、生成说明、诊断常见错误”，组网能力必须保持通用。

## 3. 当前优先级

1. 先把“通用组网中心”做稳定：n2n 启停、虚拟 IP、互通测试、邀请配置。
2. 再把 Terraria 向导作为首个游戏辅助场景做稳定。
3. 服务端托管必须真实可靠：监听后几秒退出属于发布阻断问题，不能只修显示。
4. 之后再扩展更多游戏或更多组网方式。

## 4. 关键测试基线

当前已验证过的房主侧基线：

```text
VPS supernode：154.64.231.137:7777
房主虚拟 IP：10.10.10.2
Terraria 端口：7777
Test-NetConnection 10.10.10.2 -Port 7777 => True
InterfaceAlias：cfw-tap
SourceAddress：10.10.10.2
```

这说明 n2n + TAP + Terraria 端口在房主侧可以打通。但若内嵌 TerrariaServer 随后退出，仍必须按服务端生命周期问题继续处理。

## 5. 当前已知发布阻断项

- TerrariaServer 可能出现“Listening on port 7777 后几秒进程退出”。
- 内嵌服务端控制台需要保留退出原因、最后日志和 exit code。
- NetworkSetupPage、Layout、HomePage 已开始转向“通用组网中心”定位；后续要继续统一所有页面命名和状态来源。

## 2026-06-02 结构化诊断要求

诊断报告必须包含 `release_checks`，用于明确 MVP 必需项是否通过。只有所有 `required_for_mvp=true` 的检查项通过，并完成朋友侧真实加入测试，才允许声明 MVP 完成。

## 2026-06-02 当前联机方式规划与开发进度补充

除 n2n 外，项目规划中还保留这些联机方式：

- Radmin VPN：作为外部工具检测和引导，不嵌入、不自动创建网络；适合用户已经会用 Radmin 的场景。
- Manual LAN / 手动 IP：作为兜底模式，覆盖同一局域网、已有 VPN、ZeroTier、Tailscale、自建 WireGuard 等情况；客户端只负责 IP/端口测试和解释。
- ZeroTier / Tailscale：后续可做检测与引导，但当前 MVP 不内置管理，先归入 Manual LAN 场景。
- 官方/自建 supernode：未来可产品化，当前只支持用户 VPS 自建 supernode。
- n2n 自动下载/安装：未来方向，必须固定版本、白名单下载、SHA256 校验和用户确认；当前 MVP 不自动下载。

当前开发进度以“可发布 MVP”为口径粗估：n2n 内置组网约 65%，通用组网中心约 45%，Terraria 向导约 55%，发布级诊断约 35%。真正完成 MVP 的条件不是界面看起来正常，而是 release 客户端生成的结构化 `release_checks` 必需项全部通过，并完成朋友侧真实加入测试。

## 2026-06-02 Terraria 后台服务端启动方式修正

为继续收敛 MVP 发布阻断项，当前 Windows 下 TerrariaServer 的托管启动方式已调整为：

```text
CreateProcessW
+ CREATE_NEW_CONSOLE
+ STARTF_USESHOWWINDOW / SW_HIDE
```

原因：TerrariaServer 属于控制台程序，隐藏窗口时不能简单让它完全没有控制台，否则可能出现控制台句柄无效并在监听前后退出。新的策略是“创建有效控制台，但隐藏窗口”，再用进程句柄、端口探测、运行时长和退出码判断真实状态。

当前策略：隐藏新控制台保证 Console API 可用，同时用匿名管道重定向 stdin/stdout/stderr。MVP 优先保证后台干净运行、端口真实可连、服务端输出可观察、命令按钮写入真实 stdin、退出可诊断；完整 ConPTY 伪终端作为后续增强。

## 2026-06-02 服务端托管输入输出闭环

在隐藏新控制台的基础上，Windows 下 TerrariaServer 启动时已增加匿名管道：

- stdin：用于向真实服务端发送 `help/save/exit` 等命令。
- stdout/stderr：用于把服务端输出读回内嵌控制台。
- 控制台环境：仍使用隐藏的新控制台，避免无控制台句柄导致服务端退出。

因此发布阻断项中的“没有白色命令框、服务端不因无控制台退出、内嵌控制台可观察、按钮可控制真实服务端”现在是同一套进程托管逻辑，而不是 UI 伪装。

诊断报告新增 `server_io_bridge` 检查项：只有检测到服务端 stdin/stdout/stderr 已重定向，才认为内嵌控制台与命令按钮具备发布级证据。

## 2026-06-02 n2n 后端文案与配置路径修正

为满足发布级诊断要求，n2n 后端已完成两项清理：

- 用户可见的检测、保存、启动、停止信息恢复为正常中文。
- 配置文件 `last_config.json` 和 PID 文件 `n2n.pid` 优先写入实际发现的 `tools/n2n` 目录，避免 release exe 工作目录变化时找得到 `edge.exe` 但读写另一个配置目录。

这保证“n2n edge 路径、PID、虚拟 IP、最近 supernode”能稳定显示在通用组网中心和诊断报告中。

## 2026-06-02 通用组网中心状态面板

通用组网中心已把 n2n 操作结果从原始 JSON 展示改为状态面板，直接展示 edge 检测、虚拟 IP、PID、supernode、保存/启动/停止结果，并提供复制给朋友的通用组网配置按钮。

这符合“组网层独立于游戏层”的产品结构，也让发布前验证不依赖开发者阅读 JSON。

## 2026-06-02 发布前一键汇总

诊断报告模型新增 `release_ready`、`required_passed`、`required_total`、`next_actions`。发布页会根据真实检查项自动生成下一步处理列表。MVP 是否可发布仍以 release 客户端生成的结构化诊断为准，不以口头判断为准。

## 2026-06-02 Terraria 健康检查与交互命令修正

用户实测发现，联机助手周期性用 TCP connect 检查 `127.0.0.1:7777` 会被 TerrariaServer 当成真实连接，导致内嵌控制台反复出现：

```text
127.0.0.1:<random> is connecting...
Saving world data...
Backing up world file
```

这是健康检查副作用，不是游戏自然行为。MVP 修正为：Windows 下只读取系统 TCP LISTEN 表判断端口是否监听，不再主动连接 TerrariaServer；非 Windows 才保留 TCP connect 兜底。

同时，`help/save/exit` 在隐藏后台托管模式下不能稳定证明被 TerrariaServer 接收。为避免发布产品出现“按钮可点但内部不可靠”的伪功能，MVP 阶段不再在联机向导暴露这些交互命令按钮。当前承诺范围调整为：后台干净运行、端口真实监听、日志可观察、退出诊断保留、停止托管可用。后续若实现 ConPTY/伪终端输入闭环，再恢复交互命令。

## 2026-06-02 Terraria 后台稳定性二次修正

用户实测显示：在隐藏后台模式下重定向 TerrariaServer 的 stdin/stdout/stderr 后，服务端会在 `Listening on port 7777` 和 `Type 'help' for a list of commands.` 之后以 `exit_code=0` 正常退出。这说明标准输入输出重定向本身会干扰 TerrariaServer 的控制台生命周期。

MVP 修正为：Windows 下创建隐藏控制台，但不再重定向 stdin/stdout/stderr。联机助手只用真实进程句柄、PID 对应 TCP LISTEN 表和运行时长判断服务端状态。内嵌面板显示托管状态，不再承诺完整交互式控制台或 Terraria 原始 stdout 日志。这样优先保证“服务端能稳定留在后台并监听端口”。

同时，n2n 的 `supernode` 输入框会从最近一次保存的配置中自动填入，减少用户重复输入；用户仍可手动覆盖。

## 2026-06-02 Terraria 后台稳定性第三次修正

继续跟踪用户截图后确认：直接 `CreateProcessW + CREATE_NEW_CONSOLE` 即使不重定向标准输入输出，仍可能让 TerrariaServer 在启动后以 `exit_code=0` 正常退出。说明从 GUI/Tauri 进程直接创建控制台子进程时，TerrariaServer 仍没有获得它期望的交互式控制台环境。

本轮改为 Windows Shell 托管模式：通过 PowerShell `Start-Process -WindowStyle Hidden -PassThru` 启动 TerrariaServer，再用返回的 PID 打开真实进程句柄，并继续用 PID 对应 TCP LISTEN 表判断 ready。目标是让 Windows shell 负责创建更接近普通双击/命令行启动的控制台进程，同时保持窗口隐藏和状态可诊断。

## 2026-06-02 Terraria 后台稳定性第四次修正：ConPTY 伪终端

继续测试后确认：Shell hidden 与普通隐藏控制台仍不足以让 TerrariaServer 长时间保持运行。当前结论是 TerrariaServer 需要的不是单纯“有/无控制台窗口”，而是接近真实交互终端的控制台环境。

本轮改为 Windows ConPTY 伪终端托管：联机助手创建 Pseudo Console，把 TerrariaServer 绑定到伪终端启动，父进程保留输入/输出管道并在内嵌控制台读取输出。这样既不弹出白色命令框，又给 TerrariaServer 一个交互式控制台环境。ready 判断仍然来自真实进程 PID 对应的 TCP LISTEN 表和运行时长。

## 2026-06-02 Terraria 后台稳定性第五次修正：隐藏 cmd 托管回退

ConPTY 在当前 TerrariaServer 环境中触发 `0xc0000142` 启动错误。本轮改为隐藏 `cmd.exe` 托管：通过 `cmd.exe /d /s /c TerrariaServer.exe ...` 在隐藏的新控制台中运行服务端，避免 ConPTY 兼容性问题，同时继续不显示白色命令框。由于端口由 TerrariaServer 子进程监听，ready 判断改为“当前会话进程仍运行 + 目标端口存在监听”。

## 2026-06-02 Terraria 后台托管第六次修正：接管真实监听进程

隐藏 `cmd.exe` 托管时，cmd 包装进程可能以 `exit_code=0` 退出，但 TerrariaServer 子进程仍在后台监听 `7777`。这会导致 UI 显示“未运行”，而自检端口又是可达的状态冲突。本轮增加真实监听进程接管：如果发现目标端口仍由某个 PID 监听，联机助手会打开该 PID 的进程句柄并把会话切换到真正的 TerrariaServer 进程，之后运行/停止/诊断都以该真实 PID 为准。

## 2026-06-02 多联机方式产品策略

联机助手可以做成“包揽主要联机方式供玩家选择”的产品，但不能把所有方式混成一个按钮。正确结构是分层：

```text
联机助手
├─ 通用组网层：n2n、Radmin、Manual LAN、ZeroTier/Tailscale 引导、未来自建/官方 supernode
├─ 端口转发层：未来可做 TCP/UDP 单端口转发，适合只需要一个游戏端口的场景
├─ 平台网络层：Steam Networking / Steam Relay 仅作为未来研究或插件路线，默认不进入 MVP，避免账号和合规风险
└─ 游戏辅助层：Terraria、Minecraft 等只负责开服、端口、邀请文本、错误诊断，不重复实现组网
```

产品原则：

- 第一目标不是“立刻支持所有底层协议”，而是让用户能按场景选择最稳的一种方式。
- 每种方式必须有清晰适用场景、限制、风险和诊断；不能为了“全能”牺牲可理解性。
- MVP 主线继续以 n2n + Manual LAN + Terraria 向导验证闭环；Radmin 保持检测/引导；ZeroTier/Tailscale 先归入 Manual LAN；Steam Networking 仅记录为未来研究，不作为默认承诺。
- 借鉴 connecttool-qt 的方向：房间/成员状态、聊天/置顶配置、TCP 转发模式、TUN 体验；但不照搬 Steamworks 依赖路线。

## 2026-06-02 房间与聊天 MVP 概念

通用组网中心新增“房间与聊天”面板，第一版定位为本地房间记录，不承诺实时联网聊天：

- 房间摘要：展示 community、supernode、房主虚拟 IP、游戏端口。
- 成员列表：记录房主/加入者昵称和虚拟 IP，帮助避免 IP 冲突。
- 置顶配置：生成可复制的房间信息，包含成员、端口和注意事项。
- 聊天记录：本地留言板，用于记录“我已启动 n2n”“端口已测通”等协作信息，可一起复制给朋友。

该设计先把 connecttool-qt 的“房间、成员、置顶配置、聊天”产品概念落地到现有通用组网中心。后续如果要做实时聊天，需要新增信令/房间服务或复用某个组网后端的消息通道；当前 MVP 不引入中心化账号系统。

## 2026-06-02 Steam 中继入口预留

根据用户要求，保留之前讨论过的 connecttool-qt 类路线作为一个正式功能入口：借助 Steam Networking / Steam Relay 做房间发现、P2P 或中继。

当前决策：它属于“平台网络层”的研究/插件路线，MVP 只预留入口和制作草案，不接入真实 Steamworks 后端，不影响 n2n 主线。

已新增：

- `docs/STEAM_RELAY_ENTRY.md`：记录 Steam 中继入口的定位、边界和 PoC 顺序。
- `src/pages/NetworkSetupPage.tsx`：通用组网中心新增“Steam 中继联机入口（预留）”卡片，可填写 AppID、房间名、中继模式和备注，并复制制作草案。
- `src/styles/globals.css`：给预留功能卡片增加视觉区分。

产品边界再次确认：只使用官方 Steamworks / Steam Networking SDK 或用户自有 AppID；不做破解服务器、绕过正版验证、绕过反作弊或模拟官方账号服务。后续真实开发必须先完成“创建房间 → 加入房间 → 文本消息/信令”的最小 PoC，再考虑端口代理、广播桥或游戏适配器桥接。

## 2026-06-02 推荐启动项语义修正

用户询问“扫描到的游戏执行推荐启动项是不是直接就可以本地联机”。当前产品结论：不是。

推荐页只负责把游戏适配到一个联机流程；“执行启动项”只代表启动游戏客户端、启动本地 Dedicated Server 或打开说明，不代表已经完成本地联机。真正联机必须同时满足：

1. 双方已经在同一个 n2n / Radmin / Manual LAN 网络中，虚拟 IP 不冲突。
2. 房主已经启动游戏房间或服务端，目标端口真实监听。
3. 加入方在游戏内用 LAN / IP 直连连接房主虚拟 IP 和端口。
4. 如果游戏本身没有 LAN/IP/服务端能力，不能只靠启动客户端；需要后续适配广播桥、端口代理、Mod 或 Steam Relay 等平台网络插件。

本次已在推荐页增加“这里不是一键已经联机”的说明，并把按钮文案从模糊的“执行推荐启动项”改成“启动游戏客户端 / 启动本地服务端”。后续推荐模型仍应继续区分“启动动作”和“联机完成状态”，避免发布产品误导用户。

## 2026-06-02 联机能力转换系统第一版

根据当前产品定位，推荐页从“给启动项”升级为“判断游戏能否转换成本地联机”。新增联机能力转换画像：

- `native_lan_ip`：原生 LAN/IP 直连。
- `hidden_dedicated_server`：有隐藏或独立服务端，可由启动器承接。
- `lan_discovery_broadcast`：依赖局域网广播发现，需要 UDP 广播桥；当前已有广播桥 MVP，但具体游戏仍需人工验证端口和发现流程。
- `tcp_udp_proxy_possible`：可尝试 TCP/UDP 端口代理。
- `community_mod`：依赖社区 Mod。
- `official_only`：只识别到官方/平台联机，不默认承诺转换。
- `unsupported` / `unknown`：暂不支持或需要人工适配。

每个画像包含：可否转换成本地联机、转换方式、风险等级、说明、所需组件。推荐页现在会优先展示“联机能力转换判断”，再展示启动项。

已给 Terraria、Minecraft Java、Stardew Valley 写入适配器示例。后续新增游戏时，必须先填写转换画像，再决定是否提供启动项。

## 2026-06-02 取消房间聊天 MVP

用户重新评估后认为本地房间聊天功能没有必要。当前决定：取消“房间与聊天”面板，不再保留成员列表、本地聊天记录、置顶聊天包等功能。通用组网中心保留必要的“复制给朋友的通用组网配置”，因为这是实际联机流程需要的邀请信息，不属于聊天系统。

Steam 中继入口保留为未来平台网络插件入口，但当前仍只是研究/预留，不作为实时房间聊天功能。

## 2026-06-02 游戏适配器共享库决策

用户担心“让每个用户手动认定游戏类型”会显得麻烦。当前产品决策：适配器认定不应是普通用户每次都要做的步骤，而应做成共享库机制。

目标形态：少数用户、管理员或维护者完成一次游戏类型认定并生成适配器；后续其他用户扫描到同一个 Steam AppID / exe / 游戏特征时，客户端自动命中该适配器并直接给出转换方案。

新增文档：`docs/ADAPTER_REGISTRY.md`，记录内置适配器、本地自定义适配器、远程共享适配器库、审核队列、匹配优先级、安全边界和开发顺序。

关键原则：

- 普通用户只需要扫描和使用推荐方案。
- 高级用户/管理员负责新增和审核适配器。
- 共享适配器必须是数据，不是可执行代码。
- 远程适配器后续需要 hash 校验，未来可加签名。
- 不能把未验证适配器包装成“一键联机”。

## 2026-06-02 本地适配器管理第一版

按共享适配器库策略，先实现本地适配器管理 MVP。该功能定位为管理员/高级用户入口，不是普通玩家必经流程。

已实现能力：

- 客户端新增“适配器管理”页面。
- 可查看当前适配器列表，包括游戏名、AppID、能力类型、默认端口。
- 可基于模板创建适配器：原生 LAN/IP、Dedicated Server、仅官方联机。
- 可编辑基础字段：game_id、显示名、Steam AppID、exe 列表、默认端口。
- 可编辑联机能力转换画像：能力类型、转换方式、是否可转换、风险等级、所需组件、判断说明。
- 可保存到本地 `adapters/games/custom_<game_id>.json`。
- 可导出适配器 JSON，复制给管理员或其他用户。
- 可粘贴导入适配器 JSON 并保存到本地。

后端新增命令：`list_game_adapters`、`save_game_adapter`、`import_game_adapter_json`、`export_game_adapter_json`。

当前仍是本地阶段；远程共享 registry 拉取、hash 校验、用户提交和管理员审核尚未实现。

## 2026-06-02 远程共享适配器库同步第一版

继续落地共享适配器库路线：适配器管理页新增远程 registry 同步。

当前支持的 registry 格式：

```json
{
  "version": 1,
  "updated_at": "2026-06-02",
  "games": [
    {
      "game_id": "terraria",
      "steam_appid": "105600",
      "adapter_url": "games/terraria.json",
      "sha256": "可选"
    }
  ]
}
```

客户端会从 `registry_url` 拉取 `index.json`，逐个下载 `adapter_url` 指向的适配器 JSON，并保存为 `adapters/games/registry_<game_id>.json`。如果 index 中提供 `sha256`，客户端会校验 hash，不匹配则跳过。

适配器优先级：

1. `custom_<game_id>.json`：本地用户/管理员显式覆盖，最高优先级。
2. `registry_<game_id>.json`：远程共享库同步结果。
3. 内置适配器 JSON。

这保证远程共享库能服务普通用户，同时不会覆盖用户本地明确修改过的适配器。

当前仍未实现在线提交和管理员审核后台；远程 registry 地址由用户/管理员手动填写，后续可加入默认官方 URL。

## 2026-06-02 本地 adapter-registry 示例目录

新增本地共享适配器库示例：`adapter-registry/`。

目录内容：

- `adapter-registry/index.json`：远程 registry 索引示例，包含 version、updated_at、adapter_url、sha256。
- `adapter-registry/games/terraria.json`
- `adapter-registry/games/minecraft_java.json`
- `adapter-registry/games/stardew_valley.json`
- `adapter-registry/README.md`：记录本地 HTTP 测试、VPS 部署、GitHub Pages 部署和 sha256 更新说明。

本地测试方式：

```powershell
cd E:\Documents\联机助手
python -m http.server 8088
```

客户端“适配器管理 → 远程共享适配器库”填写：

```text
http://127.0.0.1:8088/adapter-registry/index.json
```

该目录后续可直接上传到 VPS 静态目录或 GitHub Pages，用于测试远程同步。

## 2026-06-02 本地示例库同步按钮

用户测试远程 URL `http://127.0.0.1:8088/adapter-registry/index.json` 时出现 `fetch registry index failed`。本机验证显示 8088 端口不可达，原因是本地静态 HTTP 服务未启动或已关闭。

为降低测试门槛，本轮新增“同步本地示例库（无需 HTTP）”按钮：

- 不需要运行 `python -m http.server 8088`。
- 后端会自动从项目目录向上查找 `adapter-registry/index.json`。
- 读取本地 `adapter-registry/games/*.json`。
- 校验 index 中的 sha256。
- 保存为 `adapters/games/registry_<game_id>.json`。

远程 URL 同步仍保留，用于测试 VPS、GitHub Pages 或本地 HTTP 服务。

## 2026-06-02 适配器同步完成状态去除加载图标

用户反馈“本地示例库同步完成”后仍显示加载图标。原因是适配器管理页把普通完成消息也复用了 `busy-banner` 样式，而 `busy-banner::before` 固定带旋转 spinner。

已修正：

- 忙碌中继续使用 `busy-banner`，保留 spinner。
- 操作完成/错误等普通消息改用 `status-banner`，不显示 spinner。

这属于状态语义修正，避免用户误以为同步仍在继续。

## 2026-06-02 忽略 registry 运行时缓存

远程/本地示例库同步会在 `adapters/games/` 下生成 `registry_<game_id>.json`。这些文件是运行时缓存，不应该提交到 Git。

已处理：

- `.gitignore` 新增 `adapters/games/registry_*.json`。
- 清理当前测试生成的 registry 缓存文件。

保留规则：

- `adapter-registry/` 是共享库示例，可提交。
- `adapters/games/registry_*.json` 是用户同步缓存，不提交。
- `adapters/games/custom_*.json` 是用户本地自定义，后续也应评估是否默认忽略或提供导出提交流程。

## 2026-06-02 默认共享库地址与一键更新

适配器管理页新增“一键更新共享适配器”与默认共享库地址逻辑：

- 默认地址当前为开发/本地测试地址：`http://127.0.0.1:8088/adapter-registry/index.json`。
- 用户手动填写的 registry URL 会保存到 localStorage。
- 支持“恢复默认地址”。
- 同步完成后保存并显示上次同步时间、更新数量、跳过数量。
- 为避免开发默认地址在未启动 HTTP 服务时失败，若 URL 为空或仍为默认本地测试地址，“一键更新共享适配器”会直接走项目内置 `adapter-registry` 本地示例库同步；手动填写 VPS/GitHub Pages URL 后则走远程 HTTP 同步。

后续如果有正式官方 registry URL，只需要替换 `DEFAULT_ADAPTER_REGISTRY_URL` 并保留本地示例库按钮作为测试入口。

## 2026-06-02 GitHub 公开仓库与默认适配器连接

用户提供公开仓库：`https://github.com/cwccty/lan-server.git`。

当前默认共享适配器库 URL 已改为：

```text
https://raw.githubusercontent.com/cwccty/lan-server/master/adapter-registry/index.json
```

适配器管理页“一键更新共享适配器”现在默认走这个公开 GitHub raw 地址；“同步本地示例库（无需 HTTP）”按钮仍保留，用于离线/本地测试。

注意：当前本机访问 GitHub 出现连接超时，推送或远程可达性验证可能受网络影响。代码侧已完成配置，成功推送到 GitHub 后该 URL 才能正常拉取。

## 2026-06-02 适配器默认地址旧值迁移

用户反馈点击“恢复默认地址”后仍显示 `127.0.0.1:8088`。代码中最新默认值已是 GitHub raw，但旧版本曾把本地测试地址写入 localStorage，且用户可能正在运行旧 exe，导致界面仍显示旧值。

本轮补充：

- 新增 `LEGACY_LOCAL_REGISTRY_URL`，页面加载时如果发现 localStorage 仍是旧本地测试地址，会自动迁移到 GitHub raw 默认地址。
- “恢复默认地址”按钮改名为“恢复 GitHub 默认地址”。
- 适配器管理页显示版本号 `adapter-manager-2026-06-02-github-default`，用于确认用户打开的是最新 exe。

如果页面版本号没有出现，说明运行的不是最新 release exe。

## 2026-06-02 适配器来源标识

适配器管理和推荐页新增来源标识，用于验证当前生效适配器来自哪里：

- `builtin`：安装包/项目内置适配器。
- `registry`：远程共享库或本地示例库同步生成的 `registry_<game_id>.json`。
- `custom`：本地管理员/高级用户保存的 `custom_<game_id>.json`。
- `steam_scan`：Steam 自动扫描但尚未适配。

加载优先级仍然是：`custom > registry > builtin`。保存适配器时返回来源 `custom`，写入磁盘时不会把 `adapter_source` 固化到 JSON，来源由文件名前缀推断。

适配器管理页表格新增“来源”列；推荐页的“联机能力转换判断”里也会显示适配器来源。


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

产品决策：端口代理不是替代 n2n，而是在组网成功后，把“好友访问房主虚拟 IP 的某个端口”转发到房主本机真实游戏服务端，例如 `127.0.0.1:7777`。第一版只做 TCP，UDP 广播桥和 UDP 端口代理以后单独做，避免架构混乱。

已完成：

- 后端新增 TCP 端口代理运行时，支持启动、停止、列表、状态、连通性测试、连接数、字节统计、最近日志。
- Tauri 命令已注册，前端 API/类型已补齐。
- 程序退出时统一停止端口代理，避免残留后台监听。

未完成/下一步：

- 把端口代理接入推荐方案页或通用组网中心 UI。
- UI 必须显示真实状态：监听地址、目标地址、是否运行、连接数、最近错误、测试结果。
- 后续再做 UDP 相关能力，不要和本次 TCP MVP 混写。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。

## 2026-06-03 TCP 端口代理 UI 接入与端到端验证

产品状态：TCP 端口代理已从后端 MVP 接到通用组网中心，成为用户可操作能力。

当前能力：

- 房主侧可配置 `监听地址:监听端口 -> 目标地址:目标端口`。
- 默认推荐 `0.0.0.0:游戏端口 -> 127.0.0.1:游戏端口`。
- 页面按钮支持启动、停止、刷新、测试代理监听。
- 页面显示真实状态，不做假绿灯：运行状态、连接数、字节统计、最近错误、最近日志都来自后端代理运行时。
- 好友邀请文本包含端口代理摘要，方便解释“朋友连接房主虚拟 IP 的哪个端口”。
- 后端有端到端测试证明 TCP 字节可穿过代理转发。

使用边界：

- TCP 端口代理不是组网工具，不能替代 n2n；它运行在房主侧，前提是双方已经通过 n2n / Radmin / 其他方式进入同一虚拟局域网。
- 当前只支持 TCP。UDP 广播桥、UDP 端口代理、游戏协议转换应作为后续独立模块，不要混在这个 MVP 中。
- 对于本来就监听 `0.0.0.0` 或虚拟网卡地址的游戏，可能不需要端口代理；对于只监听 `127.0.0.1` 或需要换端口暴露的场景才使用。

验证：cargo test --manifest-path src-tauri\Cargo.toml tcp_proxy_forwards_bytes_end_to_end、npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过；Browser 已确认通用组网中心可见端口代理卡片。

下一步推荐：真实 Tauri 运行态手工测试并把测试步骤固化到诊断报告或 README。

## 2026-06-03 TCP 端口代理一键自测

产品状态：TCP 端口代理已具备产品内自测能力，用户不再需要手动打开 PowerShell Echo 服务才能验证代理是否能真实转发数据。

当前能力：

- 后端 `self_test_port_proxy` 自动完成 Echo 服务、临时代理、测试发送、读取返回和清理。
- 报告字段包含 ok、listen、target、sent、received、total_connections、bytes_in、bytes_out、notes、status。
- 通用组网中心新增“一键自测 TCP 代理”按钮和结果展示。
- 自测通过代表：代理能启动、监听能连接、数据能到达目标服务、目标服务返回的数据能经过代理返回、统计数据会增长。

边界：

- 自测只证明本机 TCP 代理功能正常，不证明朋友电脑、防火墙、n2n supernode、远端网络一定正常。
- 自测使用临时本地 Echo 服务，不会替代真实游戏服务端测试。
- 当前仍只覆盖 TCP，不覆盖 UDP 游戏、局域网广播发现或协议转换。

验证：cargo test --manifest-path src-tauri\Cargo.toml port_proxy、npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。

下一步推荐：把自测接入诊断报告，并在失败时给出“目标服务没开 / 监听端口被占用 / 代理不可启动”等分支建议。

## 2026-06-03 通用组网中心进入加载与缓存优化

产品决策：通用组网中心读取 n2n、网卡、日志和端口代理状态可能耗时，不能让用户感觉按钮无响应或页面卡死。首次进入需要明确加载动画；后续进入应先显示缓存，再后台刷新。

已完成：

- 首次无缓存进入：显示 LoadingOverlay。
- 后续有缓存进入：立即显示上次检测结果，后台刷新真实状态。
- 缓存内容：网络后端、n2n 诊断、TCP 端口代理状态、保存时间。
- 页面展示最近刷新时间。
- 刷新失败和操作失败显示错误提示，且保留旧状态，避免因为一次失败导致页面变空。
- 手动刷新按钮改为“刷新组网状态”，统一刷新 n2n 和 TCP 端口代理。

边界：

- 缓存只是为了减少等待感，不代表状态永远准确；后台刷新完成后会更新。
- 失败提示来自前端捕获的命令错误，后续应继续拆分为更具体的 n2n 失败类型。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。

下一步推荐：完善 n2n 失败分类提示和“下一步修复建议”。

## 2026-06-03 发布级诊断与失败分类第一步

产品状态：诊断报告已从“检查项列表”升级为“问题定位中心”的第一步。

已完成：

- 后端报告新增 `DiagnosticIssue` 结构和 `most_likely_cause`。
- n2n 失败分类已结构化：edge 缺失、supernode 未配置、edge 未运行、认证错误、IP/MAC 冲突、supernode 无响应、等待 ACK/PONG、虚拟 IP 缺失。
- 每个失败分类都包含下一步建议和证据。
- TCP 端口代理一键自测加入诊断报告，检查项 id 为 `tcp_port_proxy_self_test`。
- 诊断报告页展示：最可能原因、失败分类、证据、下一步修复建议、检测项时间线、详细日志。

边界：

- 这一步主要覆盖 n2n 和 TCP 端口代理，后续还要继续把游戏适配器、游戏类型、UDP 能力纳入诊断体系。
- `tcp_port_proxy_self_test` 当前不是 MVP 必需项，因为并非所有游戏都需要 TCP 代理；但它是重要能力自测项。
- 失败分类仍需持续根据真实用户日志扩展。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。

下一步推荐：更新 MVP 发布清单，并为诊断页增加“按失败类型跳转到对应修复页面”的产品流。

## 2026-06-03 游戏适配器体系升级第一步：游戏类型与连接方案沉淀

产品状态：适配器体系已开始从“能力标签”升级为“管理员认定的游戏类型 + 可复用连接方案”。

已完成：

- 新增 `GameNetworkType`，用于表达管理员认定的游戏联机类型。
- 新增 `GameConnectionPlan`，用于沉淀连接方案、房主/加入者步骤、默认主机/端口、需求组件、邀请模板和排错建议。
- `GameAdapter`、`GameSummary`、`GameAnalysis` 透传新字段。
- 新字段为可选，兼容旧适配器。
- 适配器管理页可编辑游戏网络类型和连接方案。
- 示例适配器和本地 registry 示例已写入新字段，并更新 sha256。

边界：

- 目前推荐页还未消费 `connection_plan`，下一步需要把它用于推荐卡片、邀请包和执行清单。
- UDP 广播桥只是类型和方案需求字段已预留，实际 UDP 后端尚未实现。
- Steam Relay 仍是预留/插件路线，不进入 MVP 默认承诺。

验证：npm run build、cargo check --manifest-path src-tauri\Cargo.toml、npm run tauri:build 均通过。

下一步推荐：将 `connection_plan` 接入推荐方案页，让扫描到游戏后自动显示沉淀方案。

## 2026-06-03 connection_plan 推荐方案闭环

适配器的 `connection_plan` 已经进入推荐页和邀请好友包，不再只是适配器管理页里的静态字段。

当前推荐页会把管理员/适配器沉淀的信息转成用户能执行的步骤：

- 游戏网络类型：例如 LAN/IP 直连、专用服务端、需要 TCP 端口代理、需要 UDP 广播桥、仅官方联机、未知需判断。
- 房主该做什么：创建房间、启动专用服务端、启动端口代理或等待后续 UDP 能力。
- 加入者该做什么：使用虚拟 IP 直连、加入专用服务端、按邀请包配置 n2n。
- 方案需求：是否需要虚拟局域网、专用服务端、TCP 代理、UDP 广播桥。
- 邀请包：包含方案摘要、房主/加入者步骤、默认连接端口、邀请模板和排错建议。

产品意义：后续用户扫描到同一个游戏时，应直接复用已经认定过的 adapter 方案，而不是再次从零理解 n2n、端口、服务端、UDP 发现等概念。

## 2026-06-03 UDP 端口代理与广播桥边界

产品上必须把 UDP 单播端口代理和 UDP 广播桥区分开：

- UDP 端口代理解决“已知 IP/端口的 UDP 数据转发”。
- UDP 广播桥解决“游戏房间列表依赖 LAN 广播/组播发现”。

两者不能共用一个模糊按钮。推荐页和诊断报告要根据 adapter 的 `connection_plan` 明确显示当前游戏到底需要哪一种能力。广播桥未实现前，相关游戏应标记为能力待实现或建议尝试手动 IP 直连。

## 2026-06-03 UDP 单播端口代理后端 MVP

UDP 单播端口代理已进入后端 MVP 阶段，定位为 TCP 端口代理的 UDP 版本，但产品上必须继续和 UDP 广播桥区分。

当前已支持：

- `start_udp_proxy`：启动 `listen_host:listen_port -> target_host:target_port` UDP 单播代理。
- `stop_udp_proxy`：停止指定代理。
- `list_udp_proxies` / `get_udp_proxy_status`：读取真实运行状态。
- `self_test_udp_proxy`：自动启动临时 UDP Echo 服务和临时 UDP 代理，发送 `hello udp proxy` 并读取回包。
- 状态字段包含活跃客户端、包数、字节数、最近错误和日志。

实现原则：UDP 无连接，不能照搬 TCP 连接模型。当前代理维护 `client_addr -> last_seen` 映射，并将目标回包转发给活跃客户端；映射通过 TTL 清理。

注意：这只能解决已知 IP/端口的 UDP 单播转发，不解决 LAN 广播/组播房间发现。广播发现仍属于后续 UDP 广播桥能力。

## 2026-06-03 UDP 端口代理 UI 与诊断接入

UDP 单播端口代理已经不只是后端命令，现已进入通用组网中心：

- 用户可以在“房主 UDP 端口代理”卡片里配置 `监听地址:监听端口 -> 目标地址:目标端口`。
- 可启动、停止、刷新状态，并执行“一键自测 UDP 代理”。
- 状态来自真实后端 UDP 代理：活跃客户端、收发包数、收发字节、最近错误和日志。
- 邀请好友文本会包含当前 UDP 代理摘要，便于朋友知道是否需要连接对应 UDP 端口。
- 诊断报告新增 `udp_port_proxy_self_test`，通过真实 UDP Echo 自测证明 UDP 单播转发可用。

产品边界仍保持清晰：UDP 端口代理不解决房间列表发现。游戏如果依赖 LAN 广播/组播发现，仍应标记为需要 UDP 广播桥，不能把 UDP 单播代理误导成广播桥。

## 2026-06-03 UDP 广播桥后端 MVP

UDP 广播桥已经进入后端 MVP 阶段，用于解决“组网已通，但依赖 LAN 广播/组播发现的游戏列表看不到房间”的问题。

当前能力：

- `start_udp_broadcast_bridge`：监听指定 UDP 地址/端口，把收到的发现包转发到指定目标列表。
- `stop_udp_broadcast_bridge`：停止指定广播桥。
- `list_udp_broadcast_bridges` / `get_udp_broadcast_bridge_status`：读取真实运行状态。
- `self_test_udp_broadcast_bridge`：自动启动临时 UDP 接收器和临时广播桥，发送 `hello udp broadcast bridge` 并验证转发。
- 状态字段包含 received/forwarded/dropped 包数、收发字节、最近错误和日志。
- 简单防回环：短时间内重复 payload 会被丢弃并计入 dropped。

产品边界：广播桥只辅助“发现房间”，不保证最终加入成功。加入仍取决于游戏端口、协议、组网、账号/平台和反作弊等因素。它也不能替代 UDP 单播端口代理；两者必须继续分开展示。

## 2026-06-03 UDP 广播桥 UI 与诊断接入

UDP 广播桥已经进入通用组网中心，并纳入诊断报告。

当前用户可配置：

- 监听地址；
- 监听端口；
- 一个或多个转发目标；
- 启动 / 停止 / 刷新；
- 一键自测 UDP 广播桥。

当前状态全部来自后端真实桥接任务：收到发现包、转发发现包、丢弃包、收发字节、最近错误和日志。

诊断报告新增 `udp_broadcast_bridge_self_test`。如果失败，会输出 `udp_broadcast_bridge_self_test_failed`，并提示用户区分两种情况：

- 支持直接 IP 的游戏：优先连接房主虚拟 IP，不必依赖广播桥；
- 依赖房间列表发现的游戏：广播桥失败时需要继续提交诊断给开发者定位。

产品边界再次确认：广播桥只辅助发现房间，不保证最终加入成功；UDP 单播端口代理和 UDP 广播桥必须继续分开展示和诊断。

## 2026-06-03 推荐页适配器需求与能力状态联动

推荐页已经开始把 adapter 的 `connection_plan` 和当前运行能力连起来，不再只展示“这个游戏需要什么”。

现在推荐页会读取真实后端状态：

- TCP 端口代理是否运行；
- UDP 单播端口代理是否运行；
- UDP 广播桥是否运行。

当 adapter 声明：

- `requires_tcp_port_proxy=true`，推荐页会显示 TCP 代理是否已运行；
- `requires_udp_broadcast_bridge=true`，推荐页会显示 UDP 广播桥是否已运行；
- UDP 单播代理当前作为可选能力展示，供需要 UDP 直连端口的游戏使用。

执行清单会新增“方案所需桥接/代理”项，邀请包也会带上当前能力摘要。这让用户能看到“这个游戏需要的能力是否真的准备好了”，而不是只看到静态说明。

## 2026-06-03 诊断报告适配器需求巡检

诊断报告现在不只检查 n2n、端口代理、广播桥本身，还会检查 adapter 声明的需求是否被当前能力满足。

新增逻辑：

- `requires_virtual_lan=true`：检查 n2n 是否 ACK/PONG。
- `requires_tcp_port_proxy=true`：检查 TCP 代理自测是否通过。
- `requires_udp_broadcast_bridge=true`：检查 UDP 广播桥自测是否通过。
- `requires_dedicated_server=true`：检查是否观察到服务端会话 running/ready。
- `network_type=unknown_need_review` 或缺少 `connection_plan`：生成未知游戏待认定问题。

诊断报告新增 `adapter_requirement_alignment` 总检查，并把细分检查加入 `release_checks`。如果不满足，会生成结构化问题：

- `adapter_virtual_lan_not_ready`
- `adapter_tcp_proxy_not_ready`
- `adapter_udp_broadcast_bridge_not_ready`
- `adapter_dedicated_server_not_observed`
- `adapter_unknown_need_review`

这让“游戏类型识别与方案沉淀”和“发布级失败分类”真正合在一起：用户不只知道底层能力是否可用，也知道当前适配器库里哪些游戏方案还缺什么能力。

## 2026-06-03 未知游戏认定入口

游戏扫描页已经可以把未知游戏直接转成本地 custom adapter 草稿。

产品流程：

```text
扫描到未知游戏
→ 点击“创建适配器草稿”
→ 写入本地 custom adapter
→ 仍标记 unknown_need_review
→ 进入适配器管理页认定游戏网络类型
→ 补齐 connection_plan
→ 后续用户复用
```

这个入口不会把未知游戏伪装成已支持。新草稿默认只说明“需要管理员认定”，并保留扫描路径作为 notes 证据。管理员后续必须选择真实网络类型并补齐房主/加入者步骤、默认端口和是否需要 TCP/UDP/广播桥能力。

## 2026-06-03 适配器管理页网络类型模板联动

适配器管理页现在支持按“游戏网络类型”自动应用推荐模板。

管理员认定游戏类型后，页面会自动同步：

- capabilities；
- multiplayer_conversion；
- methods；
- connection_plan；
- 是否需要虚拟局域网；
- 是否需要 TCP 端口代理；
- 是否需要 UDP 广播桥；
- 是否需要专用服务端。

覆盖的类型包括：

- LAN/IP 直连；
- 专用服务端；
- 需要 TCP 端口代理；
- 需要 UDP 广播桥；
- Steam Lobby 可直连；
- Steam Relay 插件；
- 需要 Mod；
- 仅官方联机；
- 暂不支持；
- 未知待判断。

这样“扫描未知游戏 → 创建草稿 → 管理员选择网络类型 → 自动生成方案骨架 → 保存 adapter”的闭环已经形成。模板只生成骨架，不替代人工验证端口和实际游戏流程。

## 2026-06-03 适配器共享库提交说明

适配器管理页导出 adapter 时，现在会同时生成共享库提交说明：

- 推荐保存路径：`adapter-registry/games/<game_id>.json`；
- 当前 adapter JSON 的 SHA256；
- `adapter-registry/index.json` 的 entry 片段；
- 默认共享库 URL；
- 审核注意事项。

这让“本地认定 → 导出 JSON → 放入共享 registry → 其他用户同步复用”的流程更清晰。

注意：共享适配器仍然只能是数据，不允许携带任意脚本或自动下载未知可执行文件；不能绕过正版验证、反作弊或官方账号服务。

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

## 2026-06-03 Stitch 高级前端与接口对接记忆

用户希望重新用 Stitch 生成一套真正高级、清爽、类似 iOS / macOS 的前端，而不是在当前界面上简单换颜色。新设计必须一次性覆盖所有核心页面、按钮、状态和交互，并为未来功能预留入口。

已新增：

- `docs/STITCH_PREMIUM_FRONTEND_PROMPT.md`：给 Stitch 的完整提示词；
- `docs/FRONTEND_BACKEND_API_MAP.md`：新前端对接现有 Tauri 后端 API 的页面级清单。

后续任何重构前端时必须遵守：

- 所有 UI 文案默认简体中文；
- 不允许中文显示问号或乱码；
- 不允许点击按钮后直接显示假成功；
- 通用组网、Terraria 向导、诊断报告等页面应缓存上次状态，主动刷新才重跑耗时检测；
- 共享方案库/adapter 要面向用户称为“共享游戏方案/方案库”；
- Terraria 向导只作为深度适配示例，不代表每个游戏都要专属向导。

## 2026-06-03 下载前端 App Shell 视觉迁移记录

已按用户要求先迁移下载前端中的外壳视觉，不替换后端逻辑：

- `Layout` 已改为浅色 macOS 风侧栏 + 顶部指挥栏；
- 增加页面切换 Toast；
- 全局样式增加浅色玻璃卡片、按钮、输入框、状态卡覆盖；
- 顶部状态明确写为“待真实检测”，避免假成功状态；
- 当前业务页面和 `src/api/tauri.ts` 调用保持不变。

后续原则：只有在用户确认视觉方向后，才逐页迁移下载前端页面结构；迁移时必须移除假数据和模拟成功状态，改接真实 Tauri 后端接口。

## 2026-06-03 内容区样式继续迁移记忆

用户已确认浅色外壳颜色满意，但需要继续替换页面内部内容样式。本次已迁移首页相关浅色兼容覆盖，并重点推进方案库、游戏扫描两个页面的内容 Hero、状态数据、面板、表格和筛选区域样式。

必须继续保持：

- 页面视觉可以迁移；
- 后端逻辑不能用下载前端的假数据替换；
- 所有“成功/运行/可联机”状态仍必须来自真实 Tauri API；
- 每次给用户查看 exe 前要重新 `npm run tauri:build`，否则用户可能看到旧安装包或旧 release exe。

## 2026-06-03 新前端参考源

新的前端参考源已切换为：

```text
C:\Users\ty\Downloads\联机助手 (1)
```

旧参考目录不再作为主要依据。新参考补充了之前要求的多个板块：适配器编辑、游戏详情/分析、好友 IP 分配、TCP/UDP/广播桥完整配置、Terraria help/save/exit、诊断证据与行动路径。

注意：新参考仍是静态原型，不能直接覆盖当前 Tauri 项目；必须逐页迁移视觉结构，并保留真实后端接口。

## 2026-06-03 推荐方案与通用组网中心内容迁移记忆

已参考 `C:\Users\ty\Downloads\联机助手 (1)` 继续迁移推荐方案和通用组网中心内容样式。此次只改视觉结构和 class，不替换真实后端调用。

后续继续保持：

- 参考前端只作为视觉和信息架构来源；
- 不引入 setTimeout 假成功、写死 IP、写死延迟；
- n2n、代理、广播桥、邀请包、诊断状态仍必须来自当前项目真实 Tauri API。

## 2026-06-03 Terraria 向导与诊断报告迁移记忆

已完成 Terraria 向导和诊断报告的内容视觉迁移。关键原则：

- Terraria 向导可以有专属深度流程，但它只是“深度适配示例”，不是每个游戏都必须做一个专属向导；
- `help`、`save`、`exit` 按钮现在通过 `sendServerCommand` 接真实后端服务端进程，不允许前端伪造命令结果；
- 诊断报告继续保留上次诊断界面内容，重新诊断必须由用户主动点击；
- 诊断页所有通过/失败/最可能原因/下一步建议都必须来自 `generateDiagnosticReport` 或 `generateDiagnosticReportForGame`；
- 前端参考目录仍只作为视觉来源，不可引入其静态假数据。

下一步应进入全页面真实状态审查，重点查：假绿、按钮无反馈、加载状态、缓存状态、Tauri invoke 环境提示、中文乱码。

## 2026-06-03 真实状态审查记忆

已开始做发布级“前端与后端连接真实性”审查。首轮发现并修复：

- 游戏扫描失败不能再静默显示为空列表，必须展示真实错误和重新扫描入口；
- 普通浏览器缺少 Tauri invoke 时必须给中文环境提示，不能显示 JS 原始错误；
- 首页不能显示写死的准备度百分比，避免被理解成真实检测；
- 项目记忆文件中历史问号乱码需要修复，关键记录必须可读。

后续审查原则：任何“成功、运行、可联机、可发布、已就绪、准备度”都必须来自真实后端或明确标为推荐路径/待检测，不允许假绿。

## 2026-06-03 第二轮真实状态审查记忆

已修复详情页和推荐页的状态真实性问题：

- GameDetail 必须显示真实加载和失败，不允许 `analyzeGame` 失败后静默空白；
- 推荐页不能把服务端进程 `running` 直接当成端口可用，只有 `ready` 或本机端口真实可达才算绿色；
- 顶部导航按钮只负责打开页面，文案不能暗示已启动后端服务。

后续仍要继续审查通用组网、代理、广播桥、Layout 顶部状态和诊断缓存联动。

## 2026-06-03 通用组网页真实状态审查记忆

第三轮审查已修复 NetworkSetup：

- 停止类按钮必须基于真实 running 状态启用，未运行时不能让用户点击停止；
- 刷新类按钮必须有加载/成功/失败反馈，不能悄悄刷新；
- 操作成功后应显示真实后端返回消息，失败进入错误提示，不允许假成功。

后续继续审查方案库和诊断页，重点是同步失败、复制失败、诊断缓存清空后的 UI 状态。

## 2026-06-03 方案库与诊断页真实反馈记忆

第四轮审查已修复：

- 方案库复制导出 JSON / 共享库提交说明必须有成功或失败反馈；
- 诊断页缓存必须按游戏上下文匹配，切换游戏后不能继续显示旧游戏报告；
- 诊断页复制、清空、生成报告都必须有明确反馈；
- 修改中文时必须检查“连续问号”，避免再次出现源码层问号乱码。

后续进入总体验收审查，重点查全项目无反馈复制、假状态和按钮可用性。

## 2026-06-03 总体验收第五轮记忆

第五轮全项目验收已修复：

- 剪贴板调用必须显式检查可用性，不能因为 `navigator.clipboard?.writeText` 静默跳过而误报已复制；
- 服务端 `running` 不能等同于 `ready`，只有端口/ready 证据才可显示绿色；
- 诊断报告“核心检查通过”不能写成“可发布”，避免用户误解；
- 文档中不要保留连续问号字面量，避免乱码搜索误报。

后续应进入 release exe 人工回放验收，逐页点击主流程按钮，确认真实 Tauri 后端行为、加载遮罩、错误提示和缓存状态。

## 2026-06-03 发布预检入口记忆

已新增发布预检入口：

```powershell
npm run release:preflight
npm run release:preflight:full
```

预检用于发布前自动确认：关键文档、release exe、adapter registry、连续问号乱码、静默剪贴板调用、强承诺文案。它不替代人工验收，只是保证进入人工回放前没有明显项目级风险。

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

关键记忆：

- 用户明确要求“不要只换颜色”，本轮按参考图做结构级迁移。
- 目标视觉：浅色固定 Sidebar、顶部 Topbar、白色卡片 Dashboard、橙色强调、右下角深色 Toast。
- 必须继续遵守产品原则：所有“已连接、延迟、就绪、可联机”等状态必须来自真实后端；参考图中的假数据不能照抄。
- 已迁移页面：
  - 首页：桌面大厅、角色切换、网络拓扑状态、主面板检查单；
  - 游戏扫描：标题区、搜索/筛选条、工具栏、卡片画廊；
  - 通用组网中心：左侧真实状态轨道、右侧 n2n 参数配置、下方高级辅助能力；
  - 诊断报告：左侧检测明细、右侧深色 N2N 监测卡。
- 已验证命令：
  - `npm run build`
  - `cargo check --manifest-path src-tauri\Cargo.toml`
  - `npm run tauri:build`
  - `npm run release:preflight`
  - `git diff --check`

下一步推荐：继续统一“推荐方案 / 适配器管理 / Terraria 向导”的内层卡片布局和按钮层级，避免这些页面与新 App Shell 出现视觉断层。

## 2026-06-04 参考前端一比一复原原则

用户已明确要求：界面必须完全按照 `C:\Users\ty\Downloads\联机助手 (1)` 做一比一复原，不能继续只做“接近风格”的 CSS 覆盖。

关键记忆：

- 视觉权威是 `C:\Users\ty\Downloads\联机助手 (1)\src`；
- 当前项目已新增 `src/reference-ui/`，直接复制参考项目源码；
- 当前入口 `src/main.tsx` 已切换到 `src/reference-ui/App`；
- 为了构建兼容，只把参考 `main.tsx` 的 `./App.tsx` 导入改成 `./App`，不影响视觉；
- 已加入参考 UI 依赖：`lucide-react`、`motion`、`@tailwindcss/vite`；
- 旧的真实后端页面暂时保留，后续要把后端能力接到参考 UI 上。

边界：

- 当前阶段实现的是“参考前端一比一显示”；
- 参考 UI 里仍有模拟状态和假数据，例如 `24ms`、`75%`、`netStatus: online`；
- 发布前必须把这些模拟状态接成真实 Tauri 后端状态或降级为“待诊断”，不能保留伪造在线结果。

下一步推荐：在 `src/reference-ui/App.tsx` 建立真实后端状态适配层，优先替换网络状态、游戏扫描、方案库同步、Terraria 服务端和诊断报告。
