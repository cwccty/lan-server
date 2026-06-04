import { useEffect, useState } from 'react';
import { getN2nLastConfig, listGameAdapters, readServerSession, recommendPlans, scanGames } from '../api/tauri';
import type { GameAdapter, GameSummary } from '../types/game';
import type { NetworkConfig } from '../types/network';
import type { Recommendation } from '../types/recommendation';
import type { ServerSessionStatus } from '../types/serverSession';
import { getReferenceSelectedGame, subscribeReferenceSelectedGame, type ReferenceSelectedGame } from './selectedGame';
import { useReferenceProductMode } from './useReferenceProductMode';

const PANEL_ATTR = 'data-lan-helper-product-inventory-panel';
const HINT_ATTR = 'data-lan-helper-product-inventory-hint';

type PageKind = 'games' | 'solutions' | 'recommendation';

interface InventoryState {
  loading: boolean;
  loadedAt: string;
  games: GameSummary[];
  adapters: GameAdapter[];
  recommendations: Recommendation[];
  n2nConfig: NetworkConfig | null;
  server: ServerSessionStatus | null;
  selectedGame: ReferenceSelectedGame | null;
  error: string;
}

function emptyState(): InventoryState {
  return {
    loading: false,
    loadedAt: '',
    games: [],
    adapters: [],
    recommendations: [],
    n2nConfig: null,
    server: null,
    selectedGame: null,
    error: ''
  };
}

function textOf(element: Element) {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function detectPage(): PageKind | null {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3')).map((node) => textOf(node));
  if (headings.some((item) => item.includes('游戏扫描'))) return 'games';
  if (headings.some((item) => item.includes('方案库'))) return 'solutions';
  if (headings.some((item) => item.includes('推荐方案'))) return 'recommendation';
  return null;
}

function findPageRoot(page: PageKind) {
  const label = page === 'games' ? '游戏扫描' : page === 'solutions' ? '方案库' : '推荐方案';
  const heading = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3')).find((node) =>
    textOf(node).includes(label)
  );
  return heading?.closest('.space-y-6') ?? heading?.closest('main > div > div') ?? null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function badge(text: string, tone = 'slate') {
  const palette: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  };
  return `<span class="rounded-full border px-2 py-0.5 text-[10px] font-bold ${palette[tone] ?? palette.slate}">${escapeHtml(text)}</span>`;
}

function restoreInventoryPanels() {
  document.querySelectorAll<HTMLElement>(`[${PANEL_ATTR}], [${HINT_ATTR}]`).forEach((node) => node.remove());
}

function insertHint(root: Element, page: PageKind) {
  if (root.querySelector(`[${HINT_ATTR}]`)) return;
  const targetText =
    page === 'games'
      ? '下面仍保留参考设计里的演示卡片；Product Mode 以“真实后端扫描结果”为准。'
      : page === 'solutions'
        ? '下面仍保留参考设计里的演示同步列表；Product Mode 以“真实本地适配器”为准。'
        : '下面仍保留参考设计里的策略演示；Product Mode 以真实推荐结果、n2n 配置和服务端状态为准。';
  const hint = document.createElement('div');
  hint.setAttribute(HINT_ATTR, page);
  hint.className = 'rounded-2xl border border-slate-200 bg-white/80 p-3 text-[11px] text-slate-500 shadow-sm';
  hint.textContent = targetText;
  root.appendChild(hint);
}

function renderGames(state: InventoryState) {
  const rows = state.games.map((game) => {
    const hasAdapter = state.adapters.some((adapter) => adapter.game_id === game.game_id);
    const ports = game.connection_plan?.default_join_port ? `默认端口 ${game.connection_plan.default_join_port}` : '';
    return `
      <div class="rounded-xl border border-amber-100 bg-white/85 p-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-heading text-sm font-bold text-slate-800">${escapeHtml(game.display_name)}</div>
            <div class="mt-1 font-mono text-[10px] text-slate-400">${escapeHtml(game.game_id)}${game.steam_appid ? ` · Steam ${escapeHtml(game.steam_appid)}` : ''}</div>
          </div>
          ${badge(hasAdapter ? '已有共享方案' : '待认定', hasAdapter ? 'green' : 'amber')}
        </div>
        <div class="mt-2 text-[11px] text-slate-600">${escapeHtml(game.connection_plan?.summary ?? game.network_type ?? '后端未返回联机方案摘要')}</div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          ${(game.capabilities ?? []).slice(0, 5).map((item) => badge(item, 'blue')).join('')}
          ${ports ? badge(ports, 'slate') : ''}
        </div>
        ${game.detected_path ? `<div class="mt-2 truncate font-mono text-[10px] text-slate-400">${escapeHtml(game.detected_path)}</div>` : ''}
      </div>
    `;
  });

  return `
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <div class="font-heading text-sm font-bold text-slate-800">真实后端扫描结果</div>
        <div class="mt-1 text-[11px] text-slate-500">来自 scan_games 与 list_game_adapters，不使用参考前端演示数组。</div>
      </div>
      ${badge(`${state.games.length} 款游戏 / ${state.adapters.length} 个方案`, 'amber')}
    </div>
    ${
      state.games.length === 0
        ? '<div class="rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-[11px] text-slate-500">后端暂未扫描到游戏。请点击“手动重扫以刷新缓存”触发真实扫描。</div>'
        : `<div class="grid grid-cols-1 gap-3 md:grid-cols-2">${rows.join('')}</div>`
    }
  `;
}

