import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
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
import {
  sendServerCommand,
  stopPortProxy,
  stopServerSession,
  stopUdpBroadcastBridge,
  stopUdpProxy
} from '../api/tauri';
import type { ReferenceAdvancedProxyKind } from '../reference-adapter/actions';

interface ProductAdvancedToolsViewProps {
  onTriggerToast: (msg: string) => void;
}

type ToolKind = ReferenceAdvancedProxyKind;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function lastLines(lines: string[] = [], count = 4) {
  return lines.slice(-count);
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

  useEffect(() => {
    refreshReferenceRuntime(false).catch(() => undefined);
  }, []);

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

  const startProxy = () => run('启动高级连接链路', () => startReferenceAdvancedProxy({
    type: kind,
    listen_port: Number(listenPort) || 7777,
    target_host: targetHost || '10.0.8.2',
    target_port: Number(targetPort) || Number(listenPort) || 7777
  }));

  const stopProxy = (row: { kind: ToolKind; id: string }) => run('停止高级连接实例', async () => {
    if (row.kind === 'tcp') return stopPortProxy(row.id);
    if (row.kind === 'udp') return stopUdpProxy(row.id);
    return stopUdpBroadcastBridge(row.id);
  });

  const selfTest = (targetKind: ToolKind) => run('高级连接自测', () => selfTestReferenceAdvancedProxy(targetKind));

  const startServer = () => run('启动通用服务端', () => startReferenceGenericServer({
    game_name: serverName || '通用游戏服务端',
    executable_path: serverPath,
    port: Number(serverPort) || 7777
  }));

  const sendCommand = () => run('发送服务端指令', () => sendServerCommand(serverCommand));
  const stopServer = () => run('停止通用服务端', () => stopServerSession());

  const server = runtime.snapshot?.server_session ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">高级连接工具</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            这里是正式 Product 页面，直接读取 Tauri 后端状态并调用 TCP/UDP 端口代理、UDP 广播桥和通用服务端接口，不再依赖参考页文字拦截。
          </p>
        </div>
        <button
          onClick={() => run('刷新高级工具状态', () => refreshReferenceRuntime(false))}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          刷新真实状态
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-950 p-5 text-white shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-amber-300">
              <Waves className="h-4 w-4" />
              <h3 className="text-sm font-bold">这些工具解决什么</h3>
            </div>
            <ul className="space-y-3 text-xs leading-relaxed text-slate-200">
              <li><b className="text-amber-200">TCP/UDP 端口代理：</b>把本地监听端口转发到好友虚拟 IP 的指定游戏端口。</li>
              <li><b className="text-amber-200">UDP 广播桥：</b>把只在局域网广播里出现的大厅发现包转发到虚拟网段。</li>
              <li><b className="text-amber-200">通用服务端：</b>管理 exe、bat、cmd、jar 服务端进程和控制台命令。</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800">新增链路实例</h3>
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
                对端虚拟 IP / 广播目标
                <input value={targetHost} onChange={(event) => setTargetHost(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                对端端口
                <input value={targetPort} onChange={(event) => setTargetPort(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={startProxy} disabled={Boolean(busy)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  挂载并上线
                </button>
                <button onClick={() => selfTest(kind)} disabled={Boolean(busy)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  一键自测
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
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
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">真实运行实例</h3>
                <p className="mt-1 text-xs text-slate-500">运行中 {runningCount} / 实例 {totalCount}</p>
              </div>
              {busy ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">处理中：{busy}</span> : null}
            </div>

            {runtime.errors.length ? (
              <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                {runtime.errors.slice(0, 3).join('；')}
              </div>
            ) : null}

            <div className="space-y-3">
              {proxyRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  当前没有 TCP/UDP/广播桥实例。创建链路后会在这里出现真实状态。
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
                        自测
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

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
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
