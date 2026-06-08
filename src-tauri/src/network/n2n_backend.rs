use std::fs;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

use crate::core::process_util::hide_console_window;
use crate::models::network::{
    BackendRuntimeStatus, BackendSummary, N2nDiagnostics, NetworkConfig, SetupResult,
};
use crate::network::windows_ip;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn detect() -> BackendSummary {
    let executable = find_n2n_executable();
    let virtual_ip = find_n2n_virtual_ip();
    let diagnostics = diagnose();
    let mut notes = Vec::new();

    if let Some(path) = &executable {
        notes.push(format!("检测到 n2n edge: {}", path.to_string_lossy()));
    } else {
        notes.push(format!(
            "未检测到 n2n edge。请将 edge.exe 或 n2n.exe 放入以下任一目录：{}",
            candidate_n2n_dirs()
                .iter()
                .map(|path| path.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join("；")
        ));
    }

    if let Some(pid) = read_recorded_pid() {
        if is_pid_running(pid) {
            notes.push(format!("n2n edge 正在运行，PID: {pid}"));
        } else {
            notes.push(format!("记录的 n2n PID {pid} 已失效，下次启动会自动清理。"));
        }
    }

    if let Some(ip) = &virtual_ip {
        notes.push(format!("当前检测到虚拟 IP: {ip}"));
    }

    if let Ok(config) = load_config() {
        if let Some(supernode) = config.supernode {
            notes.push(format!("最近一次 supernode: {supernode}"));
        }
    }

    notes.push(format!("supernode 诊断：{}", diagnostics.summary));

    BackendSummary {
        id: "n2n".to_string(),
        name: "EasyN2N / n2n".to_string(),
        installed: executable.is_some(),
        available: executable.is_some(),
        virtual_ip,
        notes,
    }
}

pub fn setup(config: NetworkConfig) -> SetupResult {
    let dir = n2n_storage_dir();
    if let Err(err) = fs::create_dir_all(&dir) {
        return SetupResult {
            ok: false,
            message: format!("创建 n2n 配置目录失败: {err}"),
        };
    }

    let content = match serde_json::to_string_pretty(&config) {
        Ok(content) => content,
        Err(err) => {
            return SetupResult {
                ok: false,
                message: format!("序列化 n2n 配置失败: {err}"),
            };
        }
    };

    if let Err(err) = fs::write(config_path(), content) {
        return SetupResult {
            ok: false,
            message: format!("写入 n2n 配置失败: {err}"),
        };
    }

    SetupResult {
        ok: config.supernode.is_some(),
        message: if config.supernode.is_some() {
            format!("n2n 配置已保存：{}", config_path().to_string_lossy())
        } else {
            "n2n 需要 supernode 地址。".to_string()
        },
    }
}

pub fn start() -> BackendRuntimeStatus {
    if let Some(pid) = read_recorded_pid() {
        if is_pid_running(pid) {
            return BackendRuntimeStatus {
                backend_id: "n2n".to_string(),
                running: true,
                virtual_ip: find_n2n_virtual_ip(),
                message: format!("n2n edge 已在运行，PID: {pid}"),
            };
        }
        let _ = fs::remove_file(pid_path());
    }

    let Some(executable) = find_n2n_executable() else {
        append_edge_log("启动失败：未检测到组网程序 edge.exe / n2n.exe");
        return BackendRuntimeStatus {
            backend_id: "n2n".to_string(),
            running: false,
            virtual_ip: None,
            message: "未检测到 n2n edge，请将 edge.exe 或 n2n.exe 放入 tools/n2n/。".to_string(),
        };
    };

    let config = match load_config() {
        Ok(config) => config,
        Err(message) => {
            append_edge_log(&format!("启动失败：{message}"));
            return BackendRuntimeStatus {
                backend_id: "n2n".to_string(),
                running: false,
                virtual_ip: None,
                message,
            };
        }
    };
    let manual_config = config.clone();

    let Some(supernode) = config.supernode else {
        append_edge_log("启动失败：组网配置缺少中继地址");
        return BackendRuntimeStatus {
            backend_id: "n2n".to_string(),
            running: false,
            virtual_ip: None,
            message: "n2n 配置缺少 supernode。".to_string(),
        };
    };

    let community = config
        .room_name
        .unwrap_or_else(|| "lan-helper-room".to_string());
    let secret = config
        .secret
        .unwrap_or_else(|| "lan-helper-secret".to_string());
    let local_ip = config.local_ip.as_deref().and_then(normalize_edge_ip_arg);
    let tap_device = find_preferred_tap_device();

    let mut command = Command::new(&executable);
    command
        .args(["-c", &community, "-k", &secret, "-l", &supernode])
        .arg("-v")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(local_ip) = &local_ip {
        command.args(["-a", local_ip]);
    }

    if let Some(device) = &tap_device {
        command.args(["-d", device]);
    }

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let _ = reset_edge_log(
        &supernode,
        &community,
        local_ip.as_deref(),
        tap_device.as_deref(),
    );
    append_edge_log(&format!(
        "[manager] executable_path={}",
        executable.to_string_lossy()
    ));
    append_edge_log(&format!(
        "[manager] manual_start_command={}",
        build_n2n_manual_start_command_for_executable(Some(&manual_config), Some(&executable))
            .unwrap_or_else(|| "未生成".to_string())
    ));

    match command.spawn() {
        Ok(mut child) => {
            let _ = fs::write(pid_path(), child.id().to_string());
            if let Some(stdout) = child.stdout.take() {
                spawn_log_reader(stdout, "stdout");
            }
            if let Some(stderr) = child.stderr.take() {
                spawn_log_reader(stderr, "stderr");
            }
            append_edge_log(&format!("[manager] n2n edge started, pid={}", child.id()));
            thread::sleep(Duration::from_millis(900));
            if let Ok(Some(status)) = child.try_wait() {
                let _ = fs::remove_file(pid_path());
                append_edge_log(&format!(
                    "[manager] n2n edge exited during startup, pid={}, status={status}",
                    child.id()
                ));
                let last_problem = read_edge_log_lines(80)
                    .into_iter()
                    .rev()
                    .find(|line| is_n2n_problem_log(line))
                    .unwrap_or_else(|| format!("edge 进程启动后立即退出，退出状态：{status}"));
                return BackendRuntimeStatus {
                    backend_id: "n2n".to_string(),
                    running: false,
                    virtual_ip: find_n2n_virtual_ip(),
                    message: format!("n2n edge 启动后立即退出：{last_problem}"),
                };
            }
            BackendRuntimeStatus {
                backend_id: "n2n".to_string(),
                running: true,
                virtual_ip: find_n2n_virtual_ip(),
                message: format!(
                    "n2n edge 已启动，PID: {}{}{}",
                    child.id(),
                    local_ip
                        .as_ref()
                        .map(|ip| format!("，虚拟 IP 参数: {ip}"))
                        .unwrap_or_default(),
                    tap_device
                        .as_ref()
                        .map(|device| format!("，TAP: {device}"))
                        .unwrap_or_default()
                ),
            }
        }
        Err(err) => {
            append_edge_log(&format!("启动组网程序失败：{err}"));
            BackendRuntimeStatus {
                backend_id: "n2n".to_string(),
                running: false,
                virtual_ip: None,
                message: format!("启动 n2n edge 失败: {err}"),
            }
        }
    }
}

pub fn stop() -> BackendRuntimeStatus {
    let pid = read_recorded_pid();
    let Some(pid) = pid else {
        stop_orphan_edge_processes();
        append_edge_log("[manager] n2n stop requested, no recorded pid; orphan cleanup attempted");
        return BackendRuntimeStatus {
            backend_id: "n2n".to_string(),
            running: false,
            virtual_ip: find_n2n_virtual_ip(),
            message: "没有记录到 n2n edge PID，已尝试清理残留 edge/n2n 进程。".to_string(),
        };
    };

    let mut command = Command::new("taskkill");
    command.args(["/PID", &pid.to_string(), "/F"]);
    let output = hide_console_window(&mut command).output();

    let _ = fs::remove_file(pid_path());
    stop_orphan_edge_processes();
    match output {
        Ok(result) if result.status.success() => {
            append_edge_log(&format!("[manager] n2n edge stopped, pid={pid}"));
            BackendRuntimeStatus {
                backend_id: "n2n".to_string(),
                running: false,
                virtual_ip: find_n2n_virtual_ip(),
                message: format!("n2n edge 已停止，PID: {pid}"),
            }
        }
        Ok(result) => BackendRuntimeStatus {
            backend_id: "n2n".to_string(),
            running: false,
            virtual_ip: find_n2n_virtual_ip(),
            message: format!(
                "停止 n2n edge 可能失败: {}",
                String::from_utf8_lossy(&result.stderr)
            ),
        },
        Err(err) => BackendRuntimeStatus {
            backend_id: "n2n".to_string(),
            running: false,
            virtual_ip: find_n2n_virtual_ip(),
            message: format!("调用 taskkill 失败: {err}"),
        },
    }
}

pub fn diagnose() -> N2nDiagnostics {
    let recorded_pid = read_recorded_pid();
    let recorded_pid_running = recorded_pid.map(is_pid_running).unwrap_or(false);
    let config = load_config().ok();
    let executable_path = find_n2n_executable();
    let supernode = config.as_ref().and_then(|item| item.supernode.clone());
    let supernode_configured = supernode
        .as_ref()
        .map(|item| !item.trim().is_empty())
        .unwrap_or(false);
    diagnose_from_parts(
        recorded_pid_running,
        supernode_configured,
        supernode,
        find_n2n_virtual_ip(),
        read_edge_log_lines(160),
        edge_log_path().to_string_lossy().to_string(),
        executable_path.is_some(),
        executable_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        recorded_pid,
        build_n2n_manual_start_command_for_executable(config.as_ref(), executable_path.as_deref()),
    )
}

#[allow(clippy::too_many_arguments)]
fn diagnose_from_parts(
    running: bool,
    supernode_configured: bool,
    supernode: Option<String>,
    virtual_ip: Option<String>,
    recent_logs: Vec<String>,
    log_path: String,
    executable_found: bool,
    executable_path: Option<String>,
    recorded_pid: Option<u32>,
    manual_start_command: Option<String>,
) -> N2nDiagnostics {
    let joined = recent_logs.join("\n");
    let lower = joined.to_ascii_lowercase();

    let ack = joined.contains("[OK] edge <<<") || joined.contains("REGISTER_SUPER_ACK");
    let pong = joined.contains("Rx PONG") || lower.contains(" pong ");
    let last_success_index = recent_logs
        .iter()
        .rposition(|line| is_n2n_success_log(line));
    let mut active_problem_signals = N2nProblemSignals::default();
    let mut last_error = None;

    for (index, line) in recent_logs.iter().enumerate() {
        if last_success_index.is_some_and(|success_index| index <= success_index) {
            continue;
        }
        if let Some(signals) = classify_n2n_problem_log(line) {
            active_problem_signals.merge(signals);
            last_error = Some(line.clone());
        }
    }

    let auth_error = active_problem_signals.auth_error;
    let ip_mac_conflict = active_problem_signals.ip_mac_conflict;
    let not_responding = active_problem_signals.not_responding;
    let tap_error = active_problem_signals.tap_error;
    let recorded_pid_running = recorded_pid.is_some() && running;
    let ok_link =
        running && (ack || pong) && !(auth_error || ip_mac_conflict || not_responding || tap_error);

    let connection_state = if !supernode_configured {
        "not_configured"
    } else if auth_error {
        "auth_error"
    } else if ip_mac_conflict {
        "ip_mac_conflict"
    } else if tap_error {
        "tap_error"
    } else if not_responding {
        "supernode_not_responding"
    } else if ok_link {
        "ready"
    } else if recorded_pid.is_some() && !running {
        "pid_stale_or_exited"
    } else if running {
        "waiting_for_ack"
    } else {
        "configured_not_started"
    };

    let summary = match connection_state {
        "not_configured" => {
            "尚未填写中继地址、房间名和密钥，请先到“加入与组网”完成设置。".to_string()
        }
        "auth_error" => "房间名或密钥不一致，中继拒绝加入；请确认双方填写完全一致。".to_string(),
        "ip_mac_conflict" => {
            "联机地址可能已被占用；请让每个人使用不同的虚拟 IP 后重新启动组网。".to_string()
        }
        "tap_error" => {
            "组网网卡无法打开或未安装，请尝试管理员运行，并检查 TAP/Wintun 虚拟网卡。".to_string()
        }
        "supernode_not_responding" => {
            "中继地址暂无响应；请核对地址和端口，或确认中继服务器已启动且端口放行。".to_string()
        }
        "ready" => "已收到中继确认，组网连接正常。".to_string(),
        "pid_stale_or_exited" => {
            "组网程序没有保持运行，可能启动后立即退出、权限不足或被安全软件拦截。".to_string()
        }
        "waiting_for_ack" => {
            "组网程序已启动，但尚未收到中继确认；请核对中继地址、房间名、密钥和联机地址。"
                .to_string()
        }
        _ => "组网信息已保存，但还没有检测到运行中的组网程序；请点击启动组网。".to_string(),
    };

    N2nDiagnostics {
        running,
        supernode_configured,
        supernode,
        virtual_ip,
        ack,
        pong,
        ok_link,
        auth_error,
        ip_mac_conflict,
        not_responding,
        tap_error,
        last_error,
        summary,
        log_path,
        recent_logs,
        executable_found,
        executable_path,
        recorded_pid,
        recorded_pid_running,
        connection_state: connection_state.to_string(),
        manual_start_command,
    }
}

fn build_n2n_manual_start_command_for_executable(
    config: Option<&NetworkConfig>,
    executable_path: Option<&Path>,
) -> Option<String> {
    let config = config?;
    let supernode = config.supernode.as_deref()?.trim();
    if supernode.is_empty() {
        return None;
    }
    let community = config
        .room_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("lan-helper-room");
    let local_ip = config.local_ip.as_deref().and_then(normalize_edge_ip_arg);
    let mut parts = vec![
        executable_path
            .map(|path| quote_cmd_arg(&path.to_string_lossy()))
            .unwrap_or_else(|| "edge.exe".to_string()),
        "-c".to_string(),
        quote_cmd_arg(community),
        "-k".to_string(),
        "<room-key>".to_string(),
        "-l".to_string(),
        quote_cmd_arg(supernode),
        "-v".to_string(),
    ];
    if let Some(local_ip) = local_ip {
        parts.push("-a".to_string());
        parts.push(quote_cmd_arg(&local_ip));
    }
    Some(parts.join(" "))
}

fn quote_cmd_arg(value: &str) -> String {
    if value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | ':' | '_' | '-' | '/'))
    {
        value.to_string()
    } else {
        format!("\"{}\"", value.replace('"', "\\\""))
    }
}

