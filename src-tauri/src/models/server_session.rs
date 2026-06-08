use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerSessionStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub game_id: Option<String>,
    pub profile_id: Option<String>,
    pub ready: bool,
    pub logs: Vec<String>,
    pub message: String,
    pub exit_code: Option<i32>,
    pub exited_at: Option<String>,
    pub ever_ready: bool,
    pub started_at: Option<String>,
    pub uptime_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenericServerLaunchConfig {
    pub game_name: Option<String>,
    pub executable_path: String,
    pub working_dir: Option<String>,
    pub port: u16,
    pub args: Option<Vec<String>>,
    pub raw_args: Option<String>,
    pub jar_memory_mb: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenericServerPreflightCheck {
    pub id: String,
    pub level: String,
    pub label: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenericServerPreflightReport {
    pub ok: bool,
    pub can_start: bool,
    pub executable_path: String,
    pub working_dir: Option<String>,
    pub executable_kind: String,
    pub port: u16,
    pub summary: String,
    pub checks: Vec<GenericServerPreflightCheck>,
}
