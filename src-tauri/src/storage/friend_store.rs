use std::fs;
use std::path::PathBuf;

use chrono::Utc;

use crate::models::friend::{FriendAllocation, FriendAllocationInput, FriendCheckInput};
use crate::storage::settings_store;

const FRIEND_ALLOCATIONS_FILE: &str = "friend_allocations.json";

pub fn list_friend_allocations() -> Result<Vec<FriendAllocation>, String> {
    Ok(read_all()?
        .into_iter()
        .filter(|item| item.status != "removed")
        .collect())
}

pub fn upsert_friend_allocation(input: FriendAllocationInput) -> Result<FriendAllocation, String> {
    let name = input.name.trim();
    let ip = input.ip.trim();
    validate_name_ip(name, ip)?;

    let mut items = list_friend_allocations()?;
    let existing = items
        .iter()
        .find(|item| item.ip == ip || item.name == name)
        .cloned();
    let now = now_iso();
    let next = FriendAllocation {
        id: existing
            .as_ref()
            .map(|item| item.id.clone())
            .unwrap_or_else(|| format!("friend_{}", Utc::now().timestamp_millis())),
        name: name.to_string(),
        ip: ip.to_string(),
        status: "selected".to_string(),
        created_at: existing
            .as_ref()
            .map(|item| item.created_at.clone())
            .unwrap_or_else(|| now.clone()),
        updated_at: now,
        last_check_summary: existing
            .as_ref()
            .and_then(|item| item.last_check_summary.clone()),
        last_checked_at: existing
            .as_ref()
            .and_then(|item| item.last_checked_at.clone()),
    };

    items.retain(|item| item.id != next.id && item.ip != next.ip && item.name != next.name);
    for item in &mut items {
        if item.status == "selected" {
            item.status = "reserved".to_string();
        }
    }
    items.insert(0, next.clone());
    write_all(&items)?;
    Ok(next)
}

pub fn select_friend_allocation(input: FriendAllocationInput) -> Result<FriendAllocation, String> {
    let name = input.name.trim();
    let ip = input.ip.trim();
    validate_name_ip(name, ip)?;

    let existing = list_friend_allocations()?
        .into_iter()
        .find(|item| item.ip == ip || item.name == name);
    if existing.is_none() {
        return upsert_friend_allocation(FriendAllocationInput {
            name: name.to_string(),
            ip: ip.to_string(),
        });
    }

    let selected = existing.expect("checked is_some");
    let now = now_iso();
    let mut items = list_friend_allocations()?;
    for item in &mut items {
        if item.id == selected.id {
            item.status = "selected".to_string();
            item.updated_at = now.clone();
        } else if item.status == "selected" {
            item.status = "reserved".to_string();
        }
    }
    write_all(&items)?;
    items
        .into_iter()
        .find(|item| item.id == selected.id)
        .ok_or_else(|| "选择好友席位失败。".to_string())
}

pub fn remove_friend_allocation(
    name: String,
    ip: Option<String>,
) -> Result<FriendAllocation, String> {
    let clean_name = name.trim();
    let clean_ip = ip.unwrap_or_default();
    let clean_ip = clean_ip.trim();
    let mut items = list_friend_allocations()?;
    let target = items
        .iter()
        .find(|item| item.name == clean_name || (!clean_ip.is_empty() && item.ip == clean_ip))
        .cloned()
        .ok_or_else(|| format!("没有找到要回收的好友席位：{clean_name}"))?;
    items.retain(|item| item.id != target.id);
    write_all(&items)?;
    Ok(target)
}

pub fn update_friend_check(input: FriendCheckInput) -> Result<Option<FriendAllocation>, String> {
    let ip = input.ip.trim();
    if !is_private_virtual_ip(ip) {
        return Err("好友虚拟 IP 必须是 10.x.x.x 网段地址。".to_string());
    }
    let now = now_iso();
    let mut items = list_friend_allocations()?;
    let mut found = None;
    for item in &mut items {
        if item.ip == ip {
            item.last_check_summary = Some(input.summary.clone());
            item.last_checked_at = Some(now.clone());
            item.updated_at = now.clone();
            found = Some(item.clone());
        }
    }
    write_all(&items)?;
    Ok(found)
}

fn read_all() -> Result<Vec<FriendAllocation>, String> {
    let path = friend_allocations_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|err| format!("read friend allocations failed: {err}"))?;
    let items = serde_json::from_str::<Vec<FriendAllocation>>(&content)
        .map_err(|err| format!("parse friend allocations failed: {err}"))?;
    Ok(items)
}

fn write_all(items: &[FriendAllocation]) -> Result<(), String> {
    let path = friend_allocations_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("create friend allocations dir failed: {err}"))?;
    }
    let content = serde_json::to_string_pretty(items)
        .map_err(|err| format!("serialize friend allocations failed: {err}"))?;
    fs::write(&path, content).map_err(|err| format!("write friend allocations failed: {err}"))?;
    Ok(())
}

fn friend_allocations_path() -> Result<PathBuf, String> {
    Ok(settings_store::settings_dir_path()?.join(FRIEND_ALLOCATIONS_FILE))
}

fn validate_name_ip(name: &str, ip: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("请输入好友昵称。".to_string());
    }
    if !is_private_virtual_ip(ip) {
        return Err("好友虚拟 IP 必须是 10.x.x.x 网段地址。".to_string());
    }
    Ok(())
}

fn is_private_virtual_ip(ip: &str) -> bool {
    let parts: Vec<&str> = ip.split('.').collect();
    parts.len() == 4
        && parts[0] == "10"
        && parts
            .iter()
            .all(|part| part.parse::<u8>().map(|_| true).unwrap_or(false))
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
