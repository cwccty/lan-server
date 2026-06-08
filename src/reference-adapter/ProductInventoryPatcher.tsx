import { useEffect, useState } from 'react';
import { analyzeGame, getN2nLastConfig, listGameAdapters, readServerSession, recommendPlans, scanGames } from '../api/tauri';
import type { GameAdapter, GameSummary } from '../types/game';
import type { NetworkConfig } from '../types/network';
import type { Recommendation } from '../types/recommendation';
import type { ServerSessionStatus } from '../types/serverSession';
import {
  listReferenceFriendAllocationsBackendFirst,
  listReferenceFriendAllocations,
  subscribeReferenceFriendAllocations,
  type ReferenceFriendAllocation
} from './friendAllocations';
import {
  getReferenceAdapterSyncResult,
  subscribeReferenceAdapterInventoryRefresh,
  subscribeReferenceAdapterSyncResult,
  type ReferenceAdapterSyncRecord
} from './adapterSyncResult';
import { getReferenceSelectedGame, setReferenceSelectedGame, subscribeReferenceSelectedGame, type ReferenceSelectedGame } from './selectedGame';
import { useReferenceProductMode } from './useReferenceProductMode';
import { toProductSafeMessage } from '../product-ui/productSafeMessage';

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
  friends: ReferenceFriendAllocation[];
  adapterSync: ReferenceAdapterSyncRecord | null;
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
    friends: [],
    adapterSync: null,
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
  const root = heading?.closest('.space-y-6') ?? heading?.closest('main > div > div') ?? null;
  if (root?.querySelector('[data-lan-helper-product-controlled]') || (root as HTMLElement | null)?.dataset?.lanHelperProductControlled) {
    return null;
  }
  return root;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeErrorText(value: string) {
  return toProductSafeMessage(value);
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

function actionButton(action: string, label: string, gameId = '') {
  return `<button type="button" data-lan-helper-inventory-action="${escapeHtml(action)}" data-lan-helper-game-id="${escapeHtml(gameId)}" class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-sm transition hover:border-amber-300 hover:text-amber-700 disabled:opacity-50">${escapeHtml(label)}</button>`;
}

function dispatchProductAction(action: string, ok: boolean, message: string, data?: unknown) {
  window.dispatchEvent(new CustomEvent('lan-helper:reference-product-action', {
    detail: {
      actionId: `inventory-${action}`,
      result: { ok, action, message, data },
      at: new Date().toISOString()
    }
  }));
}

function numberTile(label: string, value: number, tone = 'slate') {
  return `
    <div class="rounded-xl border border-slate-100 bg-white/80 p-2">
      <div class="text-[10px] font-bold text-slate-400">${escapeHtml(label)}</div>
      <div class="mt-1 font-heading text-lg font-bold ${tone === 'red' ? 'text-rose-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-800'}">${value}</div>
    </div>
  `;
}

function restoreInventoryPanels() {
  document.querySelectorAll<HTMLElement>(`[${PANEL_ATTR}], [${HINT_ATTR}]`).forEach((node) => node.remove());
}

function insertHint(root: Element, page: PageKind) {
  if (root.querySelector(`[${HINT_ATTR}]`)) return;
  const targetText =
    page === 'games'
      ? '下面仍保留参考设计里的演示卡片；产品模式以“本机扫描结果”为准。'
      : page === 'solutions'
        ? '下面仍保留参考设计里的演示同步列表；产品模式以“本机游戏方案”为准。'
        : '下面仍保留参考设计里的策略演示；产品模式以推荐结果、组网设置和服务端状态为准。';
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
    const selected = state.selectedGame?.game_id === game.game_id;
    return `
      <div class="rounded-xl border ${selected ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-100 bg-white/85'} p-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-heading text-sm font-bold text-slate-800">${escapeHtml(game.display_name)}</div>
            <div class="mt-1 font-mono text-[10px] text-slate-400">${escapeHtml(game.game_id)}${game.steam_appid ? ` · Steam ${escapeHtml(game.steam_appid)}` : ''}</div>
          </div>
          <div class="flex flex-wrap justify-end gap-1.5">
            ${selected ? badge('当前推荐目标', 'green') : ''}
            ${badge(hasAdapter ? '已有共享方案' : '待认定', hasAdapter ? 'green' : 'amber')}
          </div>
        </div>
        <div class="mt-2 text-[11px] text-slate-600">${escapeHtml(game.connection_plan?.summary ?? game.network_type ?? '后端未返回联机方案摘要')}</div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          ${(game.capabilities ?? []).slice(0, 5).map((item) => badge(item, 'blue')).join('')}
          ${ports ? badge(ports, 'slate') : ''}
        </div>
        ${game.detected_path ? `<div class="mt-2 truncate font-mono text-[10px] text-slate-400">${escapeHtml(game.detected_path)}</div>` : ''}
        <div class="mt-3 flex flex-wrap gap-2">
          ${actionButton('select-game', selected ? '已设为目标' : '设为推荐目标', game.game_id)}
          ${actionButton('analyze-game', '真实分析', game.game_id)}
        </div>
      </div>
    `;
  });

  return `
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <div class="font-heading text-sm font-bold text-slate-800">本机扫描结果</div>
        <div class="mt-1 text-[11px] text-slate-500">可在这里直接选择要联机的游戏，不再依赖下方演示卡片。</div>
      </div>
      <div class="flex flex-wrap justify-end gap-1.5">
        ${state.selectedGame ? badge(`目标: ${state.selectedGame.display_name}`, 'green') : badge('未选推荐目标', 'amber')}
        ${badge(`${state.games.length} 款游戏 / ${state.adapters.length} 个方案`, 'amber')}
      </div>
    </div>
    ${
      state.games.length === 0
        ? '<div class="rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-[11px] text-slate-500">本机暂未扫描到游戏。请点击“重新扫描”刷新。</div>'
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

  const sync = state.adapterSync;
  const syncResult = sync?.result;
  const syncItems = syncResult?.items ?? [];
  const syncFailureCount = syncResult
    ? syncResult.hash_failed + syncResult.parse_failed + syncResult.fetch_failed + syncResult.validation_failed + syncResult.write_failed
    : 0;
  const syncRows = syncItems.map((item) => {
    const hasHashMismatch = item.expected_sha256 && item.actual_sha256 && item.expected_sha256 !== item.actual_sha256;
    return `
      <tr class="border-b border-slate-100 last:border-0">
        <td class="px-3 py-2">
          <div class="font-bold text-slate-800">${escapeHtml(item.display_name || item.game_id)}</div>
          <div class="font-mono text-[10px] text-slate-400">${escapeHtml(item.game_id)}</div>
        </td>
        <td class="px-3 py-2">${badge(item.status, item.status === 'created' || item.status === 'updated' || item.status === 'skipped' ? 'green' : 'red')}</td>
        <td class="px-3 py-2 text-[11px] text-slate-600">${escapeHtml(item.reason || '无说明')}</td>
        <td class="px-3 py-2">
          <div class="max-w-[240px] truncate font-mono text-[10px] text-slate-400">${escapeHtml(item.saved_path || item.adapter_url || '未写入')}</div>
          ${hasHashMismatch ? `<div class="mt-1 font-mono text-[10px] text-rose-600">sha256: ${escapeHtml(item.actual_sha256 || '')} ≠ ${escapeHtml(item.expected_sha256 || '')}</div>` : ''}
        </td>
      </tr>
    `;
  });
  const syncPanel = syncResult ? `
    <div class="mb-4 rounded-xl border border-slate-100 bg-white/75 p-3">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <div class="font-heading text-sm font-bold text-slate-800">最近一次同步详情</div>
          <div class="mt-1 text-[11px] text-slate-500">
            来源：${sync.source === 'local' ? '本地示例目录' : '远程方案库'} · ${escapeHtml(new Date(sync.saved_at).toLocaleString())}
          </div>
          <div class="mt-1 max-w-full truncate font-mono text-[10px] text-slate-400">${escapeHtml(syncResult.registry_url || '未返回 registry_url')}</div>
        </div>
        ${badge(syncResult.ok ? '同步通过' : '同步有异常', syncResult.ok ? 'green' : 'red')}
      </div>
      <div class="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        ${numberTile('总条目', syncResult.total, 'slate')}
        ${numberTile('新增', syncResult.created, 'green')}
        ${numberTile('更新', syncResult.updated, 'green')}
        ${numberTile('跳过', syncResult.skipped, 'slate')}
        ${numberTile('失败', syncFailureCount, syncFailureCount ? 'red' : 'green')}
      </div>
      <div class="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        ${numberTile('Hash 失败', syncResult.hash_failed, syncResult.hash_failed ? 'red' : 'slate')}
        ${numberTile('解析失败', syncResult.parse_failed, syncResult.parse_failed ? 'red' : 'slate')}
        ${numberTile('下载失败', syncResult.fetch_failed, syncResult.fetch_failed ? 'red' : 'slate')}
        ${numberTile('校验失败', syncResult.validation_failed, syncResult.validation_failed ? 'red' : 'slate')}
        ${numberTile('写入失败', syncResult.write_failed, syncResult.write_failed ? 'red' : 'slate')}
      </div>
      ${
        syncRows.length
          ? `<div class="overflow-hidden rounded-xl border border-slate-100 bg-white"><table class="w-full text-left text-xs"><thead class="bg-slate-50 text-[10px] text-slate-400"><tr><th class="px-3 py-2">游戏</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">原因</th><th class="px-3 py-2">路径 / Hash</th></tr></thead><tbody>${syncRows.join('')}</tbody></table></div>`
          : '<div class="rounded-xl border border-dashed border-slate-200 bg-white/70 p-3 text-[11px] text-slate-500">本次同步没有返回 item 明细。</div>'
      }
      ${
        syncResult.messages?.length
          ? `<div class="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">${syncResult.messages.slice(0, 5).map((item) => `<div>${escapeHtml(item)}</div>`).join('')}</div>`
          : ''
      }
    </div>
  ` : `
    <div class="mb-4 rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-[11px] text-slate-500">
      尚未记录同步详情。点击“恢复默认”或“一键更新共享方案”后，这里会展示每个方案的处理结果。
    </div>
  `;
  const semanticsPanel = `
    <div class="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[11px] text-slate-600">
      <div class="mb-2 font-heading text-sm font-bold text-slate-800">方案库按钮语义</div>
      <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div class="rounded-lg bg-white/75 p-2"><strong>一键更新共享方案</strong><br/>访问当前共享库地址，下载并写入游戏方案，同步结果会记录到下方详情。</div>
        <div class="rounded-lg bg-white/75 p-2"><strong>恢复默认</strong><br/>使用项目内本地示例 registry 作为默认源同步一次，适合恢复可用基线。</div>
        <div class="rounded-lg bg-white/75 p-2"><strong>手动强制刷新</strong><br/>只重新读取本地 adapter 列表和最近同步结果，不访问远程、不覆盖方案。</div>
      </div>
    </div>
  `;

  return `
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <div class="font-heading text-sm font-bold text-slate-800">本地共享方案</div>
        <div class="mt-1 text-[11px] text-slate-500">这里显示当前客户端已经可用的游戏方案和最近一次同步结果。</div>
      </div>
      ${badge(`${state.adapters.length} 个方案`, 'amber')}
    </div>
    ${semanticsPanel}
    ${syncPanel}
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
  const selectedFriend = state.friends.find((item) => item.status === 'selected') ?? state.friends[state.friends.length - 1];
  const invite = [
    '[联机助手邀请摘要]',
    `游戏: ${game?.display_name ?? '未选择'}`,
    `房主联机地址: ${config?.local_ip ?? '未读取'}`,
    selectedFriend ? `好友预留地址: ${selectedFriend.ip} (${selectedFriend.name})` : '好友预留地址: 未分配',
    `中继地址: ${config?.supernode ?? '未读取'}`,
    `房间名: ${config?.room_name ?? '未读取'}`,
    `默认端口: ${game?.connection_plan?.default_join_port ?? game?.connection_plan?.default_join_host ?? '待按方案确认'}`,
    `好友检测: ${selectedFriend?.last_check_summary ?? '未检测'}`,
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
  const targetRows = state.games.slice(0, 8).map((item) => {
    const active = item.game_id === game?.game_id;
    return `
      <div class="flex items-center justify-between gap-2 rounded-lg ${active ? 'bg-emerald-50' : 'bg-slate-50'} px-2 py-1.5">
        <span class="min-w-0 truncate"><strong>${escapeHtml(item.display_name)}</strong> <span class="font-mono text-[10px] text-slate-400">${escapeHtml(item.game_id)}</span></span>
        ${active ? badge('当前', 'green') : actionButton('select-game', '切换', item.game_id)}
      </div>
    `;
  });

  return `
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <div class="font-heading text-sm font-bold text-slate-800">推荐与邀请摘要</div>
        <div class="mt-1 text-[11px] text-slate-500">优先使用游戏扫描页刚选中的游戏，生成更贴近当前房间的邀请信息。</div>
      </div>
      <div class="flex flex-wrap justify-end gap-1.5">
        ${badge(game?.display_name ?? '未扫描游戏', game ? 'amber' : 'red')}
        ${state.selectedGame ? badge('已绑定选中游戏', 'green') : badge('未手动选择', 'slate')}
      </div>
    </div>
    <div class="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[11px] text-slate-600">
          <div class="mb-2 flex items-center justify-between gap-2">
        <div class="font-heading text-sm font-bold text-slate-800">推荐目标</div>
        ${game ? actionButton('analyze-game', '重新分析当前目标', game.game_id) : ''}
      </div>
      ${
        targetRows.length
          ? `<div class="grid grid-cols-1 gap-1.5 md:grid-cols-2">${targetRows.join('')}</div>`
          : '<div class="rounded-lg border border-dashed border-indigo-200 bg-white/70 p-2 text-slate-500">暂无扫描游戏。请先在游戏扫描页重新扫描。</div>'
      }
    </div>
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div class="space-y-2">${recommendationRows.length > 0 ? recommendationRows.join('') : '<div class="rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-[11px] text-slate-500">暂无推荐结果。请先扫描游戏或选择有方案的游戏。</div>'}</div>
      <div class="space-y-2">
        <pre class="max-h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-amber-100">${escapeHtml(invite)}</pre>
        <div class="rounded-xl border border-slate-100 bg-white/80 p-3 text-[11px] text-slate-600">
          <div class="mb-2 flex items-center justify-between gap-2">
            <span class="font-bold text-slate-800">好友席位</span>
            ${badge(`${state.friends.length} 个持久席位`, state.friends.length ? 'green' : 'slate')}
          </div>
          ${
            state.friends.length
              ? `<div class="space-y-1.5">${state.friends.map((friend) => `
                <div class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                  <span><strong>${escapeHtml(friend.name)}</strong> <span class="font-mono">${escapeHtml(friend.ip)}</span></span>
                  <span class="text-[10px] text-slate-400">${escapeHtml(friend.last_check_summary || friend.status)}</span>
                </div>`).join('')}</div>`
              : '<div class="text-slate-400">尚未保存好友席位。点击“分配并生成推荐信”后会持久保存。</div>'
          }
        </div>
      </div>
    </div>
  `;
}

