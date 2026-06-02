# 端口代理 MVP 架构设计

## 目标

端口代理是联机助手的第一项“联机能力转换”功能。它不是替代 n2n，而是在已经有 n2n/Radmin/局域网连通的基础上，解决游戏服务端监听地址、端口映射或访问路径不匹配的问题。

核心目标：

1. 房主本机某个游戏服务端已经监听，例如 `127.0.0.1:7777` 或 `0.0.0.0:7777`。
2. 联机助手在房主侧启动代理，监听一个对朋友可访问的地址/端口，例如 `10.10.10.2:7777`。
3. 代理把朋友访问流量转发到真实游戏服务端。
4. 页面显示真实代理状态、监听地址、目标地址、PID/会话 ID、连接数和日志。
5. 推荐页/适配器可以把“需要端口代理”的游戏引导到这个功能。

## 不解决什么

端口代理 MVP 不解决：

- 游戏房间发现问题。只靠局域网广播发现的游戏，需要 UDP 广播桥。
- 官方服务器、Steam Lobby、账号验证、反作弊绑定的问题。
- 任意公网穿透。跨互联网发现仍依赖 n2n/Radmin/Tailscale/已有局域网。
- 自动猜测所有游戏协议。端口来自适配器、用户输入或已知配置。

## 适用场景

优先支持这些情况：

- 游戏支持 IP 直连，但服务端只监听 `127.0.0.1`。
- 游戏端口需要从 A 端口映射到 B 端口。
- 房主想明确监听在 n2n 虚拟 IP 上，让朋友连接 `房主虚拟 IP:端口`。
- 推荐页执行清单显示：本机 `127.0.0.1:端口` 可通，但 n2n 虚拟 IP 端口不可通。

## MVP 协议范围

第一版只做 TCP 代理。

原因：

- 当前 `testConnectivity` 也是 TCP connect。
- TCP 代理更容易实现、诊断和稳定停止。
- 很多 Dedicated Server / 管理端口 / 部分游戏直连端口可以先覆盖。

UDP 代理后续再加，不要和 UDP 广播桥混为一谈：

- UDP 单播代理：转发指定 UDP 端口流量。
- UDP 广播桥：捕获广播/组播发现包并跨网络重新广播。

## 后端模块规划

新增 Rust 模块：

```text
src-tauri/src/core/port_proxy.rs
src-tauri/src/models/port_proxy.rs
```

### 数据模型

建议新增：

```rust
PortProxyConfig {
  id: String,
  protocol: "tcp" | "udp",
  listen_host: String,
  listen_port: u16,
  target_host: String,
  target_port: u16,
  label: Option<String>,
  game_id: Option<String>,
}

PortProxyStatus {
  id: String,
  running: bool,
  protocol: String,
  listen: String,
  target: String,
  active_connections: u32,
  total_connections: u64,
  bytes_in: u64,
  bytes_out: u64,
  last_error: Option<String>,
  logs: Vec<String>,
}
```

### Tauri 命令

建议新增命令：

```text
start_port_proxy(config) -> PortProxyStatus
stop_port_proxy(id) -> PortProxyStatus
list_port_proxies() -> Vec<PortProxyStatus>
get_port_proxy_status(id) -> PortProxyStatus
test_port_proxy(id) -> ConnectivityReport
```

第一版可以只允许同时运行少量代理，甚至先只允许一个默认代理，避免状态复杂。

### 运行方式

推荐使用线程内代理，而不是启动外部 exe：

- `TcpListener` 监听 `listen_host:listen_port`。
- 每个连接 `TcpStream::connect(target_host:target_port)`。
- 双向 copy：客户端 → 目标，目标 → 客户端。
- 使用共享状态表记录连接数、字节数、最近错误。
- 使用停止信号或保存 listener handle，实现可停止。

注意：Rust 标准库没有直接“优雅关闭 listener”的控制句柄，MVP 可采用：

- 保存 stop flag；
- listener 设置 nonblocking；
- 循环 accept，定期检查 stop flag；
- stop 后移除状态。

### 监听地址建议

UI 默认值：

- `listen_host`: 优先使用检测到的 n2n 虚拟 IP，例如 `10.10.10.2`；没有则 `0.0.0.0`。
- `listen_port`: 当前游戏默认端口。
- `target_host`: `127.0.0.1`。
- `target_port`: 当前游戏默认端口。

