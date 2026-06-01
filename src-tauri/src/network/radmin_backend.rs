use crate::models::network::{BackendRuntimeStatus, BackendSummary, NetworkConfig, SetupResult};
use crate::network::windows_ip;

pub fn detect() -> BackendSummary {
    let installed = std::path::Path::new(r"C:\Program Files (x86)\Radmin VPN\RvRvpnGui.exe").exists()
        || std::path::Path::new(r"C:\Program Files\Radmin VPN\RvRvpnGui.exe").exists();
    let virtual_ip = find_radmin_virtual_ip();
    BackendSummary {
        id: "radmin".to_string(),
        name: "Radmin VPN".to_string(),
        installed,
        available: installed || virtual_ip.is_some(),
        virtual_ip,
        notes: if installed {
            vec!["检测到 Radmin VPN，第一版仅做辅助检测和引导。".to_string()]
        } else {
            vec!["未检测到 Radmin VPN。".to_string()]
        },
    }
}

pub fn setup(_config: NetworkConfig) -> SetupResult {
    SetupResult {
        ok: false,
        message: "Radmin 第一版不自动创建网络，请在 Radmin 客户端中加入同一网络。".to_string(),
    }
}

pub fn start() -> BackendRuntimeStatus {
    BackendRuntimeStatus {
        backend_id: "radmin".to_string(),
        running: detect().installed,
        virtual_ip: find_radmin_virtual_ip(),
        message: "Radmin 由外部客户端管理。".to_string(),
    }
}

pub fn stop() -> BackendRuntimeStatus {
    BackendRuntimeStatus {
        backend_id: "radmin".to_string(),
        running: detect().installed,
        virtual_ip: find_radmin_virtual_ip(),
        message: "联机助手不会停止外部 Radmin 客户端。".to_string(),
    }
}

fn find_radmin_virtual_ip() -> Option<String> {
    windows_ip::find_ipv4_by_interface_keywords(&["radmin"])
}
