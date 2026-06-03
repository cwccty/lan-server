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
| VPS supernode ACK/PONG | 待人工验证 | - | 需要用户 VPS 环境 |
| 双机 n2n 互通 | 待人工验证 | - | 需要两台电脑或虚拟机 |
| Terraria Join via IP | 待人工验证 | - | 需要游戏内加入 |
| Minecraft Java adapter 审核 | 待人工验证 | - | 需要实际游戏/服务端流程确认 |
| Stardew Valley adapter 审核 | 待人工验证 | - | 需要确认是否误导 LAN/IP 转换 |

## 5. 结论

自动化单机验证已通过；发布结论仍待人工验证项补齐后给出。






