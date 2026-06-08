# v0.3.1 朋友组网回传分流规则

用途：收到两台电脑的回传后，先用本规则判断问题属于“本机未启动”还是“中继未确认”，避免继续只看截图或反复点注册修复。

## 必须同时收齐

每台电脑都必须提供：

- 电脑身份：房主 / 加入者；
- Windows 版本；
- 网络环境：家用宽带 / 校园网 / 公司网 / 手机热点 / 其他；
- 是否管理员运行联机助手；
- 软件版本；
- ZIP SHA256；
- EXE SHA256；
- 页面状态；
- 中继地址；
- 房间名；
- 本机联机地址；
- 对方联机地址；
- 注册修复是否有效；
- 完整诊断报告；
- 手动启动命令；
- 组网日志；
- 组网页截图和诊断报告页截图。

缺少“完整诊断报告 / 手动启动命令 / 组网日志”任意一项时，不应判定为已定位，只能要求补证据。

## 分流规则

### A. 已配置未启动

命中条件之一：

- 页面状态包含“已配置未启动”；
- `connection_state=configured_not_started`；
- `connection_state=pid_stale_or_exited`；
- `running=false` 且 `recorded_pid_running=false`；
- 组网日志有“启动后立即退出”“启动组网程序失败”“Cannot find TAP device”“unable to open tap”等。

优先排查：

1. 是否从 ZIP 内直接运行，是否完整解压到新目录；
2. 是否管理员运行；
3. 安全软件是否拦截 `tools/n2n/edge.exe`；
4. `组网程序路径 / executable_path` 是否存在；
5. `recorded_pid` 是否存在且存活；
6. 手动启动命令在管理员 PowerShell 里是否秒退；
7. 虚拟网卡/TAP/Wintun 是否缺失或打不开。

### B. 中继尚未确认

命中条件之一：

- 页面状态包含“中继尚未确认”；
- `connection_state=waiting_for_ack`；
- `running=true` 但 `ok_link=false`；
- `ack=false` 且 `pong=false`；
- 组网日志没有 ACK/PONG，但没有明确 TAP/权限/启动失败。

优先排查：

1. 两台电脑中继地址是否完全一致；
2. 房间名和密钥是否完全一致，是否有空格/全角字符；
3. 本机联机地址是否互不相同；
4. 当前网络是否拦截 UDP 出站；
5. 路由器、校园网、公司网、运营商网络或安全软件是否拦截；
6. 尝试一台或两台切到手机热点，判断是否网络环境问题；
7. 中继服务器是否真的在线且端口放行。

### C. 参数错误/冲突

- `auth_error=true` 或 `connection_state=auth_error`：房间名/密钥不一致。
- `ip_mac_conflict=true` 或 `connection_state=ip_mac_conflict`：联机地址冲突。
- `not_responding=true` 或 `connection_state=supernode_not_responding`：中继地址无响应或 UDP/服务端端口不可达。
- `tap_error=true` 或 `connection_state=tap_error`：虚拟网卡/权限/驱动问题。

## 验收结论模板

- 若两台都 `ready/ok_link=true`：可以进入游戏实测，但仍需记录游戏名、端口、连接方式和结果。
- 若任一台未启动：先修该机器本机启动问题，不要继续调中继参数。
- 若两台都运行但未确认：先对照中继/房间/密钥/联机地址，再测手机热点或中继端口。
- 若材料缺失：退回补“完整诊断报告 + 手动启动命令 + 组网日志”。
