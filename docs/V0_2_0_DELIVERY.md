# v0.2.0 交付说明

日期：2026-06-08

## 当前版本与提交状态

- 版本：`v0.2.0` release candidate
- 提交：`ecbd8f0 chore: mark v0.2.0 release candidate`
- 远端状态：`ecbd8f0` 已推送到 `origin/master`
- 标签：`v0.2.0` 已创建并推送
- 说明：当前代码远端已同步；后续发布还需要确认 GitHub Release 页面和 ZIP 资产是否创建成功。

## 本版做了什么

### 普通用户体验

- 恢复首页适度信息密度：让用户能看到当前状态、下一步、房主/加入者该做什么。
- 补齐开房和加入说明：房主先选游戏、启动组网或服务端、检测端口、复制完整邀请；加入者粘贴邀请、进入同一联机房间、按提示到游戏内连接。
- 诊断页优先展示“先修这 1-3 件事”，减少只看到原始报告但不知道怎么修的问题。
- 特殊连接工具页补充普通用户说明：端口代理、UDP 广播桥、通用服务端分别适合什么场景、怎么自测。

### 方案库与多游戏说明

- 补齐 Terraria / Palworld / Minecraft Java / Stardew Valley / Cuphead 的用户可见联机闭环文案。
- 将用户不易理解的底层组网词，替换为“房主联机地址 / 组网服务 / 连接状态正常 / 中继地址”等产品语言。
- 方案库页恢复“重点推荐 + 游戏网格 + 更多游戏马上呈现”的扩展布局。

### Steam 中继 / P2P（实验）

- 新增合法 Steamworks 预检 stub 与 UI 入口。
- 可显示 Steam 客户端、`STEAMWORKS_SDK_DIR`、SDK redist、AppID、不可用原因和下一步配置说明。
- 明确边界：不会修改游戏文件，不绕过 Steam/游戏拥有权，不复制游戏目录 DLL。
- 当前只是预检入口和状态 stub，不代表真实 Steam P2P 转发已经完成。

### 版本与打包

- 项目版本已 bump 到 `0.2.0`。
- 打包脚本默认读取 `package.json` 版本，生成 v0.2.0 ZIP。

## 怎么运行

### 开发/预览

```powershell
npm install
npm run build
npm run preview -- --host 127.0.0.1 --port 1421
```

### Tauri 开发模式

```powershell
npm run tauri:dev
```

### Release EXE

```powershell
.\src-tauri\target\release\lan-helper.exe
```

## 怎么验证

推荐验收命令：

```powershell
node -e "const p=require('./package.json'); const l=require('./package-lock.json'); console.log({pkg:p.version, lockTop:l.version, lockPkg:l.packages[''].version})"
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri:build
npm run release:zip
npm run release:zip:verify
```

Release EXE smoke：

```powershell
$p = Start-Process -FilePath .\src-tauri\target\release\lan-helper.exe -PassThru
Start-Sleep -Seconds 5
Get-Process -Id $p.Id
Stop-Process -Id $p.Id -Force
```

关键页面建议人工复核：

- 首页：是否看到当前状态、房主/加入者下一步、网络拓扑状态。
- 方案库：是否看到 Terraria / Palworld / Minecraft / Stardew Valley / Cuphead 和“更多游戏马上呈现”。
- 特殊连接工具：是否看到 `Steam 中继 / P2P（实验）`，并能显示 Steam 预检项与不可用原因。
- 诊断报告：是否优先显示“先修这 1-3 件事”。

## 当前 ZIP

- ZIP 路径：`release-artifacts\LanHelper-v0.2.0-windows-x64.zip`
- SHA256：`5B9654BE0A0DFF5490D334C254CC39221BA7CA008B3C8EC4E796E126C5C1B18B`
- 验证结果：`npm run release:zip:verify` 已通过。

## 创建 GitHub Release

如果 `v0.2.0` 标签已经存在，但 GitHub Release 页面还没有创建，可由具备仓库发布权限的运行者执行：

```powershell
$env:GITHUB_TOKEN='<repo release 权限 token>'
powershell -ExecutionPolicy Bypass -File tools\update_github_release_v0_1.ps1 -CreateIfMissing
```

注意：不要把真实 token 写入文档、命令历史、提交信息或日志。也可以使用 `GH_TOKEN` 环境变量。首次发布前可先 dry run：

```powershell
powershell -ExecutionPolicy Bypass -File tools\update_github_release_v0_1.ps1 -CreateIfMissing -DryRun
```

该脚本会读取 `docs\GITHUB_RELEASE_DRAFT.md` 作为发布说明，并追加本地 ZIP 的 SHA256。

## 已知风险与边界

- GitHub Release asset 尚未确认上传到 v0.2.0 ZIP。
- Steam 中继 / P2P 当前只是合法预检 stub，不是真实 P2P 联机功能完成。
- 未配置 Steamworks SDK、AppID、Steam 登录和双机/双账号环境时，不能启动真实 Steam P2P 连接。
- Palworld / Minecraft / Stardew Valley / Cuphead 尚未执行真实双机回归，不能声称实机通过。
- 当前工作树仍有历史修改和本地产物；后续提交必须严格选择文件，不能全量提交。

## 后续建议

1. 确认 GitHub Release 资产上传为 `LanHelper-v0.2.0-windows-x64.zip`，并核对远端 digest。
2. 如需继续迭代，将以本说明中的风险清单作为后续验收入口。
3. 后续 v0.2.x 可继续补真实 Steamworks SDK 集成前置、双机验证记录和多游戏实机回归。
