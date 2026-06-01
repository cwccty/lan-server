# 联机助手开发行动记录

## 当前阶段

阶段 0：项目规划与骨架初始化

## 当前目标

阶段 1：实现真实游戏扫描、网络检测和可操作联机流程。

## 已完成内容

- 确认产品方向：面向普通 Steam/PC 玩家的一键小型游戏联机工具。
- 确认第一版平台：Windows 桌面。
- 确认技术栈：Tauri + Rust + React + TypeScript。
- 确认 MVP 边界：第一版不做 Steam API 模拟、Hook、注入、破解或反作弊绕过。
- 确认网络策略：n2n 主实现，Radmin 辅助检测，Manual LAN 兜底。
- 创建 `PROJECT.md` 项目总规划。
- 创建 `act.md` 开发行动记录。
- 创建 `README.md`、`package.json`、`tsconfig.json`、`vite.config.ts`、`index.html`。
- 创建 React + TypeScript 前端页面骨架：首页、游戏扫描、游戏详情、网络配置、推荐方案、诊断报告。
- 创建前端 Tauri API 封装：`src/api/tauri.ts`。
- 创建前端核心类型：game、network、recommendation、diagnostics。
- 创建 Tauri/Rust 骨架：commands、models、core、network、storage。
- 创建静态游戏适配库初版：Terraria、Stardew Valley、Minecraft Java。
- 实现 Rust command 空壳和最小逻辑：扫描适配库、分析游戏、列出网络后端、连接测试、推荐方案、诊断报告。
- `npm install` 成功。
- `npm run build` 成功。
- 安装 Rust 工具链：`cargo 1.96.0`、`rustc 1.96.0`。
- 新增 Tauri Windows 图标：`src-tauri/icons/icon.ico`。
- 修复 Tauri Rust 结构：新增 `src-tauri/src/lib.rs`，`main.rs` 调用 `lan_helper_lib::run()`。
- `cargo check` 成功。
- `npm run tauri:build` 成功，产物位于 `src-tauri/target/release/lan-helper.exe`。
- 实现 Steam 默认安装目录与 `libraryfolders.vdf` 扫描。
- 实现基于游戏适配库 executable 的安装路径匹配。
- 游戏详情页显示本机检测路径。
- 实现 Radmin 虚拟网卡 IPv4 初步读取。
- 网络配置页加入 Manual LAN 目标 IP/端口 TCP 连通性测试表单。
- 清理 `NetworkBackend` 预留 trait 的 dead code warning。
- 实现 Steam `appmanifest_{appid}.acf` 读取，优先使用 `installdir` 定位游戏目录。
- 实现 n2n edge 可执行文件发现：`tools/n2n/edge.exe` 或 `tools/n2n/n2n.exe`。
- 实现 n2n 配置保存：`tools/n2n/last_config.json`。
- 实现 n2n 启动、PID 记录、停止骨架：`tools/n2n/n2n.pid`。
- 网络配置页加入 n2n 配置、启动、停止操作区。
- 更新 `PROJECT.md`，补充 n2n 文件约定和 Steam 检测优先级。
- 实现 n2n PID 运行状态检测，避免重复启动仍在运行的 edge 进程。
- n2n 停止逻辑仅停止由联机助手记录 PID 的进程。
- 实现 `launch_profile` 最小可用启动器：支持 client/server 启动和 docs 说明。
- Terraria 适配加入服务端启动参数：`-port 7777`。
- 推荐方案页加入“执行推荐启动项”按钮。
- 更新 `PROJECT.md`，补充 n2n 运行策略和游戏启动策略。
- 抽取 Windows 虚拟网卡 IPv4 识别工具：优先 `Get-NetIPAddress`，回退 `ipconfig`。
- Radmin/n2n 后端改用统一虚拟 IP 识别逻辑。
- 新增 `tools/n2n/README.md`，说明 `edge.exe`/`n2n.exe` 放置方式。
- `.gitignore` 忽略本地 n2n 可执行文件、`last_config.json` 和 `n2n.pid`。
- 推荐引擎会为存在 `docs` 启动配置的游戏生成“查看连接说明”方案。
- 推荐页将启动/说明结果渲染为普通卡片，不再只显示 JSON。
- 诊断报告内容增强：包含游戏扫描结果和网络后端状态。
- 诊断页增加“复制报告”按钮，方便用户反馈和后续排障。
- 已确认 ntop/n2n 官方 latest release 未提供 Windows exe asset，因此不自动下载第三方二进制。
- 新增 Terraria 端到端测试文档：`docs/TEST_TERRARIA.md`。
- 修复 release exe 启动后“未发现游戏/适配库为空”的问题：适配库读取现在会沿当前工作目录和 exe 所在目录向上查找 `adapters/games`。
- 增加内置适配库兜底：Terraria、Stardew Valley、Minecraft Java。
- 重新构建 release exe。
- 回答并修复“适配库里没有的游戏是否扫描不到”：现在会扫描 Steam `appmanifest_*.acf`，把适配库外已安装游戏作为 `unknown` 显示。
- 未适配游戏支持基础分析页：显示低可信度、未知能力和需要后续适配的说明。
- 重新构建 release exe；构建前发现旧 exe 正在运行，已停止旧进程后完成构建。
- 修复“未检测到本机安装路径”的常见原因：Steam 不在默认 Program Files 目录时，现在会读取 Windows 注册表中的 `SteamPath` / `InstallPath`。
- 诊断报告新增 Steam 库路径输出，便于判断扫描到了哪些 Steam 库。
- 重新构建 release exe；构建前发现旧 exe 正在运行，已停止旧进程后完成构建。
- 修复/优化“点击执行推荐项没有变化”的体验：点击后立即显示“正在执行”，按钮进入执行中状态。
- 推荐页增加异常卡片，捕获 Tauri invoke 失败。
- 推荐卡片显示具体启动项 ID。
- 启动失败信息更友好，会提示安装路径、exe 名称或权限/杀毒拦截方向。
- 重新构建 release exe；构建前发现旧 exe 正在运行，已停止旧进程后完成构建。

