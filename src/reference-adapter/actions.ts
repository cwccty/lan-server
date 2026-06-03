import {
  generateDiagnosticReport,
  getN2nLastConfig,
  listPortProxies,
  listUdpBroadcastBridges,
  listUdpProxies,
  readServerSession,
  scanGames,
  sendServerCommand,
  setupNetwork,
  startGenericServerSession,
  startGameServerSession,
  startNetwork,
  startPortProxy,
  startUdpBroadcastBridge,
  startUdpProxy,
  stopNetwork,
  stopPortProxy,
  stopServerSession,
  stopUdpBroadcastBridge,
  stopUdpProxy,
  syncAdapterRegistry,
  syncLocalAdapterRegistryExample,
  selfTestPortProxy,
  selfTestUdpBroadcastBridge,
  selfTestUdpProxy,
  testConnectivity
} from '../api/tauri';
import type { ConnectivityTarget, NetworkConfig } from '../types/network';
import type { PortProxyConfig } from '../types/portProxy';
import type { LaunchConfig } from '../types/recommendation';
import type { GenericServerLaunchConfig } from '../types/serverSession';
import type { UdpBroadcastBridgeConfig } from '../types/udpBroadcastBridge';
import type { UdpProxyConfig } from '../types/udpProxy';
import { readReferenceRuntimeSnapshot } from './runtimeStore';
import type { ReferenceRuntimeSnapshot } from './types';

