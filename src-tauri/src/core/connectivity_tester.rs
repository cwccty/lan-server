use std::net::{TcpStream, ToSocketAddrs};
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
    Ok(ConnectivityReport {
        target_host: target.host,
        reachable,
        latency_ms,
        ports,
        notes: vec!["第一版当前只实现 TCP connect 检测。".to_string()],
    })
}