## 正在进行

- 阶段 1：验证推荐项执行反馈与实际启动结果。

## 下一步任务

1. 增加更友好的基础错误提示。
2. 按 `docs/TEST_TERRARIA.md` 完成 Terraria 端到端手动测试。
3. 获取或放置 Windows 版 n2n edge 到 `tools/n2n/edge.exe` 或 `tools/n2n/n2n.exe` 后测试真实 n2n 流程。

## 重要决策

- 第一版只支持 Windows。
- 第一版面向普通玩家，默认隐藏高级网络参数。
- 第一版以 EasyN2N/n2n 为主网络能力。
- Radmin VPN 第一版只做检测和引导，不自动创建网络。
- Manual LAN 作为已有局域网、已有 VPN、Tailscale/ZeroTier 用户的兜底模式。
- 所有高风险能力进入后续实验模式，不进入 MVP。

## 当前文件结构

当前主要结构：

```text
PROJECT.md
act.md
README.md
package.json
index.html
tsconfig.json
vite.config.ts
src/
src-tauri/
adapters/games/
tools/n2n/
```

当前实现与 `PROJECT.md` 阶段 0 结构保持一致。

新增构建产物和缓存目录已通过 `.gitignore` 排除：

- `node_modules/`
- `dist/`
- `src-tauri/target/`

## 功能开发记录

- 2026-06-01：开始阶段 0，创建项目规划和开发记忆体系。
- 2026-06-01：创建前端 React/Vite 骨架、Tauri/Rust 骨架、适配库初版和网络后端骨架。
- 2026-06-01：实现第一批 Tauri command 命名和前端 API 封装。
- 2026-06-01：实现最小推荐引擎：LAN/IP/Dedicated Server 游戏给出虚拟局域网/IP 直连推荐。
- 2026-06-01：安装 Rust 工具链并通过 `cargo check`。
- 2026-06-01：补齐 Tauri 图标和 lib/bin 结构，通过 `npm run tauri:build`。
- 2026-06-01：实现 Steam 库扫描、游戏安装路径匹配、Radmin IPv4 初步读取和 Manual LAN 测试 UI。
- 2026-06-01：实现 Steam appmanifest 优先检测、n2n 配置保存、n2n edge 启停骨架和前端操作区。
- 2026-06-01：实现 n2n PID 去重、游戏启动器最小版本、Terraria 服务端参数和推荐页启动按钮。
- 2026-06-01：统一 Radmin/n2n 虚拟 IP 识别逻辑，补充 n2n 本地工具说明和忽略规则。
- 2026-06-01：为 docs 启动配置生成推荐方案，并优化推荐页操作结果展示。
- 2026-06-01：增强诊断报告并增加前端复制按钮。
- 2026-06-01：补充 Terraria 端到端测试文档，记录 n2n 官方 release 未提供 Windows exe 的现状。
- 2026-06-01：修复适配库相对路径问题，增加 exe 祖先目录查找和内置适配兜底。
- 2026-06-01：增加适配库外 Steam 游戏扫描，未适配游戏以 unknown 能力显示。
- 2026-06-01：增加 Windows 注册表 SteamPath/InstallPath 读取，并在诊断报告中输出 Steam 库路径。
- 2026-06-01：优化推荐项执行反馈、loading 状态和启动失败提示。

## 测试记录

