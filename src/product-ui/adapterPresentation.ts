import type {
  ConversionMethod,
  GameAdapter,
  GameCapability,
  GameConnectionPlan,
  GameNetworkType,
  GameSummary,
  MultiplayerCapability,
  MultiplayerConversionProfile,
} from '../types/game';
import type { AdapterRegistrySyncResult } from '../api/tauri';

export type AdapterDisplayTarget = Pick<
  GameAdapter | GameSummary,
  | 'adapter_source'
  | 'adapter_version'
  | 'capabilities'
  | 'connection_plan'
  | 'description'
  | 'display_name'
  | 'game_id'
  | 'multiplayer_conversion'
  | 'network_type'
  | 'steam_appid'
> & {
  default_ports?: number[];
  detected_path?: string | null;
  executables?: string[];
  launch_profiles?: unknown[];
};

export type AdapterCategoryId =
  | 'native_lan'
  | 'dedicated_server'
  | 'bridge_or_proxy'
  | 'remote_coop'
  | 'steam_or_remote'
  | 'official_or_limited'
  | 'needs_review';

export interface AdapterCategoryInfo {
  id: AdapterCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  panelClass: string;
  iconBgClass: string;
}

const categoryInfo: Record<AdapterCategoryId, AdapterCategoryInfo> = {
  native_lan: {
    id: 'native_lan',
    label: '本地虚拟局域网',
    shortLabel: '虚拟局域网',
    description: '游戏支持 LAN 或 IP 直连，组好虚拟网后用房主虚拟 IP 加入。',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    panelClass: 'border-emerald-100 bg-emerald-50/60',
    iconBgClass: 'bg-emerald-500',
  },
  dedicated_server: {
    id: 'dedicated_server',
    label: '专用服务端',
    shortLabel: '服务端',
    description: '房主需要启动游戏服务端或内置开服程序，再让好友连接端口。',
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    panelClass: 'border-indigo-100 bg-indigo-50/60',
    iconBgClass: 'bg-indigo-500',
  },
  bridge_or_proxy: {
    id: 'bridge_or_proxy',
    label: '端口转发/广播桥',
    shortLabel: '桥接工具',
    description: '游戏不直接吃虚拟网，可能需要 TCP/UDP 端口代理或 UDP 广播桥。',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    panelClass: 'border-amber-100 bg-amber-50/60',
    iconBgClass: 'bg-amber-500',
  },
  remote_coop: {
    id: 'remote_coop',
    label: '远程同屏联机',
    shortLabel: '远程同屏',
    description: '游戏主要是本地同屏/本地合作，推荐 Steam Remote Play 或 Sunshine + Moonlight。',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    panelClass: 'border-violet-100 bg-violet-50/60',
    iconBgClass: 'bg-violet-500',
  },
  steam_or_remote: {
    id: 'steam_or_remote',
    label: 'Steam 大厅/远程入口',
    shortLabel: 'Steam/远程',
    description: '依赖 Steam 大厅、P2P、中继插件或远程同乐类入口，通常需要人工确认。',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    panelClass: 'border-sky-100 bg-sky-50/60',
    iconBgClass: 'bg-sky-500',
  },
  official_or_limited: {
    id: 'official_or_limited',
    label: '官方服/暂不支持',
    shortLabel: '受限',
    description: '当前适配器认为只能走官方服务或暂不适合转换为局域网。',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    panelClass: 'border-rose-100 bg-rose-50/60',
    iconBgClass: 'bg-rose-500',
  },
  needs_review: {
    id: 'needs_review',
    label: '待人工确认',
    shortLabel: '待确认',
    description: '缺少足够适配信息；建议先分析游戏日志、端口和联机入口。',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
    panelClass: 'border-slate-100 bg-slate-50/70',
    iconBgClass: 'bg-slate-500',
  },
};

export const adapterCategoryOrder: AdapterCategoryId[] = [
  'native_lan',
  'dedicated_server',
  'bridge_or_proxy',
  'remote_coop',
  'steam_or_remote',
  'official_or_limited',
  'needs_review',
];

export function getAdapterCategoryInfo(id: AdapterCategoryId) {
  return categoryInfo[id];
}