export interface ReferenceActionResult<T = unknown> {
  ok: boolean;
  action: string;
  message: string;
  data?: T;
  snapshot?: ReferenceRuntimeSnapshot;
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

async function withSnapshot<T>(action: string, task: () => Promise<T>, includeDiagnostics = false): Promise<ReferenceActionResult<T>> {
  try {
    const data = await task();
    const snapshot = await readReferenceRuntimeSnapshot({ includeDiagnostics });
    window.__LAN_HELPER_REFERENCE_RUNTIME__ = snapshot;
    return {
      ok: true,
      action,
      message: `${action} 已完成。`,
      data,
      snapshot
    };
  } catch (error) {
    const snapshot = await readReferenceRuntimeSnapshot({ includeDiagnostics }).catch(() => undefined);
    if (snapshot) window.__LAN_HELPER_REFERENCE_RUNTIME__ = snapshot;
    return {
      ok: false,
      action,
      message: messageOf(error),
      snapshot
    };
  }
}

export function refreshReferenceRuntime(includeDiagnostics = false) {
  return withSnapshot('刷新真实后端快照', () => readReferenceRuntimeSnapshot({ includeDiagnostics }), includeDiagnostics);
}

export function saveReferenceN2nConfig(config: NetworkConfig) {
  return withSnapshot('保存 n2n 配置', () => setupNetwork('n2n', config));
}

export function startReferenceN2n(config?: NetworkConfig) {
  return withSnapshot('启动 n2n', async () => {
    if (config) await setupNetwork('n2n', config);
    return startNetwork('n2n');
  });
}

export function stopReferenceN2n() {
  return withSnapshot('停止 n2n', () => stopNetwork('n2n'));
}

export function startReferenceTerrariaServer(config: LaunchConfig = {}) {
  return withSnapshot('启动 Terraria 服务端', () => startGameServerSession('terraria', 'server', config));
}

export function stopReferenceTerrariaServer() {
  return withSnapshot('停止 Terraria 服务端', () => stopServerSession());
}

export function readReferenceTerrariaServer() {
  return withSnapshot('读取 Terraria 服务端', () => readServerSession());
}

export function sendReferenceTerrariaCommand(command: string) {
  return withSnapshot('发送 Terraria 控制台命令', () => sendServerCommand(command));
}

export function testReferenceConnectivity(target: ConnectivityTarget) {
  return withSnapshot('测试连接', () => testConnectivity(target));
}

export function generateReferenceDiagnostics() {
  return withSnapshot('生成诊断报告', () => generateDiagnosticReport(), true);
}

export function scanReferenceGames() {
  return withSnapshot('扫描本地游戏', () => scanGames());
}

export function syncReferenceLocalAdapterRegistry() {
  return withSnapshot('同步本地共享方案示例', () => syncLocalAdapterRegistryExample());
}

export function syncReferenceAdapterRegistry(registryUrl: string) {
  return withSnapshot('同步共享方案库', () => syncAdapterRegistry(registryUrl));
}

export function readReferenceN2nLastConfig() {
  return withSnapshot('读取最近 n2n 配置', () => getN2nLastConfig());
}

export type ReferenceAdvancedProxyKind = 'tcp' | 'udp' | 'bridge';

export interface ReferenceAdvancedProxyForm {
  type: ReferenceAdvancedProxyKind;
  listen_port: number;
  target_host: string;
  target_port?: number;
}

export interface ReferenceGenericServerForm {
  game_name: string;
  executable_path: string;
  port: number;
}

export function startReferenceAdvancedProxy(form: ReferenceAdvancedProxyForm) {
  return withSnapshot('启动高级连接链路', async () => {
    if (form.type === 'tcp') {
      const config: PortProxyConfig = {
        protocol: 'tcp',
        listen_host: '0.0.0.0',
        listen_port: form.listen_port,
        target_host: form.target_host,
        target_port: form.target_port ?? form.listen_port,
        label: 'reference-ui-tcp-proxy'
      };
      return startPortProxy(config);
    }

    if (form.type === 'udp') {
      const config: UdpProxyConfig = {
        listen_host: '0.0.0.0',
        listen_port: form.listen_port,
        target_host: form.target_host,
        target_port: form.target_port ?? form.listen_port,
        label: 'reference-ui-udp-proxy'
      };
      return startUdpProxy(config);
    }

    const target = form.target_host.includes(':') ? form.target_host : `${form.target_host}:${form.listen_port}`;
    const config: UdpBroadcastBridgeConfig = {
      listen_host: '0.0.0.0',
      listen_port: form.listen_port,
      forward_targets: [target],
      allow_broadcast: true,
      duplicate_ttl_ms: 3000,
      label: 'reference-ui-udp-broadcast-bridge'
    };
    return startUdpBroadcastBridge(config);
  });
}

export function selfTestReferenceAdvancedProxy(type: ReferenceAdvancedProxyKind) {
  if (type === 'tcp') return withSnapshot('自测 TCP 端口代理', () => selfTestPortProxy());
  if (type === 'udp') return withSnapshot('自测 UDP 端口代理', () => selfTestUdpProxy());
  return withSnapshot('自测 UDP 广播桥', () => selfTestUdpBroadcastBridge());
}

export function stopReferenceAdvancedProxy(type: ReferenceAdvancedProxyKind) {
  return withSnapshot('停止高级连接链路', async () => {
    if (type === 'tcp') {
      const running = (await listPortProxies()).find((item) => item.running && item.protocol === 'tcp');
      if (!running) throw new Error('没有找到正在运行的 TCP 端口代理。');
      return stopPortProxy(running.id);
    }

    if (type === 'udp') {
      const running = (await listUdpProxies()).find((item) => item.running);
      if (!running) throw new Error('没有找到正在运行的 UDP 端口代理。');
      return stopUdpProxy(running.id);
    }

    const running = (await listUdpBroadcastBridges()).find((item) => item.running);
    if (!running) throw new Error('没有找到正在运行的 UDP 广播桥。');
    return stopUdpBroadcastBridge(running.id);
  });
}

export function startReferenceGenericServer(config: ReferenceGenericServerForm) {
  return withSnapshot('启动通用游戏服务端', () => {
    const launchConfig: GenericServerLaunchConfig = {
      game_name: config.game_name,
      executable_path: config.executable_path,
      port: config.port,
      jar_memory_mb: 1024
    };
    return startGenericServerSession(launchConfig);
  });
}