fn stop_orphan_edge_processes() {
    for image in ["edge.exe", "n2n.exe"] {
        let mut command = Command::new("taskkill");
        command.args(["/IM", image, "/F"]);
        let _ = hide_console_window(&mut command).output();
    }
}

pub fn last_config() -> Result<NetworkConfig, String> {
    load_config()
}

fn find_n2n_executable() -> Option<PathBuf> {
    candidate_n2n_dirs().into_iter().find_map(|dir| {
        ["edge.exe", "n2n.exe"]
            .into_iter()
            .map(|name| dir.join(name))
            .find(|path| path.exists())
    })
}

fn candidate_n2n_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        dirs.extend(n2n_dirs_from_ancestors(&cwd));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            dirs.extend(n2n_dirs_from_ancestors(parent));
        }
    }
    dedup_paths(dirs)
}

fn n2n_dirs_from_ancestors(start: &Path) -> Vec<PathBuf> {
    start
        .ancestors()
        .map(|ancestor| ancestor.join("tools").join("n2n"))
        .collect()
}

fn n2n_storage_dir() -> PathBuf {
    if let Some(dir) = candidate_n2n_dirs().into_iter().find(|dir| dir.exists()) {
        return dir;
    }
    PathBuf::from("tools").join("n2n")
}

fn config_path() -> PathBuf {
    n2n_storage_dir().join("last_config.json")
}

