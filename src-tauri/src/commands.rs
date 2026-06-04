use crate::core::{
    capability_engine, connectivity_tester, diagnostic_logger, game_detector, game_launcher,
    port_proxy, recommendation_engine, server_session, udp_broadcast_bridge, udp_proxy,
};
use crate::models::diagnostics::DiagnosticReport;
use crate::models::friend::{FriendAllocation, FriendAllocationInput, FriendCheckInput};
use crate::models::game::{GameAdapter, GameAnalysis, GameSummary};
use crate::models::network::{
    BackendRuntimeStatus, BackendSummary, ConnectivityReport, ConnectivityTarget, N2nDiagnostics,
    NetworkConfig, SetupResult,
};
use crate::models::port_proxy::{PortProxyConfig, PortProxySelfTestReport, PortProxyStatus};
use crate::models::udp_broadcast_bridge::{
    UdpBroadcastBridgeConfig, UdpBroadcastBridgeSelfTestReport, UdpBroadcastBridgeStatus,
};
use crate::models::udp_proxy::{UdpProxyConfig, UdpProxySelfTestReport, UdpProxyStatus};
use crate::models::recommendation::{LaunchResult, Recommendation};
use crate::models::server_session::{GenericServerLaunchConfig, ServerSessionStatus};
use crate::models::settings::{AppSettings, EdgePathCheck};
use crate::network::{manual_lan_backend, n2n_backend, radmin_backend};
use crate::storage::adapter_store::{self, AdapterRegistrySyncResult};
use crate::storage::friend_store;
use crate::storage::settings_store;
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
pub fn list_game_adapters() -> Result<Vec<GameAdapter>, String> {
    adapter_store::list_game_adapters()
}

#[tauri::command]
pub fn save_game_adapter(adapter: GameAdapter) -> Result<GameAdapter, String> {
    adapter_store::save_game_adapter(adapter)
}

#[tauri::command]
pub fn import_game_adapter_json(content: String) -> Result<GameAdapter, String> {
    adapter_store::import_game_adapter_json(content)
}

#[tauri::command]
pub fn export_game_adapter_json(game_id: String) -> Result<String, String> {
    adapter_store::export_game_adapter_json(game_id)
}

#[tauri::command]
pub fn sync_adapter_registry(registry_url: String) -> Result<AdapterRegistrySyncResult, String> {
    adapter_store::sync_adapter_registry(registry_url)
}

#[tauri::command]
pub fn sync_local_adapter_registry_example() -> Result<AdapterRegistrySyncResult, String> {
    adapter_store::sync_local_adapter_registry_example()
}

#[tauri::command]
pub fn get_app_settings() -> Result<AppSettings, String> {
    settings_store::get_app_settings()
}

#[tauri::command]
pub fn save_app_settings(settings: AppSettings) -> Result<AppSettings, String> {
    settings_store::save_app_settings(settings)
}

#[tauri::command]
pub fn reset_app_settings() -> Result<AppSettings, String> {
    settings_store::reset_app_settings()
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    settings_store::open_path(path)
}

#[tauri::command]
pub fn test_edge_path(path: Option<String>) -> Result<EdgePathCheck, String> {
    settings_store::test_edge_path(path)
}

#[tauri::command]
pub fn list_friend_allocations() -> Result<Vec<FriendAllocation>, String> {
    friend_store::list_friend_allocations()
}

#[tauri::command]
pub fn upsert_friend_allocation(input: FriendAllocationInput) -> Result<FriendAllocation, String> {
    friend_store::upsert_friend_allocation(input)
}

#[tauri::command]
pub fn select_friend_allocation(input: FriendAllocationInput) -> Result<FriendAllocation, String> {
    friend_store::select_friend_allocation(input)
}

#[tauri::command]
pub fn remove_friend_allocation(name: String, ip: Option<String>) -> Result<FriendAllocation, String> {
    friend_store::remove_friend_allocation(name, ip)
}

