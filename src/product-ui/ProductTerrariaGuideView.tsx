import { useEffect, useMemo, useState } from 'react';
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
import { readProductPageCache, writeProductPageCache } from './productPageCache';

import { ProductBusyOverlay } from './ProductBusyOverlay';

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

const TERRARIA_FORM_CACHE_KEY = 'lan-helper.product.terraria.form.cache.v1';

interface TerrariaFormCache {
  worldMode: 'choice' | 'path';
  worldChoice: string;
  worldPath: string;
  port: string;
  password: string;
  maxPlayers: string;
  autoForward: boolean;
}

export function ProductTerrariaGuideView({ onTriggerToast }: ProductTerrariaGuideViewProps) {
  const runtime = useReferenceRuntime();
  const terraria = runtime.terraria;
  const initialFormCache = useMemo(() => readProductPageCache<TerrariaFormCache>(TERRARIA_FORM_CACHE_KEY), []);
  const [worldMode, setWorldMode] = useState<'choice' | 'path'>(() => initialFormCache?.data.worldMode || 'choice');
  const [worldChoice, setWorldChoice] = useState(() => initialFormCache?.data.worldChoice || '1');
  const [worldPath, setWorldPath] = useState(() => initialFormCache?.data.worldPath || '');
  const [port, setPort] = useState(() => initialFormCache?.data.port || '7777');
  const [password, setPassword] = useState(() => initialFormCache?.data.password || '');
  const [maxPlayers, setMaxPlayers] = useState(() => initialFormCache?.data.maxPlayers || '8');
  const [autoForward, setAutoForward] = useState(() => initialFormCache?.data.autoForward ?? false);
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    readReferenceTerrariaServer()
      .then(() => refreshReferenceRuntime(false))
      .catch(() => refreshReferenceRuntime(false).catch(() => undefined));
  }, []);

  useEffect(() => {
    writeProductPageCache<TerrariaFormCache>(TERRARIA_FORM_CACHE_KEY, {
      worldMode,
      worldChoice,
      worldPath,
      port,
      password,
      maxPlayers,
      autoForward,
    });
  }, [autoForward, maxPlayers, password, port, worldChoice, worldMode, worldPath]);

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
      `房主联机地址：${runtime.network.virtualIp || '请先在加入与组网页启动组网'}`,
      `密码：${password || '无'}`,
      '好友加入：进入 Terraria 多人游戏，连接房主联机地址和上面的端口。'
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

  const flowSummary = [
    terraria.running ? '服务端已启动' : '选择世界并启动服务端',
    runtime.network.virtualIp ? '组网已有联机地址' : '先到加入与组网页启动组网',
    terraria.ready ? '可以复制邀请给好友' : '等待服务端就绪后再邀请',
  ];
  const preparedItems = [
    { label: '世界', value: worldMode === 'path' ? (worldPath.trim() || '未填写') : `编号 ${worldChoice || '1'}` },
    { label: '端口', value: port || '7777' },
    { label: '人数', value: `${maxPlayers || '8'} 人` },
    { label: '密码', value: password ? '已设置' : '无密码' },
  ];
  const upcomingServerGames = [
    { name: 'Palworld', detail: '专用服务端和端口检测' },
    { name: 'Minecraft', detail: 'Java 版开服与地址邀请' },
    { name: 'Stardew Valley', detail: '房主模式与好友加入提示' },
    { name: 'Cuphead', detail: '远程同屏开局说明' },
  ];
  const logs = lastLines(terraria.recentLogs, 24);

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="terraria">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在处理 Terraria 服务端；请等待状态刷新。" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">Terraria 向导</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            选择世界，启动服务端，然后复制邀请给好友。
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
                <h3 className="text-base font-bold text-slate-800">开 Terraria 房间</h3>
                <p className="mt-1 text-xs text-slate-500">填好世界和端口后启动。再次进入会保留上次填写内容。</p>
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
                  <span className="mt-1 block text-[11px] text-slate-400" data-terraria-technical-details="advanced">按文档/My Games/Terraria/Worlds 里的 .wld 排序选择。</span>
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
                  检查服务端
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
              当前状态
            </h3>
            <div className="space-y-2 text-xs text-slate-600">
              <p>服务状态：{terraria.ready ? '可以邀请好友' : terraria.running ? '正在启动，请稍等' : '未启动'}</p>
              <p>房主联机地址：<span className="font-mono">{runtime.network.virtualIp || '-'}</span></p>
              <p>消息：{terraria.message}</p>
              <div className="space-y-2" data-terraria-technical-details="advanced">
                <p>运行：{terraria.running ? '是' : '否'}</p>
                <p>就绪：{terraria.ready ? '是' : '否'}</p>
                <p>PID：{terraria.pid ?? '-'}</p>
              </div>
            </div>
            {terraria.running ? (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                服务端已启动。确认状态变为“可以邀请好友”后复制邀请。
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                <AlertCircle className="mr-1 inline h-4 w-4" />
                若启动失败，请确认 Terraria 已安装，并检查世界文件是否存在。
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-800">开服流程摘要</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                  右侧会告诉你现在卡在哪一步。以后 Palworld、Minecraft、Stardew、Cuphead 等游戏也会按同样结构加入“一键开服”能力。
                </p>
              </div>
              <button onClick={copyInvite} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
                <Copy className="h-4 w-4" />
                复制加入方式
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {flowSummary.map((item, index) => (
                <div key={item} className={`rounded-xl p-3 text-xs leading-relaxed ${index === 0 && terraria.running || index === 1 && runtime.network.virtualIp || index === 2 && terraria.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <span className="font-bold">{index + 1}. </span>{item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">已准备项目</h3>
              <div className="grid gap-2">
                {preparedItems.map((item) => (
                  <div key={item.label} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <span className="shrink-0 font-bold text-slate-600">{item.label}</span>
                    <span className="min-w-0 break-words text-right font-semibold text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">好友加入方式</h3>
              <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-slate-600">
                <li>房主先确认组网已启动，并看到自己的联机地址。</li>
                <li>Terraria 服务端状态变成“可以邀请好友”。</li>
                <li>复制加入方式发给好友。</li>
                <li>好友在游戏里选择多人游戏，通过 IP 加入房主联机地址和端口。</li>
              </ol>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">更多游戏一键开服陆续支持</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              当前先提供 Terraria 专用向导。后续会把不同游戏放进统一的“游戏开服能力区”，每个游戏用卡片展示准备项、启动方式、端口检测和好友加入方法。
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {upcomingServerGames.map((game) => (
                <div key={game.name} className="rounded-xl bg-white/80 p-3 text-xs leading-relaxed text-slate-600">
                  <p className="font-bold text-slate-900">{game.name}</p>
                  <p className="mt-1">{game.detail}</p>
                  <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">即将支持</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">常见问题</h3>
            <div className="grid gap-2 text-xs leading-relaxed text-slate-600 md:grid-cols-2">
              <p className="rounded-xl bg-slate-50 p-3"><b className="text-slate-800">没有联机地址？</b><br />先去“加入与组网”页保存并启动组网，再回到这里复制邀请。</p>
              <p className="rounded-xl bg-slate-50 p-3"><b className="text-slate-800">好友连不上？</b><br />先检查 Terraria 服务端是否就绪，再到诊断报告页重新检测。</p>
              <p className="rounded-xl bg-slate-50 p-3"><b className="text-slate-800">端口不是 7777？</b><br />把这里的端口改成游戏或服务端实际使用的端口，然后重新复制邀请。</p>
              <p className="rounded-xl bg-slate-50 p-3"><b className="text-slate-800">启动失败？</b><br />确认 Terraria 已安装、世界文件存在；仍失败就复制日志或打开诊断报告。</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Terminal className="h-4 w-4 text-amber-600" />
                  服务端日志与控制台
                </h3>
                <p className="mt-1 text-xs text-slate-500">普通用户一般只看上面的流程摘要；排查时再看这里的日志。</p>
              </div>
              <button onClick={refreshServer} disabled={Boolean(busy)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                刷新日志
              </button>
            </div>

            <pre className="min-h-[420px] max-h-[520px] overflow-auto rounded-2xl bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-300">
              {(logs.length ? logs : ['暂无 Terraria 服务端日志。启动服务端或点击检查服务端后会显示最近输出。']).join('\n')}
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
              注意：部分服务端指令可能不会返回交互式结果，应以日志和进程状态为准。
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
