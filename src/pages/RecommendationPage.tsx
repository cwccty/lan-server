import { useEffect, useMemo, useState } from 'react';
import { analyzeGame, getN2nDiagnostics, getN2nLastConfig, launchProfile, readServerSession, recommendPlans, testConnectivity } from '../api/tauri';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { RecommendationCard } from '../components/RecommendationCard';
import type { GameAnalysis, LaunchProfile } from '../types/game';
import type { N2nDiagnostics, ConnectivityReport, NetworkConfig } from '../types/network';
import type { LaunchConfig, LaunchResult, Recommendation } from '../types/recommendation';
import type { ServerSessionStatus } from '../types/serverSession';
import type { NetworkSetupPreset } from '../types/networkPreset';

type ProfileConfigState = Record<string, LaunchConfig>;
type ChecklistKind = 'good' | 'warn' | 'bad' | 'idle';

type ChecklistItem = {
  title: string;
  status: string;
  kind: ChecklistKind;
  detail: string;
};

type FriendIpAllocation = {
  id: string;
  name: string;
  ip: string;
  createdAt: number;
};

const FRIEND_ALLOCATIONS_STORAGE_KEY = 'lan-helper-friend-ip-allocations';

function defaultConfig(profile?: LaunchProfile): LaunchConfig {
  const config: LaunchConfig = {};
  for (const field of profile?.config_fields ?? []) config[field.id] = field.default_value ?? '';
  return config;
}

const capabilityLabels: Record<string, string> = {
  native_lan_ip: '原生 LAN/IP 直连',
  hidden_dedicated_server: '隐藏 / 独立服务端',
  lan_discovery_broadcast: '局域网广播发现',
  tcp_udp_proxy_possible: '可尝试端口代理',
  community_mod: '社区 Mod 联机',
  official_only: '仅官方 / 平台联机',
  unsupported: '暂不支持转换',
  unknown: '未知，需要人工适配'
};

const methodLabels: Record<string, string> = {
  virtual_lan: '虚拟局域网',
  dedicated_server_launcher: '服务端启动器',
  broadcast_bridge: '广播桥',
  port_proxy: '端口代理',
  mod_installer: 'Mod 安装器',
  steam_relay_plugin: 'Steam Relay 插件',
  manual_guide: '手动说明',
  not_supported: '不支持'
};

const sourceLabels: Record<string, string> = {
  builtin: '内置适配器',
  registry: '共享库适配器',
  custom: '本地自定义适配器',
  steam_scan: 'Steam 自动扫描'
};

const methodOrder = [
  'virtual_lan',
  'dedicated_server_launcher',
  'broadcast_bridge',
  'port_proxy',
  'mod_installer',
  'steam_relay_plugin',
  'manual_guide',
  'not_supported'
];

function badgeClass(kind: ChecklistKind) {
  if (kind === 'good') return 'badge good';
  if (kind === 'warn') return 'badge warn';
  if (kind === 'bad') return 'badge bad';
  return 'badge';
}

function parseIpv4(value?: string) {
  const match = value?.trim().match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)(?:\/\d+)?$/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

function suggestFriendIp(hostIp: string | undefined, allocations: FriendIpAllocation[]) {
  const parsed = parseIpv4(hostIp);
  const base = parsed ? parsed.slice(0, 3).join('.') : '10.10.10';
  const hostLast = parsed ? parsed[3] : 2;
  const used = new Set([0, 1, 255, hostLast, ...allocations.map((item) => parseIpv4(item.ip)?.[3]).filter((item): item is number => typeof item === 'number')]);
  for (let last = 2; last <= 254; last += 1) {
    if (!used.has(last)) return `${base}.${last}`;
  }
  return `${base}.254`;
}

function loadFriendAllocations() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FRIEND_ALLOCATIONS_STORAGE_KEY) || '[]') as FriendIpAllocation[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.name && item?.ip) : [];
  } catch {
    return [];
  }
}

