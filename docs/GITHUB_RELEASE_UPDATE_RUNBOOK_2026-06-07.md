# GitHub Release 最新 ZIP 资产更新手册（2026-06-07）

## 当前状态

本地最新 Windows x64 ZIP 已生成并通过校验：

- 文件：`release-artifacts/LanHelper-v0.1.0-windows-x64.zip`
- 本地 SHA256：`b4643eaad3ec80e245592f988b771817165de7da1d1bbcdee9516ee612fe62fb`

远程 GitHub Release `v0.1.0` 当前资产仍是旧包：

- Release：`https://github.com/cwccty/lan-server/releases/tag/v0.1.0`
- 资产：`LanHelper-v0.1.0-windows-x64.zip`
- 远程 digest：`sha256:91617585501427da6bb2502e18ad28e0bc1038270c04db00364e7a4b04331a75`
- 结论：远程 Release 资产尚未同步到本轮最新包。

## 需要的外部资源

需要一个具备 `cwccty/lan-server` 仓库 Release 更新权限的 GitHub token：

- 环境变量名：`GITHUB_TOKEN` 或 `GH_TOKEN`
- 权限：至少可读取 release、删除旧 asset、上传新 asset、更新 release body。

## 更新步骤

在 PowerShell 中执行：

```powershell
cd E:\Documents\联机助手
$env:GITHUB_TOKEN = '<具备 repo release 权限的 token>'
npm run release:github:update
```

脚本预期行为：

1. 读取 `docs/GITHUB_RELEASE_DRAFT.md` 更新 release body；
2. 删除旧的 `LanHelper-v0.1.0-windows-x64.zip` asset；
3. 上传本地 `release-artifacts/LanHelper-v0.1.0-windows-x64.zip`；
4. 校验远程 asset digest 是否等于本地 zip SHA256。

## 更新后复验

执行：

```powershell
cd E:\Documents\联机助手
npm run release:github:update -- --DryRun
```

或用 GitHub API 检查：

```powershell
$release = Invoke-RestMethod -Method GET `
  -Uri 'https://api.github.com/repos/cwccty/lan-server/releases/tags/v0.1.0' `
  -Headers @{ 'User-Agent'='lan-helper-release-check'; 'Accept'='application/vnd.github+json' }
$asset = $release.assets | Where-Object { $_.name -eq 'LanHelper-v0.1.0-windows-x64.zip' } | Select-Object -First 1
$asset.digest
```

通过标准：

```text
sha256:b4643eaad3ec80e245592f988b771817165de7da1d1bbcdee9516ee612fe62fb
```

## 失败处理

- `Missing GitHub token`：未设置 `GITHUB_TOKEN` / `GH_TOKEN`。
- `404` 或 `Resource not accessible`：token 没有目标仓库 release 权限。
- `Remote digest mismatch`：上传后远程资产与本地 zip 不一致，应重新执行脚本并保留日志。

## 证据归档

更新成功后把日志保存到：

`docs/acceptance-artifacts/2026-06-07/distribution/release-github-update-success.log`

并更新：

- `docs/DISTRIBUTION_DELIVERY_2026-06-07.md`
- `docs/FINAL_DELIVERY.md`
