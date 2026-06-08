use chrono::Utc;

use crate::core::{game_detector, port_proxy, server_session, udp_broadcast_bridge, udp_proxy};
use crate::models::diagnostics::{DiagnosticIssue, DiagnosticReport, ReleaseCheck};
use crate::models::game::{GameAdapter, GameNetworkType};
use crate::models::network::N2nDiagnostics;
use crate::network::{manual_lan_backend, n2n_backend, radmin_backend};
use crate::storage::adapter_store;

pub fn generate_diagnostic_report() -> Result<DiagnosticReport, String> {
    generate_diagnostic_report_with_context(None)
}

pub fn generate_diagnostic_report_for_game(game_id: &str) -> Result<DiagnosticReport, String> {
    generate_diagnostic_report_with_context(Some(game_id))
}

fn generate_diagnostic_report_with_context(
    selected_game_id: Option<&str>,
) -> Result<DiagnosticReport, String> {
    let adapters = adapter_store::load_game_adapters().unwrap_or_default();
    let steam_libraries = game_detector::discover_steam_libraries();
    let games = game_detector::scan_games().unwrap_or_default();
    let backends = vec![
        manual_lan_backend::detect(),
        radmin_backend::detect(),
        n2n_backend::detect(),
    ];
    let n2n_diagnostics = n2n_backend::diagnose();
    let tcp_proxy_self_test = port_proxy::self_test_port_proxy();
    let udp_proxy_self_test = udp_proxy::self_test_udp_proxy();
    let udp_broadcast_bridge_self_test = udp_broadcast_bridge::self_test_udp_broadcast_bridge();
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

    let server_hosting_observable_ok = server
        .as_ref()
        .map(|item| {
            !item.logs.is_empty()
                && item.logs.iter().any(|line| {
                    line.contains("后台启动")
                        || line.contains("隐藏控制台")
                        || line.contains("当前状态")
                        || line.contains("稳定后台模式")
                })
        })
        .unwrap_or(false);

    let tcp_proxy_self_test_ok = tcp_proxy_self_test
        .as_ref()
        .map(|report| report.ok)
        .unwrap_or(false);
    let tcp_proxy_detail = match &tcp_proxy_self_test {
        Ok(report) => format!(
            "ok={} {} -> {} sent={} received={} connections={} bytes_in={} bytes_out={}",
            report.ok,
            report.listen,
            report.target,
            report.sent,
            report.received,
            report.total_connections,
            report.bytes_in,
            report.bytes_out
        ),
        Err(err) => format!("TCP 端口代理自测失败: {err}"),
    };
    let udp_proxy_self_test_ok = udp_proxy_self_test
        .as_ref()
        .map(|report| report.ok)
        .unwrap_or(false);
    let udp_proxy_detail = match &udp_proxy_self_test {
        Ok(report) => format!(
            "ok={} {} -> {} sent={} received={} packets_in={} packets_out={} bytes_in={} bytes_out={}",
            report.ok,
            report.listen,
            report.target,
            report.sent,
            report.received,
            report.packets_in,
            report.packets_out,
            report.bytes_in,
            report.bytes_out
        ),
        Err(err) => format!("UDP 端口代理自测失败: {err}"),
    };
    let udp_broadcast_bridge_self_test_ok = udp_broadcast_bridge_self_test
        .as_ref()
        .map(|report| report.ok)
        .unwrap_or(false);
    let udp_broadcast_bridge_detail = match &udp_broadcast_bridge_self_test {
        Ok(report) => format!(
            "ok={} {} -> {} sent={} received={} received_packets={} forwarded_packets={} dropped_packets={} bytes_in={} bytes_out={}",
            report.ok,
            report.listen,
            report.forward_targets.join(","),
            report.sent,
            report.received,
            report.received_packets,
            report.forwarded_packets,
            report.dropped_packets,
            report.bytes_in,
            report.bytes_out
        ),
        Err(err) => format!("UDP 广播桥自测失败: {err}"),
    };
    let adapter_requirement_report = build_adapter_requirement_report(
        &adapters,
        &n2n_diagnostics,
        tcp_proxy_self_test_ok,
        udp_proxy_self_test_ok,
        udp_broadcast_bridge_self_test_ok,
        server_running || server_ready,
    );
    let adapter_requirement_ok = adapter_requirement_report.checks.iter().all(|item| item.ok);
    let selected_game_report = selected_game_id.map(|game_id| {
        build_selected_game_requirement_report(
            game_id,
            &adapters,
            &n2n_diagnostics,
            tcp_proxy_self_test_ok,
            udp_proxy_self_test_ok,
            udp_broadcast_bridge_self_test_ok,
            server_running || server_ready,
        )
    });

    let mut release_checks = vec![
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
            id: "n2n_supernode_response".to_string(),
            label: "n2n supernode 响应".to_string(),
            ok: n2n_diagnostics.ok_link
                && !n2n_diagnostics.auth_error
                && !n2n_diagnostics.ip_mac_conflict,
            detail: n2n_diagnostics.summary.clone(),
            required_for_mvp: true,
        },
        ReleaseCheck {
            id: "tcp_port_proxy_self_test".to_string(),
            label: "TCP 端口代理一键自测".to_string(),
            ok: tcp_proxy_self_test_ok,
            detail: tcp_proxy_detail.clone(),
            required_for_mvp: false,
        },
        ReleaseCheck {
            id: "udp_port_proxy_self_test".to_string(),
            label: "UDP 端口代理一键自测".to_string(),
            ok: udp_proxy_self_test_ok,
            detail: udp_proxy_detail.clone(),
            required_for_mvp: false,
        },
        ReleaseCheck {
            id: "udp_broadcast_bridge_self_test".to_string(),
            label: "UDP 广播桥一键自测".to_string(),
            ok: udp_broadcast_bridge_self_test_ok,
            detail: udp_broadcast_bridge_detail.clone(),
            required_for_mvp: false,
        },
        ReleaseCheck {
            id: "adapter_requirement_alignment".to_string(),
            label: "适配器需求与当前能力匹配".to_string(),
            ok: adapter_requirement_ok,
            detail: adapter_requirement_report.summary.clone(),
            required_for_mvp: false,
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
            id: "server_hosting_observable".to_string(),
            label: "内嵌服务端托管状态可观察".to_string(),
            ok: server_hosting_observable_ok,
            detail: if server_hosting_observable_ok {
                "已检测到内嵌服务端托管状态；MVP 只承诺真实进程、真实监听状态和停止托管，不承诺 help/save/exit 交互命令。".to_string()
            } else {
                "尚未检测到可观察的内嵌服务端托管状态；请用新版 release 启动一次 Terraria 服务端后再生成诊断。".to_string()
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
    release_checks.extend(adapter_requirement_report.checks.clone());
    if let Some(report) = &selected_game_report {
        release_checks.extend(report.checks.clone());
    }

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

    let mut issues = classify_n2n_issues(&n2n_diagnostics, n2n_available);
    issues.extend(adapter_requirement_report.issues.clone());
    if let Some(report) = &selected_game_report {
        issues.extend(report.issues.clone());
    }
    if let Err(err) = &tcp_proxy_self_test {
        issues.push(DiagnosticIssue {
            id: "tcp_proxy_self_test_failed".to_string(),
            severity: "warn".to_string(),
            title: "TCP 端口代理自测失败".to_string(),
            detail: format!("一键自测没有完成：{err}"),
            next_actions: vec![
                "检查是否有安全软件拦截本机临时 TCP 监听。".to_string(),
                "确认没有其他程序占用大量本地端口后重试。".to_string(),
                "如果游戏不需要 TCP 端口代理，可暂时忽略该项。".to_string(),
            ],
            evidence: vec![tcp_proxy_detail.clone()],
        });
    }
    if let Err(err) = &udp_proxy_self_test {
        issues.push(DiagnosticIssue {
            id: "udp_proxy_self_test_failed".to_string(),
            severity: "warn".to_string(),
            title: "UDP 端口代理自测失败".to_string(),
            detail: format!("一键 UDP 自测没有完成：{err}"),
            next_actions: vec![
                "检查是否有安全软件拦截本机临时 UDP 监听。".to_string(),
                "确认没有其他程序占用大量本地 UDP 端口后重试。".to_string(),
                "如果游戏不需要 UDP 单播端口代理，可暂时忽略该项。".to_string(),
                "如果问题是游戏列表发现不到房间，后续应使用 UDP 广播桥而不是单播端口代理。"
                    .to_string(),
            ],
            evidence: vec![udp_proxy_detail.clone()],
        });
    }
    if let Err(err) = &udp_broadcast_bridge_self_test {
        issues.push(DiagnosticIssue {
            id: "udp_broadcast_bridge_self_test_failed".to_string(),
            severity: "warn".to_string(),
            title: "UDP 广播桥自测失败".to_string(),
            detail: format!("一键 UDP 广播桥自测没有完成：{err}"),
            next_actions: vec![
                "检查是否有安全软件拦截本机临时 UDP 监听。".to_string(),
                "确认没有其他程序占用大量本地 UDP 端口后重试。".to_string(),
                "如果游戏支持直接 IP 加入，优先使用房主虚拟 IP，不必依赖广播桥。".to_string(),
                "如果游戏依赖房间列表发现，广播桥失败时应把诊断报告发给开发者继续定位。"
                    .to_string(),
            ],
            evidence: vec![udp_broadcast_bridge_detail.clone()],
        });
    }
    if !terraria_stable {
        issues.push(DiagnosticIssue {
            id: "terraria_server_not_stable".to_string(),
            severity: "error".to_string(),
            title: "Terraria 服务端尚未证明 30 秒稳定运行".to_string(),
            detail: format!(
                "running={} ready={} uptime={}s exit_code={}",
                server_running,
                server_ready,
                server_uptime,
                server_exit_code
                    .map(|code| code.to_string())
                    .unwrap_or_else(|| "无".to_string())
            ),
            next_actions: vec![
                "进入 Terraria 向导，在程序内启动服务端。".to_string(),
                "等待至少 30 秒后重新生成诊断报告。".to_string(),
                "如果服务端退出，查看内嵌控制台的最后日志和 exit_code。".to_string(),
            ],
            evidence: vec![serde_json::to_string_pretty(&server)
                .unwrap_or_else(|_| "服务端状态无法序列化".to_string())],
        });
    }
    let most_likely_cause = issues
        .iter()
        .find(|item| item.severity == "error")
        .or_else(|| issues.first())
        .cloned();

    let mut next_actions = issues
        .iter()
        .flat_map(|issue| {
            issue
                .next_actions
                .iter()
                .map(|action| format!("{}：{}", issue.title, action))
        })
        .collect::<Vec<_>>();
    next_actions.extend(
        release_checks
            .iter()
            .filter(|item| item.required_for_mvp && !item.ok)
            .map(|item| format!("处理 {}：{}", item.label, item.detail))
            .collect::<Vec<_>>(),
    );
    next_actions.sort();
    next_actions.dedup();

    Ok(DiagnosticReport {
        generated_at: Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        summary: format!(
            "适配库 {} 个游戏；扫描返回 {} 个游戏；网络后端 {} 个；{}诊断问题 {} 个。",
            adapters.len(),
            games.len(),
            backends.len(),
            selected_game_report
                .as_ref()
                .map(|report| format!("当前游戏：{}；", report.summary))
                .unwrap_or_default(),
            issues.len()
        ),
        most_likely_cause,
        issues,
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
                "n2n 失败分类输入：{}",
                serde_json::to_string_pretty(&n2n_diagnostics).unwrap_or_default()
            ),
            format!(
                "TCP 端口代理自测：{}",
                match &tcp_proxy_self_test {
                    Ok(report) => serde_json::to_string_pretty(report).unwrap_or_default(),
                    Err(err) => err.clone(),
                }
            ),
            format!(
                "UDP 端口代理自测：{}",
                match &udp_proxy_self_test {
                    Ok(report) => serde_json::to_string_pretty(report).unwrap_or_default(),
                    Err(err) => err.clone(),
                }
            ),
            format!(
                "UDP 广播桥自测：{}",
                match &udp_broadcast_bridge_self_test {
                    Ok(report) => serde_json::to_string_pretty(report).unwrap_or_default(),
                    Err(err) => err.clone(),
                }
            ),
            format!(
                "适配器需求巡检：\n{}\n{}",
                adapter_requirement_report.summary,
                adapter_requirement_report.details.join("\n")
            ),
            selected_game_report
                .as_ref()
                .map(|report| {
                    format!(
                        "当前游戏上下文诊断：\n{}\n{}",
                        report.summary,
                        report.details.join("\n")
                    )
                })
                .unwrap_or_else(|| "当前游戏上下文诊断：未选择游戏，执行全局诊断。".to_string()),
            format!(
                "内嵌服务端会话：{}",
                serde_json::to_string_pretty(&server).unwrap_or_default()
            ),
            "隐私说明：报告不包含凭据、Cookie、SSH Key、浏览器数据或无关用户目录内容。".to_string(),
        ],
    })
}

