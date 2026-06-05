# 联机助手 v0.1 GitHub Release 上传清单

更新时间：2026-06-05 11:40:00 +08:00

本清单用于把 v0.1 从“本地可打包”推进到“可以公开给少量用户测试”。它不是功能完成证明，而是发布动作前的最后检查。

## 1. Release 基本信息

| 项目 | 建议值 |
| --- | --- |
| Release tag | `v0.1.0` |
| Release title | `联机助手 v0.1.0 MVP 测试版` |
| 主程序 | `src-tauri\target\release\lan-helper.exe` |
| 本地发布包 | `release-artifacts\v0.1.0\` |
| 发布包生成命令 | `npm run release:package` |
| 发布包校验命令 | `npm run release:package:verify` |
| 自动发布门禁 | `npm run release:gate` |
| 发布说明来源 | `docs/GITHUB_RELEASE_DRAFT.md` |
| 详细说明来源 | `docs/RELEASE_NOTES_DRAFT.md` |
| 发布准备来源 | `docs/V0_1_RELEASE_READINESS.md` |
| 人工验证指南 | `docs/REAL_EXE_MANUAL_VALIDATION_GUIDE.md` |
| 验证日志来源 | `docs/RELEASE_VALIDATION_LOG.md` |
| 用户反馈模板 | `docs/V0_1_USER_FEEDBACK_TEMPLATE.md` |

## 2. 上传前必须完成的自动化检查

在仓库根目录执行：

~~~powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
powershell -ExecutionPolicy Bypass -File tools\real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog
npm run release:preflight
npm run release:package
npm run release:package:verify
~~~

如果希望用一条命令串起自动检查、打包、烟测和发布包校验，可执行：

~~~powershell
npm run release:gate
~~~

上传前要求：

- [ ] `npm run build` 通过。
- [ ] `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- [ ] `npm run tauri:build` 通过。
- [ ] `src-tauri\target\release\lan-helper.exe` 存在。
- [ ] `tools\real_exe_smoke_test.ps1` 显示 `status: PASS`。
- [ ] `npm run release:preflight` 通过。
- [ ] `npm run release:package` 生成 `release-artifacts\v0.1.0\`。
- [ ] `release-artifacts\v0.1.0\SHA256SUMS.txt` 存在。
- [ ] `release-artifacts\v0.1.0\release-manifest.json` 存在。
- [ ] `release-artifacts\v0.1.0\REAL_EXE_MANUAL_VALIDATION_GUIDE.md` 存在。
- [ ] `npm run release:package:verify` 通过，确认 SHA256、manifest、发布正文、人工验证指南和 adapter registry 一致。
- [ ] 可选但推荐：`npm run release:gate` 通过，并把自动门禁摘要追加到 `docs\RELEASE_VALIDATION_LOG.md`。
- [ ] `real exe startup smoke script is wired` 为 PASS。
- [ ] `game launch console hiding is wired` 为 PASS。
- [ ] `v0.1 release readiness docs are wired` 为 PASS。

## 3. 上传前必须确认的人工验证边界

以下项目如果没有真实执行，必须在 Release 文案中继续写为 PENDING / 建议补测，不能写成 PASS：

- [ ] 真实双机 n2n 互通。
- [ ] 真实加入者电脑连接房主虚拟 IP 与游戏端口。
- [ ] Terraria 双机 Join via IP。
- [ ] Minecraft Java adapter 真实流程审核。
- [ ] Stardew Valley adapter 真实流程审核。
- [ ] 不同 NAT / 不同运营商环境下的稳定性。

如果只完成单机验证，应写成：

~~~text
已完成单机房主侧链路与真实 EXE 启动烟测；真实双机加入仍建议补测。
~~~

不要写成：

~~~text
所有玩家都可以直接联机。
所有支持局域网的游戏都已验证。
所有不能本地联机的游戏都能转换。
~~~

## 4. GitHub Release 页面填写顺序

1. 打开 GitHub 仓库：`https://github.com/cwccty/lan-server`。
2. 进入 Releases。
3. 选择 Draft a new release。
4. Tag 填写：`v0.1.0`。
5. Title 填写：`联机助手 v0.1.0 MVP 测试版`。
6. Release body 优先复制 `docs/GITHUB_RELEASE_DRAFT.md`。
7. 在正文末尾追加：
   - 真实 EXE 启动烟测结果；
   - 仍需补测项目；
   - 用户反馈模板链接或内容。
8. 优先从 `release-artifacts\v0.1.0\` 上传 `lan-helper-v0.1.0.exe`。
9. 同时上传或保留 `SHA256SUMS.txt` 供用户校验。
10. 如需要给测试者详细步骤，附上 `REAL_EXE_MANUAL_VALIDATION_GUIDE.md`。
11. 发布前再次确认没有“所有游戏一键联机”式过度承诺。

## 5. 发布正文必须保留的边界说明

Release 正文必须包含以下意思：

- v0.1 是 MVP 测试版。
- 主线能力是 n2n、Terraria 房主侧、TCP/UDP/广播桥、高级工具、适配器共享库和诊断报告。
- 不是所有游戏都能一键联机。
- 本地同屏游戏不能真正变成 LAN，应推荐 Steam Remote Play / Sunshine + Moonlight。
- Steam P2P / 官方服务器限定游戏不能硬转 LAN。
- 单机测试不等于真实双机测试。
- 未审核 adapter 不保证正确。
- 失败时请复制诊断报告或用户反馈模板。

## 6. 用户反馈入口

推荐在 Release 正文末尾加入：

~~~text
如果你参与测试，请尽量按 docs/V0_1_USER_FEEDBACK_TEMPLATE.md 提供信息：游戏名、版本、房主/加入者虚拟 IP、supernode、n2n ACK/PONG、游戏端口、诊断报告和截图。
~~~

## 7. 发布后第一轮观察重点

发布后优先观察：

- 用户是否知道房主和好友分别该点哪里。
- 邀请包是否能减少配置错误。
- 失败时诊断页是否能给出可执行下一步。
- 哪些游戏最需要新增 adapter。
- 哪些场景应走 n2n，哪些应走远程同屏或 Steam 原方案。

## 8. 结论

当前 v0.1 可以作为小范围 MVP 测试版发布；发布前必须保留 PENDING 边界，发布后应把反馈沉淀为 adapter、诊断分类和推荐方案，而不是只临时修 UI 文案。
