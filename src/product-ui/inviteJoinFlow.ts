import {
  refreshReferenceRuntime,
  saveReferenceN2nConfig,
  startReferenceN2n,
} from '../reference-adapter/actions';
import type { ReferenceRuntimeSnapshot } from '../reference-adapter/types';
import type { NetworkConfig } from '../types/network';
import {
  formatLanInviteMissingFields,
  invitePacketToNetworkConfig,
  validateLanInvitePacket,
  type LanInvitePacket
} from './invitePacket';

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
  if (message.includes('missing_fields') || message.includes('邀请包缺少') || message.includes('配置缺少') || message.includes('未填写')) {
    return {
      kind: 'config_missing',
      title: '邀请信息不完整',
      detail: '邀请包缺少房间名、密钥或中继地址。请让房主重新生成完整邀请包。',
      nextAction: '重新向房主要邀请包，或手动补齐信息后再启动。',
    };
  }
  if (
    message.includes('auth') ||
    message.includes('认证') ||
    message.includes('key') ||
    message.includes('密钥') ||
    message.includes('password') ||
    message.includes('mismatch') ||
    message.includes('denied') ||
    message.includes('unauthorized') ||
    message.includes('wrong secret') ||
    message.includes('invalid secret')
  ) {
    return {
      kind: 'auth',
      title: '房间认证失败',
      detail: '房间密钥或房间名可能不一致。请让房主重新复制邀请包，再粘贴加入。',
      nextAction: '核对房间名和密钥；必要时让房主重开房间。',
    };
  }
  if (message.includes('room') || message.includes('secret')) {
    return {
      kind: 'config_missing',
      title: '邀请信息不完整',
      detail: '邀请包缺少房间名、密钥或中继地址。请让房主重新生成完整邀请包。',
      nextAction: '重新向房主要邀请包，或手动补齐信息后再启动。',
    };
  }
  if (message.includes('already in use') || message.includes('conflict') || message.includes('冲突') || message.includes('占用')) {
    return {
      kind: 'ip_conflict',
      title: '联机地址可能冲突',
      detail: '邀请包里的好友联机地址可能已被占用。请让房主重新分配一个好友地址。',
      nextAction: '让房主换一个好友地址，再生成新的邀请包。',
    };
  }
  if (message.includes('supernode') || message.includes('not responding') || message.includes('无响应') || message.includes('timeout')) {
    return {
      kind: 'supernode',
      title: '中继地址暂无响应',
      detail: '中继节点可能未启动、端口未放行或网络不可达。请房主检查中继地址。',
      nextAction: '让房主检查中继地址、端口、防火墙和组网服务。',
    };
  }
  if (message.includes('edge') || message.includes('not found') || message.includes('找不到')) {
    return {
      kind: 'edge_missing',
      title: '组网程序不可用',
      detail: '没有找到可用的组网程序，或程序路径配置不正确。',
      nextAction: '到设置与帮助检查组网程序，必要时重新选择工具目录。',
    };
  }
  if (message.includes('permission') || message.includes('权限') || message.includes('administrator') || message.includes('管理员')) {
    return {
      kind: 'permission',
      title: '权限不足',
      detail: '启动虚拟网卡或组网程序可能需要更高权限。',
      nextAction: '尝试以管理员身份运行联机助手，然后重新加入。',
    };
  }
  return {
    kind: 'not_ready',
    title: '加入失败',
    detail: '组网服务未能稳定启动或未读取到有效连接状态。请生成诊断报告查看详细原因。',
    nextAction: '打开诊断报告，复制错误信息给房主或管理员。',
  };
}

export function validateInviteNetworkConfig(config: NetworkConfig) {
  const missing: string[] = [];
  if (!config.supernode?.trim()) missing.push('中继地址');
  if (!config.room_name?.trim()) missing.push('房间名');
  if (!config.secret?.trim()) missing.push('房间密钥');
  if (!config.local_ip?.trim()) missing.push('我的联机地址');
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
  return `请在游戏内连接房主联机地址：${host}，端口：${port}。`;
}

