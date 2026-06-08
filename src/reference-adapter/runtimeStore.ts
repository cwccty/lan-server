import {
  generateDiagnosticReport,
  getN2nDiagnostics,
  getN2nLastConfig,
  listGameAdapters,
  listNetworkBackends,
  listPortProxies,
  listUdpBroadcastBridges,
  listUdpProxies,
  readServerSession,
  scanGames
} from '../api/tauri';
import { emptyReferenceRuntimeSnapshot, type ReferenceRuntimeSnapshot } from './types';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

function toUserFacingRuntimeError(error: unknown) {
  const raw = messageOf(error).replace(/\s+/g, ' ').trim();
  if (!raw) return '未知错误';

  if (/last_config\.json/i.test(raw) || /尚未保存\s*n2n\s*配置/i.test(raw)) {
    return '尚未保存组网服务配置，请先到“加入与组网”填写房间名、密钥和中继地址。';
  }

  return raw
    .replace(/期望配置文件[:：]\s*.*$/i, '请先到“加入与组网”保存配置。')
    .replace(/\bn2n\s+last\s+config\b/gi, '最近组网配置')
    .replace(/\bn2n\s+diagnostics\b/gi, '组网状态')
    .replace(/\bnetwork\s+backends\b/gi, '连接方式')
    .replace(/\bgame\s+scan\b/gi, '游戏扫描')
    .replace(/\bgame\s+adapters\b/gi, '游戏方案')
    .replace(/\bserver\s+session\b/gi, '游戏服务状态')
    .replace(/\bport\s+proxies\b/gi, '端口转发')
    .replace(/\budp\s+proxies\b/gi, 'UDP 转发')
    .replace(/\budp\s+broadcast\s+bridges\b/gi, '局域网发现辅助')
    .replace(/\bdiagnostic\s+report\b/gi, '诊断报告')
    .replace(/\bsupernode\b/gi, '中继地址')
    .replace(/\broom\b/gi, '房间名')
    .replace(/\bsecret\b/gi, '密钥')
    .replace(/\bn2n\b/gi, '组网服务')
    .replace(/\bedge\.exe\b/gi, '组网程序')
    .replace(/\bedge\b/gi, '组网程序');
}

async function collect<T>(errors: string[], label: string, task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch (error) {
    errors.push(`${label}: ${toUserFacingRuntimeError(error)}`);
    return fallback;
  }
}

export async function readReferenceRuntimeSnapshot(options: { includeDiagnostics?: boolean; includeInventory?: boolean } = {}): Promise<ReferenceRuntimeSnapshot> {
  const errors: string[] = [];
  const includeDiagnostics = options.includeDiagnostics ?? false;
  const includeInventory = options.includeInventory ?? false;

  const [n2n, n2nLastConfig, backends, games, adapters, serverSession, portProxies, udpProxies, udpBroadcastBridges, diagnosticReport] = await Promise.all([
    collect(errors, '组网状态', getN2nDiagnostics, null),
    collect(errors, '最近组网配置', getN2nLastConfig, null),
    includeInventory
      ? collect(errors, '连接方式', listNetworkBackends, [])
      : Promise.resolve([]),
    includeInventory
      ? collect(errors, '游戏扫描', scanGames, [])
      : Promise.resolve([]),
    includeInventory
      ? collect(errors, '游戏方案', listGameAdapters, [])
      : Promise.resolve([]),
    collect(errors, '游戏服务状态', readServerSession, null),
    collect(errors, '端口转发', listPortProxies, []),
    collect(errors, 'UDP 转发', listUdpProxies, []),
    collect(errors, '局域网发现辅助', listUdpBroadcastBridges, []),
    includeDiagnostics
      ? collect(errors, '诊断报告', generateDiagnosticReport, null)
      : Promise.resolve(null)
  ]);

  if (errors.length >= 7) {
    return emptyReferenceRuntimeSnapshot(errors);
  }

  return {
    source: errors.length > 0 ? 'unavailable' : 'tauri',
    loaded_at: new Date().toISOString(),
    n2n,
    n2n_last_config: n2nLastConfig,
    backends,
    games,
    adapters,
    server_session: serverSession,
    port_proxies: portProxies,
    udp_proxies: udpProxies,
    udp_broadcast_bridges: udpBroadcastBridges,
    diagnostic_report: diagnosticReport,
    errors
  };
}
