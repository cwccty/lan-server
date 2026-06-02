use std::collections::{HashMap, hash_map::DefaultHasher};
use std::hash::{Hash, Hasher};
use std::net::{SocketAddr, ToSocketAddrs, UdpSocket};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use crate::models::udp_broadcast_bridge::{
    UdpBroadcastBridgeConfig, UdpBroadcastBridgeSelfTestReport, UdpBroadcastBridgeStatus,
};

const DEFAULT_BRIDGE_ID: &str = "default";
const DEFAULT_DUPLICATE_TTL_MS: u64 = 800;
const MAX_LOGS: usize = 80;

struct UdpBroadcastBridgeRuntime {
    id: String,
    listen: String,
    forward_targets: Vec<SocketAddr>,
    forward_target_labels: Vec<String>,
    stop: Arc<AtomicBool>,
    duplicate_ttl: Duration,
    recent_signatures: Arc<Mutex<HashMap<u64, Instant>>>,
    received_packets: Arc<AtomicU64>,
    forwarded_packets: Arc<AtomicU64>,
    dropped_packets: Arc<AtomicU64>,
    bytes_in: Arc<AtomicU64>,
    bytes_out: Arc<AtomicU64>,
    last_error: Arc<Mutex<Option<String>>>,
    logs: Arc<Mutex<Vec<String>>>,
}