function renderSolutions(state: InventoryState) {
  const rows = state.adapters.map((adapter) => `
    <tr class="border-b border-slate-100 last:border-0">
      <td class="px-3 py-2">
        <div class="font-bold text-slate-800">${escapeHtml(adapter.display_name)}</div>
        <div class="font-mono text-[10px] text-slate-400">${escapeHtml(adapter.game_id)}</div>
      </td>
      <td class="px-3 py-2">${badge(adapter.adapter_source ?? 'unknown', adapter.adapter_source === 'registry' ? 'green' : 'slate')}</td>
      <td class="px-3 py-2 text-[11px] text-slate-600">${escapeHtml((adapter.default_ports ?? []).join(', ') || '未声明')}</td>
      <td class="px-3 py-2 text-[11px] text-slate-500">${escapeHtml(adapter.connection_plan?.summary ?? adapter.network_type ?? '无摘要')}</td>
    </tr>
  `);

  return `
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <div class="font-heading text-sm font-bold text-slate-800">真实本地共享方案</div>
        <div class="mt-1 text-[11px] text-slate-500">来自 list_game_adapters，远程同步结果会通过按钮动作单独回填。</div>
      </div>
      ${badge(`${state.adapters.length} 个真实方案`, 'amber')}
    </div>
    ${
      state.adapters.length === 0
        ? '<div class="rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-[11px] text-slate-500">本地暂无可用共享方案。请同步共享方案库或导入 JSON。</div>'
        : `<div class="overflow-hidden rounded-xl border border-slate-100 bg-white"><table class="w-full text-left text-xs"><thead class="bg-slate-50 text-[10px] text-slate-400"><tr><th class="px-3 py-2">游戏</th><th class="px-3 py-2">来源</th><th class="px-3 py-2">端口</th><th class="px-3 py-2">方案摘要</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    }
  `;
}

function renderRecommendation(state: InventoryState) {
  const game = state.selectedGame
    ? state.games.find((item) => item.game_id === state.selectedGame?.game_id) ?? {
        game_id: state.selectedGame.game_id,
        display_name: state.selectedGame.display_name,
        capabilities: []
      } as GameSummary
    : state.games[0];
  const config = state.n2nConfig;
  const invite = [
    '[联机助手真实邀请摘要]',
    `游戏: ${game?.display_name ?? '未选择'}`,
    `房主虚拟 IP: ${config?.local_ip ?? '未读取'}`,
    `Supernode: ${config?.supernode ?? '未读取'}`,
    `房间名: ${config?.room_name ?? '未读取'}`,
    `默认端口: ${game?.connection_plan?.default_join_port ?? game?.connection_plan?.default_join_host ?? '待按方案确认'}`,
    `服务端状态: ${state.server?.running ? '运行中' : '未运行'}`,
    `最近更新时间: ${state.loadedAt || '未加载'}`
  ].join('\n');

  const recommendationRows = state.recommendations.map((item) => `
    <div class="rounded-xl border border-amber-100 bg-white/85 p-3">
      <div class="flex items-center justify-between gap-3">
        <div class="font-bold text-slate-800">${escapeHtml(item.title)}</div>
        ${badge(item.level, item.level === 'recommended' ? 'green' : item.level === 'unsupported' ? 'red' : 'amber')}
      </div>
      <div class="mt-2 text-[11px] text-slate-500">${escapeHtml(item.required_actions.join(' / ') || '无额外动作')}</div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        ${item.backend_id ? badge(`backend: ${item.backend_id}`, 'blue') : ''}
        ${item.launch_profile_id ? badge(`profile: ${item.launch_profile_id}`, 'slate') : ''}
        ${typeof item.estimated_latency_ms === 'number' ? badge(`${item.estimated_latency_ms}ms`, 'green') : ''}
      </div>
    </div>
  `);

  return `
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <div class="font-heading text-sm font-bold text-slate-800">真实推荐与邀请摘要</div>
        <div class="mt-1 text-[11px] text-slate-500">来自 scan_games、recommend_plans、get_n2n_last_config、read_server_session。优先使用游戏扫描页刚选中的真实游戏。</div>
      </div>
      <div class="flex flex-wrap justify-end gap-1.5">
        ${badge(game?.display_name ?? '未扫描游戏', game ? 'amber' : 'red')}
        ${state.selectedGame ? badge('已绑定选中游戏', 'green') : badge('未手动选择', 'slate')}
      </div>
    </div>
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div class="space-y-2">${recommendationRows.length > 0 ? recommendationRows.join('') : '<div class="rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-[11px] text-slate-500">暂无真实推荐结果。请先扫描游戏或选择有适配器的游戏。</div>'}</div>
      <pre class="max-h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-amber-100">${escapeHtml(invite)}</pre>
    </div>
  `;
}

function renderPanel(page: PageKind, state: InventoryState) {
  const loading = state.loading ? '<div class="mb-3 text-[11px] font-bold text-amber-700">正在读取真实后端数据...</div>' : '';
  const error = state.error ? `<div class="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700">${escapeHtml(state.error)}</div>` : '';
  const body = page === 'games' ? renderGames(state) : page === 'solutions' ? renderSolutions(state) : renderRecommendation(state);
  return `${loading}${error}${body}`;
}

async function loadInventory(page: PageKind): Promise<InventoryState> {
  const errors: string[] = [];
  const collect = async <T,>(label: string, task: () => Promise<T>, fallback: T) => {
    try {
      return await task();
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error || '失败')}`);
      return fallback;
    }
  };
  const [games, adapters, n2nConfig, server] = await Promise.all([
    collect('扫描游戏', scanGames, []),
    collect('读取方案', listGameAdapters, []),
    collect('读取 n2n 配置', getN2nLastConfig, null),
    collect('读取服务端状态', readServerSession, null)
  ]);
  const selectedGame = getReferenceSelectedGame();
  const targetGameId = selectedGame?.game_id || games[0]?.game_id || adapters[0]?.game_id || 'terraria';
  const recommendations = page === 'recommendation'
    ? await collect('读取推荐方案', () => recommendPlans(targetGameId), [])
    : [];
  const disconnected = errors.length >= 3 && errors.some((item) => item.includes('没有连接到 Tauri 后端'));
  return {
    loading: false,
    loadedAt: new Date().toLocaleString(),
    games,
    adapters,
    recommendations,
    n2nConfig,
    server,
    selectedGame,
    error: disconnected
      ? '当前页面没有连接到 Tauri 后端。请用打包后的 lan-helper.exe 打开，普通浏览器预览只能验证界面，不能读取真实扫描/方案/推荐数据。'
      : errors.slice(0, 3).join('；')
  };
}

