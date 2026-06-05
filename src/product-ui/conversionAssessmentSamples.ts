import type { GameSummary } from '../types/game';
import { buildAdapterRecommendationRoute, type AdapterRouteKind } from './adapterRecommendationRoute';
import {
  buildGameConversionAssessment,
  buildGameConversionAssessmentReport,
  type GameConversionAssessment,
} from './conversionAssessmentEngine';

export interface ConversionAssessmentValidationSample {
  id: string;
  title: string;
  purpose: string;
  game: GameSummary;
  expected: {
    routeKind: AdapterRouteKind;
    canBecomeLan: boolean;
    canCreateLanInvite: boolean;
    conclusionIncludes: string;
  };
}

export interface ConversionAssessmentValidationResult {
  sample: ConversionAssessmentValidationSample;
  routeKind: AdapterRouteKind;
  canBecomeLan: boolean;
  canCreateLanInvite: boolean;
  assessment: GameConversionAssessment;
  passed: boolean;
  checks: string[];
}

function basePlan(summary: string, port?: number) {
  return {
    summary,
    host_role: '房主',
    join_role: '好友',
    default_join_host: 'host virtual ip',
    default_join_port: port ?? null,
    requires_virtual_lan: Boolean(port),
    requires_tcp_port_proxy: false,
    requires_udp_broadcast_bridge: false,
    requires_dedicated_server: false,
    invite_template: [],
    troubleshooting: [],
  };
}

