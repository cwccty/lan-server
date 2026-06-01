use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;

use serde_json::Value;

use crate::core::game_detector;
use crate::models::server_session::ServerSessionStatus;
use crate::storage::adapter_store;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

struct ServerSession {
    child: Child,
    game_id: String,
    profile_id: String,
    logs: Arc<Mutex<Vec<String>>>,
}

static SESSION: OnceLock<Mutex<Option<ServerSession>>> = OnceLock::new();

pub fn start_game_server_session(
    game_id: &str,
    profile_id: &str,
    config: Value,
) -> Result<ServerSessionStatus, String> {
    let session_lock = SESSION.get_or_init(|| Mutex::new(None));
    let mut current = session_lock
        .lock()
        .map_err(|_| "服务端会话锁已损坏".to_string())?;

    if let Some(session) = current.as_mut() {
        if session.child.try_wait().map_err(|err| err.to_string())?.is_none() {
            return Ok(status_from_session(session, "已有服务端会话正在运行。"));
        }
    }
    *current = None;

    if game_id != "terraria" || profile_id != "server" {
        return Err("当前内嵌控制台第一版仅支持 Terraria 服务端。".to_string());
    }

    let adapter = adapter_store::load_game_adapters()?
        .into_iter()
        .find(|item| item.game_id == game_id)
        .ok_or_else(|| format!("未找到游戏适配: {game_id}"))?;
    let profile = adapter
        .launch_profiles
        .iter()
        .find(|item| item.id == profile_id)
        .ok_or_else(|| format!("未找到启动配置: {game_id}/{profile_id}"))?;
    let exe = profile
        .exe
        .as_ref()
        .ok_or_else(|| "服务端启动配置缺少 exe。".to_string())?;

    let values = collect_profile_values(profile, config)?;
    let steam_libraries = game_detector::discover_steam_libraries();
    let game_path = game_detector::find_installed_game_path(&adapter, &steam_libraries)
        .ok_or_else(|| "未检测到 Terraria 安装路径，无法启动内嵌服务端。".to_string())?;
    let executable = std::path::Path::new(&game_path).join(exe);
    if !executable.exists() {
        return Err(format!("未找到 Terraria 服务端程序：{}", executable.to_string_lossy()));
    }

    let (args, note) = build_terraria_server_args(&values)?;
    let logs = Arc::new(Mutex::new(vec![
        format!("启动：{}", executable.to_string_lossy()),
        format!("参数：{}", args.join(" ")),
        note,
    ]));

    let mut command = Command::new(&executable);
    command
        .current_dir(&game_path)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command.spawn().map_err(|err| format!("启动 Terraria 服务端失败：{err}"))?;
    attach_reader(child.stdout.take(), logs.clone(), "OUT");
    attach_reader(child.stderr.take(), logs.clone(), "ERR");

    let pid = child.id();
    *current = Some(ServerSession {
        child,
        game_id: game_id.to_string(),
        profile_id: profile_id.to_string(),
        logs,
    });

    Ok(ServerSessionStatus {
        running: true,
        pid: Some(pid),
        game_id: Some(game_id.to_string()),
        profile_id: Some(profile_id.to_string()),
        logs: current
            .as_ref()
            .and_then(|session| session.logs.lock().ok().map(|logs| logs.clone()))
            .unwrap_or_default(),
        message: format!("Terraria 服务端已在程序内启动，PID: {pid}"),
    })
}

pub fn read_server_session() -> Result<ServerSessionStatus, String> {
    let session_lock = SESSION.get_or_init(|| Mutex::new(None));
    let mut current = session_lock
        .lock()
        .map_err(|_| "服务端会话锁已损坏".to_string())?;
    let Some(session) = current.as_mut() else {
        return Ok(ServerSessionStatus {
            running: false,
            pid: None,
            game_id: None,
            profile_id: None,
            logs: Vec::new(),
            message: "当前没有运行中的服务端会话。".to_string(),
        });
    };

    let running = session.child.try_wait().map_err(|err| err.to_string())?.is_none();
    let message = if running {
        "服务端正在运行。"
    } else {
        "服务端进程已退出。"
    };
    let mut status = status_from_session(session, message);
    status.running = running;
    Ok(status)
}

pub fn stop_server_session() -> Result<ServerSessionStatus, String> {
    let session_lock = SESSION.get_or_init(|| Mutex::new(None));
    let mut current = session_lock
        .lock()
        .map_err(|_| "服务端会话锁已损坏".to_string())?;
    let Some(mut session) = current.take() else {
        return Ok(ServerSessionStatus {
            running: false,
            pid: None,
            game_id: None,
            profile_id: None,
            logs: Vec::new(),
            message: "当前没有运行中的服务端会话。".to_string(),
        });
    };

    let _ = session.child.kill();
    let _ = session.child.wait();
    let mut status = status_from_session(&mut session, "服务端已停止。");
    status.running = false;
    status.pid = None;
    Ok(status)
}

