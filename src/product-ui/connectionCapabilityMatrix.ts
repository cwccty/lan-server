import type { AdapterRouteKind } from './adapterRecommendationRoute';
import type { ConnectionMethodId } from './connectionMethodCatalog';
import type { GameNetworkType } from '../types/game';

export type CapabilityDecisionVerdict =
  | 'can_convert_to_lan'
  | 'can_connect_not_lan'
  | 'official_only'
  | 'needs_review';

export interface ConnectionCapabilityDecisionRow {
  id: string;
  gameType: string;
  capability: string;
  routeKind: AdapterRouteKind;
  verdict: CapabilityDecisionVerdict;
  verdictLabel: string;
  recommendedMethodIds: ConnectionMethodId[];
  userFacingResult: string;
  adapterSignals: string[];
  evidenceToCollect: string[];
  adapterFields: string[];
  adapterDefaults: ConnectionCapabilityAdapterDefaults;
  operatorDecision: string;
  riskNote: string;
}

export interface ConnectionCapabilityAdapterDefaults {
  networkType: GameNetworkType;
  canConvertToLan: boolean;
  defaultNotes: string[];
}

export const connectionCapabilityMatrix: ConnectionCapabilityDecisionRow[] = [
  {
    id: 'native-lan-ip-direct',
    gameType: '原生局域网 / IP 直连',
    capability: '游戏内可以输入 IP，或局域网房间能直接通过地址加入。',
    routeKind: 'virtual_lan',
    verdict: 'can_convert_to_lan',
    verdictLabel: '可转局域网',
    recommendedMethodIds: ['n2n', 'wireguard', 'zerotier', 'tailscale'],
    userFacingResult: '优先推荐通用组网，好友用房主联机地址和端口加入。',
    adapterSignals: ['capabilities: lan, ip_join', 'network_type: lan_ip_direct', 'methods: virtual_lan'],
    evidenceToCollect: ['游戏内直连入口截图', '默认端口', '房主/好友实际加入步骤'],
    adapterFields: ['default_ports', 'connection_plan.default_join_port', 'connection_plan.invite_template'],
    adapterDefaults: {
      networkType: 'lan_ip_direct',
      canConvertToLan: true,
      defaultNotes: [
        '游戏支持局域网或 IP 直连；优先使用通用组网。',
        '好友加入同一房间后，在游戏内连接房主联机地址和端口。',
      ],
    },
    operatorDecision: '可直接沉淀为普通用户一键开房方案。',
    riskNote: '如果游戏只显示大厅但不能手动输入 IP，可能应转到 UDP 广播桥分类。',
  },
  {
    id: 'dedicated-server',
    gameType: '专用服务端 / 内置开服',
    capability: '房主可以启动独立服务端、内置开服程序、bat/cmd/jar 服务端。',
    routeKind: 'dedicated_server',
    verdict: 'can_convert_to_lan',
    verdictLabel: '可转局域网',
    recommendedMethodIds: ['n2n', 'wireguard', 'zerotier', 'tailscale'],
    userFacingResult: '先组网，再启动服务端，好友连接房主联机地址和服务端端口。',
    adapterSignals: ['capabilities: dedicated_server', 'network_type: dedicated_server', 'requires_dedicated_server: true'],
    evidenceToCollect: ['服务端启动命令', '服务端监听端口', '稳定运行检测时间', '服务端日志关键行'],
    adapterFields: ['launch_profiles.server', 'connection_plan.host_role', 'connection_plan.troubleshooting'],
    adapterDefaults: {
      networkType: 'dedicated_server',
      canConvertToLan: true,
      defaultNotes: [
        '游戏支持专用服务端或内置开服；先组网，再启动服务端。',
        '好友连接房主联机地址和服务端端口；服务端窗口关闭会导致房间不可用。',
      ],
    },
    operatorDecision: '需要在推荐页开房向导中保留“启动服务端/检测端口”步骤。',
    riskNote: '服务端窗口退出、世界存档保存、端口未监听都应进入诊断页处理。',
  },
  {
    id: 'lan-discovery-broadcast',
    gameType: '局域网大厅发现 / UDP 广播',
    capability: '游戏有局域网大厅，但依赖广播发现，好友可能看不到房间列表。',
    routeKind: 'udp_broadcast_bridge',
    verdict: 'can_convert_to_lan',
    verdictLabel: '可转局域网，但需要桥接',
    recommendedMethodIds: ['n2n', 'udp_broadcast_bridge', 'udp_proxy'],
    userFacingResult: '先组网，再用 UDP 广播桥补齐大厅发现；必要时仍可连接房主联机地址。',
    adapterSignals: ['network_type: udp_broadcast_needed', 'methods: broadcast_bridge', 'requires_udp_broadcast_bridge: true'],
    evidenceToCollect: ['大厅发现 UDP 端口', '抓包/日志里的广播地址', '桥接目标联机地址列表'],
    adapterFields: ['connection_plan.requires_udp_broadcast_bridge', 'multiplayer_conversion.required_components', 'troubleshooting'],
    adapterDefaults: {
      networkType: 'udp_broadcast_needed',
      canConvertToLan: true,
      defaultNotes: [
        '游戏有局域网大厅，但可能依赖 UDP 广播发现；单独组网可能看不到房间。',
        '推荐通用组网 + UDP 广播桥；必要时仍让好友手动连接房主联机地址。',
      ],
    },
    operatorDecision: '不要只给通用组网；推荐页应提示进入高级工具配置 UDP 广播桥。',
    riskNote: '广播桥只能帮助发现/转发，不能解决官方服务器鉴权或 Steam 大厅限制。',
  },
  {
    id: 'port-proxy-needed',
    gameType: 'TCP/UDP 端口代理',
    capability: '游戏端口只监听本机或需要把特定端口开放给好友。',
    routeKind: 'tcp_port_proxy',
    verdict: 'can_convert_to_lan',
    verdictLabel: '可转局域网，但需要代理',
    recommendedMethodIds: ['n2n', 'tcp_proxy', 'udp_proxy'],
    userFacingResult: '先组网，再按端口代理规则把游戏监听端口代理给好友联机地址。',
    adapterSignals: ['network_type: tcp_port_proxy_needed', 'methods: port_proxy', 'requires_tcp_port_proxy: true'],
    evidenceToCollect: ['本机监听地址', 'TCP/UDP 协议类型', '目标联机地址', '代理测试结果'],
    adapterFields: ['connection_plan.requires_tcp_port_proxy', 'default_ports', 'route_flags'],
    adapterDefaults: {
      networkType: 'tcp_port_proxy_needed',
      canConvertToLan: true,
      defaultNotes: [
        '游戏端口可能只监听本机或指定地址；需要把端口代理到好友可达地址。',
        '推荐通用组网 + TCP/UDP 端口代理；保存前应确认协议、监听地址和默认端口。',
      ],
    },
    operatorDecision: '推荐页应显示端口代理路线，并把用户引导到高级连接工具。',
    riskNote: '代理配置错目标地址时会表现为“端口已开但好友仍连不上”。',
  },
  {
    id: 'local-coop-remote-play',
    gameType: '只能本地同屏',
    capability: '游戏没有局域网，也没有在线大厅，只支持同一台电脑上的本地双人/多人。',
    routeKind: 'remote_coop',
    verdict: 'can_connect_not_lan',
    verdictLabel: '可远程联机，但不是局域网',
    recommendedMethodIds: ['steam_remote_play', 'sunshine_moonlight'],
    userFacingResult: '不强行组网；推荐 Steam Remote Play Together，备用 Sunshine + Moonlight。',
    adapterSignals: ['capabilities: local_coop, remote_play_together', 'network_type: local_coop_remote_play', 'methods: steam_remote_play, sunshine_moonlight'],
    evidenceToCollect: ['是否支持本地双人输入', '是否为 Steam 版本', '手柄/键鼠输入权限', '可接受延迟'],
    adapterFields: ['multiplayer_conversion.can_convert_to_lan: false', 'connection_plan.host_role', 'remote_coop checklist'],
    adapterDefaults: {
      networkType: 'local_coop_remote_play',
      canConvertToLan: false,
      defaultNotes: [
        '游戏只能本地同屏，不能被转换成真正局域网；不要生成联机地址加入说明。',
        '推荐 Steam Remote Play Together，备用 Sunshine + Moonlight；重点检查串流质量和输入权限。',
      ],
    },
    operatorDecision: '保存游戏方案时必须写清“不要连接联机地址”，避免误导用户。',
    riskNote: '远程同屏依赖串流质量；它解决输入和画面共享，不会把游戏改成真正局域网。',
  },
  {
    id: 'steam-p2p-lobby',
    gameType: 'Steam 大厅 / Steam P2P',
    capability: '游戏没有局域网入口，但有 Steam 好友邀请、大厅或 P2P 联机。',
    routeKind: 'steam_p2p',
    verdict: 'can_connect_not_lan',
    verdictLabel: '可联机，但不默认转局域网',
    recommendedMethodIds: ['steam_relay_plugin'],
    userFacingResult: '保留 Steam 原生流程；Steam Relay / P2P 插件仅作为未来插件化入口。',
    adapterSignals: ['capabilities: steam_lobby, steam_p2p', 'network_type: steam_p2p_only 或 steam_relay_plugin', 'methods: steam_relay_plugin'],
    evidenceToCollect: ['Steam 好友邀请是否可用', '是否有反作弊/官方账号限制', '是否存在社区插件'],
    adapterFields: ['steam_appid', 'connection_plan.invite_template', 'risk_level'],
    adapterDefaults: {
      networkType: 'steam_p2p_only',
      canConvertToLan: false,
      defaultNotes: [
        '游戏主要依赖 Steam 大厅或 Steam P2P；默认不推荐强行转换成局域网。',
        '优先保留 Steam 原生邀请；Steam Relay / P2P 插件只作为人工确认后的未来入口。',
      ],
    },
    operatorDecision: '不要默认推荐通用组网；需要管理员确认插件边界和用户风险。',
    riskNote: '涉及 Steamworks、反作弊或账号鉴权时，优先保留官方/原生流程。',
  },
  {
    id: 'official-only',
    gameType: '官方服务器限定',
    capability: '游戏多人依赖官方服务器、官方账号、匹配系统或不可替代的后端鉴权。',
    routeKind: 'official_only',
    verdict: 'official_only',
    verdictLabel: '不建议转换',
    recommendedMethodIds: [],
    userFacingResult: '告诉用户不要强转局域网，只保留官方入口和限制说明。',
    adapterSignals: ['network_type: official_only 或 not_supported', 'capability: official_only 或 unsupported', 'methods: not_supported'],
    evidenceToCollect: ['官方服务器/账号依赖说明', '是否无直连/无局域网/无本地同屏', '转换失败证据'],
    adapterFields: ['multiplayer_conversion.can_convert_to_lan: false', 'notes', 'troubleshooting'],
    adapterDefaults: {
      networkType: 'official_only',
      canConvertToLan: false,
      defaultNotes: [
        '游戏多人依赖官方服务器、账号或匹配后端；不建议转换成局域网。',
        '向用户解释限制，保留官方入口；不要生成局域网邀请包或联机地址连接步骤。',
      ],
    },
    operatorDecision: '高可信也不代表可转换；目标是避免用户浪费时间配置错误方案。',
    riskNote: '不要承诺私服、破解或绕过官方服务，除非后续有合法明确的社区服务端/插件证据。',
  },
  {
    id: 'unknown-review',
    gameType: '未知 / 待人工确认',
    capability: '扫描到了游戏，但缺少游戏方案或多人能力证据不足。',
    routeKind: 'needs_review',
    verdict: 'needs_review',
    verdictLabel: '先复核',
    recommendedMethodIds: [],
    userFacingResult: '先同步共享库；若仍缺失，由管理员确认类型后保存游戏方案。',
    adapterSignals: ['network_type: unknown_need_review', 'adapter_source: steam_scan', 'missing connection_plan'],
    evidenceToCollect: ['游戏内多人菜单截图', '端口/日志/抓包证据', '是否有本地同屏或 Steam 邀请'],
    adapterFields: ['network_type', 'capabilities', 'multiplayer_conversion', 'connection_plan'],
    adapterDefaults: {
      networkType: 'unknown_need_review',
      canConvertToLan: false,
      defaultNotes: [
        '当前证据不足，暂不生成开房邀请；请先补充测试步骤或方案证据。',
        '请先收集多人菜单、端口、日志或实际加入步骤，再重新套用更明确的游戏类型。',
      ],
    },
    operatorDecision: '暂不生成推荐方案；请先进入方案库创建或复核游戏方案。',
    riskNote: '低可信方案直接开房会制造“看起来有按钮但实际不可用”的产品问题。',
  },
];

