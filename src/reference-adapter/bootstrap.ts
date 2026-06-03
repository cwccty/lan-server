import { readReferenceRuntimeSnapshot } from './runtimeStore';
import { snapshotForDebug } from './mappers';
import type { ReferenceRuntimeSnapshot } from './types';

const EVENT_NAME = 'lan-helper:reference-runtime-updated';
const DEFAULT_INTERVAL_MS = 5000;

let timer: number | null = null;
let running = false;

async function refresh(includeDiagnostics = false, includeInventory = false) {
  const snapshot = await readReferenceRuntimeSnapshot({ includeDiagnostics, includeInventory });
  window.__LAN_HELPER_REFERENCE_RUNTIME__ = snapshot;
  window.dispatchEvent(
    new CustomEvent<ReferenceRuntimeSnapshot>(EVENT_NAME, {
      detail: snapshot
    })
  );

  if (window.localStorage.getItem('lan-helper.referenceRuntimeDebug') === '1') {
    // 调试用途：不影响页面视觉，也不向用户展示假状态。
    console.debug('[lan-helper/reference-runtime]', snapshotForDebug(snapshot));
  }

  return snapshot;
}

export function startReferenceRuntimeBridge(options: { intervalMs?: number; includeDiagnostics?: boolean; includeInventory?: boolean } = {}) {
  if (running) return;
  running = true;

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const includeDiagnostics = options.includeDiagnostics ?? false;
  const includeInventory = options.includeInventory ?? false;

  void refresh(includeDiagnostics, includeInventory);
  timer = window.setInterval(() => {
    void refresh(includeDiagnostics, includeInventory);
  }, intervalMs);
}

export function stopReferenceRuntimeBridge() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  running = false;
}

export { EVENT_NAME as REFERENCE_RUNTIME_EVENT };