function renderPanel(page: PageKind, state: InventoryState) {
  const loading = state.loading ? '<div class="mb-3 text-[11px] font-bold text-amber-700">正在读取本机数据...</div>' : '';
  const error = state.error ? `<div class="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700">${escapeHtml(safeErrorText(state.error))}</div>` : '';
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
    collect('读取组网配置', getN2nLastConfig, null),
    collect('读取服务端状态', readServerSession, null)
  ]);
  const selectedGame = getReferenceSelectedGame();
  const friends = await listReferenceFriendAllocationsBackendFirst();
  const adapterSync = getReferenceAdapterSyncResult();
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
    friends,
    adapterSync,
    error: disconnected
      ? safeErrorText('当前页面没有连接到 Tauri 后端。请用打包后的 lan-helper.exe 打开，普通浏览器预览只能验证界面，不能读取真实扫描/方案/推荐数据。')
      : safeErrorText(errors.slice(0, 3).join('；'))
  };
}

export function ReferenceProductInventoryPatcher() {
  const productMode = useReferenceProductMode();
  const [page, setPage] = useState<PageKind | null>(null);
  const [state, setState] = useState<InventoryState>(() => emptyState());
  const [loadedKey, setLoadedKey] = useState('');
  const [selectedGameKey, setSelectedGameKey] = useState(() => getReferenceSelectedGame()?.game_id ?? '');
  const [friendsKey, setFriendsKey] = useState(() => String(listReferenceFriendAllocations().length));
  const [adapterSyncKey, setAdapterSyncKey] = useState(() => getReferenceAdapterSyncResult()?.saved_at ?? '');
  const [adapterRefreshKey, setAdapterRefreshKey] = useState('');

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
    return subscribeReferenceFriendAllocations((friends) => {
      setFriendsKey(`${friends.length}:${friends.map((item) => `${item.id}:${item.updated_at}`).join('|')}`);
      setLoadedKey('');
      setState((prev) => ({ ...prev, friends }));
    });
  }, []);

  useEffect(() => {
    return subscribeReferenceAdapterSyncResult((record) => {
      setAdapterSyncKey(record?.saved_at ?? '');
      setLoadedKey('');
      setState((prev) => ({ ...prev, adapterSync: record }));
    });
  }, []);

  useEffect(() => {
    return subscribeReferenceAdapterInventoryRefresh(() => {
      setAdapterRefreshKey(new Date().toISOString());
      setLoadedKey('');
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

    const handleInventoryAction = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-lan-helper-inventory-action]');
      if (!button || !panel?.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.lanHelperInventoryAction || '';
      const gameId = button.dataset.lanHelperGameId || '';
      const game = state.games.find((item) => item.game_id === gameId)
        ?? state.adapters.find((item) => item.game_id === gameId);
      button.disabled = true;
      const original = button.textContent ?? '';
      button.textContent = '处理中...';
      try {
        if (!game) throw new Error(gameId ? `本机列表中没有找到游戏：${gameId}` : '缺少游戏 ID。');
        if (action === 'select-game') {
          const selected = setReferenceSelectedGame(game);
          setLoadedKey('');
          setSelectedGameKey(selected.game_id);
          setState((prev) => ({ ...prev, selectedGame: selected }));
          dispatchProductAction('选择推荐目标', true, `已将 ${selected.display_name} 设为推荐目标。`, selected);
          return;
        }
        if (action === 'analyze-game') {
          const selected = setReferenceSelectedGame(game);
          const analysis = await analyzeGame(game.game_id);
          setLoadedKey('');
          setSelectedGameKey(selected.game_id);
          setState((prev) => ({ ...prev, selectedGame: selected }));
          dispatchProductAction('分析游戏联机能力', true, `已完成 ${selected.display_name} 的联机能力分析。`, analysis);
          return;
        }
        throw new Error(`未知操作：${action}`);
      } catch (error) {
        dispatchProductAction(action || '库存动作', false, safeErrorText(error instanceof Error ? error.message : String(error || '操作失败')));
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };

    panel.addEventListener('click', handleInventoryAction, true);

    const key = `${page}:${productMode.updated_at}:${selectedGameKey}:${friendsKey}:${adapterSyncKey}:${adapterRefreshKey}`;
    if (loadedKey === key || state.loading) {
      return () => panel?.removeEventListener('click', handleInventoryAction, true);
    }
    setLoadedKey(key);
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    loadInventory(page)
      .then(setState)
      .catch((error) =>
        setState({
          ...emptyState(),
          loading: false,
          error: safeErrorText(error instanceof Error ? error.message : String(error || '读取本机数据失败'))
        })
      );
    return () => panel?.removeEventListener('click', handleInventoryAction, true);
  }, [productMode.enabled, productMode.updated_at, page, state, loadedKey, selectedGameKey, friendsKey, adapterSyncKey, adapterRefreshKey]);

  return null;
}
