# 联机助手 v0.1 发布准备清单

更新时间：2026-06-05 11:11:33 +08:00

本文件用于发布前最后收口：明确 v0.1 能发什么、不能承诺什么、需要上传哪些文件，以及真实 EXE 人工验证如何记录。

> 当前定位：v0.1 是 MVP 测试版，不是“所有游戏一键联机”的最终版。发布文案必须诚实说明仍需真实双机和更多游戏样本验证。

## 1. 版本与产物

| 项目 | 当前值 |
| --- | --- |
| npm 版本 | `0.1.0` |
| Tauri 版本 | `0.1.0` |
| Release EXE | `src-tauri\target\release\lan-helper.exe` |
| 发布预检命令 | `npm run release:preflight` |
| 完整打包命令 | `npm run tauri:build` |
| 共享库入口 | `adapter-registry/index.json` |

发布前必须确认：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run release:preflight
```

如要重新生成安装/发布产物：

```powershell
npm run tauri:build
```

## 2. v0.1 已具备的核心能力

### 2.1 房主侧

- 扫描/选择游戏。
- 自动套用 adapter 推荐路线。
- 启动 n2n 组网。
- 启动服务端/游戏。
- 检测本机游戏端口。
- 分配好友虚拟 IP。
- 生成并复制邀请包。
- 失败时写入房主失败上下文，并进入诊断或高级工具。

### 2.2 加入者侧

- 粘贴房主邀请包。
- 检测邀请包格式。
- 仅填入参数。
- 保存并启动 n2n。
- 显示 joined / pending / failed。
- 失败分类并复制给房主。
- 成功后提示在游戏内连接房主虚拟 IP 与端口。

### 2.3 适配器与共享库

- 本地 adapter 库。
- 远程共享库同步。
- GitHub Pages / VPS / 本地示例库入口。
- 版本、来源、适用条件和证据字段。
- 用户贡献包。
- 管理员审核与提交包。
- 当前示例共享库包含：
  - `terraria`
  - `minecraft_java`
  - `stardew_valley`
  - `cuphead`
  - `palworld`

### 2.4 多联机方式

已接入或预留：

- n2n；
- TCP 端口代理；
- UDP 单播代理；
- UDP 广播桥；
- Steam Remote Play；
- Sunshine + Moonlight；
- Steam Relay / Steam P2P 插件入口；
- WireGuard / ZeroTier / Tailscale 引导。

注意：v0.1 的主线仍是 n2n；外部组网和 Steam/串流方案以引导和预留为主。

### 2.5 非 LAN 游戏转换判断

v0.1 必须坚持以下边界：

- 原生 LAN / IP 直连：推荐 n2n。
- 专用服务端：推荐 n2n + 服务端端口检测。
- LAN 大厅依赖广播：推荐 n2n + UDP 广播桥。
- 只能本地同屏：推荐 Steam Remote Play / Sunshine + Moonlight。
- Steam P2P / Steam 大厅：保留 Steam 原方案或插件入口。
- 官方服务器限定：不强行转换，只给限制说明。

《茶杯头》这类本地同屏游戏不能宣传成“已转换成 LAN 游戏”，只能宣传为“可推荐远程同屏联机路线”。

## 3. 发布前真实 EXE 人工验证

进入 release EXE 后，打开“诊断报告”，点击：

```text
复制真实 EXE 验证清单
```

把复制内容粘贴到 `docs/RELEASE_VALIDATION_LOG.md`，并按实际结果标记：

- PASS：真实执行并通过；
- FAIL：真实执行失败，必须记录错误、日志或截图；
- PENDING：尚未执行，不能写成通过。

最小验证顺序：

```text
启动 EXE
→ 检查是否有白色命令框/透明残留窗口
→ 打开首页
→ 打开游戏扫描
→ 打开推荐方案
→ 打开通用组网中心
→ 打开 Terraria 向导
→ 打开诊断报告
→ 复制真实 EXE 验证清单
```

重点验证：

- 二次进入页面是否不卡顿；
- 缓存是否不会掩盖真实失败；
- 手动刷新是否能拿到最新状态；
- n2n 状态、服务端状态、诊断状态是否一致；
- 失败是否能进入诊断修复中心。

可先运行一次启动烟测，确认真实 EXE 能创建窗口/WebView，且启动期没有额外白色命令框类子进程：

```powershell
powershell -ExecutionPolicy Bypass -File tools\real_exe_smoke_test.ps1 -AppendLog
```

注意：这个烟测只检查 EXE 启动干净程度，不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。

## 4. 发布文案必须说明的已知限制

v0.1 不能承诺：

- 所有游戏都能一键变成局域网游戏；
- 本地同屏游戏能真正变成 LAN；
- 绕过正版验证、反作弊、官方账号系统或平台限制；
- Steam Relay / Steamworks 插件已经完成；
- UDP 广播桥适配所有房间列表发现游戏；
- 单机测试等于真实双机测试；
- 未审核 adapter 一定正确。

v0.1 应建议用户反馈：

- 游戏名称和版本；
- 游戏是否支持 LAN / IP 直连 / 服务端 / 本地同屏 / Steam 大厅；
- 房主和加入者虚拟 IP；
- n2n 是否出现 ACK/PONG；
- 游戏端口是否可达；
- 诊断报告或真实 EXE 验证清单。

## 5. GitHub Release 上传前检查

发布前请确认：

- [ ] `npm run build` 通过。
- [ ] `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- [ ] `npm run release:preflight` 通过。
- [ ] 如需新产物，`npm run tauri:build` 通过。
- [ ] `src-tauri\target\release\lan-helper.exe` 存在。
- [ ] `docs/RELEASE_VALIDATION_LOG.md` 已追加本轮真实 EXE 验证结果。
- [ ] `docs/GITHUB_RELEASE_DRAFT.md` 与当前版本一致。
- [ ] `docs/RELEASE_NOTES_DRAFT.md` 与当前版本一致。
- [ ] 不把 PENDING 项写成 PASS。
- [ ] 不宣传“所有游戏一键联机”。

