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

## 2026-06-02 适配器来源标识

适配器管理和推荐页新增来源标识，用于验证当前生效适配器来自哪里：

- `builtin`：安装包/项目内置适配器。
- `registry`：远程共享库或本地示例库同步生成的 `registry_<game_id>.json`。
- `custom`：本地管理员/高级用户保存的 `custom_<game_id>.json`。
- `steam_scan`：Steam 自动扫描但尚未适配。

加载优先级仍然是：`custom > registry > builtin`。保存适配器时返回来源 `custom`，写入磁盘时不会把 `adapter_source` 固化到 JSON，来源由文件名前缀推断。

适配器管理页表格新增“来源”列；推荐页的“联机能力转换判断”里也会显示适配器来源。


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
