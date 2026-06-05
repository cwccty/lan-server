import type { ReferenceRuntimeSnapshot } from '../reference-adapter/types';
import type { NetworkConfig } from '../types/network';
import type { ServerSessionStatus } from '../types/serverSession';

export type ProductConnectionStage =
  | 'not_configured'
  | 'configured_not_started'
  | 'starting'
  | 'network_ready'
  | 'server_missing'
  | 'ready_to_invite'
  | 'has_problem';

export type ProductStatusTone = 'idle' | 'warn' | 'good' | 'danger';

export interface ProductStatusCenterInput {
  loaded: boolean;
  snapshot?: ReferenceRuntimeSnapshot | null;
  network: {
    running: boolean;
    ready: boolean;
    hasError: boolean;
    label?: string;
    virtualIp?: string;
    supernode?: string;
  };
  errors?: string[];
  n2nConfig?: NetworkConfig | null;
  server?: ServerSessionStatus | null;
  requiresServer?: boolean;
  hasFriendSlot?: boolean;
  busy?: string;
}

export interface ProductStatusCenter {
  stage: ProductConnectionStage;
  label: string;
  detail: string;
  tone: ProductStatusTone;
  canInvite: boolean;
  needsNetwork: boolean;
  needsServer: boolean;
  nextAction: string;
  evidence: string[];
}

function configured(input: ProductStatusCenterInput) {
  const cfg = input.n2nConfig ?? input.snapshot?.n2n_last_config ?? null;
  return Boolean(
    (cfg?.room_name && cfg?.secret && cfg?.supernode) ||
    (input.network.supernode && (input.network.virtualIp || cfg?.local_ip))
  );
}

export function resolveProductStatusCenter(input: ProductStatusCenterInput): ProductStatusCenter {
  const label = input.network.label || input.snapshot?.n2n?.summary || '';
  const evidence = [
    label,
    input.network.virtualIp ? `虚拟 IP：${input.network.virtualIp}` : '',
    input.network.supernode ? `Supernode：${input.network.supernode}` : '',
    ...(input.errors ?? [])
  ].filter(Boolean);

  if (input.busy) {
    return {
      stage: 'starting',
      label: input.busy,
      detail: '正在执行操作，请等待当前步骤完成。',
      tone: 'warn',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer),
      nextAction: '等待操作完成后刷新状态。',
      evidence
    };
  }

  if (!input.loaded) {
    return {
      stage: 'starting',
      label: '正在读取状态',
      detail: '正在读取本地组网、服务端和诊断快照。',
      tone: 'idle',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer),
      nextAction: '稍等片刻，或手动刷新状态。',
      evidence
    };
  }

  const n2n = input.snapshot?.n2n ?? null;
  const hasRuntimeError = Boolean(input.network.hasError || input.errors?.length || n2n?.auth_error || n2n?.ip_mac_conflict || n2n?.not_responding || n2n?.last_error);
  if (hasRuntimeError) {
    const problem = n2n?.auth_error ? '房间密钥或认证不通过。'
      : n2n?.ip_mac_conflict ? '虚拟 IP 或 MAC 可能已被占用。'
        : n2n?.not_responding ? 'Supernode 暂无响应。'
          : input.errors?.[0] || n2n?.last_error || label || '检测到运行异常。';
    return {
      stage: 'has_problem',
      label: '存在问题',
      detail: problem,
      tone: 'danger',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer && !input.server?.running),
      nextAction: '打开诊断报告，按建议修复后重新启动组网。',
      evidence
    };
  }

  if (!configured(input)) {
    return {
      stage: 'not_configured',
      label: '未配置',
      detail: '还没有完整的房间名、密钥或 Supernode。',
      tone: 'idle',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer),
      nextAction: '先在通用组网中心保存 n2n 参数。',
      evidence
    };
  }

  if (!input.network.running && !input.network.ready) {
    return {
      stage: 'configured_not_started',
      label: '已配置未启动',
      detail: 'n2n 参数已保存，但当前没有运行中的 edge。',
      tone: 'warn',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer),
      nextAction: '点击启动 n2n，等待 ACK/PONG 后再邀请好友。',
      evidence
    };
  }

  if (input.network.running && !input.network.ready) {
    return {
      stage: 'starting',
      label: '启动中',
      detail: label || 'edge 已启动，正在等待 Supernode 确认。',
      tone: 'warn',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer),
      nextAction: '等待 10 到 20 秒后刷新状态。',
      evidence
    };
  }

  if (input.requiresServer && !input.server?.running) {
    return {
      stage: 'server_missing',
      label: '服务端未启动',
      detail: '虚拟组网已连接，但当前游戏还需要服务端或房间进程。',
      tone: 'warn',
      canInvite: false,
      needsNetwork: false,
      needsServer: true,
      nextAction: '先启动游戏服务端，确认端口监听后再邀请好友。',
      evidence
    };
  }

  if (input.network.ready && input.hasFriendSlot) {
    return {
      stage: 'ready_to_invite',
      label: '可邀请好友',
      detail: '组网已连接，且已有好友席位可写入邀请包。',
      tone: 'good',
      canInvite: true,
      needsNetwork: false,
      needsServer: false,
      nextAction: '复制邀请包发给好友。',
      evidence
    };
  }

  const friendSlotMissing = input.hasFriendSlot === false;
  return {
    stage: 'network_ready',
    label: '已连接',
    detail: friendSlotMissing
      ? 'n2n 已收到 ACK/PONG，但还没有给好友分配虚拟 IP。'
      : 'n2n 已收到 ACK/PONG，虚拟局域网基础链路可用。',
    tone: 'good',
    canInvite: !friendSlotMissing,
    needsNetwork: false,
    needsServer: false,
    nextAction: friendSlotMissing ? '先分配好友虚拟 IP，再复制邀请包。' : '复制邀请包。',
    evidence
  };
}

export function productStatusToneClasses(tone: ProductStatusTone) {
  if (tone === 'good') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (tone === 'warn') return 'border-amber-100 bg-amber-50 text-amber-700';
  if (tone === 'danger') return 'border-rose-100 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export function productStatusDotClasses(tone: ProductStatusTone) {
  if (tone === 'good') return 'bg-emerald-500 animate-pulse';
  if (tone === 'warn') return 'bg-amber-500 animate-pulse';
  if (tone === 'danger') return 'bg-rose-500';
  return 'bg-slate-400';
}
