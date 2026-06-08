# 发布前端到端验证日志
~~~
创建时间：2026-06-03 13:07:04 +08:00
~~~
本日志记录 `docs/RELEASE_VALIDATION_PLAN.md` 的实际执行结果。原则：只记录真实执行过的证据；没有执行的项目必须标记为待人工验证，不能写成通过。
~~~
## 1. 本轮范围
~~~
执行阶段：单机自动化验证 + 单机人工验证待办清单。
~~~
本轮可自动化验证：
~~~
- registry index 生成工具；
- `adapter-registry/index.json` 解析；
- 前端生产构建；
- Rust 后端检查；
- Tauri release 打包；
- TCP 端口代理单元测试；
- UDP 端口代理单元测试；
- UDP 广播桥单元测试；
- release 可执行文件存在性。
~~~
本轮待人工验证：
~~~
- 客户端启动后无白色命令框、透明残留窗口；
- 页面逐项打开；
- 适配器管理页同步本地示例库与 GitHub 默认共享库的 UI 明细；
- 通用组网中心里的 TCP/UDP/广播桥按钮点击体验；
- 当前游戏上下文诊断 UI；
- Terraria 服务端 30 秒稳定性；
- VPS/supernode 与双机联机。
~~~
## 2. 自动化验证结果
~~~
### registry index 生成工具
~~~
状态：PASS
耗时：0.71s
~~~
```t~~~text
updated <repo>\adapter-registry\index.json
games: 3
- minecraft_java 0852d4e55475ff746e0570b0aebe7b63300b290d00ef3a52e9712d0d8d929ea1
- stardew_valley 4ed34f221144fdd739bc6832c96a8c9b5def3b71908383280000360858552c19
- terraria 304032f5cd2cf00916b7d61ed728cf5aa4107d80a0bfd36c1cf31ea738b58715
```
### registry index JSON 解析
~~~
状态：PASS
耗时：0.11s
~~~
```t~~~text
games=3
minecraft_java games/minecraft_java.json 0852d4e55475ff746e0570b0aebe7b63300b290d00ef3a52e9712d0d8d929ea1
stardew_valley games/stardew_valley.json 4ed34f221144fdd739bc6832c96a8c9b5def3b71908383280000360858552c19
terraria games/terraria.json 304032f5cd2cf00916b7d61ed728cf5aa4107d80a0bfd36c1cf31ea738b58715
```
### 前端生产构建
~~~
状态：PASS
耗时：3.95s
~~~
```t~~~text

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
~~~
状态：PASS
耗时：2.28s
~~~
```t~~~text
cargo :    Compiling lan-helper v0.1.0 (<repo>\src-tauri)
At line:30 char:30
+ ... Step 'Rust 后端检查' { cargo check --manifest-path src-tauri\Cargo.toml }
+                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (   Compiling la...联机助手\src-tauri):String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError

    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.19s
```
### TCP 端口代理单元测试
~~~
状态：PASS
耗时：10.72s
~~~
```t~~~text
cargo :    Compiling lan-helper v0.1.0 (<repo>\src-tauri)
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
~~~
状态：PASS
耗时：10.62s
~~~
```t~~~text
cargo :    Compiling lan-helper v0.1.0 (<repo>\src-tauri)
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
~~~
状态：PASS
耗时：12.94s
~~~
```t~~~text
cargo :    Compiling lan-helper v0.1.0 (<repo>\src-tauri)
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
~~~
状态：PASS
耗时：45.38s
~~~
```t~~~text

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
   Compiling lan-helper v0.1.0 (<repo>\src-tauri)
    Finished `release` profile [optimized] target(s) in 38.81s
       Built application at: <repo>\src-tauri\target\release\lan-helper.exe
```
### release exe 存在性
~~~
状态：PASS
耗时：0.02s
~~~
```t~~~text


FullName      : <repo>\src-tauri\target\release\lan-helper.exe
Length        : 12568064
LastWriteTime : 2026/6/3 13:10:50
```
## 3. 单机人工验证记录
~~~
| 项目 | 状态 | 证据 | 备注 |
| --- | --- | --- | --- |
| 客户端启动窗口检查 | 待继续观察 | 用户本轮未报告白框/透明框异常 | 后续完整启动验证继续观察 |
| 页面逐项打开 | 部分通过 | 用户确认游戏扫描、通用组网中心、Terraria 向导、诊断报告四项复测通过 | 其他页面后续继续验证 |
| 同步本地示例库 UI | 通过 | 用户确认同步本地示例库通过，显示结构化结果 | 已完成人工验证 |
| 同步 GitHub 默认共享库 UI | 通过 | 用户确认 GitHub 默认共享库同步通过 | 已完成人工验证 |
| 通用组网中心自测按钮 | 通过 | 用户确认 TCP 代理、UDP 代理、UDP 广播桥自测通过 | 已完成人工验证 |
| 当前游戏上下文诊断 UI | 通过 | 用户确认诊断报告生成后切走再回来可保留上次内容 | 已验证缓存/保留体验 |
| Terraria 服务端 30 秒稳定性 | 通过 | 用户确认 Terraria 服务端 30 秒测试通过 | 已完成人工验证 |
~~~
~~~
## 3.1 2026-06-03 单机人工复测：加载与缓存体验
~~~
用户已确认以下 4 项通过：
~~~
| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 游戏扫描加载动画 | 通过 | 首次进入/刷新有加载反馈，不再无提示卡顿 |
| 通用组网中心缓存 | 通过 | 再次进入显示缓存，需要主动刷新 |
| Terraria 向导缓存 | 通过 | 后续进入保留状态，并有刷新向导状态入口 |
| 诊断报告保留 | 通过 | 使用一次后再次进入保留上次诊断内容 |
~~~
结论：本轮针对卡顿/缓存体验的修复已通过用户人工复测。
~~~
## 3.2 2026-06-03 单机人工复测：适配器同步、代理/广播桥、Terraria 服务端
~~~
用户已确认以下项目通过：
~~~
| 项目 | 状态 | 证据 |
| --- | --- | --- |
| 本地示例库同步 UI | 通过 | 适配器管理页同步本地示例库通过 |
| GitHub 默认共享库同步 UI | 通过 | 一键更新共享适配器通过 |
| TCP 端口代理自测 | 通过 | 通用组网中心 TCP 自测通过 |
| UDP 端口代理自测 | 通过 | 通用组网中心 UDP 自测通过 |
| UDP 广播桥自测 | 通过 | 通用组网中心广播桥自测通过 |
| Terraria 服务端 30 秒稳定性 | 通过 | 用户确认 30 秒测试通过 |
~~~
结论：单机发布验证中，适配器同步、代理/广播桥自测和 Terraria 服务端稳定性已通过人工复测。
## 4. VPS / 双机 / 游戏内验证记录
~~~
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
~~~
## 4.1 2026-06-03 VPS / supernode / n2n 注册验证
~~~
用户已确认该阶段通过。
~~~
结论：VPS / supernode / n2n 注册链路已通过人工验证。
~~~
## 4.2 2026-06-03 单机房主侧最小链路验证
~~~
用户已确认完成单机验证。
~~~
结论：房主侧最小链路已通过单机验证。该结果证明房主侧 n2n、服务端、虚拟 IP、端口和游戏加入流程可用，但仍不能替代真实双机/虚拟机加入者验证。
~~~
## 5. 结论
~~~
自动化单机验证、页面缓存体验、适配器同步、代理/广播桥自测、Terraria 服务端 30 秒稳定性、VPS / supernode / n2n 注册链路、单机房主侧最小链路已通过。
~~~
当前可以整理为 0.1.0 MVP 测试版发布材料，但最终公开发布前仍建议补齐真实双机/虚拟机加入者验证与首批 adapter 人工审核。
~~~
## 2026-06-03 release exe 人工回放验收启动记录
~~~
本轮已确认自动预检通过，当前进入 release exe 人工回放验收阶段。
~~~
已执行：
~~~
```powershell
npm run release:preflight
```
~~~
结果：PASS。
~~~
待人工回放的 release exe：
~~~
```t~~~text
<repo>\src-tauri\target\release\lan-helper.exe
```
~~~
本阶段目标不是继续盲目新增功能，而是按发布级流程逐页验证：按钮是否有响应、加载是否有反馈、状态是否来自真实后端、失败是否能明确提示、中文是否正常、页面是否保留合理缓存。
~~~
下一步推荐：按“首页 → 方案库 → 游戏扫描 → 推荐方案 → 通用组网中心 → Terraria 向导 → 诊断报告”的顺序打开 release exe 逐项测试，并把异常记录到本文件。
~~~
## 2026-06-03 新增人工验证项：加入者邀请包导入
~~~
新增测试项：通用组网中心应支持加入者粘贴房主发来的邀请文本，并自动填入 n2n 表单。
~~~
测试步骤：
~~~
1. 打开 `src-tauri\target\release\lan-helper.exe`。
2. 进入“通用组网中心”。
3. 在“加入者：粘贴好友邀请包自动填入”中粘贴示例：
~~~
```t~~~text
【联机助手 · 游戏邀请好友包】
游戏：Terraria
房主虚拟 IP：10.10.10.2
n2n community：lan-helper-room-001
n2n supernode：203.0.113.10:7777
分配给你的虚拟 IP：10.10.10.3
n2n 密钥：lan-helper-secret
建议游戏端口：7777
```
~~~
4. 点击“从邀请包导入到下方表单”。
5. 确认下方字段被填入：
   - community = `lan-helper-room-001`
   - 密钥 = `lan-helper-secret`
   - supernode = `203.0.113.10:7777`
   - 本机虚拟 IP = `10.10.10.3`
   - 房主/对方虚拟 IP = `10.10.10.2`
   - 游戏端口 = `7777`
