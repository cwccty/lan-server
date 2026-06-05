import type { GameNetworkType } from '../types/game';

export interface AdapterContributionForm {
  display_name: string;
  game_id: string;
  steam_appid: string;
  executable_hint: string;
  game_version: string;
  platform: string;
  os: string;
  network_type: GameNetworkType;
  default_ports: string;
  port_protocols: string;
  network_conditions: string;
  observed_flow: string;
  test_steps: string;
  proof_items: string;
  known_limitations: string;
  extra_notes: string;
}

export interface AdapterContributionPackage {
  schema: 'lan-helper.adapter-contribution.v1';
  created_at: string;
  contribution_id: string;
  game: {
    display_name: string;
    game_id: string;
    steam_appid?: string | null;
    executable_hint?: string | null;
    game_version?: string | null;
    platform?: string | null;
    os?: string | null;
  };
  observed_multiplayer: {
    network_type: GameNetworkType;
    network_type_label: string;
    default_ports: number[];
    observed_flow: string;
  };
  evidence: {
    port_protocols: string[];
    network_conditions: string[];
    test_steps: string[];
    proof_items: string[];
    known_limitations: string[];
    extra_notes: string[];
  };
  admin_review: {
    suggested_route: string;
    required_checks: string[];
    risk_flags: string[];
  };
}

export interface AdapterContributionBuildResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
  package: AdapterContributionPackage;
  text: string;
}

export interface AdapterContributionReviewResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
  package: AdapterContributionPackage;
  summary: string;
  reviewText: string;
  recommendedDecision: 'accept_as_draft' | 'needs_more_evidence';
}

export const contributionNetworkTypeOptions: Array<{
  value: GameNetworkType;
  label: string;
  help: string;
}> = [
  {
    value: 'unknown_need_review',
    label: '不确定，需要管理员判断',
    help: '用户只知道现象，不确定该走 LAN、同屏远程、Steam 还是官方服。',
  },
  {
    value: 'lan_ip_direct',
    label: '原生 LAN / IP 直连',
    help: '游戏内可以输入 IP 或在局域网列表里加入。',
  },
  {
    value: 'dedicated_server',
    label: '专用服务端',
    help: '游戏有独立服务端程序或可通过服务端开房。',
  },
  {
    value: 'udp_broadcast_needed',
    label: '局域网大厅发现 / UDP 广播',
    help: '需要同一局域网大厅发现，可能要 UDP 广播桥。',
  },
  {
    value: 'tcp_port_proxy_needed',
    label: 'TCP/UDP 端口代理',
    help: '游戏可连到固定端口，但需要转发或代理。',
  },
  {
    value: 'local_coop_remote_play',
    label: '只能本地同屏',
    help: '类似茶杯头，只能一台电脑同屏，建议远程同屏联机。',
  },
  {
    value: 'steam_p2p_only',
    label: 'Steam 大厅 / Steam P2P',
    help: '主要靠 Steam 好友、大厅或 P2P 邀请。',
  },
  {
    value: 'official_only',
    label: '官方服务器限定',
    help: '只能使用官方服务器或官方大厅，不建议强行转换。',
  },
];

export function createEmptyAdapterContributionForm(): AdapterContributionForm {
  return {
    display_name: '',
    game_id: '',
    steam_appid: '',
    executable_hint: '',
    game_version: '',
    platform: 'Steam',
    os: 'Windows',
    network_type: 'unknown_need_review',
    default_ports: '',
    port_protocols: '',
    network_conditions: '同一虚拟局域网；防火墙允许游戏端口',
    observed_flow: '',
    test_steps: '',
    proof_items: '',
    known_limitations: '',
    extra_notes: '',
  };
}

export function contributionNetworkTypeLabel(type: GameNetworkType) {
  return contributionNetworkTypeOptions.find((item) => item.value === type)?.label ?? type;
}

