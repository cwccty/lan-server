use std::collections::HashMap;
use std::net::{SocketAddr, ToSocketAddrs, UdpSocket};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use crate::models::udp_proxy::{UdpProxyConfig, UdpProxySelfTestReport, UdpProxyStatus};

const DEFAULT_PROXY_ID: &str = "default";
const DEFAULT_CLIENT_TTL_SECONDS: u64 = 30;
const MAX_LOGS: usize = 80;

struct UdpProxyRuntime {
    id: String,
    listen: String,
    target: SocketAddr,
    target_label: String,
    stop: Arc<AtomicBool>,
    client_ttl: Duration,
    clients: Arc<Mutex<HashMap<SocketAddr, Instant>>>,
    packets_in: Arc<AtomicU64>,
    packets_out: Arc<AtomicU64>,
    bytes_in: Arc<AtomicU64>,
    bytes_out: Arc<AtomicU64>,
    last_error: Arc<Mutex<Option<String>>>,
    logs: Arc<Mutex<Vec<String>>>,
}

static UDP_PROXIES: OnceLock<Mutex<HashMap<String, Arc<UdpProxyRuntime>>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, Arc<UdpProxyRuntime>>> {
    UDP_PROXIES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn start_udp_proxy(config: UdpProxyConfig) -> Result<UdpProxyStatus, String> {
    let id = config
        .id
        .as_deref()
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .unwrap_or(DEFAULT_PROXY_ID)
        .to_string();

    if config.listen_port == 0 || config.target_port == 0 {
        return Err("UDP 监听端口和目标端口必须大于 0。".to_string());
    }

    let listen = format!("{}:{}", config.listen_host.trim(), config.listen_port);
    let target_label = format!("{}:{}", config.target_host.trim(), config.target_port);
    let target = resolve_socket_addr(&target_label)?;

    stop_udp_proxy(&id).ok();

    let socket =
        UdpSocket::bind(&listen).map_err(|err| format!("启动 UDP 代理监听失败 {listen}: {err}"))?;
    socket
        .set_nonblocking(true)
        .map_err(|err| format!("设置 UDP 代理非阻塞监听失败: {err}"))?;

    let runtime = Arc::new(UdpProxyRuntime {
        id: id.clone(),
        listen: listen.clone(),
        target,
        target_label: target_label.clone(),
        stop: Arc::new(AtomicBool::new(false)),
        client_ttl: Duration::from_secs(
            config
                .client_ttl_seconds
                .unwrap_or(DEFAULT_CLIENT_TTL_SECONDS)
                .max(5),
        ),
        clients: Arc::new(Mutex::new(HashMap::new())),
        packets_in: Arc::new(AtomicU64::new(0)),
        packets_out: Arc::new(AtomicU64::new(0)),
        bytes_in: Arc::new(AtomicU64::new(0)),
        bytes_out: Arc::new(AtomicU64::new(0)),
        last_error: Arc::new(Mutex::new(None)),
        logs: Arc::new(Mutex::new(Vec::new())),
    });

    push_log(
        &runtime,
        format!("UDP 端口代理启动：{listen} -> {target_label}"),
    );
    if config.listen_host.trim() == "0.0.0.0" {
        push_log(
            &runtime,
            "警告：当前 UDP 代理监听 0.0.0.0，请确认不会暴露到不需要的网络。".to_string(),
        );
    }

    registry()
        .lock()
        .map_err(|_| "UDP 代理状态锁已损坏。".to_string())?
        .insert(id.clone(), runtime.clone());

    thread::spawn(move || udp_loop(runtime, socket));
    get_udp_proxy_status(&id)
}

pub fn stop_udp_proxy(id: &str) -> Result<UdpProxyStatus, String> {
    let runtime = {
        let mut guard = registry()
            .lock()
            .map_err(|_| "UDP 代理状态锁已损坏。".to_string())?;
        guard.remove(id)
    };

    let Some(runtime) = runtime else {
        return Ok(UdpProxyStatus {
            id: id.to_string(),
            running: false,
            listen: String::new(),
            target: String::new(),
            active_clients: 0,
            packets_in: 0,
            packets_out: 0,
            bytes_in: 0,
            bytes_out: 0,
            last_error: Some("UDP 代理未运行。".to_string()),
            logs: Vec::new(),
        });
    };

    runtime.stop.store(true, Ordering::SeqCst);
    push_log(&runtime, "UDP 代理停止请求已发送。".to_string());
    let mut status = status_from_runtime(&runtime);
    status.running = false;
    Ok(status)
}

pub fn stop_all_udp_proxies() {
    let ids = registry()
        .lock()
        .map(|guard| guard.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    for id in ids {
        let _ = stop_udp_proxy(&id);
    }
}

pub fn list_udp_proxies() -> Vec<UdpProxyStatus> {
    registry()
        .lock()
        .map(|guard| guard.values().map(status_from_runtime).collect())
        .unwrap_or_default()
}

pub fn get_udp_proxy_status(id: &str) -> Result<UdpProxyStatus, String> {
    let runtime = registry()
        .lock()
        .map_err(|_| "UDP 代理状态锁已损坏。".to_string())?
        .get(id)
        .cloned();

    runtime
        .map(|item| status_from_runtime(&item))
        .ok_or_else(|| format!("UDP 代理未运行: {id}"))
}

pub fn self_test_udp_proxy() -> Result<UdpProxySelfTestReport, String> {
    let echo_socket = UdpSocket::bind(("127.0.0.1", 0))
        .map_err(|err| format!("启动临时 UDP Echo 服务失败: {err}"))?;
    let target_port = echo_socket
        .local_addr()
        .map_err(|err| format!("读取临时 UDP Echo 端口失败: {err}"))?
        .port();
    echo_socket
        .set_nonblocking(true)
        .map_err(|err| format!("设置临时 UDP Echo 非阻塞失败: {err}"))?;

    let proxy_port = free_local_udp_port()?;
    let proxy_id = format!("udp-self-test-{proxy_port}");
    let echo_stop = Arc::new(AtomicBool::new(false));
    let echo_stop_thread = echo_stop.clone();

    thread::spawn(move || {
        let mut buffer = [0_u8; 1500];
        while !echo_stop_thread.load(Ordering::SeqCst) {
            match echo_socket.recv_from(&mut buffer) {
                Ok((size, peer)) => {
                    let _ = echo_socket.send_to(&buffer[..size], peer);
                }
                Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(20));
                }
                Err(_) => break,
            }
        }
    });

    let cleanup = |proxy_id: &str, echo_stop: &Arc<AtomicBool>| {
        echo_stop.store(true, Ordering::SeqCst);
        let _ = UdpSocket::bind(("127.0.0.1", 0))
            .and_then(|socket| socket.send_to(b"stop", ("127.0.0.1", target_port)));
        let _ = stop_udp_proxy(proxy_id);
    };

    let start_status = match start_udp_proxy(UdpProxyConfig {
        id: Some(proxy_id.clone()),
        listen_host: "127.0.0.1".to_string(),
        listen_port: proxy_port,
        target_host: "127.0.0.1".to_string(),
        target_port,
        label: Some("UDP 端口代理自测".to_string()),
        game_id: None,
        client_ttl_seconds: Some(10),
    }) {
        Ok(status) => status,
        Err(err) => {
            cleanup(&proxy_id, &echo_stop);
            return Err(err);
        }
    };

    thread::sleep(Duration::from_millis(80));
    let sent = "hello udp proxy";
    let client = UdpSocket::bind(("127.0.0.1", 0))
        .map_err(|err| format!("创建 UDP 自测客户端失败: {err}"))?;
    client
        .set_read_timeout(Some(Duration::from_secs(3)))
        .map_err(|err| format!("设置 UDP 自测读取超时失败: {err}"))?;
    if let Err(err) = client.send_to(sent.as_bytes(), ("127.0.0.1", proxy_port)) {
        cleanup(&proxy_id, &echo_stop);
        return Err(format!("向 UDP 自测代理发送数据失败: {err}"));
    }

    let mut buffer = [0_u8; 1500];
    let (size, _) = match client.recv_from(&mut buffer) {
        Ok(result) => result,
        Err(err) => {
            cleanup(&proxy_id, &echo_stop);
            return Err(format!("读取 UDP 自测 Echo 返回失败: {err}"));
        }
    };
    let received = String::from_utf8_lossy(&buffer[..size]).to_string();
    thread::sleep(Duration::from_millis(120));
    let status = get_udp_proxy_status(&proxy_id).unwrap_or(start_status);
    let ok = received == sent
        && status.packets_in >= 1
        && status.packets_out >= 1
        && status.bytes_in > 0
        && status.bytes_out > 0;
    let report = UdpProxySelfTestReport {
        ok,
        listen: format!("127.0.0.1:{proxy_port}"),
        target: format!("127.0.0.1:{target_port}"),
        sent: sent.to_string(),
        received,
        packets_in: status.packets_in,
        packets_out: status.packets_out,
        bytes_in: status.bytes_in,
        bytes_out: status.bytes_out,
        notes: vec![
            "已自动启动临时 UDP Echo 服务。".to_string(),
            "已自动启动临时 UDP 单播端口代理。".to_string(),
            "已通过代理发送测试字符串并读取 UDP Echo 返回。".to_string(),
            "自测结束后已停止临时代理和 Echo 服务。".to_string(),
        ],
        status: status.clone(),
    };

    cleanup(&proxy_id, &echo_stop);
    Ok(report)
}

