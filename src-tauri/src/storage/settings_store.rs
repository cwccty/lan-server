use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use chrono::Utc;

use crate::models::settings::AppSettings;

const SETTINGS_DIR: &str = ".lan-helper";
const SETTINGS_FILE: &str = "settings.json";

pub fn get_app_settings() -> Result<AppSettings, String> {
    let path = settings_file_path()?;
    if !path.exists() {
        return Ok(default_settings());
    }
    let content = fs::read_to_string(&path)
        .map_err(|err| format!("read settings failed: {err}"))?;
    let mut settings: AppSettings = serde_json::from_str(&content)
        .map_err(|err| format!("parse settings failed: {err}"))?;
    if settings.updated_at.trim().is_empty() {
        settings.updated_at = Utc::now().to_rfc3339();
    }
    Ok(settings)
}

pub fn save_app_settings(mut settings: AppSettings) -> Result<AppSettings, String> {
    settings.updated_at = Utc::now().to_rfc3339();
    let path = settings_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("create settings dir failed: {err}"))?;
    }
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|err| format!("serialize settings failed: {err}"))?;
    fs::write(&path, content).map_err(|err| format!("write settings failed: {err}"))?;
    Ok(settings)
}

pub fn reset_app_settings() -> Result<AppSettings, String> {
    let settings = default_settings();
    save_app_settings(settings)
}

pub fn open_path(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path is required".to_string());
    }
    let target = PathBuf::from(trimmed);
    if !target.exists() {
        return Err(format!("path does not exist: {trimmed}"));
    }
    open_existing_path(&target)
}

pub fn settings_file_path() -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|err| format!("cannot read current dir: {err}"))?;
    Ok(cwd.join(SETTINGS_DIR).join(SETTINGS_FILE))
}

pub fn settings_dir_path() -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|err| format!("cannot read current dir: {err}"))?;
    Ok(cwd.join(SETTINGS_DIR))
}

fn default_settings() -> AppSettings {
    AppSettings {
        edge_path: None,
        supernode_default: Some("127.0.0.1:7777".to_string()),
        adapter_registry_url: Some("http://127.0.0.1:5173/adapter-registry/index.json".to_string()),
        product_mode: false,
        log_dir: settings_dir_path()
            .ok()
            .map(|path| path.join("logs").to_string_lossy().to_string()),
        tools_dir: std::env::current_dir()
            .ok()
            .map(|path| path.join("tools").to_string_lossy().to_string()),
        updated_at: Utc::now().to_rfc3339(),
    }
}

#[cfg(target_os = "windows")]
fn open_existing_path(path: &Path) -> Result<(), String> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|err| format!("open path failed: {err}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_existing_path(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|err| format!("open path failed: {err}"))?;
    Ok(())
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn open_existing_path(path: &Path) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|err| format!("open path failed: {err}"))?;
    Ok(())
}