## 前端入口规划

新增页面或卡片：

1. 推荐页执行清单中增加“端口代理”步骤/入口。
2. 通用组网中心增加“端口代理（实验）”卡片。
3. 未来可独立成“转换工具”页。

MVP 推荐先放在推荐页和通用组网中心，不新开复杂页面。

### UI 字段

```text
协议：TCP
监听地址：10.10.10.2
监听端口：7777
目标地址：127.0.0.1
目标端口：7777
说明：Terraria / 自定义
```

按钮：

- 使用推荐参数填充
- 启动端口代理
- 停止端口代理
- 测试代理监听端口
- 复制连接说明

### 状态展示

展示真实状态：

- 是否运行
- 监听地址
- 目标地址
- 活跃连接数
- 总连接数
- 最近错误
- 最近日志

不要仅凭配置显示“可用”。必须至少有：

- listener 启动成功；
- 或 `testConnectivity(listen_host:listen_port)` 成功；
- 或实际有连接通过。

## 与推荐页执行清单的关系

当前推荐页已有：

- 适配器判断
- 通用组网
- 游戏启动 / 服务端
- 本机端口监听
- 邀请好友

加入端口代理后，清单可升级为：

1. 适配器判断
2. 通用组网
3. 游戏启动 / 服务端
4. 本机端口监听
5. 端口代理
6. 好友连接 / 邀请好友

当检测到：

- `127.0.0.1:端口` 可达；
- `房主虚拟 IP:端口` 不可达；

推荐页可提示：

> 本机服务端已启动，但虚拟 IP 端口不可达，可以尝试启动端口代理：监听房主虚拟 IP:端口 → 转发到 127.0.0.1:端口。

## 与适配器系统的关系

适配器已有 `multiplayer_conversion.methods`，其中包含：

```text
port_proxy
```

当游戏适配器声明 `port_proxy` 时，推荐页应显示端口代理入口。

适配器后续可扩展字段：

```json
"proxy_profiles": [
  {
    "id": "default_tcp",
    "protocol": "tcp",
    "listen_port": 7777,
    "target_host": "127.0.0.1",
    "target_port": 7777,
    "notes": ["服务端只监听本机时使用"]
  }
]
```

MVP 暂不改适配器 schema，先用 `default_ports[0]` 和 `methods.includes('port_proxy')`。

## 诊断和日志

端口代理必须有日志，但要简洁：

- 代理启动：监听地址 → 目标地址。
- 新连接：来源地址。
- 连接关闭：字节数。
- 连接目标失败：错误原因。
- 代理停止。

诊断报告页后续新增检查项：

- `port_proxy_running`
- `port_proxy_listen_reachable`
- `port_proxy_target_reachable`

## 安全边界

- 默认不监听公网地址。若监听 `0.0.0.0`，UI 必须提示风险。
- 不自动开放防火墙。
- 不代理任意敏感本地服务，默认仅使用游戏端口或用户明确填写端口。
- 不把端口代理描述成绕过平台/反作弊能力。
- 只在用户点击启动后运行，退出程序时停止。

## 分阶段实施

### 第 1 阶段：文档和模型

- 写本文档。
- 新增 `PortProxyConfig` / `PortProxyStatus` 类型。
- 新增 Tauri 命令空壳或最小状态结构。

### 第 2 阶段：TCP 代理后端 MVP

- 实现单个 TCP 代理。
- 支持启动、停止、状态、日志。
- 程序退出时清理代理线程。

### 第 3 阶段：前端控制卡片

- 推荐页增加“端口代理”卡片。
- 通用组网中心增加“端口代理（实验）”卡片。
- 支持用当前游戏默认端口自动填充。

### 第 4 阶段：执行清单接入

- 推荐页执行清单新增端口代理状态。
- 邀请包中加入代理监听地址。
- 若代理可用，朋友连接代理监听地址和端口。

### 第 5 阶段：UDP 单播代理 / 广播桥拆分

- 先评估 UDP 单播代理。
- 再做 UDP 广播桥实验版。
- 两者必须在 UI 和文档中明确区分。

## 推荐下一步

下一步先做第 1、2 阶段：

1. 新增端口代理模型和命令。
2. 实现 TCP 代理后端 MVP。
3. 暂时只做一个代理实例。
4. 用命令和诊断验证后，再接 UI。
