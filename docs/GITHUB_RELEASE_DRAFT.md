# GitHub Release 草稿：联机助手 v0.3.0 候选版

> 这是 `v0.3.0` 候选版，重点是把 Steam 中继 / P2P 从“预检入口”推进到 **ConnectTool 兼容 MVP**。它不是完全内置 Steamworks 的最终版，也不承诺所有游戏一键联机。

## 这个版本是什么

联机助手是面向 Windows 玩家和朋友联机的小工具。它把开房、加入、方案选择、诊断修复和特殊连接工具整理到一个桌面客户端里，尽量减少“我该先开游戏还是先启动组网”的困惑。

## v0.3.0 版本重点

### Steam Relay / P2P：ConnectTool 兼容 MVP

- 新增“Steam 中继 / P2P（ConnectTool 兼容）”普通用户界面。
- 支持填写/检测本机 ConnectTool helper 目录。
- 检测必需文件：`connecttool-qt.exe`、`steam_api64.dll`、`steamwebrtc64.dll`、`steam_appid.txt`。
- 可选检测 `wintun.dll`，用于 TUN 组网实验路线。
- 读取 `steam_appid.txt`，展示 AppID。
- 计算 helper exe 和关键 DLL SHA256，方便诊断与复核。
- 检测 Steam 客户端是否运行、ConnectTool helper 是否运行。
- 可从联机助手启动/停止用户自备 helper。
- 页面提供两条普通用户路线：
  - TCP 转发：适合 Palworld、Minecraft 等“地址 + 端口”游戏；
  - TUN 组网：实验路线，适合需要虚拟局域网的场景。
- 提供“复制房主步骤”“复制加入者步骤”“复制诊断报告”。

### 保留 v0.2.0 的用户体验改进

- 首页保持适度信息密度：显示当前状态、房主下一步、加入者下一步和网络拓扑状态。
- 方案库继续展示 Terraria、Palworld、Minecraft Java、Stardew Valley、Cuphead 的适用场景和失败修复方向。
- 特殊连接工具页继续解释端口代理、UDP 广播桥、通用服务端分别什么时候使用。

## 快速开始

1. 下载 `LanHelper-v0.3.0-windows-x64.zip`。
2. 解压到一个普通目录，例如桌面或 `D:\Apps\LanHelper`。
3. 运行解压目录里的 `LanHelper-v0.3.0-windows-x64.exe`。
4. 首次使用建议先进入“方案库”，同步最新游戏方案。
5. 普通 IP/端口或局域网游戏，优先从“开房邀请 / 加入与组网”按步骤操作。
6. 需要 Steam Relay / P2P 时，进入“特殊连接工具”里的“Steam 中继 / P2P（ConnectTool 兼容）”。
7. 按页面提示选择 TCP 转发或 TUN 组网路线，并在 ConnectTool helper 内完成房间/Steam ID/端口配置。

## 当前 ZIP

- 文件名：`LanHelper-v0.3.0-windows-x64.zip`
- SHA256：由发布脚本根据本地 ZIP 自动追加。

## 已知边界

- 当前是 ConnectTool 兼容 MVP：联机助手负责检测、启动、说明和诊断；实际 Steam 通道由用户自备 helper 完成。
- ConnectTool 二进制、Steam DLL、Steamworks SDK 不进入本仓库和发布包。
- 原生内置 Steamworks / Steam Networking Sockets 尚未完成。
- 真实双机 Steam Relay/P2P 联机仍需要两台 Windows、两个 Steam 账号、目标游戏环境进行回归。
- 不承诺绕过 Steam、游戏拥有权、官方服务器、反作弊或 DRM；不修改游戏文件。

## 真实双机回归跟踪

真实双机 Steam Relay/P2P 回归统一在 Issue #1 跟踪：

- https://github.com/cwccty/lan-server/issues/1

在 Issue #1 的 Palworld / Minecraft Java / Stardew Valley / Cuphead 回归表补齐前，请继续把本版本描述为“ConnectTool 兼容 MVP”，不要宣传为原生 Steamworks 或所有目标游戏真实双机已完成。

## 建议反馈内容

如果你参与测试，请反馈：

- 游戏名称和版本；
- 你是房主还是加入者；
- 使用的是开房邀请、方案库建议、特殊连接工具还是远程同屏；
- ConnectTool helper 目录检测结果和诊断报告；
- 房主/加入者最终在游戏里填写的地址、端口或加入方式；
- 截图或录屏中请避免包含私人账号、密钥或聊天内容。
