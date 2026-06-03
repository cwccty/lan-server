import { useEffect, useState } from 'react';
import type { ReferenceActionResult } from './actions';
import { useReferenceProductMode } from './useReferenceProductMode';

interface ProductActionEventDetail {
  actionId: string;
  result: ReferenceActionResult;
  at: string;
}

const PATCH_ATTR = 'data-lan-helper-result-patched';

function textOf(element: Element) {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function findPageRoot(headingText: string) {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3')).filter((heading) =>
    textOf(heading).includes(headingText)
  );
  const heading = headings.length > 0 ? headings[headings.length - 1] : null;
  return heading?.closest('.space-y-6') ?? heading?.closest('main > div > div') ?? null;
}

function rememberAndSet(node: HTMLElement | null | undefined, marker: string, text: string) {
  if (!node) return;
  if (!node.dataset.lanHelperOriginalText) node.dataset.lanHelperOriginalText = node.textContent ?? '';
  node.textContent = text;
  node.setAttribute(PATCH_ATTR, marker);
}

function restoreResultPatches() {
  Array.from(document.querySelectorAll<HTMLElement>(`[${PATCH_ATTR}]`)).forEach((node) => {
    node.textContent = node.dataset.lanHelperOriginalText || node.textContent;
    node.removeAttribute(PATCH_ATTR);
  });
}

function resultCount(data: unknown) {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.total === 'number') return record.total;
    if (typeof record.created === 'number' || typeof record.updated === 'number') {
      return Number(record.created || 0) + Number(record.updated || 0) + Number(record.skipped || 0);
    }
  }
  return null;
}

function actionSummary(detail: ProductActionEventDetail) {
  const count = resultCount(detail.result.data);
  const status = detail.result.ok ? '成功' : '失败';
  const countText = count === null ? '' : `｜数量 ${count}`;
  return `真实后端${status}: ${detail.result.action}${countText}｜${new Date(detail.at).toLocaleTimeString()}`;
}

function patchGameScan(detail: ProductActionEventDetail) {
  const root = findPageRoot('游戏扫描');
  if (!root) return;
  const cacheLine = Array.from(root.querySelectorAll<HTMLElement>('p')).find((node) =>
    textOf(node).includes('上次全盘检索缓存') || node.getAttribute(PATCH_ATTR) === 'games-cache-line'
  );
  rememberAndSet(cacheLine, 'games-cache-line', actionSummary(detail));
}

function patchSolutions(detail: ProductActionEventDetail) {
  const root = findPageRoot('方案库');
  if (!root) return;
  const summary = Array.from(root.querySelectorAll<HTMLElement>('h3, p, span, div')).find((node) =>
    textOf(node).includes('同步列表结果') || node.getAttribute(PATCH_ATTR) === 'solutions-sync-summary'
  );
  rememberAndSet(summary, 'solutions-sync-summary', actionSummary(detail));
}

function patchRecommendation(detail: ProductActionEventDetail) {
  const root = findPageRoot('推荐方案');
  if (!root) return;

  if (detail.actionId === 'recommendation-test-connectivity') {
    const consoleBox = Array.from(root.querySelectorAll<HTMLElement>('p')).find((node) =>
      textOf(node).includes('Ping') || node.getAttribute(PATCH_ATTR) === 'recommendation-connectivity-line'
    );
    rememberAndSet(consoleBox, 'recommendation-connectivity-line', actionSummary(detail));
    return;
  }

  const pre = root.querySelector<HTMLElement>('pre');
  if (!pre) return;
  const data = detail.result.data;
  const dataText = data ? JSON.stringify(data, null, 2) : detail.result.message;
  rememberAndSet(pre, 'recommendation-invite-summary', `[真实后端摘要]\n动作: ${detail.result.action}\n状态: ${detail.result.ok ? '成功' : '失败'}\n时间: ${new Date(detail.at).toLocaleString()}\n\n${dataText}`);
}

function patchByAction(detail: ProductActionEventDetail) {
  if (detail.actionId.startsWith('games-')) patchGameScan(detail);
  if (detail.actionId.startsWith('solutions-')) patchSolutions(detail);
  if (detail.actionId.startsWith('recommendation-')) patchRecommendation(detail);
}

export function ReferenceProductActionResultPatcher() {
  const productMode = useReferenceProductMode();
  const [lastDetail, setLastDetail] = useState<ProductActionEventDetail | null>(null);

  useEffect(() => {
    const handleAction = (event: Event) => {
      const custom = event as CustomEvent<ProductActionEventDetail>;
      if (custom.detail?.actionId && custom.detail?.result) setLastDetail(custom.detail);
    };
    window.addEventListener('lan-helper:reference-product-action', handleAction as EventListener);
    return () => window.removeEventListener('lan-helper:reference-product-action', handleAction as EventListener);
  }, []);

  useEffect(() => {
    if (!productMode.enabled) {
      restoreResultPatches();
      return;
    }
    if (lastDetail) patchByAction(lastDetail);
  }, [productMode.enabled, lastDetail]);

  return null;
}
