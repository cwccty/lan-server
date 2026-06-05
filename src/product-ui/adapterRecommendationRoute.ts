import type { GameSummary } from '../types/game';
import {
  conversionMethodLabel,
  deriveAdapterCategory,
  networkTypeLabel,
} from './adapterPresentation';

export type AdapterRouteKind =
  | 'virtual_lan'
  | 'dedicated_server'
  | 'udp_broadcast_bridge'
  | 'tcp_port_proxy'
  | 'remote_coop'
  | 'steam_p2p'
  | 'official_only'
  | 'needs_review';

export interface AdapterRouteStep {
  id: string;
  title: string;
  detail: string;
}

export interface AdapterRecommendationRoute {
  kind: AdapterRouteKind;
  title: string;
  badge: string;
  summary: string;
  primaryAction: string;
  inviteLabel: string;
  canCreateLanInvite: boolean;
  requiresVirtualLan: boolean;
  requiresDedicatedServer: boolean;
  requiresTcpPortProxy: boolean;
  requiresUdpBroadcastBridge: boolean;
  usesRemotePlay: boolean;
  usesSteamFlow: boolean;
  supported: boolean;
  steps: AdapterRouteStep[];
  tools: string[];
}

function hasMethod(game: GameSummary | null, method: string) {
  return Boolean(game?.multiplayer_conversion?.methods?.includes(method as never));
}

function hasCapability(game: GameSummary | null, capability: string) {
  return Boolean(game?.capabilities?.includes(capability as never));
}

function routeTools(game: GameSummary | null, fallback: string[]) {
  const declared = game?.multiplayer_conversion?.required_components ?? [];
  return declared.length ? declared : fallback;
}