export function capabilityLabel(capability?: MultiplayerCapability | string) {
  const map: Record<string, string> = {
    native_lan_ip: '原生 LAN/IP 直连',
    hidden_dedicated_server: '可启动隐藏/内置服务端',
    lan_discovery_broadcast: '依赖局域网广播发现',
    tcp_udp_proxy_possible: '可尝试 TCP/UDP 代理',
    local_coop_remote_play: '本地同屏，适合远程同屏',
    steam_p2p_lobby: 'Steam 大厅/P2P',
    community_mod: '需要社区 Mod/补丁',
    official_only: '仅官方服务',
    unsupported: '暂不支持转换',
    unknown: '能力未知',
  };
  return capability ? map[capability] ?? capability : '未标注多人能力';
}

export function gameCapabilityLabel(capability: GameCapability | string) {
  const map: Record<string, string> = {
    lan: 'LAN',
    ip_join: 'IP 直连',
    dedicated_server: '专用服务端',
    steam_lobby: 'Steam 大厅',
    steam_p2p: 'Steam P2P',
    local_coop: '本地同屏',
    remote_play_together: 'Remote Play Together',
    official_server: '官方服',
    unknown: '未知',
  };
  return map[capability] ?? capability;
}

export function conversionMethodLabel(method?: ConversionMethod | string) {
  const map: Record<string, string> = {
    virtual_lan: '本地虚拟局域网',
    dedicated_server_launcher: '启动专用服务端',
    broadcast_bridge: 'UDP 广播桥',
    port_proxy: '端口转发/中继',
    mod_installer: '安装 Mod/补丁',
    steam_relay_plugin: 'Steam 大厅/远程同乐入口',
    steam_remote_play: 'Steam Remote Play',
    sunshine_moonlight: 'Sunshine + Moonlight',
    wireguard_guide: 'WireGuard 引导',
    zerotier_guide: 'ZeroTier 引导',
    tailscale_guide: 'Tailscale 引导',
    manual_guide: '人工步骤指南',
    not_supported: '暂不支持',
  };
  return method ? map[method] ?? method : '未指定';
}

export function networkTypeLabel(type?: GameNetworkType | string) {
  const map: Record<string, string> = {
    lan_ip_direct: '局域网/IP 直连',
    dedicated_server: '专用服务端',
    tcp_port_proxy_needed: '需要 TCP 端口代理',
    udp_broadcast_needed: '需要 UDP 广播桥',
    steam_lobby_direct_possible: 'Steam 大厅可直连',
    steam_relay_plugin: 'Steam 中继插件入口',
    local_coop_remote_play: '本地同屏远程联机',
    steam_p2p_only: '仅 Steam P2P/大厅',
    mod_required: '需要 Mod/补丁',
    official_only: '仅官方服',
    not_supported: '暂不支持',
    unknown_need_review: '待人工确认',
  };
  return type ? map[type] ?? type : '未标注';
}

export function sourceLabel(source?: string | null) {
  const map: Record<string, string> = {
    builtin: '内置方案',
    registry: '共享库',
    custom: '自建方案',
    steam_scan: 'Steam 扫描',
  };
  return source ? map[source] ?? source : '未知来源';
}

export function registryVersionLabel(syncResult?: AdapterRegistrySyncResult | null) {
  if (!syncResult) return 'Adapter Schema v1';
  const version = syncResult.registry_version ? `共享库 v${syncResult.registry_version}` : '共享库版本未标注';
  if (!syncResult.registry_updated_at) return version;
  return `${version} · ${formatRegistryDate(syncResult.registry_updated_at)}`;
}

export function adapterVersionLabel(item: AdapterDisplayTarget, syncResult?: AdapterRegistrySyncResult | null) {
  if (item.adapter_version) {
    const source = item.adapter_source === 'registry' ? registryVersionLabel(syncResult) : sourceLabel(item.adapter_source);
    return `Adapter v${item.adapter_version} · ${source}`;
  }
  if (item.adapter_source === 'registry') return registryVersionLabel(syncResult);
  if (item.adapter_source === 'steam_scan') return 'Steam 缓存映射';
  return 'Adapter Schema v1';
}

