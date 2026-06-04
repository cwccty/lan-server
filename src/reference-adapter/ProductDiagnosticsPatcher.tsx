import { useEffect, useState } from 'react';
import { generateDiagnosticReport, generateDiagnosticReportForGame, listGameAdapters, scanGames } from '../api/tauri';
import type { DiagnosticReport } from '../types/diagnostics';
import type { GameSummary } from '../types/game';
import { REFERENCE_RUNTIME_EVENT } from './bootstrap';
import { snapshotForDebug } from './mappers';
import { getReferenceSelectedGame } from './selectedGame';
import { readReferenceRuntimeSnapshot } from './runtimeStore';
import type { ReferenceRuntimeSnapshot } from './types';
import { useReferenceProductMode } from './useReferenceProductMode';
import { useReferenceRuntime } from './useReferenceRuntime';

const PANEL_ID = 'lan-helper-product-diagnostics-target-panel';
const DIAGNOSTIC_TARGET_KEY = 'lan-helper.referenceDiagnosticTarget';
const DIAGNOSTIC_RECORD_KEY = 'lan-helper.referenceDiagnosticRecord';

const markers = [
  'diagnostics-bandwidth-value',
  'diagnostics-latency-value',
  'diagnostics-jitter-value',
  'diagnostics-loss-value',
  'diagnostics-mtu-value',
  'diagnostics-client-line',
  'diagnostics-supernode-line',
  'diagnostics-json-pre',
  'diagnostics-code',
  'diagnostics-cache-line',
  'diagnostics-evidence-a',
  'diagnostics-evidence-b'
];

type DiagnosticTargetMode = 'global' | 'selected' | 'game';

interface DiagnosticTargetState {
  mode: DiagnosticTargetMode;
  game_id: string;
}

interface DiagnosticRecord {
  target_mode: DiagnosticTargetMode;
  target_game_id?: string;
  target_label: string;
  generated_at: string;
  report: DiagnosticReport;
}

function normalizeTarget(value: unknown): DiagnosticTargetState {
  if (!value || typeof value !== 'object') return { mode: 'selected', game_id: '' };
  const record = value as Partial<DiagnosticTargetState>;
  return {
    mode: record.mode === 'global' || record.mode === 'game' || record.mode === 'selected' ? record.mode : 'selected',
    game_id: String(record.game_id || '')
  };
}

function readDiagnosticTarget() {
  try {
    return normalizeTarget(JSON.parse(window.localStorage.getItem(DIAGNOSTIC_TARGET_KEY) || 'null'));
  } catch {
    return normalizeTarget(null);
  }
}

function saveDiagnosticTarget(target: DiagnosticTargetState) {
  window.localStorage.setItem(DIAGNOSTIC_TARGET_KEY, JSON.stringify(target));
}

function readDiagnosticRecord(): DiagnosticRecord | null {
  try {
    const raw = window.localStorage.getItem(DIAGNOSTIC_RECORD_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as DiagnosticRecord;
    return record?.report ? record : null;
  } catch {
    return null;
  }
}

function saveDiagnosticRecord(record: DiagnosticRecord) {
  window.localStorage.setItem(DIAGNOSTIC_RECORD_KEY, JSON.stringify(record));
}

function rememberAndSet(node: HTMLElement, marker: string, text: string) {
  if (!node.dataset.lanHelperOriginalText) node.dataset.lanHelperOriginalText = node.textContent ?? '';
  node.textContent = text;
  node.dataset.lanHelperPatched = marker;
}

function findByExactText(root: ParentNode, selector: string, text: string, marker: string) {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).find((node) => {
    const current = node.textContent?.trim() ?? '';
    return current === text || node.dataset.lanHelperPatched === marker;
  }) ?? null;
}

