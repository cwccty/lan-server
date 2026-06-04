export interface UdpBroadcastBridgeConfig {
  id?: string | null;
  listen_host: string;
  listen_port: number;
  forward_targets: string[];
  label?: string | null;
  game_id?: string | null;
  allow_broadcast?: boolean | null;
  duplicate_ttl_ms?: number | null;
}

export interface UdpBroadcastBridgeStatus {
  id: string;
  running: boolean;
  listen: string;
  forward_targets: string[];
  received_packets: number;
  forwarded_packets: number;
  dropped_packets: number;
  bytes_in: number;
  bytes_out: number;
  last_error?: string | null;
  logs: string[];
}

export interface UdpBroadcastBridgeSelfTestReport {
  ok: boolean;
  listen: string;
  forward_targets: string[];
  sent: string;
  received: string;
  received_packets: number;
  forwarded_packets: number;
  dropped_packets: number;
  bytes_in: number;
  bytes_out: number;
  notes: string[];
  status: UdpBroadcastBridgeStatus;
}
