use crate::core::game_detector;
use crate::models::game::{
    ConversionMethod, GameAnalysis, GameCapability, MultiplayerCapability,
    MultiplayerConversionProfile,
};
use crate::storage::adapter_store;

pub fn analyze_game(game_id: &str) -> Result<GameAnalysis, String> {
    let adapter = adapter_store::load_game_adapters()?
        .into_iter()
        .find(|item| item.game_id == game_id);

    let Some(adapter) = adapter else {
        let Some(game) = game_detector::find_unknown_steam_game(game_id) else {
            return Err(format!("未找到游戏适配或 Steam 安装记录: {game_id}"));
        };
        return Ok(GameAnalysis {
            game_id: game.game_id,
            display_name: game.display_name,
            steam_appid: game.steam_appid,
            detected_path: game.detected_path,
            capabilities: game.capabilities,
            multiplayer_conversion: Some(MultiplayerConversionProfile {
                capability: MultiplayerCapability::Unknown,
                methods: vec![ConversionMethod::ManualGuide],
                can_convert_to_lan: false,
                risk_level: "high".to_string(),
                notes: vec![
                    "该游戏来自 Steam 自动扫描，但尚未进入适配库。".to_string(),
                    "当前不能判断它是否支持 LAN/IP、Dedicated Server、广播发现或 Mod 联机。"
                        .to_string(),
                ],
                required_components: vec!["人工适配".to_string()],
            }),
            network_type: game.network_type,
            connection_plan: game.connection_plan,
            adapter_source: game.adapter_source.or_else(|| Some("steam_scan".to_string())),
            confidence: "low".to_string(),
            notes: vec![
                "该游戏来自 Steam appmanifest 自动扫描，但尚未进入联机助手适配库。".to_string(),
                "当前无法判断其是否支持 LAN、IP 直连或 Dedicated Server。".to_string(),
            ],
            launch_profiles: Vec::new(),
            default_ports: Vec::new(),
        });
    };
    let steam_libraries = game_detector::discover_steam_libraries();
    let detected_path = game_detector::find_installed_game_path(&adapter, &steam_libraries);

    Ok(GameAnalysis {
        game_id: adapter.game_id,
        display_name: adapter.display_name,
        steam_appid: adapter.steam_appid,
        detected_path,
        multiplayer_conversion: adapter
            .multiplayer_conversion
            .clone()
            .or_else(|| Some(infer_multiplayer_conversion(&adapter.capabilities))),
        network_type: adapter.network_type,
        connection_plan: adapter.connection_plan,
        adapter_source: adapter.adapter_source,
        capabilities: adapter.capabilities,
        confidence: "medium".to_string(),
        notes: vec!["当前结果来自静态适配库，尚未完成本机安装路径扫描。".to_string()],
        launch_profiles: adapter.launch_profiles,
        default_ports: adapter.default_ports,
    })
}

fn infer_multiplayer_conversion(capabilities: &[GameCapability]) -> MultiplayerConversionProfile {
    let has_lan_or_ip = capabilities
        .iter()
        .any(|cap| matches!(cap, GameCapability::Lan | GameCapability::IpJoin));
    let has_dedicated_server = capabilities
        .iter()
        .any(|cap| matches!(cap, GameCapability::DedicatedServer));
    let has_official_only = capabilities.iter().any(|cap| {
        matches!(
            cap,
            GameCapability::OfficialServer | GameCapability::SteamLobby | GameCapability::SteamP2p
        )
    });

    if has_dedicated_server {
        return MultiplayerConversionProfile {
            capability: MultiplayerCapability::HiddenDedicatedServer,
            methods: vec![
                ConversionMethod::VirtualLan,
                ConversionMethod::DedicatedServerLauncher,
            ],
            can_convert_to_lan: true,
            risk_level: "low".to_string(),
            notes: vec![
                "该游戏具备本地服务端或可被服务端启动器承接。".to_string(),
                "组网成功后，加入方连接房主虚拟 IP 和游戏端口。".to_string(),
            ],
            required_components: vec!["虚拟局域网".to_string(), "本地服务端启动器".to_string()],
        };
    }

    if has_lan_or_ip {
        return MultiplayerConversionProfile {
            capability: MultiplayerCapability::NativeLanIp,
            methods: vec![ConversionMethod::VirtualLan, ConversionMethod::ManualGuide],
            can_convert_to_lan: true,
            risk_level: "low".to_string(),
            notes: vec![
                "该游戏原生支持 LAN 或 IP 直连。".to_string(),
                "联机助手主要负责组网、邀请信息和连通性诊断。".to_string(),
            ],
            required_components: vec!["虚拟局域网".to_string(), "游戏内 LAN/IP 加入".to_string()],
        };
    }

    if has_official_only {
        return MultiplayerConversionProfile {
            capability: MultiplayerCapability::OfficialOnly,
            methods: vec![
                ConversionMethod::SteamRelayPlugin,
                ConversionMethod::ManualGuide,
            ],
            can_convert_to_lan: false,
            risk_level: "high".to_string(),
            notes: vec![
                "该游戏当前只识别到官方/平台联机能力。".to_string(),
                "不能承诺转换为本地联机；未来可研究 Steam Relay 等插件路线。".to_string(),
            ],
            required_components: vec!["官方联机".to_string(), "未来平台网络插件".to_string()],
        };
    }

    MultiplayerConversionProfile {
        capability: MultiplayerCapability::Unknown,
        methods: vec![ConversionMethod::ManualGuide],
        can_convert_to_lan: false,
        risk_level: "high".to_string(),
        notes: vec!["尚未识别到可转换成本地联机的能力。".to_string()],
        required_components: vec!["人工适配".to_string()],
    }
}
