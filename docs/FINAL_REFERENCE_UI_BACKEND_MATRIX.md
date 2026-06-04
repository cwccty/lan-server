# 最终参考前端 `(3)` 后端对接矩阵

> 目标：在保持 `src/reference-ui` 一比一复刻的前提下，记录最终参考前端每个核心页面与真实 Tauri 后端的对接状态。  
> Reference Mode 只负责视觉保真；Product Mode 负责真实后端接入、状态面板、按钮拦截和缺口提示。

## 状态说明

| 状态 | 含义 |
|---|---|
| 已真实接入 | 按钮或面板已调用 Tauri 后端 API，结果不伪造。 |
| Product Mode 面板补偿 | 参考 UI 仍显示演示状态，但 Product Mode 插入真实状态面板。 |
| 已记录缺口 | 前端或后端仍缺正式能力，已记录，不把假状态当成功。 |
| 待正式 UI | 后端已有能力，但最终参考前端缺少足够的表单/绑定字段；当前可通过 Product Mode 临时接入。 |

## 1. 首页

| 前端区域/按钮 | 对应真实 API | 当前状态 | 说明 |
|---|---|---|---|
| 总览状态卡 | `readReferenceRuntimeSnapshot()` 间接读取 n2n、服务端、代理、诊断 | Product Mode 面板补偿 | `ProductHomePatcher` 显示真实后端摘要。 |
| 跳转扫描/组网/推荐/诊断 | 前端导航 | 已真实接入 | 不涉及后端。 |
| 首页演示指标 | 无直接 API | Product Mode 面板补偿 | 参考 UI 原本的炫酷指标不能视作真实状态。 |

## 2. 通用组网中心

| 前端区域/按钮 | 对应真实 API | 当前状态 | 说明 |
|---|---|---|---|
| 保存基础参数 | `setupNetwork('n2n', config)` | 已真实接入 | 从参考表单读取 room/key/supernode/virtual IP。 |
| Start n2n Edge | `startNetwork('n2n')` | 已真实接入 | 状态必须以后端运行结果为准。 |
| Stop n2n Edge | `stopNetwork('n2n')` | 已真实接入 | 停止真实 edge。 |
| Refresh Node Status | 当前调用 `startNetwork('n2n')` | 已记录缺口 | 更合理应改成 `getN2nDiagnostics()` 或刷新 runtime snapshot，不应把刷新等同启动。 |
| 首次自动读取配置 | `getN2nLastConfig()` / `getN2nDiagnostics()` | Product Mode 面板补偿 | 真实读取在 runtime snapshot 内完成；参考表单自身仍不是受控真实表单。 |

## 3. Terraria 向导

| 前端区域/按钮 | 对应真实 API | 当前状态 | 说明 |
|---|---|---|---|
| 启动自建服务 | `startGameServerSession('terraria','server', config)` | 已真实接入 | 读取世界、端口、密码、人数等字段。 |
| 停止服务 | `stopServerSession()` | 已真实接入 | 停止当前服务端会话。 |
| 一键自检 | `readServerSession()` | 已真实接入 | 读取真实服务端状态。 |
| 控制台命令 | `sendServerCommand(command)` | 已真实接入 | 高级工具页也复用该能力。 |
| 页面内演示日志 | `readServerSession()` | Product Mode 面板补偿 | 参考 UI 原日志不一定是真实后端输出；以后应改为受控日志组件。 |

## 4. 游戏扫描

| 前端区域/按钮 | 对应真实 API | 当前状态 | 说明 |
|---|---|---|---|
| 手动重扫以刷新缓存 | `scanGames()` | 已真实接入 | Product Mode 会调用真实扫描。 |
| 强同步 Steam 自适应映射 | `scanGames()` | 已真实接入 | 当前先复用扫描；后续可单独拆 Steam cache API。 |
| 查看分析与推荐方案 | `scanGames()` + `analyzeGame(game_id)` | 已真实接入 | 会按卡片标题匹配真实游戏，并写入 `selectedGame`。 |
| 查看推荐配置方案 | `scanGames()` + `analyzeGame(game_id)` | 已真实接入 | 同上。 |
| 创建局域网组网草稿 | `scanGames()` + `analyzeGame(game_id)` | 已真实接入 | 当前是分析入口，后续正式 UI 应进入方案编辑器并预填。 |
| 创建网络方案 | `scanGames()` + `analyzeGame(game_id)` | 已真实接入 | 当前是分析入口，后续正式 UI 应生成可保存 adapter 草稿。 |
| 真实扫描结果列表 | `scanGames()` + `listGameAdapters()` + `analyzeGame(gameId)` | 已真实接入 | Product Mode 面板展示真实扫描游戏，并提供“设为推荐目标/真实分析”行级操作；参考卡片仍保留视觉演示但不作为真实依据。 |

