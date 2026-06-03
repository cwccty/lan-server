# 发布前端到端验证日志

创建时间：2026-06-03 13:07:04 +08:00

本日志记录 `docs/RELEASE_VALIDATION_PLAN.md` 的实际执行结果。原则：只记录真实执行过的证据；没有执行的项目必须标记为待人工验证，不能写成通过。

## 1. 本轮范围

执行阶段：单机自动化验证 + 单机人工验证待办清单。

本轮可自动化验证：

- registry index 生成工具；
- `adapter-registry/index.json` 解析；
- 前端生产构建；
- Rust 后端检查；
- Tauri release 打包；
- TCP 端口代理单元测试；
- UDP 端口代理单元测试；
- UDP 广播桥单元测试；
- release 可执行文件存在性。

本轮待人工验证：

- 客户端启动后无白色命令框、透明残留窗口；
- 页面逐项打开；
- 适配器管理页同步本地示例库与 GitHub 默认共享库的 UI 明细；
- 通用组网中心里的 TCP/UDP/广播桥按钮点击体验；
- 当前游戏上下文诊断 UI；
- Terraria 服务端 30 秒稳定性；
- VPS/supernode 与双机联机。

## 2. 自动化验证结果

### registry index 生成工具

状态：PASS
耗时：0.71s

```text
updated E:\Documents\联机助手\adapter-registry\index.json
games: 3
- minecraft_java 0852d4e55475ff746e0570b0aebe7b63300b290d00ef3a52e9712d0d8d929ea1
- stardew_valley 4ed34f221144fdd739bc6832c96a8c9b5def3b71908383280000360858552c19
- terraria 304032f5cd2cf00916b7d61ed728cf5aa4107d80a0bfd36c1cf31ea738b58715
```
### registry index JSON 解析

状态：PASS
耗时：0.11s

```text
games=3
minecraft_java games/minecraft_java.json 0852d4e55475ff746e0570b0aebe7b63300b290d00ef3a52e9712d0d8d929ea1
stardew_valley games/stardew_valley.json 4ed34f221144fdd739bc6832c96a8c9b5def3b71908383280000360858552c19
terraria games/terraria.json 304032f5cd2cf00916b7d61ed728cf5aa4107d80a0bfd36c1cf31ea738b58715
```
### 前端生产构建

状态：PASS
耗时：3.95s

```text

> lan-helper@0.1.0 build
> tsc && vite build

[36mvite v7.3.3 [32mbuilding client environment for production...[36m[39m
transforming...
[32m✓[39m 45 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m  0.40 kB[22m[1m[22m[2m │ gzip:  0.29 kB[22m
[2mdist/[22m[35massets/index-nsB57BtH.css  [39m[1m[2m  8.69 kB[22m[1m[22m[2m │ gzip:  2.71 kB[22m
[2mdist/[22m[36massets/index-sttUmNrL.js   [39m[1m[2m325.12 kB[22m[1m[22m[2m │ gzip: 96.86 kB[22m
[32m✓ built in 934ms[39m
```
### Rust 后端检查

状态：PASS
耗时：2.28s

```text
cargo :    Compiling lan-helper v0.1.0 (E:\Documents\联机助手\src-tauri)
At line:30 char:30
+ ... Step 'Rust 后端检查' { cargo check --manifest-path src-tauri\Cargo.toml }
+                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (   Compiling la...联机助手\src-tauri):String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.19s
```
### TCP 端口代理单元测试

状态：PASS
耗时：10.72s

```text
cargo :    Compiling lan-helper v0.1.0 (E:\Documents\联机助手\src-tauri)
At line:31 char:33
+ ... 端口代理单元测试' { cargo test --manifest-path src-tauri\Cargo.toml port_prox ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (   Compiling la...联机助手\src-tauri):String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
    Finished `test` profile [unoptimized + debuginfo] target(s) in 10.21s
     Running unittests src\lib.rs (src-tauri\target\debug\deps\lan_helper_lib-bcca3b97bd874acf.exe)

running 2 tests
test core::port_proxy::tests::tcp_proxy_forwards_bytes_end_to_end ... ok
test core::port_proxy::tests::self_test_reports_success ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.24s

     Running unittests src\main.rs (src-tauri\target\debug\deps\lan_helper-75cb69cd88bfb5ad.exe)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```
