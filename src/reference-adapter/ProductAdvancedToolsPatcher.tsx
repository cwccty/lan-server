import { useEffect } from 'react';
import {
  selfTestPortProxy,
  selfTestUdpBroadcastBridge,
  selfTestUdpProxy,
  stopPortProxy,
  stopServerSession,
  stopUdpBroadcastBridge,
  stopUdpProxy
} from '../api/tauri';
import { REFERENCE_RUNTIME_EVENT } from './bootstrap';
import { readReferenceRuntimeSnapshot } from './runtimeStore';
import type { ReferenceRuntimeSnapshot } from './types';
import { useReferenceProductMode } from './useReferenceProductMode';
import { useReferenceRuntime } from './useReferenceRuntime';

const PANEL_ID = 'lan-helper-product-advanced-tools-panel';
const PATCH_ATTR = 'data-lan-helper-advanced-tools-patched';

function textOf(element: Element) {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function findPageRoot() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3')).find((node) =>
    textOf(node).includes('高级连接工具')
  );
  return heading?.closest('.space-y-6') ?? heading?.closest('main > div > div') ?? null;
}

function restoreAdvancedToolsPatch() {
  const panel = document.getElementById(PANEL_ID);
  panel?.remove();

  Array.from(document.querySelectorAll<HTMLElement>(`[${PATCH_ATTR}]`)).forEach((node) => {
    if (node.dataset.lanHelperOriginalText) node.textContent = node.dataset.lanHelperOriginalText;
    node.removeAttribute(PATCH_ATTR);
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

function dispatchRuntimeSnapshot(snapshot: ReferenceRuntimeSnapshot) {
  window.__LAN_HELPER_REFERENCE_RUNTIME__ = snapshot;
  window.dispatchEvent(new CustomEvent<ReferenceRuntimeSnapshot>(REFERENCE_RUNTIME_EVENT, { detail: snapshot }));
}

function dispatchProductAction(action: string, ok: boolean, message: string, data?: unknown) {
  window.dispatchEvent(new CustomEvent('lan-helper:reference-product-action', {
    detail: {
      actionId: `advanced-tools-panel-${action}`,
      result: {
        ok,
        action,
        message,
        data
      },
      at: new Date().toISOString()
    }
  }));
}

async function refreshRuntime(action = '刷新高级工具状态') {
  const snapshot = await readReferenceRuntimeSnapshot();
  dispatchRuntimeSnapshot(snapshot);
  dispatchProductAction(action, true, '真实运行状态已刷新。', snapshot);
  return snapshot;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buttonHtml(action: string, label: string, kind: string, id = '') {
  return `<button type="button" data-lan-helper-advanced-panel-action="${escapeHtml(action)}" data-lan-helper-advanced-panel-kind="${escapeHtml(kind)}" data-lan-helper-advanced-panel-id="${escapeHtml(id)}" class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-sm transition hover:border-amber-300 hover:text-amber-700 disabled:opacity-50">${escapeHtml(label)}</button>`;
}

async function runAdvancedPanelAction(action: string, kind: string, id: string) {
  if (action === 'refresh') return refreshRuntime();
  if (action === 'stop') {
    if (kind === 'tcp') await stopPortProxy(id);
    else if (kind === 'udp') await stopUdpProxy(id);
    else if (kind === 'bridge') await stopUdpBroadcastBridge(id);
    else if (kind === 'server') await stopServerSession();
    else throw new Error(`未知实例类型：${kind}`);
    return refreshRuntime('停止高级工具实例');
  }
  if (action === 'self-test') {
    const data =
      kind === 'tcp' ? await selfTestPortProxy()
        : kind === 'udp' ? await selfTestUdpProxy()
          : kind === 'bridge' ? await selfTestUdpBroadcastBridge()
            : null;
    if (!data) throw new Error('通用服务端暂无自测入口，请查看服务端日志和端口检测。');
    await refreshRuntime('自测高级工具实例');
    return data;
  }
  throw new Error(`未知高级工具动作：${action}`);
}

export function ReferenceProductAdvancedToolsPatcher() {
  const productMode = useReferenceProductMode();
  const runtime = useReferenceRuntime();

  useEffect(() => {
    if (!productMode.enabled) {
      restoreAdvancedToolsPatch();
      return;
    }

    const root = findPageRoot();
    if (!root) return;

    const snapshot = runtime.snapshot;
    const tcp = snapshot?.port_proxies ?? [];
    const udp = snapshot?.udp_proxies ?? [];
    const bridges = snapshot?.udp_broadcast_bridges ?? [];
    const server = snapshot?.server_session ?? null;
    const total = tcp.length + udp.length + bridges.length + (server ? 1 : 0);
    const running = [...tcp, ...udp, ...bridges].filter((item) => item.running).length + (server?.running ? 1 : 0);

    const heading = Array.from(root.querySelectorAll<HTMLElement>('h3')).find((node) =>
      textOf(node).includes('当前运行中的高级代理实例') || node.getAttribute(PATCH_ATTR) === 'advanced-heading'
    );
    if (heading) {
      if (!heading.dataset.lanHelperOriginalText) heading.dataset.lanHelperOriginalText = heading.textContent ?? '';
      heading.textContent = `真实高级连接实例 (${running}/${total} 运行中)`;
      heading.setAttribute(PATCH_ATTR, 'advanced-heading');
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.className = 'rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-slate-700 shadow-sm';
      const insertAfter = Array.from(root.querySelectorAll<HTMLElement>('div')).find((node) =>
        textOf(node).includes('管理底层 TCP/UDP')
      );
      insertAfter?.parentElement?.insertBefore(panel, insertAfter.nextSibling);
    }

    const rows = [
      ...tcp.map((item) => ({
        type: 'TCP',
        kind: 'tcp',
        id: item.id,
        running: item.running,
        line: `${item.listen} → ${item.target}`,
        metrics: `连接 ${item.active_connections}/${item.total_connections}｜入 ${formatBytes(item.bytes_in)} / 出 ${formatBytes(item.bytes_out)}`,
        error: item.last_error,
        logs: item.logs ?? [],
        canSelfTest: true
      })),
      ...udp.map((item) => ({
        type: 'UDP',
        kind: 'udp',
        id: item.id,
        running: item.running,
        line: `${item.listen} → ${item.target}`,
        metrics: `客户端 ${item.active_clients}｜包 ${item.packets_in}/${item.packets_out}｜入 ${formatBytes(item.bytes_in)} / 出 ${formatBytes(item.bytes_out)}`,
        error: item.last_error,
        logs: item.logs ?? [],
        canSelfTest: true
      })),
      ...bridges.map((item) => ({
        type: 'BRIDGE',
        kind: 'bridge',
        id: item.id,
        running: item.running,
        line: `${item.listen} → ${item.forward_targets.join(', ')}`,
        metrics: `收到 ${item.received_packets}｜转发 ${item.forwarded_packets}｜丢弃 ${item.dropped_packets}｜入 ${formatBytes(item.bytes_in)} / 出 ${formatBytes(item.bytes_out)}`,
        error: item.last_error,
        logs: item.logs ?? [],
        canSelfTest: true
      })),
      ...(server ? [{
        type: 'SERVER',
        kind: 'server',
        id: server.pid ? `pid-${server.pid}` : 'single-session',
        running: server.running,
        line: `${server.game_id || 'generic'} / ${server.profile_id || 'manual'} / ${server.message || '无状态消息'}`,
        metrics: `ready=${server.ready ? 'yes' : 'no'}｜ever_ready=${server.ever_ready ? 'yes' : 'no'}｜uptime=${server.uptime_seconds ?? 0}s`,
        error: server.exit_code !== undefined && server.exit_code !== null ? `exit_code=${server.exit_code}` : '',
        logs: server.logs ?? [],
        canSelfTest: false
      }] : [])
    ];

    panel.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <div class="font-heading text-sm font-bold text-slate-800">真实后端高级连接状态</div>
          <div class="mt-1 text-[11px] text-slate-500">Product Mode 下以 Tauri 后端返回为准；这里集中显示 TCP/UDP/广播桥和通用服务端单会话，下面参考示例卡片不再作为真实状态依据。</div>
        </div>
        <div class="flex items-center gap-2">
          <div class="rounded-full bg-white px-3 py-1 font-mono text-[11px] font-bold text-amber-700">${running}/${total}</div>
          ${buttonHtml('refresh', '刷新真实状态', 'all')}
        </div>
      </div>
      ${snapshot?.errors?.length ? `<div class="mb-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] text-rose-700">${snapshot.errors.slice(0, 3).map(escapeHtml).join('；')}</div>` : ''}
      ${
        rows.length === 0
          ? '<div class="rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-[11px] text-slate-500">当前后端没有运行中的 TCP/UDP/广播桥实例。点击“挂载并上线该高速链路”后会在这里显示真实实例。</div>'
          : `<div class="space-y-2">${rows
              .map(
                (row) => `
                  <div class="rounded-xl border border-amber-100 bg-white/80 p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <div class="font-mono text-[11px] font-bold text-slate-800">${escapeHtml(row.type)} · ${escapeHtml(row.id)}</div>
                        <div class="${row.running ? 'text-emerald-600' : 'text-slate-400'} mt-0.5 text-[10px] font-bold">${row.running ? 'RUNNING' : 'STOPPED'}</div>
                      </div>
                      <div class="flex flex-wrap justify-end gap-1.5">
                        ${row.canSelfTest ? buttonHtml('self-test', '自测', row.kind, row.id) : ''}
                        ${row.running ? buttonHtml('stop', '停止', row.kind, row.id) : ''}
                      </div>
                    </div>
                    <div class="mt-1 font-mono text-[11px] text-slate-600">${escapeHtml(row.line)}</div>
                    <div class="mt-1 text-[10px] text-slate-400">${escapeHtml(row.metrics)}</div>
                    ${row.error ? `<div class="mt-1 text-[10px] text-rose-600">${escapeHtml(row.error)}</div>` : ''}
                    ${row.logs?.length ? `<div class="mt-2 rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-500">${row.logs.slice(-3).map(escapeHtml).join('<br/>')}</div>` : ''}
                  </div>
                `
              )
              .join('')}</div>`
      }
    `;

    const handleClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-lan-helper-advanced-panel-action]');
      if (!button || !panel?.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.lanHelperAdvancedPanelAction || '';
      const kind = button.dataset.lanHelperAdvancedPanelKind || '';
      const id = button.dataset.lanHelperAdvancedPanelId || '';
      button.disabled = true;
      const original = button.textContent ?? '';
      button.textContent = '处理中...';
      try {
        const data = await runAdvancedPanelAction(action, kind, id);
        dispatchProductAction(action, true, '高级工具真实动作已完成。', data);
      } catch (error) {
        dispatchProductAction(action, false, error instanceof Error ? error.message : String(error || '高级工具动作失败'));
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    };

    panel.addEventListener('click', handleClick, true);
    return () => panel?.removeEventListener('click', handleClick, true);
  }, [productMode.enabled, runtime.snapshot]);

  return null;
}