6. 确认导入不会自动启动 n2n；需要用户手动点击“保存 n2n 配置”和“启动 n2n edge”。

状态：待人工验证。

## 2026-06-05 v0.1 发布准备自动化复测
~~~
执行时间：2026-06-05 10:47:27 +08:00
~~~
本节记录本轮进入 v0.1 发布准备后的自动化复测结果。注意：以下 PASS 只代表构建、类型检查、预检守卫和 release exe 存在性通过；真实双机、真实游戏内加入、启动窗口干净仍需人工执行。
~~~
### 自动化命令
~~~
```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run release:preflight
```
~~~
### 自动化结果
~~~
状态：PASS
~~~
关键证据：
~~~
```t~~~text
npm run build: PASS
cargo check --manifest-path src-tauri\Cargo.toml: PASS
npm run release:preflight: PASS
release exe exists: src-tauri\target\release\lan-helper.exe
```
~~~
本轮新增发布守卫：
~~~
```t~~~text
product page cache and concise copy are wired: PASS
real exe validation checklist is wired: PASS
product state consistency audit is wired: PASS
diagnostic repair center closure audit is wired: PASS
conversion engine closure audit is wired: PASS
adapter registry closure audit is wired: PASS
connection method closure audit is wired: PASS
```
~~~
### 当前仍需真实人工验证
~~~
状态：PENDING
~~~
- 启动 release exe 后无白色命令框、透明残留窗口。
- 页面二次进入不卡顿，且缓存不掩盖真实失败。
- VPS supernode 与 n2n ACK/PONG 在真实 exe 中复测。
- 邀请包一键加入在真实 exe 中复测。
- 房主开房向导完整跑一遍。
- Terraria 服务端 30 秒稳定性在真实 exe 中复测。
- TCP/UDP/UDP 广播桥在真实 exe 中自测。
- 真实游戏内 Join via IP 或远程同屏加入。
~~~
操作建议：
~~~
1. 打开 `src-tauri\target\release\lan-helper.exe`。
2. 进入“诊断报告”。
3. 点击“复制真实 EXE 验证清单”。
4. 将清单粘贴到本日志下方。
5. 对每个项目标记 PASS / FAIL / PENDING。
~~~
本阶段结论：
~~~
```t~~~text
自动化发布预检已通过；v0.1 仍需要真实 EXE 人工验证记录后再发布。
```
~~~
## 2026-06-04 新增人工验证项：参考前端一比一显示
~~~
测试目标：确认当前 release exe 显示的是 `<reference-ui-src-parent>` 的参考前端，而不是旧项目的近似重做版。
~~~
测试步骤：
~~~
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
~~~
测试目标：确认新前端不是只换颜色，而是页面结构、交互层级和真实后端状态都符合发布版要求。
~~~
测试步骤：
~~~
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
~~~
测试目标：确认推荐页复制邀请包后，用户能清楚知道好友应在通用组网中心粘贴导入，并且推荐页可把当前邀请参数带入通用组网表单。
~~~
测试步骤：
~~~
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
~~~
测试目标：确认通用组网中心不会把明显错误的 n2n 参数交给后端，并且启动 edge 前会使用当前表单参数。
~~~
测试步骤：
~~~
1. 打开 release exe，进入“通用组网中心”。
2. 清空 supernode，确认“保存 n2n 配置”和“保存并启动 n2n edge”被禁用，并显示错误原因。
3. 将本机虚拟 IP 改成 `abc`，确认显示 IPv4 格式错误。
4. 将本机虚拟 IP 和对方 / 房主虚拟 IP 填成同一个值，确认提示 IP 不能重复。
5. 填入正确参数后，确认按钮恢复可点击。
6. 点击“保存并启动 n2n edge”，确认客户端先保存当前表单，再启动 edge，后续状态等待 ACK/PONG。
状态：待人工验证。

## 2026-06-03 新增人工验证项：游戏扫描页共享方案库入口
~~~
测试目标：确认游戏扫描页不再出现不可点击的“同步共享库”假入口。
~~~
测试步骤：
~~~
1. 打开 release exe，进入“游戏扫描”。
2. 查看顶部工具栏，确认有“去同步共享方案库”按钮。
3. 点击该按钮，确认跳转到“方案库 / 适配器管理”。
4. 在方案库页面执行真实共享库同步。
5. 回到游戏扫描页，点击“开始扫描”或“刷新 Steam 游戏”。
状态：待人工验证。

## 2026-06-03 新增人工验证项：游戏扫描页手动目录占位
~~~
测试目标：确认没有后端支撑的“选择目录”不再显示为可疑禁用按钮。
~~~
测试步骤：
~~~
1. 打开 release exe，进入“游戏扫描”。
2. 确认顶部工具栏不再有“选择目录（规划中）”禁用按钮。
3. 确认显示为“手动选择目录：未来能力”标签。
4. 确认页面说明当前扫描来源为 Steam 库、内置适配器、共享库和本地 custom adapter。
5. 确认“开始扫描”“刷新 Steam 游戏”“去同步共享方案库”仍按预期可用。
状态：待人工验证。

## 2026-06-05 11:11:33 v0.1 发布准备 preflight 守卫接入复测

本节记录 v0.1 发布准备文档进入自动预检后的复测结果。

### 本次新增守卫

~~~text
v0.1 release readiness docs are wired: PASS
~~~

