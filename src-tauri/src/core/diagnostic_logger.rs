use chrono::Utc;

use crate::core::{game_detector, server_session};
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
    let server = server_session::read_server_session().ok();

    let mut release_checks = Vec::new();
    let n2n = backends.iter().find(|backend| backend.id == "n2n");
    release_checks.push(format!(
        "n2n edge：{}",
        if n2n.map(|item| item.available).unwrap_or(false) {
            "已检测到"
        } else {
            "未检测到"
        }
    ));
    release_checks.push(format!(
        "n2n 虚拟 IP：{}",
        n2n.and_then(|item| item.virtual_ip.clone())
            .unwrap_or_else(|| "未检测到".to_string())
    ));
    if let Some(server) = &server {
        release_checks.push(format!(
            "内嵌服务端：running={} ready={} ever_ready={} exit_code={}",
            server.running,
            server.ready,
            server.ever_ready,
            server
                .exit_code
                .map(|code| code.to_string())
                .unwrap_or_else(|| "无".to_string())
        ));
    } else {
        release_checks.push("内嵌服务端：未读取到会话".to_string());
    }

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
            format!("发布前关键检查:\n{}", release_checks.join("\n")),
            format!(
                "Steam 库路径: {}",
                serde_json::to_string_pretty(
                    &steam_libraries
                        .iter()
                        .map(|path| path.to_string_lossy().to_string())
                        .collect::<Vec<_>>()
                )
                .unwrap_or_default()
            ),
            format!(
                "游戏扫描: {}",
                serde_json::to_string_pretty(&games).unwrap_or_default()
            ),
            format!(
                "网络后端: {}",
                serde_json::to_string_pretty(&backends).unwrap_or_default()
            ),
            format!(
                "内嵌服务端会话: {}",
                serde_json::to_string_pretty(&server).unwrap_or_default()
            ),
            "隐私说明：报告不包含凭据、Cookie、SSH Key、浏览器数据或无关用户目录内容。".to_string(),
        ],
    })
}
