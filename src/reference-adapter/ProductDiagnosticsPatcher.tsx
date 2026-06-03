import { useEffect } from 'react';
import { snapshotForDebug } from './mappers';
import { useReferenceProductMode } from './useReferenceProductMode';
import { useReferenceRuntime } from './useReferenceRuntime';

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
  markers.forEach((marker) => {
    Array.from(root.querySelectorAll<HTMLElement>(`[data-lan-helper-patched="${marker}"]`)).forEach((node) => {
      node.textContent = node.dataset.lanHelperOriginalText || node.textContent;
      delete node.dataset.lanHelperPatched;
    });
  });
}

function patchDiagnostics(runtime: ReturnType<typeof useReferenceRuntime>) {
  const root = document.querySelector('main');
  if (!root) return;
  if (!root.textContent?.includes('网络诊断与链路性能')) return;

  const n2n = runtime.snapshot?.n2n;
  const debug = runtime.snapshot ? snapshotForDebug(runtime.snapshot) : { message: 'no runtime snapshot yet' };
  const json = JSON.stringify(debug, null, 2);

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
  if (code) rememberAndSet(code, 'diagnostics-code', '检测来源: reference runtime snapshot');

  const cacheLine = Array.from(root.querySelectorAll<HTMLElement>('p')).find((node) =>
    node.textContent?.includes('上次自愈分析缓存') || node.dataset.lanHelperPatched === 'diagnostics-cache-line'
  );
  if (cacheLine) rememberAndSet(cacheLine, 'diagnostics-cache-line', `真实快照时间: ${runtime.snapshot?.loaded_at || '等待 runtime'} ｜ product mode`);

  const evidenceA = Array.from(root.querySelectorAll<HTMLElement>('p')).find((node) =>
    node.textContent?.includes('TAP_ERR_IP_ASSIGN') || node.dataset.lanHelperPatched === 'diagnostics-evidence-a'
  );
  if (evidenceA) rememberAndSet(evidenceA, 'diagnostics-evidence-a', `诊断证据: ${n2n?.summary || runtime.network.label}`);

  const evidenceB = Array.from(root.querySelectorAll<HTMLElement>('p')).find((node) =>
    node.textContent?.includes('P2P直连握手丢包') || node.dataset.lanHelperPatched === 'diagnostics-evidence-b'
  );
  if (evidenceB) rememberAndSet(evidenceB, 'diagnostics-evidence-b', `诊断证据: Terraria=${runtime.terraria.running ? 'running' : 'stopped'} / ready=${runtime.terraria.ready}`);
}

export function ReferenceProductDiagnosticsPatcher() {
  const productMode = useReferenceProductMode();
  const runtime = useReferenceRuntime();

  useEffect(() => {
    if (!productMode.enabled) {
      restoreDiagnostics();
      return;
    }
    patchDiagnostics(runtime);
  }, [productMode.enabled, runtime.loaded, runtime.network.ready, runtime.network.running, runtime.terraria.running, runtime.terraria.ready, runtime.snapshot?.loaded_at]);

  return null;
}
