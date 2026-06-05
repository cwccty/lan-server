use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use chrono::Utc;

use crate::core::process_util::hide_console_window;
use crate::models::settings::{AppSettings, EdgePathCheck};

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
    let target = resolve_existing_open_path(trimmed)?;
    open_existing_path(&target)
}

fn resolve_existing_open_path(raw_path: &str) -> Result<PathBuf, String> {
    let requested = PathBuf::from(raw_path);
    if requested.is_absolute() {
        return if requested.exists() {
            Ok(requested)
        } else {
            Err(format!("path does not exist: {raw_path}"))
        };
    }

    let mut candidates = Vec::<PathBuf>::new();
    candidates.push(requested.clone());

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join(&requested));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let mut cursor = Some(exe_dir);
            while let Some(dir) = cursor {
                candidates.push(dir.join(&requested));
                cursor = dir.parent();
            }
        }
    }

    let mut tried = Vec::<String>::new();
    for candidate in candidates {
        let display = candidate.to_string_lossy().to_string();
        if tried.iter().any(|item| item.eq_ignore_ascii_case(&display)) {
            continue;
        }
        if candidate.exists() {
            return Ok(candidate);
        }
        tried.push(display);
    }

    Err(format!(
        "path does not exist: {raw_path}; tried: {}",
        tried.join(" | ")
    ))
}

pub fn test_edge_path(path: Option<String>) -> Result<EdgePathCheck, String> {
    let candidate = path
        .and_then(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
        .or_else(|| get_app_settings().ok().and_then(|settings| settings.edge_path));

    let Some(candidate) = candidate else {
        return Ok(EdgePathCheck {
            ok: false,
            path: None,
            exists: false,
            is_file: false,
            executable_name_ok: false,
            can_execute: false,
            version_hint: None,
            message: "尚未设置 edge.exe 路径。".to_string(),
            stderr: None,
        });
    };

    let target = PathBuf::from(candidate.trim());
    let exists = target.exists();
    let is_file = target.is_file();
    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let executable_name_ok = file_name == "edge.exe" || file_name == "n2n.exe" || file_name == "edge";

    if !exists || !is_file {
        return Ok(EdgePathCheck {
            ok: false,
            path: Some(target.to_string_lossy().to_string()),
            exists,
            is_file,
            executable_name_ok,
            can_execute: false,
            version_hint: None,
            message: "edge 路径不存在或不是文件。".to_string(),
            stderr: None,
        });
    }

    let mut command = Command::new(&target);
    command.arg("-h");
    let output = hide_console_window(&mut command).output();

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let combined = format!("{stdout}\n{stderr}");
            let version_hint = combined
                .lines()
                .map(str::trim)
                .find(|line| {
                    let lower = line.to_ascii_lowercase();
                    !line.is_empty()
                        && (lower.contains("n2n")
                            || lower.contains("edge")
                            || lower.contains("usage")
                            || lower.contains("welcome"))
                })
                .map(ToString::to_string);
            let can_execute = output.status.success() || version_hint.is_some() || !combined.trim().is_empty();
            let ok = exists && is_file && executable_name_ok && can_execute;
            Ok(EdgePathCheck {
                ok,
                path: Some(target.to_string_lossy().to_string()),
                exists,
                is_file,
                executable_name_ok,
                can_execute,
                version_hint,
                message: if ok {
                    "edge 路径检测通过。".to_string()
                } else if !executable_name_ok {
                    "文件可执行，但文件名不像 edge.exe/n2n.exe，请确认是否为 n2n edge。".to_string()
                } else {
                    "edge 可执行性检测未通过，请确认文件完整且有执行权限。".to_string()
                },
                stderr: if stderr.trim().is_empty() { None } else { Some(stderr) },
            })
        }
        Err(err) => Ok(EdgePathCheck {
            ok: false,
            path: Some(target.to_string_lossy().to_string()),
            exists,
            is_file,
            executable_name_ok,
            can_execute: false,
            version_hint: None,
            message: format!("执行 edge -h 失败: {err}"),
            stderr: None,
        }),
    }
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
        adapter_registry_url: Some("https://cwccty.github.io/lan-server/adapter-registry/index.json".to_string()),
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
