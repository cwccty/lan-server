import { invoke } from '@tauri-apps/api/core';
import type { DiagnosticReport } from '../types/diagnostics';
import type { GameAnalysis, GameSummary } from '../types/game';
import type {
  BackendRuntimeStatus,
  BackendSummary,
  ConnectivityReport,
  ConnectivityTarget,
  NetworkConfig,
  SetupResult
} from '../types/network';
import type { LaunchConfig, LaunchResult, Recommendation } from '../types/recommendation';

export const scanGames = () => invoke<GameSummary[]>('scan_games');
export const analyzeGame = (gameId: string) => invoke<GameAnalysis>('analyze_game', { gameId });
export const listNetworkBackends = () => invoke<BackendSummary[]>('list_network_backends');
export const setupNetwork = (backendId: string, config: NetworkConfig) =>
  invoke<SetupResult>('setup_network', { backendId, config });
export const startNetwork = (backendId: string) => invoke<BackendRuntimeStatus>('start_network', { backendId });
export const stopNetwork = (backendId: string) => invoke<BackendRuntimeStatus>('stop_network', { backendId });
export const testConnectivity = (target: ConnectivityTarget) =>
  invoke<ConnectivityReport>('test_connectivity', { target });
export const recommendPlans = (gameId: string) => invoke<Recommendation[]>('recommend_plans', { gameId });
export const launchProfile = (gameId: string, profileId: string, config: LaunchConfig = {}) =>
  invoke<LaunchResult>('launch_profile', { gameId, profileId, config });
export const generateDiagnosticReport = () => invoke<DiagnosticReport>('generate_diagnostic_report');
