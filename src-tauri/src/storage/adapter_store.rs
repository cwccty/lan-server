use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::game::GameAdapter;
use chrono::Local;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistryIndex {
    pub version: Option<u32>,
    pub updated_at: Option<String>,
    pub description: Option<String>,
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
    pub registry_version: Option<u32>,
    pub registry_updated_at: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistryLocalPublishResult {
    pub ok: bool,
    pub registry_dir: String,
    pub games_dir: String,
    pub index_path: String,
    pub total: usize,
    pub written: usize,
    pub created: usize,
    pub updated: usize,
    pub unchanged: usize,
    pub verified: bool,
    pub index_game_count: usize,
    pub entries: Vec<AdapterRegistryLocalPublishEntry>,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistryLocalPublishEntry {
    pub game_id: String,
    pub display_name: String,
    pub adapter_path: String,
    pub adapter_url: String,
    pub sha256: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterVariantInfo {
    pub game_id: String,
    pub display_name: String,
    pub source: String,
    pub path: String,
    pub priority: u8,
    pub fingerprint: String,
    pub short_fingerprint: String,
    pub network_type: Option<String>,
    pub default_ports: Vec<u16>,
    pub modified_at: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterConflictReport {
    pub game_id: String,
    pub display_name: String,
    pub active_source: String,
    pub active_path: String,
    pub active_fingerprint: String,
    pub has_conflict: bool,
    pub variants: Vec<AdapterVariantInfo>,
    pub summary: String,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistrySyncPreview {
    pub ok: bool,
    pub registry_url: String,
    pub registry_version: Option<u32>,
    pub registry_updated_at: Option<String>,
    pub total: usize,
    pub will_create: usize,
    pub will_update: usize,
    pub unchanged: usize,
    pub custom_protected: usize,
    pub would_affect_active: usize,
    pub possible_conflicts: usize,
    pub skipped: usize,
    pub items: Vec<AdapterRegistryPreviewItem>,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterRegistryPreviewItem {
    pub game_id: String,
    pub display_name: Option<String>,
    pub adapter_url: String,
    pub status: String,
    pub reason: String,
    pub expected_sha256: Option<String>,
    pub actual_sha256: Option<String>,
    pub local_sources: Vec<String>,
    pub active_source: Option<String>,
    pub has_custom: bool,
    pub has_registry: bool,
    pub would_write_registry: bool,
    pub would_affect_active: bool,
    pub conflict_with_custom: bool,
    pub saved_path: Option<String>,
    pub diff_fields: Vec<AdapterChangeDiffField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterChangeDiffField {
    pub field: String,
    pub label: String,
    pub before: String,
    pub after: String,
    pub changed: bool,
    pub affects_recommendation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdapterBackupEntry {
    pub id: String,
    pub game_id: String,
    pub display_name: String,
    pub source: String,
    pub reason: String,
    pub original_path: String,
    pub backup_path: String,
    pub metadata_path: String,
    pub created_at: String,
    pub fingerprint: String,
    pub short_fingerprint: String,
    pub size_bytes: u64,
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


pub fn list_adapter_conflicts() -> Result<Vec<AdapterConflictReport>, String> {
    let entries = load_adapter_variant_entries()?;
    let mut grouped: BTreeMap<String, Vec<(GameAdapter, AdapterVariantInfo)>> = BTreeMap::new();

    for entry in entries {
        grouped.entry(entry.0.game_id.clone()).or_default().push(entry);
    }

    let mut reports = Vec::new();
    for (game_id, mut group) in grouped {
        group.sort_by(|a, b| {
            b.1.priority
                .cmp(&a.1.priority)
                .then_with(|| a.1.source.cmp(&b.1.source))
                .then_with(|| a.1.path.cmp(&b.1.path))
        });
        let active = group
            .first()
            .ok_or_else(|| format!("adapter group empty: {game_id}"))?
            .clone();
        let active_fingerprint = active.1.fingerprint.clone();
        let active_source = active.1.source.clone();
        let active_path = active.1.path.clone();
        let display_name = active.0.display_name.clone();

        let fingerprints: HashSet<String> = group.iter().map(|(_, variant)| variant.fingerprint.clone()).collect();
        let has_conflict = group.len() > 1 && fingerprints.len() > 1;
        let sources: Vec<String> = group.iter().map(|(_, variant)| variant.source.clone()).collect();
        let has_custom = sources.iter().any(|source| source == "custom");
        let has_registry = sources.iter().any(|source| source == "registry");

        let mut variants: Vec<AdapterVariantInfo> = group
            .into_iter()
            .map(|(_, mut variant)| {
                variant.is_active = variant.fingerprint == active_fingerprint && variant.source == active_source && variant.path == active_path;
                variant
            })
            .collect();
        variants.sort_by(|a, b| {
            b.priority
                .cmp(&a.priority)
                .then_with(|| a.source.cmp(&b.source))
                .then_with(|| a.path.cmp(&b.path))
        });

        let summary = if has_conflict {
            format!(
                "发现 {} 个来源版本不一致，当前按优先级使用 {}。",
                variants.len(),
                source_display_label(&active_source)
            )
        } else if variants.len() > 1 {
            format!(
                "发现 {} 个来源版本，但内容指纹一致，当前使用 {}。",
                variants.len(),
                source_display_label(&active_source)
            )
        } else {
            format!("单一来源：{}。", source_display_label(&active_source))
        };

        let recommendation = if has_conflict && has_custom && has_registry {
            "建议先导出当前生效方案备份；如果自建方案是管理员确认过的，选择保留当前为自建；如果共享库更可信，再用共享库覆盖自建。".to_string()
        } else if has_conflict && has_registry {
            "共享库与内置/本地方案不一致。建议先导出备份，再把当前生效方案固定为自建，或继续以共享库为准。".to_string()
        } else if has_conflict {
            "多个本地来源不一致。建议导出备份后，只保留管理员确认过的版本。".to_string()
        } else if variants.len() > 1 {
            "多个来源已一致，无需处理；后续同步仍会按 custom > registry > builtin 优先级选择。".to_string()
        } else {
            "暂无版本冲突。".to_string()
        };

        reports.push(AdapterConflictReport {
            game_id,
            display_name,
            active_source,
            active_path,
            active_fingerprint,
            has_conflict,
            variants,
            summary,
            recommendation,
        });
    }

    Ok(reports)
}

pub fn promote_registry_adapter_to_custom(game_id: String) -> Result<GameAdapter, String> {
    let entries = load_adapter_variant_entries()?;
    let registry = entries
        .into_iter()
        .find(|(adapter, variant)| adapter.game_id == game_id && variant.source == "registry")
        .map(|(adapter, _)| adapter)
        .ok_or_else(|| format!("registry adapter not found for {game_id}"))?;
    save_game_adapter(registry)
}

pub fn pin_active_adapter_as_custom(game_id: String) -> Result<GameAdapter, String> {
    let mut entries: Vec<(GameAdapter, AdapterVariantInfo)> = load_adapter_variant_entries()?
        .into_iter()
        .filter(|(adapter, _)| adapter.game_id == game_id)
        .collect();
    if entries.is_empty() {
        return Err(format!("adapter not found: {game_id}"));
    }
    entries.sort_by(|a, b| {
        b.1.priority
            .cmp(&a.1.priority)
            .then_with(|| a.1.source.cmp(&b.1.source))
            .then_with(|| a.1.path.cmp(&b.1.path))
    });
    let active = entries
        .into_iter()
        .next()
        .map(|(adapter, _)| adapter)
        .ok_or_else(|| format!("adapter not found: {game_id}"))?;
    save_game_adapter(active)
}

pub fn save_game_adapter(mut adapter: GameAdapter) -> Result<GameAdapter, String> {
    validate_adapter(&adapter)?;
    let dir = writable_adapter_dir()?;
    fs::create_dir_all(&dir).map_err(|err| format!("create adapter dir failed: {err}"))?;
    let file_name = format!("custom_{}.json", sanitize_file_stem(&adapter.game_id));
    let path = dir.join(file_name);
    let _ = backup_existing_adapter_if_changed(&path, &adapter, "save_custom_adapter")?;
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

pub fn publish_adapters_to_local_registry(game_ids: Vec<String>) -> Result<AdapterRegistryLocalPublishResult, String> {
    let mut normalized_ids = Vec::new();
    for game_id in game_ids {
        let trimmed = game_id.trim().to_string();
        if !trimmed.is_empty() && !normalized_ids.contains(&trimmed) {
            normalized_ids.push(trimmed);
        }
    }
    if normalized_ids.is_empty() {
        return Err("game_ids is required".to_string());
    }

    let root = locate_local_registry_dir()?;
    let games_dir = root.join("games");
    fs::create_dir_all(&games_dir).map_err(|err| format!("create local registry games dir failed: {err}"))?;

    let adapters = load_game_adapters()?;
    let mut adapter_by_id: BTreeMap<String, GameAdapter> = BTreeMap::new();
    for adapter in adapters {
        adapter_by_id.insert(adapter.game_id.clone(), adapter);
    }

    let mut entries = Vec::new();
    let mut messages = Vec::new();
    let mut created = 0usize;
    let mut updated = 0usize;
    let mut unchanged = 0usize;

    for game_id in normalized_ids {
        let adapter = adapter_by_id
            .get(&game_id)
            .cloned()
            .ok_or_else(|| format!("adapter not found: {game_id}"))?;
        validate_adapter(&adapter)?;

        let file_name = format!("{}.json", sanitize_file_stem(&adapter.game_id));
        let adapter_path = games_dir.join(&file_name);
        let adapter_url = format!("games/{file_name}");
        let mut persisted = adapter.clone();
        persisted.adapter_source = None;
        let content = serde_json::to_string_pretty(&persisted)
            .map_err(|err| format!("serialize adapter {} failed: {err}", adapter.game_id))?;
        let content = format!("{content}\n");
        let sha256 = sha256_hex(content.as_bytes());

        let status = if adapter_path.exists() {
            let previous = fs::read_to_string(&adapter_path)
                .map_err(|err| format!("read existing registry adapter {:?} failed: {err}", adapter_path))?;
            if previous == content {
                unchanged += 1;
                "unchanged"
            } else {
                fs::write(&adapter_path, content.as_bytes())
                    .map_err(|err| format!("write registry adapter {:?} failed: {err}", adapter_path))?;
                updated += 1;
                "updated"
            }
        } else {
            fs::write(&adapter_path, content.as_bytes())
                .map_err(|err| format!("write registry adapter {:?} failed: {err}", adapter_path))?;
            created += 1;
            "created"
        };

        messages.push(format!("{status} {} -> {}", adapter.game_id, adapter_url));
        entries.push(AdapterRegistryLocalPublishEntry {
            game_id: adapter.game_id,
            display_name: adapter.display_name,
            adapter_path: adapter_path.to_string_lossy().to_string(),
            adapter_url,
            sha256,
            status: status.to_string(),
        });
    }

    let index_games = rebuild_local_adapter_registry_index(&root)?;
    let verify_messages = verify_local_adapter_registry_index(&root)?;
    messages.push(format!("rebuilt adapter-registry/index.json with {} entries", index_games.len()));
    messages.extend(verify_messages);

    let written = created + updated;
    Ok(AdapterRegistryLocalPublishResult {
        ok: true,
        registry_dir: root.to_string_lossy().to_string(),
        games_dir: games_dir.to_string_lossy().to_string(),
        index_path: root.join("index.json").to_string_lossy().to_string(),
        total: entries.len(),
        written,
        created,
        updated,
        unchanged,
        verified: true,
        index_game_count: index_games.len(),
        entries,
        messages,
    })
}

pub fn list_adapter_backups() -> Result<Vec<AdapterBackupEntry>, String> {
    let dir = adapter_backup_dir()?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|err| format!("read backup dir failed: {err}"))? {
        let path = entry.map_err(|err| err.to_string())?.path();
        let is_meta = path
            .file_name()
            .and_then(|item| item.to_str())
            .map(|name| name.ends_with(".meta.json"))
            .unwrap_or(false);
        if !is_meta {
            continue;
        }
        let content = fs::read_to_string(&path).map_err(|err| format!("read backup metadata {:?} failed: {err}", path))?;
        let backup: AdapterBackupEntry =
            serde_json::from_str(&content).map_err(|err| format!("parse backup metadata {:?} failed: {err}", path))?;
        backups.push(backup);
    }
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at).then_with(|| b.id.cmp(&a.id)));
    Ok(backups)
}

pub fn restore_adapter_backup(backup_id: String) -> Result<GameAdapter, String> {
    let backup = list_adapter_backups()?
        .into_iter()
        .find(|entry| entry.id == backup_id)
        .ok_or_else(|| format!("adapter backup not found: {backup_id}"))?;
    let backup_path = PathBuf::from(&backup.backup_path);
    if !backup_path.exists() {
        return Err(format!("backup file missing: {}", backup.backup_path));
    }
    let original_path = PathBuf::from(&backup.original_path);
    ensure_adapter_target_path(&original_path)?;

    if original_path.exists() {
        let _ = backup_existing_adapter_file(&original_path, "restore_before_overwrite");
    }

    if let Some(parent) = original_path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("create restore dir failed: {err}"))?;
    }
    fs::copy(&backup_path, &original_path)
        .map_err(|err| format!("restore adapter backup failed: {err}"))?;

    let restored_text = fs::read_to_string(&original_path)
        .map_err(|err| format!("read restored adapter failed: {err}"))?;
    let mut adapter: GameAdapter =
        serde_json::from_str(&restored_text).map_err(|err| format!("parse restored adapter failed: {err}"))?;
    adapter.adapter_source = Some(adapter_file_source(&original_path).to_string());
    Ok(adapter)
}

pub fn preview_adapter_registry_sync(registry_url: String) -> Result<AdapterRegistrySyncPreview, String> {
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
    let registry_version = index.version;
    let registry_updated_at = index.updated_at.clone();
    let local_by_game = group_adapter_entries_by_game(load_adapter_variant_entries()?);
    let dir = writable_adapter_dir()?;

    let total = index.games.len();
    let mut items = Vec::new();
    let mut messages = Vec::new();

    for game in index.games {
        let adapter_url = match resolve_registry_url(&registry_url, &game.adapter_url) {
            Ok(url) => url,
            Err(err) => {
                messages.push(format!("preview skip {}: invalid adapter url: {err}", game.game_id));
                items.push(preview_item(
                    &game.game_id,
                    None,
                    &game.adapter_url,
                    "skipped_fetch_failed",
                    format!("invalid adapter url: {err}"),
                    game.sha256.clone(),
                    None,
                    Vec::new(),
                    None,
                    false,
                    false,
                    false,
                    false,
                    false,
                    None,
                    Vec::new(),
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
                messages.push(format!("preview skip {}: fetch failed: {err}", game.game_id));
                items.push(preview_item(
                    &game.game_id,
                    None,
                    &adapter_url,
                    "skipped_fetch_failed",
                    format!("fetch failed: {err}"),
                    game.sha256.clone(),
                    None,
                    Vec::new(),
                    None,
                    false,
                    false,
                    false,
                    false,
                    false,
                    None,
                    Vec::new(),
                ));
                continue;
            }
        };

        let actual_hash = sha256_hex(adapter_text.as_bytes());
        if let Some(expected_hash) = game.sha256.as_ref().filter(|value| !value.trim().is_empty()) {
            if !actual_hash.eq_ignore_ascii_case(expected_hash.trim()) {
                messages.push(format!("preview skip {}: sha256 mismatch", game.game_id));
                items.push(preview_item(
                    &game.game_id,
                    None,
                    &adapter_url,
                    "skipped_hash_failed",
                    "sha256 mismatch".to_string(),
                    game.sha256.clone(),
                    Some(actual_hash),
                    Vec::new(),
                    None,
                    false,
                    false,
                    false,
                    false,
                    false,
                    None,
                    Vec::new(),
                ));
                continue;
            }
        }

        let adapter: GameAdapter = match serde_json::from_str(&adapter_text) {
            Ok(adapter) => adapter,
            Err(err) => {
                messages.push(format!("preview skip {}: parse failed: {err}", game.game_id));
                items.push(preview_item(
                    &game.game_id,
                    None,
                    &adapter_url,
                    "skipped_parse_failed",
                    format!("parse failed: {err}"),
                    game.sha256.clone(),
                    Some(actual_hash),
                    Vec::new(),
                    None,
                    false,
                    false,
                    false,
                    false,
                    false,
                    None,
                    Vec::new(),
                ));
                continue;
            }
        };

        if let Err(err) = validate_adapter(&adapter) {
            messages.push(format!("preview skip {}: validation failed: {err}", game.game_id));
            items.push(preview_item(
                &game.game_id,
                Some(&adapter.display_name),
                &adapter_url,
                "skipped_validation_failed",
                format!("validation failed: {err}"),
                game.sha256.clone(),
                Some(actual_hash),
                Vec::new(),
                None,
                false,
                false,
                false,
                false,
                false,
                None,
                Vec::new(),
            ));
            continue;
        }

        let remote_fingerprint = adapter_fingerprint(&adapter)?;
        let local_entries = local_by_game.get(&adapter.game_id).cloned().unwrap_or_default();
        let variants: Vec<AdapterVariantInfo> = local_entries.iter().map(|(_, variant)| variant.clone()).collect();
        let active = local_entries
            .iter()
            .max_by(|a, b| {
                a.1.priority
                    .cmp(&b.1.priority)
                    .then_with(|| b.1.source.cmp(&a.1.source))
                    .then_with(|| b.1.path.cmp(&a.1.path))
            });
        let active_source = active.map(|(_, variant)| variant.source.clone());
        let active_adapter = active.map(|(local_adapter, _)| local_adapter);
        let local_sources = sorted_unique_sources(&variants);
        let has_custom = variants.iter().any(|variant| variant.source == "custom");
        let has_registry = variants.iter().any(|variant| variant.source == "registry");
        let registry_variant = variants.iter().find(|variant| variant.source == "registry");
        let registry_changed = registry_variant
            .map(|variant| variant.fingerprint != remote_fingerprint)
            .unwrap_or(true);
        let conflict_with_custom = variants
            .iter()
            .any(|variant| variant.source == "custom" && variant.fingerprint != remote_fingerprint);
        let would_write_registry = registry_changed;
        let would_affect_active = would_write_registry && !has_custom;
        let saved_path = Some(
            dir.join(format!("registry_{}.json", sanitize_file_stem(&adapter.game_id)))
                .to_string_lossy()
                .to_string(),
        );
        let diff_fields = adapter_change_diff_fields(active_adapter, &adapter)?;

        let (status, reason) = if conflict_with_custom {
            (
                "custom_conflict",
                "共享库版本与本地自建方案不同；同步只会写 registry 文件，不会直接覆盖 custom，但推荐结果仍以 custom 优先。".to_string(),
            )
        } else if !has_registry {
            (
                "will_create_registry",
                if has_custom {
                    "将新增 registry 文件；当前 custom 仍保持优先。".to_string()
                } else {
                    "将新增 registry 文件，后续可直接用于推荐。".to_string()
                },
            )
        } else if registry_changed {
            (
                "will_update_registry",
                if has_custom {
                    "将更新 registry 文件；当前 custom 仍保持优先。".to_string()
                } else {
                    "将更新当前生效的 registry 方案。".to_string()
                },
            )
        } else if has_custom {
            (
                "custom_protected",
                "共享库与现有 registry 一致，且 custom 仍保持优先。".to_string(),
            )
        } else {
            ("unchanged_registry", "本地 registry 已是同一版本。".to_string())
        };

        items.push(preview_item(
            &adapter.game_id,
            Some(&adapter.display_name),
            &adapter_url,
            status,
            reason,
            game.sha256.clone(),
            Some(actual_hash),
            local_sources,
            active_source,
            has_custom,
            has_registry,
            would_write_registry,
            would_affect_active,
            conflict_with_custom,
            saved_path,
            diff_fields,
        ));
    }

    let will_create = items.iter().filter(|item| item.status == "will_create_registry").count();
    let will_update = items.iter().filter(|item| item.status == "will_update_registry").count();
    let unchanged = items.iter().filter(|item| item.status == "unchanged_registry" || item.status == "custom_protected").count();
    let custom_protected = items.iter().filter(|item| item.has_custom).count();
    let would_affect_active = items.iter().filter(|item| item.would_affect_active).count();
    let possible_conflicts = items.iter().filter(|item| item.conflict_with_custom).count();
    let skipped = items.iter().filter(|item| item.status.starts_with("skipped_")).count();

    Ok(AdapterRegistrySyncPreview {
        ok: skipped == 0,
        registry_url,
        registry_version,
        registry_updated_at,
        total,
        will_create,
        will_update,
        unchanged,
        custom_protected,
        would_affect_active,
        possible_conflicts,
        skipped,
        items,
        messages,
    })
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
    let registry_version = index.version;
    let registry_updated_at = index.updated_at.clone();
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
        let _ = backup_existing_adapter_if_changed(&path, &adapter, "sync_remote_registry")?;
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
        registry_version,
        registry_updated_at,
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
    let registry_version = index.version;
    let registry_updated_at = index.updated_at.clone();
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
        let _ = backup_existing_adapter_if_changed(&path, &adapter, "sync_local_registry")?;
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
        registry_version,
        registry_updated_at,
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


fn load_adapter_variant_entries() -> Result<Vec<(GameAdapter, AdapterVariantInfo)>, String> {
    for dir in candidate_adapter_dirs() {
        if dir.exists() {
            let variants = load_adapter_variant_entries_from_dir(&dir)?;
            if !variants.is_empty() {
                return Ok(variants);
            }
        }
    }

    let mut variants = Vec::new();
    for adapter in load_builtin_game_adapters()? {
        let path = format!("builtin:{}", adapter.game_id);
        let variant = build_adapter_variant_info(&adapter, "builtin", &path, 1, None)?;
        variants.push((adapter, variant));
    }
    Ok(variants)
}

fn load_adapter_variant_entries_from_dir(dir: &Path) -> Result<Vec<(GameAdapter, AdapterVariantInfo)>, String> {
    let mut paths = Vec::new();
    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let path = entry.map_err(|err| err.to_string())?.path();
        if path.extension().and_then(|item| item.to_str()) == Some("json") {
            paths.push(path);
        }
    }
    paths.sort();

    let mut variants = Vec::new();
    for path in paths {
        let content = fs::read_to_string(&path).map_err(|err| format!("read {:?} failed: {err}", path))?;
        let mut adapter: GameAdapter =
            serde_json::from_str(&content).map_err(|err| format!("parse {:?} failed: {err}", path))?;
        let source = adapter_file_source(&path).to_string();
        let priority = adapter_file_priority(&path);
        adapter.adapter_source = Some(source.clone());
        let modified_at = file_modified_at(&path);
        let path_text = path.to_string_lossy().to_string();
        let variant = build_adapter_variant_info(&adapter, &source, &path_text, priority, modified_at)?;
        variants.push((adapter, variant));
    }
    Ok(variants)
}

fn build_adapter_variant_info(
    adapter: &GameAdapter,
    source: &str,
    path: &str,
    priority: u8,
    modified_at: Option<String>,
) -> Result<AdapterVariantInfo, String> {
    let fingerprint = adapter_fingerprint(adapter)?;
    let short_fingerprint = fingerprint.chars().take(12).collect();
    Ok(AdapterVariantInfo {
        game_id: adapter.game_id.clone(),
        display_name: adapter.display_name.clone(),
        source: source.to_string(),
        path: path.to_string(),
        priority,
        fingerprint,
        short_fingerprint,
        network_type: network_type_string(adapter),
        default_ports: adapter.default_ports.clone(),
        modified_at,
        is_active: false,
    })
}

fn adapter_fingerprint(adapter: &GameAdapter) -> Result<String, String> {
    let mut canonical = adapter.clone();
    canonical.adapter_source = None;
    let bytes = serde_json::to_vec(&canonical).map_err(|err| format!("hash adapter failed: {err}"))?;
    Ok(sha256_hex(&bytes))
}

fn network_type_string(adapter: &GameAdapter) -> Option<String> {
    adapter
        .network_type
        .as_ref()
        .and_then(|value| serde_json::to_value(value).ok())
        .and_then(|value| value.as_str().map(|item| item.to_string()))
}

fn file_modified_at(path: &Path) -> Option<String> {
    fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs().to_string())
}

fn source_display_label(source: &str) -> &'static str {
    match source {
        "custom" => "自建方案",
        "registry" => "共享库方案",
        "builtin" => "内置方案",
        "steam_scan" => "Steam 扫描方案",
        _ => "未知来源",
    }
}

fn backup_existing_adapter_if_changed(path: &Path, next_adapter: &GameAdapter, reason: &str) -> Result<Option<AdapterBackupEntry>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let current_text = fs::read_to_string(path).map_err(|err| format!("read current adapter for backup failed: {err}"))?;
    let current_adapter: GameAdapter =
        serde_json::from_str(&current_text).map_err(|err| format!("parse current adapter for backup failed: {err}"))?;
    if adapter_fingerprint(&current_adapter)? == adapter_fingerprint(next_adapter)? {
        return Ok(None);
    }
    backup_existing_adapter_file(path, reason)
}

fn backup_existing_adapter_file(path: &Path, reason: &str) -> Result<Option<AdapterBackupEntry>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|err| format!("read adapter before backup failed: {err}"))?;
    let mut adapter: GameAdapter =
        serde_json::from_str(&content).map_err(|err| format!("parse adapter before backup failed: {err}"))?;
    let source = adapter_file_source(path).to_string();
    adapter.adapter_source = Some(source.clone());
    let fingerprint = adapter_fingerprint(&adapter)?;
    let short_fingerprint: String = fingerprint.chars().take(12).collect();
    let created_at = current_unix_timestamp();
    let file_stem = path
        .file_stem()
        .and_then(|item| item.to_str())
        .unwrap_or("adapter");
    let id = format!(
        "{}_{}_{}_{}",
        created_at,
        sanitize_file_stem(reason),
        sanitize_file_stem(file_stem),
        short_fingerprint
    );
    let dir = adapter_backup_dir()?;
    fs::create_dir_all(&dir).map_err(|err| format!("create adapter backup dir failed: {err}"))?;
    let backup_path = dir.join(format!("{id}.json"));
    let metadata_path = dir.join(format!("{id}.meta.json"));
    fs::write(&backup_path, &content).map_err(|err| format!("write adapter backup failed: {err}"))?;

    let entry = AdapterBackupEntry {
        id,
        game_id: adapter.game_id.clone(),
        display_name: adapter.display_name.clone(),
        source,
        reason: reason.to_string(),
        original_path: path.to_string_lossy().to_string(),
        backup_path: backup_path.to_string_lossy().to_string(),
        metadata_path: metadata_path.to_string_lossy().to_string(),
        created_at,
        fingerprint,
        short_fingerprint,
        size_bytes: content.len() as u64,
    };
    let metadata = serde_json::to_string_pretty(&entry).map_err(|err| format!("serialize adapter backup metadata failed: {err}"))?;
    fs::write(&metadata_path, format!("{metadata}\n")).map_err(|err| format!("write adapter backup metadata failed: {err}"))?;
    Ok(Some(entry))
}

fn adapter_backup_dir() -> Result<PathBuf, String> {
    let adapter_dir = writable_adapter_dir()?;
    if let Some(root) = adapter_dir.parent().and_then(|parent| parent.parent()) {
        return Ok(root.join("backups").join("adapters"));
    }
    Ok(adapter_dir.join("backups"))
}

fn ensure_adapter_target_path(target: &Path) -> Result<(), String> {
    let parent = target
        .parent()
        .ok_or_else(|| format!("invalid restore target: {:?}", target))?;
    let parent_canonical = fs::canonicalize(parent).map_err(|err| format!("restore target parent is not accessible: {err}"))?;
    for dir in candidate_adapter_dirs() {
        if !dir.exists() {
            continue;
        }
        let dir_canonical = fs::canonicalize(&dir).map_err(|err| format!("canonicalize adapter dir {:?} failed: {err}", dir))?;
        if parent_canonical == dir_canonical {
            return Ok(());
        }
    }
    Err(format!("restore target is outside adapter dirs: {:?}", target))
}

fn current_unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn group_adapter_entries_by_game(entries: Vec<(GameAdapter, AdapterVariantInfo)>) -> BTreeMap<String, Vec<(GameAdapter, AdapterVariantInfo)>> {
    let mut grouped: BTreeMap<String, Vec<(GameAdapter, AdapterVariantInfo)>> = BTreeMap::new();
    for (adapter, variant) in entries {
        grouped.entry(adapter.game_id.clone()).or_default().push((adapter, variant));
    }
    grouped
}

fn adapter_change_diff_fields(before: Option<&GameAdapter>, after: &GameAdapter) -> Result<Vec<AdapterChangeDiffField>, String> {
    let before_missing = "无本地方案".to_string();
    let fields = vec![
        diff_field("network_type", "联机类型", before.and_then(network_type_string).unwrap_or_else(|| before_missing.clone()), network_type_string(after).unwrap_or_else(|| "未标注".to_string()), true),
        diff_field("default_ports", "默认端口", before.map(format_ports).unwrap_or_else(|| before_missing.clone()), format_ports(after), true),
        diff_field("capabilities", "游戏能力", before.map(format_capabilities).unwrap_or_else(|| before_missing.clone()), format_capabilities(after), true),
        diff_field("conversion_capability", "多人能力", before.map(format_conversion_capability).unwrap_or_else(|| before_missing.clone()), format_conversion_capability(after), true),
        diff_field("conversion_methods", "转换方式", before.map(format_conversion_methods).unwrap_or_else(|| before_missing.clone()), format_conversion_methods(after), true),
        diff_field("can_convert_to_lan", "是否可转局域网体验", before.map(format_can_convert).unwrap_or_else(|| before_missing.clone()), format_can_convert(after), true),
        diff_field("connection_summary", "方案摘要", before.map(format_plan_summary).unwrap_or_else(|| before_missing.clone()), format_plan_summary(after), false),
        diff_field("host_role", "房主步骤", before.map(format_host_role).unwrap_or_else(|| before_missing.clone()), format_host_role(after), false),
        diff_field("join_role", "加入者步骤", before.map(format_join_role).unwrap_or_else(|| before_missing.clone()), format_join_role(after), false),
        diff_field("default_join_port", "默认加入端口", before.map(format_default_join_port).unwrap_or_else(|| before_missing.clone()), format_default_join_port(after), true),
        diff_field("route_flags", "路线开关", before.map(format_route_flags).unwrap_or_else(|| before_missing.clone()), format_route_flags(after), true),
        diff_field("applicability", "适用条件", before.map(format_applicability).unwrap_or_else(|| before_missing.clone()), format_applicability(after), true),
        diff_field("evidence", "验证证据", before.map(format_evidence).unwrap_or_else(|| before_missing.clone()), format_evidence(after), true),
    ];
    Ok(fields)
}

fn diff_field(field: &str, label: &str, before: String, after: String, affects_recommendation: bool) -> AdapterChangeDiffField {
    let changed = before != after;
    AdapterChangeDiffField {
        field: field.to_string(),
        label: label.to_string(),
        before,
        after,
        changed,
        affects_recommendation,
    }
}

fn format_ports(adapter: &GameAdapter) -> String {
    if adapter.default_ports.is_empty() {
        "未设置".to_string()
    } else {
        adapter.default_ports.iter().map(|port| port.to_string()).collect::<Vec<_>>().join(", ")
    }
}

fn format_capabilities(adapter: &GameAdapter) -> String {
    if adapter.capabilities.is_empty() {
        "未标注".to_string()
    } else {
        adapter.capabilities
            .iter()
            .filter_map(|item| serde_json::to_value(item).ok().and_then(|value| value.as_str().map(|text| text.to_string())))
            .collect::<Vec<_>>()
            .join(", ")
    }
}

fn format_conversion_capability(adapter: &GameAdapter) -> String {
    adapter
        .multiplayer_conversion
        .as_ref()
        .and_then(|profile| serde_json::to_value(&profile.capability).ok())
        .and_then(|value| value.as_str().map(|text| text.to_string()))
        .unwrap_or_else(|| "未标注".to_string())
}

fn format_conversion_methods(adapter: &GameAdapter) -> String {
    let methods = adapter
        .multiplayer_conversion
        .as_ref()
        .map(|profile| {
            profile
                .methods
                .iter()
                .filter_map(|item| serde_json::to_value(item).ok().and_then(|value| value.as_str().map(|text| text.to_string())))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if methods.is_empty() {
        "未标注".to_string()
    } else {
        methods.join(", ")
    }
}

fn format_can_convert(adapter: &GameAdapter) -> String {
    adapter
        .multiplayer_conversion
        .as_ref()
        .map(|profile| if profile.can_convert_to_lan { "是" } else { "否" }.to_string())
        .unwrap_or_else(|| "未标注".to_string())
}

fn format_plan_summary(adapter: &GameAdapter) -> String {
    adapter
        .connection_plan
        .as_ref()
        .map(|plan| plan.summary.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "未填写".to_string())
}

fn format_host_role(adapter: &GameAdapter) -> String {
    adapter
        .connection_plan
        .as_ref()
        .map(|plan| plan.host_role.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "未填写".to_string())
}

fn format_join_role(adapter: &GameAdapter) -> String {
    adapter
        .connection_plan
        .as_ref()
        .map(|plan| plan.join_role.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "未填写".to_string())
}

fn format_default_join_port(adapter: &GameAdapter) -> String {
    adapter
        .connection_plan
        .as_ref()
        .and_then(|plan| plan.default_join_port)
        .map(|port| port.to_string())
        .unwrap_or_else(|| "未设置".to_string())
}

fn format_route_flags(adapter: &GameAdapter) -> String {
    adapter
        .connection_plan
        .as_ref()
        .map(|plan| {
            vec![
                format!("virtual_lan={}", plan.requires_virtual_lan),
                format!("tcp_proxy={}", plan.requires_tcp_port_proxy),
                format!("udp_bridge={}", plan.requires_udp_broadcast_bridge),
                format!("dedicated_server={}", plan.requires_dedicated_server),
            ]
            .join(", ")
        })
        .unwrap_or_else(|| "未设置".to_string())
}

fn join_or_dash(values: &[String]) -> String {
    if values.is_empty() {
        "-".to_string()
    } else {
        values.join("、")
    }
}

fn format_applicability(adapter: &GameAdapter) -> String {
    adapter
        .applicability
        .as_ref()
        .map(|profile| {
            vec![
                format!("verification={}", profile.verification_status),
                format!("versions={}", join_or_dash(&profile.tested_versions)),
                format!("platforms={}", join_or_dash(&profile.tested_platforms)),
                format!("os={}", join_or_dash(&profile.supported_os)),
                format!("conditions={}", join_or_dash(&profile.network_conditions)),
                format!("limitations={}", join_or_dash(&profile.known_limitations)),
            ]
            .join(", ")
        })
        .unwrap_or_else(|| "未结构化".to_string())
}

fn format_evidence(adapter: &GameAdapter) -> String {
    adapter
        .evidence
        .as_ref()
        .map(|evidence| {
            vec![
                format!("ports={}", join_or_dash(&evidence.port_protocols)),
                format!("proof={}", join_or_dash(&evidence.proof_items)),
                format!("steps={}", join_or_dash(&evidence.test_steps)),
                format!("last_verified={}", evidence.last_verified_at.clone().unwrap_or_else(|| "-".to_string())),
            ]
            .join(", ")
        })
        .unwrap_or_else(|| "未结构化".to_string())
}

fn sorted_unique_sources(variants: &[AdapterVariantInfo]) -> Vec<String> {
    let mut sources: Vec<String> = variants.iter().map(|variant| variant.source.clone()).collect();
    sources.sort();
    sources.dedup();
    sources
}

fn preview_item(
    game_id: &str,
    display_name: Option<&str>,
    adapter_url: &str,
    status: &str,
    reason: String,
    expected_sha256: Option<String>,
    actual_sha256: Option<String>,
    local_sources: Vec<String>,
    active_source: Option<String>,
    has_custom: bool,
    has_registry: bool,
    would_write_registry: bool,
    would_affect_active: bool,
    conflict_with_custom: bool,
    saved_path: Option<String>,
    diff_fields: Vec<AdapterChangeDiffField>,
) -> AdapterRegistryPreviewItem {
    AdapterRegistryPreviewItem {
        game_id: game_id.to_string(),
        display_name: display_name.map(|value| value.to_string()),
        adapter_url: adapter_url.to_string(),
        status: status.to_string(),
        reason,
        expected_sha256,
        actual_sha256,
        local_sources,
        active_source,
        has_custom,
        has_registry,
        would_write_registry,
        would_affect_active,
        conflict_with_custom,
        saved_path,
        diff_fields,
    }
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

fn rebuild_local_adapter_registry_index(root: &Path) -> Result<Vec<AdapterRegistryGame>, String> {
    let games_dir = root.join("games");
    if !games_dir.exists() {
        return Err(format!("local registry games dir not found: {:?}", games_dir));
    }

    let index_path = root.join("index.json");
    let previous_index = if index_path.exists() {
        let text = fs::read_to_string(&index_path)
            .map_err(|err| format!("read local registry index {:?} failed: {err}", index_path))?;
        serde_json::from_str::<AdapterRegistryIndex>(&text).ok()
    } else {
        None
    };

    let mut files = Vec::new();
    for entry in fs::read_dir(&games_dir).map_err(|err| format!("read local registry games dir failed: {err}"))? {
        let path = entry.map_err(|err| err.to_string())?.path();
        if path.extension().and_then(|item| item.to_str()) == Some("json") {
            files.push(path);
        }
    }
    files.sort();

    let mut games = Vec::new();
    for path in files {
        let content = fs::read_to_string(&path)
            .map_err(|err| format!("read local registry adapter {:?} failed: {err}", path))?;
        let adapter: GameAdapter = serde_json::from_str(&content)
            .map_err(|err| format!("parse local registry adapter {:?} failed: {err}", path))?;
        validate_adapter(&adapter)?;
        let file_name = path
            .file_name()
            .and_then(|item| item.to_str())
            .ok_or_else(|| format!("invalid local registry adapter file name: {:?}", path))?;
        let steam_appid = adapter
            .steam_appid
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        games.push(AdapterRegistryGame {
            game_id: adapter.game_id,
            steam_appid,
            adapter_url: format!("games/{file_name}"),
            sha256: Some(sha256_hex(content.as_bytes())),
        });
    }

    let index = AdapterRegistryIndex {
        version: previous_index.as_ref().and_then(|item| item.version).or(Some(1)),
        updated_at: Some(Local::now().format("%Y-%m-%d").to_string()),
        description: previous_index
            .as_ref()
            .and_then(|item| item.description.clone())
            .or_else(|| Some("Lan Helper local adapter registry example. Can be hosted by VPS, static HTTP server, GitHub Pages, or any HTTPS static file hosting.".to_string())),
        games: games.clone(),
    };
    let json = serde_json::to_string_pretty(&index)
        .map_err(|err| format!("serialize local registry index failed: {err}"))?;
    fs::write(&index_path, format!("{json}\n"))
        .map_err(|err| format!("write local registry index {:?} failed: {err}", index_path))?;

    Ok(games)
}

fn verify_local_adapter_registry_index(root: &Path) -> Result<Vec<String>, String> {
    let index_path = root.join("index.json");
    let index_text = fs::read_to_string(&index_path)
        .map_err(|err| format!("read local registry index {:?} failed: {err}", index_path))?;
    let index: AdapterRegistryIndex = serde_json::from_str(&index_text)
        .map_err(|err| format!("parse local registry index {:?} failed: {err}", index_path))?;
    let mut messages = Vec::new();

    for game in &index.games {
        if game.adapter_url.starts_with("http://") || game.adapter_url.starts_with("https://") {
            return Err(format!("local registry adapter_url must be relative: {}", game.adapter_url));
        }
        let adapter_path = root.join(&game.adapter_url);
        if !adapter_path.exists() {
            return Err(format!("local registry adapter missing: {:?}", adapter_path));
        }
        let content = fs::read_to_string(&adapter_path)
            .map_err(|err| format!("read local registry adapter {:?} failed: {err}", adapter_path))?;
        let actual_hash = sha256_hex(content.as_bytes());
        if let Some(expected_hash) = game.sha256.as_ref().filter(|value| !value.trim().is_empty()) {
            if !actual_hash.eq_ignore_ascii_case(expected_hash.trim()) {
                return Err(format!(
                    "local registry sha256 mismatch for {}: expected {}, actual {}",
                    game.game_id, expected_hash, actual_hash
                ));
            }
        }
        let adapter: GameAdapter = serde_json::from_str(&content)
            .map_err(|err| format!("parse local registry adapter {:?} failed: {err}", adapter_path))?;
        validate_adapter(&adapter)?;
        if adapter.game_id != game.game_id {
            return Err(format!(
                "local registry game_id mismatch: index={}, file={}",
                game.game_id, adapter.game_id
            ));
        }
    }

    messages.push(format!("verified adapter-registry/index.json: {} entries", index.games.len()));
    Ok(messages)
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
        include_str!("../../../adapters/games/cuphead.json"),
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
