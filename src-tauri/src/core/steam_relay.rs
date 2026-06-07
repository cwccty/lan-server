use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};

use chrono::Utc;

use crate::models::steam_relay::{
    SteamP2pGuestRequest, SteamP2pHostRequest, SteamP2pInvitePacket, SteamP2pSessionStatus,
    SteamRelayStatus,
};

static SESSION: OnceLock<Mutex<Option<SteamP2pSessionStatus>>> = OnceLock::new();

fn session_store() -> &'static Mutex<Option<SteamP2pSessionStatus>> {
    SESSION.get_or_init(|| Mutex::new(None))
}

pub fn get_steam_relay_status() -> SteamRelayStatus {
    let steam = detect_steam_process();
    let sdk_dir = std::env::var("STEAMWORKS_SDK_DIR").ok().filter(|value| !value.trim().is_empty());
    let redistributable_path = sdk_dir
        .as_deref()
        .and_then(find_steam_api64_redist);
    let app_id = detect_app_id();

    let mut unavailable_reasons = Vec::new();
    let mut next_steps = Vec::new();

    if !steam.0 {
        unavailable_reasons.push("未检测到正在运行的 Steam 客户端。".to_string());
        next_steps.push("先启动 Steam 客户端并登录自己的 Steam 账号。".to_string());
    }
    if sdk_dir.is_none() {
        unavailable_reasons.push("未配置 STEAMWORKS_SDK_DIR。".to_string());
        next_steps.push("安装 Steamworks SDK，并把 STEAMWORKS_SDK_DIR 指向 SDK 根目录。".to_string());
    }
    if sdk_dir.is_some() && redistributable_path.is_none() {
        unavailable_reasons.push("Steamworks SDK 中未找到 redistributable_bin/win64/steam_api64.dll。".to_string());
        next_steps.push("确认 SDK redist 完整。不要复制游戏目录里的 steam_api64.dll。".to_string());
    }
    if app_id.is_none() {
        unavailable_reasons.push("未配置 AppID。".to_string());
        next_steps.push("设置 STEAM_APP_ID 或在桌面版旁提供 steam_appid.txt。生产环境必须使用项目自己的 AppID。".to_string());
    }

    let available = steam.0 && sdk_dir.is_some() && redistributable_path.is_some() && app_id.is_some();
    if available {
        next_steps.push("组件预检通过。下一阶段可接入 Steamworks Networking Sockets。".to_string());
    }

    SteamRelayStatus {
        available,
        steam_running: steam.0,
        steam_process_path: steam.1,
        steamworks_sdk_configured: sdk_dir.is_some(),
        steamworks_sdk_dir: sdk_dir,
        redistributable_found: redistributable_path.is_some(),
        redistributable_path: redistributable_path.map(|path| path.display().to_string()),
        app_id_configured: app_id.is_some(),
        app_id,
        unavailable_reasons,
        next_steps,
        legal_notice: "仅支持合法 Steamworks / Steam Networking Sockets / Steam Datagram Relay 集成；不会修改游戏文件、绕过拥有权或复制游戏目录 DLL。".to_string(),
    }
}

pub fn start_steam_p2p_host(input: SteamP2pHostRequest) -> Result<SteamP2pSessionStatus, String> {
    let status = get_steam_relay_status();
    let app_id = input.app_id.or_else(|| status.app_id.clone()).unwrap_or_default();
    let invite = SteamP2pInvitePacket {
        method: "steam_p2p".to_string(),
        host_steam_id: input.host_steam_id,
        virtual_port: input.virtual_port,
        protocol: "tcp".to_string(),
        target_host: if input.target_host.trim().is_empty() { "127.0.0.1".to_string() } else { input.target_host },
        target_port: input.target_port,
        guest_local_port: input.virtual_port,
        app_id,
        created_at: Utc::now().to_rfc3339(),
    };
    let session = SteamP2pSessionStatus {
        running: false,
        mode: "host".to_string(),
        state: if status.available { "ready_for_sdk" } else { "blocked_by_precheck" }.to_string(),
        message: if status.available {
            "Steam 组件预检通过。本版本仍是实验 stub，尚未启动真实 P2P 转发。".to_string()
        } else {
            "Steam Relay / P2P 预检未通过，不能启动真实连接。请按缺失项配置。".to_string()
        },
        invite: Some(invite),
        status,
    };
    *session_store().lock().map_err(|_| "Steam P2P session lock poisoned".to_string())? = Some(session.clone());
    Ok(session)
}

pub fn start_steam_p2p_guest(input: SteamP2pGuestRequest) -> Result<SteamP2pSessionStatus, String> {
    let status = get_steam_relay_status();
    let invite = SteamP2pInvitePacket {
        method: "steam_p2p".to_string(),
        host_steam_id: input.host_steam_id,
        virtual_port: input.virtual_port,
        protocol: "tcp".to_string(),
        target_host: "127.0.0.1".to_string(),
        target_port: input.virtual_port,
        guest_local_port: input.guest_local_port,
        app_id: input.app_id.or_else(|| status.app_id.clone()).unwrap_or_default(),
        created_at: Utc::now().to_rfc3339(),
    };
    let session = SteamP2pSessionStatus {
        running: false,
        mode: "guest".to_string(),
        state: if status.available { "ready_for_sdk" } else { "blocked_by_precheck" }.to_string(),
        message: if status.available {
            "Steam 组件预检通过。本版本仍是实验 stub，尚未启动真实 P2P 转发。".to_string()
        } else {
            "Steam Relay / P2P 预检未通过，不能启动真实连接。请按缺失项配置。".to_string()
        },
        invite: Some(invite),
        status,
    };
    *session_store().lock().map_err(|_| "Steam P2P session lock poisoned".to_string())? = Some(session.clone());
    Ok(session)
}

pub fn stop_steam_p2p_session() -> Result<SteamP2pSessionStatus, String> {
    let status = get_steam_relay_status();
    let session = SteamP2pSessionStatus {
        running: false,
        mode: "none".to_string(),
        state: "stopped".to_string(),
        message: "Steam P2P 实验会话已停止。".to_string(),
        invite: None,
        status,
    };
    *session_store().lock().map_err(|_| "Steam P2P session lock poisoned".to_string())? = None;
    Ok(session)
}

pub fn get_steam_p2p_session_status() -> Result<SteamP2pSessionStatus, String> {
    if let Some(session) = session_store().lock().map_err(|_| "Steam P2P session lock poisoned".to_string())?.clone() {
        return Ok(session);
    }
    Ok(SteamP2pSessionStatus {
        running: false,
        mode: "none".to_string(),
        state: "idle".to_string(),
        message: "尚未启动 Steam Relay / P2P 实验会话。".to_string(),
        invite: None,
        status: get_steam_relay_status(),
    })
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
        if let Ok(output) = Command::new("tasklist").args(["/FI", "IMAGENAME eq steam.exe"]).output() {
            let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if text.contains("steam.exe") {
                return (true, None);
            }
        }
    }
    (false, None)
}

fn find_steam_api64_redist(sdk_dir: &str) -> Option<PathBuf> {
    let root = Path::new(sdk_dir);
    let candidates = [
        root.join("redistributable_bin").join("win64").join("steam_api64.dll"),
        root.join("sdk").join("redistributable_bin").join("win64").join("steam_api64.dll"),
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