function restoreDiagnostics() {
  const root = document.querySelector('main');
  if (!root) return;
  document.getElementById(PANEL_ID)?.remove();
  markers.forEach((marker) => {
    Array.from(root.querySelectorAll<HTMLElement>(`[data-lan-helper-patched="${marker}"]`)).forEach((node) => {
      node.textContent = node.dataset.lanHelperOriginalText || node.textContent;
      delete node.dataset.lanHelperPatched;
    });
  });
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

function dispatchProductAction(action: string, ok: boolean, message: string, data?: unknown) {
  window.dispatchEvent(new CustomEvent('lan-helper:reference-product-action', {
    detail: {
      actionId: `diagnostics-target-${action}`,
      result: { ok, action, message, data },
      at: new Date().toISOString()
    }
  }));
}

function dispatchRuntimeSnapshot(snapshot: ReferenceRuntimeSnapshot) {
  window.__LAN_HELPER_REFERENCE_RUNTIME__ = snapshot;
  window.dispatchEvent(new CustomEvent<ReferenceRuntimeSnapshot>(REFERENCE_RUNTIME_EVENT, { detail: snapshot }));
}

function gameOptionsFrom(games: GameSummary[], targetGameId: string) {
  return games
    .map((game) => `<option value="${escapeHtml(game.game_id)}" ${game.game_id === targetGameId ? 'selected' : ''}>${escapeHtml(game.display_name)} (${escapeHtml(game.game_id)})</option>`)
    .join('');
}

function renderDiagnosticPanel(options: GameSummary[], target: DiagnosticTargetState, record: DiagnosticRecord | null, selectedGameLabel: string) {
  const report = record?.report;
  const issue = report?.most_likely_cause ?? report?.issues?.[0];
  return `
    <div class="mb-4 rounded-2xl border border-amber-200 bg-amber-50/75 p-4 text-xs text-slate-700 shadow-sm" id="${PANEL_ID}">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <div class="font-heading text-sm font-bold text-slate-800">真实诊断目标选择器</div>
          <div class="mt-1 text-[11px] text-slate-500">Product Mode 下明确选择诊断对象，不再让用户猜测当前报告是全局还是某个游戏。</div>
        </div>
        ${badge(record ? '已有真实报告' : '等待生成', record ? (report?.release_ready ? 'green' : 'amber') : 'slate')}
      </div>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr_auto]">
        <label class="space-y-1">
          <span class="text-[10px] font-bold text-slate-400">诊断范围</span>
          <select data-lan-helper-diagnostics-field="mode" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-300">
            <option value="selected" ${target.mode === 'selected' ? 'selected' : ''}>当前选中游戏</option>
            <option value="game" ${target.mode === 'game' ? 'selected' : ''}>指定游戏</option>
            <option value="global" ${target.mode === 'global' ? 'selected' : ''}>全局环境</option>
          </select>
        </label>
        <label class="space-y-1">
          <span class="text-[10px] font-bold text-slate-400">指定游戏</span>
          <select data-lan-helper-diagnostics-field="game" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-300" ${target.mode === 'global' || options.length === 0 ? 'disabled' : ''}>
            <option value="">${escapeHtml(selectedGameLabel || '未选择游戏')}</option>
            ${gameOptionsFrom(options, target.game_id)}
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button type="button" data-lan-helper-diagnostics-action="generate" class="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800">生成真实诊断</button>
          <button type="button" data-lan-helper-diagnostics-action="refresh-options" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-amber-300 hover:text-amber-700">刷新游戏</button>
        </div>
      </div>
      <div class="mt-3 rounded-xl border border-slate-100 bg-white/80 p-3">
        ${
          report
            ? `
              <div class="mb-2 flex flex-wrap items-center gap-2">
                ${badge(record.target_label, 'blue')}
                ${badge(report.release_ready ? 'release ready' : 'needs attention', report.release_ready ? 'green' : 'amber')}
                ${badge(`${report.required_passed}/${report.required_total} 必需项通过`, report.required_passed === report.required_total ? 'green' : 'red')}
              </div>
              <div class="font-bold text-slate-800">${escapeHtml(report.summary || '无摘要')}</div>
              ${issue ? `<div class="mt-2 text-[11px] text-slate-600"><strong>${escapeHtml(issue.title)}</strong>：${escapeHtml(issue.detail)}</div>` : ''}
              ${report.next_actions?.length ? `<div class="mt-2 text-[11px] text-slate-500">下一步：${report.next_actions.slice(0, 3).map(escapeHtml).join(' / ')}</div>` : ''}
              <div class="mt-2 font-mono text-[10px] text-slate-400">报告时间：${escapeHtml(record.generated_at)}｜后端版本：${escapeHtml(report.app_version || 'unknown')}</div>
            `
            : '<div class="text-[11px] text-slate-500">尚未生成真实诊断报告。选择范围后点击“生成真实诊断”。</div>'
        }
      </div>
    </div>
  `;
}

function findDiagnosticsRoot() {
  const root = document.querySelector('main');
  if (!root?.textContent?.includes('网络诊断与链路性能')) return null;
  const heading = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3')).find((node) =>
    node.textContent?.includes('网络诊断与链路性能')
  );
  return heading?.closest('.space-y-6') ?? heading?.closest('main > div > div') ?? root;
}

