import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  FileSearch,
  FolderOpen,
  Gamepad2,
  Network,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  ShieldQuestion,
  Target,
  Wrench,
  XCircle
} from 'lucide-react';
import { analyzeGame, recommendPlans, scanGames } from '../api/tauri';
import type { GameAnalysis, GameSummary } from '../types/game';
import type { Recommendation } from '../types/recommendation';
import { getReferenceSelectedGame, setReferenceSelectedGame } from '../reference-adapter/selectedGame';
import { refreshReferenceRuntime } from '../reference-adapter/actions';
import {
  getReferenceAdapterSyncResult,
  subscribeReferenceAdapterSyncResult
} from '../reference-adapter/adapterSyncResult';
import {
  adapterVersionLabel,
  buildApplicabilityList,
  compactPlanSummary,
  conversionMethodsFor,
  deriveAdapterCategory,
  gameCapabilityLabel,
  multiplayerSummary,
  networkTypeLabel,
  registryVersionLabel,
  sourceLabel,
  summarizeAdapterInventory,
  type AdapterCategoryId
} from './adapterPresentation';
import { buildGameScanRecommendationExplanation } from './gameScanRecommendationExplanation';
import { productPageCacheLabel, readProductPageCache, writeProductPageCache } from './productPageCache';

import { ProductBusyOverlay } from './ProductBusyOverlay';

interface ProductGameScanViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

const GAME_SCAN_CACHE_KEY = 'lan-helper.product.gameScan.cache.v1';

interface GameScanPageCache {
  games: GameSummary[];
  selectedGameId: string;
  loadedAt: string;
}

