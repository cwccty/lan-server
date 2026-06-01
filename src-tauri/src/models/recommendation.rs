use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    pub id: String,
    pub title: String,
    pub level: String,
    pub backend_id: Option<String>,
    pub estimated_latency_ms: Option<u128>,
    pub required_actions: Vec<String>,
    pub launch_profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchResult {
    pub ok: bool,
    pub message: String,
}
