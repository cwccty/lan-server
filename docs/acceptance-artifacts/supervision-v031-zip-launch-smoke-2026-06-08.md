# 监督验收｜v0.3.1 ZIP 解压启动烟测

时间：2026-06-08

## 本轮目标

在“源码 + 运行时 UI 门禁”和“重新打包”之外，补齐普通用户下载后的最低烟测：从 ZIP 解压后的目录启动 EXE，确认不是只在开发目录可运行。

## 修改文件

- `tools/verify_windows_zip_launch_smoke.ps1`
  - 解压 `release-artifacts/LanHelper-v0.3.1-windows-x64.zip` 到 `docs/acceptance-artifacts/v031-zip-launch-smoke/extracted`。
  - 从解压后的目录启动 `LanHelper-v0.3.1-windows-x64.exe`。
  - 等待 10 秒，若进程仍存活则判定最低启动烟测通过，然后停止进程。
  - 输出 `docs/acceptance-artifacts/windows-zip-launch-smoke-v031-2026-06-08.json`。
- `tools/run_v0_3_1_release_gate.ps1`
  - 新增 `windows zip launch smoke` 步骤。

## 验证命令

```powershell
powershell -ExecutionPolicy Bypass -File tools\verify_windows_zip_launch_smoke.ps1 -Version 0.3.1 -TimeoutSeconds 8
npm.cmd run release:gate:v031
```

## 命令结果

- 独立 ZIP 启动烟测：通过。
- `npm.cmd run release:gate:v031`：通过，新增步骤 `windows zip launch smoke` 为 PASS。
- 最新候选产物：
  - ZIP SHA256：`D2DE11EE1B1FA355D706DFE047CCC81F7652E58A8C2D7C8F9F6CAC4EC925E808`
  - EXE SHA256：`C6459104E18ECB7A470AEB8F480D1BAEDDF05EE6624C9761FE69A08A89A70CA9`
- 烟测结果：
  - `started=true`
  - `still_running_after_timeout=true`
  - `passed=true`

## 证据路径

- `docs/acceptance-artifacts/windows-zip-launch-smoke-v031-2026-06-08.json`
- `docs/acceptance-artifacts/v031-release-candidate-gate-2026-06-08.json`

## 结论

现在 v0.3.1 gate 不仅会构建、检查 UI、重新打包和校验 ZIP，还会验证“用户解压 ZIP 后 EXE 能启动并保持运行”。这比只检查 `src-tauri/target/release/lan-helper.exe` 更接近真实分发场景。

## 未解决问题

- 该烟测只证明 EXE 能启动，不证明真实组网已经成功。
- 真实用户朋友机器仍需用最新 ZIP 复测。
- Palworld / Minecraft Java / Stardew Valley / Cuphead 真实双机回归仍 pending。
- 远端 `v0.3.1` prerelease 仍未创建。