export function buildAdapterContributionPackage(form: AdapterContributionForm): AdapterContributionBuildResult {
  const normalized = normalizeContributionForm(form);
  const missing = [
    normalized.display_name ? '' : '游戏名称',
    normalized.observed_flow ? '' : '观察到的联机现象',
    normalized.test_steps ? '' : '测试步骤',
  ].filter(Boolean);
  const warnings = [
    normalized.network_type === 'unknown_need_review' ? '联机类型仍不确定，管理员需要先复核游戏类型。' : '',
    parsePorts(normalized.default_ports).length === 0 ? '没有填写端口；如果游戏不是同屏/Steam/官方服，建议补充端口或协议。' : '',
    normalized.proof_items ? '' : '没有填写截图、日志或测试证据；共享库审核可信度会较低。',
    normalized.game_version ? '' : '没有填写游戏版本；不同版本联机方式可能不同。',
  ].filter(Boolean);
  const gameId = normalized.game_id || safeGameId(normalized.display_name);
  const createdAt = new Date().toISOString();
  const pkg: AdapterContributionPackage = {
    schema: 'lan-helper.adapter-contribution.v1',
    created_at: createdAt,
    contribution_id: `${gameId || 'unknown'}-${createdAt.replace(/[:.]/g, '-')}`,
    game: {
      display_name: normalized.display_name,
      game_id: gameId,
      steam_appid: normalized.steam_appid || null,
      executable_hint: normalized.executable_hint || null,
      game_version: normalized.game_version || null,
      platform: normalized.platform || null,
      os: normalized.os || null,
    },
    observed_multiplayer: {
      network_type: normalized.network_type,
      network_type_label: contributionNetworkTypeLabel(normalized.network_type),
      default_ports: parsePorts(normalized.default_ports),
      observed_flow: normalized.observed_flow,
    },
    evidence: {
      port_protocols: splitContributionList(normalized.port_protocols),
      network_conditions: splitContributionList(normalized.network_conditions),
      test_steps: splitContributionList(normalized.test_steps),
      proof_items: splitContributionList(normalized.proof_items),
      known_limitations: splitContributionList(normalized.known_limitations),
      extra_notes: splitContributionList(normalized.extra_notes),
    },
    admin_review: {
      suggested_route: suggestedAdminRoute(normalized.network_type),
      required_checks: requiredAdminChecks(normalized.network_type),
      risk_flags: warnings,
    },
  };

  return {
    ok: missing.length === 0,
    missing,
    warnings,
    package: pkg,
    text: buildAdapterContributionText(pkg, missing, warnings),
  };
}

export function buildAdapterContributionText(
  pkg: AdapterContributionPackage,
  missing: string[] = [],
  warnings: string[] = [],
) {
  return [
    '[联机助手 Adapter 用户贡献包]',
    `schema：${pkg.schema}`,
    `生成时间：${pkg.created_at}`,
    `贡献 ID：${pkg.contribution_id}`,
    '',
    '游戏信息：',
    `- 名称：${pkg.game.display_name || '未填写'}`,
    `- game_id：${pkg.game.game_id || '未填写'}`,
    `- Steam AppID：${pkg.game.steam_appid || '未填写'}`,
    `- 可执行文件特征：${pkg.game.executable_hint || '未填写'}`,
    `- 版本 / 平台 / 系统：${pkg.game.game_version || '未填写'} / ${pkg.game.platform || '未填写'} / ${pkg.game.os || '未填写'}`,
    '',
    '观察到的联机能力：',
    `- 类型：${pkg.observed_multiplayer.network_type_label} (${pkg.observed_multiplayer.network_type})`,
    `- 默认端口：${pkg.observed_multiplayer.default_ports.join(', ') || '未填写'}`,
    `- 现象：${pkg.observed_multiplayer.observed_flow || '未填写'}`,
    '',
    '验证证据：',
    `- 端口协议：${pkg.evidence.port_protocols.join('；') || '未填写'}`,
    `- 网络条件：${pkg.evidence.network_conditions.join('；') || '未填写'}`,
    `- 测试步骤：${pkg.evidence.test_steps.join(' / ') || '未填写'}`,
    `- 截图/日志/证据：${pkg.evidence.proof_items.join('；') || '未填写'}`,
    `- 已知限制：${pkg.evidence.known_limitations.join('；') || '未填写'}`,
    `- 备注：${pkg.evidence.extra_notes.join('；') || '无'}`,
    '',
    '管理员处理建议：',
    `- 建议路线：${pkg.admin_review.suggested_route}`,
    ...pkg.admin_review.required_checks.map((item) => `- ${item}`),
    '',
    missing.length ? `缺失项：${missing.join('、')}` : '缺失项：无关键缺失',
    warnings.length ? `风险提示：${warnings.join('；')}` : '风险提示：暂无',
    '',
    'JSON：',
    JSON.stringify(pkg, null, 2),
  ].join('\n');
}

