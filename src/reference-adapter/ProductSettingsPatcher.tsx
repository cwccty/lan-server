import { useEffect, useState } from 'react';
import { getAppSettings } from '../api/tauri';
import type { AppSettings } from '../types/settings';
import { useReferenceProductMode } from './useReferenceProductMode';

const PANEL_ATTR = 'data-lan-helper-product-settings-panel';

function textOf(element: Element) {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isSettingsPage() {
  return Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3'))
    .some((heading) => textOf(heading).includes('设置与帮助'));
}

function findSettingsRoot() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3'))
    .find((node) => textOf(node).includes('设置与帮助'));
  return heading?.closest('.space-y-6') ?? heading?.closest('main > div > div') ?? null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSettings(settings: AppSettings | null, error: string) {
  const body = error
    ? `<div class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700">${escapeHtml(error)}</div>`
    : `<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div class="rounded-xl bg-white/80 p-3">
          <div class="text-[10px] font-bold uppercase tracking-wide text-slate-400">edge.exe</div>
          <div class="mt-1 break-all font-mono text-[11px] text-slate-700">${escapeHtml(settings?.edge_path || '未设置')}</div>
        </div>
        <div class="rounded-xl bg-white/80 p-3">
          <div class="text-[10px] font-bold uppercase tracking-wide text-slate-400">默认 Supernode</div>
          <div class="mt-1 break-all font-mono text-[11px] text-slate-700">${escapeHtml(settings?.supernode_default || '未设置')}</div>
        </div>
        <div class="rounded-xl bg-white/80 p-3 md:col-span-2">
          <div class="text-[10px] font-bold uppercase tracking-wide text-slate-400">方案库地址</div>
          <div class="mt-1 break-all font-mono text-[11px] text-slate-700">${escapeHtml(settings?.adapter_registry_url || '未设置')}</div>
        </div>
        <div class="rounded-xl bg-white/80 p-3">
          <div class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Product Mode</div>
          <div class="mt-1 text-[11px] font-bold ${settings?.product_mode ? 'text-emerald-700' : 'text-slate-500'}">${settings?.product_mode ? '开启' : '关闭'}</div>
        </div>
        <div class="rounded-xl bg-white/80 p-3">
          <div class="text-[10px] font-bold uppercase tracking-wide text-slate-400">更新时间</div>
          <div class="mt-1 font-mono text-[11px] text-slate-600">${escapeHtml(settings?.updated_at || '未保存')}</div>
        </div>
      </div>`;
  return `
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <div class="font-heading text-sm font-bold text-slate-800">真实应用设置</div>
        <div class="mt-1 text-[11px] text-slate-500">来自 Tauri 后端 settings.json；“保存本地设置”会写入真实配置文件。</div>
      </div>
      <span class="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Product Mode</span>
    </div>
    ${body}
  `;
}

export function ReferenceProductSettingsPatcher() {
  const productMode = useReferenceProductMode();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState('');
  const [pageTick, setPageTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setPageTick((value) => value + 1), 800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!productMode.enabled || !isSettingsPage()) return;
    getAppSettings()
      .then((value) => {
        setSettings(value);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err || '读取应用设置失败')));
  }, [productMode.enabled, productMode.updated_at, pageTick]);

  useEffect(() => {
    const existing = document.querySelector<HTMLElement>(`[${PANEL_ATTR}]`);
    if (!productMode.enabled || !isSettingsPage()) {
      existing?.remove();
      return;
    }
    const root = findSettingsRoot();
    if (!root) return;
    let panel = existing;
    if (!panel) {
      panel = document.createElement('div');
      panel.setAttribute(PANEL_ATTR, '1');
      panel.className = 'rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-slate-700 shadow-sm';
      const header = root.querySelector('div');
      header?.parentElement?.insertBefore(panel, header.nextSibling);
    }
    panel.innerHTML = renderSettings(settings, error);
  }, [productMode.enabled, settings, error, pageTick]);

  return null;
}
