# 联机助手后续大方向路线图

更新时间：2026-06-05 09:49:30

这份文件用于保存“接下来到底做什么”的长期判断，避免项目在持续迭代中只补零散问题、忘记主线。

## 2026-06-05 精简后的下一阶段大方向

结合当前已经完成的邀请包加入闭环、房主开房闭环、房主失败诊断闭环、适配器共享库审计，后续主线应收敛为下面几个大方向：

1. **多联机方式支持最终审计**
   - 把 n2n、TCP/UDP 端口代理、UDP 广播桥、Steam Remote Play、Sunshine + Moonlight、Steam Relay / Steam P2P 插件入口、WireGuard / ZeroTier / Tailscale 引导统一成“方式矩阵”。
   - 重点不是所有方式都深度自研，而是让用户知道当前游戏该选哪一种、为什么、点哪里、失败后怎么诊断。

2. **非局域网游戏转换方案引擎最终审计**
   - 继续强化“不是所有游戏都能变成 LAN”的判断能力。
   - 对原生 LAN、广播发现、本地同屏、Steam P2P、官方服务器限定、未知待复核分别给出不同路线。
   - 例如《茶杯头》这类本地同屏游戏，应走远程同屏/串流路线，而不是假装 n2n 可以把它改造成真正 LAN 游戏。

3. **诊断页升级为问题修复中心**
   - 诊断页要从“看报告”变成“发现问题 → 一键修复 → 自动复测 → 复制复盘”的主入口。
   - 要能承接邀请加入、房主开房、高级工具、适配器推荐、转换路线选错等失败上下文。

4. **发布级体验和性能打磨**
   - 解决按钮多次点击卡顿、页面进入自动加载卡顿、状态互相打架、长文本出框、中文乱码、加载态不明显等问题。
   - 原则是内部状态也要正确，不能只改显示。

5. **前端产品化与用户说明收敛**
   - 保留当前已完成的真实后端能力，不为了视觉重构丢接口。
   - 首页、组网中心、推荐方案、高级工具、诊断报告、适配器管理要统一成更清爽的用户路径。
   - 删除过多给开发者看的解释，换成普通玩家能理解的“我该点什么、失败怎么办、好友怎么做”。

6. **发布准备与真实用户测试**
   - 补齐发布前人工验证流程、单机测试流程、双人测试流程、VPS supernode 流程、失败场景复测。
   - 打包后用真实 exe 验证，而不是只看开发环境。

当前建议顺序：

```text
多联机方式最终审计
→ 非局域网游戏转换方案引擎最终审计
→ 诊断页问题修复中心最终审计
→ 发布级性能 / 状态 / 文案 / 前端体验打磨
→ 打包发布与真实用户测试
```

## 2026-06-05 09:15 多联机方式支持最终审计进展

已完成：

- 新增并接入 `src/product-ui/connectionMethodClosureAudit.ts`。
- 高级工具页新增 `data-connection-method-closure-audit="checklist"` 自检卡。
- 自检覆盖 n2n、WireGuard、ZeroTier、Tailscale、TCP/UDP 代理、UDP 广播桥、Steam Remote Play、Sunshine + Moonlight、Steam Relay / Steam P2P 插件入口。
- 自检同时覆盖游戏类型决策矩阵、推荐页交接、高级工具真实后端、风险检查、自测、诊断预填、本地同屏远程方案、Steam P2P 预留、外部组网引导、按路线降权诊断、可复制方式说明。
- 高级工具页新增“复制联机方式自检”，可输出当前方式目录、缺失项、当前工具、运行实例、阻断风险、诊断预填和逐项人工验证说明。
- `tools/release_preflight.ps1` 新增 `connection method closure audit is wired` 守卫，避免后续前端重构丢掉多联机方式闭环。

验证：

- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`connection method closure audit is wired` 为 PASS。

下一步顺序更新为：

```text
非局域网游戏转换方案引擎最终审计
→ 诊断页问题修复中心最终审计
→ 发布级性能 / 状态 / 文案 / 前端体验打磨
→ 打包发布与真实用户测试
```

## 2026-06-05 09:26 非局域网游戏转换方案引擎最终审计进展

已完成：

- 新增 `src/product-ui/conversionEngineClosureAudit.ts`。
- 方案库页新增 `data-conversion-engine-closure-audit="checklist"` 自检卡。
- 转换评估小样本从 5 类扩展到 8 类：
  - 原生 LAN / IP 直连
  - 专用服务端 / 内置开服
  - UDP 广播大厅发现
  - TCP/UDP 端口代理
  - Cuphead / 只能本地同屏
  - Steam 大厅 / Steam P2P
  - 官方服务器限定
  - 未知 / 待人工确认
- 自检明确区分：
  - 可生成 LAN 邀请的路线：LAN/IP、专用服务端、UDP 广播、端口代理。
  - 不生成 LAN 邀请的路线：本地同屏、Steam P2P、官方服限定、未知待复核。
- 方案库新增“复制转换引擎自检”，可输出样本结果、缺失样本、当前编辑器类型、当前决策、共享库地址、下一风险和逐项人工验证说明。
- `tools/release_preflight.ps1` 新增 `conversion engine closure audit is wired` 守卫，避免后续把本地同屏、Steam P2P、官方服或未知游戏误导成 n2n 虚拟 IP 邀请。

