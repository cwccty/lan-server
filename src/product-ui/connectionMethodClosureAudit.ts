import type { AdvancedToolIntent } from './advancedToolIntent';
import type { ConnectionCapabilityDecisionRow } from './connectionCapabilityMatrix';
import type { ConnectionMethodEntry, ConnectionMethodId } from './connectionMethodCatalog';

export type ConnectionMethodClosureAuditStatus = 'wired' | 'observed' | 'manual_check';

export interface ConnectionMethodClosureAuditItem {
  id: string;
  label: string;
  status: ConnectionMethodClosureAuditStatus;
  evidence: string;
  manualCheck: string;
}

export interface ConnectionMethodClosureAuditInput {
  methods: ConnectionMethodEntry[];
  decisionRows: ConnectionCapabilityDecisionRow[];
  selectedDecision?: ConnectionCapabilityDecisionRow | null;
  selectedToolKind: 'tcp' | 'udp' | 'bridge';
  advancedToolIntent: AdvancedToolIntent | null;
  proxyInstanceCount: number;
  runningInstanceCount: number;
  blockingRiskCount: number;
  runtimeLoaded: boolean;
}

const REQUIRED_METHOD_IDS: ConnectionMethodId[] = [
  'n2n',
  'wireguard',
  'zerotier',
  'tailscale',
  'tcp_proxy',
  'udp_proxy',
  'udp_broadcast_bridge',
  'steam_remote_play',
  'sunshine_moonlight',
  'steam_relay_plugin',
];

const REQUIRED_DECISION_IDS = [
  'native-lan-ip-direct',
  'dedicated-server',
  'lan-discovery-broadcast',
  'port-proxy-needed',
  'local-coop-remote-play',
  'steam-p2p-lobby',
  'official-only',
  'unknown-review',
];