export function deriveAdapterCategory(item: AdapterDisplayTarget): AdapterCategoryInfo {
  const type = item.network_type;
  const capability = item.multiplayer_conversion?.capability;
  const methods = item.multiplayer_conversion?.methods ?? [];
  const capabilities = item.capabilities ?? [];
  const plan = item.connection_plan;

  if (type === 'official_only' || type === 'not_supported' || capability === 'official_only' || capability === 'unsupported') {
    return categoryInfo.official_or_limited;
  }
  if (
    type === 'local_coop_remote_play'
    || capability === 'local_coop_remote_play'
    || methods.includes('steam_remote_play')
    || methods.includes('sunshine_moonlight')
    || capabilities.includes('local_coop')
    || capabilities.includes('remote_play_together')
  ) {
    return categoryInfo.remote_coop;
  }
  if (
    type === 'steam_lobby_direct_possible'
    || type === 'steam_relay_plugin'
    || type === 'steam_p2p_only'
    || methods.includes('steam_relay_plugin')
    || capabilities.includes('steam_lobby')
    || capabilities.includes('steam_p2p')
  ) {
    return categoryInfo.steam_or_remote;
  }
  if (
    type === 'tcp_port_proxy_needed'
    || type === 'udp_broadcast_needed'
    || methods.includes('port_proxy')
    || methods.includes('broadcast_bridge')
    || capability === 'lan_discovery_broadcast'
    || capability === 'tcp_udp_proxy_possible'
    || plan?.requires_tcp_port_proxy
    || plan?.requires_udp_broadcast_bridge
  ) {
    return categoryInfo.bridge_or_proxy;
  }
  if (
    type === 'dedicated_server'
    || capabilities.includes('dedicated_server')
    || capability === 'hidden_dedicated_server'
    || methods.includes('dedicated_server_launcher')
    || plan?.requires_dedicated_server
  ) {
    return categoryInfo.dedicated_server;
  }
  if (
    type === 'lan_ip_direct'
    || capability === 'native_lan_ip'
    || capabilities.includes('lan')
    || capabilities.includes('ip_join')
    || methods.includes('virtual_lan')
  ) {
    return categoryInfo.native_lan;
  }
  return categoryInfo.needs_review;
}

export function conversionMethodsFor(item: AdapterDisplayTarget) {
  const explicit = item.multiplayer_conversion?.methods ?? [];
  if (explicit.length > 0) return explicit.map(conversionMethodLabel);

  if (item.network_type === 'dedicated_server') return ['启动专用服务端', '本地虚拟局域网'];
  if (item.network_type === 'tcp_port_proxy_needed') return ['端口转发/中继'];
  if (item.network_type === 'udp_broadcast_needed') return ['UDP 广播桥'];
  if (item.network_type === 'steam_lobby_direct_possible' || item.network_type === 'steam_relay_plugin') {
    return ['Steam 大厅/远程同乐入口'];
  }
  if (item.network_type === 'local_coop_remote_play' || item.capabilities.includes('local_coop')) {
    return ['Steam Remote Play', 'Sunshine + Moonlight'];
  }
  if (item.capabilities.includes('lan') || item.capabilities.includes('ip_join')) return ['本地虚拟局域网'];
  return ['人工步骤指南'];
}

export function multiplayerSummary(item: AdapterDisplayTarget) {
  const conversion = item.multiplayer_conversion;
  if (!conversion) {
    if (item.capabilities.includes('local_coop') || item.capabilities.includes('remote_play_together')) return '本地同屏游戏，推荐远程同屏联机';
    if (item.capabilities.includes('lan') || item.capabilities.includes('ip_join')) return '可按 LAN/IP 直连方案尝试';
    if (item.capabilities.includes('official_server')) return '偏官方服务器流程';
    return '尚未沉淀完整多人能力';
  }
  const capability = capabilityLabel(conversion.capability);
  if (conversion.can_convert_to_lan) return `${capability}，可转换为局域网体验`;
  return `${capability}，需要保留原联机入口或人工确认`;
}

