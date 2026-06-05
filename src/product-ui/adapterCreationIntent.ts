import type { GameNetworkType } from '../types/game';

export const ADAPTER_CREATION_INTENT_KEY = 'lan-helper.adapterCreationIntent';

export interface AdapterCreationIntent {
  source: 'diagnostics' | 'game_scan' | 'recommendation' | 'manual';
  reason: 'missing_adapter' | 'needs_review' | 'conversion_assessment' | 'manual';
  game_id?: string;
  display_name?: string;
  steam_appid?: string | null;
  detected_path?: string | null;
  issue_ids?: string[];
  note?: string;
  network_type?: GameNetworkType;
  route_kind?: string;
  conversion_verdict?: string;
  game_type?: string;
  original_capability?: string;
  recommended_plan?: string;
  can_become_lan?: boolean;
  default_port?: number | null;
  admin_evidence?: string[];
  user_steps?: string[];
  boundaries?: string[];
  adapter_signals?: string[];
  assessment_report?: string;
  created_at: string;
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeNetworkType(value: unknown): GameNetworkType | undefined {
  const allowed: GameNetworkType[] = [
    'lan_ip_direct',
    'dedicated_server',
    'tcp_port_proxy_needed',
    'udp_broadcast_needed',
    'steam_lobby_direct_possible',
    'steam_relay_plugin',
    'local_coop_remote_play',
    'steam_p2p_only',
    'mod_required',
    'official_only',
    'not_supported',
    'unknown_need_review',
  ];
  return allowed.includes(value as GameNetworkType) ? value as GameNetworkType : undefined;
}

function normalizeIntent(value: unknown): AdapterCreationIntent | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<AdapterCreationIntent>;
  const defaultPort = Number(record.default_port);
  return {
    source: record.source === 'diagnostics' || record.source === 'game_scan' || record.source === 'recommendation' || record.source === 'manual' ? record.source : 'manual',
    reason: record.reason === 'missing_adapter' || record.reason === 'needs_review' || record.reason === 'conversion_assessment' || record.reason === 'manual' ? record.reason : 'manual',
    game_id: record.game_id ? String(record.game_id) : undefined,
    display_name: record.display_name ? String(record.display_name) : undefined,
    steam_appid: record.steam_appid ? String(record.steam_appid) : null,
    detected_path: record.detected_path ? String(record.detected_path) : null,
    issue_ids: normalizeStringList(record.issue_ids),
    note: record.note ? String(record.note) : undefined,
    network_type: normalizeNetworkType(record.network_type),
    route_kind: record.route_kind ? String(record.route_kind) : undefined,
    conversion_verdict: record.conversion_verdict ? String(record.conversion_verdict) : undefined,
    game_type: record.game_type ? String(record.game_type) : undefined,
    original_capability: record.original_capability ? String(record.original_capability) : undefined,
    recommended_plan: record.recommended_plan ? String(record.recommended_plan) : undefined,
    can_become_lan: typeof record.can_become_lan === 'boolean' ? record.can_become_lan : undefined,
    default_port: Number.isFinite(defaultPort) && defaultPort > 0 ? defaultPort : null,
    admin_evidence: normalizeStringList(record.admin_evidence),
    user_steps: normalizeStringList(record.user_steps),
    boundaries: normalizeStringList(record.boundaries),
    adapter_signals: normalizeStringList(record.adapter_signals),
    assessment_report: record.assessment_report ? String(record.assessment_report) : undefined,
    created_at: record.created_at ? String(record.created_at) : new Date().toISOString(),
  };
}

export function writeAdapterCreationIntent(intent: Omit<AdapterCreationIntent, 'created_at'> & { created_at?: string }) {
  const next = normalizeIntent({
    ...intent,
    created_at: intent.created_at || new Date().toISOString(),
  });
  if (!next) return;
  window.localStorage.setItem(ADAPTER_CREATION_INTENT_KEY, JSON.stringify(next));
}

export function readAdapterCreationIntent(): AdapterCreationIntent | null {
  try {
    const raw = window.localStorage.getItem(ADAPTER_CREATION_INTENT_KEY);
    if (!raw) return null;
    return normalizeIntent(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearAdapterCreationIntent() {
  window.localStorage.removeItem(ADAPTER_CREATION_INTENT_KEY);
}
