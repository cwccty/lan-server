# 联机助手最终交付说明（监督验收版）

更新时间：2026-06-07（Asia/Shanghai）

## 交付结论

当前工作树已达到本轮本机可验证的交付门槛：前端构建、Rust 检查、Tauri release 构建、Windows release 启动、默认方案库地址、方案库同步预检/同步/成功失败提示、设置页旧地址规范化、主要页面无明显问号乱码，以及本轮新增的“普通用户说明增强”和“非 Terraria 游戏联机闭环优化”均已有证据。

分发阶段补充状态：远程 registry v3 已发布并验证；Vite chunk 已拆分；Windows x64 zip 已生成并本地校验。GitHub Release 资产上传尚未完成，因为当前环境缺少具备 release 权限的 `GITHUB_TOKEN` / `GH_TOKEN`。真实双机 Palworld / Minecraft / Stardew / Cuphead 游戏内回归也尚未执行，需第二台 Windows 机器、对应游戏账号/客户端和远端好友环境。

源码同步补充状态：本地已创建交付/分发提交（当前本地 HEAD，以 `git rev-parse --short HEAD` 为准），但 `git push origin master` 因无法连接 `github.com:443` 失败，当前本地仍领先远程 1 个提交；远程仓库尚未包含这次 Vite chunk/ZIP 清理/交付文档提交。

release 可执行文件：

```text
E:\Documents\联机助手\src-tauri\target\release\lan-helper.exe
```

## 做了什么

### 1. 普通用户界面说明增强

- 在开房邀请页增加“普通玩家说明”，用房主/好友视角解释：当前游戏怎么联机、房主做什么、好友做什么、失败时先查什么。
- 将游戏端口输入与检测放入普通用户流程，不再只隐藏在高级工具或诊断语境中。
- 特殊连接工具页增加“特殊连接工具是什么”说明卡，解释：
  - 端口代理：游戏已开房但好友连不上端口时使用；
  - UDP 广播桥：游戏靠局域网房间列表发现但好友看不到房间时使用；
  - 通用服务端：用户已经有 server.exe / bat / cmd / jar 时托管服务端进程；
  - 4 步使用法：从开房邀请进入、核对端口、启动工具、回到游戏实测。
- 清理 release UI 中 `????` / `UDP ??` 问号乱码，降低普通首页暴露 `last_config.json`、`n2n`、`supernode`、`room/secret` 等开发者术语的程度。

### 2. 非 Terraria 联机逻辑闭环优化

- Palworld：主路线改为 `dedicated_server` + UDP 8211；不再把 TCP 端口代理作为主流程；房主启动 Palworld Dedicated Server，检测本机 UDP 端口，好友在游戏内用房主联机地址和端口加入；UDP 远端结果以游戏内实测为准。
- Minecraft Java：主路线为 `lan_ip_direct`；优先 Open to LAN / 游戏显示端口，已有 server.jar 的玩家可使用 25565 或自定义端口；不强制后台专用服务端。
- Stardew Valley：主路线为 `lan_ip_direct` + 原生合作优先；如版本支持 LAN/IP 则使用房主联机地址和端口，否则保留游戏原生邀请，不强行转换。
- Cuphead：标记为 `local_coop_remote_play`；不生成局域网房间邀请，不做端口检测；推荐 Steam Remote Play Together，备用 Sunshine + Moonlight。
- 手动服务端兼容：如果用户没有用联机助手托管服务端，但本机端口检测已显示“已监听”，开房邀请页允许继续复制邀请。
- 测试稳定性：UDP 单播代理和 UDP 广播桥端到端测试均改为等待统计达到预期后再断言，避免异步转发已成功但状态读取过早导致 `cargo test` 偶发失败。

### 3. 方案库与设置

- 默认方案库地址使用 GitHub raw：`https://raw.githubusercontent.com/cwccty/lan-server/master/adapter-registry/index.json`。
- 兼容旧 GitHub Pages 地址和 GitHub blob 地址，读取/保存/同步前会规范化。
- 方案库同步流程包含同步前预检、同步执行、成功提示和失败提示。
- 设置页保存旧 GitHub Pages 地址后不会继续写回旧错误地址。
- `adapter-registry/index.json` 已升到 version 3，并重新计算各游戏 JSON 的 sha256。
- 增加默认共享库防降级：若未来默认远程版本低于随包 version 3，客户端会使用随包方案库执行预检/同步，避免用户同步后把 Minecraft、Palworld 等优化方案回退；当前远程 raw 已发布为 version 3。

## 怎么运行

直接启动 release：

```powershell
E:\Documents\联机助手\src-tauri\target\release\lan-helper.exe
```

重新构建 release：

```powershell
cd E:\Documents\联机助手
npm run build
cd src-tauri
cargo check
cd ..
npm run tauri:build
```

注意：重新打包前请先关闭正在运行的 `lan-helper.exe`，否则 Windows 会锁定 release exe，导致构建无法覆盖。

## 怎么验证

### 必跑命令

```powershell
cd E:\Documents\联机助手
npm run build
npm run adapter:validate
cd src-tauri
cargo check
cargo test
cd ..
npm run tauri:build
```

### UI / release 验收

