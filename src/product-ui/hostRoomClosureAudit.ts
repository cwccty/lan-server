import type { GameSummary } from '../types/game';
import type { NetworkConfig } from '../types/network';
import type { ServerSessionStatus } from '../types/serverSession';
import type { AdapterRecommendationRoute } from './adapterRecommendationRoute';

export type HostRoomClosureAuditStatus = 'wired' | 'observed' | 'manual_check';

export interface HostRoomClosureAuditItem {
  id: string;
  label: string;
  status: HostRoomClosureAuditStatus;
  evidence: string;
  manualCheck: string;
}

export interface HostRoomClosureStepSnapshot {
  id: string;
  title: string;
  state: string;
}

export interface HostRoomClosureAuditInput {
  currentGame: GameSummary | null;
  adapterRoute: AdapterRecommendationRoute;
  hostSteps: HostRoomClosureStepSnapshot[];
  runtime: {
    loaded: boolean;
    network: {
      running: boolean;
      ready: boolean;
      hasError: boolean;
      label?: string;
      virtualIp?: string;
      supernode?: string;
    };
    errors?: string[];
  };
  n2nConfig: NetworkConfig | null;
  server: ServerSessionStatus | null;
  selectedFriend: {
    name: string;
    ip: string;
    last_check_summary?: string | null;
  } | null;
  hostPortCheck: string;
  lastCheck: string;
  invite: string;
  routeUsesLanInvite: boolean;
}

const STATIC_AUDIT_ITEMS: HostRoomClosureAuditItem[] = [
  {
    id: 'select-game',
    label: '选择游戏',
    status: 'wired',
    evidence: 'ProductRecommendationView 的 selectGameStep / chooseGame 会读取游戏扫描结果并设置当前推荐目标。',
    manualCheck: '进入推荐方案页后，应能看到当前游戏；切换游戏后，推荐路线、端口和向导步骤随之变化。',
  },
  {
    id: 'recommendation-route',
    label: '生成推荐方案',
    status: 'wired',
    evidence: 'buildAdapterRecommendationRoute 根据 adapter 的 network_type / conversion methods 生成 n2n、广播桥、端口代理、远程同屏、Steam 或官方路线。',
    manualCheck: '不同类型 adapter 应显示不同路线，不应把本地同屏或官方服限定游戏强行做成 LAN 邀请。',
  },
  {
    id: 'start-host-network',
    label: '启动房主组网',
    status: 'wired',
    evidence: 'startHostNetwork 调用 startReferenceN2n，并在完成后 refreshReferenceRuntime / load 刷新房主向导。',
    manualCheck: 'LAN 路线点击“启动 n2n”后，应看到 edge 运行、ACK/PONG 或明确失败提示。',
  },
  {
    id: 'auto-detect-n2n-state',
    label: '自动检测 n2n 状态',
    status: 'wired',
    evidence: 'resolveProductStatusCenter 使用 runtime.network、n2nConfig、server 和好友席位计算当前可邀请状态。',
    manualCheck: 'n2n 未配置、启动中、已连接、异常时，向导和状态卡应显示不同下一步。',
  },
  {
    id: 'launch-host-entity',
    label: '启动服务端或游戏',
    status: 'wired',
    evidence: 'launchHostEntity 会根据 adapterRoute.requiresDedicatedServer 调用 startGameServerSession 或 launchProfile。',
    manualCheck: '需要专用服务端的游戏应启动服务端；普通 LAN 游戏应启动游戏或推荐启动项。',
  },
  {
    id: 'test-host-port',
    label: '检测游戏端口',
    status: 'wired',
    evidence: 'testHostGamePort 使用 testConnectivity(mode=local_game_port) 检测 127.0.0.1 + 默认端口。',
    manualCheck: '服务端/游戏启动后点击检测，应显示本机端口已监听或未监听，而不是只改变按钮文字。',
  },
  {
    id: 'advanced-tools-route',
    label: '配置高级工具路线',
    status: 'wired',
    evidence: 'advancedStep 会在 adapterRoute.requiresTcpPortProxy 或 requiresUdpBroadcastBridge 时引导进入高级连接工具。',
    manualCheck: '端口代理或 UDP 广播桥游戏应出现高级工具步骤，普通 LAN 游戏不应强制配置。',
  },
  {
    id: 'friend-allocation',
    label: '分配好友虚拟 IP',
    status: 'wired',
    evidence: 'ensureFriendSlot / upsertReferenceFriendAllocationBackendFirst 会创建并选择好友虚拟 IP 席位。',
    manualCheck: '点击分配好友 IP 后，应生成好友名称和虚拟 IP，并写入邀请包。',
  },
  {
    id: 'friend-connectivity-check',
    label: '检测好友连接',
    status: 'wired',
    evidence: 'testFriend 使用 testConnectivity(mode=n2n_game_port) 检测选中好友虚拟 IP 与当前游戏端口，并保存 last_check_summary。',
    manualCheck: '选中好友后点击检测，应显示可连接/不可连接结果，并能进入邀请包摘要。',
  },
  {
    id: 'generate-invite-packet',
    label: '生成邀请包或路线说明',
    status: 'wired',
    evidence: 'buildLanInvitePacket 生成真实 LAN 邀请包；buildRemoteCoopFriendGuide / buildNonLanRouteInvite 生成非 LAN 路线说明。',
    manualCheck: 'LAN 路线应包含房间名、密钥、Supernode、房主/好友虚拟 IP 和端口；非 LAN 路线应是说明而不是虚拟 IP 邀请。',
  },
  {
    id: 'copy-host-invite',
    label: '一键复制给好友',
    status: 'wired',
    evidence: 'copyHostInvite 在 LAN 路线检查好友席位后调用 copyInvite；非 LAN 路线直接复制对应说明。',
    manualCheck: '点击“复制邀请包/复制说明”后，剪贴板内容应可直接发给好友。',
  },
  {
    id: 'non-lan-route-guard',
    label: '非 LAN 路线防误导',
    status: 'wired',
    evidence: 'routeUsesLanInvite / adapterRoute.canCreateLanInvite 决定是否生成 LAN 邀请；remote_coop、steam_p2p、official_only、needs_review 不生成虚拟 IP 邀请。',
    manualCheck: '本地同屏、Steam P2P、官方服限定或待复核游戏，应复制路线说明，不应提示好友连接虚拟 IP。',
  },
];

