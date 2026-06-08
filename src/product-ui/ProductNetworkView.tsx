import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Globe,
  KeyRound,
  Play,
  RefreshCw,
  Save,
  Server,
  Square,
  Terminal,
  Wifi,
  Eye,
  EyeOff,
  LogIn
} from 'lucide-react';
import {
  readReferenceN2nLastConfig,
  refreshReferenceRuntime,
  saveReferenceN2nConfig,
  startReferenceN2n,
  stopReferenceN2n
} from '../reference-adapter/actions';
import { testConnectivity } from '../api/tauri';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';
import type { ConnectivityReport, NetworkConfig } from '../types/network';
import {
  formatLanInviteMissingFields,
  invitePacketToNetworkConfig,
  parseLanInvitePacket,
  validateLanInvitePacket,
  type LanInvitePacket
} from './invitePacket';
import {
  buildInviteJoinErrorText,
  classifyJoinFailure,
  inviteResultTone,
  joinFromInvitePacket,
  type InviteJoinResult,
} from './inviteJoinFlow';
import { buildInviteDiagnosticContext, clearInviteDiagnosticContext, writeInviteDiagnosticContext } from './inviteDiagnosticContext';
import {
  appendInviteJoinSuccessRecord,
  applyPortCheckToJoinSuccessRecord,
  buildInviteJoinSuccessRecord,
  formatInviteJoinSuccessInstruction,
  readInviteJoinSuccessHistory,
  updateInviteJoinSuccessRecord,
  type InviteJoinSuccessRecord,
} from './inviteJoinSuccess';
import { buildInviteJoinClosureAudit, formatInviteJoinClosureAuditReport } from './inviteJoinClosureAudit';
import { productStatusDotClasses, productStatusToneClasses, resolveProductStatusCenter } from './statusCenter';
import { readProductPageCache, writeProductPageCache } from './productPageCache';

import { ProductBusyOverlay } from './ProductBusyOverlay';

interface ProductNetworkViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

function buildConfig(roomName: string, roomKey: string, supernode: string, localIp: string): NetworkConfig {
  return {
    room_name: roomName.trim(),
    secret: roomKey,
    supernode: supernode.trim(),
    local_ip: localIp.trim()
  };
}

const INVITE_PENDING_AUTO_RETEST_DELAY_MS = 15000;
const NETWORK_FORM_CACHE_KEY = 'lan-helper.product.network.form.cache.v1';

const NETWORK_STUCK_USER_SOP = [
  '两台电脑都点“复制完整诊断报告”，先对照中继地址、房间名、密钥是否一致。',
  '再对照本机联机地址：两台电脑必须不同；如果相同，给其中一台换成新的 10.x 地址后重启组网。',
  '如果一台显示“已配置未启动”，重点看组网程序文件、记录 PID 是否存活、最后错误和组网日志。',
  '如果一台显示“中继尚未确认”，重点看中继地址是否能访问、房间名/密钥是否一致、组网日志里是否有拒绝或超时。',
  '如果“注册修复”无效，不要反复点击；改为复制手动启动命令，用管理员权限运行，并检查虚拟网卡和组网程序文件。',
  '如果诊断提到网卡/TAP/Wintun，请优先修复组联网卡；如果提到权限不足，请用管理员身份重新运行联机助手。',
];

interface NetworkFormCache {
  roomName: string;
  roomKey: string;
  supernode: string;
  localIp: string;
  gamePort: string;
  connectHost: string;
}

