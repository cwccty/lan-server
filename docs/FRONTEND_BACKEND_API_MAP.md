# 新前端后端接口对接清单

> 目的：重新构筑前端后，用本清单快速把 Stitch / 新 UI 对接到现有 Tauri 后端。本文只整理真实已存在的接口与页面映射，不允许用假状态替代真实检测。

## 1. 对接总原则

1. **状态必须真实**：绿色、可联机、已运行、端口可达、诊断通过等状态必须来自 Tauri API 返回值，不能只根据用户点击按钮就显示成功。
2. **所有长耗时动作必须有 loading**：扫描游戏、启动 n2n、保存 n2n 设置、启动 Terraria 服务端、生成诊断、同步方案库、端口/广播桥自测都要显示加载遮罩或局部 loading。
3. **页面可以缓存，但刷新必须真实**：例如通用组网中心、诊断报告、Terraria 向导再次进入时可先显示上次结果，但“刷新/重新检测”必须重新调用后端。
4. **错误要分类展示**：不要只显示“失败”。至少区分：组件缺失、supernode 不响应、认证/房间密码错误、IP/MAC 冲突、端口未监听、目标不可达、adapter 不存在、游戏服务端启动失败。
5. **高级能力渐进展示**：TCP 代理、UDP 代理、UDP 广播桥应放在“高级辅助能力”中，默认折叠；推荐页只在方案需要时主动提示。
6. **术语面向用户改写**：adapter 可显示为“共享游戏方案”；registry 可显示为“方案库地址”；edge/supernode 首次出现要配中文解释。
7. **邀请好友包必须基于真实配置**：包含 supernode、房间名、虚拟 IP 分配、游戏端口、推荐方案、诊断摘要；不能包含后端未确认的信息。
8. **不要重复启动后台进程**：启动按钮要根据 `running` / 端口 / session 状态防抖；重复点击应显示“已在运行”或“正在启动”。

## 2. 前端统一封装建议

建议在新前端先封装这些 hooks / services，再做页面：

```ts
useAsyncAction(actionName, fn)
useCachedResource(cacheKey, loader, options)
useToast()
useN2nStatus()
useServerSession()
useSelectedGame()
useAdapterRegistry()
useConnectivityTest()
```

统一状态结构建议：

```ts
type UiAsyncState<T> = {
  loading: boolean;
  data?: T;
  error?: string;
  lastUpdatedAt?: string;
};
```

所有按钮建议支持：

- `idle`：可点击；
- `loading`：禁用并显示“正在……”；
- `success`：短暂反馈；
- `failed`：显示错误 toast + 卡片内错误说明。

## 3. 页面到 API 映射

### 3.1 首页

首页是“任务控制台”，不应该做太多重操作。建议轻量读取状态并引导下一步。

可调用：

| UI 模块 | API | 用途 |
|---|---|---|
| 准备度/状态概览 | `listNetworkBackends()` | 判断 n2n / 手动局域网 / Radmin 是否可用 |
| n2n 摘要 | `getN2nDiagnostics()` | 显示是否运行、supernode、虚拟 IP、最近错误 |
| 服务端摘要 | `readServerSession()` | 显示游戏服务端是否还在运行 |
| 快速诊断入口 | `generateDiagnosticReport()` | 用户主动点击时生成诊断 |

主要按钮：

- “更新方案库” → 跳转方案库页；
- “扫描游戏” → 跳转游戏扫描页；
- “打开组网中心” → 跳转通用组网页；
- “查看推荐方案” → 跳转推荐方案页；
- “生成诊断报告” → 调用 `generateDiagnosticReport()` 或跳转诊断页。

### 3.2 方案库 / 适配器管理

| UI 模块 | API | 用途 |
|---|---|---|
| 本地方案列表 | `listGameAdapters()` | 显示已安装共享游戏方案 |
| 保存/编辑方案 | `saveGameAdapter(adapter)` | 管理员或高级用户保存方案 |
| 导入 JSON | `importGameAdapterJson(content)` | 导入单个方案文件 |
| 导出 JSON | `exportGameAdapterJson(gameId)` | 导出当前游戏方案 |
| 同步远程方案库 | `syncAdapterRegistry(registryUrl)` | 从 GitHub Pages/VPS 同步方案库 |
| 同步本地示例 | `syncLocalAdapterRegistryExample()` | 开发/测试本地方案库 |

必须设计的按钮：

- “同步共享方案库”；
- “恢复默认地址”；
- “导入方案 JSON”；
- “导出选中方案”；
- “新建/编辑方案”；
- “查看同步详情”；
- “复制错误信息”。

关键展示字段：

- `ok`、`total`、`created`、`updated`、`skipped`；
- `hash_failed`、`parse_failed`、`fetch_failed`、`validation_failed`、`write_failed`；
- 每个 item 的 `game_id`、`display_name`、`status`、`reason`。

