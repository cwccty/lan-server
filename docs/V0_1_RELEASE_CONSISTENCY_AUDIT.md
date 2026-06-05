# v0.1.0 发布一致性审计

更新时间：2026-06-05

## 当前阶段

联机助手当前处于 `0.1.0 早期公开测试版 / MVP 后首个公开体验包` 阶段。

已经具备公开小范围测试价值：

- n2n 主线组网与 edge 状态检测；
- 房主邀请包与加入者粘贴加入闭环；
- 游戏扫描、推荐路线、共享游戏方案库；
- TCP / UDP / UDP 广播桥高级连接工具；
- Terraria 房主侧服务端向导；
- 诊断报告、修复建议、真实 EXE 烟测与发布预检。

不能宣传为：

- 所有游戏都能一键联机；
- 所有非局域网游戏都能转换成本地联机；
- 单机 Join via IP 等同于真实双机验证；
- 未审核游戏方案一定正确。

## GitHub Release 现状

已发布 `v0.1.0` GitHub Release：

- Release 名称：`联机助手 v0.1.0`
- 状态：Prerelease / 早期公开测试版
- 资产：`LanHelper-v0.1.0-windows-x64.zip`
- 当前 `master` 已推送清理提交：`4b36a6f`
- 当前 `v0.1.0` tag 已移动并推送到清理后的提交：`4b36a6f`。\n- 当前 GitHub Release 资产仍是旧 ZIP，SHA256 为 `3a26d8cc8ec66473c216a930fe08742a04cf460cf60843bcceeedc5cc30ba45d`
- 本地已生成的新 ZIP 为 `release-artifacts/LanHelper-v0.1.0-windows-x64.zip`，SHA256 为 `91617585501427da6bb2502e18ad28e0bc1038270c04db00364e7a4b04331a75`
- GitHub API 查询到旧资产下载数为 `0` 时，替换 `v0.1.0` 资产仍可接受；若之后下载数大于 0，建议改发 `v0.1.1`

## 已发现并处理的问题

### 1. 源码、tag、release 资产不一致

`v0.1.0` tag 指向的源码不是当前工作区最新状态。当前工作区已经继续加入邀请包补强、共享库增强、诊断修复增强、发布预检增强等内容。

处理原则：

- 不建议在用户已经看到 Release 后继续把内部状态混在 `v0.1.0` 里；
- 若下载数仍为 0，可以替换 `v0.1.0` 资产并保留 prerelease；
- 更稳妥做法是提交当前修复后发布 `v0.1.1` 修正版。

### 2. 发布包构建会残留本机路径

Rust/Tauri release EXE 可能残留本地源码路径或 Cargo 依赖路径。

已加入：

- `src-tauri/Cargo.toml` 的 release profile：`debug = 0`、`strip = "symbols"`；
- `tools/build_tauri_release_clean.ps1`：使用 `RUSTFLAGS --remap-path-prefix` 清理路径，并在构建后扫描 EXE；
- `package.json`：`npm run tauri:build` 改为走干净构建脚本。

### 3. 手动测试后的解压目录含运行时文件

运行后的 n2n 目录可能生成：

- `tools/n2n/edge.log`
- `tools/n2n/edge.stdout.log`
- `tools/n2n/edge.stderr.log`
- `tools/n2n/last_config.json`
- `tools/n2n/n2n.pid`

这些文件可能包含测试房间、Supernode、虚拟 IP 或日志，不应进入 GitHub Release。

已加入：

- `tools/prepare_windows_x64_zip.ps1`：只复制白名单文件，自动排除运行时日志/配置；
- `tools/verify_windows_x64_zip.ps1`：校验 ZIP 中不存在运行时文件；
- `tools/verify_v0_1_release_package.ps1`：校验 staging 包不存在运行时文件和本地路径。

### 4. 公开文案存在内部话术

已把面向用户的表达从开发评审口吻，改为“当前状态 + 用户下一步动作”的产品说明：

- 当前证据不足，建议先补充联机方式、端口或实测结果，再生成推荐方案；
- 当前方案仍需确认，请先补充端口、联机方式或实测证据，再用于开房邀请；
- 当前证据不足，暂不生成开房邀请，请先补充测试步骤或方案证据。

README 与 Release 草稿已改为“早期公开测试版”和“游戏方案库”口径，减少 `MVP / PENDING / adapter / registry` 等内部词直接暴露给普通用户。

## 当前必须继续解决的问题

1. **重新跑完整发布门禁**：`npm run release:gate`，确认干净构建、烟测、staging 包和 Windows ZIP 均通过。
2. **重新生成 GitHub ZIP 资产**：使用 `npm run release:zip -- -Clean` 生成 `release-artifacts/LanHelper-v0.1.0-windows-x64.zip`。
3. **确认 EXE 不含本地路径**：干净构建脚本会自动扫描，失败则不能发布。
4. **决定版本策略**：
   - 下载数仍为 0：可以替换 v0.1.0 资产；
   - 若已经有人下载：建议发布 v0.1.1 修正版。
5. **补真实双机验证**：至少完成一组房主/加入者真实设备或虚拟机验证，再更新 Release 文案。

## 下一步推荐

如果要替换 `v0.1.0` 资产：

1. 打开 GitHub Release：`https://github.com/cwccty/lan-server/releases/tag/v0.1.0`
2. 删除旧的 `LanHelper-v0.1.0-windows-x64.zip`
3. 上传新的 `release-artifacts/LanHelper-v0.1.0-windows-x64.zip`
4. 在 Release 正文中补充新 SHA256：`91617585501427da6bb2502e18ad28e0bc1038270c04db00364e7a4b04331a75`
5. 保持 `Prerelease`，不要写“所有游戏一键联机”

如果要改发 `v0.1.1`，优先执行：

```powershell
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run adapter:validate
npm run tauri:build
npm run release:package -- -Clean
npm run release:package:verify
npm run release:zip -- -Clean
npm run release:zip:verify
npm run release:preflight
```

全部通过后，新建 `v0.1.1` Release，并上传同一份新 ZIP 或重新按 `Version=0.1.1` 打包。