export function parseAdapterContributionInput(input: string): AdapterContributionReviewResult {
  const text = input.trim();
  if (!text) {
    throw new Error('请先粘贴用户贡献包文本或 JSON。');
  }
  const jsonText = extractContributionJson(text);
  const parsed = JSON.parse(jsonText) as AdapterContributionPackage;
  const pkg = normalizeContributionPackage(parsed);
  return auditAdapterContributionPackage(pkg);
}

export function auditAdapterContributionPackage(pkg: AdapterContributionPackage): AdapterContributionReviewResult {
  if (pkg.schema !== 'lan-helper.adapter-contribution.v1') {
    throw new Error(`贡献包 schema 不匹配：${pkg.schema || '未填写'}`);
  }
  const form = contributionPackageToForm(pkg);
  const rebuilt = buildAdapterContributionPackage(form);
  const missing = Array.from(new Set([
    ...rebuilt.missing,
    pkg.game.game_id ? '' : 'game_id',
    pkg.evidence.test_steps.length > 0 ? '' : '测试步骤',
    pkg.evidence.proof_items.length > 0 ? '' : '截图/日志/证据',
  ].filter(Boolean)));
  const warnings = Array.from(new Set([
    ...rebuilt.warnings,
    pkg.observed_multiplayer.network_type === 'unknown_need_review' ? '用户未能判断联机类型，需要管理员先按能力矩阵复核。' : '',
    pkg.admin_review.risk_flags.join('；'),
  ].filter(Boolean)));
  const recommendedDecision = missing.length === 0 && warnings.length <= 2
    ? 'accept_as_draft'
    : 'needs_more_evidence';
  const summary = recommendedDecision === 'accept_as_draft'
    ? '关键证据基本完整，可以转为 adapter 草稿，但保存前仍需管理员复核。'
    : '证据不足或类型不确定，建议先要求用户补充，再转正式 adapter。';
  return {
    ok: recommendedDecision === 'accept_as_draft',
    missing,
    warnings,
    package: pkg,
    summary,
    recommendedDecision,
    reviewText: buildContributionReviewText(pkg, missing, warnings, summary),
  };
}

export function contributionPackageToForm(pkg: AdapterContributionPackage): AdapterContributionForm {
  return {
    display_name: pkg.game.display_name || '',
    game_id: pkg.game.game_id || '',
    steam_appid: pkg.game.steam_appid || '',
    executable_hint: pkg.game.executable_hint || '',
    game_version: pkg.game.game_version || '',
    platform: pkg.game.platform || 'Steam',
    os: pkg.game.os || 'Windows',
    network_type: pkg.observed_multiplayer.network_type || 'unknown_need_review',
    default_ports: pkg.observed_multiplayer.default_ports.join(', '),
    port_protocols: pkg.evidence.port_protocols.join('\n'),
    network_conditions: pkg.evidence.network_conditions.join('\n'),
    observed_flow: pkg.observed_multiplayer.observed_flow || '',
    test_steps: pkg.evidence.test_steps.join('\n'),
    proof_items: pkg.evidence.proof_items.join('\n'),
    known_limitations: pkg.evidence.known_limitations.join('\n'),
    extra_notes: pkg.evidence.extra_notes.join('\n'),
  };
}

