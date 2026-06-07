import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { DiagnosticReport } from '../types/diagnostics';
import type { FriendAllocation, FriendAllocationInput, FriendCheckInput } from '../types/friend';
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
import type { GenericServerLaunchConfig, ServerSessionStatus } from '../types/serverSession';
import type { AppSettings, EdgePathCheck, UserAccountState } from '../types/settings';
import type { PortProxyConfig, PortProxySelfTestReport, PortProxyStatus } from '../types/portProxy';
import type {
  UdpBroadcastBridgeConfig,
  UdpBroadcastBridgeSelfTestReport,
  UdpBroadcastBridgeStatus
} from '../types/udpBroadcastBridge';
import type { UdpProxyConfig, UdpProxySelfTestReport, UdpProxyStatus } from '../types/udpProxy';

function normalizeTauriError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '\u672a\u77e5\u9519\u8bef');
  if (
    message.includes('__TAURI_INTERNALS__') ||
    message.includes('window.__TAURI__') ||
    message.includes("reading 'invoke'") ||
    message.includes('reading "invoke"') ||
    message.includes('IPC')
  ) {
    return new Error('\u5f53\u524d\u9875\u9762\u6ca1\u6709\u8fde\u63a5\u5230 Tauri \u540e\u7aef\u3002\u8bf7\u4ece\u6253\u5305\u540e\u7684 lan-helper.exe \u6253\u5f00\uff0c\u4e0d\u8981\u7528\u666e\u901a\u6d4f\u89c8\u5668\u9884\u89c8\u529f\u80fd\u9875\u3002');
  }
  return error instanceof Error ? error : new Error(message);
}

const invoke = async <T>(command: string, args?: Record<string, unknown>) => {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    throw normalizeTauriError(error);
  }
};

export const scanGames = () => invoke<GameSummary[]>('scan_games');
export const analyzeGame = (gameId: string) => invoke<GameAnalysis>('analyze_game', { gameId });
export const listGameAdapters = () => invoke<GameAdapter[]>('list_game_adapters');
export interface AdapterVariantInfo {
  game_id: string;
  display_name: string;
  source: string;
  path: string;
  priority: number;
  fingerprint: string;
  short_fingerprint: string;
  network_type?: string | null;
  default_ports: number[];
  modified_at?: string | null;
  is_active: boolean;
}

export interface AdapterConflictReport {
  game_id: string;
  display_name: string;
  active_source: string;
  active_path: string;
  active_fingerprint: string;
  has_conflict: boolean;
  variants: AdapterVariantInfo[];
  summary: string;
  recommendation: string;
}

export interface AdapterBackupEntry {
  id: string;
  game_id: string;
  display_name: string;
  source: string;
  reason: string;
  original_path: string;
  backup_path: string;
  metadata_path: string;
  created_at: string;
  fingerprint: string;
  short_fingerprint: string;
  size_bytes: number;
}

export interface AdapterRegistrySyncPreview {
  ok: boolean;
  registry_url: string;
  registry_version?: number | null;
  registry_updated_at?: string | null;
  total: number;
  will_create: number;
  will_update: number;
  unchanged: number;
  custom_protected: number;
  would_affect_active: number;
  possible_conflicts: number;
  skipped: number;
  items: AdapterRegistryPreviewItem[];
  messages: string[];
}

export interface AdapterRegistryPreviewItem {
  game_id: string;
  display_name?: string | null;
  adapter_url: string;
  status: string;
  reason: string;
  expected_sha256?: string | null;
  actual_sha256?: string | null;
  local_sources: string[];
  active_source?: string | null;
  has_custom: boolean;
  has_registry: boolean;
  would_write_registry: boolean;
  would_affect_active: boolean;
  conflict_with_custom: boolean;
  saved_path?: string | null;
  diff_fields: AdapterChangeDiffField[];
}

export interface AdapterChangeDiffField {
  field: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
  affects_recommendation: boolean;
}

export const previewAdapterRegistrySync = (registryUrl: string) =>
  invoke<AdapterRegistrySyncPreview>('preview_adapter_registry_sync', { registryUrl });
export const listAdapterConflicts = () => invoke<AdapterConflictReport[]>('list_adapter_conflicts');
export const listAdapterBackups = () => invoke<AdapterBackupEntry[]>('list_adapter_backups');
export const restoreAdapterBackup = (backupId: string) =>
  invoke<GameAdapter>('restore_adapter_backup', { backupId });
export const saveGameAdapter = (adapter: GameAdapter) => invoke<GameAdapter>('save_game_adapter', { adapter });
export const promoteRegistryAdapterToCustom = (gameId: string) =>
  invoke<GameAdapter>('promote_registry_adapter_to_custom', { gameId });
export const pinActiveAdapterAsCustom = (gameId: string) =>
  invoke<GameAdapter>('pin_active_adapter_as_custom', { gameId });
export const importGameAdapterJson = (content: string) =>
  invoke<GameAdapter>('import_game_adapter_json', { content });
export const exportGameAdapterJson = (gameId: string) =>
  invoke<string>('export_game_adapter_json', { gameId });
