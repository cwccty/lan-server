use std::collections::HashMap;
use std::io::Write;
use std::process::{Command, Stdio};

use serde_json::Value;

use crate::core::game_detector;
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

    match command.spawn() {
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
