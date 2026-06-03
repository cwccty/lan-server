import type { DiagnosticReport } from '../types/diagnostics';
import type { GameAdapter, GameSummary } from '../types/game';
import type { BackendSummary, N2nDiagnostics, NetworkConfig } from '../types/network';
import type { PortProxyStatus } from '../types/portProxy';
import type { ServerSessionStatus } from '../types/serverSession';
import type { UdpBroadcastBridgeStatus } from '../types/udpBroadcastBridge';
import type { UdpProxyStatus } from '../types/udpProxy';

export type ReferenceRuntimeSource = 'tauri' | 'unavailable';

export interface ReferenceRuntimeSnapshot {
  source: ReferenceRuntimeSource;
  loaded_at: string;
  n2n: N2nDiagnostics | null;
  n2n_last_config: NetworkConfig | null;
  backends: BackendSummary[];
  games: GameSummary[];
  adapters: GameAdapter[];
  server_session: ServerSessionStatus | null;
  port_proxies: PortProxyStatus[];
  udp_proxies: UdpProxyStatus[];
  udp_broadcast_bridges: UdpBroadcastBridgeStatus[];
  diagnostic_report: DiagnosticReport | null;
  errors: string[];
}

export interface ReferenceStatusSummary {
  network_label: string;
  network_running: boolean;
  network_ready: boolean;
  virtual_ip: string;
  supernode: string;
  terraria_running: boolean;
  terraria_ready: boolean;
  game_count: number;
  adapter_count: number;
  release_ready: boolean | null;
  short_error: string;
}

export const emptyReferenceRuntimeSnapshot = (errors: string[] = []): ReferenceRuntimeSnapshot => ({
  source: errors.length > 0 ? 'unavailable' : 'tauri',
  loaded_at: new Date().toISOString(),
  n2n: null,
  n2n_last_config: null,
  backends: [],
  games: [],
  adapters: [],
  server_session: null,
  port_proxies: [],
  udp_proxies: [],
  udp_broadcast_bridges: [],
  diagnostic_report: null,
  errors
});
