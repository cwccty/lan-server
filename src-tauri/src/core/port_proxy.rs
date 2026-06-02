use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use crate::core::connectivity_tester;
use crate::models::network::{ConnectivityReport, ConnectivityTarget};
use crate::models::port_proxy::{PortProxyConfig, PortProxyStatus};

const DEFAULT_PROXY_ID: &str = "default";
const MAX_LOGS: usize = 80;

struct ProxyRuntime {
    id: String,
    protocol: String,
    listen: String,
    target: String,
    stop: Arc<AtomicBool>,
    active_connections: Arc<AtomicU32>,
    total_connections: Arc<AtomicU64>,
    bytes_in: Arc<AtomicU64>,
    bytes_out: Arc<AtomicU64>,
    last_error: Arc<Mutex<Option<String>>>,
    logs: Arc<Mutex<Vec<String>>>,
}

static PROXIES: OnceLock<Mutex<HashMap<String, Arc<ProxyRuntime>>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, Arc<ProxyRuntime>>> {
    PROXIES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn start_port_proxy(config: PortProxyConfig) -> Result<PortProxyStatus, String> {
    let protocol = config.protocol.trim().to_ascii_lowercase();
    if protocol != "tcp" {
        return Err("端口代理 MVP 当前只支持 TCP。".to_string());
    }

    let id = config
        .id
        .as_deref()
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .unwrap_or(DEFAULT_PROXY_ID)
        .to_string();
    let listen = format!("{}:{}", config.listen_host.trim(), config.listen_port);
    let target = format!("{}:{}", config.target_host.trim(), config.target_port);

    if config.listen_port == 0 || config.target_port == 0 {
        return Err("监听端口和目标端口必须大于 0。".to_string());
    }

    stop_port_proxy(&id).ok();

    let listener = TcpListener::bind(&listen)
        .map_err(|err| format!("启动端口代理监听失败 {listen}: {err}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|err| format!("设置端口代理非阻塞监听失败: {err}"))?;

    let runtime = Arc::new(ProxyRuntime {
        id: id.clone(),
        protocol: "tcp".to_string(),
        listen: listen.clone(),
        target: target.clone(),
        stop: Arc::new(AtomicBool::new(false)),
        active_connections: Arc::new(AtomicU32::new(0)),
        total_connections: Arc::new(AtomicU64::new(0)),
        bytes_in: Arc::new(AtomicU64::new(0)),
        bytes_out: Arc::new(AtomicU64::new(0)),
        last_error: Arc::new(Mutex::new(None)),
        logs: Arc::new(Mutex::new(Vec::new())),
    });

    push_log(&runtime, format!("端口代理启动：{listen} -> {target}"));
    if config.listen_host.trim() == "0.0.0.0" {
        push_log(
            &runtime,
            "警告：当前监听 0.0.0.0，请确认不会暴露到不需要的网络。".to_string(),
        );
    }

    registry()
        .lock()
        .map_err(|_| "端口代理状态锁已损坏。".to_string())?
        .insert(id.clone(), runtime.clone());

    thread::spawn(move || accept_loop(runtime, listener));

    get_port_proxy_status(&id)
}

pub fn stop_port_proxy(id: &str) -> Result<PortProxyStatus, String> {
    let runtime = {
        let mut guard = registry()
            .lock()
            .map_err(|_| "端口代理状态锁已损坏。".to_string())?;
        guard.remove(id)
    };

    let Some(runtime) = runtime else {
        return Ok(PortProxyStatus {
            id: id.to_string(),
            running: false,
            protocol: "tcp".to_string(),
            listen: String::new(),
            target: String::new(),
            active_connections: 0,
            total_connections: 0,
            bytes_in: 0,
            bytes_out: 0,
            last_error: Some("端口代理未运行。".to_string()),
            logs: Vec::new(),
        });
    };

    runtime.stop.store(true, Ordering::SeqCst);
    push_log(&runtime, "端口代理停止请求已发送。".to_string());
    let mut status = status_from_runtime(&runtime);
    status.running = false;
    Ok(status)
}

pub fn stop_all_port_proxies() {
    let ids = registry()
        .lock()
        .map(|guard| guard.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    for id in ids {
        let _ = stop_port_proxy(&id);
    }
}

pub fn list_port_proxies() -> Vec<PortProxyStatus> {
    registry()
        .lock()
        .map(|guard| guard.values().map(status_from_runtime).collect())
        .unwrap_or_default()
}

pub fn get_port_proxy_status(id: &str) -> Result<PortProxyStatus, String> {
    let runtime = registry()
        .lock()
        .map_err(|_| "端口代理状态锁已损坏。".to_string())?
        .get(id)
        .cloned();

    runtime
        .map(|item| status_from_runtime(&item))
        .ok_or_else(|| format!("端口代理未运行: {id}"))
}

pub fn test_port_proxy(id: &str) -> Result<ConnectivityReport, String> {
    let status = get_port_proxy_status(id)?;
    let (mut host, port) = parse_host_port(&status.listen)?;
    if host == "0.0.0.0" || host == "::" {
        host = "127.0.0.1".to_string();
    }
    connectivity_tester::test_connectivity(ConnectivityTarget {
        host,
        ports: vec![port],
        timeout_ms: Some(1200),
        mode: Some("generic".to_string()),
    })
}

fn accept_loop(runtime: Arc<ProxyRuntime>, listener: TcpListener) {
    while !runtime.stop.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((client, addr)) => {
                runtime.total_connections.fetch_add(1, Ordering::SeqCst);
                runtime.active_connections.fetch_add(1, Ordering::SeqCst);
                push_log(&runtime, format!("新连接：{addr}"));
                let cloned = runtime.clone();
                thread::spawn(move || handle_connection(cloned, client, addr.to_string()));
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(80));
            }
            Err(err) => {
                set_error(&runtime, format!("接受连接失败：{err}"));
                thread::sleep(Duration::from_millis(200));
            }
        }
    }
    push_log(&runtime, "端口代理监听线程已退出。".to_string());
}

fn handle_connection(runtime: Arc<ProxyRuntime>, client: TcpStream, source: String) {
    let target = runtime.target.clone();
    let upstream = match TcpStream::connect(&target) {
        Ok(stream) => stream,
        Err(err) => {
            set_error(&runtime, format!("连接目标失败 {target}: {err}"));
            runtime.active_connections.fetch_sub(1, Ordering::SeqCst);
            return;
        }
    };

    let client_to_target = match (client.try_clone(), upstream.try_clone()) {
        (Ok(reader), Ok(writer)) => pipe_streams(reader, writer),
        (Err(err), _) | (_, Err(err)) => {
            set_error(&runtime, format!("复制 TCP 流失败：{err}"));
            runtime.active_connections.fetch_sub(1, Ordering::SeqCst);
            return;
        }
    };

    let target_to_client = pipe_streams(upstream, client);
    let bytes_in = client_to_target.join().unwrap_or(0);
    let bytes_out = target_to_client.join().unwrap_or(0);

    runtime.bytes_in.fetch_add(bytes_in, Ordering::SeqCst);
    runtime.bytes_out.fetch_add(bytes_out, Ordering::SeqCst);
    runtime.active_connections.fetch_sub(1, Ordering::SeqCst);
    push_log(
        &runtime,
        format!("连接关闭：{source}，上行 {bytes_in} bytes，下行 {bytes_out} bytes"),
    );
}

fn pipe_streams(mut reader: TcpStream, mut writer: TcpStream) -> thread::JoinHandle<u64> {
    thread::spawn(move || {
        let mut total = 0_u64;
        let mut buffer = [0_u8; 16 * 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    if writer.write_all(&buffer[..size]).is_err() {
                        break;
                    }
                    total += size as u64;
                }
                Err(_) => break,
            }
        }
        let _ = writer.shutdown(Shutdown::Write);
        total
    })
}