fn udp_loop(runtime: Arc<UdpProxyRuntime>, socket: UdpSocket) {
    let mut buffer = [0_u8; 65_507];
    while !runtime.stop.load(Ordering::SeqCst) {
        match socket.recv_from(&mut buffer) {
            Ok((size, source)) => {
                prune_clients(&runtime);
                if source == runtime.target {
                    forward_target_reply(&runtime, &socket, &buffer[..size]);
                } else {
                    remember_client(&runtime, source);
                    runtime.packets_in.fetch_add(1, Ordering::SeqCst);
                    runtime.bytes_in.fetch_add(size as u64, Ordering::SeqCst);
                    match socket.send_to(&buffer[..size], runtime.target) {
                        Ok(sent) => {
                            runtime.packets_out.fetch_add(1, Ordering::SeqCst);
                            runtime.bytes_out.fetch_add(sent as u64, Ordering::SeqCst);
                        }
                        Err(err) => set_error(
                            &runtime,
                            format!("UDP 转发到目标失败 {}: {err}", runtime.target_label),
                        ),
                    }
                }
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(20));
            }
            Err(err) => {
                set_error(&runtime, format!("UDP 接收失败：{err}"));
                thread::sleep(Duration::from_millis(100));
            }
        }
    }
    push_log(&runtime, "UDP 代理监听线程已退出。".to_string());
}