export function ProductNetworkView({ onTriggerToast, onNavigateTab }: ProductNetworkViewProps) {
  const runtime = useReferenceRuntime();
  const invitePendingRetestTimer = useRef<number | null>(null);
  const initialFormCache = useMemo(() => readProductPageCache<NetworkFormCache>(NETWORK_FORM_CACHE_KEY), []);
  const [roomName, setRoomName] = useState(() => initialFormCache?.data.roomName || 'Terraria_Night_Squad');
  const [roomKey, setRoomKey] = useState(() => initialFormCache?.data.roomKey || '');
  const [supernode, setSupernode] = useState(() => initialFormCache?.data.supernode || '');
  const [localIp, setLocalIp] = useState(() => initialFormCache?.data.localIp || '');
  const [gamePort, setGamePort] = useState(() => initialFormCache?.data.gamePort || '7777');
  const [connectHost, setConnectHost] = useState(() => initialFormCache?.data.connectHost || '');
  const [busy, setBusy] = useState('');
  const [lastConnectivity, setLastConnectivity] = useState('');
  const [showRoomKey, setShowRoomKey] = useState(false);
  const [invitePaste, setInvitePaste] = useState('');
  const [detectedInvite, setDetectedInvite] = useState<LanInvitePacket | null>(null);
  const [inviteJoinResult, setInviteJoinResult] = useState<InviteJoinResult | null>(null);
  const [invitePendingAutoRetest, setInvitePendingAutoRetest] = useState('');
  const [inviteJoinSuccessHistory, setInviteJoinSuccessHistory] = useState<InviteJoinSuccessRecord[]>(() => readInviteJoinSuccessHistory());
  const [latestInviteJoinSuccess, setLatestInviteJoinSuccess] = useState<InviteJoinSuccessRecord | null>(() => readInviteJoinSuccessHistory()[0] ?? null);
  const inviteClosureAudit = useMemo(() => buildInviteJoinClosureAudit({
    detectedInvite,
    inviteJoinResult,
    successHistory: inviteJoinSuccessHistory,
  }), [detectedInvite, inviteJoinResult, inviteJoinSuccessHistory]);
  const status = resolveProductStatusCenter({
    loaded: runtime.loaded,
    snapshot: runtime.snapshot,
    network: runtime.network,
    errors: runtime.errors,
    n2nConfig: buildConfig(roomName, roomKey, supernode, localIp),
    busy
  });

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const showBusy = !initialFormCache;
      if (showBusy) setBusy('读取最近配置');
      try {
        const result = await readReferenceN2nLastConfig();
        if (cancelled) return;
        const config = result.data as NetworkConfig | null;
        if (config) {
          if (config.room_name) setRoomName(config.room_name);
          if (config.secret) setRoomKey(config.secret);
          if (config.supernode) setSupernode(config.supernode);
          if (config.local_ip) {
            setLocalIp(config.local_ip);
            setConnectHost(config.local_ip);
          }
        }
        await refreshReferenceRuntime(false);
      } catch {
        await refreshReferenceRuntime(false).catch(() => undefined);
      } finally {
        if (!cancelled && showBusy) setBusy('');
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [initialFormCache]);

  useEffect(() => {
    writeProductPageCache<NetworkFormCache>(NETWORK_FORM_CACHE_KEY, {
      roomName,
      roomKey,
      supernode,
      localIp,
      gamePort,
      connectHost,
    });
  }, [connectHost, gamePort, localIp, roomKey, roomName, supernode]);

  useEffect(() => () => {
    if (invitePendingRetestTimer.current) {
      window.clearTimeout(invitePendingRetestTimer.current);
      invitePendingRetestTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!connectHost && runtime.network.virtualIp) setConnectHost(runtime.network.virtualIp);
    if (!localIp && runtime.network.virtualIp) setLocalIp(runtime.network.virtualIp);
    if (!supernode && runtime.network.supernode) setSupernode(runtime.network.supernode);
  }, [connectHost, localIp, runtime.network.supernode, runtime.network.virtualIp, supernode]);

  const run = async (label: string, task: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await task();
      await refreshReferenceRuntime(false);
      onTriggerToast(`${label}完成。`);
    } catch (error) {
      onTriggerToast(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const config = () => buildConfig(roomName, roomKey, supernode, localIp);

  const saveConfig = () => run('保存组网设置', () => saveReferenceN2nConfig(config()));
  const startN2n = () => run('启动组网服务', () => startReferenceN2n(config()));
  const stopN2n = () => run('停止组网服务', () => stopReferenceN2n());
  const refreshStatus = () => run('刷新节点状态', () => refreshReferenceRuntime(false));

  const currentInviteJoinContext = () => ({
    connectHost,
    localIp,
    supernode,
    roomName,
    gamePort,
    runtimeLabel: runtime.network.label || status.label,
    runtimeErrors: runtime.errors,
  });

  const persistInviteJoinDiagnosticContext = (result: InviteJoinResult) => {
    writeInviteDiagnosticContext(buildInviteDiagnosticContext(result, currentInviteJoinContext()));
  };

  const persistInviteJoinSuccess = (result: InviteJoinResult) => {
    const record = buildInviteJoinSuccessRecord(result, currentInviteJoinContext());
    const next = appendInviteJoinSuccessRecord(record);
    setLatestInviteJoinSuccess(record);
    setInviteJoinSuccessHistory(next);
    return record;
  };

  const clearPendingInviteRetest = () => {
    if (invitePendingRetestTimer.current) {
      window.clearTimeout(invitePendingRetestTimer.current);
      invitePendingRetestTimer.current = null;
    }
    setInvitePendingAutoRetest('');
  };

  const scheduleInvitePendingAutoRetest = (packet: LanInvitePacket, pendingResult: InviteJoinResult) => {
    persistInviteJoinDiagnosticContext(pendingResult);
    clearPendingInviteRetest();
    setInvitePendingAutoRetest('将在 15 秒后自动复测中继确认。');
    invitePendingRetestTimer.current = window.setTimeout(async () => {
      invitePendingRetestTimer.current = null;
      setInvitePendingAutoRetest('正在自动复测中继确认...');
      try {
        const refreshed = await refreshReferenceRuntime(false);
        const latest = refreshed.snapshot;
        const n2n = latest?.n2n;
        if (n2n?.ok_link) {
          const joinedResult: InviteJoinResult = {
            phase: 'joined',
            title: '已加入好友房间',
            detail: `自动复测已收到中继确认。请在游戏内连接房主联机地址：${packet.hostVirtualIp || connectHost || '未读取'}，端口：${packet.gamePort || gamePort || 7777}。`,
            packet,
            latest,
          };
          setInviteJoinResult(joinedResult);
          clearInviteDiagnosticContext();
          persistInviteJoinSuccess(joinedResult);
          onTriggerToast('自动复测通过：已加入好友房间。');
          return;
        }
        if (n2n?.running) {
          const stillPending: InviteJoinResult = {
            phase: 'pending',
            title: '仍在等待中继确认',
            detail: '自动复测后组网程序仍在运行，但中继还没有确认。请带等待信息进入诊断，核对中继地址、房间名、密钥和联机地址。',
            packet,
            error: n2n?.summary || latest?.errors?.[0] || 'auto_retest_pending_ack',
            latest,
          };
          setInviteJoinResult(stillPending);
          writeInviteDiagnosticContext(buildInviteDiagnosticContext(stillPending, {
            ...currentInviteJoinContext(),
            runtimeLabel: n2n?.summary || runtime.network.label || status.label,
            runtimeErrors: latest?.errors ?? runtime.errors,
          }));
          onTriggerToast('自动复测后仍未收到中继确认，请打开诊断。');
          return;
        }
        const error = n2n?.last_error || latest?.errors?.[0] || n2n?.summary || '自动复测后组网程序未保持运行';
        const reason = classifyJoinFailure(error, n2n?.summary);
        const failedResult: InviteJoinResult = {
          phase: 'failed',
          title: reason.title,
          detail: reason.detail,
          packet,
          error,
          reason,
          latest,
        };
        setInviteJoinResult(failedResult);
        writeInviteDiagnosticContext(buildInviteDiagnosticContext(failedResult, {
          ...currentInviteJoinContext(),
          runtimeLabel: n2n?.summary || runtime.network.label || status.label,
          runtimeErrors: latest?.errors ?? runtime.errors,
        }));
        onTriggerToast(`自动复测失败：${reason.title}，已准备诊断上下文。`);
      } catch (error) {
        const reason = classifyJoinFailure(error, runtime.network.label);
        const failedResult: InviteJoinResult = {
          phase: 'failed',
          title: reason.title,
          detail: reason.detail,
          packet,
          error: error instanceof Error ? error.message : String(error),
          reason,
        };
        setInviteJoinResult(failedResult);
        persistInviteJoinDiagnosticContext(failedResult);
        onTriggerToast(`自动复测失败：${reason.title}`);
      } finally {
        setInvitePendingAutoRetest('');
      }
    }, INVITE_PENDING_AUTO_RETEST_DELAY_MS);
  };

  const runStatusAction = () => {
    if (status.needsServer) {
      onNavigateTab('terraria');
      return;
    }
    if (status.needsNetwork) {
      if (status.stage === 'configured_not_started' || status.stage === 'not_configured') {
        startN2n();
        return;
      }
      refreshStatus();
      return;
    }
    onNavigateTab('protocol');
  };

  const statusActionLabel = () => {
    if (status.needsServer) return '去启动服务端';
    if (status.needsNetwork) {
      if (status.stage === 'configured_not_started' || status.stage === 'not_configured') return '启动组网';
      return '刷新状态';
    }
    return '生成邀请包';
  };

  const handleInvitePaste = (value: string) => {
    setInvitePaste(value);
    if (!value.trim()) {
      setDetectedInvite(null);
      setInviteJoinResult(null);
      clearPendingInviteRetest();
      clearInviteDiagnosticContext();
      return;
    }
    const packet = parseLanInvitePacket(value);
    setDetectedInvite(packet);
    if (packet) {
      const validation = validateLanInvitePacket(packet);
      setInviteJoinResult({
        phase: 'idle',
        title: '已识别好友邀请',
        detail: validation.ok
          ? '可以先填入参数自行检查，也可以直接保存并启动组网。'
          : `邀请包还缺少：${formatLanInviteMissingFields(validation.missing)}。建议让房主重新生成完整邀请包。`,
        packet
      });
    } else {
      setInviteJoinResult(null);
      clearPendingInviteRetest();
    }
  };

  const applyInvitePacket = (packet: LanInvitePacket) => {
    const next = invitePacketToNetworkConfig(packet);
    if (next.room_name) setRoomName(next.room_name);
    if (next.secret) setRoomKey(next.secret);
    if (next.supernode) setSupernode(next.supernode);
    if (next.local_ip) setLocalIp(next.local_ip);
    if (packet.hostVirtualIp) setConnectHost(packet.hostVirtualIp);
    if (packet.gamePort) setGamePort(String(packet.gamePort));
    return next;
  };

  const enterInvite = () => {
    if (!detectedInvite) return;
    applyInvitePacket(detectedInvite);
    const validation = validateLanInvitePacket(detectedInvite);
    setInviteJoinResult({
      phase: validation.ok ? 'filled' : 'failed',
      title: validation.ok ? '邀请参数已填入' : '邀请参数不完整',
      detail: validation.ok
        ? '请确认房间名、密钥、中继地址和你的联机地址。确认无误后可以保存并启动组网。'
        : `已尽量填入可识别参数，但邀请包缺少：${formatLanInviteMissingFields(validation.missing)}。请让房主重新生成完整邀请包。`,
      packet: detectedInvite
    });
    onTriggerToast(validation.ok ? '已填入邀请包。确认后可保存并启动组网。' : '邀请包不完整，已填入可识别参数。');
  };

  const startFromInvite = async () => {
    const packet = detectedInvite || parseLanInvitePacket(invitePaste);
    if (!packet) {
      onTriggerToast('没有检测到可加入的邀请包。');
      return;
    }
    applyInvitePacket(packet);
    const validation = validateLanInvitePacket(packet);
    if (!validation.ok) {
      const missingText = formatLanInviteMissingFields(validation.missing);
      const reason = classifyJoinFailure(`missing_fields=${validation.missing.join(',')}`);
      const failedResult: InviteJoinResult = {
        phase: 'failed',
        title: '邀请参数不完整',
        detail: `已填入可识别参数，但邀请包缺少：${missingText}。请把错误复制给房主，让房主重新生成完整邀请包。`,
        packet,
        error: `missing_fields=${validation.missing.join(',')}`,
        reason
      };
      setInviteJoinResult(failedResult);
      persistInviteJoinDiagnosticContext(failedResult);
      onTriggerToast(`邀请包不完整：${missingText}。未启动组网。`);
      return;
    }
    setBusy('保存并启动邀请');
    setInviteJoinResult({
      phase: 'joining',
      title: '正在加入好友房间',
      detail: '正在保存邀请参数并启动组网；如果 20 秒后仍未确认，请打开诊断并复制报告给房主。',
      packet
    });
    try {
      const result = await joinFromInvitePacket(packet, {
        connectHost,
        localIp,
        supernode,
        roomName,
        gamePort,
        runtimeLabel: runtime.network.label,
        runtimeErrors: runtime.errors
      });
      setInviteJoinResult(result);
      if (result.phase === 'joined') {
        persistInviteJoinSuccess(result);
        clearInviteDiagnosticContext();
        onTriggerToast('已加入好友房间。请进入游戏连接房主联机地址。');
      }
      else if (result.phase === 'pending') {
        scheduleInvitePendingAutoRetest(packet, result);
        onTriggerToast('组网已启动，正在等待中继确认；将自动复测一次。');
      }
      else if (result.phase === 'failed') {
        persistInviteJoinDiagnosticContext(result);
        onTriggerToast(`加入失败：${result.title}，已准备诊断上下文。`);
      }
    } catch (error) {
      const reason = classifyJoinFailure(error, runtime.network.label);
      const failedResult: InviteJoinResult = {
        phase: 'failed',
        title: reason.title,
        detail: reason.detail,
        packet,
        error: error instanceof Error ? error.message : String(error),
        reason
      };
      setInviteJoinResult(failedResult);
      persistInviteJoinDiagnosticContext(failedResult);
      onTriggerToast(`加入失败：${reason.title}，已准备诊断上下文。`);
    } finally {
      setBusy('');
    }
  };

  const testCurrent = () => run('联机端口检测', async () => {
    const host = connectHost.trim() || runtime.network.virtualIp || localIp;
    if (!host) throw new Error('没有可检测的联机地址。请先保存并启动组网。');
    const port = Number(gamePort) || 7777;
    const report = await testConnectivity({
      host,
      ports: [port],
      timeout_ms: 1200,
      mode: 'n2n_game_port'
    });
    setLastConnectivity(`${report.target_host}:${port} ${report.reachable ? '可连接' : '不可连接'}${report.notes.length ? `｜${report.notes.join('；')}` : ''}`);
    return report;
  });

  const testInviteHostGamePort = async (record = latestInviteJoinSuccess) => {
    if (!record) {
      onTriggerToast('暂无加入成功记录，无法检测房主游戏端口。');
      return;
    }
    setBusy('检测房主游戏端口');
    try {
      const report = await testConnectivity({
        host: record.hostVirtualIp,
        ports: [record.gamePort],
        timeout_ms: 1500,
        mode: 'n2n_game_port'
      });
      const nextRecord = applyPortCheckToJoinSuccessRecord(record, report as ConnectivityReport);
      const next = updateInviteJoinSuccessRecord(nextRecord);
      setLatestInviteJoinSuccess(nextRecord);
      setInviteJoinSuccessHistory(next);
      setLastConnectivity(nextRecord.portCheckSummary || '');
      onTriggerToast(nextRecord.portReachable ? '房主游戏端口可连接。' : '房主游戏端口暂不可连接，请确认服务端/游戏已开房。');
    } catch (error) {
      onTriggerToast(`检测房主游戏端口失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copyTextToClipboard = async (text: string, successMessage: string) => {
    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
    await clipboard.writeText(text);
    onTriggerToast(successMessage);
  };

  const buildNetworkDiagnosticReportText = () => {
    const n2n = runtime.snapshot?.n2n;
    const recentLogs = n2n?.recent_logs?.length ? n2n.recent_logs.join('\n') : '暂无最近日志';
    return [
      '联机助手组网诊断报告',
      `生成时间：${new Date().toLocaleString()}`,
      `页面结论：${status.label}`,
      `说明：${status.detail}`,
      `建议动作：${status.nextAction}`,
      `程序是否运行：${runtime.network.running ? '是' : '否'}`,
      `中继是否确认：${runtime.network.ready ? '是' : '否'}`,
      `组网程序文件：${n2n?.executable_found === false ? '未找到' : n2n?.executable_found === true ? '已找到' : '未读取'}`,
      `组网程序路径：${n2n?.executable_path || '未读取'}`,
      `记录 PID：${n2n?.recorded_pid ?? '无'}`,
      `记录 PID 是否存活：${n2n?.recorded_pid_running === true ? '是' : n2n?.recorded_pid_running === false ? '否' : '未读取'}`,
      `连接状态：${n2n?.connection_state || '未读取'}`,
      `ACK：${n2n?.ack ? '是' : '否'} / PONG：${n2n?.pong ? '是' : '否'}`,
      `中继地址：${n2n?.supernode || supernode || runtime.network.supernode || '未配置'}`,
      `房间名：${roomName || '未填写'}`,
      `本机联机地址：${n2n?.virtual_ip || runtime.network.virtualIp || localIp || '未读取到'}`,
      `游戏端口：${gamePort || '未填写'}`,
      `最后错误：${n2n?.last_error || runtime.errors[0] || '无'}`,
      `日志路径：${n2n?.log_path || '未读取'}`,
      `手动启动命令：${n2n?.manual_start_command || '未生成'}`,
      '关闭防火墙仍失败时也要继续检查：UDP 出站、路由器/校园网/公司网、运营商网络和安全软件仍可能拦截。',
      '两台电脑对照步骤：',
      ...NETWORK_STUCK_USER_SOP.map((item, index) => `${index + 1}. ${item}`),
      '最近组网日志：',
      recentLogs,
    ].join('\n');
  };

  const copyFullDiagnosticReport = async () => {
    try {
      await copyTextToClipboard(buildNetworkDiagnosticReportText(), '已复制完整组网诊断报告，请发给房主或开发者。');
    } catch (error) {
      onTriggerToast(`复制诊断报告失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyManualStartCommand = async () => {
    const command = runtime.snapshot?.n2n?.manual_start_command;
    if (!command) {
      onTriggerToast('当前还没有手动启动命令。请先保存组网设置，再刷新状态。');
      return;
    }
    try {
      await copyTextToClipboard(command, '已复制手动启动命令。');
    } catch (error) {
      onTriggerToast(`复制手动启动命令失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyEdgeLogs = async () => {
    const n2n = runtime.snapshot?.n2n;
    const text = n2n?.recent_logs?.length
      ? [`日志路径：${n2n.log_path || '未读取'}`, '最近组网日志：', ...n2n.recent_logs].join('\n')
      : '';
    if (!text) {
      onTriggerToast('当前没有读取到组网日志。请先启动组网并刷新状态。');
      return;
    }
    try {
      await copyTextToClipboard(text, '已复制最近组网日志。');
    } catch (error) {
      onTriggerToast(`复制组网日志失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copySummary = async () => {
    const text = [
      '联机助手组网配置摘要',
      `房间名：${roomName || '未填写'}`,
      `中继地址：${supernode || runtime.network.supernode || '未配置'}`,
      `本机联机地址：${runtime.network.virtualIp || localIp || '未读取到'}`,
      `游戏端口：${gamePort || '未填写'}`,
      `状态：${status.label}`,
      '提醒：好友需要使用同一房间名、密钥和中继地址，并连接房主联机地址。'
    ].join('\n');
    try {
      await copyTextToClipboard(text, '已复制组网配置摘要。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyInviteJoinError = async () => {
    if (!inviteJoinResult) return;
    const text = buildInviteJoinErrorText(inviteJoinResult, {
      connectHost,
      localIp,
      supernode,
      roomName,
      gamePort,
      runtimeLabel: runtime.network.label || status.label,
      runtimeErrors: runtime.errors
    });
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(text);
      onTriggerToast('已复制加入失败信息，可发给房主或管理员。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyInviteGameConnectInstruction = async (record = latestInviteJoinSuccess) => {
    if (!record) {
      onTriggerToast('暂无加入成功记录，无法复制游戏内连接说明。');
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatInviteJoinSuccessInstruction(record));
      onTriggerToast('游戏内连接说明已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyInviteClosureAudit = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatInviteJoinClosureAuditReport({
        detectedInvite,
        inviteJoinResult,
        successHistory: inviteJoinSuccessHistory,
      }));
      onTriggerToast('邀请加入闭环自检已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openInviteJoinDiagnostics = () => {
    if (inviteJoinResult?.phase === 'failed' || inviteJoinResult?.phase === 'pending') {
      persistInviteJoinDiagnosticContext(inviteJoinResult);
      onTriggerToast(inviteJoinResult.phase === 'pending' ? '已把邀请等待中继确认的信息带入诊断页。' : '已把邀请加入失败信息带入诊断页。');
    }
    onNavigateTab('diagnostics');
  };

  const logs = runtime.snapshot?.n2n?.recent_logs?.slice(-10) ?? [];

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="network">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在读取配置、启动/停止组网或检测端口；完成前请不要重复点击组网按钮。" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">通用组网中心</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            配置联机房间，启动或停止组网服务，并查看当前连接状态。
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${productStatusToneClasses(status.tone)}`}>
          <span className={`h-2 w-2 rounded-full ${productStatusDotClasses(status.tone)}`} />
          {`真实状态：${status.label}`}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">组网基础参数</h3>
              <p className="mt-1 text-xs text-slate-500">这些参数会写入本地配置，启动时由组网程序使用。</p>
            </div>
            <button onClick={copySummary} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
              <Copy className="h-4 w-4" />
              复制摘要
            </button>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[150px_1fr] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{status.label}</p>
                  <p className="mt-1 text-xs text-slate-500">当前步骤</p>
                </div>
                <p className="min-w-0 break-words text-xs leading-relaxed text-slate-600">{status.detail}</p>
              </div>
              <button
                onClick={runStatusAction}
                disabled={Boolean(busy)}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {statusActionLabel()}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              房间名
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="共同约定的英文/数字房间名" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              房间密钥
              <div className="mt-1 flex rounded-xl border border-slate-200 bg-slate-50 focus-within:border-amber-400">
                <input value={roomKey} onChange={(event) => setRoomKey(event.target.value)} type={showRoomKey ? 'text' : 'password'} placeholder="通信授权密码" className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3 py-2 text-sm text-slate-800 outline-none" />
                <button
                  type="button"
                  onClick={() => setShowRoomKey((value) => !value)}
                  className="inline-flex items-center justify-center rounded-r-xl px-3 text-slate-400 hover:bg-white hover:text-slate-700"
                  title={showRoomKey ? '隐藏房间密钥' : '显示房间密钥'}
                >
                  {showRoomKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
              中继地址
              <input value={supernode} onChange={(event) => setSupernode(event.target.value)} placeholder="例如：中继地址:7777" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-amber-400" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              本机联机地址
              <input value={localIp} onChange={(event) => setLocalIp(event.target.value)} placeholder="例如：10.10.10.2，留空可让程序自动处理" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-amber-400" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              游戏端口
              <input value={gamePort} onChange={(event) => setGamePort(event.target.value)} placeholder="如 7777" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-amber-400" />
            </label>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <button onClick={saveConfig} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <Save className="h-4 w-4" />
              保存基础参数
            </button>
            <button onClick={startN2n} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
              <Play className="h-4 w-4" />
              启动组网
            </button>
            <button onClick={stopN2n} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-100 px-3 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
              <Square className="h-4 w-4" />
              停止组网
            </button>
            <button onClick={refreshStatus} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${busy === '刷新节点状态' ? 'animate-spin' : ''}`} />
              刷新状态
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">连接准备清单</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  房主保存并启动组网；好友粘贴邀请包后，一键加入同一个联机房间。
                </p>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-[11px] font-bold ${productStatusToneClasses(status.tone)}`}>
                {status.label}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white bg-white p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Globe className="h-4 w-4 text-amber-600" />
                  中继地址
                </div>
                <p className="break-words font-mono text-xs text-slate-700">{supernode || runtime.network.supernode || '未填写'}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">负责让异地玩家找到同一个虚拟房间。</p>
              </div>

              <div className="rounded-xl border border-white bg-white p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800">
                  <KeyRound className="h-4 w-4 text-amber-600" />
                  房间凭证
                </div>
                <p className="break-words font-mono text-xs text-slate-700">{roomName || '未填写'} / {roomKey ? '密钥已填写' : '密钥未填写'}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">房主和好友必须使用同一房间名与密钥。</p>
              </div>

              <div className="rounded-xl border border-white bg-white p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Wifi className="h-4 w-4 text-amber-600" />
                  游戏连接
                </div>
                <p className="break-words font-mono text-xs text-slate-700">{localIp || runtime.network.virtualIp || '未分配'} : {gamePort || '未填写'}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">好友在游戏内连接房主联机地址和端口。</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex h-full flex-col gap-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Activity className="h-4 w-4 text-amber-600" />
              组网排查状态
            </h3>
            <div className="space-y-3 text-xs text-slate-600">
              <p>运行：{runtime.network.running ? '是' : '否'}</p>
              <p>中继确认：{runtime.network.ready ? '通过' : '未通过'}</p>
              <p>联机地址：<span className="font-mono">{runtime.network.virtualIp || localIp || '-'}</span></p>
              <p>中继地址：<span className="font-mono">{runtime.network.supernode || supernode || '-'}</span></p>
              <p>组网程序文件：{runtime.snapshot?.n2n?.executable_found === false ? '未找到' : runtime.snapshot?.n2n?.executable_found === true ? '已找到' : '未读取'}</p>
              <p>组网程序路径：<span className="break-all font-mono">{runtime.snapshot?.n2n?.executable_path || '-'}</span></p>
              <p>记录 PID：<span className="font-mono">{runtime.snapshot?.n2n?.recorded_pid ?? '-'}</span> / 存活：{runtime.snapshot?.n2n?.recorded_pid_running === true ? '是' : runtime.snapshot?.n2n?.recorded_pid_running === false ? '否' : '未读取'}</p>
              <p>ACK/PONG：{runtime.snapshot?.n2n?.ack ? 'ACK 已收到' : 'ACK 未收到'} / {runtime.snapshot?.n2n?.pong ? 'PONG 已收到' : 'PONG 未收到'}</p>
              <p>日志路径：<span className="break-all font-mono">{runtime.snapshot?.n2n?.log_path || '-'}</span></p>
              <p>摘要：{runtime.network.label || '暂无状态摘要'}</p>
            </div>
            {runtime.network.hasError || runtime.errors.length ? (
              <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                <div className="mb-1 flex items-center gap-1 font-bold"><AlertCircle className="h-4 w-4" />需要诊断</div>
                {(runtime.errors[0] || runtime.network.label || '组网状态异常，请查看诊断报告。')}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
                <div className="flex items-center gap-1 font-bold"><CheckCircle2 className="h-4 w-4" />状态已读取</div>
              </div>
            )}
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 p-3" data-network-user-diagnostic-actions="visible" data-network-n2n-diagnostic-closure="actions">
              <p className="text-[11px] font-bold text-amber-900">如果一直卡住，请不要只等待</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                先让双方核对中继地址、房间名、密钥和联机地址；关闭防火墙仍失败时，还要检查 UDP 出站、路由器/校园网/公司网和安全软件。仍不行就复制下面三项发给房主或开发者。
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-amber-900" data-network-stuck-two-machine-sop="visible">
                <li>两台电脑都复制完整诊断报告，先确认中继地址、房间名、密钥完全一致。</li>
                <li>再确认两台电脑的联机地址不同；如果重复，给其中一台换一个 10.x 地址后重新启动组网。</li>
                <li>显示“已配置未启动”时，看组网程序文件、PID、最后错误；显示“中继尚未确认”时，看中继地址和组网日志。</li>
                <li>如果“注册修复”无效，请复制手动启动命令，用管理员权限运行，并检查虚拟网卡和组网程序文件。</li>
              </ol>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <button onClick={copyFullDiagnosticReport} className="rounded-lg bg-white/85 px-2 py-2 text-[11px] font-bold text-amber-800 ring-1 ring-amber-100 hover:bg-white">
                  复制完整诊断报告
                </button>
                <button onClick={copyManualStartCommand} className="rounded-lg bg-white/85 px-2 py-2 text-[11px] font-bold text-amber-800 ring-1 ring-amber-100 hover:bg-white">
                  复制手动启动命令
                </button>
                <button onClick={copyEdgeLogs} className="rounded-lg bg-white/85 px-2 py-2 text-[11px] font-bold text-amber-800 ring-1 ring-amber-100 hover:bg-white">
                  复制组网日志
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Terminal className="h-4 w-4 text-amber-600" />
              联机端口检测
            </h3>
            <div className="space-y-3">
              <input value={connectHost} onChange={(event) => setConnectHost(event.target.value)} placeholder="目标联机地址，默认本机/房主联机地址" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
              <button onClick={testCurrent} disabled={Boolean(busy)} className="w-full rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60">
                检测游戏端口
              </button>
              {lastConnectivity ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{lastConnectivity}</p> : null}
            </div>
          </div>

          <div className="flex flex-1 flex-col rounded-2xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm">
            <div className="mb-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <LogIn className="h-4 w-4 text-amber-600" />
                粘贴好友邀请包
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                把房主发来的邀请包粘贴到这里，不需要手动理解房间名和密钥。
              </p>
            </div>
            <textarea
              value={invitePaste}
              onChange={(event) => handleInvitePaste(event.target.value)}
              placeholder="粘贴 [联机助手真实邀请包] ..."
              className="min-h-44 w-full flex-1 resize-y rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700 outline-none focus:border-amber-400"
            />
            {detectedInvite ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
                <div className="space-y-3">
                  <div className="min-w-0 text-xs text-slate-600">
                    <p className="font-bold text-slate-800">检测到其他玩家的邀请，是否进入？</p>
                    <p className="mt-1 break-words leading-relaxed">
                      {detectedInvite.gameName || '未知游戏'}<br />
                      房主：{detectedInvite.hostVirtualIp || '-'}｜你的 IP：{detectedInvite.friendVirtualIp || '-'}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { setInvitePaste(''); setDetectedInvite(null); setInviteJoinResult(null); clearPendingInviteRetest(); clearInviteDiagnosticContext(); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">取消</button>
                    <button onClick={enterInvite} disabled={Boolean(busy)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">仅填入参数</button>
                    <button onClick={startFromInvite} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                      {busy === '保存并启动邀请' ? '加入中...' : '保存并启动组网'}
                    </button>
                  </div>
                </div>
              </div>
            ) : invitePaste.trim() ? (
              <p className="mt-2 rounded-xl bg-white/70 p-2 text-xs leading-relaxed text-amber-700">
                没有识别到联机助手邀请包，请确认内容包含“[联机助手真实邀请包]”。
              </p>
            ) : null}
            {inviteJoinResult ? (
              <div className={`mt-3 rounded-xl border p-3 text-xs ${inviteResultTone(inviteJoinResult.phase)}`}>
                <div className="flex items-start gap-2">
                  {inviteJoinResult.phase === 'joined' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : inviteJoinResult.phase === 'failed' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <RefreshCw className={`mt-0.5 h-4 w-4 shrink-0 ${inviteJoinResult.phase === 'joining' ? 'animate-spin' : ''}`} />}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{inviteJoinResult.title}</p>
                    <p className="mt-1 break-words leading-relaxed">{inviteJoinResult.detail}</p>
                    {inviteJoinResult.packet?.hostVirtualIp ? (
                      <p className="mt-2 rounded-lg bg-white/70 p-2 font-mono text-[11px]">
                        房主 {inviteJoinResult.packet.hostVirtualIp}:{inviteJoinResult.packet.gamePort || gamePort || 7777}
                      </p>
                    ) : null}
                  </div>
                </div>
                {inviteJoinResult.phase === 'joined' ? (
                  <div className="mt-3 rounded-lg bg-white/70 p-3" data-invite-joined-game-confirmation="latest">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">组网已确认</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">下一步确认游戏端口</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-emerald-800">
                      这只证明你已进入同一个联机房间。若游戏仍进不去，请先检测房主游戏端口是否可达。
                    </p>
                    {latestInviteJoinSuccess?.portCheckSummary ? (
                      <p className={`mt-2 rounded-lg p-2 text-[11px] font-semibold ${
                        latestInviteJoinSuccess.portReachable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {latestInviteJoinSuccess.portCheckSummary}
                        {latestInviteJoinSuccess.portCheckNotes.length ? `｜${latestInviteJoinSuccess.portCheckNotes.join('；')}` : ''}
                      </p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => testInviteHostGamePort()} disabled={Boolean(busy)} className="rounded-lg bg-white/85 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 hover:bg-white disabled:opacity-60">
                        检测房主游戏端口
                      </button>
                      <button onClick={() => copyInviteGameConnectInstruction()} className="rounded-lg bg-white/85 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 hover:bg-white">
                        复制游戏内连接说明
                      </button>
                    </div>
                  </div>
                ) : inviteJoinResult.phase === 'failed' ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={openInviteJoinDiagnostics} className="rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-100 hover:bg-white">
                      带失败信息诊断
                    </button>
                    <button onClick={copyInviteJoinError} className="rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-100 hover:bg-white">
                      复制错误给房主
                    </button>
                  </div>
                ) : inviteJoinResult.phase === 'pending' ? (
                  <>
                    {invitePendingAutoRetest ? (
                      <p className="mt-3 rounded-lg bg-white/70 p-2 text-[11px] font-semibold text-amber-700" data-invite-pending-auto-retest="status">
                        自动复测：{invitePendingAutoRetest}
                      </p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={refreshStatus} disabled={Boolean(busy)} className="rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-100 hover:bg-white disabled:opacity-60">
                        手动刷新状态
                      </button>
                      <button onClick={openInviteJoinDiagnostics} className="rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-100 hover:bg-white">
                        带等待信息诊断
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {inviteJoinSuccessHistory.length ? (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-white/80 p-3" data-invite-join-success-history="recent">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800">最近加入成功记录</p>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    {inviteJoinSuccessHistory.length} 条
                  </span>
                </div>
                <div className="space-y-2">
                  {inviteJoinSuccessHistory.slice(0, 3).map((record) => (
                    <div key={record.id} className="rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-bold text-slate-800">{record.gameName}</span>
                        <span className="font-mono">{record.hostVirtualIp}:{record.gamePort}</span>
                      </div>
                      <p className="mt-1">
                        {record.portCheckSummary || '尚未检测游戏端口'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-3 rounded-xl border border-slate-100 bg-white/85 p-3" data-invite-join-closure-audit="checklist">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">邀请加入闭环自检</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{inviteClosureAudit.summary}</p>
                </div>
                <button onClick={copyInviteClosureAudit} className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                  复制自检
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                  <p className="font-bold text-slate-800">能力项</p>
                  <p className="mt-1 font-mono">{inviteClosureAudit.wiredCount} 项</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                  <p className="font-bold text-slate-800">本次观察</p>
                  <p className="mt-1 font-mono">{inviteClosureAudit.observedCount} 项</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {inviteClosureAudit.items.slice(0, 6).map((item) => (
                  <span key={item.id} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    item.status === 'observed' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Globe className="h-4 w-4 text-amber-600" />
            组网与高级工具关系
          </h3>
          <p className="text-sm leading-relaxed text-slate-500">
            通用组网中心负责建立基础联机房间。若游戏需要端口转发、UDP 单播或局域网大厅广播发现，再进入高级连接工具补充 TCP/UDP/广播桥。
          </p>
          <button onClick={() => onNavigateTab('advanced_tools')} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
            打开高级连接工具
          </button>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-950 p-5 text-white shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-200">
            <Server className="h-4 w-4" />
            组网最近日志
          </h3>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
            {(logs.length ? logs : ['暂无组网日志。启动或刷新后会显示后端最近输出。']).join('\n')}
          </pre>
        </section>
      </div>
    </div>
  );
}
