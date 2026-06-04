# 后端能力与参考前端缺口清单

更新时间：2026-06-04

目的：当前项目是“后端先行、参考前端后接入”。参考前端来自外部设计资源，视觉风格可用，但并不是按现有后端能力完整设计，因此需要以后端真实能力为主导，反推前端还缺哪些入口、页面区块和状态展示。

本清单用于发给前端设计/前端 AI：不是要求推翻现有参考前端，而是在保持当前 iOS 风格、清爽卡片、侧边栏和顶部栏的基础上，把后端已有能力补齐到界面中。

---

## 1. 后端已实现能力总览

当前 Tauri 后端已经暴露以下能力：

### 1.1 游戏与适配器

- 扫描本地游戏：`scan_games`
- 分析单个游戏：`analyze_game`
- 推荐联机方案：`recommend_plans`
- 启动游戏/启动配置：`launch_profile`
- 列出游戏适配器：`list_game_adapters`
- 保存游戏适配器：`save_game_adapter`
- 导入适配器 JSON：`import_game_adapter_json`
- 导出适配器 JSON：`export_game_adapter_json`
- 同步远程适配器 registry：`sync_adapter_registry`
- 同步本地示例 registry：`sync_local_adapter_registry_example`

### 1.2 网络后端

- 列出网络后端：`list_network_backends`
- 配置网络后端：`setup_network`
- 启动网络后端：`start_network`
- 停止网络后端：`stop_network`
- 支持的后端类型：
  - `manual_lan`
  - `radmin`
  - `n2n`

### 1.3 n2n 专项

- n2n 诊断：`get_n2n_diagnostics`
- 读取最近 n2n 配置：`get_n2n_last_config`
- n2n 启停通过 `start_network('n2n')` / `stop_network('n2n')`
- n2n 配置通过 `setup_network('n2n', config)`
- 后端诊断字段包括：
  - 是否运行
  - supernode 是否配置
  - virtual IP
  - ACK/PONG
  - 认证错误
  - IP/MAC 冲突
  - supernode 无响应
  - 最近日志
  - 日志路径

### 1.4 连通性测试

- 通用端口连通性测试：`test_connectivity`
- 支持 host、ports、timeout、mode
- mode 包括：
  - `generic`
  - `local_game_port`
  - `n2n_game_port`

### 1.5 游戏服务端会话

- 启动游戏服务端会话：`start_game_server_session`
- 读取服务端状态：`read_server_session`
- 停止服务端：`stop_server_session`
- 向服务端发送命令：`send_server_command`
- 当前 Terraria 向导主要使用这组能力。

### 1.6 TCP/UDP 端口代理

- 启动端口代理：`start_port_proxy`
- 停止端口代理：`stop_port_proxy`
- 列出端口代理：`list_port_proxies`
- 获取单个代理状态：`get_port_proxy_status`
- 测试代理：`test_port_proxy`
- 代理自测：`self_test_port_proxy`
- 状态字段包括：
  - listen
  - target
  - active_connections
  - total_connections
  - bytes_in / bytes_out
  - last_error
  - logs

### 1.7 UDP 单播代理

- 启动 UDP 代理：`start_udp_proxy`
- 停止 UDP 代理：`stop_udp_proxy`
- 列出 UDP 代理：`list_udp_proxies`
- 获取 UDP 代理状态：`get_udp_proxy_status`
- UDP 代理自测：`self_test_udp_proxy`
- 状态字段包括：
  - listen
  - target
  - active_clients
  - packets_in / packets_out
  - bytes_in / bytes_out
  - last_error
  - logs

### 1.8 UDP 广播桥

- 启动 UDP 广播桥：`start_udp_broadcast_bridge`
- 停止 UDP 广播桥：`stop_udp_broadcast_bridge`
- 列出 UDP 广播桥：`list_udp_broadcast_bridges`
- 获取 UDP 广播桥状态：`get_udp_broadcast_bridge_status`
- UDP 广播桥自测：`self_test_udp_broadcast_bridge`
- 状态字段包括：
  - listen
  - forward_targets
  - received_packets
  - forwarded_packets
  - dropped_packets
  - bytes_in / bytes_out
  - last_error
  - logs

### 1.9 诊断报告

- 生成全局诊断报告：`generate_diagnostic_report`
- 生成指定游戏诊断报告：`generate_diagnostic_report_for_game`
- 报告包括：
  - summary
  - most_likely_cause
  - issues
  - next_actions
  - release_checks
  - details
  - required_passed / required_total

---

## 2. 当前参考前端已有页面

参考前端当前包含：

- 首页
- 方案库
- 游戏扫描
- 推荐方案
- 通用组网中心
- Terraria 向导
- 诊断报告
- 设置与帮助

这些页面的视觉结构已经可用，但多处内容仍是参考稿中的静态演示文案，不完整覆盖后端真实能力。

