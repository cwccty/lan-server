use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use crate::models::network::{BackendRuntimeStatus, BackendSummary, NetworkConfig, SetupResult};
use crate::network::windows_ip;

const CONFIG_PATH: &str = "tools/n2n/last_config.json";
const PID_PATH: &str = "tools/n2n/n2n.pid";

pub fn detect() -> BackendSummary {
    let executable = find_n2n_executable();
    BackendSummary {
        id: "n2n".to_string(),
        name: "EasyN2N / n2n".to_string(),
        installed: executable.is_some(),
        available: executable.is_some(),
        virtual_ip: find_n2n_virtual_ip(),
        notes: if let Some(path) = executable {
            vec![format!("检测到 n2n edge: {}", path.to_string_lossy())]
        } else {
            vec!["未检测到 n2n edge，请将 edge.exe 或 n2n.exe 放入 tools/n2n/。".to_string()]
        },
    }
}

pub fn setup(config: NetworkConfig) -> SetupResult {
    if let Err(err) = fs::create_dir_all("tools/n2n") {
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
            }
        }
    };

    if let Err(err) = fs::write(CONFIG_PATH, content) {
        return SetupResult {
            ok: false,
            message: format!("写入 n2n 配置失败: {err}"),
        };
    }

    SetupResult {
        ok: config.supernode.is_some(),
        message: if config.supernode.is_some() {
            "n2n 配置已保存。".to_string()
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
        let _ = fs::remove_file(PID_PATH);
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
            }
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

    let community = config.room_name.unwrap_or_else(|| "lan-helper-room".to_string());
    let secret = config.secret.unwrap_or_else(|| "lan-helper-secret".to_string());
    let mut command = Command::new(executable);
    command
        .args(["-c", &community, "-k", &secret, "-l", &supernode])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if let Some(local_ip) = config.local_ip {
        command.args(["-a", &local_ip]);
    }

    match command.spawn() {
        Ok(child) => {
            let _ = fs::write(PID_PATH, child.id().to_string());
            BackendRuntimeStatus {
                backend_id: "n2n".to_string(),
                running: true,
                virtual_ip: find_n2n_virtual_ip(),
                message: format!("n2n edge 已启动，PID: {}", child.id()),
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

    let output = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .output();

    let _ = fs::remove_file(PID_PATH);
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
    ["tools/n2n/edge.exe", "tools/n2n/n2n.exe"]
        .into_iter()
        .map(PathBuf::from)
        .find(|path| path.exists())
}

fn load_config() -> Result<NetworkConfig, String> {
    let content = fs::read_to_string(CONFIG_PATH)
        .map_err(|_| "尚未保存 n2n 配置，请先填写 room、secret 和 supernode。".to_string())?;
    serde_json::from_str(&content).map_err(|err| format!("解析 n2n 配置失败: {err}"))
}

fn find_n2n_virtual_ip() -> Option<String> {
    windows_ip::find_ipv4_by_interface_keywords(&["n2n", "edge", "tap"])
}

fn read_recorded_pid() -> Option<u32> {
    fs::read_to_string(PID_PATH)
        .ok()
        .and_then(|value| value.trim().parse::<u32>().ok())
}

fn is_pid_running(pid: u32) -> bool {
    let output = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"])
        .output();

    let Ok(output) = output else {
        return false;
    };
    if !output.status.success() {
        return false;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.contains(&pid.to_string()) && !stdout.to_ascii_lowercase().contains("no tasks")
}
