import type { GameNetworkType } from '../types/game';
import type { AdapterCreationIntent } from './adapterCreationIntent';
import type { ConnectionCapabilityDecisionRow } from './connectionCapabilityMatrix';
import type { ConversionAssessmentValidationResult } from './conversionAssessmentSamples';

export type ConversionEngineClosureAuditStatus = 'wired' | 'observed' | 'manual_check';

export interface ConversionEngineClosureAuditItem {
  id: string;
  label: string;
  status: ConversionEngineClosureAuditStatus;
  evidence: string;
  manualCheck: string;
}

export interface ConversionEngineClosureAuditInput {
  sampleResults: ConversionAssessmentValidationResult[];
  activeDecision?: ConnectionCapabilityDecisionRow | null;
  adapterIntent: AdapterCreationIntent | null;
  adapterIntentIsConversionAssessment: boolean;
  adapterCount: number;
  editorNetworkType: GameNetworkType;
  activeRegistryUrl: string;
}

const REQUIRED_SAMPLE_IDS = [
  'native-lan-ip-direct',
  'dedicated-server-host',
  'udp-broadcast-discovery',
  'tcp-udp-port-proxy',
  'cuphead-local-coop',
  'steam-p2p-lobby',
  'official-server-only',
  'unknown-needs-review',
];

const LAN_SAMPLE_IDS = [
  'native-lan-ip-direct',
  'dedicated-server-host',
  'udp-broadcast-discovery',
  'tcp-udp-port-proxy',
];

const NON_LAN_SAMPLE_IDS = [
  'cuphead-local-coop',
  'steam-p2p-lobby',
  'official-server-only',
  'unknown-needs-review',
];

const STATIC_AUDIT_ITEMS: ConversionEngineClosureAuditItem[] = [
  {
    id: 'conversion-route-classifier-complete',
    label: '转换分类完整',
    status: 'wired',
    evidence: 'conversionAssessmentEngine + adapterRecommendationRoute 覆盖原生 LAN、专用服务端、UDP 广播、端口代理、本地同屏、Steam P2P、官方服限定、未知待复核。',
    manualCheck: '方案库小样本应至少包含 8 类，并且每类 routeKind 与是否生成 LAN 邀请都符合预期。',
  },
  {
    id: 'true-lan-invite-boundary',
    label: '真 LAN 才生成邀请',
    status: 'wired',
    evidence: 'GameConversionAssessment.canBecomeLan 与 AdapterRecommendationRoute.canCreateLanInvite 同时守住 LAN 邀请边界。',
    manualCheck: 'LAN/IP、专用服务端、UDP 广播、端口代理样例应生成 LAN 邀请；本地同屏、Steam P2P、官方服、未知待复核不应生成。',
  },
  {
    id: 'native-lan-route',
    label: '原生 LAN / IP 直连',
    status: 'wired',
    evidence: 'native-lan-ip-direct 样例验证可输入 IP 的游戏进入 n2n 虚拟局域网路线。',
    manualCheck: '推荐页应显示可生成 LAN 邀请，并提示好友连接房主虚拟 IP 和端口。',
  },
  {
    id: 'dedicated-server-route',
    label: '专用服务端路线',
    status: 'wired',
    evidence: 'dedicated-server-host 样例验证专用服务端或内置开服游戏需要启动服务端、检测端口并生成 LAN 邀请。',
    manualCheck: '房主开房向导应保留“启动服务端/游戏”和“检测游戏端口”，失败时进入诊断。',
  },
  {
    id: 'udp-broadcast-route',
    label: 'UDP 广播大厅路线',
    status: 'wired',
    evidence: 'udp-broadcast-discovery 样例验证 LAN 大厅发现类游戏进入 n2n + UDP 广播桥，而不是只给普通 n2n。',
    manualCheck: '推荐页和诊断页应能把用户带到高级工具的 UDP 广播桥，并说明它解决大厅发现，不等于官方服转换。',
  },
  {
    id: 'port-proxy-route',
    label: 'TCP/UDP 端口代理路线',
    status: 'wired',
    evidence: 'tcp-udp-port-proxy 样例验证端口只监听本机或需要转发时进入 n2n + TCP/UDP 端口代理路线。',
    manualCheck: '诊断页发现端口代理路线时，应能带参数进入高级工具，并进行风险检查和自测。',
  },
  {
    id: 'local-coop-remote-play-boundary',
    label: '本地同屏不伪装 LAN',
    status: 'wired',
    evidence: 'cuphead-local-coop 样例验证只能本地同屏的游戏推荐 Steam Remote Play / Sunshine + Moonlight，不生成虚拟 IP 邀请。',
    manualCheck: '例如 Cuphead 应复制远程同屏说明，好友不应看到“连接房主虚拟 IP”的主流程。',
  },
  {
    id: 'steam-p2p-plugin-boundary',
    label: 'Steam P2P 保留原生流程',
    status: 'wired',
    evidence: 'steam-p2p-lobby 样例验证 Steam 大厅/P2P 游戏保留 Steam 好友邀请，Steam Relay/P2P 插件仅作为预留入口。',
    manualCheck: 'Steam P2P 游戏不应默认启动 n2n；如未来插件化，应先提示反作弊、账号和 Steamworks 边界。',
  },
  {
    id: 'official-only-blocked',
    label: '官方服限定不强转',
    status: 'wired',
    evidence: 'official-server-only 样例验证官方服限定游戏不生成 n2n 邀请包，只解释限制并保留官方入口。',
    manualCheck: '诊断页不应把官方服限定问题引导成 edge.exe / Supernode 修复。',
  },
  {
    id: 'unknown-review-handoff',
    label: '未知游戏先复核',
    status: 'wired',
    evidence: 'unknown-needs-review 样例验证证据不足时进入方案库复核、贡献包或管理员创建 adapter。',
    manualCheck: '扫描到未知游戏时应先同步共享库和收集证据，不要给普通用户直接开房按钮。',
  },
  {
    id: 'recommendation-assessment-handoff',
    label: '推荐页转换评估交接',
    status: 'wired',
    evidence: 'ProductRecommendationView 显示 data-non-lan-conversion-engine="assessment"，可复制评估并带评估进入方案库。',
    manualCheck: '推荐页非 LAN 转换评估中的“带评估去方案库”应携带结论、边界、证据和用户步骤。',
  },
  {
    id: 'solutions-contribution-handoff',
    label: '方案库沉淀转换结论',
    status: 'wired',
    evidence: 'ProductSolutionsView 可读取 conversion_assessment intent，并预填编辑器或用户贡献包。',
    manualCheck: '从推荐页或诊断页带入转换评估后，方案库应能生成贡献包或管理员 custom adapter。',
  },
  {
    id: 'diagnostic-route-correction',
    label: '诊断按路线纠错',
    status: 'wired',
    evidence: 'diagnosticConversionAdvice 会纠正本地同屏、Steam P2P、官方服、UDP 广播、端口代理路线，并按路线降权 n2n 修复。',
    manualCheck: '诊断页发现非 LAN 路线时，应优先给远程同屏/Steam/官方入口/高级工具建议，而不是盲目修 n2n。',
  },
  {
    id: 'copyable-conversion-reports',
    label: '转换结论可复制',
    status: 'wired',
    evidence: 'buildGameConversionAssessmentReport 与 buildConversionAssessmentValidationReport 可复制单个游戏评估和样本验证清单。',
    manualCheck: '用户、管理员或好友应能复制“为什么这样推荐、该怎么做、边界是什么、还缺什么证据”。',
  },
];

