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
- `n2n.pid`：由联机助手启动的 n2n 进程 PID。

注意：

- `last_config.json` 和 `n2n.pid` 不应提交到版本库。
- 只使用你信任来源的 n2n 可执行文件。
