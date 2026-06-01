use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use serde_json::Value;

use crate::core::game_detector;
use crate::core::process_util::hide_console_window;
use crate::models::server_session::ServerSessionStatus;
use crate::storage::adapter_store;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(windows)]
const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

#[cfg(windows)]
const STILL_ACTIVE: u32 = 259;

struct ServerSession {
    pid: u32,
    game_id: String,
    profile_id: String,
    port: u16,
    child: Child,
    stdin: Option<ChildStdin>,
    logs: Arc<Mutex<Vec<String>>>,
}

struct ManagedProcess {
    child: Child,
    stdin: Option<ChildStdin>,
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
        .map_err(|_| "服务端会话锁已损坏。".to_string())?;

    if let Some(session) = current.as_ref() {
        if is_pid_running(session.pid) {
            return Ok(status_from_session(session, "已有服务端会话正在运行。"));
        }
    }
    *current = None;

    if game_id != "terraria" || profile_id != "server" {
        return Err("后台服务端第一版仅支持 Terraria 服务端。".to_string());
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
        .ok_or_else(|| "未检测到 Terraria 安装路径，无法启动后台服务端。".to_string())?;
    let executable = std::path::Path::new(&game_path).join(exe);
    if !executable.exists() {
        return Err(format!(
            "未找到 Terraria 服务端程序：{}",
            executable.to_string_lossy()
        ));
    }

    let (args, note, port) = build_terraria_server_args(&values)?;
    let mut managed = start_hidden_process(&executable, &PathBuf::from(&game_path), &args)?;
    let pid = managed.child.id();

    push_logs(
        &managed.logs,
        vec![
            format!("后台启动：{}", executable.to_string_lossy()),
            format!("参数：{}", args.join(" ")),
            note,
            format!("PID：{pid}"),
            "已使用后台托管模式启动：不会弹出白色命令框，并会保持 Terraria 控制台输入流。"
                .to_string(),
            "服务端是否可用将通过 127.0.0.1:端口监听状态判断。".to_string(),
        ],
    );

    let session = ServerSession {
        pid,
        game_id: game_id.to_string(),
        profile_id: profile_id.to_string(),
        port,
        child: managed.child,
        stdin: managed.stdin.take(),
        logs: managed.logs,
    };
    let status = status_from_session(&session, "Terraria 服务端已在后台启动。");
    *current = Some(session);
    Ok(status)
}

pub fn read_server_session() -> Result<ServerSessionStatus, String> {
    let session_lock = SESSION.get_or_init(|| Mutex::new(None));
    let current = session_lock
        .lock()
        .map_err(|_| "服务端会话锁已损坏。".to_string())?;
    let Some(session) = current.as_ref() else {
        return Ok(empty_status("当前没有运行中的服务端会话。"));
    };
    Ok(status_from_session(session, "服务端状态已刷新。"))
}

pub fn send_server_command(command: &str) -> Result<ServerSessionStatus, String> {
    let session_lock = SESSION.get_or_init(|| Mutex::new(None));
    let mut current = session_lock
        .lock()
        .map_err(|_| "服务端会话锁已损坏。".to_string())?;
    let Some(session) = current.as_mut() else {
        return Ok(empty_status("当前没有运行中的服务端会话。"));
    };
    if !is_pid_running(session.pid) {
        return Ok(status_from_session(
            session,
            "服务端进程已经退出，命令未发送。",
        ));
    }
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Ok(status_from_session(session, "命令为空，未发送。"));
    }
    let Some(stdin) = session.stdin.as_mut() else {
        return Ok(status_from_session(session, "当前服务端没有可用的输入流。"));
    };
    writeln!(stdin, "{trimmed}").map_err(|err| format!("发送服务端命令失败: {err}"))?;
    stdin
        .flush()
        .map_err(|err| format!("刷新服务端命令失败: {err}"))?;
    push_log(&session.logs, format!("> {trimmed}"));
    Ok(status_from_session(session, "命令已发送。"))
}

pub fn stop_server_session() -> Result<ServerSessionStatus, String> {
    let session_lock = SESSION.get_or_init(|| Mutex::new(None));
    let mut current = session_lock
        .lock()
        .map_err(|_| "服务端会话锁已损坏。".to_string())?;
    let Some(session) = current.take() else {
        return Ok(empty_status("当前没有运行中的服务端会话。"));
    };

    let mut command = Command::new("taskkill");
    command.args(["/PID", &session.pid.to_string(), "/F"]);
    let output = hide_console_window(&mut command).output();
    let mut status = status_from_session(&session, "服务端已停止。委托进程即将清理。");
    status.running = false;
    status.pid = None;
    if let Ok(result) = output {
        if !result.status.success() {
            status.message = format!(
                "停止服务端可能失败：{}",
                String::from_utf8_lossy(&result.stderr)
            );
        }
    }
    Ok(status)
}