---

## 3. 前端缺失能力清单，按优先级排序

## P0：必须补，否则后端核心能力会被搁置

### 3.1 高级连接工具总入口缺失

后端已有能力：

- TCP 端口代理
- UDP 单播代理
- UDP 广播桥
- 代理自测
- 代理状态列表
- 停止代理
- 查看代理日志

当前前端问题：

- 参考前端在文案中提到 TCP/UDP/Bridge，但没有形成一个完整可操作的“高级连接工具”区域。
- 用户无法清晰知道：什么时候用端口代理，什么时候用 UDP 广播桥。
- 用户无法看到当前代理实例列表、收发包统计、错误日志和停止按钮。

建议前端补充：

在“通用组网中心”或新增“高级连接工具”页面中增加一个完整模块：

```text
高级连接工具
- TCP 端口代理卡片
  - 监听地址
  - 监听端口
  - 目标地址
  - 目标端口
  - 启动代理
  - 停止代理
  - 一键自测
  - 当前连接数 / 总连接数 / 上下行字节
  - 最近日志

- UDP 单播代理卡片
  - 监听地址
  - 监听端口
  - 目标地址
  - 目标端口
  - 启动代理
  - 停止代理
  - 一键自测
  - 活跃客户端数 / 收发包数量 / 上下行字节
  - 最近日志

- UDP 广播桥卡片
  - 监听地址
  - 监听端口
  - 转发目标列表
  - 允许广播开关
  - 去重 TTL
  - 启动广播桥
  - 停止广播桥
  - 一键自测
  - 收包 / 转发 / 丢弃统计
  - 最近日志
```

面向用户文案建议：

- “好友能直连 IP，但游戏搜不到房间：试试 UDP 广播桥。”
- “游戏只认本机端口或端口不一致：试试端口代理。”
- “不确定是否需要：先运行一键自测。”

---

### 3.2 游戏适配器编辑/认定能力体现不足

后端已有能力：

- 保存适配器 `save_game_adapter`
- 导入适配器 JSON
- 导出适配器 JSON
- 本地/远程 registry 同步
- 游戏 network_type、connection_plan、conversion_profile

当前前端问题：

- 当前有“方案库/游戏扫描”，但缺少面向管理员/高级用户的“认定这个游戏如何联机”的完整编辑入口。
- 用户之前提出的关键产品方向是：管理员或用户认定一次游戏类型，后续其他用户复用。这个能力在 UI 上还不够明确。

建议前端补充：

在“方案库”或“适配器管理”中增加“创建/编辑适配器”流程：

```text
认定游戏联机方式
- 游戏名称
- Steam AppID
- 可执行文件特征
- 默认端口
- 联机类型选择：
  - 原生 LAN/IP 直连
  - 需要专用服务端
  - 需要 TCP/UDP 端口代理
  - 需要 UDP 广播桥
  - Steam Lobby 可转本地
  - Steam Relay/插件方案
  - 需要社区 Mod
  - 仅官方服务器，不支持转换
  - 未知，待审核

- 转换方案：
  - 虚拟局域网
  - 专用服务端启动器
  - 广播桥
  - 端口代理
  - Mod 安装器
  - Steam Relay 插件
  - 手动教程
  - 不支持

- 主机玩家说明
- 加入玩家说明
- 默认加入 IP
- 默认端口
- 邀请模板
- 故障排查说明
- 保存到本地
- 导出 JSON
- 提交到共享库占位入口
```

---

### 3.3 推荐方案页缺少“按后端 connection_plan 展示”的结构

后端已有能力：

- `recommend_plans(game_id)`
- `analyze_game(game_id)`
- `GameConnectionPlan`
- `MultiplayerConversionProfile`
- `network_type`

当前前端问题：

- 推荐方案页视觉上有方案展示，但没有完整体现后端的结构化字段。
- 缺少“这个游戏为什么推荐这个方式”的解释区。
- 缺少“需要哪些组件”的检查区。
- 缺少“主机做什么/好友做什么”的步骤区。

建议前端补充：

```text
推荐方案页
- 当前识别结果
  - 游戏名称
  - 联机类型 network_type
  - 可转换程度 can_convert_to_lan
  - 风险等级 risk_level
  - 识别来源 adapter_source

- 推荐连接方案
  - 是否需要虚拟局域网
  - 是否需要专用服务端
  - 是否需要 TCP/UDP 代理
  - 是否需要 UDP 广播桥
  - 是否需要 Mod/Steam 插件

- 主机步骤
  - 按 connection_plan.host_role 展示

- 好友步骤
  - 按 connection_plan.join_role 展示

- 邀请好友包
  - supernode
  - 房间名
  - 密钥
  - 主机虚拟 IP
  - 游戏端口
  - 是否需要端口代理
  - 是否需要 UDP 广播桥
  - 一键复制

- 故障排查
  - 按 connection_plan.troubleshooting 展示
```