fn forward_target_reply(runtime: &Arc<UdpProxyRuntime>, socket: &UdpSocket, payload: &[u8]) {
    let clients = runtime
        .clients
        .lock()
        .map(|guard| guard.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    if clients.is_empty() {
        push_log(
            runtime,
            "收到目标 UDP 回包，但当前没有活跃客户端映射，已丢弃。".to_string(),
        );
        return;
    }

    for client in clients {
        match socket.send_to(payload, client) {
            Ok(sent) => {
                runtime.packets_out.fetch_add(1, Ordering::SeqCst);
                runtime.bytes_out.fetch_add(sent as u64, Ordering::SeqCst);
            }
            Err(err) => set_error(runtime, format!("UDP 回包转发给客户端失败 {client}: {err}")),
        }
    }
}

fn remember_client(runtime: &Arc<UdpProxyRuntime>, source: SocketAddr) {
    if let Ok(mut clients) = runtime.clients.lock() {
        let is_new = !clients.contains_key(&source);
        clients.insert(source, Instant::now());
        if is_new {
            push_log(runtime, format!("UDP 客户端映射：{source}"));
        }
    }
}

fn prune_clients(runtime: &Arc<UdpProxyRuntime>) {
    if let Ok(mut clients) = runtime.clients.lock() {
        let now = Instant::now();
        clients.retain(|_, last_seen| now.duration_since(*last_seen) <= runtime.client_ttl);
    }
}

fn status_from_runtime(runtime: &Arc<UdpProxyRuntime>) -> UdpProxyStatus {
    prune_clients(runtime);
    UdpProxyStatus {
        id: runtime.id.clone(),
        running: !runtime.stop.load(Ordering::SeqCst),
        listen: runtime.listen.clone(),
        target: runtime.target_label.clone(),
        active_clients: runtime
            .clients
            .lock()
            .map(|item| item.len() as u32)
            .unwrap_or(0),
        packets_in: runtime.packets_in.load(Ordering::SeqCst),
        packets_out: runtime.packets_out.load(Ordering::SeqCst),
        bytes_in: runtime.bytes_in.load(Ordering::SeqCst),
        bytes_out: runtime.bytes_out.load(Ordering::SeqCst),
        last_error: runtime.last_error.lock().ok().and_then(|item| item.clone()),
        logs: runtime
            .logs
            .lock()
            .map(|item| item.clone())
            .unwrap_or_default(),
    }
}

fn push_log(runtime: &Arc<UdpProxyRuntime>, line: String) {
    if let Ok(mut logs) = runtime.logs.lock() {
        logs.push(line);
        if logs.len() > MAX_LOGS {
            let overflow = logs.len() - MAX_LOGS;
            logs.drain(0..overflow);
        }
    }
}

fn set_error(runtime: &Arc<UdpProxyRuntime>, error: String) {
    if let Ok(mut last_error) = runtime.last_error.lock() {
        *last_error = Some(error.clone());
    }
    push_log(runtime, format!("错误：{error}"));
}

fn resolve_socket_addr(value: &str) -> Result<SocketAddr, String> {
    value
        .to_socket_addrs()
        .map_err(|err| format!("解析 UDP 目标地址失败 {value}: {err}"))?
        .next()
        .ok_or_else(|| format!("解析 UDP 目标地址失败: {value}"))
}

fn free_local_udp_port() -> Result<u16, String> {
    UdpSocket::bind("127.0.0.1:0")
        .map_err(|err| format!("分配临时 UDP 端口失败: {err}"))?
        .local_addr()
        .map(|addr| addr.port())
        .map_err(|err| format!("读取临时 UDP 端口失败: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wait_for_udp_proxy_counters(
        proxy_id: &str,
        min_packets_in: u64,
        min_packets_out: u64,
    ) -> UdpProxyStatus {
        let deadline = Instant::now() + Duration::from_secs(3);
        let mut last_status = get_udp_proxy_status(proxy_id).expect("read udp proxy status");
        while Instant::now() < deadline {
            if last_status.packets_in >= min_packets_in
                && last_status.packets_out >= min_packets_out
            {
                return last_status;
            }
            thread::sleep(Duration::from_millis(20));
            last_status = get_udp_proxy_status(proxy_id).expect("read udp proxy status");
        }
        last_status
    }

    #[test]
    fn udp_proxy_forwards_datagrams_end_to_end() {
        let echo_socket = UdpSocket::bind(("127.0.0.1", 0)).expect("bind udp target");
        let target_port = echo_socket.local_addr().expect("target addr").port();
        let proxy_port = free_local_udp_port().expect("free udp port");
        let proxy_id = format!("test-udp-proxy-{proxy_port}");

        thread::spawn(move || {
            let mut buffer = [0_u8; 512];
            let (size, peer) = echo_socket.recv_from(&mut buffer).expect("read udp target");
            echo_socket
                .send_to(&buffer[..size], peer)
                .expect("echo udp payload");
        });

        let status = start_udp_proxy(UdpProxyConfig {
            id: Some(proxy_id.clone()),
            listen_host: "127.0.0.1".to_string(),
            listen_port: proxy_port,
            target_host: "127.0.0.1".to_string(),
            target_port,
            label: Some("test udp proxy".to_string()),
            game_id: None,
            client_ttl_seconds: Some(10),
        })
        .expect("start udp proxy");
        assert!(status.running);

        let client = UdpSocket::bind(("127.0.0.1", 0)).expect("bind udp client");
        client
            .set_read_timeout(Some(Duration::from_secs(3)))
            .expect("set timeout");
        client
            .send_to(b"hello-udp-proxy", ("127.0.0.1", proxy_port))
            .expect("send udp proxy");
        let mut response = [0_u8; 512];
        let (size, _) = client.recv_from(&mut response).expect("read udp echo");
        assert_eq!(&response[..size], b"hello-udp-proxy");

        let status = wait_for_udp_proxy_counters(&proxy_id, 1, 2);
        assert!(status.packets_in >= 1);
        assert!(status.packets_out >= 2);

        let stopped = stop_udp_proxy(&proxy_id).expect("stop udp proxy");
        assert!(!stopped.running);
    }

    #[test]
    fn self_test_reports_success() {
        let report = self_test_udp_proxy().expect("self test udp proxy");
        assert!(report.ok);
        assert_eq!(report.sent, "hello udp proxy");
        assert_eq!(report.received, "hello udp proxy");
        assert!(report.packets_in >= 1);
        assert!(report.packets_out >= 2);
    }
}
