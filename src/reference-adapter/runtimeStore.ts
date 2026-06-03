import {
  generateDiagnosticReport,
  getN2nDiagnostics,
  getN2nLastConfig,
  listGameAdapters,
  listNetworkBackends,
  listPortProxies,
  listUdpBroadcastBridges,
  listUdpProxies,
  readServerSession,
  scanGames
} from '../api/tauri';
import { emptyReferenceRuntimeSnapshot, type ReferenceRuntimeSnapshot } from './types';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

async function collect<T>(errors: string[], label: string, task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch (error) {
    errors.push(`${label}: ${messageOf(error)}`);
    return fallback;
  }
}

export async function readReferenceRuntimeSnapshot(options: { includeDiagnostics?: boolean; includeInventory?: boolean } = {}): Promise<ReferenceRuntimeSnapshot> {
  const errors: string[] = [];
  const includeDiagnostics = options.includeDiagnostics ?? false;
  const includeInventory = options.includeInventory ?? false;

  const [n2n, n2nLastConfig, backends, games, adapters, serverSession, portProxies, udpProxies, udpBroadcastBridges, diagnosticReport] = await Promise.all([
    collect(errors, 'n2n diagnostics', getN2nDiagnostics, null),
    collect(errors, 'n2n last config', getN2nLastConfig, null),
    includeInventory
      ? collect(errors, 'network backends', listNetworkBackends, [])
      : Promise.resolve([]),
    includeInventory
      ? collect(errors, 'game scan', scanGames, [])
      : Promise.resolve([]),
    includeInventory
      ? collect(errors, 'game adapters', listGameAdapters, [])
      : Promise.resolve([]),
    collect(errors, 'server session', readServerSession, null),
    collect(errors, 'port proxies', listPortProxies, []),
    collect(errors, 'udp proxies', listUdpProxies, []),
    collect(errors, 'udp broadcast bridges', listUdpBroadcastBridges, []),
    includeDiagnostics
      ? collect(errors, 'diagnostic report', generateDiagnosticReport, null)
      : Promise.resolve(null)
  ]);

  if (errors.length >= 7) {
    return emptyReferenceRuntimeSnapshot(errors);
  }

  return {
    source: errors.length > 0 ? 'unavailable' : 'tauri',
    loaded_at: new Date().toISOString(),
    n2n,
    n2n_last_config: n2nLastConfig,
    backends,
    games,
    adapters,
    server_session: serverSession,
    port_proxies: portProxies,
    udp_proxies: udpProxies,
    udp_broadcast_bridges: udpBroadcastBridges,
    diagnostic_report: diagnosticReport,
    errors
  };
}
