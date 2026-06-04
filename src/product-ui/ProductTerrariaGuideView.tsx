import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Play,
  RefreshCw,
  Save,
  Send,
  Server,
  Square,
  Terminal
} from 'lucide-react';
import {
  readReferenceTerrariaServer,
  refreshReferenceRuntime,
  sendReferenceTerrariaCommand,
  startReferenceTerrariaServer,
  stopReferenceTerrariaServer
} from '../reference-adapter/actions';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';

interface ProductTerrariaGuideViewProps {
  onTriggerToast: (msg: string) => void;
}

function statusLabel(session: ReturnType<typeof useReferenceRuntime>['terraria']) {
  if (session.ready) return '服务端已就绪';
  if (session.running) return '服务端运行中';
  return '服务端未运行';
}

function statusTone(session: ReturnType<typeof useReferenceRuntime>['terraria']) {
  if (session.ready) return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (session.running) return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function lastLines(lines: string[] = [], count = 18) {
  return lines.slice(-count);
}

export function ProductTerrariaGuideView({ onTriggerToast }: ProductTerrariaGuideViewProps) {
  const runtime = useReferenceRuntime();
  const terraria = runtime.terraria;
  const [worldMode, setWorldMode] = useState<'choice' | 'path'>('choice');
  const [worldChoice, setWorldChoice] = useState('1');
  const [worldPath, setWorldPath] = useState('');
  const [port, setPort] = useState('7777');
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('8');
  const [autoForward, setAutoForward] = useState(false);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    readReferenceTerrariaServer()
      .then(() => refreshReferenceRuntime(false))
      .catch(() => refreshReferenceRuntime(false).catch(() => undefined));
  }, []);

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

  const buildConfig = () => {
    const config: Record<string, string | number | boolean> = {
      port: Number(port) || 7777,
      max_players: Number(maxPlayers) || 8,
      password,
      auto_forward: autoForward
    };
    if (worldMode === 'path') {
      config.world_path = worldPath.trim();
    } else {
      config.world_choice = Number(worldChoice) || 1;
    }
    return config;
  };

  const startServer = () => run('启动 Terraria 服务端', () => startReferenceTerrariaServer(buildConfig()));
  const stopServer = () => run('停止 Terraria 服务端', () => stopReferenceTerrariaServer());
  const refreshServer = () => run('读取 Terraria 会话', () => readReferenceTerrariaServer());
  const sendCommand = () => run('发送 Terraria 指令', () => sendReferenceTerrariaCommand(command));

  const copyInvite = async () => {
    const text = [
      'Terraria 联机邀请摘要',
      `服务端状态：${statusLabel(terraria)}`,
      `端口：${port || '7777'}`,
      `房主虚拟 IP：${runtime.network.virtualIp || '请先在通用组网中心启动 n2n'}`,
      `密码：${password || '无'}`,
      '好友加入：进入 Terraria 多人游戏，连接房主虚拟 IP 和上面的端口。'
    ].join('\n');
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(text);
      onTriggerToast('已复制 Terraria 联机摘要。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const logs = lastLines(terraria.recentLogs, 24);

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="terraria">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">Terraria 向导</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            正式 Product 页面，直接控制真实 Terraria 服务端会话；不再生成模拟日志，也不再用 setTimeout 假装启动成功。
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${statusTone(terraria)}`}>
          <span className={`h-2 w-2 rounded-full ${terraria.ready ? 'bg-emerald-500' : terraria.running ? 'bg-amber-500' : 'bg-slate-400'}`} />
          {busy || statusLabel(terraria)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">服务端启动参数</h3>
                <p className="mt-1 text-xs text-slate-500">参数会传给真实 TerrariaServer.exe。</p>
              </div>
              <button onClick={copyInvite} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                <Copy className="h-4 w-4" />
                复制邀请
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-1">
                <button
                  onClick={() => setWorldMode('choice')}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${worldMode === 'choice' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  世界编号
                </button>
                <button
                  onClick={() => setWorldMode('path')}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${worldMode === 'path' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  世界路径
                </button>
              </div>

              {worldMode === 'choice' ? (
                <label className="block text-xs font-semibold text-slate-600">
                  世界编号
                  <input value={worldChoice} onChange={(event) => setWorldChoice(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
                  <span className="mt-1 block text-[11px] text-slate-400">按文档/My Games/Terraria/Worlds 里的 .wld 排序选择。</span>
                </label>
              ) : (
                <label className="block text-xs font-semibold text-slate-600">
                  世界文件完整路径
                  <input value={worldPath} onChange={(event) => setWorldPath(event.target.value)} placeholder="C:\\Users\\...\\Worlds\\world.wld" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-slate-600">
                  端口
                  <input value={port} onChange={(event) => setPort(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  最大人数
                  <input value={maxPlayers} onChange={(event) => setMaxPlayers(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
                </label>
              </div>

              <label className="block text-xs font-semibold text-slate-600">
                房间密码
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="留空表示无密码" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                允许 UPnP 自动端口映射
                <input type="checkbox" checked={autoForward} onChange={(event) => setAutoForward(event.target.checked)} />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={startServer} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  <Play className="h-4 w-4" />
                  启动自建服务
                </button>
                <button onClick={stopServer} disabled={Boolean(busy) || !terraria.running} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-100 px-3 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                  <Square className="h-4 w-4" />
                  停止服务
                </button>
                <button onClick={refreshServer} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  <RefreshCw className={`h-4 w-4 ${busy === '读取 Terraria 会话' ? 'animate-spin' : ''}`} />
                  一键自检
                </button>
                <button onClick={() => onTriggerToast('配置已在当前表单中保留。启动服务时会传入后端。')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Save className="h-4 w-4" />
                  保留配置
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Server className="h-4 w-4 text-amber-600" />
              真实会话状态
            </h3>
            <div className="space-y-2 text-xs text-slate-600">
              <p>运行：{terraria.running ? '是' : '否'}</p>
              <p>就绪：{terraria.ready ? '是' : '否'}</p>
              <p>PID：{terraria.pid ?? '-'}</p>
              <p>虚拟 IP：<span className="font-mono">{runtime.network.virtualIp || '-'}</span></p>
              <p>消息：{terraria.message}</p>
            </div>
            {terraria.running ? (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                后端已托管服务端进程，状态以进程和端口监听为准。
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                <AlertCircle className="mr-1 inline h-4 w-4" />
                若启动失败，请确认已安装 Terraria、世界文件存在，并查看日志中的错误原因。
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Terminal className="h-4 w-4 text-amber-600" />
                  服务端日志与控制台
                </h3>
                <p className="mt-1 text-xs text-slate-500">这里显示真实后端会话日志，不再显示参考页模拟启动流。</p>
              </div>
              <button onClick={refreshServer} disabled={Boolean(busy)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                刷新日志
              </button>
            </div>

            <pre className="min-h-[420px] max-h-[520px] overflow-auto rounded-2xl bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-300">
              {(logs.length ? logs : ['暂无 Terraria 服务端日志。启动服务端或点击一键自检后会显示真实后端输出。']).join('\n')}
            </pre>

            <div className="mt-3 flex gap-2">
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && command.trim()) sendCommand();
                }}
                placeholder="输入服务端指令，例如 help、save、exit"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400"
              />
              <button onClick={sendCommand} disabled={Boolean(busy) || !command.trim()} className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60">
                <Send className="h-4 w-4" />
                发送
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
              <Activity className="mr-1 inline h-4 w-4 text-amber-600" />
              注意：后端曾记录过“交互式 help/save/exit 不作为 MVP 承诺”。如果某些命令无响应，应以日志和进程状态为准，不伪造成功。
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