fn status_from_runtime(runtime: &Arc<ProxyRuntime>) -> PortProxyStatus {
    PortProxyStatus {
        id: runtime.id.clone(),
        running: !runtime.stop.load(Ordering::SeqCst),
        protocol: runtime.protocol.clone(),
        listen: runtime.listen.clone(),
        target: runtime.target.clone(),
        active_connections: runtime.active_connections.load(Ordering::SeqCst),
        total_connections: runtime.total_connections.load(Ordering::SeqCst),
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

fn push_log(runtime: &Arc<ProxyRuntime>, line: String) {
    if let Ok(mut logs) = runtime.logs.lock() {
        logs.push(line);
        if logs.len() > MAX_LOGS {
            let overflow = logs.len() - MAX_LOGS;
            logs.drain(0..overflow);
        }
    }
}

fn set_error(runtime: &Arc<ProxyRuntime>, error: String) {
    if let Ok(mut last_error) = runtime.last_error.lock() {
        *last_error = Some(error.clone());
    }
    push_log(runtime, format!("错误：{error}"));
}

fn parse_host_port(value: &str) -> Result<(String, u16), String> {
    let Some((host, port)) = value.rsplit_once(':') else {
        return Err(format!("无法解析地址: {value}"));
    };
    let port = port
        .parse::<u16>()
        .map_err(|err| format!("无法解析端口 {port}: {err}"))?;
    Ok((host.to_string(), port))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::time::{Duration, Instant};

    fn free_port() -> u16 {
        TcpListener::bind("127.0.0.1:0")
            .expect("bind ephemeral port")
            .local_addr()
            .expect("read local addr")
            .port()
    }

    fn wait_for_tcp(host: &str, port: u16) {
        let deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < deadline {
            if TcpStream::connect((host, port)).is_ok() {
                return;
            }
            thread::sleep(Duration::from_millis(40));
        }
        panic!("tcp listener did not become ready on {host}:{port}");
    }

    #[test]
    fn tcp_proxy_forwards_bytes_end_to_end() {
        let target_listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind target");
        let target_port = target_listener.local_addr().expect("target addr").port();
        let proxy_port = free_port();
        let proxy_id = format!("test-proxy-{proxy_port}");

        thread::spawn(move || {
            for _ in 0..4 {
                let (mut stream, _) = target_listener.accept().expect("accept target connection");
                let mut buffer = [0_u8; 64];
                let size = stream.read(&mut buffer).expect("read proxied data");
                if size == 0 {
                    continue;
                }
                stream.write_all(&buffer[..size]).expect("echo proxied data");
                break;
            }
        });

        let status = start_port_proxy(PortProxyConfig {
            id: Some(proxy_id.clone()),
            protocol: "tcp".to_string(),
            listen_host: "127.0.0.1".to_string(),
            listen_port: proxy_port,
            target_host: "127.0.0.1".to_string(),
            target_port,
            label: Some("test proxy".to_string()),
            game_id: None,
        })
        .expect("start proxy");
        assert!(status.running);
        assert_eq!(status.listen, format!("127.0.0.1:{proxy_port}"));

        wait_for_tcp("127.0.0.1", proxy_port);
        let mut client = TcpStream::connect(("127.0.0.1", proxy_port)).expect("connect proxy");
        client.write_all(b"hello-proxy").expect("write proxy");
        let mut response = [0_u8; 32];
        let size = client.read(&mut response).expect("read echo");
        assert_eq!(&response[..size], b"hello-proxy");

        let status = get_port_proxy_status(&proxy_id).expect("read proxy status");
        assert!(status.total_connections >= 1);

        let stopped = stop_port_proxy(&proxy_id).expect("stop proxy");
        assert!(!stopped.running);
    }
}
