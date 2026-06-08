# 监督验收｜v0.3.1 ZIP 内置复测说明

时间：2026-06-08

## 本轮目标

上一轮生成了外部复测说明，但如果用户只收到 ZIP，说明文件可能没有一起发出去。本轮把真实用户复测说明写入 ZIP 内部，让朋友解压后即可看到 `FRIEND_RETEST_GUIDE.txt`。

## 修改文件

- `tools/prepare_windows_x64_zip.ps1`
  - 将包内 `README_使用说明.txt` 改为中文普通用户说明。
  - 新增包内 `FRIEND_RETEST_GUIDE.txt`。
  - 说明内容覆盖：不要在压缩包里直接运行、两机参数要求、20 秒后复制报告/手动命令/组网日志、已配置未启动 vs 中继尚未确认分流。
- `release-artifacts/LanHelper-v0.3.1-windows-x64/FRIEND_RETEST_GUIDE.txt`
  - 由打包脚本生成。
- `release-artifacts/LanHelper-v0.3.1-windows-x64/README_使用说明.txt`
  - 由打包脚本生成。

## 验证命令

```powershell
npm.cmd run release:gate:v031
```

以及 ZIP 内容核对：

```powershell
# 检查 ZIP 内是否包含 FRIEND_RETEST_GUIDE.txt、README_使用说明.txt、SHA256SUMS.txt
# 检查解压目录中的 FRIEND_RETEST_GUIDE.txt 前 20 行
```

## 命令结果

- `npm.cmd run release:gate:v031`：通过。
  - `npm build`：PASS。
  - `cargo check`：PASS。
  - `n2n diagnostics fixtures`：PASS，8 passed。
  - `adapter registry validation`：PASS。
  - `dual machine regression evidence gate`：PASS，四个游戏仍 pending。
  - `network stuck diagnostic UI gate`：PASS，源码 + 运行时 DOM/截图。
  - `windows release package rebuild`：PASS。
  - `windows zip verification`：PASS，`payload_files=22`。
  - `windows zip launch smoke`：PASS。
  - `zip excludes external helper files`：PASS。
- ZIP 内容核对：通过，包含：
  - `LanHelper-v0.3.1-windows-x64/FRIEND_RETEST_GUIDE.txt`
  - `LanHelper-v0.3.1-windows-x64/README_使用说明.txt`
  - `LanHelper-v0.3.1-windows-x64/SHA256SUMS.txt`

## 最新候选产物

- ZIP SHA256：`D2DE11EE1B1FA355D706DFE047CCC81F7652E58A8C2D7C8F9F6CAC4EC925E808`
- EXE SHA256：`C6459104E18ECB7A470AEB8F480D1BAEDDF05EE6624C9761FE69A08A89A70CA9`

## 结论

现在用户只要拿到 ZIP，解压后就能看到普通用户说明和复测回传模板，不再依赖额外发送外部说明文件。

## 未解决问题

- 真实用户朋友机器仍需用最新 ZIP 复测并回传证据。
- Palworld / Minecraft Java / Stardew Valley / Cuphead 真实双机回归仍 pending。
- 远端 `v0.3.1` prerelease 仍未创建。
