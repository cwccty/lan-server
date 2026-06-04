# 前后端接口对接 Subagent 审计记录

更新时间：2026-06-04 20:32:04

## 目标

检查当前项目前后端接口还有哪些没有完善好，拆分给 3 个 worker subagent 审计，并由主 Agent 负责审核、修复和验证，继续推进“彻底完成前后端对接”。

## 三个 worker 提示词

### Worker A：前端入口与页面状态对接审计

`	ext
你是 Worker A，负责“前端入口与页面状态对接审计”。项目路径：E:\Documents\联机助手。目标：检查当前 EXE/源码前端是否完整体现最终设计稿和所有核心功能入口，尤其是 Sidebar、App 路由、页面按钮、Product Mode 默认状态。你不是唯一 worker，不要回退或覆盖其他人的修改。请优先只读审计，不要大范围改代码；如发现明确小修可改，但写集限定在 src/reference-ui、src/reference-adapter 的前端入口/导航相关文件。输出：1) 缺失/不一致清单；2) 每项对应文件和建议修法；3) 如有改动，列出改动文件；4) 验证命令。重点关注：高级连接工具是否在当前源码、dist、release exe 对应构建中存在；Product Mode 默认是否会让发布 EXE 显示真实状态；不要把参考演示值当完成。
`

### Worker B：后端 Tauri commands 与前端 API 类型对接审计

`	ext
你是 Worker B，负责“后端 Tauri commands 与前端 API 类型对接审计”。项目路径：E:\Documents\联机助手。目标：核对 src/api/tauri.ts 暴露的前端 API、src-tauri/src commands 注册、Rust command 实现、TypeScript 类型之间是否一致。你不是唯一 worker，不要回退其他人修改。请优先只读；如发现明确命名/参数不一致的小修可改，写集限定在 src/api/tauri.ts、src/types、src-tauri/src 与命令注册相关文件。输出：1) 命令缺失/参数不一致/类型不一致清单；2) 哪些前端按钮仍没有真实 API；3) 建议修复顺序；4) 如有改动列文件；5) 验证命令。
`

### Worker C：发布验证、预检规则与前后端矩阵审计

`	ext
你是 Worker C，负责“发布验证、预检规则与前后端矩阵审计”。项目路径：E:\Documents\联机助手。目标：检查 docs/FINAL_REFERENCE_UI_BACKEND_MATRIX.md、docs/GOAL_COMPLETION_AUDIT.md、tools/release_preflight.ps1 是否覆盖当前用户关心的问题：设计稿入口缺失、EXE 默认进入参考模式、核心按钮是否真实对接、假数据是否仍可在发布版出现。你不是唯一 worker，不要回退其他人修改。请优先只读；如发现明确预检遗漏可小范围新增脚本规则，写集限定 docs、tools。输出：1) 当前文档/预检覆盖不足清单；2) 应新增的 gate；3) 如有改动列文件；4) 验证命令。
`

## Worker 结果审核

### Worker A 结论

- 当前真实入口是 src/main.tsx -> src/reference-ui/App，不是旧 src/App.tsx。
- src/reference-ui/components/Sidebar.tsx 已包含 高级连接工具。
- src/reference-ui/App.tsx 已注册 dvanced_tools 并渲染 AdvancedToolsView。
- src/main.tsx 已挂载 ReferenceProductAdvancedToolsPatcher。
- 旧 src/App.tsx 和 src/components/Layout.tsx 与最终设计稿不一致，但不是当前运行入口，后续应标注 deprecated 或移除，避免误判。
- Product Mode 在 Tauri fresh state 下默认开启，但如果 localStorage 曾写入 lan-helper.referenceProductMode = 0，仍可能显示参考模式；这是后续发布策略问题。

### Worker B 结论

- Worker B 返回无效内容，未采纳。
- 主 Agent 本地补做审计，发现当前 
pm run build 曾因 TS 严格类型不一致失败。
- 已核对 src/api/tauri.ts 与 src-tauri/src/lib.rs：前端暴露的核心命令均已在 Rust invoke_handler 注册。

### Worker C 结论

- 原预检缺少：最终设计稿 (3) 固定检查、EXE Product Mode 默认、Product patcher 挂载、核心 API wiring sentinel。
- 已补强 	ools/release_preflight.ps1。

## 本轮已修复缺口

1. **通用组网中心 Refresh Node Status 误启动 n2n**
   - 文件：src/reference-adapter/ProductActionPatcher.tsx
   - 修复：从 startReferenceN2n(readNetworkConfigFromReferenceForm()) 改为 efreshReferenceRuntime(false)。
   - 意义：刷新状态不再改变运行状态，不会把刷新按钮误当启动按钮。

