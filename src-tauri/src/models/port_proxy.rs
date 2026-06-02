use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProxyConfig {
    pub id: Option<String>,
    pub protocol: String,
    pub listen_host: String,
    pub listen_port: u16,
    pub target_host: String,
    pub target_port: u16,
    pub label: Option<String>,
    pub game_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProxyStatus {
    pub id: String,
    pub running: bool,
    pub protocol: String,
    pub listen: String,
    pub target: String,
    pub active_connections: u32,
    pub total_connections: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub last_error: Option<String>,
    pub logs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortProxySelfTestReport {
    pub ok: bool,
    pub listen: String,
    pub target: String,
    pub sent: String,
    pub received: String,
    pub total_connections: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub notes: Vec<String>,
    pub status: PortProxyStatus,
}
