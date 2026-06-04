export interface UdpProxyConfig {
  id?: string | null;
  listen_host: string;
  listen_port: number;
  target_host: string;
  target_port: number;
  label?: string | null;
  game_id?: string | null;
  client_ttl_seconds?: number | null;
}

export interface UdpProxyStatus {
  id: string;
  running: boolean;
  listen: string;
  target: string;
  active_clients: number;
  packets_in: number;
  packets_out: number;
  bytes_in: number;
  bytes_out: number;
  last_error?: string | null;
  logs: string[];
}

export interface UdpProxySelfTestReport {
  ok: boolean;
  listen: string;
  target: string;
  sent: string;
  received: string;
  packets_in: number;
  packets_out: number;
  bytes_in: number;
  bytes_out: number;
  notes: string[];
  status: UdpProxyStatus;
}
