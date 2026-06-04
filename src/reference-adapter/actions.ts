import {
  analyzeGame,
  exportGameAdapterJson,
  generateDiagnosticReport,
  getN2nLastConfig,
  importGameAdapterJson,
  launchProfile,
  listGameAdapters,
  listPortProxies,
  listUdpBroadcastBridges,
  listUdpProxies,
  readServerSession,
  saveGameAdapter,
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
import type { GameAdapter, GameSummary } from '../types/game';
import type { UdpBroadcastBridgeConfig } from '../types/udpBroadcastBridge';
import type { UdpProxyConfig } from '../types/udpProxy';
import { readReferenceRuntimeSnapshot } from './runtimeStore';
import type { ReferenceRuntimeSnapshot } from './types';
import { setReferenceSelectedGame } from './selectedGame';

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

export function importReferenceAdapterJson(content: string) {
  return withSnapshot('导入共享游戏方案 JSON', () => importGameAdapterJson(content), true);
}

export function exportReferenceAdapterJson(gameId?: string) {
  return withSnapshot('导出共享游戏方案 JSON', async () => {
    const adapters = await listGameAdapters();
    const target = gameId
      ? adapters.find((adapter) => adapter.game_id === gameId)
      : adapters[0];
    if (!target) {
      throw new Error('本地没有可导出的共享游戏方案。请先同步方案库或创建自建方案。');
    }
    const content = await exportGameAdapterJson(target.game_id);
    return {
      game_id: target.game_id,
      display_name: target.display_name,
      content
    };
  }, true);
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

export interface ReferenceLaunchProfileForm {
  game_id: string;
  profile_id: string;
  config: LaunchConfig;
}

export interface ReferenceAdapterDraftForm {
  name: string;
  steam_appid?: string;
  executable?: string;
  port?: number;
  conversion_profile?: string;
  host_role?: string;
  join_role?: string;
  default_join_ip?: string;
  invite_template?: string;
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

function normalizeGameId(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'custom_game';
}

function findReferenceGame(games: GameSummary[], displayName?: string) {
  if (!displayName) return games[0] ?? null;
  const needle = displayName.trim().toLowerCase();
  return games.find((game) => game.display_name.toLowerCase() === needle)
    ?? games.find((game) => game.display_name.toLowerCase().includes(needle) || needle.includes(game.display_name.toLowerCase()))
    ?? games[0]
    ?? null;
}

export function analyzeReferenceGameByName(displayName?: string) {
  return withSnapshot('分析游戏联机能力', async () => {
    const games = await scanGames();
    const selected = findReferenceGame(games, displayName);
    if (!selected) {
      throw new Error(displayName ? `没有在真实扫描结果中找到：${displayName}` : '没有可分析的真实扫描游戏。');
    }
    setReferenceSelectedGame(selected);
    return analyzeGame(selected.game_id);
  }, true);
}

export function launchReferenceProfile(form: ReferenceLaunchProfileForm) {
  return withSnapshot('启动推荐启动项', () => launchProfile(form.game_id, form.profile_id, form.config));
}

function methodFromConversion(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes('dedicated')) return 'dedicated_server_launcher';
  if (lower.includes('broadcast')) return 'broadcast_bridge';
  if (lower.includes('proxy')) return 'port_proxy';
  if (lower.includes('steam')) return 'steam_relay_plugin';
  if (lower.includes('official')) return 'not_supported';
  if (lower.includes('manual')) return 'manual_guide';
  return 'virtual_lan';
}

function capabilityFromConversion(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes('dedicated')) return 'dedicated_server';
  if (lower.includes('broadcast')) return 'lan';
  if (lower.includes('official')) return 'official_server';
  return 'ip_join';
}

function networkTypeFromConversion(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes('dedicated')) return 'dedicated_server';
  if (lower.includes('broadcast')) return 'udp_broadcast_needed';
  if (lower.includes('proxy')) return 'tcp_port_proxy_needed';
  if (lower.includes('steam')) return 'steam_relay_plugin';
  if (lower.includes('official')) return 'official_only';
  return 'lan_ip_direct';
}

export function saveReferenceAdapterDraft(form: ReferenceAdapterDraftForm) {
  return withSnapshot('保存共享游戏方案', () => {
    const port = form.port && Number.isFinite(form.port) ? form.port : 7777;
    const executable = form.executable?.trim() || `${normalizeGameId(form.name)}.exe`;
    const conversion = form.conversion_profile || 'Virtual LAN';
    const method = methodFromConversion(conversion);
    const gameId = normalizeGameId(form.name);
    const adapter: GameAdapter = {
      game_id: gameId,
      display_name: form.name.trim() || gameId,
      steam_appid: form.steam_appid?.trim() || undefined,
      capabilities: [capabilityFromConversion(conversion) as any],
      multiplayer_conversion: {
        capability: (method === 'not_supported' ? 'official_only' : method === 'broadcast_bridge' ? 'lan_discovery_broadcast' : method === 'dedicated_server_launcher' ? 'hidden_dedicated_server' : 'native_lan_ip') as any,
        methods: [method as any],
        can_convert_to_lan: method !== 'not_supported',
        risk_level: method === 'not_supported' ? 'high' : method === 'port_proxy' ? 'medium' : 'low',
        notes: ['由最终参考前端方案编辑器保存。'],
        required_components: method === 'virtual_lan' ? ['n2n/radmin/manual_lan'] : [method]
      },
      network_type: networkTypeFromConversion(conversion) as any,
      connection_plan: {
        summary: `${form.name || gameId} 的本地共享联机方案。`,
        host_role: form.host_role || '房主启动游戏或服务端，并保持虚拟局域网在线。',
        join_role: form.join_role || '加入方进入同一虚拟局域网后连接房主虚拟 IP。',
        default_join_host: form.default_join_ip || '10.0.8.1',
        default_join_port: port,
        requires_virtual_lan: method !== 'not_supported',
        requires_tcp_port_proxy: method === 'port_proxy',
        requires_udp_broadcast_bridge: method === 'broadcast_bridge',
        requires_dedicated_server: method === 'dedicated_server_launcher',
        invite_template: (form.invite_template || '房主IP: {{host_ip}}\n端口: {{port}}').split(/\r?\n/).filter(Boolean),
        troubleshooting: ['如果无法加入，先确认双方虚拟 IP 互通，再检查游戏端口监听。']
      },
      adapter_source: 'custom',
      executables: [executable],
      default_ports: [port],
      launch_profiles: [
        { id: 'client', name: '启动游戏客户端', type: 'client', exe: executable, args: [] },
        { id: 'docs', name: '查看连接说明', type: 'docs' }
      ]
    };
    return saveGameAdapter(adapter);
  }, true);
}


