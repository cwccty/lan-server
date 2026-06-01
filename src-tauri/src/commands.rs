use crate::core::{
    capability_engine, connectivity_tester, diagnostic_logger, game_detector, game_launcher,
    recommendation_engine, server_session,
};
use crate::models::diagnostics::DiagnosticReport;
use crate::models::game::{GameAnalysis, GameSummary};
use crate::models::network::{
    BackendRuntimeStatus, BackendSummary, ConnectivityReport, ConnectivityTarget, NetworkConfig,
    SetupResult,
};
use crate::models::recommendation::{LaunchResult, Recommendation};
use crate::models::server_session::ServerSessionStatus;
use crate::network::{manual_lan_backend, n2n_backend, radmin_backend};
use serde_json::Value;

#[tauri::command]
pub fn scan_games() -> Result<Vec<GameSummary>, String> {
    game_detector::scan_games()
}

#[tauri::command]
pub fn analyze_game(game_id: String) -> Result<GameAnalysis, String> {
    capability_engine::analyze_game(&game_id)
}

#[tauri::command]
pub fn list_network_backends() -> Result<Vec<BackendSummary>, String> {
    Ok(vec![
        manual_lan_backend::detect(),
        radmin_backend::detect(),
        n2n_backend::detect(),
    ])
}

#[tauri::command]
pub fn setup_network(backend_id: String, config: NetworkConfig) -> Result<SetupResult, String> {
    match backend_id.as_str() {
        "manual_lan" => Ok(manual_lan_backend::setup(config)),
        "radmin" => Ok(radmin_backend::setup(config)),
        "n2n" => Ok(n2n_backend::setup(config)),
        _ => Err(format!("未知网络后端: {backend_id}")),
    }
}

#[tauri::command]
pub fn start_network(backend_id: String) -> Result<BackendRuntimeStatus, String> {
    match backend_id.as_str() {
        "manual_lan" => Ok(manual_lan_backend::start()),
        "radmin" => Ok(radmin_backend::start()),
        "n2n" => Ok(n2n_backend::start()),
        _ => Err(format!("未知网络后端: {backend_id}")),
    }
}

#[tauri::command]
pub fn stop_network(backend_id: String) -> Result<BackendRuntimeStatus, String> {
    match backend_id.as_str() {
        "manual_lan" => Ok(manual_lan_backend::stop()),
        "radmin" => Ok(radmin_backend::stop()),
        "n2n" => Ok(n2n_backend::stop()),
        _ => Err(format!("未知网络后端: {backend_id}")),
    }
}

#[tauri::command]
pub fn test_connectivity(target: ConnectivityTarget) -> Result<ConnectivityReport, String> {
    connectivity_tester::test_connectivity(target)
}

#[tauri::command]
pub fn recommend_plans(game_id: String) -> Result<Vec<Recommendation>, String> {
    recommendation_engine::recommend_plans(&game_id)
}

#[tauri::command]
pub fn launch_profile(
    game_id: String,
    profile_id: String,
    config: Value,
) -> Result<LaunchResult, String> {
    game_launcher::launch_profile(&game_id, &profile_id, config)
}

#[tauri::command]
pub fn generate_diagnostic_report() -> Result<DiagnosticReport, String> {
    diagnostic_logger::generate_diagnostic_report()
}

#[tauri::command]
pub fn start_game_server_session(
    game_id: String,
    profile_id: String,
    config: serde_json::Value,
) -> Result<ServerSessionStatus, String> {
    server_session::start_game_server_session(&game_id, &profile_id, config)
}

#[tauri::command]
pub fn read_server_session() -> Result<ServerSessionStatus, String> {
    server_session::read_server_session()
}

#[tauri::command]
pub fn stop_server_session() -> Result<ServerSessionStatus, String> {
    server_session::stop_server_session()
}

#[tauri::command]
pub fn send_server_command(command: String) -> Result<ServerSessionStatus, String> {
    server_session::send_server_command(&command)
}