#[tauri::command]
pub fn update_friend_check(input: FriendCheckInput) -> Result<Option<FriendAllocation>, String> {
    friend_store::update_friend_check(input)
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
pub fn get_n2n_diagnostics() -> Result<N2nDiagnostics, String> {
    Ok(n2n_backend::diagnose())
}

#[tauri::command]
pub fn get_n2n_last_config() -> Result<NetworkConfig, String> {
    n2n_backend::last_config()
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
pub fn generate_diagnostic_report_for_game(game_id: String) -> Result<DiagnosticReport, String> {
    diagnostic_logger::generate_diagnostic_report_for_game(&game_id)
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
pub fn start_generic_server_session(
    config: GenericServerLaunchConfig,
) -> Result<ServerSessionStatus, String> {
    server_session::start_generic_server_session(config)
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

#[tauri::command]
pub fn start_port_proxy(config: PortProxyConfig) -> Result<PortProxyStatus, String> {
    port_proxy::start_port_proxy(config)
}

#[tauri::command]
pub fn stop_port_proxy(id: String) -> Result<PortProxyStatus, String> {
    port_proxy::stop_port_proxy(&id)
}

#[tauri::command]
pub fn list_port_proxies() -> Result<Vec<PortProxyStatus>, String> {
    Ok(port_proxy::list_port_proxies())
}

#[tauri::command]
pub fn get_port_proxy_status(id: String) -> Result<PortProxyStatus, String> {
    port_proxy::get_port_proxy_status(&id)
}

#[tauri::command]
pub fn test_port_proxy(id: String) -> Result<ConnectivityReport, String> {
    port_proxy::test_port_proxy(&id)
}

#[tauri::command]
pub fn self_test_port_proxy() -> Result<PortProxySelfTestReport, String> {
    port_proxy::self_test_port_proxy()
}

#[tauri::command]
pub fn start_udp_proxy(config: UdpProxyConfig) -> Result<UdpProxyStatus, String> {
    udp_proxy::start_udp_proxy(config)
}

#[tauri::command]
pub fn stop_udp_proxy(id: String) -> Result<UdpProxyStatus, String> {
    udp_proxy::stop_udp_proxy(&id)
}

#[tauri::command]
pub fn list_udp_proxies() -> Result<Vec<UdpProxyStatus>, String> {
    Ok(udp_proxy::list_udp_proxies())
}

#[tauri::command]
pub fn get_udp_proxy_status(id: String) -> Result<UdpProxyStatus, String> {
    udp_proxy::get_udp_proxy_status(&id)
}

#[tauri::command]
pub fn self_test_udp_proxy() -> Result<UdpProxySelfTestReport, String> {
    udp_proxy::self_test_udp_proxy()
}

#[tauri::command]
pub fn start_udp_broadcast_bridge(
    config: UdpBroadcastBridgeConfig,
) -> Result<UdpBroadcastBridgeStatus, String> {
    udp_broadcast_bridge::start_udp_broadcast_bridge(config)
}

#[tauri::command]
pub fn stop_udp_broadcast_bridge(id: String) -> Result<UdpBroadcastBridgeStatus, String> {
    udp_broadcast_bridge::stop_udp_broadcast_bridge(&id)
}

#[tauri::command]
pub fn list_udp_broadcast_bridges() -> Result<Vec<UdpBroadcastBridgeStatus>, String> {
    Ok(udp_broadcast_bridge::list_udp_broadcast_bridges())
}

#[tauri::command]
pub fn get_udp_broadcast_bridge_status(id: String) -> Result<UdpBroadcastBridgeStatus, String> {
    udp_broadcast_bridge::get_udp_broadcast_bridge_status(&id)
}

#[tauri::command]
pub fn self_test_udp_broadcast_bridge() -> Result<UdpBroadcastBridgeSelfTestReport, String> {
    udp_broadcast_bridge::self_test_udp_broadcast_bridge()
}
