use crate::core::game_detector;
use crate::models::game::GameAnalysis;
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
        capabilities: adapter.capabilities,
        confidence: "medium".to_string(),
        notes: vec!["当前结果来自静态适配库，尚未完成本机安装路径扫描。".to_string()],
        launch_profiles: adapter.launch_profiles,
        default_ports: adapter.default_ports,
    })
}
