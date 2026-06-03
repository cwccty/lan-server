import { useEffect, useRef, useState } from 'react';
import {
  getN2nDiagnostics,
  listUdpBroadcastBridges,
  listNetworkBackends,
  listPortProxies,
  listUdpProxies,
  setupNetwork,
  startNetwork,
  startPortProxy,
  startUdpBroadcastBridge,
  startUdpProxy,
  selfTestUdpBroadcastBridge,
  selfTestPortProxy,
  selfTestUdpProxy,
  stopNetwork,
  stopPortProxy,
  stopUdpBroadcastBridge,
  stopUdpProxy,
  testConnectivity,
  testPortProxy
} from '../api/tauri';
import { BackendCard } from '../components/BackendCard';
import { LoadingOverlay } from '../components/LoadingOverlay';
import type { BackendRuntimeStatus, BackendSummary, ConnectivityReport, N2nDiagnostics, SetupResult } from '../types/network';
import type { NetworkSetupPreset } from '../types/networkPreset';
import type { PortProxySelfTestReport, PortProxyStatus } from '../types/portProxy';
import type { UdpBroadcastBridgeSelfTestReport, UdpBroadcastBridgeStatus } from '../types/udpBroadcastBridge';
import type { UdpProxySelfTestReport, UdpProxyStatus } from '../types/udpProxy';

type SteamRelayDraft = {
  appId: string;
  roomName: string;
  relayMode: 'steam_datagram_relay' | 'steam_lobby_p2p';
  notes: string;
};

type FlowStep = {
  title: string;
  detail: string;
  state?: 'done' | 'active' | 'idle';
};