## 5. 推荐方案

| 前端区域/按钮 | 对应真实 API | 当前状态 | 说明 |
|---|---|---|---|
| 推荐列表 | `recommendPlans(game_id)` | 已真实接入 | Product Mode 真实面板按当前真实推荐目标读取推荐，并可直接切换目标。 |
| n2n 摘要 | `getN2nLastConfig()` | 已真实接入 | Product Mode 真实邀请摘要读取最近 n2n 配置。 |
| 服务端状态 | `readServerSession()` | 已真实接入 | Product Mode 真实邀请摘要读取当前服务端单会话状态。 |
| 重新测试 | `testConnectivity(target)` | 已真实接入 | 当前读取页面 host/port，失败不应判定为绝对不能联机。 |
| 复制主 IP | `getN2nLastConfig()` | 已真实接入 | 当前动作读取真实配置并 Toast。 |
| 一键拷制专属密信包 | `generateDiagnosticReportForGame(gameId)` / `generateDiagnosticReport()` | 已真实接入 | 有真实选中游戏时生成指定游戏诊断摘要。 |
| 立即启动本地游戏实体 | `recommendPlans(game_id)` + `launchProfile(game_id, profile_id, config)` | 已真实接入 | 优先使用真实选中游戏，并优先采用真实推荐结果里的 `launch_profile_id`；没有推荐启动项时才回退到默认 profile。 |
| 分配好友 IP / 选择邀请包 / 回收席位 | `listFriendAllocations()` / `upsertFriendAllocation()` / `selectFriendAllocation()` / `removeFriendAllocation()` | 已真实接入 | Tauri 后端写入 `.lan-helper/friend_allocations.json`；前端保留 localStorage 作为浏览器预览兜底。云房间/多人同步仍是未来 API。 |
| 检测好友连接 | `testConnectivity(target)` + `updateFriendCheck()` | 已真实接入 | “探测”会检测当前选中好友虚拟 IP 的游戏端口，并把最近检测摘要写入后端好友席位。 |
| 复制完整邀请凭证包 | `getN2nLastConfig()` + 好友席位 + 选中游戏 | 已真实接入 | Product Mode 会复制真实邀请包，不再只复制参考 UI 演示文本。 |

## 6. 方案库

| 前端区域/按钮 | 对应真实 API | 当前状态 | 说明 |
|---|---|---|---|
| 一键更新共享方案 | `syncAdapterRegistry(registryUrl)` | 已真实接入 | 使用输入框里的 registry URL。 |
| 恢复默认 | `syncLocalAdapterRegistryExample()` | 已真实接入 | 当前 Product Mode 下读取/同步本地示例；参考 UI 自身仍会更新 URL 文本。 |
| 手动强制刷新 / 手动刷新此缓存 | `listGameAdapters()` | 已真实接入 | Product Mode 下仅重新读取本地真实 adapter 列表和最近同步详情，不访问远程 registry、不写入或覆盖方案；已和“一键更新共享方案”区分。 |
| 导入方案 | `importGameAdapterJson(content)` | 已真实接入 | Product Mode 打开文件选择，读取 JSON 后导入真实 adapter。 |
| 导出备份 | `exportGameAdapterJson(gameId)` | 已真实接入 | 优先导出最近选中游戏，否则导出本地方案列表第一项，并下载 JSON 文件。 |
| 一键发布登记至共享适配器库 | `saveGameAdapter(adapter)` | 已真实接入 | 根据编辑器字段生成基础 custom adapter。 |
| 同步详情面板 | `AdapterRegistrySyncResult` | 已真实接入 | Product Mode 会持久保存最近一次同步结果，并展示 `created/updated/skipped/hash_failed/parse_failed/fetch_failed/validation_failed/write_failed` 与每个 item 的 `game_id/status/reason/saved_path/hash`。 |

## 7. 高级连接工具