fn start_hidden_process(
    executable: &PathBuf,
    working_dir: &PathBuf,
    args: &[String],
) -> Result<ManagedProcess, String> {
    let mut command = Command::new(executable);
    command
        .args(args)
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        .spawn()
        .map_err(|err| format!("启动后台服务端失败: {err}"))?;

    let stdin = child.stdin.take();
    let logs = Arc::new(Mutex::new(Vec::new()));

    if let Some(stdout) = child.stdout.take() {
        spawn_output_reader(stdout, Arc::clone(&logs));
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_output_reader(stderr, Arc::clone(&logs));
    }

    Ok(ManagedProcess { child, stdin, logs })
}

fn spawn_output_reader<R>(reader: R, logs: Arc<Mutex<Vec<String>>>)
where
    R: std::io::Read + Send + 'static,
{
    thread::spawn(move || {
        let reader = BufReader::new(reader);
        for line in reader.lines().map_while(Result::ok) {
            push_log(&logs, line);
        }
    });
}

fn push_log(logs: &Arc<Mutex<Vec<String>>>, line: String) {
    if let Ok(mut logs) = logs.lock() {
        logs.push(line);
        let overflow = logs.len().saturating_sub(300);
        if overflow > 0 {
            logs.drain(0..overflow);
        }
    }
}

fn push_logs(logs: &Arc<Mutex<Vec<String>>>, lines: Vec<String>) {
    for line in lines {
        push_log(logs, line);
    }
}

fn snapshot_logs(logs: &Arc<Mutex<Vec<String>>>) -> Vec<String> {
    logs.lock().map(|logs| logs.clone()).unwrap_or_default()
}

fn status_from_session(session: &ServerSession, message: &str) -> ServerSessionStatus {
    let _ = session.child.id();
    let running = is_pid_running(session.pid);
    let ready = running && is_local_port_open(session.port);
    let mut logs = snapshot_logs(&session.logs);
    logs.push(format!(
        "当前状态：{}；端口 {} {}。",
        if running {
            "进程运行中"
        } else {
            "进程已退出"
        },
        session.port,
        if ready { "已监听" } else { "尚未监听" }
    ));
    ServerSessionStatus {
        running,
        pid: if running { Some(session.pid) } else { None },
        game_id: Some(session.game_id.clone()),
        profile_id: Some(session.profile_id.clone()),
        ready,
        logs,
        message: message.to_string(),
    }
}

fn empty_status(message: &str) -> ServerSessionStatus {
    ServerSessionStatus {
        running: false,
        pid: None,
        game_id: None,
        profile_id: None,
        ready: false,
        logs: Vec::new(),
        message: message.to_string(),
    }
}

fn is_pid_running(pid: u32) -> bool {
    #[cfg(windows)]
    {
        return is_pid_running_windows(pid);
    }

    #[cfg(not(windows))]
    {
        return is_pid_running_tasklist(pid);
    }
}

#[cfg(windows)]
fn is_pid_running_windows(pid: u32) -> bool {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{GetExitCodeProcess, OpenProcess};

    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle.is_null() {
        return false;
    }

    let mut exit_code = 0;
    let ok = unsafe { GetExitCodeProcess(handle, &mut exit_code) };
    unsafe {
        CloseHandle(handle);
    }
    ok != 0 && exit_code == STILL_ACTIVE
}

#[allow(dead_code)]
fn is_pid_running_tasklist(pid: u32) -> bool {
    let mut command = Command::new("tasklist");
    command.args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"]);
    let output = hide_console_window(&mut command).output();
    let Ok(output) = output else {
        return false;
    };
    if !output.status.success() {
        return false;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.contains(&pid.to_string()) && !stdout.to_ascii_lowercase().contains("no tasks")
}

fn is_local_port_open(port: u16) -> bool {
    let Ok(mut addrs) = format!("127.0.0.1:{port}").to_socket_addrs() else {
        return false;
    };
    let Some(addr) = addrs.next() else {
        return false;
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
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
) -> Result<(Vec<String>, String, u16), String> {
    let world_path = if let Some(path) = values
        .get("world_path")
        .filter(|item| !item.trim().is_empty())
    {
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
        return Err(format!(
            "Terraria 世界文件不存在：{}",
            world_path.to_string_lossy()
        ));
    }

    let players = values
        .get("max_players")
        .cloned()
        .unwrap_or_else(|| "8".to_string());
    let port = values
        .get("port")
        .and_then(|value| value.trim().parse::<u16>().ok())
        .unwrap_or(7777);
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
        port.to_string(),
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
        port,
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