function FlowSteps({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="flow-steps" aria-label="页面操作步骤">
      {steps.map((step, index) => (
        <article className={`flow-step ${step.state ?? 'idle'}`} key={step.title}>
          <span className="flow-step-index">{index + 1}</span>
          <div>
            <strong>{step.title}</strong>
            <small>{step.detail}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

type NetworkSetupCache = {
  backends: BackendSummary[];
  n2nDiagnostics: N2nDiagnostics | null;
  portProxyStatus: PortProxyStatus | null;
  udpProxyStatus: UdpProxyStatus | null;
  udpBroadcastBridgeStatus: UdpBroadcastBridgeStatus | null;
  savedAt: number;
};

const NETWORK_SETUP_CACHE_KEY = 'lan-helper-network-setup-cache';
let networkSetupAutoLoadedOnce = false;

function readNetworkSetupCache(): NetworkSetupCache | null {
  try {
    const raw = window.localStorage.getItem(NETWORK_SETUP_CACHE_KEY);
    return raw ? JSON.parse(raw) as NetworkSetupCache : null;
  } catch {
    return null;
  }
}

function writeNetworkSetupCache(cache: NetworkSetupCache) {
  try {
    window.localStorage.setItem(NETWORK_SETUP_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore localStorage quota or compatibility failures.
  }
}

function ConnectivityReportView({ report }: { report: ConnectivityReport }) {
  return (
    <div className={report.reachable ? 'result-ok' : 'result-bad'}>
      <h4>{report.reachable ? '连接成功' : '连接失败'}</h4>
      <p>目标：{report.target_host}</p>
      {report.latency_ms !== undefined && <p>延迟：{report.latency_ms} ms</p>}
      <ul>
        {report.ports.map((port) => (
          <li key={port.port}>
            端口 {port.port}：{port.reachable ? '可达' : '不可达'}
            {port.latency_ms !== undefined ? `，${port.latency_ms} ms` : ''}
            {port.error ? `，${port.error}` : ''}
          </li>
        ))}
      </ul>
      <h5>判断建议</h5>
      <ul>
        {report.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function BackendRuntimeStatusView({ status }: { status: BackendRuntimeStatus }) {
  return (
    <div className={status.running ? 'result-ok' : 'result-idle'}>
      <h4>{status.running ? 'n2n edge 正在运行' : 'n2n edge 未运行'}</h4>
      <p>{status.message}</p>
      {status.virtual_ip && <p>当前虚拟 IP：{status.virtual_ip}</p>}
    </div>
  );
}

function SetupResultView({ result }: { result: SetupResult }) {
  return (
    <div className={result.ok ? 'result-ok' : 'result-bad'}>
      <h4>{result.ok ? '配置已保存' : '配置未完成'}</h4>
      <p>{result.message}</p>
    </div>
  );
}

function PortProxyStatusView({ status }: { status: PortProxyStatus }) {
  return (
    <div className={status.running ? 'result-ok' : 'result-idle'}>
      <h4>{status.running ? 'TCP 端口代理正在运行' : 'TCP 端口代理未运行'}</h4>
      <p>{status.listen || '未监听'} → {status.target || '未设置目标'}</p>
      <ul>
        <li>当前连接：{status.active_connections}</li>
        <li>历史连接：{status.total_connections}</li>
        <li>上行字节：{status.bytes_in}</li>
        <li>下行字节：{status.bytes_out}</li>
      </ul>
      {status.last_error && <p className="muted">最近错误：{status.last_error}</p>}
      {status.logs.length > 0 && (
        <details>
          <summary>查看端口代理日志</summary>
          <pre className="console-panel">{status.logs.slice(-20).join('\n')}</pre>
        </details>
      )}
    </div>
  );
}

function PortProxySelfTestView({ report }: { report: PortProxySelfTestReport }) {
  return (
    <div className={report.ok ? 'result-ok' : 'result-bad'}>
      <h4>{report.ok ? 'TCP 端口代理自测通过' : 'TCP 端口代理自测失败'}</h4>
      <p>自测链路：{report.listen} → {report.target}</p>
      <ul>
        <li>发送内容：{report.sent}</li>
        <li>收到内容：{report.received || '无返回'}</li>
        <li>历史连接：{report.total_connections}</li>
        <li>上行字节：{report.bytes_in}</li>
        <li>下行字节：{report.bytes_out}</li>
      </ul>
      <h5>自测步骤</h5>
      <ul>
        {report.notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </div>
  );
}

function UdpProxyStatusView({ status }: { status: UdpProxyStatus }) {
  return (
    <div className={status.running ? 'result-ok' : 'result-idle'}>
      <h4>{status.running ? 'UDP 端口代理正在运行' : 'UDP 端口代理未运行'}</h4>
      <p>{status.listen || '未监听'} → {status.target || '未设置目标'}</p>
      <ul>
        <li>活跃客户端：{status.active_clients}</li>
        <li>收包数：{status.packets_in}</li>
        <li>发包数：{status.packets_out}</li>
        <li>上行字节：{status.bytes_in}</li>
        <li>下行字节：{status.bytes_out}</li>
      </ul>
      {status.last_error && <p className="muted">最近错误：{status.last_error}</p>}
      {status.logs.length > 0 && (
        <details>
          <summary>查看 UDP 代理日志</summary>
          <pre className="console-panel">{status.logs.slice(-20).join('\n')}</pre>
        </details>
      )}
    </div>
  );
}

function UdpProxySelfTestView({ report }: { report: UdpProxySelfTestReport }) {
  return (
    <div className={report.ok ? 'result-ok' : 'result-bad'}>
      <h4>{report.ok ? 'UDP 端口代理自测通过' : 'UDP 端口代理自测失败'}</h4>
      <p>自测链路：{report.listen} → {report.target}</p>
      <ul>
        <li>发送内容：{report.sent}</li>
        <li>收到内容：{report.received || '无返回'}</li>
        <li>收包数：{report.packets_in}</li>
        <li>发包数：{report.packets_out}</li>
        <li>上行字节：{report.bytes_in}</li>
        <li>下行字节：{report.bytes_out}</li>
      </ul>
      <h5>自测步骤</h5>
      <ul>
        {report.notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </div>
  );
}

function UdpBroadcastBridgeStatusView({ status }: { status: UdpBroadcastBridgeStatus }) {
  return (
    <div className={status.running ? 'result-ok' : 'result-idle'}>
      <h4>{status.running ? 'UDP 广播桥正在运行' : 'UDP 广播桥未运行'}</h4>
      <p>{status.listen || '未监听'} → {status.forward_targets.length ? status.forward_targets.join('，') : '未设置转发目标'}</p>
      <ul>
        <li>收到发现包：{status.received_packets}</li>
        <li>转发发现包：{status.forwarded_packets}</li>
        <li>丢弃包：{status.dropped_packets}</li>
        <li>上行字节：{status.bytes_in}</li>
        <li>下行字节：{status.bytes_out}</li>
      </ul>
      {status.last_error && <p className="muted">最近错误：{status.last_error}</p>}
      {status.logs.length > 0 && (
        <details>
          <summary>查看 UDP 广播桥日志</summary>
          <pre className="console-panel">{status.logs.slice(-20).join('\n')}</pre>
        </details>
      )}
    </div>
  );
}

function UdpBroadcastBridgeSelfTestView({ report }: { report: UdpBroadcastBridgeSelfTestReport }) {
  return (
    <div className={report.ok ? 'result-ok' : 'result-bad'}>
      <h4>{report.ok ? 'UDP 广播桥自测通过' : 'UDP 广播桥自测失败'}</h4>
      <p>自测监听：{report.listen}</p>
      <p>转发目标：{report.forward_targets.join('，')}</p>
      <ul>
        <li>发送内容：{report.sent}</li>
        <li>收到内容：{report.received || '无返回'}</li>
        <li>收到发现包：{report.received_packets}</li>
        <li>转发发现包：{report.forwarded_packets}</li>
        <li>丢弃包：{report.dropped_packets}</li>
        <li>上行字节：{report.bytes_in}</li>
        <li>下行字节：{report.bytes_out}</li>
      </ul>
      <h5>自测步骤</h5>
      <ul>
        {report.notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </div>
  );
}

function recentSupernodeFromBackends(backends: BackendSummary[]) {
  const n2n = backends.find((backend) => backend.id === 'n2n');
  const note = n2n?.notes.find((item) => item.startsWith('最近一次 supernode:') || item.startsWith('最近一次 supernode：'));
  return note?.replace(/^最近一次 supernode[:：]\s*/, '').trim() || '';
}

type NetworkStatusKind = 'good' | 'warn' | 'bad' | 'idle';

type NetworkStatusCardData = {
  title: string;
  value: string;
  kind: NetworkStatusKind;
  evidence: string;
  detail: string;
};

function statusBadgeClass(kind: NetworkStatusKind) {
  if (kind === 'good') return 'badge good';
  if (kind === 'warn') return 'badge warn';
  if (kind === 'bad') return 'badge bad';
  return 'badge';
}

function NetworkStatusCard({ item }: { item: NetworkStatusCardData }) {
  return (
    <article className={'status-tile status-' + item.kind}>
      <div className="feature-card-title">
        <span>{item.title}</span>
        <span className={statusBadgeClass(item.kind)}>{item.value}</span>
      </div>
      <strong>{item.evidence}</strong>
      <small>{item.detail}</small>
    </article>
  );
}

function suggestAlternativeIps(currentIp: string) {
  const trimmed = currentIp.trim();
  const match = trimmed.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  const base = match ? match.slice(1, 4).join('.') : '10.10.10';
  const currentLast = match ? Number(match[4]) : 2;
  const reserved = new Set([0, 1, 255, currentLast]);
  const suggestions: string[] = [];
  for (let last = 2; last <= 254 && suggestions.length < 4; last += 1) {
    if (!reserved.has(last)) suggestions.push(base + '.' + last);
  }
  return suggestions.length > 0 ? suggestions : ['10.10.10.3', '10.10.10.4', '10.10.10.5'];
}

function buildN2nAdminSummary(
  diagnostics: N2nDiagnostics | null,
  localIp: string,
  peerIp: string,
  supernode: string,
  roomName: string
) {
  const recentLogs = diagnostics?.recent_logs.slice(-20) ?? ['暂无'];
  return [
    '【联机助手 n2n 诊断摘要】',
    `生成时间：${new Date().toLocaleString()}`,
    '',
    `supernode：${supernode.trim() || '未填写'}`,
    `community：${roomName.trim() || '未填写'}`,
    `本机期望虚拟 IP：${localIp.trim() || '未填写'}`,
    `对方 / 房主虚拟 IP：${peerIp.trim() || '未填写'}`,
    '',
    `edge 运行：${diagnostics?.running ? '是' : '否'}`,
    `supernode 已配置：${diagnostics?.supernode_configured ? '是' : '否'}`,
    `ACK：${diagnostics?.ack ? '是' : '否'}`,
    `PONG：${diagnostics?.pong ? '是' : '否'}`,
    `认证错误：${diagnostics?.auth_error ? '是' : '否'}`,
    `IP / MAC 冲突：${diagnostics?.ip_mac_conflict ? '是' : '否'}`,
    `supernode 无响应：${diagnostics?.not_responding ? '是' : '否'}`,
    '',
    `结论：${diagnostics?.summary || '暂无诊断结果'}`,
    diagnostics?.last_error ? `最近错误：${diagnostics.last_error}` : '',
    `日志路径：${diagnostics?.log_path || '暂无'}`,
    '',
    '最近日志：',
    ...recentLogs
  ].filter(Boolean).join('\n');
}

export function NetworkSetupPage({ onNext, preset }: { onNext: () => void; preset?: NetworkSetupPreset }) {
  const cachedNetworkSetup = readNetworkSetupCache();
  const [backends, setBackends] = useState<BackendSummary[]>(cachedNetworkSetup?.backends ?? []);
  const [host, setHost] = useState('127.0.0.1');
  const [ports, setPorts] = useState('7777');
  const [report, setReport] = useState<ConnectivityReport | null>(null);
  const [roomName, setRoomName] = useState('lan-helper-room-001');
  const [secret, setSecret] = useState('lan-helper-secret');
  const [supernode, setSupernode] = useState('');
  const [localIp, setLocalIp] = useState('10.10.10.2');
  const [peerIp, setPeerIp] = useState('10.10.10.3');
  const [gamePort, setGamePort] = useState('7777');
  const [proxyListenHost, setProxyListenHost] = useState('0.0.0.0');
  const [proxyListenPort, setProxyListenPort] = useState('7777');
  const [proxyTargetHost, setProxyTargetHost] = useState('127.0.0.1');
  const [proxyTargetPort, setProxyTargetPort] = useState('7777');
  const [udpProxyListenHost, setUdpProxyListenHost] = useState('0.0.0.0');
  const [udpProxyListenPort, setUdpProxyListenPort] = useState('7777');
  const [udpProxyTargetHost, setUdpProxyTargetHost] = useState('127.0.0.1');
  const [udpProxyTargetPort, setUdpProxyTargetPort] = useState('7777');
  const [udpBridgeListenHost, setUdpBridgeListenHost] = useState('0.0.0.0');
  const [udpBridgeListenPort, setUdpBridgeListenPort] = useState('7777');
  const [udpBridgeTargets, setUdpBridgeTargets] = useState('10.10.10.3:7777');
  const [localReport, setLocalReport] = useState<ConnectivityReport | null>(null);
  const [peerReport, setPeerReport] = useState<ConnectivityReport | null>(null);
  const [portProxyStatus, setPortProxyStatus] = useState<PortProxyStatus | null>(cachedNetworkSetup?.portProxyStatus ?? null);
  const [portProxyReport, setPortProxyReport] = useState<ConnectivityReport | null>(null);
  const [portProxySelfTest, setPortProxySelfTest] = useState<PortProxySelfTestReport | null>(null);
  const [udpProxyStatus, setUdpProxyStatus] = useState<UdpProxyStatus | null>(cachedNetworkSetup?.udpProxyStatus ?? null);
  const [udpProxySelfTest, setUdpProxySelfTest] = useState<UdpProxySelfTestReport | null>(null);
  const [udpBroadcastBridgeStatus, setUdpBroadcastBridgeStatus] = useState<UdpBroadcastBridgeStatus | null>(cachedNetworkSetup?.udpBroadcastBridgeStatus ?? null);
  const [udpBroadcastBridgeSelfTest, setUdpBroadcastBridgeSelfTest] = useState<UdpBroadcastBridgeSelfTestReport | null>(null);
  const [n2nResult, setN2nResult] = useState<SetupResult | BackendRuntimeStatus | null>(null);
  const [n2nDiagnostics, setN2nDiagnostics] = useState<N2nDiagnostics | null>(cachedNetworkSetup?.n2nDiagnostics ?? null);
  const [n2nAutoRefresh, setN2nAutoRefresh] = useState<{ reason: string; startedAt: number } | null>(null);
  const [presetNotice, setPresetNotice] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(!cachedNetworkSetup && !networkSetupAutoLoadedOnce);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [networkLoadError, setNetworkLoadError] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState(cachedNetworkSetup?.savedAt ?? 0);
  const autoRefreshInFlightRef = useRef(false);
  const [steamRelayDraft, setSteamRelayDraft] = useState<SteamRelayDraft>({
    appId: '',
    roomName: 'steam-relay-room-001',
    relayMode: 'steam_datagram_relay',
    notes: '预留 connecttool-qt 类路线：通过 Steam Networking / Relay 做房间发现和中继。'
  });

  const saveNetworkCache = (
    nextBackends = backends,
    nextDiagnostics = n2nDiagnostics,
    nextPortProxyStatus = portProxyStatus,
    nextUdpProxyStatus = udpProxyStatus,
    nextUdpBroadcastBridgeStatus = udpBroadcastBridgeStatus
  ) => {
    const savedAt = Date.now();
    setLastRefreshAt(savedAt);
    writeNetworkSetupCache({
      backends: nextBackends,
      n2nDiagnostics: nextDiagnostics,
      portProxyStatus: nextPortProxyStatus,
      udpProxyStatus: nextUdpProxyStatus,
      udpBroadcastBridgeStatus: nextUdpBroadcastBridgeStatus,
      savedAt
    });
  };

  const refreshBackends = () =>
    Promise.all([listNetworkBackends(), getN2nDiagnostics().catch(() => null)])
      .then(([items, diagnostics]) => {
        setBackends(items);
        setN2nDiagnostics(diagnostics);
        setNetworkLoadError('');
        saveNetworkCache(items, diagnostics, portProxyStatus, udpProxyStatus, udpBroadcastBridgeStatus);
        const recentSupernode = recentSupernodeFromBackends(items);
        if (recentSupernode) {
          setSupernode((current) => current.trim() ? current : recentSupernode);
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error || '未知错误');
        setNetworkLoadError(`刷新网络后端失败：${message}。已保留上次检测结果，请稍后重试。`);
      });

  const refreshPortProxy = () =>
    listPortProxies()
      .then((items) => {
        const nextStatus = items.find((item) => item.id === 'default') ?? items[0] ?? null;
        setPortProxyStatus(nextStatus);
        setNetworkLoadError('');
        saveNetworkCache(backends, n2nDiagnostics, nextStatus, udpProxyStatus, udpBroadcastBridgeStatus);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error || '未知错误');
        setNetworkLoadError(`刷新 TCP 端口代理状态失败：${message}。已保留上次检测结果，请稍后重试。`);
      });

  const refreshUdpProxy = () =>
    listUdpProxies()
      .then((items) => {
        const nextStatus = items.find((item) => item.id === 'default') ?? items[0] ?? null;
        setUdpProxyStatus(nextStatus);
        setNetworkLoadError('');
        saveNetworkCache(backends, n2nDiagnostics, portProxyStatus, nextStatus, udpBroadcastBridgeStatus);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error || '未知错误');
        setNetworkLoadError(`刷新 UDP 端口代理状态失败：${message}。已保留上次检测结果，请稍后重试。`);
      });

  const refreshUdpBroadcastBridge = () =>
    listUdpBroadcastBridges()
      .then((items) => {
        const nextStatus = items.find((item) => item.id === 'default') ?? items[0] ?? null;
        setUdpBroadcastBridgeStatus(nextStatus);
        setNetworkLoadError('');
        saveNetworkCache(backends, n2nDiagnostics, portProxyStatus, udpProxyStatus, nextStatus);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error || '未知错误');
        setNetworkLoadError(`刷新 UDP 广播桥状态失败：${message}。已保留上次检测结果，请稍后重试。`);
      });

  useEffect(() => {
    const loadInitialState = async () => {
      if (networkSetupAutoLoadedOnce) {
        setInitialLoading(false);
        setBackgroundRefreshing(false);
        return;
      }
      networkSetupAutoLoadedOnce = true;
      try {
        if (cachedNetworkSetup) {
          setBackgroundRefreshing(false);
        } else {
          setInitialLoading(true);
        }
        await Promise.all([refreshBackends(), refreshPortProxy(), refreshUdpProxy(), refreshUdpBroadcastBridge()]);
      } finally {
        setInitialLoading(false);
        setBackgroundRefreshing(false);
      }
    };

    loadInitialState();
    const saved = window.localStorage.getItem('lan-helper-steam-relay-draft');
    if (!saved) {
      return;
    }
    try {
      const state = JSON.parse(saved) as SteamRelayDraft;
      setSteamRelayDraft((current) => ({ ...current, ...state }));
    } catch {
      // Ignore incompatible old Steam relay draft state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('lan-helper-steam-relay-draft', JSON.stringify(steamRelayDraft));
  }, [steamRelayDraft]);

  useEffect(() => {
    if (!preset) return;
    if (preset.defaultPort && Number.isInteger(preset.defaultPort) && preset.defaultPort > 0) {
      const nextPort = String(preset.defaultPort);
      setGamePort(nextPort);
      setPorts(nextPort);
      setProxyListenPort(nextPort);
      setProxyTargetPort(nextPort);
    }
    setPresetNotice(
      [
        `已从推荐方案带入：${preset.displayName || preset.gameId || '未知游戏'}`,
        preset.defaultPort ? `默认端口 ${preset.defaultPort}` : '未声明默认端口',
        preset.capability ? `能力类型 ${preset.capability}` : '',
        preset.recommendedMethods?.length ? `推荐方式 ${preset.recommendedMethods.join(', ')}` : ''
      ].filter(Boolean).join('；')
    );
  }, [preset?.appliedAt]);

  const runAction = async <T,>(label: string, action: () => Promise<T>, onDone?: (value: T) => void) => {
    if (busy) return;
    try {
      setNetworkLoadError('');
      setActionMessage('');
      setBusy(label);
      const value = await action();
      onDone?.(value);
      await Promise.all([refreshBackends(), refreshPortProxy(), refreshUdpProxy(), refreshUdpBroadcastBridge()]);
      const backendMessage =
        value && typeof value === 'object' && 'message' in value && typeof (value as { message?: unknown }).message === 'string'
          ? `：${(value as { message: string }).message}`
          : '';
      setActionMessage(`${label}已完成${backendMessage}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '未知错误');
      setNetworkLoadError(`${label}失败：${message}`);
      setActionMessage('');
    } finally {
      setBusy(null);
    }
  };

  const refreshAllNetworkState = () =>
    runAction('刷新组网状态', async () => {
      await Promise.all([refreshBackends(), refreshPortProxy(), refreshUdpProxy(), refreshUdpBroadcastBridge()]);
      return true;
    });

  const refreshPortProxyWithFeedback = () =>
    runAction('刷新 TCP 端口代理状态', async () => {
      await refreshPortProxy();
      return true;
    });

  const refreshUdpProxyWithFeedback = () =>
    runAction('刷新 UDP 端口代理状态', async () => {
      await refreshUdpProxy();
      return true;
    });

  const refreshUdpBroadcastBridgeWithFeedback = () =>
    runAction('刷新 UDP 广播桥状态', async () => {
      await refreshUdpBroadcastBridge();
      return true;
    });

  const friendConfigText = [
    '【联机助手通用组网邀请】',
    '',
    '这个配置不绑定具体游戏。组网成功后，支持 LAN/IP 直连的游戏都可以尝试连接房主虚拟 IP。',
    '',
    `community：${roomName}`,
    `密钥：${secret}`,
    `supernode：${supernode || '先填写你的 supernode 地址'}`,
    `你的虚拟 IP：${peerIp}`,
    `房主虚拟 IP：${localIp}`,
    `房主 TCP 端口代理：${portProxyStatus?.running ? `${portProxyStatus.listen} -> ${portProxyStatus.target}` : '未启动 / 不需要时可忽略'}`,
    `房主 UDP 端口代理：${udpProxyStatus?.running ? `${udpProxyStatus.listen} -> ${udpProxyStatus.target}` : '未启动 / 不需要时可忽略'}`,
    `UDP 广播桥：${udpBroadcastBridgeStatus?.running ? `${udpBroadcastBridgeStatus.listen} -> ${udpBroadcastBridgeStatus.forward_targets.join('、')}` : '未启动 / 只有房间列表发现不到时才需要'}`,
    `建议游戏端口：${gamePort}`,
    '',
    '操作：',
    '1. 打开联机助手 → 通用组网中心。',
    '2. 填写相同 community / 密钥 / supernode。',
    '3. 你的虚拟 IP 填上面分配给你的地址，不能和房主重复。',
    '4. 启动 n2n edge。',
    `5. 在游戏里选择 LAN / Join via IP，连接 ${localIp}:${gamePort}。`
  ].join('\n');

  const n2nAdminSummary = buildN2nAdminSummary(n2nDiagnostics, localIp, peerIp, supernode, roomName);

  const parsedGamePort = Number(gamePort.trim()) || 7777;
  const parsedProxyListenPort = Number(proxyListenPort.trim());
  const parsedProxyTargetPort = Number(proxyTargetPort.trim());
  const parsedUdpProxyListenPort = Number(udpProxyListenPort.trim());
  const parsedUdpProxyTargetPort = Number(udpProxyTargetPort.trim());
  const parsedUdpBridgeListenPort = Number(udpBridgeListenPort.trim());
  const udpBridgeTargetList = udpBridgeTargets
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const proxyPortsValid =
    Number.isInteger(parsedProxyListenPort) &&
    parsedProxyListenPort > 0 &&
    Number.isInteger(parsedProxyTargetPort) &&
    parsedProxyTargetPort > 0;
  const udpProxyPortsValid =
    Number.isInteger(parsedUdpProxyListenPort) &&
    parsedUdpProxyListenPort > 0 &&
    Number.isInteger(parsedUdpProxyTargetPort) &&
    parsedUdpProxyTargetPort > 0;
  const udpBridgeConfigValid =
    Number.isInteger(parsedUdpBridgeListenPort) &&
    parsedUdpBridgeListenPort > 0 &&
    udpBridgeTargetList.length > 0;
  const n2nBackend = backends.find((backend) => backend.id === 'n2n');
  const n2nRuntimeResult = n2nResult && 'running' in n2nResult ? n2nResult : null;
  const n2nSetupResult = n2nResult && 'ok' in n2nResult ? n2nResult : null;
  const n2nRecordedRunning = Boolean(n2nBackend?.notes.some((note) => note.includes('PID')));
  const n2nRunning = Boolean(n2nDiagnostics?.running || n2nRuntimeResult?.running || n2nRecordedRunning);
  const supernodeValue = supernode.trim();
  const supernodeOk = Boolean(n2nDiagnostics?.ok_link && !n2nDiagnostics.auth_error && !n2nDiagnostics.ip_mac_conflict);
  const supernodeProblem = Boolean(n2nDiagnostics?.auth_error || n2nDiagnostics?.ip_mac_conflict || n2nDiagnostics?.not_responding);
  const hasRecommendationPreset = Boolean(preset?.gameId || preset?.displayName);
  const nextActionLabel = hasRecommendationPreset ? '返回推荐方案继续执行游戏步骤' : '生成推荐方案';
  const alternativeLocalIps = suggestAlternativeIps(localIp);
  const networkStatusCards: NetworkStatusCardData[] = [
    {
      title: 'n2n edge',
      value: n2nRunning ? '运行中' : n2nBackend?.available ? '可启动' : '未检测到',
      kind: n2nRunning ? 'good' : n2nBackend?.available ? 'warn' : 'bad',
      evidence: n2nRuntimeResult?.message || n2nBackend?.notes.find((note) => note.includes('edge')) || '等待后端检测 edge.exe / n2n.exe',
      detail: '来自后端文件检测、记录 PID 与启动/停止操作结果。'
    },
    {
      title: 'supernode',
      value: supernodeOk ? 'ACK / PONG' : supernodeProblem ? '存在问题' : supernodeValue ? (n2nRunning ? '等待 ACK' : '已填写') : '未配置',
      kind: supernodeOk ? 'good' : supernodeProblem ? 'bad' : supernodeValue ? 'warn' : 'bad',
      evidence: n2nDiagnostics?.summary || supernodeValue || '请填写 VPS_IP:端口，例如 154.64.231.137:7777',
      detail: n2nDiagnostics ? 'ACK=' + n2nDiagnostics.ack + ' PONG=' + n2nDiagnostics.pong + ' 认证错误=' + n2nDiagnostics.auth_error + ' IP/MAC冲突=' + n2nDiagnostics.ip_mac_conflict : '这里只表示配置存在，不伪装成 supernode 已响应。'
    },
    {
      title: '虚拟网卡',
      value: n2nBackend?.virtual_ip ? '已检测' : n2nBackend?.available ? '待分配 IP' : '未检测',
      kind: n2nBackend?.virtual_ip ? 'good' : n2nBackend?.available ? 'warn' : 'idle',
      evidence: n2nBackend?.virtual_ip ? '检测到 TAP/n2n/cfw/edge 相关 IPv4' : '尚未从系统网卡检测到 n2n 虚拟 IP',
      detail: '来自 Windows 网卡 IPv4 扫描，不是前端静态显示。'
    },
    {
      title: '虚拟 IP',
      value: n2nDiagnostics?.virtual_ip || n2nBackend?.virtual_ip || n2nRuntimeResult?.virtual_ip || '未分配',
      kind: n2nDiagnostics?.virtual_ip || n2nBackend?.virtual_ip || n2nRuntimeResult?.virtual_ip ? 'good' : 'warn',
      evidence: localIp ? '当前配置期望：' + localIp : '未填写本机虚拟 IP',
      detail: '显示“检测值 / 期望值”，用于发现 IP 冲突或 TAP 未生效。'
    }
  ];

  useEffect(() => {
    if (!n2nAutoRefresh) return;

    const elapsedMs = Date.now() - n2nAutoRefresh.startedAt;
    const shouldStop =
      supernodeOk ||
      supernodeProblem ||
      (n2nDiagnostics !== null && !n2nDiagnostics.running) ||
      elapsedMs > 60000;

    if (shouldStop) {
      setN2nAutoRefresh(null);
      return;
    }

    const tick = () => {
      if (autoRefreshInFlightRef.current) return;
      autoRefreshInFlightRef.current = true;
      refreshBackends().finally(() => {
        autoRefreshInFlightRef.current = false;
      });
    };

    tick();
    const timer = window.setInterval(tick, 2500);
    return () => window.clearInterval(timer);
  }, [n2nAutoRefresh, supernodeOk, supernodeProblem, n2nDiagnostics?.running]);

  const steamRelayPacketText = [
    '【Steam 中继联机入口草案】',
    '状态：预留入口 / 研究功能，当前不会真正启动 Steamworks。',
    `Steam AppID：${steamRelayDraft.appId || '未填写'}`,
    `房间名：${steamRelayDraft.roomName}`,
    `模式：${steamRelayDraft.relayMode === 'steam_datagram_relay' ? 'Steam Datagram Relay' : 'Steam Lobby P2P'}`,
    `说明：${steamRelayDraft.notes || '无'}`,
    '',
    '产品边界：只做官方 Steam Networking/Relay SDK 或用户自有 AppID 的可选插件入口；不做破解服务器、绕过正版验证、绕过反作弊或模拟官方账号服务。',
    '后续制作点：Steamworks SDK 封装、房间创建/加入、成员状态、聊天/信令、与端口代理或虚拟 LAN 的桥接。'
  ].join('\n');

  const copyFriendConfig = async () => {
    await navigator.clipboard?.writeText(friendConfigText);
    setCopyMessage('通用组网配置已复制，可以发给朋友。');
  };

  const copyN2nAdminSummary = async () => {
    await navigator.clipboard?.writeText(n2nAdminSummary);
    setCopyMessage('n2n 诊断摘要已复制，可以发给管理员或发到项目 issue。');
  };

  const copySteamRelayDraft = async () => {
    await navigator.clipboard?.writeText(steamRelayPacketText);
    setCopyMessage('Steam 中继入口草案已复制，可作为后续插件制作说明。');
  };

  const startDefaultPortProxy = () =>
    runAction(
      '启动 TCP 端口代理',
      () => startPortProxy({
        id: 'default',
        protocol: 'tcp',
        listen_host: proxyListenHost.trim() || '0.0.0.0',
        listen_port: parsedProxyListenPort,
        target_host: proxyTargetHost.trim() || '127.0.0.1',
        target_port: parsedProxyTargetPort,
        label: '通用房主端口代理',
        game_id: preset?.gameId
      }),
      setPortProxyStatus
    );

  const stopDefaultPortProxy = () =>
    runAction('停止 TCP 端口代理', () => stopPortProxy(portProxyStatus?.id || 'default'), setPortProxyStatus);

  const testDefaultPortProxy = () =>
    runAction('测试 TCP 端口代理', () => testPortProxy(portProxyStatus?.id || 'default'), setPortProxyReport);

  const runPortProxySelfTest = () =>
    runAction('一键自测 TCP 端口代理', () => selfTestPortProxy(), setPortProxySelfTest);

  const startDefaultUdpProxy = () =>
    runAction(
      '启动 UDP 端口代理',
      () => startUdpProxy({
        id: 'default',
        listen_host: udpProxyListenHost.trim() || '0.0.0.0',
        listen_port: parsedUdpProxyListenPort,
        target_host: udpProxyTargetHost.trim() || '127.0.0.1',
        target_port: parsedUdpProxyTargetPort,
        label: '通用房主 UDP 端口代理',
        game_id: preset?.gameId,
        client_ttl_seconds: 30
      }),
      setUdpProxyStatus
    );

  const stopDefaultUdpProxy = () =>
    runAction('停止 UDP 端口代理', () => stopUdpProxy(udpProxyStatus?.id || 'default'), setUdpProxyStatus);

  const runUdpProxySelfTest = () =>
    runAction('一键自测 UDP 端口代理', () => selfTestUdpProxy(), setUdpProxySelfTest);

  const startDefaultUdpBroadcastBridge = () =>
    runAction(
      '启动 UDP 广播桥',
      () => startUdpBroadcastBridge({
        id: 'default',
        listen_host: udpBridgeListenHost.trim() || '0.0.0.0',
        listen_port: parsedUdpBridgeListenPort,
        forward_targets: udpBridgeTargetList,
        label: '通用 UDP 广播桥',
        game_id: preset?.gameId,
        allow_broadcast: true,
        duplicate_ttl_ms: 800
      }),
      setUdpBroadcastBridgeStatus
    );

  const stopDefaultUdpBroadcastBridge = () =>
    runAction('停止 UDP 广播桥', () => stopUdpBroadcastBridge(udpBroadcastBridgeStatus?.id || 'default'), setUdpBroadcastBridgeStatus);

  const runUdpBroadcastBridgeSelfTest = () =>
    runAction('一键自测 UDP 广播桥', () => selfTestUdpBroadcastBridge(), setUdpBroadcastBridgeSelfTest);

  return (
    <section className="page-stack network-page modern-content-page">
      <LoadingOverlay
        visible={initialLoading || Boolean(busy)}
        title={initialLoading ? '正在加载通用组网状态' : `正在处理：${busy ?? ''}`}
        message={initialLoading ? '首次进入需要读取 n2n、网卡、端口代理和日志状态，请稍等。' : '请稍等，不要重复点击按钮或关闭程序。'}
      />
      <div className="content-hero network-hero">
        <div>
          <span className="eyebrow">NETWORK</span>
          <h2>通用组网中心</h2>
          <p className="muted">
            先让房主和朋友进入同一个虚拟局域网。组网成功后，支持 LAN 或 IP 直连的游戏通常可以连接房主虚拟 IP。
          </p>
        </div>
        <span className={n2nRunning ? 'badge good' : 'badge warn'}>{n2nRunning ? '组网进程运行中' : '等待启动组网'}</span>
      </div>

      <FlowSteps
        steps={[
          { title: '填写房间信息', detail: '双方使用同一房间名、密钥和 supernode。', state: supernode.trim() && roomName.trim() && secret.trim() ? 'done' : 'active' },
          { title: '启动 n2n', detail: '等待 ACK / PONG，确认虚拟 IP 已分配。', state: supernodeOk ? 'done' : n2nRunning ? 'active' : 'idle' },
          { title: '复制邀请', detail: '把组网配置和游戏端口发给朋友。', state: supernodeOk ? 'active' : 'idle' },
          { title: '失败时诊断', detail: '用下方检测区分组网、端口或游戏问题。', state: supernodeProblem ? 'active' : 'idle' }
        ]}
      />

      {busy && <div className="busy-banner">正在处理：{busy}，请稍等，不要重复点击。</div>}
      {backgroundRefreshing && !busy && !initialLoading && (
        <div className="busy-banner">正在后台刷新组网状态。页面先显示上次检测结果，刷新完成后会自动更新。</div>
      )}
      {lastRefreshAt > 0 && !backgroundRefreshing && !initialLoading && (
        <div className="notice-card">
          <strong>状态缓存：</strong>当前页面优先显示上次检测结果，最近刷新时间：{new Date(lastRefreshAt).toLocaleString()}。
        </div>
      )}
      {networkLoadError && (
        <div className="error-card">
          <strong>组网状态提示：</strong>{networkLoadError}
        </div>
      )}
      {actionMessage && !networkLoadError && !busy && (
        <div className="status-banner">
          <strong>操作结果：</strong>{actionMessage}
        </div>
      )}
      {n2nAutoRefresh && !busy && (
        <div className="busy-banner">正在自动刷新 n2n 状态：{n2nAutoRefresh.reason}。检测到 ACK/PONG、错误、进程停止或 60 秒超时后会自动停止。</div>
      )}
      {presetNotice && (
        <div className="notice-card">
          <strong>推荐方案参数已带入：</strong>{presetNotice}。你仍然需要填写 supernode、确认每台电脑虚拟 IP 不重复，并启动 n2n edge。
        </div>
      )}
      {hasRecommendationPreset && supernodeOk && (
        <article className="card conversion-card">
          <div className="feature-card-title">
            <div>
              <h3>组网已连上，可以继续游戏步骤</h3>
              <p className="muted">
                已从 edge 日志检测到 supernode ACK/PONG。下一步回到推荐方案，继续执行该游戏的服务端启动、端口检测或邀请好友步骤。
              </p>
            </div>
            <span className="badge good">ACK / PONG</span>
          </div>
          <div className="actions">
            <button type="button" onClick={onNext} disabled={Boolean(busy)}>返回推荐方案继续</button>
          </div>
        </article>
      )}

      <div className="status-grid">
        {networkStatusCards.map((item) => <NetworkStatusCard key={item.title} item={item} />)}
      </div>

      <div className="notice-card">
        <strong>真实状态说明：</strong>edge、虚拟网卡、虚拟 IP 来自后端检测；supernode 必须从 edge 日志解析到 REGISTER_SUPER_ACK、PONG 或 [OK] 才显示正常。
      </div>

      {n2nDiagnostics?.ip_mac_conflict && (
        <article className="card error-card">
          <div className="feature-card-title">
            <h3>检测到 IP / MAC 冲突</h3>
            <span className="badge bad">需要更换虚拟 IP</span>
          </div>
          <p>
            edge 日志显示当前虚拟 IP 或 MAC 仍被 supernode 认为已占用。常见原因是：同一个虚拟 IP 被另一台电脑使用，
            或上一次异常退出后 supernode 尚未释放旧注册。
          </p>
          <p className="muted">当前配置期望 IP：{localIp || '未填写'}。请给每台电脑分配不同虚拟 IP。</p>
          <div className="actions">
            {alternativeLocalIps.map((ip) => (
              <button key={ip} type="button" className="secondary" onClick={() => setLocalIp(ip)} disabled={Boolean(busy)}>
                改用 {ip}
              </button>
            ))}
          </div>
          <ol>
            <li>点击上方候选 IP，或手动填写一个未被朋友使用的地址。</li>
            <li>点击“保存 n2n 配置”。</li>
            <li>点击“停止 n2n edge”，再重新“启动 n2n edge”。</li>
            <li>等待 10~20 秒后刷新状态，确认 supernode 变为 ACK / PONG。</li>
          </ol>
          {n2nDiagnostics.last_error && <p className="muted">最近日志证据：{n2nDiagnostics.last_error}</p>}
        </article>
      )}

      <article className="card">
        <h3>当前网络后端</h3>
        {backends.map((backend) => <BackendCard key={backend.id} backend={backend} />)}
        {backends.length === 0 && !initialLoading && <p className="muted">尚未读取到网络后端状态。可以点击刷新，或查看上方失败提示。</p>}
        <button onClick={refreshAllNetworkState} disabled={Boolean(busy) || initialLoading}>刷新组网状态</button>
      </article>

      <article className="card primary-config-card network-config-panel">
        <div className="section-kicker"><span>主要步骤</span><strong>n2n 内置组网</strong></div>
        <p className="muted">每台玩家电脑运行 edge；supernode 负责让这些 edge 找到彼此。双方必须填写相同的 community、密钥和 supernode，但本机虚拟 IP 必须不同。</p>
        <label>房间名 / community<input value={roomName} onChange={(event) => setRoomName(event.target.value)} disabled={Boolean(busy)} /><small className="muted">相当于房间号。朋友必须填写完全相同的值。</small></label>
        <label>密钥<input value={secret} onChange={(event) => setSecret(event.target.value)} disabled={Boolean(busy)} /><small className="muted">相当于房间密码。朋友必须填写完全相同的值。</small></label>
        <label>supernode 地址<input value={supernode} onChange={(event) => setSupernode(event.target.value)} placeholder="host:port" disabled={Boolean(busy)} /><small className="muted">例如：你的 VPS IP:7777。没有 supernode 时，n2n 无法完成异地发现。</small></label>
        <label>本机虚拟 IP<input value={localIp} onChange={(event) => setLocalIp(event.target.value)} placeholder="例如 10.10.10.2" disabled={Boolean(busy)} /><small className="muted">房主建议填 10.10.10.2，朋友建议填 10.10.10.3、10.10.10.4 等。</small></label>
        <label>对方 / 房主虚拟 IP<input value={peerIp} onChange={(event) => setPeerIp(event.target.value)} placeholder="例如 10.10.10.3" disabled={Boolean(busy)} /><small className="muted">房主可填朋友 IP 用于测试；加入者这里填房主 IP。</small></label>
        <label>游戏端口，可按游戏修改<input value={gamePort} onChange={(event) => setGamePort(event.target.value)} disabled={Boolean(busy)} /><small className="muted">Terraria 默认 7777，Minecraft Java 默认 25565。其他游戏使用自己的 LAN/IP 端口。</small></label>

        <div className="actions">
          <button disabled={Boolean(busy)} onClick={() => runAction('保存 n2n 配置', () => setupNetwork('n2n', { room_name: roomName, secret, supernode, local_ip: localIp || undefined }), setN2nResult)}>保存 n2n 配置</button>
          <button disabled={Boolean(busy)} onClick={() => runAction('启动 n2n edge', () => startNetwork('n2n'), (value) => { setN2nResult(value); setN2nAutoRefresh({ reason: '等待 supernode ACK / PONG', startedAt: Date.now() }); })}>启动 n2n edge</button>
          <button disabled={Boolean(busy) || !n2nRunning} onClick={() => runAction('停止 n2n edge', () => stopNetwork('n2n'), (value) => { setN2nResult(value); setN2nAutoRefresh(null); })}>停止 n2n edge</button>
        </div>

        <article className="config-panel">
          <h4>当前 n2n 状态</h4>
          {n2nBackend ? (
            <>
              <p>{n2nBackend.available ? '已检测到 edge.exe / n2n.exe。' : '尚未检测到 edge.exe / n2n.exe。'}</p>
              {n2nBackend.virtual_ip && <p>检测到虚拟 IP：{n2nBackend.virtual_ip}</p>}
              <ul>{n2nBackend.notes.map((note) => <li key={note}>{note}</li>)}</ul>
            </>
          ) : <p className="muted">尚未读取 n2n 状态。</p>}
          {n2nSetupResult && <SetupResultView result={n2nSetupResult} />}
          {n2nRuntimeResult && <BackendRuntimeStatusView status={n2nRuntimeResult} />}
          {n2nDiagnostics && (
            <div className={supernodeOk ? 'result-ok' : supernodeProblem ? 'result-bad' : 'result-idle'}>
              <h4>supernode 响应诊断</h4>
              <p>{n2nDiagnostics.summary}</p>
              <p>日志文件：{n2nDiagnostics.log_path}</p>
              {n2nDiagnostics.last_error && <p>最近错误：{n2nDiagnostics.last_error}</p>}
              <div className="actions">
                <button type="button" className="secondary" onClick={copyN2nAdminSummary} disabled={Boolean(busy)}>复制给管理员的诊断摘要</button>
              </div>
              <p className="muted">摘要不会包含 n2n 密钥，只包含 supernode、community、虚拟 IP、ACK/PONG、错误状态和最近日志。</p>
              {copyMessage && <p className="muted">{copyMessage}</p>}
              <details>
                <summary>查看最近 edge 日志</summary>
                <pre className="console-panel">{n2nDiagnostics.recent_logs.join('\n') || '暂无 edge 日志。启动 n2n edge 后会自动捕获。'}</pre>
              </details>
            </div>
          )}
        </article>

        <details>
          <summary>复制给朋友的通用组网配置</summary>
          <pre>{friendConfigText}</pre>
          <button type="button" onClick={copyFriendConfig} disabled={Boolean(busy)}>复制通用组网配置</button>
          {copyMessage && <p className="muted">{copyMessage}</p>}
        </details>
      </article>

      <div className="section-header">
        <div>
          <h3>高级辅助能力</h3>
          <p className="muted">只有推荐方案或诊断报告提示需要时，再打开这些能力。</p>
        </div>
      </div>

      <article className="card feature-card pending-feature advanced-card proxy-panel tcp-proxy-panel">
        <div className="feature-card-title">
          <h3>房主 TCP 端口代理</h3>
          <span className={portProxyStatus?.running ? 'badge good' : 'badge warn'}>
            {portProxyStatus?.running ? '运行中' : '未启动'}
          </span>
        </div>
        <p className="muted">
          端口代理用于房主侧：把朋友访问“房主虚拟 IP:监听端口”的 TCP 流量转发到房主本机真实游戏服务端。
          例如游戏只监听 <code>127.0.0.1:7777</code> 时，可启动 <code>0.0.0.0:7777 → 127.0.0.1:7777</code>。
          它不是替代 n2n，必须先保证双方已经在同一个虚拟局域网里。
        </p>
        <div className="room-grid">
          <section className="config-panel">
            <h4>监听设置</h4>
            <label>监听地址<input value={proxyListenHost} onChange={(event) => setProxyListenHost(event.target.value)} disabled={Boolean(busy)} /><small className="muted">房主侧建议 0.0.0.0；测试时也可填 127.0.0.1。</small></label>
            <label>监听端口<input value={proxyListenPort} onChange={(event) => setProxyListenPort(event.target.value)} disabled={Boolean(busy)} /><small className="muted">朋友在游戏里连接房主虚拟 IP 时使用的端口。</small></label>
          </section>
          <section className="config-panel">
            <h4>目标游戏服务端</h4>
            <label>目标地址<input value={proxyTargetHost} onChange={(event) => setProxyTargetHost(event.target.value)} disabled={Boolean(busy)} /><small className="muted">通常是 127.0.0.1，表示房主本机游戏服务端。</small></label>
            <label>目标端口<input value={proxyTargetPort} onChange={(event) => setProxyTargetPort(event.target.value)} disabled={Boolean(busy)} /><small className="muted">通常和游戏端口一致，例如 Terraria 7777。</small></label>
          </section>
        </div>
        {!proxyPortsValid && <p className="result-bad">监听端口和目标端口必须是大于 0 的数字。</p>}
        <div className="actions">
          <button type="button" disabled={Boolean(busy) || !proxyPortsValid} onClick={startDefaultPortProxy}>启动 TCP 端口代理</button>
          <button type="button" className="secondary" disabled={Boolean(busy) || !portProxyStatus?.running} onClick={stopDefaultPortProxy}>停止 TCP 端口代理</button>
          <button type="button" className="secondary" disabled={Boolean(busy) || !portProxyStatus?.running} onClick={testDefaultPortProxy}>测试代理监听</button>
          <button type="button" className="secondary" disabled={Boolean(busy)} onClick={runPortProxySelfTest}>一键自测 TCP 代理</button>
          <button type="button" className="secondary" disabled={Boolean(busy)} onClick={refreshPortProxyWithFeedback}>刷新代理状态</button>
        </div>
        {portProxyStatus && <PortProxyStatusView status={portProxyStatus} />}
        {portProxyReport && <ConnectivityReportView report={portProxyReport} />}
        {portProxySelfTest && <PortProxySelfTestView report={portProxySelfTest} />}
        <div className="notice-card">
          <strong>使用方式：</strong>房主启动 n2n 和游戏服务端后，再启动此代理；朋友仍然在游戏里连接房主虚拟 IP：
          <code>{localIp || '房主虚拟IP'}:{proxyListenPort || gamePort}</code>。
        </div>
      </article>

      <article className="card feature-card pending-feature">
        <div className="feature-card-title">
          <h3>房主 UDP 端口代理</h3>
          <span className={udpProxyStatus?.running ? 'badge good' : 'badge warn'}>
            {udpProxyStatus?.running ? '运行中' : '未启动'}
          </span>
        </div>
        <p className="muted">
          UDP 端口代理用于已知 IP/端口的 UDP 单播转发：把朋友访问“房主虚拟 IP:UDP 监听端口”的数据转发到房主本机游戏 UDP 端口。
          它不同于 UDP 广播桥，不能负责 LAN 房间列表发现；如果游戏依赖广播/组播发现，后续仍需要广播桥能力。
        </p>
        <div className="room-grid">
          <section className="config-panel">
            <h4>UDP 监听设置</h4>
            <label>监听地址<input value={udpProxyListenHost} onChange={(event) => setUdpProxyListenHost(event.target.value)} disabled={Boolean(busy)} /><small className="muted">房主侧建议 0.0.0.0；测试时也可填 127.0.0.1。</small></label>
            <label>监听端口<input value={udpProxyListenPort} onChange={(event) => setUdpProxyListenPort(event.target.value)} disabled={Boolean(busy)} /><small className="muted">朋友访问房主虚拟 IP 时使用的 UDP 端口。</small></label>
          </section>
          <section className="config-panel">
            <h4>目标 UDP 游戏端口</h4>
            <label>目标地址<input value={udpProxyTargetHost} onChange={(event) => setUdpProxyTargetHost(event.target.value)} disabled={Boolean(busy)} /><small className="muted">通常是 127.0.0.1，表示房主本机游戏 UDP 服务。</small></label>
            <label>目标端口<input value={udpProxyTargetPort} onChange={(event) => setUdpProxyTargetPort(event.target.value)} disabled={Boolean(busy)} /><small className="muted">填写游戏实际使用的 UDP 端口。</small></label>
          </section>
        </div>
        {!udpProxyPortsValid && <p className="result-bad">UDP 监听端口和目标端口必须是大于 0 的数字。</p>}
        <div className="actions">
          <button type="button" disabled={Boolean(busy) || !udpProxyPortsValid} onClick={startDefaultUdpProxy}>启动 UDP 端口代理</button>
          <button type="button" className="secondary" disabled={Boolean(busy) || !udpProxyStatus?.running} onClick={stopDefaultUdpProxy}>停止 UDP 端口代理</button>
          <button type="button" className="secondary" disabled={Boolean(busy)} onClick={runUdpProxySelfTest}>一键自测 UDP 代理</button>
          <button type="button" className="secondary" disabled={Boolean(busy)} onClick={refreshUdpProxyWithFeedback}>刷新 UDP 代理状态</button>
        </div>
        {udpProxyStatus && <UdpProxyStatusView status={udpProxyStatus} />}
        {udpProxySelfTest && <UdpProxySelfTestView report={udpProxySelfTest} />}
        <div className="notice-card">
          <strong>使用方式：</strong>只有当游戏支持已知 IP/端口的 UDP 直连时才使用它。朋友连接：
          <code>{localIp || '房主虚拟IP'}:{udpProxyListenPort || gamePort}</code>。
          如果问题是“游戏列表看不到房间”，这通常是广播发现问题，不是 UDP 单播代理问题。
        </div>
      </article>

      <article className="card feature-card pending-feature">
        <div className="feature-card-title">
          <h3>UDP 广播桥</h3>
          <span className={udpBroadcastBridgeStatus?.running ? 'badge good' : 'badge warn'}>
            {udpBroadcastBridgeStatus?.running ? '运行中' : '未启动'}
          </span>
        </div>
        <p className="muted">
          广播桥用于“游戏房间列表发现”：把本机收到的 UDP 发现包转发到指定虚拟 IP 或广播地址。
          它只辅助发现房间，不保证最终加入成功；加入仍取决于游戏端口、协议、账号系统、反作弊和组网状态。
        </p>
        <div className="room-grid">
          <section className="config-panel">
            <h4>监听发现包</h4>
            <label>监听地址<input value={udpBridgeListenHost} onChange={(event) => setUdpBridgeListenHost(event.target.value)} disabled={Boolean(busy)} /><small className="muted">通常填 0.0.0.0；测试时可填 127.0.0.1。</small></label>
            <label>监听端口<input value={udpBridgeListenPort} onChange={(event) => setUdpBridgeListenPort(event.target.value)} disabled={Boolean(busy)} /><small className="muted">填写游戏用于 LAN 发现的 UDP 端口，不一定等于加入端口。</small></label>
          </section>
          <section className="config-panel">
            <h4>转发目标</h4>
            <label>目标列表
              <textarea value={udpBridgeTargets} onChange={(event) => setUdpBridgeTargets(event.target.value)} disabled={Boolean(busy)} rows={4} />
              <small className="muted">每行或逗号分隔一个目标，例如 10.10.10.3:7777、10.10.10.255:7777 或 255.255.255.255:7777。</small>
            </label>
          </section>
        </div>
        {!udpBridgeConfigValid && <p className="result-bad">UDP 广播桥需要大于 0 的监听端口，并至少填写一个 host:port 转发目标。</p>}
        <div className="actions">
          <button type="button" disabled={Boolean(busy) || !udpBridgeConfigValid} onClick={startDefaultUdpBroadcastBridge}>启动 UDP 广播桥</button>
          <button type="button" className="secondary" disabled={Boolean(busy) || !udpBroadcastBridgeStatus?.running} onClick={stopDefaultUdpBroadcastBridge}>停止 UDP 广播桥</button>
          <button type="button" className="secondary" disabled={Boolean(busy)} onClick={runUdpBroadcastBridgeSelfTest}>一键自测 UDP 广播桥</button>
          <button type="button" className="secondary" disabled={Boolean(busy)} onClick={refreshUdpBroadcastBridgeWithFeedback}>刷新广播桥状态</button>
        </div>
        {udpBroadcastBridgeStatus && <UdpBroadcastBridgeStatusView status={udpBroadcastBridgeStatus} />}
        {udpBroadcastBridgeSelfTest && <UdpBroadcastBridgeSelfTestView report={udpBroadcastBridgeSelfTest} />}
        <div className="notice-card">
          <strong>边界说明：</strong>如果游戏支持直接输入 IP，请优先连接房主虚拟 IP；只有“组网已通但房间列表看不到”时，再尝试广播桥。
          广播桥与 UDP 端口代理不同：前者帮助发现房间，后者转发已知 IP/端口的 UDP 数据。
        </div>
      </article>

      <article className="card feature-card pending-feature">
        <div className="feature-card-title">
          <h3>Steam 中继联机入口（预留）</h3>
          <span className="badge warn">研究 / 插件路线</span>
        </div>
        <p className="muted">
          这里预留你之前提到的 connecttool-qt 类方向：借助 Steam Networking / Steam Relay 做房间发现、P2P 或中继。
          当前它只是产品入口和制作草案，不会真正启动 Steamworks，也不会影响 n2n 主线。
        </p>
        <div className="room-grid">
          <section className="config-panel">
            <h4>制作入口参数</h4>
            <label>Steam AppID / 测试 AppID<input value={steamRelayDraft.appId} onChange={(event) => setSteamRelayDraft((current) => ({ ...current, appId: event.target.value }))} placeholder="例如用户自有 AppID；测试阶段可留空" disabled={Boolean(busy)} /></label>
            <label>Steam 房间名<input value={steamRelayDraft.roomName} onChange={(event) => setSteamRelayDraft((current) => ({ ...current, roomName: event.target.value }))} disabled={Boolean(busy)} /></label>
            <label>中继模式
              <select value={steamRelayDraft.relayMode} onChange={(event) => setSteamRelayDraft((current) => ({ ...current, relayMode: event.target.value as SteamRelayDraft['relayMode'] }))} disabled={Boolean(busy)}>
                <option value="steam_datagram_relay">Steam Datagram Relay</option>
                <option value="steam_lobby_p2p">Steam Lobby P2P</option>
              </select>
            </label>
            <label>制作备注<input value={steamRelayDraft.notes} onChange={(event) => setSteamRelayDraft((current) => ({ ...current, notes: event.target.value }))} disabled={Boolean(busy)} /></label>
          </section>
          <section className="config-panel">
            <h4>当前边界</h4>
            <ul>
              <li>这是后续预留能力，当前版本暂不可直接使用。</li>
              <li>只走官方 Steamworks / Steam Networking 能力或用户自有 AppID。</li>
              <li>不做破解服务器、绕过正版验证、绕过反作弊、模拟官方账号服务。</li>
              <li>后续会在确认可用后再开放给普通用户。</li>
            </ul>
          </section>
        </div>
        <details>
          <summary>查看 Steam 中继入口草案</summary>
          <pre>{steamRelayPacketText}</pre>
          <button type="button" onClick={copySteamRelayDraft} disabled={Boolean(busy)}>复制 Steam 中继制作草案</button>
        </details>
      </article>

      <article className="card">
        <h3>通用联机排查</h3>
        <p className="muted">先测房主本机 127.0.0.1，确认游戏服务端或房间真的监听端口；再测房主虚拟 IP，区分是游戏没开还是组网/防火墙不通。</p>
        <div className="actions">
          <button disabled={Boolean(busy)} onClick={() => runAction('测试本机游戏端口', () => testConnectivity({ host: '127.0.0.1', ports: [parsedGamePort], timeout_ms: 1200, mode: 'local_game_port' }), setLocalReport)}>测本机游戏端口</button>
          <button disabled={Boolean(busy)} onClick={() => runAction('测试对方虚拟 IP 游戏端口', () => testConnectivity({ host: peerIp, ports: [parsedGamePort], timeout_ms: 1600, mode: 'n2n_game_port' }), setPeerReport)}>测对方 / 房主虚拟 IP 端口</button>
        </div>
        {localReport && <ConnectivityReportView report={localReport} />}
        {peerReport && <ConnectivityReportView report={peerReport} />}
      </article>

      <article className="card">
        <h3>手动连接测试</h3>
        <p className="muted">适用于 Radmin、ZeroTier、Tailscale、同一局域网，或你已经知道对方 IP 和端口的情况。</p>
        <label>目标 IP / 域名<input value={host} onChange={(event) => setHost(event.target.value)} disabled={Boolean(busy)} /></label>
        <label>端口，多个用英文逗号分隔<input value={ports} onChange={(event) => setPorts(event.target.value)} disabled={Boolean(busy)} /></label>
        <button disabled={Boolean(busy)} onClick={() => runAction('测试手动连接', () => testConnectivity({ host, ports: ports.split(',').map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0), timeout_ms: 1200, mode: 'generic' }), setReport)}>测试连接</button>
        {report && <ConnectivityReportView report={report} />}
      </article>

      <button onClick={onNext} disabled={Boolean(busy)}>{nextActionLabel}</button>
    </section>
  );
}
