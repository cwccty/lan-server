# 监督验收｜v0.3.1 候选门禁接入真实双机证据验证

## 本轮目标

上一轮已新增 `regression:dual-machine:verify`，但它还只是独立命令。本轮将真实双机证据门禁接入发布检查流程，并新增 v0.3.1 专用候选门禁，保证候选包在发布前会检查：

- 前端构建；
- Rust 编译；
- n2n “启动中 / 已配置未启动”诊断 fixture；
- 方案库校验；
- 真实双机回归证据清单；
- Windows ZIP 校验；
- ZIP 不包含外部 helper / Steam DLL / WinTUN / `steam_appid.txt`。

## 修改文件

- `tools/release_preflight.ps1`
  - required file 清单加入 `tools/verify_dual_machine_regression_evidence.cjs`。
  - release preflight 中新增 `dual machine regression evidence gate` 步骤。
- `tools/run_v0_3_1_release_gate.ps1`
  - 新增 v0.3.1 专用候选门禁脚本。
- `package.json`
  - 新增脚本：`release:gate:v031`。
- `docs/acceptance-artifacts/v031-release-candidate-gate-2026-06-08.json`
  - 新增 v0.3.1 候选门禁输出。

## 验证命令

```powershell
npm.cmd run release:preflight
npm.cmd run release:gate:v031
git diff --check -- package.json tools/release_preflight.ps1 tools/run_v0_3_1_release_gate.ps1 tools/verify_dual_machine_regression_evidence.cjs docs/acceptance-artifacts/v031-release-candidate-gate-2026-06-08.json docs/acceptance-artifacts/dual-machine-regression-evidence-verification-2026-06-08.json
```

## 命令结果

### `npm.cmd run release:preflight`

- 新增的 `dual machine regression evidence gate` 步骤已执行并显示 PASS。
- 但旧的总 `release_preflight.ps1` 当前仍失败，失败项为历史/大范围产品闭环守卫，共 28 项，不是本轮新增证据门禁导致。
- 因此不能宣称旧总 preflight 已通过。

### `npm.cmd run release:gate:v031`

通过，关键结果：

- `npm build`：PASS。
- `cargo check`：PASS。
- `n2n diagnostics fixtures`：PASS，8 passed。
- `adapter registry validation`：PASS，Adapters=5，Warnings=0，Errors=0。
- `dual machine regression evidence gate`：PASS。
  - `passed_games=[]`
  - `pending_or_not_passed_games=["palworld","minecraft_java","stardew_valley","cuphead"]`
  - `can_claim_real_dual_machine_passed=false`
  - `issues=[]`
- `windows zip verification`：PASS，payload_files=21。
- `zip excludes external helper files`：PASS，external_helper_matches=0。

候选产物：

- ZIP SHA256：`C995673A13514CAD543DAE6B1290660CD08BB3AEBA15C94F20027D02ED79D695`
- EXE SHA256：`6413331E226C160806ADE31B92E10378D4080CACA5AF09CEF93F55031F640C3F`

## 结论

- v0.3.1 专用候选门禁已可用并通过。
- 真实双机证据门禁已接入旧 `release_preflight.ps1`，但旧总 preflight 仍有历史失败项，需要后续开发线程修复或拆分过期守卫。
- 当前仍不能宣称 v1.0 或真实双机已通过。
