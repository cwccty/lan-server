use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendSummary {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub available: bool,
    pub virtual_ip: Option<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NetworkConfig {
    pub room_name: Option<String>,
    pub secret: Option<String>,
    pub supernode: Option<String>,
    pub local_ip: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendRuntimeStatus {
    pub backend_id: String,
    pub running: bool,
    pub virtual_ip: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct N2nDiagnostics {
    pub running: bool,
    pub supernode_configured: bool,
    pub supernode: Option<String>,
    pub virtual_ip: Option<String>,
    pub ack: bool,
    pub pong: bool,
    pub ok_link: bool,
    pub auth_error: bool,
    pub ip_mac_conflict: bool,
    pub not_responding: bool,
    pub tap_error: bool,
    pub last_error: Option<String>,
    pub summary: String,
    pub log_path: String,
    pub recent_logs: Vec<String>,
    pub executable_found: bool,
    pub executable_path: Option<String>,
    pub recorded_pid: Option<u32>,
    pub recorded_pid_running: bool,
    pub connection_state: String,
    pub manual_start_command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectivityTarget {
    pub host: String,
    pub ports: Vec<u16>,
    pub timeout_ms: Option<u64>,
    pub mode: Option<String>,
    pub protocol: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortCheckResult {
    pub port: u16,
    pub reachable: bool,
    pub latency_ms: Option<u128>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectivityReport {
    pub target_host: String,
    pub reachable: bool,
    pub latency_ms: Option<u128>,
    pub ports: Vec<PortCheckResult>,
    pub notes: Vec<String>,
}
