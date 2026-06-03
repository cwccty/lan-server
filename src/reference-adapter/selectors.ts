import { REFERENCE_RUNTIME_EVENT } from './bootstrap';
import { summarizeReferenceRuntime } from './mappers';
import type { ReferenceRuntimeSnapshot, ReferenceStatusSummary } from './types';

export function getCurrentReferenceRuntimeSnapshot() {
  return window.__LAN_HELPER_REFERENCE_RUNTIME__ ?? null;
}

export function getCurrentReferenceStatusSummary(): ReferenceStatusSummary | null {
  const snapshot = getCurrentReferenceRuntimeSnapshot();
  return snapshot ? summarizeReferenceRuntime(snapshot) : null;
}

export function subscribeReferenceRuntime(listener: (snapshot: ReferenceRuntimeSnapshot | null) => void) {
  const handleUpdate = (event: Event) => {
    const custom = event as CustomEvent<ReferenceRuntimeSnapshot>;
    listener(custom.detail ?? getCurrentReferenceRuntimeSnapshot());
  };

  window.addEventListener(REFERENCE_RUNTIME_EVENT, handleUpdate as EventListener);
  listener(getCurrentReferenceRuntimeSnapshot());

  return () => {
    window.removeEventListener(REFERENCE_RUNTIME_EVENT, handleUpdate as EventListener);
  };
}

export function selectReferenceNetworkStatus(snapshot: ReferenceRuntimeSnapshot | null) {
  if (!snapshot) {
    return {
      label: '等待 runtime 快照',
      running: false,
      ready: false,
      virtualIp: '',
      supernode: '',
      hasError: false
    };
  }
  const summary = summarizeReferenceRuntime(snapshot);
  return {
    label: summary.network_label,
    running: summary.network_running,
    ready: summary.network_ready,
    virtualIp: summary.virtual_ip,
    supernode: summary.supernode,
    hasError: Boolean(summary.short_error)
  };
}

export function selectReferenceTerrariaStatus(snapshot: ReferenceRuntimeSnapshot | null) {
  return {
    running: Boolean(snapshot?.server_session?.running),
    ready: Boolean(snapshot?.server_session?.ready),
    pid: snapshot?.server_session?.pid ?? null,
    message: snapshot?.server_session?.message ?? '尚无 Terraria 会话快照',
    recentLogs: snapshot?.server_session?.logs?.slice(-8) ?? []
  };
}

export function selectReferenceLibraryStatus(snapshot: ReferenceRuntimeSnapshot | null) {
  return {
    gameCount: snapshot?.games.length ?? 0,
    adapterCount: snapshot?.adapters.length ?? 0,
    releaseReady: snapshot?.diagnostic_report?.release_ready ?? null,
    errors: snapshot?.errors ?? []
  };
}
