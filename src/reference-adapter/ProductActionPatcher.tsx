import { useEffect, useRef, useState } from 'react';
import {
  generateReferenceDiagnostics,
  readReferenceN2nLastConfig,
  readReferenceTerrariaServer,
  saveReferenceN2nConfig,
  scanReferenceGames,
  startReferenceN2n,
  startReferenceTerrariaServer,
  stopReferenceN2n,
  stopReferenceTerrariaServer,
  syncReferenceAdapterRegistry,
  syncReferenceLocalAdapterRegistry,
  testReferenceConnectivity,
  type ReferenceActionResult
} from './actions';
import type { NetworkConfig } from '../types/network';
import type { LaunchConfig } from '../types/recommendation';
import { useReferenceProductMode } from './useReferenceProductMode';

const BUSY_ATTR = 'data-lan-helper-product-busy';
const HOOK_ATTR = 'data-lan-helper-action-hooked';

function textOf(element: Element) {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isVisible(element: Element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function findPageRoot(headingText: string) {
  const headings = Array.from(document.querySelectorAll<HTMLElement>('main h1, main h2, main h3')).filter((heading) => {
    return textOf(heading).includes(headingText) && isVisible(heading);
  });
  const heading = headings.length > 0 ? headings[headings.length - 1] : null;
  return heading?.closest('.space-y-6') ?? heading?.closest('main > div > div') ?? null;
}

function firstButton(text: string, headingText: string) {
  const root = findPageRoot(headingText);
  if (!root) return null;
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => {
    return textOf(button).includes(text) && isVisible(button);
  }) ?? null;
}

function findInputByLabel(labelText: string) {
  const labels = Array.from(document.querySelectorAll('label'));
  const label = labels.find((item) => textOf(item).includes(labelText));
  const container = label?.parentElement;
  return container?.querySelector('input, textarea, select') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
}

function readNetworkConfigFromReferenceForm(): NetworkConfig {
  const roomName = findInputByLabel('Room Name')?.value?.trim();
  const secret = findInputByLabel('Key')?.value?.trim();
  const supernode = findInputByLabel('Supernode')?.value?.trim();
  const localIp = findInputByLabel('Virtual IP')?.value?.trim();

  return {
    room_name: roomName || undefined,
    secret: secret || undefined,
    supernode: supernode || undefined,
    local_ip: localIp || undefined
  };
}

function readTerrariaConfigFromReferenceForm(): LaunchConfig {
  const world = findInputByLabel('选择要开启的世界地图')?.value?.trim();
  const portValue = findInputByLabel('服务物理端口')?.value;
  const password = findInputByLabel('进入加密锁')?.value ?? '';
  const maxPlayersValue = findInputByLabel('最大玩家承载额')?.value;
  const port = Number(portValue || 7777);
  const maxPlayers = Number(maxPlayersValue || 8);

  return {
    ...(world ? { world } : {}),
    port: Number.isFinite(port) ? port : 7777,
    password,
    max_players: Number.isFinite(maxPlayers) ? maxPlayers : 8
  };
}

function readSolutionsRegistryUrl() {
  const root = findPageRoot('方案库');
  const input = root?.querySelector('input[type="text"]') as HTMLInputElement | null;
  return input?.value?.trim() || 'http://127.0.0.1:5173/adapter-registry/index.json';
}

function readHostIpFromRecommendationPage() {
  const root = findPageRoot('推荐方案');
  const text = root?.textContent ?? '';
  const match = text.match(/10\.\d+\.\d+\.\d+/);
  return match?.[0] ?? '10.0.8.1';
}

function readGamePortFromNetworkForm() {
  const value = findInputByLabel('Game Port')?.value;
  const port = Number(value || 7777);
  return Number.isFinite(port) ? port : 7777;
}

function setBusy(button: HTMLButtonElement, busy: boolean, label?: string) {
  if (!button.dataset.lanHelperOriginalText) {
    button.dataset.lanHelperOriginalText = textOf(button);
  }
  if (!button.dataset.lanHelperOriginalTitle) {
    button.dataset.lanHelperOriginalTitle = button.title || '';
  }

  if (busy) {
    button.setAttribute(BUSY_ATTR, '1');
    button.disabled = true;
    if (label) button.title = label;
  } else {
    button.removeAttribute(BUSY_ATTR);
    button.disabled = false;
    button.title = button.dataset.lanHelperOriginalTitle || '';
  }
}

function dispatchProductNotice(actionId: string, result: ReferenceActionResult) {
  window.dispatchEvent(new CustomEvent('lan-helper:reference-product-action', { detail: { actionId, result, at: new Date().toISOString() } }));
}

function interceptButton(
  button: HTMLButtonElement | null,
  actionId: string,
  handler: () => Promise<ReferenceActionResult>
) {
  if (!button) return () => undefined;
  button.setAttribute(HOOK_ATTR, actionId);

  const handleClick = async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.getAttribute(BUSY_ATTR) === '1') return;

    setBusy(button, true, '正在调用真实后端...');
    try {
      const result = await handler();
      dispatchProductNotice(actionId, result);
    } finally {
      setBusy(button, false);
    }
  };

  button.addEventListener('click', handleClick, true);
  return () => {
    button.removeEventListener('click', handleClick, true);
    button.removeAttribute(HOOK_ATTR);
    button.removeAttribute(BUSY_ATTR);
    button.disabled = false;
    if (button.dataset.lanHelperOriginalTitle !== undefined) {
      button.title = button.dataset.lanHelperOriginalTitle;
    }
  };
}

