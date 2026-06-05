# Reference UI 与 Product Mode 手动验证流程

创建日期：2026-06-04

本文用于验证当前阶段的两个目标：

1. 默认界面仍然完全按照 `<reference-ui-src-parent>` 一比一复原；
2. 开启 product mode 后，真实后端 runtime 状态可以通过 adapter patcher 注入 Header、首页和诊断页。

## 1. 前置命令验证

在仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File tools\check_reference_ui_fidelity.ps1
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
npm run release:preflight
git diff --check
```

期望结果：

```text
Reference UI fidelity check: PASS
visual_diff_count=0
```

并且所有构建、打包、发布预检通过。

## 2. 启动 release 版

使用 release exe，不要用普通浏览器预览验证真实后端：

```powershell
.\src-tauri\target\release\lan-helper.exe
```

如果 exe 不存在，先运行：

```powershell
npm run tauri:build
```

## 3. 验证默认 Reference Mode

默认情况下，product mode 应该关闭。此时界面必须保持参考前端一比一。

### 3.1 首页应保持参考文案

打开首页，确认能看到：

- Header 右侧状态：`就绪: 24ms`
- Header 按钮：`断开物理网`
- 首页标题：`桌面大厅`
- 就绪进度：`75%`
- 拓扑状态：`虚拟服主在线`
- Supernode 小标：`24ms`
- Supernode 地址：`n2n.edge.me:7777`
- 检查单文案：
  - `系统驱动检测完毕，正常启动。`
  - `穿透环境评级为 [A级优质]`
  - `已自动分配最近北京联通服务器节点`

如果这些文字默认已经被替换成“真实状态”，说明 product mode 泄漏到了默认界面，需要修复。

### 3.2 诊断页应保持参考文案

进入诊断页，确认能看到：

- `14.85 Mbps`
- `24.5 ms`
- `1.22 ms`
- `0.00 %`
- `1400 bytes`
- `运行客户端: n2n-edge v3.0 stable`
- `挂载超级节点: lianji-telecom-cn2`
- `检测代码: N2N_D_CODE_301XT`

如果默认状态下这些内容被替换，则说明一比一参考界面被破坏。

## 4. 打开隐藏调试面板

按快捷键：

```text
Ctrl + Shift + D
```

应出现 `Reference Runtime Debug` 隐藏面板。

面板中应能看到：

- `mode: reference` 或 `mode: product`
- runtime 摘要：
  - network
  - running
  - ready
  - virtual_ip
  - supernode
  - terraria
  - games
  - adapters
  - release_ready
- 安全动作：
  - 刷新快照
  - 生成诊断报告
  - 读取 Terraria 会话
  - 停止 n2n
  - 停止 Terraria 服务端

## 5. 验证 Product Mode

在隐藏调试面板中点击：

```text
开启产品化接入实验
```

此时 mode 应变为：

```text
mode: product
```

### 5.1 Header 状态替换

回到首页或保持当前页面，Header 顶部状态应从参考假状态替换为以下之一：

- `真实状态: 读取中`
- `真实状态: n2n 已连接`
- `真实状态: n2n 运行中`
- `真实状态: 需诊断`
- `真实状态: 未组网`

如果 product mode 开启后 Header 仍是 `就绪: 24ms`，说明 `ReferenceProductHeaderPatcher` 未生效。

### 5.2 首页状态替换

在首页确认以下内容被替换：

- `虚拟服主在线` -> `真实状态：虚拟组网已连接` / `真实状态：n2n 运行中` / `真实状态：等待组网`
- `24ms` -> `ACK` / `RUN` / `待测`
- `n2n.edge.me:7777` -> 真实 supernode 或 `未配置 supernode`
- 检查单说明替换为真实 runtime 摘要

如果替换后布局明显错位、溢出或遮挡，需要记录截图并调整 patch 文案长度或策略。

### 5.3 诊断页状态替换

进入诊断页，确认右侧 N2N 监测卡和 JSON 区域被替换：

- `14.85 Mbps` -> `ACK/PONG OK` / `RUNNING` / `STOPPED`
- `24.5 ms` -> ACK 状态
- `1.22 ms` -> PONG 状态
- `0.00 %` -> 真实虚拟 IP 或 `--`
- `1400 bytes` -> `configured` / `missing`
- `运行客户端: ...` -> 真实运行状态
- `挂载超级节点: ...` -> 真实 supernode
- JSON `<pre>` -> runtime debug JSON
- `检测代码: N2N_D_CODE_301XT` -> `检测来源: reference runtime snapshot`

## 6. 关闭 Product Mode

在隐藏调试面板中点击：

```text
关闭产品化接入，保持参考 UI
```

然后确认：

- Header 恢复 `就绪: 24ms`
- 首页恢复参考文案；
- 诊断页恢复参考文案；
- 再次运行 `tools\check_reference_ui_fidelity.ps1` 仍然是 `visual_diff_count=0`。

注意：关闭 product mode 后，patcher 只恢复它标记过的 DOM 文本。如果页面没有恢复，先切换页面再返回验证。

## 7. 失败记录模板

如果发现问题，记录：

```text
验证日期：
exe 路径：
当前 mode：reference / product
页面：首页 / 诊断页 / 其他
问题描述：
期望：
实际：
是否能复现：
截图路径：
相关 runtime 摘要：
```

## 8. 当前边界

当前产品化接入仍是原型：

- 默认发布界面仍以 reference mode 为准；
- product mode 仅用于验证真实后端状态注入；
- 不建议继续扩大 DOM patch 范围，除非用户确认 product mode 体验可接受；
- 后续若要正式产品化，应考虑用 wrapper/component adapter 替代更多 DOM patch。