## 6. 用户快速说明

### 房主

1. 同步共享方案库。
2. 扫描并选择游戏。
3. 在推荐方案页按步骤启动组网和服务端/游戏。
4. 分配好友虚拟 IP。
5. 复制邀请包给好友。
6. 如果失败，打开诊断报告并复制报告。

### 好友

1. 打开联机助手。
2. 进入通用组网中心或首页。
3. 粘贴房主邀请包。
4. 点击“仅填入参数”或“保存并启动 n2n”。
5. 等待 ACK/PONG。
6. 在游戏内连接房主虚拟 IP 和端口。

## 7. 下一步

发布前最后一轮建议：

```text
真实 EXE 手动跑一遍
→ 把结果写入 RELEASE_VALIDATION_LOG
→ 重新 tauri:build
→ 核对 GitHub Release 文案
→ 上传 v0.1 测试版
```


## 2026-06-05 12:36:51 - 本地发布包生成步骤

v0.1 上传 GitHub Release 前，现在可以使用统一脚本整理本地发布包：

~~~powershell
npm run release:package
~~~

生成目录：

~~~text
release-artifacts\v0.1.0\
~~~

目录内包含：

- `lan-helper-v0.1.0.exe`
- `SHA256SUMS.txt`
- `release-manifest.json`
- `RELEASE_BODY.md`
- `RELEASE_NOTES.md`
- `V0_1_USER_FEEDBACK_TEMPLATE.md`
- `adapter-registry` 示例索引与游戏条目。

注意：发布包只是上传材料整理，不替代真实双机、真实加入者、Terraria 或更多 adapter 人工验证。

## 2026-06-05 12:44:17 - 适配器共享库校验器 v1

为避免远程共享库或本地示例库出现坏 JSON、SHA 不一致、缺字段、错误转换路线，本轮新增 adapter registry 校验器：

~~~powershell
npm run adapter:validate
~~~

校验范围：

- `adapter-registry/index.json` 是否可解析。
- index 中每个 `game_id` / `adapter_url` / `sha256` 是否存在且唯一。
- `sha256` 是否与实际 `adapter-registry/games/*.json` 文件一致。
- adapter 是否包含 `display_name`、`capabilities`、`network_type`、`multiplayer_conversion`、`connection_plan`。
- 默认端口是否在 1-65535。
- `connection_plan` 是否包含房主/加入者说明、邀请模板、排错说明和关键布尔字段。
- 本地同屏路线不得设置 `can_convert_to_lan=true`。
- 本地同屏路线不得要求虚拟局域网或推荐 `virtual_lan`。
- 本地同屏路线必须推荐 `steam_remote_play` 或 `sunshine_moonlight`。
- 本地同屏路线不得暴露 LAN 加入端口。

这一步对应长期目标中的“游戏适配器与共享方案库增强”和“非局域网游戏转换方案引擎”。

## 2026-06-05 13:34:55 - 发布包完整性校验步骤

生成 `release-artifacts\v0.1.0\` 后，请继续执行：

~~~powershell
npm run release:package:verify
~~~

该命令会校验：

- `lan-helper-v0.1.0.exe` 是否存在且大小合理。
- `SHA256SUMS.txt` 是否覆盖所有发布文件。
- 每个文件的 SHA256 是否与实际文件一致。
- `release-manifest.json` 的 tag、版本、文件大小、哈希是否一致。
- `RELEASE_BODY.md` 是否保留 MVP / PENDING / 远程同屏边界。
- `REAL_EXE_MANUAL_VALIDATION_GUIDE.md` 是否包含 PASS / FAIL / PENDING、n2n、Terraria、Cuphead 等验证点。
- 发布包内 `adapter-registry/index.json` 是否可解析且包含当前示例游戏。

注意：发布包完整性校验只证明本地上传材料没有明显缺失或哈希错误，不替代真实双机、真实加入者、Terraria 或更多 adapter 人工验证。

## 2026-06-05 13:43:39 - v0.1 自动发布门禁

发布前可以执行一条自动门禁命令：

~~~powershell
npm run release:gate
~~~

它会串起：

- `npm run build`
- `cargo check --manifest-path src-tauri\Cargo.toml`
- `npm run adapter:validate`
- `npm run tauri:build`
- 真实 EXE 启动烟测
- `npm run release:package -- -Clean -AppendLog`
- `npm run release:package:verify -- -AppendLog`
- `npm run release:preflight`

门禁通过后会把自动化摘要追加到 `docs\RELEASE_VALIDATION_LOG.md`。注意：它仍不替代真实双机、真实加入者、Terraria 双机 Join via IP 或更多 adapter 人工验证。