export const conversionAssessmentValidationSamples: ConversionAssessmentValidationSample[] = [
  {
    id: 'cuphead-local-coop',
    title: 'Cuphead / 只能本地同屏',
    purpose: '验证本地同屏游戏不会被误判成 n2n 局域网；应推荐 Steam Remote Play 或 Sunshine + Moonlight。',
    game: {
      game_id: 'cuphead',
      display_name: 'Cuphead',
      steam_appid: '268910',
      capabilities: ['local_coop', 'remote_play_together'],
      network_type: 'local_coop_remote_play',
      adapter_source: 'custom',
      multiplayer_conversion: {
        capability: 'local_coop_remote_play',
        methods: ['steam_remote_play', 'sunshine_moonlight'],
        can_convert_to_lan: false,
        risk_level: 'medium',
        notes: ['只能本地同屏，远程同屏解决画面与输入，不生成虚拟 IP 加入步骤。'],
        required_components: ['Steam Remote Play Together', 'Sunshine + Moonlight'],
      },
      connection_plan: {
        ...basePlan('本地同屏远程，不需要虚拟局域网。'),
        requires_virtual_lan: false,
      },
    },
    expected: {
      routeKind: 'remote_coop',
      canBecomeLan: false,
      canCreateLanInvite: false,
      conclusionIncludes: '不要把它描述成真正的局域网',
    },
  },
  {
    id: 'native-lan-ip-direct',
    title: '原生 LAN / IP 直连',
    purpose: '验证可输入 IP 的游戏会生成 LAN 邀请路线，推荐 n2n 虚拟局域网。',
    game: {
      game_id: 'sample_lan_ip',
      display_name: 'Sample LAN IP Game',
      capabilities: ['lan', 'ip_join'],
      network_type: 'lan_ip_direct',
      adapter_source: 'registry',
      multiplayer_conversion: {
        capability: 'native_lan_ip',
        methods: ['virtual_lan'],
        can_convert_to_lan: true,
        risk_level: 'low',
        notes: ['好友加入 n2n 后连接房主虚拟 IP 和端口。'],
        required_components: ['n2n edge'],
      },
      connection_plan: basePlan('支持 IP 直连，组网后连接房主虚拟 IP。', 25565),
    },
    expected: {
      routeKind: 'virtual_lan',
      canBecomeLan: true,
      canCreateLanInvite: true,
      conclusionIncludes: '可以按当前方案转换成局域网',
    },
  },
  {
    id: 'udp-broadcast-discovery',
    title: '局域网大厅发现 / UDP 广播',
    purpose: '验证 LAN 大厅发现类游戏会提示 n2n + UDP 广播桥，而不是只给 n2n。',
    game: {
      game_id: 'sample_udp_broadcast',
      display_name: 'Sample UDP Broadcast Game',
      capabilities: ['lan'],
      network_type: 'udp_broadcast_needed',
      adapter_source: 'custom',
      multiplayer_conversion: {
        capability: 'lan_discovery_broadcast',
        methods: ['virtual_lan', 'broadcast_bridge'],
        can_convert_to_lan: true,
        risk_level: 'medium',
        notes: ['需要桥接 UDP 广播才能在 LAN 大厅发现房间。'],
        required_components: ['n2n edge', 'UDP 广播桥'],
      },
      connection_plan: {
        ...basePlan('n2n 负责互通，UDP 广播桥负责大厅发现。', 27015),
        requires_udp_broadcast_bridge: true,
      },
    },
    expected: {
      routeKind: 'udp_broadcast_bridge',
      canBecomeLan: true,
      canCreateLanInvite: true,
      conclusionIncludes: '可以按当前方案转换成局域网',
    },
  },
  {
    id: 'dedicated-server-host',
    title: '专用服务端 / 内置开服',
    purpose: '验证需要独立服务端或内置开服的游戏会保留“启动服务端 + 检测端口 + LAN 邀请”路线。',
    game: {
      game_id: 'sample_dedicated_server',
      display_name: 'Sample Dedicated Server Game',
      capabilities: ['lan', 'dedicated_server'],
      network_type: 'dedicated_server',
      adapter_source: 'registry',
      multiplayer_conversion: {
        capability: 'hidden_dedicated_server',
        methods: ['virtual_lan', 'dedicated_server_launcher'],
        can_convert_to_lan: true,
        risk_level: 'medium',
        notes: ['需要房主先启动服务端，好友再连接房主虚拟 IP 和服务端端口。'],
        required_components: ['n2n edge', '游戏服务端'],
      },
      connection_plan: {
        ...basePlan('先组网，再启动专用服务端，好友连接房主虚拟 IP。', 7777),
        requires_dedicated_server: true,
      },
    },
    expected: {
      routeKind: 'dedicated_server',
      canBecomeLan: true,
      canCreateLanInvite: true,
      conclusionIncludes: '可以按当前方案转换成局域网',
    },
  },
  {
    id: 'tcp-udp-port-proxy',
    title: 'TCP/UDP 端口代理',
    purpose: '验证端口只监听本机或需要转发时，会推荐 n2n + TCP/UDP 端口代理，而不是只提示普通 n2n。',
    game: {
      game_id: 'sample_port_proxy',
      display_name: 'Sample Port Proxy Game',
      capabilities: ['lan', 'ip_join'],
      network_type: 'tcp_port_proxy_needed',
      adapter_source: 'custom',
      multiplayer_conversion: {
        capability: 'tcp_udp_proxy_possible',
        methods: ['virtual_lan', 'port_proxy'],
        can_convert_to_lan: true,
        risk_level: 'medium',
        notes: ['游戏端口需要代理到虚拟网可达地址。'],
        required_components: ['n2n edge', 'TCP/UDP 端口代理'],
      },
      connection_plan: {
        ...basePlan('n2n 负责互通，端口代理负责把游戏端口暴露给虚拟网。', 27016),
        requires_tcp_port_proxy: true,
      },
    },
    expected: {
      routeKind: 'tcp_port_proxy',
      canBecomeLan: true,
      canCreateLanInvite: true,
      conclusionIncludes: '可以按当前方案转换成局域网',
    },
  },
  {
    id: 'steam-p2p-lobby',
    title: 'Steam 大厅 / Steam P2P',
    purpose: '验证 Steam P2P 游戏保留 Steam 原生流程，Steam Relay / P2P 插件仅作为人工确认入口。',
    game: {
      game_id: 'sample_steam_p2p',
      display_name: 'Sample Steam P2P Game',
      capabilities: ['steam_lobby', 'steam_p2p'],
      network_type: 'steam_p2p_only',
      adapter_source: 'registry',
      multiplayer_conversion: {
        capability: 'steam_p2p_lobby',
        methods: ['steam_relay_plugin'],
        can_convert_to_lan: false,
        risk_level: 'high',
        notes: ['优先使用 Steam 好友邀请；插件路线需要人工确认。'],
        required_components: ['Steam 好友邀请', 'Steam Relay / P2P 插件入口'],
      },
      connection_plan: {
        ...basePlan('按游戏原生 Steam 大厅或 P2P 流程加入。'),
        requires_virtual_lan: false,
      },
    },
    expected: {
      routeKind: 'steam_p2p',
      canBecomeLan: false,
      canCreateLanInvite: false,
      conclusionIncludes: '不要把它描述成真正的局域网',
    },
  },
  {
    id: 'official-server-only',
    title: '官方服务器限定',
    purpose: '验证官方服限定游戏不会生成 n2n 邀请包，只解释限制并保留官方入口。',
    game: {
      game_id: 'sample_official_only',
      display_name: 'Sample Official Only Game',
      capabilities: ['official_server'],
      network_type: 'official_only',
      adapter_source: 'custom',
      multiplayer_conversion: {
        capability: 'official_only',
        methods: ['not_supported'],
        can_convert_to_lan: false,
        risk_level: 'high',
        notes: ['多人依赖官方账号、匹配或后端鉴权。'],
        required_components: ['官方服务器/官方大厅'],
      },
      connection_plan: {
        ...basePlan('官方服限定，不建议转换。'),
        requires_virtual_lan: false,
      },
    },
    expected: {
      routeKind: 'official_only',
      canBecomeLan: false,
      canCreateLanInvite: false,
      conclusionIncludes: '不建议转换成局域网',
    },
  },
  {
    id: 'unknown-needs-review',
    title: '未知 / 待人工确认',
    purpose: '验证证据不足的游戏不会直接承诺可联机，而是进入方案库复核、贡献包或管理员创建 adapter。',
    game: {
      game_id: 'sample_unknown_review',
      display_name: 'Sample Unknown Game',
      capabilities: ['unknown'],
      network_type: 'unknown_need_review',
      adapter_source: 'steam_scan',
      multiplayer_conversion: {
        capability: 'unknown',
        methods: ['manual_guide'],
        can_convert_to_lan: false,
        risk_level: 'medium',
        notes: ['缺少多人菜单、端口、日志或实测步骤，不能直接推荐给普通用户。'],
        required_components: ['方案库复核', '管理员确认'],
      },
      connection_plan: {
        ...basePlan('证据不足，先进入方案库复核。'),
        requires_virtual_lan: false,
      },
    },
    expected: {
      routeKind: 'needs_review',
      canBecomeLan: false,
      canCreateLanInvite: false,
      conclusionIncludes: '证据不足',
    },
  },
];