守卫覆盖：

- `docs/V0_1_RELEASE_READINESS.md` 必须存在；
- `docs/GITHUB_RELEASE_DRAFT.md` 必须存在；
- `docs/RELEASE_NOTES_DRAFT.md` 必须存在；
- `docs/NEXT_BIG_DIRECTIONS.md` 必须存在；
- 发布准备文档必须包含 v0.1、`lan-helper.exe`、真实 EXE、GitHub Release、房主/好友流程、已知限制；
- 发布准备文档必须保留 PENDING 人工验证边界，不能把未验证项目写成 PASS；
- 发布文案必须避免“所有游戏一键联机”式过度承诺；
- 下一阶段路线必须明确从 v0.1 发布准备进入真实 EXE 人工验证。

### 自动化命令

~~~powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run release:preflight
~~~

### 结果

~~~text
npm run build: PASS
cargo check --manifest-path src-tauri\Cargo.toml: PASS
npm run release:preflight: PASS
v0.1 release readiness docs are wired: PASS
~~~

### 仍需人工验证

状态：PENDING

- 启动真实 `src-tauri\target\release\lan-helper.exe` 后确认无白色命令框、透明残留窗口。
- 连续进入首页、游戏扫描、推荐方案、通用组网中心、Terraria 向导、诊断报告，确认二次进入不卡顿。
- 在真实 EXE 中复测 VPS supernode 与 n2n ACK/PONG。
- 在真实 EXE 中复测邀请包一键加入、房主开房向导、Terraria 30 秒稳定性。
- 真实游戏内 Join via IP 或远程同屏加入仍需按实际环境验证。

## 2026-06-05 11:25:07 真实 EXE 启动烟测

~~~text
status: PASS
exe: <repo>\src-tauri\target\release\lan-helper.exe
pid: 53216
startup_seconds: 5
process_alive: True
window_ready: True
main_window_handle: 10489510
main_window_title: 联机助手
webview_children: 6
console_like_children: 0
console_like_detail: 未发现 cmd/conhost/powershell/edge/n2n 启动期子进程
child_processes: msedgewebview2.exe#24408, msedgewebview2.exe#56124, msedgewebview2.exe#34200, msedgewebview2.exe#61080, msedgewebview2.exe#25932, msedgewebview2.exe#41644
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。



## 2026-06-05 11:32:48 v0.1 release EXE 重新打包与启动烟测

本节记录本轮对真实 release EXE 的自动化可验证结果。

### 已执行

~~~powershell
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
powershell -ExecutionPolicy Bypass -File tools\real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog
npm run release:preflight
~~~

### 结果

~~~text
cargo check: PASS
npm run tauri:build: PASS
release exe: <repo>\src-tauri\target\release\lan-helper.exe
release exe size: 13328384 bytes
release exe last write: 06/05/2026 11:21:23
real exe startup smoke: PASS
main window title: 联机助手
webview children: 6
console-like startup children: 0
npm run release:preflight: PASS
real exe startup smoke script is wired: PASS
game launch console hiding is wired: PASS
~~~

### 仍需人工验证

状态：PENDING

- 真实点击页面二次进入、n2n ACK/PONG、邀请包一键加入、房主开房向导和 Terraria 30 秒稳定性。
- 真实双机或虚拟机加入者连接房主虚拟 IP 与端口。

## 2026-06-05 11:43:12 v0.1 GitHub Release 上传清单与反馈模板

本节记录发布上传动作的文档闭环。

### 新增文件

- `docs/V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md`
- `docs/V0_1_USER_FEEDBACK_TEMPLATE.md`

### 已接入预检

~~~text
v0.1 github release upload checklist is wired: PASS
~~~

该守卫检查：

- Release tag / title / `lan-helper.exe` 上传项；
- `npm run tauri:build`、真实 EXE 启动烟测、`npm run release:preflight` 上传前检查；
- PENDING 人工验证边界；
- 不宣传“所有游戏一键联机”；
- 用户反馈模板包含游戏名、版本、房主/加入者虚拟 IP、ACK/PONG、端口、诊断报告、本地同屏边界。

### 自动化结果

~~~text
npm run release:preflight: PASS
npm run build: PASS
cargo check --manifest-path src-tauri\Cargo.toml: PASS
~~~

### 仍需人工验证

状态：PENDING

- 按真实 EXE 验证清单逐项点击测试。
- 将 n2n ACK/PONG、邀请包、房主开房、Terraria 和真实加入结果写回本日志。
## 2026-06-05 11:48:40 当前长期目标完成证据审计接入

本节记录长期目标 6 条主线的完成证据审计已经进入发布预检。

### 新增/更新

- `docs/GOAL_COMPLETION_AUDIT.md` 顶部新增“当前长期目标完成证据审计”。
- 审计覆盖：邀请包一键加入闭环、房主开房向导闭环、游戏适配器与共享方案库增强、多联机方式支持、非局域网游戏转换方案引擎、诊断页问题修复中心。
- 审计结论明确：核心功能闭环已接入并通过自动化发布预检；真实双机和真实游戏内加入仍为 PENDING，因此不调用 goal complete。
- `tools/release_preflight.ps1` 新增 `current long-term goal audit is recorded` 守卫。

### 验证

~~~text
npm run release:preflight: PASS
current long-term goal audit is recorded: PASS
~~~
## 2026-06-05 12:02:44 真实 EXE 人工验证记录器接入

本节记录诊断页从“复制验证清单”升级为“可记录 PASS / FAIL / PENDING”的进展。

### 新增能力

- `src/product-ui/realExeValidationChecklist.ts` 新增本地人工验证结果存储：`REAL_EXE_VALIDATION_RESULTS_KEY`。
- 诊断页真实 EXE 验证卡新增手动记录器：每个验证项可标记 `PASS` / `FAIL` / `PENDING`。
- “复制真实 EXE 验证清单”会带上当前人工记录摘要和每项记录结果。
- 可一键清空本轮记录，避免不同测试轮次混在一起。

### 验证

~~~text
npm run build: PASS
cargo check --manifest-path src-tauri\Cargo.toml: PASS
npm run release:preflight: PASS
real exe validation checklist is wired: PASS
~~~

### 仍需人工执行

状态：PENDING

- 使用真实 release EXE 点击每个核心流程后，在诊断页记录 PASS / FAIL / PENDING。
- 将复制出的验证清单粘贴回本日志。
## 2026-06-05 12:07:14 真实 EXE 启动烟测

~~~text
status: PASS
exe: <repo>\src-tauri\target\release\lan-helper.exe
pid: 20424
startup_seconds: 5
process_alive: True
window_ready: True
main_window_handle: 44500836
main_window_title: 联机助手
webview_children: 6
console_like_children: 0
console_like_detail: 未发现 cmd/conhost/powershell/edge/n2n 启动期子进程
child_processes: msedgewebview2.exe#58460, msedgewebview2.exe#44116, msedgewebview2.exe#29448, msedgewebview2.exe#14672, msedgewebview2.exe#23116, msedgewebview2.exe#44760
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。

## 2026-06-05 12:09:15 带人工验证记录器的 release EXE 重新打包

本节记录“真实 EXE 人工验证记录器”进入 release 产物后的自动化结果。

### 已执行

~~~powershell
npm run tauri:build
powershell -ExecutionPolicy Bypass -File tools\real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog
npm run release:preflight
~~~

### 结果

