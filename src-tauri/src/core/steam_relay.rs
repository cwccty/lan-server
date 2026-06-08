use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use chrono::Utc;
use sha2::{Digest, Sha256};

use crate::models::steam_relay::{
    ConnectToolFileStatus, ConnectToolLaunchRequest, ConnectToolStatus, SteamP2pGuestRequest,
    SteamP2pHostRequest, SteamP2pInvitePacket, SteamP2pSessionStatus, SteamRelayNativeStatus,
    SteamRelayStatus,
};

static SESSION: OnceLock<Mutex<Option<SteamP2pSessionStatus>>> = OnceLock::new();
static CONNECTTOOL_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn session_store() -> &'static Mutex<Option<SteamP2pSessionStatus>> {
    SESSION.get_or_init(|| Mutex::new(None))
}

fn connecttool_child_store() -> &'static Mutex<Option<Child>> {
    CONNECTTOOL_CHILD.get_or_init(|| Mutex::new(None))
}

pub fn get_steam_relay_status() -> SteamRelayStatus {
    get_steam_relay_status_for_dir(None)
}

pub fn get_steam_relay_status_for_dir(connecttool_dir: Option<String>) -> SteamRelayStatus {
    let steam = detect_steam_process();
    let native_status = build_native_status(&steam);
    let connecttool_status = inspect_connecttool(connecttool_dir.as_deref(), &steam);

    let mut unavailable_reasons = native_status_reasons(&native_status, &steam);
    unavailable_reasons.extend(connecttool_status.diagnostics.clone());

    let mut next_steps = connecttool_status.next_steps.clone();
    if next_steps.is_empty() && connecttool_status.can_start {
        next_steps
            .push("点击“启动 ConnectTool helper”，再在 helper 里创建房间或加入房间。".to_string());
    }

    let overall_status = if connecttool_status.helper_running {
        "running_connecttool".to_string()
    } else if connecttool_status.can_start {
        "connecttool_ready".to_string()
    } else if !steam.0 {
        "missing_steam".to_string()
    } else if !connecttool_status.directory_exists {
        "missing_helper_dir".to_string()
    } else if !connecttool_status.required_files_ok {
        "missing_helper_files".to_string()
    } else {
        "blocked".to_string()
    };

    SteamRelayStatus {
        available: connecttool_status.can_start || connecttool_status.helper_running,
        overall_status,
        native_status,
        connecttool_status,
        steam_running: steam.0,
        steam_process_path: steam.1,
        steamworks_sdk_configured: std::env::var("STEAMWORKS_SDK_DIR").ok().filter(|value| !value.trim().is_empty()).is_some(),
        steamworks_sdk_dir: std::env::var("STEAMWORKS_SDK_DIR").ok().filter(|value| !value.trim().is_empty()),
        redistributable_found: false,
        redistributable_path: None,
        app_id_configured: detect_app_id().is_some(),
        app_id: detect_app_id(),
        unavailable_reasons,
        next_steps,
        legal_notice: "ConnectTool 兼容模式仅管理用户自备 helper；不会修改游戏文件、绕过 Steam 或游戏拥有权，也不会把外部 DLL 打包进联机助手。".to_string(),
    }
}

fn build_native_status(steam: &(bool, Option<String>)) -> SteamRelayNativeStatus {
    let sdk_dir = std::env::var("STEAMWORKS_SDK_DIR")
        .ok()
        .filter(|value| !value.trim().is_empty());
    let redistributable_path = sdk_dir.as_deref().and_then(find_steam_api64_redist);
    let app_id = detect_app_id();
    let precheck_ready =
        steam.0 && sdk_dir.is_some() && redistributable_path.is_some() && app_id.is_some();
    SteamRelayNativeStatus {
        built_in: false,
        available: false,
        state: if precheck_ready {
            "precheck_ready_not_built_in"
        } else {
            "not_built_in"
        }
        .to_string(),
        message: if precheck_ready {
            "原生 Steamworks 依赖预检基本满足，但联机助手尚未内置真实 Steamworks Networking。"
                .to_string()
        } else {
            "原生 Steamworks 仍未内置；当前可交付路线是 ConnectTool 兼容模式。".to_string()
        },
    }
}