- 已通过：`npm install`。
- 已通过：`npm run build`。
- 已通过：`cargo check`。
- 已通过：`npm run tauri:build`。
- 已通过：修复后 `cargo check` 无 warning。
- 已通过：阶段 1 当前改动后 `npm run build`。
- 已通过：阶段 1 当前改动后 `npm run tauri:build`。
- 已通过：本轮改动后 `cargo check`。
- 已通过：本轮改动后 `npm run build`。
- 已通过：本轮改动后 `npm run tauri:build`。
- 已通过：虚拟 IP 识别工具改动后 `cargo check`。
- 已通过：虚拟 IP 识别工具改动后 `npm run build`。
- 已通过：连接说明 UI 改动后 `cargo check`。
- 已通过：连接说明 UI 改动后 `npm run build`。
- 已通过：诊断报告改动后 `cargo check`。
- 已通过：诊断报告改动后 `npm run build`。
- 已通过：诊断报告改动后 `npm run tauri:build`。
- 已通过：适配库路径修复后 `cargo check`。
- 已通过：适配库路径修复后 `npm run build`。
- 已通过：适配库路径修复后 `npm run tauri:build`。
- 已通过：未知 Steam 游戏扫描改动后 `cargo check`。
- 已通过：未知 Steam 游戏扫描改动后 `npm run build`。
- 已通过：未知 Steam 游戏扫描改动后 `npm run tauri:build`。
- 已通过：Steam 注册表路径发现改动后 `cargo check`。
- 已通过：Steam 注册表路径发现改动后 `npm run build`。
- 已通过：Steam 注册表路径发现改动后 `npm run tauri:build`。
- 已通过：推荐项执行反馈改动后 `cargo check`。
- 已通过：推荐项执行反馈改动后 `npm run build`。
- 已通过：推荐项执行反馈改动后 `npm run tauri:build`。

## 待确认问题

- n2n 可执行文件来源和版本待后续确定。
- 是否提供官方 supernode 待后续产品决策。

## 不允许偏离的约束

- 每次开发前必须读取 `PROJECT.md` 和 `act.md`。
- 每次功能完成后必须更新 `act.md`。
- 修改架构、API、数据结构、文件命名时必须同步更新 `PROJECT.md`。
- 第一版不得实现 Steam API 模拟、Hook、注入、破解或反作弊绕过。
- 不得扫描无关用户隐私目录、系统凭据、SSH Key、浏览器 Cookie 等与联机助手无关的信息。

## 2026-06-01 通用开服配置更新

### 本轮目标
- 回答并落实：不同游戏开服设置不一致时，不为每个游戏单独写前端页面。
- 建立适配器驱动的通用开服配置模型。

### 已完成
- 扩展前端 `LaunchProfile` 类型：新增 `config_fields`、`arg_templates`、`stdin_templates`。
- 扩展 Rust `LaunchProfile` 模型：支持从适配器读取通用开服字段。
- 修改 `launch_profile` API：新增 `config` 参数，用于接收前端统一表单填写结果。
- 修改 Rust 启动器：支持模板替换、命令行参数模板、stdin 自动写入。
- 修改 Terraria 适配器：服务端启动项声明世界编号、最大人数、端口、自动端口转发、密码字段。
- 修改推荐方案页：根据当前启动项的 `config_fields` 自动渲染通用表单。
- 重写推荐卡片文案，修复部分中文显示不清晰的问题。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。

### 下一步
- 在真实 Terraria Server 窗口中验证 `stdin_templates` 是否能完整走完控制台问答。
- 如果某些服务端需要持续日志读取，再设计独立的“服务端会话管理”能力，而不是把所有游戏写成专用前端。
- `npm run tauri:build` 首次失败：旧的 `lan-helper.exe` 正在运行导致 release exe 无法覆盖；已停止旧进程后重新构建通过。

## 2026-06-01 Terraria 开服参数修复

### 问题
- 用户反馈点击推荐启动后，Terraria Server 仍停留在世界选择界面。
- 原因判断：上一版使用 `stdin_templates` 在启动后立即写入控制台输入，这类交互式控制台程序可能尚未进入可读输入状态，导致输入被忽略或未完整应用。
- 后续网络测试返回 false 的直接原因是服务端未真正监听 7777 端口。

### 修复
- Terraria 服务端启动不再依赖 `stdin_templates`。
- `game_launcher` 对 `terraria/server` 增加窄范围适配：
  - 自动发现 `Documents/My Games/Terraria/Worlds` 和 OneDrive Documents 下的 `.wld` 世界文件。
  - 根据 `world_choice` 解析世界文件；也支持用户填写完整 `world_path`。
  - 使用 TerrariaServer 命令行参数启动：`-world`、`-players`、`-port`、`-pass`、`-noupnp`。
- `adapters/games/terraria.json` 新增 `world_path` 可选字段，并移除 Terraria server 的 stdin 自动输入模板。

### 验证
- `cargo check` 通过。
- `npm run build` 通过。
- `npm run tauri:build` 首次因旧 `lan-helper.exe` 运行中无法覆盖失败；停止旧进程后重新构建通过。

### 下一步测试
- 重新打开 release 客户端。
- 选择 Terraria。
- 推荐方案页选择“启动本地服务端”。
- 默认世界编号 1；如果仍找不到世界，填写完整 `.wld` 路径。
- 启动后确认服务端不再停留在世界选择界面，并等待出现监听端口信息。
- 再进行 `127.0.0.1:7777` 或虚拟 IP:7777 的 TCP 测试。

## 2026-06-01 n2n 说明与客户端整理

### 本轮目标
- 按“n2n 作为核心内置组网方案，Radmin 作为辅助检测”继续整理。
- 给用户解释 edge 和 supernode 是什么，以及如何配置。