---

### 3.4 游戏服务端通用会话能力被 Terraria 页面绑定过死

后端已有能力：

- `start_game_server_session(game_id, profile_id, config)`
- `read_server_session`
- `send_server_command`
- `stop_server_session`

当前前端问题：

- 目前主要体现为 “Terraria 向导”。
- 但后端抽象其实是“任意游戏服务端会话”。
- 如果未来有 Minecraft、饥荒、幻兽帕鲁等服务端配置，不应该每个都复制一个完全独立页面。

建议前端补充：

保留 Terraria 向导作为专属样例，但在“推荐方案”或“高级启动”中增加通用服务端启动卡片：

```text
专用服务端
- 当前游戏
- 可用启动配置 profile
- 参数表单 config_fields
- 启动服务端
- 停止服务端
- 控制台命令输入
- 日志窗口
- ready 状态
- 运行时长
- 退出码
```

Terraria 页面可以继续存在，但前端设计上要表达：

> “Terraria 是专属向导示例，通用服务端能力可以被其他游戏复用。”

---

## P1：应该补，影响产品完整度

### 3.5 网络后端选择没有完整体现 manual_lan / radmin / n2n

后端已有能力：

- `list_network_backends`
- `manual_lan`
- `radmin`
- `n2n`

当前前端问题：

- 通用组网中心重点是 n2n。
- Radmin 和手动局域网更像文字概念，没有形成同级别选择器。
- 用户目标是“包揽主要方式供玩家选择”，前端应该把多种方式并列展示。

建议前端补充：

```text
组网方式选择
- 自动推荐
- n2n 虚拟局域网
- Radmin VPN 检测/引导
- 已有局域网/同 Wi-Fi 手动模式
- 未来：Steam Relay 插件/其他方式入口

每个方式显示：
- 是否已安装
- 是否可用
- 当前虚拟 IP
- 适合场景
- 启动/停止/查看说明
```

---

### 3.6 n2n 失败分类展示不够完整

后端已有字段：

- auth_error
- ip_mac_conflict
- not_responding
- ack
- pong
- ok_link
- recent_logs
- log_path

当前前端问题：

- 参考前端有诊断样式，但对 n2n 的失败分类不够产品化。
- 用户之前遇到过 IP/MAC 冲突、supernode 参数差异、监听变灰、白框等问题，这些都应该有明确状态卡。

建议前端补充：

```text
n2n 状态详情
- Edge 是否运行
- Supernode 是否配置
- 是否收到 ACK
- 是否收到 PONG
- 是否认证失败
- 是否 IP/MAC 冲突
- 是否 Supernode 无响应
- 当前虚拟 IP
- 最近日志
- 打开日志路径
- 一键复制排障摘要
```

---

### 3.7 诊断报告缺少“指定游戏诊断”和“可复制给管理员”的结构

后端已有能力：

- 全局诊断报告
- 指定游戏诊断报告
- release_checks
- issues / next_actions / evidence

当前前端问题：

- 诊断报告页面已有，但更像展示固定诊断项。
- 缺少选择“当前游戏/全局”的入口。
- 缺少“复制给管理员/开发者”的按钮结构。

建议前端补充：

```text
诊断报告
- 诊断范围：全局 / 当前游戏
- 生成诊断
- 最可能原因
- 问题列表
- 下一步建议
- 发布前检查项
- 原始详情
- 复制完整报告
- 复制精简报告给好友/管理员
```

---

### 3.8 启动配置 launch_profile 没有通用 UI

后端已有能力：

- `launch_profile`
- `LaunchProfile`
- `config_fields`
- `arg_templates`
- `stdin_templates`

当前前端问题：

- 前端没有完整的“启动配置表单生成器”。
- 这会导致适配器里定义的启动参数无法被用户操作。

建议前端补充：

```text
启动配置
- 选择 profile：客户端 / 服务端 / 文档
- 根据 config_fields 自动渲染表单
  - text
  - number
  - password
  - select
  - checkbox
- 显示即将执行的参数预览
- 启动
- 失败时显示错误和排查建议
```

---

## P2：可后续补，但需要预留入口

### 3.9 Steam Lobby / Steam P2P / Steam Relay 插件入口需要占位

后端类型中已经预留：

- `steam_lobby`
- `steam_p2p`
- `steam_lobby_direct_possible`
- `steam_relay_plugin`
- `steam_relay_plugin` conversion method

当前前端问题：

- 参考前端没有清晰入口表达“借助 Steam 服务器/插件/Relay 的方案”。

建议前端补充占位：

```text
未来连接方式
- Steam Lobby 转本地方案
- Steam Relay 插件方案
- 社区 Mod 方案
- 当前状态：规划中 / 实验中 / 需要适配器支持
```