export function buildApplicabilityList(item: AdapterDisplayTarget, limit = 4) {
  const plan = item.connection_plan;
  const conversion = item.multiplayer_conversion;
  const conditions: string[] = [];

  pushUnique(conditions, conditionFromNetworkType(item.network_type));
  if (plan?.requires_virtual_lan || conversion?.methods.includes('virtual_lan')) {
    pushUnique(conditions, '双方需要进入同一虚拟局域网，使用房主虚拟 IP。');
  }
  if (plan?.requires_dedicated_server || conversion?.methods.includes('dedicated_server_launcher')) {
    pushUnique(conditions, '房主需要启动游戏服务端或保持游戏房间在线。');
  }
  if (plan?.requires_tcp_port_proxy || conversion?.methods.includes('port_proxy')) {
    pushUnique(conditions, '如游戏只监听本地地址，需要启用 TCP/UDP 端口代理。');
  }
  if (plan?.requires_udp_broadcast_bridge || conversion?.methods.includes('broadcast_bridge')) {
    pushUnique(conditions, '如游戏依赖 LAN 自动发现，需要启用 UDP 广播桥。');
  }
  if (item.default_ports?.length) {
    pushUnique(conditions, `优先检查端口：${item.default_ports.slice(0, 4).join(', ')}。`);
  } else if (plan?.default_join_port) {
    pushUnique(conditions, `默认加入端口：${plan.default_join_port}。`);
  }
  if (conversion?.required_components?.length) {
    pushUnique(conditions, `需要组件：${conversion.required_components.slice(0, 3).join('、')}。`);
  }
  if ('detected_path' in item) {
    pushUnique(
      conditions,
      item.detected_path
        ? '已检测到安装路径，可直接进入分析或推荐。'
        : '未检测到安装路径，仍可基于 adapter 查看方案。',
    );
  }

  if (conditions.length === 0) conditions.push('适用条件未完整标注，建议先做真实分析。');
  return conditions.filter(Boolean).slice(0, limit);
}

export function summarizeAdapterInventory<T extends AdapterDisplayTarget>(items: T[]) {
  const counts = adapterCategoryOrder.map((id) => ({
    ...categoryInfo[id],
    count: 0,
  }));
  let convertible = 0;
  let needsReview = 0;
  let registry = 0;

  for (const item of items) {
    const category = deriveAdapterCategory(item);
    const count = counts.find((entry) => entry.id === category.id);
    if (count) count.count += 1;
    if (item.multiplayer_conversion?.can_convert_to_lan || item.capabilities.includes('lan') || item.capabilities.includes('ip_join')) {
      convertible += 1;
    }
    if (category.id === 'needs_review') needsReview += 1;
    if (item.adapter_source === 'registry') registry += 1;
  }

  return {
    counts,
    convertible,
    needsReview,
    registry,
    total: items.length,
  };
}

export function compactPlanSummary(plan?: GameConnectionPlan | null) {
  if (!plan) return '尚未沉淀连接方案摘要。';
  return plan.summary || '已提供连接方案，但缺少摘要。';
}

function conditionFromNetworkType(type?: GameNetworkType | string) {
  const map: Record<string, string> = {
    lan_ip_direct: '游戏内需要支持 LAN 或 Join via IP。',
    dedicated_server: '适合有服务端程序或房主可开服的游戏。',
    tcp_port_proxy_needed: '适合服务端端口可监听，但需要代理暴露给虚拟网的游戏。',
    udp_broadcast_needed: '适合依赖局域网房间发现、但可通过广播桥补齐的游戏。',
    steam_lobby_direct_possible: '适合保留 Steam 大厅入口，再配合直连或中继验证。',
    steam_relay_plugin: '适合 Steam 大厅、P2P 或远程同乐类入口，需插件/人工确认。',
    local_coop_remote_play: '适合本地同屏/本地合作游戏，不强行转换为 LAN。',
    steam_p2p_only: '适合保留 Steam 大厅/P2P 流程，必要时研究 Steam Relay 插件。',
    mod_required: '适合存在稳定社区 Mod 或补丁的游戏。',
    official_only: '当前只建议官方服务器或官方大厅流程。',
    not_supported: '当前版本不建议转换为局域网。',
    unknown_need_review: '需要人工确认端口、日志和游戏内联机入口。',
  };
  return type ? map[type] ?? '' : '';
}

function pushUnique(values: string[], value?: string | null) {
  const normalized = value?.trim();
  if (normalized && !values.includes(normalized)) values.push(normalized);
}

function formatRegistryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}
