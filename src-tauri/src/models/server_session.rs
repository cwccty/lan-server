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
}
