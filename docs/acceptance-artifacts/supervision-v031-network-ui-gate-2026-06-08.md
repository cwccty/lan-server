# 监督验收｜v0.3.1 组网卡住 UI 防回退门禁

时间：2026-06-08

## 本轮目标

把真实用户反馈的“启动组网一直卡启动中 / 已配置未启动 / 注册修复无效”闭环从人工复核推进为发布门禁，防止后续 UI 或文案回退。

## 修改文件

- `package.json`
  - 新增 `network:diagnostic:verify`，执行 `node tools/verify_network_diagnostic_ui.cjs`。
- `tools/verify_network_diagnostic_ui.cjs`
  - 若 `127.0.0.1:4175` 没有 Vite preview，脚本会自动启动 `npm run preview -- --host 127.0.0.1 --port 4175`。
  - 使用 Chrome/Edge CDP 打开生产预览页面并截图。
  - 验证“加入与组网”和“诊断报告”两处是否保留普通用户可执行闭环。
- `tools/run_v0_3_1_release_gate.ps1`
  - v0.3.1 candidate gate 已包含 `network stuck diagnostic UI gate`。
- `docs/acceptance-artifacts/network-diagnostic-closure-dom-2026-06-08.json`
  - 本轮 DOM 验证输出。
- `docs/acceptance-artifacts/network-diagnostic-closure-actions-2026-06-08.png`
  - 组网页截图证据。
- `docs/acceptance-artifacts/diagnostics-n2n-copy-actions-2026-06-08.png`
  - 诊断页截图证据。
- `docs/acceptance-artifacts/v031-release-candidate-gate-2026-06-08.json`
  - v0.3.1 gate 最新输出。

## 验证命令

```powershell
npm.cmd run build
npm.cmd run network:diagnostic:verify
npm.cmd run release:gate:v031
```

## 命令结果

- `npm.cmd run build`：通过，`2163 modules transformed`。
- `npm.cmd run network:diagnostic:verify`：通过。
  - 组网页：存在 `data-network-user-diagnostic-actions="visible"`。
  - 组网页：存在 `data-network-stuck-two-machine-sop="visible"`。
  - 组网页：包含“复制完整诊断报告 / 复制手动启动命令 / 复制组网日志”。
  - 组网页：包含“两台电脑都复制完整诊断报告 / 联机地址不同 / 已配置未启动 / 中继尚未确认”。
  - 组网页：包含“组网程序文件 / 记录 PID / ACK/PONG / 日志路径”。
  - 组网页：保留“注册修复”之后的管理员权限等后续排查提示。
  - 诊断页：存在 `data-diagnostic-n2n-copy-actions="visible"`。
  - 诊断页：包含“复制报告 / 复制手动命令 / 复制组网日志”。
  - 两页均不再出现“复制 edge 日志”“等待 10 到 20 秒后刷新状态”和纯状态标签“启动中”。
- `npm.cmd run release:gate:v031`：通过。
  - `npm build`：PASS。
  - `cargo check`：PASS。
  - `n2n diagnostics fixtures`：PASS，8 passed。
  - `adapter registry validation`：PASS。
  - `dual machine regression evidence gate`：PASS，但四个游戏仍为 pending。
  - `network stuck diagnostic UI gate`：PASS。
  - `windows zip verification`：PASS。
  - ZIP SHA256：`C995673A13514CAD543DAE6B1290660CD08BB3AEBA15C94F20027D02ED79D695`。
  - EXE SHA256：`6413331E226C160806ADE31B92E10378D4080CACA5AF09CEF93F55031F640C3F`。

## 对用户问题的结论

这两台机器不是同一个故障：

- “启动中”应按“组网服务已启动，但中继尚未确认”处理，优先核对中继地址、房间名、密钥、联机地址和 UDP/中继可达性。
- “已配置未启动”应按“本机组网进程没有跑起来”处理，优先检查组网程序文件、记录 PID、最后错误、虚拟网卡/TAP/Wintun、权限和手动启动命令。
- “注册修复”无效时，产品现在必须引导用户继续复制完整报告、复制手动命令、复制组网日志，而不是让用户停在修复按钮上。

## 未解决问题

- 本轮证明 UI 闭环和 v0.3.1 防回退门禁已补齐，不代表真实用户两台电脑已经恢复。
- Palworld / Minecraft Java / Stardew Valley / Cuphead 真实双机回归仍为 pending。
- 远端 `v0.3.1` prerelease 仍未创建。
- 旧总 `release_preflight.ps1` 仍有历史失败项，不能宣称旧总 preflight 全通过。

## 下一步

1. 让真实用户分别导出两边完整诊断报告、手动命令和组网日志，用新 SOP 对照。
2. 若仍失败，按状态分流：
   - 已配置未启动：本机权限/程序文件/驱动/进程秒退。
   - 中继尚未确认：中继地址/端口/UDP/房间名/密钥/联机地址冲突。
3. 发布 v0.3.1 前继续跑 `npm.cmd run release:gate:v031`。
4. 真实双机游戏回归完成后回填 `dual-machine-regression-evidence-v031-2026-06-08.json`。
