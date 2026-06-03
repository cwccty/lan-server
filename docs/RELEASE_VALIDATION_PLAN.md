# 发布前端到端人工验证流程

更新时间：2026-06-03

本文件用于把“是否可以发布”从口头判断变成可重复执行的测试流程。原则不变：**不能只看 UI 变绿，所有通过项都必须来自真实后端状态、进程、端口、网卡、日志、自测或游戏内人工验证。**

## 1. 验证目标

本轮发布验证重点证明以下链路真实可用：

```text
同步共享库
→ 扫描/选择游戏
→ 匹配 adapter
→ 推荐方案
→ 通用组网 / TCP 代理 / UDP 代理 / UDP 广播桥 / 服务端
→ 邀请好友包
→ 诊断报告
→ 游戏内加入验证
```

首批验证游戏：

| 游戏 | 预期类型 | 重点验证 |
| --- | --- | --- |
| Terraria | 专用服务端 + IP 加入 | 服务端稳定、7777 监听、邀请包、诊断报告 |
| Minecraft Java | 专用服务端 / LAN/IP 方案 | 端口、房主步骤、加入者步骤、adapter 文案 |
| Stardew Valley | LAN / 可能依赖平台或游戏内流程 | 是否需要额外限制说明，不能误导一键转换 |

## 2. 验证环境分级

### 2.1 单机可测

一台电脑即可完成：

- 客户端启动后无白色命令框、透明残留窗口。
- 首页、通用组网中心、Terraria 向导、游戏扫描、推荐方案、适配器管理、诊断报告页面可打开。
- 同步本地示例库。
- 同步 GitHub 默认共享库。
- adapter registry 同步详情显示新增/更新/跳过/失败分类。
- TCP 端口代理一键自测。
- UDP 端口代理一键自测。
- UDP 广播桥一键自测。
- 当前游戏上下文诊断。
- Terraria 服务端本机启动、监听、30 秒稳定性。

### 2.2 VPS / supernode 可测

需要 VPS：

- supernode 监听 UDP/TCP 端口，例如 7777。
- n2n edge 能注册到 supernode。
- 日志出现 ACK/PONG/[OK]。
- 客户端诊断报告中的 supernode 状态来自 edge 日志，而不是只来自用户填写地址。

### 2.3 双机可测

需要两台电脑或虚拟机：

- 房主和加入者使用不同虚拟 IP，例如：
  - 房主：`10.10.10.2`
  - 加入者：`10.10.10.3`
- 双方 community、secret、supernode 一致。
- 加入者能访问房主虚拟 IP。
- Terraria 使用 Join via IP 成功进入房主服务端。

### 2.4 游戏内人工验证

需要真实进入游戏：

- Terraria：Join via IP 输入房主虚拟 IP 和端口后能进入。
- Minecraft Java：按 adapter 推荐方案验证加入流程。
- Stardew Valley：验证 adapter 文案是否准确；如果不能稳定转换为 LAN/IP，必须在 adapter 中明确限制，不允许误导。

## 3. 单机验证步骤

### 3.1 启动与窗口检查

1. 启动 release 客户端。
2. 观察是否出现额外白色命令框、透明窗口、残留控制台。
3. 打开任务管理器，确认没有异常重复的 `lan-helper.exe`、`edge.exe`、代理进程。

通过标准：

- 主程序只有预期窗口。
- 没有多余控制台框。
- 关闭客户端后，由联机助手启动的 edge / proxy / bridge / server 进程能清理。

### 3.2 共享库同步验证

1. 进入“适配器管理”。
2. 点击“同步本地示例库（无需 HTTP）”。
3. 检查同步详情：
   - 总数；
   - 新增；
   - 更新；
   - 跳过；
   - 失败分类；
   - 每个 adapter 的 hash 和保存路径。
4. 点击“恢复 GitHub 默认地址”。
5. 点击“一键更新共享适配器”。

通过标准：

- 同步结果不是一句泛泛成功/失败，而是有结构化明细。
- Hash 失败、解析失败、读取失败时不会覆盖本地可用 adapter。
- 本地 custom adapter 优先级高于 registry adapter。

