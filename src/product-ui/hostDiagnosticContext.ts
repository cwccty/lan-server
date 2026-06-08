import type { GameSummary } from '../types/game';
import type { NetworkConfig } from '../types/network';
import type { ServerSessionStatus } from '../types/serverSession';
import type { AdapterRecommendationRoute } from './adapterRecommendationRoute';

export const HOST_DIAGNOSTIC_CONTEXT_KEY = 'lan-helper.hostDiagnosticContext';
export const HOST_DIAGNOSTIC_CONTEXT_UPDATED_EVENT = 'lan-helper:host-diagnostic-context-updated';
const DIAGNOSTIC_TARGET_KEY = 'lan-helper.referenceDiagnosticTarget';

export type HostDiagnosticContextSource =
  | 'host_network_failure'
  | 'host_server_failure'
  | 'host_port_failure'
  | 'host_advanced_tools_needed'
  | 'host_friend_check_failure'
  | 'host_config_missing';

export type HostDiagnosticNextActionKind = 'diagnostics' | 'advanced_tools' | 'network' | 'recommendation';

export interface HostDiagnosticContext {
  id: string;
  source: HostDiagnosticContextSource;
  createdAt: string;
  title: string;
  detail: string;
  reasonKind: string;
  nextAction: string;
  nextActionKind: HostDiagnosticNextActionKind;
  error?: string;
  gameId?: string;
  gameName?: string;
  routeKind: AdapterRecommendationRoute['kind'];
  routeTitle: string;
  routeSummary: string;
  routeUsesLanInvite: boolean;
  requiresDedicatedServer: boolean;
  requiresTcpPortProxy: boolean;
  requiresUdpBroadcastBridge: boolean;
  roomName?: string;
  supernode?: string;
  hostVirtualIp?: string;
  friendName?: string;
  friendVirtualIp?: string;
  gamePort?: number;
  serverRunning: boolean;
  serverMessage?: string;
  hostPortCheck?: string;
  friendCheck?: string;
  runtimeLabel?: string;
  runtimeErrors: string[];
}

export interface BuildHostDiagnosticContextInput {
  source: HostDiagnosticContextSource;
  reasonKind: string;
  title?: string;
  detail?: string;
  nextAction?: string;
  nextActionKind?: HostDiagnosticNextActionKind;
  error?: string;
  game: GameSummary | null;
  adapterRoute: AdapterRecommendationRoute;
  routeUsesLanInvite: boolean;
  n2nConfig: NetworkConfig | null;
  runtime: {
    network: {
      running: boolean;
      ready: boolean;
      label?: string;
      virtualIp?: string;
      supernode?: string;
    };
    errors?: string[];
  };
  server: ServerSessionStatus | null;
  selectedFriend: {
    name: string;
    ip: string;
    last_check_summary?: string | null;
  } | null;
  gamePort: number;
  hostPortCheck?: string;
  friendCheck?: string;
}

function defaultTitle(source: HostDiagnosticContextSource) {
  if (source === 'host_network_failure') return '房主启动组网失败';
  if (source === 'host_server_failure') return '房主服务端或游戏启动失败';
  if (source === 'host_port_failure') return '房主游戏端口未通过检测';
  if (source === 'host_advanced_tools_needed') return '当前路线需要高级连接工具';
  if (source === 'host_friend_check_failure') return '好友连接检测未通过';
  return '房主开房信息不完整';
}

function defaultDetail(source: HostDiagnosticContextSource, input: BuildHostDiagnosticContextInput) {
  if (source === 'host_network_failure') return '房主组网启动失败，需要检查中继地址、房间名、密钥、组网程序和权限。';
  if (source === 'host_server_failure') return '房主侧服务端或游戏进程未能按推荐方案启动，需要结合端口和进程状态诊断。';
  if (source === 'host_port_failure') return `本机 127.0.0.1:${input.gamePort} 尚未确认监听，好友即使完成组网也可能进不了游戏。`;
  if (source === 'host_advanced_tools_needed') return `${input.adapterRoute.title} 需要进入高级连接工具，预填端口代理或 UDP 广播桥信息后再测试。`;
  if (source === 'host_friend_check_failure') return '选中好友的联机地址或游戏端口暂未连通，需要确认双方组网状态和游戏端口。';
  return '房主开房缺少完整组网信息，请先补齐房间名、密钥和中继地址。';
}

function defaultNextAction(source: HostDiagnosticContextSource, input: BuildHostDiagnosticContextInput) {
  if (source === 'host_advanced_tools_needed') return '带当前游戏、端口和好友联机地址进入高级连接工具，启动后测试连接。';
  if (source === 'host_config_missing') return '先回加入与组网页补齐房间名、密钥和中继地址，然后重新启动房主组网。';
  if (source === 'host_port_failure') return '打开诊断报告，确认服务端/游戏是否监听端口；如该游戏方案需要代理或广播桥，再带信息去高级工具。';
  if (input.adapterRoute.requiresTcpPortProxy || input.adapterRoute.requiresUdpBroadcastBridge) {
    return '先带信息进入高级连接工具；如果测试仍失败，再把诊断报告发给管理员。';
  }
  return '打开诊断报告，按组网、服务端和端口证据继续修复。';
}

function defaultNextActionKind(source: HostDiagnosticContextSource, input: BuildHostDiagnosticContextInput): HostDiagnosticNextActionKind {
  if (source === 'host_advanced_tools_needed') return 'advanced_tools';
  if (source === 'host_config_missing') return 'network';
  if (input.adapterRoute.requiresTcpPortProxy || input.adapterRoute.requiresUdpBroadcastBridge) return 'advanced_tools';
  return 'diagnostics';
}

