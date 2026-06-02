import { invoke } from '@tauri-apps/api/core';
import type { DiagnosticReport } from '../types/diagnostics';
import type { GameAdapter, GameAnalysis, GameSummary } from '../types/game';
import type {
  BackendRuntimeStatus,
  BackendSummary,
  ConnectivityReport,
  ConnectivityTarget,
  N2nDiagnostics,
  NetworkConfig,
  SetupResult
} from '../types/network';
import type { LaunchConfig, LaunchResult, Recommendation } from '../types/recommendation';
import type { ServerSessionStatus } from '../types/serverSession';
import type { PortProxyConfig, PortProxyStatus } from '../types/portProxy';

export const scanGames = () => invoke<GameSummary[]>('scan_games');
export const analyzeGame = (gameId: string) => invoke<GameAnalysis>('analyze_game', { gameId });
export const listGameAdapters = () => invoke<GameAdapter[]>('list_game_adapters');
export const saveGameAdapter = (adapter: GameAdapter) => invoke<GameAdapter>('save_game_adapter', { adapter });
export const importGameAdapterJson = (content: string) =>
  invoke<GameAdapter>('import_game_adapter_json', { content });
export const exportGameAdapterJson = (gameId: string) =>
  invoke<string>('export_game_adapter_json', { gameId });
export interface AdapterRegistrySyncResult {
  ok: boolean;
  registry_url: string;
  updated: number;
  skipped: number;
  messages: string[];
}
export const syncAdapterRegistry = (registryUrl: string) =>
  invoke<AdapterRegistrySyncResult>('sync_adapter_registry', { registryUrl });
export const syncLocalAdapterRegistryExample = () =>
  invoke<AdapterRegistrySyncResult>('sync_local_adapter_registry_example');
export const listNetworkBackends = () => invoke<BackendSummary[]>('list_network_backends');
export const setupNetwork = (backendId: string, config: NetworkConfig) =>
  invoke<SetupResult>('setup_network', { backendId, config });
export const startNetwork = (backendId: string) => invoke<BackendRuntimeStatus>('start_network', { backendId });
export const stopNetwork = (backendId: string) => invoke<BackendRuntimeStatus>('stop_network', { backendId });
export const getN2nDiagnostics = () => invoke<N2nDiagnostics>('get_n2n_diagnostics');
export const getN2nLastConfig = () => invoke<NetworkConfig>('get_n2n_last_config');
export const testConnectivity = (target: ConnectivityTarget) =>
  invoke<ConnectivityReport>('test_connectivity', { target });
export const recommendPlans = (gameId: string) => invoke<Recommendation[]>('recommend_plans', { gameId });
export const launchProfile = (gameId: string, profileId: string, config: LaunchConfig = {}) =>
  invoke<LaunchResult>('launch_profile', { gameId, profileId, config });
export const generateDiagnosticReport = () => invoke<DiagnosticReport>('generate_diagnostic_report');

export const startGameServerSession = (gameId: string, profileId: string, config: LaunchConfig = {}) =>
  invoke<ServerSessionStatus>('start_game_server_session', { gameId, profileId, config });
export const readServerSession = () => invoke<ServerSessionStatus>('read_server_session');
export const stopServerSession = () => invoke<ServerSessionStatus>('stop_server_session');
export const sendServerCommand = (command: string) => invoke<ServerSessionStatus>('send_server_command', { command });

export const startPortProxy = (config: PortProxyConfig) =>
  invoke<PortProxyStatus>('start_port_proxy', { config });
export const stopPortProxy = (id: string) =>
  invoke<PortProxyStatus>('stop_port_proxy', { id });
export const listPortProxies = () => invoke<PortProxyStatus[]>('list_port_proxies');
export const getPortProxyStatus = (id: string) =>
  invoke<PortProxyStatus>('get_port_proxy_status', { id });
export const testPortProxy = (id: string) =>
  invoke<ConnectivityReport>('test_port_proxy', { id });
