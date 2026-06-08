import type { ReferenceAdvancedProxyKind } from '../reference-adapter/actions';

export const ADVANCED_TOOL_INTENT_KEY = 'lan-helper.advancedToolIntent';
export const ADVANCED_TOOL_INTENT_UPDATED_EVENT = 'lan-helper:advanced-tool-intent-updated';

export type AdvancedConnectionCardId = 'steam_relay' | 'tcp_proxy' | 'udp_broadcast_bridge' | 'generic_server';

export interface AdvancedToolIntent {
  source: 'diagnostics' | 'recommendation' | 'manual';
  reason: 'udp_broadcast_bridge' | 'port_proxy' | 'bridge_or_proxy_choice' | 'steam_relay_p2p' | 'generic_server' | 'manual';
  kind: ReferenceAdvancedProxyKind;
  preferred_card?: AdvancedConnectionCardId;
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
  if (
    value === 'udp_broadcast_bridge'
    || value === 'port_proxy'
    || value === 'bridge_or_proxy_choice'
    || value === 'steam_relay_p2p'
    || value === 'generic_server'
    || value === 'manual'
  ) return value;
  return 'manual';
}

function normalizePreferredCard(value: unknown, reason: AdvancedToolIntent['reason'], kind: ReferenceAdvancedProxyKind): AdvancedConnectionCardId | undefined {
  if (
    value === 'steam_relay'
    || value === 'tcp_proxy'
    || value === 'udp_broadcast_bridge'
    || value === 'generic_server'
  ) return value;
  if (reason === 'steam_relay_p2p') return 'steam_relay';
  if (reason === 'generic_server') return 'generic_server';
  if (reason === 'bridge_or_proxy_choice') return undefined;
  if (reason === 'udp_broadcast_bridge' || kind === 'bridge') return 'udp_broadcast_bridge';
  if (reason === 'port_proxy') return 'tcp_proxy';
  return undefined;
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
  const reason = normalizeReason(record.reason);
  const kind = normalizeKind(record.kind);
  return {
    source: normalizeSource(record.source),
    reason,
    kind,
    preferred_card: normalizePreferredCard(record.preferred_card, reason, kind),
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

export function connectionCardFromAdvancedToolIntent(intent?: AdvancedToolIntent | null): AdvancedConnectionCardId | undefined {
  if (!intent) return undefined;
  return normalizePreferredCard(intent.preferred_card, intent.reason, intent.kind);
}

export function writeAdvancedToolIntent(intent: Omit<AdvancedToolIntent, 'created_at'> & { created_at?: string }) {
  const next = normalizeIntent({
    ...intent,
    created_at: intent.created_at || new Date().toISOString(),
  });
  if (!next) return;
  window.localStorage.setItem(ADVANCED_TOOL_INTENT_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(ADVANCED_TOOL_INTENT_UPDATED_EVENT, { detail: next }));
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
  window.dispatchEvent(new CustomEvent(ADVANCED_TOOL_INTENT_UPDATED_EVENT, { detail: null }));
}
