import { useEffect, useState } from 'react';
import { listNetworkBackends, setupNetwork, startNetwork, stopNetwork, testConnectivity } from '../api/tauri';
import { BackendCard } from '../components/BackendCard';
import type { BackendRuntimeStatus, BackendSummary, ConnectivityReport, SetupResult } from '../types/network';

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

export function NetworkSetupPage({ onNext }: { onNext: () => void }) {
  const [backends, setBackends] = useState<BackendSummary[]>([]);
  const [host, setHost] = useState('127.0.0.1');
  const [ports, setPorts] = useState('7777');
  const [report, setReport] = useState<ConnectivityReport | null>(null);
  const [roomName, setRoomName] = useState('terraria-room-001');
  const [secret, setSecret] = useState('lan-helper-secret');
  const [supernode, setSupernode] = useState('');
  const [localIp, setLocalIp] = useState('10.10.10.2');
  const [peerIp, setPeerIp] = useState('10.10.10.3');
  const [gamePort, setGamePort] = useState('7777');
  const [localReport, setLocalReport] = useState<ConnectivityReport | null>(null);
  const [peerReport, setPeerReport] = useState<ConnectivityReport | null>(null);
  const [n2nResult, setN2nResult] = useState<SetupResult | BackendRuntimeStatus | null>(null);

  const refreshBackends = () => listNetworkBackends().then(setBackends).catch(() => setBackends([]));

  useEffect(() => {
    refreshBackends();
  }, []);

  const friendConfigText = [
    `房间名/community：${roomName}`,
    `密钥：${secret}`,
    `supernode：${supernode || '先填写你的 supernode 地址'}`,
    `朋友本机虚拟 IP：${peerIp}`,
    `房主虚拟 IP：${localIp}`,
    `游戏连接地址：${localIp}:${gamePort}`,
    '说明：双方 community、密钥、supernode 必须相同；双方本机虚拟 IP 必须不同。'
  ].join('\n');

  const parsedGamePort = Number(gamePort.trim()) || 7777;

  return (
    <section>
      <h2>网络配置</h2>
      {backends.map((backend) => (
        <BackendCard key={backend.id} backend={backend} />
      ))}
      <button onClick={refreshBackends}>刷新网络后端状态</button>

      <article className="card">
        <h3>n2n 内置组网</h3>
        <p className="muted">
          每台玩家电脑运行 edge；supernode 负责让这些 edge 找到彼此。双方必须填写相同的
          community、密钥和 supernode，但本机虚拟 IP 必须不同。
        </p>

        <label>
          房间名 / community
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
          <small className="muted">相当于房间号。朋友必须填写完全相同的值。</small>
        </label>

        <label>
          密钥
          <input value={secret} onChange={(event) => setSecret(event.target.value)} />
          <small className="muted">相当于房间密码。朋友必须填写完全相同的值。</small>
        </label>

        <label>
          supernode 地址
          <input value={supernode} onChange={(event) => setSupernode(event.target.value)} placeholder="host:port" />
          <small className="muted">例如：你的 VPS IP:7777。没有 supernode 时，n2n 无法完成异地发现。</small>
        </label>

        <label>
          本机虚拟 IP
          <input value={localIp} onChange={(event) => setLocalIp(event.target.value)} placeholder="例如 10.10.10.2" />
          <small className="muted">房主建议填 10.10.10.2，朋友建议填 10.10.10.3。</small>
        </label>

        <label>
          对方虚拟 IP
          <input value={peerIp} onChange={(event) => setPeerIp(event.target.value)} placeholder="例如 10.10.10.3" />
          <small className="muted">用于测试对方电脑上的游戏端口。房主这里填朋友 IP，朋友这里填房主 IP。</small>
        </label>

        <label>
          游戏端口
          <input value={gamePort} onChange={(event) => setGamePort(event.target.value)} />
          <small className="muted">Terraria 默认 7777，Minecraft Java 默认 25565。</small>
        </label>

        <div className="actions">
          <button
            onClick={() =>
              setupNetwork('n2n', {
                room_name: roomName,
                secret,
                supernode,
                local_ip: localIp || undefined
              }).then(setN2nResult)
            }
          >
            保存 n2n 配置
          </button>
          <button onClick={() => startNetwork('n2n').then(setN2nResult)}>启动 n2n edge</button>
          <button onClick={() => stopNetwork('n2n').then(setN2nResult)}>停止 n2n edge</button>
        </div>

        <details>
          <summary>复制给朋友的 n2n 配置</summary>
          <pre>{friendConfigText}</pre>
        </details>

        {n2nResult && <pre>{JSON.stringify(n2nResult, null, 2)}</pre>}
      </article>

      <article className="card">
        <h3>n2n 联机排查</h3>
        <p className="muted">
          先测房主本机 127.0.0.1，确认游戏服务端真的启动；再测对方/房主虚拟 IP，区分是游戏没开还是 n2n/防火墙不通。
        </p>
        <div className="actions">
          <button
            onClick={() =>
              testConnectivity({
                host: '127.0.0.1',
                ports: [parsedGamePort],
                timeout_ms: 1200,
                mode: 'local_game_port'
              }).then(setLocalReport)
            }
          >
            测本机游戏端口
          </button>
          <button
            onClick={() =>
              testConnectivity({
                host: peerIp,
                ports: [parsedGamePort],
                timeout_ms: 1600,
                mode: 'n2n_game_port'
              }).then(setPeerReport)
            }
          >
            测对方虚拟 IP 游戏端口
          </button>
        </div>
        {localReport && <ConnectivityReportView report={localReport} />}
        {peerReport && <ConnectivityReportView report={peerReport} />}
      </article>

      <article className="card">
        <h3>手动连接测试</h3>
        <label>
          目标 IP / 域名
          <input value={host} onChange={(event) => setHost(event.target.value)} />
        </label>
        <label>
          端口，多个用英文逗号分隔
          <input value={ports} onChange={(event) => setPorts(event.target.value)} />
        </label>
        <button
          onClick={() =>
            testConnectivity({
              host,
              ports: ports
                .split(',')
                .map((item) => Number(item.trim()))
                .filter((item) => Number.isInteger(item) && item > 0),
              timeout_ms: 1200,
              mode: 'generic'
            }).then(setReport)
          }
        >
          测试连接
        </button>
        {report && <ConnectivityReportView report={report} />}
      </article>

      <button onClick={onNext}>生成推荐方案</button>
    </section>
  );
}
