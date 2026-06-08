# 监督验收｜v0.3.1 组网卡住 UI 防回退门禁（源码 + 运行时）

时间：2026-06-08

## 本轮目标

开发线程将 `tools/verify_network_diagnostic_ui.cjs` 调整为源码契约检查后，我重新补强为“源码契约 + 真实 Vite 运行时 DOM/截图”双重门禁，避免只看源码而漏掉页面路由、懒加载、渲染条件或文案实际不可见的问题。

## 修改文件

- `tools/verify_network_diagnostic_ui.cjs`
  - 保留源码契约检查：状态中心、组网页、诊断页、后端诊断字段、v0.3.1 gate 接入。
  - 新增/恢复运行时检查：自动确保 Vite preview 可访问，使用 Chrome/Edge CDP 打开页面，点击“加入与组网”和“诊断报告”，读取 DOM 并截图。
  - 同时输出：
    - `docs/acceptance-artifacts/network-diagnostic-ui-gate-2026-06-08.json`
    - `docs/acceptance-artifacts/network-diagnostic-closure-dom-2026-06-08.json`
    - `docs/acceptance-artifacts/network-diagnostic-closure-actions-2026-06-08.png`
    - `docs/acceptance-artifacts/diagnostics-n2n-copy-actions-2026-06-08.png`
- `docs/acceptance-artifacts/v031-release-candidate-gate-2026-06-08.json`
  - 更新为最新 v0.3.1 gate 输出。

## 验证命令

```powershell
npm.cmd run build
npm.cmd run network:diagnostic:verify
npm.cmd run release:gate:v031
```

## 命令结果

- `npm.cmd run build`：通过，`2163 modules transformed`。
- `npm.cmd run network:diagnostic:verify`：通过，`mode=source-and-runtime-ui-contract`，所有 23 项检查通过。
- `npm.cmd run release:gate:v031`：通过。
  - `npm build`：PASS。
  - `cargo check`：PASS。
  - `n2n diagnostics fixtures`：PASS，8 passed。
  - `adapter registry validation`：PASS。
  - `dual machine regression evidence gate`：PASS，但四个游戏仍 pending。
  - `network stuck diagnostic UI gate`：PASS，且现在包含运行时 DOM/截图检查。
  - `windows zip verification`：PASS。
  - ZIP SHA256：`D2DE11EE1B1FA355D706DFE047CCC81F7652E58A8C2D7C8F9F6CAC4EC925E808`。
  - EXE SHA256：`C6459104E18ECB7A470AEB8F480D1BAEDDF05EE6624C9761FE69A08A89A70CA9`。

## 运行时实际验证点

- 能进入“加入与组网”。
- 能进入“诊断报告”。
- 组网页显示：
  - `data-network-user-diagnostic-actions="visible"`
  - `data-network-stuck-two-machine-sop="visible"`
  - 复制完整诊断报告、复制手动启动命令、复制组网日志。
  - 两台电脑都复制完整诊断报告、联机地址不同、已配置未启动、中继尚未确认。
  - 组网程序文件、记录 PID、ACK/PONG、日志路径。
  - 注册修复无效后的管理员权限提示。
- 诊断页显示：
  - `data-diagnostic-n2n-copy-actions="visible"`
  - 复制报告、复制手动命令、复制组网日志。
- 两页均不出现：
  - “复制 edge 日志”
  - “等待 10 到 20 秒后刷新状态”
  - 纯状态标签“启动中”

## 未解决问题

- UI 闭环已进入 v0.3.1 gate，但这不能替代真实用户机器复测。
- Palworld / Minecraft Java / Stardew Valley / Cuphead 真实双机回归仍是 pending。
- 远端 `v0.3.1` prerelease 仍未创建。
- 旧总 `release_preflight.ps1` 仍有历史失败项，不能宣称旧总 preflight 全通过。

## 下一步

1. 开发线程若继续修改组网页、诊断页、状态中心或 release gate，必须重新跑 `npm.cmd run release:gate:v031`。
2. 真实用户复测时，两台电脑都导出完整诊断报告、手动启动命令、组网日志；按“本机未启动”和“中继未确认”分流。
3. 发布前继续保留该运行时门禁，不允许退回纯源码检查。