### UDP 端口代理单元测试

状态：PASS
耗时：10.62s

```text
cargo :    Compiling lan-helper v0.1.0 (E:\Documents\联机助手\src-tauri)
At line:32 char:33
+ ... 端口代理单元测试' { cargo test --manifest-path src-tauri\Cargo.toml udp_proxy ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (   Compiling la...联机助手\src-tauri):String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
    Finished `test` profile [unoptimized + debuginfo] target(s) in 10.14s
     Running unittests src\lib.rs (src-tauri\target\debug\deps\lan_helper_lib-bcca3b97bd874acf.exe)

running 2 tests
test core::udp_proxy::tests::udp_proxy_forwards_datagrams_end_to_end ... ok
test core::udp_proxy::tests::self_test_reports_success ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.23s

     Running unittests src\main.rs (src-tauri\target\debug\deps\lan_helper-75cb69cd88bfb5ad.exe)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```
### UDP 广播桥单元测试

状态：PASS
耗时：12.94s

```text
cargo :    Compiling lan-helper v0.1.0 (E:\Documents\联机助手\src-tauri)
At line:33 char:32
+ ...  广播桥单元测试' { cargo test --manifest-path src-tauri\Cargo.toml udp_broad ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (   Compiling la...联机助手\src-tauri):String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
    Finished `test` profile [unoptimized + debuginfo] target(s) in 12.42s
     Running unittests src\lib.rs (src-tauri\target\debug\deps\lan_helper_lib-bcca3b97bd874acf.exe)

running 2 tests
test core::udp_broadcast_bridge::tests::udp_broadcast_bridge_forwards_discovery_packet ... ok
test core::udp_broadcast_bridge::tests::self_test_reports_success ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 4 filtered out; finished in 0.21s

     Running unittests src\main.rs (src-tauri\target\debug\deps\lan_helper-75cb69cd88bfb5ad.exe)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```
### Tauri release 打包

状态：PASS
耗时：45.38s

```text

> lan-helper@0.1.0 tauri:build
> tauri build

node.exe :         Info Looking up installed tauri packages to check mismatched versions...
At line:1 char:1
+ & "C:\nvm4w\nodejs/node.exe" "C:\nvm4w\nodejs/node_modules/npm/bin/np ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (        Info Lo...hed versions...:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
     Running beforeBuildCommand `npm run build`

> lan-helper@0.1.0 build
> tsc && vite build

[36mvite v7.3.3 [32mbuilding client environment for production...[36m[39m
transforming...
[32m✓[39m 45 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m  0.40 kB[22m[1m[22m[2m │ gzip:  0.29 kB[22m
[2mdist/[22m[35massets/index-nsB57BtH.css  [39m[1m[2m  8.69 kB[22m[1m[22m[2m │ gzip:  2.71 kB[22m
[2mdist/[22m[36massets/index-sttUmNrL.js   [39m[1m[2m325.12 kB[22m[1m[22m[2m │ gzip: 96.86 kB[22m
[32m✓ built in 878ms[39m
   Compiling lan-helper v0.1.0 (E:\Documents\联机助手\src-tauri)
    Finished `release` profile [optimized] target(s) in 38.81s
       Built application at: E:\Documents\联机助手\src-tauri\target\release\lan-helper.exe
```
### release exe 存在性

状态：PASS
耗时：0.02s

```text


FullName      : E:\Documents\联机助手\src-tauri\target\release\lan-helper.exe
Length        : 12568064
LastWriteTime : 2026/6/3 13:10:50
```
## 3. 单机人工验证记录

