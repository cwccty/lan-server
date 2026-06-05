# Adapter Registry 示例目录

这是联机助手远程共享适配器库的本地示例。

## 目录结构

```text
adapter-registry/
├─ index.json
└─ games/
   ├─ terraria.json
   ├─ minecraft_java.json
   └─ stardew_valley.json
```

## 本地测试

在项目根目录执行：

```powershell
cd <repo>
python -m http.server 8088
```

然后在客户端“适配器管理 → 远程共享适配器库”里填写：

```text
http://127.0.0.1:8088/adapter-registry/index.json
```

点击“同步共享适配器库”。同步成功后，客户端会把远程适配器保存为：

```text
adapters/games/registry_<game_id>.json
```

## 部署到 VPS

把整个 `adapter-registry` 目录上传到任意静态 Web 目录，例如 Nginx：

```text
/var/www/html/adapter-registry/index.json
/var/www/html/adapter-registry/games/*.json
```

客户端填写：

```text
https://你的域名/adapter-registry/index.json
```

## 部署到 GitHub Pages

把 `adapter-registry` 目录提交到仓库并开启 GitHub Pages 后，客户端填写 Pages 地址下的 `index.json`。

## 更新 sha256

每次修改 `games/*.json` 后，需要重新生成 `index.json` 里的 sha256。可以重新运行项目里的生成脚本，或用任意 sha256 工具计算。

## 自动生成 index.json

项目现在提供本地生成脚本：

```powershell
powershell -ExecutionPolicy Bypass -File tools\update_adapter_registry_index.ps1
```

脚本会：

1. 扫描 `adapter-registry/games/*.json`。
2. 读取每个 adapter 的 `game_id` 和 `steam_appid`。
3. 计算 adapter 文件的 SHA256。
4. 生成或覆盖 `adapter-registry/index.json`。

如果只想预览输出而不写入文件：

```powershell
powershell -ExecutionPolicy Bypass -File tools\update_adapter_registry_index.ps1 -NoWrite
```

如果你的 registry 目录不在默认位置：

```powershell
powershell -ExecutionPolicy Bypass -File tools\update_adapter_registry_index.ps1 -RegistryDir D:\registry\adapter-registry
```

每次新增或修改 `adapter-registry/games/*.json` 后，都应先运行这个脚本，再把 `games/*.json` 和新的 `index.json` 一起提交或上传到 GitHub Pages / VPS。