function ConversionProfileView({ analysis }: { analysis: GameAnalysis }) {
  const profile = analysis.multiplayer_conversion;
  if (!profile) {
    return (
      <article className="card error-card">
        <h3>联机能力转换判断</h3>
        <p>该游戏还没有转换画像，暂时不能判断能否转换成本地 / 局域网体验。</p>
      </article>
    );
  }

  return (
    <article className={profile.can_convert_to_lan ? 'card conversion-card' : 'card error-card'}>
      <div className="feature-card-title">
        <div>
          <h3>联机能力转换判断</h3>
          <p className="muted">根据适配器画像给出判断，不等于点击后已经联机。</p>
        </div>
        <span className={profile.can_convert_to_lan ? 'badge good' : 'badge bad'}>{profile.can_convert_to_lan ? '可转换成 LAN' : '暂不承诺转换'}</span>
      </div>
      <div className="status-grid compact">
        <div className="status-tile"><span>能力类型</span><strong>{capabilityLabels[profile.capability] ?? profile.capability}</strong><small>{profile.capability}</small></div>
        <div className="status-tile"><span>风险等级</span><strong>{profile.risk_level}</strong><small>由适配器声明</small></div>
        <div className="status-tile"><span>置信度</span><strong>{analysis.confidence}</strong><small>扫描与适配器匹配结果</small></div>
        <div className="status-tile"><span>适配器来源</span><strong>{sourceLabels[analysis.adapter_source ?? ''] ?? analysis.adapter_source ?? '未知'}</strong><small>custom &gt; registry &gt; builtin</small></div>
      </div>
      <h4>推荐转换方式</h4>
      <div className="badge-row">
        {methodOrder.map((method) => {
          const active = profile.methods.includes(method as never);
          const future = ['broadcast_bridge', 'port_proxy', 'mod_installer', 'steam_relay_plugin'].includes(method) && !active;
          return <span className={active ? 'badge good' : future ? 'badge warn' : 'badge'} key={method}>{methodLabels[method]} · {active ? '推荐/可用' : future ? '未来入口' : '不适用'}</span>;
        })}
      </div>
      <div className="content-with-aside">
        <div>
          <h4>所需组件</h4>
          <ul>{profile.required_components.map((component) => <li key={component}>{component}</li>)}</ul>
          <h4>判断说明</h4>
          <ul>{profile.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
        <aside className="right-panel">
          <h3>风险提示</h3>
          <p>官方服务器限定、反作弊 / 账号风险、Mod 依赖、管理员审核等必须在这里明确展示。</p>
          <span className="badge warn">应用前需要确认</span>
        </aside>
      </div>
    </article>
  );
}

function ExecutionChecklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="status-grid">
      {items.map((item) => (
        <article className={'status-tile status-' + item.kind} key={item.title}>
          <div className="feature-card-title">
            <span>{item.title}</span>
            <span className={badgeClass(item.kind)}>{item.status}</span>
          </div>
          <strong>{item.detail}</strong>
        </article>
      ))}
    </div>
  );
}