| 项目 | 状态 | 证据 | 备注 |
| --- | --- | --- | --- |
| 客户端启动窗口检查 | 待继续观察 | 用户本轮未报告白框/透明框异常 | 后续完整启动验证继续观察 |
| 页面逐项打开 | 部分通过 | 用户确认游戏扫描、通用组网中心、Terraria 向导、诊断报告四项复测通过 | 其他页面后续继续验证 |
| 同步本地示例库 UI | 通过 | 用户确认同步本地示例库通过，显示结构化结果 | 已完成人工验证 |
| 同步 GitHub 默认共享库 UI | 通过 | 用户确认 GitHub 默认共享库同步通过 | 已完成人工验证 |
| 通用组网中心自测按钮 | 通过 | 用户确认 TCP 代理、UDP 代理、UDP 广播桥自测通过 | 已完成人工验证 |
| 当前游戏上下文诊断 UI | 通过 | 用户确认诊断报告生成后切走再回来可保留上次内容 | 已验证缓存/保留体验 |
| Terraria 服务端 30 秒稳定性 | 通过 | 用户确认 Terraria 服务端 30 秒测试通过 | 已完成人工验证 |


## 3.1 2026-06-03 单机人工复测：加载与缓存体验

用户已确认以下 4 项通过：

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 游戏扫描加载动画 | 通过 | 首次进入/刷新有加载反馈，不再无提示卡顿 |
| 通用组网中心缓存 | 通过 | 再次进入显示缓存，需要主动刷新 |
| Terraria 向导缓存 | 通过 | 后续进入保留状态，并有刷新向导状态入口 |
| 诊断报告保留 | 通过 | 使用一次后再次进入保留上次诊断内容 |

结论：本轮针对卡顿/缓存体验的修复已通过用户人工复测。

## 3.2 2026-06-03 单机人工复测：适配器同步、代理/广播桥、Terraria 服务端

用户已确认以下项目通过：

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 本地示例库同步 UI | 通过 | 适配器管理页同步本地示例库通过 |
| GitHub 默认共享库同步 UI | 通过 | 一键更新共享适配器通过 |
| TCP 端口代理自测 | 通过 | 通用组网中心 TCP 自测通过 |
| UDP 端口代理自测 | 通过 | 通用组网中心 UDP 自测通过 |
| UDP 广播桥自测 | 通过 | 通用组网中心广播桥自测通过 |
| Terraria 服务端 30 秒稳定性 | 通过 | 用户确认 30 秒测试通过 |

结论：单机发布验证中，适配器同步、代理/广播桥自测和 Terraria 服务端稳定性已通过人工复测。
## 4. VPS / 双机 / 游戏内验证记录

| 项目 | 状态 | 证据 | 备注 |
| --- | --- | --- | --- |
| VPS supernode 监听 | 通过 | 用户确认 VPS / supernode 阶段通过 | 已完成人工验证 |
| 客户端 n2n edge 注册 | 通过 | 用户确认客户端 n2n 注册验证通过 | 已完成人工验证 |
| ACK/PONG/[OK] 日志判断 | 通过 | 用户确认 n2n 注册验证通过 | 已完成人工验证 |
| 诊断报告 n2n 状态 | 通过 | 用户确认该阶段通过 | 已完成人工验证 |
| 房主 n2n ACK/PONG | 通过 | 用户确认单机 n2n 验证已完成 | 单机房主侧验证 |
| 房主虚拟 IP 路径 | 通过 | 用户确认单机虚拟 IP 路径已测试 | 单机房主侧验证 |
| 房主 Terraria 7777 端口 | 通过 | 用户确认单机 Terraria 服务端测试已完成 | 单机房主侧验证 |
| Terraria Join via IP 加自己 | 通过 | 用户确认单机加入自己测试已完成 | 单机房主侧验证，不能替代真实加入者 |
| 双机 n2n 互通 | 待人工验证 | - | 需要两台电脑或虚拟机 |
| Terraria 双机 Join via IP | 待人工验证 | - | 需要真实加入者验证 |
| Minecraft Java adapter 审核 | 待人工验证 | - | 需要实际游戏/服务端流程确认 |
| Stardew Valley adapter 审核 | 待人工验证 | - | 需要确认是否误导 LAN/IP 转换 |

## 4.1 2026-06-03 VPS / supernode / n2n 注册验证

用户已确认该阶段通过。

结论：VPS / supernode / n2n 注册链路已通过人工验证。

## 4.2 2026-06-03 单机房主侧最小链路验证

用户已确认完成单机验证。

