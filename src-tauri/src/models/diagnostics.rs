use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub generated_at: String,
    pub app_version: String,
    pub os: String,
    pub summary: String,
    pub most_likely_cause: Option<DiagnosticIssue>,
    pub issues: Vec<DiagnosticIssue>,
    pub release_ready: bool,
    pub required_passed: usize,
    pub required_total: usize,
    pub next_actions: Vec<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticIssue {
    pub id: String,
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub next_actions: Vec<String>,
    pub evidence: Vec<String>,
}
