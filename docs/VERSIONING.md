# 联机助手版本策略

本文记录项目对外版本命名与后续开发节奏。后续由项目维护者按实际验收进度管理版本号，完整上线目标为 `v1.0.0`。

## 当前版本线

| 版本 | 定位 | 主要内容 | 发布/验收边界 |
| --- | --- | --- | --- |
| `v0.1.0` | 旧版基础可用 / 信息密度高版本 | 早期公开测试包，包含较多方案库、诊断、网络与维护信息入口。 | 适合回看功能覆盖与信息密度；不代表所有游戏都已一键联机。 |
| `v0.1.1` | 账号用户 + 个性化设置 + 基础可交付版本 | 新增本地账号、登录/退出、昵称展示、记住我、外观主题、强调色、背景设置与普通用户降噪。 | 已完成基础构建、打包、EXE smoke 与账号/个性化普通用户路径验收；真实双机多游戏回归仍需补齐。 |
| `v0.2.0` | 恢复适度信息密度 + 多联机方式入口 + Steam Relay/P2P 合规预检 MVP | 恢复首页状态/下一步说明、方案分类概览、网络拓扑状态、特殊连接工具说明、方案库多游戏联机闭环文案；加入 `Steam 中继 / P2P（实验）` 合法预检 stub。 | 这是版本候选：包含普通用户说明补齐、方案库多游戏联机闭环文案、Steamworks SDK/AppID/Steam 客户端预检；不代表 Steam P2P 真实联机完成，也不包含 Palworld / Minecraft / Stardew / Cuphead 真实双机回归通过。 |
| `v0.3.0` | Steam Relay/P2P ConnectTool 兼容 MVP | 在高级连接工具中提供 `Steam 中继 / P2P（ConnectTool 兼容）`；检测用户自备 helper 目录、必需文件、AppID、SHA256、Steam 客户端和 helper 进程；支持从联机助手启动/停止 helper；补齐 TCP 转发、TUN 组网、房主/加入者步骤和诊断报告。 | 当前是 ConnectTool 兼容模式，不是原生内置 Steamworks；真实双机 Steam Relay/P2P 仍需两台 Windows、两个 Steam 账号和目标游戏环境回归后才能宣传实机通过。 |
| `v1.0.0` | 完整上线版本 | 多游戏联机流程、诊断闭环、分发更新、真实双机回归与普通用户引导全部完成。 | 需要 Palworld / Minecraft / Stardew / Cuphead 等真实双机回归、分发包、Release asset、诊断报告和修复闭环全部通过。 |

## 命名规则

- `v0.1.x`：补丁版本，用于修复、命名调整、小体验优化、发布资产校正。
- `v0.x.0`：次版本，用于新增功能 MVP、恢复重要信息架构、引入新的联机方式实验入口。
- `v1.0.0`：主版本，用于完整上线；必须满足真实双机、多游戏、打包分发、诊断闭环全部通过。

## 打包规则

- 项目版本以 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 保持一致为准。
- Windows x64 ZIP 脚本默认读取 `package.json` 的版本号，生成：
  - `release-artifacts/LanHelper-v<version>-windows-x64/`
  - `release-artifacts/LanHelper-v<version>-windows-x64.zip`
- 旧目录，例如 `release-artifacts/v0.1.0/`，作为历史交付资料保留，不应被新版本脚本删除或覆盖。
- GitHub Release 更新脚本默认读取 `package.json` 版本并指向 `v<version>`；如需维护旧 Release，可显式传入 `-Version`、`-Tag` 或 `-ZipPath`。

## Steam Relay / Steam P2P 边界

- 仅允许合法合规的 Steamworks / Steam Networking Sockets / Steam Datagram Relay 集成。
- 不做破解、绕过 DRM、盗版联机、伪造拥有权、注入其它游戏进程或复制灰色联机机制。
- 开源 GameNetworkingSockets 不接入 Valve relay，不能冒充为 Steam Relay。
- 本机仅检测到 Steam 客户端或游戏目录中的 `steam_api64.dll` 时，不代表 Steamworks SDK 可用，也不能把游戏目录 DLL 复制或打包进本项目。
- `v0.2.0` 的 Steam 入口只是合法预检与 stub；`v0.3.0` 提供 ConnectTool 兼容 MVP，可检测并启动用户自备 helper，但仍不是原生内置 Steamworks，也不能在未完成双机/双账号回归前宣传实机通过。
