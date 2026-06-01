# Terraria 端到端测试流程

本文档用于验证联机助手第一版 MVP：游戏检测、网络后端检测、推荐方案、启动服务端、连接说明和诊断报告。

## 1. 前置条件

测试机器：

- Windows 10/11。
- 已安装 Steam 版 Terraria。
- 已构建联机助手：`npm run tauri:build`。

可选网络后端：

- Manual LAN：两台机器已在同一局域网或已有 VPN。
- Radmin VPN：两台机器已加入同一个 Radmin 网络。
- n2n：已将可信来源的 `edge.exe` 或 `n2n.exe` 放入 `tools/n2n/`。

## 2. 单机基础验证

1. 启动 `src-tauri/target/release/lan-helper.exe`。
2. 点击“扫描本机游戏”。
3. 确认 Terraria 出现在列表中。
4. 点击 Terraria 的“分析”。
5. 期望结果：
   - 能力包含 `lan`、`ip_join`、`dedicated_server`。
   - 如果本机已安装 Terraria，应显示检测路径。

## 3. 网络后端验证

### Manual LAN

1. 进入“网络配置”页。
2. 在 Manual LAN 中输入目标机器 IP。
3. 端口输入 `7777`。
4. 点击“测试连接”。

期望结果：

- 若目标机器已启动 Terraria 服务端，`7777` 应可达。
- 若未启动服务端，端口不可达但错误信息应可理解。

### Radmin VPN

1. 启动 Radmin VPN 并加入同一网络。
2. 打开联机助手“网络配置”页。
3. 期望 Radmin 卡片显示可用，并尽量显示虚拟 IP。

### n2n

1. 将 `edge.exe` 或 `n2n.exe` 放入 `tools/n2n/`。
2. 输入：
   - 房间名 / community
   - 密钥
   - supernode 地址
   - 可选本机虚拟 IP
3. 点击“保存 n2n 配置”。
4. 点击“启动 n2n”。
5. 点击“停止 n2n”。

期望结果：

- 无 edge 文件时应提示缺少可执行文件。
- 有 edge 文件时应启动进程并记录 PID。
- 重复启动时不应重复拉起同一个 PID。
- 停止时只停止联机助手记录的 PID。

## 4. Terraria 服务端验证

1. 在推荐方案页选择 Terraria。
2. 点击 Dedicated Server 推荐项的“执行推荐启动项”。
3. 期望启动：

```text
TerrariaServer.exe -port 7777
```

4. 按 Terraria 服务端窗口提示选择世界、人数、密码等。
5. 记录房主虚拟 IP。

## 5. 加入方验证

加入方操作：

1. 确认与房主处于同一 Manual LAN/Radmin/n2n 网络。
2. 启动 Terraria。
3. 选择：

```text
Multiplayer -> Join via IP
```

4. 输入房主虚拟 IP。
5. 输入端口：

```text
7777
```

期望结果：

- 加入成功。
- 若失败，返回联机助手生成诊断报告。

## 6. 诊断报告验证

1. 打开“诊断报告”页。
2. 点击“生成诊断报告”。
3. 点击“复制报告”。
4. 确认报告包含：
   - 应用版本。
   - 操作系统。
   - 游戏扫描结果。
   - 网络后端状态。

报告不得包含：

- Steam 密码或 Cookie。
- SSH Key。
- 浏览器 Cookie。
- 无关用户目录内容。

## 7. 通过标准

MVP Terraria 端到端通过条件：

- Terraria 可被扫描或从适配库显示。
- Terraria 能力分析正确。
- 至少一种网络后端可完成连通性测试。
- 房主能启动 Terraria 服务端。
- 加入方能通过虚拟 IP + `7777` 加入。
- 失败时能生成可复制诊断报告。
