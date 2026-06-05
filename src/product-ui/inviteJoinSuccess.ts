import type { ConnectivityReport } from '../types/network';
import type { LanInvitePacket } from './invitePacket';
import type { InviteJoinContext, InviteJoinResult } from './inviteJoinFlow';

export const INVITE_JOIN_SUCCESS_HISTORY_KEY = 'lan-helper.inviteJoinSuccessHistory';
export const INVITE_JOIN_SUCCESS_HISTORY_UPDATED_EVENT = 'lan-helper:invite-join-success-history-updated';

export interface InviteJoinSuccessRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  gameName: string;
  gameId?: string;
  hostVirtualIp: string;
  friendVirtualIp?: string;
  supernode?: string;
  roomName?: string;
  gamePort: number;
  joinSummary: string;
  portReachable?: boolean;
  portCheckSummary?: string;
  portCheckNotes: string[];
  portCheckedAt?: string;
}

function cleanText(value?: string | number | null) {
  return String(value ?? '').trim();
}

function defaultPort(packet?: LanInvitePacket, context?: InviteJoinContext) {
  const port = Number(packet?.gamePort || context?.gamePort || 7777);
  return Number.isFinite(port) && port > 0 ? port : 7777;
}

export function buildInviteJoinSuccessRecord(
  result: InviteJoinResult,
  context: InviteJoinContext = {},
): InviteJoinSuccessRecord {
  const packet = result.packet ?? {};
  const host = cleanText(packet.hostVirtualIp || context.connectHost || '');
  const port = defaultPort(packet, context);
  return {
    id: `${Date.now()}-invite-joined-${packet.gameId || packet.gameName || host || 'unknown'}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gameName: cleanText(packet.gameName) || '未知游戏',
    gameId: cleanText(packet.gameId) || undefined,
    hostVirtualIp: host || '未读取',
    friendVirtualIp: cleanText(packet.friendVirtualIp || context.localIp) || undefined,
    supernode: cleanText(packet.supernode || context.supernode) || undefined,
    roomName: cleanText(packet.roomName || context.roomName) || undefined,
    gamePort: port,
    joinSummary: result.detail || `n2n 已连接，请在游戏内连接 ${host || '房主虚拟 IP'}:${port}`,
    portCheckNotes: [],
  };
}

export function readInviteJoinSuccessHistory(): InviteJoinSuccessRecord[] {
  try {
    const raw = window.localStorage.getItem(INVITE_JOIN_SUCCESS_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.id && item?.hostVirtualIp && item?.gamePort).slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

export function saveInviteJoinSuccessHistory(history: InviteJoinSuccessRecord[]) {
  window.localStorage.setItem(INVITE_JOIN_SUCCESS_HISTORY_KEY, JSON.stringify(history.slice(0, 8)));
  window.dispatchEvent(new CustomEvent(INVITE_JOIN_SUCCESS_HISTORY_UPDATED_EVENT));
}

export function appendInviteJoinSuccessRecord(record: InviteJoinSuccessRecord) {
  const previous = readInviteJoinSuccessHistory();
  const next = [record, ...previous.filter((item) => item.id !== record.id)].slice(0, 8);
  saveInviteJoinSuccessHistory(next);
  return next;
}

export function updateInviteJoinSuccessRecord(record: InviteJoinSuccessRecord) {
  const previous = readInviteJoinSuccessHistory();
  const next = [record, ...previous.filter((item) => item.id !== record.id)].slice(0, 8);
  saveInviteJoinSuccessHistory(next);
  return next;
}

export function applyPortCheckToJoinSuccessRecord(
  record: InviteJoinSuccessRecord,
  report: ConnectivityReport,
): InviteJoinSuccessRecord {
  const portResult = report.ports.find((item) => item.port === record.gamePort) ?? report.ports[0];
  const reachable = Boolean(report.reachable || portResult?.reachable);
  const latency = report.latency_ms ?? portResult?.latency_ms;
  const error = portResult?.error;
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    portReachable: reachable,
    portCheckSummary: `${record.hostVirtualIp}:${record.gamePort} ${reachable ? '可连接' : '不可连接'}${latency ? `｜${latency}ms` : ''}${error ? `｜${error}` : ''}`,
    portCheckNotes: report.notes ?? [],
    portCheckedAt: new Date().toISOString(),
  };
}

export function formatInviteJoinSuccessInstruction(record: InviteJoinSuccessRecord) {
  return [
    '[联机助手游戏内连接说明]',
    `游戏：${record.gameName}${record.gameId ? ` (${record.gameId})` : ''}`,
    `房主虚拟 IP：${record.hostVirtualIp}`,
    `游戏端口：${record.gamePort}`,
    record.friendVirtualIp ? `我的虚拟 IP：${record.friendVirtualIp}` : '',
    record.supernode ? `Supernode：${record.supernode}` : '',
    record.roomName ? `房间名：${record.roomName}` : '',
    '',
    '游戏内操作：',
    `1. 打开游戏的多人 / 加入 / IP 直连入口。`,
    `2. 地址填写：${record.hostVirtualIp}`,
    `3. 端口填写：${record.gamePort}`,
    '4. 如果游戏没有 IP 直连入口，请回到联机助手推荐方案页确认是否需要 UDP 广播桥、端口代理或远程同屏方案。',
    '',
    '端口检测：',
    record.portCheckSummary || '尚未检测房主游戏端口。',
    record.portCheckNotes.length ? `备注：${record.portCheckNotes.join('；')}` : '',
  ].filter(Boolean).join('\n');
}
