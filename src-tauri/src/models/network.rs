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
pub struct ConnectivityTarget {
    pub host: String,
    pub ports: Vec<u16>,
    pub timeout_ms: Option<u64>,
    pub mode: Option<String>,
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
