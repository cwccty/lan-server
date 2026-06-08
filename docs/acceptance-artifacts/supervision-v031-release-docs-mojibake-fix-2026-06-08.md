# 监督验收｜v0.3.1 发布文档乱码修复

## 本轮目标

复核当前交付文档，发现 `docs/V0_3_1_RELEASE_DRAFT.md` 与 `docs/V0_3_1_RELEASE_CHECKLIST.md` 存在严重 mojibake，会影响发布说明和交付沟通。本轮将两份文档重写为正确 UTF-8 简体中文，并同步最新候选包 SHA 与未完成边界。

## 修改文件

- `docs/V0_3_1_RELEASE_DRAFT.md`
- `docs/V0_3_1_RELEASE_CHECKLIST.md`
- `docs/acceptance-artifacts/gh-release-v0.3.1-current-2026-06-08.json`

## 核对结果

- 已用 `gh release view v0.3.1 --repo cwccty/lan-server` 检查远端状态。
- 截至 `2026-06-08 21:14:00 +08:00`，远端 `v0.3.1` Release 未创建。
- 发布文档已明确：
  - 当前是本地候选包；
  - ZIP SHA256：`C995673A13514CAD543DAE6B1290660CD08BB3AEBA15C94F20027D02ED79D695`；
  - EXE SHA256：`6413331E226C160806ADE31B92E10378D4080CACA5AF09CEF93F55031F640C3F`；
  - Steam Relay / P2P 是 ConnectTool 兼容模式，不是原生 Steamworks；
  - Palworld / Minecraft / Stardew / Cuphead 真实双机回归仍未完成；
  - v0.3.1 远端 prerelease 仍待创建与 asset digest 校验。

## 验证命令

```powershell
git diff --check -- docs/V0_3_1_RELEASE_DRAFT.md docs/V0_3_1_RELEASE_CHECKLIST.md docs/acceptance-artifacts/gh-release-v0.3.1-current-2026-06-08.json
rg -n "<常见 mojibake / replacement-character 模式>" docs/V0_3_1_RELEASE_DRAFT.md docs/V0_3_1_RELEASE_CHECKLIST.md docs/acceptance-artifacts/gh-release-v0.3.1-current-2026-06-08.json
```

## 验证结果

- `git diff --check`：通过。
- 乱码扫描：无命中。

## 未解决问题

- 本轮只修复发布文档和远端状态记录，不代表真实双机回归已完成。
- 仍需真实双机执行 Palworld / Minecraft / Stardew / Cuphead 回归，或发布时明确标注“待实机验证”。