结论：房主侧最小链路已通过单机验证。该结果证明房主侧 n2n、服务端、虚拟 IP、端口和游戏加入流程可用，但仍不能替代真实双机/虚拟机加入者验证。

## 5. 结论

自动化单机验证、页面缓存体验、适配器同步、代理/广播桥自测、Terraria 服务端 30 秒稳定性、VPS / supernode / n2n 注册链路、单机房主侧最小链路已通过。

当前可以整理为 0.1.0 MVP 测试版发布材料，但最终公开发布前仍建议补齐真实双机/虚拟机加入者验证与首批 adapter 人工审核。

## 2026-06-03 release exe 人工回放验收启动记录

本轮已确认自动预检通过，当前进入 release exe 人工回放验收阶段。

已执行：

```powershell
npm run release:preflight
```

结果：PASS。

待人工回放的 release exe：

```text
E:\Documents\联机助手\src-tauri\target\release\lan-helper.exe
```

本阶段目标不是继续盲目新增功能，而是按发布级流程逐页验证：按钮是否有响应、加载是否有反馈、状态是否来自真实后端、失败是否能明确提示、中文是否正常、页面是否保留合理缓存。

下一步推荐：按“首页 → 方案库 → 游戏扫描 → 推荐方案 → 通用组网中心 → Terraria 向导 → 诊断报告”的顺序打开 release exe 逐项测试，并把异常记录到本文件。

## 2026-06-03 新增人工验证项：加入者邀请包导入

新增测试项：通用组网中心应支持加入者粘贴房主发来的邀请文本，并自动填入 n2n 表单。

测试步骤：

1. 打开 `src-tauri\target\release\lan-helper.exe`。
2. 进入“通用组网中心”。
3. 在“加入者：粘贴好友邀请包自动填入”中粘贴示例：

```text
【联机助手 · 游戏邀请好友包】
游戏：Terraria
房主虚拟 IP：10.10.10.2
n2n community：lan-helper-room-001
n2n supernode：154.64.231.137:7777
分配给你的虚拟 IP：10.10.10.3
n2n 密钥：lan-helper-secret
建议游戏端口：7777
```

4. 点击“从邀请包导入到下方表单”。
5. 确认下方字段被填入：
   - community = `lan-helper-room-001`
   - 密钥 = `lan-helper-secret`
   - supernode = `154.64.231.137:7777`
   - 本机虚拟 IP = `10.10.10.3`
   - 房主/对方虚拟 IP = `10.10.10.2`
   - 游戏端口 = `7777`
6. 确认导入不会自动启动 n2n；需要用户手动点击“保存 n2n 配置”和“启动 n2n edge”。

状态：待人工验证。

## 2026-06-04 新增人工验证项：参考前端一比一显示

测试目标：确认当前 release exe 显示的是 `C:\Users\ty\Downloads\联机助手 (1)` 的参考前端，而不是旧项目的近似重做版。

测试步骤：

1. 打开 `src-tauri\target\release\lan-helper.exe`。
2. 确认首页视觉与参考项目一致：
   - 左侧 Sidebar 项目包括：首页、方案库、游戏扫描、推荐方案、通用组网中心、Terraria 向导、诊断报告、设置与帮助；
   - 顶部状态栏出现参考 UI 的按钮和图标；
   - 首页标题为“桌面大厅”；
   - 右侧就绪进度卡为参考 UI 的圆环样式；
   - 网络拓扑状态和主面板检查单与参考项目布局一致。
3. 逐个点击导航，确认页面切换和 Toast 动效与参考项目一致。
4. 注意：此阶段允许参考 UI 中仍存在模拟状态；下一阶段会把模拟状态替换为真实 Tauri 后端状态。

状态：待人工验证。

## 2026-06-03 新增人工验证项：参考前端结构级迁移

测试目标：确认新前端不是只换颜色，而是页面结构、交互层级和真实后端状态都符合发布版要求。

测试步骤：

1. 打开 release exe：`src-tauri\target\release\lan-helper.exe`。
2. 检查 App Shell：
   - 左侧 Sidebar 是否为浅色固定导航；
   - 顶部 Topbar 是否显示中文入口；
   - 页面切换是否出现右下角深色 Toast；
   - 顶部状态是否没有伪造延迟或“已连接”。
