export type NetworkBackendKind = 'manual_lan' | 'radmin' | 'n2n';

export interface BackendSummary {
  id: NetworkBackendKind;
  name: string;
  installed: boolean;
  available: boolean;
  virtual_ip?: string | null;
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
  virtual_ip?: string | null;
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
  tap_error?: boolean;
  last_error?: string | null;
  summary: string;
  log_path: string;
  recent_logs: string[];
  executable_found?: boolean;
  executable_path?: string | null;
  recorded_pid?: number | null;
  recorded_pid_running?: boolean;
  connection_state?: string;
  manual_start_command?: string | null;
}

export interface ConnectivityTarget {
  host: string;
  ports: number[];
  timeout_ms?: number;
  mode?: 'generic' | 'local_game_port' | 'n2n_game_port';
  protocol?: 'tcp' | 'udp' | 'tcp_udp';
}

export interface PortCheckResult {
  port: number;
  reachable: boolean;
  latency_ms?: number | null;
  error?: string | null;
}

export interface ConnectivityReport {
  target_host: string;
  reachable: boolean;
  latency_ms?: number | null;
  ports: PortCheckResult[];
  notes: string[];
}
