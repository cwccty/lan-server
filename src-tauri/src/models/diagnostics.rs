use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub generated_at: String,
    pub app_version: String,
    pub os: String,
    pub summary: String,
    pub release_checks: Vec<ReleaseCheck>,
    pub details: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseCheck {
    pub id: String,
    pub label: String,
    pub ok: bool,
    pub detail: String,
    pub required_for_mvp: bool,
}