function useProductActionToast() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const handleAction = (event: Event) => {
      const custom = event as CustomEvent<{ result?: ReferenceActionResult } | ReferenceActionResult>;
      const detail = custom.detail;
      const result: ReferenceActionResult | undefined =
        detail && 'ok' in detail ? detail : detail?.result;
      if (!result) return;
      setMessage(`${result.ok ? '真实后端完成' : '真实后端失败'}：${result.action}｜${result.message}`);
    };
    window.addEventListener('lan-helper:reference-product-action', handleAction as EventListener);
    return () => window.removeEventListener('lan-helper:reference-product-action', handleAction as EventListener);
  }, []);

  return message;
}

function useAttachProductActions(enabled: boolean) {
  const cleanupRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    cleanupRef.current.forEach((cleanup) => cleanup());
    cleanupRef.current = [];

    if (!enabled) return;

    const attach = () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [
        interceptButton(firstButton('保存基础参数', '通用组网中心'), 'network-save-config', () => saveReferenceN2nConfig(readNetworkConfigFromReferenceForm())),
        interceptButton(firstButton('Start n2n Edge', '通用组网中心'), 'network-start-n2n', () => startReferenceN2n(readNetworkConfigFromReferenceForm())),
        interceptButton(firstButton('Stop n2n Edge', '通用组网中心'), 'network-stop-n2n', () => stopReferenceN2n()),
        interceptButton(firstButton('Refresh Node Status', '通用组网中心'), 'network-refresh-runtime', () => startReferenceN2n(readNetworkConfigFromReferenceForm())),
        interceptButton(firstButton('启动自建服务', 'Terraria 联机向导'), 'terraria-start-server', () => startReferenceTerrariaServer(readTerrariaConfigFromReferenceForm())),
        interceptButton(firstButton('停止服务', 'Terraria 联机向导'), 'terraria-stop-server', () => stopReferenceTerrariaServer()),
        interceptButton(firstButton('一键自检', 'Terraria 联机向导'), 'terraria-read-server', () => readReferenceTerrariaServer()),
        interceptButton(firstButton('手动强制重扫', '网络诊断与链路性能'), 'diagnostics-generate', () => generateReferenceDiagnostics()),
        interceptButton(firstButton('手动重扫以刷新缓存', '游戏扫描'), 'games-scan-local', () => scanReferenceGames()),
        interceptButton(firstButton('强同步 Steam 自适应映射', '游戏扫描'), 'games-scan-steam-cache', () => scanReferenceGames()),
        interceptButton(firstButton('一键更新共享方案', '方案库'), 'solutions-sync-remote', () => syncReferenceAdapterRegistry(readSolutionsRegistryUrl())),
        interceptButton(firstButton('恢复默认', '方案库'), 'solutions-read-local-example', () => syncReferenceLocalAdapterRegistry()),
        interceptButton(firstButton('重新测试', '推荐方案'), 'recommendation-test-connectivity', () => testReferenceConnectivity({ host: readHostIpFromRecommendationPage(), ports: [readGamePortFromNetworkForm()], timeout_ms: 1200, mode: 'n2n_game_port' })),
        interceptButton(firstButton('复制主IP', '推荐方案'), 'recommendation-read-n2n-config', () => readReferenceN2nLastConfig()),
        interceptButton(firstButton('一键拷制专属密信包', '推荐方案'), 'recommendation-generate-diagnostics', () => generateReferenceDiagnostics())
      ].filter(Boolean) as Array<() => void>;
    };

    attach();
    const observer = new MutationObserver(() => attach());
    const main = document.querySelector('main') ?? document.body;
    observer.observe(main, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, [enabled]);
}

export function ReferenceProductActionPatcher() {
  const productMode = useReferenceProductMode();
  const actionMessage = useProductActionToast();
  useAttachProductActions(productMode.enabled);

  if (!productMode.enabled || !actionMessage) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[650] max-w-md rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white shadow-2xl">
      <div className="mb-1 font-semibold text-amber-300">Product Mode 真实动作</div>
      <div className="leading-relaxed text-slate-200">{actionMessage}</div>
    </div>
  );
}