export interface AdapterRegistrySyncResult {
  ok: boolean;
  registry_url: string;
  registry_version?: number | null;
  registry_updated_at?: string | null;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  hash_failed: number;
  parse_failed: number;
  fetch_failed: number;
  validation_failed: number;
  write_failed: number;
  items: AdapterRegistrySyncItem[];
  messages: string[];
}

export interface AdapterRegistrySyncItem {
  game_id: string;
  display_name?: string | null;
  adapter_url: string;
  status: string;
  reason: string;
  expected_sha256?: string | null;
  actual_sha256?: string | null;
  saved_path?: string | null;
}

export interface AdapterRegistryLocalPublishEntry {
  game_id: string;
  display_name: string;
  adapter_path: string;
  adapter_url: string;
  sha256: string;
  status: string;
}

export interface AdapterRegistryLocalPublishResult {
  ok: boolean;
  registry_dir: string;
  games_dir: string;
  index_path: string;
  total: number;
  written: number;
  created: number;
  updated: number;
  unchanged: number;
  verified: boolean;
  index_game_count: number;
  entries: AdapterRegistryLocalPublishEntry[];
  messages: string[];
}
export const syncAdapterRegistry = (registryUrl: string) =>
  invoke<AdapterRegistrySyncResult>('sync_adapter_registry', { registryUrl });
export const syncLocalAdapterRegistryExample = () =>
  invoke<AdapterRegistrySyncResult>('sync_local_adapter_registry_example');
export const publishAdaptersToLocalRegistry = (gameIds: string[]) =>
  invoke<AdapterRegistryLocalPublishResult>('publish_adapters_to_local_registry', { gameIds });
export const getAppSettings = () => invoke<AppSettings>('get_app_settings');
export const saveAppSettings = (settings: AppSettings) =>
  invoke<AppSettings>('save_app_settings', { settings });
export const resetAppSettings = () => invoke<AppSettings>('reset_app_settings');
export const openPath = (path: string) => invoke<void>('open_path', { path });
export const testEdgePath = (path?: string | null) =>
  invoke<EdgePathCheck>('test_edge_path', { path });
export const getAccountState = () => invoke<UserAccountState>('get_account_state');
export const createLocalAccount = (nickname: string, password: string, rememberMe: boolean) =>
  invoke<UserAccountState>('create_local_account', { nickname, password, rememberMe });
export const loginLocalAccount = (nickname: string, password: string, rememberMe: boolean) =>
  invoke<UserAccountState>('login_local_account', { nickname, password, rememberMe });
export const logoutLocalAccount = () => invoke<UserAccountState>('logout_local_account');
export const updateAccountNickname = (nickname: string) =>
  invoke<UserAccountState>('update_account_nickname', { nickname });
export const listFriendAllocations = () =>
  invoke<FriendAllocation[]>('list_friend_allocations');
export const upsertFriendAllocation = (input: FriendAllocationInput) =>
  invoke<FriendAllocation>('upsert_friend_allocation', { input });
export const selectFriendAllocation = (input: FriendAllocationInput) =>
  invoke<FriendAllocation>('select_friend_allocation', { input });
export const removeFriendAllocation = (name: string, ip?: string | null) =>
  invoke<FriendAllocation>('remove_friend_allocation', { name, ip });
export const updateFriendCheck = (input: FriendCheckInput) =>
  invoke<FriendAllocation | null>('update_friend_check', { input });
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
export const generateDiagnosticReportForGame = (gameId: string) =>
  invoke<DiagnosticReport>('generate_diagnostic_report_for_game', { gameId });

export const startGameServerSession = (gameId: string, profileId: string, config: LaunchConfig = {}) =>
  invoke<ServerSessionStatus>('start_game_server_session', { gameId, profileId, config });
export const startGenericServerSession = (config: GenericServerLaunchConfig) =>
  invoke<ServerSessionStatus>('start_generic_server_session', { config });
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
export const selfTestPortProxy = () => invoke<PortProxySelfTestReport>('self_test_port_proxy');

export const startUdpProxy = (config: UdpProxyConfig) =>
  invoke<UdpProxyStatus>('start_udp_proxy', { config });
export const stopUdpProxy = (id: string) =>
  invoke<UdpProxyStatus>('stop_udp_proxy', { id });
export const listUdpProxies = () => invoke<UdpProxyStatus[]>('list_udp_proxies');
export const getUdpProxyStatus = (id: string) =>
  invoke<UdpProxyStatus>('get_udp_proxy_status', { id });
export const selfTestUdpProxy = () => invoke<UdpProxySelfTestReport>('self_test_udp_proxy');

export const startUdpBroadcastBridge = (config: UdpBroadcastBridgeConfig) =>
  invoke<UdpBroadcastBridgeStatus>('start_udp_broadcast_bridge', { config });
export const stopUdpBroadcastBridge = (id: string) =>
  invoke<UdpBroadcastBridgeStatus>('stop_udp_broadcast_bridge', { id });
export const listUdpBroadcastBridges = () =>
  invoke<UdpBroadcastBridgeStatus[]>('list_udp_broadcast_bridges');
export const getUdpBroadcastBridgeStatus = (id: string) =>
  invoke<UdpBroadcastBridgeStatus>('get_udp_broadcast_bridge_status', { id });
export const selfTestUdpBroadcastBridge = () =>
  invoke<UdpBroadcastBridgeSelfTestReport>('self_test_udp_broadcast_bridge');
