import type { ReferenceAdvancedProxyKind } from '../reference-adapter/actions';

export const ADVANCED_TOOL_INTENT_KEY = 'lan-helper.advancedToolIntent';

export interface AdvancedToolIntent {
  source: 'diagnostics' | 'recommendation' | 'manual';
  reason: 'udp_broadcast_bridge' | 'port_proxy' | 'manual';
  kind: ReferenceAdvancedProxyKind;
  game_id?: string;
  display_name?: string;
  listen_port?: number | null;
  target_host?: string | null;
  target_port?: number | null;
  note?: string;
  evidence?: string[];
  created_at: string;
}

function normalizeKind(value: unknown): ReferenceAdvancedProxyKind {
  return value === 'udp' || value === 'bridge' || value === 'tcp' ? value : 'tcp';
}

function normalizeReason(value: unknown): AdvancedToolIntent['reason'] {
  if (value === 'udp_broadcast_bridge' || value === 'port_proxy' || value === 'manual') return value;
  return 'manual';
}

function normalizeSource(value: unknown): AdvancedToolIntent['source'] {
  if (value === 'diagnostics' || value === 'recommendation' || value === 'manual') return value;
  return 'manual';
}

function normalizePort(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeIntent(value: unknown): AdvancedToolIntent | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<AdvancedToolIntent>;
  return {
    source: normalizeSource(record.source),
    reason: normalizeReason(record.reason),
    kind: normalizeKind(record.kind),
    game_id: record.game_id ? String(record.game_id) : undefined,
    display_name: record.display_name ? String(record.display_name) : undefined,
    listen_port: normalizePort(record.listen_port),
    target_host: record.target_host ? String(record.target_host) : null,
    target_port: normalizePort(record.target_port),
    note: record.note ? String(record.note) : undefined,
    evidence: normalizeStringList(record.evidence),
    created_at: record.created_at ? String(record.created_at) : new Date().toISOString(),
  };
}

export function writeAdvancedToolIntent(intent: Omit<AdvancedToolIntent, 'created_at'> & { created_at?: string }) {
  const next = normalizeIntent({
    ...intent,
    created_at: intent.created_at || new Date().toISOString(),
  });
  if (!next) return;
  window.localStorage.setItem(ADVANCED_TOOL_INTENT_KEY, JSON.stringify(next));
}

export function readAdvancedToolIntent(): AdvancedToolIntent | null {
  try {
    const raw = window.localStorage.getItem(ADVANCED_TOOL_INTENT_KEY);
    if (!raw) return null;
    return normalizeIntent(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearAdvancedToolIntent() {
  window.localStorage.removeItem(ADVANCED_TOOL_INTENT_KEY);
}
