import type { ReferenceRuntimeSnapshot } from '../reference-adapter/types';
import type { NetworkConfig } from '../types/network';
import type { ServerSessionStatus } from '../types/serverSession';
import { toProductSafeMessage } from './productSafeMessage';

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

function userFacingRuntimeText(text?: string | null) {
  return toProductSafeMessage(text || '');
}

function n2nConnectionState(input: ProductStatusCenterInput) {
  return input.snapshot?.n2n?.connection_state || '';
}

function hasActiveN2nProblem(input: ProductStatusCenterInput) {
  const n2n = input.snapshot?.n2n ?? null;
  const state = n2nConnectionState(input);
  const ready = Boolean(input.network.ready || n2n?.ok_link);
  if (ready) return false;
  return Boolean(
    n2n?.auth_error ||
    n2n?.ip_mac_conflict ||
    n2n?.tap_error ||
    n2n?.not_responding ||
    n2n?.last_error ||
    ['auth_error', 'ip_mac_conflict', 'tap_error', 'supernode_not_responding', 'pid_stale_or_exited'].includes(state)
  );
}

function activeN2nProblemDetail(input: ProductStatusCenterInput) {
  const n2n = input.snapshot?.n2n ?? null;
  const state = n2nConnectionState(input);
  if (n2n?.auth_error || state === 'auth_error') {
    return '房间名或密钥不一致，中继拒绝加入；请确认双方填写完全一致。';
  }
  if (n2n?.ip_mac_conflict || state === 'ip_mac_conflict') {
    return '联机地址可能已被占用；请让每个人使用不同的联机地址后重新启动组网。';
  }
  if (n2n?.tap_error || state === 'tap_error') {
    return '虚拟网卡/组网网卡无法打开或未安装；请尝试管理员运行，并检查 TAP/Wintun 网卡。';
  }
  if (n2n?.not_responding || state === 'supernode_not_responding') {
    return '中继地址暂无响应；请核对地址和端口，确认中继服务器已启动且端口已放行，并检查当前网络是否拦截 UDP 出站。';
  }
  if (state === 'pid_stale_or_exited') {
    return '组网程序没有保持运行，可能启动后立即退出、权限不足或被安全软件拦截。';
  }
  return userFacingRuntimeText(n2n?.last_error || input.errors?.[0] || input.network.label || n2n?.summary || '检测到组网异常。');
}

function buildEvidence(input: ProductStatusCenterInput) {
  const n2n = input.snapshot?.n2n ?? null;
  return [
    input.network.label || n2n?.summary || '',
    n2n?.connection_state ? `连接状态：${n2n.connection_state}` : '',
    typeof n2n?.executable_found === 'boolean' ? `组网程序文件：${n2n.executable_found ? '已找到' : '未找到'}` : '',
    n2n?.executable_path ? `组网程序路径：${n2n.executable_path}` : '',
    typeof n2n?.recorded_pid === 'number' ? `记录 PID：${n2n.recorded_pid}` : '',
    typeof n2n?.recorded_pid_running === 'boolean' ? `PID 存活：${n2n.recorded_pid_running ? '是' : '否'}` : '',
    input.network.virtualIp ? `联机地址：${input.network.virtualIp}` : '',
    input.network.supernode ? `中继地址：${input.network.supernode}` : '',
    n2n?.log_path ? `日志路径：${n2n.log_path}` : '',
    ...(input.errors ?? []),
  ].filter(Boolean);
}

export function resolveProductStatusCenter(input: ProductStatusCenterInput): ProductStatusCenter {
  const evidence = buildEvidence(input);
  const n2n = input.snapshot?.n2n ?? null;
  const label = input.network.label || n2n?.summary || '';

  if (input.busy) {
    return {
      stage: 'starting',
      label: input.busy,
      detail: '正在执行操作，请等待当前步骤完成。',
      tone: 'warn',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer),
      nextAction: '等待操作完成后刷新状态；如果长时间无变化，请复制诊断报告和日志。',
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

  const hasRuntimeError = Boolean(input.network.hasError || input.errors?.length || hasActiveN2nProblem(input));
  if (hasRuntimeError) {
    return {
      stage: 'has_problem',
      label: '存在问题',
      detail: activeN2nProblemDetail(input),
      tone: 'danger',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer && !input.server?.running),
      nextAction: '打开诊断报告，复制完整报告或手动启动命令；核对中继地址、房间名、密钥、联机地址，查看日志后重新启动组网。',
      evidence
    };
  }

  if (!configured(input)) {
    return {
      stage: 'not_configured',
      label: '未配置',
      detail: '还没有完整的组网信息。',
      tone: 'idle',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer),
      nextAction: '先到“加入与组网”填写中继地址、房间名、密钥和本机联机地址。',
      evidence
    };
  }

  if (!input.network.running && !input.network.ready) {
    const state = n2nConnectionState(input);
    const stalePid = state === 'pid_stale_or_exited' || (typeof n2n?.recorded_pid === 'number' && n2n.recorded_pid_running === false);
    return {
      stage: 'configured_not_started',
      label: '已配置未启动',
      detail: stalePid
        ? '组网信息已保存，但上次记录的组网程序已经退出或 PID 过期。'
        : '组网信息已保存，但当前没有检测到组网程序在运行。',
      tone: 'warn',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer),
      nextAction: '点击启动组网；如果启动后仍显示未启动，请复制完整诊断报告、手动启动命令和组网日志，确认程序是否启动后退出或权限不足。',
      evidence
    };
  }

  if (input.network.running && !input.network.ready) {
    return {
      stage: 'starting',
      label: '组网程序已启动，但中继尚未确认',
      detail: label || '组网程序已启动，但还没有收到中继确认；这还不等于好友已经能游戏内加入。',
      tone: 'warn',
      canInvite: false,
      needsNetwork: true,
      needsServer: Boolean(input.requiresServer),
      nextAction: '不要只等待：请核对双方中继地址、房间名、密钥和联机地址；复制手动启动命令与组网日志，必要时用管理员权限重新运行；关闭防火墙仍失败时继续检查 UDP 出站、校园网/公司网、路由器和安全软件。',
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
      ? '组网已连接，还需要添加好友。'
      : '组网已连接，可以继续生成邀请。',
    tone: 'good',
    canInvite: !friendSlotMissing,
    needsNetwork: false,
    needsServer: false,
    nextAction: friendSlotMissing ? '先添加好友，再复制邀请包。' : '复制邀请包。',
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
