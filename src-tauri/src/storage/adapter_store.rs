use std::fs;
use std::path::{Path, PathBuf};

use crate::models::game::GameAdapter;

pub fn load_game_adapters() -> Result<Vec<GameAdapter>, String> {
    for dir in candidate_adapter_dirs() {
        if dir.exists() {
            let adapters = load_game_adapters_from_dir(&dir)?;
            if !adapters.is_empty() {
                return Ok(adapters);
            }
        }
    }

    load_builtin_game_adapters()
}

pub fn list_game_adapters() -> Result<Vec<GameAdapter>, String> {
    load_game_adapters()
}

pub fn save_game_adapter(adapter: GameAdapter) -> Result<GameAdapter, String> {
    validate_adapter(&adapter)?;
    let dir = writable_adapter_dir()?;
    fs::create_dir_all(&dir).map_err(|err| format!("create adapter dir failed: {err}"))?;
    let file_name = format!("custom_{}.json", sanitize_file_stem(&adapter.game_id));
    let path = dir.join(file_name);
    let content = serde_json::to_string_pretty(&adapter).map_err(|err| format!("serialize adapter failed: {err}"))?;
    fs::write(&path, format!("{content}\n")).map_err(|err| format!("write {:?} failed: {err}", path))?;
    Ok(adapter)
}

pub fn import_game_adapter_json(content: String) -> Result<GameAdapter, String> {
    let adapter: GameAdapter = serde_json::from_str(&content).map_err(|err| format!("parse adapter JSON failed: {err}"))?;
    save_game_adapter(adapter)
}

pub fn export_game_adapter_json(game_id: String) -> Result<String, String> {
    let adapter = load_game_adapters()?
        .into_iter()
        .find(|item| item.game_id == game_id)
        .ok_or_else(|| format!("adapter not found: {game_id}"))?;
    serde_json::to_string_pretty(&adapter).map_err(|err| format!("export adapter failed: {err}"))
}

fn validate_adapter(adapter: &GameAdapter) -> Result<(), String> {
    if adapter.game_id.trim().is_empty() {
        return Err("game_id is required".to_string());
    }
    if adapter.display_name.trim().is_empty() {
        return Err("display_name is required".to_string());
    }
    if adapter.default_ports.iter().any(|port| *port == 0) {
        return Err("default ports must be greater than 0".to_string());
    }
    Ok(())
}

fn writable_adapter_dir() -> Result<PathBuf, String> {
    for dir in candidate_adapter_dirs() {
        if dir.exists() {
            return Ok(dir);
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        return Ok(cwd.join("adapters").join("games"));
    }
    Err("cannot locate writable adapter directory".to_string())
}

fn sanitize_file_stem(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
            out.push(ch);
        } else if ch.is_whitespace() {
            out.push('_');
        }
    }
    if out.is_empty() {
        "game".to_string()
    } else {
        out
    }
}

fn load_game_adapters_from_dir(dir: &Path) -> Result<Vec<GameAdapter>, String> {
    let mut paths = Vec::new();
    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let path = entry.map_err(|err| err.to_string())?.path();
        if path.extension().and_then(|item| item.to_str()) == Some("json") {
            paths.push(path);
        }
    }
    paths.sort();

    let mut adapters: Vec<GameAdapter> = Vec::new();
    for path in paths {
        let content = fs::read_to_string(&path).map_err(|err| format!("read {:?} failed: {err}", path))?;
        let adapter: GameAdapter = serde_json::from_str(&content).map_err(|err| format!("parse {:?} failed: {err}", path))?;
        let is_custom = path
            .file_stem()
            .and_then(|item| item.to_str())
            .map(|stem| stem.starts_with("custom_"))
            .unwrap_or(false);

        if let Some(index) = adapters.iter().position(|item| item.game_id == adapter.game_id) {
            if is_custom {
                adapters[index] = adapter;
            }
        } else {
            adapters.push(adapter);
        }
    }
    Ok(adapters)
}

fn candidate_adapter_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        dirs.extend(adapter_dirs_from_ancestors(&cwd));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            dirs.extend(adapter_dirs_from_ancestors(parent));
        }
    }
    dedup_paths(dirs)
}

fn adapter_dirs_from_ancestors(start: &Path) -> Vec<PathBuf> {
    start
        .ancestors()
        .map(|ancestor| ancestor.join("adapters").join("games"))
        .collect()
}

fn dedup_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut result = Vec::new();
    for path in paths {
        if !result.contains(&path) {
            result.push(path);
        }
    }
    result
}

fn load_builtin_game_adapters() -> Result<Vec<GameAdapter>, String> {
    let builtin = [
        include_str!("../../../adapters/games/terraria.json"),
        include_str!("../../../adapters/games/stardew_valley.json"),
        include_str!("../../../adapters/games/minecraft_java.json"),
    ];

    builtin
        .into_iter()
        .map(|content| serde_json::from_str(content).map_err(|err| format!("parse builtin adapter failed: {err}")))
        .collect()
}
