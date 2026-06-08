# 监督验收｜真实双机回归证据门禁

## 本轮目标

真实双机 Palworld / Minecraft / Stardew / Cuphead 回归仍未完成。为避免后续只用口头“已通过”替代证据，本轮新增机器可读证据清单和验证脚本，要求每个游戏必须回填房主/加入者环境、截图、诊断报告和日志后才能宣称实机通过。

## 修改文件

- `package.json`
  - 新增脚本：`regression:dual-machine:verify`
- `tools/verify_dual_machine_regression_evidence.cjs`
  - 新增证据验证脚本。
  - 检查四个必测游戏是否存在：`palworld`、`minecraft_java`、`stardew_valley`、`cuphead`。
  - 如果某游戏标为 `passed`，强制要求房主/加入者环境、路线、结果摘要、截图、诊断报告和日志。
  - 防止 `release_claims.can_claim_v1` 或 `can_claim_real_dual_machine_passed` 在证据不足时被置为 `true`。
- `docs/acceptance-artifacts/dual-machine-regression-evidence-v031-2026-06-08.json`
  - 新增 v0.3.1 真实双机证据清单。
  - 当前四个游戏均为 `pending`，不能宣称通过。
- `docs/acceptance-artifacts/dual-machine-regression-evidence-verification-2026-06-08.json`
  - 新增验证输出。

## 验证命令

```powershell
npm.cmd run regression:dual-machine:verify
npm.cmd run build
cargo check --manifest-path src-tauri\Cargo.toml
git diff --check -- package.json tools/verify_dual_machine_regression_evidence.cjs docs/acceptance-artifacts/dual-machine-regression-evidence-v031-2026-06-08.json docs/acceptance-artifacts/dual-machine-regression-evidence-verification-2026-06-08.json
rg -n "<常见 mojibake / replacement-character 模式>" package.json tools/verify_dual_machine_regression_evidence.cjs docs/acceptance-artifacts/dual-machine-regression-evidence-v031-2026-06-08.json docs/acceptance-artifacts/dual-machine-regression-evidence-verification-2026-06-08.json
```

## 命令结果

- `npm.cmd run regression:dual-machine:verify`：通过。
- 验证输出：
  - `passed_games=[]`
  - `pending_or_not_passed_games=["palworld","minecraft_java","stardew_valley","cuphead"]`
  - `can_claim_real_dual_machine_passed=false`
  - `issues=[]`
- `npm.cmd run build`：通过，2163 modules transformed。
- `cargo check`：通过。
- `git diff --check`：通过，仅 LF/CRLF warning。
- 乱码扫描：无命中。

## 结论

当前可以证明：项目不会因为缺少真实双机证据而误宣称 v1.0 或实机通过。

当前不能证明：

- Palworld 已完成真实双机游戏内加入；
- Minecraft Java 已完成真实双机游戏内加入；
- Stardew Valley 已完成真实双机游戏内加入；
- Cuphead 已完成远程同屏路线实机验证；
- Steam Relay / P2P 已完成双机双账号实机回归。

## 下一步

开发线程必须按 `docs/acceptance-artifacts/dual-machine-regression-evidence-v031-2026-06-08.json` 回填真实证据。只有对应游戏状态改为 `passed` 且 `npm.cmd run regression:dual-machine:verify` 通过后，才允许把该游戏写成实机通过。
