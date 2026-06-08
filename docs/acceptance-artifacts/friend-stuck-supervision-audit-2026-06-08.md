# Friend stuck networking supervision audit (v0.3.1)

Date: 2026-06-08
Scope: User reported two real friend machines: one stuck at “启动中”, another at “已配置未启动”; Windows firewall was disabled; “注册修复” did not solve it.

## Current interpretation

### 已配置未启动
This is a local startup layer problem. Configuration exists, but the n2n/edge networking process is not detected as running or the previously recorded PID is stale/exited.

Likely causes to check first:
- LanHelper was not run as administrator.
- `tools/n2n/edge.exe` is missing, quarantined, blocked, or exits immediately.
- TAP/Wintun/virtual adapter is missing or cannot be opened.
- Security software blocks process creation or driver access.
- The package was run from inside the ZIP or from a stale/extracted old directory.

### 组网程序已启动，但中继尚未确认 / old “启动中”
This is a relay acknowledgement/connectivity layer problem. The local edge process is running, but ACK/PONG from the relay/supernode has not been observed.

Likely causes to check first:
- Relay address or port is wrong/unreachable.
- Room name or key differs between machines.
- Both machines use the same LAN-helper virtual IP.
- UDP outbound is blocked by router/campus/company network/ISP/security software, even if Windows firewall is off.
- Relay server is offline or not listening on the expected UDP port.

## 注册修复 boundary
“注册修复” must not be treated as a universal fix. It may help with local app/protocol registration style problems, but it does not prove or repair:
- edge process startup failure;
- TAP/Wintun/virtual adapter failure;
- relay reachability;
- UDP outbound restrictions;
- room/key mismatch;
- LAN-helper IP conflict.

Current UI source includes a fallback hint: if “注册修复” is ineffective, do not repeat it; copy manual start command, run with administrator permissions, and check virtual adapter/networking program files.

## Evidence checked locally

Commands run by supervision thread:

```powershell
npm.cmd run network:diagnostic:verify
cargo test --manifest-path src-tauri\Cargo.toml n2n_diagnostics_fixture --lib
npm.cmd run friend:retest:triage -- --self-test
```

Results:
- `network:diagnostic:verify`: PASS.
- n2n diagnostics fixtures: PASS, 8 passed.
- friend retest triage self-test: PASS.

Coverage confirmed:
- UI no longer relies on a plain “启动中” label for running without relay confirmation.
- UI exposes copy actions for full report, manual start command, and networking logs.
- UI distinguishes “已配置未启动” from “中继尚未确认”.
- Diagnostics fields are present in model/types/backend: `executable_path`, `recorded_pid`, `recorded_pid_running`, `connection_state`, `manual_start_command`, `tap_error`, `recent_logs`.
- The triage script can classify sample reports as:
  - `configured_not_started_local_startup_problem`
  - `running_but_relay_not_confirmed`

## Minimum retest request for friends

Both machines should retest with the latest v0.3.1 ZIP, extracted to a fresh folder, not run from inside the ZIP.

Required setup:
1. Right-click `lan-helper.exe` and run as administrator.
2. Use exactly the same relay address, room name, and room key on both machines.
3. Use different LAN-helper virtual IPs, for example:
   - host: `10.10.10.2`
   - joiner: `10.10.10.3`
4. If it fails, both machines must return:
   - page screenshot;
   - diagnostics page screenshot;
   - copied full diagnostic report;
   - copied manual start command;
   - copied networking logs;
   - relay address, room name, room key, local virtual IP, peer virtual IP.

## Current acceptance conclusion

The current code has enough diagnostic separation to guide the next retest, but the real-world issue is not proven solved until both friend machines return full reports from the latest package or successfully connect.

Do not claim real dual-machine pass yet.