export function buildAdapterRecommendationRoute(game: GameSummary | null): AdapterRecommendationRoute {
  const type = game?.network_type;
  const plan = game?.connection_plan;
  const capability = game?.multiplayer_conversion?.capability;
  const category = game ? deriveAdapterCategory(game) : null;
  const methods = game?.multiplayer_conversion?.methods ?? [];
  const methodLabels = methods.map(conversionMethodLabel);
  const typeLabel = networkTypeLabel(type);

  if (!game || type === 'unknown_need_review' || category?.id === 'needs_review') {
    return {
      kind: 'needs_review',
      title: '待人工确认方案',
      badge: '待确认',
      summary: game
        ? `${game.display_name} 尚未沉淀可靠联机方案。请先确认它属于 LAN、服务端、广播发现、同屏远程、Steam P2P 还是官方服限定。`
        : '尚未选择游戏，无法判断联机方式。',
      primaryAction: '去方案库确认',
      inviteLabel: '复制人工确认说明',
      canCreateLanInvite: false,
      requiresVirtualLan: false,
      requiresDedicatedServer: false,
      requiresTcpPortProxy: false,
      requiresUdpBroadcastBridge: false,
      usesRemotePlay: false,
      usesSteamFlow: false,
      supported: false,
      tools: ['方案库', '诊断报告', '端口/日志分析'],
      steps: [
        { id: 'sync', title: '同步共享库', detail: '先从共享库查找是否已有同款游戏 adapter。' },
        { id: 'review', title: '管理员确认', detail: '确认游戏原生多人能力、端口、是否需要服务端或远程同屏。' },
        { id: 'save', title: '保存 adapter', detail: '保存后推荐页会自动套用对应联机路线。' },
      ],
    };
  }

  if (
    type === 'official_only'
    || type === 'not_supported'
    || capability === 'official_only'
    || capability === 'unsupported'
    || hasMethod(game, 'not_supported')
  ) {
    return {
      kind: 'official_only',
      title: type === 'not_supported' || capability === 'unsupported' ? '暂不建议转换' : '官方服限定路线',
      badge: '受限',
      summary: '当前 adapter 认为该游戏应保留官方服务器/官方大厅入口，不建议强行转换为局域网。',
      primaryAction: '查看原因',
      inviteLabel: '复制官方路线说明',
      canCreateLanInvite: false,
      requiresVirtualLan: false,
      requiresDedicatedServer: false,
      requiresTcpPortProxy: false,
      requiresUdpBroadcastBridge: false,
      usesRemotePlay: false,
      usesSteamFlow: false,
      supported: false,
      tools: routeTools(game, ['官方服务器', '官方账号/大厅']),
      steps: [
        { id: 'official', title: '使用官方入口', detail: '优先走官方服务器、官方大厅或官方好友邀请。' },
        { id: 'avoid', title: '不要强转 LAN', detail: '避免误导用户配置 n2n 后仍无法联机。' },
        { id: 'record', title: '记录限制', detail: '可在 adapter 说明中记录为什么不建议转换。' },
      ],
    };
  }

  if (
    type === 'local_coop_remote_play'
    || capability === 'local_coop_remote_play'
    || hasCapability(game, 'local_coop')
    || hasCapability(game, 'remote_play_together')
    || hasMethod(game, 'steam_remote_play')
    || hasMethod(game, 'sunshine_moonlight')
  ) {
    return {
      kind: 'remote_coop',
      title: '本地同屏远程联机',
      badge: '远程同屏',
      summary: '该游戏主要是本地同屏/本地合作，不强行转换为 LAN；推荐 Steam Remote Play，备用 Sunshine + Moonlight。',
      primaryAction: '复制远程同屏说明',
      inviteLabel: '复制远程同屏说明',
      canCreateLanInvite: false,
      requiresVirtualLan: false,
      requiresDedicatedServer: false,
      requiresTcpPortProxy: false,
      requiresUdpBroadcastBridge: false,
      usesRemotePlay: true,
      usesSteamFlow: true,
      supported: true,
      tools: routeTools(game, ['Steam Remote Play Together', 'Sunshine + Moonlight']),
      steps: [
        { id: 'launch', title: '房主启动游戏', detail: '进入本地双人/同屏合作模式。' },
        { id: 'steam', title: 'Steam Remote Play', detail: 'Steam 版本优先从好友列表发起 Remote Play Together。' },
        { id: 'sunshine', title: '备用串流', detail: '非 Steam 或延迟不稳时使用 Sunshine + Moonlight。' },
      ],
    };
  }

  if (
    type === 'steam_lobby_direct_possible'
    || type === 'steam_relay_plugin'
    || type === 'steam_p2p_only'
    || capability === 'steam_p2p_lobby'
    || hasCapability(game, 'steam_lobby')
    || hasCapability(game, 'steam_p2p')
    || hasMethod(game, 'steam_relay_plugin')
  ) {
    return {
      kind: 'steam_p2p',
      title: 'Steam 大厅 / P2P 路线',
      badge: 'Steam',
      summary: '该游戏依赖 Steam 大厅、P2P 或可选 Steam Relay 插件；默认不把 n2n 当作主方案。',
      primaryAction: '复制 Steam 方案说明',
      inviteLabel: '复制 Steam 方案说明',
      canCreateLanInvite: false,
      requiresVirtualLan: false,
      requiresDedicatedServer: false,
      requiresTcpPortProxy: false,
      requiresUdpBroadcastBridge: false,
      usesRemotePlay: false,
      usesSteamFlow: true,
      supported: true,
      tools: routeTools(game, ['Steam 好友邀请', 'Steam 大厅/P2P', '可选 Steam Relay 插件']),
      steps: [
        { id: 'steam-room', title: '使用 Steam 邀请', detail: '房主按游戏原生流程创建 Steam 大厅或好友房间。' },
        { id: 'relay', title: '保留插件入口', detail: '如后续接入 Steam Relay/P2P 插件，可在这里扩展。' },
        { id: 'manual', title: '人工确认', detail: '涉及反作弊、官方账号或 Steamworks 权限时保持官方流程。' },
      ],
    };
  }

  if (type === 'udp_broadcast_needed' || plan?.requires_udp_broadcast_bridge || hasMethod(game, 'broadcast_bridge')) {
    return {
      kind: 'udp_broadcast_bridge',
      title: 'n2n + UDP 广播桥',
      badge: '广播桥',
      summary: `${typeLabel}：先建立虚拟局域网，再用 UDP 广播桥补齐局域网大厅发现。`,
      primaryAction: '打开高级工具',
      inviteLabel: '复制 LAN 邀请包',
      canCreateLanInvite: true,
      requiresVirtualLan: true,
      requiresDedicatedServer: Boolean(plan?.requires_dedicated_server || hasCapability(game, 'dedicated_server')),
      requiresTcpPortProxy: Boolean(plan?.requires_tcp_port_proxy || hasMethod(game, 'port_proxy')),
      requiresUdpBroadcastBridge: true,
      usesRemotePlay: false,
      usesSteamFlow: false,
      supported: true,
      tools: routeTools(game, ['n2n edge', 'UDP 广播桥']),
      steps: [
        { id: 'n2n', title: '启动 n2n', detail: '双方进入同一虚拟局域网并确认 ACK/PONG。' },
        { id: 'bridge', title: '启用 UDP 广播桥', detail: '在高级连接工具中配置游戏大厅发现所需 UDP 端口。' },
        { id: 'join', title: '进游戏大厅', detail: '好友在游戏内刷新局域网大厅或连接房主虚拟 IP。' },
      ],
    };
  }

  if (type === 'tcp_port_proxy_needed' || plan?.requires_tcp_port_proxy || hasMethod(game, 'port_proxy')) {
    return {
      kind: 'tcp_port_proxy',
      title: 'n2n + 端口代理',
      badge: '端口代理',
      summary: `${typeLabel}：先建立虚拟局域网，再按端口代理规则把游戏端口暴露给虚拟网。`,
      primaryAction: '打开高级工具',
      inviteLabel: '复制 LAN 邀请包',
      canCreateLanInvite: true,
      requiresVirtualLan: true,
      requiresDedicatedServer: Boolean(plan?.requires_dedicated_server || hasCapability(game, 'dedicated_server')),
      requiresTcpPortProxy: true,
      requiresUdpBroadcastBridge: Boolean(plan?.requires_udp_broadcast_bridge || hasMethod(game, 'broadcast_bridge')),
      usesRemotePlay: false,
      usesSteamFlow: false,
      supported: true,
      tools: routeTools(game, ['n2n edge', 'TCP/UDP 端口代理']),
      steps: [
        { id: 'n2n', title: '启动 n2n', detail: '双方进入同一虚拟局域网并确认 ACK/PONG。' },
        { id: 'proxy', title: '启用端口代理', detail: '在高级连接工具里把游戏监听端口代理到虚拟 IP。' },
        { id: 'test', title: '检测端口', detail: '检测房主虚拟 IP 和游戏端口是否可达。' },
      ],
    };
  }

  if (
    type === 'dedicated_server'
    || plan?.requires_dedicated_server
    || hasCapability(game, 'dedicated_server')
    || capability === 'hidden_dedicated_server'
    || hasMethod(game, 'dedicated_server_launcher')
  ) {
    return {
      kind: 'dedicated_server',
      title: 'n2n + 专用服务端',
      badge: '服务端',
      summary: '房主需要启动游戏服务端，并让好友通过虚拟 IP 和端口加入。',
      primaryAction: '启动服务端',
      inviteLabel: '复制 LAN 邀请包',
      canCreateLanInvite: true,
      requiresVirtualLan: true,
      requiresDedicatedServer: true,
      requiresTcpPortProxy: Boolean(plan?.requires_tcp_port_proxy || hasMethod(game, 'port_proxy')),
      requiresUdpBroadcastBridge: Boolean(plan?.requires_udp_broadcast_bridge || hasMethod(game, 'broadcast_bridge')),
      usesRemotePlay: false,
      usesSteamFlow: false,
      supported: true,
      tools: routeTools(game, ['n2n edge', '游戏服务端']),
      steps: [
        { id: 'n2n', title: '启动 n2n', detail: '双方进入同一虚拟局域网。' },
        { id: 'server', title: '启动服务端', detail: '房主启动专用服务端并保持窗口运行。' },
        { id: 'join', title: '好友加入', detail: '好友在游戏内连接房主虚拟 IP 和端口。' },
      ],
    };
  }

  return {
    kind: 'virtual_lan',
    title: 'n2n 虚拟局域网',
    badge: 'LAN',
    summary: methodLabels.length
      ? `适配器推荐：${methodLabels.join('、')}。组好虚拟局域网后用房主虚拟 IP 加入。`
      : '游戏支持 LAN 或 IP 直连，组好虚拟局域网后用房主虚拟 IP 加入。',
    primaryAction: '启动 n2n',
    inviteLabel: '复制 LAN 邀请包',
    canCreateLanInvite: true,
    requiresVirtualLan: true,
    requiresDedicatedServer: false,
    requiresTcpPortProxy: false,
    requiresUdpBroadcastBridge: false,
    usesRemotePlay: false,
    usesSteamFlow: false,
    supported: true,
    tools: routeTools(game, ['n2n edge', '虚拟网卡']),
    steps: [
      { id: 'n2n', title: '启动 n2n', detail: '双方进入同一房间并确认 ACK/PONG。' },
      { id: 'host', title: '房主开房', detail: '房主启动游戏或局域网房间。' },
      { id: 'join', title: '好友直连', detail: '好友连接房主虚拟 IP 和默认端口。' },
    ],
  };
}

