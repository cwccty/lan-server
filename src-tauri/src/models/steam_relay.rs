use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamRelayStatus {
    pub available: bool,
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