注意：占位可以有，但不要显示为已可用。

---

### 3.10 共享库同步详情展示不够完整

后端已有字段：

- created
- updated
- skipped
- hash_failed
- parse_failed
- fetch_failed
- validation_failed
- write_failed
- items
- messages

当前前端问题：

- 有“方案库”页面，但同步结果应该有更清楚的明细表。

建议前端补充：

```text
共享库同步结果
- 总数
- 新增
- 更新
- 跳过
- Hash 失败
- 解析失败
- 拉取失败
- 校验失败
- 写入失败
- 明细表：游戏、URL、状态、原因、保存路径
```

---

### 3.11 设置页缺少后端路径与默认值管理

后端相关能力：

- n2n 最近配置读取
- setup_network 保存 n2n 配置
- registry URL 同步
- n2n 诊断日志路径

当前前端问题：

- 设置页有帮助信息，但不够像真实产品设置。

建议前端补充：

```text
设置
- 默认 Supernode
- 默认房间名
- 默认密钥
- 默认虚拟 IP 段
- 适配器共享库地址
- 恢复默认共享库地址
- n2n edge 路径检测结果
- 日志目录
- 打开日志目录
- 清理运行状态
```

---

## 4. 建议前端最终页面结构

为了不让用户觉得复杂，建议按“普通用户优先，高级工具收纳”的方式组织：

```text
首页
- 当前状态
- 推荐下一步
- 最近扫描游戏
- 快速诊断

游戏扫描
- 扫描本地游戏
- 识别联机类型
- 进入推荐方案
- 未知游戏提交认定入口

推荐方案
- 游戏识别结果
- 推荐联机方式
- 主机步骤
- 好友步骤
- 邀请好友包
- 需要的增强工具提示

通用组网中心
- 组网方式选择：n2n / Radmin / 手动局域网
- n2n 配置、启动、停止、诊断
- 当前虚拟 IP 与 supernode 状态

高级连接工具
- TCP 端口代理
- UDP 单播代理
- UDP 广播桥
- 一键自测
- 实例列表与日志

适配器管理 / 方案库
- 同步共享库
- 本地适配器列表
- 创建/编辑适配器
- 导入/导出 JSON
- 同步明细

Terraria 向导
- 保留为专属向导示例
- 但不要代表每个游戏都要单独做页面

诊断报告
- 全局诊断
- 当前游戏诊断
- 复制给管理员
- 原始报告

设置与帮助
- 默认 supernode
- registry 地址
- n2n 路径/日志
- 未来能力入口
```

---

## 5. 给前端设计的直接要求

请前端按以下要求补设计：

1. 不要只做视觉壳，必须给后端已有功能留出可操作区域。
2. 以后端能力为主导，至少补齐：
   - 高级连接工具页或模块
   - TCP/UDP 代理操作区
   - UDP 广播桥操作区
   - 适配器创建/编辑流程
   - 推荐方案中的 connection_plan 展示
   - 通用服务端启动卡片
   - 诊断报告的全局/游戏范围切换
   - 网络后端选择器：n2n / Radmin / 手动局域网
3. 普通用户文案要少用技术词，技术能力收进高级区。
4. 所有长耗时按钮都要有 loading 状态。
5. 所有真实后端结果都要有成功、失败、部分成功、日志详情四种状态。
6. 不要展示假延迟、假连接成功、假可发布状态。
7. Steam Relay、Mod、云端提交等未完成能力只能做“未来/实验入口”，不能显示为已可用。

---

## 6. 最关键的缺口一句话总结

当前参考前端已经有漂亮的基础页面，但缺少对“高级连接工具、适配器认定、通用服务端会话、结构化推荐方案、多网络后端选择”的完整承载。下一轮前端设计应以后端功能矩阵为准补空间，而不是继续只优化颜色和卡片。

---

## 2026-06-04 最终参考前端(3)对接审计

参考来源：`C:\Users\ty\Downloads\联机助手 (3)\src`。

### 已复刻并纳入保真检查

- `src/reference-ui` 已同步最终参考前端(3)。
- `tools/check_reference_ui_fidelity.ps1` 默认参考路径已改为 `(3)`。
- 新增页面 `components/AdvancedToolsView.tsx` 已纳入一比一差异检查。
- 由于最终参考前端自带 `main.tsx` 使用 `import App from './App.tsx'`，会触发当前 TypeScript 构建限制；该文件仅作为参考源码保留，不作为项目入口使用，因此已在 `tsconfig.json` 中排除 `src/reference-ui/main.tsx`，实际入口仍为 `src/main.tsx`。

### 最终参考前端(3)新增/强化的能力入口

