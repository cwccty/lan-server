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

  return (
    <section>
      <h2>网络配置</h2>
      {backends.map((backend) => (
        <BackendCard key={backend.id} backend={backend} />
      ))}
      <article className="card">
        <h3>n2n 配置</h3>
        <label>
          房间名 / community
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
        </label>
        <label>
          密钥
          <input value={secret} onChange={(event) => setSecret(event.target.value)} />
        </label>
        <label>
          supernode 地址
          <input value={supernode} onChange={(event) => setSupernode(event.target.value)} placeholder="host:port" />
        </label>
        <label>
          本机虚拟 IP，可选
          <input value={localIp} onChange={(event) => setLocalIp(event.target.value)} placeholder="例如 10.10.10.2" />
        </label>
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
        <button onClick={() => startNetwork('n2n').then(setN2nResult)}>启动 n2n</button>
        <button onClick={() => stopNetwork('n2n').then(setN2nResult)}>停止 n2n</button>
        {n2nResult && <pre>{JSON.stringify(n2nResult, null, 2)}</pre>}
      </article>
      <article className="card">
        <h3>Manual LAN 连通性测试</h3>
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
