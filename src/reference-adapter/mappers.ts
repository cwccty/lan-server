import type { ReferenceRuntimeSnapshot, ReferenceStatusSummary } from './types';

export function summarizeReferenceRuntime(snapshot: ReferenceRuntimeSnapshot): ReferenceStatusSummary {
  const n2nBackend = snapshot.backends.find((backend) => backend.id === 'n2n');
  const n2n = snapshot.n2n;
  const config = snapshot.n2n_last_config;
  // available 只代表 edge.exe 存在，不能当作 edge 正在运行。
  // ok_link 也必须建立在当前 edge 进程仍运行的基础上，否则停止后旧 ACK/PONG 日志会误报“已连接”。
  const networkRunning = Boolean(n2n?.running);
  const networkReady = Boolean(n2n?.running && n2n?.ok_link);
  const virtualIp = n2n?.virtual_ip || n2nBackend?.virtual_ip || config?.local_ip || '';
  const supernode = n2n?.supernode || config?.supernode || '';

  return {
    network_label: n2n?.summary || n2nBackend?.notes?.[0] || (networkRunning ? 'n2n 运行中，等待真实诊断。' : 'n2n 未运行。'),
    network_running: networkRunning,
    network_ready: networkReady,
    virtual_ip: virtualIp,
    supernode,
    terraria_running: Boolean(snapshot.server_session?.running),
    terraria_ready: Boolean(snapshot.server_session?.ready),
    game_count: snapshot.games.length,
    adapter_count: snapshot.adapters.length,
    release_ready: snapshot.diagnostic_report ? snapshot.diagnostic_report.release_ready : null,
    short_error: snapshot.errors[0] || ''
  };
}

export function snapshotForDebug(snapshot: ReferenceRuntimeSnapshot) {
  const summary = summarizeReferenceRuntime(snapshot);
  return {
    source: snapshot.source,
    loaded_at: snapshot.loaded_at,
    summary,
    errors: snapshot.errors,
    n2n_recent_logs: snapshot.n2n?.recent_logs?.slice(-5) ?? [],
    server_recent_logs: snapshot.server_session?.logs?.slice(-5) ?? []
  };
}