验证：

- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`conversion engine closure audit is wired` 为 PASS。

下一步顺序更新为：

```text
诊断页问题修复中心最终审计
→ 发布级性能 / 状态 / 文案 / 前端体验打磨
→ 打包发布与真实用户测试
```

## 2026-06-05 09:38 诊断页问题修复中心最终审计进展

已完成：

- 新增 `src/product-ui/diagnosticRepairCenterClosureAudit.ts`。
- 诊断页新增 `data-diagnostic-repair-center-closure-audit="checklist"` 自检卡。
- `errorActions.ts` 新增 `version_mismatch` 问题分类，覆盖游戏版本、服务端版本、n2n 组件版本、adapter 测试版本不一致的风险。
- 诊断修复中心最终审计覆盖：
  - edge.exe 缺失
  - n2n 未启动
  - Supernode 无响应
  - 房间凭证 / 虚拟 IP / MAC 冲突
  - 虚拟 IP 未生效
  - 游戏端口 / TCP/UDP 代理 / UDP 广播桥异常
  - 服务端不稳定
  - 防火墙 / 权限风险
  - 版本不匹配
  - adapter 缺失
  - 邀请失败上下文
  - 房主失败上下文
  - 转换路线纠错
  - 高级工具自测复盘
  - 自动下一步决策
  - 诊断报告复制/导出
- 诊断页新增“复制诊断修复自检”，可输出当前报告、问题组、一键后端动作、复制命令、自动复测、复盘历史和逐项人工验证说明。
- `tools/release_preflight.ps1` 新增 `diagnostic repair center closure audit is wired` 守卫，避免后续重构丢掉真实修复闭环。

验证：

- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`diagnostic repair center closure audit is wired` 为 PASS。

下一步顺序更新为：

```text
发布级性能 / 状态 / 文案 / 前端体验打磨
→ 打包发布与真实用户测试
```

## 2026-06-05 09:49 发布级加载与重复点击防护进展

已完成：

- 新增 `src/product-ui/ProductBusyOverlay.tsx`。
- 统一使用真实 `busy` 状态驱动加载遮罩，而不是模拟 loading。
- 遮罩带 280ms 延迟，避免短操作闪屏；真实耗时操作超过延迟后会出现全屏虚化层。
- 遮罩会提示“正在等待真实状态返回，请不要重复点击按钮”，降低用户多次点击造成卡顿和状态混乱的概率。
- 已接入主要耗时页面：
  - 游戏扫描
  - 通用组网中心
  - 推荐方案 / 房主开房向导
  - Terraria 向导
  - 诊断报告 / 问题修复中心
  - 高级连接工具
  - 方案库
  - 设置与帮助
- `tools/release_preflight.ps1` 新增 `product busy overlay is wired` 守卫，确认统一遮罩组件存在并接入主要 Product 页面。

验证：

- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`product busy overlay is wired` 为 PASS。

下一步建议：

```text
继续做发布级状态一致性与文案收敛
→ 检查 n2n/服务端/诊断/高级工具状态是否仍有互相打架
→ 简化给用户看的长段技术说明
→ 最后进入真实 exe 人工测试与发布准备
```

## 2026-06-05 10:05 发布级状态一致性审计进展

已完成：

- 新增 `src/product-ui/productStateConsistencyAudit.ts`。
- 诊断页新增 `data-product-state-consistency-audit="checklist"` 自检卡。
- 状态一致性样例矩阵覆盖 busy 优先级、runtime 未加载、runtime 错误、未配置、已配置未启动、ACK 等待、服务端缺失、好友 IP 缺失和可邀请成功。
- 修正 LAN 邀请前的好友 IP 拦截：`hasFriendSlot === false` 时 `canInvite=false`，避免房主未分配好友虚拟 IP 就生成邀请。
- 推荐方案页底部邀请按钮改为走 `copyHostInvite`，未分配好友 IP 时先显示并执行“先分配好友 IP”，不再直接复制不完整 LAN 邀请。
- 新增“复制状态一致性自检”，可输出当前状态、runtime、路线、诊断上下文、覆盖页面、样例结果和人工验证项。
- `tools/release_preflight.ps1` 新增 `product state consistency audit is wired` 守卫。

验证：

- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`product state consistency audit is wired` 为 PASS。

下一步顺序更新为：

```text
发布级文案与页面二次进入体验收敛
→ 真实 exe 人工测试与失败场景复测
→ v0.1 打包发布与真实用户测试
```

## 2026-06-05 10:34 页面二次进入体验收敛进展

已完成：

- 新增 `src/product-ui/productPageCache.ts`。
- 游戏扫描页再次进入优先展示上次扫描结果，不再每次都阻塞式自动扫描。
- 推荐方案页再次进入优先展示上次推荐、好友席位、端口和检测结果，然后后台刷新真实状态。
- 通用组网中心保留上次表单内容；有缓存时读取最近 n2n 配置不再触发明显遮罩。
- Terraria 向导保留世界、端口、密码、人数等表单内容。
- 精简了几处面向玩家的说明文案，减少开发者式长句。
- `tools/release_preflight.ps1` 新增 `product page cache and concise copy are wired` 守卫。

