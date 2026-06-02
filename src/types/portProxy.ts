export interface PortProxyConfig {
  id?: string;
  protocol: 'tcp' | 'udp' | string;
  listen_host: string;
  listen_port: number;
  target_host: string;
  target_port: number;
  label?: string;
  game_id?: string;
}

export interface PortProxyStatus {
  id: string;
  running: boolean;
  protocol: string;
  listen: string;
  target: string;
  active_connections: number;
  total_connections: number;
  bytes_in: number;
  bytes_out: number;
  last_error?: string;
  logs: string[];
}