### 3.3 游戏扫描

| UI 模块 | API | 用途 |
|---|---|---|
| 扫描本机游戏 | `scanGames()` | 查找本地游戏 |
| 分析选中游戏 | `analyzeGame(gameId)` | 识别联机能力、端口、候选方案 |
| 方案匹配 | `listGameAdapters()` | 显示是否已有共享方案 |
| 保存管理员认定 | `saveGameAdapter(adapter)` | 把游戏类型/转换方案沉淀为共享方案 |

必须设计的按钮：

- “开始扫描”；
- “重新扫描”；
- “分析这个游戏”；
- “查看推荐方案”；
- “创建共享方案”；
- “复制游戏识别信息”。

交互要求：

- 第一次点击扫描必须显示加载动画，不能卡住不动；
- 扫描结果为空时展示空状态和下一步；
- 点击游戏卡片后右侧/抽屉显示分析详情；
- 推荐方案不足时提示“可由管理员认定一次，之后其他用户复用”。

### 3.4 推荐方案

| UI 模块 | API | 用途 |
|---|---|---|
| 游戏分析 | `analyzeGame(gameId)` | 获取游戏能力和端口线索 |
| 推荐方案列表 | `recommendPlans(gameId)` | 生成 recommended / tryable / unsupported |
| n2n 状态 | `getN2nDiagnostics()` | 判断是否已组网 |
| 服务端状态 | `readServerSession()` | 判断游戏服务端是否运行 |
| 启动项 | `launchProfile(gameId, profileId, config)` | 执行推荐启动项 |
| 启动服务端 | `startGameServerSession(gameId, profileId, config)` | 启动 Terraria 等服务端 |
| 好友连接检测 | `testConnectivity(target)` | 检测好友虚拟 IP / 游戏端口 |

必须设计的按钮：

- “应用推荐方案”；
- “启动游戏/启动项”；
- “在程序内启动服务端”；
- “分配好友 IP”；
- “检测好友连接”；
- “复制邀请好友包”；
- “重新生成邀请包”；
- “进入诊断”。

邀请包字段建议：

- 房主虚拟 IP；
- 好友分配 IP；
- supernode；
- 房间名；
- 游戏端口；
- 推荐方案；
- 当前 n2n 摘要；
- 最近一次好友检测结果。

注意：`testConnectivity()` 对“好友 IP:端口”失败，不一定代表好友无法加入，可能只是好友不是服务端。UI 文案要写成“待确认/未检测到端口响应”，不要绝对判死。

### 3.5 通用组网中心

| UI 模块 | API | 用途 |
|---|---|---|
| 后端列表 | `listNetworkBackends()` | 显示 manual_lan / radmin / n2n 可用性 |
| 读取上次配置 | `getN2nLastConfig()` | 自动填入最近 supernode、房间名等 |
| 保存 n2n 设置 | `setupNetwork('n2n', config)` | 写入 n2n 配置 |
| 启动组网 | `startNetwork('n2n')` | 启动 edge |
| 停止组网 | `stopNetwork('n2n')` | 停止 edge |
| n2n 诊断 | `getN2nDiagnostics()` | 读取 ACK/PONG/虚拟 IP/最近日志 |
| 连通性测试 | `testConnectivity(target)` | 测试虚拟 IP 或游戏端口 |

必须设计的按钮：

- “保存设置”；
- “启动 n2n”；
- “停止 n2n”；
- “刷新状态”；
- “复制邀请参数”；
- “测试 supernode”；
- “测试虚拟 IP/端口”；
- “打开诊断报告”。

进入页面策略：

- 第一次进入：自动加载 `listNetworkBackends()`、`getN2nLastConfig()`、`getN2nDiagnostics()`；
- 后续进入：先显示缓存内容，不自动卡顿；
- 用户点击“刷新状态”才重新检测；
- 如果启动失败，要保留错误分类和最近日志。

### 3.6 通用组网中心：TCP 端口代理

| UI 模块 | API | 用途 |
|---|---|---|
| 启动 TCP 代理 | `startPortProxy(config)` | 本地监听并转发到目标 TCP |
| 停止 TCP 代理 | `stopPortProxy(id)` | 停止指定代理 |
| 列出代理 | `listPortProxies()` | 展示当前运行代理 |
| 查看状态 | `getPortProxyStatus(id)` | 查询指定代理 |
| 测试代理 | `testPortProxy(id)` | 检测代理是否可用 |
| 自测 | `selfTestPortProxy()` | 单机验证 TCP 代理功能 |

UI 要求：

- 默认折叠在“高级辅助能力”；
- 配置项包含：监听地址、监听端口、目标地址、目标端口；
- 显示运行 ID、监听地址、目标地址、最近错误；
- 提供“单机自测”按钮，方便只有一台电脑的用户验证。

