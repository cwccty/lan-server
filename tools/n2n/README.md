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

## 本机已构建的 edge.exe

本机已按 A 方案从 `ntop/n2n` 官方源码构建 Windows 版 edge：

```text
源码目录：tools/n2n/source/n2n
源码提交：31936c8
产物路径：tools/n2n/edge.exe
SHA256：E4AFEFFA39A6DA6A120A4EF9EEE80B7184EA8AE6EF32DED06E960BC54BE9115D
```

由于当前环境没有 autoconf，构建时手动生成了 `config.mak` 和 `include/config.h`，使用 MinGW 工具链编译：

```powershell
$env:PATH='D:\Git\usr\bin;C:\mingw64\bin;' + $env:PATH
mingw32-make edge.exe -j4
```

`edge.exe --help` 已能正常输出 n2n 帮助信息。

注意：`tools/n2n/edge.exe` 和 `tools/n2n/source/` 不提交到 Git；正式分发前应改为可复现构建流水线或经过 SHA256 校验的下载流程。
