use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdpProxyConfig {
    pub id: Option<String>,
    pub listen_host: String,
    pub listen_port: u16,
    pub target_host: String,
    pub target_port: u16,
    pub label: Option<String>,
    pub game_id: Option<String>,
    pub client_ttl_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdpProxyStatus {
    pub id: String,
    pub running: bool,
    pub listen: String,
    pub target: String,
    pub active_clients: u32,
    pub packets_in: u64,
    pub packets_out: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub last_error: Option<String>,
    pub logs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdpProxySelfTestReport {
    pub ok: bool,
    pub listen: String,
    pub target: String,
    pub sent: String,
    pub received: String,
    pub packets_in: u64,
    pub packets_out: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub notes: Vec<String>,
    pub status: UdpProxyStatus,
}
