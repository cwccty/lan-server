import {
  generateDiagnosticReport,
  getN2nLastConfig,
  readServerSession,
  scanGames,
  sendServerCommand,
  setupNetwork,
  startGameServerSession,
  startNetwork,
  stopNetwork,
  stopServerSession,
  syncAdapterRegistry,
  syncLocalAdapterRegistryExample,
  testConnectivity
} from '../api/tauri';
import type { ConnectivityTarget, NetworkConfig } from '../types/network';
import type { LaunchConfig } from '../types/recommendation';
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
