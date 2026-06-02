# 游戏类型识别与方案沉淀工作流

更新时间：2026-06-03

本文档记录联机助手下一阶段的核心产品闭环：让管理员或高级用户认定一个游戏的联机类型，沉淀为 adapter，后续普通用户扫描到同一个游戏时直接获得可执行方案。

## 1. 为什么要做这套工作流

n2n、Radmin、Manual LAN、TCP 端口代理、未来 UDP 代理和 Steam Relay 都只是底层能力。用户真正关心的是：

```text
这个游戏我应该怎么和朋友联机？
房主做什么？
朋友做什么？
失败后先检查哪里？
```

因此产品不能只展示“已启动 n2n”或“端口可达”，还必须把游戏识别结果转化成清晰的连接方案。

## 2. 推荐流程

```text
扫描游戏
  ↓
匹配 adapter
  ↓
如果已认定：直接展示推荐方案和邀请包
  ↓
如果未知：进入管理员认定流程
  ↓
选择游戏网络类型
  ↓
填写房主/加入者步骤、端口、是否需要代理/广播桥
  ↓
保存为本地 adapter 草稿
  ↓
可选：同步到共享 adapter registry
  ↓
后续用户扫描同一游戏时自动复用
```

## 3. 游戏网络类型

| 类型 | 含义 | 推荐方案 |
|---|---|---|
| `lan_ip_direct` | 游戏本身支持 LAN 或 Join via IP | 先启动通用组网，朋友连接房主虚拟 IP 和游戏端口 |
| `dedicated_server` | 需要或推荐专用服务端 | 房主启动服务端，朋友连接房主虚拟 IP:端口 |
| `tcp_port_proxy_needed` | 游戏服务只监听本机或需要 TCP 转发 | 房主启动 TCP 端口代理，把虚拟 IP 端口转发到本机游戏端口 |
| `udp_broadcast_needed` | 游戏依赖 LAN 广播/组播发现 | 未来需要 UDP 广播桥；当前应标记为能力待实现或手动直连兜底 |
| `steam_lobby_direct_possible` | Steam Lobby 负责发现，但连接可直连 | 保留 Steam 入口说明，同时优先尝试虚拟 IP/直连 |
| `steam_relay_plugin` | 需要 Steam Networking / Relay 插件路线 | 当前仅作为未来插件入口，不作为 MVP 默认承诺 |
| `mod_required` | 需要 Mod 才能把联机方式转换为可控 LAN/IP | 显示 Mod 依赖和风险，不自动安装 |
| `official_only` | 只能通过官方服务器/平台联机 | 明确说明联机助手不能转换为本地联机 |
| `not_supported` | 已确认暂不支持 | 不给出误导性启动项 |
| `unknown_need_review` | 未确认 | 引导管理员认定，不伪装为已支持 |

## 4. adapter 中必须沉淀的连接方案

`connection_plan` 应至少包含：

- `summary`：一句话说明这个游戏怎么联机。
- `host_role`：房主步骤。
- `join_role`：加入者步骤。
- `default_join_host`：默认连接主机，通常是房主虚拟 IP 或“按游戏提示”。
- `default_join_port`：默认连接端口。
- `requires_virtual_lan`：是否需要 n2n/Radmin/Manual LAN 等虚拟局域网。
- `requires_tcp_port_proxy`：是否需要 TCP 端口代理。
- `requires_udp_broadcast_bridge`：是否需要 UDP 广播桥。
- `requires_dedicated_server`：是否需要专用服务端。
- `invite_template`：邀请好友时追加的游戏特定说明。
- `troubleshooting`：失败时优先检查的点。

## 5. 发布级要求

- 未知游戏必须显示“需要判断”，不能给绿色结论。
- 推荐页和邀请包必须来自 adapter / 后端分析结果，而不是前端硬编码假状态。
- adapter 同步失败不能覆盖本地可用 adapter。
- 本地草稿和共享库 adapter 要区分来源与可信度。
- 需要 UDP 广播桥的游戏，在 UDP 功能未完成前必须显示“能力待实现”，不能暗示已经支持。

## 6. 下一步实现顺序

1. 完成推荐页 `connection_plan` 展示和邀请包接入。
2. 在适配器管理页增加“未知游戏认定”入口，允许从扫描结果一键创建 adapter 草稿。
3. 增加 adapter 可信度/验证状态字段，例如：`verified`、`community_draft`、`local_draft`、`needs_review`。
4. 把诊断报告和推荐页关联：如果游戏声明需要 TCP 代理或 UDP 广播桥，诊断里要出现对应检查项。
5. 开始 UDP 端口代理 MVP，再做 UDP 广播桥 MVP。
