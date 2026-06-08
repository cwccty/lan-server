import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  Compass,
  Play,
  RefreshCw,
  Server,
  Square,
  Terminal,
  Trash2,
  Waves
} from 'lucide-react';
import {
  refreshReferenceRuntime,
  selfTestReferenceAdvancedProxy,
  startReferenceAdvancedProxy,
  startReferenceGenericServer
} from '../reference-adapter/actions';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';
import { toProductSafeMessage } from './productSafeMessage';
import {
  sendServerCommand,
  getSteamRelayStatus,
  getSteamP2pSessionStatus,
  startConnectToolHelper,
  startSteamP2pGuest,
  startSteamP2pHost,
  stopConnectToolHelper,
  stopSteamP2pSession,
  type SteamP2pSessionStatus,
  type SteamRelayStatus,
  stopPortProxy,
  stopServerSession,
  stopUdpBroadcastBridge,
  stopUdpProxy
} from '../api/tauri';
import type { ReferenceAdvancedProxyKind } from '../reference-adapter/actions';
import {
  buildConnectionMethodGuide,
  connectionMethodCatalog,
  type ConnectionMethodEntry,
} from './connectionMethodCatalog';
import {
  buildConnectionCapabilityMatrixGuide,
  connectionCapabilityMatrix,
  type ConnectionCapabilityDecisionRow,
} from './connectionCapabilityMatrix';
import {
  ADVANCED_TOOL_INTENT_UPDATED_EVENT,
  clearAdvancedToolIntent,
  connectionCardFromAdvancedToolIntent,
  readAdvancedToolIntent,
  type AdvancedConnectionCardId,
  type AdvancedToolIntent,
} from './advancedToolIntent';
import {
  ADAPTER_CATEGORY_ROUTE_ANCHOR_EVENT,
  consumeAdapterCategoryRouteAnchor,
  scrollToAdapterCategoryRouteAnchor,
} from './adapterCategoryRoute';
import {
  buildConnectionMethodClosureAudit,
  formatConnectionMethodClosureAuditReport,
} from './connectionMethodClosureAudit';

import { ProductBusyOverlay } from './ProductBusyOverlay';

interface ProductAdvancedToolsViewProps {
  onTriggerToast: (msg: string) => void;
}

type ToolKind = ReferenceAdvancedProxyKind;
interface AdvancedToolRiskCheck {
  id: string;
  level: 'ok' | 'warn' | 'danger';
  label: string;
  detail: string;
}

interface AdvancedToolSelfTestRecap {
  id: string;
  kind: ToolKind;
  label: string;
  ok: boolean;
  summary: string;
  params: string;
  notes: string[];
  generatedAt: string;
}

const DIAGNOSTIC_FIX_HISTORY_KEY = 'lan-helper.referenceDiagnosticFixHistory';
const DIAGNOSTIC_FIX_HISTORY_UPDATED_EVENT = 'lan-helper:diagnostic-fix-history-updated';

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function lastLines(lines: string[] = [], count = 4) {
  return lines.slice(-count);
}

function methodStatusTone(status: ConnectionMethodEntry['status']) {
  if (status === '已接入') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (status === '引导') return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-slate-100 bg-slate-50 text-slate-600';
}

function riskTone(level: AdvancedToolRiskCheck['level']) {
  if (level === 'ok') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (level === 'danger') return 'border-rose-100 bg-rose-50 text-rose-700';
  return 'border-amber-100 bg-amber-50 text-amber-700';
}

function buildAdvancedToolRiskChecks(input: {
  kind: ToolKind;
  listenPort: string;
  targetHost: string;
  targetPort: string;
  intent?: AdvancedToolIntent | null;
}): AdvancedToolRiskCheck[] {
  const listen = Number(input.listenPort);
  const target = Number(input.targetPort);
  const host = input.targetHost.trim();
  const checks: AdvancedToolRiskCheck[] = [];

  checks.push(Number.isFinite(listen) && listen > 0 && listen <= 65535
    ? { id: 'listen-port-ok', level: 'ok', label: '监听端口有效', detail: `本地监听端口 ${Math.round(listen)} 可用于创建链路。` }
    : { id: 'listen-port-invalid', level: 'danger', label: '监听端口无效', detail: '监听端口必须是 1-65535 的数字，否则无法启动代理/广播桥。' });

  checks.push(Number.isFinite(target) && target > 0 && target <= 65535
    ? { id: 'target-port-ok', level: 'ok', label: '目标端口有效', detail: `目标端口 ${Math.round(target)} 已填写。` }
    : { id: 'target-port-invalid', level: input.kind === 'bridge' ? 'warn' : 'danger', label: '目标端口需确认', detail: '端口代理需要明确目标端口；广播桥未填时通常沿用监听端口。' });

  if (!host) {
    checks.push({ id: 'target-host-missing', level: 'danger', label: '目标地址缺失', detail: '必须填写好友/房主联机地址或广播转发目标。' });
  } else if (host === '127.0.0.1' || host.toLowerCase() === 'localhost') {
    checks.push({ id: 'target-host-localhost', level: 'warn', label: '目标是本机地址', detail: '诊断预填通常应指向好友/房主联机地址；localhost 只适合本机测试。' });
  } else if (!/^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(host) && !host.includes(':')) {
    checks.push({ id: 'target-host-format', level: 'warn', label: '目标格式需人工确认', detail: '目标不是常见 IPv4/host:port 格式，请确认广播桥或代理能解析该地址。' });
  } else {
    checks.push({ id: 'target-host-ok', level: 'ok', label: '目标地址已填写', detail: `目标地址：${host}` });
  }

  if (input.kind === 'bridge') {
    checks.push({
      id: 'bridge-intent',
      level: input.intent?.reason === 'udp_broadcast_bridge' ? 'ok' : 'warn',
      label: '广播桥用途',
      detail: input.intent?.reason === 'udp_broadcast_bridge'
        ? '来自诊断的 UDP 广播发现路线，启动后会自动检查广播桥。'
        : '广播桥只解决 LAN 大厅发现，不等于游戏端口已经可连接。',
    });
  } else {
    checks.push({
      id: 'proxy-intent',
      level: input.intent?.reason === 'port_proxy' ? 'ok' : 'warn',
      label: '端口代理用途',
      detail: input.intent?.reason === 'port_proxy'
        ? '来自诊断的端口代理路线，启动后会自动检查代理。'
        : '请确认该游戏确实需要端口代理；如果只是普通局域网/IP 直连，优先回到开房向导。',
    });
  }

  if (listen > 0 && listen < 1024) {
    checks.push({ id: 'privileged-port', level: 'warn', label: '低位端口可能需要权限', detail: '低于 1024 的端口可能被系统或权限策略限制。' });
  }

  return checks;
}

function summarizeSelfTestData(data: unknown) {
  if (!data || typeof data !== 'object') return { ok: true, notes: [] as string[], detail: '检查已完成。' };
  const record = data as Partial<{
    ok: boolean;
    listen: string;
    target: string;
    forward_targets: string[];
    sent: string;
    received: string;
    notes: string[];
  }>;
  const target = record.target || record.forward_targets?.join(', ') || '-';
  return {
    ok: record.ok !== false,
    notes: record.notes ?? [],
    detail: `listen=${record.listen || '-'} target=${target} sent=${record.sent || '-'} received=${record.received || '-'}`,
  };
}

function appendDiagnosticFixHistoryFromAdvancedTool(recap: AdvancedToolSelfTestRecap, targetLabel: string, gameId?: string) {
  try {
    const raw = window.localStorage.getItem(DIAGNOSTIC_FIX_HISTORY_KEY);
    const previous = raw ? JSON.parse(raw) : [];
    const history = Array.isArray(previous) ? previous : [];
    const entry = {
      id: recap.id,
      targetLabel,
      targetGameId: gameId,
      actionLabel: recap.label,
      actionMessage: recap.summary,
      beforeIssueCount: 0,
      afterIssueCount: recap.ok ? 0 : 1,
      beforeRequiredPassed: 0,
      afterRequiredPassed: recap.ok ? 1 : 0,
      requiredTotal: 1,
      resolvedIssueIds: recap.ok ? ['advanced_tool_self_test'] : [],
      newIssueIds: recap.ok ? [] : ['advanced_tool_self_test_failed'],
      remainingIssueIds: recap.ok ? [] : ['advanced_tool_self_test_failed'],
      beforeIssueIds: [],
      afterIssueIds: recap.ok ? [] : ['advanced_tool_self_test_failed'],
      reportSummary: recap.summary,
      summary: `${recap.ok ? '高级工具检查通过' : '高级工具检查失败'}：${recap.params}`,
      generatedAt: recap.generatedAt,
    };
    window.localStorage.setItem(DIAGNOSTIC_FIX_HISTORY_KEY, JSON.stringify([entry, ...history].slice(0, 12)));
    window.dispatchEvent(new CustomEvent(DIAGNOSTIC_FIX_HISTORY_UPDATED_EVENT));
  } catch {
    // 诊断历史只是辅助记录，写入失败不应阻止高级工具运行。
  }
}

