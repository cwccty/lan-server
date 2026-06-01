# n2n 组网说明

本文用于解释联机助手中的 n2n 组网方案，以及 edge、supernode 应该如何配置。

## 1. n2n 是什么

n2n 是一种虚拟局域网方案。它的目标是让不在同一个 Wi-Fi / 路由器下的电脑，看起来像在同一个局域网里。

用于游戏联机时，逻辑是：

```text
房主电脑 edge
    ↓
supernode
    ↓
朋友电脑 edge
```

当两台电脑加入同一个 n2n 网络后，游戏就可以尝试通过虚拟 IP 连接，例如：

```text
10.10.10.2:7777
```

## 2. edge 是什么

`edge` 是运行在每台玩家电脑上的 n2n 客户端。

它负责：

- 创建虚拟网卡；
- 加入指定 community；
- 使用密钥加入同一个虚拟网络；
- 连接 supernode；
- 给本机分配一个虚拟 IP；
- 尝试和其他玩家建立连接。

每个玩家都需要运行一个 edge。

例子：

```text
房主电脑：edge，虚拟 IP 10.10.10.2
朋友电脑：edge，虚拟 IP 10.10.10.3
```

## 3. supernode 是什么

`supernode` 是 n2n 的协调节点。

它负责：

- 让不同玩家的 edge 找到彼此；
- 协调穿透；
- 在必要时辅助转发或中继；
- 作为一个稳定的公共入口。

supernode 通常需要放在：

- 有公网 IP 的 VPS；
- 或双方都能访问的服务器；
- 或局域网测试时的一台固定机器。

如果没有 supernode，异地玩家通常无法互相发现。

## 4. 三个核心参数

### community / 房间名

相当于“房间号”。

同一个房间里的玩家必须填写完全相同的 community。

示例：

```text
terraria-room-001
```

### secret / 密钥

相当于“房间密码”。

同一个房间里的玩家必须填写完全相同的 secret。

示例：

```text
my-secret-password
```

### supernode 地址

格式通常是：

```text
服务器IP或域名:端口
```

示例：

```text
example.com:7777
1.2.3.4:7777
```

## 5. 虚拟 IP 如何配置

每台电脑都要有不同的虚拟 IP。

建议先使用一个私有网段，例如：

```text
房主：10.10.10.2
朋友：10.10.10.3
第三人：10.10.10.4
```

不要让两台电脑填同一个虚拟 IP。

## 6. Terraria 示例

房主：

```text
community: terraria-room-001
secret: 一串双方相同的密码
supernode: 你的supernode地址:端口
local_ip: 10.10.10.2
```

朋友：

```text
community: terraria-room-001
secret: 同一串密码
supernode: 同一个supernode地址:端口
local_ip: 10.10.10.3
```

房主启动 Terraria Server，端口：

```text
7777
```

朋友在 Terraria 中：

```text
Multiplayer
→ Join via IP
→ 10.10.10.2
→ 7777
```

## 7. 当前联机助手里的处理方式

当前客户端已经做了：

- 检测 `tools/n2n/edge.exe` 或 `tools/n2n/n2n.exe`；
- 保存 n2n 配置到 `tools/n2n/last_config.json`；
- 启动 edge；
- 记录 PID 到 `tools/n2n/n2n.pid`；
- 停止由联机助手启动的 edge；
- 尝试读取 n2n 虚拟 IP；
- 生成可复制给朋友的配置说明。

第一版暂不做：

- 自动下载 n2n；
- 自动部署 supernode；
- 官方房间码服务器；
- 自动处理 Windows 虚拟网卡驱动安装。

## 8. 最小可用流程

1. 准备一个可用 supernode。
2. 把 Windows 版 n2n edge 放到：

```text
tools/n2n/edge.exe
```

3. 房主和朋友填写相同的：

```text
community
secret
supernode
```

4. 房主和朋友填写不同的：

```text
local_ip
```

5. 两边点击“保存 n2n 配置”。
6. 两边点击“启动 n2n edge”。
7. 房主启动游戏服务端。
8. 朋友连接房主虚拟 IP 和游戏端口。

## 9. 常见失败原因

- 两边 community 不一致。
- 两边 secret 不一致。
- supernode 地址或端口填错。
- 两边虚拟 IP 冲突。
- Windows 防火墙拦截 edge 或游戏服务端。
- 游戏服务端没有真正监听端口。
- n2n edge 可执行文件版本不兼容。
- supernode 不可达。
