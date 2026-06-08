import type { AdapterRegistrySyncResult } from '../api/tauri';
import type { GameAdapter } from '../types/game';
import { deriveAdapterCategory } from './adapterPresentation';

export type AdapterPublishState =
  | 'registry_synced'
  | 'publish_ready'
  | 'needs_review'
  | 'incomplete';

export interface AdapterPublishAudit {
  state: AdapterPublishState;
  label: string;
  badgeClass: string;
  summary: string;
  missing: string[];
  warnings: string[];
  review: string[];
  syncStatus: string;
  canSubmit: boolean;
}

function hasText(value?: string | null) {
  return Boolean(value && value.trim());
}

function hasList(values?: unknown[] | null) {
  return Boolean(values && values.length > 0);
}

function isNonLan(adapter: GameAdapter) {
  return adapter.network_type === 'local_coop_remote_play'
    || adapter.network_type === 'steam_p2p_only'
    || adapter.network_type === 'steam_relay_plugin'
    || adapter.network_type === 'steam_lobby_direct_possible'
    || adapter.network_type === 'official_only'
    || adapter.network_type === 'not_supported';
}

function hasStructuredApplicability(adapter: GameAdapter) {
  const profile = adapter.applicability;
  return Boolean(profile && (
    profile.verification_status !== 'unverified'
    || profile.tested_versions?.length
    || profile.tested_platforms?.length
    || profile.supported_os?.length
    || profile.network_conditions?.length
    || profile.known_limitations?.length
  ));
}

function hasStructuredEvidence(adapter: GameAdapter) {
  const evidence = adapter.evidence;
  return Boolean(evidence && (
    evidence.port_protocols?.length
    || evidence.proof_items?.length
    || evidence.test_steps?.length
    || evidence.last_verified_at
  ));
}

function syncLabel(adapter: GameAdapter, syncResult?: AdapterRegistrySyncResult | null) {
  const item = syncResult?.items?.find((entry) => entry.game_id === adapter.game_id);
  if (item) return `${item.status}：${item.reason}`;
  if (adapter.adapter_source === 'registry') return '来自共享库';
  if (adapter.adapter_source === 'custom') return '本地自建方案，尚未确认是否发布';
  if (adapter.adapter_source === 'builtin') return '内置方案';
  if (adapter.adapter_source === 'steam_scan') return 'Steam 扫描结果，通常需要转成自建游戏方案';
  return '未记录同步状态';
}

