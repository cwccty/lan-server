// Deprecated after controlled Header migration.
// Product Mode 顶部状态栏现在由 src/product-ui/ProductHeader.tsx 直接读取 runtime state 并调用真实 n2n 动作。
// 不再通过 DOM 文本替换来覆盖参考 Header 中的 就绪: 24ms。
import { useEffect } from 'react';
import { useReferenceProductMode } from './useReferenceProductMode';
import { useReferenceRuntime } from './useReferenceRuntime';

const REFERENCE_READY_TEXT_PATTERN = /^就绪:\s*\d+ms$/;

function getHeaderStatusSpan() {
  const header = document.querySelector('header');
  if (!header) return null;

  const spans = Array.from(header.querySelectorAll('span'));
  return spans.find((span) => {
    const text = span.textContent?.trim() ?? '';
    return REFERENCE_READY_TEXT_PATTERN.test(text) || text === '网络连接中...' || span.dataset.lanHelperPatched === 'header-status';
  }) ?? null;
}

function productStatusText(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (!runtime.loaded) return '真实状态: 读取中';
  if (runtime.network.ready) return '真实状态: n2n 已连接';
  if (runtime.network.running) return '真实状态: n2n 运行中';
  if (runtime.network.hasError) return '真实状态: 需诊断';
  return '真实状态: 未组网';
}

export function ReferenceProductHeaderPatcher() {
  const productMode = useReferenceProductMode();
  const runtime = useReferenceRuntime();

  useEffect(() => {
    const statusSpan = getHeaderStatusSpan();
    if (!statusSpan) return;

    if (!statusSpan.dataset.lanHelperOriginalText) {
      statusSpan.dataset.lanHelperOriginalText = statusSpan.textContent ?? '';
    }

    if (!productMode.enabled) {
      statusSpan.textContent = statusSpan.dataset.lanHelperOriginalText || statusSpan.textContent;
      delete statusSpan.dataset.lanHelperPatched;
      return;
    }

    statusSpan.textContent = productStatusText(runtime);
    statusSpan.dataset.lanHelperPatched = 'header-status';
  }, [productMode.enabled, runtime.loaded, runtime.network.ready, runtime.network.running, runtime.network.hasError]);

  return null;
}

