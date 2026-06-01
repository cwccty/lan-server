mod commands;
mod core;
mod models;
mod network;
mod storage;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::scan_games,
            commands::analyze_game,
            commands::list_network_backends,
            commands::setup_network,
            commands::start_network,
            commands::stop_network,
            commands::test_connectivity,
            commands::recommend_plans,
            commands::launch_profile,
            commands::generate_diagnostic_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