export function rowsForRouteKind(kind: AdapterRouteKind) {
  return connectionCapabilityMatrix.filter((row) => row.routeKind === kind);
}

export function decisionRowForNetworkType(type?: GameNetworkType | null) {
  if (!type) return undefined;
  return connectionCapabilityMatrix.find((row) => row.adapterDefaults.networkType === type);
}

export function buildAdapterEditorPresetFromDecision(row: ConnectionCapabilityDecisionRow) {
  return {
    network_type: row.adapterDefaults.networkType,
    can_convert_to_lan: row.adapterDefaults.canConvertToLan,
    notes: [
      ...row.adapterDefaults.defaultNotes,
      `判定结果：${row.verdictLabel}。`,
      `推荐说明：${row.userFacingResult}`,
      `需要证据：${row.evidenceToCollect.join('；')}`,
      `风险说明：${row.riskNote}`,
    ].join('\n'),
  };
}

export function buildConnectionCapabilityMatrixGuide(rows = connectionCapabilityMatrix) {
  return [
    '[联机助手联机方式能力矩阵 / 游戏类型决策表]',
    '',
    '原则：目标不是强行把所有游戏变成局域网，而是识别游戏原本多人能力，再选择最合适的联机方案。',
    '',
    ...rows.map((row, index) => [
      `${index + 1}. ${row.gameType}`,
      `   判定：${row.verdictLabel}`,
      `   能力：${row.capability}`,
      `   推荐结果：${row.userFacingResult}`,
      `   方案信号：${row.adapterSignals.join('；')}`,
      `   需要证据：${row.evidenceToCollect.join('；')}`,
      `   关键字段：${row.adapterFields.join('；')}`,
      `   管理员决策：${row.operatorDecision}`,
      `   风险：${row.riskNote}`,
    ].join('\n')),
  ].join('\n\n');
}
