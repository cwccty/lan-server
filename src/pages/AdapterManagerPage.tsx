import { useEffect, useMemo, useState } from 'react';
import {
  exportGameAdapterJson,
  importGameAdapterJson,
  listGameAdapters,
  saveGameAdapter,
  syncAdapterRegistry,
  syncLocalAdapterRegistryExample,
  type AdapterRegistrySyncResult
} from '../api/tauri';
import { LoadingOverlay } from '../components/LoadingOverlay';
import type { ConversionMethod, GameAdapter, GameCapability, GameNetworkType, MultiplayerCapability } from '../types/game';

const capabilityOptions: Array<[MultiplayerCapability, string]> = [
  ['native_lan_ip', '原生 LAN/IP 直连'],
  ['hidden_dedicated_server', '隐藏/独立服务端'],
  ['lan_discovery_broadcast', '局域网广播发现'],
  ['tcp_udp_proxy_possible', '可尝试端口代理'],
  ['local_coop_remote_play', '本地同屏远程联机'],
  ['steam_p2p_lobby', 'Steam 大厅/P2P'],
  ['community_mod', '社区 Mod 联机'],
  ['official_only', '仅官方/平台联机'],
  ['unsupported', '暂不支持转换'],
  ['unknown', '未知，需人工适配']
];

const methodOptions: Array<[ConversionMethod, string]> = [
  ['virtual_lan', '虚拟局域网'],
  ['dedicated_server_launcher', '服务端启动器'],
  ['broadcast_bridge', '广播桥'],
  ['port_proxy', '端口代理'],
  ['mod_installer', 'Mod 安装器'],
  ['steam_relay_plugin', 'Steam Relay 插件'],
  ['steam_remote_play', 'Steam Remote Play'],
  ['sunshine_moonlight', 'Sunshine + Moonlight'],
  ['wireguard_guide', 'WireGuard 引导'],
  ['zerotier_guide', 'ZeroTier 引导'],
  ['tailscale_guide', 'Tailscale 引导'],
  ['manual_guide', '手动说明'],
  ['not_supported', '不支持']
];

const networkTypeOptions: Array<[GameNetworkType, string]> = [
  ['lan_ip_direct', 'LAN/IP 直连'],
  ['dedicated_server', '专用服务端'],
  ['tcp_port_proxy_needed', '需要 TCP 端口代理'],
  ['udp_broadcast_needed', '需要 UDP 广播桥'],
  ['steam_lobby_direct_possible', 'Steam Lobby 发现但可直连'],
  ['steam_relay_plugin', 'Steam Relay 插件'],
  ['steam_p2p_only', '仅 Steam 大厅/P2P'],
  ['local_coop_remote_play', '本地同屏远程联机'],
  ['mod_required', '需要 Mod'],
  ['official_only', '仅官方/平台联机'],
  ['not_supported', '暂不支持'],
  ['unknown_need_review', '未知，需管理员判断']
];

const sourceLabels: Record<string, string> = {
  builtin: '内置',
  registry: '共享库',
  custom: '本地自定义',
  steam_scan: 'Steam 扫描'
};

const DEFAULT_ADAPTER_REGISTRY_URL = 'https://raw.githubusercontent.com/cwccty/lan-server/master/adapter-registry/index.json';
const LEGACY_LOCAL_REGISTRY_URL = 'http://127.0.0.1:8088/adapter-registry/index.json';
const REGISTRY_URL_STORAGE_KEY = 'lan-helper-adapter-registry-url';
const REGISTRY_LAST_SYNC_STORAGE_KEY = 'lan-helper-adapter-registry-last-sync';
const ADAPTER_MANAGER_VERSION = 'adapter-manager-2026-06-03-registry-sync-details';

const registrySyncStatusLabels: Record<string, string> = {
  created: '新增',
  updated: '更新',
  skipped_fetch_failed: '读取失败',
  skipped_hash_failed: 'Hash 失败',
  skipped_parse_failed: '解析失败',
  skipped_validation_failed: '校验失败',
  skipped_write_failed: '写入失败'
};