struct AdapterRequirementReport {
    summary: String,
    checks: Vec<ReleaseCheck>,
    issues: Vec<DiagnosticIssue>,
    details: Vec<String>,
}

fn build_adapter_requirement_report(
    adapters: &[GameAdapter],
    n2n_diagnostics: &N2nDiagnostics,
    tcp_proxy_ok: bool,
    udp_proxy_ok: bool,
    udp_broadcast_bridge_ok: bool,
    dedicated_server_observed: bool,
) -> AdapterRequirementReport {
    let mut checks = Vec::new();
    let mut issues = Vec::new();
    let mut details = Vec::new();

    let virtual_lan_ok =
        n2n_diagnostics.ok_link && !n2n_diagnostics.auth_error && !n2n_diagnostics.ip_mac_conflict;

    let virtual_lan_games = adapters
        .iter()
        .filter(|adapter| {
            adapter
                .connection_plan
                .as_ref()
                .map(|plan| plan.requires_virtual_lan)
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    let tcp_proxy_games = adapters
        .iter()
        .filter(|adapter| {
            adapter
                .connection_plan
                .as_ref()
                .map(|plan| plan.requires_tcp_port_proxy)
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    let udp_broadcast_games = adapters
        .iter()
        .filter(|adapter| {
            adapter
                .connection_plan
                .as_ref()
                .map(|plan| plan.requires_udp_broadcast_bridge)
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    let dedicated_server_games = adapters
        .iter()
        .filter(|adapter| {
            adapter
                .connection_plan
                .as_ref()
                .map(|plan| plan.requires_dedicated_server)
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    let unknown_games = adapters
        .iter()
        .filter(|adapter| {
            matches!(
                adapter.network_type,
                Some(GameNetworkType::UnknownNeedReview)
            ) || adapter.connection_plan.is_none()
        })
        .collect::<Vec<_>>();
    let udp_proxy_candidate_games = adapters
        .iter()
        .filter(|adapter| {
            matches!(
                adapter.network_type,
                Some(GameNetworkType::TcpPortProxyNeeded)
            )
        })
        .collect::<Vec<_>>();

    push_adapter_check(
        &mut checks,
        "adapter_requires_virtual_lan",
        "需要虚拟局域网的适配器",
        virtual_lan_games.is_empty() || virtual_lan_ok,
        format!(
            "{} 个适配器声明需要虚拟局域网；当前 n2n ACK/PONG={}",
            virtual_lan_games.len(),
            virtual_lan_ok
        ),
    );
    if !virtual_lan_games.is_empty() && !virtual_lan_ok {
        issues.push(adapter_issue(
            "adapter_virtual_lan_not_ready",
            "error",
            "有游戏方案需要虚拟局域网，但 n2n 尚未就绪",
            "适配器声明需要虚拟局域网；当前诊断没有证明 n2n 已 ACK/PONG。",
            vec![
                "进入通用组网中心，启动 n2n edge。".to_string(),
                "等待 supernode ACK/PONG 后重新生成诊断报告。".to_string(),
                "确认每台电脑虚拟 IP 不重复。".to_string(),
            ],
            &virtual_lan_games,
            vec![n2n_diagnostics.summary.clone()],
        ));
    }

    push_adapter_check(
        &mut checks,
        "adapter_requires_tcp_proxy",
        "需要 TCP 端口代理的适配器",
        tcp_proxy_games.is_empty() || tcp_proxy_ok,
        format!(
            "{} 个适配器声明需要 TCP 代理；TCP 自测={}",
            tcp_proxy_games.len(),
            tcp_proxy_ok
        ),
    );
    if !tcp_proxy_games.is_empty() && !tcp_proxy_ok {
        issues.push(adapter_issue(
            "adapter_tcp_proxy_not_ready",
            "warn",
            "有游戏方案需要 TCP 端口代理，但 TCP 代理能力未通过自测",
            "适配器声明需要 TCP 端口代理；当前 TCP 代理一键自测未通过。",
            vec![
                "进入通用组网中心，运行“一键自测 TCP 代理”。".to_string(),
                "如果自测失败，检查本机安全软件和端口占用。".to_string(),
                "房主侧按游戏端口启动 TCP 端口代理后再邀请好友。".to_string(),
            ],
            &tcp_proxy_games,
            Vec::new(),
        ));
    }

    push_adapter_check(
        &mut checks,
        "adapter_requires_udp_broadcast_bridge",
        "需要 UDP 广播桥的适配器",
        udp_broadcast_games.is_empty() || udp_broadcast_bridge_ok,
        format!(
            "{} 个适配器声明需要 UDP 广播桥；广播桥自测={}",
            udp_broadcast_games.len(),
            udp_broadcast_bridge_ok
        ),
    );
    if !udp_broadcast_games.is_empty() && !udp_broadcast_bridge_ok {
        issues.push(adapter_issue(
            "adapter_udp_broadcast_bridge_not_ready",
            "warn",
            "有游戏方案需要 UDP 广播桥，但广播桥能力未通过自测",
            "适配器声明需要 UDP 广播桥；当前 UDP 广播桥一键自测未通过。",
            vec![
                "进入通用组网中心，运行“一键自测 UDP 广播桥”。".to_string(),
                "如果游戏支持直接 IP 加入，优先使用房主虚拟 IP。".to_string(),
                "如果游戏只能靠房间列表发现，广播桥自测失败时请提交诊断报告。".to_string(),
            ],
            &udp_broadcast_games,
            Vec::new(),
        ));
    }

    push_adapter_check(
        &mut checks,
        "adapter_requires_dedicated_server",
        "需要专用服务端的适配器",
        dedicated_server_games.is_empty() || dedicated_server_observed,
        format!(
            "{} 个适配器声明需要专用服务端；当前服务端会话 running/ready={}",
            dedicated_server_games.len(),
            dedicated_server_observed
        ),
    );
    if !dedicated_server_games.is_empty() && !dedicated_server_observed {
        issues.push(adapter_issue(
            "adapter_dedicated_server_not_observed",
            "warn",
            "有游戏方案需要专用服务端，但当前没有观察到服务端会话",
            "适配器声明需要专用服务端；诊断时没有检测到内嵌服务端会话 running/ready。",
            vec![
                "如果正在测试 Terraria，先在 Terraria 向导里启动服务端。".to_string(),
                "如果是其他游戏，按 adapter 的房主步骤启动服务端后再生成诊断。".to_string(),
                "如果游戏只需要游戏内开房，可在 adapter 中把 requires_dedicated_server 改为 false。".to_string(),
            ],
            &dedicated_server_games,
            Vec::new(),
        ));
    }

    push_adapter_check(
        &mut checks,
        "adapter_unknown_need_review",
        "未知或未沉淀方案的适配器",
        unknown_games.is_empty(),
        format!(
            "{} 个适配器仍需要管理员判断或缺少 connection_plan",
            unknown_games.len()
        ),
    );
    if !unknown_games.is_empty() {
        issues.push(adapter_issue(
            "adapter_unknown_need_review",
            "warn",
            "存在未知或未沉淀连接方案的游戏",
            "这些游戏不能伪装成已支持，需要管理员认定网络类型并补齐 connection_plan。",
            vec![
                "进入适配器管理页，选择游戏网络类型。".to_string(),
                "填写房主步骤、加入者步骤、默认端口和是否需要代理/广播桥。".to_string(),
                "保存为本地 adapter 草稿后再同步到共享库。".to_string(),
            ],
            &unknown_games,
            Vec::new(),
        ));
    }

    push_adapter_check(
        &mut checks,
        "adapter_udp_proxy_optional",
        "UDP 单播代理候选适配器",
        udp_proxy_candidate_games.is_empty() || udp_proxy_ok,
        format!(
            "{} 个适配器属于端口代理候选；UDP 单播代理自测={}",
            udp_proxy_candidate_games.len(),
            udp_proxy_ok
        ),
    );

    details.push(format_adapter_group("需要虚拟局域网", &virtual_lan_games));
    details.push(format_adapter_group("需要 TCP 代理", &tcp_proxy_games));
    details.push(format_adapter_group(
        "需要 UDP 广播桥",
        &udp_broadcast_games,
    ));
    details.push(format_adapter_group(
        "需要专用服务端",
        &dedicated_server_games,
    ));
    details.push(format_adapter_group("未知/待判断", &unknown_games));

    let failed = checks.iter().filter(|item| !item.ok).count();
    AdapterRequirementReport {
        summary: format!(
            "适配器需求巡检：{} 个检查，{} 个未满足；n2n={} TCP自测={} UDP自测={} 广播桥自测={} 服务端观测={}",
            checks.len(),
            failed,
            virtual_lan_ok,
            tcp_proxy_ok,
            udp_proxy_ok,
            udp_broadcast_bridge_ok,
            dedicated_server_observed
        ),
        checks,
        issues,
        details,
    }
}

fn build_selected_game_requirement_report(
    game_id: &str,
    adapters: &[GameAdapter],
    n2n_diagnostics: &N2nDiagnostics,
    tcp_proxy_ok: bool,
    udp_proxy_ok: bool,
    udp_broadcast_bridge_ok: bool,
    dedicated_server_observed: bool,
) -> AdapterRequirementReport {
    let mut checks = Vec::new();
    let mut issues = Vec::new();
    let mut details = Vec::new();
    let selected = adapters.iter().find(|adapter| adapter.game_id == game_id);
    let virtual_lan_ok =
        n2n_diagnostics.ok_link && !n2n_diagnostics.auth_error && !n2n_diagnostics.ip_mac_conflict;

    let Some(adapter) = selected else {
        push_adapter_check(
            &mut checks,
            "selected_game_adapter_found",
            "当前游戏适配器存在",
            false,
            format!("未找到 game_id={game_id} 的适配器；可能还没有扫描或同步共享库。"),
        );
        issues.push(DiagnosticIssue {
            id: "selected_game_adapter_missing".to_string(),
            severity: "warn".to_string(),
            title: "当前游戏没有可用适配器".to_string(),
            detail: format!("诊断时没有找到 game_id={game_id} 的 adapter，因此无法判断这个游戏需要哪种联机能力。"),
            next_actions: vec![
                "先进入游戏扫描页确认游戏是否被识别。".to_string(),
                "进入适配器管理页同步共享库或创建本地 adapter 草稿。".to_string(),
                "管理员认定游戏网络类型后，再重新生成当前游戏诊断。".to_string(),
            ],
            evidence: vec![format!("selected_game_id={game_id}")],
        });
        return AdapterRequirementReport {
            summary: format!("未找到当前游戏适配器 game_id={game_id}"),
            checks,
            issues,
            details: vec![format!("selected_game_id={game_id}；适配器不存在")],
        };
    };

    push_adapter_check(
        &mut checks,
        "selected_game_adapter_found",
        "当前游戏适配器存在",
        true,
        format!(
            "{}({}) source={} network_type={:?}",
            adapter.display_name,
            adapter.game_id,
            adapter.adapter_source.as_deref().unwrap_or("unknown"),
            adapter.network_type
        ),
    );

    let plan = adapter.connection_plan.as_ref();
    push_adapter_check(
        &mut checks,
        "selected_game_connection_plan",
        "当前游戏连接方案已沉淀",
        plan.is_some()
            && !matches!(
                adapter.network_type,
                Some(GameNetworkType::UnknownNeedReview)
            ),
        plan.map(|item| item.summary.clone())
            .unwrap_or_else(|| "当前 adapter 缺少 connection_plan。".to_string()),
    );

    if plan.is_none()
        || matches!(
            adapter.network_type,
            Some(GameNetworkType::UnknownNeedReview)
        )
    {
        issues.push(adapter_issue(
            "selected_game_unknown_need_review",
            "warn",
            "当前游戏还没有完成方案认定",
            "当前游戏缺少可复用 connection_plan，或仍标记为 unknown_need_review；不能把它伪装成已经支持。",
            vec![
                "进入适配器管理页，选择该游戏真实网络类型。".to_string(),
                "补齐房主步骤、加入者步骤、默认端口和能力需求。".to_string(),
                "保存后可导出并提交到共享 adapter registry。".to_string(),
            ],
            &[adapter],
            Vec::new(),
        ));
    }

    let requires_virtual_lan = plan.map(|item| item.requires_virtual_lan).unwrap_or(false);
    let requires_tcp_proxy = plan
        .map(|item| item.requires_tcp_port_proxy)
        .unwrap_or(false);
    let requires_udp_broadcast_bridge = plan
        .map(|item| item.requires_udp_broadcast_bridge)
        .unwrap_or(false);
    let requires_dedicated_server = plan
        .map(|item| item.requires_dedicated_server)
        .unwrap_or(false);
    let udp_proxy_candidate = matches!(
        adapter.network_type,
        Some(GameNetworkType::TcpPortProxyNeeded)
    );

    push_adapter_check(
        &mut checks,
        "selected_game_virtual_lan_ready",
        "当前游戏所需虚拟局域网",
        !requires_virtual_lan || virtual_lan_ok,
        format!(
            "requires_virtual_lan={}；n2n ACK/PONG={}",
            requires_virtual_lan, virtual_lan_ok
        ),
    );
    if requires_virtual_lan && !virtual_lan_ok {
        issues.push(adapter_issue(
            "selected_game_virtual_lan_not_ready",
            "error",
            "当前游戏需要虚拟局域网，但 n2n 尚未就绪",
            "当前游戏连接方案声明需要虚拟局域网；诊断没有证明 n2n 已 ACK/PONG。",
            vec![
                "进入通用组网中心，启动 n2n edge。".to_string(),
                "确认 supernode 地址、community、secret 与好友一致。".to_string(),
                "等待 ACK/PONG 后重新生成当前游戏诊断。".to_string(),
            ],
            &[adapter],
            vec![n2n_diagnostics.summary.clone()],
        ));
    }

    push_adapter_check(
        &mut checks,
        "selected_game_tcp_proxy_ready",
        "当前游戏所需 TCP 端口代理",
        !requires_tcp_proxy || tcp_proxy_ok,
        format!(
            "requires_tcp_port_proxy={}；TCP 代理自测={}",
            requires_tcp_proxy, tcp_proxy_ok
        ),
    );
    if requires_tcp_proxy && !tcp_proxy_ok {
        issues.push(adapter_issue(
            "selected_game_tcp_proxy_not_ready",
            "warn",
            "当前游戏需要 TCP 端口代理，但代理能力未通过自测",
            "当前游戏可能只监听 127.0.0.1 或需要把虚拟 IP 端口转发到本机服务端。",
            vec![
                "进入通用组网中心，运行“一键自测 TCP 代理”。".to_string(),
                "房主侧启动 TCP 端口代理：虚拟 IP/0.0.0.0:游戏端口 -> 127.0.0.1:游戏端口。"
                    .to_string(),
                "把代理状态写入邀请包后再发给好友。".to_string(),
            ],
            &[adapter],
            Vec::new(),
        ));
    }

    push_adapter_check(
        &mut checks,
        "selected_game_udp_proxy_candidate",
        "当前游戏 UDP 单播代理候选",
        !udp_proxy_candidate || udp_proxy_ok,
        format!(
            "udp_proxy_candidate={}；UDP 单播代理自测={}",
            udp_proxy_candidate, udp_proxy_ok
        ),
    );

    push_adapter_check(
        &mut checks,
        "selected_game_udp_broadcast_bridge_ready",
        "当前游戏所需 UDP 广播桥",
        !requires_udp_broadcast_bridge || udp_broadcast_bridge_ok,
        format!(
            "requires_udp_broadcast_bridge={}；UDP 广播桥自测={}",
            requires_udp_broadcast_bridge, udp_broadcast_bridge_ok
        ),
    );
    if requires_udp_broadcast_bridge && !udp_broadcast_bridge_ok {
        issues.push(adapter_issue(
            "selected_game_udp_broadcast_bridge_not_ready",
            "warn",
            "当前游戏需要 UDP 广播桥，但广播桥能力未通过自测",
            "当前游戏连接方案依赖 LAN 广播/房间发现；仅有 n2n 虚拟 IP 不一定能让房间出现在列表里。",
            vec![
                "进入通用组网中心，运行“一键自测 UDP 广播桥”。".to_string(),
                "如果游戏支持直接 IP 加入，优先使用房主虚拟 IP 绕过房间列表。".to_string(),
                "如果必须靠房间列表发现，广播桥失败时提交诊断报告继续定位。".to_string(),
            ],
            &[adapter],
            Vec::new(),
        ));
    }

    push_adapter_check(
        &mut checks,
        "selected_game_dedicated_server_ready",
        "当前游戏所需专用服务端",
        !requires_dedicated_server || dedicated_server_observed,
        format!(
            "requires_dedicated_server={}；服务端 running/ready={}",
            requires_dedicated_server, dedicated_server_observed
        ),
    );
    if requires_dedicated_server && !dedicated_server_observed {
        issues.push(adapter_issue(
            "selected_game_dedicated_server_not_observed",
            "warn",
            "当前游戏需要专用服务端，但未观察到服务端运行",
            "当前游戏方案声明需要服务端；诊断时没有看到内嵌服务端会话 running/ready。",
            vec![
                "按推荐方案中的房主步骤启动服务端。".to_string(),
                "如果是 Terraria，进入 Terraria 向导并在程序内启动服务端。".to_string(),
                "服务端稳定监听后重新生成当前游戏诊断。".to_string(),
            ],
            &[adapter],
            Vec::new(),
        ));
    }

    details.push(format!(
        "当前游戏：{}({}) source={} network_type={:?}",
        adapter.display_name,
        adapter.game_id,
        adapter.adapter_source.as_deref().unwrap_or("unknown"),
        adapter.network_type
    ));
    details.push(format!(
        "需求：virtual_lan={} tcp_proxy={} udp_proxy_candidate={} udp_broadcast_bridge={} dedicated_server={}",
        requires_virtual_lan,
        requires_tcp_proxy,
        udp_proxy_candidate,
        requires_udp_broadcast_bridge,
        requires_dedicated_server
    ));
    details.push(format!(
        "当前能力：n2n={} tcp_proxy={} udp_proxy={} udp_broadcast_bridge={} dedicated_server={}",
        virtual_lan_ok,
        tcp_proxy_ok,
        udp_proxy_ok,
        udp_broadcast_bridge_ok,
        dedicated_server_observed
    ));
    if let Some(plan) = plan {
        details.push(format!("房主步骤：{}", plan.host_role));
        details.push(format!("加入者步骤：{}", plan.join_role));
        if let Some(port) = plan.default_join_port {
            details.push(format!("默认加入端口：{}", port));
        }
    }

    let failed = checks.iter().filter(|item| !item.ok).count();
    AdapterRequirementReport {
        summary: format!(
            "{}({}) 当前游戏检查 {} 项，{} 项未满足",
            adapter.display_name,
            adapter.game_id,
            checks.len(),
            failed
        ),
        checks,
        issues,
        details,
    }
}

fn push_adapter_check(
    checks: &mut Vec<ReleaseCheck>,
    id: &str,
    label: &str,
    ok: bool,
    detail: String,
) {
    checks.push(ReleaseCheck {
        id: id.to_string(),
        label: label.to_string(),
        ok,
        detail,
        required_for_mvp: false,
    });
}

fn adapter_issue(
    id: &str,
    severity: &str,
    title: &str,
    detail: &str,
    next_actions: Vec<String>,
    adapters: &[&GameAdapter],
    extra_evidence: Vec<String>,
) -> DiagnosticIssue {
    let mut evidence = adapters
        .iter()
        .take(12)
        .map(|adapter| {
            let plan = adapter.connection_plan.as_ref();
            format!(
                "{}({}) source={} network_type={:?} plan={}",
                adapter.display_name,
                adapter.game_id,
                adapter.adapter_source.as_deref().unwrap_or("unknown"),
                adapter.network_type,
                plan.map(|item| item.summary.as_str())
                    .unwrap_or("无 connection_plan")
            )
        })
        .collect::<Vec<_>>();
    if adapters.len() > 12 {
        evidence.push(format!("还有 {} 个适配器未展开。", adapters.len() - 12));
    }
    evidence.extend(extra_evidence);
    DiagnosticIssue {
        id: id.to_string(),
        severity: severity.to_string(),
        title: title.to_string(),
        detail: detail.to_string(),
        next_actions,
        evidence,
    }
}

fn format_adapter_group(label: &str, adapters: &[&GameAdapter]) -> String {
    let names = adapters
        .iter()
        .take(20)
        .map(|adapter| format!("{}({})", adapter.display_name, adapter.game_id))
        .collect::<Vec<_>>();
    let suffix = if adapters.len() > 20 {
        format!("，另有 {} 个未列出", adapters.len() - 20)
    } else {
        String::new()
    };
    format!(
        "{}：{} 个{}{}",
        label,
        adapters.len(),
        if names.is_empty() {
            String::new()
        } else {
            format!("：{}", names.join("、"))
        },
        suffix
    )
}

fn classify_n2n_issues(diagnostics: &N2nDiagnostics, edge_available: bool) -> Vec<DiagnosticIssue> {
    let mut issues = Vec::new();

    if !edge_available || !diagnostics.executable_found {
        issues.push(DiagnosticIssue {
            id: "n2n_edge_missing".to_string(),
            severity: "error".to_string(),
            title: "组网程序文件缺失".to_string(),
            detail: "没有找到组网程序 edge.exe / n2n.exe，无法启动虚拟组网。".to_string(),
            next_actions: vec![
                "确认安装包目录 tools/n2n 下存在 edge.exe 或 n2n.exe。".to_string(),
                "如果是绿色包，请重新解压完整 ZIP 后再启动。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if !diagnostics.supernode_configured {
        issues.push(DiagnosticIssue {
            id: "n2n_supernode_missing".to_string(),
            severity: "error".to_string(),
            title: "中继地址未配置".to_string(),
            detail: "尚未填写中继地址，组网程序不知道要连接到哪里。".to_string(),
            next_actions: vec![
                "在“加入与组网”里填写中继地址，例如 VPS_IP:7777。".to_string(),
                "确认房主和加入者使用同一个中继地址、房间名和密钥。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
        return issues;
    }

    if !diagnostics.running {
        issues.push(DiagnosticIssue {
            id: if diagnostics.recorded_pid.is_some() {
                "n2n_pid_stale_or_exited"
            } else {
                "n2n_edge_not_running"
            }
            .to_string(),
            severity: "error".to_string(),
            title: if diagnostics.recorded_pid.is_some() {
                "组网程序已退出 / PID 已过期"
            } else {
                "已配置未启动"
            }
            .to_string(),
            detail: "已保存组网信息，但当前没有检测到运行中的组网程序。".to_string(),
            next_actions: vec![
                "点击“启动组网服务”重新启动。".to_string(),
                "如果启动后又变成未启动，请复制手动启动命令和组网日志。".to_string(),
                "必要时用管理员权限运行联机助手，并检查安全软件是否拦截组网程序。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if diagnostics.auth_error {
        issues.push(DiagnosticIssue {
            id: "n2n_auth_error".to_string(),
            severity: "error".to_string(),
            title: "房间名或密钥不一致".to_string(),
            detail: "中继拒绝加入，通常是房主和加入者的房间名或密钥不一致。".to_string(),
            next_actions: vec![
                "让双方重新复制同一份邀请包或房间凭证。".to_string(),
                "确认没有多余空格、全角字符或输入法替换。".to_string(),
                "保存后停止组网，再重新启动。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if diagnostics.ip_mac_conflict {
        issues.push(DiagnosticIssue {
            id: "n2n_ip_mac_conflict".to_string(),
            severity: "error".to_string(),
            title: "联机地址冲突".to_string(),
            detail: "当前联机地址可能已被其他机器占用，或旧连接尚未释放。".to_string(),
            next_actions: vec![
                "给每个人分配不同的联机地址，例如 10.10.10.2、10.10.10.3。".to_string(),
                "停止组网后等待十几秒再启动。".to_string(),
                "如果仍冲突，请重启联机助手或电脑后再试。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if diagnostics.not_responding && !diagnostics.ok_link {
        issues.push(DiagnosticIssue {
            id: "n2n_supernode_not_responding".to_string(),
            severity: "error".to_string(),
            title: "中继地址暂无响应".to_string(),
            detail: "组网程序已尝试连接中继，但没有收到回应。".to_string(),
            next_actions: vec![
                "核对中继地址和端口是否填写正确。".to_string(),
                "确认中继服务器已启动，并且服务器/路由器放行对应端口。".to_string(),
                "复制手动启动命令和组网日志给管理员排查。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if diagnostics.tap_error {
        issues.push(DiagnosticIssue {
            id: "n2n_tap_device_error".to_string(),
            severity: "error".to_string(),
            title: "虚拟网卡/组网网卡异常".to_string(),
            detail: "组网程序无法打开 TAP/Wintun 虚拟网卡，通常和驱动、权限或安全软件有关。"
                .to_string(),
            next_actions: vec![
                "尝试用管理员权限启动联机助手。".to_string(),
                "检查系统里是否存在 TAP/Wintun 虚拟网卡。".to_string(),
                "复制组网日志中 Cannot find TAP device / unable to open tap 等关键行。"
                    .to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if diagnostics.running
        && diagnostics.supernode_configured
        && !diagnostics.ok_link
        && !diagnostics.auth_error
        && !diagnostics.ip_mac_conflict
        && !diagnostics.not_responding
        && !diagnostics.tap_error
    {
        issues.push(DiagnosticIssue {
            id: "n2n_waiting_for_ack".to_string(),
            severity: "warn".to_string(),
            title: "组网程序已启动，但中继尚未确认".to_string(),
            detail: "组网程序进程存在，但日志里还没有看到中继确认 ACK/PONG，不能只继续等待。"
                .to_string(),
            next_actions: vec![
                "核对双方中继地址、房间名、密钥和联机地址是否一致。".to_string(),
                "复制手动启动命令，在管理员终端中运行一次观察输出。".to_string(),
                "查看并复制最近组网日志。".to_string(),
                "即使已关闭 Windows 防火墙，也要确认路由器、校园网/公司网、运营商网络或安全软件没有拦截 UDP 出站。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if diagnostics.virtual_ip.is_none() {
        issues.push(DiagnosticIssue {
            id: "n2n_virtual_ip_missing".to_string(),
            severity: "warn".to_string(),
            title: "联机地址未读取到".to_string(),
            detail: "系统里暂时没有读取到 n2n/TAP/cfw/edge 对应的联机地址。".to_string(),
            next_actions: vec![
                "等待组网程序收到中继确认后刷新状态。".to_string(),
                "检查虚拟网卡是否被禁用。".to_string(),
                "手动填写本机联机地址后再生成邀请包。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    issues
}

fn diagnostic_evidence(diagnostics: &N2nDiagnostics) -> Vec<String> {
    let mut evidence = vec![
        diagnostics.summary.clone(),
        format!("connection_state={}", diagnostics.connection_state),
        format!("executable_found={}", diagnostics.executable_found),
        format!(
            "executable_path={}",
            diagnostics
                .executable_path
                .clone()
                .unwrap_or_else(|| "none".to_string())
        ),
        format!(
            "recorded_pid={}",
            diagnostics
                .recorded_pid
                .map(|pid| pid.to_string())
                .unwrap_or_else(|| "none".to_string())
        ),
        format!("recorded_pid_running={}", diagnostics.recorded_pid_running),
        format!("running={}", diagnostics.running),
        format!("ok_link={}", diagnostics.ok_link),
        format!("ack={}", diagnostics.ack),
        format!("pong={}", diagnostics.pong),
        format!(
            "supernode={}",
            diagnostics
                .supernode
                .clone()
                .unwrap_or_else(|| "none".to_string())
        ),
        format!(
            "virtual_ip={}",
            diagnostics
                .virtual_ip
                .clone()
                .unwrap_or_else(|| "none".to_string())
        ),
        format!("log_path={}", diagnostics.log_path),
    ];
    if let Some(command) = &diagnostics.manual_start_command {
        evidence.push(format!("manual_start_command={command}"));
    }
    if let Some(error) = &diagnostics.last_error {
        evidence.push(format!("last_error={error}"));
    }
    evidence.extend(diagnostics.recent_logs.iter().rev().take(8).cloned());
    evidence
}