export function ProductGameScanView({ onTriggerToast, onNavigateTab }: ProductGameScanViewProps) {
  const initialCache = useMemo(() => readProductPageCache<GameScanPageCache>(GAME_SCAN_CACHE_KEY), []);
  const [games, setGames] = useState<GameSummary[]>(() => initialCache?.data.games ?? []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'detected' | 'convertible'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AdapterCategoryId>('all');
  const [selectedGameId, setSelectedGameId] = useState(() => getReferenceSelectedGame()?.game_id || initialCache?.data.selectedGameId || '');
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState('');
  const [loadedAt, setLoadedAt] = useState(() => initialCache?.data.loadedAt || '');
  const [syncResult, setSyncResult] = useState(() => getReferenceAdapterSyncResult()?.result ?? null);

  const selectedGame = games.find((game) => game.game_id === selectedGameId) ?? null;

  const filteredGames = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return games.filter((game) => {
      const matchesQuery = !needle || game.display_name.toLowerCase().includes(needle) || game.game_id.toLowerCase().includes(needle);
      const matchesFilter =
        filter === 'all'
          || (filter === 'detected' && Boolean(game.detected_path))
          || (filter === 'convertible' && Boolean(
            game.multiplayer_conversion?.can_convert_to_lan
            || game.capabilities.includes('lan')
            || game.capabilities.includes('ip_join')
            || game.capabilities.includes('dedicated_server')
          ));
      const matchesCategory = categoryFilter === 'all' || deriveAdapterCategory(game).id === categoryFilter;
      return matchesQuery && matchesFilter && matchesCategory;
    });
  }, [categoryFilter, filter, games, query]);

  const inventory = useMemo(() => summarizeAdapterInventory(games), [games]);
  const analysisExplanation = useMemo(() => analysis ? buildGameScanRecommendationExplanation(analysis) : null, [analysis]);
  const cacheLabel = productPageCacheLabel(initialCache);

  const saveGameScanCache = (nextGames = games, nextSelectedGameId = selectedGameId, nextLoadedAt = loadedAt) => {
    writeProductPageCache<GameScanPageCache>(GAME_SCAN_CACHE_KEY, {
      games: nextGames,
      selectedGameId: nextSelectedGameId,
      loadedAt: nextLoadedAt,
    });
  };

  const runScan = async (label = '扫描本地游戏') => {
    setBusy(label);
    try {
      const result = await scanGames();
      setGames(result);
      const nextLoadedAt = new Date().toLocaleString();
      setLoadedAt(nextLoadedAt);
      const selected = getReferenceSelectedGame();
      if (selected && result.some((game) => game.game_id === selected.game_id)) setSelectedGameId(selected.game_id);
      saveGameScanCache(result, selected?.game_id || selectedGameId, nextLoadedAt);
      await refreshReferenceRuntime(false).catch(() => undefined);
      onTriggerToast(`真实扫描完成：发现 ${result.length} 个游戏/适配目标。`);
    } catch (error) {
      onTriggerToast(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    if (initialCache?.data.games?.length) {
      refreshReferenceRuntime(false).catch(() => undefined);
      return;
    }
    runScan('首次读取真实游戏列表');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => subscribeReferenceAdapterSyncResult((record) => {
    setSyncResult(record?.result ?? null);
  }), []);

  const selectGame = (game: GameSummary) => {
    const selected = setReferenceSelectedGame(game);
    setSelectedGameId(selected.game_id);
    saveGameScanCache(games, selected.game_id, loadedAt);
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

  const openScanRecommendedNextStep = (game: GameSummary) => {
    const explanation = buildGameScanRecommendationExplanation(game);
    selectGame(game);
    onNavigateTab(explanation.targetTab);
    onTriggerToast(`${game.display_name}：${explanation.headline}，${explanation.nextStep}`);
  };

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="games">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在扫描、分析或刷新游戏列表；完成前请不要重复点击扫描/分析按钮。" />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">游戏扫描</h2>
          <p className="mt-1 text-sm text-slate-500">扫描游戏后，直接告诉你该用哪种联机方式。</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">最近真实扫描：{loadedAt || '尚未完成'} ｜ 上次缓存：{cacheLabel} ｜ 当前目标：{selectedGame?.display_name || getReferenceSelectedGame()?.display_name || '未选择'}</p>
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
        <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">adapter 库内可用游戏分类</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  这里会把游戏分成虚拟网、服务端、端口工具、远程同屏或待复核几类，方便下一步直接操作。
                </p>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-[11px] text-slate-500">
              {registryVersionLabel(syncResult)}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`rounded-xl border p-3 text-left transition ${
                categoryFilter === 'all'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <p className="text-lg font-bold">{inventory.total}</p>
              <p className="text-[11px] font-bold">全部目标</p>
            </button>
            {inventory.counts.map((category) => {
              const selected = categoryFilter === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setCategoryFilter(category.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selected ? category.panelClass : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${category.iconBgClass}`}>
                      {category.id === 'dedicated_server' ? <Server className="h-3.5 w-3.5" /> : category.id === 'bridge_or_proxy' ? <Wrench className="h-3.5 w-3.5" /> : category.id === 'needs_review' ? <ShieldQuestion className="h-3.5 w-3.5" /> : <Network className="h-3.5 w-3.5" />}
                    </span>
                    <b className="text-lg text-slate-800">{category.count}</b>
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-slate-800">{category.shortLabel}</p>
                </button>
              );
            })}
          </div>
        </div>

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
              const category = deriveAdapterCategory(game);
              const methods = conversionMethodsFor(game);
              const conditions = buildApplicabilityList(game, 3);
              const explanation = buildGameScanRecommendationExplanation(game);
              return (
                <article key={game.game_id} className={`rounded-2xl border p-4 shadow-sm transition ${selected ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <Gamepad2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-800">{game.display_name}</h3>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${category.badgeClass}`}>
                            {category.shortLabel}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-400">{game.game_id}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {selected ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">推荐目标</span> : null}
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${explanation.qualityBadgeClass}`}>
                        {explanation.qualityLabel} {explanation.qualityScore}分
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-500">
                    <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{multiplayerSummary(game)}</p>
                    <p className="flex items-center gap-2"><Network className="h-4 w-4 text-amber-500" />{networkTypeLabel(game.network_type)} · {sourceLabel(game.adapter_source)}</p>
                    <p className="truncate font-mono text-[11px]">{game.detected_path || '未检测到安装路径，仍可基于 adapter 做方案分析。'}</p>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {methods.map((method) => (
                        <span key={method} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                          {method}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      版本：{adapterVersionLabel(game, syncResult)} ｜ 能力：{game.capabilities.map(gameCapabilityLabel).join('、') || '未标注'}
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-500">
                      {conditions.map((condition) => <li key={condition}>• {condition}</li>)}
                    </ul>
                  </div>

                  <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3" data-game-scan-recommendation-explanation="card">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {explanation.routeBadge}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{explanation.headline}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">{explanation.reason}</p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-700">下一步：{explanation.nextStep}</p>
                    <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-500">
                      {explanation.evidence.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
                    </ul>
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
                    <button
                      onClick={() => openScanRecommendedNextStep(game)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                        explanation.shouldReviewFirst
                          ? 'border border-rose-200 text-rose-700 hover:bg-rose-50'
                          : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {explanation.actionLabel}
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
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${deriveAdapterCategory(analysis).badgeClass}`}>{deriveAdapterCategory(analysis).label}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-800">{compactPlanSummary(analysis.connection_plan)}</p>
                <p className="mt-2">房主：{analysis.connection_plan?.host_role || '-'}</p>
                <p className="mt-1">加入者：{analysis.connection_plan?.join_role || '-'}</p>
              </div>
              {analysisExplanation ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4" data-game-scan-recommendation-explanation="analysis">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-amber-700">
                      自动推荐解释
                    </span>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                      {analysisExplanation.routeTitle}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${analysisExplanation.qualityBadgeClass}`}>
                      可信度：{analysisExplanation.qualityLabel} {analysisExplanation.qualityScore}分
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{analysisExplanation.headline}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{analysisExplanation.reason}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">下一步：{analysisExplanation.nextStep}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {analysisExplanation.evidence.slice(0, 4).map((item) => (
                      <div key={item} className="rounded-lg bg-white/80 p-2 text-[11px] leading-relaxed text-slate-600">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">推荐转换方式</p>
                  <div className="flex flex-wrap gap-1.5">
                    {conversionMethodsFor(analysis).map((method) => (
                      <span key={method} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{method}</span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">来源：{sourceLabel(analysis.adapter_source)} ｜ {adapterVersionLabel(analysis, syncResult)}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">适用条件</p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-slate-600">
                    {buildApplicabilityList(analysis, 4).map((condition) => <li key={condition}>• {condition}</li>)}
                  </ul>
                </div>
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