~~~text
npm run tauri:build: PASS
release exe: <repo>\src-tauri\target\release\lan-helper.exe
release exe size: 13332480 bytes
release exe last write: 06/05/2026 12:06:52
real exe startup smoke: PASS
main window title: 联机助手
console-like startup children: 0
npm run release:preflight: PASS
real exe validation checklist is wired: PASS
~~~

### 仍需人工验证

状态：PENDING

- 打开 release EXE 后进入诊断页，在“真实 EXE 人工验证”卡片逐项标记 PASS / FAIL / PENDING。
- 复制验证清单并粘贴到本日志。
## 2026-06-05 12:23:37 真实 EXE 启动烟测

~~~text
status: PASS
exe: <repo>\src-tauri\target\release\lan-helper.exe
pid: 60948
startup_seconds: 5
process_alive: True
window_ready: True
main_window_handle: 30870602
main_window_title: 联机助手
webview_children: 6
console_like_children: 0
console_like_detail: 未发现 cmd/conhost/powershell/edge/n2n 启动期子进程
child_processes: msedgewebview2.exe#21676, msedgewebview2.exe#28880, msedgewebview2.exe#23116, msedgewebview2.exe#40772, msedgewebview2.exe#61492, msedgewebview2.exe#51300
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。

## 2026-06-05 12:24:18 - 6 条长期主线自动化复测与真实 EXE 启动烟测
- 已基于当前工作树复测长期目标相关守卫：邀请包一键加入、房主开房向导、适配器共享库、多联机方式、非 LAN 转换引擎、诊断修复中心、发布级加载/缓存/状态一致性。
- `npm run build` 通过，前端生产构建成功；Vite 仍提示 chunk 较大，这是性能优化提示，不是构建失败。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过，Rust/Tauri 后端检查成功。
- `npm run release:preflight` 通过，所有 release 守卫 PASS；包括 invite one-click join、host room wizard、adapter registry、connection method、conversion engine、diagnostic repair center、real exe validation checklist。
- 已运行 `tools\real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog`，真实 release EXE 启动烟测 PASS：窗口标题“联机助手”，WebView 子进程 6 个，启动期 console-like 子进程 0 个。
- 当前仍不能把长期目标标记为 complete：真实双机/真实好友加入、真实游戏内加入、更多 adapter 用户审核仍需要人工或外部用户验证。

下一步推荐：打开真实 release EXE，在诊断页逐项标记 PASS / FAIL / PENDING；核心项可接受后进入 v0.1 GitHub Release 小范围测试。
## 2026-06-05 12:34:42 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 14
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.

## 2026-06-05 12:36:51 - v0.1 本地发布包脚本 v1
- 新增 `tools/prepare_v0_1_release_package.ps1`，用于把 release exe、发布正文、发布说明、反馈模板、验证日志、adapter-registry、SHA256 和 manifest 整理到 `release-artifacts\v0.1.0\`。
- `package.json` 新增 `npm run release:package`。
- `docs/V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md` 已加入发布包命令、`SHA256SUMS.txt` 和 `release-manifest.json` 上传/核对要求。
- `tools/release_preflight.ps1` 新增 required file 和 `v0.1 release package script is wired` 守卫，防止发布流程漏掉本地打包步骤。
- 已实际执行 `npm run release:package -- -Clean -AppendLog`，发布包生成成功；`release-artifacts/` 已加入 `.gitignore`，本地用于上传但不作为源码提交。

验证：
- `npm run release:package -- -Clean -AppendLog` 通过。
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，新增 `v0.1 release package script is wired` 为 PASS。

下一步推荐：打开真实 EXE 做人工验证；核心项可接受后，从 `release-artifacts\v0.1.0\` 上传 `lan-helper-v0.1.0.exe` 和 `SHA256SUMS.txt` 到 GitHub Release。

## 2026-06-05 12:44:17 - 适配器共享库校验器 v1
- 新增 `tools/validate_adapter_registry.ps1`。
- `package.json` 新增 `npm run adapter:validate`。
- `tools/release_preflight.ps1` 新增 required file，并在 release preflight 中执行 `adapter registry schema validation`。
- 校验器会检查 index JSON、adapter 文件存在性、SHA256、必要字段、端口范围、连接计划完整性。
- 重点增加非 LAN 边界保护：Cuphead/本地同屏类 adapter 不能误标 `can_convert_to_lan=true`，不能要求虚拟 LAN，不能推荐 `virtual_lan`，不能暴露 LAN 加入端口，必须走 Steam Remote Play 或 Sunshine + Moonlight 等远程同屏路线。

验证：
- `npm run adapter:validate` 通过：Adapters=5，Warnings=0，Errors=0。
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，新增 `adapter registry schema validation` 为 PASS。

下一步推荐：继续做真实 EXE 人工验证；发布后新增 adapter 时先运行 `npm run adapter:validate`，再同步到 GitHub Pages/VPS 共享库。
## 2026-06-05 12:50:32 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 15
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.

## 2026-06-05 12:52:47 - 真实 EXE 人工验证指南 v1
- 新增 `docs/REAL_EXE_MANUAL_VALIDATION_GUIDE.md`，把 v0.1 发布前最后一轮人工验证拆成 A/B/C/D/E 五组：真实 EXE 启动与页面缓存、邀请包一键加入、房主开房向导/Terraria、adapter 与非 LAN 边界、诊断修复中心。
- 指南明确每个 PASS 必须来自真实 EXE、真实进程、真实端口、真实 n2n 日志、真实游戏内操作或诊断报告；双机未测项必须保持 PENDING。
- 指南覆盖：`仅填入参数`、`保存并启动 n2n`、加入结果卡片、失败进入诊断、复制错误给房主、成功后连接房主虚拟 IP 和端口。
- 指南覆盖房主流程：选择游戏、推荐方案、启动组网、启动服务端/游戏、检测端口、分配好友 IP、生成邀请包。
- 指南覆盖非 LAN 边界：Cuphead/本地同屏不能真正变成 LAN，应走 Steam Remote Play 或 Sunshine + Moonlight。
- `tools/prepare_v0_1_release_package.ps1` 已把该指南复制进 `release-artifacts\v0.1.0\REAL_EXE_MANUAL_VALIDATION_GUIDE.md`。
- `docs/V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md` 已加入人工验证指南作为发布材料。
- `tools/release_preflight.ps1` 新增 required file 和 `real exe manual validation guide is wired` 守卫。

验证：
- `npm run release:package -- -Clean -AppendLog` 通过，发布包中已包含 `REAL_EXE_MANUAL_VALIDATION_GUIDE.md`。
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\Cargo.toml` 通过。
- `npm run release:preflight` 通过，`real exe manual validation guide is wired` 为 PASS。

下一步推荐：按 `docs/REAL_EXE_MANUAL_VALIDATION_GUIDE.md` 打开真实 EXE 做人工验证；核心项可接受后发布 v0.1 小范围测试。

## 2026-06-05 13:05:13 真实 EXE 启动烟测

~~~text
status: FAIL
exe: <repo>\src-tauri\target\release\lan-helper.exe
pid: 15972
startup_seconds: 5
process_alive: True
window_ready: True
main_window_handle: 21958260
main_window_title: 联机助手
webview_children: 6
console_like_children: 1
console_like_detail: powershell.exe#19884
child_processes: msedgewebview2.exe#50324, msedgewebview2.exe#18864, msedgewebview2.exe#9604, msedgewebview2.exe#51436, msedgewebview2.exe#8760, msedgewebview2.exe#52992, powershell.exe#19884
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。

## 2026-06-05 13:06:21 真实 EXE 启动烟测

