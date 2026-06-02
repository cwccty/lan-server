import { useEffect, useState } from 'react';
import { listNetworkBackends, setupNetwork, startNetwork, stopNetwork, testConnectivity } from '../api/tauri';
import { BackendCard } from '../components/BackendCard';
import type { BackendRuntimeStatus, BackendSummary, ConnectivityReport, SetupResult } from '../types/network';

type SteamRelayDraft = {
  appId: string;
  roomName: string;
  relayMode: 'steam_datagram_relay' | 'steam_lobby_p2p';
  notes: string;
};

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

export function NetworkSetupPage({ onNext }: { onNext: () => void }) {
  const [backends, setBackends] = useState<BackendSummary[]>([]);
  const [host, setHost] = useState('127.0.0.1');
  const [ports, setPorts] = useState('7777');
  const [report, setReport] = useState<ConnectivityReport | null>(null);
  const [roomName, setRoomName] = useState('lan-helper-room-001');
  const [secret, setSecret] = useState('lan-helper-secret');
  const [supernode, setSupernode] = useState('');
  const [localIp, setLocalIp] = useState('10.10.10.2');
  const [peerIp, setPeerIp] = useState('10.10.10.3');
  const [gamePort, setGamePort] = useState('7777');
  const [localReport, setLocalReport] = useState<ConnectivityReport | null>(null);
  const [peerReport, setPeerReport] = useState<ConnectivityReport | null>(null);
  const [n2nResult, setN2nResult] = useState<SetupResult | BackendRuntimeStatus | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [steamRelayDraft, setSteamRelayDraft] = useState<SteamRelayDraft>({
    appId: '',
    roomName: 'steam-relay-room-001',
    relayMode: 'steam_datagram_relay',
    notes: '预留 connecttool-qt 类路线：通过 Steam Networking / Relay 做房间发现和中继。'
  });

  const refreshBackends = () =>
    listNetworkBackends()
      .then((items) => {
        setBackends(items);
        const recentSupernode = recentSupernodeFromBackends(items);
        if (recentSupernode) {
          setSupernode((current) => current.trim() ? current : recentSupernode);
        }
      })
      .catch(() => setBackends([]));

  useEffect(() => {
    refreshBackends();
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

  const runAction = async <T,>(label: string, action: () => Promise<T>, onDone?: (value: T) => void) => {
    if (busy) return;
    try {
      setBusy(label);
      const value = await action();
      onDone?.(value);
      await refreshBackends();
    } finally {
      setBusy(null);
    }
  };

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
    '',
    '操作：',
    '1. 打开联机助手 → 通用组网中心。',
    '2. 填写相同 community / 密钥 / supernode。',
    '3. 你的虚拟 IP 填上面分配给你的地址，不能和房主重复。',
    '4. 启动 n2n edge。',
    `5. 在游戏里选择 LAN / Join via IP，连接 ${localIp}:${gamePort}。`
  ].join('\n');

  const parsedGamePort = Number(gamePort.trim()) || 7777;
  const n2nBackend = backends.find((backend) => backend.id === 'n2n');
  const n2nRuntimeResult = n2nResult && 'running' in n2nResult ? n2nResult : null;
  const n2nSetupResult = n2nResult && 'ok' in n2nResult ? n2nResult : null;
  const n2nRecordedRunning = Boolean(n2nBackend?.notes.some((note) => note.includes('PID')));
  const n2nRunning = Boolean(n2nRuntimeResult?.running || n2nRecordedRunning);
  const supernodeValue = supernode.trim();
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
      value: supernodeValue ? (n2nRunning ? '已用于启动' : '已填写') : '未配置',
      kind: supernodeValue ? (n2nRunning ? 'good' : 'warn') : 'bad',
      evidence: supernodeValue || '请填写 VPS_IP:端口，例如 154.64.231.137:7777',
      detail: n2nRunning ? 'edge 已带该 supernode 启动；是否 ACK 需看 edge 日志或诊断。' : '这里只表示配置存在，不伪装成 supernode 已响应。'
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
      value: n2nBackend?.virtual_ip || n2nRuntimeResult?.virtual_ip || '未分配',
      kind: n2nBackend?.virtual_ip || n2nRuntimeResult?.virtual_ip ? 'good' : 'warn',
      evidence: localIp ? '当前配置期望：' + localIp : '未填写本机虚拟 IP',
      detail: '显示“检测值 / 期望值”，用于发现 IP 冲突或 TAP 未生效。'
    }
  ];

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

  const copySteamRelayDraft = async () => {
    await navigator.clipboard?.writeText(steamRelayPacketText);
    setCopyMessage('Steam 中继入口草案已复制，可作为后续插件制作说明。');
  };

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">NETWORK</span>
          <h2>通用组网中心</h2>
          <p className="muted">
            n2n / Radmin / 已有局域网属于“组网层”，不应该绑定某个具体游戏。先让几台电脑进入同一个虚拟局域网，
            然后任何支持 LAN 或 IP 直连的游戏都可以尝试连接房主虚拟 IP。Terraria 向导只是额外的一键开服辅助。
          </p>
        </div>
        <span className={n2nRunning ? 'badge good' : 'badge warn'}>{n2nRunning ? '组网进程运行中' : '等待启动组网'}</span>
      </div>

      {busy && <div className="busy-banner">正在处理：{busy}，请稍等，不要重复点击。</div>}

      <div className="status-grid">
        {networkStatusCards.map((item) => <NetworkStatusCard key={item.title} item={item} />)}
      </div>

      <div className="notice-card">
        <strong>真实状态说明：</strong>edge、虚拟网卡、虚拟 IP 来自后端检测；supernode 卡片只说明配置是否存在和 edge 是否已用它启动，不会把“已填写”伪装成“已响应”。
      </div>

      <article className="card">
        <h3>当前网络后端</h3>
        {backends.map((backend) => <BackendCard key={backend.id} backend={backend} />)}
        <button onClick={refreshBackends} disabled={Boolean(busy)}>刷新网络后端状态</button>
      </article>

      <article className="card">
        <h3>n2n 内置组网</h3>
        <p className="muted">每台玩家电脑运行 edge；supernode 负责让这些 edge 找到彼此。双方必须填写相同的 community、密钥和 supernode，但本机虚拟 IP 必须不同。</p>
        <label>房间名 / community<input value={roomName} onChange={(event) => setRoomName(event.target.value)} disabled={Boolean(busy)} /><small className="muted">相当于房间号。朋友必须填写完全相同的值。</small></label>
        <label>密钥<input value={secret} onChange={(event) => setSecret(event.target.value)} disabled={Boolean(busy)} /><small className="muted">相当于房间密码。朋友必须填写完全相同的值。</small></label>
        <label>supernode 地址<input value={supernode} onChange={(event) => setSupernode(event.target.value)} placeholder="host:port" disabled={Boolean(busy)} /><small className="muted">例如：你的 VPS IP:7777。没有 supernode 时，n2n 无法完成异地发现。</small></label>
        <label>本机虚拟 IP<input value={localIp} onChange={(event) => setLocalIp(event.target.value)} placeholder="例如 10.10.10.2" disabled={Boolean(busy)} /><small className="muted">房主建议填 10.10.10.2，朋友建议填 10.10.10.3、10.10.10.4 等。</small></label>
        <label>对方 / 房主虚拟 IP<input value={peerIp} onChange={(event) => setPeerIp(event.target.value)} placeholder="例如 10.10.10.3" disabled={Boolean(busy)} /><small className="muted">房主可填朋友 IP 用于测试；加入者这里填房主 IP。</small></label>
        <label>游戏端口，可按游戏修改<input value={gamePort} onChange={(event) => setGamePort(event.target.value)} disabled={Boolean(busy)} /><small className="muted">Terraria 默认 7777，Minecraft Java 默认 25565。其他游戏使用自己的 LAN/IP 端口。</small></label>

        <div className="actions">
          <button disabled={Boolean(busy)} onClick={() => runAction('保存 n2n 配置', () => setupNetwork('n2n', { room_name: roomName, secret, supernode, local_ip: localIp || undefined }), setN2nResult)}>保存 n2n 配置</button>
          <button disabled={Boolean(busy)} onClick={() => runAction('启动 n2n edge', () => startNetwork('n2n'), setN2nResult)}>启动 n2n edge</button>
          <button disabled={Boolean(busy)} onClick={() => runAction('停止 n2n edge', () => stopNetwork('n2n'), setN2nResult)}>停止 n2n edge</button>
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
        </article>

        <details>
          <summary>复制给朋友的通用组网配置</summary>
          <pre>{friendConfigText}</pre>
          <button type="button" onClick={copyFriendConfig} disabled={Boolean(busy)}>复制通用组网配置</button>
          {copyMessage && <p className="muted">{copyMessage}</p>}
        </details>
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
              <li>适合作为未来“平台网络层”的可选插件，不作为 MVP 默认承诺。</li>
              <li>只走官方 Steamworks / Steam Networking 能力或用户自有 AppID。</li>
              <li>不做破解服务器、绕过正版验证、绕过反作弊、模拟官方账号服务。</li>
              <li>后续先做最小 PoC：创建房间 → 加入房间 → 文本消息/信令 → 再接端口代理或游戏桥接。</li>
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

      <button onClick={onNext} disabled={Boolean(busy)}>生成推荐方案</button>
    </section>
  );
}
