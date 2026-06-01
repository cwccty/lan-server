import { useEffect, useState } from 'react';
import { listNetworkBackends, setupNetwork, startNetwork, stopNetwork, testConnectivity } from '../api/tauri';
import { BackendCard } from '../components/BackendCard';
import type { BackendRuntimeStatus, BackendSummary, ConnectivityReport, SetupResult } from '../types/network';

export function NetworkSetupPage({ onNext }: { onNext: () => void }) {
  const [backends, setBackends] = useState<BackendSummary[]>([]);
  const [host, setHost] = useState('127.0.0.1');
  const [ports, setPorts] = useState('7777');
  const [report, setReport] = useState<ConnectivityReport | null>(null);
  const [roomName, setRoomName] = useState('lan-helper-room');
  const [secret, setSecret] = useState('lan-helper-secret');
  const [supernode, setSupernode] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [n2nResult, setN2nResult] = useState<SetupResult | BackendRuntimeStatus | null>(null);

  useEffect(() => {
    listNetworkBackends().then(setBackends).catch(() => setBackends([]));
  }, []);

  const friendConfigText = [
    `房间名/community：${roomName}`,
    `密钥：${secret}`,
    `supernode：${supernode || '先填写你的 supernode 地址'}`,
    '本机虚拟 IP：两台电脑必须不同，例如房主 10.10.10.2，朋友 10.10.10.3',
    '加入后，朋友在 Terraria 里连接房主虚拟 IP:7777'
  ].join('\n');

  return (
    <section>
      <h2>网络配置</h2>
      {backends.map((backend) => (
        <BackendCard key={backend.id} backend={backend} />
      ))}

      <article className="card">
        <h3>n2n 内置组网</h3>
        <p className="muted">
          n2n 由 edge 和 supernode 组成：每台玩家电脑运行 edge；supernode 负责让这些 edge 找到彼此。
          两个玩家必须填写相同的 community、密钥和 supernode，但本机虚拟 IP 必须不同。
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
          <small className="muted">例如：你的服务器域名:7777。没有 supernode 时，n2n 无法完成异地发现。</small>
        </label>

        <label>
          本机虚拟 IP，可选
          <input value={localIp} onChange={(event) => setLocalIp(event.target.value)} placeholder="例如 10.10.10.2" />
          <small className="muted">建议房主填 10.10.10.2，朋友填 10.10.10.3，避免 IP 冲突。</small>
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
        <h3>连接测试</h3>
        <p className="muted">
          房主先测 127.0.0.1:7777，确认游戏服务端已经监听；朋友再测房主虚拟 IP:7777。
        </p>
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
              timeout_ms: 1200
            }).then(setReport)
          }
        >
          测试连接
        </button>
        {report && <pre>{JSON.stringify(report, null, 2)}</pre>}
      </article>

      <button onClick={onNext}>生成推荐方案</button>
    </section>
  );
}
