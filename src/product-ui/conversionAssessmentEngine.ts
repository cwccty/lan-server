import type { GameNetworkType, GameSummary } from '../types/game';
import type { AdapterRecommendationRoute, AdapterRouteKind } from './adapterRecommendationRoute';
import { conversionMethodLabel, networkTypeLabel, sourceLabel } from './adapterPresentation';
import {
  connectionCapabilityMatrix,
  decisionRowForNetworkType,
  rowsForRouteKind,
  type CapabilityDecisionVerdict,
  type ConnectionCapabilityDecisionRow,
} from './connectionCapabilityMatrix';

export type ConversionAssessmentTone = 'good' | 'warn' | 'blocked' | 'review';

export interface GameConversionAssessment {
  gameName: string;
  gameId: string;
  adapterSource: string;
  networkTypeLabel: string;
  routeKind: AdapterRouteKind;
  routeTitle: string;
  verdict: CapabilityDecisionVerdict;
  tone: ConversionAssessmentTone;
  gameType: string;
  originalCapability: string;
  canBecomeLan: boolean;
  playableByAnotherWay: boolean;
  userConclusion: string;
  recommendedPlan: string;
  reason: string;
  primaryMethods: string[];
  fallbackMethods: string[];
  userSteps: string[];
  adminEvidence: string[];
  boundaries: string[];
  adapterSignals: string[];
  exampleHint: string;
}

function firstDecisionForRoute(kind: AdapterRouteKind) {
  return rowsForRouteKind(kind)[0];
}

function decisionFromGame(game: GameSummary | null, route: AdapterRecommendationRoute): ConnectionCapabilityDecisionRow {
  const networkType = game?.network_type as GameNetworkType | undefined;
  return decisionRowForNetworkType(networkType)
    ?? firstDecisionForRoute(route.kind)
    ?? connectionCapabilityMatrix.find((row) => row.id === 'unknown-review')
    ?? connectionCapabilityMatrix[connectionCapabilityMatrix.length - 1];
}

function toneForVerdict(verdict: CapabilityDecisionVerdict, route: AdapterRecommendationRoute): ConversionAssessmentTone {
  if (verdict === 'can_convert_to_lan') return 'good';
  if (verdict === 'can_connect_not_lan') return 'warn';
  if (verdict === 'official_only') return 'blocked';
  if (route.kind === 'official_only') return 'blocked';
  return 'review';
}

function primaryMethodsFor(row: ConnectionCapabilityDecisionRow, route: AdapterRecommendationRoute) {
  const declared = route.tools.length ? route.tools : row.recommendedMethodIds;
  return declared.slice(0, 3).map((item) => {
    const catalogMatch = row.recommendedMethodIds.find((id) => id === item);
    return catalogMatch ? item : item;
  });
}

function fallbackMethodsFor(row: ConnectionCapabilityDecisionRow, route: AdapterRecommendationRoute) {
  const methodLabels = row.recommendedMethodIds.map((id) => id
    .replace('steam_remote_play', 'Steam Remote Play')
    .replace('sunshine_moonlight', 'Sunshine + Moonlight')
    .replace('udp_broadcast_bridge', 'UDP 广播桥')
    .replace('tcp_proxy', 'TCP 端口代理')
    .replace('udp_proxy', 'UDP 代理')
    .replace('steam_relay_plugin', 'Steam Relay / P2P 插件')
    .replace('wireguard', 'WireGuard')
    .replace('zerotier', 'ZeroTier')
    .replace('tailscale', 'Tailscale')
    .replace('n2n', '通用组网'));
  const conversionLabels = route.kind === 'remote_coop'
    ? ['Steam Remote Play Together', 'Sunshine + Moonlight']
    : route.kind === 'steam_p2p'
      ? ['Steam 好友邀请/大厅', 'Steam Relay / P2P 插件入口']
      : route.kind === 'official_only'
        ? ['官方服务器/官方大厅']
        : [];
  return Array.from(new Set([...conversionLabels, ...methodLabels])).slice(0, 4);
}

function routeSpecificSteps(route: AdapterRecommendationRoute, row: ConnectionCapabilityDecisionRow) {
  if (route.kind === 'remote_coop') {
    return [
      '房主启动游戏，并进入本地双人/同屏合作模式。',
      '优先用 Steam Remote Play Together 邀请好友；非 Steam 或需要更细控制时使用 Sunshine + Moonlight。',
      '确认好友输入权限、手柄/键鼠映射、延迟和画质；不要让好友连接联机地址。',
    ];
  }
  if (route.kind === 'steam_p2p') {
    return [
      '房主按游戏原生 Steam 好友邀请、Steam 大厅或 P2P 流程创建房间。',
      '好友通过 Steam 原生入口加入；通用组网只作为未来插件/人工路线的旁路，不默认推荐。',
      '如果要接入 Steam Relay / P2P 插件，先由管理员确认反作弊、账号和插件边界。',
    ];
  }
  if (route.kind === 'official_only') {
    return [
      '使用游戏官方服务器、官方大厅或官方账号入口。',
      '不要生成局域网邀请包，也不要提示好友连接联机地址。',
      '在游戏方案中记录不能转换的证据，避免用户反复尝试错误方案。',
    ];
  }
  if (route.kind === 'needs_review') {
    return [
      '先同步共享方案库，查看是否已有同 game_id 的游戏方案。',
      '仍缺方案时，由管理员收集多人菜单、端口、日志、截图或实测步骤。',
      '确认类型后再保存游戏方案，让推荐页自动切换到正确路线。',
    ];
  }
  return route.steps.map((step) => `${step.title}：${step.detail}`);
}