### 已完成
- 新增 `docs/N2N_GUIDE.md`：完整说明 n2n、edge、supernode、community、secret、local_ip、Terraria 示例和常见失败原因。
- 重写 `tools/n2n/README.md`：说明 edge.exe/n2n.exe 放置方式和最小配置规则。
- 优化 `src/pages/NetworkSetupPage.tsx`：
  - 把乱码/不清晰文案改成正常中文。
  - 明确 n2n 参数含义。
  - 增加“复制给朋友的 n2n 配置”。
  - 说明房主和朋友 local_ip 必须不同。
- 更新 `PROJECT.md`：明确 Radmin/n2n/Manual LAN 的职责边界。

### 下一步
- 获取可信 Windows 版 n2n edge，放入 `tools/n2n/edge.exe`。
- 准备一个可用 supernode。
- 两台电脑分别配置不同 local_ip，做真实 n2n 互通测试。
- 验证记录：`npm run build` 通过；随后在仓库根目录直接运行 `cargo check` 失败，因为 `Cargo.toml` 位于 `src-tauri/`；切换到 `src-tauri` 后 `cargo check` 通过。

## 2026-06-01 n2n edge 获取与 VPS 延迟说明

### 已完成
- 新增 `docs/N2N_EDGE_AND_SUPERNODE.md`。
- 文档明确：
  - `edge.exe` 推荐从官方源码自行构建。
  - 临时测试可用可信构建产物，但必须记录来源、版本和 SHA256。
  - 正式分发前应做固定版本、白名单下载和校验。
  - VPS 很远是否影响延迟取决于是否 P2P 直连成功：直连成功影响小；走 supernode 中继影响大。

### 后续建议
- 增加 supernode 延迟测试和多节点评分。
- 增加 P2P/中继状态识别能力。

## 2026-06-01 supernode 部署文档与未来自动下载规划

### 本轮目标
- 采用 A 方案：优先从官方源码自行构建 n2n edge。
- 把自动下载 edge 加入未来方向，而不是当前第一版默认能力。
- 给出 VPS 部署 supernode 的可执行步骤。

### 已完成
- 新增 `docs/N2N_SUPERNODE_DEPLOY.md`，包含：
  - Ubuntu/Debian 上安装 n2n。
  - 源码构建 n2n。
  - 临时启动 `supernode -l 7777`。
  - UFW 和云厂商安全组放行 UDP。
  - systemd 常驻服务配置。
  - 客户端填写方式。
  - 延迟判断和常见问题。
- 更新 `PROJECT.md`：把 n2n 自动下载/安装列为未来方向，并规定固定版本、白名单、SHA256 校验和用户确认。

### 下一步
- 用户在 VPS 上按 `docs/N2N_SUPERNODE_DEPLOY.md` 部署 supernode。
- 本地准备 Windows 版 `tools/n2n/edge.exe`。
- 两台电脑用相同 community/secret/supernode，不同 local_ip 做真实互通测试。

## 2026-06-01 n2n edge 未检测到排查

### 现象
- 客户端显示未检测到 n2n edge。

### 本机确认
- 当前 `tools/n2n/` 目录下只有 `.gitkeep` 和 `README.md`，没有 `edge.exe` 或 `n2n.exe`，所以未检测到是正常结果。

### 修复/优化
- 增强 `n2n_backend` 的 edge 查找逻辑：
  - 不再只依赖当前工作目录。
  - 会从当前工作目录和 release exe 所在目录开始，沿祖先目录查找 `tools/n2n/edge.exe` 或 `tools/n2n/n2n.exe`。
  - 未检测到时返回候选目录列表，方便用户放置文件。

### 验证
- `cargo check` 通过。

## 2026-06-01 Windows edge.exe 官方源码构建记录

### 本轮目标
- 采用 A 方案，从 `ntop/n2n` 官方源码构建 Windows 版 `edge.exe`。

### 已完成
- 克隆官方源码到 `tools/n2n/source/n2n`。
- 当前源码提交：`31936c8`。
- 本机使用 MinGW/Git Unix 工具链构建成功：
  - `D:\Git\usr\bin`
  - `C:\mingw64\bin`
  - `mingw32-make edge.exe -j4`
- 已复制产物到：`tools/n2n/edge.exe`。
- 产物 SHA256：`E4AFEFFA39A6DA6A120A4EF9EEE80B7184EA8AE6EF32DED06E960BC54BE9115D`。
- `edge.exe --help` 可正常输出帮助信息。
- `.gitignore` 已忽略 `tools/n2n/source/`；`tools/n2n/*.exe` 已保持忽略，避免把本机二进制直接提交到仓库。

### 说明
- 当前环境没有 autoconf，因此构建时手动生成 `config.mak` 和 `include/config.h`。
- 构建日志中存在 n2n 上游源码的格式化 warning，但最终链接成功。
- 下一步打开客户端网络配置页，确认 n2n edge 检测状态变为可用。

## 2026-06-01 n2n edge 仍未检测到二次排查

