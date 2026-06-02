mod commands;
mod core;
mod models;
mod network;
mod storage;

pub fn run() {
    tauri::Builder::default()
        .on_window_event(|_, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                cleanup_managed_processes();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_games,
            commands::analyze_game,
            commands::list_game_adapters,
            commands::save_game_adapter,
            commands::import_game_adapter_json,
            commands::export_game_adapter_json,
            commands::sync_adapter_registry,
            commands::sync_local_adapter_registry_example,
            commands::list_network_backends,
            commands::setup_network,
            commands::start_network,
            commands::stop_network,
            commands::get_n2n_diagnostics,
            commands::get_n2n_last_config,
            commands::test_connectivity,
            commands::recommend_plans,
            commands::launch_profile,
            commands::generate_diagnostic_report,
            commands::start_game_server_session,
            commands::read_server_session,
            commands::stop_server_session,
            commands::send_server_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn cleanup_managed_processes() {
    let _ = core::server_session::stop_server_session();
    let _ = network::n2n_backend::stop();
}
