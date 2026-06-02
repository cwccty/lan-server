export type NetworkBackendKind = 'manual_lan' | 'radmin' | 'n2n';

export interface BackendSummary {
  id: NetworkBackendKind;
  name: string;
  installed: boolean;
  available: boolean;
  virtual_ip?: string;
  notes: string[];
}

export interface NetworkConfig {
  room_name?: string;
  secret?: string;
  supernode?: string;
  local_ip?: string;
}

export interface SetupResult {
  ok: boolean;
  message: string;
}

export interface BackendRuntimeStatus {
  backend_id: NetworkBackendKind;
  running: boolean;
  virtual_ip?: string;
  message: string;
}

export interface N2nDiagnostics {
  running: boolean;
  supernode_configured: boolean;
  supernode?: string;
  virtual_ip?: string;
  ack: boolean;
  pong: boolean;
  ok_link: boolean;
  auth_error: boolean;
  ip_mac_conflict: boolean;
  not_responding: boolean;
  last_error?: string;
  summary: string;
  log_path: string;
  recent_logs: string[];
}

export interface ConnectivityTarget {
  host: string;
  ports: number[];
  timeout_ms?: number;
  mode?: 'generic' | 'local_game_port' | 'n2n_game_port';
}

export interface PortCheckResult {
  port: number;
  reachable: boolean;
  latency_ms?: number;
  error?: string;
}

export interface ConnectivityReport {
  target_host: string;
  reachable: boolean;
  latency_ms?: number;
  ports: PortCheckResult[];
  notes: string[];
}