fn native_status_reasons(
    native_status: &SteamRelayNativeStatus,
    steam: &(bool, Option<String>),
) -> Vec<String> {
    let mut reasons = Vec::new();
    if !steam.0 {
        reasons.push("未检测到正在运行的 Steam 客户端。".to_string());
    }
    if !native_status.built_in {
        reasons
            .push("联机助手尚未内置原生 Steamworks P2P；请使用 ConnectTool 兼容模式。".to_string());
    }
    reasons
}

pub fn start_connecttool_helper(
    input: ConnectToolLaunchRequest,
) -> Result<SteamRelayStatus, String> {
    let status = get_steam_relay_status_for_dir(input.directory.clone());
    if status.connecttool_status.helper_running {
        return Ok(status);
    }
    if !status.connecttool_status.can_start {
        return Err(format!(
            "ConnectTool helper 暂不可启动：{}",
            status.connecttool_status.diagnostics.join("；")
        ));
    }
    let dir = status
        .connecttool_status
        .directory
        .clone()
        .ok_or_else(|| "ConnectTool 目录为空".to_string())?;
    let exe = Path::new(&dir).join("connecttool-qt.exe");
    let child = Command::new(&exe)
        .current_dir(&dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|err| format!("启动 ConnectTool helper 失败：{err}"))?;
    *connecttool_child_store()
        .lock()
        .map_err(|_| "ConnectTool process lock poisoned".to_string())? = Some(child);
    std::thread::sleep(std::time::Duration::from_millis(700));
    Ok(get_steam_relay_status_for_dir(Some(dir)))
}

pub fn stop_connecttool_helper(
    input: ConnectToolLaunchRequest,
) -> Result<SteamRelayStatus, String> {
    let requested_dir = resolve_connecttool_dir(input.directory.as_deref());
    if let Some(mut child) = connecttool_child_store()
        .lock()
        .map_err(|_| "ConnectTool process lock poisoned".to_string())?
        .take()
    {
        let _ = child.kill();
        let _ = child.wait();
    } else {
        stop_connecttool_matching_dir(requested_dir.as_deref());
    }
    std::thread::sleep(std::time::Duration::from_millis(300));
    Ok(get_steam_relay_status_for_dir(input.directory))
}

pub fn start_steam_p2p_host(input: SteamP2pHostRequest) -> Result<SteamP2pSessionStatus, String> {
    let status = get_steam_relay_status_for_dir(input.connecttool_dir.clone());
    let app_id = input
        .app_id
        .or_else(|| status.connecttool_status.app_id.clone())
        .or_else(|| status.app_id.clone())
        .unwrap_or_default();
    let invite = SteamP2pInvitePacket {
        method: "steam_p2p".to_string(),
        host_steam_id: input.host_steam_id,
        virtual_port: input.virtual_port,
        protocol: "tcp".to_string(),
        target_host: if input.target_host.trim().is_empty() {
            "127.0.0.1".to_string()
        } else {
            input.target_host
        },
        target_port: input.target_port,
        guest_local_port: input.virtual_port,
        app_id,
        created_at: Utc::now().to_rfc3339(),
    };
    let session = SteamP2pSessionStatus {
        running: status.connecttool_status.helper_running,
        mode: "host_connecttool_compatible".to_string(),
        state: if status.connecttool_status.helper_running {
            "helper_running"
        } else if status.connecttool_status.can_start {
            "helper_ready"
        } else {
            "blocked_by_precheck"
        }
        .to_string(),
        message: if status.connecttool_status.helper_running {
            "ConnectTool helper 已运行。请在 helper 中选择 TCP 转发、创建房间并邀请好友。"
                .to_string()
        } else if status.connecttool_status.can_start {
            "ConnectTool 兼容模式可启动。请先启动 helper，再在 helper 中创建 TCP 转发房间。"
                .to_string()
        } else {
            "ConnectTool 兼容模式预检未通过，请按缺失项修复。".to_string()
        },
        invite: Some(invite),
        status,
    };
    *session_store()
        .lock()
        .map_err(|_| "Steam P2P session lock poisoned".to_string())? = Some(session.clone());
    Ok(session)
}

