import {
  generateDiagnosticReport,
  getN2nDiagnostics,
  getN2nLastConfig,
  listGameAdapters,
  listNetworkBackends,
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

export async function readReferenceRuntimeSnapshot(options: { includeDiagnostics?: boolean } = {}): Promise<ReferenceRuntimeSnapshot> {
  const errors: string[] = [];
  const includeDiagnostics = options.includeDiagnostics ?? false;

  const [n2n, n2nLastConfig, backends, games, adapters, serverSession, diagnosticReport] = await Promise.all([
    collect(errors, 'n2n diagnostics', getN2nDiagnostics, null),
    collect(errors, 'n2n last config', getN2nLastConfig, null),
    collect(errors, 'network backends', listNetworkBackends, []),
    collect(errors, 'game scan', scanGames, []),
    collect(errors, 'game adapters', listGameAdapters, []),
    collect(errors, 'server session', readServerSession, null),
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
    diagnostic_report: diagnosticReport,
    errors
  };
}