function shortHash(value?: string | null) {
  if (!value) return '-';
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

const templates: Record<string, Pick<GameAdapter, 'capabilities' | 'default_ports' | 'multiplayer_conversion' | 'launch_profiles' | 'network_type' | 'connection_plan'>> = {
  native_lan_ip: {
    capabilities: ['lan', 'ip_join'],
    default_ports: [],
    launch_profiles: [{ id: 'docs', name: '查看连接说明', type: 'docs' }],
    multiplayer_conversion: {
      capability: 'native_lan_ip',
      methods: ['virtual_lan', 'manual_guide'],
      can_convert_to_lan: true,
      risk_level: 'low',
      notes: ['该游戏原生支持 LAN 或 IP 直连。', '联机助手负责组网、邀请信息和连通性诊断。'],
      required_components: ['n2n/Radmin/已有局域网', '游戏内 LAN/IP 加入']
    },
    network_type: 'lan_ip_direct',
    connection_plan: {
      summary: '先完成通用组网，再在游戏内使用 LAN/IP 加入房主虚拟 IP。',
      host_role: '房主创建局域网房间或主机。',
      join_role: '加入者连接房主虚拟 IP 和游戏端口。',
      default_join_host: '房主虚拟 IP',
      default_join_port: undefined,
      requires_virtual_lan: true,
      requires_tcp_port_proxy: false,
      requires_udp_broadcast_bridge: false,
      requires_dedicated_server: false,
      invite_template: ['进入同一 n2n/Radmin 网络。', '在游戏内选择 LAN/IP 加入。', '连接房主虚拟 IP 和实际端口。'],
      troubleshooting: ['先确认双方虚拟 IP 可达。', '再确认游戏房间或端口已开启。']
    }
  },
  dedicated_server: {
    capabilities: ['lan', 'ip_join', 'dedicated_server'],
    default_ports: [],
    launch_profiles: [{ id: 'docs', name: '查看连接说明', type: 'docs' }],
    multiplayer_conversion: {
      capability: 'hidden_dedicated_server',
      methods: ['virtual_lan', 'dedicated_server_launcher', 'manual_guide'],
      can_convert_to_lan: true,
      risk_level: 'low',
      notes: ['该游戏支持独立服务端或可由服务端启动器承接。', '组网成功后，加入方连接房主虚拟 IP 和游戏端口。'],
      required_components: ['n2n/Radmin/已有局域网', '本地服务端', '游戏端口']
    },
    network_type: 'dedicated_server',
    connection_plan: {
      summary: '房主启动本地/专用服务端，加入者通过虚拟 IP 和端口连接。',
      host_role: '房主启动服务端并保持运行。',
      join_role: '加入者连接房主虚拟 IP:端口。',
      default_join_host: '房主虚拟 IP',
      default_join_port: undefined,
      requires_virtual_lan: true,
      requires_tcp_port_proxy: false,
      requires_udp_broadcast_bridge: false,
      requires_dedicated_server: true,
      invite_template: ['房主先启动服务端。', '双方进入同一虚拟局域网。', '加入者连接房主虚拟 IP:端口。'],
      troubleshooting: ['确认 127.0.0.1:端口可达。', '确认房主虚拟 IP:端口可达。', '必要时启用 TCP 端口代理。']
    }
  },
  official_only: {
    capabilities: ['official_server'],
    default_ports: [],
    launch_profiles: [{ id: 'docs', name: '查看连接说明', type: 'docs' }],
    multiplayer_conversion: {
      capability: 'official_only',
      methods: ['steam_relay_plugin', 'manual_guide'],
      can_convert_to_lan: false,
      risk_level: 'high',
      notes: ['该游戏当前只识别到官方/平台联机能力。', '不能承诺转换为本地联机；未来可研究平台网络插件。'],
      required_components: ['官方联机', '未来平台网络插件']
    },
    network_type: 'official_only',
    connection_plan: {
      summary: '当前只承诺官方/平台联机，不承诺转换为本地局域网。',
      host_role: '使用游戏官方房间或平台邀请。',
      join_role: '通过官方/平台方式加入。',
      default_join_host: undefined,
      default_join_port: undefined,
      requires_virtual_lan: false,
      requires_tcp_port_proxy: false,
      requires_udp_broadcast_bridge: false,
      requires_dedicated_server: false,
      invite_template: ['使用官方联机入口。'],
      troubleshooting: ['联机助手暂不承诺该游戏可转换成本地联机。']
    }
  }
};

const networkTypeTemplateIds: Record<GameNetworkType, keyof typeof templates | 'tcp_port_proxy_needed' | 'udp_broadcast_needed' | 'steam_relay_plugin' | 'steam_p2p_only' | 'local_coop_remote_play' | 'mod_required' | 'not_supported' | 'unknown_need_review' | 'steam_lobby_direct_possible'> = {
  lan_ip_direct: 'native_lan_ip',
  dedicated_server: 'dedicated_server',
  tcp_port_proxy_needed: 'tcp_port_proxy_needed',
  udp_broadcast_needed: 'udp_broadcast_needed',
  steam_lobby_direct_possible: 'steam_lobby_direct_possible',
  steam_relay_plugin: 'steam_relay_plugin',
  steam_p2p_only: 'steam_p2p_only',
  local_coop_remote_play: 'local_coop_remote_play',
  mod_required: 'mod_required',
  official_only: 'official_only',
  not_supported: 'not_supported',
  unknown_need_review: 'unknown_need_review'
};

function templateForNetworkType(type: GameNetworkType): Pick<GameAdapter, 'capabilities' | 'default_ports' | 'multiplayer_conversion' | 'launch_profiles' | 'network_type' | 'connection_plan'> {
  if (networkTypeTemplateIds[type] in templates) {
    return templates[networkTypeTemplateIds[type] as keyof typeof templates];
  }
  const docs = [{ id: 'docs', name: '查看连接说明', type: 'docs' as const }];
  if (type === 'tcp_port_proxy_needed') {
    return {
      capabilities: ['lan', 'ip_join'],
      default_ports: [],
      launch_profiles: docs,
      multiplayer_conversion: {
        capability: 'tcp_udp_proxy_possible',
        methods: ['virtual_lan', 'port_proxy', 'manual_guide'],
        can_convert_to_lan: true,
        risk_level: 'medium',
        notes: ['该游戏可能需要端口代理才能让朋友访问房主本机服务。', '优先确认游戏是否支持直接 IP/端口加入。'],
        required_components: ['n2n/Radmin/已有局域网', 'TCP 端口代理', '游戏端口']
      },
      network_type: 'tcp_port_proxy_needed',
      connection_plan: {
        summary: '房主启动游戏后，再启动 TCP 端口代理，把虚拟 IP 端口转发到本机游戏端口。',
        host_role: '房主先启动游戏房间/服务端，再在通用组网中心启动 TCP 端口代理。',
        join_role: '加入者连接房主虚拟 IP 和代理监听端口。',
        default_join_host: '房主虚拟 IP',
        default_join_port: undefined,
        requires_virtual_lan: true,
        requires_tcp_port_proxy: true,
        requires_udp_broadcast_bridge: false,
        requires_dedicated_server: false,
        invite_template: ['双方进入同一虚拟局域网。', '房主启动 TCP 端口代理。', '加入者连接房主虚拟 IP:代理端口。'],
        troubleshooting: ['确认 TCP 代理自测通过。', '确认目标游戏端口在房主本机可达。']
      }
    };
  }
  if (type === 'udp_broadcast_needed') {
    return {
      capabilities: ['lan'],
      default_ports: [],
      launch_profiles: docs,
      multiplayer_conversion: {
        capability: 'lan_discovery_broadcast',
        methods: ['virtual_lan', 'broadcast_bridge', 'manual_guide'],
        can_convert_to_lan: true,
        risk_level: 'medium',
        notes: ['该游戏依赖 LAN 广播/组播发现房间。', '组网已通但列表看不到房间时，需要 UDP 广播桥辅助发现。'],
        required_components: ['n2n/Radmin/已有局域网', 'UDP 广播桥', '游戏发现端口']
      },
      network_type: 'udp_broadcast_needed',
      connection_plan: {
        summary: '先完成通用组网；如果游戏房间列表看不到房主，启动 UDP 广播桥转发发现包。',
        host_role: '房主创建 LAN 房间，并按游戏发现端口启动 UDP 广播桥。',
        join_role: '加入者进入同一虚拟局域网，在游戏 LAN 列表中查找房间；若支持 IP 直连则优先直连。',
        default_join_host: '房主虚拟 IP',
        default_join_port: undefined,
        requires_virtual_lan: true,
        requires_tcp_port_proxy: false,
        requires_udp_broadcast_bridge: true,
        requires_dedicated_server: false,
        invite_template: ['双方进入同一虚拟局域网。', '房主启动 UDP 广播桥。', '加入者刷新 LAN 房间列表或尝试 IP 直连。'],
        troubleshooting: ['广播桥只辅助发现房间，不保证加入成功。', '如果游戏支持 IP 直连，优先连接房主虚拟 IP。']
      }
    };
  }
  if (type === 'steam_lobby_direct_possible') {
    return {
      capabilities: ['steam_lobby', 'ip_join'],
      default_ports: [],
      launch_profiles: docs,
      multiplayer_conversion: {
        capability: 'native_lan_ip',
        methods: ['virtual_lan', 'manual_guide', 'steam_relay_plugin'],
        can_convert_to_lan: true,
        risk_level: 'medium',
        notes: ['Steam Lobby 可用于发现/邀请，但仍可能支持 IP 直连。', '优先验证虚拟 IP 是否能加入。'],
        required_components: ['Steam Lobby/游戏内邀请', 'n2n/Radmin/已有局域网']
      },
      network_type: 'steam_lobby_direct_possible',
      connection_plan: {
        summary: '保留 Steam Lobby 发现/邀请，同时优先验证是否可通过房主虚拟 IP 直连。',
        host_role: '房主按游戏内 Steam/LAN 流程创建房间，并记录端口或直连入口。',
        join_role: '加入者可尝试 Steam 邀请或连接房主虚拟 IP。',
        default_join_host: '房主虚拟 IP',
        default_join_port: undefined,
        requires_virtual_lan: true,
        requires_tcp_port_proxy: false,
        requires_udp_broadcast_bridge: false,
        requires_dedicated_server: false,
        invite_template: ['先尝试游戏内 Steam/LAN 邀请。', '失败时尝试房主虚拟 IP 直连。'],
        troubleshooting: ['确认游戏是否允许直接 IP 加入。', '涉及 Steam/反作弊时不要绕过官方验证。']
      }
    };
  }
  if (type === 'steam_relay_plugin') {
    return {
      capabilities: ['steam_lobby', 'steam_p2p'],
      default_ports: [],
      launch_profiles: docs,
      multiplayer_conversion: {
        capability: 'official_only',
        methods: ['steam_relay_plugin', 'manual_guide'],
        can_convert_to_lan: false,
        risk_level: 'high',
        notes: ['该游戏可能需要 Steam Networking/Relay 插件路线。', '当前只是预留入口，暂不可直接使用。'],
        required_components: ['Steamworks/Steam Networking 插件', '官方平台能力']
      },
      network_type: 'steam_relay_plugin',
      connection_plan: {
        summary: '当前只作为 Steam Relay 插件研究入口，不作为默认可用联机方案。',
        host_role: '使用官方/Steam 房间，或等待后续插件方案。',
        join_role: '通过官方/Steam 方式加入。',
        default_join_host: undefined,
        default_join_port: undefined,
        requires_virtual_lan: false,
        requires_tcp_port_proxy: false,
        requires_udp_broadcast_bridge: false,
        requires_dedicated_server: false,
        invite_template: ['当前不承诺本地联机转换。'],
        troubleshooting: ['需要官方 Steamworks/Networking SDK 或用户自有 AppID。']
      }
    };
  }
  if (type === 'steam_p2p_only') {
    return {
      capabilities: ['steam_lobby', 'steam_p2p'],
      default_ports: [],
      launch_profiles: docs,
      multiplayer_conversion: {
        capability: 'steam_p2p_lobby',
        methods: ['steam_relay_plugin', 'manual_guide'],
        can_convert_to_lan: false,
        risk_level: 'medium',
        notes: ['该游戏主要依赖 Steam Lobby/P2P。', '优先使用官方 Steam 邀请；插件路线需要人工确认。'],
        required_components: ['Steam 好友邀请/大厅', '可选 Steam Relay 插件']
      },
      network_type: 'steam_p2p_only',
      connection_plan: {
        summary: '保留 Steam 大厅/P2P 原流程，不承诺转换为 LAN。',
        host_role: '房主使用游戏内 Steam 大厅或好友邀请创建房间。',
        join_role: '加入者通过 Steam 邀请或官方大厅加入。',
        default_join_host: undefined,
        default_join_port: undefined,
        requires_virtual_lan: false,
        requires_tcp_port_proxy: false,
        requires_udp_broadcast_bridge: false,
        requires_dedicated_server: false,
        invite_template: ['优先使用 Steam 好友邀请或游戏官方大厅。'],
        troubleshooting: ['确认 Steam 在线状态和游戏版本一致。', '涉及反作弊或官方账号时保持官方流程。']
      }
    };
  }
  if (type === 'local_coop_remote_play') {
    return {
      capabilities: ['local_coop', 'remote_play_together'],
      default_ports: [],
      launch_profiles: docs,
      multiplayer_conversion: {
        capability: 'local_coop_remote_play',
        methods: ['steam_remote_play', 'sunshine_moonlight', 'manual_guide'],
        can_convert_to_lan: false,
        risk_level: 'low',
        notes: ['该游戏主要是本地同屏/本地合作。', '推荐 Steam Remote Play Together 或 Sunshine + Moonlight，不强行转换为 LAN。'],
        required_components: ['Steam Remote Play Together', 'Sunshine + Moonlight', '房主侧输入权限配置']
      },
      network_type: 'local_coop_remote_play',
      connection_plan: {
        summary: '房主启动本地同屏游戏，通过 Steam Remote Play Together 或 Sunshine + Moonlight 邀请好友。',
        host_role: '房主启动游戏并进入本地同屏模式，然后发起远程同屏邀请。',
        join_role: '加入者接受 Steam Remote Play 邀请，或使用 Moonlight 连接房主 Sunshine。',
        default_join_host: 'Steam Remote Play / Moonlight 会话',
        default_join_port: undefined,
        requires_virtual_lan: false,
        requires_tcp_port_proxy: false,
        requires_udp_broadcast_bridge: false,
        requires_dedicated_server: false,
        invite_template: ['房主启动本地同屏模式。', '通过 Steam Remote Play 或 Sunshine + Moonlight 邀请好友。', '确认好友输入权限。'],
        troubleshooting: ['检查远程同屏输入授权。', '串流延迟高时降低分辨率/码率。', '不要用 n2n 端口检测判断同屏游戏。']
      }
    };
  }
  if (type === 'mod_required') {
    return {
      capabilities: ['unknown'],
      default_ports: [],
      launch_profiles: docs,
      multiplayer_conversion: {
        capability: 'community_mod',
        methods: ['mod_installer', 'manual_guide'],
        can_convert_to_lan: false,
        risk_level: 'high',
        notes: ['该游戏可能需要社区 Mod 才能转换联机方式。', '当前不自动安装 Mod。'],
        required_components: ['社区 Mod', '人工确认风险']
      },
      network_type: 'mod_required',
      connection_plan: {
        summary: '需要社区 Mod 或额外补丁才可能转换联机方式；当前仅记录说明。',
        host_role: '按 Mod 文档配置房主环境。',
        join_role: '按 Mod 文档加入。',
        default_join_host: undefined,
        default_join_port: undefined,
        requires_virtual_lan: false,
        requires_tcp_port_proxy: false,
        requires_udp_broadcast_bridge: false,
        requires_dedicated_server: false,
        invite_template: ['请先阅读 Mod 文档并确认风险。'],
        troubleshooting: ['不要自动安装未知 Mod。', '注意版本、反作弊和账号风险。']
      }
    };
  }
  if (type === 'not_supported') {
    return {
      capabilities: ['unknown'],
      default_ports: [],
      launch_profiles: docs,
      multiplayer_conversion: {
        capability: 'unsupported',
        methods: ['not_supported'],
        can_convert_to_lan: false,
        risk_level: 'high',
        notes: ['已确认当前不支持转换成本地联机。'],
        required_components: ['无可用转换方案']
      },
      network_type: 'not_supported',
      connection_plan: {
        summary: '已确认当前暂不支持转换为本地/局域网联机。',
        host_role: '不提供房主流程。',
        join_role: '不提供加入流程。',
        default_join_host: undefined,
        default_join_port: undefined,
        requires_virtual_lan: false,
        requires_tcp_port_proxy: false,
        requires_udp_broadcast_bridge: false,
        requires_dedicated_server: false,
        invite_template: ['该游戏当前暂不支持。'],
        troubleshooting: ['不要给用户误导性联机步骤。']
      }
    };
  }
  return emptyAdapter();
}

function emptyAdapter(): GameAdapter {
  return {
    game_id: '',
    display_name: '',
    steam_appid: undefined,
    capabilities: ['unknown'],
    executables: [],
    default_ports: [],
    launch_profiles: [{ id: 'docs', name: '查看连接说明', type: 'docs' }],
    multiplayer_conversion: {
      capability: 'unknown',
      methods: ['manual_guide'],
      can_convert_to_lan: false,
      risk_level: 'high',
      notes: ['需要管理员或高级用户进一步确认。'],
      required_components: ['人工适配']
    },
    network_type: 'unknown_need_review',
    connection_plan: {
      summary: '尚未认定游戏联机类型，需要管理员或高级用户测试后沉淀方案。',
      host_role: '待确认。',
      join_role: '待确认。',
      default_join_host: '房主虚拟 IP',
      default_join_port: undefined,
      requires_virtual_lan: true,
      requires_tcp_port_proxy: false,
      requires_udp_broadcast_bridge: false,
      requires_dedicated_server: false,
      invite_template: ['该游戏尚未完成适配，请先人工确认联机方式。'],
      troubleshooting: ['确认游戏是否支持 LAN/IP/专用服务端/广播发现/Mod。']
    }
  };
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function csv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function registryFileName(gameId: string) {
  const safe = gameId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${safe || 'game'}.json`;
}

async function sha256Hex(content: string) {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function buildRegistrySubmitGuide(adapterJson: string) {
  const adapter = JSON.parse(adapterJson) as GameAdapter;
  const fileName = registryFileName(adapter.game_id);
  const adapterPath = `adapter-registry/games/${fileName}`;
  const hash = await sha256Hex(adapterJson.endsWith('\n') ? adapterJson : `${adapterJson}\n`);
  const indexEntry = {
    game_id: adapter.game_id,
    steam_appid: adapter.steam_appid ?? null,
    adapter_url: `games/${fileName}`,
    sha256: hash
  };
  return [
    '【共享适配器库提交说明】',
    '',
    `游戏：${adapter.display_name} (${adapter.game_id})`,
    `适配器文件：${adapterPath}`,
    `SHA256：${hash}`,
    '',
    '1. 把上方导出的 JSON 保存为：',
    adapterPath,
    '',
    '2. 在 adapter-registry/index.json 的 games 数组中加入或更新：',
    JSON.stringify(indexEntry, null, 2),
    '',
    '3. 提交到 GitHub 后，客户端可通过默认共享库地址同步：',
    DEFAULT_ADAPTER_REGISTRY_URL,
    '',
    '4. 审核前请确认：',
    '- 游戏身份、Steam AppID、exe 名准确。',
    '- network_type 和 connection_plan 已人工验证。',
    '- 没有误导性“一键联机”承诺。',
    '- 没有下载未知 exe、绕过正版验证、绕过反作弊或模拟官方账号服务。'
  ].join('\n');
}

export function AdapterManagerPage() {
  const [adapters, setAdapters] = useState<GameAdapter[]>([]);
  const [draft, setDraft] = useState<GameAdapter>(emptyAdapter());
  const [executablesText, setExecutablesText] = useState('');
  const [portsText, setPortsText] = useState('');
  const [notesText, setNotesText] = useState('需要管理员或高级用户进一步确认。');
  const [componentsText, setComponentsText] = useState('人工适配');
  const [inviteTemplateText, setInviteTemplateText] = useState('该游戏尚未完成适配，请先人工确认联机方式。');
  const [troubleshootingText, setTroubleshootingText] = useState('确认游戏是否支持 LAN/IP/专用服务端/广播发现/Mod。');
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [registrySubmitGuide, setRegistrySubmitGuide] = useState('');
  const [registryUrl, setRegistryUrl] = useState('');
  const [lastRegistrySync, setLastRegistrySync] = useState('');
  const [registryResult, setRegistryResult] = useState<AdapterRegistrySyncResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');

  const refresh = () => listGameAdapters().then(setAdapters).catch((error) => setMessage(String(error)));

  useEffect(() => {
    refresh();
    const savedUrl = window.localStorage.getItem(REGISTRY_URL_STORAGE_KEY);
    const nextUrl = !savedUrl || savedUrl === LEGACY_LOCAL_REGISTRY_URL ? DEFAULT_ADAPTER_REGISTRY_URL : savedUrl;
    setRegistryUrl(nextUrl);
    if (savedUrl !== nextUrl) {
      window.localStorage.setItem(REGISTRY_URL_STORAGE_KEY, nextUrl);
    }
    setLastRegistrySync(window.localStorage.getItem(REGISTRY_LAST_SYNC_STORAGE_KEY) ?? '');
  }, []);

  const adapterCount = useMemo(() => adapters.length, [adapters]);

  const syncDraftText = (next: GameAdapter) => {
    setDraft(next);
    setExecutablesText(next.executables.join('\n'));
    setPortsText(next.default_ports.join(','));
    setNotesText(next.multiplayer_conversion?.notes.join('\n') ?? '');
    setComponentsText(next.multiplayer_conversion?.required_components.join('\n') ?? '');
    setInviteTemplateText(next.connection_plan?.invite_template.join('\n') ?? '');
    setTroubleshootingText(next.connection_plan?.troubleshooting.join('\n') ?? '');
  };

  const applyTemplate = (id: keyof typeof templates) => {
    const template = templates[id];
    syncDraftText({ ...draft, ...template, multiplayer_conversion: { ...template.multiplayer_conversion! } });
  };

  const applyNetworkTypeTemplate = (type: GameNetworkType) => {
    const template = templateForNetworkType(type);
    syncDraftText({
      ...draft,
      ...template,
      game_id: draft.game_id,
      display_name: draft.display_name,
      steam_appid: draft.steam_appid,
      executables: draft.executables,
      default_ports: draft.default_ports.length > 0 ? draft.default_ports : template.default_ports,
      network_type: type,
      multiplayer_conversion: {
        ...template.multiplayer_conversion!,
        notes: [...template.multiplayer_conversion!.notes],
        required_components: [...template.multiplayer_conversion!.required_components],
        methods: [...template.multiplayer_conversion!.methods]
      },
      connection_plan: {
        ...template.connection_plan!,
        invite_template: [...template.connection_plan!.invite_template],
        troubleshooting: [...template.connection_plan!.troubleshooting]
      },
      launch_profiles: template.launch_profiles.map((profile) => ({ ...profile }))
    });
    setMessage(`已按“${networkTypeOptions.find(([value]) => value === type)?.[1] ?? type}”同步推荐模板；请继续确认端口、房主/加入者步骤后保存。`);
  };

  const save = async () => {
    setBusy(true);
    setBusyLabel('保存适配器');
    setMessage('');
    try {
      const next: GameAdapter = {
        ...draft,
        steam_appid: draft.steam_appid?.trim() || undefined,
        executables: lines(executablesText),
        default_ports: csv(portsText).map(Number).filter((item) => Number.isInteger(item) && item > 0),
        multiplayer_conversion: {
          ...(draft.multiplayer_conversion ?? emptyAdapter().multiplayer_conversion!),
          notes: lines(notesText),
          required_components: lines(componentsText)
        },
        connection_plan: {
          ...(draft.connection_plan ?? emptyAdapter().connection_plan!),
          invite_template: lines(inviteTemplateText),
          troubleshooting: lines(troubleshootingText)
        }
      };
      const saved = await saveGameAdapter(next);
      syncDraftText(saved);
      await refresh();
      setMessage(`已保存适配器：${saved.display_name}`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const importAdapter = async () => {
    setBusy(true);
    setBusyLabel('导入适配器');
    setMessage('');
    try {
      const saved = await importGameAdapterJson(importText);
      syncDraftText(saved);
      setImportText('');
      await refresh();
      setMessage(`已导入适配器：${saved.display_name}`);
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const exportAdapter = async (gameId: string) => {
    setBusy(true);
    setBusyLabel('导出适配器');
    setMessage('');
    try {
      const exported = await exportGameAdapterJson(gameId);
      setExportText(exported);
      setRegistrySubmitGuide(await buildRegistrySubmitGuide(exported));
      setMessage('已生成导出 JSON 和共享库提交说明，可复制给管理员或提交到 GitHub registry。');
    } catch (error) {
      setMessage(String(error));
      setRegistrySubmitGuide('');
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const finishRegistrySync = async (result: AdapterRegistrySyncResult, label: string) => {
    setRegistryResult(result);
    await refresh();
    const summary = `${new Date().toLocaleString()}：${label}，总计 ${result.total} 个，新增 ${result.created} 个，更新 ${result.updated} 个，跳过 ${result.skipped} 个。`;
    setLastRegistrySync(summary);
    window.localStorage.setItem(REGISTRY_LAST_SYNC_STORAGE_KEY, summary);
    setMessage(summary);
  };

  const syncRegistry = async (url = registryUrl) => {
    setBusy(true);
    setBusyLabel('同步共享方案库');
    setMessage('');
    setRegistryResult(null);
    try {
      const nextUrl = url.trim() || DEFAULT_ADAPTER_REGISTRY_URL;
      setRegistryUrl(nextUrl);
      window.localStorage.setItem(REGISTRY_URL_STORAGE_KEY, nextUrl);
      const result = await syncAdapterRegistry(nextUrl);
      await finishRegistrySync(result, '共享库同步完成');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const syncLocalExample = async () => {
    setBusy(true);
    setBusyLabel('同步本地示例库');
    setMessage('');
    setRegistryResult(null);
    try {
      const result = await syncLocalAdapterRegistryExample();
      await finishRegistrySync(result, '本地示例库同步完成');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
      setBusyLabel('');
    }
  };

  const oneClickUpdateSharedAdapters = () => {
    const url = registryUrl.trim();
    return syncRegistry(url || DEFAULT_ADAPTER_REGISTRY_URL);
  };

  const restoreDefaultRegistryUrl = () => {
    setRegistryUrl(DEFAULT_ADAPTER_REGISTRY_URL);
    window.localStorage.setItem(REGISTRY_URL_STORAGE_KEY, DEFAULT_ADAPTER_REGISTRY_URL);
    setMessage('已恢复 GitHub 默认共享库地址。');
  };

  const copyToClipboard = async (content: string, label: string) => {
    if (!content.trim()) {
      setMessage(`${label}失败：没有可复制的内容。`);
      return;
    }
    try {
      if (!navigator.clipboard) throw new Error('剪贴板不可用');
      await navigator.clipboard.writeText(content);
      setMessage(`${label}已复制。`);
    } catch (error) {
      setMessage(`${label}失败：${error instanceof Error ? error.message : String(error || '剪贴板不可用')}`);
    }
  };

  const conversion = draft.multiplayer_conversion ?? emptyAdapter().multiplayer_conversion!;

  return (
    <section className="page-stack library-page modern-content-page">
      <LoadingOverlay visible={busy} title={busyLabel ? `正在处理：${busyLabel}` : '正在处理'} message="正在更新适配器数据，请稍等，不要重复点击。" />
      <div className="content-hero library-hero"><div><span className="eyebrow">SOLUTION LIBRARY</span><h2>游戏方案库</h2><p className="muted">从共享库更新游戏联机方案。普通用户一般只需要点击“一键更新共享方案”。</p></div><div className="hero-mini-stats"><article><span>本地方案</span><strong>{adapterCount}</strong></article><article><span>上次同步</span><strong>{lastRegistrySync ? '已记录' : '未同步'}</strong></article></div></div>
      {message && <div className={busy ? 'busy-banner' : 'status-banner'}>{message}</div>}

      <article className="card content-panel sync-panel">
        <div className="panel-heading"><div><span className="eyebrow">SYNC</span><h3>共享游戏方案库</h3></div><span className="badge warn">真实同步</span></div>
        <p className="muted">
          从共享库拉取游戏联机方案。更新后，扫描游戏时会自动使用这些推荐步骤。
        </p>
        <div className="actions">
          <button disabled={busy} onClick={oneClickUpdateSharedAdapters}>一键更新共享方案</button>
          <button disabled={busy} onClick={syncLocalExample}>同步本地示例库（无需 HTTP）</button>
          <button disabled={busy} onClick={restoreDefaultRegistryUrl}>恢复 GitHub 默认地址</button>
        </div>
        <p className="muted">默认共享库地址：{DEFAULT_ADAPTER_REGISTRY_URL}</p>
        {lastRegistrySync && <p className="muted">上次同步：{lastRegistrySync}</p>}
        <p className="muted">
          默认会从公开共享库拉取游戏方案；如果只是离线测试项目内置示例，可以点击“同步本地示例库”。
        </p>
        <label>共享库地址
          <input
            value={registryUrl}
            onChange={(event) => setRegistryUrl(event.target.value)}
            placeholder="https://example.com/adapter-registry/index.json"
            disabled={busy}
          />
          <small className="muted">这个地址会自动保存；留空时会使用默认地址。</small>
        </label>
        <button disabled={busy} onClick={() => syncRegistry()}>同步共享方案库</button>
        {registryResult && (
          <div className={registryResult.ok ? 'result-ok' : 'result-bad'}>
            <h4>{registryResult.ok ? '同步成功' : '同步完成但有跳过项'}</h4>
            <div className="status-grid compact">
              <article className="status-tile"><span>索引总数</span><strong>{registryResult.total}</strong><small>共享库中的游戏</small></article>
              <article className="status-tile"><span>新增</span><strong>{registryResult.created}</strong><small>新增游戏方案</small></article>
              <article className="status-tile"><span>更新</span><strong>{registryResult.updated}</strong><small>更新已有方案</small></article>
              <article className="status-tile"><span>跳过</span><strong>{registryResult.skipped}</strong><small>未覆盖本地可用数据</small></article>
            </div>
            {registryResult.skipped > 0 && (
              <p className="muted">
                失败分类：读取 {registryResult.fetch_failed}，Hash {registryResult.hash_failed}，
                解析 {registryResult.parse_failed}，字段校验 {registryResult.validation_failed}，写入 {registryResult.write_failed}。
              </p>
            )}
            <p className="muted">来源：{registryResult.registry_url}</p>
            <table className="adapter-table registry-sync-table">
              <thead><tr><th>游戏</th><th>结果</th><th>原因</th><th>Hash</th><th>保存位置</th></tr></thead>
              <tbody>
                {registryResult.items.map((item) => (
                  <tr key={`${item.game_id}-${item.status}-${item.adapter_url}`}>
                    <td>{item.display_name || item.game_id}<br /><small className="muted">{item.game_id}</small></td>
                    <td><span className={`badge ${item.status.startsWith('skipped') ? 'source-custom' : 'source-registry'}`}>{registrySyncStatusLabels[item.status] ?? item.status}</span></td>
                    <td>{item.reason}<br /><small className="muted">{item.adapter_url}</small></td>
                    <td><small>期望：{shortHash(item.expected_sha256)}<br />实际：{shortHash(item.actual_sha256)}</small></td>
                    <td><small>{item.saved_path || '-'}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {registryResult.messages.length > 0 && (
              <details>
                <summary>原始同步日志</summary>
                <ul>
                  {registryResult.messages.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </article>

      <article className="card content-panel adapter-list-panel">
        <div className="panel-heading"><div><span className="eyebrow">LOCAL</span><h3>当前适配器（{adapterCount}）</h3></div><span className="badge">builtin / registry / custom</span></div>
        {adapters.length === 0 ? <p className="muted">暂无适配器。</p> : (
          <table className="adapter-table">
            <thead><tr><th>游戏</th><th>来源</th><th>AppID</th><th>游戏类型</th><th>能力</th><th>端口</th><th>操作</th></tr></thead>
            <tbody>
              {adapters.map((adapter) => (
                <tr key={adapter.game_id}>
                  <td>{adapter.display_name}<br /><small className="muted">{adapter.game_id}</small></td>
                  <td><span className={`badge source-${adapter.adapter_source ?? 'unknown'}`}>{sourceLabels[adapter.adapter_source ?? ''] ?? adapter.adapter_source ?? '未知'}</span></td>
                  <td>{adapter.steam_appid || '-'}</td>
                  <td>{adapter.network_type || 'unknown_need_review'}</td>
                  <td>{adapter.multiplayer_conversion?.capability || 'unknown'}</td>
                  <td>{adapter.default_ports.join(',') || '-'}</td>
                  <td>
                    <button disabled={busy} onClick={() => syncDraftText(adapter)}>编辑</button>
                    <button disabled={busy} onClick={() => exportAdapter(adapter.game_id)}>导出</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      <article className="card content-panel editor-panel">
        <div className="panel-heading"><div><span className="eyebrow">EDITOR</span><h3>新增 / 编辑适配器</h3></div><span className="badge warn">管理员功能</span></div>
        <div className="actions">
          <button disabled={busy} onClick={() => syncDraftText(emptyAdapter())}>新建空白</button>
          <button disabled={busy} onClick={() => applyTemplate('native_lan_ip')}>模板：原生 LAN/IP</button>
          <button disabled={busy} onClick={() => applyTemplate('dedicated_server')}>模板：Dedicated Server</button>
          <button disabled={busy} onClick={() => applyTemplate('official_only')}>模板：仅官方联机</button>
        </div>
        <label>游戏 ID<input value={draft.game_id} onChange={(event) => setDraft({ ...draft, game_id: event.target.value })} placeholder="例如 my_game" /></label>
        <label>显示名<input value={draft.display_name} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} /></label>
        <label>Steam AppID（可选）<input value={draft.steam_appid ?? ''} onChange={(event) => setDraft({ ...draft, steam_appid: event.target.value })} /></label>
        <label>可执行文件名，每行一个<textarea value={executablesText} onChange={(event) => setExecutablesText(event.target.value)} placeholder="Game.exe" /></label>
        <label>默认端口，逗号分隔<input value={portsText} onChange={(event) => setPortsText(event.target.value)} placeholder="7777,25565" /></label>
        <label>游戏网络类型 / 管理员认定
          <select value={draft.network_type ?? 'unknown_need_review'} onChange={(event) => applyNetworkTypeTemplate(event.target.value as GameNetworkType)}>
            {networkTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <small className="muted">选择后会自动同步 capabilities、转换方式和 connection_plan 需求，避免手动勾选错误；仍需人工确认端口和具体步骤。</small>
        </label>
        <div className="notice-card">
          <strong>当前认定结果：</strong>{draft.network_type ?? 'unknown_need_review'}。
          管理员认定后请检查下方“方案需求”和“房主/加入者步骤”，再保存为本地 custom adapter。
        </div>
        <label>连接方案摘要<input value={draft.connection_plan?.summary ?? ''} onChange={(event) => setDraft({ ...draft, connection_plan: { ...(draft.connection_plan ?? emptyAdapter().connection_plan!), summary: event.target.value } })} placeholder="例如：房主启动服务端，好友连接房主虚拟 IP:端口" /></label>
        <label>房主步骤<input value={draft.connection_plan?.host_role ?? ''} onChange={(event) => setDraft({ ...draft, connection_plan: { ...(draft.connection_plan ?? emptyAdapter().connection_plan!), host_role: event.target.value } })} /></label>
        <label>加入者步骤<input value={draft.connection_plan?.join_role ?? ''} onChange={(event) => setDraft({ ...draft, connection_plan: { ...(draft.connection_plan ?? emptyAdapter().connection_plan!), join_role: event.target.value } })} /></label>
        <label>默认加入主机<input value={draft.connection_plan?.default_join_host ?? ''} onChange={(event) => setDraft({ ...draft, connection_plan: { ...(draft.connection_plan ?? emptyAdapter().connection_plan!), default_join_host: event.target.value || undefined } })} placeholder="房主虚拟 IP" /></label>
        <label>默认加入端口<input value={draft.connection_plan?.default_join_port ?? ''} onChange={(event) => setDraft({ ...draft, connection_plan: { ...(draft.connection_plan ?? emptyAdapter().connection_plan!), default_join_port: Number(event.target.value) || undefined } })} placeholder="例如 7777" /></label>
        <label>方案需求
          <div className="filter-list">
            <label><input type="checkbox" checked={draft.connection_plan?.requires_virtual_lan ?? true} onChange={(event) => setDraft({ ...draft, connection_plan: { ...(draft.connection_plan ?? emptyAdapter().connection_plan!), requires_virtual_lan: event.target.checked } })} /> 虚拟局域网</label>
            <label><input type="checkbox" checked={draft.connection_plan?.requires_dedicated_server ?? false} onChange={(event) => setDraft({ ...draft, connection_plan: { ...(draft.connection_plan ?? emptyAdapter().connection_plan!), requires_dedicated_server: event.target.checked } })} /> 专用服务端</label>
            <label><input type="checkbox" checked={draft.connection_plan?.requires_tcp_port_proxy ?? false} onChange={(event) => setDraft({ ...draft, connection_plan: { ...(draft.connection_plan ?? emptyAdapter().connection_plan!), requires_tcp_port_proxy: event.target.checked } })} /> TCP 端口代理</label>
            <label><input type="checkbox" checked={draft.connection_plan?.requires_udp_broadcast_bridge ?? false} onChange={(event) => setDraft({ ...draft, connection_plan: { ...(draft.connection_plan ?? emptyAdapter().connection_plan!), requires_udp_broadcast_bridge: event.target.checked } })} /> UDP 广播桥</label>
          </div>
        </label>
        <label>联机能力类型
          <select value={conversion.capability} onChange={(event) => setDraft({ ...draft, multiplayer_conversion: { ...conversion, capability: event.target.value as MultiplayerCapability } })}>
            {capabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>转换方式
          <select multiple value={conversion.methods} onChange={(event) => setDraft({ ...draft, multiplayer_conversion: { ...conversion, methods: Array.from(event.target.selectedOptions).map((item) => item.value as ConversionMethod) } })}>
            {methodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <small className="muted">按住 Ctrl 可以多选。</small>
        </label>
        <label>是否可转换成本地联机
          <select value={String(conversion.can_convert_to_lan)} onChange={(event) => setDraft({ ...draft, multiplayer_conversion: { ...conversion, can_convert_to_lan: event.target.value === 'true' } })}>
            <option value="true">可转换</option>
            <option value="false">暂不承诺</option>
          </select>
        </label>
        <label>风险等级
          <select value={conversion.risk_level} onChange={(event) => setDraft({ ...draft, multiplayer_conversion: { ...conversion, risk_level: event.target.value as 'low' | 'medium' | 'high' } })}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <label>所需组件，每行一个<textarea value={componentsText} onChange={(event) => setComponentsText(event.target.value)} /></label>
        <label>判断说明，每行一条<textarea value={notesText} onChange={(event) => setNotesText(event.target.value)} /></label>
        <label>邀请模板，每行一条<textarea value={inviteTemplateText} onChange={(event) => setInviteTemplateText(event.target.value)} /></label>
        <label>排错建议，每行一条<textarea value={troubleshootingText} onChange={(event) => setTroubleshootingText(event.target.value)} /></label>
        <button disabled={busy} onClick={save}>保存到本地适配器库</button>
      </article>

      <article className="card content-panel io-panel">
        <div className="panel-heading"><div><span className="eyebrow">JSON</span><h3>导入 / 导出</h3></div><span className="badge">共享提交</span></div>
        <label>导入适配器 JSON<textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴别人导出的适配器 JSON" /></label>
        <button disabled={busy || !importText.trim()} onClick={importAdapter}>导入并保存</button>
        <label>导出结果<textarea readOnly value={exportText} placeholder="点击上方表格中的导出按钮后，这里会出现 JSON。" /></label>
        <button disabled={!exportText} onClick={() => copyToClipboard(exportText, '复制导出 JSON')}>复制导出 JSON</button>
        <label>共享库提交说明<textarea readOnly value={registrySubmitGuide} placeholder="导出适配器后，这里会生成 adapter-registry 路径、sha256 和 index.json 片段。" /></label>
        <div className="actions">
          <button disabled={!registrySubmitGuide} onClick={() => copyToClipboard(registrySubmitGuide, '复制共享库提交说明')}>复制共享库提交说明</button>
        </div>
      </article>
    </section>
  );
}
