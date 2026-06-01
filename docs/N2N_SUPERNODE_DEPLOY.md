# n2n supernode VPS 部署说明

本文记录第一版联机助手推荐的 n2n supernode 部署方式。默认目标 VPS 系统为 Ubuntu / Debian。

## 1. supernode 的作用

supernode 是 n2n 的公共协调节点。玩家电脑上的 edge 会连接到同一个 supernode，并通过相同的 community 和 secret 加入同一个虚拟网络。

典型结构：

```text
房主电脑 edge  →  VPS supernode  ←  朋友电脑 edge
```

如果 P2P 直连成功，supernode 主要负责发现和协调；如果 P2P 失败，流量可能经过 supernode 中继，VPS 距离会明显影响延迟。

## 2. VPS 端口选择

建议先使用一个固定 UDP 端口，例如：

```text
7777
```

注意：这个端口是 n2n supernode 的端口，不一定等于 Terraria 的游戏端口。为了记忆方便，测试阶段可以都用 `7777`，但正式使用时建议区分，例如：

```text
n2n supernode: 7654/udp
Terraria Server: 7777/tcp
```

## 3. 安装 n2n

### 方式 A：系统包安装，优先用于快速测试

在 Ubuntu / Debian VPS 上执行：

```bash
sudo apt update
sudo apt install -y n2n
```

检查是否安装成功：

```bash
which supernode
supernode --help
```

如果系统仓库版本太旧，或者没有 `supernode` 命令，再使用源码构建方式。

### 方式 B：源码构建，推荐用于长期固定版本

```bash
sudo apt update
sudo apt install -y git build-essential cmake pkg-config libssl-dev
git clone https://github.com/ntop/n2n.git
cd n2n
mkdir -p build
cd build
cmake ..
make -j"$(nproc)"
sudo make install
```

检查：

```bash
which supernode
supernode --help
```

## 4. 临时启动 supernode

先用前台方式测试：

```bash
sudo supernode -l 7777
```

如果命令启动后没有退出，说明进程正在监听。

另开一个 SSH 窗口检查端口：

```bash
sudo ss -lunp | grep 7777
```

云厂商安全组和系统防火墙都要放行 UDP 端口。

## 5. 放行防火墙

如果使用 UFW：

```bash
sudo ufw allow 7777/udp
sudo ufw reload
sudo ufw status
```

还需要在 VPS 云厂商控制台放行：

```text
UDP 7777 入站
```

如果你后续把 n2n supernode 端口改成 `7654`，就放行：

```text
UDP 7654 入站
```

## 6. 配置 systemd 常驻运行

创建服务文件：

```bash
sudo nano /etc/systemd/system/n2n-supernode.service
```

写入：

```ini
[Unit]
Description=n2n supernode
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/sbin/supernode -l 7777
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

如果 `which supernode` 输出不是 `/usr/sbin/supernode`，需要把 `ExecStart` 改成真实路径，例如：

```bash
which supernode
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now n2n-supernode
sudo systemctl status n2n-supernode
```

查看日志：

```bash
journalctl -u n2n-supernode -f
```

## 7. 客户端如何填写

假设 VPS 公网 IP 是：

```text
1.2.3.4
```

supernode 端口是：

```text
7777
```

联机助手里填写：

```text
supernode: 1.2.3.4:7777
```

房主：

```text
community: terraria-room-001
secret: 一串双方相同的密码
supernode: 1.2.3.4:7777
local_ip: 10.10.10.2
```

朋友：

```text
community: terraria-room-001
secret: 同一串密码
supernode: 1.2.3.4:7777
local_ip: 10.10.10.3
```

两边保存配置并启动 n2n edge 后，朋友连接：

```text
10.10.10.2:7777
```

这里的 `10.10.10.2` 是房主 n2n 虚拟 IP，后面的 `7777` 是 Terraria Server 端口。

## 8. 延迟判断

先在两台玩家电脑上分别测试到 VPS 的延迟：

```bash
ping 1.2.3.4
```

如果双方 P2P 直连成功，VPS 延迟只影响发现和协调，游戏延迟不一定高。

如果走中继，游戏延迟大约接近：

```text
玩家 A 到 VPS 的延迟 + VPS 到玩家 B 的延迟
```

因此 VPS 很远时，建议后续准备多个 supernode，并让联机助手做测速和推荐。

## 9. 常见问题

### edge 启动失败

- 检查 `tools/n2n/edge.exe` 是否存在。
- 检查杀毒软件是否拦截。
- 检查是否需要管理员权限创建虚拟网卡。

### edge 启动了但互相不通

- 检查 community 是否一致。
- 检查 secret 是否一致。
- 检查 supernode 地址是否一致。
- 检查两边 local_ip 是否冲突。
- 检查 VPS UDP 端口是否放行。

### Terraria 仍连不上

- 房主先测试 `127.0.0.1:7777`。
- 朋友再测试 `10.10.10.2:7777`。
- 如果本机通、朋友不通，优先检查 n2n 或防火墙。
- 如果本机不通，说明 Terraria Server 没有成功监听端口。
