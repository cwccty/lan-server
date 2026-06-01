use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::core::process_util::hide_console_window;
use crate::models::game::{GameAdapter, GameCapability, GameSummary};
use crate::storage::adapter_store;

pub fn scan_games() -> Result<Vec<GameSummary>, String> {
    let adapters = adapter_store::load_game_adapters()?;
    let steam_libraries = discover_steam_libraries();
    let mut games: Vec<GameSummary> = adapters
        .into_iter()
        .map(|adapter| {
            let detected_path = find_installed_game_path(&adapter, &steam_libraries);
            GameSummary {
                game_id: adapter.game_id,
                display_name: adapter.display_name,
                steam_appid: adapter.steam_appid,
                detected_path,
                capabilities: adapter.capabilities,
            }
        })
        .collect();

    append_unknown_steam_games(&mut games, &steam_libraries);
    Ok(games)
}

pub fn discover_steam_libraries() -> Vec<PathBuf> {
    let mut roots = BTreeSet::new();

    for steam_root in candidate_steam_roots() {
        let default_library = steam_root.join("steamapps");
        if default_library.exists() {
            roots.insert(default_library);
        }

        let library_file = steam_root.join("steamapps").join("libraryfolders.vdf");
        for path in parse_libraryfolders_vdf(&library_file) {
            let steamapps = path.join("steamapps");
            if steamapps.exists() {
                roots.insert(steamapps);
            }
        }
    }

    roots.into_iter().collect()
}

fn candidate_steam_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    roots.extend(candidate_steam_roots_from_registry());
    if let Ok(path) = std::env::var("PROGRAMFILES(X86)") {
        roots.push(PathBuf::from(path).join("Steam"));
    }
    if let Ok(path) = std::env::var("PROGRAMFILES") {
        roots.push(PathBuf::from(path).join("Steam"));
    }
    roots.push(PathBuf::from(r"C:\Program Files (x86)\Steam"));
    roots.push(PathBuf::from(r"C:\Program Files\Steam"));
    dedup_pathbufs(roots)
}

fn candidate_steam_roots_from_registry() -> Vec<PathBuf> {
    let queries = [
        (r"HKCU\Software\Valve\Steam", "SteamPath"),
        (r"HKCU\Software\Valve\Steam", "InstallPath"),
        (r"HKLM\Software\WOW6432Node\Valve\Steam", "InstallPath"),
        (r"HKLM\Software\Valve\Steam", "InstallPath"),
    ];

    queries
        .into_iter()
        .filter_map(|(key, value)| read_registry_string(key, value))
        .map(|path| PathBuf::from(path.replace('/', "\\")))
        .collect()
}

fn read_registry_string(key: &str, value: &str) -> Option<String> {
    let mut command = Command::new("reg");
    command.args(["query", key, "/v", value]);
    let output = hide_console_window(&mut command).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(value) || !trimmed.contains("REG_") {
            continue;
        }
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() >= 3 {
            return Some(parts[2..].join(" "));
        }
    }

    None
}

fn dedup_pathbufs(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut result = Vec::new();
    for path in paths {
        if !result.contains(&path) {
            result.push(path);
        }
    }
    result
}

fn parse_libraryfolders_vdf(path: &Path) -> Vec<PathBuf> {
    let Ok(content) = fs::read_to_string(path) else {
        return Vec::new();
    };

    content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if !trimmed.starts_with("\"path\"") {
                return None;
            }
            let parts: Vec<&str> = trimmed.split('"').collect();
            let raw_path = parts.get(3)?;
            Some(PathBuf::from(raw_path.replace("\\\\", "\\")))
        })
        .collect()
}

pub fn find_installed_game_path(adapter: &GameAdapter, steam_libraries: &[PathBuf]) -> Option<String> {
    if let Some(path) = find_by_steam_appmanifest(adapter, steam_libraries) {
        return Some(path);
    }

    for steamapps in steam_libraries {
        let common = steamapps.join("common");
        let Ok(entries) = fs::read_dir(&common) else {
            continue;
        };
        for entry in entries.flatten() {
            let game_dir = entry.path();
            if !game_dir.is_dir() {
                continue;
            }
            for exe in &adapter.executables {
                if game_dir.join(exe).exists() {
                    return Some(game_dir.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

fn find_by_steam_appmanifest(adapter: &GameAdapter, steam_libraries: &[PathBuf]) -> Option<String> {
    let appid = adapter.steam_appid.as_ref()?;

    for steamapps in steam_libraries {
        let manifest = steamapps.join(format!("appmanifest_{appid}.acf"));
        let content = fs::read_to_string(manifest).ok()?;
        let install_dir = parse_acf_value(&content, "installdir")?;
        let game_dir = steamapps.join("common").join(install_dir);

        if adapter.executables.is_empty() || adapter.executables.iter().any(|exe| game_dir.join(exe).exists()) {
            return Some(game_dir.to_string_lossy().to_string());
        }
    }

    None
}

pub fn find_unknown_steam_game(game_id: &str) -> Option<GameSummary> {
    let steam_libraries = discover_steam_libraries();
    let mut games = Vec::new();
    append_unknown_steam_games(&mut games, &steam_libraries);
    games.into_iter().find(|item| item.game_id == game_id)
}

fn append_unknown_steam_games(games: &mut Vec<GameSummary>, steam_libraries: &[PathBuf]) {
    let known_appids: BTreeSet<String> = games.iter().filter_map(|item| item.steam_appid.clone()).collect();

    for steamapps in steam_libraries {
        let Ok(entries) = fs::read_dir(steamapps) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !file_name.starts_with("appmanifest_") || !file_name.ends_with(".acf") {
                continue;
            }

            let Some(appid) = file_name
                .strip_prefix("appmanifest_")
                .and_then(|value| value.strip_suffix(".acf"))
                .map(ToString::to_string)
            else {
                continue;
            };
            if known_appids.contains(&appid) {
                continue;
            }

            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };
            let display_name = parse_acf_value(&content, "name").unwrap_or_else(|| format!("Steam App {appid}"));
            let install_dir = parse_acf_value(&content, "installdir");
            let detected_path = install_dir.map(|dir| steamapps.join("common").join(dir).to_string_lossy().to_string());
            games.push(GameSummary {
                game_id: format!("steam_{appid}"),
                display_name,
                steam_appid: Some(appid),
                detected_path,
                capabilities: vec![GameCapability::Unknown],
            });
        }
    }
}

fn parse_acf_value(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(&format!("\"{key}\"")) {
            continue;
        }
        let parts: Vec<&str> = trimmed.split('"').collect();
        if let Some(value) = parts.get(3) {
            return Some((*value).to_string());
        }
    }
    None
}
