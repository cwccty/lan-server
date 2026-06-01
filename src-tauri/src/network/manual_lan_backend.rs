use crate::models::network::{BackendRuntimeStatus, BackendSummary, NetworkConfig, SetupResult};

pub fn detect() -> BackendSummary {
    BackendSummary {
        id: "manual_lan".to_string(),
        name: "手动 LAN/IP".to_string(),
        installed: true,
        available: true,
        virtual_ip: None,
        notes: vec!["适用于已有局域网、已有 VPN、Tailscale/ZeroTier 等场景。".to_string()],
    }
}

pub fn setup(_config: NetworkConfig) -> SetupResult {
    SetupResult {
        ok: true,
        message: "Manual LAN 无需额外配置。".to_string(),
    }
}

pub fn start() -> BackendRuntimeStatus {
    BackendRuntimeStatus {
        backend_id: "manual_lan".to_string(),
        running: true,
        virtual_ip: None,
        message: "Manual LAN 模式已就绪。".to_string(),
    }
}

pub fn stop() -> BackendRuntimeStatus {
    BackendRuntimeStatus {
        backend_id: "manual_lan".to_string(),
        running: false,
        virtual_ip: None,
        message: "Manual LAN 无后台进程。".to_string(),
    }
}