3. 检查首页：
   - 是否显示“桌面大厅”；
   - Host / Joiner 切换是否正常；
   - 是否显示网络拓扑状态和主面板检查单；
   - 检查单状态是否标为等待真实检测。
4. 检查游戏扫描：
   - 是否显示标题区、搜索/筛选条、扫描工具栏和游戏卡片；
   - 点击真实按钮时是否有加载遮罩或结果提示；
   - 普通浏览器预览中的 Tauri 后端缺失提示不应出现在 release exe 中。
5. 检查通用组网中心：
   - 是否为左侧状态轨道 + 右侧 n2n 配置；
   - n2n、supernode、虚拟网卡、虚拟 IP 状态是否来自真实检测；
   - 保存/启动/停止/刷新按钮仍然调用真实后端。
6. 检查诊断报告：
   - 是否为左侧检测明细 + 右侧深色 N2N 监测卡；
   - 点击“开始诊断”后是否保留真实报告；
   - 不应出现伪造 Mbps、ms、在线率等假指标。

状态：待人工验证。

## 2026-06-03 新增人工验证项：房主邀请与好友导入闭环

测试目标：确认推荐页复制邀请包后，用户能清楚知道好友应在通用组网中心粘贴导入，并且推荐页可把当前邀请参数带入通用组网表单。

测试步骤：

1. 进入“推荐方案”。
2. 选择或分配一个好友虚拟 IP。
3. 点击“复制游戏邀请好友包”。
4. 检查页面提示是否说明：好友进入“通用组网中心 → 加入者：粘贴好友邀请包自动填入”。
5. 点击“把当前邀请参数带到通用组网”。
6. 确认通用组网中心表单中尽可能带入：community、密钥、supernode、房主虚拟 IP、好友虚拟 IP、游戏端口。
7. 粘贴刚才复制的邀请包，再点击“从邀请包导入到下方表单”。
8. 确认导入不会自动启动 n2n，需要用户手动保存和启动。

状态：待人工验证。

## 2026-06-03 新增人工验证项：n2n 表单校验与保存启动一致性

测试目标：确认通用组网中心不会把明显错误的 n2n 参数交给后端，并且启动 edge 前会使用当前表单参数。

测试步骤：

1. 打开 release exe，进入“通用组网中心”。
2. 清空 supernode，确认“保存 n2n 配置”和“保存并启动 n2n edge”被禁用，并显示错误原因。
3. 将本机虚拟 IP 改成 `abc`，确认显示 IPv4 格式错误。
4. 将本机虚拟 IP 和对方 / 房主虚拟 IP 填成同一个值，确认提示 IP 不能重复。
5. 填入正确参数后，确认按钮恢复可点击。
6. 点击“保存并启动 n2n edge”，确认客户端先保存当前表单，再启动 edge，后续状态等待 ACK/PONG。

状态：待人工验证。

## 2026-06-03 新增人工验证项：游戏扫描页共享方案库入口

测试目标：确认游戏扫描页不再出现不可点击的“同步共享库”假入口。

测试步骤：

1. 打开 release exe，进入“游戏扫描”。
2. 查看顶部工具栏，确认有“去同步共享方案库”按钮。
3. 点击该按钮，确认跳转到“方案库 / 适配器管理”。
4. 在方案库页面执行真实共享库同步。
5. 回到游戏扫描页，点击“开始扫描”或“刷新 Steam 游戏”。

状态：待人工验证。

## 2026-06-03 新增人工验证项：游戏扫描页手动目录占位

测试目标：确认没有后端支撑的“选择目录”不再显示为可疑禁用按钮。

测试步骤：

1. 打开 release exe，进入“游戏扫描”。
2. 确认顶部工具栏不再有“选择目录（规划中）”禁用按钮。
3. 确认显示为“手动选择目录：未来能力”标签。
4. 确认页面说明当前扫描来源为 Steam 库、内置适配器、共享库和本地 custom adapter。
5. 确认“开始扫描”“刷新 Steam 游戏”“去同步共享方案库”仍按预期可用。

状态：待人工验证。
