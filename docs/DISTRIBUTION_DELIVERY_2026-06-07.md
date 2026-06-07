# 联机助手交付/打包分发记录（2026-06-07）

## 结论

本轮已完成交付/打包分发阶段的本机可验证项：Vite chunk 拆分、release 构建、Windows x64 zip 打包与校验、release exe 启动、远程 registry v3 发布与 hash 校验。

GitHub Release 资产上传尚未完成：本地分发 zip 已生成并校验，但 `v0.1.0` Release 上的 `LanHelper-v0.1.0-windows-x64.zip` 仍是旧 digest。实际更新需要 `GITHUB_TOKEN` 或 `GH_TOKEN`，当前环境未提供该 token。

源码分发提交也尚未推送成功：本地已创建交付/分发提交（当前本地 HEAD，以 `git rev-parse --short HEAD` 为准），记录 Vite chunk 拆分、ZIP 清理脚本和交付/回归文档；但 `git push origin master` 两次因无法连接 `github.com:443` 失败，当前本地仍显示 `master...origin/master [ahead 1]`。

真实双机 Palworld / Minecraft / Stardew / Cuphead 游戏内回归尚未执行；原因是当前环境缺少第二台 Windows 机器、对应游戏账号/客户端和远端好友环境。已补充可执行回归清单：`docs/REAL_DUAL_MACHINE_REGRESSION_2026-06-07.md`。

## 本轮修改

- `vite.config.ts`
  - 增加 Rollup `manualChunks`：拆分 React、Tauri API、lucide icons、motion、产品页视图、产品逻辑和 reference adapter。
  - 构建后最大 JS chunk 从约 `1,182.36 KB` 降到约 `208.96 KB`，Vite chunk size warning 消失。
- `tools/prepare_windows_x64_zip.ps1`
  - 打包前自动清理旧的 release 输出目录和 zip，避免上一次运行残留的 `edge.log` / `last_config.json` 泄漏进分发包。
  - 增加输出目录边界检查，只清理 `release-artifacts` 下的目标包目录。
- `adapter-registry/index.json` 与 `adapter-registry/games/*.json`
  - 已最小提交并推送到 `origin/master`，远程 raw registry 已为 `version: 3`。
- `docs/REAL_DUAL_MACHINE_REGRESSION_2026-06-07.md`
  - 新增真实双机回归清单，明确 Palworld / Minecraft Java / Stardew Valley / Cuphead 的房主步骤、好友步骤、通过标准和受限项。

## 关键验证命令

```powershell
npm run build
npm run adapter:validate
cd src-tauri
cargo check
cargo test
cd ..
npm run tauri:build
npm run release:zip
npm run release:zip:verify
```

## 验证结果

- `npm run build`：通过。
  - 拆分前：单个 `index-*.js` 约 `1,182.36 KB`，有 chunk warning。
  - 拆分后：最大 `product-logic-*.js` 约 `208.96 KB`，无 chunk warning。
- `npm run adapter:validate`：通过，5 个 adapters，0 warning，0 error。
- `cargo check`：通过。
- `cargo test`：通过，7 passed。
- `npm run tauri:build`：通过，生成 `src-tauri/target/release/lan-helper.exe`。
- release exe 启动：通过，窗口标题为“联机助手”，进程响应正常。
- `npm run release:zip`：通过，生成 `release-artifacts/LanHelper-v0.1.0-windows-x64.zip`。
- `npm run release:zip:verify`：通过，payload_files=21。
- 分发包内 exe 启动：通过，窗口标题为“联机助手”。
- release UI CDP 9 页冒烟：通过，9 个主要页面均可点击、文本非空、无明显问号乱码。
- 远程 registry v3：通过，raw URL HTTP 200，`version: 3`，5 个游戏 JSON sha256 全部匹配 index。
- GitHub Release 资产更新：未完成。`npm run release:github:update -- --DryRun` 通过并确认会替换旧资产；实际 `npm run release:github:update` 因缺少 `GITHUB_TOKEN` / `GH_TOKEN` 失败。
- 源码提交推送：未完成。本地交付/分发提交存在，但远程 `origin/master` 尚未包含该提交；证据见 `git-push-distribution-commit-status.json`。

## 产物

- release exe：`src-tauri/target/release/lan-helper.exe`
  - size: `13,382,656`
  - sha256: `830461d6656152dd1ef8db53ed35f2270a5ebda68cb1dc4df30d817125c4d4f0`