function patchDiagnostics(runtime: ReturnType<typeof useReferenceRuntime>) {
  const root = document.querySelector('main');
  if (!root) return;
  if (!root.textContent?.includes('网络诊断与链路性能')) return;

  const n2n = runtime.snapshot?.n2n;
  const selectedGame = getReferenceSelectedGame();
  const record = readDiagnosticRecord();
  const debug = runtime.snapshot ? snapshotForDebug(runtime.snapshot) : { message: 'no runtime snapshot yet' };
  const json = JSON.stringify({ ...debug, diagnostic_target: record ? { target_label: record.target_label, generated_at: record.generated_at } : 'not generated' }, null, 2);

  const bandwidth = findByExactText(root, 'span,div', '14.85 Mbps', 'diagnostics-bandwidth-value');
  if (bandwidth) rememberAndSet(bandwidth, 'diagnostics-bandwidth-value', n2n?.ok_link ? 'ACK/PONG OK' : n2n?.running ? 'RUNNING' : 'STOPPED');

  const latency = findByExactText(root, 'div', '24.5 ms', 'diagnostics-latency-value');
  if (latency) rememberAndSet(latency, 'diagnostics-latency-value', n2n?.ack ? 'ACK true' : 'ACK false');

  const jitter = findByExactText(root, 'div', '1.22 ms', 'diagnostics-jitter-value');
  if (jitter) rememberAndSet(jitter, 'diagnostics-jitter-value', n2n?.pong ? 'PONG true' : 'PONG false');

  const loss = findByExactText(root, 'div', '0.00 %', 'diagnostics-loss-value');
  if (loss) rememberAndSet(loss, 'diagnostics-loss-value', n2n?.virtual_ip || '--');

  const mtu = findByExactText(root, 'div', '1400 bytes', 'diagnostics-mtu-value');
  if (mtu) rememberAndSet(mtu, 'diagnostics-mtu-value', n2n?.supernode_configured ? 'configured' : 'missing');

  const client = findByExactText(root, 'div', '运行客户端: n2n-edge v3.0 stable', 'diagnostics-client-line');
  if (client) rememberAndSet(client, 'diagnostics-client-line', `运行状态: ${n2n?.running ? 'running' : 'stopped'}`);

  const supernode = findByExactText(root, 'div', '挂载超级节点: lianji-telecom-cn2', 'diagnostics-supernode-line');
  if (supernode) rememberAndSet(supernode, 'diagnostics-supernode-line', `超级节点: ${n2n?.supernode || '未配置'}`);

  const pre = root.querySelector<HTMLElement>('pre');
  if (pre) rememberAndSet(pre, 'diagnostics-json-pre', json);

  const code = findByExactText(root, 'span', '检测代码: N2N_D_CODE_301XT', 'diagnostics-code');
  if (code) rememberAndSet(code, 'diagnostics-code', '检测来源: reference runtime snapshot + diagnostic target');

  const cacheLine = Array.from(root.querySelectorAll<HTMLElement>('p')).find((node) =>
    node.textContent?.includes('上次自愈分析缓存') || node.dataset.lanHelperPatched === 'diagnostics-cache-line'
  );
  if (cacheLine) rememberAndSet(cacheLine, 'diagnostics-cache-line', `真实快照时间: ${runtime.snapshot?.loaded_at || '等待 runtime'} ｜ 诊断目标: ${record?.target_label || selectedGame?.display_name || '全局'} ｜ product mode`);

  const evidenceA = Array.from(root.querySelectorAll<HTMLElement>('p')).find((node) =>
    node.textContent?.includes('TAP_ERR_IP_ASSIGN') || node.dataset.lanHelperPatched === 'diagnostics-evidence-a'
  );
  if (evidenceA) rememberAndSet(evidenceA, 'diagnostics-evidence-a', `诊断证据: ${record?.report.summary || n2n?.summary || runtime.network.label}`);

  const evidenceB = Array.from(root.querySelectorAll<HTMLElement>('p')).find((node) =>
    node.textContent?.includes('P2P直连握手丢包') || node.dataset.lanHelperPatched === 'diagnostics-evidence-b'
  );
  if (evidenceB) rememberAndSet(evidenceB, 'diagnostics-evidence-b', `诊断证据: Terraria=${runtime.terraria.running ? 'running' : 'stopped'} / ready=${runtime.terraria.ready}`);
}

