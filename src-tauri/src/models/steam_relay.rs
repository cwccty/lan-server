use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamRelayStatus {
    pub available: bool,
    pub overall_status: String,
    pub native_status: SteamRelayNativeStatus,
    pub connecttool_status: ConnectToolStatus,
    pub steam_running: bool,
    pub steam_process_path: Option<String>,
    pub steamworks_sdk_dir: Option<String>,
    pub steamworks_sdk_configured: bool,
    pub redistributable_found: bool,
    pub redistributable_path: Option<String>,
    pub app_id: Option<String>,
    pub app_id_configured: bool,
    pub unavailable_reasons: Vec<String>,
    pub next_steps: Vec<String>,
    pub legal_notice: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamRelayNativeStatus {
    pub built_in: bool,
    pub available: bool,
    pub state: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectToolFileStatus {
    pub name: String,
    pub required: bool,
    pub found: bool,
    pub path: Option<String>,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectToolStatus {
    pub enabled: bool,
    pub directory: Option<String>,
    pub directory_exists: bool,
    pub app_id: Option<String>,
    pub app_id_path: Option<String>,
    pub required_files_ok: bool,
    pub wintun_available: bool,
    pub helper_running: bool,
    pub helper_process_path: Option<String>,
    pub helper_pid: Option<u32>,
    pub can_start: bool,
    pub can_tcp_forward: bool,
    pub can_tun: bool,
    pub missing_files: Vec<String>,
    pub file_statuses: Vec<ConnectToolFileStatus>,
    pub diagnostics: Vec<String>,
    pub next_steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamP2pInvitePacket {
    pub method: String,
    pub host_steam_id: String,
    pub virtual_port: u16,
    pub protocol: String,
    pub target_host: String,
    pub target_port: u16,
    pub guest_local_port: u16,
    pub app_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamP2pHostRequest {
    pub host_steam_id: String,
    pub virtual_port: u16,
    pub target_host: String,
    pub target_port: u16,
    pub app_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamP2pGuestRequest {
    pub host_steam_id: String,
    pub virtual_port: u16,
    pub guest_local_port: u16,
    pub app_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamP2pSessionStatus {
    pub running: bool,
    pub mode: String,
    pub state: String,
    pub message: String,
    pub invite: Option<SteamP2pInvitePacket>,
    pub status: SteamRelayStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectToolLaunchRequest {
    pub directory: Option<String>,
}