pub fn start_steam_p2p_guest(input: SteamP2pGuestRequest) -> Result<SteamP2pSessionStatus, String> {
    let status = get_steam_relay_status_for_dir(input.connecttool_dir.clone());
    let invite = SteamP2pInvitePacket {
        method: "steam_p2p".to_string(),
        host_steam_id: input.host_steam_id,
        virtual_port: input.virtual_port,
        protocol: "tcp".to_string(),
        target_host: "127.0.0.1".to_string(),
        target_port: input.virtual_port,
        guest_local_port: input.guest_local_port,
        app_id: input
            .app_id
            .or_else(|| status.connecttool_status.app_id.clone())
            .or_else(|| status.app_id.clone())
            .unwrap_or_default(),
        created_at: Utc::now().to_rfc3339(),
    };
    let session = SteamP2pSessionStatus {
        running: status.connecttool_status.helper_running,
        mode: "guest_connecttool_compatible".to_string(),
        state: if status.connecttool_status.helper_running {
            "helper_running"
        } else if status.connecttool_status.can_start {
            "helper_ready"
        } else {
            "blocked_by_precheck"
        }
        .to_string(),
        message: if status.connecttool_status.helper_running {
            "ConnectTool helper 已运行。请在 helper 中输入房主 Steam ID 或加入房间。".to_string()
        } else if status.connecttool_status.can_start {
            "ConnectTool 兼容模式可启动。请先启动 helper，再加入房主房间。".to_string()
        } else {
            "ConnectTool 兼容模式预检未通过，请按缺失项修复。".to_string()
        },
        invite: Some(invite),
        status,
    };
    *session_store()
        .lock()
        .map_err(|_| "Steam P2P session lock poisoned".to_string())? = Some(session.clone());
    Ok(session)
}

pub fn stop_steam_p2p_session() -> Result<SteamP2pSessionStatus, String> {
    let status = get_steam_relay_status();
    let session = SteamP2pSessionStatus {
        running: status.connecttool_status.helper_running,
        mode: "none".to_string(),
        state: "stopped".to_string(),
        message: "Steam P2P 会话状态已清空；ConnectTool helper 如需关闭请使用停止 helper。"
            .to_string(),
        invite: None,
        status,
    };
    *session_store()
        .lock()
        .map_err(|_| "Steam P2P session lock poisoned".to_string())? = None;
    Ok(session)
}

pub fn get_steam_p2p_session_status() -> Result<SteamP2pSessionStatus, String> {
    if let Some(session) = session_store()
        .lock()
        .map_err(|_| "Steam P2P session lock poisoned".to_string())?
        .clone()
    {
        return Ok(session);
    }
    Ok(SteamP2pSessionStatus {
        running: false,
        mode: "none".to_string(),
        state: "idle".to_string(),
        message:
            "尚未启动 Steam Relay / P2P 会话。当前可使用 ConnectTool 兼容模式启动外部 helper。"
                .to_string(),
        invite: None,
        status: get_steam_relay_status(),
    })
}