static BRIDGES: OnceLock<Mutex<HashMap<String, Arc<UdpBroadcastBridgeRuntime>>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, Arc<UdpBroadcastBridgeRuntime>>> {
    BRIDGES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn start_udp_broadcast_bridge(
    config: UdpBroadcastBridgeConfig,
) -> Result<UdpBroadcastBridgeStatus, String> {
    let id = config
        .id
        .as_deref()
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .unwrap_or(DEFAULT_BRIDGE_ID)
        .to_string();

    if config.listen_port == 0 {
        return Err("UDP 广播桥监听端口必须大于 0。".to_string());
    }

    let mut target_labels = config
        .forward_targets
        .iter()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    target_labels.sort();
    target_labels.dedup();
    if target_labels.is_empty() {
        return Err("UDP 广播桥至少需要一个转发目标，例如 10.10.10.3:7777 或 255.255.255.255:7777。".to_string());
    }

    let mut forward_targets = Vec::new();
    for target in &target_labels {
        forward_targets.push(resolve_socket_addr(target)?);
    }

    let listen = format!("{}:{}", config.listen_host.trim(), config.listen_port);
    stop_udp_broadcast_bridge(&id).ok();

    let socket = UdpSocket::bind(&listen)
        .map_err(|err| format!("启动 UDP 广播桥监听失败 {listen}: {err}"))?;
    socket
        .set_nonblocking(true)
        .map_err(|err| format!("设置 UDP 广播桥非阻塞监听失败: {err}"))?;
    if config.allow_broadcast.unwrap_or(true) {
        socket
            .set_broadcast(true)
            .map_err(|err| format!("启用 UDP 广播发送失败: {err}"))?;
    }

    let runtime = Arc::new(UdpBroadcastBridgeRuntime {
        id: id.clone(),
        listen: listen.clone(),
        forward_targets,
        forward_target_labels: target_labels.clone(),
        stop: Arc::new(AtomicBool::new(false)),
        duplicate_ttl: Duration::from_millis(
            config
                .duplicate_ttl_ms
                .unwrap_or(DEFAULT_DUPLICATE_TTL_MS)
                .max(100),
        ),
        recent_signatures: Arc::new(Mutex::new(HashMap::new())),
        received_packets: Arc::new(AtomicU64::new(0)),
        forwarded_packets: Arc::new(AtomicU64::new(0)),
        dropped_packets: Arc::new(AtomicU64::new(0)),
        bytes_in: Arc::new(AtomicU64::new(0)),
        bytes_out: Arc::new(AtomicU64::new(0)),
        last_error: Arc::new(Mutex::new(None)),
        logs: Arc::new(Mutex::new(Vec::new())),
    });

    push_log(
        &runtime,
        format!("UDP 广播桥启动：{listen} -> {}", target_labels.join(", ")),
    );
    push_log(
        &runtime,
        "说明：广播桥只辅助房间发现，不保证游戏最终加入成功。".to_string(),
    );

    registry()
        .lock()
        .map_err(|_| "UDP 广播桥状态锁已损坏。".to_string())?
        .insert(id.clone(), runtime.clone());

    thread::spawn(move || bridge_loop(runtime, socket));
    get_udp_broadcast_bridge_status(&id)
}

pub fn stop_udp_broadcast_bridge(id: &str) -> Result<UdpBroadcastBridgeStatus, String> {
    let runtime = {
        let mut guard = registry()
            .lock()
            .map_err(|_| "UDP 广播桥状态锁已损坏。".to_string())?;
        guard.remove(id)
    };

    let Some(runtime) = runtime else {
        return Ok(UdpBroadcastBridgeStatus {
            id: id.to_string(),
            running: false,
            listen: String::new(),
            forward_targets: Vec::new(),
            received_packets: 0,
            forwarded_packets: 0,
            dropped_packets: 0,
            bytes_in: 0,
            bytes_out: 0,
            last_error: Some("UDP 广播桥未运行。".to_string()),
            logs: Vec::new(),
        });
    };

    runtime.stop.store(true, Ordering::SeqCst);
    push_log(&runtime, "UDP 广播桥停止请求已发送。".to_string());
    let mut status = status_from_runtime(&runtime);
    status.running = false;
    Ok(status)
}

pub fn stop_all_udp_broadcast_bridges() {
    let ids = registry()
        .lock()
        .map(|guard| guard.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    for id in ids {
        let _ = stop_udp_broadcast_bridge(&id);
    }
}

pub fn list_udp_broadcast_bridges() -> Vec<UdpBroadcastBridgeStatus> {
    registry()
        .lock()
        .map(|guard| guard.values().map(status_from_runtime).collect())
        .unwrap_or_default()
}

pub fn get_udp_broadcast_bridge_status(id: &str) -> Result<UdpBroadcastBridgeStatus, String> {
    let runtime = registry()
        .lock()
        .map_err(|_| "UDP 广播桥状态锁已损坏。".to_string())?
        .get(id)
        .cloned();

    runtime
        .map(|item| status_from_runtime(&item))
        .ok_or_else(|| format!("UDP 广播桥未运行: {id}"))
}

pub fn self_test_udp_broadcast_bridge() -> Result<UdpBroadcastBridgeSelfTestReport, String> {
    let collector =
        UdpSocket::bind(("127.0.0.1", 0)).map_err(|err| format!("启动 UDP 发现包接收器失败: {err}"))?;
    let collector_port = collector
        .local_addr()
        .map_err(|err| format!("读取 UDP 发现包接收器端口失败: {err}"))?
        .port();
    collector
        .set_read_timeout(Some(Duration::from_secs(3)))
        .map_err(|err| format!("设置 UDP 发现包接收器超时失败: {err}"))?;

    let bridge_port = free_local_udp_port()?;
    let bridge_id = format!("udp-bridge-self-test-{bridge_port}");
    let target = format!("127.0.0.1:{collector_port}");

    let start_status = match start_udp_broadcast_bridge(UdpBroadcastBridgeConfig {
        id: Some(bridge_id.clone()),
        listen_host: "127.0.0.1".to_string(),
        listen_port: bridge_port,
        forward_targets: vec![target.clone()],
        label: Some("UDP 广播桥自测".to_string()),
        game_id: None,
        allow_broadcast: Some(false),
        duplicate_ttl_ms: Some(500),
    }) {
        Ok(status) => status,
        Err(err) => {
            let _ = stop_udp_broadcast_bridge(&bridge_id);
            return Err(err);
        }
    };

    thread::sleep(Duration::from_millis(80));
    let sent = "hello udp broadcast bridge";
    let sender =
        UdpSocket::bind(("127.0.0.1", 0)).map_err(|err| format!("创建 UDP 发现包发送器失败: {err}"))?;
    if let Err(err) = sender.send_to(sent.as_bytes(), ("127.0.0.1", bridge_port)) {
        let _ = stop_udp_broadcast_bridge(&bridge_id);
        return Err(format!("发送 UDP 广播桥自测发现包失败: {err}"));
    }

    let mut buffer = [0_u8; 1500];
    let (size, _) = match collector.recv_from(&mut buffer) {
        Ok(result) => result,
        Err(err) => {
            let _ = stop_udp_broadcast_bridge(&bridge_id);
            return Err(format!("接收 UDP 广播桥转发包失败: {err}"));
        }
    };
    let received = String::from_utf8_lossy(&buffer[..size]).to_string();
    thread::sleep(Duration::from_millis(120));
    let status = get_udp_broadcast_bridge_status(&bridge_id).unwrap_or(start_status);
    let ok = received == sent
        && status.received_packets >= 1
        && status.forwarded_packets >= 1
        && status.bytes_in > 0
        && status.bytes_out > 0;
    let report = UdpBroadcastBridgeSelfTestReport {
        ok,
        listen: format!("127.0.0.1:{bridge_port}"),
        forward_targets: vec![target],
        sent: sent.to_string(),
        received,
        received_packets: status.received_packets,
        forwarded_packets: status.forwarded_packets,
        dropped_packets: status.dropped_packets,
        bytes_in: status.bytes_in,
        bytes_out: status.bytes_out,
        notes: vec![
            "已自动启动临时 UDP 发现包接收器。".to_string(),
            "已自动启动临时 UDP 广播桥。".to_string(),
            "已向广播桥监听端口发送模拟发现包。".to_string(),
            "已验证发现包被转发到指定目标。".to_string(),
            "自测结束后已停止临时广播桥。".to_string(),
        ],
        status: status.clone(),
    };

    let _ = stop_udp_broadcast_bridge(&bridge_id);
    Ok(report)
}

fn bridge_loop(runtime: Arc<UdpBroadcastBridgeRuntime>, socket: UdpSocket) {
    let mut buffer = [0_u8; 65_507];
    while !runtime.stop.load(Ordering::SeqCst) {
        match socket.recv_from(&mut buffer) {
            Ok((size, source)) => {
                runtime.received_packets.fetch_add(1, Ordering::SeqCst);
                runtime.bytes_in.fetch_add(size as u64, Ordering::SeqCst);
                prune_signatures(&runtime);

                let signature = packet_signature(&buffer[..size]);
                if is_duplicate(&runtime, signature) {
                    runtime.dropped_packets.fetch_add(1, Ordering::SeqCst);
                    continue;
                }

                for target in &runtime.forward_targets {
                    if *target == source {
                        runtime.dropped_packets.fetch_add(1, Ordering::SeqCst);
                        continue;
                    }
                    match socket.send_to(&buffer[..size], target) {
                        Ok(sent) => {
                            runtime.forwarded_packets.fetch_add(1, Ordering::SeqCst);
                            runtime.bytes_out.fetch_add(sent as u64, Ordering::SeqCst);
                        }
                        Err(err) => set_error(&runtime, format!("UDP 广播桥转发到 {target} 失败: {err}")),
                    }
                }
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(20));
            }
            Err(err) => {
                set_error(&runtime, format!("UDP 广播桥接收失败：{err}"));
                thread::sleep(Duration::from_millis(100));
            }
        }
    }
    push_log(&runtime, "UDP 广播桥监听线程已退出。".to_string());
}

fn status_from_runtime(runtime: &Arc<UdpBroadcastBridgeRuntime>) -> UdpBroadcastBridgeStatus {
    prune_signatures(runtime);
    UdpBroadcastBridgeStatus {
        id: runtime.id.clone(),
        running: !runtime.stop.load(Ordering::SeqCst),
        listen: runtime.listen.clone(),
        forward_targets: runtime.forward_target_labels.clone(),
        received_packets: runtime.received_packets.load(Ordering::SeqCst),
        forwarded_packets: runtime.forwarded_packets.load(Ordering::SeqCst),
        dropped_packets: runtime.dropped_packets.load(Ordering::SeqCst),
        bytes_in: runtime.bytes_in.load(Ordering::SeqCst),
        bytes_out: runtime.bytes_out.load(Ordering::SeqCst),
        last_error: runtime.last_error.lock().ok().and_then(|item| item.clone()),
        logs: runtime.logs.lock().map(|item| item.clone()).unwrap_or_default(),
    }
}

fn packet_signature(payload: &[u8]) -> u64 {
    let mut hasher = DefaultHasher::new();
    payload.hash(&mut hasher);
    payload.len().hash(&mut hasher);
    hasher.finish()
}

fn is_duplicate(runtime: &Arc<UdpBroadcastBridgeRuntime>, signature: u64) -> bool {
    if let Ok(mut signatures) = runtime.recent_signatures.lock() {
        let now = Instant::now();
        if let Some(last_seen) = signatures.get(&signature) {
            if now.duration_since(*last_seen) <= runtime.duplicate_ttl {
                return true;
            }
        }
        signatures.insert(signature, now);
    }
    false
}

fn prune_signatures(runtime: &Arc<UdpBroadcastBridgeRuntime>) {
    if let Ok(mut signatures) = runtime.recent_signatures.lock() {
        let now = Instant::now();
        signatures.retain(|_, last_seen| now.duration_since(*last_seen) <= runtime.duplicate_ttl);
    }
}

fn push_log(runtime: &Arc<UdpBroadcastBridgeRuntime>, line: String) {
    if let Ok(mut logs) = runtime.logs.lock() {
        logs.push(line);
        if logs.len() > MAX_LOGS {
            let overflow = logs.len() - MAX_LOGS;
            logs.drain(0..overflow);
        }
    }
}

fn set_error(runtime: &Arc<UdpBroadcastBridgeRuntime>, error: String) {
    if let Ok(mut last_error) = runtime.last_error.lock() {
        *last_error = Some(error.clone());
    }
    push_log(runtime, format!("错误：{error}"));
}

fn resolve_socket_addr(value: &str) -> Result<SocketAddr, String> {
    value
        .to_socket_addrs()
        .map_err(|err| format!("解析 UDP 广播桥目标地址失败 {value}: {err}"))?
        .next()
        .ok_or_else(|| format!("解析 UDP 广播桥目标地址失败: {value}"))
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

    #[test]
    fn udp_broadcast_bridge_forwards_discovery_packet() {
        let collector = UdpSocket::bind(("127.0.0.1", 0)).expect("bind collector");
        let collector_port = collector.local_addr().expect("collector addr").port();
        collector
            .set_read_timeout(Some(Duration::from_secs(3)))
            .expect("collector timeout");
        let bridge_port = free_local_udp_port().expect("free udp port");
        let bridge_id = format!("test-udp-bridge-{bridge_port}");

        let status = start_udp_broadcast_bridge(UdpBroadcastBridgeConfig {
            id: Some(bridge_id.clone()),
            listen_host: "127.0.0.1".to_string(),
            listen_port: bridge_port,
            forward_targets: vec![format!("127.0.0.1:{collector_port}")],
            label: Some("test udp bridge".to_string()),
            game_id: None,
            allow_broadcast: Some(false),
            duplicate_ttl_ms: Some(500),
        })
        .expect("start bridge");
        assert!(status.running);

        let sender = UdpSocket::bind(("127.0.0.1", 0)).expect("bind sender");
        sender
            .send_to(b"discover-lan-room", ("127.0.0.1", bridge_port))
            .expect("send discovery");

        let mut response = [0_u8; 512];
        let (size, _) = collector.recv_from(&mut response).expect("read forwarded discovery");
        assert_eq!(&response[..size], b"discover-lan-room");

        let status = get_udp_broadcast_bridge_status(&bridge_id).expect("bridge status");
        assert!(status.received_packets >= 1);
        assert!(status.forwarded_packets >= 1);

        let stopped = stop_udp_broadcast_bridge(&bridge_id).expect("stop bridge");
        assert!(!stopped.running);
    }

    #[test]
    fn self_test_reports_success() {
        let report = self_test_udp_broadcast_bridge().expect("self test udp broadcast bridge");
        assert!(report.ok);
        assert_eq!(report.sent, "hello udp broadcast bridge");
        assert_eq!(report.received, "hello udp broadcast bridge");
        assert!(report.received_packets >= 1);
        assert!(report.forwarded_packets >= 1);
    }
}