| 前端区域/按钮 | 对应真实 API | 当前状态 | 说明 |
|---|---|---|---|
| 挂载并上线该高速链路 | `startPortProxy()` / `startUdpProxy()` / `startUdpBroadcastBridge()` | 已真实接入 | 按当前类型选择 TCP/UDP/广播桥。 |
| 一键连通自测 | `selfTestPortProxy()` / `selfTestUdpProxy()` / `selfTestUdpBroadcastBridge()` | 已真实接入 | 单机自测入口可用。 |
| 暂停代理 | `stopPortProxy(id)` / `stopUdpProxy(id)` / `stopUdpBroadcastBridge(id)` | 已真实接入 | 当前按类型停止一个运行实例。 |
| 完全卸载链路 | 同停止接口 | 已真实接入 | 当前等价停止，后续如有持久规则再做删除。 |
| 通用游戏服务端启动 | `startGenericServerSession(config)` | 已真实接入 | 支持 `.exe/.bat/.cmd/.jar`。 |
| 通用服务端停止 | `stopServerSession()` | 已真实接入 | 单会话服务端模型。 |
| 通用服务端发送指令 | `sendServerCommand(command)` | 已真实接入 | 从参考输入框读取命令。 |
| 真实实例列表 | `listPortProxies()` / `listUdpProxies()` / `listUdpBroadcastBridges()` / `readServerSession()` | 已真实接入 | Product Mode 面板集中展示 TCP、UDP、广播桥和通用服务端单会话；支持刷新、按实例停止、按类型自测。参考卡片仍保留视觉演示，但不作为真实依据。 |

## 8. 诊断报告

| 前端区域/按钮 | 对应真实 API | 当前状态 | 说明 |
|---|---|---|---|
| 手动强制重扫 | `generateDiagnosticReportForGame(gameId)` / `generateDiagnosticReport()` | 已真实接入 | Product Mode 有最近选中游戏时优先生成指定游戏诊断；没有选中游戏时回退全局诊断。 |
| 诊断页真实面板 | `generateDiagnosticReport()` / `generateDiagnosticReportForGame(gameId)` / runtime snapshot / selected game | 已真实接入 | Product Mode 新增真实诊断目标选择器，支持全局环境、当前选中游戏、指定游戏，并持久保存最近一次真实报告。 |
| 指定游戏诊断 | `generateDiagnosticReportForGame(gameId)` | 已真实接入 | 诊断页 Product Mode 已提供“当前选中游戏 / 指定游戏”选择器。 |
| 导出文本 / 复制报告 | `localStorage: lan-helper.referenceDiagnosticRecord` + 前端 Blob/Clipboard | 已真实接入 | Product Mode 诊断页基于最近一次真实 `DiagnosticReport` 生成统一纯文本，支持复制到剪贴板和导出 `.txt`。 |

## 9. 设置 / 帮助

| 前端区域/按钮 | 对应真实 API | 当前状态 | 说明 |
|---|---|---|---|
| Product Mode 开关 | `localStorage: lan-helper.referenceProductMode` | 已真实接入 | 用于在一比一参考模式和真实接入模式之间切换。 |
| 方案库默认地址 | `getAppSettings()` / `saveAppSettings(settings)` | 已真实接入 | 作为 App Settings 的 `adapter_registry_url` 保存。 |
| 保存本地设置 | `saveAppSettings(settings)` | 已真实接入 | Product Mode 下保存 edge 路径、默认 supernode、方案库地址、Product Mode 状态等。 |
| 联机自测 | `testEdgePath(path)` | 已真实接入 | 检查 edge 路径是否存在、是否为文件、文件名是否像 edge/n2n，并尝试 `-h` 读取帮助/版本线索。 |
| App 级设置读写 | `getAppSettings()` / `saveAppSettings()` / `resetAppSettings()` / `openPath()` | 已真实接入 | 后端写入 `.lan-helper/settings.json`；设置页 Product Mode 面板显示真实配置。 |

## 当前最重要的剩余缺口

1. **真实实例列表替换**：高级工具、游戏扫描、方案库、推荐页均已有 Product Mode 真实面板和关键行级操作；正式产品若要完全摆脱 DOM patcher，仍应重构为受控 React 数据流。
2. **云房间/多人同步**：好友席位已本地后端化；如果未来要做多人房间、云同步、管理员统一分配 IP，仍需 room API。
3. **edge 自动下载**：edge 路径已能深度检测；自动下载/修复 edge.exe 仍属于未来功能。
4. **Palworld 专用服深度启动**：Palworld adapter 已提供专用服/IP 直连方案；后续仍可做 SteamCMD 安装、配置文件编辑和服务端日志解析。

