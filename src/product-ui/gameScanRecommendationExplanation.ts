import type { GameSummary } from '../types/game';
import { buildAdapterQualityScore } from './adapterQualityScore';
import {
  buildAdapterRecommendationRoute,
  type AdapterRouteKind,
} from './adapterRecommendationRoute';
import {
  compactPlanSummary,
  gameCapabilityLabel,
  networkTypeLabel,
  sourceLabel,
} from './adapterPresentation';

export interface GameScanRecommendationExplanation {
  routeKind: AdapterRouteKind;
  routeTitle: string;
  routeBadge: string;
  qualityLabel: string;
  qualityScore: number;
  qualityBadgeClass: string;
  headline: string;
  reason: string;
  evidence: string[];
  nextStep: string;
  actionLabel: string;
  targetTab: 'protocol' | 'solutions' | 'advanced_tools' | 'network' | 'diagnostics';
  canStartFromRecommendation: boolean;
  shouldReviewFirst: boolean;
}

function routeReason(kind: AdapterRouteKind) {
  const map: Record<AdapterRouteKind, { headline: string; reason: string; nextStep: string; actionLabel: string }> = {
    virtual_lan: {
      headline: '可按局域网方式开房',
      reason: '方案判断该游戏支持局域网或 IP 直连，组好联机房间后让好友连接房主联机地址和端口。',
      nextStep: '进入推荐方案页，按开房向导启动组网、检测端口并复制邀请包。',
      actionLabel: '进入开房向导',
    },
    dedicated_server: {
      headline: '需要先启动服务端',
      reason: '方案判断该游戏需要房主启动专用服务端或内置开服程序，再通过联机地址加入。',
      nextStep: '进入推荐方案页，先启动组网，再启动服务端并检测端口。',
      actionLabel: '进入服务端向导',
    },
    udp_broadcast_bridge: {
      headline: '需要组网 + UDP 广播桥',
      reason: '方案判断该游戏依赖局域网大厅广播发现，单纯组网可能无法让大厅互相发现。',
      nextStep: '进入推荐方案页，按向导启动组网，再到高级工具配置 UDP 广播桥。',
      actionLabel: '查看桥接方案',
    },
    tcp_port_proxy: {
      headline: '需要组网 + 端口代理',
      reason: '方案判断该游戏需要额外开放本机监听端口，单纯启动组网可能还不够。',
      nextStep: '进入推荐方案页，按向导启动组网，再到高级工具配置端口代理。',
      actionLabel: '查看代理方案',
    },
    remote_coop: {
      headline: '推荐远程同屏联机',
      reason: '方案判断该游戏主要是本地同屏/本地合作，不应该强行转换为局域网。',
      nextStep: '进入推荐方案页，复制 Steam Remote Play 或 Sunshine + Moonlight 的好友说明。',
      actionLabel: '查看远程同屏方案',
    },
    steam_p2p: {
      headline: '优先使用 Steam 大厅/P2P',
      reason: '方案判断该游戏依赖 Steam 大厅、好友邀请或 P2P 流程，不默认把通用组网当主方案。',
      nextStep: '进入推荐方案页查看 Steam 路线说明；如果未来接入 Steam Relay 插件，可在这里扩展。',
      actionLabel: '查看 Steam 方案',
    },
    official_only: {
      headline: '不建议强转局域网',
      reason: '方案判断该游戏更适合保留官方服务器、官方大厅或官方账号流程。',
      nextStep: '查看限制说明，避免用户花时间配置通用组网后仍无法联机。',
      actionLabel: '查看限制说明',
    },
    needs_review: {
      headline: '需要先复核方案',
      reason: '当前方案信息不足，尚不能可靠判断它属于局域网、服务端、广播桥、远程同屏、Steam 邀请还是官方服限定。',
      nextStep: '先去方案库同步共享库或创建自建方案，再回到推荐页执行。',
      actionLabel: '去方案库复核',
    },
  };
  return map[kind];
}

export function buildGameScanRecommendationExplanation(game: GameSummary): GameScanRecommendationExplanation {
  const route = buildAdapterRecommendationRoute(game);
  const quality = buildAdapterQualityScore(game);
  const base = routeReason(route.kind);
  const shouldReviewFirst = route.kind === 'needs_review' || quality.level === 'low';
  const targetTab = shouldReviewFirst ? 'solutions' : 'protocol';

  const evidence = [
    `联机类型：${networkTypeLabel(game.network_type)}`,
    `来源：${sourceLabel(game.adapter_source)}`,
    `能力：${game.capabilities.map(gameCapabilityLabel).join('、') || '未标注'}`,
    `方案：${compactPlanSummary(game.connection_plan)}`,
  ];
  if (quality.missing.length) evidence.push(`缺失：${quality.missing.slice(0, 3).join('、')}`);
  if (quality.risks.length) evidence.push(`风险：${quality.risks.slice(0, 2).join('；')}`);

  return {
    routeKind: route.kind,
    routeTitle: route.title,
    routeBadge: route.badge,
    qualityLabel: quality.label,
    qualityScore: quality.score,
    qualityBadgeClass: quality.badgeClass,
    headline: shouldReviewFirst ? '先复核方案再使用' : base.headline,
    reason: shouldReviewFirst
      ? `${base.reason} 但当前可信度不足，建议先补全方案信息或同步共享库。`
      : base.reason,
    evidence: evidence.slice(0, 6),
    nextStep: shouldReviewFirst ? '去方案库补全/同步共享库，确认后再进入推荐向导。' : base.nextStep,
    actionLabel: shouldReviewFirst ? '去方案库复核' : base.actionLabel,
    targetTab,
    canStartFromRecommendation: quality.canUseDirectly && !shouldReviewFirst,
    shouldReviewFirst,
  };
}