export function ReferenceProductInventoryPatcher() {
  const productMode = useReferenceProductMode();
  const [page, setPage] = useState<PageKind | null>(null);
  const [state, setState] = useState<InventoryState>(() => emptyState());
  const [loadedKey, setLoadedKey] = useState('');
  const [selectedGameKey, setSelectedGameKey] = useState(() => getReferenceSelectedGame()?.game_id ?? '');

  useEffect(() => {
    const tick = () => setPage(detectPage());
    tick();
    const timer = window.setInterval(tick, 800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return subscribeReferenceSelectedGame((game) => {
      const nextKey = game?.game_id ?? '';
      setSelectedGameKey(nextKey);
      setLoadedKey('');
      setState((prev) => ({ ...prev, selectedGame: game }));
    });
  }, []);

  useEffect(() => {
    if (!productMode.enabled || !page) {
      restoreInventoryPanels();
      return;
    }

    const root = findPageRoot(page);
    if (!root) return;
    let panel = root.querySelector<HTMLElement>(`[${PANEL_ATTR}]`);
    if (!panel) {
      panel = document.createElement('div');
      panel.setAttribute(PANEL_ATTR, page);
      panel.className = 'rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-slate-700 shadow-sm';
      const header = root.querySelector('header, div');
      header?.parentElement?.insertBefore(panel, header.nextSibling);
    }
    panel.innerHTML = renderPanel(page, state);
    insertHint(root, page);

    const key = `${page}:${productMode.updated_at}:${selectedGameKey}`;
    if (loadedKey === key || state.loading) return;
    setLoadedKey(key);
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    loadInventory(page)
      .then(setState)
      .catch((error) =>
        setState({
          ...emptyState(),
          loading: false,
          error: error instanceof Error ? error.message : String(error || '读取真实后端数据失败')
        })
      );
  }, [productMode.enabled, productMode.updated_at, page, state, loadedKey, selectedGameKey]);

  return null;
}
