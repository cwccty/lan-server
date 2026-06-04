import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Globe,
  KeyRound,
  Play,
  RefreshCw,
  Save,
  Server,
  Square,
  Terminal,
  Wifi
} from 'lucide-react';
import {
  readReferenceN2nLastConfig,
  refreshReferenceRuntime,
  saveReferenceN2nConfig,
  startReferenceN2n,
  stopReferenceN2n
} from '../reference-adapter/actions';
import { testConnectivity } from '../api/tauri';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';
import type { NetworkConfig } from '../types/network';

interface ProductNetworkViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

function statusLabel(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (!runtime.loaded) return '读取中';
  if (runtime.network.ready) return '已连接';
  if (runtime.network.running) return '运行中';
  if (runtime.network.hasError) return '需诊断';
  return '未启动';
}

function statusTone(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (runtime.network.ready) return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (runtime.network.running) return 'border-amber-100 bg-amber-50 text-amber-700';
  if (runtime.network.hasError) return 'border-rose-100 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function buildConfig(roomName: string, roomKey: string, supernode: string, localIp: string): NetworkConfig {
  return {
    room_name: roomName.trim(),
    secret: roomKey,
    supernode: supernode.trim(),
    local_ip: localIp.trim()
  };
}

export function ProductNetworkView({ onTriggerToast, onNavigateTab }: ProductNetworkViewProps) {
  const runtime = useReferenceRuntime();
  const [roomName, setRoomName] = useState('Terraria_Night_Squad');
  const [roomKey, setRoomKey] = useState('');
  const [supernode, setSupernode] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [gamePort, setGamePort] = useState('7777');
  const [connectHost, setConnectHost] = useState('');
  const [busy, setBusy] = useState('');
  const [lastConnectivity, setLastConnectivity] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      setBusy('读取最近配置');
      try {
        const result = await readReferenceN2nLastConfig();
        if (cancelled) return;
        const config = result.data as NetworkConfig | null;
        if (config) {
          if (config.room_name) setRoomName(config.room_name);
          if (config.secret) setRoomKey(config.secret);
          if (config.supernode) setSupernode(config.supernode);
          if (config.local_ip) {
            setLocalIp(config.local_ip);
            setConnectHost(config.local_ip);
          }
        }
        await refreshReferenceRuntime(false);
      } catch {
        await refreshReferenceRuntime(false).catch(() => undefined);
      } finally {
        if (!cancelled) setBusy('');
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!connectHost && runtime.network.virtualIp) setConnectHost(runtime.network.virtualIp);
    if (!localIp && runtime.network.virtualIp) setLocalIp(runtime.network.virtualIp);
    if (!supernode && runtime.network.supernode) setSupernode(runtime.network.supernode);
  }, [connectHost, localIp, runtime.network.supernode, runtime.network.virtualIp, supernode]);

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

  const config = () => buildConfig(roomName, roomKey, supernode, localIp);

  const saveConfig = () => run('保存 n2n 设置', () => saveReferenceN2nConfig(config()));
  const startN2n = () => run('启动 n2n Edge', () => startReferenceN2n(config()));
  const stopN2n = () => run('停止 n2n Edge', () => stopReferenceN2n());
  const refreshStatus = () => run('刷新节点状态', () => refreshReferenceRuntime(false));

  const testCurrent = () => run('联机端口检测', async () => {
    const host = connectHost.trim() || runtime.network.virtualIp || localIp;
    if (!host) throw new Error('没有可检测的虚拟 IP。请先保存并启动 n2n。');
    const port = Number(gamePort) || 7777;
    const report = await testConnectivity({
      host,
      ports: [port],
      timeout_ms: 1200,
      mode: 'n2n_game_port'
    });
    setLastConnectivity(`${report.target_host}:${port} ${report.reachable ? '可连接' : '不可连接'}${report.notes.length ? `｜${report.notes.join('；')}` : ''}`);
    return report;
  });

  const copySummary = async () => {
    const text = [
      '联机助手 n2n 配置摘要',
      `房间名：${roomName || '未填写'}`,
      `Supernode：${supernode || runtime.network.supernode || '未配置'}`,
      `本机虚拟 IP：${runtime.network.virtualIp || localIp || '未读取到'}`,
      `游戏端口：${gamePort || '未填写'}`,
      `状态：${statusLabel(runtime)}`,
      '提醒：好友需要使用同一房间名、密钥和 Supernode，并连接房主虚拟 IP。'
    ].join('\n');
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(text);
      onTriggerToast('已复制真实 n2n 配置摘要。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const logs = runtime.snapshot?.n2n?.recent_logs?.slice(-10) ?? [];

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="network">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">通用组网中心</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            正式 Product 页面，直接保存、启动、停止和刷新 n2n 后端状态；刷新不会重复启动 edge。
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${statusTone(runtime)}`}>
          <span className={`h-2 w-2 rounded-full ${runtime.network.ready ? 'bg-emerald-500' : runtime.network.running ? 'bg-amber-500' : runtime.network.hasError ? 'bg-rose-500' : 'bg-slate-400'}`} />
          {busy || `真实状态：${statusLabel(runtime)}`}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">n2n Edge 基础参数</h3>
              <p className="mt-1 text-xs text-slate-500">这些参数会写入本地后端配置，启动时由真实 edge 使用。</p>
            </div>
            <button onClick={copySummary} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
              <Copy className="h-4 w-4" />
              复制摘要
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              Room Name
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="共同约定的英文/数字房间名" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Room Key
              <input value={roomKey} onChange={(event) => setRoomKey(event.target.value)} type="password" placeholder="通信授权密码" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400" />
            </label>
            <label className="block text-xs font-semibold text-slate-600 md:col-span-2">
              Supernode
              <input value={supernode} onChange={(event) => setSupernode(event.target.value)} placeholder="例如：你的VPS:7777" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-amber-400" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              本机虚拟 IP
              <input value={localIp} onChange={(event) => setLocalIp(event.target.value)} placeholder="例如：10.10.10.2，留空可让后端/edge处理" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-amber-400" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              游戏端口
              <input value={gamePort} onChange={(event) => setGamePort(event.target.value)} placeholder="如 7777" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 outline-none focus:border-amber-400" />
            </label>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <button onClick={saveConfig} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <Save className="h-4 w-4" />
              保存基础参数
            </button>
            <button onClick={startN2n} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
              <Play className="h-4 w-4" />
              Start n2n Edge
            </button>
            <button onClick={stopN2n} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-100 px-3 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
              <Square className="h-4 w-4" />
              Stop n2n Edge
            </button>
            <button onClick={refreshStatus} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${busy === '刷新节点状态' ? 'animate-spin' : ''}`} />
              Refresh Node Status
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Activity className="h-4 w-4 text-amber-600" />
              真实 n2n 状态
            </h3>
            <div className="space-y-3 text-xs text-slate-600">
              <p>运行：{runtime.network.running ? '是' : '否'}</p>
              <p>链路 ACK/PONG：{runtime.network.ready ? '通过' : '未通过'}</p>
              <p>虚拟 IP：<span className="font-mono">{runtime.network.virtualIp || localIp || '-'}</span></p>
              <p>Supernode：<span className="font-mono">{runtime.network.supernode || supernode || '-'}</span></p>
              <p>摘要：{runtime.network.label || '暂无状态摘要'}</p>
            </div>
            {runtime.network.hasError || runtime.errors.length ? (
              <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                <div className="mb-1 flex items-center gap-1 font-bold"><AlertCircle className="h-4 w-4" />需要诊断</div>
                {(runtime.errors[0] || runtime.network.label || 'n2n 状态异常，请查看诊断报告。')}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
                <div className="flex items-center gap-1 font-bold"><CheckCircle2 className="h-4 w-4" />状态已读取</div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Terminal className="h-4 w-4 text-amber-600" />
              联机端口检测
            </h3>
            <div className="space-y-3">
              <input value={connectHost} onChange={(event) => setConnectHost(event.target.value)} placeholder="目标虚拟 IP，默认本机/房主虚拟 IP" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
              <button onClick={testCurrent} disabled={Boolean(busy)} className="w-full rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60">
                检测游戏端口
              </button>
              {lastConnectivity ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{lastConnectivity}</p> : null}
            </div>
          </div>
        </aside>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Globe className="h-4 w-4 text-amber-600" />
            组网与高级工具关系
          </h3>
          <p className="text-sm leading-relaxed text-slate-500">
            通用组网中心负责建立基础虚拟局域网。若游戏需要端口转发、UDP 单播或局域网大厅广播发现，再进入高级连接工具补充 TCP/UDP/广播桥。
          </p>
          <button onClick={() => onNavigateTab('advanced_tools')} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
            打开高级连接工具
          </button>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-950 p-5 text-white shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-200">
            <Server className="h-4 w-4" />
            n2n 最近日志
          </h3>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
            {(logs.length ? logs : ['暂无 n2n 日志。启动或刷新后会显示后端最近输出。']).join('\n')}
          </pre>
        </section>
      </div>
    </div>
  );
}