function buildChecklist(
  analysis: GameAnalysis | null,
  n2n: N2nDiagnostics | null,
  serverSession: ServerSessionStatus | null,
  localPortReport: ConnectivityReport | null,
  launchResult: LaunchResult | null
): ChecklistItem[] {
  const defaultPort = analysis?.default_ports[0] ?? 7777;
  const hasServerProfile = Boolean(analysis?.launch_profiles.some((profile) => profile.type === 'server'));
  const networkReady = Boolean(n2n?.ok_link && !n2n.auth_error && !n2n.ip_mac_conflict);
  const localPortReady = Boolean(localPortReport?.reachable);
  const launchOk = Boolean(launchResult?.ok);
  const serverReady = Boolean(serverSession?.ready || serverSession?.running || localPortReady || launchOk);

  return [
    {
      title: '1. 适配器判断',
      status: analysis?.multiplayer_conversion ? '已命中' : analysis ? '需人工适配' : '未选择',
      kind: analysis?.multiplayer_conversion ? 'good' : analysis ? 'warn' : 'idle',
      detail: analysis ? `${analysis.display_name} · ${sourceLabels[analysis.adapter_source ?? ''] ?? analysis.adapter_source ?? '未知来源'}` : '请先从游戏扫描页选择游戏。'
    },
    {
      title: '2. 通用组网',
      status: networkReady ? 'ACK / PONG' : n2n?.running ? '等待确认' : '未完成',
      kind: networkReady ? 'good' : n2n?.running ? 'warn' : 'idle',
      detail: n2n?.summary || '进入通用组网中心，启动 n2n edge 并等待 supernode ACK/PONG。'
    },
    {
      title: '3. 游戏启动 / 服务端',
      status: serverReady ? '已有迹象' : hasServerProfile ? '待启动' : '游戏内创建',
      kind: serverReady ? 'good' : hasServerProfile ? 'warn' : 'idle',
      detail: hasServerProfile
        ? serverSession?.message || launchResult?.message || '该游戏适配器声明了服务端启动项，请执行启动项或进入对应向导。'
        : '该游戏未声明独立服务端启动项，通常需要房主在游戏内创建房间或按说明操作。'
    },
    {
      title: '4. 本机端口监听',
      status: localPortReady ? '可连接' : localPortReport ? '不可达' : '未检测',
      kind: localPortReady ? 'good' : localPortReport ? 'bad' : 'idle',
      detail: localPortReport
        ? `${localPortReport.target_host}:${defaultPort} · ${localPortReport.notes.join('；')}`
        : `点击刷新执行清单后检测 127.0.0.1:${defaultPort}。`
    },
    {
      title: '5. 邀请好友',
      status: networkReady && (localPortReady || !hasServerProfile) ? '可以准备' : '等待前置',
      kind: networkReady && (localPortReady || !hasServerProfile) ? 'good' : 'warn',
      detail: networkReady
        ? `把房主虚拟 IP、端口 ${defaultPort} 和组网配置发给朋友；朋友仍需启动自己的 n2n。`
        : '先完成组网 ACK/PONG，再邀请好友测试。'
    }
  ];
}

