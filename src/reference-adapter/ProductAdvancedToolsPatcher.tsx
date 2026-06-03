import { useEffect } from 'react';
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
    const total = tcp.length + udp.length + bridges.length;
    const running = [...tcp, ...udp, ...bridges].filter((item) => item.running).length;

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
        id: item.id,
        running: item.running,
        line: `${item.listen} → ${item.target}`,
        metrics: `连接 ${item.active_connections}/${item.total_connections}｜${Math.round((item.bytes_in + item.bytes_out) / 1024)} KB`,
        error: item.last_error
      })),
      ...udp.map((item) => ({
        type: 'UDP',
        id: item.id,
        running: item.running,
        line: `${item.listen} → ${item.target}`,
        metrics: `客户端 ${item.active_clients}｜包 ${item.packets_in}/${item.packets_out}`,
        error: item.last_error
      })),
      ...bridges.map((item) => ({
        type: 'BRIDGE',
        id: item.id,
        running: item.running,
        line: `${item.listen} → ${item.forward_targets.join(', ')}`,
        metrics: `转发 ${item.forwarded_packets}｜丢弃 ${item.dropped_packets}`,
        error: item.last_error
      }))
    ];

    panel.innerHTML = `
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <div class="font-heading text-sm font-bold text-slate-800">真实后端高级连接状态</div>
          <div class="mt-1 text-[11px] text-slate-500">Product Mode 下以 Tauri 后端返回为准，下面的参考示例卡片不再作为真实状态依据。</div>
        </div>
        <div class="rounded-full bg-white px-3 py-1 font-mono text-[11px] font-bold text-amber-700">${running}/${total}</div>
      </div>
      ${
        rows.length === 0
          ? '<div class="rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-[11px] text-slate-500">当前后端没有运行中的 TCP/UDP/广播桥实例。点击“挂载并上线该高速链路”后会在这里显示真实实例。</div>'
          : `<div class="space-y-2">${rows
              .map(
                (row) => `
                  <div class="rounded-xl border border-amber-100 bg-white/80 p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div class="font-mono text-[11px] font-bold text-slate-800">${escapeHtml(row.type)} · ${escapeHtml(row.id)}</div>
                      <div class="${row.running ? 'text-emerald-600' : 'text-slate-400'} text-[10px] font-bold">${row.running ? 'RUNNING' : 'STOPPED'}</div>
                    </div>
                    <div class="mt-1 font-mono text-[11px] text-slate-600">${escapeHtml(row.line)}</div>
                    <div class="mt-1 text-[10px] text-slate-400">${escapeHtml(row.metrics)}</div>
                    ${row.error ? `<div class="mt-1 text-[10px] text-rose-600">${escapeHtml(row.error)}</div>` : ''}
                  </div>
                `
              )
              .join('')}</div>`
      }
    `;
  }, [productMode.enabled, runtime.snapshot]);

  return null;
}
