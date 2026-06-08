# Steam Relay / P2P ConnectTool 兼容 MVP

日期：2026-06-08

## 当前做了什么

`v0.3.0` 阶段先不把 Steamworks 完整内置进联机助手，而是提供 **ConnectTool 兼容模式**：

- 联机助手负责检测本机 ConnectTool helper 目录；
- 校验 `connecttool-qt.exe`、`steam_api64.dll`、`steamwebrtc64.dll`、`steam_appid.txt`；
- 可选检测 `wintun.dll`，用于 TUN 组网实验路线；
- 读取 `steam_appid.txt` 并展示 AppID；
- 计算 helper exe 和关键 DLL 的 SHA256，方便诊断与复核；
- 检测 Steam 客户端是否运行；
- 检测 ConnectTool helper 是否已经运行；
- 从联机助手启动或停止 helper；
- 在高级工具页给普通用户展示 TCP 转发 / TUN 组网两条路线和复制步骤。

实际 Steam Relay / P2P 通道由用户自备的 ConnectTool helper 完成；联机助手不打包、不分发、不复制外部 DLL。

## 外部依赖

用户需要自己准备 ConnectTool 目录。当前默认检测路径：

```text
E:\BaiduNetdiskDownload\connecttool-qt-1.5.7\connecttool-qt-windows-x86_64
```

目录内建议包含：

| 文件 | 必需 | 用途 |
| --- | --- | --- |
| `connecttool-qt.exe` | 是 | helper 主程序 |
| `steam_api64.dll` | 是 | helper 自带 Steam API 运行依赖 |
| `steamwebrtc64.dll` | 是 | helper Steam/WebRTC 相关运行依赖 |
| `steam_appid.txt` | 是 | helper 使用的 AppID |
| `wintun.dll` | 否 | TUN 组网实验路线 |

联机助手仓库不提交这些二进制文件。

## 房主如何使用 TCP 转发

适合 Palworld、Minecraft 等有“地址 + 端口”的游戏。

1. 先在游戏里开服或开房，确认本机游戏端口已经监听。
   - Palworld 常见端口：`8211`，以服务端配置为准。
   - Minecraft Java 常见端口：`25565`，以服务端或游戏实际显示为准。
2. 打开联机助手 → 高级连接工具 → Steam 中继 / P2P（ConnectTool 兼容）。
3. 确认 helper 目录正确，点击“重新检测”。
4. 如果检测通过，点击“启动 helper”。
5. 在 helper 窗口选择 TCP 转发，填写本地游戏端口并创建房间。
6. 把 helper 显示的 Steam ID、房间或邀请信息发给好友。
7. 好友加入后，让好友在游戏里连接 `127.0.0.1:本地绑定端口` 或 helper 给出的地址。

## 加入者如何使用 TCP 转发

1. 启动 Steam 并登录自己的账号。
2. 打开联机助手 → 高级连接工具 → Steam 中继 / P2P（ConnectTool 兼容）。
3. 确认 helper 目录正确，点击“启动 helper”。
4. 在 helper 中填入房主 Steam ID，或接受房主邀请加入房间。
5. helper 建立转发后，在游戏里连接 `127.0.0.1:本地绑定端口`。
6. 如果失败，复制联机助手中的 Steam 诊断报告，与房主一起核对 Steam、端口、防火墙和 helper 文件。

## TUN 组网路线

TUN 组网适合需要“像在同一局域网”的实验路线，但要求更高：

- 需要 `wintun.dll`；
- 可能需要管理员权限；
- 可能触发防火墙许可；
- 网络行为更接近虚拟网卡，排查成本高于 TCP 转发。

如果游戏支持直接输入地址和端口，优先使用 TCP 转发。

## 当前真实能力

当前 ConnectTool 兼容 MVP 可以做到：

- 发现并校验 helper 文件；
- 展示 SHA256 和 AppID；
- 启动/停止 helper 进程；
- 给房主/加入者提供可复制步骤；
- 给诊断报告说明当前是 ConnectTool 兼容模式；
- 在没有 Steam、缺文件、helper 未运行时给出修复建议。

当前仍不能由联机助手直接完成：

- 原生调用 Steamworks `CreateListenSocketP2P` / `ConnectP2P`；
- 在联机助手内直接创建 Steam Lobby；
- 在联机助手内直接完成好友邀请；
- 在联机助手内直接建立 TCP 转发通道；
- 不依赖 helper 的完整 Steam Relay / P2P 连接。

## 合规边界

- 不修改游戏文件；
- 不绕过 Steam、游戏拥有权、官方账号或反作弊；
- 不把 `E:\BaiduNetdiskDownload` 里的二进制提交进仓库；
- 不把外部 DLL 打包进联机助手；
- ConnectTool 相关能力来自用户自备 helper，联机助手只做检测、启动、说明和诊断。

## 后续原生 Steamworks 计划

下一阶段如果要做完全内置版，需要：

1. 准备合法 Steamworks SDK；
2. 准备项目自己的 AppID；
3. feature-gated 接入 Steamworks SDK 或 FFI；
4. 初始化 Steam API 和 Relay Network Access；
5. 实现 host `CreateListenSocketP2P`；
6. 实现 guest `ConnectP2P`；
7. 实现本地 TCP 转发；
8. 增加连接日志和诊断；
9. 使用两台 Windows、两个 Steam 账号做真实双机验证。