验证：

- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`product page cache and concise copy are wired` 为 PASS。

下一步顺序更新为：

```text
真实 exe 人工测试与失败场景复测
→ v0.1 打包发布与真实用户测试
```

## 2026-06-05 10:47 真实 EXE 人工验证清单进展

已完成：

- 新增 `src/product-ui/realExeValidationChecklist.ts`。
- 诊断页新增 `data-real-exe-validation-checklist="checklist"` 卡片。
- 清单覆盖真实 EXE 入口、窗口干净、页面二次进入缓存、n2n/Supernode ACK/PONG、邀请加入、房主开房、Terraria 30 秒稳定性、高级工具、共享库、非 LAN 边界、诊断修复中心、游戏内加入。
- 新增“复制真实 EXE 验证清单”，可复制当前 runtime、诊断报告、页面缓存、上下文和逐项人工测试步骤。
- `tools/release_preflight.ps1` 新增 `real exe validation checklist is wired` 守卫。

验证：

- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`real exe validation checklist is wired` 为 PASS。

下一步顺序更新为：

```text
发布日志与 v0.1 打包发布准备
→ GitHub Release / 真实用户测试
```

## 当前定位

联机助手不应该只是一个 n2n 启动器，而应逐步变成：

> 面向普通玩家的“多人联机方案选择器 + 一键执行器 + 问题修复中心”。

核心逻辑是：

1. 先识别游戏本身支持什么多人能力。
2. 再判断它能不能通过某种方式转换成可联机体验。
3. 最后把合适方案包装成用户能理解、能一键执行、能诊断修复的流程。

## 后续几个大方向

### 1. 房主开房向导闭环

当前“好友粘贴邀请包加入”已经基本闭环，下一步应优先把房主侧也做成发布级闭环。

目标流程：

```text
选择游戏
→ 推荐方案
→ 启动组网
→ 启动服务端/游戏
→ 检测游戏端口
→ 分配好友虚拟 IP
→ 生成邀请包
→ 一键复制给好友
```

要补齐的重点：

- 房主步骤自检卡。
- 每一步失败时能明确进入诊断或高级工具。
- 非 LAN 路线不能误生成 LAN 邀请。
- 房主侧也要有可复制的发布验收清单。

### 2. 游戏适配器与共享方案库增强

这是项目长期差异化核心。世界上游戏太多，不应每个游戏都单独写一个前端向导，而应通过“适配器”沉淀方案。

目标：

- 用户或管理员识别某个游戏属于哪类联机能力。
- 生成或保存该游戏的适配器。
- 之后其他用户扫描到同一游戏时，自动套用已验证方案。

要继续增强：

- 适配器质量评分。
- 管理员审核流程。
- 用户贡献包导入。
- 远程共享库同步。
- 版本冲突、备份、恢复、差异摘要。
- 适配器与推荐页、诊断页、高级工具之间保持闭环。

### 3. 多联机方式统一入口

项目不应只绑定 n2n。n2n 是主线，但不同游戏需要不同方案。

需要支持并统一展示：

- n2n：原生 LAN / IP 直连游戏主线方案。
- TCP 端口代理：把某些只监听本机或指定端口的服务转发到虚拟网。
- UDP 单播代理：处理部分 UDP 直连场景。
- UDP 广播桥：处理“局域网大厅发现不到房间”的游戏。
- Steam Remote Play：本地同屏游戏的远程同屏方案。
- Sunshine + Moonlight：本地同屏游戏的通用串流方案。
- Steam Relay / Steam P2P 插件入口：为 Steam 联机类游戏预留。
- WireGuard / ZeroTier / Tailscale：作为替代组网或引导方案。

重点不是一次性全部深度实现，而是让推荐引擎能告诉用户：

```text
这个游戏应该选哪种方式，为什么，下一步点哪里。
```

### 4. 非局域网游戏转换方案引擎

这是最有想象力、最能区别于普通组网工具的模块。

目标不是承诺“所有游戏都能变成局域网游戏”，而是判断游戏属于哪一类，然后给出可行转换路线。

主要分类：

- 原生 LAN / IP 直连：推荐 n2n。
- LAN 大厅依赖广播：推荐 n2n + UDP 广播桥。
- 只能本地同屏：推荐 Steam Remote Play 或 Sunshine + Moonlight。
- Steam P2P / Steam 大厅：推荐 Steam Relay / 插件入口或保留 Steam 原方案。
- 官方服务器限定：不强行转换，给出限制说明和替代建议。

例如《茶杯头》这类只能本地同屏的游戏，不能真正“变成 LAN 游戏”，但可以通过远程同屏方案变成“异地一起玩”的体验。

### 5. 诊断页升级成问题修复中心

诊断页不应只是报告文本，而应成为失败后的主入口。

要覆盖：

- n2n 未启动。
- supernode 无响应。
- edge.exe 缺失。
- IP / MAC 冲突。
- 组网已通但游戏端口不通。
- UDP 广播不可达。
- TCP/UDP 代理参数错误。
- 防火墙可能阻止。
- 服务端启动失败。
- 游戏路线选错，例如本地同屏游戏却尝试 n2n。