- Windows x64 zip：`release-artifacts/LanHelper-v0.1.0-windows-x64.zip`
  - size: `5,145,378`
  - sha256: `b4643eaad3ec80e245592f988b771817165de7da1d1bbcdee9516ee612fe62fb`
- 分发包目录：`release-artifacts/LanHelper-v0.1.0-windows-x64/`
- 远程 registry commit：`86bf597 chore: publish adapter registry v3`
- 远程 registry raw：`https://raw.githubusercontent.com/cwccty/lan-server/master/adapter-registry/index.json`
- 本地交付/分发源码提交：当前本地 HEAD（`chore: document distribution delivery status`）
  - 状态：尚未推送到远程，`git push` 网络连接失败。
- GitHub Release 页面：`https://github.com/cwccty/lan-server/releases/tag/v0.1.0`
  - 当前远程资产 digest：`sha256:91617585501427da6bb2502e18ad28e0bc1038270c04db00364e7a4b04331a75`
  - 本地最新 zip digest：`sha256:b4643eaad3ec80e245592f988b771817165de7da1d1bbcdee9516ee612fe62fb`
  - 结论：远程 Release 资产未同步到本轮最新包。

## 证据目录

全部本轮日志/截图/JSON 证据保存在：

`docs/acceptance-artifacts/2026-06-07/distribution/`

关键文件：

- `npm-build-before-chunk.log`
- `dist-assets-before-chunk.json`
- `npm-build-after-chunk-v2.log`
- `dist-assets-after-chunk-v2.json`
- `adapter-validate.log`
- `cargo-check.log`
- `cargo-test.log`
- `tauri-build.log`
- `release-zip-after-clean-fix.log`
- `release-zip-verify.log`
- `release-artifacts-summary.json`
- `release-exe-start.json`
- `packaged-exe-start.json`
- `ui-cdp-after-chunk-pages/summary.json`
- `remote-registry-before.json`
- `git-commit-registry-v3.log`
- `git-push-registry-v3.log`
- `remote-registry-after-publish.json`
- `remote-registry-v3-hash-verify.json`
- `game-regression-local-adapter-precheck.json`
- `release-github-update-dryrun.log`
- `release-github-update-attempt.log`
- `github-release-asset-current.json`
- `remote-registry-recheck-escalated.json`
- `github-release-asset-current-escalated.json`
- `git-push-distribution-commit-status.json`

## 运行方式

普通用户分发包运行：

1. 解压 `release-artifacts/LanHelper-v0.1.0-windows-x64.zip` 到普通目录。
2. 运行 `LanHelper-v0.1.0-windows-x64.exe`。
3. 首次进入设置页确认组网程序、默认中继和方案库地址。
4. 先“方案库”同步，再“游戏扫描”选择游戏，最后按“开房邀请 / 加入与组网”操作。

开发/验收运行：

```powershell
cd E:\Documents\联机助手
npm install
npm run build
npm run adapter:validate
cd src-tauri
cargo check
cargo test
cd ..
npm run tauri:build
.\src-tauri\target\release\lan-helper.exe
```

## 风险与剩余事项

- 真实双机游戏内回归未完成，不能宣称 Palworld / Minecraft / Stardew / Cuphead 已实机通过；需要第二台机器和对应游戏账号/客户端后按 `docs/REAL_DUAL_MACHINE_REGRESSION_2026-06-07.md` 执行。
- GitHub Release 资产未更新到最新 zip；需要提供具备 repo release 权限的 `GITHUB_TOKEN` 或 `GH_TOKEN` 后运行 `npm run release:github:update`，再复验远程 asset digest 等于本地 zip digest。
- 本地交付/分发源码提交未推送到远程；需要网络恢复后运行 `git push origin master`，再确认 `origin/master` 包含该提交。
- 当前工作树仍有大量历史未提交改动；本轮远程发布只最小提交了 `adapter-registry` v3，未把所有 UI/Rust/文档改动整体纳入远程源码交付。
- release 构建前必须关闭正在运行的 `lan-helper.exe`，否则 Windows 会锁定目标 exe 导致构建失败。
- `tools/n2n/edge.exe` 仍属于外部二进制，分发时应保留 hash 校验和来源说明；杀软误报需要用户自行确认信任来源。

## GitHub Release 资产更新手册

当具备 release 权限的 token 到位后，按 `docs/GITHUB_RELEASE_UPDATE_RUNBOOK_2026-06-07.md` 替换 GitHub Release 上的旧 ZIP 资产并复验 digest。


