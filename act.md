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
