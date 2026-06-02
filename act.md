# 联机助手开发行动记录

更新时间：2026-06-02

## 当前阶段

阶段 1：MVP 发布阻断项收敛。目标是先把“通用组网 + Terraria 首个游戏向导”做成真实可验证的发布级闭环，而不是只修界面显示。

## 当前产品定位

联机助手不是“每个游戏都单独配置一套 n2n”的工具，而是：

```text
通用组网中心（n2n / Radmin / Manual LAN）
  → 建立一个像局域网一样的虚拟网络
  → 支持 LAN/IP 的游戏直接连接房主虚拟 IP
  → 游戏向导只负责游戏特有的开服、端口、世界、邀请文本和诊断
```

核心原则：

- n2n、Radmin、Manual LAN 是通用组网层，不属于 Terraria 专属配置。
- Terraria 向导只是第一个游戏辅助层，用于验证“开服 + 组网 + 邀请 + 自检”的完整体验。
- 世界上支持 LAN/IP 的游戏很多，不能为每个游戏重复做一套 n2n；后续游戏适配只在能明显降低配置成本时才做。
- UI 状态必须来自真实进程、真实端口、真实虚拟网卡、真实 supernode 注册和真实连通性。
- 不能通过隐藏错误、改颜色、改文案来掩盖内部状态混乱。

## 已规划的联机方式

| 方式 | 定位 | 当前进度 | MVP 状态 |
|---|---|---|---|
| n2n / EasyN2N | 长期核心内置组网方案；客户端管理 edge，VPS 运行 supernode | 已支持 edge 检测、保存配置、启动/停止、static 虚拟 IP、TAP IP 检测；官方源码 Windows edge 已编译；VPS supernode 已跑通 | 接近可用，仍需朋友侧实测、异常诊断和发布检查全通过 |
| Radmin VPN | 外部工具辅助检测与引导 | 已能检测安装和虚拟 IP；不自动创建/加入网络 | 辅助可用，不作为内置核心 |
| Manual LAN / 手动 IP | 兜底模式，适用于同一局域网、已有 VPN、ZeroTier、Tailscale 等 | 已有手动 IP/端口 TCP 测试 | 基础可用，后续需要更友好的解释 |
| ZeroTier / Tailscale | 规划中的外部组网方案 | 目前仅作为 Manual LAN 场景被用户手动使用 | 不进入当前 MVP 内置管理 |
| 官方/自建 supernode 服务 | 未来降低门槛 | 当前使用用户 VPS；已有部署文档 | 不进入当前 MVP 默认承诺 |
| 自动下载/安装 n2n | 未来降低门槛 | 已记录要求：固定版本、白名单 URL、SHA256、用户确认 | 不进入当前 MVP |

## 当前开发进度粗估

- 项目骨架 / Tauri 桌面端：70%
- 游戏扫描 / Steam 路径识别：60%
- 通用组网中心：45%
- n2n 内置组网：65%
- Radmin 辅助检测：35%
- Manual LAN 兜底测试：45%
- Terraria 一键开服向导：55%
- 发布级诊断 / 状态统一：35%
- 打包发布体验：35%

## 当前已验证基线

```text
VPS supernode：154.64.231.137:7777
房主虚拟 IP：10.10.10.2
Terraria 端口：7777
Test-NetConnection 10.10.10.2 -Port 7777 => True
InterfaceAlias：cfw-tap
SourceAddress：10.10.10.2
```

这说明房主侧 n2n + TAP + Terraria 端口已经能打通。但发布级完成还需要：朋友侧使用不同虚拟 IP 加入，并确认服务端 30 秒以上稳定运行。

## 当前发布阻断项

1. Terraria 服务端曾出现 `Listening on port 7777` 后几秒退出，UI 变灰。
2. 该问题不能只改显示，必须记录真实退出码、退出时间、是否曾经 ready、运行时长和最后日志。
3. 诊断报告必须输出结构化 `release_checks`，明确 MVP 必需项是否通过。
4. 只有所有必需项通过，并完成朋友侧真实加入测试，才允许说 MVP 完成。

## 最近完成

- `server_session` 已改为通过真实进程状态和运行时长判断服务端状态。
- `ServerSessionStatus` 已包含 `started_at`、`uptime_seconds`、`exit_code`、`exited_at`、`ever_ready`。
- 联机向导已显示服务端运行时长，并加入 30 秒稳定性门禁。
- 诊断报告已升级为结构化发布检查：n2n edge、n2n 虚拟 IP、n2n 运行状态、Terraria 30 秒稳定性、服务端退出诊断、隐私边界。
- 本轮修复了 `src-tauri/src/core/diagnostic_logger.rs` 的中文乱码，避免发布报告出现不可读内容。

## 下一步

1. 构建新版 release 客户端。
2. 用户用新版客户端执行：启动 n2n → 启动 Terraria 服务端 → 等待 30 秒 → 生成诊断报告。
3. 若 `Terraria 服务端 30 秒稳定性` 未通过，继续根据 exit code、exited_at、ever_ready、日志定位根因。
4. 完成朋友侧真实加入测试：朋友使用不同虚拟 IP，例如 `10.10.10.3`，加入房主 `10.10.10.2:7777`。
5. 通过后再进入 MVP 收尾：通用组网中心 UI 梳理、邀请文本优化、错误提示和打包说明。

