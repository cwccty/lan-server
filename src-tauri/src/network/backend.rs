use crate::models::network::{
    BackendRuntimeStatus, BackendSummary, ConnectivityReport, NetworkConfig, SetupResult,
};

#[allow(dead_code)]
pub trait NetworkBackend {
    fn detect(&self) -> BackendSummary;
    fn setup(&self, config: NetworkConfig) -> SetupResult;
    fn start(&self) -> BackendRuntimeStatus;
    fn stop(&self) -> BackendRuntimeStatus;
    fn test_peer(&self, host: String, ports: Vec<u16>) -> Result<ConnectivityReport, String>;
}