~~~text
status: PASS
exe: <repo>\src-tauri\target\release\lan-helper.exe
pid: 56188
startup_seconds: 5
process_alive: True
window_ready: True
main_window_handle: 27723648
main_window_title: 联机助手
webview_children: 6
console_like_children: 0
console_like_detail: 未发现 cmd/conhost/powershell/edge/n2n 启动期子进程
child_processes: msedgewebview2.exe#61952, msedgewebview2.exe#30544, msedgewebview2.exe#51308, msedgewebview2.exe#24580, msedgewebview2.exe#46932, msedgewebview2.exe#29604
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。
## 2026-06-05 13:06:57 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 15
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.

## 2026-06-05 13:07:33 - 诊断页人工验证指南入口与真实 EXE 复测
- 诊断页“真实 EXE 人工验证”卡片新增两个入口：`打开人工验证指南` 与 `复制人工验证指南`。
- 新增 `src/product-ui/realExeManualValidationGuide.ts`，提供简版人工验证指南文本，覆盖真实 EXE、邀请包一键加入、房主开房、Terraria、adapter、Cuphead/本地同屏边界和诊断修复中心。
- `ProductDiagnosticsView.tsx` 现在会优先尝试打开 `docs\\REAL_EXE_MANUAL_VALIDATION_GUIDE.md`，如果发布包目录下运行，则尝试打开 `REAL_EXE_MANUAL_VALIDATION_GUIDE.md`；打开失败时提示用户复制指南文本。
- `tools/release_preflight.ps1` 已把 `src/product-ui/realExeManualValidationGuide.ts` 加入 required file，并补强 `real exe validation checklist is wired` 守卫。

验证：
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。
- `npm run release:preflight` 通过。
- 已重新执行 `npm run tauri:build`，生成包含人工验证指南入口的新 release EXE。
- 连续执行 tauri build + 烟测时曾出现一次 `powershell.exe` console-like 子进程 FAIL；随后单独重跑 `tools\\real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog` PASS，console-like 子进程 0。该异常保留在日志中，不当作最终 PASS 证据；发布前以最后一次独立烟测 PASS 为准。
- 已重新执行 `npm run release:package -- -Clean -AppendLog`，发布包已更新为新 EXE。

下一步推荐：打开新 release EXE，进入诊断页，点击“打开人工验证指南”或“复制人工验证指南”，然后逐项标记 PASS / FAIL / PENDING。
## 2026-06-05 13:08:25 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 15
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.

## 2026-06-05 13:19:35 真实 EXE 启动烟测

~~~text
status: PASS
exe: <repo>\src-tauri\target\release\lan-helper.exe
pid: 33524
startup_seconds: 5
process_alive: True
window_ready: True
main_window_handle: 12195692
main_window_title: 联机助手
webview_children: 6
console_like_children: 0
console_like_detail: 未发现 cmd/conhost/powershell/edge/n2n 启动期子进程
child_processes: msedgewebview2.exe#35396, msedgewebview2.exe#596, msedgewebview2.exe#22436, msedgewebview2.exe#39400, msedgewebview2.exe#35056, msedgewebview2.exe#37488
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。
## 2026-06-05 13:20:15 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 15
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.

## 2026-06-05 13:20:50 - 人工验证指南打开路径解析修复
- 修复后端 `open_path` 的相对路径解析：现在会按当前工作目录、当前 EXE 所在目录、当前 EXE 父级链路依次查找相对路径。
- 这样诊断页“打开人工验证指南”在两种场景下都更可靠：
  - 从 `src-tauri\\target\\release\\lan-helper.exe` 启动时，可沿父级链路找到仓库内 `docs\\REAL_EXE_MANUAL_VALIDATION_GUIDE.md`。
  - 从 `release-artifacts\\v0.1.0\\lan-helper-v0.1.0.exe` 所在目录运行时，可打开同目录 `REAL_EXE_MANUAL_VALIDATION_GUIDE.md`。
- `tools/release_preflight.ps1` 新增 `manual validation guide open path resolution is wired` 守卫，防止后续回退成只按当前目录找文件。

验证：
- `npm run build` 通过。
- `cargo check --manifest-path src-tauri\\Cargo.toml` 通过。
- `npm run release:preflight` 通过，新增路径解析守卫 PASS。
- `npm run tauri:build` 通过。
- 独立运行 `tools\\real_exe_smoke_test.ps1 -StartupSeconds 5 -AppendLog` 通过，console-like 子进程 0。
- `npm run release:package -- -Clean -AppendLog` 通过；发布包 EXE 已更新，大小 13337088 bytes。

下一步推荐：打开更新后的真实 EXE，进入诊断页点击“打开人工验证指南”，确认能打开指南；随后按指南逐项标记 PASS / FAIL / PENDING。
## 2026-06-05 13:22:01 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 15
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
## 2026-06-05 13:33:19 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 15
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
## 2026-06-05 13:33:20 v0.1.0 release package verification

~~~text
status: PASS
package: <repo>\release-artifacts\v0.1.0
payload_files: 15
sha256sums: PASS
manifest: PASS
manual_guide: PASS
adapter_registry: PASS
~~~

Note: this verifies local release package integrity only. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.