fn inspect_connecttool(
    input_dir: Option<&str>,
    steam: &(bool, Option<String>),
) -> ConnectToolStatus {
    let directory = resolve_connecttool_dir(input_dir);
    let directory_exists = directory
        .as_ref()
        .map(|path| path.is_dir())
        .unwrap_or(false);
    let mut file_statuses = Vec::new();
    let mut missing_files = Vec::new();

    let required = [
        "connecttool-qt.exe",
        "steam_api64.dll",
        "steamwebrtc64.dll",
        "steam_appid.txt",
    ];
    let optional = ["wintun.dll"];
    if let Some(dir) = directory.as_ref() {
        for name in required {
            let path = dir.join(name);
            let found = path.is_file();
            if !found {
                missing_files.push(name.to_string());
            }
            file_statuses.push(file_status(name, true, &path, found));
        }
        for name in optional {
            let path = dir.join(name);
            let found = path.is_file();
            file_statuses.push(file_status(name, false, &path, found));
        }
    } else {
        for name in required {
            missing_files.push(name.to_string());
            file_statuses.push(ConnectToolFileStatus {
                name: name.to_string(),
                required: true,
                found: false,
                path: None,
                sha256: None,
            });
        }
        file_statuses.push(ConnectToolFileStatus {
            name: "wintun.dll".to_string(),
            required: false,
            found: false,
            path: None,
            sha256: None,
        });
    }

    let required_files_ok = directory_exists && missing_files.is_empty();
    let app_id_path = directory
        .as_ref()
        .map(|dir| dir.join("steam_appid.txt"))
        .filter(|path| path.is_file());
    let app_id = app_id_path
        .as_ref()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let wintun_available = file_statuses
        .iter()
        .any(|item| item.name.eq_ignore_ascii_case("wintun.dll") && item.found);
    let running = detect_connecttool_process();
    let can_start = steam.0 && required_files_ok;
    let can_tcp_forward = can_start || running.0;
    let can_tun = can_tcp_forward && wintun_available;

    let mut diagnostics = Vec::new();
    let mut next_steps = Vec::new();
    if !directory_exists {
        diagnostics.push("未找到 ConnectTool helper 目录。".to_string());
        next_steps.push("在高级工具里填入 connecttool-qt 解压目录，或设置 LAN_HELPER_CONNECTTOOL_DIR 后重新检测。".to_string());
    }
    if directory_exists && !required_files_ok {
        diagnostics.push(format!(
            "ConnectTool helper 缺少必需文件：{}。",
            missing_files.join("、")
        ));
        next_steps.push("请重新解压 connecttool-qt 完整包，不要只复制单个 exe。".to_string());
    }
    if !steam.0 {
        diagnostics.push("Steam 客户端未运行。".to_string());
        next_steps.push("先启动 Steam 并登录，再启动 ConnectTool helper。".to_string());
    }
    if required_files_ok && !wintun_available {
        next_steps.push(
            "TCP 转发可用；如需 TUN 组网，请确认 wintun.dll 存在并以管理员权限允许驱动/防火墙。"
                .to_string(),
        );
    }
    if can_start && !running.0 {
        next_steps.push(
            "可以启动 ConnectTool helper。房主或加入者仍需在 helper 中完成房间/Steam ID/端口配置。"
                .to_string(),
        );
    }
    if running.0 {
        next_steps
            .push("helper 正在运行。请切到 helper 窗口完成 TCP 转发或 TUN 组网设置。".to_string());
    }

    ConnectToolStatus {
        enabled: directory_exists,
        directory: directory.map(|path| path.display().to_string()),
        directory_exists,
        app_id,
        app_id_path: app_id_path.map(|path| path.display().to_string()),
        required_files_ok,
        wintun_available,
        helper_running: running.0,
        helper_process_path: running.1,
        helper_pid: running.2,
        can_start,
        can_tcp_forward,
        can_tun,
        missing_files,
        file_statuses,
        diagnostics,
        next_steps,
    }
}

fn resolve_connecttool_dir(input_dir: Option<&str>) -> Option<PathBuf> {
    if let Some(value) = input_dir.map(str::trim).filter(|value| !value.is_empty()) {
        return Some(PathBuf::from(value));
    }
    if let Ok(value) = std::env::var("LAN_HELPER_CONNECTTOOL_DIR") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Some(PathBuf::from(trimmed));
        }
    }
    None
}

fn file_status(name: &str, required: bool, path: &Path, found: bool) -> ConnectToolFileStatus {
    ConnectToolFileStatus {
        name: name.to_string(),
        required,
        found,
        path: Some(path.display().to_string()),
        sha256: if found { sha256_file(path).ok() } else { None },
    }
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|err| err.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|err| err.to_string())?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn detect_steam_process() -> (bool, Option<String>) {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-Process steam -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path",
            ])
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return (true, Some(path));
                }
            }
        }
        if let Ok(output) = Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq steam.exe"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if text.contains("steam.exe") {
                return (true, None);
            }
        }
    }
    (false, None)
}

fn detect_connecttool_process() -> (bool, Option<String>, Option<u32>) {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-Process connecttool-qt -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { \"$($_.Id)|$($_.Path)\" }",
            ])
            .output()
        {
            if output.status.success() {
                let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !text.is_empty() {
                    let mut parts = text.splitn(2, '|');
                    let pid = parts.next().and_then(|value| value.parse::<u32>().ok());
                    let path = parts.next().map(str::trim).filter(|value| !value.is_empty()).map(str::to_string);
                    return (true, path, pid);
                }
            }
        }
        if let Ok(output) = Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq connecttool-qt.exe"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if text.contains("connecttool-qt.exe") {
                return (true, None, None);
            }
        }
    }
    (false, None, None)
}