- 新增侧边栏入口：`高级连接工具`。
- 高级连接工具内包含：
  - TCP 端口代理配置与实例列表；
  - UDP 单播代理配置与实例列表；
  - UDP 广播大厅桥配置与实例列表；
  - 代理/广播桥一键自测；
  - 通用游戏服务端启动器 UI。
- 推荐方案、方案库、通用组网中心页面包含更多高级说明和入口。

### 已接入真实后端的新增入口，Product Mode

保持 reference mode 一比一不动；Product Mode 下新增拦截：

| 页面 | 前端按钮 | 后端动作 |
|---|---|---|
| 高级连接工具 | 挂载并上线该高速链路 | 按选择调用 `start_port_proxy` / `start_udp_proxy` / `start_udp_broadcast_bridge` |
| 高级连接工具 | 一键连通自测 | 按当前卡片类型调用 `self_test_port_proxy` / `self_test_udp_proxy` / `self_test_udp_broadcast_bridge` |
| 高级连接工具 | 暂停代理 | 按当前卡片类型停止一个正在运行的真实代理/广播桥 |
| 高级连接工具 | 完全卸载链路 | 当前等价于停止对应真实代理/广播桥，后续可扩展为持久规则删除 |

### 仍存在的前后端缺口

1. **通用游戏服务端启动器缺后端命令**
   - 参考前端提供“任意 Jar/Exe 可执行路径 + 端口 + 控制台”的 UI。
   - 当前后端只有基于 `game_id + profile_id + adapter` 的 `start_game_server_session`，没有“按任意物理路径启动通用服务端”的安全命令。
   - Product Mode 下已拦截“挂载并运行专属服务端”，返回真实失败说明，而不是伪造启动成功。
   - 后续如要完成该功能，需要新增后端命令，例如：`start_generic_server_session(config)`、`read_generic_server_session()`、`stop_generic_server_session()`，并定义路径白名单/参数模板/工作目录/日志编码/进程清理策略。

2. **高级连接工具真实实例列表尚未完全替换参考假实例**
   - 后端已能 `list_port_proxies`、`list_udp_proxies`、`list_udp_broadcast_bridges`。
   - 当前 Product Mode 已把三类列表纳入 runtime snapshot，并能把动作结果回填到页面摘要。
   - 但参考 UI 的实例卡片仍来自参考前端本地 state。后续应在 Product Mode 下进一步用真实列表覆盖卡片内容，避免用户把参考示例实例当成真实运行实例。

3. **高级连接工具停止/删除当前只能按类型停止一个真实实例**
   - 参考卡片内没有绑定真实后端 ID。
   - 当前 Product Mode 依据卡片类型 TCP/UDP/Bridge 停止一个正在运行的真实实例。
   - 后续要做到精确停止，需要把真实 ID 渲染/绑定到 DOM 或改造参考适配层的数据注入。

---

## 2026-06-04 通用服务端启动器缺口关闭

本轮已补齐最终参考前端(3)中“高级连接工具 / 通用游戏服务端”对应的后端命令，原先“缺少安全后端命令”的缺口更新为已关闭。

### 新增真实后端能力

- 新增模型：`GenericServerLaunchConfig`。
- 新增 Tauri command：`start_generic_server_session(config)`。
- 新增前端 API：`startGenericServerSession(config)`。
- 支持启动类型：`.exe`、`.bat`、`.cmd`、`.jar`。
- `.jar` 文件通过 `java -Xmx{memory}M -jar <path>` 启动，默认 `jar_memory_mb=1024`。
- 工作目录默认取服务端文件所在目录，也允许后续通过配置指定。
- 仍复用既有 `read_server_session`、`stop_server_session`、`send_server_command`，避免并行多套服务端会话状态。
- 就绪判断仍以“进程存活 + 本地端口监听”为准，不根据点击按钮伪造成功。

### Product Mode 前端接入

- `高级连接工具 / 通用游戏服务端 / 挂载并运行专属服务端` 已接入 `start_generic_server_session`。
- `安全停止并固化世界存档` 复用 `stop_server_session`。
- `发送指令` 复用 `send_server_command`。
- 新增 `ReferenceProductAdvancedToolsPatcher`：Product Mode 下在高级连接工具页插入“真实后端高级连接状态”面板，并将实例标题改为真实后端实例数量，避免参考示例卡片误导用户。

### 仍需继续完善

- 参考 UI 的通用服务端页面本身仍由参考前端本地 state 控制，真实状态通过 Product Mode 面板和动作结果回填展示。后续若要彻底替换，需要把该页面抽象为受控组件或继续扩展 DOM patcher。
- 通用服务端当前只支持单会话托管，不支持同时开多个不同游戏专用服。

---

## 2026-06-04 Product Mode 真实库存/推荐覆盖

最终参考前端(3)的游戏扫描、方案库、推荐方案页面仍保留原设计中的演示卡片。为保持视觉一比一，不直接改 `src/reference-ui`，本轮通过 Product Mode patcher 增加真实后端数据面板：

