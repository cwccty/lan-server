import {
  refreshReferenceRuntime,
  saveReferenceN2nConfig,
  startReferenceN2n,
} from '../reference-adapter/actions';
import type { ReferenceRuntimeSnapshot } from '../reference-adapter/types';
import type { NetworkConfig } from '../types/network';
import { invitePacketToNetworkConfig, type LanInvitePacket } from './invitePacket';

export type InviteJoinPhase = 'idle' | 'filled' | 'joining' | 'joined' | 'pending' | 'failed';

export type InviteJoinFailureKind =
  | 'auth'
  | 'ip_conflict'
  | 'supernode'
  | 'edge_missing'
  | 'permission'
  | 'config_missing'
  | 'not_ready'
  | 'unknown';

export interface InviteJoinFailureReason {
  kind: InviteJoinFailureKind;
  title: string;
  detail: string;
  nextAction: string;
}

export interface InviteJoinResult {
  phase: InviteJoinPhase;
  title: string;
  detail: string;
  packet?: LanInvitePacket;
  error?: string;
  reason?: InviteJoinFailureReason;
  latest?: ReferenceRuntimeSnapshot;
}

export interface InviteJoinContext {
  connectHost?: string;
  localIp?: string;
  supernode?: string;
  roomName?: string;
  gamePort?: string | number;
  runtimeLabel?: string;
  runtimeErrors?: string[];
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function messageText(error: unknown, runtimeLabel = '') {
  return `${error instanceof Error ? error.message : String(error || '')} ${runtimeLabel}`.trim();
}

export function classifyJoinFailure(error: unknown, runtimeLabel = ''): InviteJoinFailureReason {
  const message = messageText(error, runtimeLabel).toLowerCase();
  if (!message.trim()) {
    return {
      kind: 'unknown',
      title: '加入失败',
      detail: '暂时没有足够错误信息。请生成诊断报告，把报告或错误信息发给房主。',
      nextAction: '打开诊断报告，复制结果给房主或管理员。',
    };
  }
  if (message.includes('room') || message.includes('secret') || message.includes('配置缺少') || message.includes('未填写')) {
    return {
      kind: 'config_missing',
      title: '邀请参数不完整',
      detail: '邀请包缺少房间名、密钥或 Supernode。请让房主重新生成完整邀请包。',
      nextAction: '重新向房主要邀请包，或手动补齐参数后再启动。',
    };
  }
  if (message.includes('auth') || message.includes('认证') || message.includes('key') || message.includes('密钥')) {
    return {
      kind: 'auth',
      title: '房间认证失败',
      detail: '房间密钥或房间名可能不一致。请让房主重新复制邀请包，再粘贴加入。',
      nextAction: '核对房间名和密钥；必要时让房主重开房间。',
    };
  }
  if (message.includes('already in use') || message.includes('conflict') || message.includes('冲突') || message.includes('占用')) {
    return {
      kind: 'ip_conflict',
      title: '虚拟 IP 可能冲突',
      detail: '邀请包里的好友虚拟 IP 可能已被占用。请让房主重新分配一个好友 IP。',
      nextAction: '让房主换一个好友 IP，再生成新的邀请包。',
    };
  }
  if (message.includes('supernode') || message.includes('not responding') || message.includes('无响应') || message.includes('timeout')) {
    return {
      kind: 'supernode',
      title: 'Supernode 暂无响应',
      detail: '中继节点可能未启动、端口未放行或网络不可达。请房主检查 VPS 上的 supernode。',
      nextAction: '让房主检查 supernode 地址、端口、防火墙和 n2n 服务。',
    };
  }
  if (message.includes('edge') || message.includes('not found') || message.includes('找不到')) {
    return {
      kind: 'edge_missing',
      title: 'n2n edge 不可用',
      detail: '没有找到可用的 edge.exe，或 edge 路径配置不正确。',
      nextAction: '到设置与帮助检查 edge.exe 路径，必要时重新选择工具目录。',
    };
  }
  if (message.includes('permission') || message.includes('权限') || message.includes('administrator') || message.includes('管理员')) {
    return {
      kind: 'permission',
      title: '权限不足',
      detail: '启动虚拟网卡或 edge 可能需要更高权限。',
      nextAction: '尝试以管理员身份运行联机助手，然后重新加入。',
    };
  }
  return {
    kind: 'not_ready',
    title: '加入失败',
    detail: 'n2n 未能稳定启动或未读取到有效连接状态。请生成诊断报告查看详细原因。',
    nextAction: '打开诊断报告，复制错误信息给房主或管理员。',
  };
}

export function validateInviteNetworkConfig(config: NetworkConfig) {
  const missing: string[] = [];
  if (!config.supernode?.trim()) missing.push('Supernode');
  if (!config.room_name?.trim()) missing.push('房间名');
  if (!config.secret?.trim()) missing.push('房间密钥');
  return missing;
}

export function inviteResultTone(phase: InviteJoinPhase) {
  if (phase === 'joined') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (phase === 'failed') return 'border-rose-100 bg-rose-50 text-rose-700';
  if (phase === 'joining' || phase === 'pending') return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-slate-100 bg-slate-50 text-slate-600';
}

export function joinSuccessDetail(packet: LanInvitePacket, context: InviteJoinContext = {}) {
  const host = packet.hostVirtualIp || context.connectHost || '未读取';
  const port = packet.gamePort || Number(context.gamePort) || 7777;
  return `请在游戏内连接房主虚拟 IP：${host}，端口：${port}。`;
}

export async function joinFromInvitePacket(packet: LanInvitePacket, context: InviteJoinContext = {}): Promise<InviteJoinResult> {
  const config = invitePacketToNetworkConfig(packet);
  const missing = validateInviteNetworkConfig(config);
  if (missing.length) {
    const reason = classifyJoinFailure(`邀请包缺少：${missing.join('、')}`);
    return {
      phase: 'failed',
      title: reason.title,
      detail: reason.detail,
      packet,
      error: `missing_fields=${missing.join(',')}`,
      reason,
    };
  }

  try {
    const saved = await saveReferenceN2nConfig(config);
    if (!saved.ok) throw new Error(saved.message);
    const started = await startReferenceN2n(config);
    if (!started.ok) throw new Error(started.message);

    let latest = started.snapshot;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await wait(1500);
      const refreshed = await refreshReferenceRuntime(false);
      latest = refreshed.snapshot || latest;
      if (latest?.n2n?.ok_link) break;
    }

    const n2n = latest?.n2n;
    if (n2n?.ok_link) {
      return {
        phase: 'joined',
        title: '已加入好友房间',
        detail: joinSuccessDetail(packet, context),
        packet,
        latest,
      };
    }
    if (n2n?.running) {
      return {
        phase: 'pending',
        title: 'n2n 已启动，等待确认',
        detail: 'edge 已运行，但暂未看到 ACK/PONG。等待 10 到 20 秒后刷新，若仍未连接请生成诊断报告。',
        packet,
        latest,
      };
    }

    const error = n2n?.last_error || latest?.errors?.[0] || n2n?.summary || 'edge 未保持运行';
    const reason = classifyJoinFailure(error, n2n?.summary);
    return {
      phase: 'failed',
      title: reason.title,
      detail: reason.detail,
      packet,
      error,
      reason,
      latest,
    };
  } catch (error) {
    const reason = classifyJoinFailure(error, context.runtimeLabel);
    return {
      phase: 'failed',
      title: reason.title,
      detail: reason.detail,
      packet,
      error: error instanceof Error ? error.message : String(error),
      reason,
    };
  }
}

export function buildInviteJoinErrorText(result: InviteJoinResult, context: InviteJoinContext = {}) {
  const packet = result.packet;
  return [
    '[联机助手加入失败信息]',
    `结果：${result.title}`,
    `分类：${result.reason?.kind || 'unknown'}`,
    `说明：${result.detail}`,
    result.reason?.nextAction ? `建议：${result.reason.nextAction}` : '',
    result.error ? `错误：${result.error}` : '',
    `游戏：${packet?.gameName || '未知'}`,
    `房主虚拟 IP：${packet?.hostVirtualIp || context.connectHost || '未读取'}`,
    `我的预留 IP：${packet?.friendVirtualIp || context.localIp || '未读取'}`,
    `Supernode：${packet?.supernode || context.supernode || '未读取'}`,
    `房间名：${packet?.roomName || context.roomName || '未读取'}`,
    `游戏端口：${packet?.gamePort || context.gamePort || '未读取'}`,
    `当前 n2n 状态：${context.runtimeLabel || '未读取'}`,
    context.runtimeErrors?.length ? `runtime 错误：${context.runtimeErrors.join('；')}` : '',
  ].filter(Boolean).join('\n');
}