function sampleById(input: ConversionEngineClosureAuditInput) {
  return new Map(input.sampleResults.map((result) => [result.sample.id, result]));
}

function samplePassed(input: ConversionEngineClosureAuditInput, id: string) {
  return sampleById(input).get(id)?.passed === true;
}

function allRequiredSamplesPresent(input: ConversionEngineClosureAuditInput) {
  const ids = sampleById(input);
  return REQUIRED_SAMPLE_IDS.every((id) => ids.has(id));
}

function lanBoundaryPassed(input: ConversionEngineClosureAuditInput) {
  const ids = sampleById(input);
  return LAN_SAMPLE_IDS.every((id) => ids.get(id)?.canCreateLanInvite === true)
    && NON_LAN_SAMPLE_IDS.every((id) => ids.get(id)?.canCreateLanInvite === false);
}

function markObserved(item: ConversionEngineClosureAuditItem, input: ConversionEngineClosureAuditInput): ConversionEngineClosureAuditItem {
  if (item.id === 'conversion-route-classifier-complete' && allRequiredSamplesPresent(input)) return { ...item, status: 'observed' };
  if (item.id === 'true-lan-invite-boundary' && lanBoundaryPassed(input)) return { ...item, status: 'observed' };
  if (item.id === 'native-lan-route' && samplePassed(input, 'native-lan-ip-direct')) return { ...item, status: 'observed' };
  if (item.id === 'dedicated-server-route' && samplePassed(input, 'dedicated-server-host')) return { ...item, status: 'observed' };
  if (item.id === 'udp-broadcast-route' && samplePassed(input, 'udp-broadcast-discovery')) return { ...item, status: 'observed' };
  if (item.id === 'port-proxy-route' && samplePassed(input, 'tcp-udp-port-proxy')) return { ...item, status: 'observed' };
  if (item.id === 'local-coop-remote-play-boundary' && samplePassed(input, 'cuphead-local-coop')) return { ...item, status: 'observed' };
  if (item.id === 'steam-p2p-plugin-boundary' && samplePassed(input, 'steam-p2p-lobby')) return { ...item, status: 'observed' };
  if (item.id === 'official-only-blocked' && samplePassed(input, 'official-server-only')) return { ...item, status: 'observed' };
  if (item.id === 'unknown-review-handoff' && samplePassed(input, 'unknown-needs-review')) return { ...item, status: 'observed' };
  if (item.id === 'recommendation-assessment-handoff' && input.sampleResults.length >= REQUIRED_SAMPLE_IDS.length) return { ...item, status: 'observed' };
  if (item.id === 'solutions-contribution-handoff' && input.adapterIntentIsConversionAssessment) return { ...item, status: 'observed' };
  if (item.id === 'diagnostic-route-correction' && allRequiredSamplesPresent(input)) return { ...item, status: 'observed' };
  if (item.id === 'copyable-conversion-reports' && input.sampleResults.length > 0) return { ...item, status: 'observed' };
  return item;
}