function markObserved(item: HostRoomClosureAuditItem, input: HostRoomClosureAuditInput): HostRoomClosureAuditItem {
  const hostStepIds = new Set(input.hostSteps.map((step) => step.id));
  const hasInviteText = input.invite.trim().length > 0;
  const hasHostPortResult = input.hostPortCheck.trim().length > 0;
  const hasFriendCheck = input.lastCheck.trim().length > 0 || Boolean(input.selectedFriend?.last_check_summary);

  if (item.id === 'select-game' && input.currentGame) return { ...item, status: 'observed' };
  if (item.id === 'recommendation-route' && input.adapterRoute.kind) return { ...item, status: 'observed' };
  if (item.id === 'start-host-network' && (input.runtime.network.running || input.runtime.network.ready || input.n2nConfig?.supernode)) return { ...item, status: 'observed' };
  if (item.id === 'auto-detect-n2n-state' && (input.runtime.loaded || input.runtime.network.label || input.runtime.errors?.length)) return { ...item, status: 'observed' };
  if (item.id === 'launch-host-entity' && (input.server?.running || hasHostPortResult || hostStepIds.has('host-entity') || hostStepIds.has('launch-local'))) return { ...item, status: 'observed' };
  if (item.id === 'test-host-port' && hasHostPortResult) return { ...item, status: 'observed' };
  if (item.id === 'advanced-tools-route' && (hostStepIds.has('advanced-tools') || (!input.adapterRoute.requiresTcpPortProxy && !input.adapterRoute.requiresUdpBroadcastBridge))) return { ...item, status: 'observed' };
  if (item.id === 'friend-allocation' && (!input.routeUsesLanInvite || input.selectedFriend)) return { ...item, status: 'observed' };
  if (item.id === 'friend-connectivity-check' && (!input.routeUsesLanInvite || hasFriendCheck)) return { ...item, status: hasFriendCheck ? 'observed' : 'wired' };
  if (item.id === 'generate-invite-packet' && hasInviteText) return { ...item, status: 'observed' };
  if (item.id === 'copy-host-invite' && hasInviteText && (!input.routeUsesLanInvite || input.selectedFriend)) return { ...item, status: 'observed' };
  if (item.id === 'non-lan-route-guard' && !input.routeUsesLanInvite) return { ...item, status: 'observed' };
  return item;
}

export function buildHostRoomClosureAudit(input: HostRoomClosureAuditInput) {
  const items = STATIC_AUDIT_ITEMS.map((item) => markObserved(item, input));
  const observedCount = items.filter((item) => item.status === 'observed').length;
  const manualCount = items.filter((item) => item.status === 'manual_check').length;
  const routeLabel = input.routeUsesLanInvite ? 'LAN 邀请路线' : '非 LAN 路线说明';

  return {
    items,
    wiredCount: items.length,
    observedCount,
    manualCount,
    routeLabel,
    summary: `已固化 ${items.length} 项房主开房闭环能力；当前为 ${routeLabel}，界面状态已观察到 ${observedCount} 项。`,
  };
}

export function formatHostRoomClosureAuditReport(input: HostRoomClosureAuditInput) {
  const audit = buildHostRoomClosureAudit(input);
  return [
    '[联机助手房主开房闭环自检]',
    audit.summary,
    '',
    '当前状态：',
    `- 游戏：${input.currentGame?.display_name || '未选择'}`,
    `- 路线：${input.adapterRoute.title} (${input.adapterRoute.kind})`,
    `- 是否生成 LAN 邀请：${input.routeUsesLanInvite ? '是' : '否'}`,
    `- n2n：${input.runtime.network.ready ? 'ACK/PONG 已通过' : input.runtime.network.running ? 'edge 运行中' : input.n2nConfig?.supernode ? '已配置未确认' : '未配置'}`,
    `- 房主虚拟 IP：${input.runtime.network.virtualIp || input.n2nConfig?.local_ip || '未读取'}`,
    `- Supernode：${input.runtime.network.supernode || input.n2nConfig?.supernode || '未读取'}`,
    `- 服务端：${input.server?.running ? '运行中' : '未运行'}`,
    `- 端口检测：${input.hostPortCheck || '未检测'}`,
    `- 好友席位：${input.selectedFriend ? `${input.selectedFriend.name} (${input.selectedFriend.ip})` : input.routeUsesLanInvite ? '未分配' : '非 LAN 路线不需要'}`,
    `- 好友检测：${input.lastCheck || input.selectedFriend?.last_check_summary || '未检测'}`,
    '',
    '当前向导步骤：',
    ...input.hostSteps.map((step, index) => `${index + 1}. ${step.title} [${step.id}/${step.state}]`),
    '',
    '自检清单：',
    ...audit.items.map((item, index) => [
      `${index + 1}. ${item.label} [${item.status}]`,
      `   证据：${item.evidence}`,
      `   人工验证：${item.manualCheck}`,
    ].join('\n')),
  ].join('\n');
}
