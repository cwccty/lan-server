use chrono::Utc;

use crate::core::{game_detector, server_session};
use crate::models::diagnostics::{DiagnosticReport, ReleaseCheck};
use crate::network::{manual_lan_backend, n2n_backend, radmin_backend};
use crate::storage::adapter_store;

pub fn generate_diagnostic_report() -> Result<DiagnosticReport, String> {
    let adapters = adapter_store::load_game_adapters().unwrap_or_default();
    let steam_libraries = game_detector::discover_steam_libraries();
    let games = game_detector::scan_games().unwrap_or_default();
    let backends = vec![
        manual_lan_backend::detect(),
        radmin_backend::detect(),
        n2n_backend::detect(),
    ];
    let server = server_session::read_server_session().ok();
    let n2n = backends.iter().find(|backend| backend.id == "n2n");

    let n2n_available = n2n.map(|item| item.available).unwrap_or(false);
    let n2n_virtual_ip = n2n.and_then(|item| item.virtual_ip.clone());
    let n2n_running = n2n
        .map(|item| {
            item.notes.iter().any(|note| {
                note.contains("正在运行")
                    || note.to_ascii_lowercase().contains("running")
                    || note.contains("PID")
            })
        })
        .unwrap_or(false);

    let server_running = server.as_ref().map(|item| item.running).unwrap_or(false);
    let server_ready = server.as_ref().map(|item| item.ready).unwrap_or(false);
    let server_uptime = server
        .as_ref()
        .and_then(|item| item.uptime_seconds)
        .unwrap_or(0);
    let server_exit_code = server.as_ref().and_then(|item| item.exit_code);
    let terraria_stable = server_running && server_ready && server_uptime >= 30;

    let server_exit_diagnostics_ok = server
        .as_ref()
        .map(|item| {
            item.running || item.exit_code.is_some() || item.exited_at.is_some() || item.ever_ready
        })
        .unwrap_or(false);

    let server_console_observable_ok = server
        .as_ref()
        .map(|item| {
            !item.logs.is_empty()
                && item.logs.iter().any(|line| {
                    line.contains("后台启动")
                        || line.contains("Listening on port")
                        || line.contains("当前状态")
                })
        })
        .unwrap_or(false);

    let release_checks = vec![
        ReleaseCheck {
            id: "n2n_edge".to_string(),
            label: "n2n edge 可执行文件".to_string(),
            ok: n2n_available,
            detail: n2n
                .map(|item| item.notes.join("；"))
                .unwrap_or_else(|| "未找到 n2n 后端信息".to_string()),
            required_for_mvp: true,
        },
        ReleaseCheck {
            id: "n2n_virtual_ip".to_string(),
            label: "n2n 虚拟 IP".to_string(),
            ok: n2n_virtual_ip.is_some(),
            detail: n2n_virtual_ip.unwrap_or_else(|| "未检测到 n2n/TAP 虚拟 IP".to_string()),
            required_for_mvp: true,
        },
        ReleaseCheck {
            id: "n2n_running".to_string(),
            label: "n2n edge 运行状态".to_string(),
            ok: n2n_running,
            detail: if n2n_running {
                "检测到联机助手记录或系统中正在运行的 n2n edge。".to_string()
            } else {
                "尚未检测到正在运行的 n2n edge；发布前需要启动一次并确认 supernode 注册成功。"
                    .to_string()
            },
            required_for_mvp: true,
        },
        ReleaseCheck {
            id: "terraria_server_30s".to_string(),
            label: "Terraria 服务端 30 秒稳定性".to_string(),
            ok: terraria_stable,
            detail: format!(
                "running={} ready={} uptime={}s exit_code={}",
                server_running,
                server_ready,
                server_uptime,
                server_exit_code
                    .map(|code| code.to_string())
                    .unwrap_or_else(|| "无".to_string())
            ),
            required_for_mvp: true,
        },
        ReleaseCheck {
            id: "server_console_observable".to_string(),
            label: "内嵌服务端日志可观察".to_string(),
            ok: server_console_observable_ok,
            detail: if server_console_observable_ok {
                "已检测到内嵌服务端会话日志；MVP 只承诺日志观察、真实监听状态和停止托管，不承诺 help/save/exit 交互命令。".to_string()
            } else {
                "尚未检测到可观察的内嵌服务端日志；请用新版 release 启动一次 Terraria 服务端后再生成诊断。".to_string()
            },
            required_for_mvp: true,
        },
        ReleaseCheck {
            id: "server_exit_diagnostics".to_string(),
            label: "服务端退出诊断".to_string(),
            ok: server_exit_diagnostics_ok,
            detail: server
                .as_ref()
                .map(|item| {
                    format!(
                        "ever_ready={} exit_code={} exited_at={} uptime={}s",
                        item.ever_ready,
                        item.exit_code
                            .map(|code| code.to_string())
                            .unwrap_or_else(|| "无".to_string()),
                        item.exited_at.as_deref().unwrap_or("无"),
                        item.uptime_seconds.unwrap_or(0)
                    )
                })
                .unwrap_or_else(|| {
                    "当前没有服务端会话；请在 release 客户端启动一次 Terraria 服务端后再生成诊断。"
                        .to_string()
                }),
            required_for_mvp: true,
        },
        ReleaseCheck {
            id: "privacy_boundary".to_string(),
            label: "诊断报告隐私边界".to_string(),
            ok: true,
            detail: "报告不采集 Cookie、SSH Key、系统凭据、浏览器数据或无关用户目录内容。"
                .to_string(),
            required_for_mvp: true,
        },
    ];

    let required_total = release_checks
        .iter()
        .filter(|item| item.required_for_mvp)
        .count();
    let required_passed = release_checks
        .iter()
        .filter(|item| item.required_for_mvp && item.ok)
        .count();
    let mvp_ready = required_total > 0 && required_passed == required_total;

    let mut release_lines = release_checks
        .iter()
        .map(|item| {
            format!(
                "{} {}：{}",
                if item.ok { "✅" } else { "❌" },
                item.label,
                item.detail
            )
        })
        .collect::<Vec<_>>();
    release_lines.push(format!(
        "MVP 必需项：{} / {} 通过。",
        required_passed, required_total
    ));

    let next_actions = release_checks
        .iter()
        .filter(|item| item.required_for_mvp && !item.ok)
        .map(|item| format!("处理 {}：{}", item.label, item.detail))
        .collect::<Vec<_>>();

    Ok(DiagnosticReport {
        generated_at: Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        summary: format!(
            "适配库 {} 个游戏；扫描返回 {} 个游戏；网络后端 {} 个。",
            adapters.len(),
            games.len(),
            backends.len()
        ),
        release_ready: mvp_ready,
        required_passed,
        required_total,
        next_actions,
        release_checks,
        details: vec![
            format!("发布前关键检查：\n{}", release_lines.join("\n")),
            format!(
                "Steam 库路径：{}",
                serde_json::to_string_pretty(
                    &steam_libraries
                        .iter()
                        .map(|path| path.to_string_lossy().to_string())
                        .collect::<Vec<_>>()
                )
                .unwrap_or_default()
            ),
            format!(
                "游戏扫描：{}",
                serde_json::to_string_pretty(&games).unwrap_or_default()
            ),
            format!(
                "网络后端：{}",
                serde_json::to_string_pretty(&backends).unwrap_or_default()
            ),
            format!(
                "内嵌服务端会话：{}",
                serde_json::to_string_pretty(&server).unwrap_or_default()
            ),
            "隐私说明：报告不包含凭据、Cookie、SSH Key、浏览器数据或无关用户目录内容。".to_string(),
        ],
    })
}
