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
  clearAdvancedToolIntent,
  readAdvancedToolIntent,
  type AdvancedToolIntent,
} from './advancedToolIntent';
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
  const [steamRelayStatus, setSteamRelayStatus] = useState<SteamRelayStatus | null>(null);
  const [steamRelayBusy, setSteamRelayBusy] = useState(false);

  useEffect(() => {
    refreshReferenceRuntime(false).catch(() => undefined);
  }, []);

  const refreshSteamRelayStatus = async () => {
    setSteamRelayBusy(true);
    try {
      setSteamRelayStatus(await getSteamRelayStatus());
    } catch (error) {
      onTriggerToast(`读取 Steam 中继状态失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSteamRelayBusy(false);
    }
  };

  useEffect(() => {
    refreshSteamRelayStatus().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyAdvancedToolIntent = (intent: AdvancedToolIntent) => {
    setKind(intent.kind);
    if (intent.listen_port) setListenPort(String(intent.listen_port));
    if (intent.target_port) setTargetPort(String(intent.target_port));
    if (intent.target_host) setTargetHost(intent.target_host);
    const decisionId = intent.reason === 'udp_broadcast_bridge'
      ? 'lan-discovery-broadcast'
      : intent.reason === 'port_proxy'
        ? 'port-proxy-needed'
        : selectedDecisionId;
    setSelectedDecisionId(decisionId);
  };

  useEffect(() => {
    if (!advancedToolIntent || advancedToolIntentApplied) return;
    applyAdvancedToolIntent(advancedToolIntent);
    setAdvancedToolIntentApplied(true);
    onTriggerToast('已根据诊断建议预填连接信息，请核对目标联机地址后再启动。');
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
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">
              特殊连接工具是什么
            </div>
            <h3 className="text-base font-black text-slate-900">当游戏“看得到人但连不上”或“看不到房间”时，用它补一段连接。</h3>
            <p className="mt-2 max-w-4xl text-xs leading-relaxed text-slate-700">
              开房邀请页会尽量自动带入端口和地址；你只需要核对数字是否和游戏显示一致，然后点击“挂载并上线”。挂载成功后，回到游戏里刷新房间或按邀请地址加入。
            </p>
          </div>
          <button
            onClick={startProxy}
            disabled={Boolean(busy) || blockingRiskCount > 0}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            挂载并上线
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-1 font-bold text-slate-900">端口代理</p>
            <p>游戏已经开了房，但好友连不上端口时使用。它会把本机入口转到房主或好友的游戏端口。</p>
            <p className="mt-2 text-[11px] text-slate-500">常见：Minecraft/Terraria 的 TCP 端口，或 Palworld 这类 UDP 服务端的备用方案。</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-1 font-bold text-slate-900">UDP 广播桥</p>
            <p>游戏靠“局域网房间列表”找房间，但好友列表里看不到房间时使用。它负责把房间发现信息带到联机房间里。</p>
            <p className="mt-2 text-[11px] text-slate-500">如果游戏支持直接输入 IP，优先直接输入房主地址，不必先开广播桥。</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-1 font-bold text-slate-900">通用服务端</p>
            <p>只有你已经有 server.exe、bat、cmd 或 server.jar 时才用。它负责托管服务端进程，不能替你下载或破解官方服务端。</p>
            <p className="mt-2 text-[11px] text-slate-500">更简单的路径：能在开房邀请页启动的游戏，优先从开房邀请页启动。</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {[
            '从开房邀请页进入，优先使用自动预填。',
            '核对端口：必须和游戏或服务端显示的一致。',
            '点击挂载并上线，再点测试连接。',
            '回到游戏里刷新房间或按邀请地址加入。'
          ].map((item, index) => (
            <div key={item} className="rounded-xl bg-white/75 p-3 text-xs leading-relaxed text-slate-600">
              <b className="text-slate-900">{index + 1}. </b>{item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-steam-relay-p2p="experimental">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">Steam 中继 / P2P（实验）</span>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${steamRelayStatus?.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {steamRelayStatus?.available ? '预检通过' : '仅预检，未启用真实连接'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">合法 Steamworks 预检和后续转发入口。</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
              这个入口用于后续通过 Steamworks Networking 建立两端 TCP 转发通道。当前未配置 Steamworks SDK 或 AppID 时不能启动真实连接。
              它不会修改游戏文件，不绕过 Steam 或游戏拥有权，也不会复制游戏目录里的 steam_api64.dll。
            </p>
          </div>
          <button
            onClick={refreshSteamRelayStatus}
            disabled={steamRelayBusy}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${steamRelayBusy ? 'animate-spin' : ''}`} />
            重新预检
          </button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {[
            ['Steam 客户端', steamRelayStatus?.steam_running ? '已运行' : '未检测到', steamRelayStatus?.steam_process_path || '请先启动并登录 Steam'],
            ['STEAMWORKS_SDK_DIR', steamRelayStatus?.steamworks_sdk_configured ? '已配置' : '未配置', steamRelayStatus?.steamworks_sdk_dir || '需要指向 Steamworks SDK 根目录'],
            ['SDK redist', steamRelayStatus?.redistributable_found ? '已找到' : '未找到', steamRelayStatus?.redistributable_path || '检查 redistributable_bin/win64/steam_api64.dll'],
            ['AppID', steamRelayStatus?.app_id_configured ? '已配置' : '未配置', steamRelayStatus?.app_id || '设置 STEAM_APP_ID 或 steam_appid.txt'],
          ].map(([label, status, detail]) => (
            <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-800">{label}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-600">{status}</p>
              <p className="mt-1 break-words text-[11px] leading-relaxed text-slate-500">{detail}</p>
            </div>
          ))}
        </div>
        {steamRelayStatus?.unavailable_reasons?.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-800">为什么现在不可用</p>
              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-amber-800">
                {steamRelayStatus.unavailable_reasons.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-800">下一步怎么配置</p>
              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-600">
                {steamRelayStatus.next_steps.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

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
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">诊断建议已预填</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                  {advancedToolIntent.kind === 'bridge' ? 'UDP 广播桥' : advancedToolIntent.kind === 'udp' ? 'UDP 代理' : 'TCP 代理'}
                </span>
                {advancedToolIntent.display_name ? (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">{advancedToolIntent.display_name}</span>
                ) : null}
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {advancedToolIntent.reason === 'udp_broadcast_bridge' ? '该诊断建议需要房间发现辅助' : '该诊断建议需要端口辅助'}
              </h3>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
                已填入监听端口 {advancedToolIntent.listen_port || listenPort}、目标 {advancedToolIntent.target_host || targetHost}:{advancedToolIntent.target_port || targetPort}。
                这里已自动填入连接信息，请先核对目标联机地址，再点击“挂载并上线”。
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

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
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
    </div>
  );
}