function buildContributionReviewText(
  pkg: AdapterContributionPackage,
  missing: string[],
  warnings: string[],
  summary: string,
) {
  return [
    '[联机助手 Adapter 贡献包审核意见]',
    `贡献 ID：${pkg.contribution_id}`,
    `游戏：${pkg.game.display_name} (${pkg.game.game_id})`,
    `用户判断类型：${pkg.observed_multiplayer.network_type_label} (${pkg.observed_multiplayer.network_type})`,
    `审核结论：${summary}`,
    '',
    missing.length ? `需要补充：${missing.join('、')}` : '需要补充：暂无关键缺失',
    warnings.length ? `风险/注意：${warnings.join('；')}` : '风险/注意：暂无明显风险',
    '',
    '管理员复核清单：',
    ...pkg.admin_review.required_checks.map((item) => `- ${item}`),
    '',
    '给用户的回复建议：',
    missing.length
      ? `请补充：${missing.join('、')}。补充后重新发送贡献包。`
      : '已收到，可以进入管理员复核；如果后续需要更多证据会再联系你。',
  ].join('\n');
}

function extractContributionJson(text: string) {
  try {
    JSON.parse(text);
    return text;
  } catch {
    const markerIndex = text.lastIndexOf('JSON');
    const searchFrom = markerIndex >= 0 ? markerIndex : 0;
    const start = text.indexOf('{', searchFrom);
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new Error('未找到贡献包 JSON。请粘贴完整贡献包，或只粘贴 JSON 部分。');
    }
    return text.slice(start, end + 1);
  }
}

function normalizeContributionPackage(pkg: AdapterContributionPackage): AdapterContributionPackage {
  const networkType = isContributionNetworkType(pkg.observed_multiplayer?.network_type)
    ? pkg.observed_multiplayer.network_type
    : 'unknown_need_review';
  return {
    schema: pkg.schema,
    created_at: pkg.created_at || new Date().toISOString(),
    contribution_id: pkg.contribution_id || `${pkg.game?.game_id || 'unknown'}-imported`,
    game: {
      display_name: String(pkg.game?.display_name || ''),
      game_id: String(pkg.game?.game_id || safeGameId(String(pkg.game?.display_name || ''))),
      steam_appid: pkg.game?.steam_appid || null,
      executable_hint: pkg.game?.executable_hint || null,
      game_version: pkg.game?.game_version || null,
      platform: pkg.game?.platform || null,
      os: pkg.game?.os || null,
    },
    observed_multiplayer: {
      network_type: networkType,
      network_type_label: contributionNetworkTypeLabel(networkType),
      default_ports: Array.isArray(pkg.observed_multiplayer?.default_ports)
        ? pkg.observed_multiplayer.default_ports.filter((port) => Number.isFinite(port) && port > 0 && port <= 65535)
        : [],
      observed_flow: String(pkg.observed_multiplayer?.observed_flow || ''),
    },
    evidence: {
      port_protocols: normalizeStringArray(pkg.evidence?.port_protocols),
      network_conditions: normalizeStringArray(pkg.evidence?.network_conditions),
      test_steps: normalizeStringArray(pkg.evidence?.test_steps),
      proof_items: normalizeStringArray(pkg.evidence?.proof_items),
      known_limitations: normalizeStringArray(pkg.evidence?.known_limitations),
      extra_notes: normalizeStringArray(pkg.evidence?.extra_notes),
    },
    admin_review: {
      suggested_route: pkg.admin_review?.suggested_route || suggestedAdminRoute(networkType),
      required_checks: normalizeStringArray(pkg.admin_review?.required_checks).length
        ? normalizeStringArray(pkg.admin_review?.required_checks)
        : requiredAdminChecks(networkType),
      risk_flags: normalizeStringArray(pkg.admin_review?.risk_flags),
    },
  };
}

