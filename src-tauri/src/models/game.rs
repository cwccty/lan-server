use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameCapability {
    Lan,
    IpJoin,
    DedicatedServer,
    SteamLobby,
    SteamP2p,
    LocalCoop,
    RemotePlayTogether,
    OfficialServer,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MultiplayerCapability {
    NativeLanIp,
    HiddenDedicatedServer,
    LanDiscoveryBroadcast,
    TcpUdpProxyPossible,
    LocalCoopRemotePlay,
    SteamP2pLobby,
    CommunityMod,
    OfficialOnly,
    Unsupported,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConversionMethod {
    VirtualLan,
    DedicatedServerLauncher,
    BroadcastBridge,
    PortProxy,
    ModInstaller,
    SteamRelayPlugin,
    SteamRemotePlay,
    SunshineMoonlight,
    WireguardGuide,
    ZerotierGuide,
    TailscaleGuide,
    ManualGuide,
    NotSupported,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameNetworkType {
    LanIpDirect,
    DedicatedServer,
    TcpPortProxyNeeded,
    UdpBroadcastNeeded,
    SteamLobbyDirectPossible,
    SteamRelayPlugin,
    LocalCoopRemotePlay,
    SteamP2pOnly,
    ModRequired,
    OfficialOnly,
    NotSupported,
    UnknownNeedReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameConnectionPlan {
    pub summary: String,
    pub host_role: String,
    pub join_role: String,
    pub default_join_host: Option<String>,
    pub default_join_port: Option<u16>,
    pub requires_virtual_lan: bool,
    pub requires_tcp_port_proxy: bool,
    pub requires_udp_broadcast_bridge: bool,
    pub requires_dedicated_server: bool,
    pub invite_template: Vec<String>,
    pub troubleshooting: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiplayerConversionProfile {
    pub capability: MultiplayerCapability,
    pub methods: Vec<ConversionMethod>,
    pub can_convert_to_lan: bool,
    pub risk_level: String,
    pub notes: Vec<String>,
    pub required_components: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterApplicabilityProfile {
    pub verification_status: String,
    pub tested_versions: Vec<String>,
    pub tested_platforms: Vec<String>,
    pub supported_os: Vec<String>,
    pub network_conditions: Vec<String>,
    pub known_limitations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterEvidenceProfile {
    pub port_protocols: Vec<String>,
    pub proof_items: Vec<String>,
    pub test_steps: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_verified_at: Option<String>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adapter_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub detected_path: Option<String>,
    pub capabilities: Vec<GameCapability>,
    pub multiplayer_conversion: Option<MultiplayerConversionProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub network_type: Option<GameNetworkType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connection_plan: Option<GameConnectionPlan>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub applicability: Option<AdapterApplicabilityProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence: Option<AdapterEvidenceProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adapter_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameAnalysis {
    pub game_id: String,
    pub display_name: String,
    pub steam_appid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adapter_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub detected_path: Option<String>,
    pub capabilities: Vec<GameCapability>,
    pub multiplayer_conversion: Option<MultiplayerConversionProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub network_type: Option<GameNetworkType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connection_plan: Option<GameConnectionPlan>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub applicability: Option<AdapterApplicabilityProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence: Option<AdapterEvidenceProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adapter_source: Option<String>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adapter_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub capabilities: Vec<GameCapability>,
    pub multiplayer_conversion: Option<MultiplayerConversionProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub network_type: Option<GameNetworkType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connection_plan: Option<GameConnectionPlan>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub applicability: Option<AdapterApplicabilityProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence: Option<AdapterEvidenceProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adapter_source: Option<String>,
    pub executables: Vec<String>,
    pub default_ports: Vec<u16>,
    pub launch_profiles: Vec<LaunchProfile>,
}
