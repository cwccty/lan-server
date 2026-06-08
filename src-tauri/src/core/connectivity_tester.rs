use std::net::{IpAddr, TcpStream, ToSocketAddrs};
use std::process::Command;
use std::time::{Duration, Instant};

use crate::core::process_util::hide_console_window;
use crate::models::network::{ConnectivityReport, ConnectivityTarget, PortCheckResult};

pub fn test_connectivity(target: ConnectivityTarget) -> Result<ConnectivityReport, String> {
    let timeout = Duration::from_millis(target.timeout_ms.unwrap_or(1200));
    let mut ports = Vec::new();

    for port in &target.ports {
        let start = Instant::now();
        let check = check_port(&target, *port, timeout, start)?;
        ports.push(check);
    }

    let reachable = ports.iter().any(|item| item.reachable);
    let latency_ms = ports.iter().filter_map(|item| item.latency_ms).min();
    let notes = build_notes(&target, reachable, &ports);
    Ok(ConnectivityReport {
        target_host: target.host,
        reachable,
        latency_ms,
        ports,
        notes,
    })
}

fn check_port(
    target: &ConnectivityTarget,
    port: u16,
    timeout: Duration,
    start: Instant,
) -> Result<PortCheckResult, String> {
    let protocol = normalize_protocol(target.protocol.as_deref());
    match protocol {
        "udp" => Ok(check_udp_listener(&target.host, port, start)),
        "tcp_udp" => {
            let tcp = check_tcp(&target.host, port, timeout, start)?;
            if tcp.reachable {
                return Ok(tcp);
            }
            if is_local_host(&target.host) {
                let udp = check_udp_listener(&target.host, port, start);
                if udp.reachable {
                    return Ok(udp);
                }
                return Ok(PortCheckResult {
                    port,
                    reachable: false,
                    latency_ms: None,
                    error: Some(format!(
                        "TCP 检测失败：{}；UDP 本机监听也未发现",
                        tcp.error.unwrap_or_else(|| "未知原因".to_string())
                    )),
                });
            }
            Ok(tcp)
        }
        _ => check_tcp(&target.host, port, timeout, start),
    }
}

fn check_tcp(
    host: &str,
    port: u16,
    timeout: Duration,
    start: Instant,
) -> Result<PortCheckResult, String> {
    let addr = format!("{host}:{port}");
    let result = addr
        .to_socket_addrs()
        .map_err(|err| err.to_string())?
        .next()
        .ok_or_else(|| format!("无法解析地址: {addr}"));

    let check = match result {
        Ok(socket_addr) => match TcpStream::connect_timeout(&socket_addr, timeout) {
            Ok(_) => PortCheckResult {
                port,
                reachable: true,
                latency_ms: Some(start.elapsed().as_millis()),
                error: None,
            },
            Err(err) => PortCheckResult {
                port,
                reachable: false,
                latency_ms: None,
                error: Some(err.to_string()),
            },
        },
        Err(err) => PortCheckResult {
            port,
            reachable: false,
            latency_ms: None,
            error: Some(err),
        },
    };
    Ok(check)
}

fn check_udp_listener(host: &str, port: u16, start: Instant) -> PortCheckResult {
    if !is_local_host(host) {
        return PortCheckResult {
            port,
            reachable: false,
            latency_ms: None,
            error: Some(
                "UDP 远端端口不能用 TCP connect 方式可靠确认，请以游戏内加入为准".to_string(),
            ),
        };
    }

    match local_udp_port_listening(host, port) {
        Ok(true) => PortCheckResult {
            port,
            reachable: true,
            latency_ms: Some(start.elapsed().as_millis()),
            error: None,
        },
        Ok(false) => PortCheckResult {
            port,
            reachable: false,
            latency_ms: None,
            error: Some("未发现本机 UDP 监听".to_string()),
        },
        Err(err) => PortCheckResult {
            port,
            reachable: false,
            latency_ms: None,
            error: Some(err),
        },
    }
}

