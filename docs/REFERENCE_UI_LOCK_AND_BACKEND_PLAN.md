# Reference UI 锁定清单与后端适配方案

创建日期：2026-06-04

目标：当前阶段先保证界面完全按照 `<reference-ui-src-parent>` 一比一复原；后端连接必须在不破坏参考 UI 的前提下逐步接入。

## 1. 当前结论

当前项目入口为：

```ts
src/main.tsx -> src/reference-ui/App
```

`src/reference-ui` 是用户提供的参考前端源码副本。当前已通过源码复核：除 `src/reference-ui/main.tsx` 的构建兼容导入差异外，参考 UI 主要文件与 `<reference-ui-src>` 视觉等价。

`src/reference-ui/main.tsx` 差异：

```ts
// 参考前端
import App from './App.tsx'

// 当前项目，为了 TypeScript 构建兼容
import App from './App'
```

该文件不是当前项目入口，不影响实际渲染视觉。

## 2. 受锁定文件

以下文件是参考 UI 的视觉权威文件，默认不得直接改动 DOM 结构、Tailwind class、布局层级、动效参数、卡片顺序、按钮文案和模拟数据：

- `src/reference-ui/App.tsx`
- `src/reference-ui/index.css`
- `src/reference-ui/data.ts`
- `src/reference-ui/types.ts`
- `src/reference-ui/components/Sidebar.tsx`
- `src/reference-ui/components/Header.tsx`
- `src/reference-ui/components/HomeView.tsx`
- `src/reference-ui/components/GameScanView.tsx`
- `src/reference-ui/components/SolutionsView.tsx`
- `src/reference-ui/components/RecommendProtocolView.tsx`
- `src/reference-ui/components/UniversalNetworkView.tsx`
- `src/reference-ui/components/TerrariaGuideView.tsx`
- `src/reference-ui/components/DiagnosticsView.tsx`
- `src/reference-ui/components/SettingsView.tsx`

允许的极小差异：

- 清理行尾空格；
- 修复 EOF 空行；
- `main.tsx` 的 `./App.tsx` 到 `./App` 导入兼容；
- 不改变视觉的 TypeScript 类型补丁，必须在提交说明里写清楚。

## 3. 复核命令

每次接入后端前后，都应运行以下复核命令。目标是确认参考 UI 没有被误改。

```powershell
$ref='<reference-ui-src>'
$cur='<repo>\src\reference-ui'
$files=@(
  'App.tsx',
  'components\Header.tsx',
  'components\HomeView.tsx',
  'components\GameScanView.tsx',
  'components\SolutionsView.tsx',
  'components\UniversalNetworkView.tsx',
  'components\TerrariaGuideView.tsx',
  'components\DiagnosticsView.tsx',
  'components\Sidebar.tsx',
  'components\RecommendProtocolView.tsx',
  'components\SettingsView.tsx',
  'index.css',
  'data.ts',
  'types.ts'
)
$bad=0
foreach($f in $files){
  $a=Join-Path $ref $f
  $b=Join-Path $cur $f
  git diff --no-index --ignore-space-at-eol --ignore-blank-lines --quiet -- $a $b
  if($LASTEXITCODE -ne 0){ Write-Host "DIFF $f"; $bad++ }
}
Write-Host "visual_diff_count=$bad"
```

验收标准：

```text
visual_diff_count=0
```

## 4. 后端接入原则

用户目标明确要求：完全一比一复原后再做前后端连接。因此下一阶段接后端时必须遵守以下原则。

### 4.1 不直接污染 reference-ui

不要再把以下内容直接写进参考视觉组件：

- `getN2nDiagnostics()`
- `scanGames()`
- `listGameAdapters()`
- `startNetwork()` / `stopNetwork()`
- `startGameServerSession()`
- `generateDiagnosticReport()`
- 任何会大幅改动 JSX 结构的后端状态判断

原因：这些改动会让参考 UI 源码不再一比一，用户再次对比时会看到明显偏差。

### 4.2 使用适配层

后端连接建议新增独立目录：

```text
src/reference-adapter/
```

建议文件：

```text
src/reference-adapter/runtimeStore.ts
src/reference-adapter/useReferenceRuntime.ts
src/reference-adapter/actions.ts
src/reference-adapter/mappers.ts
```

职责：

- 从 Tauri API 读取真实状态；
- 将真实状态映射为参考 UI 已有的 `AppState` 形状；
- 将按钮动作包装为参考 UI 可调用的 handler；
- 不改变参考 UI 的布局结构。

### 4.3 分阶段接入

后端连接建议按以下顺序做：

1. 只接全局状态读，不改页面 JSX：
   - n2n running/online 状态；
   - 本机虚拟 IP；
   - supernode 地址；
   - Terraria session running/logs。
2. 接按钮动作，但保持按钮位置和视觉不变：
   - Header 启动/停止组网；
   - 组网中心保存配置；
   - Terraria 启动/停止服务端；
   - 诊断页重新诊断。
3. 接列表数据，但保持卡片结构不变：
   - 游戏扫描结果；
   - 适配器方案列表。
4. 最后再替换假文案：
   - `24ms`、`12ms`、`0.0%`、`已连接` 等参考文案需要产品化时再替换；
   - 替换前要确认用户接受“视觉不再完全等于参考图”。

## 5. 后端接入时的风险点

### 风险 A：真实状态会改变参考视觉

例如参考 UI 顶部显示 `就绪: 24ms`，真实后端可能显示 `待诊断`。这会改变参考图观感。

处理方式：

- 一比一复原阶段保留参考文案；
- 产品化阶段才切换真实文案；
- 必要时提供两种模式：
  - `reference`：完全参考视觉；
  - `product`：真实后端状态。

### 风险 B：真实列表数量改变页面高度

游戏扫描、方案库列表如果改成真实数据，会改变卡片数量和页面视觉。

处理方式：

- 一比一复原阶段使用参考 `data.ts`；
- 产品化阶段用 mapper 将真实数据限制/填充为参考卡片结构；
- 空状态必须仍保持参考卡片布局，不出现突兀的纯文字页面。

### 风险 C：真实错误提示破坏高级感

Tauri 后端错误如果直接 toast 长文本，会破坏 UI 效果。

处理方式：

- adapter 层将错误归类为短消息；
- 详细错误放到诊断报告页；
- Toast 保持参考 UI 的短句风格。

## 6. 下一阶段建议

建议下一步不要直接改 `src/reference-ui`，而是先新增：

```text
src/reference-adapter/
```

然后做一个最小后端桥接：

- 不改参考页面结构；
- 只在 `App.tsx` 外层或一个 wrapper 中读取后端；
- 先把后端状态写入控制台或隐藏状态，不改变视觉；
- 验证不会破坏 `visual_diff_count=0`；
- 再决定是否进入产品化真实状态替换。

## 7. 发布验证要求

任何接入动作完成后必须运行：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
npm run release:preflight
git diff --check
```

并重新运行第 3 节的参考 UI 复核命令。
