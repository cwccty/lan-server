# 最终参考前端 `(3)` 复刻与前后端完全对接完成度审计

审计时间：2026-06-04

目标原文：

> `C:\Users\ty\Downloads\联机助手 (3)` 是最终的前端设计，要求一比一复刻，在完成复刻后开始进行前后端对接，并完全完成，其中如果存在前端功能缺失记录下来。

## 结论

当前状态：**未达到“完全完成”**，但已经完成大部分关键对接。

不能标记总目标完成的原因：

1. 参考 UI 一比一复刻已有强证据通过。
2. 真实后端 API 已覆盖主要能力，并且 Product Mode 已把大量按钮接到真实后端。
3. 但部分页面仍依赖 **Product Mode DOM patcher / 真实面板补偿**，参考前端本体仍保留演示 state 和演示卡片。
4. 仍有少量正式前端缺口需要保留记录，例如部分页面真实列表正式受控化、房间/好友席位后端化、edge 自动下载等。

因此当前应继续推进，而不是调用目标完成。

## 审计证据

### 1. 最终参考前端一比一复刻

证据：

```powershell
powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1
```

结果：

```text
Reference UI fidelity check: PASS
visual_diff_count=0
```

判断：**已完成**。

说明：

- `tools/check_reference_ui_fidelity.ps1` 已以 `C:\Users\ty\Downloads\联机助手 (3)\src` 为参考源。
- 该检查确认 `src/reference-ui` 与最终参考前端核心源码保持一致。
- Product Mode 对接通过 `src/reference-adapter` 进行，不直接破坏 `src/reference-ui`。

### 2. 真实后端 API 覆盖

已存在并接入的主要 API：

| 能力 | API / Command | 当前状态 |
|---|---|---|
| 游戏扫描 | `scanGames()` / `scan_games` | 已接入 |
| 游戏分析 | `analyzeGame(gameId)` / `analyze_game` | 已接入 |
| 推荐方案 | `recommendPlans(gameId)` / `recommend_plans` | 已接入 |
| 启动项 | `launchProfile()` / `launch_profile` | 已接入，profile 优先来自真实推荐 |
| 方案库列表 | `listGameAdapters()` / `list_game_adapters` | 已接入 |
| 保存方案 | `saveGameAdapter()` / `save_game_adapter` | 已接入 |
| 导入导出方案 | `importGameAdapterJson()` / `exportGameAdapterJson()` | 已接入 |
| 同步方案库 | `syncAdapterRegistry()` / `sync_adapter_registry` | 已接入 |
| n2n 配置/启动/停止 | `setupNetwork()` / `startNetwork()` / `stopNetwork()` | 已接入 |
| n2n 诊断 | `getN2nDiagnostics()` | 已接入 |
| 连通性测试 | `testConnectivity()` | 已接入 |
| Terraria/游戏服务端 | `startGameServerSession()` / `startGenericServerSession()` | 已接入 |
| 控制台命令 | `sendServerCommand()` | 已接入 |
| TCP 代理 | `startPortProxy()` / `selfTestPortProxy()` 等 | 已接入 |
| UDP 代理 | `startUdpProxy()` / `selfTestUdpProxy()` 等 | 已接入 |
| UDP 广播桥 | `startUdpBroadcastBridge()` / `selfTestUdpBroadcastBridge()` 等 | 已接入 |
| 诊断报告 | `generateDiagnosticReport()` / `generateDiagnosticReportForGame()` | 已接入 |
| App Settings | `getAppSettings()` / `saveAppSettings()` / `resetAppSettings()` / `openPath()` | 已接入 |
| edge 路径检测 | `testEdgePath()` | 已接入 |

判断：**后端能力大体已覆盖当前参考前端需要的主流程**。

### 3. Product Mode 对接状态

Product Mode 通过以下文件把参考 UI 按钮和真实后端连接：

```text
src/reference-adapter/ProductActionPatcher.tsx
src/reference-adapter/ProductActionResultPatcher.tsx
src/reference-adapter/ProductInventoryPatcher.tsx
src/reference-adapter/ProductAdvancedToolsPatcher.tsx
src/reference-adapter/ProductDiagnosticsPatcher.tsx
src/reference-adapter/ProductSettingsPatcher.tsx
src/reference-adapter/ProductHomePatcher.tsx
src/reference-adapter/ProductHeaderPatcher.tsx
```

判断：**已形成可运行的真实接入层**。

注意：

- 这是在不改 `src/reference-ui` 的前提下完成真实对接。
- 该策略符合“一比一复刻参考前端”的要求。
- 但它不是最终理想的受控 React 数据流；正式产品后续仍应逐步减少 DOM patcher。

### 4. Adapter registry 覆盖

当前本地 registry：

```text
adapter-registry/index.json
```

发布预检显示：

```text
adapter registry count PASS games=4
```

当前已覆盖：

```text
Minecraft Java
Palworld / 幻兽帕鲁
Stardew Valley
Terraria
```

判断：**最终参考前端出现的 Palworld 缺口已关闭**。

注意：

- Palworld adapter 覆盖的是专用服/IP 直连流程。
- 不承诺把官方服务器、Steam 好友大厅或平台匹配强转成本地 LAN。

## 仍未完成的硬缺口

### 缺口 1：部分真实列表仍主要靠 Product Mode 面板补偿

