use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub edge_path: Option<String>,
    pub supernode_default: Option<String>,
    pub adapter_registry_url: Option<String>,
    pub product_mode: bool,
    pub log_dir: Option<String>,
    pub tools_dir: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgePathCheck {
    pub ok: bool,
    pub path: Option<String>,
    pub exists: bool,
    pub is_file: bool,
    pub executable_name_ok: bool,
    pub can_execute: bool,
    pub version_hint: Option<String>,
    pub message: String,
    pub stderr: Option<String>,
}
