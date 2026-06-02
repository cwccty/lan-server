import { useEffect, useState } from 'react';
import { listNetworkBackends, setupNetwork, startNetwork, stopNetwork, testConnectivity } from '../api/tauri';
import { BackendCard } from '../components/BackendCard';
import type { BackendRuntimeStatus, BackendSummary, ConnectivityReport, SetupResult } from '../types/network';

type RoomMember = {
  id: string;
  name: string;
  virtualIp: string;
  role: '房主' | '加入者';
};

type ChatMessage = {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
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
  const [playerName, setPlayerName] = useState('房主');
  const [memberName, setMemberName] = useState('朋友');
  const [memberIp, setMemberIp] = useState('10.10.10.3');
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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
    const saved = window.localStorage.getItem('lan-helper-room-state');
    if (!saved) {
      return;
    }
    try {
      const state = JSON.parse(saved) as { playerName?: string; members?: RoomMember[]; messages?: ChatMessage[] };
      if (state.playerName) setPlayerName(state.playerName);
      if (Array.isArray(state.members)) setRoomMembers(state.members);
      if (Array.isArray(state.messages)) setChatMessages(state.messages);
    } catch {
      // Ignore incompatible old room state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'lan-helper-room-state',
      JSON.stringify({ playerName, members: roomMembers, messages: chatMessages })
    );
  }, [playerName, roomMembers, chatMessages]);

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

  const roomPacketText = [
    '【联机助手房间信息】',
    `房间名/community：${roomName}`,
    `supernode：${supernode || '未填写'}`,
    `房主虚拟 IP：${localIp}`,
    `游戏端口：${gamePort}`,
    '',
    '成员：',
    ...(roomMembers.length > 0 ? roomMembers.map((member) => `- ${member.role} ${member.name}：${member.virtualIp}`) : ['- 暂无成员，先添加自己和朋友。']),
    '',
    '置顶说明：双方 community、密钥、supernode 必须一致；每个人的虚拟 IP 必须不同。',
    '',
    '聊天记录：',
    ...(chatMessages.length > 0 ? chatMessages.map((message) => `[${message.createdAt}] ${message.sender}：${message.text}`) : ['暂无聊天记录。'])
  ].join('\n');

  const copyFriendConfig = async () => {
    await navigator.clipboard?.writeText(friendConfigText);
    setCopyMessage('通用组网配置已复制，可以发给朋友。');
  };

  const copyRoomPacket = async () => {
    await navigator.clipboard?.writeText(roomPacketText);
    setCopyMessage('房间信息和聊天记录已复制，可以发给朋友。');
  };

  const addMember = (role: RoomMember['role'], name: string, virtualIp: string) => {
    const trimmedName = name.trim();
    const trimmedIp = virtualIp.trim();
    if (!trimmedName || !trimmedIp) return;
    setRoomMembers((current) => [
      ...current.filter((member) => member.virtualIp !== trimmedIp),
      { id: `${Date.now()}-${trimmedIp}`, name: trimmedName, virtualIp: trimmedIp, role }
    ]);
  };

  const sendRoomMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((current) => [
      ...current,
      { id: `${Date.now()}`, sender: playerName.trim() || '我', text, createdAt: new Date().toLocaleString() }
    ]);
    setChatInput('');
  };

  return (
    <section>
      <h2>通用组网中心</h2>
      <p className="muted">
        n2n / Radmin / 已有局域网属于“组网层”，不应该绑定某个具体游戏。先让几台电脑进入同一个虚拟局域网，
        然后任何支持 LAN 或 IP 直连的游戏都可以尝试连接房主虚拟 IP。Terraria 向导只是额外的一键开服辅助。
      </p>

      {busy && <div className="busy-banner">正在处理：{busy}，请稍等，不要重复点击。</div>}

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

      <article className="card">
        <h3>房间与聊天</h3>
        <p className="muted">当前是本地房间面板：用于整理成员、置顶配置和复制聊天记录。它不是实时联网聊天；未来接入信令/中继后可升级为实时房间。</p>
        <div className="room-grid">
          <section className="config-panel">
            <h4>房间摘要</h4>
            <p>房间名：<strong>{roomName}</strong></p>
            <p>supernode：<strong>{supernode || '未填写'}</strong></p>
            <p>房主虚拟 IP：<strong>{localIp}</strong></p>
            <p>游戏端口：<strong>{gamePort}</strong></p>
            <button type="button" onClick={() => addMember('房主', playerName || '房主', localIp)} disabled={Boolean(busy)}>把我加入房间</button>
          </section>
          <section className="config-panel">
            <h4>成员</h4>
            <label>我的昵称<input value={playerName} onChange={(event) => setPlayerName(event.target.value)} disabled={Boolean(busy)} /></label>
            <div className="actions">
              <input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="朋友昵称" disabled={Boolean(busy)} />
              <input value={memberIp} onChange={(event) => setMemberIp(event.target.value)} placeholder="朋友虚拟 IP" disabled={Boolean(busy)} />
              <button type="button" onClick={() => addMember('加入者', memberName, memberIp)} disabled={Boolean(busy)}>添加朋友</button>
            </div>
            {roomMembers.length === 0 ? <p className="muted">暂无成员。建议先添加自己，再添加朋友的虚拟 IP。</p> : (
              <ul className="member-list">
                {roomMembers.map((member) => (
                  <li key={member.id}><span>{member.role}：{member.name}</span><strong>{member.virtualIp}</strong><button type="button" onClick={() => setRoomMembers((current) => current.filter((item) => item.id !== member.id))} disabled={Boolean(busy)}>移除</button></li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <section className="config-panel">
          <h4>置顶配置</h4>
          <pre>{roomPacketText}</pre>
          <button type="button" onClick={copyRoomPacket} disabled={Boolean(busy)}>复制房间信息和聊天</button>
          <button type="button" onClick={() => setChatMessages([])} disabled={Boolean(busy) || chatMessages.length === 0}>清空聊天</button>
        </section>
        <section className="config-panel">
          <h4>聊天记录</h4>
          <div className="chat-panel">
            {chatMessages.length === 0 ? <p className="muted">暂无消息。可以先写“我已启动 n2n，虚拟 IP 是 10.10.10.2”。</p> : chatMessages.map((message) => (
              <div className="chat-message" key={message.id}><span>{message.createdAt} · {message.sender}</span><p>{message.text}</p></div>
            ))}
          </div>
          <div className="actions">
            <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendRoomMessage(); }} placeholder="输入本地留言，例如：我已启动 n2n，等你加入。" disabled={Boolean(busy)} />
            <button type="button" onClick={sendRoomMessage} disabled={Boolean(busy) || !chatInput.trim()}>发送到房间记录</button>
          </div>
        </section>
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
