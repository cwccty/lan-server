import type { GameAdapter, GameConnectionPlan, GameSummary } from '../types/game';

export type AdapterQualityLevel = 'high' | 'medium' | 'low';

export interface AdapterQualityScore {
  level: AdapterQualityLevel;
  label: string;
  score: number;
  badgeClass: string;
  summary: string;
  strengths: string[];
  risks: string[];
  missing: string[];
  canUseDirectly: boolean;
}

export interface AdapterQualityContext {
  hasConflict?: boolean;
  conflictSummary?: string | null;
}

function hasText(value?: string | null) {
  return Boolean(value && value.trim());
}

function hasList(values?: unknown[] | null) {
  return Boolean(values && values.length > 0);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function adapterSourceOf(adapter: GameAdapter | GameSummary) {
  return adapter.adapter_source || 'unknown';
}

function defaultPortsOf(adapter: GameAdapter | GameSummary) {
  if ('default_ports' in adapter && Array.isArray(adapter.default_ports)) return adapter.default_ports;
  const port = adapter.connection_plan?.default_join_port;
  return typeof port === 'number' && Number.isFinite(port) && port > 0 ? [port] : [];
}

function planHasInvite(plan?: GameConnectionPlan | null) {
  return hasList(plan?.invite_template);
}

function planHasTroubleshooting(plan?: GameConnectionPlan | null) {
  return hasList(plan?.troubleshooting);
}

function isNonLanOrLimited(adapter: GameAdapter | GameSummary) {
  const type = adapter.network_type;
  const capability = adapter.multiplayer_conversion?.capability;
  return type === 'local_coop_remote_play'
    || type === 'steam_p2p_only'
    || type === 'steam_relay_plugin'
    || type === 'steam_lobby_direct_possible'
    || type === 'official_only'
    || type === 'not_supported'
    || capability === 'local_coop_remote_play'
    || capability === 'steam_p2p_lobby'
    || capability === 'official_only'
    || capability === 'unsupported';
}

function routeDescription(adapter: GameAdapter | GameSummary) {
  const type = adapter.network_type;
  if (type === 'official_only') return '该方案可信时表示应走官方服务器/官方大厅，不代表可以转换成 LAN。';
  if (type === 'not_supported') return '该方案可信时表示暂不建议转换，应该把限制说明给用户。';
  if (type === 'local_coop_remote_play') return '该方案可信时表示应使用远程同屏，而不是让好友连接虚拟 IP。';
  if (type === 'steam_p2p_only' || type === 'steam_relay_plugin' || type === 'steam_lobby_direct_possible') {
    return '该方案可信时表示应优先保留 Steam 大厅/P2P 流程。';
  }
  return '该方案可信时可以按推荐向导启动组网、端口检测和邀请包流程。';
}

function hasStructuredApplicability(adapter: GameAdapter | GameSummary) {
  const profile = adapter.applicability;
  return Boolean(profile && (
    profile.verification_status !== 'unverified'
    || hasList(profile.tested_versions)
    || hasList(profile.tested_platforms)
    || hasList(profile.supported_os)
    || hasList(profile.network_conditions)
    || hasList(profile.known_limitations)
  ));
}

function hasStructuredEvidence(adapter: GameAdapter | GameSummary) {
  const evidence = adapter.evidence;
  return Boolean(evidence && (
    hasList(evidence.port_protocols)
    || hasList(evidence.proof_items)
    || hasList(evidence.test_steps)
    || hasText(evidence.last_verified_at)
  ));
}

export function buildAdapterQualityScore(
  adapter: GameAdapter | GameSummary | null | undefined,
  context: AdapterQualityContext = {},
): AdapterQualityScore {
  if (!adapter) {
    return {
      level: 'low',
      label: '低可信',
      score: 0,
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
      summary: '尚未选择游戏或没有 adapter，无法判断推荐是否可靠。',
      strengths: [],
      risks: ['没有可评分的游戏方案'],
      missing: ['adapter'],
      canUseDirectly: false,
    };
  }

  let score = 20;
  const strengths: string[] = [];
  const risks: string[] = [];
  const missing: string[] = [];
  const source = adapterSourceOf(adapter);
  const plan = adapter.connection_plan;
  const type = adapter.network_type;
  const ports = defaultPortsOf(adapter);
  const nonLanOrLimited = isNonLanOrLimited(adapter);
  const applicability = adapter.applicability;
  const evidence = adapter.evidence;

  if (hasText(adapter.game_id)) {
    score += 4;
    strengths.push('有稳定 game_id');
  } else {
    score -= 8;
    missing.push('game_id');
  }

  if (hasText(adapter.display_name)) {
    score += 4;
    strengths.push('有游戏名称');
  } else {
    score -= 5;
    missing.push('游戏名称');
  }

  if (type && type !== 'unknown_need_review') {
    score += 12;
    strengths.push('已标注联机类型');
  } else {
    score -= 18;
    missing.push('联机类型');
    risks.push('仍是待人工确认类型');
  }

  if (hasList(adapter.capabilities)) {
    score += 8;
    strengths.push('已标注游戏能力');
  } else {
    score -= 8;
    missing.push('游戏能力');
  }

  if (adapter.multiplayer_conversion) {
    score += 12;
    strengths.push('有多人能力转换说明');
    if (hasList(adapter.multiplayer_conversion.methods)) score += 5;
    else missing.push('转换方式');
    if (adapter.multiplayer_conversion.risk_level === 'high') {
      score -= 6;
      risks.push('转换风险较高');
    }
  } else {
    score -= 12;
    missing.push('多人能力转换说明');
  }

  if (plan) {
    score += 12;
    strengths.push('有连接方案');
    if (hasText(plan.summary)) score += 3;
    else missing.push('方案摘要');
    if (hasText(plan.host_role) && hasText(plan.join_role)) {
      score += 6;
      strengths.push('房主/好友步骤清楚');
    } else {
      score -= 6;
      missing.push('房主/好友步骤');
    }
    if (planHasInvite(plan)) {
      score += 5;
      strengths.push('有邀请模板');
    } else {
      score -= 3;
      missing.push('邀请模板');
    }
    if (planHasTroubleshooting(plan)) {
      score += 5;
      strengths.push('有排障说明');
    } else {
      score -= 3;
      missing.push('排障说明');
    }
  } else {
    score -= 16;
    missing.push('连接方案');
  }

  if (ports.length > 0) {
    score += 6;
    strengths.push('有默认端口');
  } else if (nonLanOrLimited) {
    strengths.push('该路线通常不需要游戏端口');
  } else {
    score -= 8;
    missing.push('默认端口');
    risks.push('缺少端口会影响邀请包和端口检测');
  }

  if (source === 'registry') {
    score += 8;
    strengths.push('来自共享库');
  } else if (source === 'custom') {
    score += 7;
    strengths.push('管理员自建方案');
  } else if (source === 'builtin') {
    score += 4;
    strengths.push('内置方案');
  } else if (source === 'steam_scan') {
    score -= 14;
    risks.push('仅来自 Steam 扫描，通常需要转成 custom adapter');
  } else {
    risks.push('来源不明确');
  }

  if (hasStructuredApplicability(adapter)) {
    score += 7;
    strengths.push('有结构化适用条件');
    if (applicability?.verification_status === 'friend_tested' || applicability?.verification_status === 'community_verified') {
      score += 5;
      strengths.push('已记录好友/社区验证');
    } else if (applicability?.verification_status === 'self_tested') {
      score += 3;
      strengths.push('已记录本机自测');
    } else {
      score -= 3;
      risks.push('适用条件尚未实测验证');
    }
  } else {
    score -= 7;
    missing.push('结构化适用条件');
    risks.push('缺少版本、平台、系统或不适用边界');
  }

  if (hasStructuredEvidence(adapter)) {
    score += 7;
    strengths.push('有结构化验证证据');
    if (hasList(evidence?.test_steps)) score += 3;
    else missing.push('实测步骤');
    if (!nonLanOrLimited && hasList(evidence?.port_protocols)) score += 3;
  } else {
    score -= 7;
    missing.push('结构化验证证据');
    risks.push('缺少端口协议、截图/日志或实测步骤证据');
  }

  if (context.hasConflict) {
    score -= 18;
    risks.push(context.conflictSummary || '同一游戏存在 adapter 版本冲突');
  } else {
    score += 6;
    strengths.push('未检测到版本冲突');
  }

  if (type === 'official_only' || type === 'not_supported') {
    risks.push(type === 'official_only' ? '官方服限定，不生成 LAN 邀请包' : '当前不建议转换');
  }
  if (nonLanOrLimited) {
    strengths.push('不会误导用户强行走 n2n');
  }

  const normalizedScore = clampScore(score);
  const level: AdapterQualityLevel = normalizedScore >= 78 ? 'high' : normalizedScore >= 55 ? 'medium' : 'low';
  const label = level === 'high' ? '高可信' : level === 'medium' ? '中可信' : '低可信';
  const badgeClass = level === 'high'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : level === 'medium'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-rose-200 bg-rose-50 text-rose-700';
  const canUseDirectly = level === 'high' && !context.hasConflict && Boolean(type && type !== 'unknown_need_review' && plan);

  return {
    level,
    label,
    score: normalizedScore,
    badgeClass,
    summary: `${label}（${normalizedScore} 分）：${canUseDirectly ? '可按当前向导执行。' : level === 'low' ? '建议先去方案库补全或复核。' : '可参考，但建议管理员复核关键字段。'}${routeDescription(adapter)}`,
    strengths: unique(strengths).slice(0, 6),
    risks: unique(risks).slice(0, 6),
    missing: unique(missing).slice(0, 6),
    canUseDirectly,
  };
}

export function summarizeAdapterQuality(scores: AdapterQualityScore[]) {
  return {
    high: scores.filter((item) => item.level === 'high').length,
    medium: scores.filter((item) => item.level === 'medium').length,
    low: scores.filter((item) => item.level === 'low').length,
    direct: scores.filter((item) => item.canUseDirectly).length,
    total: scores.length,
  };
}
