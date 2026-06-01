use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameCapability {
    Lan,
    IpJoin,
    DedicatedServer,
    SteamLobby,
    SteamP2p,
    OfficialServer,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfigField {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub field_type: String,
    pub default_value: Option<String>,
    pub required: Option<bool>,
    pub help: Option<String>,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchProfile {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub profile_type: String,
    pub exe: Option<String>,
    pub args: Option<Vec<String>>,
    pub arg_templates: Option<Vec<String>>,
    pub stdin_templates: Option<Vec<String>>,
    pub config_fields: Option<Vec<LaunchConfigField>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSummary {
    pub game_id: String,
    pub display_name: String,
    pub steam_appid: Option<String>,
    pub detected_path: Option<String>,
    pub capabilities: Vec<GameCapability>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameAnalysis {
    pub game_id: String,
    pub display_name: String,
    pub steam_appid: Option<String>,
    pub detected_path: Option<String>,
    pub capabilities: Vec<GameCapability>,
    pub confidence: String,
    pub notes: Vec<String>,
    pub launch_profiles: Vec<LaunchProfile>,
    pub default_ports: Vec<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameAdapter {
    pub game_id: String,
    pub display_name: String,
    pub steam_appid: Option<String>,
    pub capabilities: Vec<GameCapability>,
    pub executables: Vec<String>,
    pub default_ports: Vec<u16>,
    pub launch_profiles: Vec<LaunchProfile>,
}