function sameInviteValue(expected?: string, actual?: string | null) {
  const expectedText = (expected || '').trim().toLowerCase();
  if (!expectedText) return true;
  return (actual || '').trim().toLowerCase() === expectedText;
}

function snapshotMatchesInvite(snapshot: ReferenceRuntimeSnapshot | undefined, config: NetworkConfig) {
  if (!snapshot) return false;
  const n2n = snapshot.n2n;
  const lastConfig = snapshot.n2n_last_config;
  const supernode = n2n?.supernode || lastConfig?.supernode || '';
  const localIp = n2n?.virtual_ip || lastConfig?.local_ip || '';
  return (
    sameInviteValue(config.supernode, supernode)
    && sameInviteValue(config.local_ip, localIp)
    && sameInviteValue(config.room_name, lastConfig?.room_name || config.room_name)
    && sameInviteValue(config.secret, lastConfig?.secret || config.secret)
  );
}

export async function joinFromInvitePacket(packet: LanInvitePacket, context: InviteJoinContext = {}): Promise<InviteJoinResult> {
  const packetValidation = validateLanInvitePacket(packet);
  if (!packetValidation.ok) {
    const reason = classifyJoinFailure(`邀请包缺少：${formatLanInviteMissingFields(packetValidation.missing)}`);
    return {
      phase: 'failed',
      title: reason.title,
      detail: `${reason.detail} 缺少：${formatLanInviteMissingFields(packetValidation.missing)}。`,
      packet,
      error: `missing_fields=${packetValidation.missing.join(',')}`,
      reason,
    };
  }

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
      if (latest?.n2n?.ok_link && snapshotMatchesInvite(latest, config)) break;
    }

    const n2n = latest?.n2n;
    const matchesInvite = snapshotMatchesInvite(latest, config);
    if (n2n?.ok_link && matchesInvite) {
      return {
        phase: 'joined',
        title: '已加入好友房间',
        detail: joinSuccessDetail(packet, context),
        packet,
        latest,
      };
    }
    if (n2n?.ok_link && !matchesInvite) {
      const error = '当前连接状态与本次邀请信息不一致，可能读到了旧组网状态或配置尚未生效。';
      const reason = classifyJoinFailure(error, n2n.summary);
      return {
        phase: 'failed',
        title: '当前连接与邀请不一致',
        detail: '联机助手没有把旧连接状态当作加入成功。请先停止组网，再用这份邀请包重新保存并启动。',
        packet,
        error,
        reason,
        latest,
      };
    }
    if (n2n?.running) {
      const error = '组网程序已运行，但暂未收到联机确认。';
      const reason = classifyJoinFailure(error, n2n.summary);
      return {
        phase: 'pending',
        title: '组网已启动，但中继尚未确认',
        detail: '组网程序已运行，但暂未收到中继确认。请核对双方中继地址、房间名、密钥和联机地址；仍不行请生成诊断报告并复制手动启动命令与组网日志。',
        packet,
        error,
        reason,
        latest,
      };
    }

    const error = n2n?.last_error || latest?.errors?.[0] || n2n?.summary || '组网程序未保持运行';
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
    '[联机助手加入状态信息]',
    `结果：${result.title}`,
    `分类：${result.reason?.kind || 'unknown'}`,
    `说明：${result.detail}`,
    result.reason?.nextAction ? `建议：${result.reason.nextAction}` : '',
    result.error ? `错误：${result.error}` : '',
    `游戏：${packet?.gameName || '未知'}`,
    `房主联机地址：${packet?.hostVirtualIp || context.connectHost || '未读取'}`,
    `我的预留地址：${packet?.friendVirtualIp || context.localIp || '未读取'}`,
    `中继地址：${packet?.supernode || context.supernode || '未读取'}`,
    `房间名：${packet?.roomName || context.roomName || '未读取'}`,
    `游戏端口：${packet?.gamePort || context.gamePort || '未读取'}`,
    `当前组网状态：${context.runtimeLabel || '未读取'}`,
    context.runtimeErrors?.length ? `运行错误：${context.runtimeErrors.join('；')}` : '',
  ].filter(Boolean).join('\n');
}