export function buildConversionEngineClosureAudit(input: ConversionEngineClosureAuditInput) {
  const items = STATIC_AUDIT_ITEMS.map((item) => markObserved(item, input));
  const observedCount = items.filter((item) => item.status === 'observed').length;
  const passedSamples = input.sampleResults.filter((item) => item.passed).length;
  const missingSamples = REQUIRED_SAMPLE_IDS.filter((id) => !sampleById(input).has(id));
  const lanInviteSamples = input.sampleResults.filter((item) => item.canCreateLanInvite).length;
  const nonLanSamples = input.sampleResults.length - lanInviteSamples;
  const failedSamples = input.sampleResults.filter((item) => !item.passed);
  return {
    items,
    wiredCount: items.length,
    observedCount,
    sampleTotal: input.sampleResults.length,
    passedSamples,
    missingSamples,
    failedSamples,
    lanInviteSamples,
    nonLanSamples,
    summary: `已固化 ${items.length} 项非局域网转换闭环能力；当前样本 ${input.sampleResults.length} 个，通过 ${passedSamples} 个，LAN 邀请 ${lanInviteSamples} 个，非 LAN / 不生成邀请 ${nonLanSamples} 个。`,
    nextRisk: missingSamples.length
      ? `先补齐样本：${missingSamples.join('、')}。`
      : failedSamples.length
        ? `先复核失败样本：${failedSamples.map((item) => item.sample.id).join('、')}。`
        : input.adapterIntentIsConversionAssessment
          ? '当前有转换评估带入方案库，建议生成贡献包或保存 custom adapter。'
          : '继续用真实游戏验证推荐页、方案库和诊断页是否始终遵守“能不能转 LAN”的边界。',
  };
}

export function formatConversionEngineClosureAuditReport(input: ConversionEngineClosureAuditInput) {
  const audit = buildConversionEngineClosureAudit(input);
  return [
    '[联机助手非局域网游戏转换方案引擎闭环自检]',
    audit.summary,
    '',
    '当前状态：',
    `- 缺失样本：${audit.missingSamples.join('、') || '无'}`,
    `- 失败样本：${audit.failedSamples.map((item) => item.sample.id).join('、') || '无'}`,
    `- 当前编辑器类型：${input.editorNetworkType}`,
    `- 当前决策：${input.activeDecision?.gameType || '未匹配'}`,
    `- 转换评估带入方案库：${input.adapterIntentIsConversionAssessment ? '是' : '否'}`,
    `- 当前 adapter 数：${input.adapterCount}`,
    `- 共享库地址：${input.activeRegistryUrl || '未设置'}`,
    `- 下一风险：${audit.nextRisk}`,
    '',
    '样本结果：',
    ...input.sampleResults.map((result) => [
      `- ${result.sample.title} (${result.sample.id})`,
      `  路线：${result.routeKind}｜LAN 邀请：${result.canCreateLanInvite ? '生成' : '不生成'}｜结果：${result.passed ? '通过' : '需复核'}`,
      `  结论：${result.assessment.userConclusion}`,
    ].join('\n')),
    '',
    '自检清单：',
    ...audit.items.map((item, index) => [
      `${index + 1}. ${item.label} [${item.status}]`,
      `   证据：${item.evidence}`,
      `   人工验证：${item.manualCheck}`,
    ].join('\n')),
  ].join('\n');
}