fn stop_connecttool_matching_dir(expected_dir: Option<&Path>) {
    #[cfg(target_os = "windows")]
    {
        let (running, process_path, pid) = detect_connecttool_process();
        if !running {
            return;
        }
        let Some(pid) = pid else {
            return;
        };
        if let Some(expected_dir) = expected_dir {
            if let Some(process_path) = process_path.as_deref() {
                let expected = expected_dir.join("connecttool-qt.exe");
                let expected_text = expected.to_string_lossy().to_lowercase();
                let actual_text = process_path.to_lowercase();
                if actual_text != expected_text {
                    return;
                }
            } else {
                return;
            }
        }
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output();
    }
}

fn find_steam_api64_redist(sdk_dir: &str) -> Option<PathBuf> {
    let root = Path::new(sdk_dir);
    let candidates = [
        root.join("redistributable_bin")
            .join("win64")
            .join("steam_api64.dll"),
        root.join("sdk")
            .join("redistributable_bin")
            .join("win64")
            .join("steam_api64.dll"),
    ];
    candidates.into_iter().find(|path| path.exists())
}

fn detect_app_id() -> Option<String> {
    if let Ok(value) = std::env::var("STEAM_APP_ID") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    let appid_path = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join("steam_appid.txt")));
    appid_path
        .and_then(|path| std::fs::read_to_string(path).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn connecttool_dir_is_not_hardcoded_when_empty() {
        let _guard = env_lock().lock().expect("env test lock poisoned");
        let previous = std::env::var("LAN_HELPER_CONNECTTOOL_DIR").ok();
        std::env::remove_var("LAN_HELPER_CONNECTTOOL_DIR");
        let resolved = resolve_connecttool_dir(None);
        if let Some(value) = previous {
            std::env::set_var("LAN_HELPER_CONNECTTOOL_DIR", value);
        } else {
            std::env::remove_var("LAN_HELPER_CONNECTTOOL_DIR");
        }
        assert!(
            resolved.is_none(),
            "empty ConnectTool dir must not fall back to a user-specific local path"
        );
    }

    #[test]
    fn connecttool_dir_can_come_from_environment() {
        let _guard = env_lock().lock().expect("env test lock poisoned");
        let previous = std::env::var("LAN_HELPER_CONNECTTOOL_DIR").ok();
        std::env::set_var(
            "LAN_HELPER_CONNECTTOOL_DIR",
            r"D:\Tools\connecttool-qt-windows-x86_64",
        );
        let resolved = resolve_connecttool_dir(None);
        if let Some(value) = previous {
            std::env::set_var("LAN_HELPER_CONNECTTOOL_DIR", value);
        } else {
            std::env::remove_var("LAN_HELPER_CONNECTTOOL_DIR");
        }
        assert_eq!(
            resolved,
            Some(PathBuf::from(r"D:\Tools\connecttool-qt-windows-x86_64"))
        );
    }

    #[test]
    fn steam_p2p_host_uses_requested_connecttool_dir_in_status() {
        let _guard = env_lock().lock().expect("env test lock poisoned");
        let previous = std::env::var("LAN_HELPER_CONNECTTOOL_DIR").ok();
        std::env::remove_var("LAN_HELPER_CONNECTTOOL_DIR");
        let request_dir = r"D:\LanHelperTest\connecttool-qt-windows-x86_64".to_string();
        let session = start_steam_p2p_host(SteamP2pHostRequest {
            host_steam_id: "76561198000000000".to_string(),
            virtual_port: 8211,
            target_host: "127.0.0.1".to_string(),
            target_port: 8211,
            app_id: Some("480".to_string()),
            connecttool_dir: Some(request_dir.clone()),
        })
        .expect("host session should produce a precheck-backed session status");
        if let Some(value) = previous {
            std::env::set_var("LAN_HELPER_CONNECTTOOL_DIR", value);
        } else {
            std::env::remove_var("LAN_HELPER_CONNECTTOOL_DIR");
        }
        assert_eq!(
            session.invite.as_ref().map(|item| item.app_id.as_str()),
            Some("480")
        );
        assert_eq!(
            session.status.connecttool_status.directory.as_deref(),
            Some(request_dir.as_str())
        );
    }
}
