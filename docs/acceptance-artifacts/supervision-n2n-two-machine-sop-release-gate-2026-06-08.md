# 监督验收｜两机组网卡住 SOP 与候选包

## 本轮目标

在“启动中 / 已配置未启动”诊断闭环基础上，补齐真实用户可执行的两台电脑对照排障步骤，并确认进入 Windows 候选包。

## 修改文件

- `src/product-ui/ProductNetworkView.tsx`
  - 新增两台电脑排障 SOP：
    - 两台电脑都复制完整诊断报告；
    - 对照中继地址、房间名、密钥；
    - 对照联机地址是否重复；
    - “已配置未启动”优先看程序文件、PID、最后错误；
    - “中继尚未确认”优先看中继地址和组网日志。
  - 完整诊断报告文本中同步加入“两台电脑对照步骤”。
- `src/product-ui/ProductDiagnosticsView.tsx`
  - 报告工具条说明补充：两台电脑一台未启动、一台中继未确认时，双方都复制报告和组网日志，对照关键字段。
- `docs/acceptance-artifacts/n2n-two-machine-troubleshooting-sop-2026-06-08.md`
  - 新增可转发给测试用户的 SOP 文档。

## 验证命令

```powershell
cargo test --manifest-path src-tauri\Cargo.toml n2n_diagnostics_fixture -- --nocapture
cargo check --manifest-path src-tauri\Cargo.toml
npm.cmd run build
node tools\verify_status_center_fixtures.cjs
git diff --check -- src/product-ui/ProductNetworkView.tsx src/product-ui/ProductDiagnosticsView.tsx src/product-ui/statusCenter.ts src-tauri/src/network/n2n_backend.rs src-tauri/src/core/diagnostic_logger.rs src/types/network.ts docs/acceptance-artifacts/n2n-two-machine-troubleshooting-sop-2026-06-08.md
rg -n "\?\?\?\?|宸|鏈|鍚|寰|鎴|鍔|绔|銆|妫€|�" src/product-ui/ProductNetworkView.tsx src/product-ui/ProductDiagnosticsView.tsx src/product-ui/statusCenter.ts src-tauri/src/network/n2n_backend.rs src-tauri/src/core/diagnostic_logger.rs src/types/network.ts docs/acceptance-artifacts/n2n-two-machine-troubleshooting-sop-2026-06-08.md
npm.cmd run tauri:build
npm.cmd run release:zip
npm.cmd run release:zip:verify
```

## 命令结果

- n2n 诊断 fixture：8 passed。
- `cargo check`：通过。
- `npm.cmd run build`：通过，2163 modules transformed。
- `statusCenter` fixture：6 scenarios passed。
- `git diff --check`：通过，仅 LF/CRLF warning。
- 乱码扫描：无命中。
- `npm.cmd run tauri:build`：通过。
- `npm.cmd run release:zip`：通过。
- `npm.cmd run release:zip:verify`：通过，payload_files=21。
- release EXE smoke：启动 8 秒后仍存活。
- ZIP 外部 helper 扫描：`external_helper_matches=0`。

## 浏览器验收

页面：`加入与组网`

DOM 结果：

- `hasTwoMachineSop=true`
- `hasBothCopyReports=true`
- `hasCompareAddress=true`
- `hasConfiguredNotStartedAdvice=true`
- `hasRelayNotConfirmedAdvice=true`
- `hasCopyReport=true`
- `hasCopyManual=true`
- `hasCopyLogs=true`
- `hasOldWait=false`
- `hasPlainStarting=false`

证据：

- `docs/acceptance-artifacts/n2n-two-machine-sop-network-dom-2026-06-08.json`
- `docs/acceptance-artifacts/n2n-two-machine-sop-network-page-2026-06-08.png`
- `docs/acceptance-artifacts/release-exe-n2n-two-machine-sop-smoke-2026-06-08.json`

## 产物

- EXE：`src-tauri/target/release/lan-helper.exe`
  - SHA256：`6413331E226C160806ADE31B92E10378D4080CACA5AF09CEF93F55031F640C3F`
- ZIP：`release-artifacts/LanHelper-v0.3.1-windows-x64.zip`
  - SHA256：`C995673A13514CAD543DAE6B1290660CD08BB3AEBA15C94F20027D02ED79D695`

## 未解决问题

- 本轮解决的是“用户卡住时如何判断和收集证据”的闭环，不等于真实双机已联通。
- Palworld / Minecraft / Stardew / Cuphead 真实双机回归仍未完成。
- 未完成真实双机回归前，不能宣称 v1.0 可交付。
