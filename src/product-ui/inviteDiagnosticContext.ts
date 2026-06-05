import type { LanInvitePacket } from './invitePacket';
import type { InviteJoinContext, InviteJoinResult } from './inviteJoinFlow';

export const INVITE_DIAGNOSTIC_CONTEXT_KEY = 'lan-helper.inviteDiagnosticContext';
export const INVITE_DIAGNOSTIC_CONTEXT_UPDATED_EVENT = 'lan-helper:invite-diagnostic-context-updated';
const DIAGNOSTIC_TARGET_KEY = 'lan-helper.referenceDiagnosticTarget';

export type InviteDiagnosticContextSource = 'invite_join_failure' | 'invite_join_pending';

export interface InviteDiagnosticContext {
  id: string;
  source: InviteDiagnosticContextSource;
  createdAt: string;
  packet: LanInvitePacket;
  phase: InviteJoinResult['phase'];
  title: string;
  detail: string;
  reasonKind: string;
  nextAction: string;
  error?: string;
  connectHost?: string;
  localIp?: string;
  supernode?: string;
  roomName?: string;
  gamePort?: string | number;
  runtimeLabel?: string;
  runtimeErrors: string[];
}

export function buildInviteDiagnosticContext(result: InviteJoinResult, context: InviteJoinContext = {}): InviteDiagnosticContext {
  const packet = result.packet ?? {};
  const isPending = result.phase === 'pending';
  return {
    id: `${Date.now()}-invite-join-${isPending ? 'pending_ack' : result.reason?.kind || 'unknown'}`,
    source: isPending ? 'invite_join_pending' : 'invite_join_failure',
    createdAt: new Date().toISOString(),
    packet,
    phase: result.phase,
    title: result.title,
    detail: result.detail,
    reasonKind: isPending ? 'pending_ack' : result.reason?.kind || 'unknown',
    nextAction: result.reason?.nextAction || (isPending
      ? '等待 10-20 秒自动复测 ACK/PONG；如果仍未确认，请打开诊断报告。'
      : '打开诊断报告，复制结果给房主或管理员。'),
    error: result.error,
    connectHost: context.connectHost || packet.hostVirtualIp,
    localIp: context.localIp || packet.friendVirtualIp,
    supernode: context.supernode || packet.supernode,
    roomName: context.roomName || packet.roomName,
    gamePort: context.gamePort || packet.gamePort,
    runtimeLabel: context.runtimeLabel,
    runtimeErrors: context.runtimeErrors ?? [],
  };
}

export function readInviteDiagnosticContext(): InviteDiagnosticContext | null {
  try {
    const raw = window.localStorage.getItem(INVITE_DIAGNOSTIC_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InviteDiagnosticContext;
    return (parsed?.source === 'invite_join_failure' || parsed?.source === 'invite_join_pending') && parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function clearInviteDiagnosticContext() {
  window.localStorage.removeItem(INVITE_DIAGNOSTIC_CONTEXT_KEY);
  window.dispatchEvent(new CustomEvent(INVITE_DIAGNOSTIC_CONTEXT_UPDATED_EVENT));
}

export function writeInviteDiagnosticContext(context: InviteDiagnosticContext) {
  window.localStorage.setItem(INVITE_DIAGNOSTIC_CONTEXT_KEY, JSON.stringify(context));
  if (context.packet.gameId) {
    window.localStorage.setItem(DIAGNOSTIC_TARGET_KEY, JSON.stringify({
      mode: 'game',
      game_id: context.packet.gameId,
    }));
  }
  window.dispatchEvent(new CustomEvent(INVITE_DIAGNOSTIC_CONTEXT_UPDATED_EVENT, { detail: context }));
}

export function formatInviteDiagnosticContext(context: InviteDiagnosticContext) {
  return [
    '[联机助手邀请加入诊断上下文]',
    `状态：${context.source === 'invite_join_pending' || context.phase === 'pending' ? '等待 ACK/PONG 确认' : '加入失败'}`,
    `时间：${new Date(context.createdAt).toLocaleString()}`,
    `结果：${context.title}`,
    `分类：${context.reasonKind}`,
    `说明：${context.detail}`,
    `建议：${context.nextAction}`,
    context.error ? `错误：${context.error}` : '',
    '',
    `游戏：${context.packet.gameName || '未知'}`,
    context.packet.gameId ? `游戏 ID：${context.packet.gameId}` : '',
    `房主虚拟 IP：${context.packet.hostVirtualIp || context.connectHost || '未读取'}`,
    `我的预留 IP：${context.packet.friendVirtualIp || context.localIp || '未读取'}`,
    `Supernode：${context.packet.supernode || context.supernode || '未读取'}`,
    `房间名：${context.packet.roomName || context.roomName || '未读取'}`,
    `游戏端口：${context.packet.gamePort || context.gamePort || '未读取'}`,
    `当前 n2n 状态：${context.runtimeLabel || '未读取'}`,
    context.runtimeErrors.length ? `runtime 错误：${context.runtimeErrors.join('；')}` : '',
  ].filter(Boolean).join('\n');
}
