# 监督验收｜组网卡在“启动中 / 已配置未启动”跟进

## 用户反馈

- 机器 A：启动组网后长期卡在“启动中”。
- 机器 B：诊断显示“已配置未启动 / 组网服务未运行”。
- 两边关闭防火墙后仍无法继续。

## 判断

- “启动中”不等于已经能联机，只表示组网程序进程被检测到；若没有中继确认，仍可能是中继地址不可达、房间名/密钥不一致、联机地址冲突、虚拟网卡异常或程序启动后异常。
- “已配置未启动”表示本地配置已保存，但联机助手没有检测到有效的组网进程；常见原因是组网程序文件缺失、权限不足、PID 过期、启动后立即退出、虚拟网卡异常。
- 关闭防火墙只能排除一部分入站拦截，不能排除上述问题。

## 本轮修复

- `src/product-ui/ProductNetworkView.tsx`
  - 主流程文案改为普通用户语言：组网服务、中继确认、中继地址、联机地址。
  - “加入与组网”侧边状态卡新增普通用户可见的排查入口：
    - 复制完整诊断报告；
    - 复制手动启动命令；
    - 复制组网日志。
  - 删除“只等待 ACK/PONG 刷新”的表达，改为 20 秒后进入诊断并复制证据。
- `src/product-ui/statusCenter.ts`
  - 将“edge 日志”改为“组网日志”，避免普通用户界面暴露过多底层术语。

## 验证命令

```powershell
cargo fmt --manifest-path src-tauri\Cargo.toml
cargo test --manifest-path src-tauri\Cargo.toml n2n_diagnostics_fixture -- --nocapture
cargo check --manifest-path src-tauri\Cargo.toml
npm.cmd run build
node tools\verify_status_center_fixtures.cjs
git diff --check -- src-tauri/src/models/network.rs src-tauri/src/network/n2n_backend.rs src-tauri/src/core/diagnostic_logger.rs src/product-ui/statusCenter.ts src/product-ui/ProductNetworkView.tsx src/product-ui/errorActions.ts src/types/network.ts
rg -n "\?\?\?\?|宸|鏈|鍚|寰|鎴|鍔|绔|銆|妫€|�" src-tauri/src/core/diagnostic_logger.rs src-tauri/src/network/n2n_backend.rs src/product-ui/statusCenter.ts src/product-ui/ProductNetworkView.tsx src/product-ui/errorActions.ts src/types/network.ts
```

## 验证结果

- Rust 诊断 fixture：8 passed。
- `cargo check`：通过。
- `npm.cmd run build`：通过，2163 modules transformed。
- `statusCenter` fixture：6 scenarios passed。
- `git diff --check`：通过，仅 LF/CRLF warning。
- 乱码扫描：无命中。

## 浏览器验收

- 预览地址：`http://127.0.0.1:4175`
- 页面：加入与组网
- DOM 结果：
  - `hasDiagnosticActions=true`
  - `hasStuckAdvice=true`
  - `hasCopyReport=true`
  - `hasCopyManual=true`
  - `hasCopyLogs=true`
  - `hasOldWait=false`
  - `hasOldPlainStarting=false`
  - `hasOldAckPongStatusRefresh=false`

## 证据

- `docs/acceptance-artifacts/status-center-n2n-fixtures-2026-06-08.json`
- `docs/acceptance-artifacts/n2n-network-diagnostic-actions-dom-2026-06-08.json`
- `docs/acceptance-artifacts/n2n-network-diagnostic-actions-2026-06-08.png`

## 未解决

- 这只是诊断闭环与普通用户排查入口修复，不等于真实双机联机已通过。
- Palworld / Minecraft / Stardew / Cuphead 真实双机回归仍需继续收集证据。
