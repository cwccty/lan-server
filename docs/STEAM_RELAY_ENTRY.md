# Steam 中继联机入口（预留）

这是用户之前提到的 connecttool-qt 类方向：借助 Steam Networking / Steam Relay 做房间发现、P2P 或中继。

当前状态：**产品入口已预留，实际后端未接入**。它不会影响 n2n、Radmin、Manual LAN 和 Terraria 向导主线。

## 为什么要预留

联机助手的长期定位不是普通组网工具外壳，而是“多方式联机能力转换平台”。Steam 中继属于平台网络层，适合未来作为可选插件入口：

- 用 Steam Lobby 做房间发现、成员状态、聊天/信令。
- 用 Steam Networking / Steam Datagram Relay 做 P2P 或中继传输。
- 再把信令/传输结果接到端口代理、广播桥或游戏适配器。

## 发布边界

MVP 阶段不承诺 Steam 中继可用。后续实现必须遵守这些边界：

- 只使用官方 Steamworks / Steam Networking SDK，或用户自有 AppID。
- 不做破解服务器。
- 不绕过正版验证。
- 不绕过反作弊。
- 不模拟官方账号服务。
- 不把它包装成“所有 Steam 游戏都能直接联机”。

## 最小 PoC 顺序

1. 新增独立后端/插件：`steam_relay`。
2. 配置 Steam AppID、房间名、房间密钥或邀请码。
3. 实现创建房间 / 加入房间。
4. 实现房间成员列表和文本消息，证明信令闭环。
5. 再评估接入端口代理、UDP 广播桥或虚拟 LAN 桥接。
6. 每一步都要有真实状态诊断，不能只改 UI 显示。

## UI 入口

`src/pages/NetworkSetupPage.tsx` 已加入“Steam 中继联机入口（预留）”卡片：

- Steam AppID / 测试 AppID
- Steam 房间名
- Steam Datagram Relay / Steam Lobby P2P 模式选择
- 制作备注
- 一键复制制作草案

该入口目前保存在本地 `localStorage` 的 `lan-helper-room-state` 中，作为后续开发记忆和插件制作入口。