fn pid_path() -> PathBuf {
    n2n_storage_dir().join("n2n.pid")
}

fn edge_log_path() -> PathBuf {
    n2n_storage_dir().join("edge.log")
}

fn reset_edge_log(
    supernode: &str,
    community: &str,
    local_ip: Option<&str>,
    tap_device: Option<&str>,
) -> Result<(), String> {
    let path = edge_log_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let mut file = fs::File::create(&path).map_err(|err| err.to_string())?;
    writeln!(file, "[manager] reset edge log").map_err(|err| err.to_string())?;
    writeln!(file, "[manager] supernode={supernode}").map_err(|err| err.to_string())?;
    writeln!(file, "[manager] community={community}").map_err(|err| err.to_string())?;
    if let Some(local_ip) = local_ip {
        writeln!(file, "[manager] local_ip={local_ip}").map_err(|err| err.to_string())?;
    }
    if let Some(tap_device) = tap_device {
        writeln!(file, "[manager] tap_device={tap_device}").map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn append_edge_log(line: &str) {
    let path = edge_log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{line}");
    }
}

fn spawn_log_reader<R>(reader: R, stream_name: &'static str)
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let reader = BufReader::new(reader);
        for line in reader.lines().map_while(Result::ok) {
            append_edge_log(&format!("[{stream_name}] {line}"));
        }
    });
}

