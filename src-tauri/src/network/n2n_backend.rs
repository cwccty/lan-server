use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::core::process_util::hide_console_window;
use crate::models::network::{BackendRuntimeStatus, BackendSummary, NetworkConfig, SetupResult};
use crate::network::windows_ip;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn detect() -> BackendSummary {
    let executable = find_n2n_executable();
    let virtual_ip = find_n2n_virtual_ip();
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
            return BackendRuntimeStatus {
                backend_id: "n2n".to_string(),
                running: false,
                virtual_ip: None,
                message,
            };
        }
    };

    let Some(supernode) = config.supernode else {
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

    let mut command = Command::new(executable);
    command
        .args(["-c", &community, "-k", &secret, "-l", &supernode])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if let Some(local_ip) = &local_ip {
        command.args(["-a", local_ip]);
    }

    if let Some(device) = &tap_device {
        command.args(["-d", device]);
    }

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    match command.spawn() {
        Ok(child) => {
            let _ = fs::write(pid_path(), child.id().to_string());
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
        Err(err) => BackendRuntimeStatus {
            backend_id: "n2n".to_string(),
            running: false,
            virtual_ip: None,
            message: format!("启动 n2n edge 失败: {err}"),
        },
    }
}

pub fn stop() -> BackendRuntimeStatus {
    let pid = read_recorded_pid();
    let Some(pid) = pid else {
        return BackendRuntimeStatus {
            backend_id: "n2n".to_string(),
            running: false,
            virtual_ip: find_n2n_virtual_ip(),
            message: "没有记录到 n2n edge PID。".to_string(),
        };
    };

    let mut command = Command::new("taskkill");
    command.args(["/PID", &pid.to_string(), "/F"]);
    let output = hide_console_window(&mut command).output();

    let _ = fs::remove_file(pid_path());
    match output {
        Ok(result) if result.status.success() => BackendRuntimeStatus {
            backend_id: "n2n".to_string(),
            running: false,
            virtual_ip: find_n2n_virtual_ip(),
            message: format!("n2n edge 已停止，PID: {pid}"),
        },
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
        format!(
            "尚未保存 n2n 配置，请先填写 room、secret 和 supernode。期望配置文件：{}",
            path.to_string_lossy()
        )
    })?;
    serde_json::from_str(&content).map_err(|err| format!("解析 n2n 配置失败: {err}"))
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
$adapters | Select-Object -First 1
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
        .map(ToString::to_string)
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