每类问题都应给出：

- 简短原因。
- 一键修复。
- 自动复测。
- 手动命令。
- 可复制给好友/管理员的复盘。

### 6. 发布级体验与性能打磨

用户已经多次反馈按钮卡顿、状态混乱、文字排版、加载动画、中文乱码等问题。后续要把它当作产品质量主线，而不是临时修 UI。

重点：

- 所有耗时按钮必须有加载遮罩或按钮级 loading。
- 页面二次进入应优先保留上次结果，不重复卡顿加载。
- n2n 状态、服务端状态、诊断状态不能互相打架。
- 错误信息不能出框，长文本要自动换行或折叠。
- 中文、版本号、说明文案要统一。
- release preflight 要守住关键闭环，避免重构时丢功能。

### 7. 用户说明、测试流程与发布准备

最终要面向普通用户，因此需要持续补齐：

- 房主怎么用。
- 好友怎么用。
- 只有一台电脑怎么测试。
- VPS supernode 怎么部署。
- n2n / edge / supernode 是什么。
- 什么情况下需要端口代理。
- 什么情况下需要 UDP 广播桥。
- 什么情况下应使用远程同屏。
- 发布前人工验证流程。

## 当前优先级

建议顺序：

1. 先完成“房主开房向导闭环最终审计”。
2. 再做“房主失败自动进入诊断 / 高级工具”的闭环。
3. 然后审计“游戏适配器与共享方案库”是否已经能支撑真实用户贡献。
4. 接着把“非局域网游戏转换方案引擎”做成更明确的用户流程。
5. 最后做发布前整体体验、性能、文案和安装包验证。

## 当前不要偏离的判断

- 不要为每个游戏都写一个独立复杂前端。
- Terraria 向导可以保留为样例和特殊服务端游戏模板。
- 通用做法应该是：扫描游戏 → 识别能力 → 匹配适配器 → 推荐方案 → 一键执行。
- 对于不能 LAN 的游戏，应诚实推荐远程同屏、Steam Relay 或其他路线，不要假装 n2n 能解决所有问题。
- 产品价值不在“自己造一个 Radmin”，而在“把玩家该选哪种联机方式、怎么配置、失败怎么修”统一起来。

## 2026-06-05 11:04:48 - 当前下一阶段大方向总览

基于目前已经完成的邀请包加入闭环、房主开房闭环、适配器共享库审计、多联机方式审计、非 LAN 转换引擎审计、诊断修复中心、加载遮罩、页面缓存和真实 EXE 验证清单，后续工作收敛为下面几个大方向：

1. **v0.1 发布准备与真实 EXE 验证**
   - 把 `docs/V0_1_RELEASE_READINESS.md`、发布日志、GitHub Release 草稿和真实 EXE 人工验证记录接入 preflight。
   - 明确哪些是自动化 PASS，哪些仍是人工 PENDING，不能把未测项写成通过。
   - 真实运行 `lan-helper.exe`，验证启动窗口干净、页面二次进入不卡顿、n2n ACK/PONG、Terraria 30 秒稳定、邀请加入和房主开房闭环。

2. **用户发布包与使用说明**
   - 面向普通玩家整理“房主怎么开房、好友怎么加入、只有一台电脑怎么测、失败后点哪里修”。
   - 发布说明必须强调：不是所有游戏都能一键变 LAN；本地同屏、Steam P2P、官方服限定游戏要走对应路线。

3. **真实用户测试与反馈闭环**
   - 用 v0.1 找少量真实用户测试，重点收集入口理解、失败步骤、诊断有效性和邀请包体验。
   - 把反馈沉淀为问题分类、适配器、共享库条目和 UI 文案，而不是临时修单点显示。

4. **适配器共享库扩容**
   - 从 Terraria / Minecraft / Stardew / Palworld / Cuphead 示例，扩展到更多真实游戏。
   - 每个新增游戏不单独做复杂前端，而是沉淀为 adapter：能力类型、推荐方式、端口、启动提示、诊断规则、适用版本。

5. **多联机方式深度化**
   - n2n 继续作为原生 LAN/IP 直连主线。
   - UDP 广播桥、TCP/UDP 代理、Steam Remote Play、Sunshine + Moonlight、WireGuard/ZeroTier/Tailscale 保持统一入口。
   - 后续优先把最常用且能真实验证的方式做成更完整的“配置 → 启动 → 检测 → 诊断”闭环。

6. **非局域网游戏转换方案引擎增强**
   - 继续完善“能不能转、该怎么转、不能转时该推荐什么”的判断。
   - 对本地同屏游戏不要假装能 LAN，而是走远程同屏；对 Steam P2P/官方服限定游戏要诚实提示边界。

7. **发布级体验继续打磨**
   - 继续处理真实 EXE 中的卡顿、加载态、重复点击、中文乱码、文字出框、状态互相打架。
   - 原则保持：必须前后端状态闭环，不能只改显示。

当前建议执行顺序：

```text
v0.1 发布准备接入 preflight
→ 真实 EXE 人工验证
→ GitHub Release / 小范围用户测试
→ 收集反馈并扩容适配器共享库
→ 选择 1-2 个高价值联机方式做深度闭环
→ 持续强化非 LAN 转换方案引擎
```
## 2026-06-05 11:11:33 v0.1 发布准备 preflight 接入进展

