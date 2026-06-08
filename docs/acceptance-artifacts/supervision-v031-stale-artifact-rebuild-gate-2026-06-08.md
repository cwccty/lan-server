# 监督验收｜v0.3.1 候选包 stale 产物拦截与重新打包

时间：2026-06-08

## 问题发现

复核时发现一个发布风险：`npm build` 和 UI 门禁已经通过，但当时的 `release-artifacts/LanHelper-v0.3.1-windows-x64.zip` 与 `src-tauri/target/release/lan-helper.exe` 时间早于最新 `ProductNetworkView.tsx` 和 `verify_network_diagnostic_ui.cjs` 修改时间。

这意味着旧 gate 会出现假阳性：源码和预览页面已经修好，但候选 ZIP/EXE 可能仍是旧产物。

## 修复

- `tools/run_v0_3_1_release_gate.ps1`
  - 在 `network stuck diagnostic UI gate` 之后新增 `windows release package rebuild`。
  - 默认非 `-SkipBuild` 时会调用：
    `powershell -ExecutionPolicy Bypass -File tools/prepare_windows_x64_zip.ps1 -Version 0.3.1 -Rebuild`
  - 该步骤会重新执行 `npm run tauri:build`，生成新的 release EXE，并重新打 ZIP。

## 验证命令

```powershell
npm.cmd run release:gate:v031
```

## 结果

`npm.cmd run release:gate:v031` 通过，且现在包含：

- `npm build`：PASS
- `cargo check`：PASS
- `n2n diagnostics fixtures`：PASS，8 passed
- `adapter registry validation`：PASS
- `dual machine regression evidence gate`：PASS（四个游戏仍 pending）
- `network stuck diagnostic UI gate`：PASS（源码 + 运行时 DOM/截图）
- `windows release package rebuild`：PASS
- `windows zip verification`：PASS
- `zip excludes external helper files`：PASS

最新候选产物：

- ZIP：`release-artifacts/LanHelper-v0.3.1-windows-x64.zip`
  - SHA256：`D2DE11EE1B1FA355D706DFE047CCC81F7652E58A8C2D7C8F9F6CAC4EC925E808`
- EXE：`src-tauri/target/release/lan-helper.exe`
  - SHA256：`C6459104E18ECB7A470AEB8F480D1BAEDDF05EE6624C9761FE69A08A89A70CA9`

## 结论

旧 SHA `C995.../641333...` 对应 stale 候选，不应再用于 v0.3.1 发布。后续远端 prerelease 和真实双机测试都必须使用本轮最新 ZIP SHA。

## 未解决问题

- Palworld / Minecraft Java / Stardew Valley / Cuphead 真实双机回归仍 pending。
- 远端 `v0.3.1` prerelease 仍未创建。
- 真实用户朋友机器仍需用最新包复测。