export function buildNonLanRouteInvite(route: AdapterRecommendationRoute, game: GameSummary | null) {
  const gameName = game?.display_name || '未选择';
  const gameId = game?.game_id || '未选择';
  return [
    `[联机助手${route.title}说明]`,
    `游戏：${gameName}`,
    `游戏 ID：${gameId}`,
    `推荐路线：${route.title}`,
    `适配器类型：${game?.network_type ? networkTypeLabel(game.network_type) : '未标注'}`,
    '',
    '为什么这样推荐：',
    route.summary,
    '',
    '需要组件：',
    ...route.tools.map((tool) => `- ${tool}`),
    '',
    '操作步骤：',
    ...route.steps.map((step, index) => `${index + 1}. ${step.title}：${step.detail}`),
    '',
    route.kind === 'remote_coop'
      ? '提示：这类本地同屏游戏不需要 n2n，也不需要连接房主虚拟 IP 或端口。'
      : route.kind === 'steam_p2p'
        ? '提示：优先使用游戏原生 Steam 好友邀请/大厅；插件方案需要后续人工确认。'
        : route.kind === 'official_only'
          ? '提示：当前不建议强制转换为局域网，请使用官方入口。'
          : '提示：该游戏需要先完善 adapter 后再生成可执行邀请包。'
  ].join('\n');
}