已完成：

- `tools/release_preflight.ps1` 新增发布准备 required files：
  - `docs/V0_1_RELEASE_READINESS.md`
  - `docs/GITHUB_RELEASE_DRAFT.md`
  - `docs/RELEASE_NOTES_DRAFT.md`
  - `docs/NEXT_BIG_DIRECTIONS.md`
- 新增 `v0.1 release readiness docs are wired` 守卫。
- 守卫会检查 v0.1、`lan-helper.exe`、真实 EXE、PENDING、GitHub Release、房主/好友流程、已知限制、“不宣传所有游戏一键联机”和下一阶段路线。
- `docs/RELEASE_NOTES_DRAFT.md` 已修正为 2026-06-05，并把 adapter registry 示例数量从 3 个改为当前 5 个。
- `docs/RELEASE_VALIDATION_LOG.md` 已追加本轮自动化复测结果，同时保留真实 EXE 人工验证 PENDING 边界。

验证：

- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`v0.1 release readiness docs are wired` 为 PASS。

下一步顺序更新为：

```text
真实 EXE 人工验证
→ npm run tauri:build 重新生成发布产物
→ GitHub Release / 小范围用户测试
→ 根据反馈扩容适配器共享库
```
## 2026-06-05 11:32:48 真实 EXE 启动烟测与白框防护进展

已完成：

- `src-tauri/src/core/game_launcher.rs` 的 adapter/游戏启动命令已接入 `hide_console_window(&mut command).spawn()`，降低通过适配器启动控制台型 helper/server 时弹出白色命令框的风险。
- 新增 `tools/real_exe_smoke_test.ps1`，可启动真实 `src-tauri/target/release/lan-helper.exe`，检查进程存活、窗口/WebView 是否创建、启动期是否出现 `cmd/conhost/powershell/edge/n2n` 类子进程，并可追加到 `docs/RELEASE_VALIDATION_LOG.md`。
- `docs/V0_1_RELEASE_READINESS.md` 新增启动烟测命令说明，并强调烟测不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。
- `tools/release_preflight.ps1` 新增 required file `tools/real_exe_smoke_test.ps1` 和 `src-tauri/src/core/process_util.rs`。
- `tools/release_preflight.ps1` 新增两个守卫：
  - `real exe startup smoke script is wired`
  - `game launch console hiding is wired`
- 已重新执行 `npm run tauri:build` 生成当前 release exe。
- 已执行真实 EXE 启动烟测：窗口标题为“联机助手”，WebView 子进程 6 个，启动期 console-like 子进程 0 个，结果 PASS。

验证：

- `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
- `npm run tauri:build` 通过。
- `powershell -ExecutionPolicy Bypass -File tools/real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog` 通过。
- `npm run release:preflight` 通过，新增守卫 PASS。

下一步顺序更新为：

~~~text
真实点击人工验证
→ 记录 n2n ACK/PONG 与邀请/房主/Terraria 结果
→ 如全部通过，整理 GitHub Release v0.1 上传清单
→ 小范围用户测试
~~~

## 2026-06-05 11:43:12 v0.1 GitHub Release 上传清单进展

已完成：

- 新增 `docs/V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md`，把 GitHub Release 的 tag、title、上传文件、发布正文、自动化命令、人工 PENDING 边界和发布后观察重点固定下来。
- 新增 `docs/V0_1_USER_FEEDBACK_TEMPLATE.md`，方便首批用户按游戏名、版本、房主/加入者虚拟 IP、ACK/PONG、端口、诊断报告和截图反馈问题。
- `docs/GITHUB_RELEASE_DRAFT.md` 已追加 v0.1 上传与反馈说明。
- `tools/release_preflight.ps1` 新增 required files 和 `v0.1 github release upload checklist is wired` 守卫。

验证：

- `npm run release:preflight` 通过，新增守卫 PASS。
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri/Cargo.toml` 通过。

下一步顺序更新为：

~~~text
真实 EXE 人工点击验证
→ 把 PASS / FAIL / PENDING 写入 RELEASE_VALIDATION_LOG
→ 如果人工验证可接受，按 V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md 发布 v0.1
→ 收集首批用户反馈并转成 adapter / 诊断 / 推荐路线改进
~~~
## 2026-06-05 11:48:40 长期目标完成证据审计进展

已完成：

- `docs/GOAL_COMPLETION_AUDIT.md` 已补充当前长期目标 6 条主线的证据矩阵。
- 明确当前状态：功能闭环已接入并通过自动化发布预检；真实双机、真实加入者、Terraria 双机和更多 adapter 审核仍为 PENDING。
- `tools/release_preflight.ps1` 新增 `current long-term goal audit is recorded` 守卫，避免后续错误声称目标完全完成或丢失 PENDING 边界。

验证：

- `npm run release:preflight` 通过，`current long-term goal audit is recorded` 为 PASS。

下一步顺序更新为：

~~~text
真实 EXE 人工点击验证
→ 按 GOAL_COMPLETION_AUDIT / RELEASE_VALIDATION_LOG 记录 PASS/FAIL/PENDING
→ 发布 v0.1 MVP 小范围测试
→ 用反馈扩展 adapter 与诊断分类
~~~
## 2026-06-05 12:02:44 真实 EXE 人工验证记录器进展