function normalizeContributionForm(form: AdapterContributionForm): AdapterContributionForm {
  return {
    ...form,
    display_name: form.display_name.trim(),
    game_id: form.game_id.trim(),
    steam_appid: form.steam_appid.trim(),
    executable_hint: form.executable_hint.trim(),
    game_version: form.game_version.trim(),
    platform: form.platform.trim(),
    os: form.os.trim(),
    default_ports: form.default_ports.trim(),
    port_protocols: form.port_protocols.trim(),
    network_conditions: form.network_conditions.trim(),
    observed_flow: form.observed_flow.trim(),
    test_steps: form.test_steps.trim(),
    proof_items: form.proof_items.trim(),
    known_limitations: form.known_limitations.trim(),
    extra_notes: form.extra_notes.trim(),
  };
}

function safeGameId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function parsePorts(value: string) {
  return Array.from(new Set(
    value
      .split(/[,，；;\s]+/)
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter((port) => Number.isFinite(port) && port > 0 && port <= 65535)
  ));
}

function splitContributionList(value: string) {
  return value
    .split(/\r?\n|[；;]/)
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function isContributionNetworkType(value: unknown): value is GameNetworkType {
  return typeof value === 'string' && contributionNetworkTypeOptions.some((item) => item.value === value);
}

function suggestedAdminRoute(type: GameNetworkType) {
  const map: Record<GameNetworkType, string> = {
    lan_ip_direct: '按原生 LAN / IP 直连建立 adapter，默认走 n2n 或其他虚拟局域网。',
    dedicated_server: '确认服务端启动方式与端口，建立专用服务端 adapter。',
    tcp_port_proxy_needed: '确认固定端口与协议，优先评估 TCP/UDP 端口代理。',
    udp_broadcast_needed: '确认是否依赖局域网广播发现，评估 n2n + UDP 广播桥。',
    steam_lobby_direct_possible: '保留 Steam 大厅原生流程，必要时仅提供说明。',
    steam_relay_plugin: '进入 Steam Relay / 插件方案复核，不直接生成 LAN 邀请包。',
    local_coop_remote_play: '按本地同屏远程联机处理，推荐 Steam Remote Play 或 Sunshine + Moonlight。',
    steam_p2p_only: '按 Steam P2P / 大厅限定处理，暂不伪装为 LAN。',
    mod_required: '需要社区 Mod 或补丁，先复核安全性和版本边界。',
    official_only: '标记为官方服务器限定，不建议转换。',
    not_supported: '标记暂不支持，并给出原因说明。',
    unknown_need_review: '先由管理员复核游戏类型，再决定是否创建 adapter。',
  };
  return map[type] ?? '先由管理员复核游戏类型。';
}

function requiredAdminChecks(type: GameNetworkType) {
  const base = [
    '核对游戏版本、平台和系统是否与贡献者一致。',
    '确认测试步骤可以复现，不要只根据口述直接入库。',
  ];
  if (type === 'local_coop_remote_play') {
    return [...base, '确认游戏确实只能本地同屏，再补充远程同屏输入权限和延迟建议。'];
  }
  if (type === 'udp_broadcast_needed') {
    return [...base, '确认是否存在 UDP 广播发现，并记录广播端口或抓包证据。'];
  }
  if (type === 'lan_ip_direct' || type === 'dedicated_server' || type === 'tcp_port_proxy_needed') {
    return [...base, '确认端口协议、防火墙条件和至少一次好友实测。'];
  }
  if (type === 'steam_p2p_only' || type === 'steam_lobby_direct_possible' || type === 'steam_relay_plugin') {
    return [...base, '确认是否依赖 Steam 好友/大厅/P2P，避免误生成虚拟 IP 邀请包。'];
  }
  if (type === 'official_only' || type === 'not_supported') {
    return [...base, '确认是否存在官方限制、反作弊或账号服务器依赖，并写清不建议转换原因。'];
  }
  return [...base, '根据能力矩阵选择正确路线后，再生成正式 adapter。'];
}