涉及页面：

- 游戏扫描
- 推荐方案
- 方案库
- 高级连接工具

现状：

- 真实数据通过 Product Mode 面板插入。
- 参考 UI 原卡片仍可能来自演示 state。

风险：

- 用户可能把部分页面的参考演示卡片误认为真实后端实例。高级连接工具已通过 Product Mode 真实清单和行级操作显著降低该风险。

下一步建议：

- 继续保持 `src/reference-ui` 一比一。
- 在 Product Mode 下进一步用真实数据覆盖更多列表，或准备正式受控 UI 重构方案。

### 已关闭：方案库同步详情真实展示

现状：

- `syncAdapterRegistry()` / `syncLocalAdapterRegistryExample()` 返回的 `AdapterRegistrySyncResult.items` 已在 Product Mode 中持久保存。
- 方案库真实面板会展示最近一次同步来源、时间、registry_url、created / updated / skipped / hash_failed / parse_failed / fetch_failed / validation_failed / write_failed。
- 每个 item 会展示 `game_id / display_name / status / reason / saved_path`，如 hash 不一致会展示 expected/actual 摘要。

仍需注意：

- 这是 Product Mode 面板级真实展示，不代表 `src/reference-ui` 原始演示卡片已被改成受控 React 数据流。
- “手动强制刷新”语义已整理：只刷新本地 adapter 列表，不进行远程同步。
### 已关闭：诊断目标选择器

现状：

- Product Mode 诊断页已新增真实诊断目标选择器。
- 支持“全局环境 / 当前选中游戏 / 指定游戏”。
- 全局诊断调用 `generateDiagnosticReport()`；游戏诊断调用 `generateDiagnosticReportForGame(gameId)`。
- 最近一次真实诊断报告会持久保存到 localStorage，并回填诊断页摘要、最可能原因、必需项通过数量和下一步动作。

仍需注意：

- 该能力仍位于 Product Mode patcher 层；正式产品如果完全重构前端，应将它迁移为受控 React 页面组件。
### 缺口 4：好友席位仍是本地持久化，不是后端房间

现状：

- Product Mode 使用 `localStorage: lan-helper.referenceFriendAllocations` 持久化好友席位。
- 邀请包已经基于真实 n2n 配置、真实选中游戏、好友席位和端口生成。

缺口：

- 如果未来要做多人房间、云同步、管理员共享配置，需要后端房间 API。

下一步建议：

- 当前本地产品可以接受 localStorage。
- 若要做多人协作，新增 room/friend allocation 后端模型。

### 缺口 5：edge 自动下载/修复仍是未来功能

现状：

- `testEdgePath()` 已能检测 edge 路径、可执行性和帮助/版本线索。

缺口：

- 未实现 edge.exe 自动下载。
- 未实现 TAP/Wintun 驱动自动安装或修复。

下一步建议：

- 保持为未来方向，除非用户明确要求自动下载/安装。

### 缺口 6：通用服务端仍是单会话模型

现状：

- `startGenericServerSession()` 已支持 `.exe/.bat/.cmd/.jar`。
- `readServerSession()` / `stopServerSession()` / `sendServerCommand()` 复用单一会话。

缺口：

- 不支持同时托管多个游戏服务端。

下一步建议：

- 当前 MVP 可以接受单会话。
- 若要支持多游戏同时开服，需要引入 session id。

## 已关闭的重要缺口摘要

| 缺口 | 关闭方式 |
|---|---|
| 最终参考前端 `(3)` 同步 | `src/reference-ui` + fidelity checker |
| 高级 TCP/UDP/广播桥 | 真实后端命令 + Product Mode 接入 |
| 通用 Jar/Exe 服务端 | `startGenericServerSession()` |
| 真实扫描/方案/推荐面板 | `ProductInventoryPatcher` |
| 推荐启动项错 profile | 启动前优先读取 `recommendPlans().launch_profile_id` |
| 指定游戏诊断 | 最近选中游戏 + `generateDiagnosticReportForGame()` |
| 好友邀请包演示值 | 本地持久好友席位 + 真实 n2n 配置 |
| 设置中心无后端 | App Settings 后端 |
| edge 路径假自测 | `testEdgePath()` |
| Palworld 缺 adapter | 新增 Palworld adapter |
| 方案库同步详情未展示 item | Product Mode 新增真实同步详情面板，展示计数、失败分类和每个 adapter item 明细 |
| 高级工具参考实例误导 | Product Mode 新增真实 TCP/UDP/广播桥/服务端清单，支持刷新、按实例停止和自测 |
| 诊断目标不明确 | Product Mode 新增真实诊断目标选择器，支持全局、当前游戏、指定游戏 |
| 方案库手动刷新语义重复 | 手动刷新改为只读取本地 adapter 列表；远程写入只由“一键更新共享方案/恢复默认”触发 |

## 下一步优先级

1. **游戏扫描/推荐页真实列表正式受控化**：进一步减少 Product Mode DOM patcher 对参考演示卡片的依赖。
2. **好友席位后端化评估**：当前 localStorage 能满足本地邀请包；如要多人房间/云同步，需要后端 room API。
3. **复制/导出诊断报告正式入口**：诊断报告已有真实数据，仍可补复制/导出文本按钮。
4. **多服务端 session / edge 自动下载**：保留为后续更大功能块。