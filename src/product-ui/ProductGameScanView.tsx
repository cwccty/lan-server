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
import { writeAdvancedToolIntent } from './advancedToolIntent';
import {
  buildAdapterCategoryRoute,
  rememberAdapterCategoryRouteAnchor,
  scrollToAdapterCategoryRouteAnchor,
} from './adapterCategoryRoute';
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
import { gameProfileToneClass, getGameConnectionProfile } from './gameConnectionProfiles';
import { productPageCacheLabel, readProductPageCache, writeProductPageCache } from './productPageCache';

import { ProductBusyOverlay } from './ProductBusyOverlay';

interface ProductGameScanViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

const GAME_SCAN_CACHE_KEY = 'lan-helper.product.gameScan.cache.v1';
type GameScanStatusFilter = 'all' | 'detected' | 'has_plan' | 'missing_path' | 'pending_verify';

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
  const [statusFilter, setStatusFilter] = useState<GameScanStatusFilter>('all');
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
      const profile = getGameConnectionProfile(game);
      const matchesStatus =
        statusFilter === 'all'
        || (statusFilter === 'detected' && Boolean(game.detected_path))
        || (statusFilter === 'has_plan' && Boolean(game.connection_plan || game.multiplayer_conversion || profile))
        || (statusFilter === 'missing_path' && !game.detected_path)
        || (statusFilter === 'pending_verify' && profile?.verificationTone === 'pending');
      return matchesQuery && matchesFilter && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, filter, games, query, statusFilter]);

  const inventory = useMemo(() => summarizeAdapterInventory(games), [games]);
  const statusCounts = useMemo(() => ({
    detected: games.filter((game) => Boolean(game.detected_path)).length,
    hasPlan: games.filter((game) => Boolean(game.connection_plan || game.multiplayer_conversion || getGameConnectionProfile(game))).length,
    missingPath: games.filter((game) => !game.detected_path).length,
    pendingVerify: games.filter((game) => getGameConnectionProfile(game)?.verificationTone === 'pending').length,
  }), [games]);
  const selectedCategoryRoute = categoryFilter === 'all' ? null : buildAdapterCategoryRoute(categoryFilter);
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
      onTriggerToast(`扫描完成：发现 ${result.length} 个可用方案。`);
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
    runScan('首次读取游戏列表');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => subscribeReferenceAdapterSyncResult((record) => {
    setSyncResult(record?.result ?? null);
  }), []);

  const selectGame = (game: GameSummary) => {
    const selected = setReferenceSelectedGame(game);
    setSelectedGameId(selected.game_id);
    saveGameScanCache(games, selected.game_id, loadedAt);
    onTriggerToast(`已选择 ${selected.display_name}。`);
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
      onTriggerToast(`已完成 ${game.display_name} 的联机分析。`);
    } catch (error) {
      onTriggerToast(`分析失败：${error instanceof Error ? error.message : String(error)}`);
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

  const openCategoryRoute = (categoryId: AdapterCategoryId) => {
    const route = buildAdapterCategoryRoute(categoryId);
    if (route.intent) writeAdvancedToolIntent(route.intent);
    rememberAdapterCategoryRouteAnchor(route);
    onNavigateTab(route.targetTab);
    scrollToAdapterCategoryRouteAnchor(route.anchorSelector);
    onTriggerToast(route.toast);
  };

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="games">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在扫描游戏或刷新列表；完成前请不要重复点击按钮。" />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">游戏扫描</h2>
          <p className="mt-1 text-sm text-slate-500">扫描后选择游戏，按推荐继续开房或加入。</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400" data-game-scan-technical-details="advanced">最近扫描：{loadedAt || '尚未完成'} ｜ 上次缓存：{cacheLabel} ｜ 当前目标：{selectedGame?.display_name || getReferenceSelectedGame()?.display_name || '未选择'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runScan('手动重扫')}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <FolderOpen className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {busy || '重新扫描'}
          </button>
          <button
            onClick={() => runScan('同步 Steam 缓存')}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            data-game-scan-technical-details="advanced"
          >
            <RefreshCw className="h-4 w-4" />
            强制刷新扫描缓存
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">先选择你要联机的游戏</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                找到游戏后点“选择此游戏”，再点“按推荐继续”。如果列表不对，先重新扫描。
              </p>
            </div>
            <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-xl bg-white/80 px-3 py-2">
                <b className="text-slate-800">{games.length}</b>
                <span className="ml-1">个可用方案</span>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-2">
                <b className="text-slate-800">{games.filter((game) => game.detected_path).length}</b>
                <span className="ml-1">个已检测到安装</span>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-2">
                <b className="text-slate-800">{selectedGame?.display_name || '未选择'}</b>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4" data-game-scan-method-filter="visible">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">按联机方式筛选游戏</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  不确定该怎么玩时，先点一个方式。列表会只保留适合这类方式的游戏，再按卡片里的“下一步”继续。
                </p>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-[11px] text-slate-500">
              {registryVersionLabel(syncResult)}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`rounded-xl border p-3 text-left transition ${
                categoryFilter === 'all'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <p className="text-lg font-bold">{inventory.total}</p>
              <p className="text-[11px] font-bold">全部游戏</p>
              <p className={`mt-1 text-[10px] leading-relaxed ${categoryFilter === 'all' ? 'text-slate-200' : 'text-slate-500'}`}>查看所有已收录或已扫描到的游戏。</p>
              <p className={`mt-2 text-[10px] leading-relaxed ${categoryFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                适合不确定路线时先全局搜索。
              </p>
            </button>
            {inventory.counts.map((category) => {
              const selected = categoryFilter === category.id;
              const hasExamples = category.examples.length > 0;
              return (
                <button
                  key={category.id}
                  onClick={() => setCategoryFilter(category.id)}
                  aria-pressed={selected}
                  className={`min-h-[158px] rounded-xl border p-3 text-left transition ${
                    selected
                      ? category.panelClass
                      : category.count === 0
                        ? 'border-dashed border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${category.iconBgClass}`}>
                      {category.id === 'dedicated_server' ? <Server className="h-3.5 w-3.5" /> : category.id === 'bridge_or_proxy' ? <Wrench className="h-3.5 w-3.5" /> : category.id === 'needs_review' ? <ShieldQuestion className="h-3.5 w-3.5" /> : <Network className="h-3.5 w-3.5" />}
                    </span>
                    <div className="text-right">
                      <b className="text-lg text-slate-800">{category.count}</b>
                      <p className="text-[10px] font-bold text-slate-500">{category.count > 0 ? '已收录' : '待补充'}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-slate-800">{category.shortLabel}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-500">{category.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {hasExamples
                      ? category.examples.map((example) => (
                        <span key={example} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-100">
                          {example}
                        </span>
                      ))
                      : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          暂无支持游戏示例
                        </span>
                      )}
                  </div>
                  <p className="mt-2 text-[10px] font-bold text-slate-700">
                    下一步：{buildAdapterCategoryRoute(category.id).actionLabel}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[11px] leading-relaxed text-slate-500">
              当前筛选后显示 <b className="text-slate-800">{filteredGames.length}</b> 个游戏。分类只帮助快速选择路线，最终仍以游戏卡片里的“下一步”为准。
              {selectedCategoryRoute ? <span className="ml-1 text-slate-600">{selectedCategoryRoute.description}</span> : null}
            </p>
            {selectedCategoryRoute ? (
              <button
                onClick={() => openCategoryRoute(categoryFilter as AdapterCategoryId)}
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-800"
              >
                {selectedCategoryRoute.actionLabel}
              </button>
            ) : null}
          </div>
          {inventory.total === 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">还没有可选择的游戏方案</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">
                    先更新方案库，再重新扫描本机游戏。更新后这里会显示每种联机方式支持哪些游戏。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onNavigateTab('solutions')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    <Database className="h-4 w-4" />
                    去更新方案库
                  </button>
                  <button
                    onClick={() => runScan('重新扫描游戏')}
                    disabled={Boolean(busy)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                    重新扫描
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4" data-game-scan-status-filter="visible">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">按状态快速找下一步</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                不想先理解分类时，直接按当前状态筛选：已检测到、可按方案继续、需要补路径、待实机验证。
              </p>
            </div>
            {statusFilter !== 'all' ? (
              <button onClick={() => setStatusFilter('all')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                清空状态筛选
              </button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { id: 'detected' as GameScanStatusFilter, label: '已检测到', count: statusCounts.detected, help: '本机已有安装路径，可以直接选游戏继续。' },
              { id: 'has_plan' as GameScanStatusFilter, label: '可按方案继续', count: statusCounts.hasPlan, help: '方案库已有路线或游戏闭环说明。' },
              { id: 'missing_path' as GameScanStatusFilter, label: '需要补充路径', count: statusCounts.missingPath, help: '可先看方案，也可以重新扫描或手动反馈。' },
              { id: 'pending_verify' as GameScanStatusFilter, label: '待实机验证', count: statusCounts.pendingVerify, help: '已有操作路径，但不能标成真实通过。' },
            ].map((item) => {
              const selected = statusFilter === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setStatusFilter(item.id)}
                  className={`rounded-xl border p-3 text-left transition ${selected ? 'border-slate-900 bg-slate-900 text-white' : item.count === 0 ? 'border-dashed border-slate-200 bg-slate-50 text-slate-500 hover:bg-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold">{item.label}</p>
                    <b className="text-lg">{item.count}</b>
                  </div>
                  <p className={`mt-1 text-[11px] leading-relaxed ${selected ? 'text-slate-200' : 'text-slate-500'}`}>
                    {item.count === 0 ? '暂未收录，欢迎反馈或导入方案。' : item.help}
                  </p>
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
              placeholder="搜索游戏名"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-400"
            />
          </label>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-400"
          >
            <option value="all">全部游戏</option>
            <option value="detected">已检测到安装</option>
            <option value="convertible">有可用联机方案</option>
          </select>
        </div>

        {filteredGames.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-slate-900">
              {games.length === 0 ? '还没有扫描到可用游戏' : '当前筛选下没有游戏'}
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
              {games.length === 0
                ? '先更新方案库，再重新扫描本机。即使游戏没有安装，只要方案库有记录，也可以查看推荐联机方式。'
                : '换一个联机方式分类，或清空搜索关键词后再查看。'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {games.length === 0 ? (
                <button
                  onClick={() => onNavigateTab('solutions')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Database className="h-4 w-4" />
                  先更新方案库
                </button>
              ) : (
                <button
                  onClick={() => {
                    setQuery('');
                    setCategoryFilter('all');
                    setFilter('all');
                    setStatusFilter('all');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  查看全部游戏
                </button>
              )}
              <button
                onClick={() => runScan('重新扫描游戏')}
                disabled={Boolean(busy)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                重新扫描
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredGames.map((game) => {
              const selected = game.game_id === selectedGameId;
              const category = deriveAdapterCategory(game);
              const methods = conversionMethodsFor(game);
              const conditions = buildApplicabilityList(game, 3);
              const explanation = buildGameScanRecommendationExplanation(game);
              const profile = getGameConnectionProfile(game);
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
                        <p className="font-mono text-[11px] text-slate-400" data-game-scan-technical-details="advanced">{game.game_id}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {selected ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">已选择</span> : null}
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${explanation.qualityBadgeClass}`} data-game-scan-technical-details="advanced">
                        {explanation.qualityLabel} {explanation.qualityScore}分
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-500">
                    <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{multiplayerSummary(game)}</p>
                    <p className="flex items-center gap-2" data-game-scan-technical-details="advanced"><Network className="h-4 w-4 text-amber-500" />{networkTypeLabel(game.network_type)} · {sourceLabel(game.adapter_source)}</p>
                    <p className="truncate font-mono text-[11px]" data-game-scan-technical-details="advanced">{game.detected_path || '未检测到安装路径，仍可基于方案库分析。'}</p>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3" data-game-scan-methods="visible">
                    <p className="mb-2 text-[11px] font-bold text-slate-700">支持的联机方式</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(methods.length ? methods : [category.shortLabel]).map((method) => (
                        <span key={method} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3" data-game-scan-technical-details="advanced">
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
                    <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-500" data-game-scan-recommendation-evidence="details">
                      {explanation.evidence.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>

                  {profile ? (
                    <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3" data-game-connection-profile="card">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${gameProfileToneClass(profile)}`}>
                          {profile.verificationLabel}
                        </span>
                        {profile.methodTags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{tag}</span>
                        ))}
                      </div>
                      <p className="text-[11px] font-bold text-slate-800">推荐：{profile.mainPath}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <p className="rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                          <b className="text-slate-800">房主：</b>{profile.hostFirstStep}
                        </p>
                        <p className="rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                          <b className="text-slate-800">加入者：</b>{profile.guestFirstStep}
                        </p>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        失败先查：{profile.failureChecks.slice(0, 2).join('；')}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => selectGame(game)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Target className="mr-1 inline h-3.5 w-3.5" />
                      {selected ? '已选择' : '选择此游戏'}
                    </button>
                    <button onClick={() => analyze(game)} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60" data-game-scan-technical-details="advanced">
                      <FileSearch className="mr-1 inline h-3.5 w-3.5" />
                      分析详情
                    </button>
                    <button onClick={() => goRecommendation(game)} className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50">
                      进入开房向导
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

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]" data-game-scan-technical-details="advanced">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-800">分析结果</h3>
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
              点击某个游戏的“分析详情”后，这里会显示分析结果。
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-800">推荐预览</h3>
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
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">暂无推荐预览。完成分析详情后会显示。</p>
          )}
        </aside>
      </section>
    </div>
  );
}