### 现象
- `tools/n2n/edge.exe` 已存在，但正在运行的客户端仍显示未检测到。

### 原因
- 构建 `edge.exe` 后，release 客户端没有重新构建/重启；正在运行的是旧的 `lan-helper.exe` 进程，仍使用旧检测逻辑。

### 处理
- 已停止旧进程：`lan-helper.exe`。
- 重新执行 `npm run tauri:build` 成功，生成新的 release 客户端。

### 下一步
- 重新打开 `src-tauri/target/release/lan-helper.exe`。
- 进入网络配置页，n2n 应显示检测到 `tools/n2n/edge.exe`。

## 2026-06-01 n2n 检测提示乱码修复

### 已完成
- 修复 `n2n_backend` 检测成功/失败提示中的乱码。
- 修复 `BackendCard` 中“可用/不可用”和 notes 分隔符乱码。
- 已停止旧 release 客户端进程并重新执行 `npm run tauri:build`，生成新版 `lan-helper.exe`。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。
- `npm run tauri:build` 通过。

### 下一步
- 重新打开 release 客户端确认 n2n 卡片显示：`检测到 n2n edge: ...`。
- 进入真实 n2n 联调：VPS supernode、两台客户端 edge、虚拟 IP 互通、Terraria 端口测试。

## 2026-06-01 n2n 连通性测试与失败原因提示

### 已完成
- 扩展 `ConnectivityTarget`：新增 `mode` 字段，用于区分普通测试、本机游戏端口测试、n2n 虚拟 IP 游戏端口测试。
- 重写 `connectivity_tester`：
  - 修复原有中文乱码。
  - 为成功/失败生成可读诊断 notes。
  - 本机游戏端口失败时提示优先检查游戏服务端是否监听。
  - n2n 虚拟 IP 端口失败时提示按顺序检查：房主本机端口、n2n 配置、local_ip 冲突、防火墙。
- 重写网络配置页：
  - 修复页面中文乱码。
  - 增加“对方虚拟 IP”和“游戏端口”字段。
  - 增加“测本机游戏端口”按钮。
  - 增加“测对方虚拟 IP 游戏端口”按钮。
  - 增加结构化连接报告显示，区分连接成功/失败和判断建议。
- 增加连接报告样式：`result-ok` / `result-bad`。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。
- `npm run tauri:build` 通过。

### 下一步
- 在两台电脑上真实联调：
  1. VPS supernode 运行中。
  2. 双方启动 n2n edge。
  3. 房主启动 Terraria Server。
  4. 房主测 `127.0.0.1:7777`。
  5. 朋友测 `房主虚拟 IP:7777`。
- 根据测试结果继续增强：显示 n2n edge PID、虚拟 IP、supernode 当前配置和复制给朋友的一键说明。

## 2026-06-01 联机向导与内嵌服务端控制台基础

### 本轮目标
- 实现“联机向导”，把普通用户流程整理成房主/加入者两条路径。
- 评估并实现白色命令框内嵌到程序中的可行方案。

### 结论
- 不建议把系统 cmd/Terminal 窗口直接嵌入 UI。
- 推荐做法是由 Tauri/Rust 托管游戏服务端子进程，隐藏原始控制台窗口，捕获 stdout/stderr，并在前端显示为“内嵌服务端控制台”。
- 这种方式更稳定、可控，也便于后续做停止服务端、复制日志、诊断分析。

### 已完成
- 新增 `MultiplayerWizardPage`：
  - 身份选择：我是房主 / 我是加入者。
  - n2n 房间配置：community、secret、supernode、房主虚拟 IP、加入者虚拟 IP。
  - 房主流程：启动 n2n、配置 Terraria 服务端参数、在程序内启动服务端。
  - 加入者流程：根据房主配置启动 n2n，并显示 Join via IP 地址。
  - 自动生成可复制给朋友的邀请信息。
- 导航新增“联机向导”。
- 修复首页和侧栏导航中文乱码。
- 新增 Rust 服务端会话模块 `core/server_session.rs`：
  - 第一版支持 Terraria server。
  - 使用命令行参数启动 TerrariaServer。
  - Windows 下使用 `CREATE_NO_WINDOW` 隐藏外部控制台窗口。
  - 捕获 stdout/stderr 到内嵌日志面板。
  - 支持读取会话状态和停止服务端。
- 新增 Tauri commands：
  - `start_game_server_session`
  - `read_server_session`
  - `stop_server_session`
- 新增前端类型 `serverSession.ts` 和 API 封装。
- 新增 `.console-panel` 样式。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。
- `npm run tauri:build` 通过。

### 注意
- 内嵌控制台第一版先显示日志和停止进程；暂不实现任意 stdin 交互输入。
- Terraria 当前通过 `-world/-players/-port/-pass/-noupnp` 命令行参数避免交互式世界选择。
- 后续可增加：发送服务端命令、保存日志、按行高亮错误、自动识别 Listening on port。

## 2026-06-01 联机向导按钮反馈与内嵌控制台增强