已完成：

- 诊断页“真实 EXE 人工验证”卡片新增 PASS / FAIL / PENDING 记录器。
- 人工结果写入 localStorage，支持跨页面保留、窗口 focus/storage 刷新和一键清空本轮记录。
- 复制验证清单时会带上人工记录摘要和每项记录，方便直接粘贴到 `docs/RELEASE_VALIDATION_LOG.md`。
- `tools/release_preflight.ps1` 的 `real exe validation checklist is wired` 守卫已补强，要求存在 manual-recorder、mark/clear 逻辑和结果存储。

验证：

- `npm run build` 通过。
- `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
- `npm run release:preflight` 通过。

下一步顺序更新为：

~~~text
打开 release EXE 实际点击验证
→ 在诊断页逐项标记 PASS/FAIL/PENDING
→ 复制验证清单写入 RELEASE_VALIDATION_LOG
→ 结果可接受后发布 v0.1
~~~
## 2026-06-05 12:09:15 带人工验证记录器的 release EXE 产物进展

已完成：

- 已重新执行 `npm run tauri:build`，当前 release exe 已包含诊断页 PASS / FAIL / PENDING 人工验证记录器。
- 已运行 `tools/real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog`，真实 EXE 启动烟测 PASS，启动期 console-like 子进程 0 个。
- 已再次运行 `npm run release:preflight`，`real exe validation checklist is wired` 等守卫 PASS。

下一步顺序更新为：

~~~text
人工打开 release EXE
→ 诊断页逐项标记 PASS/FAIL/PENDING
→ 复制验证清单写入 RELEASE_VALIDATION_LOG
→ 若核心项可接受，发布 v0.1
~~~


## 2026-06-05 12:21:27 - 当前后续大方向总结版

这次把后续路线收敛为 7 个大方向，按优先级执行：

1. **v0.1 发布验证与真实 EXE 门禁**
   - 当前不是继续无限加功能，而是先确认打包后的 `lan-helper.exe` 能稳定运行。
   - 重点验证：启动无白框、页面二次进入不卡顿、n2n ACK/PONG、房主开房、邀请包加入、Terraria 30 秒稳定、诊断修复中心。
   - 自动化 PASS 不等于真实用户 PASS，人工项必须记录 PASS / FAIL / PENDING。

2. **v0.1 GitHub Release 与小范围真实用户测试**
   - 核心项可接受后发布 v0.1 MVP。
   - 发布文案必须写清楚：这不是“所有游戏一键联机”，而是根据游戏能力推荐对应联机方式。
   - 首批测试重点看用户能不能理解：房主怎么做、好友怎么做、失败后点哪里修。

3. **适配器共享库扩容**
   - 后续不要为每个游戏单独做一套复杂前端。
   - 每个游戏应沉淀为 adapter：游戏能力、端口、推荐方式、启动参数、诊断规则、适用版本、注意事项。
   - 通过管理员/用户贡献让同一个游戏配置可以被后续用户复用。

4. **多联机方式深度闭环**
   - n2n 继续作为原生 LAN / IP 直连主线。
   - 后续优先选择 1-2 个高价值方式做深：例如 TCP/UDP 端口代理、UDP 广播桥、Steam Remote Play / Sunshine + Moonlight。
   - 每种方式都应形成“配置 → 启动 → 检测 → 诊断 → 复制给好友”的闭环。

5. **非局域网游戏转换方案引擎增强**
   - 继续强化“能不能转、该怎么转、不能转时推荐什么”。
   - 本地同屏游戏例如 Cuphead 不能假装变成真正 LAN，应推荐远程同屏/串流路线。
   - Steam P2P、官方服务器限定、未知游戏要诚实提示边界，避免误导用户。

6. **诊断修复中心继续产品化**
   - 诊断页要作为失败后的主入口，而不是只展示报告。
   - 后续继续增加：失败分类、自动修复、自动复测、复制给房主/好友、发布验证记录。
   - 每次修复都要保证内部真实状态闭环，不能只改前端显示。

7. **前端体验与用户说明长期打磨**
   - 继续优化高级感、排版、加载态、中文、长文本、重复点击防护。
   - 删除开发者式说明，换成普通玩家能理解的“我该点什么、好友该做什么、失败怎么办”。
   - 后续前端重构可以做，但必须保留当前后端接口和真实功能闭环。

当前实际执行顺序：

```text
真实 EXE 人工验证
→ 发布 v0.1 小范围测试
→ 收集反馈
→ 扩容 adapter 共享库
→ 选择 1-2 个联机方式做深度闭环
→ 增强非 LAN 转换引擎
→ 持续打磨诊断修复中心和前端体验
```

## 2026-06-05 12:44:17 - 适配器共享库校验器 v1
- 新增 `tools/validate_adapter_registry.ps1`。
- `package.json` 新增 `npm run adapter:validate`。
- `tools/release_preflight.ps1` 新增 required file，并在 release preflight 中执行 `adapter registry schema validation`。
- 校验器会检查 index JSON、adapter 文件存在性、SHA256、必要字段、端口范围、连接计划完整性。
- 重点增加非 LAN 边界保护：Cuphead/本地同屏类 adapter 不能误标 `can_convert_to_lan=true`，不能要求虚拟 LAN，不能推荐 `virtual_lan`，不能暴露 LAN 加入端口，必须走 Steam Remote Play 或 Sunshine + Moonlight 等远程同屏路线。

验证：
- `npm run adapter:validate` 通过：Adapters=5，Warnings=0，Errors=0。
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，新增 `adapter registry schema validation` 为 PASS。

下一步推荐：继续做真实 EXE 人工验证；发布后新增 adapter 时先运行 `npm run adapter:validate`，再同步到 GitHub Pages/VPS 共享库。

## 2026-06-05 12:52:47 - 真实 EXE 人工验证指南 v1
- 新增 `docs/REAL_EXE_MANUAL_VALIDATION_GUIDE.md`，把 v0.1 发布前最后一轮人工验证拆成 A/B/C/D/E 五组：真实 EXE 启动与页面缓存、邀请包一键加入、房主开房向导/Terraria、adapter 与非 LAN 边界、诊断修复中心。
- 指南明确每个 PASS 必须来自真实 EXE、真实进程、真实端口、真实 n2n 日志、真实游戏内操作或诊断报告；双机未测项必须保持 PENDING。
- 指南覆盖：`仅填入参数`、`保存并启动 n2n`、加入结果卡片、失败进入诊断、复制错误给房主、成功后连接房主虚拟 IP 和端口。
- 指南覆盖房主流程：选择游戏、推荐方案、启动组网、启动服务端/游戏、检测端口、分配好友 IP、生成邀请包。
- 指南覆盖非 LAN 边界：Cuphead/本地同屏不能真正变成 LAN，应走 Steam Remote Play 或 Sunshine + Moonlight。
- `tools/prepare_v0_1_release_package.ps1` 已把该指南复制进 `release-artifacts\v0.1.0\REAL_EXE_MANUAL_VALIDATION_GUIDE.md`。
- `docs/V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md` 已加入人工验证指南作为发布材料。
- `tools/release_preflight.ps1` 新增 required file 和 `real exe manual validation guide is wired` 守卫。

验证：
- `npm run release:package -- -Clean -AppendLog` 通过，发布包中已包含 `REAL_EXE_MANUAL_VALIDATION_GUIDE.md`。
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`real exe manual validation guide is wired` 为 PASS。

下一步推荐：按 `docs/REAL_EXE_MANUAL_VALIDATION_GUIDE.md` 打开真实 EXE 做人工验证；核心项可接受后发布 v0.1 小范围测试。

## 2026-06-05 13:07:33 - 诊断页人工验证指南入口与真实 EXE 复测
- 诊断页“真实 EXE 人工验证”卡片新增两个入口：`打开人工验证指南` 与 `复制人工验证指南`。
- 新增 `src/product-ui/realExeManualValidationGuide.ts`，提供简版人工验证指南文本，覆盖真实 EXE、邀请包一键加入、房主开房、Terraria、adapter、Cuphead/本地同屏边界和诊断修复中心。
- `ProductDiagnosticsView.tsx` 现在会优先尝试打开 `docs\\REAL_EXE_MANUAL_VALIDATION_GUIDE.md`，如果发布包目录下运行，则尝试打开 `REAL_EXE_MANUAL_VALIDATION_GUIDE.md`；打开失败时提示用户复制指南文本。
- `tools/release_preflight.ps1` 已把 `src/product-ui/realExeManualValidationGuide.ts` 加入 required file，并补强 `real exe validation checklist is wired` 守卫。

验证：
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。
- `npm run release:preflight` 通过。
- 已重新执行 `npm run tauri:build`，生成包含人工验证指南入口的新 release EXE。
- 连续执行 tauri build + 烟测时曾出现一次 `powershell.exe` console-like 子进程 FAIL；随后单独重跑 `tools\\real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog` PASS，console-like 子进程 0。该异常保留在日志中，不当作最终 PASS 证据；发布前以最后一次独立烟测 PASS 为准。
- 已重新执行 `npm run release:package -- -Clean -AppendLog`，发布包已更新为新 EXE。

下一步推荐：打开新 release EXE，进入诊断页，点击“打开人工验证指南”或“复制人工验证指南”，然后逐项标记 PASS / FAIL / PENDING。

## 2026-06-05 13:20:50 - 人工验证指南打开路径解析修复
- 修复后端 `open_path` 的相对路径解析：现在会按当前工作目录、当前 EXE 所在目录、当前 EXE 父级链路依次查找相对路径。
- 这样诊断页“打开人工验证指南”在两种场景下都更可靠：
  - 从 `src-tauri\\target\\release\\lan-helper.exe` 启动时，可沿父级链路找到仓库内 `docs\\REAL_EXE_MANUAL_VALIDATION_GUIDE.md`。
  - 从 `release-artifacts\\v0.1.0\\lan-helper-v0.1.0.exe` 所在目录运行时，可打开同目录 `REAL_EXE_MANUAL_VALIDATION_GUIDE.md`。
- `tools/release_preflight.ps1` 新增 `manual validation guide open path resolution is wired` 守卫，防止后续回退成只按当前目录找文件。

验证：
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。
- `npm run release:preflight` 通过，新增路径解析守卫 PASS。
- `npm run tauri:build` 通过。
- 独立运行 `tools\\real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog` 通过，console-like 子进程 0。
- `npm run release:package -- -Clean -AppendLog` 通过；发布包 EXE 已更新，大小 13337088 bytes。

下一步推荐：打开更新后的真实 EXE，进入诊断页点击“打开人工验证指南”，确认能打开指南；随后按指南逐项标记 PASS / FAIL / PENDING。

## 2026-06-05 13:34:55 - v0.1 发布包完整性校验器 v1
- 新增 `tools/verify_v0_1_release_package.ps1`。
- `package.json` 新增 `npm run release:package:verify`。
- 校验器会检查 `release-artifacts\v0.1.0\` 中的 EXE、SHA256SUMS、release-manifest、Release 正文、人工验证指南、反馈模板和 adapter registry。
- 初次运行时发现 `RELEASE_BODY.md` 缺少远程同屏边界；已在 `docs/GITHUB_RELEASE_DRAFT.md` 中补充：Cuphead / 茶杯头这类本地同屏游戏应使用 Steam Remote Play 或 Sunshine + Moonlight，不应当成 n2n 局域网游戏处理。
- 已重新生成发布包并运行 `npm run release:package:verify -- -AppendLog`，结果 PASS，Warnings=0，Errors=0。
- `docs/V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md` 已加入 `release:package:verify` 作为上传前检查。

下一步推荐：发布前运行 `npm run release:package:verify`；通过后从 `release-artifacts\v0.1.0\` 上传 EXE 和 SHA256SUMS。

## 2026-06-05 13:48:11 - 后续大方向总纲（用户确认口径）

经过前面关于 n2n、适配器、房主/好友邀请、诊断修复、发布验证以及“非局域网游戏能否转换”的讨论，后续大方向收敛为：

1. **v0.1 发布验证与小范围真实用户测试**
   - 先不继续无限加功能，优先用真实 EXE 完成最后一轮人工验证。
   - 重点验证启动干净、页面不卡顿、n2n 状态真实、邀请包加入、房主开房、Terraria 30 秒稳定、诊断修复入口、Cuphead/本地同屏边界说明。
   - 通过后发布 v0.1，让真实用户反馈决定下一轮优先级。

2. **适配器共享库与用户/管理员沉淀机制**
   - 不给每个游戏单独做一套前端。
   - 每个游戏沉淀为 adapter：游戏类型、联机能力、端口、启动项、推荐路线、诊断规则、适用版本、注意事项。
   - 用户或管理员确认过的方案可以进入共享库，后续用户扫描到同一游戏时直接复用。

3. **多联机方式统一入口**
   - n2n 继续负责原生 LAN / IP 直连类游戏。
   - TCP/UDP 端口代理、UDP 广播桥用于补足“有端口但发现机制不友好”的游戏。
   - Steam Remote Play、Sunshine + Moonlight 用于本地同屏/同屏合作游戏。
   - WireGuard / ZeroTier / Tailscale / Steam Relay / Steam P2P 插件入口作为未来方式预留，但必须清楚标注当前成熟度。

4. **非局域网游戏转换方案引擎**
   - 这是项目长期最核心的差异化方向：不是只做虚拟局域网，而是判断一个游戏到底能不能“变成可远程一起玩”。
   - 对游戏分型：原生 LAN、IP 直连、LAN 广播发现、端口联机、本地同屏、Steam P2P、官方服务器限定、未知待复核。
   - 对 Cuphead 这类只能本地同屏的游戏，不能说 n2n 可以把它变成真正 LAN；可行方向是远程同屏/串流 + 输入转发，也就是“远程沙发合作”。

5. **诊断页升级为问题修复中心**
   - 用户失败后不应该看一堆日志，而是看到“为什么失败、点哪里修、修完是否恢复”。
   - 诊断要承接 n2n、服务端、端口、好友 IP、邀请包、适配器路线、远程同屏方案等上下文。
   - 原则：所有提示必须对应真实状态和真实后端动作，不能只改显示。

6. **前端产品化与交互打磨**
   - 保留后端真实能力，继续把界面做成更清爽、更高级、更像成品。
   - 重点优化加载遮罩、重复点击防护、页面二次进入缓存、长文本排版、中文文案、普通玩家说明。
   - 用户路径要简化成：扫描游戏 → 推荐方案 → 房主/好友照做 → 失败进诊断。

7. **发布后反馈闭环与路线降级机制**
   - 用户反馈要反向沉淀到 adapter、诊断规则、推荐权重和发布清单中。
   - 对不确定游戏不要强行推荐，而是标记“待复核/需要管理员确认”。
   - 对不能 LAN 化的游戏要明确降级到远程同屏、官方服务器或暂不支持，避免误导。

当前推荐执行顺序：

```text
真实 EXE 人工验证
→ v0.1 小范围发布
→ 收集真实用户反馈
→ 扩容 adapter 共享库
→ 做深 1-2 个高价值联机方式
→ 增强非局域网转换方案引擎
→ 诊断修复中心和前端体验持续产品化
```
