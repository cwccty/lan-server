use std::collections::HashMap;
use std::fs;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
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

#[derive(Clone)]
struct ServerSession {
    pid: u32,
    game_id: String,
    profile_id: String,
    port: u16,
    logs: Vec<String>,
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
        return Err(format!("未找到 Terraria 服务端程序：{}", executable.to_string_lossy()));
    }

    let (args, note, port) = build_terraria_server_args(&values)?;
    let pid = start_hidden_process(&executable, &PathBuf::from(&game_path), &args)?;

    let logs = vec![
        format!("后台启动：{}", executable.to_string_lossy()),
        format!("参数：{}", args.join(" ")),
        note,
        format!("PID：{pid}"),
        "已使用隐藏窗口方式启动。该模式不会弹出白色命令框，但第一版无法捕获 Terraria 实时日志或发送服务端命令。".to_string(),
        "服务端是否可用将通过 127.0.0.1:端口 监听状态判断。".to_string(),
    ];

    let session = ServerSession {
        pid,
        game_id: game_id.to_string(),
        profile_id: profile_id.to_string(),
        port,
        logs,
    };
    *current = Some(session.clone());
    Ok(status_from_session(&session, "Terraria 服务端已在后台启动。"))
}

pub fn read_server_session() -> Result<ServerSessionStatus, String> {
    let session_lock = SESSION.get_or_init(|| Mutex::new(None));
    let current = session_lock
        .lock()
        .map_err(|_| "服务端会话锁已损坏".to_string())?;
    let Some(session) = current.as_ref() else {
        return Ok(empty_status("当前没有运行中的服务端会话。"));
    };
    Ok(status_from_session(session, "服务端状态已刷新。"))
}

pub fn send_server_command(_command: &str) -> Result<ServerSessionStatus, String> {
    Err("当前使用隐藏后台模式，暂不支持向 Terraria 服务端发送命令。需要 help/save/exit 时，后续会用 Windows ConPTY 方案实现真正内嵌控制台。".to_string())
}

pub fn stop_server_session() -> Result<ServerSessionStatus, String> {
    let session_lock = SESSION.get_or_init(|| Mutex::new(None));
    let mut current = session_lock
        .lock()
        .map_err(|_| "服务端会话锁已损坏".to_string())?;
    let Some(session) = current.take() else {
        return Ok(empty_status("当前没有运行中的服务端会话。"));
    };

    let mut command = Command::new("taskkill");
    command.args(["/PID", &session.pid.to_string(), "/F"]);
    let output = hide_console_window(&mut command).output();
    let mut status = status_from_session(&session, "服务端已停止。");
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

fn start_hidden_process(executable: &PathBuf, working_dir: &PathBuf, args: &[String]) -> Result<u32, String> {
    #[cfg(windows)]
    {
        return start_hidden_windows_console_process(executable, working_dir, args);
    }

    #[cfg(not(windows))]
    {
        let child = Command::new(executable)
            .args(args)
            .current_dir(working_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|err| format!("启动后台服务端失败：{err}"))?;
        return Ok(child.id());
    }
}

#[cfg(windows)]
fn start_hidden_windows_console_process(
    executable: &PathBuf,
    working_dir: &PathBuf,
    args: &[String],
) -> Result<u32, String> {
    use std::mem::size_of;
    use std::ptr::null;
    use windows_sys::Win32::Foundation::{CloseHandle, GetLastError};
    use windows_sys::Win32::System::Threading::{
        CreateProcessW, CREATE_NEW_CONSOLE, PROCESS_INFORMATION, STARTUPINFOW, STARTF_USESHOWWINDOW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_HIDE;

    let command_line = std::iter::once(executable.to_string_lossy().to_string())
        .chain(args.iter().cloned())
        .map(|item| quote_windows_arg(&item))
        .collect::<Vec<_>>()
        .join(" ");
    let mut command_line_w = to_wide_null(&command_line);
    let application_name_w = to_wide_null(&executable.to_string_lossy());
    let current_dir_w = to_wide_null(&working_dir.to_string_lossy());

    let mut startup_info = STARTUPINFOW {
        cb: size_of::<STARTUPINFOW>() as u32,
        dwFlags: STARTF_USESHOWWINDOW,
        wShowWindow: SW_HIDE as u16,
        ..unsafe { std::mem::zeroed() }
    };
    let mut process_info: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };

    let created = unsafe {
        CreateProcessW(
            application_name_w.as_ptr(),
            command_line_w.as_mut_ptr(),
            null(),
            null(),
            0,
            CREATE_NEW_CONSOLE,
            null(),
            current_dir_w.as_ptr(),
            &mut startup_info,
            &mut process_info,
        )
    };

    if created == 0 {
        let code = unsafe { GetLastError() };
        return Err(format!("启动隐藏控制台服务端失败，Windows 错误码：{code}"));
    }

    let pid = process_info.dwProcessId;
    unsafe {
        CloseHandle(process_info.hThread);
        CloseHandle(process_info.hProcess);
    }
    Ok(pid)
}

#[cfg(windows)]
fn to_wide_null(input: &str) -> Vec<u16> {
    input.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn quote_windows_arg(input: &str) -> String {
    if input.is_empty() {
        return "\"\"".to_string();
    }
    if !input.chars().any(|item| item.is_whitespace() || item == '"') {
        return input.to_string();
    }
    let mut quoted = String::from("\"");
    let mut backslashes = 0;
    for ch in input.chars() {
        match ch {
            '\\' => backslashes += 1,
            '"' => {
                quoted.push_str(&"\\".repeat(backslashes * 2 + 1));
                quoted.push('"');
                backslashes = 0;
            }
            _ => {
                quoted.push_str(&"\\".repeat(backslashes));
                backslashes = 0;
                quoted.push(ch);
            }
        }
    }
    quoted.push_str(&"\\".repeat(backslashes * 2));
    quoted.push('"');
    quoted
}

#[allow(dead_code)]
fn start_hidden_process_via_powershell(executable: &PathBuf, working_dir: &PathBuf, args: &[String]) -> Result<u32, String> {
    let script = format!(
        "$p = Start-Process -FilePath '{}' -ArgumentList @({}) -WorkingDirectory '{}' -WindowStyle Hidden -PassThru; Write-Output $p.Id",
        ps_escape(&executable.to_string_lossy()),
        args.iter()
            .map(|arg| format!("'{}'", ps_escape(arg)))
            .collect::<Vec<_>>()
            .join(","),
        ps_escape(&working_dir.to_string_lossy())
    );

    let mut command = Command::new("powershell");
    command
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command
        .output()
        .map_err(|err| format!("调用 PowerShell 后台启动失败：{err}"))?;
    if !output.status.success() {
        return Err(format!(
            "PowerShell 后台启动失败：{}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .trim()
        .parse::<u32>()
        .map_err(|_| format!("无法解析后台服务端 PID：{stdout}"))
}

fn ps_escape(input: &str) -> String {
    input.replace('\'', "''")
}

fn status_from_session(session: &ServerSession, message: &str) -> ServerSessionStatus {
    let running = is_pid_running(session.pid);
    let ready = running && is_local_port_open(session.port);
    let mut logs = session.logs.clone();
    logs.push(format!(
        "当前状态：{}；端口 {} {}。",
        if running { "进程运行中" } else { "进程已退出" },
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
