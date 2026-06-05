import type { AdapterRecommendationRoute, AdapterRouteKind } from './adapterRecommendationRoute';

export type ConnectionMethodId =
  | 'n2n'
  | 'wireguard'
  | 'zerotier'
  | 'tailscale'
  | 'tcp_proxy'
  | 'udp_proxy'
  | 'udp_broadcast_bridge'
  | 'steam_remote_play'
  | 'sunshine_moonlight'
  | 'steam_relay_plugin';

export interface ConnectionMethodEntry {
  id: ConnectionMethodId;
  title: string;
  shortLabel: string;
  status: '已接入' | '引导' | '预留';
  summary: string;
  whenToUse: string;
  userSteps: string[];
  advancedToolKind?: 'tcp' | 'udp' | 'bridge';
  routeKinds: AdapterRouteKind[];
}

export const connectionMethodCatalog: ConnectionMethodEntry[] = [
  {
    id: 'n2n',
    title: 'n2n 虚拟局域网',
    shortLabel: 'n2n',
    status: '已接入',
    summary: '当前主线组网方式。双方进入同一个房间后，游戏把虚拟 IP 当作局域网地址使用。',
    whenToUse: '原生 LAN、IP 直连、专用服务端、需要端口代理或 UDP 广播桥的游戏。',
    userSteps: ['在通用组网中心保存房间名、密钥和 Supernode', '启动 n2n 并等待 ACK/PONG', '好友使用邀请包一键加入'],
    routeKinds: ['virtual_lan', 'dedicated_server', 'udp_broadcast_bridge', 'tcp_port_proxy'],
  },
  {
    id: 'tcp_proxy',
    title: 'TCP 端口代理',
    shortLabel: 'TCP 代理',
    status: '已接入',
    summary: '把一个本地 TCP 监听端口转发到目标虚拟 IP 的游戏端口。',
    whenToUse: '游戏服务端只监听本机地址，或需要把特定 TCP 端口暴露给虚拟网。',
    userSteps: ['确认游戏实际 TCP 端口', '填写本地监听端口和目标虚拟 IP', '启动实例后做端口检测'],
    advancedToolKind: 'tcp',
    routeKinds: ['tcp_port_proxy'],
  },
  {
    id: 'udp_proxy',
    title: 'UDP 单播代理',
    shortLabel: 'UDP 代理',
    status: '已接入',
    summary: '把 UDP 单播数据转发到目标虚拟 IP 与端口。',
    whenToUse: '游戏使用 UDP 单播连接，但直连虚拟 IP 不稳定或端口需要转发。',
    userSteps: ['确认游戏 UDP 端口', '填写监听端口、目标虚拟 IP 和目标端口', '启动后观察包计数'],
    advancedToolKind: 'udp',
    routeKinds: ['tcp_port_proxy', 'udp_broadcast_bridge'],
  },
  {
    id: 'udp_broadcast_bridge',
    title: 'UDP 广播桥',
    shortLabel: '广播桥',
    status: '已接入',
    summary: '把局域网大厅发现用的 UDP 广播包转发到虚拟网目标。',
    whenToUse: '游戏支持 LAN 大厅，但好友在虚拟网内看不到房间列表。',
    userSteps: ['先确保 n2n 已连接', '确认游戏大厅发现 UDP 端口', '在高级工具创建广播桥并观察转发计数'],
    advancedToolKind: 'bridge',
    routeKinds: ['udp_broadcast_bridge'],
  },
  {
    id: 'wireguard',
    title: 'WireGuard 引导',
    shortLabel: 'WireGuard',
    status: '引导',
    summary: '更标准的 VPN 组网方式，适合有固定服务器、愿意配置密钥和路由的高级用户。',
    whenToUse: 'n2n 不适合、需要更强可控性，或管理员已经有 WireGuard 服务端。',
    userSteps: ['管理员创建 WireGuard 服务端和 peer', '给每个玩家分配独立地址', '游戏内连接房主 VPN 地址'],
    routeKinds: ['virtual_lan', 'dedicated_server'],
  },
  {
    id: 'zerotier',
    title: 'ZeroTier 引导',
    shortLabel: 'ZeroTier',
    status: '引导',
    summary: '第三方异地组网方案。客户端暂不内嵌，只提供何时该使用和如何配合游戏的说明。',
    whenToUse: '用户已经熟悉 ZeroTier，或不想自建 Supernode/VPS。',
    userSteps: ['创建 ZeroTier Network', '双方加入并授权成员', '游戏内连接房主 ZeroTier IP'],
    routeKinds: ['virtual_lan', 'dedicated_server'],
  },
  {
    id: 'tailscale',
    title: 'Tailscale 引导',
    shortLabel: 'Tailscale',
    status: '引导',
    summary: '基于 WireGuard 的托管组网方案，适合朋友之间快速加入同一个 tailnet。',
    whenToUse: '好友都有账号，且更希望使用现成托管网络而不是 n2n。',
    userSteps: ['双方登录同一 tailnet 或共享设备', '确认能互 ping Tailscale IP', '游戏内连接房主 Tailscale IP'],
    routeKinds: ['virtual_lan', 'dedicated_server'],
  },
  {
    id: 'steam_remote_play',
    title: 'Steam Remote Play Together',
    shortLabel: 'Remote Play',
    status: '引导',
    summary: '把本地同屏/本地合作游戏通过 Steam 串流给好友，好友输入会回传到房主电脑。',
    whenToUse: '游戏没有 LAN，只能本机同屏，例如本地双人合作游戏。',
    userSteps: ['房主启动游戏并进入本地双人模式', 'Steam 好友列表发起 Remote Play Together', '确认好友手柄/键鼠输入权限'],
    routeKinds: ['remote_coop'],
  },
  {
    id: 'sunshine_moonlight',
    title: 'Sunshine + Moonlight',
    shortLabel: 'Sunshine',
    status: '引导',
    summary: '开源串流方案。房主运行 Sunshine，好友用 Moonlight 连接并回传输入。',
    whenToUse: '非 Steam 版本、Remote Play 不稳定，或想更细致控制码率和延迟。',
    userSteps: ['房主安装并配置 Sunshine', '好友用 Moonlight 配对房主', '降低码率/分辨率以减少延迟'],
    routeKinds: ['remote_coop'],
  },
  {
    id: 'steam_relay_plugin',
    title: 'Steam Relay / Steam P2P 插件',
    shortLabel: 'Steam Relay',
    status: '预留',
    summary: '为只支持 Steam 大厅/P2P 的游戏预留插件化入口；当前先给出路线说明，不默认修改游戏。',
    whenToUse: '游戏没有 LAN，但原本有 Steam 大厅、好友邀请或 P2P 联机能力。',
    userSteps: ['保留游戏原生 Steam 邀请流程', '确认是否存在可用社区插件或官方接口', '后续在插件系统中接入 Steam Relay/P2P 适配'],
    routeKinds: ['steam_p2p'],
  },
];

export function methodsForAdapterRoute(route: AdapterRecommendationRoute) {
  const matched = connectionMethodCatalog.filter((method) => method.routeKinds.includes(route.kind));
  if (route.requiresTcpPortProxy && !matched.some((method) => method.id === 'tcp_proxy')) {
    matched.push(connectionMethodCatalog.find((method) => method.id === 'tcp_proxy')!);
  }
  if (route.requiresUdpBroadcastBridge && !matched.some((method) => method.id === 'udp_broadcast_bridge')) {
    matched.push(connectionMethodCatalog.find((method) => method.id === 'udp_broadcast_bridge')!);
  }
  if (route.requiresVirtualLan && !matched.some((method) => method.id === 'n2n')) {
    matched.unshift(connectionMethodCatalog.find((method) => method.id === 'n2n')!);
  }
  return matched.filter(Boolean);
}

export function buildConnectionMethodGuide(method: ConnectionMethodEntry) {
  return [
    `[联机助手联机方式说明] ${method.title}`,
    `状态：${method.status}`,
    '',
    '适用场景：',
    method.whenToUse,
    '',
    '原理摘要：',
    method.summary,
    '',
    '使用步骤：',
    ...method.userSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join('\n');
}