fn status_from_session(session: &mut ServerSession, message: &str) -> ServerSessionStatus {
    ServerSessionStatus {
        running: true,
        pid: Some(session.child.id()),
        game_id: Some(session.game_id.clone()),
        profile_id: Some(session.profile_id.clone()),
        logs: session.logs.lock().map(|logs| logs.clone()).unwrap_or_default(),
        message: message.to_string(),
    }
}

fn attach_reader<T: std::io::Read + Send + 'static>(
    stream: Option<T>,
    logs: Arc<Mutex<Vec<String>>>,
    label: &'static str,
) {
    if let Some(stream) = stream {
        thread::spawn(move || {
            let reader = BufReader::new(stream);
            for line in reader.lines().map_while(Result::ok) {
                if let Ok(mut logs) = logs.lock() {
                    logs.push(format!("[{label}] {line}"));
                    if logs.len() > 500 {
                        let excess = logs.len() - 500;
                        logs.drain(0..excess);
                    }
                }
            }
        });
    }
}

fn collect_profile_values(
    profile: &crate::models::game::LaunchProfile,
    config: Value,
) -> Result<HashMap<String, String>, String> {
    let mut values = HashMap::new();
    if let Some(fields) = &profile.config_fields {
        for field in fields {
            if let Some(default_value) = &field.default_value {
                values.insert(field.id.clone(), default_value.clone());
            }
        }
        for field in fields {
            if let Some(value) = config.get(&field.id).and_then(value_to_string) {
                values.insert(field.id.clone(), value);
            }
            if field.required.unwrap_or(false)
                && values
                    .get(&field.id)
                    .map_or(true, |value| value.trim().is_empty())
            {
                return Err(format!("缺少必填开服参数：{}", field.label));
            }
        }
    }
    Ok(values)
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(item) => Some(item.clone()),
        Value::Number(item) => Some(item.to_string()),
        Value::Bool(item) => Some(if *item { "true" } else { "false" }.to_string()),
        Value::Null => Some(String::new()),
        _ => None,
    }
}

fn build_terraria_server_args(
    values: &HashMap<String, String>,
) -> Result<(Vec<String>, String), String> {
    let world_path = if let Some(path) = values.get("world_path").filter(|item| !item.trim().is_empty()) {
        PathBuf::from(path)
    } else {
        let world_choice = values
            .get("world_choice")
            .and_then(|item| item.trim().parse::<usize>().ok())
            .unwrap_or(1);
        let worlds = discover_terraria_worlds();
        let Some(path) = worlds.get(world_choice.saturating_sub(1)) else {
            return Err(format!(
                "未找到 Terraria 世界编号 {world_choice} 对应的 .wld 文件。请填写完整 world_path。"
            ));
        };
        path.clone()
    };

    if !world_path.exists() {
        return Err(format!("Terraria 世界文件不存在：{}", world_path.to_string_lossy()));
    }

    let players = values
        .get("max_players")
        .cloned()
        .unwrap_or_else(|| "8".to_string());
    let port = values
        .get("port")
        .cloned()
        .unwrap_or_else(|| "7777".to_string());
    let password = values.get("password").cloned().unwrap_or_default();
    let auto_forward = values
        .get("auto_forward")
        .map(|item| item.trim().eq_ignore_ascii_case("y"))
        .unwrap_or(false);

    let mut args = vec![
        "-world".to_string(),
        world_path.to_string_lossy().to_string(),
        "-players".to_string(),
        players,
        "-port".to_string(),
        port,
    ];
    if !password.trim().is_empty() {
        args.push("-pass".to_string());
        args.push(password);
    }
    if !auto_forward {
        args.push("-noupnp".to_string());
    }

    Ok((
        args,
        format!("已指定世界文件：{}", world_path.to_string_lossy()),
    ))
}

fn discover_terraria_worlds() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        candidates.push(
            PathBuf::from(&user_profile)
                .join("Documents")
                .join("My Games")
                .join("Terraria")
                .join("Worlds"),
        );
    }
    for env_name in ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] {
        if let Ok(one_drive) = std::env::var(env_name) {
            candidates.push(
                PathBuf::from(one_drive)
                    .join("Documents")
                    .join("My Games")
                    .join("Terraria")
                    .join("Worlds"),
            );
        }
    }

    let mut worlds = Vec::new();
    for dir in candidates {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|item| item.to_str()) == Some("wld") {
                    worlds.push(path);
                }
            }
        }
    }
    worlds.sort_by_key(|path| path.file_name().map(|item| item.to_os_string()));
    worlds.dedup();
    worlds
}