1. 启动：`E:\Documents\联机助手\src-tauri\target\release\lan-helper.exe`。
2. 检查窗口标题为「联机助手」，进程响应。
3. 逐页检查：首页、开房邀请、加入与组网、游戏扫描、方案库、Terraria 向导、诊断报告、特殊连接工具、设置页无明显乱码、空白或崩溃。
4. 方案库页面点击“同步共享库”，应先出现同步前预检，再进入同步，并有成功提示。
5. 把方案库地址临时改为 `http://127.0.0.1:9/adapter-registry/index.json` 后同步，应显示失败提示。
6. 设置页把旧地址 `https://cwccty.github.io/lan-server/adapter-registry/index.json` 保存后，应规范化为 raw 地址。

## 当前验收结果与证据

- `npm run build`：通过，仅有 Vite chunk size warning。
- `cargo check`：通过。
- `cargo test`：首次复现 UDP 代理测试时序失败；已在 `src-tauri\src\core\udp_proxy.rs` 增加测试侧统计等待，复跑通过（7 passed）。
- `cargo test` 本轮又复现 UDP 广播桥测试状态读取时序失败；已在 `src-tauri\src\core\udp_broadcast_bridge.rs` 增加测试侧统计等待，复跑通过（7 passed）。
- `npm run tauri:build`：通过，输出 `PASS: clean Tauri release build completed.`。
- release exe 启动：通过，窗口标题为「联机助手」，进程响应。
- 源码问号乱码扫描：`rg -n "\?\?\?|UDP \?\?" src src-tauri -S` 为 0。
- 普通用户/联机闭环静态断言：通过，日志 `E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\static-ordinary-user-closure-check.log`。
- 修复后监督复跑日志：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\supervisor-rerun`。
- 修复后 release CDP 9 页冒烟：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\supervisor-rerun\release-cdp-smoke-after-udp-wait-fix.json`。
- 默认同步防降级实测：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\supervisor-rerun\release-sync-default-downgrade-guard.json`，同步后 Minecraft 仍为 `lan_ip_direct` 且不强制专用服务端，Palworld 仍不要求 TCP 端口代理。
- 最终静态断言：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\supervisor-rerun\final-static-acceptance.log`。
- 本轮重新验收日志：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\goal-rerun-2`。
- 本轮 release CDP 9 页冒烟：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\goal-rerun-2\release-cdp-9page-smoke.json`。
- 本轮错误方案库地址失败提示复验：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\goal-rerun-2\release-bad-sync-hidden-input.json`。
- 本轮设置页旧地址规范化复验：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\goal-rerun-2\release-bad-sync-via-settings-and-restore.json` 中 settings 保存后恢复为 raw 地址。
- release 启动截图：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\lan-helper-release-printwindow.png`。
- 修复后逐页 CDP 截图/文本：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\ui-cdp-after-fix-pages`。
- 设置页旧地址保存规范化：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\ui-cdp-after-fix-flows\summary.json`。
- 方案库同步成功：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\ui-cdp-after-fix-solution-sync\summary.json`。
- 方案库错误地址失败提示：`E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\ui-cdp-after-fix-solution-bad\summary.json`。
- 本地设置保存证据：`E:\Documents\联机助手\.lan-helper\settings.json`。

## 已知风险 / 非阻断项

- Vite 仍提示主 chunk 超过 500 kB，当前不阻断交付，后续可做 code splitting。
- 真实公网/跨机组网能力、真实双机加入游戏和第三方平台联机账号未做外部实机验收；本轮验收覆盖客户端启动、UI、配置、方案库、诊断入口和本地端口/流程逻辑。
- 远程 GitHub raw 默认库已发布为 version 3，并通过 hash 校验；证据见 `E:\Documents\联机助手\docs\acceptance-artifacts\2026-06-07\distribution\remote-registry-v3-hash-verify.json`。
- GitHub Release 上 `v0.1.0` 的 zip 资产仍是旧 digest；本地最新 zip 为 `sha256:b4643eaad3ec80e245592f988b771817165de7da1d1bbcdee9516ee612fe62fb`，远程资产仍为 `sha256:91617585501427da6bb2502e18ad28e0bc1038270c04db00364e7a4b04331a75`。需要 token 后运行 `npm run release:github:update`。
- 本地交付/分发源码提交尚未推送；网络恢复后需要运行 `git push origin master` 并确认远程包含该提交。
- Palworld UDP 远端端口无法像 TCP connect 一样可靠自动判定，最终仍需以游戏内加入为准；软件已改为提示游戏内实测。
- UDP 代理端到端测试曾复现统计读取时序波动，已通过测试侧等待统计达到预期后再断言修复；后续如真实运行也出现 UDP 转发统计异常，应继续排查运行时统计刷新。
- `.lan-helper\settings.json` 是本机验收状态文件，不应作为代码提交内容。
- `product_mode` 在本地 settings 文件中可能为 `false`，但 Tauri release 环境当前会强制启用真实产品界面；后续可统一设置页显示与持久化语义。


## GitHub Release 资产更新手册

当具备 release 权限的 token 到位后，按 `docs/GITHUB_RELEASE_UPDATE_RUNBOOK_2026-06-07.md` 替换 GitHub Release 上的旧 ZIP 资产并复验 digest。