### 3.7 通用组网中心：UDP 端口代理

| UI 模块 | API | 用途 |
|---|---|---|
| 启动 UDP 代理 | `startUdpProxy(config)` | 转发 UDP 单播流量 |
| 停止 UDP 代理 | `stopUdpProxy(id)` | 停止指定 UDP 代理 |
| 列出代理 | `listUdpProxies()` | 展示当前运行 UDP 代理 |
| 查看状态 | `getUdpProxyStatus(id)` | 查询指定 UDP 代理 |
| 自测 | `selfTestUdpProxy()` | 单机验证 UDP 代理 |

UI 要求：

- 明确说明适合“游戏使用固定 UDP 服务器端口”的场景；
- 不要承诺解决所有 UDP 广播发现；
- 提供单机自测入口。

### 3.8 通用组网中心：UDP 广播桥

| UI 模块 | API | 用途 |
|---|---|---|
| 启动广播桥 | `startUdpBroadcastBridge(config)` | 在本机端口和虚拟网段间转发 UDP 广播 |
| 停止广播桥 | `stopUdpBroadcastBridge(id)` | 停止指定广播桥 |
| 列出广播桥 | `listUdpBroadcastBridges()` | 展示当前桥 |
| 查看状态 | `getUdpBroadcastBridgeStatus(id)` | 查询桥状态 |
| 自测 | `selfTestUdpBroadcastBridge()` | 单机验证广播桥 |

UI 要求：

- 文案说明：用于“游戏局域网房间发现依赖 UDP 广播”的场景；
- 显示监听地址、广播地址、端口、收发计数、最近错误；
- 默认高级折叠，不干扰普通 n2n 主流程。

### 3.9 Terraria 向导

| UI 模块 | API | 用途 |
|---|---|---|
| 自动填入 n2n | `getN2nLastConfig()` | 读取最近 supernode/房间参数 |
| 保存/启动 n2n | `setupNetwork()` / `startNetwork()` | 必要时启动组网 |
| 服务端状态 | `readServerSession()` | 进入页面显示上次状态 |
| 启动服务端 | `startGameServerSession(gameId, profileId, config)` | 启动 Terraria server |
| 停止服务端 | `stopServerSession()` | 停止当前服务端 |
| 发送命令 | `sendServerCommand(command)` | help/save/exit 等控制台命令 |
| 检测端口 | `testConnectivity(target)` | 测试 127.0.0.1/虚拟 IP 的 7777 |

必须设计的按钮：

- “自动填入最近 n2n 设置”；
- “启动 n2n”；
- “在程序内启动服务端”；
- “检测本机端口”；
- “检测虚拟 IP 端口”；
- “发送 help”；
- “保存世界 save”；
- “退出服务端 exit”；
- “复制邀请好友内容”。

注意：Terraria 向导是示例/深度适配，不代表每个游戏都要做一个完整向导。新前端应把它标成“深度向导示例”，并把通用游戏放到“推荐方案 + 通用组网 + 高级代理/广播桥”。

### 3.10 诊断报告

| UI 模块 | API | 用途 |
|---|---|---|
| 全局诊断 | `generateDiagnosticReport()` | 生成完整诊断 |
| 指定游戏诊断 | `generateDiagnosticReportForGame(gameId)` | 针对某个游戏生成诊断 |

必须设计的按钮：

- “生成诊断报告”；
- “重新诊断”；
- “复制报告”；
- “导出文本”；
- “只看失败项”；
- “展开证据”；
- “按建议跳转”。

进入页面策略：

- 第一次没有报告时显示空状态；
- 生成后缓存上次报告；
- 下次进入先保留上次诊断结果；
- 点击“重新诊断”才重新调用后端；
- 失败项优先展示。

### 3.11 设置 / 帮助

当前后端没有完整设置读写 API。新前端可以先做配置入口和说明，但涉及真实保存时应复用现有功能页：

| UI 模块 | API | 用途 |
|---|---|---|
| 最近 n2n 配置 | `getN2nLastConfig()` | 展示最近 supernode/房间信息 |
| n2n 状态 | `getN2nDiagnostics()` | 展示组件/日志路径 |
| 方案库状态 | `listGameAdapters()` | 显示本地方案数量 |
| 同步方案库 | `syncAdapterRegistry(registryUrl)` | 设置页可提供快捷入口 |

未来可新增后端 API：

```ts
getAppSettings(): Promise<AppSettings>
saveAppSettings(settings: AppSettings): Promise<AppSettings>
resetAppSettings(): Promise<AppSettings>
openPath(path: string): Promise<void>
```

## 4. 已存在 API 总表

### 游戏 / 方案库