fn read_edge_log_lines(max_lines: usize) -> Vec<String> {
    let Ok(content) = fs::read_to_string(edge_log_path()) else {
        return Vec::new();
    };
    let mut lines = content
        .lines()
        .map(|line| line.trim_end().to_string())
        .filter(|line| !line.trim().is_empty())
        .collect::<Vec<_>>();
    if lines.len() > max_lines {
        lines = lines.split_off(lines.len() - max_lines);
    }
    lines
}

fn dedup_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut result = Vec::new();
    for path in paths {
        if !result.contains(&path) {
            result.push(path);
        }
    }
    result
}

fn load_config() -> Result<NetworkConfig, String> {
    let path = config_path();
    let content = fs::read_to_string(&path).map_err(|_| {
        "尚未保存组网服务配置，请先到“加入与组网”填写房间名、密钥和中继地址。".to_string()
    })?;
    serde_json::from_str(&content).map_err(|err| format!("解析组网服务配置失败: {err}"))
}

fn normalize_edge_ip_arg(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with("static:") || trimmed.starts_with("dhcp:") {
        return Some(trimmed.to_string());
    }
    if trimmed.contains('/') {
        return Some(format!("static:{trimmed}"));
    }
    Some(format!("static:{trimmed}/24"))
}

fn find_n2n_virtual_ip() -> Option<String> {
    windows_ip::find_ipv4_by_interface_keywords(&["n2n", "edge", "cfw", "tap"])
}