2. **TypeScript 前后端类型契约不一致**
   - 文件：src/types/*.ts
   - 修复：将 Rust/serde 可能返回 
ull 的字段统一声明为 ? | null，例如 steam_appid、detected_path、last_error、latency_ms、launch_profile_id、server/proxy optional fields。
   - 意义：前端草稿、adapter JSON、Rust 返回值与 TS 严格模式一致，避免真实接口对接时因 null/undefined 差异构建失败。

3. **发布预检缺少核心入口/真实模式 gate**
   - 文件：	ools/release_preflight.ps1
   - 新增检查：
     - EXE defaults to Product Mode
     - elease mounts Product Mode patchers
     - core navigation includes all product pages
     - core buttons use real backend API sentinel
     - 
etwork refresh does not restart n2n
     - inal design source pinned to (3)

## 当前验证

已通过：

`powershell
npm.cmd run build
cargo check --manifest-path src-tauri\Cargo.toml
powershell -NoProfile -ExecutionPolicy Bypass -File tools\release_preflight.ps1
`

## 剩余对接风险

1. Product Mode 仍是 patcher 架构，不是最终正式受控 React 数据流。
2. 旧 src/App.tsx / src/components/Layout.tsx 仍存在，容易误导审计，但当前不是入口。
3. localStorage 曾关闭 Product Mode 时，EXE 会尊重旧值，可能再次显示参考模式；如要强发布策略，应增加版本迁移或在 Tauri 下禁止关闭默认真实模式。
4. 仍需运行 
pm run tauri:build 重新生成 release exe，确保本轮修复进入实际 EXE。

## 2026-06-04 20:41:57 发布 EXE 强制真实 Product Mode

本轮继续收敛前后端对接的发布风险：

- src/reference-adapter/productMode.ts：Tauri/EXE 环境现在强制返回 Product Mode=true，不再尊重旧 WebView localStorage 中可能残留的 lan-helper.referenceProductMode=0。浏览器预览仍可保持参考模式，用于视觉保真。
- src/reference-adapter/DebugPanel.tsx：修正调试面板文案，明确“浏览器预览默认关闭；Tauri EXE 发布版强制开启真实产品接入”。
- src/App.tsx、src/components/Layout.tsx：加 deprecated 注释，明确当前发布入口是 src/main.tsx -> src/reference-ui/App，旧壳不是 EXE 前端来源。
- 	ools/release_preflight.ps1：把检查从“EXE defaults to Product Mode”升级为“EXE forces Product Mode”，并新增 legacy shell is not release entry gate，防止后续误把旧 App Shell 当发布入口。

原因：用户已多次通过截图发现“打开 EXE 与最终设计稿/真实接入不一致”。发布版必须防止任何旧状态或旧入口导致展示稿模式泄漏。

## 2026-06-04 21:09:03 首页迁移为正式 React 受控页面

本轮开始执行“把 Product Mode patcher 逐页迁移为正式 React 受控页面”。

已完成首页第一步迁移：

- 新增 src/product-ui/ProductHomeView.tsx：首页在 Product Mode 下直接使用 useReferenceRuntime() 读取真实 runtime snapshot 渲染，不再依赖 DOM patcher 替换参考 UI 文本。
- 修改 src/reference-ui/App.tsx：当 productMode.enabled 时首页渲染 ProductHomeView；浏览器参考模式仍渲染原 HomeView，方便视觉对照。
- 修改 src/main.tsx：不再挂载 ReferenceProductHomePatcher。
- src/reference-adapter/ProductHomePatcher.tsx 已标注 deprecated，仅作为历史/回退文件存在。
- src/reference-runtime.css 增加 @source "./product-ui/**/*.{ts,tsx}"，确保受控页面样式进入构建。
- 	ools/check_reference_ui_fidelity.ps1：App.tsx 作为受控迁移入口跳过逐字 fidelity；其他 reference-ui 文件仍保持一比一锁定。
- 	ools/release_preflight.ps1：新增 controlled Home page replaces Home patcher 与 product Tailwind source scan gate。

验证已通过：

`powershell
npm.cmd run build
cargo check --manifest-path src-tauri\Cargo.toml
powershell -NoProfile -ExecutionPolicy Bypass -File tools\release_preflight.ps1
`

迁移意义：发布版首页不再先显示参考图中的 75%、24ms、
2n.edge.me:7777 再靠 patcher 覆盖，而是由 React state 直接渲染真实状态。下一页建议迁移 Header，因为顶部仍由 HeaderPatcher 替换 就绪: 24ms。