export function validateConversionAssessmentSamples(): ConversionAssessmentValidationResult[] {
  return conversionAssessmentValidationSamples.map((sample) => {
    const route = buildAdapterRecommendationRoute(sample.game);
    const assessment = buildGameConversionAssessment(sample.game, route);
    const checks = [
      `路线 ${route.kind} / 期望 ${sample.expected.routeKind}`,
      `可转 LAN ${assessment.canBecomeLan ? '是' : '否'} / 期望 ${sample.expected.canBecomeLan ? '是' : '否'}`,
      `LAN 邀请 ${route.canCreateLanInvite ? '生成' : '不生成'} / 期望 ${sample.expected.canCreateLanInvite ? '生成' : '不生成'}`,
      `结论包含“${sample.expected.conclusionIncludes}”：${assessment.userConclusion.includes(sample.expected.conclusionIncludes) ? '是' : '否'}`,
    ];
    const passed = route.kind === sample.expected.routeKind
      && assessment.canBecomeLan === sample.expected.canBecomeLan
      && route.canCreateLanInvite === sample.expected.canCreateLanInvite
      && assessment.userConclusion.includes(sample.expected.conclusionIncludes);

    return {
      sample,
      routeKind: route.kind,
      canBecomeLan: assessment.canBecomeLan,
      canCreateLanInvite: route.canCreateLanInvite,
      assessment,
      passed,
      checks,
    };
  });
}

export function buildConversionAssessmentValidationReport(results = validateConversionAssessmentSamples()) {
  return [
    '[联机助手转换评估小样本验证清单]',
    `样例数量：${results.length}`,
    `通过数量：${results.filter((item) => item.passed).length}`,
    '',
    ...results.map((result, index) => [
      `${index + 1}. ${result.sample.title}`,
      `   目的：${result.sample.purpose}`,
      `   结果：${result.passed ? '通过' : '需复核'}`,
      `   路线：${result.routeKind}`,
      `   是否生成 LAN 邀请：${result.canCreateLanInvite ? '是' : '否'}`,
      `   结论：${result.assessment.userConclusion}`,
      `   推荐：${result.assessment.recommendedPlan}`,
      '   检查：',
      ...result.checks.map((check) => `   - ${check}`),
      '   完整评估摘要：',
      ...buildGameConversionAssessmentReport(result.assessment).split('\n').slice(0, 12).map((line) => `   ${line}`),
    ].join('\n')),
  ].join('\n\n');
}