const STATIC_AUDIT_ITEMS: ConnectionMethodClosureAuditItem[] = [
  {
    id: 'method-catalog-complete',
    label: '联机方式目录完整',
    status: 'wired',
    evidence: 'connectionMethodCatalog 覆盖 n2n、WireGuard、ZeroTier、Tailscale、TCP/UDP 代理、UDP 广播桥、Steam Remote Play、Sunshine/Moonlight、Steam Relay/P2P。',
    manualCheck: '高级工具页“多联机方式入口”应能看到所有方式，并区分已接入、引导和预留。',
  },
  {
    id: 'method-status-boundary',
    label: '接入/引导/预留边界清楚',
    status: 'wired',
    evidence: 'ConnectionMethodEntry.status 使用“已接入 / 引导 / 预留”，避免把外部工具或未来插件伪装成当前已内嵌能力。',
    manualCheck: 'WireGuard、ZeroTier、Tailscale、Steam Remote Play、Sunshine/Moonlight 应显示为引导；Steam Relay/P2P 插件应显示预留。',
  },
  {
    id: 'capability-decision-matrix',
    label: '游戏能力决策矩阵',
    status: 'wired',
    evidence: 'connectionCapabilityMatrix 把原生 LAN、专用服务端、UDP 广播、端口代理、本地同屏、Steam P2P、官方服限定、未知待复核映射到推荐方式。',
    manualCheck: '管理员选择游戏类型后，矩阵应给出用户可理解的结果、应收集证据和 adapter 默认字段。',
  },
  {
    id: 'recommendation-method-handoff',
    label: '推荐页方式入口一致',
    status: 'wired',
    evidence: 'ProductRecommendationView 使用 methodsForAdapterRoute、buildConnectionMethodGuide、openConnectionMethod，将 adapterRoute 映射到对应联机方式。',
    manualCheck: '不同 adapter 路线应在推荐页显示对应方式，不应把本地同屏/Steam/官方服错误导向 n2n 虚拟 IP。',
  },
  {
    id: 'advanced-tools-real-backend',
    label: '高级工具真实后端',
    status: 'wired',
    evidence: 'ProductAdvancedToolsView 可启动 TCP 端口代理、UDP 单播代理、UDP 广播桥，并展示真实实例、计数、错误和日志。',
    manualCheck: '启动高级工具后，真实实例列表应出现运行状态；停止/自测应改变真实后端状态，不只是改文字。',
  },
  {
    id: 'advanced-tool-risk-self-test',
    label: '高级工具风险检查与自测',
    status: 'wired',
    evidence: 'buildAdvancedToolRiskChecks、blockingRiskCount、selfTestReferenceAdvancedProxy 和诊断修复历史回流共同保证参数检查、启动后自测和失败复盘。',
    manualCheck: '目标 IP、端口缺失时应阻止启动；诊断预填启动后应自动自测，并能复制复盘。',
  },
  {
    id: 'diagnostic-prefill-handoff',
    label: '诊断页预填高级工具',
    status: 'wired',
    evidence: 'ProductDiagnosticsView 会通过 writeAdvancedToolIntent 把 UDP 广播桥 / 端口代理建议带入高级工具。',
    manualCheck: '诊断发现端口代理或广播桥路线时，点击“带参数去高级工具”应预填游戏、端口和目标虚拟 IP。',
  },
  {
    id: 'remote-coop-route',
    label: '本地同屏远程方案',
    status: 'wired',
    evidence: 'remoteCoopGuide 和 connectionMethodCatalog 共同提供 Steam Remote Play 与 Sunshine + Moonlight 说明、质量预设和输入检查。',
    manualCheck: '本地同屏游戏应复制远程同屏说明，不应生成 LAN 邀请包。',
  },
  {
    id: 'steam-p2p-plugin-reserved',
    label: 'Steam P2P 插件预留',
    status: 'wired',
    evidence: 'steam_relay_plugin 被标记为预留；Steam P2P 路线默认复制 Steam 原生/插件说明，不强制 n2n。',
    manualCheck: 'Steam 大厅/P2P 游戏应提示保留 Steam 原生邀请或未来插件入口。',
  },
  {
    id: 'external-vpn-guides',
    label: '外部组网引导',
    status: 'wired',
    evidence: 'WireGuard、ZeroTier、Tailscale 作为引导方式保留，适合用户已有外部网络或不想使用 n2n 时选择。',
    manualCheck: '点击外部组网方式应复制说明或提示外部配置，不应尝试启动不存在的内嵌服务。',
  },
  {
    id: 'route-aware-diagnostics',
    label: '诊断按路线降权 n2n',
    status: 'wired',
    evidence: '诊断页 conversion advice 会对远程同屏、Steam P2P、官方服限定路线降低 n2n 修复优先级，避免错误排查。',
    manualCheck: '如果游戏不是 LAN 路线，诊断自动下一步不应优先让用户修 n2n。',
  },
  {
    id: 'copyable-method-guides',
    label: '可复制方式说明',
    status: 'wired',
    evidence: 'buildConnectionMethodGuide 和 buildConnectionCapabilityMatrixGuide 可复制单个方式说明与整体决策矩阵。',
    manualCheck: '用户应能复制某种方式的原理、适用场景和步骤发给好友或管理员。',
  },
];

function methodIds(input: ConnectionMethodClosureAuditInput) {
  return new Set(input.methods.map((method) => method.id));
}

function decisionIds(input: ConnectionMethodClosureAuditInput) {
  return new Set(input.decisionRows.map((row) => row.id));
}

function markObserved(item: ConnectionMethodClosureAuditItem, input: ConnectionMethodClosureAuditInput): ConnectionMethodClosureAuditItem {
  const ids = methodIds(input);
  const decisions = decisionIds(input);
  const allMethods = REQUIRED_METHOD_IDS.every((id) => ids.has(id));
  const allDecisions = REQUIRED_DECISION_IDS.every((id) => decisions.has(id));
  const hasStatusGroups = ['已接入', '引导', '预留'].every((status) => input.methods.some((method) => method.status === status));
  const advancedMethodCount = input.methods.filter((method) => method.advancedToolKind).length;

  if (item.id === 'method-catalog-complete' && allMethods) return { ...item, status: 'observed' };
  if (item.id === 'method-status-boundary' && hasStatusGroups) return { ...item, status: 'observed' };
  if (item.id === 'capability-decision-matrix' && allDecisions) return { ...item, status: 'observed' };
  if (item.id === 'recommendation-method-handoff' && allMethods && allDecisions) return { ...item, status: 'observed' };
  if (item.id === 'advanced-tools-real-backend' && advancedMethodCount >= 3) return { ...item, status: input.proxyInstanceCount > 0 ? 'observed' : 'wired' };
  if (item.id === 'advanced-tool-risk-self-test' && input.runtimeLoaded) return { ...item, status: 'observed' };
  if (item.id === 'diagnostic-prefill-handoff' && input.advancedToolIntent) return { ...item, status: 'observed' };
  if (item.id === 'remote-coop-route' && ids.has('steam_remote_play') && ids.has('sunshine_moonlight')) return { ...item, status: 'observed' };
  if (item.id === 'steam-p2p-plugin-reserved' && input.methods.find((method) => method.id === 'steam_relay_plugin')?.status === '预留') return { ...item, status: 'observed' };
  if (item.id === 'external-vpn-guides' && ids.has('wireguard') && ids.has('zerotier') && ids.has('tailscale')) return { ...item, status: 'observed' };
  if (item.id === 'route-aware-diagnostics' && allDecisions) return { ...item, status: 'observed' };
  if (item.id === 'copyable-method-guides' && input.methods.length > 0 && input.decisionRows.length > 0) return { ...item, status: 'observed' };
  return item;
}

