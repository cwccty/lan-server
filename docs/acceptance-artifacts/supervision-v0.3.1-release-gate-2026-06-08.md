# v0.3.1 监督验收记录（2026-06-08）

## 本轮目标
- 复核 UI/分类/一键开服/Steam Relay-P2P 路线改动后的最新工作树。
- 在最新工作树上重新生成 Windows release 候选。
- 检查产物是否误包含外部 ConnectTool helper、Steam DLL、WinTUN 或 steam_appid.txt。
- 检查源码/文档是否残留发布凭据形态、本机下载目录路径、私有默认 ConnectTool 目录常量。

## 验收命令与结果

```powershell
npm.cmd run build
# PASS: vite build ok, 2163 modules transformed

cargo check --manifest-path src-tauri\Cargo.toml
# PASS: Finished dev profile

npm.cmd run tauri:build
# PASS: built release exe at src-tauri\target\release\lan-helper.exe
# PASS: build script sensitive local path scan ok

npm.cmd run release:zip
# PASS: release-artifacts\LanHelper-v0.3.1-windows-x64.zip ready

npm.cmd run release:zip:verify
# PASS: payload_files=21
# zip_sha256=c17082a54be2c79b1b85be03bf3091e22e7dbd9019c6769eac923a44dd7e4f08
```

## 产物信息

- EXE: `src-tauri\target\release\lan-helper.exe`
- EXE SHA256: `95A01D2A8654DEA6862F83DF97943C1AAFA7C72CD438ACCDE3D0FE33B59F9287`
- ZIP: `release-artifacts\LanHelper-v0.3.1-windows-x64.zip`
- ZIP SHA256: `C17082A54BE2C79B1B85BE03BF3091E22E7DBD9019C6769EAC923A44DD7E4F08`

## 启动 smoke

```powershell
Start-Process src-tauri\target\release\lan-helper.exe
Start-Sleep 8
# PASS: process alive after 8 seconds, then stopped by supervision script
```

## 安全/洁净度检查

- ZIP 条目扫描：未发现外部 ConnectTool 程序、Steam 相关 DLL、WinTUN、Steam AppID 文件或本机下载目录作为打包条目。
- 源码/文档扫描：未发现 GitHub token 形态、发布 token 环境变量写法、本机下载目录路径或私有默认 ConnectTool 目录常量。
- 说明：EXE 文本中保留若干 Steam 相关文件名用于运行时检测，这是功能检查字符串，不代表 ZIP 包含这些外部文件。

## 本轮修正

- 脱敏旧 v0.2.0 文档里的 GitHub token 变量名示例，改为泛化 `RELEASE_TOKEN`。
- 脱敏验收日志中的本机 ConnectTool 路径，改为 `<local-connecttool-dir>`。

## 未完成/风险

- Steam Relay/P2P 仍是 ConnectTool 兼容 MVP，不是原生 Steamworks。
- 真实双机 Palworld/Minecraft/Stardew/Cuphead 回归仍未完成，不能宣称完全联机通过。
- 方案库远程 registry v3 发布/远端更新仍需单独核对。
- 需要 release EXE 的最终可视截图作为补充证据。

## 追加 release EXE 可视证据

- `docs\acceptance-artifacts\release-exe-isolated-home-2026-06-08.png`
  - 操作：最小化其他窗口后启动 `src-tauri\target\release\lan-helper.exe`，等待 6 秒截图。
  - 结果：窗口可见，标题为“联机助手”，首页“开始联机”、左侧导航、房主路径、网络拓扑状态等普通用户主路径可见；进程截图时仍存活。
- `docs\acceptance-artifacts\release-exe-visible-smoke-home-2026-06-08.png`
  - 早期全屏截图：能看到 release EXE 窗口，但受其他窗口遮挡，仅作为辅助证据。
