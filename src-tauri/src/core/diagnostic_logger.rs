use chrono::Utc;

use crate::core::{game_detector, port_proxy, server_session, udp_broadcast_bridge, udp_proxy};
use crate::models::diagnostics::{DiagnosticIssue, DiagnosticReport, ReleaseCheck};
use crate::models::network::N2nDiagnostics;
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
                "如果问题是游戏列表发现不到房间，后续应使用 UDP 广播桥而不是单播端口代理。".to_string(),
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
                "如果游戏依赖房间列表发现，广播桥失败时应把诊断报告发给开发者继续定位。".to_string(),
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
            evidence: vec![
                serde_json::to_string_pretty(&server).unwrap_or_else(|_| "服务端状态无法序列化".to_string()),
            ],
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
    next_actions.extend(release_checks
        .iter()
        .filter(|item| item.required_for_mvp && !item.ok)
        .map(|item| format!("处理 {}：{}", item.label, item.detail))
        .collect::<Vec<_>>());
    next_actions.sort();
    next_actions.dedup();

    Ok(DiagnosticReport {
        generated_at: Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        summary: format!(
            "适配库 {} 个游戏；扫描返回 {} 个游戏；网络后端 {} 个；诊断问题 {} 个。",
            adapters.len(),
            games.len(),
            backends.len(),
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
                "内嵌服务端会话：{}",
                serde_json::to_string_pretty(&server).unwrap_or_default()
            ),
            "隐私说明：报告不包含凭据、Cookie、SSH Key、浏览器数据或无关用户目录内容。".to_string(),
        ],
    })
}

fn classify_n2n_issues(diagnostics: &N2nDiagnostics, edge_available: bool) -> Vec<DiagnosticIssue> {
    let mut issues = Vec::new();

    if !edge_available {
        issues.push(DiagnosticIssue {
            id: "n2n_edge_missing".to_string(),
            severity: "error".to_string(),
            title: "未检测到 n2n edge".to_string(),
            detail: "客户端没有找到 edge.exe / n2n.exe，无法启动内置 n2n 组网。".to_string(),
            next_actions: vec![
                "确认 tools/n2n 目录下存在官方源码编译的 edge.exe 或 n2n.exe。".to_string(),
                "重新打开通用组网中心并刷新组网状态。".to_string(),
            ],
            evidence: vec![diagnostics.summary.clone()],
        });
    }

    if !diagnostics.supernode_configured {
        issues.push(DiagnosticIssue {
            id: "n2n_supernode_missing".to_string(),
            severity: "error".to_string(),
            title: "未配置 supernode".to_string(),
            detail: "n2n 需要 VPS 上的 supernode 地址用于异地节点发现。".to_string(),
            next_actions: vec![
                "在通用组网中心填写 supernode，例如 VPS_IP:7777。".to_string(),
                "确认 VPS 上 supernode 正在监听对应端口。".to_string(),
            ],
            evidence: vec![diagnostics.summary.clone()],
        });
        return issues;
    }

    if !diagnostics.running {
        issues.push(DiagnosticIssue {
            id: "n2n_edge_not_running".to_string(),
            severity: "error".to_string(),
            title: "n2n edge 未运行".to_string(),
            detail: "已经配置 supernode，但当前没有检测到由联机助手记录的 edge 进程。".to_string(),
            next_actions: vec![
                "在通用组网中心点击“启动 n2n edge”。".to_string(),
                "启动后等待 10-20 秒，再查看是否出现 ACK/PONG。".to_string(),
            ],
            evidence: vec![diagnostics.summary.clone()],
        });
    }

    if diagnostics.auth_error {
        issues.push(DiagnosticIssue {
            id: "n2n_auth_error".to_string(),
            severity: "error".to_string(),
            title: "n2n 认证错误".to_string(),
            detail: "edge 日志显示认证失败，常见原因是 community 或密钥与朋友不一致。".to_string(),
            next_actions: vec![
                "确认所有玩家填写相同 community。".to_string(),
                "确认所有玩家填写相同 n2n 密钥。".to_string(),
                "保存配置后停止并重新启动 n2n edge。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if diagnostics.ip_mac_conflict {
        issues.push(DiagnosticIssue {
            id: "n2n_ip_mac_conflict".to_string(),
            severity: "error".to_string(),
            title: "n2n IP / MAC 冲突".to_string(),
            detail: "supernode 返回 IP 或 MAC 已被占用，通常是虚拟 IP 重复或旧注册未释放。".to_string(),
            next_actions: vec![
                "给每台电脑分配不同虚拟 IP，例如房主 10.10.10.2，朋友 10.10.10.3。".to_string(),
                "点击通用组网中心的候选 IP 按钮或手动更换本机虚拟 IP。".to_string(),
                "停止 n2n edge 后重新启动；必要时等待 supernode 释放旧注册。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if diagnostics.not_responding && !diagnostics.ok_link {
        issues.push(DiagnosticIssue {
            id: "n2n_supernode_not_responding".to_string(),
            severity: "error".to_string(),
            title: "supernode 无响应".to_string(),
            detail: "edge 日志显示 supernode 没有响应，通常是 VPS 服务未运行、端口未放行或地址填写错误。".to_string(),
            next_actions: vec![
                "在 VPS 上确认 supernode 进程正在监听，例如 ss -lunp | grep 7777。".to_string(),
                "确认 VPS 安全组和系统防火墙放行 UDP/TCP 7777。".to_string(),
                "确认客户端填写的是正确的 VPS_IP:端口。".to_string(),
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
    {
        issues.push(DiagnosticIssue {
            id: "n2n_waiting_for_ack".to_string(),
            severity: "warn".to_string(),
            title: "n2n 正在等待 ACK/PONG".to_string(),
            detail: "edge 已运行且 supernode 已配置，但日志中尚未看到 ACK/PONG。".to_string(),
            next_actions: vec![
                "等待 10-20 秒后刷新组网状态。".to_string(),
                "如果仍无 ACK/PONG，检查 supernode 地址、防火墙和网络连通性。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    if diagnostics.virtual_ip.is_none() {
        issues.push(DiagnosticIssue {
            id: "n2n_virtual_ip_missing".to_string(),
            severity: "warn".to_string(),
            title: "未检测到 n2n 虚拟 IP".to_string(),
            detail: "系统网卡扫描没有发现 n2n/TAP/cfw/edge 相关 10.x 虚拟地址。".to_string(),
            next_actions: vec![
                "确认 TAP 驱动或 n2n 虚拟网卡已经创建。".to_string(),
                "启动 n2n edge 后重新刷新状态。".to_string(),
                "如果虚拟 IP 被分配到其他网卡名称，请生成诊断报告发给开发者。".to_string(),
            ],
            evidence: diagnostic_evidence(diagnostics),
        });
    }

    issues
}

fn diagnostic_evidence(diagnostics: &N2nDiagnostics) -> Vec<String> {
    let mut evidence = vec![
        diagnostics.summary.clone(),
        format!("log_path={}", diagnostics.log_path),
    ];
    if let Some(error) = &diagnostics.last_error {
        evidence.push(format!("last_error={error}"));
    }
    evidence.extend(diagnostics.recent_logs.iter().rev().take(8).cloned());
    evidence
}
