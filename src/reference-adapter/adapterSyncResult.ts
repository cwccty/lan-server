import type { AdapterRegistrySyncResult } from '../api/tauri';

const SYNC_RESULT_KEY = 'lan-helper.referenceAdapterSyncResult';
export const ADAPTER_SYNC_RESULT_EVENT = 'lan-helper:reference-adapter-sync-result-changed';

export interface ReferenceAdapterSyncRecord {
  source: 'remote' | 'local';
  saved_at: string;
  result: AdapterRegistrySyncResult;
}

function normalize(value: unknown): ReferenceAdapterSyncRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<ReferenceAdapterSyncRecord>;
  if (!record.result || typeof record.result !== 'object') return null;
  return {
    source: record.source === 'local' ? 'local' : 'remote',
    saved_at: String(record.saved_at || new Date().toISOString()),
    result: record.result as AdapterRegistrySyncResult
  };
}

export function getReferenceAdapterSyncResult() {
  try {
    const raw = window.localStorage.getItem(SYNC_RESULT_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setReferenceAdapterSyncResult(source: 'remote' | 'local', result: AdapterRegistrySyncResult) {
  const record: ReferenceAdapterSyncRecord = {
    source,
    result,
    saved_at: new Date().toISOString()
  };
  window.localStorage.setItem(SYNC_RESULT_KEY, JSON.stringify(record));
  window.dispatchEvent(new CustomEvent<ReferenceAdapterSyncRecord>(ADAPTER_SYNC_RESULT_EVENT, { detail: record }));
  return record;
}

export function subscribeReferenceAdapterSyncResult(listener: (record: ReferenceAdapterSyncRecord | null) => void) {
  const handle = () => listener(getReferenceAdapterSyncResult());
  window.addEventListener(ADAPTER_SYNC_RESULT_EVENT, handle);
  window.addEventListener('storage', handle);
  return () => {
    window.removeEventListener(ADAPTER_SYNC_RESULT_EVENT, handle);
    window.removeEventListener('storage', handle);
  };
}