```ts
scanGames(): Promise<GameSummary[]>
analyzeGame(gameId: string): Promise<GameAnalysis>
listGameAdapters(): Promise<GameAdapter[]>
saveGameAdapter(adapter: GameAdapter): Promise<GameAdapter>
importGameAdapterJson(content: string): Promise<GameAdapter>
exportGameAdapterJson(gameId: string): Promise<string>
syncAdapterRegistry(registryUrl: string): Promise<AdapterRegistrySyncResult>
syncLocalAdapterRegistryExample(): Promise<AdapterRegistrySyncResult>
```

### n2n / 网络

```ts
listNetworkBackends(): Promise<BackendSummary[]>
setupNetwork(backendId: string, config: NetworkConfig): Promise<SetupResult>
startNetwork(backendId: string): Promise<BackendRuntimeStatus>
stopNetwork(backendId: string): Promise<BackendRuntimeStatus>
getN2nDiagnostics(): Promise<N2nDiagnostics>
getN2nLastConfig(): Promise<NetworkConfig>
testConnectivity(target: ConnectivityTarget): Promise<ConnectivityReport>
```

### 推荐方案 / 启动项

```ts
recommendPlans(gameId: string): Promise<Recommendation[]>
launchProfile(gameId: string, profileId: string, config?: LaunchConfig): Promise<LaunchResult>
```

### 诊断报告

```ts
generateDiagnosticReport(): Promise<DiagnosticReport>
generateDiagnosticReportForGame(gameId: string): Promise<DiagnosticReport>
```

### 游戏服务端 / Terraria 向导

```ts
startGameServerSession(gameId: string, profileId: string, config?: LaunchConfig): Promise<ServerSessionStatus>
readServerSession(): Promise<ServerSessionStatus>
stopServerSession(): Promise<ServerSessionStatus>
sendServerCommand(command: string): Promise<ServerSessionStatus>
```

### TCP 端口代理

```ts
startPortProxy(config: PortProxyConfig): Promise<PortProxyStatus>
stopPortProxy(id: string): Promise<PortProxyStatus>
listPortProxies(): Promise<PortProxyStatus[]>
getPortProxyStatus(id: string): Promise<PortProxyStatus>
testPortProxy(id: string): Promise<ConnectivityReport>
selfTestPortProxy(): Promise<PortProxySelfTestReport>
```

### UDP 端口代理

```ts
startUdpProxy(config: UdpProxyConfig): Promise<UdpProxyStatus>
stopUdpProxy(id: string): Promise<UdpProxyStatus>
listUdpProxies(): Promise<UdpProxyStatus[]>
getUdpProxyStatus(id: string): Promise<UdpProxyStatus>
selfTestUdpProxy(): Promise<UdpProxySelfTestReport>
```

### UDP 广播桥

```ts
startUdpBroadcastBridge(config: UdpBroadcastBridgeConfig): Promise<UdpBroadcastBridgeStatus>
stopUdpBroadcastBridge(id: string): Promise<UdpBroadcastBridgeStatus>
listUdpBroadcastBridges(): Promise<UdpBroadcastBridgeStatus[]>
getUdpBroadcastBridgeStatus(id: string): Promise<UdpBroadcastBridgeStatus>
selfTestUdpBroadcastBridge(): Promise<UdpBroadcastBridgeSelfTestReport>
```

## 5. 关键类型文件

新前端对接时优先引用这些类型，不要重新手写一套不兼容字段：

```text
src/types/game.ts
src/types/network.ts
src/types/recommendation.ts
src/types/diagnostics.ts
src/types/serverSession.ts
src/types/portProxy.ts
src/types/udpProxy.ts
src/types/udpBroadcastBridge.ts
src/api/tauri.ts
```

## 6. 需要避免的前端错误

- 点击“启动”后立刻显示成功，但后端实际未启动；
- 端口监听几秒后消失，UI 仍显示可联机；
- 每次进入页面都自动重跑重任务，造成卡顿；
- 诊断报告页面每次进入都清空上次结果；
- Terraria 向导把所有游戏都暗示为需要专属向导；
- 共享方案库同步失败只弹 toast，不展示失败 item；
- 中文乱码或问号；
- 把内部文档词如 MVP、adapter、registry 直接暴露给普通用户。

## 7. 建议的新前端落地顺序

1. 先实现 App Shell、导航、Toast、Loading Overlay、空状态、错误卡片；
2. 再封装 `src/api/tauri.ts` 的 hooks；
3. 先接首页、游戏扫描、通用组网中心、诊断报告四个高频页；
4. 再接推荐方案、Terraria 向导、方案库；
5. 最后接高级 TCP/UDP/广播桥折叠模块；
6. 每接一页都跑：`npm run build`，并人工确认无乱码、无假状态、无卡顿。
