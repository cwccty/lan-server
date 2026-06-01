use chrono::Utc;

use crate::core::game_detector;
use crate::models::diagnostics::DiagnosticReport;
use crate::network::{manual_lan_backend, n2n_backend, radmin_backend};
use crate::storage::adapter_store;

pub fn generate_diagnostic_report() -> Result<DiagnosticReport, String> {
    let adapters = adapter_store::load_game_adapters().unwrap_or_default();
    let steam_libraries = game_detector::discover_steam_libraries();
    let games = game_detector::scan_games().unwrap_or_default();
    let backends = vec![
        manual_lan_backend::detect(),
        radmin_backend::detect(),
        n2n_backend::detect(),
    ];

    Ok(DiagnosticReport {
        generated_at: Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        summary: format!(
            "适配库 {} 个游戏；扫描返回 {} 个游戏；网络后端 {} 个。",
            adapters.len(),
            games.len(),
            backends.len()
        ),
        details: vec![
            format!(
                "Steam 库路径: {}",
                serde_json::to_string_pretty(&steam_libraries.iter().map(|path| path.to_string_lossy().to_string()).collect::<Vec<_>>()).unwrap_or_default()
            ),
            format!("游戏扫描: {}", serde_json::to_string_pretty(&games).unwrap_or_default()),
            format!("网络后端: {}", serde_json::to_string_pretty(&backends).unwrap_or_default()),
            "报告不包含凭据、Cookie、SSH Key 或无关用户目录内容。".to_string(),
        ],
    })
}
