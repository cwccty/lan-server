# 监督验收｜组网卡住修复进入 v0.3.1 候选包

## 本轮目标

把真实用户反馈的“启动组网一直卡启动中 / 已配置未启动”修复，从源码与浏览器预览推进到 Windows release 候选包，并补齐诊断页普通用户复制入口验收。

## 本轮补充修复

- `src/product-ui/ProductDiagnosticsView.tsx`
  - 诊断报告工具条继续保留“复制报告 / 复制手动命令 / 复制日志”入口。
  - 将普通用户可见的“复制 edge 日志”改为“复制组网日志”。
  - 将复制日志相关 toast 改为“组网日志”，减少普通用户界面的底层术语。

## 验证命令

```powershell
cargo test --manifest-path src-tauri\Cargo.toml n2n_diagnostics_fixture -- --nocapture
cargo check --manifest-path src-tauri\Cargo.toml
npm.cmd run build
node tools\verify_status_center_fixtures.cjs
git diff --check -- src-tauri/src/models/network.rs src-tauri/src/network/n2n_backend.rs src-tauri/src/core/diagnostic_logger.rs src/product-ui/statusCenter.ts src/product-ui/ProductNetworkView.tsx src/product-ui/ProductDiagnosticsView.tsx src/product-ui/errorActions.ts src/types/network.ts
rg -n "\?\?\?\?|宸|鏈|鍚|寰|鎴|鍔|绔|銆|妫€|�" src-tauri/src/core/diagnostic_logger.rs src-tauri/src/network/n2n_backend.rs src/product-ui/statusCenter.ts src/product-ui/ProductNetworkView.tsx src/product-ui/ProductDiagnosticsView.tsx src/product-ui/errorActions.ts src/types/network.ts
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
- release EXE smoke：启动 `src-tauri/target/release/lan-helper.exe`，8 秒后仍存活。
- ZIP 外部 helper 扫描：`external_helper_matches=0`，未打包 `connecttool-qt.exe`、Steam DLL、WinTUN 或 `steam_appid.txt`。

## 产物

- EXE：`src-tauri/target/release/lan-helper.exe`
  - SHA256：`25DF9DCA2223BE9F6559659389CC29A5E322E1B4C0F79FED63EDA0C2D90DC58C`
- ZIP：`release-artifacts/LanHelper-v0.3.1-windows-x64.zip`
  - SHA256：`5B9FB5636D9B3F82C7B92BAC3AA432B02C6E40788C696BA841807B6FEB5582E9`

## 浏览器验收

### 加入与组网

- `hasDiagnosticActions=true`
- `hasStuckAdvice=true`
- `hasCopyReport=true`
- `hasCopyManual=true`
- `hasCopyLogs=true`
- `hasOldWait=false`
- `hasOldPlainStarting=false`
- `hasOldAckPongStatusRefresh=false`

证据：

- `docs/acceptance-artifacts/n2n-network-diagnostic-actions-dom-2026-06-08.json`
- `docs/acceptance-artifacts/n2n-network-diagnostic-actions-2026-06-08.png`

### 诊断报告

- `hasToolbarActions=true`
- `hasCopyReport=true`
- `hasCopyManual=true`
- `hasCopyNetworkLogs=true`
- `hasCopyEdgeLogs=false`
- `hasOldWait=false`
- `hasPlainStarting=false`

证据：

- `docs/acceptance-artifacts/diagnostics-n2n-copy-actions-network-log-dom-2026-06-08.json`
- `docs/acceptance-artifacts/diagnostics-n2n-copy-actions-network-log-2026-06-08.png`
- `docs/acceptance-artifacts/release-exe-n2n-stuck-fix-smoke-2026-06-08.json`

## 仍未完成

- 这证明“启动中 / 已配置未启动”的诊断闭环和普通用户证据收集入口已进入候选包。
- 还不能证明真实双机联机已成功。
- Palworld / Minecraft / Stardew / Cuphead 双机回归仍未完成，不能宣称 1.0 可交付。