export function buildConnectionMethodClosureAudit(input: ConnectionMethodClosureAuditInput) {
  const items = STATIC_AUDIT_ITEMS.map((item) => markObserved(item, input));
  const observedCount = items.filter((item) => item.status === 'observed').length;
  const connectedCount = input.methods.filter((method) => method.status === '已接入').length;
  const guideCount = input.methods.filter((method) => method.status === '引导').length;
  const reservedCount = input.methods.filter((method) => method.status === '预留').length;
  const missingMethods = REQUIRED_METHOD_IDS.filter((id) => !methodIds(input).has(id));
  const missingDecisions = REQUIRED_DECISION_IDS.filter((id) => !decisionIds(input).has(id));
  return {
    items,
    wiredCount: items.length,
    observedCount,
    connectedCount,
    guideCount,
    reservedCount,
    missingMethods,
    missingDecisions,
    summary: `已固化 ${items.length} 项多联机方式闭环能力；当前目录 ${input.methods.length} 种方式，其中已接入 ${connectedCount}、引导 ${guideCount}、预留 ${reservedCount}。`,
    nextRisk: missingMethods.length || missingDecisions.length
      ? '先补齐目录或游戏类型决策矩阵。'
      : input.blockingRiskCount > 0
        ? '当前高级工具参数仍有阻断风险，请先修正红色项。'
        : input.advancedToolIntent
          ? '已有诊断预填参数，建议启动后自动自测并回流诊断。'
          : '继续用推荐页/诊断页验证不同游戏路线是否进入正确方式。',
  };
}

export function formatConnectionMethodClosureAuditReport(input: ConnectionMethodClosureAuditInput) {
  const audit = buildConnectionMethodClosureAudit(input);
  return [
    '[联机助手多联机方式闭环自检]',
    audit.summary,
    '',
    '当前状态：',
    `- 已接入：${audit.connectedCount}，引导：${audit.guideCount}，预留：${audit.reservedCount}`,
    `- 缺失方式：${audit.missingMethods.join('、') || '无'}`,
    `- 决策行：${input.decisionRows.length}，缺失决策：${audit.missingDecisions.join('、') || '无'}`,
    `- 当前选中游戏类型：${input.selectedDecision?.gameType || '未选择'}`,
    `- 当前工具类型：${input.selectedToolKind}`,
    `- 高级工具实例：${input.proxyInstanceCount} 个，运行中 ${input.runningInstanceCount} 个`,
    `- 参数阻断风险：${input.blockingRiskCount}`,
    `- 诊断预填：${input.advancedToolIntent ? `${input.advancedToolIntent.reason} / ${input.advancedToolIntent.kind}` : '无'}`,
    `- runtime 已读取：${input.runtimeLoaded ? '是' : '否'}`,
    `- 下一风险：${audit.nextRisk}`,
    '',
    '方式目录：',
    ...input.methods.map((method) => `- ${method.title} [${method.status}]：${method.whenToUse}`),
    '',
    '自检清单：',
    ...audit.items.map((item, index) => [
      `${index + 1}. ${item.label} [${item.status}]`,
      `   证据：${item.evidence}`,
      `   人工验证：${item.manualCheck}`,
    ].join('\n')),
  ].join('\n');
}
