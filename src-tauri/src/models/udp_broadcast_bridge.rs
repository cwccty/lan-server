use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdpBroadcastBridgeConfig {
    pub id: Option<String>,
    pub listen_host: String,
    pub listen_port: u16,
    pub forward_targets: Vec<String>,
    pub label: Option<String>,
    pub game_id: Option<String>,
    pub allow_broadcast: Option<bool>,
    pub duplicate_ttl_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdpBroadcastBridgeStatus {
    pub id: String,
    pub running: bool,
    pub listen: String,
    pub forward_targets: Vec<String>,
    pub received_packets: u64,
    pub forwarded_packets: u64,
    pub dropped_packets: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub last_error: Option<String>,
    pub logs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdpBroadcastBridgeSelfTestReport {
    pub ok: bool,
    pub listen: String,
    pub forward_targets: Vec<String>,
    pub sent: String,
    pub received: String,
    pub received_packets: u64,
    pub forwarded_packets: u64,
    pub dropped_packets: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub notes: Vec<String>,
    pub status: UdpBroadcastBridgeStatus,
}
