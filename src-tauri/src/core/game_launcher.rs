use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use serde_json::Value;

use crate::core::game_detector;
use crate::core::process_util::hide_console_window;
use crate::models::game::LaunchProfile;
use crate::models::recommendation::LaunchResult;
use crate::storage::adapter_store;

pub fn launch_profile(
    game_id: &str,
    profile_id: &str,
    config: Value,
) -> Result<LaunchResult, String> {
    let adapter = adapter_store::load_game_adapters()?
        .into_iter()
        .find(|item| item.game_id == game_id)
        .ok_or_else(|| format!("未找到游戏适配: {game_id}"))?;
    let profile = adapter
        .launch_profiles
        .iter()
        .find(|item| item.id == profile_id)
        .ok_or_else(|| format!("未找到启动配置: {game_id}/{profile_id}"))?;

    if profile.profile_type == "docs" {
        return Ok(LaunchResult {
            ok: true,
            message: connection_docs(game_id),
        });
    }

    let values = collect_config_values(profile, config)?;
    let steam_libraries = game_detector::discover_steam_libraries();
    let Some(game_path) = game_detector::find_installed_game_path(&adapter, &steam_libraries) else {
        return Ok(LaunchResult {
            ok: false,
            message: format!(
                "未检测到 {game_id} 的本地安装路径，无法启动。请确认 Steam 已安装该游戏，并在诊断报告中查看 Steam 库路径是否正确。"
            ),
        });
    };

    let Some(exe) = &profile.exe else {
        return Ok(LaunchResult {
            ok: false,
            message: format!("启动配置 {profile_id} 未声明 exe。"),
        });
    };

    let executable = std::path::Path::new(&game_path).join(exe);
    if !executable.exists() {
        return Ok(LaunchResult {
            ok: false,
            message: format!(
                "未找到可执行文件: {}。可能是游戏版本目录不同，或适配库中的 exe 名称需要更新。",
                executable.to_string_lossy()
            ),
        });
    }

    let mut command = Command::new(&executable);
    command.current_dir(&game_path);
    if let Some(args) = &profile.args {
        command.args(args);
    }
    if let Some(arg_templates) = &profile.arg_templates {
        let rendered_args: Vec<String> = arg_templates
            .iter()
            .map(|item| render_template(item, &values))
            .collect();
        command.args(rendered_args);
    }

    let mut launch_note = String::new();
    if game_id == "terraria" && profile_id == "server" {
        match build_terraria_server_args(&values) {
            Ok((args, note)) => {
                command.args(args);
                launch_note = note;
            }
            Err(message) => {
                return Ok(LaunchResult { ok: false, message });
            }
        }
    }

    let stdin_lines: Vec<String> = profile
        .stdin_templates
        .clone()
        .unwrap_or_default()
        .iter()
        .map(|item| render_template(item, &values))
        .collect();
    if !stdin_lines.is_empty() {
        command.stdin(Stdio::piped());
    }

    match hide_console_window(&mut command).spawn() {
        Ok(mut child) => {
            if !stdin_lines.is_empty() {
                if let Some(mut stdin) = child.stdin.take() {
                    for line in &stdin_lines {
                        if let Err(err) = writeln!(stdin, "{line}") {
                            return Ok(LaunchResult {
                                ok: false,
                                message: format!(
                                    "已启动 {exe}，但写入开服参数失败: {err}。请在服务端窗口中手动继续输入。PID: {}",
                                    child.id()
                                ),
                            });
                        }
                    }
                }
            }

            let mut message = format!("已启动 {exe}，PID: {}", child.id());
            if !launch_note.is_empty() {
                message.push_str(&format!("。{launch_note}"));
            }
            if !stdin_lines.is_empty() {
                message.push_str("。已按当前适配器配置自动写入开服参数。若游戏仍停在控制台提示，请在服务端窗口中手动确认剩余选项。");
            }
            Ok(LaunchResult { ok: true, message })
        }
        Err(err) => Ok(LaunchResult {
            ok: false,
            message: format!(
                "启动失败: {err}。如果是权限或杀毒拦截，请尝试手动打开游戏目录中的对应 exe。"
            ),
        }),
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
                "未找到 Terraria 世界编号 {world_choice} 对应的 .wld 文件。请确认世界文件位于“文档/My Games/Terraria/Worlds”，或在开服参数里填写完整 world_path。"
            ));
        };
        path.clone()
    };

    if !world_path.exists() {
        return Err(format!(
            "Terraria 世界文件不存在：{}。请检查世界编号或填写完整 world_path。",
            world_path.to_string_lossy()
        ));
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
        format!(
            "已使用 Terraria 命令行参数指定世界文件：{}，因此不应再停留在世界选择界面",
            world_path.to_string_lossy()
        ),
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

fn collect_config_values(
    profile: &LaunchProfile,
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
            let value = config.get(&field.id).and_then(value_to_string);
            if let Some(value) = value {
                values.insert(field.id.clone(), value);
            }
            let required = field.required.unwrap_or(false);
            if required
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

fn render_template(input: &str, values: &HashMap<String, String>) -> String {
    let mut output = input.to_string();
    for (key, value) in values {
        output = output.replace(&format!("{{{{{key}}}}}"), value);
    }
    output
}

fn connection_docs(game_id: &str) -> String {
    match game_id {
        "terraria" => {
            "Terraria 推荐流程：房主启动 TerrariaServer.exe，端口默认 7777；双方加入同一个虚拟局域网后，其他玩家在 Multiplayer -> Join via IP 中输入房主虚拟 IP。".to_string()
        }
        "minecraft_java" => {
            "Minecraft Java 推荐流程：房主启动服务端或开放局域网，其他玩家通过虚拟 IP:25565 连接。".to_string()
        }
        _ => "该游戏暂无专用说明，请参考推荐方案中的连接步骤。".to_string(),
    }
}
