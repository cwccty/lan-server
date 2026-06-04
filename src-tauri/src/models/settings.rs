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