export function buildHostDiagnosticContext(input: BuildHostDiagnosticContextInput): HostDiagnosticContext {
  return {
    id: `${Date.now()}-${input.source}-${input.reasonKind}`,
    source: input.source,
    createdAt: new Date().toISOString(),
    title: input.title || defaultTitle(input.source),
    detail: input.detail || defaultDetail(input.source, input),
    reasonKind: input.reasonKind,
    nextAction: input.nextAction || defaultNextAction(input.source, input),
    nextActionKind: input.nextActionKind || defaultNextActionKind(input.source, input),
    error: input.error,
    gameId: input.game?.game_id,
    gameName: input.game?.display_name,
    routeKind: input.adapterRoute.kind,
    routeTitle: input.adapterRoute.title,
    routeSummary: input.adapterRoute.summary,
    routeUsesLanInvite: input.routeUsesLanInvite,
    requiresDedicatedServer: input.adapterRoute.requiresDedicatedServer,
    requiresTcpPortProxy: input.adapterRoute.requiresTcpPortProxy,
    requiresUdpBroadcastBridge: input.adapterRoute.requiresUdpBroadcastBridge,
    roomName: input.n2nConfig?.room_name,
    supernode: input.runtime.network.supernode || input.n2nConfig?.supernode,
    hostVirtualIp: input.runtime.network.virtualIp || input.n2nConfig?.local_ip,
    friendName: input.selectedFriend?.name,
    friendVirtualIp: input.selectedFriend?.ip,
    gamePort: input.gamePort,
    serverRunning: Boolean(input.server?.running),
    serverMessage: input.server?.message,
    hostPortCheck: input.hostPortCheck,
    friendCheck: input.friendCheck || input.selectedFriend?.last_check_summary || undefined,
    runtimeLabel: input.runtime.network.label,
    runtimeErrors: input.runtime.errors ?? [],
  };
}

export function readHostDiagnosticContext(): HostDiagnosticContext | null {
  try {
    const raw = window.localStorage.getItem(HOST_DIAGNOSTIC_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HostDiagnosticContext;
    return parsed?.id && parsed?.source?.startsWith('host_') ? parsed : null;
  } catch {
    return null;
  }
}

export function clearHostDiagnosticContext() {
  window.localStorage.removeItem(HOST_DIAGNOSTIC_CONTEXT_KEY);
  window.dispatchEvent(new CustomEvent(HOST_DIAGNOSTIC_CONTEXT_UPDATED_EVENT));
}

export function targetFromHostDiagnosticContext(context: HostDiagnosticContext | null): { mode: 'global' | 'game'; game_id: string } | null {
  if (!context) return null;
  return context.gameId ? { mode: 'game', game_id: context.gameId } : { mode: 'global', game_id: '' };
}

export function writeHostDiagnosticContext(context: HostDiagnosticContext) {
  window.localStorage.setItem(HOST_DIAGNOSTIC_CONTEXT_KEY, JSON.stringify(context));
  const target = targetFromHostDiagnosticContext(context);
  if (target) window.localStorage.setItem(DIAGNOSTIC_TARGET_KEY, JSON.stringify(target));
  window.dispatchEvent(new CustomEvent(HOST_DIAGNOSTIC_CONTEXT_UPDATED_EVENT, { detail: context }));
}

export function formatHostDiagnosticContext(context: HostDiagnosticContext) {
  return [
    '[联机助手房主开房诊断上下文]',
    `时间：${new Date(context.createdAt).toLocaleString()}`,
    `来源：${context.source}`,
    `分类：${context.reasonKind}`,
    `结果：${context.title}`,
    `说明：${context.detail}`,
    `建议：${context.nextAction}`,
    context.error ? `错误：${context.error}` : '',
    '',
    `游戏：${context.gameName || '未知'}`,
    context.gameId ? `游戏 ID：${context.gameId}` : '',
    `推荐路线：${context.routeTitle} (${context.routeKind})`,
    `路线说明：${context.routeSummary}`,
    `是否生成 LAN 邀请：${context.routeUsesLanInvite ? '是' : '否'}`,
    `需要服务端：${context.requiresDedicatedServer ? '是' : '否'}`,
    `需要端口代理：${context.requiresTcpPortProxy ? '是' : '否'}`,
    `需要 UDP 广播桥：${context.requiresUdpBroadcastBridge ? '是' : '否'}`,
    '',
    `房间名：${context.roomName || '未读取'}`,
    `中继地址：${context.supernode || '未读取'}`,
    `房主联机地址：${context.hostVirtualIp || '未读取'}`,
    `好友：${context.friendName || '未选择'} ${context.friendVirtualIp || ''}`.trim(),
    `游戏端口：${context.gamePort || '未读取'}`,
    `服务端：${context.serverRunning ? '运行中' : '未运行'}${context.serverMessage ? `｜${context.serverMessage}` : ''}`,
    `房主端口检测：${context.hostPortCheck || '未检测'}`,
    `好友检测：${context.friendCheck || '未检测'}`,
    `当前组网状态：${context.runtimeLabel || '未读取'}`,
    context.runtimeErrors.length ? `运行错误：${context.runtimeErrors.join('；')}` : '',
  ].filter(Boolean).join('\n');
}