- 游戏扫描：`scanGames()` + `listGameAdapters()`。
- 方案库：`listGameAdapters()`。
- 推荐方案：`scanGames()` + `recommendPlans(gameId)` + `getN2nLastConfig()` + `readServerSession()`。

普通浏览器预览无法连接 Tauri 后端时，面板会显示后端未连接提示；真实数据验证应在 `lan-helper.exe` 中进行。

仍需继续完善：

1. 将真实游戏选择状态贯通到推荐页，而不是默认取扫描结果第一项。
2. 将“查看分析与推荐方案 / 创建局域网组网草稿 / 自建共享方案编辑器”进一步接入 `analyzeGame()` 和 `saveGameAdapter()`。
3. 推荐页“立即启动本地游戏实体”仍需要接入 `launchProfile(gameId, profileId, config)`，当前还不是完整真实启动链路。

---

## 2026-06-04 推荐启动项与适配器编辑接入更新

已接入：

- 推荐页 `立即启动本地游戏实体`：调用 `launchProfile(gameId, profileId, config)`。
- 游戏扫描页分析/创建方案按钮：调用 `analyzeGame(game_id)`。
- 方案库 `一键发布登记至共享适配器库`：调用 `saveGameAdapter(adapter)`。

仍需继续完善：

1. 推荐页当前通过参考前端选择器推断 `game_id/profile_id`，还不是由真实选中游戏状态贯通而来。
2. `palworld` 在最终参考前端中存在演示选项，但当前本地 adapter registry 未包含 Palworld，因此真实启动会合理失败；如要支持，需要新增 Palworld adapter。
3. 方案编辑器已能保存基础 custom adapter，但还没有完整覆盖所有高级字段，例如协议细分、Steam Relay 插件入口、复杂启动参数模板。

## 2026-06-04 10:38:31 前端缺口处理策略与选中游戏缺口关闭

### 如果后端已有功能但最终参考前端没有接口

处理策略固定为三步：

1. **先记录缺口**：写入本文档，说明缺少哪个入口、对应哪个后端 command/API、当前是否可通过 Product Mode 临时操作。
2. **Product Mode 临时接入**：不破坏 src/reference-ui 一比一视觉源码，通过 src/reference-adapter 插入真实状态面板、Toast、按钮拦截或调试入口；所有结果必须来自 Tauri 后端，不允许伪造成功。
3. **等待新前端补齐正式入口**：当最终设计增加对应按钮/表单时，直接复用 src/reference-adapter/actions.ts 或 src/api/tauri.ts 的真实 API，逐步减少 DOM patcher。

### 本轮关闭：真实选中游戏状态贯通

- 已新增 src/reference-adapter/selectedGame.ts。
- 游戏扫描页分析/建方案动作会保存最近选中的真实游戏。
- 推荐方案页真实推荐、邀请摘要、启动动作优先使用最近选中的真实游戏。
- 原“推荐页默认取扫描结果第一项”的缺口已关闭。

### 仍存在的前端功能缺口

- Palworld 仍是参考前端演示项，本地 adapter registry 暂无 Palworld adapter；真实启动失败属于合理后端反馈。
- 方案编辑器目前只能保存基础 adapter 字段，复杂协议、Steam Relay 插件入口、复杂启动参数模板仍需正式 UI。
- 高级连接工具参考卡片仍不是完全受控真实实例列表，Product Mode 目前通过真实状态面板补偿。

## 2026-06-04 10:51:21 方案库导入导出缺口关闭与矩阵新增

### 本轮关闭

- 方案库“导入方案”不再只是参考 UI Toast；Product Mode 下已通过文件选择读取 JSON，并调用 importGameAdapterJson(content)。
- 方案库“导出备份”不再只是参考 UI Toast；Product Mode 下已调用 exportGameAdapterJson(gameId) 并下载真实 JSON。
- 新增 docs/FINAL_REFERENCE_UI_BACKEND_MATRIX.md，作为最终参考前端 (3) 的逐页对接状态表。

### 仍需正式前端补齐

- “手动强制刷新”和“一键更新共享方案”的语义需要重新区分，否则用户会认为两个按钮作用相同。
- 同步详情应该绑定 AdapterRegistrySyncResult.items，展示每个失败项原因，而不是只靠 Toast。
- 导入 JSON 后应在正式 UI 中刷新真实方案列表，并高亮刚导入的方案。

## 2026-06-04 12:03:23 推荐启动项 profile 智能选择缺口关闭

- 原缺口：推荐页 launchProfile() 的 profile_id 由参考选择器简化推断，可能启动错 profile。
- 当前处理：Product Mode 下启动前先调用 ecommendPlans(game_id)，优先使用真实推荐项中的 launch_profile_id。
- 回退规则：没有任何推荐项提供 launch_profile_id 时，才使用旧的 profile_id 或默认 client。
- 仍需正式 UI 补齐：推荐卡片应允许用户明确选择某一条推荐方案，而不是只让 Product Mode 自动挑第一条 recommended。