function buildFriendInvitePacket(
  analysis: GameAnalysis | null,
  n2n: N2nDiagnostics | null,
  localPortReport: ConnectivityReport | null,
  serverSession: ServerSessionStatus | null,
  n2nConfig: NetworkConfig | null,
  includeSecret: boolean,
  friendName: string,
  friendIp: string,
  friendConnectivityReport: ConnectivityReport | null
) {
  const defaultPort = analysis?.default_ports[0] ?? 7777;
  const profile = analysis?.multiplayer_conversion;
  const networkReady = Boolean(n2n?.ok_link && !n2n.auth_error && !n2n.ip_mac_conflict);
  const localPortReady = Boolean(localPortReport?.reachable);
  const hostVirtualIp = n2n?.virtual_ip || '待确认';
  const canSendAsReady = Boolean(networkReady && localPortReady);

  return [
    '【联机助手 · 游戏邀请好友包】',
    '',
    `游戏：${analysis?.display_name || '未选择游戏'}`,
    `推荐判断：${profile ? capabilityLabels[profile.capability] ?? profile.capability : '暂无适配器判断'}`,
    `推荐方式：${profile?.methods.map((method) => methodLabels[method] ?? method).join('、') || '暂无'}`,
    `默认端口：${defaultPort}`,
    `房主虚拟 IP：${hostVirtualIp}`,
    `n2n community：${n2nConfig?.room_name || '待填写'}`,
    `n2n supernode：${n2nConfig?.supernode || n2n?.supernode || '待填写'}`,
    `邀请对象：${friendName || '未填写昵称'}`,
    `分配给你的虚拟 IP：${friendIp || '请让房主先分配一个不重复地址，例如 10.10.10.3'}`,
    `n2n 密钥：${includeSecret ? n2nConfig?.secret || '待填写' : '已隐藏，请让房主单独确认或勾选后复制'}`,
    '',
    '当前检测状态：',
    `- n2n 组网：${networkReady ? '已检测到 ACK/PONG' : '待确认 / 未完成'}`,
    `- 本机游戏端口：${localPortReady ? `127.0.0.1:${defaultPort} 可连接` : `127.0.0.1:${defaultPort} 待确认 / 不可达`}`,
    `- 服务端状态：${serverSession?.ready ? '已就绪' : serverSession?.running ? '运行中，等待就绪' : '未检测到独立服务端就绪'}`,
    `- 好友虚拟 IP 检测：${friendConnectivityReport ? (friendConnectivityReport.reachable ? `${friendConnectivityReport.target_host}:${defaultPort} 可达` : `${friendConnectivityReport.target_host}:${defaultPort} 不可达 / 待确认`) : '未检测'}`,
    '',
    canSendAsReady ? '结论：房主侧组网和本机端口已有可用证据，可以让朋友尝试加入。' : '结论：当前证据还不完整，建议先完成组网 ACK/PONG 和本机端口检测后再邀请。',
    '',
    '朋友操作：',
    '1. 先打开联机助手，进入通用组网中心。',
    `2. 使用上面的 n2n community、supernode 和密钥；你的虚拟 IP 填 ${friendIp || '房主分配给你的地址'}，不要和别人重复。`,
    '3. 启动 n2n edge，等待 ACK/PONG。',
    `4. 打开游戏，在 LAN / Join via IP / 直连入口连接 ${hostVirtualIp}:${defaultPort}。`,
    '',
    includeSecret
      ? '注意：这份邀请包含 n2n 密钥，请只发给要一起联机的人。'
      : '注意：这份邀请默认隐藏 n2n 密钥；如果要一次性发完整配置，请勾选“复制时包含 n2n 密钥”，或使用“通用组网中心 → 复制给朋友的通用组网配置”。'
  ].join('\n');
}