export function ProductAdvancedToolsView({ onTriggerToast }: ProductAdvancedToolsViewProps) {
  const runtime = useReferenceRuntime();
  const [kind, setKind] = useState<ToolKind>('tcp');
  const [listenPort, setListenPort] = useState('27015');
  const [targetHost, setTargetHost] = useState('10.0.8.2');
  const [targetPort, setTargetPort] = useState('27015');
  const [serverName, setServerName] = useState('通用游戏服务端');
  const [serverPath, setServerPath] = useState('');
  const [serverPort, setServerPort] = useState('7777');
  const [serverCommand, setServerCommand] = useState('');
  const [busy, setBusy] = useState('');
  const [selectedDecisionId, setSelectedDecisionId] = useState(connectionCapabilityMatrix[0]?.id ?? '');
  const [advancedToolIntent, setAdvancedToolIntent] = useState<AdvancedToolIntent | null>(() => readAdvancedToolIntent());
  const [advancedToolIntentApplied, setAdvancedToolIntentApplied] = useState(false);
  const [advancedToolSelfTestRecap, setAdvancedToolSelfTestRecap] = useState<AdvancedToolSelfTestRecap | null>(null);
  const [connectToolDir, setConnectToolDir] = useState('');
  const [steamRelayStatus, setSteamRelayStatus] = useState<SteamRelayStatus | null>(null);
  const [steamP2pSession, setSteamP2pSession] = useState<SteamP2pSessionStatus | null>(null);
  const [steamRelayBusy, setSteamRelayBusy] = useState(false);
  const [steamHostId, setSteamHostId] = useState('');
  const [steamVirtualPort, setSteamVirtualPort] = useState('8211');
  const [steamTargetHost, setSteamTargetHost] = useState('127.0.0.1');
  const [steamTargetPort, setSteamTargetPort] = useState('8211');
  const [steamGuestLocalPort, setSteamGuestLocalPort] = useState('8211');
  const [steamAppId, setSteamAppId] = useState('');
  const [bridgeChoicePending, setBridgeChoicePending] = useState(false);
  const [activeConnectionCard, setActiveConnectionCard] = useState<AdvancedConnectionCardId | null>(() => (
    connectionCardFromAdvancedToolIntent(readAdvancedToolIntent()) ?? null
  ));

  useEffect(() => {
    refreshReferenceRuntime(false).catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleAdvancedToolIntentUpdated = () => {
      setAdvancedToolIntent(readAdvancedToolIntent());
      setAdvancedToolIntentApplied(false);
    };
    window.addEventListener(ADVANCED_TOOL_INTENT_UPDATED_EVENT, handleAdvancedToolIntentUpdated);
    return () => window.removeEventListener(ADVANCED_TOOL_INTENT_UPDATED_EVENT, handleAdvancedToolIntentUpdated);
  }, []);

  const refreshSteamRelayStatus = async () => {
    setSteamRelayBusy(true);
    try {
      setSteamRelayStatus(await getSteamRelayStatus(connectToolDir));
    } catch (error) {
      onTriggerToast(`读取 Steam 中继状态失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSteamRelayBusy(false);
    }
  };

  useEffect(() => {
    refreshSteamRelayStatus().catch(() => undefined);
    getSteamP2pSessionStatus().then(setSteamP2pSession).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scrollToPendingAnchor = (selector: string | null | undefined) => {
      scrollToAdapterCategoryRouteAnchor(selector, 180);
    };
    scrollToPendingAnchor(consumeAdapterCategoryRouteAnchor());
    const onAnchorUpdated = (event: Event) => {
      const selector = (event as CustomEvent<{ selector?: string }>).detail?.selector;
      scrollToPendingAnchor(selector);
    };
    window.addEventListener(ADAPTER_CATEGORY_ROUTE_ANCHOR_EVENT, onAnchorUpdated);
    return () => window.removeEventListener(ADAPTER_CATEGORY_ROUTE_ANCHOR_EVENT, onAnchorUpdated);
  }, []);

  const startConnectTool = async () => {
    setSteamRelayBusy(true);
    try {
      setSteamRelayStatus(await startConnectToolHelper(connectToolDir));
      onTriggerToast('已启动 ConnectTool helper，请在 helper 窗口里创建或加入房间。');
    } catch (error) {
      onTriggerToast(`启动 ConnectTool helper 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSteamRelayBusy(false);
    }
  };

  const stopConnectTool = async () => {
    setSteamRelayBusy(true);
    try {
      setSteamRelayStatus(await stopConnectToolHelper(connectToolDir));
      onTriggerToast('已尝试停止 ConnectTool helper。');
    } catch (error) {
      onTriggerToast(`停止 ConnectTool helper 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSteamRelayBusy(false);
    }
  };

  const parseSteamPort = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535) return parsed;
    return fallback;
  };

  const startSteamHostProfile = async () => {
    setSteamRelayBusy(true);
    try {
      const session = await startSteamP2pHost({
        host_steam_id: steamHostId.trim() || '待填写房主 Steam ID',
        virtual_port: parseSteamPort(steamVirtualPort, 8211),
        target_host: steamTargetHost.trim() || '127.0.0.1',
        target_port: parseSteamPort(steamTargetPort, 8211),
        app_id: steamAppId.trim() || null,
        connecttool_dir: connectToolDir.trim() || null,
      });
      setSteamP2pSession(session);
      setSteamRelayStatus(session.status);
      onTriggerToast('已生成房主配置，请在 helper 中按相同端口创建房间。');
    } catch (error) {
      onTriggerToast(`生成房主配置失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSteamRelayBusy(false);
    }
  };

  const startSteamGuestProfile = async () => {
    setSteamRelayBusy(true);
    try {
      const session = await startSteamP2pGuest({
        host_steam_id: steamHostId.trim() || '待填写房主 Steam ID',
        virtual_port: parseSteamPort(steamVirtualPort, 8211),
        guest_local_port: parseSteamPort(steamGuestLocalPort, parseSteamPort(steamVirtualPort, 8211)),
        app_id: steamAppId.trim() || null,
        connecttool_dir: connectToolDir.trim() || null,
      });
      setSteamP2pSession(session);
      setSteamRelayStatus(session.status);
      onTriggerToast('已生成加入者配置，请在 helper 中加入房主房间后回到游戏连接本机端口。');
    } catch (error) {
      onTriggerToast(`生成加入者配置失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSteamRelayBusy(false);
    }
  };

  const clearSteamP2pSession = async () => {
    setSteamRelayBusy(true);
    try {
      const session = await stopSteamP2pSession();
      setSteamP2pSession(session);
      setSteamRelayStatus(session.status);
      onTriggerToast('已清空 Steam/P2P 配置状态。');
    } catch (error) {
      onTriggerToast(`清空 Steam/P2P 配置失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSteamRelayBusy(false);
    }
  };

  const focusSteamConnectToolInput = () => {
    window.setTimeout(() => {
      const target = document.querySelector('[data-steam-helper-directory="input"]');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const top = Math.max(0, window.scrollY + rect.top - 140);
      window.scrollTo({ top, behavior: 'smooth' });
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target instanceof HTMLElement) window.setTimeout(() => target.focus(), 220);
    }, 220);
  };

  const buildSteamP2pInviteText = () => {
    const invite = steamP2pSession?.invite;
    if (!invite) return '尚未生成 Steam/P2P 房主或加入者配置。';
    return [
      '[联机助手 Steam/P2P ConnectTool 配置]',
      `模式：${steamP2pSession?.mode || '未记录'}`,
      `状态：${steamP2pSession?.state || '未记录'}`,
      `说明：${steamP2pSession?.message || '无'}`,
      `房主 Steam ID：${invite.host_steam_id}`,
      `AppID：${invite.app_id || '未读取'}`,
      `协议：${invite.protocol}`,
      `房主目标：${invite.target_host}:${invite.target_port}`,
      `房间/虚拟端口：${invite.virtual_port}`,
      `加入者本机端口：${invite.guest_local_port}`,
      '',
      '使用方式：',
      '1. 双方先启动 Steam 并登录不同账号。',
      '2. 双方在联机助手中检测并启动自己准备的 ConnectTool helper。',
      '3. 房主在 helper 中创建房间或 TCP 转发，端口与上面一致。',
      '4. 加入者在 helper 中加入房主房间。',
      `5. 加入者回到游戏，连接 127.0.0.1:${invite.guest_local_port}。`,
      '',
      '边界：该配置不等于真实双机已通过，最终仍以两台电脑游戏内加入成功为准。',
    ].join('\n');
  };

  const copySteamRelayText = async (title: string, text: string) => {
    try {
      const fallbackCopy = () => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) throw new Error('剪贴板不可用');
      };
      const clipboard = navigator.clipboard;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(text);
        } catch {
          fallbackCopy();
        }
      } else {
        fallbackCopy();
      }
      onTriggerToast(`已复制${title}。`);
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const steamHostSteps = [
    '房主步骤（TCP 转发）',
    '1. 先在游戏里开服或开房，确认本机游戏端口已经监听，例如 Palworld 8211、Minecraft 25565。',
    '2. 在联机助手高级工具里确认 ConnectTool helper 文件完整，并启动 helper。',
    '3. 在 helper 中选择 TCP 转发，填写本地游戏端口，创建房间。',
    '4. 把 helper 显示的 Steam ID、房间或邀请信息发给好友。',
    '5. 好友加入后，让好友在游戏里连接 127.0.0.1:本地绑定端口 或 helper 给出的地址。',
  ].join('\n');

  const steamGuestSteps = [
    '加入者步骤（TCP 转发）',
    '1. 启动 Steam 并登录自己的账号。',
    '2. 在联机助手高级工具里启动 ConnectTool helper。',
    '3. 在 helper 中填入房主 Steam ID，或接受房主邀请加入房间。',
    '4. helper 建立转发后，在游戏里连接 127.0.0.1:本地绑定端口。',
    '5. 如果连接失败，复制联机助手诊断报告给房主一起核对 Steam、端口、防火墙和 helper 文件。',
  ].join('\n');

  const buildConnectToolDiagnosticReport = () => {
    const status = steamRelayStatus?.connecttool_status;
    if (!status) return '尚未读取 ConnectTool 兼容模式状态。';
    return [
      '[联机助手 Steam 中继 / P2P ConnectTool 兼容模式诊断]',
      `时间：${new Date().toLocaleString()}`,
      `目录：${status.directory || connectToolDir || '未设置'}`,
      `Steam：${steamRelayStatus?.steam_running ? '已运行' : '未检测到'}`,
      `helper：${status.helper_running ? `运行中${status.helper_pid ? ` PID=${status.helper_pid}` : ''}` : '未运行'}`,
      `AppID：${status.app_id || '未读取'}`,
      `TCP 转发：${status.can_tcp_forward ? '可继续配置' : '暂不可用'}`,
      `TUN 组网：${status.can_tun ? '可尝试' : '不可用或缺 WinTUN/权限'}`,
      `缺失文件：${status.missing_files.join('、') || '无'}`,
      '',
      '文件 SHA256：',
      ...status.file_statuses.map((file) => `- ${file.name}: ${file.found ? file.sha256 || '已找到，未计算' : '未找到'}`),
      '',
      '诊断：',
      ...(status.diagnostics.length ? status.diagnostics.map((item) => `- ${item}`) : ['- 当前未发现阻断项。']),
      '',
      '下一步：',
      ...(status.next_steps.length ? status.next_steps.map((item) => `- ${item}`) : ['- 启动 helper 后在 helper 中创建或加入房间。']),
      '',
      '说明：当前是 ConnectTool 兼容模式，实际 Steam 通道由用户自备 helper 完成；联机助手负责检测、启动和诊断。',
    ].join('\n');
  };

  const buildSteamDualMachineEvidenceTemplate = () => {
    const status = steamRelayStatus?.connecttool_status;
    return [
      '[联机助手 Steam Relay/P2P 真实双机回归证据]',
      '',
      '一、基础信息',
      `测试日期：${new Date().toLocaleDateString()}`,
      '测试人：',
      '联机助手版本：v0.3.0 或当前测试版本',
      'Release URL：https://github.com/cwccty/lan-server/releases/tag/v0.3.0',
      'Release ZIP SHA256：97525924f16bb8abafa772abca288f7eaaae026688ae4f7408d7e8a2a27abb7e',
      '',
      '二、ConnectTool helper',
      `helper 目录：${status?.directory || connectToolDir || '未填写'}`,
      `Steam 客户端：${steamRelayStatus?.steam_running ? '已运行' : '未检测到，请测试时重新确认'}`,
      `helper 状态：${status?.helper_running ? '运行中' : status?.can_start ? '可启动，测试时需启动' : '当前不可启动，请先修复'}`,
      `AppID：${status?.app_id || '未读取'}`,
      `必需文件缺失：${status?.missing_files?.join('、') || '无或尚未检测'}`,
      'helper 来源/版本：',
      '',
      '三、双机环境',
      '房主 Windows 版本：',
      '加入者 Windows 版本：',
      '房主 Steam 账号状态：已登录 / 未登录',
      '加入者 Steam 账号状态：已登录 / 未登录',
      '网络环境：同宽带 / 不同宽带 / 手机热点 / 校园网 / 其他',
      '防火墙处理：已放行 Steam、helper、游戏服务端 / 未处理 / 其他',
      '',
      '四、游戏与路线',
      '游戏名称：Palworld / Minecraft Java / Stardew Valley / Cuphead / 其他',
      '游戏版本/平台：',
      '路线：TCP 转发 / TUN 组网实验 / 远程同屏 / 其他',
      '房主游戏端口：',
      '加入者本地绑定端口：',
      '',
      '五、执行结果',
      '1. 房主开服或创建游戏房间：通过 / 未通过，说明：',
      '2. 房主启动 helper 并创建房间：通过 / 未通过，说明：',
      '3. 加入者启动 helper 并加入房间：通过 / 未通过，说明：',
      '4. 加入者在游戏内连接 127.0.0.1:<本地绑定端口>：通过 / 未通过，说明：',
      '5. 稳定性：游玩时长、延迟、掉线、重连情况：',
      '',
      '六、证据附件',
      '房主诊断报告：',
      '加入者诊断报告：',
      '截图/录屏：',
      '失败日志：',
      '',
      '七、结论',
      '结论：通过 / 未通过 / 部分通过',
      '是否需要更新 Release：是 / 否',
      '是否需要更新方案库：是 / 否',
      '备注：',
    ].join('\n');
  };

  const applyAdvancedToolIntent = (intent: AdvancedToolIntent) => {
    if (intent.reason === 'bridge_or_proxy_choice') {
      setBridgeChoicePending(true);
      return;
    }
    setBridgeChoicePending(false);
    const preferredCard = connectionCardFromAdvancedToolIntent(intent);
    if (preferredCard) setActiveConnectionCard(preferredCard);
    if (intent.reason === 'steam_relay_p2p') focusSteamConnectToolInput();
    setKind(intent.kind);
    if (intent.listen_port) setListenPort(String(intent.listen_port));
    if (intent.target_port) setTargetPort(String(intent.target_port));
    if (intent.target_host) setTargetHost(intent.target_host);
    const decisionId = intent.reason === 'udp_broadcast_bridge' || preferredCard === 'udp_broadcast_bridge'
      ? 'lan-discovery-broadcast'
      : intent.reason === 'port_proxy' || preferredCard === 'tcp_proxy'
        ? 'port-proxy-needed'
        : selectedDecisionId;
    setSelectedDecisionId(decisionId);
  };

  useEffect(() => {
    if (!advancedToolIntent || advancedToolIntentApplied) return;
    applyAdvancedToolIntent(advancedToolIntent);
    setAdvancedToolIntentApplied(true);
    onTriggerToast(
      advancedToolIntent.reason === 'steam_relay_p2p'
        ? '已切到 Steam Relay / P2P。请先检查 Steam 连接工具文件夹，再按房主或加入者步骤操作。'
        : advancedToolIntent.reason === 'generic_server'
          ? '已切到通用服务端。请先选择服务端文件并做启动前检查。'
          : advancedToolIntent.reason === 'bridge_or_proxy_choice'
            ? '已打开桥接工具选择。请先判断是“地址+端口”还是“房间列表看不到”。'
          : '已根据建议预填连接信息，请核对目标联机地址后再启动。'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedToolIntent, advancedToolIntentApplied]);

  const proxyRows = useMemo(() => {
    const snapshot = runtime.snapshot;
    return [
      ...(snapshot?.port_proxies ?? []).map((item) => ({
        kind: 'tcp' as ToolKind,
        type: 'TCP',
        id: item.id,
        running: item.running,
        line: `${item.listen} → ${item.target}`,
        metrics: `连接 ${item.active_connections}/${item.total_connections}｜入 ${formatBytes(item.bytes_in)} / 出 ${formatBytes(item.bytes_out)}`,
        error: item.last_error || '',
        logs: item.logs ?? []
      })),
      ...(snapshot?.udp_proxies ?? []).map((item) => ({
        kind: 'udp' as ToolKind,
        type: 'UDP',
        id: item.id,
        running: item.running,
        line: `${item.listen} → ${item.target}`,
        metrics: `客户端 ${item.active_clients}｜包 ${item.packets_in}/${item.packets_out}｜入 ${formatBytes(item.bytes_in)} / 出 ${formatBytes(item.bytes_out)}`,
        error: item.last_error || '',
        logs: item.logs ?? []
      })),
      ...(snapshot?.udp_broadcast_bridges ?? []).map((item) => ({
        kind: 'bridge' as ToolKind,
        type: 'BRIDGE',
        id: item.id,
        running: item.running,
        line: `${item.listen} → ${item.forward_targets.join(', ')}`,
        metrics: `收到 ${item.received_packets}｜转发 ${item.forwarded_packets}｜丢弃 ${item.dropped_packets}｜入 ${formatBytes(item.bytes_in)} / 出 ${formatBytes(item.bytes_out)}`,
        error: item.last_error || '',
        logs: item.logs ?? []
      }))
    ];
  }, [runtime.snapshot]);

  const runningCount = proxyRows.filter((row) => row.running).length + (runtime.snapshot?.server_session?.running ? 1 : 0);
  const totalCount = proxyRows.length + (runtime.snapshot?.server_session ? 1 : 0);
  const selectedDecision = connectionCapabilityMatrix.find((row) => row.id === selectedDecisionId) ?? connectionCapabilityMatrix[0];
  const riskChecks = useMemo(() => buildAdvancedToolRiskChecks({
    kind,
    listenPort,
    targetHost,
    targetPort,
    intent: advancedToolIntent,
  }), [advancedToolIntent, kind, listenPort, targetHost, targetPort]);
  const blockingRiskCount = riskChecks.filter((item) => item.level === 'danger').length;
  const connectionMethodClosureAuditInput = useMemo(() => ({
    methods: connectionMethodCatalog,
    decisionRows: connectionCapabilityMatrix,
    selectedDecision,
    selectedToolKind: kind,
    advancedToolIntent,
    proxyInstanceCount: totalCount,
    runningInstanceCount: runningCount,
    blockingRiskCount,
    runtimeLoaded: runtime.loaded,
  }), [advancedToolIntent, blockingRiskCount, kind, runningCount, selectedDecision, totalCount, runtime.loaded]);
  const connectionMethodClosureAudit = useMemo(
    () => buildConnectionMethodClosureAudit(connectionMethodClosureAuditInput),
    [connectionMethodClosureAuditInput],
  );

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

  const currentProxyForm = () => ({
    type: kind,
    listen_port: Number(listenPort) || 7777,
    target_host: targetHost || '10.0.8.2',
    target_port: Number(targetPort) || Number(listenPort) || 7777
  });

  const runAdvancedToolSelfTest = async (label = '高级工具检查', reason = '手动检查') => {
    const result = await selfTestReferenceAdvancedProxy(kind);
    const data = summarizeSelfTestData(result.data);
    const ok = result.ok && data.ok;
    const params = `${kind.toUpperCase()} ${listenPort} → ${targetHost}:${targetPort}`;
    const recap: AdvancedToolSelfTestRecap = {
      id: `${Date.now()}-${kind}-self-test`,
      kind,
      label,
      ok,
      params,
      notes: data.notes,
      summary: `${reason}：${ok ? '通过' : '失败'}｜${result.message}｜${data.detail}`,
      generatedAt: new Date().toISOString(),
    };
    setAdvancedToolSelfTestRecap(recap);
    if (advancedToolIntent) {
      appendDiagnosticFixHistoryFromAdvancedTool(
        recap,
        advancedToolIntent.display_name ? `${advancedToolIntent.display_name} (${advancedToolIntent.game_id || 'unknown'})` : '高级工具诊断预填',
        advancedToolIntent.game_id,
      );
    }
    if (!result.ok) throw new Error(result.message);
    return recap;
  };

  const startProxy = async () => {
    if (blockingRiskCount > 0) {
      onTriggerToast('连接信息仍有阻断风险，请先修正红色风险项。');
      return;
    }
    setBusy('启动高级连接链路');
    try {
      const startResult = await startReferenceAdvancedProxy(currentProxyForm());
      if (!startResult.ok) throw new Error(startResult.message);
      await refreshReferenceRuntime(false);
      onTriggerToast('启动高级连接链路完成。');
      if (advancedToolIntent) {
        setBusy('启动后自动检查');
        const recap = await runAdvancedToolSelfTest('启动后自动检查', '诊断预填启动后自动检查');
        onTriggerToast(recap.ok ? '高级工具已启动并通过自动检查。' : '高级工具已启动，但自动检查未通过。');
      }
    } catch (error) {
      onTriggerToast(`启动高级连接链路失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const stopProxy = (row: { kind: ToolKind; id: string }) => run('停止高级连接实例', async () => {
    if (row.kind === 'tcp') return stopPortProxy(row.id);
    if (row.kind === 'udp') return stopUdpProxy(row.id);
    return stopUdpBroadcastBridge(row.id);
  });

  const selfTest = (targetKind: ToolKind) => {
    const previousKind = kind;
    if (targetKind !== kind) setKind(targetKind);
    setBusy('高级连接检查');
    Promise.resolve()
      .then(() => selfTestReferenceAdvancedProxy(targetKind))
      .then((result) => {
        const data = summarizeSelfTestData(result.data);
        const ok = result.ok && data.ok;
        const params = `${targetKind.toUpperCase()} ${listenPort} → ${targetHost}:${targetPort}`;
        const recap: AdvancedToolSelfTestRecap = {
          id: `${Date.now()}-${targetKind}-self-test`,
          kind: targetKind,
          label: '手动高级工具检查',
          ok,
          params,
          notes: data.notes,
          summary: `手动检查：${ok ? '通过' : '失败'}｜${result.message}｜${data.detail}`,
          generatedAt: new Date().toISOString(),
        };
        setAdvancedToolSelfTestRecap(recap);
        if (advancedToolIntent) {
          appendDiagnosticFixHistoryFromAdvancedTool(recap, advancedToolIntent.display_name || '高级工具诊断预填', advancedToolIntent.game_id);
        }
        if (!result.ok) throw new Error(result.message);
        return refreshReferenceRuntime(false);
      })
      .then(() => onTriggerToast('高级连接检查完成。'))
      .catch((error) => {
        if (targetKind !== previousKind) setKind(previousKind);
        onTriggerToast(`高级连接检查失败：${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => setBusy(''));
  };

  const startServer = () => run('启动通用服务端', () => startReferenceGenericServer({
    game_name: serverName || '通用游戏服务端',
    executable_path: serverPath,
    port: Number(serverPort) || 7777
  }));

  const sendCommand = () => run('发送服务端指令', () => sendServerCommand(serverCommand));
  const stopServer = () => run('停止通用服务端', () => stopServerSession());

  const selectMethod = (method: ConnectionMethodEntry) => {
    if (method.advancedToolKind) {
      setKind(method.advancedToolKind);
      onTriggerToast(`已切换到${method.title}配置。`);
      return;
    }
    onTriggerToast(`${method.title}当前是${method.status}入口，请先复制说明按外部工具配置。`);
  };

  const copyMethodGuide = async (method: ConnectionMethodEntry) => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(buildConnectionMethodGuide(method));
      onTriggerToast(`已复制${method.title}说明。`);
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const methodsForDecisionRow = (row: ConnectionCapabilityDecisionRow) =>
    row.recommendedMethodIds
      .map((id) => connectionMethodCatalog.find((method) => method.id === id))
      .filter((method): method is ConnectionMethodEntry => Boolean(method));

  const copyDecisionMatrix = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(buildConnectionCapabilityMatrixGuide());
      onTriggerToast('已复制联机方式能力矩阵。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyDecisionRow = async (row: ConnectionCapabilityDecisionRow) => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(buildConnectionCapabilityMatrixGuide([row]));
      onTriggerToast(`已复制 ${row.gameType} 决策说明。`);
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyConnectionMethodClosureAudit = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatConnectionMethodClosureAuditReport(connectionMethodClosureAuditInput));
      onTriggerToast('已复制联机方式检查。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyAdvancedToolSelfTestRecap = async () => {
    if (!advancedToolSelfTestRecap) {
      onTriggerToast('暂无高级工具检查结果。');
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText([
        '[联机助手高级工具检查结果]',
        `时间：${new Date(advancedToolSelfTestRecap.generatedAt).toLocaleString()}`,
        `工具：${advancedToolSelfTestRecap.kind}`,
        `连接信息：${advancedToolSelfTestRecap.params}`,
        `结果：${advancedToolSelfTestRecap.ok ? '通过' : '失败'}`,
        `摘要：${advancedToolSelfTestRecap.summary}`,
        `备注：${advancedToolSelfTestRecap.notes.join('；') || '无'}`,
        advancedToolIntent?.display_name ? `来源游戏：${advancedToolIntent.display_name} (${advancedToolIntent.game_id || '-'})` : '',
        advancedToolIntent?.note ? `诊断建议：${advancedToolIntent.note}` : '',
      ].filter(Boolean).join('\n'));
      onTriggerToast('高级工具检查结果已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const applyDecisionRow = (row: ConnectionCapabilityDecisionRow) => {
    setSelectedDecisionId(row.id);
    const firstTool = methodsForDecisionRow(row).find((method) => method.advancedToolKind);
    if (firstTool?.advancedToolKind) {
      setKind(firstTool.advancedToolKind);
      onTriggerToast(`已按“${row.gameType}”切换到${firstTool.title}配置。`);
      return;
    }
    onTriggerToast(`已选中“${row.gameType}”：${row.userFacingResult}`);
  };

  const dismissAdvancedToolIntent = () => {
    clearAdvancedToolIntent();
    setAdvancedToolIntent(null);
    setAdvancedToolIntentApplied(false);
    onTriggerToast('已关闭高级工具预填建议。');
  };

  const server = runtime.snapshot?.server_session ?? null;
  const steamCardStatus = steamRelayStatus?.connecttool_status?.helper_running
    ? '正在运行'
    : steamRelayStatus?.connecttool_status?.can_start
      ? '可启动'
      : '需先检测';
  const activeProxyName = kind === 'bridge' ? 'UDP 广播桥' : kind === 'udp' ? 'UDP 单播代理' : 'TCP 端口代理';
  const activeConnectionCards: Array<{
    id: AdvancedConnectionCardId;
    title: string;
    status: string;
    description: string;
    bestFor: string;
    actionLabel: string;
    tone: string;
  }> = [
    {
      id: 'steam_relay',
      title: 'Steam Relay / P2P',
      status: steamCardStatus,
      description: '游戏原本依赖 Steam 邀请、房间或 P2P 时，用外部 ConnectTool 建立 Steam 通道。',
      bestFor: 'Palworld、部分 Steam 大厅游戏、需要 Steam ID 或房间信息的游戏',
      actionLabel: '配置 Steam 通道',
      tone: 'border-sky-100 bg-sky-50/80',
    },
    {
      id: 'tcp_proxy',
      title: '端口代理',
      status: proxyRows.some((row) => row.kind === 'tcp' && row.running) ? '正在运行' : '可配置',
      description: '游戏有明确“地址 + 端口”时，把本机入口转到房主或服务端端口。',
      bestFor: 'Minecraft Java、Terraria、带 TCP 端口的专用服务端',
      actionLabel: '填写端口',
      tone: 'border-emerald-100 bg-emerald-50/80',
    },
    {
      id: 'udp_broadcast_bridge',
      title: 'UDP 广播桥',
      status: proxyRows.some((row) => row.kind === 'bridge' && row.running) ? '正在运行' : '可配置',
      description: '游戏靠局域网房间列表发现房间，但好友看不到房间时使用。',
      bestFor: '需要局域网大厅发现、刷新房间列表的老游戏或局域网游戏',
      actionLabel: '配置房间发现',
      tone: 'border-violet-100 bg-violet-50/80',
    },
    {
      id: 'generic_server',
      title: '通用服务端',
      status: server?.running ? '正在运行' : '可配置',
      description: '已经有 server.exe、bat、cmd 或 server.jar 时，在联机助手里托管启动和停止。',
      bestFor: 'Palworld、Minecraft、Terraria 等专用服务端路线',
      actionLabel: '填写服务端',
      tone: 'border-amber-100 bg-amber-50/80',
    },
  ];

  const selectConnectionCard = (id: AdvancedConnectionCardId) => {
    setActiveConnectionCard(id);
    setBridgeChoicePending(false);
    if (id === 'tcp_proxy') setKind('tcp');
    if (id === 'udp_broadcast_bridge') setKind('bridge');
  };
  const chooseBridgeTool = (id: 'tcp_proxy' | 'udp_broadcast_bridge') => {
    setBridgeChoicePending(false);
    setActiveConnectionCard(id);
    setKind(id === 'udp_broadcast_bridge' ? 'bridge' : 'tcp');
    setSelectedDecisionId(id === 'udp_broadcast_bridge' ? 'lan-discovery-broadcast' : 'port-proxy-needed');
    onTriggerToast(id === 'udp_broadcast_bridge'
      ? '已选择 UDP 广播桥。适合好友看不到局域网房间列表。'
      : '已选择端口代理。适合你已经知道房主地址和游戏端口。');
  };
  const activeConnectionCardDetail = bridgeChoicePending
    ? {
      id: 'tcp_proxy' as AdvancedConnectionCardId,
      title: '桥接工具二选一',
      status: '请先选择',
      description: '先判断你是有房主地址和端口，还是好友看不到局域网房间列表。',
      bestFor: '地址 + 端口走端口代理；房间列表看不到走 UDP 广播桥',
      actionLabel: '选择桥接路线',
      tone: 'border-violet-100 bg-violet-50/80',
    }
    : activeConnectionCard
      ? activeConnectionCards.find((card) => card.id === activeConnectionCard) || null
      : null;
  const currentConnectionCardDetail = activeConnectionCardDetail ?? {
    id: 'tcp_proxy' as AdvancedConnectionCardId,
    title: '请先选择一种方式',
    status: '未选择',
    description: '四种高级联机方式是同级入口。先按游戏症状点一张卡片，下方才会展开对应操作。',
    bestFor: '不确定时先回到“游戏扫描”或“方案库”，按联机方式筛选支持游戏。',
    actionLabel: '选择方式',
    tone: 'border-slate-100 bg-slate-50/80',
  };
  const activeConfigIsConnectionAssist =
    !bridgeChoicePending
    && activeConnectionCard !== null
    && activeConnectionCard !== 'steam_relay';

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="advanced_tools">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在启动或测试连接工具；请等待状态刷新。" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">高级连接工具</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            只有推荐方案或诊断提示需要时再使用。它不是给所有游戏用的；普通开房优先回到“开房邀请”按步骤操作。
          </p>
        </div>
        <button
          onClick={() => run('刷新高级工具状态', () => refreshReferenceRuntime(false))}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          刷新状态
        </button>
      </div>

      <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm" data-advanced-tool-user-guide="visible">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">
              特殊连接工具是什么
            </div>
            <h3 className="text-base font-black text-slate-900">当游戏“看得到人但连不上”或“看不到房间”时，用它补一段连接。</h3>
            <p className="mt-2 max-w-4xl text-xs leading-relaxed text-slate-700">
              下面四个入口同级，不是 Steam Relay/P2P 的附属功能。先按游戏实际情况选一种，再只填写这一种方式需要的信息；如果你从方案库、游戏扫描或诊断报告跳过来，联机助手会尽量帮你带入推荐方式。
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-amber-200 bg-white/85 p-4 text-xs leading-relaxed text-amber-900 lg:max-w-sm">
            <p className="font-bold text-slate-900">当前选择：{currentConnectionCardDetail.title}</p>
            <p className="mt-1">{currentConnectionCardDetail.description}</p>
            <p className="mt-2 text-[11px] text-amber-800">适合：{currentConnectionCardDetail.bestFor}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {[
            '先从方案库或游戏扫描确认联机方式。',
            '四张方式卡只选一张，避免混用端口和 Steam 通道。',
            '按选中的方式启动、检测或复制诊断。',
            '回到游戏里刷新房间，或按邀请地址加入。'
          ].map((item, index) => (
            <div key={item} className="rounded-xl bg-white/75 p-3 text-xs leading-relaxed text-slate-600">
              <b className="text-slate-900">{index + 1}. </b>{item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-advanced-tool-method-level="equal">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">选择一种高级联机方式</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              四种方式在这里拥有相同层级。选中哪一种，下方就只展开对应的操作区；没有被选中的方式不会被折叠成“次要功能”。
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            当前：{bridgeChoicePending ? '桥接工具二选一' : activeConnectionCards.find((card) => card.id === activeConnectionCard)?.title || '未选择'}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {activeConnectionCards.map((card) => {
            const selected = !bridgeChoicePending && activeConnectionCard === card.id;
            return (
              <button
                key={card.id}
                onClick={() => selectConnectionCard(card.id)}
                className={`min-h-[190px] rounded-2xl border p-4 text-left transition ${
                  selected ? `${card.tone} ring-2 ring-slate-900/10` : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white'
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    {card.id === 'generic_server' ? <Server className="h-5 w-5" /> : card.id === 'udp_broadcast_bridge' ? <Waves className="h-5 w-5" /> : card.id === 'steam_relay' ? <Compass className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                    selected ? 'bg-white/80 text-slate-800' : 'bg-white text-slate-500'
                  }`}>
                    {card.status}
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900">{card.title}</h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{card.description}</p>
                <p className="mt-3 rounded-xl bg-white/75 p-3 text-[11px] leading-relaxed text-slate-500">
                  <b className="text-slate-800">适合：</b>{card.bestFor}
                </p>
                <span className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white">
                  {card.actionLabel}
                </span>
                <p className="mt-2 text-[10px] font-bold text-slate-500">
                  方式 {activeConnectionCards.findIndex((item) => item.id === card.id) + 1} / {activeConnectionCards.length}
                </p>
              </button>
            );
          })}
        </div>
        <div className={`mt-4 rounded-2xl border p-4 text-xs leading-relaxed ${bridgeChoicePending ? 'border-violet-100 bg-violet-50 text-violet-900' : 'border-slate-100 bg-slate-50 text-slate-600'}`}>
          <p className="font-bold text-slate-900">{currentConnectionCardDetail.title} 下一步</p>
          <p className="mt-1">
            {bridgeChoicePending
              ? '请先在下方二选一：有房主地址和端口就用端口代理；好友看不到局域网房间列表就用 UDP 广播桥。选完以后才展开对应表单。'
              : activeConnectionCard
                ? `${currentConnectionCardDetail.actionLabel}，然后按下方对应区域完成检测、启动或复制诊断。若不确定该选哪张卡，先回到“方案库”按联机方式筛选游戏。`
                : '先点击上方任意一张方式卡。未选择前不展开 Steam 配置、端口代理或服务端表单，避免普通用户误以为某一种方式更重要。'}
          </p>
        </div>
      </section>

      {bridgeChoicePending ? (
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm" data-bridge-route-choice="selector" tabIndex={-1}>
          <div>
            <div className="mb-2 inline-flex rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700">
              桥接工具先选一种
            </div>
            <h3 className="text-base font-bold text-slate-900">你现在遇到的是哪一种问题？</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
              没有具体游戏推荐时，联机助手不会强行把你带到端口代理。先按症状选一条路，选错了也可以随时切换。
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseBridgeTool('tcp_proxy')}
              className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-100/70"
            >
              <p className="text-sm font-black text-slate-900">我有房主地址和游戏端口</p>
              <p className="mt-2 text-xs leading-relaxed text-emerald-900">
                例如好友给了 10.x.x.x:25565、7777，或游戏显示了直接连接端口。下一步填写本机入口端口、房主联机地址和游戏端口。
              </p>
              <span className="mt-3 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">使用端口代理</span>
            </button>
            <button
              type="button"
              onClick={() => chooseBridgeTool('udp_broadcast_bridge')}
              className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-100/70"
            >
              <p className="text-sm font-black text-slate-900">好友看不到局域网房间列表</p>
              <p className="mt-2 text-xs leading-relaxed text-violet-900">
                适合游戏靠“刷新局域网房间”找房间，但组网后列表仍为空。下一步启动 UDP 广播桥，再回游戏刷新房间。
              </p>
              <span className="mt-3 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">使用 UDP 广播桥</span>
            </button>
          </div>
        </section>
      ) : null}

      {!bridgeChoicePending && activeConnectionCard === 'steam_relay' ? (
      <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm" data-steam-relay-p2p="connecttool-compatible">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">Steam 中继 / P2P</span>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${steamRelayStatus?.connecttool_status?.helper_running ? 'bg-emerald-50 text-emerald-700' : steamRelayStatus?.connecttool_status?.can_start ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                {steamRelayStatus?.connecttool_status?.helper_running ? '连接工具运行中' : steamRelayStatus?.connecttool_status?.can_start ? '可启动连接工具' : '需要先选择文件夹'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">用你自己准备的 Steam 连接工具，整理房主和加入者需要填的参数。</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
              联机助手负责检查文件夹、启动工具、记录参数和复制诊断；真实 Steam 通道仍由双方的外部连接工具完成。不会修改游戏文件，也不会绕过 Steam 或游戏拥有权。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button onClick={refreshSteamRelayStatus} disabled={steamRelayBusy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${steamRelayBusy ? 'animate-spin' : ''}`} />
              重新检测
            </button>
            <button onClick={startConnectTool} disabled={steamRelayBusy || !steamRelayStatus?.connecttool_status?.can_start} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
              <Play className="h-4 w-4" />
              启动连接工具
            </button>
            <button onClick={stopConnectTool} disabled={steamRelayBusy || !steamRelayStatus?.connecttool_status?.helper_running} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Square className="h-4 w-4" />
              停止连接工具
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <label className="text-xs font-bold text-slate-800">Steam 连接工具文件夹</label>
          <div className="mt-2 flex flex-col gap-2 lg:flex-row">
            <input
              data-steam-helper-directory="input"
              value={connectToolDir}
              onChange={(event) => setConnectToolDir(event.target.value)}
              placeholder="例如 D:\Tools\connecttool-qt-windows-x86_64，或粘贴你解压后的连接工具文件夹"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-300"
            />
            <button onClick={refreshSteamRelayStatus} disabled={steamRelayBusy} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">检测这个目录</button>
          </div>
          <details className="mt-2 rounded-xl border border-slate-100 bg-white p-3">
            <summary className="cursor-pointer text-[11px] font-bold text-slate-700">需要准备哪些文件</summary>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              目录内应包含 connecttool-qt.exe、steam_api64.dll、steamwebrtc64.dll、steam_appid.txt；wintun.dll 只用于 TUN 组网实验路线。
            </p>
          </details>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {[
            ['Steam 客户端', steamRelayStatus?.steam_running ? '已运行' : '未检测到', steamRelayStatus?.steam_process_path || '请先启动并登录 Steam'],
            ['Steam 连接工具', steamRelayStatus?.connecttool_status?.helper_running ? '运行中' : steamRelayStatus?.connecttool_status?.can_start ? '可启动' : '不可启动', steamRelayStatus?.connecttool_status?.helper_process_path || steamRelayStatus?.connecttool_status?.directory || '请设置连接工具文件夹'],
            ['AppID', steamRelayStatus?.connecttool_status?.app_id || '未读取', steamRelayStatus?.connecttool_status?.app_id_path || '从连接工具文件夹读取'],
            ['TUN 组网', steamRelayStatus?.connecttool_status?.can_tun ? '可尝试' : '需额外文件/权限', steamRelayStatus?.connecttool_status?.wintun_available ? '已检测到相关文件' : '未检测到相关文件'],
          ].map(([label, status, detail]) => (
            <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-800">{label}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-600">{status}</p>
              <p className="mt-1 break-words text-[11px] leading-relaxed text-slate-500">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <p className="text-sm font-black text-slate-900">路线一：TCP 转发</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">适合 Palworld、Minecraft 等有“地址 + 端口”的游戏。房主开服后让 Steam 连接工具建立通道，加入者在自己电脑的游戏里连接 127.0.0.1:本地绑定端口。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => copySteamRelayText('房主步骤', steamHostSteps)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"><ClipboardCopy className="h-3.5 w-3.5" />复制房主步骤</button>
              <button onClick={() => copySteamRelayText('加入者步骤', steamGuestSteps)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"><ClipboardCopy className="h-3.5 w-3.5" />复制加入者步骤</button>
            </div>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <p className="text-sm font-black text-slate-900">路线二：TUN 组网（实验）</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">适合需要“像在同一局域网”的实验路线。需要额外文件、管理员权限和防火墙许可；如果只是 IP + 端口，优先用 TCP 转发。</p>
            <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-slate-600">
              <li>• Steam ID：Steam 账号的数字 ID，用来让 helper 找到对端。</li>
              <li>• 房间：Steam 连接工具里创建或加入的连接会话。</li>
              <li>• 端口：游戏服务端真正监听的数字。</li>
              <li>• 本地绑定端口：加入者本机 127.0.0.1 上给游戏连接的入口。</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-sky-100 bg-white p-4" data-steam-p2p-session-config="connecttool">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-slate-900">房主 / 加入者配置单</p>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-600">
                这里把 Steam ID、端口和 AppID 记录成一份可复制配置。它不会替你完成 Steam 连接，真实通道仍需要双方在 Steam 连接工具里创建或加入房间。
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
              steamP2pSession?.state === 'helper_running' ? 'bg-emerald-50 text-emerald-700' : steamP2pSession?.state === 'helper_ready' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {steamP2pSession?.state === 'idle' || !steamP2pSession ? '尚未生成配置' : steamP2pSession.state}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-[11px] font-bold text-slate-600 xl:col-span-2">
              房主 Steam ID
              <input
                value={steamHostId}
                onChange={(event) => setSteamHostId(event.target.value)}
                placeholder="例如 7656119..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-sky-300"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              房间/虚拟端口
              <input
                value={steamVirtualPort}
                onChange={(event) => setSteamVirtualPort(event.target.value)}
                placeholder="8211"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-sky-300"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              游戏目标端口
              <input
                value={steamTargetPort}
                onChange={(event) => setSteamTargetPort(event.target.value)}
                placeholder="8211"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-sky-300"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              加入者本机端口
              <input
                value={steamGuestLocalPort}
                onChange={(event) => setSteamGuestLocalPort(event.target.value)}
                placeholder="8211"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-sky-300"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600 md:col-span-2">
              房主游戏地址
              <input
                value={steamTargetHost}
                onChange={(event) => setSteamTargetHost(event.target.value)}
                placeholder="127.0.0.1"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-sky-300"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600 md:col-span-2 xl:col-span-3">
              AppID，可留空
              <input
                value={steamAppId}
                onChange={(event) => setSteamAppId(event.target.value)}
                placeholder={steamRelayStatus?.connecttool_status?.app_id || '从 steam_appid.txt 读取，或手动填写'}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-sky-300"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={startSteamHostProfile} disabled={steamRelayBusy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
              <Play className="h-4 w-4" />
              生成房主配置
            </button>
            <button onClick={startSteamGuestProfile} disabled={steamRelayBusy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 disabled:opacity-50">
              <Play className="h-4 w-4" />
              生成加入者配置
            </button>
            <button onClick={() => copySteamRelayText('Steam/P2P 配置单', buildSteamP2pInviteText())} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <ClipboardCopy className="h-4 w-4" />
              复制配置单
            </button>
            <button onClick={clearSteamP2pSession} disabled={steamRelayBusy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <Trash2 className="h-4 w-4" />
              清空配置
            </button>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <p className="font-bold text-slate-900">{steamP2pSession?.message || '尚未生成配置。先检测 Steam 连接工具文件夹，再按房主或加入者身份生成。'}</p>
            {steamP2pSession?.invite ? (
              <p className="mt-1">
                当前配置：房主 Steam ID {steamP2pSession.invite.host_steam_id || '未填'}，目标 {steamP2pSession.invite.target_host}:{steamP2pSession.invite.target_port}，加入者连接 127.0.0.1:{steamP2pSession.invite.guest_local_port}。
              </p>
            ) : (
              <p className="mt-1">配置单只记录路线和端口，不代表真实联机成功；真实结果必须由双机游戏内加入验证。</p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4" data-steam-dual-machine-evidence="template">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-slate-900">真实双机回归证据</p>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-emerald-900">
                这一步不是本机 smoke。需要房主和加入者各一台 Windows、两个 Steam 账号、同版本 helper 和目标游戏。
                测试人员复制模板后，按 Palworld、Minecraft 或其他目标游戏逐项填写，再回填到回归 Issue。
              </p>
              <div className="mt-3 grid gap-2 text-[11px] leading-relaxed text-emerald-900 sm:grid-cols-3">
                <div className="rounded-xl bg-white/75 p-3">
                  <b className="text-slate-900">房主</b>
                  <p className="mt-1">开服，确认端口，启动 helper，创建房间，保存诊断报告。</p>
                </div>
                <div className="rounded-xl bg-white/75 p-3">
                  <b className="text-slate-900">加入者</b>
                  <p className="mt-1">登录另一个 Steam 账号，加入 helper 房间，在游戏里连本机绑定端口。</p>
                </div>
                <div className="rounded-xl bg-white/75 p-3">
                  <b className="text-slate-900">结论</b>
                  <p className="mt-1">记录通过、部分通过或失败，并附截图、录屏、日志和双端诊断。</p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <button
                onClick={() => copySteamRelayText('双机回归证据模板', buildSteamDualMachineEvidenceTemplate())}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <ClipboardCopy className="h-4 w-4" />
                复制证据模板
              </button>
              <button
                onClick={() => copySteamRelayText('Steam 诊断报告', buildConnectToolDiagnosticReport())}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
              >
                <ClipboardCopy className="h-4 w-4" />
                复制当前诊断
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-800">当前诊断</p>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-amber-800">
              {(steamRelayStatus?.connecttool_status?.diagnostics?.length ? steamRelayStatus.connecttool_status.diagnostics : steamRelayStatus?.unavailable_reasons || ['尚未读取状态']).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800">下一步怎么做</p>
              <button onClick={() => copySteamRelayText('Steam 诊断报告', buildConnectToolDiagnosticReport())} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm hover:bg-slate-50"><ClipboardCopy className="h-3.5 w-3.5" />复制诊断报告</button>
            </div>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-600">
              {(steamRelayStatus?.connecttool_status?.next_steps?.length ? steamRelayStatus.connecttool_status.next_steps : steamRelayStatus?.next_steps || ['先重新检测 ConnectTool 目录。']).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>

        {steamRelayStatus?.connecttool_status?.file_statuses?.length ? (
          <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <summary className="cursor-pointer text-xs font-bold text-slate-800">展开文件校验和 SHA256</summary>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {steamRelayStatus.connecttool_status.file_statuses.map((file) => (
                <div key={file.name} className="min-w-0 rounded-xl bg-white p-3 text-[11px] leading-relaxed text-slate-600">
                  <p className="font-bold text-slate-800">{file.name} {file.required ? '（必需）' : '（可选）'}：{file.found ? '已找到' : '未找到'}</p>
                  <p className="break-words">{file.path || '-'}</p>
                  <p className="break-all text-slate-500">SHA256：{file.sha256 || '-'}</p>
                </div>
              ))}
            </div>
            </details>
        ) : null}
      </section>
      ) : null}

      {activeConfigIsConnectionAssist ? (
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-advanced-tool-visible-config="primary">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
              {activeConnectionCard === 'generic_server' ? '服务端启动' : activeProxyName}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {activeConnectionCard === 'generic_server' ? '启动已有的游戏服务端' : '填写连接信息并挂载上线'}
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              {activeConnectionCard === 'generic_server'
                ? '这里适合你已经下载好官方或游戏自带服务端的情况。选择服务端文件后启动，再回到开房邀请页复制地址给好友。'
                : '先确认游戏里显示的端口和房主联机地址。启动成功后点“测试连接”，再回到游戏刷新房间或输入地址加入。'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${
            activeConnectionCard === 'generic_server'
              ? server?.running ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              : blockingRiskCount ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {activeConnectionCard === 'generic_server'
              ? server?.running ? '服务端运行中' : '等待选择文件'
              : blockingRiskCount ? `还需确认 ${blockingRiskCount} 项` : '可启动'}
          </span>
        </div>

        {activeConnectionCard === 'generic_server' ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-xs font-semibold text-slate-600">
                游戏名称
                <input value={serverName} onChange={(event) => setServerName(event.target.value)} placeholder="例如 Minecraft Java" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              </label>
              <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
                服务端文件路径
                <input value={serverPath} onChange={(event) => setServerPath(event.target.value)} placeholder="选择或粘贴 server.exe / .bat / .cmd / server.jar 路径" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                服务端端口
                <input value={serverPort} onChange={(event) => setServerPort(event.target.value)} placeholder="例如 25565" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              </label>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
              <p className="font-bold text-slate-900">普通用户步骤</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>先准备游戏官方服务端文件。</li>
                <li>在这里启动服务端，等待显示运行中。</li>
                <li>回到开房邀请页复制联机地址给好友。</li>
              </ol>
              <button onClick={startServer} disabled={Boolean(busy) || !serverPath.trim()} className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                启动服务端
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-xs font-semibold text-slate-600">
                本机入口端口
                <input value={listenPort} onChange={(event) => setListenPort(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                房主联机地址
                <input value={targetHost} onChange={(event) => setTargetHost(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                游戏端口
                <input value={targetPort} onChange={(event) => setTargetPort(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
              </label>
            </div>
            <div className={`rounded-2xl border p-4 text-xs leading-relaxed ${
              blockingRiskCount ? 'border-amber-100 bg-amber-50 text-amber-900' : 'border-emerald-100 bg-emerald-50 text-emerald-800'
            }`}>
              <p className="font-bold text-slate-900">启动前确认</p>
              <p className="mt-2">
                {blockingRiskCount
                  ? '地址或端口还需要修正。请确认端口是 1 到 65535，房主地址不是 localhost。'
                  : '连接信息看起来可以启动。启动后建议马上测试连接。'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={startProxy} disabled={Boolean(busy) || blockingRiskCount > 0} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  挂载并上线
                </button>
                <button onClick={() => selfTest(kind)} disabled={Boolean(busy)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  测试连接
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      ) : null}

      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm" data-connection-method-closure-audit="checklist">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-emerald-700">多联机方式最终审计</span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                {connectionMethodClosureAudit.observedCount} / {connectionMethodClosureAudit.wiredCount} 已观察
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">
                当前工具：{kind === 'bridge' ? 'UDP 广播桥' : kind === 'udp' ? 'UDP 代理' : 'TCP 代理'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">联机方式、游戏类型和诊断建议已连通。</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
              {connectionMethodClosureAudit.summary}
              当前运行记录 {runningCount}/{totalCount}，阻断风险 {blockingRiskCount} 项。
              下一风险：{connectionMethodClosureAudit.nextRisk}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">方式状态</p>
                <p className="mt-1 text-xs font-bold text-slate-700">
                  已接入 {connectionMethodClosureAudit.connectedCount}｜引导 {connectionMethodClosureAudit.guideCount}｜预留 {connectionMethodClosureAudit.reservedCount}
                </p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">缺失方式</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{connectionMethodClosureAudit.missingMethods.join('、') || '无'}</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">缺失决策</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{connectionMethodClosureAudit.missingDecisions.join('、') || '无'}</p>
              </div>
            </div>
          </div>
          <button
            onClick={copyConnectionMethodClosureAudit}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
          >
            <ClipboardCopy className="h-4 w-4" />
            复制联机方式检查
          </button>
        </div>
      </section>

      {advancedToolIntent ? (
        <section className="rounded-2xl border border-amber-100 bg-amber-50/80 p-5 shadow-sm" data-advanced-tool-intent="diagnostic-prefill">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">路线建议已带入</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                  {advancedToolIntent.reason === 'steam_relay_p2p'
                    ? 'Steam Relay / P2P'
                    : advancedToolIntent.reason === 'generic_server'
                      ? '通用服务端'
                      : advancedToolIntent.reason === 'bridge_or_proxy_choice'
                        ? '桥接工具二选一'
                        : advancedToolIntent.kind === 'bridge' ? 'UDP 广播桥' : advancedToolIntent.kind === 'udp' ? 'UDP 代理' : 'TCP 代理'}
                </span>
                {advancedToolIntent.display_name ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">{advancedToolIntent.display_name}</span>
                ) : null}
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {advancedToolIntent.reason === 'steam_relay_p2p'
                  ? '该路线需要先检查 Steam 连接工具文件夹，再创建或加入房间'
                  : advancedToolIntent.reason === 'generic_server'
                    ? '该路线需要先选择服务端文件，再启动和检测端口'
                    : advancedToolIntent.reason === 'bridge_or_proxy_choice'
                      ? '请先判断桥接工具该走哪条路'
                    : advancedToolIntent.reason === 'udp_broadcast_bridge' ? '该建议需要房间发现辅助' : '该建议需要端口辅助'}
              </h3>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
                {advancedToolIntent.reason === 'steam_relay_p2p'
                  ? '已自动选中 Steam Relay / P2P。请填写或检测 Steam 连接工具文件夹，确认 Steam 已登录，再按房主/加入者步骤操作。'
                  : advancedToolIntent.reason === 'generic_server'
                    ? '已自动选中通用服务端。请准备官方或游戏自带服务端文件，先做启动前检查，不要把本机预检当成好友已能加入。'
                    : advancedToolIntent.reason === 'bridge_or_proxy_choice'
                      ? '已打开桥接工具选择。若你有房主地址和端口，选端口代理；若好友看不到局域网房间列表，选 UDP 广播桥。'
                    : <>已填入监听端口 {advancedToolIntent.listen_port || listenPort}、目标 {advancedToolIntent.target_host || targetHost}:{advancedToolIntent.target_port || targetPort}。请先核对目标联机地址，再点击“挂载并上线”。</>}
              </p>
              {advancedToolIntent.note ? (
                <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-amber-800">{advancedToolIntent.note}</p>
              ) : null}
              {advancedToolIntent.evidence?.length ? (
                <div className="mt-2 flex flex-wrap gap-2" data-advanced-runtime-technical="details">
                  {advancedToolIntent.evidence.slice(0, 4).map((item) => (
                    <span key={item} className="rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold text-slate-600">{item}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button onClick={() => applyAdvancedToolIntent(advancedToolIntent)} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                重新套用信息
              </button>
              <button onClick={dismissAdvancedToolIntent} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                关闭建议
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-advanced-connection-methods="catalog">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Compass className="h-5 w-5 text-amber-600" />
              多联机方式入口
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              这里保留给管理员查看不同联机方式的接入状态。普通用户不需要逐项理解。
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {connectionMethodCatalog.filter((method) => method.status === '已接入').length} 个已接入
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {connectionMethodCatalog.map((method) => (
            <article key={method.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${methodStatusTone(method.status)}`}>
                  {method.status}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  {method.shortLabel}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-800">{method.title}</h4>
              <p className="mt-2 line-clamp-3 min-h-12 text-[11px] leading-relaxed text-slate-500">{method.whenToUse}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => selectMethod(method)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  {method.advancedToolKind ? '选择工具' : '查看入口'}
                </button>
                <button
                  onClick={() => copyMethodGuide(method)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                >
                  <ClipboardCopy className="h-3 w-3" />
                  复制说明
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-connection-capability-matrix="decision-table" data-advanced-connection-matrix="decision-table">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Compass className="h-5 w-5 text-amber-600" />
              联机方式能力矩阵 / 游戏类型决策表
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              这里用于管理员判断游戏类型并沉淀方案。普通用户只需要使用已保存的推荐方案。
            </p>
          </div>
          <button
            onClick={copyDecisionMatrix}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <ClipboardCopy className="h-4 w-4" />
            复制决策表
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-2 md:grid-cols-2">
            {connectionCapabilityMatrix.map((row) => {
              const selected = selectedDecision?.id === row.id;
              const methods = methodsForDecisionRow(row);
              return (
                <article
                  key={row.id}
                  className={`rounded-2xl border p-3 transition ${
                    selected ? 'border-amber-200 bg-amber-50/70' : 'border-slate-100 bg-slate-50/70 hover:border-slate-200'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">{row.verdictLabel}</span>
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">{row.routeKind}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">{row.gameType}</h4>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{row.capability}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {methods.length ? methods.map((method) => (
                      <span key={method.id} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {method.shortLabel}
                      </span>
                    )) : (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-rose-600">不推荐工具</span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => applyDecisionRow(row)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      选择类型
                    </button>
                    <button
                      onClick={() => copyDecisionRow(row)}
                      className="rounded-lg bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                    >
                      复制说明
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {selectedDecision ? (
            <aside className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-amber-700">当前决策</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">{selectedDecision.verdictLabel}</span>
              </div>
              <h4 className="text-base font-bold text-slate-800">{selectedDecision.gameType}</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{selectedDecision.userFacingResult}</p>
              <p className="mt-2 rounded-xl bg-white/70 p-3 text-[11px] leading-relaxed text-slate-600">
                <b className="text-slate-800">管理员决策：</b>{selectedDecision.operatorDecision}
              </p>
              <div className="mt-3 grid gap-3">
                <div className="rounded-xl bg-white/75 p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">方案信号</p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-slate-600">
                    {selectedDecision.adapterSignals.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl bg-white/75 p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">需要收集的证据</p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-slate-600">
                    {selectedDecision.evidenceToCollect.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl bg-white/75 p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">关键方案字段</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDecision.adapterFields.map((field) => (
                      <span key={field} className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-600">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="rounded-xl border border-amber-100 bg-white/75 p-3 text-[11px] leading-relaxed text-amber-800">
                  <b>风险：</b>{selectedDecision.riskNote}
                </p>
              </div>
            </aside>
          ) : null}
        </div>
      </section>

      <details className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-advanced-runtime-technical="details">
        <summary className="cursor-pointer text-sm font-bold text-slate-800">
          排查详情：运行记录和旧式高级配置
          <span className="ml-2 text-[11px] font-semibold text-slate-500">普通用户通常不需要展开</span>
        </summary>
        <div className="mt-4 grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-950 p-5 text-white shadow-sm" data-advanced-tool-explainer="details">
            <div className="mb-3 flex items-center gap-2 text-amber-300">
              <Waves className="h-4 w-4" />
              <h3 className="text-sm font-bold">这些工具解决什么</h3>
            </div>
            <ul className="space-y-3 text-xs leading-relaxed text-slate-200">
              <li><b className="text-amber-200">TCP/UDP 端口代理：</b>把本地监听端口转发到好友联机地址的指定游戏端口。</li>
              <li><b className="text-amber-200">UDP 广播桥：</b>把只在局域网广播里出现的大厅发现包转发到虚拟网段。</li>
              <li><b className="text-amber-200">通用服务端：</b>管理 exe、bat、cmd、jar 服务端进程和控制台命令。</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800">配置连接辅助</h3>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                链路类型
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as ToolKind)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400"
                >
                  <option value="tcp">TCP 端口代理</option>
                  <option value="udp">UDP 单播代理</option>
                  <option value="bridge">UDP 广播桥</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                本地监听端口
                <input value={listenPort} onChange={(event) => setListenPort(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                对端联机地址 / 广播目标
                <input value={targetHost} onChange={(event) => setTargetHost(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                对端端口
                <input value={targetPort} onChange={(event) => setTargetPort(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
              </label>
              <div className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                blockingRiskCount ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
              }`}>
                {blockingRiskCount
                  ? `还有 ${blockingRiskCount} 项连接信息需要确认。请先检查端口和对端联机地址。`
                  : '连接信息已满足启动条件。'}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3" data-advanced-tool-risk-check="preflight" data-advanced-tool-risk-detail="checks">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800">启动前连接信息检查</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    blockingRiskCount ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {blockingRiskCount ? `${blockingRiskCount} 项阻断` : '可启动'}
                  </span>
                </div>
                <div className="space-y-2">
                  {riskChecks.map((check) => (
                    <div key={check.id} className={`rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${riskTone(check.level)}`}>
                      <b>{check.label}：</b>{check.detail}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={startProxy} disabled={Boolean(busy)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  挂载并上线
                </button>
                <button onClick={() => selfTest(kind)} disabled={Boolean(busy)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  测试连接
                </button>
              </div>
              {advancedToolSelfTestRecap ? (
                <div className={`rounded-2xl border p-3 text-xs leading-relaxed ${
                  advancedToolSelfTestRecap.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-700'
                }`} data-advanced-tool-self-test-recap="latest">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{advancedToolSelfTestRecap.label}</p>
                      <p className="mt-1 font-mono">{advancedToolSelfTestRecap.params}</p>
                    </div>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold">
                      {advancedToolSelfTestRecap.ok ? '通过' : '失败'}
                    </span>
                  </div>
                  <p>{advancedToolSelfTestRecap.summary}</p>
                  {advancedToolSelfTestRecap.notes.length ? (
                    <p className="mt-1">备注：{advancedToolSelfTestRecap.notes.join('；')}</p>
                  ) : null}
                  <button onClick={copyAdvancedToolSelfTestRecap} className="mt-2 rounded-lg bg-white/85 px-3 py-1.5 text-[11px] font-bold text-slate-700 ring-1 ring-black/5 hover:bg-white">
                    复制检查结果
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-advanced-runtime-technical="details">
            <h3 className="mb-4 text-sm font-bold text-slate-800">通用服务端</h3>
            <div className="space-y-3">
              <input value={serverName} onChange={(event) => setServerName(event.target.value)} placeholder="游戏名" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              <input value={serverPath} onChange={(event) => setServerPath(event.target.value)} placeholder="服务端 exe/bat/cmd/jar 路径" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              <input value={serverPort} onChange={(event) => setServerPort(event.target.value)} placeholder="端口" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              <button onClick={startServer} disabled={Boolean(busy) || !serverPath.trim()} className="w-full rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60">
                挂载并运行专属服务端
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-advanced-runtime-technical="details">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">运行记录</h3>
                <p className="mt-1 text-xs text-slate-500">运行中 {runningCount} / 实例 {totalCount}</p>
              </div>
              {busy ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">处理中：{busy}</span> : null}
            </div>

            {runtime.errors.length ? (
              <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                {runtime.errors.slice(0, 3).map(toProductSafeMessage).join('；')}
              </div>
            ) : null}

            <div className="space-y-3">
              {proxyRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  当前没有高级链路实例。创建链路后会在这里出现状态。
                </div>
              ) : proxyRows.map((row) => (
                <div key={`${row.kind}-${row.id}`} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-white px-2 py-1 font-mono text-xs font-bold text-amber-700 shadow-sm">{row.type}</span>
                        {row.running ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-slate-400" />}
                        <span className="font-mono text-xs text-slate-500">{row.id}</span>
                      </div>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-800">{row.line}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.metrics}</p>
                      {row.error ? <p className="mt-1 text-xs text-rose-600">{row.error}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => selfTest(row.kind)} disabled={Boolean(busy)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                        检查
                      </button>
                      <button onClick={() => stopProxy(row)} disabled={Boolean(busy)} className="rounded-lg border border-rose-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                        停止
                      </button>
                    </div>
                  </div>
                  {lastLines(row.logs).length ? (
                    <pre className="mt-3 max-h-24 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">{lastLines(row.logs).join('\n')}</pre>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-advanced-runtime-technical="details">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">通用服务端会话</h3>
              </div>
              {server?.running ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">运行中</span> : <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">未运行</span>}
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
              <p>状态：{server?.message || '尚无服务端会话'}</p>
              <p>PID：{server?.pid ?? '-'}</p>
              <p>端口：{serverPort}</p>
              <p>就绪：{server?.ready ? '是' : '否'}｜曾经就绪：{server?.ever_ready ? '是' : '否'}</p>
            </div>

            <pre className="mt-3 max-h-52 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">
              {(server?.logs?.length ? lastLines(server.logs, 12) : ['暂无服务端日志。']).join('\n')}
            </pre>

            <div className="mt-3 flex gap-2">
              <input
                value={serverCommand}
                onChange={(event) => setServerCommand(event.target.value)}
                placeholder="输入服务端控制台命令，例如 help/save/exit"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400"
              />
              <button onClick={sendCommand} disabled={Boolean(busy) || !serverCommand.trim()} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                <Terminal className="h-4 w-4" />
                发送
              </button>
              <button onClick={stopServer} disabled={Boolean(busy) || !server?.running} className="inline-flex items-center gap-1 rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                <Square className="h-4 w-4" />
                停止
              </button>
            </div>
          </div>
        </section>
        </div>
      </details>
    </div>
  );
}
