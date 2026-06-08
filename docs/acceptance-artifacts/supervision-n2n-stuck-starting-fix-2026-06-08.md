# 监督验收：组网卡在“启动中 / 已配置未启动”修复复核（2026-06-08）

## 背景
用户反馈两台朋友机器：一台启动组网后长期停在“启动中”，另一台诊断为“已配置未启动 / 组网服务未运行”。关闭防火墙后仍无法继续。

## 本轮复核/修复重点
- `running && !ready` 不再只提示“启动中 / 等待刷新”，改为明确说明“组网程序已启动，但中继尚未确认”。
- `configured && !running` 明确提示“已配置未启动”，并引导复制诊断报告、手动启动命令和 edge 日志。
- 前端状态优先识别：认证/密钥错误、IP 冲突、中继无响应、TAP/Wintun 网卡错误、PID 过期或进程退出。
- 后端 `N2nDiagnostics` 暴露可观测字段：`executable_found`、`recorded_pid`、`recorded_pid_running`、`connection_state`、`manual_start_command`。
- 后端诊断 summary 从乱码/术语化描述恢复为普通用户可读中文。

## 关注文件
- `src-tauri/src/models/network.rs`
- `src-tauri/src/network/n2n_backend.rs`
- `src/types/network.ts`
- `src/product-ui/statusCenter.ts`
- `src/product-ui/ProductNetworkView.tsx`
- `src/product-ui/errorActions.ts`

## 已运行验证
- `cargo fmt --manifest-path src-tauri\Cargo.toml`
- `cargo test --manifest-path src-tauri\Cargo.toml n2n_diagnostics_fixture -- --nocapture`
  - 结果：8 passed
- `cargo check --manifest-path src-tauri\Cargo.toml`
  - 结果：通过
- `npm.cmd run build`
  - 结果：通过，2163 modules transformed
- `git diff --check -- src-tauri/src/models/network.rs src-tauri/src/network/n2n_backend.rs src/product-ui/statusCenter.ts src/product-ui/ProductNetworkView.tsx src/product-ui/errorActions.ts src/types/network.ts`
  - 结果：无 whitespace error，仅 LF/CRLF warning
- 乱码扫描：`rg -n "\?\?\?\?|宸|鏈|鍚|寰|鎴|鍔|绔|銆|妫€|�" ...`
  - 结果：无命中

## 结论
本轮已把“启动中”长期等待的问题推进为可诊断状态：用户能看到中继未确认、未启动、PID 失效、网卡错误、密钥错误、IP 冲突等更明确原因。仍需开发线程补交最终汇报，并建议后续做 release EXE 级截图/DOM 验收。
