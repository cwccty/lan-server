import { useEffect } from 'react';
import { useReferenceProductMode } from './useReferenceProductMode';
import { useReferenceRuntime } from './useReferenceRuntime';

function replaceText(root: ParentNode, original: string, replacement: string, marker: string) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('span,p'));
  const target = candidates.find((node) => {
    const text = node.textContent?.trim() ?? '';
    return text === original || node.dataset.lanHelperPatched === marker;
  });
  if (!target) return;
  if (!target.dataset.lanHelperOriginalText) target.dataset.lanHelperOriginalText = original;
  target.textContent = replacement;
  target.dataset.lanHelperPatched = marker;
}

function restoreText(root: ParentNode, marker: string) {
  const targets = Array.from(root.querySelectorAll<HTMLElement>(`[data-lan-helper-patched="${marker}"]`));
  targets.forEach((target) => {
    target.textContent = target.dataset.lanHelperOriginalText || target.textContent;
    delete target.dataset.lanHelperPatched;
  });
}

function patchHome(runtime: ReturnType<typeof useReferenceRuntime>) {
  const root = document.querySelector('main');
  if (!root) return;

  const readinessText = !runtime.loaded
    ? '读取中'
    : runtime.network.ready
      ? '已连接'
      : runtime.network.running
        ? '运行中'
        : runtime.network.hasError
          ? '需诊断'
          : '待配置';
  const networkStatus = runtime.network.ready
    ? '真实状态：虚拟组网已连接'
    : runtime.network.running
      ? '真实状态：n2n 运行中'
      : '真实状态：等待组网';
  const supernodeBadge = runtime.network.ready ? 'ACK' : runtime.network.running ? 'RUN' : '待测';
  const supernodeAddress = runtime.network.supernode || '未配置 supernode';
  const adapterDetail = runtime.network.virtualIp
    ? `真实虚拟 IP：${runtime.network.virtualIp}`
    : '尚未读取到真实虚拟 IP。';
  const supernodeDetail = runtime.network.supernode
    ? `真实 Supernode：${runtime.network.supernode}`
    : '尚未配置或读取到 Supernode。';
  const networkDetail = runtime.network.label || '等待真实 runtime 快照。';
  const readinessDetail = runtime.loaded
    ? `当前读取的是真实后端轻量状态：${networkDetail}`
    : '正在读取真实后端状态，请稍候。';

  replaceText(root, '75%', readinessText, 'home-readiness-progress');
  replaceText(root, '虚拟服主在线', networkStatus, 'home-topology-status');
  replaceText(root, '24ms', supernodeBadge, 'home-supernode-badge');
  replaceText(root, 'n2n.edge.me:7777', supernodeAddress, 'home-supernode-address');
  replaceText(root, '「网卡状态/游戏档案/系统补丁」检测通过。无需配置防火墙。', readinessDetail, 'home-readiness-detail');
  replaceText(root, '系统驱动检测完毕，正常启动。', adapterDetail, 'home-adapter-detail');
  replaceText(root, '穿透环境评级为 [A级优质]', networkDetail, 'home-network-detail');
  replaceText(root, '已自动分配最近北京联通服务器节点', supernodeDetail, 'home-supernode-detail');
}

function restoreHome() {
  const root = document.querySelector('main');
  if (!root) return;
  [
    'home-topology-status',
    'home-readiness-progress',
    'home-readiness-detail',
    'home-supernode-badge',
    'home-supernode-address',
    'home-adapter-detail',
    'home-network-detail',
    'home-supernode-detail'
  ].forEach((marker) => restoreText(root, marker));
}

export function ReferenceProductHomePatcher() {
  const productMode = useReferenceProductMode();
  const runtime = useReferenceRuntime();

  useEffect(() => {
    if (!productMode.enabled) {
      restoreHome();
      return;
    }
    patchHome(runtime);
  }, [productMode.enabled, runtime.loaded, runtime.network.ready, runtime.network.running, runtime.network.virtualIp, runtime.network.supernode, runtime.network.label]);

  return null;
}