fn build_notes(
    target: &ConnectivityTarget,
    reachable: bool,
    ports: &[PortCheckResult],
) -> Vec<String> {
    let mut notes = Vec::new();
    let mode = target.mode.as_deref().unwrap_or("generic");
    let protocol = normalize_protocol(target.protocol.as_deref());
    notes.push(match protocol {
        "udp" => {
            "当前检测方式：本机 UDP 监听检查。适合 Palworld 等使用 UDP 服务端或 UDP 开房的游戏。"
                .to_string()
        }
        "tcp_udp" => "当前检测方式：先测 TCP；本机失败时再查 UDP 监听。适合端口协议不确定的游戏。"
            .to_string(),
        _ => "当前检测方式：TCP connect。适合判断游戏端口是否正在监听。".to_string(),
    });

    if reachable {
        notes.push("至少一个目标端口可连接，说明网络路径和对应服务端口基本可用。".to_string());
        if protocol == "udp" || protocol == "tcp_udp" {
            notes.push("已发现本机 UDP 监听时，说明游戏房间已在本机开出；远端能否加入还取决于组网、防火墙和游戏内加入方式。".to_string());
        }
        if mode == "n2n_game_port" {
            notes.push("朋友现在可以尝试在游戏里连接这个虚拟 IP 和端口。".to_string());
        }
        return notes;
    }

    if mode == "local_game_port" {
        notes.push(
            "本机 127.0.0.1 测试失败：优先检查游戏服务端是否真的启动成功、端口是否填写正确。"
                .to_string(),
        );
        notes.push("如果 Terraria Server 仍停在世界选择或报错，就不会监听 7777。".to_string());
    } else if mode == "n2n_game_port" {
        notes.push("n2n 虚拟 IP 的游戏端口不可达。先在房主电脑测 127.0.0.1:游戏端口。".to_string());
        notes.push("如果房主本机也不通：游戏服务端没开好。".to_string());
        notes.push("如果房主本机可通但朋友不通：检查 n2n 是否启动、双方 community/secret/supernode 是否一致、local_ip 是否冲突、防火墙是否拦截。".to_string());
        if !looks_like_private_ip(&target.host) {
            notes.push("目标地址看起来不像常见虚拟局域网 IP。请确认朋友连接的是房主 n2n 虚拟 IP，而不是公网 IP 或普通局域网 IP。".to_string());
        }
    } else {
        notes.push(
            "全部端口不可达：可能是目标服务未启动、端口错误、防火墙拦截或网络不通。".to_string(),
        );
    }

    for item in ports {
        if let Some(error) = &item.error {
            notes.push(format!("端口 {} 失败原因：{}", item.port, error));
        }
    }

    notes
}

fn normalize_protocol(protocol: Option<&str>) -> &'static str {
    match protocol.unwrap_or("tcp").to_ascii_lowercase().as_str() {
        "udp" => "udp",
        "tcp_udp" | "tcp+udp" | "tcp/udp" => "tcp_udp",
        _ => "tcp",
    }
}

fn is_local_host(host: &str) -> bool {
    let lowered = host.trim().to_ascii_lowercase();
    if lowered == "localhost" {
        return true;
    }
    match lowered.parse::<IpAddr>() {
        Ok(IpAddr::V4(v4)) => v4.is_loopback() || v4.octets() == [0, 0, 0, 0],
        Ok(IpAddr::V6(v6)) => v6.is_loopback() || v6.is_unspecified(),
        Err(_) => false,
    }
}

#[cfg(windows)]
fn local_udp_port_listening(host: &str, port: u16) -> Result<bool, String> {
    let host = host.replace('\'', "''");
    let command = format!(
        "$hostIp='{host}'; \
         $items=Get-NetUDPEndpoint -LocalPort {port} -ErrorAction SilentlyContinue | \
         Where-Object {{ $_.LocalAddress -eq '0.0.0.0' -or $_.LocalAddress -eq '::' -or $_.LocalAddress -eq '127.0.0.1' -or $_.LocalAddress -eq '::1' -or $_.LocalAddress -eq $hostIp }}; \
         if ($items) {{ 'LISTENING' }} else {{ 'MISSING' }}"
    );
    let mut process = Command::new("powershell");
    process.args([
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        &command,
    ]);
    let output = hide_console_window(&mut process)
        .output()
        .map_err(|err| format!("检查 UDP 监听失败: {err}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("检查 UDP 监听失败: {}", stderr.trim()));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.contains("LISTENING"))
}

#[cfg(not(windows))]
fn local_udp_port_listening(_host: &str, _port: u16) -> Result<bool, String> {
    Err("当前平台暂不支持本机 UDP 监听自动检查".to_string())
}

fn looks_like_private_ip(host: &str) -> bool {
    let Ok(ip) = host.parse::<IpAddr>() else {
        return true;
    };
    match ip {
        IpAddr::V4(v4) => {
            let octets = v4.octets();
            octets[0] == 10
                || (octets[0] == 172 && (16..=31).contains(&octets[1]))
                || (octets[0] == 192 && octets[1] == 168)
                || octets[0] == 127
        }
        IpAddr::V6(_) => true,
    }
}
