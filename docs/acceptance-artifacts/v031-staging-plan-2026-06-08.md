# v0.3.1 发布前提交/分发一致性计划

生成时间：2026-06-08 23:10 +08:00

## 目标

把当前可通过 `npm.cmd run release:gate:v031` 的候选包，绑定到一个可复现的 Git commit，再创建远端 `v0.3.1` prerelease。禁止直接 `git add .`，避免把临时截图、缓存、预览 profile、打包产物或本机状态提交进 tag。

当前候选产物：

- ZIP：`release-artifacts/LanHelper-v0.3.1-windows-x64.zip`
- ZIP SHA256：`EE65491E725538DD482CCE96CD33F2A834A311A702DA6CB0691F2C5BDA9E2C96`
- EXE SHA256：`75295FDB62187E75AB4A659647530F4F4A5F4824261ACAE49AC207C226645329`
- 远端 `v0.3.1`：尚不存在，证据见 `docs/acceptance-artifacts/gh-release-v0.3.1-current-2026-06-08.json`。

## 必须提交的源码/脚本类别

这些文件影响应用行为、构建、诊断、打包或验收，应该纳入 v0.3.1 候选 commit：

1. 前端源码：
   - `src/api/`
   - `src/components/`
   - `src/pages/`
   - `src/product-ui/`
   - `src/reference-adapter/`
   - `src/reference-ui/`
   - `src/types/`

2. Tauri/Rust 源码与配置：
   - `src-tauri/Cargo.toml`
   - `src-tauri/Cargo.lock`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/src/`

3. Node/Rust 构建入口：
   - `package.json`
   - `package-lock.json`

4. release gate / 验证脚本：
   - `tools/run_v0_3_1_release_gate.ps1`
   - `tools/verify_network_diagnostic_ui.cjs`
   - `tools/verify_dual_machine_regression_evidence.cjs`
   - `tools/verify_windows_zip_launch_smoke.ps1`
   - `tools/verify_windows_x64_zip.ps1`
   - `tools/prepare_windows_x64_zip.ps1`
   - `tools/triage_friend_retest_evidence.cjs`
   - `tools/verify_status_center_fixtures.cjs`
   - 以及本轮确实被源码引用或 gate 调用的其他 `tools/*.ps1|*.cjs`。

5. v0.3.1 文档与关键证据：
   - `docs/V0_3_1_RELEASE_DRAFT.md`
   - `docs/V0_3_1_RELEASE_CHECKLIST.md`
   - `docs/acceptance-artifacts/v031-release-candidate-gate-2026-06-08.json`
   - `docs/acceptance-artifacts/network-diagnostic-ui-gate-2026-06-08.json`
   - `docs/acceptance-artifacts/windows-zip-launch-smoke-v031-2026-06-08.json`
   - `docs/acceptance-artifacts/dual-machine-regression-evidence-v031-2026-06-08.json`
   - `docs/acceptance-artifacts/dual-machine-regression-evidence-verification-2026-06-08.json`
   - `docs/acceptance-artifacts/friend-retest-template-v031-2026-06-08.md`
   - `docs/acceptance-artifacts/friend-retest-template-v031-2026-06-08.json`
   - `docs/acceptance-artifacts/friend-retest-triage-rules-v031-2026-06-08.md`
   - `docs/acceptance-artifacts/gh-release-v0.3.1-current-2026-06-08.json`
   - 与本轮组网卡住修复直接相关的 `supervision-*.md`、`n2n-*.md` 文字证据。

## 默认不要提交的内容

这些是临时产物、本机状态、截图或打包输出，不应进入源码 tag：

- `release-artifacts/`：被 `.gitignore` 忽略，ZIP 应作为 GitHub Release asset 上传，不进 commit。
- `.lan-helper/`
- `backups/`
- `src-tauri/target-ui-preview/`
- `docs/acceptance-artifacts/*profile*/`
- `docs/acceptance-artifacts/*preview*/` 目录或 `.pid/.log` 预览进程文件。
- 根目录临时截图：`*.png`，例如 `advanced-tools-*.png`、`steam-connecttool-*.png`、`v0.2.0-b1-home.png`。
- 大量 UI 截图证据 `docs/acceptance-artifacts/*.png`：除非本次发布说明明确引用，否则不要默认提交。
- 本机 host/key/cache/临时环境文件。

## 推荐执行顺序

1. 先确认没有运行中的预览服务或打包进程会继续写文件。
2. 按类别精准 stage，不要 `git add .`。
3. stage 后运行：

```powershell
git diff --cached --check
npm.cmd run release:gate:v031
```

4. 如果 gate 重新打包导致 SHA 变化：
   - 更新 `docs/V0_3_1_RELEASE_DRAFT.md`；
   - 更新 `docs/V0_3_1_RELEASE_CHECKLIST.md`；
   - 更新 `docs/acceptance-artifacts/dual-machine-regression-evidence-v031-2026-06-08.json`；
   - 更新朋友复测材料；
   - 再运行一次轻量 SHA/乱码检查。

5. commit 后才能创建远端 prerelease：

```powershell
gh release create v0.3.1 release-artifacts/LanHelper-v0.3.1-windows-x64.zip --repo cwccty/lan-server --prerelease --title "Lan Helper v0.3.1" --notes-file docs/V0_3_1_RELEASE_DRAFT.md
```

6. 发布后必须下载远端 asset 校验 SHA：

```powershell
gh release download v0.3.1 --repo cwccty/lan-server --pattern LanHelper-v0.3.1-windows-x64.zip --dir docs/acceptance-artifacts/gh-v031-download
Get-FileHash docs/acceptance-artifacts/gh-v031-download/LanHelper-v0.3.1-windows-x64.zip -Algorithm SHA256
```

SHA 必须等于最后一次 gate 输出的 ZIP SHA。

## 当前阻塞/风险

- 当前工作树有 `77` 个 tracked 修改和 `42` 个 untracked 条目，必须先分类 stage。
- 真实朋友机器尚未回传完整诊断证据，因此不能宣称“组网问题已真实解决”。
- Palworld / Minecraft Java / Stardew Valley / Cuphead 真实双机回归仍 pending。
- 远端 `v0.3.1` prerelease 尚未创建。
