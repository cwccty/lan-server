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
- `lan_discovery_broadcast`：依赖局域网广播发现，未来需要广播桥。
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