export function auditAdapterForPublish(adapter: GameAdapter, syncResult?: AdapterRegistrySyncResult | null): AdapterPublishAudit {
  const missing: string[] = [];
  const warnings: string[] = [];
  const review: string[] = [];
  const category = deriveAdapterCategory(adapter);

  if (!hasText(adapter.game_id)) missing.push('game_id');
  if (!hasText(adapter.display_name)) missing.push('游戏名称');
  if (!adapter.network_type || adapter.network_type === 'unknown_need_review') missing.push('联机类型');
  if (!hasList(adapter.capabilities)) missing.push('游戏能力 capabilities');
  if (!adapter.multiplayer_conversion) missing.push('多人能力转换说明');
  if (!adapter.connection_plan) missing.push('连接方案 connection_plan');

  const plan = adapter.connection_plan;
  if (plan) {
    if (!hasText(plan.summary)) missing.push('方案摘要');
    if (!hasText(plan.host_role)) missing.push('房主步骤');
    if (!hasText(plan.join_role)) missing.push('加入者步骤');
    if (!hasList(plan.invite_template)) warnings.push('邀请模板为空');
    if (!hasList(plan.troubleshooting)) warnings.push('排障说明为空');
  }

  if (!isNonLan(adapter) && !adapter.default_ports?.length) warnings.push('LAN/服务端类方案建议标注默认端口');
  if (!adapter.executables?.length) warnings.push('建议标注 exe 特征，方便扫描匹配');
  if (!adapter.steam_appid) warnings.push('Steam 游戏建议标注 AppID；非 Steam 游戏可忽略');
  if (!hasStructuredApplicability(adapter)) warnings.push('建议补充结构化适用条件：版本、平台、系统、网络条件和不适用边界');
  if (!hasStructuredEvidence(adapter)) warnings.push('建议补充结构化验证证据：端口协议、截图/日志、实测步骤和最近验证时间');
  if (adapter.applicability?.verification_status === 'unverified') {
    review.push('验证状态仍为未实测，提交共享库前建议至少完成本机自测或好友实测。');
  }
  if (!isNonLan(adapter) && !adapter.evidence?.port_protocols?.length) {
    review.push('LAN/服务端类方案发布前建议填写端口协议证据。');
  }

  if (category.id === 'needs_review') review.push('当前仍是待人工确认分类，不建议直接发布。');
  if (adapter.network_type === 'official_only' || adapter.network_type === 'not_supported') {
    review.push('该方案会告诉用户不要强转 LAN，发布前需确认说明足够清楚。');
  }
  if (adapter.network_type === 'local_coop_remote_play') {
    review.push('本地同屏方案需确认不会误导用户连接联机地址。');
  }
  if (adapter.network_type === 'steam_relay_plugin' || adapter.network_type === 'steam_p2p_only') {
    review.push('Steam/P2P 方案通常需要人工确认插件或官方流程边界。');
  }

  const item = syncResult?.items?.find((entry) => entry.game_id === adapter.game_id);
  const synced = adapter.adapter_source === 'registry' || Boolean(item && ['created', 'updated', 'skipped'].includes(item.status));
  const incomplete = missing.length > 0;
  const needsReview = !incomplete && (review.length > 0 || warnings.length > 2 || adapter.adapter_source === 'steam_scan');
  const publishReady = !incomplete && !needsReview && adapter.adapter_source !== 'registry';

  if (synced && adapter.adapter_source === 'registry') {
    return {
      state: 'registry_synced',
      label: '已在共享库',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      summary: '该游戏方案已来自共享库，通常不需要再次提交。',
      missing,
      warnings,
      review,
      syncStatus: syncLabel(adapter, syncResult),
      canSubmit: false,
    };
  }

  if (incomplete) {
    return {
      state: 'incomplete',
      label: '草稿不完整',
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
      summary: `缺少 ${missing.length} 项必要信息，暂不建议发布。`,
      missing,
      warnings,
      review,
      syncStatus: syncLabel(adapter, syncResult),
      canSubmit: false,
    };
  }

  if (needsReview) {
    return {
      state: 'needs_review',
      label: '需复核',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
      summary: '字段基本完整，但发布前仍需要管理员复核适用条件和边界说明。',
      missing,
      warnings,
      review,
      syncStatus: syncLabel(adapter, syncResult),
      canSubmit: true,
    };
  }

  return {
    state: publishReady ? 'publish_ready' : 'needs_review',
    label: publishReady ? '可提交' : '需复核',
    badgeClass: publishReady ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-amber-200 bg-amber-50 text-amber-700',
    summary: publishReady ? '字段完整，可生成共享库提交包。' : '建议复核后再提交。',
    missing,
    warnings,
    review,
    syncStatus: syncLabel(adapter, syncResult),
    canSubmit: true,
  };
}

export function summarizePublishAudits(adapters: GameAdapter[], syncResult?: AdapterRegistrySyncResult | null) {
  const audits = adapters.map((adapter) => auditAdapterForPublish(adapter, syncResult));
  return {
    ready: audits.filter((audit) => audit.state === 'publish_ready').length,
    needsReview: audits.filter((audit) => audit.state === 'needs_review').length,
    incomplete: audits.filter((audit) => audit.state === 'incomplete').length,
    registrySynced: audits.filter((audit) => audit.state === 'registry_synced').length,
    total: audits.length,
  };
}