## 2026-06-04 12:22:26 指定游戏诊断缺口关闭

- 原缺口：后端已有 generateDiagnosticReportForGame(gameId)，但最终参考前端没有绑定当前游戏的诊断入口。
- 当前处理：Product Mode 使用最近真实选中游戏作为诊断目标；诊断页和推荐页生成诊断时优先调用 generateDiagnosticReportForGame(gameId)。
- 回退规则：没有真实选中游戏时仍生成全局诊断 generateDiagnosticReport()。
- 仍需正式前端补齐：提供“诊断目标选择器”，允许用户明确选择“全局诊断 / 当前游戏诊断 / 指定游戏诊断”。

## 2026-06-04 12:37:12 好友席位与真实邀请包缺口阶段关闭

- 原缺口：最终参考前端有好友 IP 分配大厅，但数据只存在参考 UI 组件 state，邀请包文本包含演示值。
- 当前处理：Product Mode 新增本地持久好友席位存储，并拦截分配、选择、回收、探测、复制邀请包按钮。
- 真实邀请包字段来自：getN2nLastConfig()、最近真实选中游戏、Product Mode 好友席位、当前游戏端口、最近好友检测结果。
- 仍需正式前端补齐：好友席位列表应改为受控真实数据源；如果要多人房间/云同步，需要新增后端房间 API，而不是继续依赖 localStorage。

## 2026-06-04 13:00:06 设置中心真实 API 缺口关闭

- 原缺口：设置页主要是参考 UI state，缺少统一后端设置读写。
- 当前处理：新增 App Settings 后端命令并写入 .lan-helper/settings.json；Product Mode 下设置页可保存真实设置并显示真实配置面板。
- 已有 API：getAppSettings()、saveAppSettings(settings)、esetAppSettings()、openPath(path)。
- 仍需正式前端补齐：设置页应提供重置按钮、打开日志/工具目录按钮，并把“联机自测”升级为 edge.exe 路径存在性、版本和可执行权限检测。

## 2026-06-04 13:20:26 edge 路径深度检测缺口关闭

- 原缺口：设置页可以保存 edge.exe 路径，但“联机自测”没有真实检查该路径。
- 当前处理：新增 	estEdgePath(path)，检查路径存在性、文件属性、文件名合理性，并尝试执行 -h 获取帮助/版本线索。
- Product Mode 设置页“联机自测”已接入该真实检测。
- 仍需未来功能：自动下载 edge.exe、自动修复路径、自动安装/检查 TAP/Wintun 驱动。

## 2026-06-04 13:45:38 Palworld adapter 缺口关闭

- 原缺口：最终参考前端包含 Palworld 演示项，但本地 adapter registry 没有 Palworld，导致真实推荐/启动可能失败。
- 当前处理：新增 Palworld adapter 到本地 adapters 与 adapter-registry 示例，并更新 registry index SHA256。
- 支持范围：Palworld Dedicated Server / IP:端口加入，默认 UDP 8211，虚拟局域网连通，必要时 UDP 单播代理。
- 明确边界：不承诺官方服务器、Steam 好友大厅或平台匹配强制转换成本地 LAN。
- 仍需未来增强：SteamCMD 安装器、PalWorldSettings.ini 可视化编辑、服务端日志解析、UDP 可达性专用检测。

## 2026-06-04 方案库同步详情缺口更新

- Product Mode 已新增 `src/reference-adapter/adapterSyncResult.ts`，持久保存最近一次远程/本地方案库同步结果。
- `ProductActionPatcher` 会在“恢复默认”和“一键更新共享方案”成功后写入真实 `AdapterRegistrySyncResult`。
- `ProductInventoryPatcher` 的方案库面板已展示同步来源、时间、registry_url、成功/失败计数，以及每个 adapter item 的状态、原因、保存路径和 hash mismatch 信息。
- 剩余缺口从“同步详情不可见”收窄为：正式受控 React UI 尚未替换参考演示列表；“手动强制刷新”按钮语义仍需产品确认。

## 2026-06-04 高级工具真实实例列表受控化

- `src/reference-adapter/actions.ts` 的 `withSnapshot()` 现在在真实动作完成/失败后会广播 `lan-helper:reference-runtime-updated`，Product Mode 状态无需等待 5 秒轮询。
- `ReferenceProductAdvancedToolsPatcher` 已升级为真实清单：集中展示 TCP 端口代理、UDP 单播代理、UDP 广播桥、通用服务端单会话。
- 高级工具真实清单支持“刷新真实状态”、按实例“停止”、按类型“自测”；所有结果继续通过 Product Mode toast 暴露，不伪造成功。
- 面板展示运行状态、listen/target、连接/包/字节统计、最近错误、最近日志，降低参考演示实例误导。
- 下一步推荐：做“诊断目标选择器”，让用户明确选择全局诊断、当前选中游戏诊断或指定游戏诊断。

