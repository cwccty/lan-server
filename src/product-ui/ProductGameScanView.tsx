import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileSearch,
  FolderOpen,
  Gamepad2,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  XCircle
} from 'lucide-react';
import { analyzeGame, recommendPlans, scanGames } from '../api/tauri';
import type { GameAnalysis, GameSummary } from '../types/game';
import type { Recommendation } from '../types/recommendation';
import { getReferenceSelectedGame, setReferenceSelectedGame } from '../reference-adapter/selectedGame';
import { refreshReferenceRuntime } from '../reference-adapter/actions';

interface ProductGameScanViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

function capabilityText(game: GameSummary) {
  if (game.multiplayer_conversion?.can_convert_to_lan) return '可转换为局域网体验';
  if (game.capabilities.includes('lan')) return '原生局域网';
  if (game.capabilities.includes('dedicated_server')) return '专用服务端';
  if (game.capabilities.includes('official_server')) return '官方服优先';
  return '需要分析';
}

function networkTypeText(type?: string) {
  const map: Record<string, string> = {
    lan_ip_direct: 'IP 直连',
    dedicated_server: '专用服务端',
    tcp_port_proxy_needed: '端口代理',
    udp_broadcast_needed: 'UDP 广播桥',
    steam_lobby_direct_possible: 'Steam 大厅',
    steam_relay_plugin: 'Steam 中继入口',
    official_only: '仅官方服',
    unknown_need_review: '待人工确认'
  };
  return type ? map[type] ?? type : '未知';
}

export function ProductGameScanView({ onTriggerToast, onNavigateTab }: ProductGameScanViewProps) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'detected' | 'convertible'>('all');
  const [selectedGameId, setSelectedGameId] = useState(() => getReferenceSelectedGame()?.game_id || '');
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState('');
  const [loadedAt, setLoadedAt] = useState('');

  const selectedGame = games.find((game) => game.game_id === selectedGameId) ?? null;

  const filteredGames = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return games.filter((game) => {
      const matchesQuery = !needle || game.display_name.toLowerCase().includes(needle) || game.game_id.toLowerCase().includes(needle);
      const matchesFilter =
        filter === 'all'
          || (filter === 'detected' && Boolean(game.detected_path))
          || (filter === 'convertible' && Boolean(game.multiplayer_conversion?.can_convert_to_lan || game.capabilities.includes('lan')));
      return matchesQuery && matchesFilter;
    });
  }, [filter, games, query]);

  const runScan = async (label = '扫描本地游戏') => {
    setBusy(label);
    try {
      const result = await scanGames();
      setGames(result);
      setLoadedAt(new Date().toLocaleString());
      const selected = getReferenceSelectedGame();
      if (selected && result.some((game) => game.game_id === selected.game_id)) setSelectedGameId(selected.game_id);
      await refreshReferenceRuntime(false).catch(() => undefined);
      onTriggerToast(`真实扫描完成：发现 ${result.length} 个游戏/适配目标。`);
    } catch (error) {
      onTriggerToast(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    runScan('首次读取真实游戏列表');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectGame = (game: GameSummary) => {
    const selected = setReferenceSelectedGame(game);
    setSelectedGameId(selected.game_id);
    onTriggerToast(`已将 ${selected.display_name} 设为推荐目标。`);
  };

  const analyze = async (game: GameSummary) => {
    setBusy(`分析 ${game.display_name}`);
    try {
      selectGame(game);
      const [nextAnalysis, nextRecommendations] = await Promise.all([
        analyzeGame(game.game_id),
        recommendPlans(game.game_id).catch(() => [])
      ]);
      setAnalysis(nextAnalysis);
      setRecommendations(nextRecommendations);
      onTriggerToast(`已完成 ${game.display_name} 的真实联机能力分析。`);
    } catch (error) {
      onTriggerToast(`真实分析失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const goRecommendation = (game: GameSummary) => {
    selectGame(game);
    onNavigateTab('protocol');
  };

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="games">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">游戏扫描</h2>
          <p className="mt-1 text-sm text-slate-500">扫描本机游戏和本地适配器，判断可用的联机转换方案。</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">最近真实扫描：{loadedAt || '尚未完成'} ｜ 当前目标：{selectedGame?.display_name || getReferenceSelectedGame()?.display_name || '未选择'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runScan('手动重扫')}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <FolderOpen className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {busy || '手动重扫以刷新缓存'}
          </button>
          <button
            onClick={() => runScan('同步 Steam 缓存')}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            强同步 Steam 自适应映射
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索游戏名或 game_id"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-400"
            />
          </label>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-400"
          >
            <option value="all">全部目标</option>
            <option value="detected">已检测到安装</option>
            <option value="convertible">可局域网/可转换</option>
          </select>
        </div>

        {filteredGames.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            暂无真实扫描结果。请点击“手动重扫以刷新缓存”。
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredGames.map((game) => {
              const selected = game.game_id === selectedGameId;
              return (
                <article key={game.game_id} className={`rounded-2xl border p-4 shadow-sm transition ${selected ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <Gamepad2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{game.display_name}</h3>
                        <p className="font-mono text-[11px] text-slate-400">{game.game_id}</p>
                      </div>
                    </div>
                    {selected ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">推荐目标</span> : null}
                  </div>

                  <div className="space-y-2 text-xs text-slate-500">
                    <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" />{capabilityText(game)}</p>
                    <p className="flex items-center gap-2"><Network className="h-4 w-4 text-amber-500" />{networkTypeText(game.network_type)}</p>
                    <p className="truncate font-mono text-[11px]">{game.detected_path || '未检测到安装路径，仍可基于 adapter 做方案分析。'}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => selectGame(game)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Target className="mr-1 inline h-3.5 w-3.5" />
                      {selected ? '已设为目标' : '设为推荐目标'}
                    </button>
                    <button onClick={() => analyze(game)} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                      <FileSearch className="mr-1 inline h-3.5 w-3.5" />
                      真实分析
                    </button>
                    <button onClick={() => goRecommendation(game)} className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50">
                      查看推荐方案
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-800">真实分析结果</h3>
          {analysis ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{analysis.display_name}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">置信度：{analysis.confidence}</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">默认端口：{analysis.default_ports.join(', ') || '无'}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-800">{analysis.connection_plan?.summary || '暂无连接方案摘要。'}</p>
                <p className="mt-2">房主：{analysis.connection_plan?.host_role || '-'}</p>
                <p className="mt-1">加入者：{analysis.connection_plan?.join_role || '-'}</p>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {analysis.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              点击某个游戏的“真实分析”后，这里会显示后端分析结果。
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-800">真实推荐预览</h3>
          {recommendations.length ? (
            <div className="space-y-2">
              {recommendations.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800">{item.title}</p>
                    {item.level === 'recommended' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-400" />}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">启动项：{item.launch_profile_id || '-'}｜后端：{item.backend_id || '-'}</p>
                  {item.required_actions.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-slate-500">
                      {item.required_actions.map((action) => <li key={action}>{action}</li>)}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">暂无推荐预览。完成真实分析后会显示。</p>
          )}
        </aside>
      </section>
    </div>
  );
}
