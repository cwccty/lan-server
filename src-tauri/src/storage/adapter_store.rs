use std::fs;
use std::path::{Path, PathBuf};

use crate::models::game::GameAdapter;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistryIndex {
    pub version: Option<u32>,
    pub updated_at: Option<String>,
    pub games: Vec<AdapterRegistryGame>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistryGame {
    pub game_id: String,
    pub steam_appid: Option<String>,
    pub adapter_url: String,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistrySyncResult {
    pub ok: bool,
    pub registry_url: String,
    pub total: usize,
    pub created: usize,
    pub updated: usize,
    pub skipped: usize,
    pub hash_failed: usize,
    pub parse_failed: usize,
    pub fetch_failed: usize,
    pub validation_failed: usize,
    pub write_failed: usize,
    pub items: Vec<AdapterRegistrySyncItem>,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistrySyncItem {
    pub game_id: String,
    pub display_name: Option<String>,
    pub adapter_url: String,
    pub status: String,
    pub reason: String,
    pub expected_sha256: Option<String>,
    pub actual_sha256: Option<String>,
    pub saved_path: Option<String>,
}

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

pub fn save_game_adapter(mut adapter: GameAdapter) -> Result<GameAdapter, String> {
    validate_adapter(&adapter)?;
    let dir = writable_adapter_dir()?;
    fs::create_dir_all(&dir).map_err(|err| format!("create adapter dir failed: {err}"))?;
    let file_name = format!("custom_{}.json", sanitize_file_stem(&adapter.game_id));
    let path = dir.join(file_name);
    write_adapter(&path, &adapter)?;
    adapter.adapter_source = Some("custom".to_string());
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

pub fn sync_adapter_registry(registry_url: String) -> Result<AdapterRegistrySyncResult, String> {
    let registry_url = registry_url.trim().to_string();
    if registry_url.is_empty() {
        return Err("registry_url is required".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|err| format!("create HTTP client failed: {err}"))?;

    let index_text = client
        .get(&registry_url)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|err| format!("fetch registry index failed: {err}"))?
        .text()
        .map_err(|err| format!("read registry index failed: {err}"))?;

    let index: AdapterRegistryIndex =
        serde_json::from_str(&index_text).map_err(|err| format!("parse registry index failed: {err}"))?;
    let dir = writable_adapter_dir()?;
    fs::create_dir_all(&dir).map_err(|err| format!("create adapter dir failed: {err}"))?;

    let total = index.games.len();
    let mut created = 0usize;
    let mut updated = 0usize;
    let mut skipped = 0usize;
    let mut messages = Vec::new();
    let mut items = Vec::new();

    for game in index.games {
        let adapter_url = match resolve_registry_url(&registry_url, &game.adapter_url) {
            Ok(url) => url,
            Err(err) => {
                skipped += 1;
                messages.push(format!("skip {}: invalid adapter url: {err}", game.game_id));
                items.push(sync_item(
                    &game.game_id,
                    None,
                    &game.adapter_url,
                    "skipped_fetch_failed",
                    format!("invalid adapter url: {err}"),
                    game.sha256.clone(),
                    None,
                    None,
                ));
                continue;
            }
        };
        let adapter_text = match client
            .get(&adapter_url)
            .send()
            .and_then(|response| response.error_for_status())
        {
            Ok(response) => response
                .text()
                .map_err(|err| format!("read adapter {adapter_url} failed: {err}"))?,
            Err(err) => {
                skipped += 1;
                messages.push(format!("skip {}: fetch failed: {err}", game.game_id));
                items.push(sync_item(
                    &game.game_id,
                    None,
                    &adapter_url,
                    "skipped_fetch_failed",
                    format!("fetch failed: {err}"),
                    game.sha256.clone(),
                    None,
                    None,
                ));
                continue;
            }
        };

        let actual_hash = sha256_hex(adapter_text.as_bytes());
        if let Some(expected_hash) = game.sha256.as_ref().filter(|value| !value.trim().is_empty()) {
            if !actual_hash.eq_ignore_ascii_case(expected_hash.trim()) {
                skipped += 1;
                messages.push(format!("skip {}: sha256 mismatch", game.game_id));
                items.push(sync_item(
                    &game.game_id,
                    None,
                    &adapter_url,
                    "skipped_hash_failed",
                    "sha256 mismatch".to_string(),
                    game.sha256.clone(),
                    Some(actual_hash),
                    None,
                ));
                continue;
            }
        }

        let adapter: GameAdapter = match serde_json::from_str(&adapter_text) {
            Ok(adapter) => adapter,
            Err(err) => {
                skipped += 1;
                messages.push(format!("skip {}: parse failed: {err}", game.game_id));
                items.push(sync_item(
                    &game.game_id,
                    None,
                    &adapter_url,
                    "skipped_parse_failed",
                    format!("parse failed: {err}"),
                    game.sha256.clone(),
                    Some(actual_hash),
                    None,
                ));
                continue;
            }
        };
        if let Err(err) = validate_adapter(&adapter) {
            skipped += 1;
            messages.push(format!("skip {}: validation failed: {err}", game.game_id));
            items.push(sync_item(
                &game.game_id,
                Some(&adapter.display_name),
                &adapter_url,
                "skipped_validation_failed",
                format!("validation failed: {err}"),
                game.sha256.clone(),
                Some(actual_hash),
                None,
            ));
            continue;
        }

        let file_name = format!("registry_{}.json", sanitize_file_stem(&adapter.game_id));
        let path = dir.join(file_name);
        let existed = path.exists();
        if let Err(err) = write_adapter(&path, &adapter) {
            skipped += 1;
            messages.push(format!("skip {}: write failed: {err}", adapter.game_id));
            items.push(sync_item(
                &adapter.game_id,
                Some(&adapter.display_name),
                &adapter_url,
                "skipped_write_failed",
                format!("write failed: {err}"),
                game.sha256.clone(),
                Some(actual_hash),
                Some(path.to_string_lossy().to_string()),
            ));
            continue;
        }
        if existed {
            updated += 1;
            messages.push(format!("updated {}", adapter.game_id));
            items.push(sync_item(
                &adapter.game_id,
                Some(&adapter.display_name),
                &adapter_url,
                "updated",
                "registry adapter updated".to_string(),
                game.sha256.clone(),
                Some(actual_hash),
                Some(path.to_string_lossy().to_string()),
            ));
        } else {
            created += 1;
            messages.push(format!("created {}", adapter.game_id));
            items.push(sync_item(
                &adapter.game_id,
                Some(&adapter.display_name),
                &adapter_url,
                "created",
                "registry adapter created".to_string(),
                game.sha256.clone(),
                Some(actual_hash),
                Some(path.to_string_lossy().to_string()),
            ));
        }
    }

    let hash_failed = items.iter().filter(|item| item.status == "skipped_hash_failed").count();
    let parse_failed = items.iter().filter(|item| item.status == "skipped_parse_failed").count();
    let fetch_failed = items.iter().filter(|item| item.status == "skipped_fetch_failed").count();
    let validation_failed = items.iter().filter(|item| item.status == "skipped_validation_failed").count();
    let write_failed = items.iter().filter(|item| item.status == "skipped_write_failed").count();

    Ok(AdapterRegistrySyncResult {
        ok: skipped == 0,
        registry_url,
        total,
        created,
        updated,
        skipped,
        hash_failed,
        parse_failed,
        fetch_failed,
        validation_failed,
        write_failed,
        items,
        messages,
    })
}


pub fn sync_local_adapter_registry_example() -> Result<AdapterRegistrySyncResult, String> {
    let root = locate_local_registry_dir()?;
    sync_adapter_registry_from_dir(root)
}

pub fn sync_adapter_registry_from_dir(root: PathBuf) -> Result<AdapterRegistrySyncResult, String> {
    let index_path = root.join("index.json");
    let index_text = fs::read_to_string(&index_path).map_err(|err| format!("read {:?} failed: {err}", index_path))?;
    let index: AdapterRegistryIndex =
        serde_json::from_str(&index_text).map_err(|err| format!("parse {:?} failed: {err}", index_path))?;
    let dir = writable_adapter_dir()?;
    fs::create_dir_all(&dir).map_err(|err| format!("create adapter dir failed: {err}"))?;

    let total = index.games.len();
    let mut created = 0usize;
    let mut updated = 0usize;
    let mut skipped = 0usize;
    let mut messages = Vec::new();
    let mut items = Vec::new();

    for game in index.games {
        let adapter_path = root.join(&game.adapter_url);
        let adapter_url = adapter_path.to_string_lossy().to_string();
        let adapter_text = match fs::read_to_string(&adapter_path) {
            Ok(content) => content,
            Err(err) => {
                skipped += 1;
                messages.push(format!("skip {}: read failed: {err}", game.game_id));
                items.push(sync_item(
                    &game.game_id,
                    None,
                    &adapter_url,
                    "skipped_fetch_failed",
                    format!("read failed: {err}"),
                    game.sha256.clone(),
                    None,
                    None,
                ));
                continue;
            }
        };

        let actual_hash = sha256_hex(adapter_text.as_bytes());
        if let Some(expected_hash) = game.sha256.as_ref().filter(|value| !value.trim().is_empty()) {
            if !actual_hash.eq_ignore_ascii_case(expected_hash.trim()) {
                skipped += 1;
                messages.push(format!("skip {}: sha256 mismatch", game.game_id));
                items.push(sync_item(
                    &game.game_id,
                    None,
                    &adapter_url,
                    "skipped_hash_failed",
                    "sha256 mismatch".to_string(),
                    game.sha256.clone(),
                    Some(actual_hash),
                    None,
                ));
                continue;
            }
        }

        let adapter: GameAdapter = match serde_json::from_str(&adapter_text) {
            Ok(adapter) => adapter,
            Err(err) => {
                skipped += 1;
                messages.push(format!("skip {}: parse failed: {err}", game.game_id));
                items.push(sync_item(
                    &game.game_id,
                    None,
                    &adapter_url,
                    "skipped_parse_failed",
                    format!("parse failed: {err}"),
                    game.sha256.clone(),
                    Some(actual_hash),
                    None,
                ));
                continue;
            }
        };
        if let Err(err) = validate_adapter(&adapter) {
            skipped += 1;
            messages.push(format!("skip {}: validation failed: {err}", game.game_id));
            items.push(sync_item(
                &game.game_id,
                Some(&adapter.display_name),
                &adapter_url,
                "skipped_validation_failed",
                format!("validation failed: {err}"),
                game.sha256.clone(),
                Some(actual_hash),
                None,
            ));
            continue;
        }
        let file_name = format!("registry_{}.json", sanitize_file_stem(&adapter.game_id));
        let path = dir.join(file_name);
        let existed = path.exists();
        if let Err(err) = write_adapter(&path, &adapter) {
            skipped += 1;
            messages.push(format!("skip {}: write failed: {err}", adapter.game_id));
            items.push(sync_item(
                &adapter.game_id,
                Some(&adapter.display_name),
                &adapter_url,
                "skipped_write_failed",
                format!("write failed: {err}"),
                game.sha256.clone(),
                Some(actual_hash),
                Some(path.to_string_lossy().to_string()),
            ));
            continue;
        }
        if existed {
            updated += 1;
            messages.push(format!("updated {}", adapter.game_id));
            items.push(sync_item(
                &adapter.game_id,
                Some(&adapter.display_name),
                &adapter_url,
                "updated",
                "registry adapter updated".to_string(),
                game.sha256.clone(),
                Some(actual_hash),
                Some(path.to_string_lossy().to_string()),
            ));
        } else {
            created += 1;
            messages.push(format!("created {}", adapter.game_id));
            items.push(sync_item(
                &adapter.game_id,
                Some(&adapter.display_name),
                &adapter_url,
                "created",
                "registry adapter created".to_string(),
                game.sha256.clone(),
                Some(actual_hash),
                Some(path.to_string_lossy().to_string()),
            ));
        }
    }

    let hash_failed = items.iter().filter(|item| item.status == "skipped_hash_failed").count();
    let parse_failed = items.iter().filter(|item| item.status == "skipped_parse_failed").count();
    let fetch_failed = items.iter().filter(|item| item.status == "skipped_fetch_failed").count();
    let validation_failed = items.iter().filter(|item| item.status == "skipped_validation_failed").count();
    let write_failed = items.iter().filter(|item| item.status == "skipped_write_failed").count();

    Ok(AdapterRegistrySyncResult {
        ok: skipped == 0,
        registry_url: index_path.to_string_lossy().to_string(),
        total,
        created,
        updated,
        skipped,
        hash_failed,
        parse_failed,
        fetch_failed,
        validation_failed,
        write_failed,
        items,
        messages,
    })
}

fn sync_item(
    game_id: &str,
    display_name: Option<&str>,
    adapter_url: &str,
    status: &str,
    reason: String,
    expected_sha256: Option<String>,
    actual_sha256: Option<String>,
    saved_path: Option<String>,
) -> AdapterRegistrySyncItem {
    AdapterRegistrySyncItem {
        game_id: game_id.to_string(),
        display_name: display_name.map(|value| value.to_string()),
        adapter_url: adapter_url.to_string(),
        status: status.to_string(),
        reason,
        expected_sha256,
        actual_sha256,
        saved_path,
    }
}

fn locate_local_registry_dir() -> Result<PathBuf, String> {
    let mut starts = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        starts.push(cwd);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            starts.push(parent.to_path_buf());
        }
    }

    for start in starts {
        for ancestor in start.ancestors() {
            let candidate = ancestor.join("adapter-registry");
            if candidate.join("index.json").exists() {
                return Ok(candidate);
            }
        }
    }
    Err("local adapter-registry/index.json not found".to_string())
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

fn write_adapter(path: &Path, adapter: &GameAdapter) -> Result<(), String> {
    let mut persisted = adapter.clone();
    persisted.adapter_source = None;
    let content = serde_json::to_string_pretty(&persisted).map_err(|err| format!("serialize adapter failed: {err}"))?;
    fs::write(path, format!("{content}\n")).map_err(|err| format!("write {:?} failed: {err}", path))
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

    let mut adapters: Vec<(GameAdapter, u8)> = Vec::new();
    for path in paths {
        let content = fs::read_to_string(&path).map_err(|err| format!("read {:?} failed: {err}", path))?;
        let mut adapter: GameAdapter =
            serde_json::from_str(&content).map_err(|err| format!("parse {:?} failed: {err}", path))?;
        let priority = adapter_file_priority(&path);
        adapter.adapter_source = Some(adapter_file_source(&path).to_string());

        if let Some(index) = adapters
            .iter()
            .position(|(item, _)| item.game_id == adapter.game_id)
        {
            if priority >= adapters[index].1 {
                adapters[index] = (adapter, priority);
            }
        } else {
            adapters.push((adapter, priority));
        }
    }
    Ok(adapters.into_iter().map(|(adapter, _)| adapter).collect())
}

fn adapter_file_source(path: &Path) -> &'static str {
    path.file_stem()
        .and_then(|item| item.to_str())
        .map(|stem| {
            if stem.starts_with("custom_") {
                "custom"
            } else if stem.starts_with("registry_") {
                "registry"
            } else {
                "builtin"
            }
        })
        .unwrap_or("builtin")
}

fn adapter_file_priority(path: &Path) -> u8 {
    path.file_stem()
        .and_then(|item| item.to_str())
        .map(|stem| {
            if stem.starts_with("custom_") {
                3
            } else if stem.starts_with("registry_") {
                2
            } else {
                1
            }
        })
        .unwrap_or(1)
}

fn resolve_registry_url(index_url: &str, adapter_url: &str) -> Result<String, String> {
    if adapter_url.starts_with("http://") || adapter_url.starts_with("https://") {
        return Ok(adapter_url.to_string());
    }
    let base = reqwest::Url::parse(index_url).map_err(|err| format!("invalid registry URL: {err}"))?;
    base.join(adapter_url)
        .map(|url| url.to_string())
        .map_err(|err| format!("invalid adapter URL {adapter_url}: {err}"))
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
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
        .map(|content| {
            let mut adapter: GameAdapter =
                serde_json::from_str(content).map_err(|err| format!("parse builtin adapter failed: {err}"))?;
            adapter.adapter_source = Some("builtin".to_string());
            Ok(adapter)
        })
        .collect()
}