## 2026-06-04 诊断目标选择器真实接入

- `ReferenceProductDiagnosticsPatcher` 新增 Product Mode 真实诊断目标选择器，不改 `src/reference-ui`。
- 支持三种范围：全局环境、当前选中游戏、指定游戏。
- 全局环境调用 `generateDiagnosticReport()`；游戏范围调用 `generateDiagnosticReportForGame(gameId)`。
- 最近一次报告保存到 localStorage `lan-helper.referenceDiagnosticRecord`，诊断目标保存到 `lan-helper.referenceDiagnosticTarget`。
- 诊断页会展示目标标签、release_ready、必需项通过数量、摘要、最可能原因和下一步动作，并把目标信息写入参考诊断 JSON/证据行。
- 下一步推荐：整理方案库“手动强制刷新”语义，避免它和“一键更新共享方案”重复或误导用户。

## 2026-06-04 方案库手动刷新语义整理

- 新增 `refreshReferenceAdapterInventory()`：调用 `listGameAdapters()` 重新读取本地真实 adapter 列表。
- 新增 `requestReferenceAdapterInventoryRefresh()` / `subscribeReferenceAdapterInventoryRefresh()`，让 Product Mode 方案库面板可在手动刷新后立即重新加载。
- Product Mode 下“手动强制刷新”和“手动刷新此缓存”已接入本地刷新动作：不访问远程 registry，不写入或覆盖 adapter。
- Product Mode 方案库真实面板新增“方案库按钮语义”说明：一键更新=远程同步写入；恢复默认=本地示例同步；手动强制刷新=只重读本地列表。
- 下一步推荐：做“游戏扫描/推荐页真实列表正式受控化”，进一步减少参考演示卡片对用户的误导。

## 2026-06-04 游戏扫描/推荐页真实目标受控化

- `ReferenceProductInventoryPatcher` 的游戏扫描真实面板新增行级操作：设为推荐目标、真实分析。
- 设为推荐目标会写入 `lan-helper.referenceSelectedGame`，并触发推荐页刷新。
- 真实分析直接调用 `analyzeGame(gameId)`，结果通过 Product Mode action toast 暴露，不依赖参考演示卡片。
- 推荐页真实面板新增“真实推荐目标”区：展示真实扫描游戏列表，可切换目标并重新分析当前目标。
- 这一步进一步降低了 `src/reference-ui` 演示数组对用户判断的影响；参考 UI 仍保持一比一不改。
- 下一步推荐：补“复制/导出诊断报告正式入口”，让真实诊断报告可直接复制或导出文本。

## 2026-06-04 诊断报告复制与导出入口

- `ReferenceProductDiagnosticsPatcher` 新增统一纯文本格式化：`formatDiagnosticRecord(record)`。
- Product Mode 诊断页在已有真实报告时显示“复制报告”和“导出文本”。
- 复制报告使用 `navigator.clipboard.writeText()`，若环境不支持剪贴板会明确失败并提示使用导出文本。
- 导出文本使用 Blob 下载 `.txt`，内容来自最近一次真实 `lan-helper.referenceDiagnosticRecord`，不生成空报告、不伪造成功。
- `docs/FINAL_REFERENCE_UI_BACKEND_MATRIX.md` 已把“导出文本 / 复制报告”从缺口改为已真实接入。
- 下一步推荐：做好友席位后端化评估，明确 localStorage 是否足够 MVP，还是需要 room API。

## 2026-06-04 好友席位本地后端化

- 新增后端模型 `FriendAllocation`、`FriendAllocationInput`、`FriendCheckInput`。
- 新增 Tauri 本地存储 `src-tauri/src/storage/friend_store.rs`，写入 `.lan-helper/friend_allocations.json`。
- 新增 Tauri commands：`list_friend_allocations`、`upsert_friend_allocation`、`select_friend_allocation`、`remove_friend_allocation`、`update_friend_check`。
- 前端新增 `src/types/friend.ts` 与 `src/api/tauri.ts` friend API 封装。
- `friendAllocations.ts` 改为后端优先、localStorage 兜底；Product Mode 的分配、选择、回收、检测摘要已接后端。
- MVP 决策：当前版本不做云房间；本地后端持久化足够支撑单机/房主邀请包流程。云房间、账号、多人同步、管理员统一分配 IP 作为未来 room API。
- 下一步推荐：进行目标完成度审计，确认是否只剩“架构性未来项/受控 React 重构评估”，还是仍有必须补齐的真实功能缺口。