#[derive(Default)]
struct N2nProblemSignals {
    auth_error: bool,
    ip_mac_conflict: bool,
    not_responding: bool,
    tap_error: bool,
}

impl N2nProblemSignals {
    fn merge(&mut self, other: N2nProblemSignals) {
        self.auth_error |= other.auth_error;
        self.ip_mac_conflict |= other.ip_mac_conflict;
        self.not_responding |= other.not_responding;
        self.tap_error |= other.tap_error;
    }

    fn has_named_problem(&self) -> bool {
        self.auth_error || self.ip_mac_conflict || self.not_responding || self.tap_error
    }
}

fn is_n2n_problem_log(line: &str) -> bool {
    classify_n2n_problem_log(line).is_some()
}

fn is_n2n_success_log(line: &str) -> bool {
    let lower = line.to_ascii_lowercase();
    line.contains("[OK] edge <<<")
        || line.contains("REGISTER_SUPER_ACK")
        || line.contains("Rx PONG")
        || lower.contains(" pong ")
}

fn classify_n2n_problem_log(line: &str) -> Option<N2nProblemSignals> {
    let lower = line.to_ascii_lowercase();
    if lower.contains("warning: switching to aes as key was provided") {
        return None;
    }
    let signals = N2nProblemSignals {
        auth_error: lower.contains("authentication error"),
        ip_mac_conflict: lower.contains("mac or ip address already in use")
            || lower.contains("address already in use")
            || lower.contains("ip address already in use"),
        not_responding: lower.contains("supernode not responding")
            || lower.contains("not responding")
            || lower.contains("timeout"),
        tap_error: lower.contains("cannot find tap device")
            || lower.contains("unable to open tap")
            || lower.contains("failed to open tap")
            || lower.contains("no tap device"),
    };
    if signals.has_named_problem()
        || lower.contains("error")
        || lower.contains("warning")
        || lower.contains("nak")
    {
        Some(signals)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(running: bool, supernode_configured: bool, logs: &[&str]) -> N2nDiagnostics {
        diagnose_from_parts(
            running,
            supernode_configured,
            supernode_configured.then(|| "1.2.3.4:7777".to_string()),
            Some("10.10.10.2".to_string()),
            logs.iter().map(|line| line.to_string()).collect(),
            "tools/n2n/edge.log".to_string(),
            true,
            Some("tools/n2n/edge.exe".to_string()),
            running.then_some(4242),
            Some("edge.exe -c room -k <room-key> -l 1.2.3.4:7777 -v".to_string()),
        )
    }

    #[test]
    fn n2n_diagnostics_fixture_no_config() {
        let report = fixture(false, false, &[]);
        assert_eq!(report.connection_state, "not_configured");
        assert!(!report.ok_link);
        assert!(report
            .summary
            .contains("\u{5c1a}\u{672a}\u{586b}\u{5199}\u{4e2d}\u{7ee7}\u{5730}\u{5740}"));
    }

    #[test]
    fn n2n_diagnostics_fixture_configured_not_started() {
        let report = fixture(false, true, &[]);
        assert_eq!(report.connection_state, "configured_not_started");
        assert!(report.summary.contains("\u{8fd8}\u{6ca1}\u{6709}\u{68c0}\u{6d4b}\u{5230}\u{8fd0}\u{884c}\u{4e2d}\u{7684}\u{7ec4}\u{7f51}\u{7a0b}\u{5e8f}"));
    }

    #[test]
    fn n2n_diagnostics_fixture_running_without_ack() {
        let report = fixture(true, true, &["[manager] n2n edge started, pid=4242"]);
        assert_eq!(report.connection_state, "waiting_for_ack");
        assert!(!report.ok_link);
        assert!(report
            .summary
            .contains("\u{5c1a}\u{672a}\u{6536}\u{5230}\u{4e2d}\u{7ee7}\u{786e}\u{8ba4}"));
        assert!(report
            .manual_start_command
            .as_deref()
            .unwrap_or_default()
            .contains("<room-key>"));
    }

    #[test]
    fn n2n_diagnostics_fixture_ack_pong_ready() {
        let report = fixture(
            true,
            true,
            &["[OK] edge <<< REGISTER_SUPER_ACK", "Rx PONG from supernode"],
        );
        assert_eq!(report.connection_state, "ready");
        assert!(report.ok_link);
        assert!(report.ack);
        assert!(report.pong);
    }

    #[test]
    fn n2n_diagnostics_fixture_supernode_not_responding() {
        let report = fixture(true, true, &["supernode not responding, timeout"]);
        assert_eq!(report.connection_state, "supernode_not_responding");
        assert!(report.not_responding);
        assert!(report
            .summary
            .contains("\u{4e2d}\u{7ee7}\u{5730}\u{5740}\u{6682}\u{65e0}\u{54cd}\u{5e94}"));
    }

    #[test]
    fn n2n_diagnostics_fixture_tap_error() {
        let report = fixture(true, true, &["ERROR: Cannot find TAP device"]);
        assert_eq!(report.connection_state, "tap_error");
        assert!(report.tap_error);
        assert!(report
            .summary
            .contains("\u{7ec4}\u{7f51}\u{7f51}\u{5361}\u{65e0}\u{6cd5}\u{6253}\u{5f00}"));
    }

    #[test]
    fn n2n_diagnostics_fixture_auth_error() {
        let report = fixture(true, true, &["authentication error"]);
        assert_eq!(report.connection_state, "auth_error");
        assert!(report.auth_error);
        assert!(report
            .summary
            .contains("\u{623f}\u{95f4}\u{540d}\u{6216}\u{5bc6}\u{94a5}\u{4e0d}\u{4e00}\u{81f4}"));
    }

    #[test]
    fn n2n_diagnostics_fixture_ip_mac_conflict() {
        let report = fixture(true, true, &["MAC or IP address already in use"]);
        assert_eq!(report.connection_state, "ip_mac_conflict");
        assert!(report.ip_mac_conflict);
        assert!(report.summary.contains(
            "\u{8054}\u{673a}\u{5730}\u{5740}\u{53ef}\u{80fd}\u{5df2}\u{88ab}\u{5360}\u{7528}"
        ));
    }
}

#[cfg(windows)]
fn find_preferred_tap_device() -> Option<String> {
    let script = r#"
$adapters = Get-NetAdapter -ErrorAction SilentlyContinue |
  Where-Object { $_.InterfaceDescription -match 'TAP|Wintun|n2n|VPN' -or $_.Name -match 'cfw|tap|n2n|edge|vpn' } |
  Select-Object -ExpandProperty Name
$preferred = @('cfw-tap', 'n2n', 'edge', 'tap', 'SetupVPN')
foreach ($name in $preferred) {
  $hit = $adapters | Where-Object { $_ -ieq $name } | Select-Object -First 1
  if ($hit) { $hit; exit }
}
"#;
    let mut process = Command::new("powershell");
    process.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ]);
    let output = hide_console_window(&mut process).output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .filter(|line| is_safe_tap_device_name(line))
        .map(ToString::to_string)
}

#[cfg(windows)]
fn is_safe_tap_device_name(name: &str) -> bool {
    let trimmed = name.trim();
    !trimmed.is_empty()
        && trimmed.len() <= 64
        && trimmed.is_ascii()
        && trimmed
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | ' '))
}

#[cfg(not(windows))]
fn find_preferred_tap_device() -> Option<String> {
    None
}

fn read_recorded_pid() -> Option<u32> {
    fs::read_to_string(pid_path())
        .ok()
        .and_then(|value| value.trim().parse::<u32>().ok())
}

fn is_pid_running(pid: u32) -> bool {
    let mut command = Command::new("tasklist");
    command.args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"]);
    let output = hide_console_window(&mut command).output();

    let Ok(output) = output else {
        return false;
    };
    if !output.status.success() {
        return false;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.contains(&pid.to_string()) && !stdout.to_ascii_lowercase().contains("no tasks")
}