### 问题
- 用户反馈联机向导里的按钮按下貌似没有响应。
- 用户反馈 Terraria Server 白色命令框仍单独出现，两个运行窗口体验不舒服。

### 判断
- 按钮“无响应”的主要原因是前端 async 操作没有统一捕获错误，Tauri invoke 失败时没有把错误显示到 UI。
- 白色命令框不应该作为最终体验存在；应使用“程序托管子进程 + 内嵌日志面板”。如果仍弹出，通常是点击了旧的推荐方案启动项、旧客户端未重启，或 TerrariaServer 自身创建控制台窗口。

### 已完成
- 重写 `MultiplayerWizardPage`，修复中文乱码。
- 为所有关键按钮增加统一错误反馈：失败会显示在状态消息区域。
- 内嵌控制台增加服务端命令输入：
  - 自定义命令输入框。
  - 预设按钮：`help`、`save`、`exit`。
- Rust 服务端会话改为保留 stdin，可向 Terraria Server 发送命令。
- `ServerSessionStatus` 增加 `ready` 字段。
- 根据日志自动识别：`Listening on port` 或 `Server started`，显示服务端是否就绪。
- 新增 Tauri command：`send_server_command`。
- Windows 下继续使用 `CREATE_NO_WINDOW` 隐藏外部控制台。
- 已停止旧 release 客户端并重新构建。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。
- `npm run tauri:build` 通过。

### 下一步
- 用户重新打开新版 `src-tauri/target/release/lan-helper.exe` 测试联机向导按钮反馈。
- 如果“在程序内启动服务端”仍弹出白色命令框，记录具体点击入口和是否有旧 TerrariaServer 进程残留，再考虑更强的 Windows 进程创建策略或改用服务端配置文件模式。

## 2026-06-01 就绪状态样式与后台进程优化

### 用户反馈
- Terraria 日志已显示 `Listening on port 7777`，说明服务端已监听端口，理论上可以联机；但 UI 仍显示红色“未运行”，观感突兀。
- n2n / Terraria Server 外部白色命令窗口仍存在，希望后台运行，不单独出现窗口。

### 已完成
- 联机向导状态显示改为：只要 `ready` 或 `running` 为真，就使用绿色状态样式。
- 增加 `result-idle` 样式，未运行但非错误状态不再使用红色。
- n2n edge 启动时增加 Windows 后台进程 flags：`CREATE_NO_WINDOW | DETACHED_PROCESS`。
- 内嵌 Terraria Server 启动时也增加 `CREATE_NO_WINDOW | DETACHED_PROCESS`。
- 已停止旧 release 客户端并重新构建。

### 说明
- 页面出现 `Listening on port 7777` / `Server started` 时，说明房主本机服务端已就绪；朋友是否能加入还取决于 n2n/Radmin/局域网和防火墙是否互通。
- 如果仍有白色窗口，优先确认是否是旧的 TerrariaServer/n2n 进程残留，或是否从旧“推荐方案启动项”启动，而不是“联机向导 → 在程序内启动服务端”。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。
- `npm run tauri:build` 通过。

## 2026-06-01 Terraria 后台启动修复

### 问题
- 隐藏控制台后 Terraria Server 报 `System.IO.IOException: 句柄无效`。
- 原因：Terraria Server 是控制台程序，会调用 `Console.Title` 等 Console API；直接 `CREATE_NO_WINDOW/DETACHED_PROCESS` 会导致没有有效控制台句柄。
- n2n 保存/启动时白色框闪现后消失，且 UI 缺少明确失败反馈。

### 修复
- Terraria 内嵌服务端改为 PowerShell `Start-Process -WindowStyle Hidden -PassThru` 后台启动：
  - 给 Terraria 一个隐藏窗口环境，避免 `Console.Title` 句柄无效。
  - 不再显示白色 Terraria Server 控制台。
  - 通过 PID 管理服务端进程。
  - 通过检测 `127.0.0.1:端口` 判断是否就绪。
- 明确当前隐藏后台模式的限制：第一版无法捕获实时 stdout，也无法发送 help/save/exit；这些需要后续 Windows ConPTY 真正伪终端方案。
- n2n edge 启动去掉 `DETACHED_PROCESS`，保留 `CREATE_NO_WINDOW`，减少短暂白框/闪退影响。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。
- `npm run tauri:build` 通过。

### 测试建议
- 关闭所有旧的 TerrariaServer.exe / edge.exe / 白色命令框。
- 重新打开新版 release 客户端。
- 从“联机向导 → 在程序内启动服务端”启动。
- 等待状态从“尚未监听”变为“已监听端口，可以邀请朋友加入”。


## 2026-06-01 空白白色命令框与按钮卡顿优化

### 问题
- 用户反馈打开后持续存在一个无内容白色命令框，标题类似项目 `src-tauri` 路径。
- 点击联机向导内多个按钮时存在卡顿，且缺少“正在处理/请稍等”的明确反馈。

