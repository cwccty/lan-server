# n2n 工具放置说明

第一版联机助手不会自动下载 n2n 可执行文件。

请将 Windows 版 n2n edge 可执行文件放到本目录，并命名为以下任一名称：

- `edge.exe`
- `n2n.exe`

联机助手会按顺序检测：

1. `tools/n2n/edge.exe`
2. `tools/n2n/n2n.exe`

运行时生成文件：

- `last_config.json`：最近一次保存的 n2n 配置。
- `n2n.pid`：由联机助手启动的 n2n edge 进程 PID。

这些运行时文件不应提交到版本库。

## edge 和 supernode

- `edge`：运行在每台玩家电脑上的客户端进程，负责创建虚拟网卡，并把本机加入某个 n2n 虚拟网络。
- `supernode`：运行在公网服务器或双方都可访问的机器上，负责帮助多个 edge 互相发现和建立连接。

两个玩家必须使用相同的：

- community / 房间名
- secret / 密钥
- supernode 地址

但必须使用不同的虚拟 IP，例如：

- 房主：`10.10.10.2`
- 朋友：`10.10.10.3`

Terraria 场景下，朋友连接：

```text
房主虚拟 IP:7777
```