function boundariesFor(row: ConnectionCapabilityDecisionRow, route: AdapterRecommendationRoute, game: GameSummary | null) {
  const base = [
    row.riskNote,
    ...(game?.multiplayer_conversion?.notes ?? []),
  ];
  if (route.kind === 'remote_coop') {
    base.unshift('这不是把游戏改造成局域网，而是把房主本机画面和好友输入远程传输。');
  }
  if (route.kind === 'steam_p2p') {
    base.unshift('该类游戏优先保留 Steam 原生大厅/P2P，不承诺虚拟局域网可替代。');
  }
  if (route.kind === 'official_only') {
    base.unshift('官方服限定不建议转换；当前目标是解释限制，而不是强行开房。');
  }
  if (route.kind === 'needs_review') {
    base.unshift('证据不足时不能把按钮做成“可联机”，否则会造成内部状态混乱。');
  }
  return Array.from(new Set(base.filter(Boolean))).slice(0, 5);
}

function exampleHintFor(row: ConnectionCapabilityDecisionRow, route: AdapterRecommendationRoute) {
  if (route.kind === 'remote_coop') return '例如《茶杯头》这类只能同屏的游戏，应推荐远程同屏，而不是让好友连联机地址。';
  if (route.kind === 'udp_broadcast_bridge') return '例如只靠局域网大厅发现的游戏，通用组网负责互通，UDP 广播桥负责让大厅能被发现。';
  if (route.kind === 'steam_p2p') return '例如只有 Steam 好友房间的游戏，应优先保留 Steam 流程，插件入口需要人工确认。';
  if (route.kind === 'official_only') return '例如多人完全依赖官方账号/匹配服务器的游戏，应明确提示“不建议转换”。';
  if (row.id === 'native-lan-ip-direct') return '例如支持输入 IP 的游戏，好友加入组网房间后直接连接房主联机地址和端口。';
  return '该评估用于决定给用户展示局域网邀请包、远程同屏说明、Steam 路线说明，还是进入人工复核。';
}

export function buildGameConversionAssessment(
  game: GameSummary | null,
  route: AdapterRecommendationRoute,
): GameConversionAssessment {
  const row = decisionFromGame(game, route);
  const tone = toneForVerdict(row.verdict, route);
  const methods = game?.multiplayer_conversion?.methods?.map(conversionMethodLabel) ?? [];
  const primaryMethods = primaryMethodsFor(row, route);
  const fallbackMethods = fallbackMethodsFor(row, route);
  const canBecomeLan = row.verdict === 'can_convert_to_lan' && route.canCreateLanInvite;
  const playableByAnotherWay = route.supported || row.verdict === 'can_connect_not_lan';
  const reason = [
    row.capability,
    route.summary,
    methods.length ? `游戏方案已标注方法：${methods.join('、')}。` : '',
  ].filter(Boolean).join(' ');

  return {
    gameName: game?.display_name || '未选择游戏',
    gameId: game?.game_id || 'unknown',
    adapterSource: sourceLabel(game?.adapter_source),
    networkTypeLabel: networkTypeLabel(game?.network_type),
    routeKind: route.kind,
    routeTitle: route.title,
    verdict: row.verdict,
    tone,
    gameType: row.gameType,
    originalCapability: row.capability,
    canBecomeLan,
    playableByAnotherWay,
    userConclusion: canBecomeLan
      ? '可以按当前方案转换成局域网联机体验。'
      : row.verdict === 'can_connect_not_lan'
        ? '可以远程联机，但不要把它描述成真正的局域网。'
        : row.verdict === 'official_only'
          ? '不建议转换成局域网，应保留官方入口并说明限制。'
          : '当前证据不足，建议先补充联机方式、端口或实测结果，再生成推荐方案。',
    recommendedPlan: row.userFacingResult,
    reason,
    primaryMethods,
    fallbackMethods,
    userSteps: routeSpecificSteps(route, row),
    adminEvidence: row.evidenceToCollect,
    boundaries: boundariesFor(row, route, game),
    adapterSignals: row.adapterSignals,
    exampleHint: exampleHintFor(row, route),
  };
}

export function buildGameConversionAssessmentReport(assessment: GameConversionAssessment) {
  return [
    '[联机助手非局域网游戏转换评估]',
    `游戏：${assessment.gameName} (${assessment.gameId})`,
    `来源：${assessment.adapterSource}`,
    `当前类型：${assessment.networkTypeLabel}`,
    `原始多人能力：${assessment.gameType}`,
    `结论：${assessment.userConclusion}`,
    `推荐方案：${assessment.recommendedPlan}`,
    `路线：${assessment.routeTitle}`,
    '',
    '为什么：',
    assessment.reason,
    '',
    '主要方式：',
    ...(assessment.primaryMethods.length ? assessment.primaryMethods.map((item) => `- ${item}`) : ['- 暂无，需人工确认。']),
    '',
    '备用/关联方式：',
    ...(assessment.fallbackMethods.length ? assessment.fallbackMethods.map((item) => `- ${item}`) : ['- 暂无。']),
    '',
    '用户步骤：',
    ...assessment.userSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '需要管理员补充的证据：',
    ...assessment.adminEvidence.map((item) => `- ${item}`),
    '',
    '边界说明：',
    ...assessment.boundaries.map((item) => `- ${item}`),
    '',
    assessment.exampleHint,
  ].join('\n');
}
