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

fn load_game_adapters_from_dir(dir: &Path) -> Result<Vec<GameAdapter>, String> {
    let mut adapters = Vec::new();
    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let path = entry.map_err(|err| err.to_string())?.path();
        if path.extension().and_then(|item| item.to_str()) == Some("json") {
            let content = fs::read_to_string(&path).map_err(|err| format!("读取 {:?} 失败: {err}", path))?;
            let adapter: GameAdapter =
                serde_json::from_str(&content).map_err(|err| format!("解析 {:?} 失败: {err}", path))?;
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
        .map(|content| serde_json::from_str(content).map_err(|err| format!("解析内置游戏适配失败: {err}")))
        .collect()
}
