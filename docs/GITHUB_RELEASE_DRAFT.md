# GitHub Release 草稿：联机助手 0.1.0 MVP 测试版

> 这是一个 MVP 测试版，不是“所有游戏一键联机”的最终承诺版。当前重点是验证 n2n 组网、端口代理、UDP 广播桥、游戏适配器和 Terraria 房主侧流程。

## 这个版本是什么

联机助手是面向普通 PC / Steam 玩家的 Windows 小型游戏联机辅助工具。

它把原本分散的联机步骤整理到一个客户端中：

```text
游戏扫描
→ 匹配适配器
→ 推荐联机方案
→ 启动 n2n 组网
→ 按需使用 TCP / UDP / UDP 广播桥
→ 生成邀请好友包
→ 用诊断报告定位失败原因
```

## 新增与已完成能力

### 组网与连接

- n2n edge 启动与状态检测；
- VPS supernode 配置记录；
- 房主 / 加入者虚拟 IP 分配；
- TCP 端口代理；
- UDP 单播端口代理；
- UDP 广播桥；
- 好友邀请包生成。

### 游戏与适配器

- 游戏扫描；
- 推荐方案页；
- 本地 adapter 适配器体系；
- adapter 共享库同步；
- 未知游戏 adapter 草稿创建；
- Terraria 专用服务端向导。

### 诊断与稳定性

- 当前游戏上下文诊断；
- n2n / supernode / edge 状态诊断；
- TCP / UDP / UDP 广播桥自测；
- 页面加载动画与缓存体验优化；
- 发布验证日志和测试版说明文档。

## 当前验证状态

已通过：

- 前端生产构建；
- Rust 后端检查；
- Tauri release 打包；
- TCP 端口代理单元测试；
- UDP 端口代理单元测试；
- UDP 广播桥单元测试；
- 本地示例 adapter 同步；
- GitHub 默认共享库同步；
- VPS / supernode / n2n 注册验证；
- Terraria 服务端 30 秒稳定性；
- 单机房主侧 Join via IP 加自己；
- 页面加载动画、缓存、诊断报告保留体验。

仍建议补测：

- 真实双机 n2n 互通；
- 真实加入者访问房主虚拟 IP；
- Terraria 双机 Join via IP；
- Minecraft Java adapter 真实流程审核；
- Stardew Valley adapter 真实流程审核；
- 不同 NAT / 不同运营商下的稳定性和延迟。

## 快速开始

### 房主

1. 打开联机助手。
2. 进入“适配器管理”，同步共享适配器库。
3. 进入“游戏扫描”，扫描本机游戏。
4. 在“推荐方案”中选择游戏。
5. 进入“通用组网中心”，填写 community、secret、supernode、本机虚拟 IP。
6. 启动 n2n edge，等待 ACK / PONG / [OK]。
7. 如果是 Terraria，进入 Terraria 向导启动服务端。
8. 复制邀请好友包发给加入者。
9. 如遇问题，进入“诊断报告”。

### 加入者

1. 打开联机助手。
2. 使用房主邀请包中的 community、secret、supernode。
3. 设置不同虚拟 IP，例如房主 `10.10.10.2`、加入者 `10.10.10.3`。
4. 启动 n2n edge。
5. 在游戏内连接房主虚拟 IP 和端口。

## 重要说明

当前版本不承诺：

- 所有游戏都能一键联机；
- 所有不能本地联机的游戏都能转换成本地联机；
- 本地同屏游戏能真正变成 LAN/IP 直连游戏；
- Cuphead / 茶杯头这类本地同屏游戏应优先使用 Steam Remote Play 或 Sunshine + Moonlight，不应当成 n2n 局域网游戏处理；
- 绕过正版验证、反作弊、官方账号系统或平台限制；
- Steam Relay / Steamworks 方案已经可用；
- 未审核 adapter 一定正确；
- UDP 广播桥一定适配所有依赖房间列表发现的游戏；
- 单机验证等同于真实双机验证。

## 关于 Terraria 向导

Terraria 向导不是每个游戏都要复制一套的模式。

后续架构是：

```text
通用组网能力
+ 游戏 adapter
+ 少量专用向导
```

大多数游戏应通过 adapter 描述端口、网络类型、推荐步骤和注意事项；只有像 Terraria 这种需要选择世界、启动专用服务端、解析日志和确认端口的复杂游戏，才会做专用向导。

## 推荐反馈内容

如果你愿意测试，请优先反馈：

- 游戏名称和版本；
- 是否能扫描到游戏；
- 推荐方案是否准确；
- n2n 是否能成功注册；
- 房主和加入者的虚拟 IP；
- 游戏端口是否可达；
- 诊断报告中的失败原因；
- 是否需要 TCP 代理、UDP 代理或 UDP 广播桥。

## 下一步计划

- 补齐真实双机 / 虚拟机加入者验证；
- 审核 Minecraft Java adapter；
- 审核 Stardew Valley adapter；
- 持续沉淀共享 adapter；
- 评估发布验证页；
- 预留 Steam Relay / Steamworks 类方案入口。

## v0.1 上传与反馈

发布前请对照 `docs/V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md` 检查：

- `npm run tauri:build` 已重新生成 `lan-helper.exe`；
- `tools\real_exe_smoke_test.ps1` 启动烟测通过；
- `npm run release:preflight` 通过；
- 未完成的真实双机项目仍写为建议补测 / PENDING。

如果你参与测试，请按 `docs/V0_1_USER_FEEDBACK_TEMPLATE.md` 反馈游戏名、版本、房主/加入者虚拟 IP、n2n ACK/PONG、游戏端口、诊断报告和截图。
