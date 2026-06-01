use std::net::{IpAddr, TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};

use crate::models::network::{ConnectivityReport, ConnectivityTarget, PortCheckResult};

pub fn test_connectivity(target: ConnectivityTarget) -> Result<ConnectivityReport, String> {
    let timeout = Duration::from_millis(target.timeout_ms.unwrap_or(1200));
    let mut ports = Vec::new();

    for port in &target.ports {
        let start = Instant::now();
        let addr = format!("{}:{}", target.host, port);
        let result = addr
            .to_socket_addrs()
            .map_err(|err| err.to_string())?
            .next()
            .ok_or_else(|| format!("无法解析地址: {addr}"));

        let check = match result {
            Ok(socket_addr) => match TcpStream::connect_timeout(&socket_addr, timeout) {
                Ok(_) => PortCheckResult {
                    port: *port,
                    reachable: true,
                    latency_ms: Some(start.elapsed().as_millis()),
                    error: None,
                },
                Err(err) => PortCheckResult {
                    port: *port,
                    reachable: false,
                    latency_ms: None,
                    error: Some(err.to_string()),
                },
            },
            Err(err) => PortCheckResult {
                port: *port,
                reachable: false,
                latency_ms: None,
                error: Some(err),
            },
        };
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

fn build_notes(
    target: &ConnectivityTarget,
    reachable: bool,
    ports: &[PortCheckResult],
) -> Vec<String> {
    let mut notes = Vec::new();
    let mode = target.mode.as_deref().unwrap_or("generic");
    notes.push("当前检测方式：TCP connect。适合判断游戏端口是否正在监听。".to_string());

    if reachable {
        notes.push("至少一个目标端口可连接，说明网络路径和对应服务端口基本可用。".to_string());
        if mode == "n2n_game_port" {
            notes.push("朋友现在可以尝试在游戏里连接这个虚拟 IP 和端口。".to_string());
        }
        return notes;
    }

    if mode == "local_game_port" {
        notes.push("本机 127.0.0.1 测试失败：优先检查游戏服务端是否真的启动成功、端口是否填写正确。".to_string());
        notes.push("如果 Terraria Server 仍停在世界选择或报错，就不会监听 7777。".to_string());
    } else if mode == "n2n_game_port" {
        notes.push("n2n 虚拟 IP 的游戏端口不可达。先在房主电脑测 127.0.0.1:游戏端口。".to_string());
        notes.push("如果房主本机也不通：游戏服务端没开好。".to_string());
        notes.push("如果房主本机可通但朋友不通：检查 n2n 是否启动、双方 community/secret/supernode 是否一致、local_ip 是否冲突、防火墙是否拦截。".to_string());
        if !looks_like_private_ip(&target.host) {
            notes.push("目标地址看起来不像常见虚拟局域网 IP。请确认朋友连接的是房主 n2n 虚拟 IP，而不是公网 IP 或普通局域网 IP。".to_string());
        }
    } else {
        notes.push("全部端口不可达：可能是目标服务未启动、端口错误、防火墙拦截或网络不通。".to_string());
    }

    for item in ports {
        if let Some(error) = &item.error {
            notes.push(format!("端口 {} 失败原因：{}", item.port, error));
        }
    }

    notes
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