export function RecommendationPage({ gameId, onOpenNetwork }: { gameId?: string; onOpenNetwork?: (preset: NetworkSetupPreset) => void }) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [profileConfigs, setProfileConfigs] = useState<ProfileConfigState>({});
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isRefreshingChecklist, setIsRefreshingChecklist] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [n2nDiagnostics, setN2nDiagnostics] = useState<N2nDiagnostics | null>(null);
  const [serverSession, setServerSession] = useState<ServerSessionStatus | null>(null);
  const [localPortReport, setLocalPortReport] = useState<ConnectivityReport | null>(null);
  const [n2nConfig, setN2nConfig] = useState<NetworkConfig | null>(null);
  const [includeSecretInInvite, setIncludeSecretInInvite] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [selectedFriendIp, setSelectedFriendIp] = useState('');
  const [friendAllocations, setFriendAllocations] = useState<FriendIpAllocation[]>([]);
  const [friendConnectivityReport, setFriendConnectivityReport] = useState<ConnectivityReport | null>(null);
  const [isCheckingFriend, setIsCheckingFriend] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const profilesById = useMemo(() => {
    const map = new Map<string, LaunchProfile>();
    for (const profile of analysis?.launch_profiles ?? []) map.set(profile.id, profile);
    return map;
  }, [analysis]);

  const defaultPort = analysis?.default_ports[0] ?? 7777;
  const checklist = buildChecklist(analysis, n2nDiagnostics, serverSession, localPortReport, launchResult);
  const hostVirtualIp = n2nConfig?.local_ip || n2nDiagnostics?.virtual_ip;
  const nextSuggestedFriendIp = suggestFriendIp(hostVirtualIp, friendAllocations);
  const friendInvitePacket = buildFriendInvitePacket(analysis, n2nDiagnostics, localPortReport, serverSession, n2nConfig, includeSecretInInvite, friendName, selectedFriendIp, friendConnectivityReport);

  const refreshExecutionChecklist = async (nextAnalysis = analysis) => {
    setIsRefreshingChecklist(true);
    try {
      const port = nextAnalysis?.default_ports[0] ?? 7777;
      const [n2n, session, portReport] = await Promise.all([
        getN2nDiagnostics().catch(() => null),
        readServerSession().catch(() => null),
        testConnectivity({ host: '127.0.0.1', ports: [port], timeout_ms: 1000, mode: 'local_game_port' }).catch(() => null)
      ]);
      setN2nDiagnostics(n2n);
      setServerSession(session);
      setLocalPortReport(portReport);
      setN2nConfig(await getN2nLastConfig().catch(() => null));
    } finally {
      setIsRefreshingChecklist(false);
    }
  };

  useEffect(() => {
    setLaunchResult(null);
    setLaunchError(null);
    setAnalysis(null);
    setProfileConfigs({});
    setN2nDiagnostics(null);
    setServerSession(null);
    setLocalPortReport(null);
    setN2nConfig(null);
    if (!gameId) {
      setItems([]);
      return;
    }
    Promise.all([recommendPlans(gameId), analyzeGame(gameId)])
      .then(([recommendations, nextAnalysis]) => {
        setItems(recommendations);
        setAnalysis(nextAnalysis);
        const nextConfigs: ProfileConfigState = {};
        for (const profile of nextAnalysis.launch_profiles) nextConfigs[profile.id] = defaultConfig(profile);
        setProfileConfigs(nextConfigs);
        refreshExecutionChecklist(nextAnalysis);
      })
      .catch((error) => {
        setItems([]);
        setLaunchError(String(error));
      });
  }, [gameId]);

  useEffect(() => {
    const stored = loadFriendAllocations();
    setFriendAllocations(stored);
    if (stored[0]) {
      setFriendName(stored[0].name);
      setSelectedFriendIp(stored[0].ip);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FRIEND_ALLOCATIONS_STORAGE_KEY, JSON.stringify(friendAllocations));
  }, [friendAllocations]);

  const updateConfigValue = (profileId: string, fieldId: string, value: string | boolean) => {
    setProfileConfigs((current) => ({ ...current, [profileId]: { ...(current[profileId] ?? {}), [fieldId]: value } }));
  };

  const runLaunchProfile = (profileId: string) => {
    if (!gameId) {
      setLaunchError('请先选择游戏。');
      return;
    }
    setIsLaunching(true);
    setLaunchError(null);
    setLaunchResult({ ok: true, message: '正在执行启动项：' + profileId + ' ...' });
    launchProfile(gameId, profileId, profileConfigs[profileId] ?? {})
      .then((result) => {
        setLaunchResult(result);
        refreshExecutionChecklist();
      })
      .catch((error) => {
        setLaunchResult(null);
        setLaunchError(String(error));
      })
      .finally(() => setIsLaunching(false));
  };

  const openNetworkWithPreset = () => {
    if (!analysis || !onOpenNetwork) return;
    const profile = analysis.multiplayer_conversion;
    onOpenNetwork({
      gameId: analysis.game_id,
      displayName: analysis.display_name,
      defaultPort,
      capability: profile?.capability,
      recommendedMethods: profile?.methods ?? [],
      source: analysis.adapter_source,
      note: '来自推荐方案页的适配器判断',
      appliedAt: Date.now()
    });
  };

  const copyFriendInvitePacket = async () => {
    await navigator.clipboard?.writeText(friendInvitePacket);
    setCopyMessage('游戏邀请好友包已复制。若还没有 community / 密钥，请再到通用组网中心复制完整组网配置。');
  };

  const allocateFriendIp = () => {
    const name = friendName.trim() || `好友 ${friendAllocations.length + 1}`;
    const existing = friendAllocations.find((item) => item.name === name);
    if (existing) {
      setSelectedFriendIp(existing.ip);
      setFriendName(existing.name);
      setCopyMessage(`已选择 ${existing.name} 的虚拟 IP：${existing.ip}`);
      return;
    }
    const next: FriendIpAllocation = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      ip: nextSuggestedFriendIp,
      createdAt: Date.now()
    };
    setFriendAllocations((current) => [...current, next]);
    setFriendName(next.name);
    setSelectedFriendIp(next.ip);
    setCopyMessage(`已为 ${next.name} 分配虚拟 IP：${next.ip}`);
  };

  const removeFriendAllocation = (id: string) => {
    setFriendAllocations((current) => current.filter((item) => item.id !== id));
    const removed = friendAllocations.find((item) => item.id === id);
    if (removed?.ip === selectedFriendIp) {
      setSelectedFriendIp('');
      setFriendConnectivityReport(null);
    }
  };

  const checkFriendConnectivity = async () => {
    if (!selectedFriendIp) {
      setCopyMessage('请先为好友分配或选择一个虚拟 IP。');
      return;
    }
    setIsCheckingFriend(true);
    setCopyMessage('');
    try {
      const report = await testConnectivity({
        host: selectedFriendIp,
        ports: [defaultPort],
        timeout_ms: 1400,
        mode: 'n2n_game_port'
      });
      setFriendConnectivityReport(report);
      setCopyMessage(report.reachable ? `好友虚拟 IP ${selectedFriendIp}:${defaultPort} 当前可达。` : `好友虚拟 IP ${selectedFriendIp}:${defaultPort} 当前不可达；如果好友不是房主，这通常只表示好友没有监听游戏端口。`);
    } catch (error) {
      setFriendConnectivityReport({
        target_host: selectedFriendIp,
        reachable: false,
        ports: [{ port: defaultPort, reachable: false, error: String(error) }],
        notes: [`检测失败：${String(error)}`]
      });
      setCopyMessage(`好友连接检测失败：${String(error)}`);
    } finally {
      setIsCheckingFriend(false);
    }
  };

  return (
    <section className="page-stack">
      <LoadingOverlay visible={isLaunching || isRefreshingChecklist || isCheckingFriend} title={isLaunching ? '正在执行推荐启动项' : isCheckingFriend ? '正在检测好友连接' : '正在刷新执行清单'} message={isLaunching ? '正在调用后端执行启动流程，请稍等。' : isCheckingFriend ? '正在测试好友虚拟 IP 和游戏端口，请稍等。' : '正在读取 n2n、服务端会话和本机端口状态。'} />
      <div className="page-header">
        <div>
          <span className="eyebrow">RECOMMENDATION</span>
          <h2>推荐方案</h2>
          <p className="muted">根据适配器判断游戏能否转换成本地 / 局域网体验。</p>
        </div>
        <span className="badge warn">不是一键联机</span>
      </div>

      <article className="card pending-feature">
        <h3>推荐页的真实含义</h3>
        <p>这里负责把扫描到的游戏匹配到合适流程：通用组网、启动本地服务端、查看说明或进入未来插件入口。真正能否联机仍取决于组网、端口监听、游戏内加入方式和适配器判断。</p>
        <ol>
          <li>双方在同一个 n2n / Radmin / 现有局域网中，并且虚拟 IP 不冲突。</li>
          <li>房主已经启动游戏房间或 Dedicated Server，端口正在由真实 PID 监听。</li>
          <li>加入方在游戏内选择 LAN / IP 直连，连接房主虚拟 IP 和游戏端口。</li>
          <li>如果游戏没有 LAN/IP/服务端能力，需要后续适配广播桥、端口代理、Mod 或平台网络插件。</li>
        </ol>
      </article>

      <article className="card">
        <div className="feature-card-title">
          <div>
            <h3>执行清单</h3>
            <p className="muted">清单来自真实检测：n2n 日志、服务端会话和本机端口，不用颜色假装成功。</p>
          </div>
          <button type="button" className="secondary" onClick={() => refreshExecutionChecklist()} disabled={isRefreshingChecklist}>刷新执行清单</button>
        </div>
        <ExecutionChecklist items={checklist} />
      </article>

      {analysis && (
        <article className="card">
          <div className="feature-card-title">
            <div>
              <h3>游戏邀请好友包</h3>
              <p className="muted">
                这是“游戏层”的邀请说明，会带入游戏名、端口、房主虚拟 IP 和当前检测摘要；n2n community / 密钥仍以通用组网中心复制内容为准。
              </p>
            </div>
            <span className={n2nDiagnostics?.ok_link && localPortReport?.reachable ? 'badge good' : 'badge warn'}>
              {n2nDiagnostics?.ok_link && localPortReport?.reachable ? '可尝试邀请' : '证据待补齐'}
            </span>
          </div>
          <div className="config-panel">
            <h4>好友虚拟 IP 分配器</h4>
            <p className="muted">给每个好友分配不同的虚拟 IP，避免多人都填写 10.10.10.3 导致 n2n 冲突。</p>
            <label>
              好友昵称
              <input value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="例如 小明" />
              <small className="muted">当前建议 IP：{nextSuggestedFriendIp}；房主 IP 基于最近 n2n 配置或当前虚拟网卡推断。</small>
            </label>
            <div className="actions">
              <button type="button" onClick={allocateFriendIp}>分配 / 选择好友虚拟 IP</button>
              <button type="button" className="secondary" onClick={checkFriendConnectivity} disabled={isCheckingFriend || !selectedFriendIp}>检测好友连接</button>
              {selectedFriendIp && <span className="badge good">当前邀请对象：{friendName || '未填写'} · {selectedFriendIp}</span>}
            </div>
            {friendConnectivityReport && (
              <div className={friendConnectivityReport.reachable ? 'result-ok' : 'result-idle'}>
                <h4>好友连接检测结果</h4>
                <p>
                  {friendConnectivityReport.target_host}:{defaultPort}：
                  {friendConnectivityReport.reachable ? '可达' : '不可达 / 待确认'}
                </p>
                <ul>
                  {friendConnectivityReport.notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
                <p className="muted">说明：如果好友不是房主，好友电脑通常不会监听游戏端口；不可达不一定代表 n2n 失败。后续可加入 ping/edge 成员检测。</p>
              </div>
            )}
            {friendAllocations.length > 0 && (
              <table className="adapter-table">
                <thead><tr><th>好友</th><th>虚拟 IP</th><th>操作</th></tr></thead>
                <tbody>
                  {friendAllocations.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.ip}</td>
                      <td>
                        <button type="button" className="secondary" onClick={() => { setFriendName(item.name); setSelectedFriendIp(item.ip); }}>用于邀请</button>
                        <button type="button" className="danger" onClick={() => removeFriendAllocation(item.id)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <pre>{friendInvitePacket}</pre>
          <label>
            <span>复制时包含 n2n 密钥</span>
            <input type="checkbox" checked={includeSecretInInvite} onChange={(event) => setIncludeSecretInInvite(event.target.checked)} />
            <small className="muted">默认隐藏密钥，避免把房间密码误发到公开位置；确认只发给朋友时再勾选。</small>
          </label>
          <div className="actions">
            <button type="button" onClick={copyFriendInvitePacket}>复制游戏邀请好友包</button>
            <button type="button" className="secondary" onClick={() => refreshExecutionChecklist()} disabled={isRefreshingChecklist}>先刷新检测状态</button>
          </div>
          {copyMessage && <p className="muted">{copyMessage}</p>}
        </article>
      )}

      {analysis && (
        <article className="card">
          <h3>游戏摘要</h3>
          <div className="status-grid">
            <div className="status-tile"><span>游戏</span><strong>{analysis.display_name}</strong><small>{analysis.game_id}</small></div>
            <div className="status-tile"><span>路径</span><strong>{analysis.detected_path ?? '未检测到'}</strong><small>安装位置</small></div>
            <div className="status-tile"><span>适配器</span><strong>{sourceLabels[analysis.adapter_source ?? ''] ?? analysis.adapter_source ?? '未知'}</strong><small>来源</small></div>
            <div className="status-tile"><span>默认端口</span><strong>{analysis.default_ports.join(', ') || '-'}</strong><small>由适配器声明</small></div>
          </div>
        </article>
      )}

      {analysis && <ConversionProfileView analysis={analysis} />}

      {analysis && (
        <article className="card conversion-card">
          <div className="feature-card-title">
            <div>
              <h3>下一步：先进入通用组网</h3>
              <p className="muted">把该游戏的默认端口和适配器判断带入通用组网中心，减少重复填写。进入后仍需填写 supernode、启动 n2n，并验证 ACK/PONG 和端口监听。</p>
            </div>
            <span className="badge good">参数联动</span>
          </div>
          <div className="actions">
            <button type="button" onClick={openNetworkWithPreset}>带入参数并进入通用组网</button>
          </div>
        </article>
      )}

      <article className="card">
        <h3>方案执行步骤</h3>
        <div className="feature-grid">
          {['先通用组网', '再执行游戏方案', '邀请好友', '诊断失败项'].map((title, index) => (
            <div className="status-tile" key={title}><span>步骤 {index + 1}</span><strong>{title}</strong><small>按顺序执行</small></div>
          ))}
        </div>
      </article>

      {items.length === 0 ? (
        <article className="card empty-state">
          <h3>暂无推荐</h3>
          <p className="muted">请先在游戏扫描页选择一个游戏。</p>
        </article>
      ) : items.map((item) => {
        const profile = item.launch_profile_id ? profilesById.get(item.launch_profile_id) : undefined;
        return (
          <article className="card" key={item.id}>
            <RecommendationCard item={item} launchProfileType={profile?.type} onLaunch={gameId && item.launch_profile_id ? () => runLaunchProfile(item.launch_profile_id as string) : undefined} disabled={isLaunching} />
            {profile?.config_fields && profile.config_fields.length > 0 && (
              <div className="config-panel">
                <h4>推荐启动项参数</h4>
                {profile.config_fields.map((field) => (
                  <label key={field.id}>
                    <span>{field.label}{field.required ? ' *' : ''}</span>
                    {field.type === 'select' ? (
                      <select value={String(profileConfigs[profile.id]?.[field.id] ?? field.default_value ?? '')} onChange={(event) => updateConfigValue(profile.id, field.id, event.target.value)}>
                        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <input type="checkbox" checked={Boolean(profileConfigs[profile.id]?.[field.id])} onChange={(event) => updateConfigValue(profile.id, field.id, event.target.checked)} />
                    ) : (
                      <input type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'} value={String(profileConfigs[profile.id]?.[field.id] ?? field.default_value ?? '')} onChange={(event) => updateConfigValue(profile.id, field.id, event.target.value)} />
                    )}
                    {field.help && <small className="muted">{field.help}</small>}
                  </label>
                ))}
                <p className="muted">应用前会再次确认，不会直接乱改游戏文件。</p>
              </div>
            )}
          </article>
        );
      })}

      {launchError && <article className="card error-card"><h3>操作异常</h3><p>{launchError}</p></article>}
      {launchResult && <article className="card"><h3>{launchResult.ok ? '操作结果' : '操作失败'}</h3><p>{launchResult.message}</p></article>}

      <article className="card">
        <h3>未来功能入口</h3>
        <div className="filter-list"><span className="future-chip">Steam Relay 插件</span><span className="future-chip">广播桥</span><span className="future-chip">端口代理</span><span className="future-chip">Mod 安装器</span></div>
      </article>
    </section>
  );
}