export function ReferenceProductDiagnosticsPatcher() {
  const productMode = useReferenceProductMode();
  const runtime = useReferenceRuntime();
  const [target, setTarget] = useState<DiagnosticTargetState>(() => readDiagnosticTarget());
  const [record, setRecord] = useState<DiagnosticRecord | null>(() => readDiagnosticRecord());
  const [options, setOptions] = useState<GameSummary[]>([]);

  useEffect(() => {
    if (!productMode.enabled) return;
    let cancelled = false;
    Promise.all([
      scanGames().catch(() => []),
      listGameAdapters().catch(() => [])
    ]).then(([games, adapters]) => {
      if (cancelled) return;
      const map = new Map<string, GameSummary>();
      games.forEach((game) => map.set(game.game_id, game));
      adapters.forEach((adapter) => {
        if (!map.has(adapter.game_id)) {
          map.set(adapter.game_id, {
            game_id: adapter.game_id,
            display_name: adapter.display_name,
            steam_appid: adapter.steam_appid,
            detected_path: '',
            capabilities: adapter.capabilities ?? [],
            network_type: adapter.network_type,
            connection_plan: adapter.connection_plan
          });
        }
      });
      setOptions(Array.from(map.values()).sort((a, b) => a.display_name.localeCompare(b.display_name)));
    });
    return () => {
      cancelled = true;
    };
  }, [productMode.enabled]);

  useEffect(() => {
    if (!productMode.enabled) return;
    const root = findDiagnosticsRoot();
    if (!root) return;

    const selectedGame = getReferenceSelectedGame();
    const selectedGameLabel = selectedGame ? `${selectedGame.display_name} (${selectedGame.game_id})` : '未选择游戏';
    let panel = document.getElementById(PANEL_ID);
    const html = renderDiagnosticPanel(options, target, record, selectedGameLabel);
    if (!panel) {
      const first = root.querySelector('section, div');
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      panel = wrapper.firstElementChild as HTMLElement | null;
      if (panel) first?.parentElement?.insertBefore(panel, first.nextSibling);
    } else {
      panel.outerHTML = html;
      panel = document.getElementById(PANEL_ID);
    }
    if (!panel) return;

    const handleChange = (event: Event) => {
      const field = (event.target as HTMLElement | null)?.closest<HTMLSelectElement>('[data-lan-helper-diagnostics-field]');
      if (!field) return;
      const next = { ...readDiagnosticTarget() };
      if (field.dataset.lanHelperDiagnosticsField === 'mode') next.mode = field.value as DiagnosticTargetMode;
      if (field.dataset.lanHelperDiagnosticsField === 'game') next.game_id = field.value;
      saveDiagnosticTarget(next);
      setTarget(next);
    };

    const handleClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-lan-helper-diagnostics-action]');
      if (!button || !panel?.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.lanHelperDiagnosticsAction || '';
      button.disabled = true;
      const original = button.textContent ?? '';
      button.textContent = '处理中...';
      try {
        if (action === 'refresh-options') {
          const games = await scanGames();
          setOptions(games);
          dispatchProductAction('刷新诊断游戏列表', true, '诊断目标游戏列表已刷新。', games);
          return;
        }
        const current = readDiagnosticTarget();
        const currentSelectedGame = getReferenceSelectedGame();
        const targetGameId =
          current.mode === 'global' ? ''
            : current.mode === 'selected' ? currentSelectedGame?.game_id || current.game_id
              : current.game_id;
        const targetLabel =
          current.mode === 'global' ? '全局环境'
            : targetGameId
              ? options.find((game) => game.game_id === targetGameId)?.display_name || currentSelectedGame?.display_name || targetGameId
              : '当前选中游戏未设置，已回退全局环境';
        const report = targetGameId ? await generateDiagnosticReportForGame(targetGameId) : await generateDiagnosticReport();
        const nextRecord: DiagnosticRecord = {
          target_mode: current.mode,
          target_game_id: targetGameId || undefined,
          target_label: targetGameId ? `${targetLabel} (${targetGameId})` : targetLabel,
          generated_at: new Date().toISOString(),
          report
        };
        saveDiagnosticRecord(nextRecord);
        setRecord(nextRecord);
        const snapshot = await readReferenceRuntimeSnapshot({ includeDiagnostics: true });
        dispatchRuntimeSnapshot(snapshot);
        dispatchProductAction('生成真实诊断报告', true, `已生成 ${nextRecord.target_label} 的真实诊断报告。`, nextRecord);
      } catch (error) {
        dispatchProductAction('生成真实诊断报告', false, error instanceof Error ? error.message : String(error || '诊断失败'));
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };

    panel.addEventListener('change', handleChange, true);
    panel.addEventListener('click', handleClick, true);
    return () => {
      panel?.removeEventListener('change', handleChange, true);
      panel?.removeEventListener('click', handleClick, true);
    };
  }, [productMode.enabled, target, record, options, runtime.snapshot?.loaded_at]);

  useEffect(() => {
    if (!productMode.enabled) {
      restoreDiagnostics();
      return;
    }
    patchDiagnostics(runtime);
  }, [productMode.enabled, runtime.loaded, runtime.network.ready, runtime.network.running, runtime.terraria.running, runtime.terraria.ready, runtime.snapshot?.loaded_at, record?.generated_at]);

  return null;
}