## 2026-06-05 13:34:55 - v0.1 发布包完整性校验器 v1
- 新增 `tools/verify_v0_1_release_package.ps1`。
- `package.json` 新增 `npm run release:package:verify`。
- 校验器会检查 `release-artifacts\v0.1.0\` 中的 EXE、SHA256SUMS、release-manifest、Release 正文、人工验证指南、反馈模板和 adapter registry。
- 初次运行时发现 `RELEASE_BODY.md` 缺少远程同屏边界；已在 `docs/GITHUB_RELEASE_DRAFT.md` 中补充：Cuphead / 茶杯头这类本地同屏游戏应使用 Steam Remote Play 或 Sunshine + Moonlight，不应当成 n2n 局域网游戏处理。
- 已重新生成发布包并运行 `npm run release:package:verify -- -AppendLog`，结果 PASS，Warnings=0，Errors=0。
- `docs/V0_1_GITHUB_RELEASE_UPLOAD_CHECKLIST.md` 已加入 `release:package:verify` 作为上传前检查。

下一步推荐：发布前运行 `npm run release:package:verify`；通过后从 `release-artifacts\v0.1.0\` 上传 EXE 和 SHA256SUMS。

## 2026-06-05 13:45:33 真实 EXE 启动烟测

~~~text
status: PASS
exe: <repo>\src-tauri\target\release\lan-helper.exe
pid: 41896
startup_seconds: 5
process_alive: True
window_ready: True
main_window_handle: 41291758
main_window_title: 联机助手
webview_children: 6
console_like_children: 0
console_like_detail: 未发现 cmd/conhost/powershell/edge/n2n 启动期子进程
child_processes: msedgewebview2.exe#22900, msedgewebview2.exe#11564, msedgewebview2.exe#57448, msedgewebview2.exe#36844, msedgewebview2.exe#41260, msedgewebview2.exe#46264
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。
## 2026-06-05 13:45:47 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 15
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
## 2026-06-05 13:45:49 v0.1.0 release package verification

~~~text
status: PASS
package: <repo>\release-artifacts\v0.1.0
payload_files: 15
sha256sums: PASS
manifest: PASS
manual_guide: PASS
adapter_registry: PASS
~~~

Note: this verifies local release package integrity only. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
## 2026-06-05 13:45:56 v0.1 automated release gate

~~~text
status: PASS
passed: 7
failed: 0
skipped: 1
skip_tauri_build: True
skip_smoke: False
~~~

### Step results

- PASS `npm run build` (26s)
- PASS `cargo check` (4s)
- PASS `npm run adapter:validate` (2s)
- SKIP `npm run tauri:build` (0s) - SkipTauriBuild
- PASS `real exe smoke test` (12s)
- PASS `npm run release:package` (3s)
- PASS `npm run release:package:verify` (2s)
- PASS `npm run release:preflight` (7s)

### Manual validation still required

- real dual-machine n2n connectivity
- real joiner connects to host virtual IP and game port
- Terraria dual-machine Join via IP
- more adapter reviews by real users

Note: this gate verifies automated release readiness only. It does not replace PASS / FAIL / PENDING manual validation in the real EXE diagnostics page.

## 2026-06-05 14:21:40 - v0.1 release gate log formatting fix
- Fixed 	ools/run_v0_1_release_gate.ps1 so Step results append readable Markdown command names instead of PowerShell interpolation leftovers.
- Corrected the previous malformed Step results block in this validation log.
- Validation:
pm run release:preflight PASS.
- Boundary: this only fixes automated validation evidence readability; real dual-machine, real joiner, Terraria Join via IP, and more adapter user reviews remain manual PENDING items.

## 2026-06-05 14:23:42 真实 EXE 启动烟测

~~~text
status: PASS
exe: <repo>\src-tauri\target\release\lan-helper.exe
pid: 2980
startup_seconds: 5
process_alive: True
window_ready: True
main_window_handle: 10226582
main_window_title: 联机助手
webview_children: 6
console_like_children: 0
console_like_detail: 未发现 cmd/conhost/powershell/edge/n2n 启动期子进程
child_processes: msedgewebview2.exe#19764, msedgewebview2.exe#31176, msedgewebview2.exe#54712, msedgewebview2.exe#49096, msedgewebview2.exe#61648, msedgewebview2.exe#38892
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。
## 2026-06-05 14:23:56 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 15
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
## 2026-06-05 14:23:58 v0.1.0 release package verification

~~~text
status: PASS
package: <repo>\release-artifacts\v0.1.0
payload_files: 15
sha256sums: PASS
manifest: PASS
manual_guide: PASS
adapter_registry: PASS
~~~

Note: this verifies local release package integrity only. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
## 2026-06-05 14:24:04 v0.1 automated release gate

~~~text
status: PASS
passed: 7
failed: 0
skipped: 1
skip_tauri_build: True
skip_smoke: False
~~~

### Step results

- PASS `npm run build` (22s)
- PASS `cargo check` (4s)
- PASS `npm run adapter:validate` (2s)
- SKIP `npm run tauri:build` (0s) - SkipTauriBuild
- PASS `real exe smoke test` (13s)
- PASS `npm run release:package` (2s)
- PASS `npm run release:package:verify` (2s)
- PASS `npm run release:preflight` (6s)

### Manual validation still required

- real dual-machine n2n connectivity
- real joiner connects to host virtual IP and game port
- Terraria dual-machine Join via IP
- more adapter reviews by real users

Note: this gate verifies automated release readiness only. It does not replace PASS / FAIL / PENDING manual validation in the real EXE diagnostics page.

## 2026-06-05 14:28:46 真实 EXE 启动烟测

~~~text
status: PASS
exe: <repo>\src-tauri\target\release\lan-helper.exe
pid: 51996
startup_seconds: 5
process_alive: True
window_ready: True
main_window_handle: 7606518
main_window_title: 联机助手
webview_children: 6
console_like_children: 0
console_like_detail: 未发现 cmd/conhost/powershell/edge/n2n 启动期子进程
child_processes: msedgewebview2.exe#51664, msedgewebview2.exe#4948, msedgewebview2.exe#58480, msedgewebview2.exe#27180, msedgewebview2.exe#60992, msedgewebview2.exe#40188
~~~

说明：本烟测只验证真实 release EXE 能启动、能创建窗口/WebView、启动期没有额外白色命令框类子进程。它不能替代 n2n ACK/PONG、邀请包、Terraria 或真实双机人工验证。
## 2026-06-05 14:29:01 v0.1.0 local release package

~~~text
status: PASS
output: <repo>\release-artifacts\v0.1.0
exe: lan-helper-v0.1.0.exe
sha256sums: SHA256SUMS.txt
manifest: release-manifest.json
payload_files: 15
~~~

Note: this package only stages GitHub Release upload files. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
## 2026-06-05 14:29:03 v0.1.0 release package verification

~~~text
status: PASS
package: <repo>\release-artifacts\v0.1.0
payload_files: 15
sha256sums: PASS
manifest: PASS
manual_guide: PASS
adapter_registry: PASS
~~~

Note: this verifies local release package integrity only. It does not replace real dual-machine, real joiner, Terraria, or more adapter manual validation.
## 2026-06-05 14:29:09 v0.1 automated release gate

~~~text
status: PASS
passed: 8
failed: 0
skipped: 0
skip_tauri_build: False
skip_smoke: False
~~~

### Step results

- PASS `npm run build` (21s)
- PASS `cargo check` (6s)
- PASS `npm run adapter:validate` (2s)
- PASS `npm run tauri:build` (107s)
- PASS `real exe smoke test` (13s)
- PASS `npm run release:package` (3s)
- PASS `npm run release:package:verify` (2s)
- PASS `npm run release:preflight` (6s)

### Manual validation still required

- real dual-machine n2n connectivity
- real joiner connects to host virtual IP and game port
- Terraria dual-machine Join via IP
- more adapter reviews by real users

Note: this gate verifies automated release readiness only. It does not replace PASS / FAIL / PENDING manual validation in the real EXE diagnostics page.

## 2026-06-05 15:11:04 - 邀请包/房主开房 gate 与高级工具预填验证

结论：PASS（自动化/源码级验证，不代表真实双机 PASS）。

已验证命令：

-
pm run build：PASS。
- cargo check --manifest-path src-tauri\Cargo.toml：PASS。
-
pm run release:preflight：PASS。

本轮新增守卫：

- 好友端保存并启动 n2n 前必须先校验邀请包完整性。
- joinFromInvitePacket 保存配置和启动 n2n 前必须先校验邀请包完整性。
- 房主端未 ready 时不得渲染完整 LAN 邀请包预览。
- 推荐页高级工具入口必须保留点击的 TCP/UDP/bridge 类型。

人工边界：真实双机 n2n 互通、真实好友加入、真实游戏内连接仍需按发布验证计划单独记录 PASS/FAIL/PENDING。

## 2026-06-05 15:31:01 - 共享适配器库增强验证

结论：PASS（源码/数据/自动校验级验证，不代表所有 adapter 都已社区实测）。

已验证命令：

-
pm run adapter:validate：PASS。
-
pm run build：PASS。
- cargo check --manifest-path src-tauri\Cargo.toml：PASS。
-
pm run release:preflight：PASS。

新增发布边界：

- registry adapter 必须有版本、说明、适用条件、验证证据。
- registry adapter 不得持久化 dapter_source。
- 提交包 sha256 必须基于 canonical JSON。
- roadcast_bridge 是 multiplayer_conversion.methods 中的 canonical 广播桥方法名。

人工边界：每个 adapter 的 erification_status 仅表示当前证据等级；真实好友加入、真实游戏内加入、社区实测仍需单独记录。

## 2026-06-05 15:37:54 - 转换引擎混合能力边界验证

结论：PASS（自动化/源码级验证）。

已验证命令：

-
pm run build：PASS。
- cargo check --manifest-path src-tauri\Cargo.toml：PASS。
-
pm run release:preflight：PASS。

新增边界：LAN + 本地同屏混合能力游戏优先走 LAN/n2n；纯本地同屏游戏才走远程同屏。Cuphead/茶杯头仍不得生成 LAN 邀请包。

## 2026-06-05 16:01:12 - 诊断修复中心手动命令覆盖验证

结论：PASS（源码/自动化守卫级验证）。

已验证命令：

- npm run build：PASS。
- cargo check --manifest-path src-tauri\Cargo.toml：PASS。
- npm run release:preflight：PASS。
- git diff --check：PASS。

新增守卫：

- n2n 未启动必须有 copy-n2n-manual-start。
- IP/密钥冲突必须有 copy-ip-conflict-check。
- 游戏端口/代理必须有 copy-game-port-proxy-check。
- 版本不匹配必须有 copy-version-manual-check。
- 诊断修复中心审计必须包含逐问题 action coverage 矩阵。

人工边界：该验证不代表真实 supernode、真实双机互通、真实游戏端口或真实好友加入已通过。

## 2026-06-05 20:27:30 v0.1.0 release consistency cleanup

~~~text
status: PASS
clean_tauri_build: PASS
release_preflight: PASS
release_package_verify: PASS
windows_zip_verify: PASS
release_exe_sha256: 286d636f43e1f26a52a8ff4019c05afc09d62153d1a3273a5d9f87ead477b04d
windows_zip_sha256: 91617585501427da6bb2502e18ad28e0bc1038270c04db00364e7a4b04331a75
runtime_files_excluded: edge.log, edge.stdout.log, edge.stderr.log, last_config.json, n2n.pid
sensitive_path_scan: PASS
~~~

Notes:
- Public wording was changed to early public test build / game solution library / suggested follow-up validation.
- Current GitHub v0.1.0 asset still has the older ZIP digest until the Release asset is replaced manually.
- Download count was 0 when checked through GitHub API, so replacing the v0.1.0 asset is still acceptable; publishing v0.1.1 is safer if any user has downloaded it later.

## 2026-06-06 n2n TAP device startup failure triage

Observed friend-side log:

~~~text
[manager] n2n edge started
[stdout] adding supernode = <supernode>:7777
[stdout] WARNING: switching to AES as key was provided
[stdout] starting n2n edge dev-31936c8
[stdout] use manually set IP address
[stdout] Cannot find tap device "????? 6"
~~~

Conclusion: this is not a supernode/authentication failure. The edge process started, but failed before registration because the TAP device passed to `-d` could not be found. The likely trigger was automatic selection of a localized/Chinese TAP adapter name; inside edge output the adapter name appeared as question marks, so n2n could not match the Windows adapter.

Fix applied:

- `src-tauri/src/network/n2n_backend.rs` no longer falls back to the first arbitrary TAP/Wintun/VPN adapter.
- The backend only passes `-d` when the selected adapter name is safe ASCII, e.g. `cfw-tap`, `n2n`, `edge`, `tap`, `SetupVPN`.
- If edge exits during startup, the backend removes the stale pid file and returns the decisive log line to the UI.
- `Cannot find tap device` is classified as `tap_error`, with a diagnostic issue id `n2n_tap_device_error`.
- Sidebar membership-style placeholder text was changed to neutral local configuration copy.

Validation:

- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS.
- `npm run build`: PASS.

Manual retest required: install the rebuilt client on the friend's machine, start n2n again, and verify the log reaches `REGISTER_SUPER_ACK` / `Rx PONG` instead of `Cannot find tap device`.

## 2026-06-06 ordinary user UI declutter

Conclusion: the audit/self-check cards shown in product pages are useful for development and release verification, but they are too noisy for ordinary players.

Fix applied:

- Added a local setting toggle: “显示开发者验证信息”.
- Default state is off.
- Ordinary users no longer see final audit, closure self-check, sample validation, publish gate, real EXE validation, adapter publish audit, adapter review workbench, version conflict and backup history cards.
- The cards are not deleted; enabling developer validation information shows them again for release QA and troubleshooting.

Product rule recorded in `PRODUCT.md`: developer audit information must be hidden by default. User-facing screens should lead with next action, true status and required operations.

## 2026-06-06 user main flow reorder

Conclusion: ordinary users should not land on a technical dashboard. The first screen now answers whether the player wants to host or join, then shows the next three actions.

Fix applied:

- `src/product-ui/ProductHomeView.tsx` title changed from desktop hall to start joining/hosting flow.
- Home first card now shows role-specific 3-step actions:
  - host: scan game, start n2n, open host invite flow;
  - joiner: paste invite packet, save/start n2n, enter game by host virtual IP.
- Home topology, real checklist and duplicate host guide are kept, but hidden by default behind developer validation mode.
- `src/product-ui/ProductSidebar.tsx` navigation is regrouped into 联机 / 游戏 / 排查.
- Product rule recorded in `PRODUCT.md`: home and sidebar must prioritize 我要开房 / 我要加入; technical topology, internal checklist and release validation content stay out of the default user flow.

Validation:

- `npm.cmd run build`: PASS.
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS.

## 2026-06-06 network page main flow reorder

Conclusion: the network page should not open with a full n2n parameter form. Joiners normally only need to paste the host invite packet, start n2n, then enter the game.

Fix applied:

- `src/product-ui/ProductNetworkView.tsx` title changed from generic network center to 加入与组网.
- The first visible card now prioritizes:
  - paste invite packet;
  - save and start n2n;
  - inspect next action / diagnostics / game connection instruction.
- Manual n2n settings are still available through 手动设置, but they are no longer the default first screen.
- The old duplicate invite card, n2n logs and advanced-tool relationship explanation are kept for developer validation mode instead of ordinary default UI.
- Product rule recorded in `PRODUCT.md`: the network page must prioritize invite-based join flow; hand-written room name, key, Supernode, port checks and logs are progressive details.

Validation:

- `npm.cmd run build`: PASS.
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS.

## 2026-06-06 host invite page declutter

Conclusion: ordinary hosts should not see adapter confidence, conversion assessment, backend/profile fields, closure audit, ACK/PONG or internal failure reason codes on the default invite page.

Fix applied:

- Host invite page now keeps ordinary flow focused on selecting a game, starting network/server, adding a friend and copying the invite package.
- Technical recommendation selector, conversion assessment, raw recommendation list and host closure audit remain available in developer validation mode.
- Host diagnostic card keeps the user action visible, while reason codes and low-level fields are hidden by default.
- User-facing copy prefers 添加好友 / 组网 / 邀请还没准备好 over IP slot / ACK / adapter / context terms.
- Product rule recorded in `PRODUCT.md`: host invite page should be action-first and keep recommendation confidence, conversion assessment and raw failure fields out of the ordinary default UI.

Validation:

- `npm.cmd run build`: PASS
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS

## 2026-06-06 host invite copy area cleanup

Conclusion: the host invite page should not show raw invite package text, friend connectivity test buttons, or test summaries in the ordinary host flow. Hosts should mainly see the selected friend state and one copy action.

Fix applied:

- Host invite right panel title now focuses on copying to a friend, not "invite package and test".
- Ordinary host view now shows selected friend / missing friend state and a single copy invite action.
- Raw invite preview, friend connectivity test action, and last connectivity summary are moved under `data-recommendation-technical-details="details"`.
- Friend list action is renamed from generating an invite package to selecting the friend, matching the actual step.
- Product rule recorded in `PRODUCT.md`: raw invite preview and friend connectivity diagnostics are not part of the default host flow.

Validation:

- `npm.cmd run build`: PASS
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS

## 2026-06-06 user-facing wording cleanup

Conclusion: default user paths should not expose implementation terms such as n2n, Supernode, ACK/PONG, edge, virtual IP, backend/profile/latency unless the user opens manual settings or developer troubleshooting details.

Fix applied:

- Global status center now converts runtime wording into user-facing terms: 组网服务, 中继地址, 联机地址, 联机确认.
- Home join flow now says 保存并加入 / 房主联机地址 / 中继确认 instead of save/start n2n, virtual IP, Supernode or ACK/PONG.
- Join page first card now says 保存并加入, 手动填写, 房主联机地址 and 我的联机地址.
- Sidebar hints no longer advertise n2n/TCP/UDP implementation details in the main navigation.
- Product rule recorded in `PRODUCT.md`: join flow defaults to 粘贴邀请包 → 保存并加入 → 进入游戏, with implementation terms reserved for manual settings and troubleshooting.

Validation:

- `npm.cmd run build`: PASS
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS

## 2026-06-06 auxiliary pages main flow reorder

Conclusion: auxiliary pages should also be task-first. Ordinary users should not land on URL forms, adapter lists, runtime summaries, release checks, raw reports, physical paths or log directories.

Fix applied:

- Solution library page now opens with a normal-user action card: update shared solution library, scan games, open host invite flow, or report a missing game.
- Diagnostic page now opens with a single "先做这一步" decision card based on the real diagnostic state and auto-next-step decision.
- Settings page now opens with common settings: default relay address, default solution library address, save, reset and network-program check.
- Existing maintenance views are preserved under developer validation details: shared library URL/source cards, adapter category/list, runtime summary, release checks, raw report preview, physical executable path, log directory and publish notes.
- Product rule recorded in `PRODUCT.md`: auxiliary pages must remain task-first, with technical details progressive.

Validation:

- `npm.cmd run build`: PASS
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS

## 2026-06-06 advanced and dedicated-guide default declutter

Conclusion: advanced tools and game-specific guide pages still exposed too much implementation detail for ordinary players. The functions are useful, but the default screen should not teach port proxy theory, method matrices, raw risk details, PID/log fields, or control-console caveats before the user has a reason to troubleshoot.

Fix applied:

- Added default-hidden technical selectors in `src/reference-runtime.css`:
  - `data-advanced-connection-methods`
  - `data-advanced-connection-matrix`
  - `data-advanced-tool-explainer`
  - `data-advanced-tool-risk-detail`
  - `data-advanced-runtime-technical`
  - `data-terraria-technical-details`
  - `data-network-manual-technical`
- `src/product-ui/ProductNetworkView.tsx` now uses user-facing labels in the manual area: 中继地址, 我的联机地址, 启动组网服务, 联机确认.
- `src/product-ui/ProductAdvancedToolsView.tsx` keeps the real start/self-test operations visible, but hides the method catalog, capability matrix, long explainer, detailed risk list, runtime instance logs and generic server console by default.
- `src/product-ui/ProductTerrariaGuideView.tsx` now defaults to “选择世界 → 启动服务端 → 复制邀请”; PID, low-level readiness fields, logs and command console move to developer troubleshooting details.
- Product rule recorded in `PRODUCT.md`: advanced tools and dedicated guides must be operation-first by default, while technical evidence stays available behind developer validation details.

Validation:

- `npm.cmd run build`: PASS
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS

## 2026-06-06 game scan and header main-flow cleanup

Conclusion: the game scan page and top status bar were still written like developer surfaces. Ordinary players should not see adapter/version/source/confidence/backend fields before they have selected a game and continued into the host/join flow.

Fix applied:

- `src/product-ui/ProductGameScanView.tsx` now defaults to:
  - scan or rescan games;
  - choose a game;
  - follow the recommended next step.
- Adapter category inventory, registry version, cache timestamp, game id, install path, adapter version, capability details, recommendation evidence, analysis result and raw recommendation preview are now behind developer validation selectors.
- User-facing labels were shortened from `真实分析` / `推荐目标` / `game_id` to `分析详情` / `选择此游戏` / normal game search copy.
- `src/product-ui/ProductHeader.tsx` no longer shows implementation terms like `n2n` or `真实状态` in the default top bar.
- Placeholder notification/account icons without product behavior were removed from the top bar.
- Product rule recorded in `PRODUCT.md`: game scan and header must remain main-flow surfaces, not adapter/debug dashboards.

Validation:

- `npm.cmd run build`: PASS
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS

## 2026-06-06 settings and diagnostics default declutter

Conclusion: settings and diagnostics were still too close to developer consoles. Ordinary players should not see edge.exe, ACK/PONG, Supernode, runtime, release checks, real EXE validation, raw reason codes, raw report previews, or repair history by default.

Fix applied:

- `src/product-ui/ProductSettingsView.tsx` now uses user-facing copy in the default area:
  - 保存设置 / 保存常用设置;
  - 检测组网程序;
  - 默认中继地址;
  - 默认方案库地址;
  - 显示排查与验证详情.
- The real settings save/reset/load/check calls are unchanged; only the default wording and information hierarchy were simplified.
- `src/product-ui/ProductDiagnosticsView.tsx` now presents the ordinary flow as:
  - 先生成诊断;
  - 查看诊断结论;
  - 按建议修复;
  - 复制报告给朋友.
- Diagnostic text is simplified in visible cards: n2n/edge/Supernode/ACK/PONG/virtual IP/backend/runtime/adapter/release-check wording is converted to group networking / network program / relay address / connection confirmation / connection address / local service / current state / game solution / checks.
- Raw reason codes, relay fields in context cards, auto-retest technical deltas, advanced-tool self-test history, fix history, and low-priority route-specific n2n fix groups are now behind developer validation selectors.
- `src/reference-runtime.css` adds default-hidden selectors:
  - `data-diagnostic-context-technical`
  - `data-diagnostic-auto-retest-technical`
  - `data-diagnostic-advanced-tool-self-test-history`
  - `data-diagnostic-fix-history`
  - `data-diagnostic-n2n-fixes-deprioritized`
- Product rule recorded in `PRODUCT.md`: settings and diagnostics must not look like developer consoles in the ordinary default UI.

Validation:

- `npm.cmd run build`: PASS
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS
- `git diff --check`: PASS, only LF/CRLF working-copy warnings


## 2026-06-06 global first-screen audit

Conclusion: the product shell should answer ?what should I do next?? before exposing implementation detail. This pass keeps the real diagnostic and validation data intact, but pushes adapter/n2n/edge/Supernode/ACK/PONG/raw runtime wording into troubleshooting details or copied developer reports.

Fix applied:

- `PRODUCT.md` now records a global first-screen rule: first screen = identity, current status, next step, primary action; implementation terms stay in troubleshooting/developer details.
- User-facing route, invite, diagnostic and connection-method copy now prefers: ???? / ???? / ???? / ???? / ????.
- `src/product-ui/connectionMethodCatalog.ts`, `diagnosticConversionAdvice.ts`, `hostDiagnosticContext.ts`, `inviteDiagnosticContext.ts`, `inviteJoinSuccess.ts`, `errorActions.ts`, `conversionAssessmentEngine.ts` and related presentation helpers were cleaned so copied reports and repair cards no longer read like developer consoles by default.
- Game scan hidden analysis placeholders were renamed from ?????/????? to ?????/?????.
- Advanced tools first visible form now says ????????, while method matrices, risk details, logs and service-console details remain available behind developer validation.

Validation to run for this pass:

- `npm.cmd run build`
- `cargo check --manifest-path src-tauri\Cargo.toml`
- `git diff --check`