### 3.3 adapter 生成工具验证

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File tools\update_adapter_registry_index.ps1
```

再执行：

```powershell
Get-Content adapter-registry\index.json -Raw -Encoding UTF8 | ConvertFrom-Json
```

通过标准：

- `index.json` 可解析。
- `games` 数量与 `adapter-registry/games/*.json` 一致。
- 每个 entry 包含 `game_id`、`adapter_url`、`sha256`。

### 3.4 代理与广播桥自测

在“通用组网中心”依次执行：

- TCP 端口代理一键自测；
- UDP 端口代理一键自测；
- UDP 广播桥一键自测。

通过标准：

- TCP 自测发送 `hello proxy` 并收到回包。
- UDP 单播代理自测发送 `hello udp proxy` 并收到回包。
- UDP 广播桥自测发送 `hello udp broadcast bridge`，转发目标收到相同内容。
- 状态显示真实计数：连接数、包数、字节数、最近日志。

### 3.5 当前游戏上下文诊断

1. 在“游戏扫描”或“推荐方案”中选择 Terraria。
2. 进入“诊断报告”。
3. 点击“诊断当前游戏”。

通过标准：

- 报告包含 `selected_game_*` 检查项。
- 能说明 Terraria 当前需要哪些能力。
- 如果 n2n、服务端或端口代理未就绪，应出现对应失败分类和下一步建议。
- 报告仍包含全局 `adapter_requirement_alignment`。

### 3.6 Terraria 单机服务端验证

1. 进入 Terraria 向导。
2. 在程序内启动服务端。
3. 等待日志出现监听端口，例如 `Listening on port 7777`。
4. 等待至少 30 秒。
5. 生成诊断报告。

通过标准：

- 不弹出额外命令框。
- 服务端状态包含 running / ready / uptime。
- 30 秒稳定性检查能反映真实状态。
- 如果服务端退出，报告包含 exit_code、退出时间、最后日志。

## 4. VPS / supernode 验证步骤

在 VPS 上：

```bash
sudo ss -lunp | grep 7777
```

或启动：

```bash
sudo supernode -p 7777 -vm
```

客户端侧：

1. 通用组网中心填写 supernode。
2. 启动 n2n edge。
3. 查看 edge 日志。
4. 生成诊断报告。

通过标准：

- edge 日志出现 ACK/PONG/[OK]。
- 没有 authentication error。
- 没有 MAC/IP already in use。
- 诊断报告的 supernode 状态与日志一致。

## 5. 双机验证步骤

### 5.1 房主

1. 设置虚拟 IP：`10.10.10.2`。
2. 启动 n2n。
3. 启动游戏服务端或游戏内开房。
4. 如游戏只监听 `127.0.0.1`，启动 TCP 端口代理：

```text
0.0.0.0:游戏端口 -> 127.0.0.1:游戏端口
```

5. 复制邀请好友包。

### 5.2 加入者

1. 设置虚拟 IP：`10.10.10.3`。
2. 使用邀请包中的 community、secret、supernode。
3. 启动 n2n。
4. 访问房主虚拟 IP 和端口。
5. 进入游戏执行加入。

通过标准：

- 双方虚拟 IP 不重复。
- 加入者能连接房主虚拟 IP。
- Terraria 能 Join via IP 进入。
- 失败时诊断报告能给出明确失败分类。

## 6. 首批 adapter 审核标准

每个首批 adapter 审核时必须确认：

1. `game_id`、`display_name`、`steam_appid` 正确。
2. `network_type` 准确。
3. `connection_plan.summary` 不夸大能力。
4. 房主步骤和加入者步骤能被普通玩家照着做。
5. 默认端口正确。
6. `requires_virtual_lan`、`requires_tcp_port_proxy`、`requires_udp_broadcast_bridge`、`requires_dedicated_server` 与真实玩法一致。
7. 邀请模板包含必要字段。
8. troubleshooting 包含常见失败原因。
9. 不包含任意脚本、未知 exe 下载、绕过正版验证、绕过反作弊或模拟官方账号服务。

## 7. 客户端内验证入口规划

后续可以新增一个“发布验证”页面，定位为开发者/管理员功能，不面向普通玩家强制展示。

建议入口：

```text
侧边栏：发布验证
```

页面结构：

1. **验证总览**
   - 当前版本；
   - 最近一次验证时间；
   - 单机验证通过数；
   - 双机验证待人工确认数；
   - 首批 adapter 审核状态。

2. **单机自动验证**
   - 构建信息；
   - adapter registry 本地同步；
   - TCP 代理自测；
   - UDP 代理自测；
   - UDP 广播桥自测；
   - 诊断报告生成。

3. **当前游戏验证**
   - 选择游戏；
   - 运行当前游戏上下文诊断；
   - 显示所需能力和未就绪能力；
   - 跳转推荐方案 / 通用组网 / 适配器管理。

4. **双机人工验证记录**
   - 房主虚拟 IP；
   - 加入者虚拟 IP；
   - supernode；
   - 游戏端口；
   - 是否成功进入；
   - 失败报告粘贴区。

5. **首批 adapter 审核**
   - Terraria；
   - Minecraft Java；
   - Stardew Valley；
   - 每个 adapter 显示审核项和结论。

本阶段先完成文档，不立刻做页面，避免在没有稳定测试流程前把 UI 做成另一组空按钮。

## 8. 发布结论模板

每次发布前按以下格式记录：

```text
版本：
日期：
验证人：

单机验证：通过 / 未通过
VPS supernode 验证：通过 / 未通过
双机验证：通过 / 未通过
Terraria：通过 / 未通过
Minecraft Java：通过 / 未通过
Stardew Valley：通过 / 未通过

阻断问题：
1.
2.

非阻断问题：
1.
2.

是否允许发布：
是 / 否
```

下一步推荐：按本文档先执行单机验证，并把结果写入新的 `docs/RELEASE_VALIDATION_LOG.md`。