### 判断
- 持续空白窗口大概率来自 PowerShell 中转启动 Terraria Server 的隐藏窗口策略不够彻底。
- 直接 `CREATE_NO_WINDOW/DETACHED_PROCESS` 会导致 Terraria Server 没有有效 Console 句柄并报 `System.IO.IOException: 句柄无效`，因此需要“有控制台但隐藏”的启动方式。
- 按钮卡顿主要来自异步操作期间仍可重复点击，以及状态轮询频率较高、可能与手动操作叠加。

### 已完成
- `src-tauri/src/core/server_session.rs`
  - Windows 下改用 `CreateProcessW` 启动 Terraria Server。
  - 使用 `CREATE_NEW_CONSOLE` 给 Terraria Server 有效控制台环境。
  - 使用 `STARTF_USESHOWWINDOW + SW_HIDE` 隐藏控制台窗口，目标是消除持续白色空窗口。
  - Windows PID 检测改用 `OpenProcess + GetExitCodeProcess`，减少 `tasklist` 子进程开销。
- `src/pages/MultiplayerWizardPage.tsx`
  - 增加 `busyAction`，执行中显示“正在处理：xxx，请稍等”。
  - 操作期间禁用关键按钮，避免重复点击。
  - 轮询间隔从 1500ms 放宽到 3000ms，且操作执行中暂停轮询。
- `src/styles/globals.css`
  - 增加 `.busy-banner` 和轻量 loading 动画。
- `src-tauri/Cargo.toml`
  - 增加 `windows-sys` 直接依赖，用于 Windows 进程创建与状态检测 API。

### 验证
- `cargo check` 通过。
- `npm run build` 通过。

### 下一步测试
- 关闭旧的 `lan-helper.exe`、`TerrariaServer.exe`、`edge.exe` 和残留白色命令框。
- 重新构建/打开 release 客户端。
- 在“联机向导”里点击“在程序内启动服务端”，确认不再出现持续空白白色命令框。
- 如果仍出现，需要记录该窗口对应进程 PID/标题，再针对具体进程继续处理。


## 2026-06-01 主程序白色空窗口二次修复

### 问题
- 用户反馈：只要打开联机助手，白色空窗口仍存在。

### 定位
- 这类窗口在打开主程序时就出现，说明不是 Terraria Server/n2n 启动造成，而是 `lan-helper.exe` 自身仍按控制台子系统运行。
- `src-tauri/src/main.rs` 缺少 Tauri/Rust Windows release 常用的 `windows_subsystem = "windows"` 标记。