## 开发约束

- 关键决策必须写入项目文件，不能只存在聊天记录。
- 修改 API、数据结构、目录、文件命名或产品结构时，必须同步更新文档。
- 不提交 n2n 二进制；`tools/n2n/*.exe` 继续由 `.gitignore` 排除。
- 不把无关格式化改动混进提交。
- 第一版不做 Steam API 模拟、Hook、注入、破解、绕过反作弊。

## 2026-06-02 发布阻断项继续推进：Terraria 后台启动方式修正

本轮继续处理“监听端口后几秒变灰 / 服务端可能启动后退出”的发布阻断项。当前判断：仅用 `CREATE_NO_WINDOW` 启动 TerrariaServer 风险较高，因为 TerrariaServer 是控制台程序，部分版本会访问 Console API；如果进程没有有效控制台，可能触发控制台句柄无效并退出。

已调整：

- Windows 下内嵌 Terraria 服务端改为 `CreateProcessW + CREATE_NEW_CONSOLE + STARTF_USESHOWWINDOW/SW_HIDE`。
- 目的：给 TerrariaServer 一个有效控制台环境，同时隐藏外部白色命令框。
- 状态判断继续以真实进程状态、`127.0.0.1:端口` 探测、运行时长、退出码、退出时间、是否曾经监听端口为准。
- 当前 Windows 隐藏控制台模式已重定向 stdin/stdout/stderr，因此内嵌控制台和命令按钮应对应真实服务端进程。
- 修复 `server_session.rs` 中遗留中文乱码，避免用户看到不可读错误信息。

这一步不是纯 UI 修改，而是改变服务端创建方式，目标是降低“后台隐藏后服务端立即退出”的真实风险。

## 2026-06-02 发布阻断项补强：隐藏控制台 + 标准输入输出重定向

上一轮隐藏控制台方案解决了“需要有效控制台”的问题，但如果不重定向标准输入输出，`help/save/exit` 等按钮无法证明发送到了真实服务端。为满足发布清单，本轮继续补强：

- Windows 下 `CreateProcessW` 启动 TerrariaServer 时创建匿名管道。
- 将 stdin/stdout/stderr 传给子进程，同时继续使用隐藏的新控制台。
- 内嵌控制台现在应能显示服务端 stdout/stderr。
- `help` / `save` / `exit` 会写入真实服务端 stdin，不再只是界面按钮。
- 状态仍以真实进程句柄、端口探测、退出码、退出时间、运行时长和是否曾经监听端口为准。

这一步进一步把“服务端托管”从表面控制台面板推进为可验证的真实进程控制闭环。

- 诊断报告新增 `server_io_bridge` 必需检查，用于证明内嵌控制台和 help/save/exit 不是 UI 伪装，而是已连接真实服务端 stdin/stdout/stderr。

## 2026-06-02 n2n 后端发布级清理

继续收敛 MVP 发布质量：n2n 后端用户可见文案已恢复为正常中文，并统一配置/ PID 文件定位逻辑。

已完成：

- `n2n_backend` 的检测、保存、启动、停止错误信息不再出现乱码。
- `last_config.json` 与 `n2n.pid` 会优先写入实际发现的 `tools/n2n` 目录，避免 release exe 工作目录变化导致配置和 edge.exe 分离。
- 诊断报告中用于判断 `n2n_running` 的“正在运行 / PID”证据现在来自可读中文 notes。

这项改动直接服务于发布清单 A 和 E：n2n 状态必须可读、可解释、可复制到诊断报告。

## 2026-06-02 通用组网中心 UI 收敛

继续推进 MVP 收尾：通用组网中心不再把 n2n 操作结果只显示成 JSON，而是显示面向发布验证的状态面板：

- 是否检测到 edge.exe / n2n.exe。
- 当前虚拟 IP。
- 后端 notes，包括 PID、supernode、配置路径等。
- 保存配置结果。
- 启动/停止运行态结果。
- 可一键复制通用组网配置给朋友。

这使发布清单 A 中“显示 n2n edge 检测路径、PID、虚拟 IP、最近 supernode”的验证更接近普通用户可理解的产品体验。

## 2026-06-02 诊断报告升级为发布前一键汇总

诊断报告现在不只列出检查项，还会输出：

- `release_ready`：MVP 必需项是否全部通过。
- `required_passed` / `required_total`：必需项通过数量。
- `next_actions`：未通过项的下一步处理建议。

诊断页会直接显示下一步处理列表，避免用户只看到红叉但不知道该做什么。该结果仍来自真实后端状态，不是手工勾选。

## 2026-06-02 发布阻断项修正：避免健康检查副作用

本轮根据用户实测日志确认：`Saving world data` 和 `127.0.0.1:<random> is connecting...` 是联机助手的端口健康检查主动 TCP 连接造成的副作用。已将 Windows 下服务端 ready 判断改为读取 TCP LISTEN 表，不再连接 TerrariaServer 本身。

另外，隐藏后台模式下 `help/save/exit` 交互输入未达到发布级可靠性。MVP 不再把这些按钮作为功能暴露，诊断报告也不再把 `server_io_bridge` 作为“命令按钮可用”的必需项；改为检查内嵌服务端日志可观察、真实监听状态、退出诊断和 30 秒稳定性。
