# v0.2.0 发布执行检查清单

日期：2026-06-08
状态：待执行

## 目的

本清单用于执行 `v0.2.0` GitHub Release 创建、ZIP 资产上传和发布后核对。它只规定发布步骤和证据要求，不替代真实双机回归，也不把候选版描述为最终上线版。

## 1. 发布前本地确认

在发布机器上依次执行并保存输出：

```powershell
git status -sb
git log --oneline -5 --decorate
git ls-remote --heads origin master
git ls-remote --tags origin "v0.2.0*"
npm run release:zip:verify
```

判定要求：

- `origin/master` 应指向计划发布提交。
- `refs/tags/v0.2.0^{}` 应指向同一个计划发布提交。
- `git status -sb` 不允许存在 staged 内容；如果工作树有历史遗留修改，必须确认它们不会进入本次发布。
- ZIP 校验必须输出：

```text
zip_sha256=5b9654be0a0dff5490d334c254cc39221ba7ca008b3c8ec4e796e126c5c1b18b
payload_files=21
PASS: Windows x64 ZIP verification completed.
```

## 2. GitHub Release 创建

只允许通过环境变量提供发布权限。不要把真实 token 写入文档、命令历史、终端日志、截图或提交记录。

```powershell
$env:GITHUB_TOKEN='<repo release 权限 token>'
```

也可以使用：

```powershell
$env:GH_TOKEN='<repo release 权限 token>'
```

先执行 dry run：

```powershell
powershell -ExecutionPolicy Bypass -File tools\update_github_release_v0_1.ps1 -CreateIfMissing -DryRun
```

确认 dry run 输出包含：

- release tag：`v0.2.0`
- asset：`LanHelper-v0.2.0-windows-x64.zip`
- local SHA256：`5b9654be0a0dff5490d334c254cc39221ba7ca008b3c8ec4e796e126c5c1b18b`
- 将创建或更新 GitHub Release
- 将上传 ZIP asset
- 未打印真实 token

确认无误后执行真实发布：

```powershell
powershell -ExecutionPolicy Bypass -File tools\update_github_release_v0_1.ps1 -CreateIfMissing
```

## 3. 发布后远端核对

发布后必须核对以下项目：

| 项目 | 预期 | 实际 | 结果 |
| --- | --- | --- | --- |
| Release tag | `v0.2.0` | 待填写 | 待填写 |
| Release 标记 | prerelease | 待填写 | 待填写 |
| Asset 名称 | `LanHelper-v0.2.0-windows-x64.zip` | 待填写 | 待填写 |
| Asset digest | `sha256:5b9654be0a0dff5490d334c254cc39221ba7ca008b3c8ec4e796e126c5c1b18b` | 待填写 | 待填写 |
| 下载后 SHA256 | `5b9654be0a0dff5490d334c254cc39221ba7ca008b3c8ec4e796e126c5c1b18b` | 待填写 | 待填写 |

建议远端核对命令：

```powershell
$r = Invoke-RestMethod -Uri 'https://api.github.com/repos/cwccty/lan-server/releases/tags/v0.2.0' -Headers @{ 'User-Agent'='lan-helper-release-check' }
$r.tag_name
$r.prerelease
$r.assets | Select-Object name,size,digest,browser_download_url
```

下载远端 ZIP 后重新计算：

```powershell
Invoke-WebRequest -Uri '<browser_download_url>' -OutFile .\LanHelper-v0.2.0-windows-x64.remote.zip
Get-FileHash .\LanHelper-v0.2.0-windows-x64.remote.zip -Algorithm SHA256
```

## 4. 对外口径

发布说明和对外描述必须保持以下边界：

- 版本是 `v0.2.0` 候选版。
- Steam 中继 / P2P 是合法预检 stub，不是真实 Steam P2P 联机完成。
- Palworld / Minecraft Java / Stardew Valley / Cuphead 在 Runbook 填完证据前仍是待验证。
- 不能承诺所有游戏一键开服或一键联机。
- 不能暗示会修改游戏文件、复制游戏目录 DLL、规避平台限制或改变游戏拥有权要求。

## 5. 回滚与修正

| 场景 | 处理方式 |
| --- | --- |
| Release body 文案错误 | 只更新 body，不改 tag，不重新打包 |
| Asset digest 不一致 | 删除错误 asset，重新上传正确 ZIP，并重新核对 digest |
| ZIP 需要重新打包 | 必须 bump 版本或明确记录新 SHA，不要静默覆盖同名包 |
| tag 指错提交 | 发布前可修正 tag；发布后应避免移动 tag，优先新版本修正 |
| token 出现在日志或截图 | 立即撤销该 token，清理公开材料，并重新生成 token |

## 6. 发布完成记录模板

| 项目 | 记录 |
| --- | --- |
| 执行人 | 待填写 |
| 执行时间 | 待填写 |
| 本地提交 | 待填写 |
| 远端 master | 待填写 |
| v0.2.0 tag | 待填写 |
| ZIP 本地 SHA256 | 待填写 |
| Release URL | 待填写 |
| Asset URL | 待填写 |
| 远端 digest | 待填写 |
| 下载复核 SHA256 | 待填写 |
| 结论 | 待填写 |

## 7. 后续动作

- Release 创建和资产核对完成后，再进入真实双机回归。
- 双机回归必须按 `docs/V0_2_0_DUAL_MACHINE_REGRESSION.md` 填写证据。
- 未填完证据前，对外仍使用“待验证 / 候选版 / 预检 stub”口径。