### 已完成
- `src-tauri/src/main.rs`
  - 增加 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`。
- `src-tauri/tauri.conf.json`
  - 修复产品名和窗口标题，使用 JSON Unicode escape 保存，避免 Windows 终端编码导致乱码。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。
- `npm run tauri:build` 通过。
- 重新启动 release `lan-helper.exe` 后，进程树中只有 `lan-helper.exe` 和 WebView2 子进程；白色 Terminal/OpenConsole 不再作为主程序子进程出现。


## 2026-06-01 透明 Terminal 残影清理

### 问题
- 主程序白框消失后，用户反馈任务栏出现两个透明 Terminal 窗口，很难关闭。

### 定位
- 不是 `lan-helper.exe` 主窗口本身。
- 启动时游戏扫描会运行 `reg query` 等短命令行工具；Windows 11 默认终端可能接管这些控制台子进程，留下 `WindowsTerminal/OpenConsole` 透明残影。

### 已完成
- 清理当前残留：停止旧 `lan-helper.exe`、`TerrariaServer.exe`、`edge.exe`、`WindowsTerminal.exe`、`OpenConsole.exe`。
- 新增 `src-tauri/src/core/process_util.rs`。
- 后台检测/管理命令统一隐藏执行：
  - `reg query`
  - `tasklist`
  - `taskkill`
  - `powershell`
  - `ipconfig`
- `src-tauri/src/lib.rs` 增加窗口关闭时清理托管的 Terraria/n2n 会话，减少残留进程。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。
- `npm run tauri:build` 通过。
- 清理残留后重新打开 release，进程列表显示主窗口为 `lan-helper.exe`，未再出现 `WindowsTerminal/OpenConsole`。


## 2026-06-01 联机向导中文界面恢复

### 已完成
- 将联机向导中临时英文的邀请信息、等待提示、服务端状态、加入说明、控制台说明恢复为中文。
- 保留上一轮无白框、无透明 Terminal、后台命令隐藏执行的修复。

### 验证
- `npm run build` 通过。
- `npm run tauri:build` 通过。

### 下一步
- 进入真实联机验证：确认房主服务端端口已监听、n2n edge 已在双方运行、加入者用房主虚拟 IP + 端口加入。


## 2026-06-01 联机一键自检

### 已完成
- 在联机向导的 n2n 配置区增加“一键自检”和“复制自检结果”。
- 房主侧自检项：supernode、edge.exe、本机虚拟 IP、Terraria 服务端、`127.0.0.1:端口`、`房主虚拟IP:端口`。
- 加入者侧自检项：supernode、edge.exe、本机虚拟 IP、`房主虚拟IP:端口`。
- 邀请信息改为更适合发给朋友的中文步骤格式。

### 验证
- `npm run build` 通过。
- `cargo check` 通过。
- `npm run tauri:build` 通过。

### 下一步
- 用当前一台电脑先点房主侧“一键自检”，确认房主侧结论为通过。
- 然后找一位朋友按邀请信息跑加入者侧自检。

## 2026-06-02 产品定位纠偏：通用组网层与游戏向导分离

用户明确指出：项目要按可发布产品推进，不能把截图问题当作纯显示修复；关键内容必须写入项目文件，关键操作要形成项目记忆。

本轮关键决策：

- n2n / Radmin / Manual LAN 是通用组网层，不应绑定 Terraria 或单个游戏。
- Terraria 向导只是第一个游戏辅助场景，负责一键开服、世界、端口、邀请文本和游戏特有诊断。
- 支持 LAN/IP 的大量游戏不应逐个重复配置 n2n；组网成功后，游戏只需要连接房主虚拟 IP 和对应端口。
- UI 必须反映真实内部状态，不能只把红叉改成绿勾。
- “Listening on port 7777 后几秒变灰/退出”是服务端生命周期发布阻断问题，必须记录日志和退出原因继续处理。

新增项目文件：

- `docs/PRODUCT_MEMORY.md`：记录产品级原则、组网层/游戏层分离、当前测试基线和发布阻断项。
- `docs/DEVELOPMENT_PROGRESS.md`：记录 n2n、Radmin、Manual LAN、Terraria 向导等联机方式的规划与当前进度。

代码方向调整：

- `NetworkSetupPage` 改为“通用组网中心”，强调组网能力不绑定具体游戏。
- `Layout` 导航改为：首页、通用组网中心、Terraria 向导、游戏扫描、推荐方案、诊断报告。
- `HomePage` 默认引导用户先进入通用组网中心，再按需进入 Terraria 向导。

## 2026-06-02 MVP 发布阻断项推进：服务端退出诊断与 n2n 状态闭环

本轮继续围绕“先完全解决发布阻断项，再完成 MVP”推进。

已完成：

- `server_session` 不再只依赖 PID/端口快照判断服务端状态，改为持有 `Child` 并通过 `try_wait()` 获取真实退出状态。
- 服务端状态新增 `exit_code`、`exited_at`、`ever_ready`，用于诊断“曾经监听 7777 后几秒退出”的发布阻断项。
- 内嵌控制台会保留最后日志，并在退出后显示退出码、退出时间、是否曾经监听端口。
- 房主自检不再把“端口短暂可达”当作通过；必须服务端进程仍在运行且端口可达，Terraria 服务端项才通过。
- n2n 后端检测结果新增运行态说明：edge 路径、记录 PID 是否仍在运行、当前虚拟 IP、最近一次 supernode。

验证：

- `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
- `npm run build` 通过。

仍需真实运行验证：

- 使用 release `lan-helper.exe` 启动 Terraria 服务端，观察 15-30 秒是否仍会退出。
- 若退出，使用新增退出诊断继续定位根因。

## 2026-06-02 MVP 诊断报告与发布验证清单

本轮补齐发布级诊断闭环：

- 诊断报告现在汇总 n2n edge、虚拟 IP、网络后端、内嵌服务端 running/ready/ever_ready/exit_code。
- 诊断报告页面恢复中文，并增加等待态和摘要展示。
- 新增 `docs/MVP_RELEASE_CHECKLIST.md`，明确 MVP 发布前必须验证的通用组网、Terraria 服务端、房主/加入者、自检和诊断报告项目。

注意：目标尚未完成，因为仍缺少 release 客户端真实运行 30 秒稳定性验证和朋友侧加入验证。

## 2026-06-02 30 秒稳定性门禁

为了让“监听后几秒变灰”这个发布阻断项可验证，本轮加入了服务端运行时长字段：

- 后端 `ServerSessionStatus` 新增 `started_at` 和 `uptime_seconds`。
- 联机向导显示服务端运行时长；当服务端已监听且运行超过 30 秒时，显示“30 秒稳定性已通过”。
- 诊断报告会输出 `uptime_seconds`，并给出 `Terraria 30 秒稳定性：通过/未通过或尚未验证`。
- `docs/MVP_RELEASE_CHECKLIST.md` 同步更新 30 秒稳定性门禁。

## 2026-06-02 结构化 MVP 发布检查

本轮把诊断报告从纯文本详情升级为结构化发布检查：

- `DiagnosticReport` 新增 `release_checks`。
- 每个检查项包含 `id`、`label`、`ok`、`detail`、`required_for_mvp`。
- 诊断报告页面会显示 MVP 必需项通过数量，并逐项显示 ✅/❌。
- 当前 MVP 必需检查包括：n2n edge、n2n 虚拟 IP、n2n 运行态、Terraria 30 秒稳定性、服务端退出诊断、诊断隐私边界。

这让“是否可以发布”不再依赖口头判断，而是由客户端生成可复制的结构化证据。
