import {
  resolveProductStatusCenter,
  type ProductConnectionStage,
  type ProductStatusCenter,
  type ProductStatusCenterInput,
  type ProductStatusTone,
} from './statusCenter';

export type ProductStateConsistencyAuditStatus = 'wired' | 'observed' | 'manual_check';

export type ProductStateCoveragePage =
  | 'home'
  | 'header'
  | 'network'
  | 'recommendation'
  | 'diagnostics'
  | 'advanced_tools';

export interface ProductStateConsistencyAuditItem {
  id: string;
  label: string;
  status: ProductStateConsistencyAuditStatus;
  evidence: string;
  manualCheck: string;
}

export interface ProductStateScenarioResult {
  id: string;
  label: string;
  passed: boolean;
  expected: string;
  actual: string;
  mismatch: string[];
}

export interface ProductStateConsistencyAuditInput {
  productStatus: ProductStatusCenter;
  runtimeLoaded: boolean;
  busy: string;
  network: {
    running: boolean;
    ready: boolean;
    hasError: boolean;
    label?: string;
    virtualIp?: string;
    supernode?: string;
  };
  runtimeErrorCount: number;
  hasReport: boolean;
  hasInviteDiagnosticContext: boolean;
  hasHostDiagnosticContext: boolean;
  hasLatestAdvancedToolFix: boolean;
  routeUsesLanInvite?: boolean | null;
  routeKind?: string;
  routeTitle?: string;
  pageCoverage: Partial<Record<ProductStateCoveragePage, boolean>>;
}

interface ProductStateScenario {
  id: string;
  label: string;
  input: ProductStatusCenterInput;
  expected: Partial<Pick<ProductStatusCenter, 'stage' | 'tone' | 'canInvite' | 'needsNetwork' | 'needsServer'>>;
}

const CONFIGURED_N2N = {
  room_name: 'audit-room',
  secret: 'audit-secret',
  supernode: '127.0.0.1:7777',
  local_ip: '10.10.10.2',
};

const SERVER_STOPPED = {
  running: false,
  ready: false,
  logs: [],
  message: '未启动',
  ever_ready: false,
};

const SERVER_RUNNING = {
  running: true,
  ready: true,
  logs: ['端口已监听'],
  message: '端口已监听',
  ever_ready: true,
};

const STATIC_SCENARIOS: ProductStateScenario[] = [
  {
    id: 'busy-priority',
    label: '忙碌状态优先',
    input: {
      loaded: true,
      network: { running: true, ready: true, hasError: false, label: 'ACK/PONG 已通过' },
      n2nConfig: CONFIGURED_N2N,
      busy: '启动 n2n',
      hasFriendSlot: true,
    },
    expected: { stage: 'starting', tone: 'warn', canInvite: false, needsNetwork: true },
  },
  {
    id: 'runtime-not-loaded',
    label: 'runtime 未读取不显示已连接',
    input: {
      loaded: false,
      network: { running: false, ready: false, hasError: false },
      n2nConfig: CONFIGURED_N2N,
    },
    expected: { stage: 'starting', tone: 'idle', canInvite: false, needsNetwork: true },
  },
  {
    id: 'runtime-error-priority',
    label: '运行错误进入问题态',
    input: {
      loaded: true,
      network: { running: true, ready: true, hasError: true, label: 'Supernode 暂无响应' },
      errors: ['Supernode 暂无响应'],
      n2nConfig: CONFIGURED_N2N,
      hasFriendSlot: true,
    },
    expected: { stage: 'has_problem', tone: 'danger', canInvite: false, needsNetwork: true },
  },
  {
    id: 'stale-last-error-after-ack',
    label: 'ACK/PONG 已确认后忽略 n2n 残留错误',
    input: {
      loaded: true,
      network: { running: true, ready: true, hasError: false, label: 'ACK/PONG 已通过' },
      snapshot: {
        source: 'tauri',
        loaded_at: 'audit',
        n2n: {
          running: true,
          supernode_configured: true,
          supernode: '127.0.0.1:7777',
          virtual_ip: '10.10.10.2',
          ack: true,
          pong: true,
          ok_link: true,
          auth_error: false,
          ip_mac_conflict: false,
          last_error: 'Supernode 暂无响应',
          not_responding: true,
          tap_error: false,
          summary: 'ACK/PONG 已通过',
          log_path: 'audit.log',
          recent_logs: [],
        },
        n2n_last_config: CONFIGURED_N2N,
        backends: [],
        games: [],
        adapters: [],
        server_session: null,
        port_proxies: [],
        udp_proxies: [],
        udp_broadcast_bridges: [],
        diagnostic_report: null,
        errors: [],
      },
      n2nConfig: CONFIGURED_N2N,
      hasFriendSlot: true,
    },
    expected: { stage: 'ready_to_invite', tone: 'good', canInvite: true, needsNetwork: false },
  },
  {
    id: 'not-configured',
    label: '未配置不允许启动邀请',
    input: {
      loaded: true,
      network: { running: false, ready: false, hasError: false },
    },
    expected: { stage: 'not_configured', tone: 'idle', canInvite: false, needsNetwork: true },
  },
  {
    id: 'configured-not-started',
    label: '已配置未启动',
    input: {
      loaded: true,
      network: { running: false, ready: false, hasError: false },
      n2nConfig: CONFIGURED_N2N,
    },
    expected: { stage: 'configured_not_started', tone: 'warn', canInvite: false, needsNetwork: true },
  },
  {
    id: 'ack-pending',
    label: 'edge 运行但未 ACK',
    input: {
      loaded: true,
      network: { running: true, ready: false, hasError: false, label: '等待 ACK/PONG' },
      n2nConfig: CONFIGURED_N2N,
    },
    expected: { stage: 'starting', tone: 'warn', canInvite: false, needsNetwork: true },
  },
  {
    id: 'server-required-before-invite',
    label: '需要服务端时先阻止邀请',
    input: {
      loaded: true,
      network: { running: true, ready: true, hasError: false, label: 'ACK/PONG 已通过' },
      n2nConfig: CONFIGURED_N2N,
      requiresServer: true,
      server: SERVER_STOPPED,
      hasFriendSlot: true,
    },
    expected: { stage: 'server_missing', tone: 'warn', canInvite: false, needsNetwork: false, needsServer: true },
  },
  {
    id: 'friend-slot-required-before-lan-invite',
    label: 'LAN 邀请前必须有好友 IP',
    input: {
      loaded: true,
      network: { running: true, ready: true, hasError: false, label: 'ACK/PONG 已通过' },
      n2nConfig: CONFIGURED_N2N,
      hasFriendSlot: false,
    },
    expected: { stage: 'network_ready', tone: 'good', canInvite: false, needsNetwork: false },
  },
  {
    id: 'ready-to-invite',
    label: '组网、服务端和好友席位齐全',
    input: {
      loaded: true,
      network: { running: true, ready: true, hasError: false, label: 'ACK/PONG 已通过' },
      n2nConfig: CONFIGURED_N2N,
      requiresServer: true,
      server: SERVER_RUNNING,
      hasFriendSlot: true,
    },
    expected: { stage: 'ready_to_invite', tone: 'good', canInvite: true, needsNetwork: false, needsServer: false },
  },
];

const STATIC_AUDIT_ITEMS: ProductStateConsistencyAuditItem[] = [
  {
    id: 'status-center-scenario-matrix',
    label: '状态中心场景矩阵',
    status: 'wired',
    evidence: 'productStateConsistencyAudit 使用 resolveProductStatusCenter 对忙碌、未加载、错误、未配置、未启动、ACK 等待、服务端缺失、好友 IP 缺失和可邀请场景做固定样例校验。',
    manualCheck: '修改 statusCenter.ts 后先复制状态一致性自检；任何样例失败都说明前端可能出现互相矛盾的提示。',
  },
  {
    id: 'shared-status-center-pages',
    label: '主要页面共用状态中心',
    status: 'wired',
    evidence: 'Header、首页、通用组网中心、推荐方案页通过 resolveProductStatusCenter 读取同一套 n2n/服务端状态。',
    manualCheck: '同一时刻 Header、首页状态圈、组网中心和推荐方案页的状态标签不应互相打架。',
  },
  {
    id: 'busy-overrides-actions',
    label: '忙碌态禁止继续邀请',
    status: 'wired',
    evidence: 'busy 场景固定返回 starting，并将 canInvite 置为 false；ProductBusyOverlay 负责提示等待真实状态返回。',
    manualCheck: '启动 n2n、检测端口、生成诊断时，主按钮不应继续给“复制邀请包”这种可执行动作。',
  },
  {
    id: 'runtime-loading-guard',
    label: 'runtime 未加载保护',
    status: 'wired',
    evidence: 'loaded=false 时固定显示“正在读取状态”，不把上次残留值误判为已连接。',
    manualCheck: '首次打开或刷新慢时，页面应显示读取中，而不是提前显示可邀请。',
  },
  {
    id: 'runtime-error-priority',
    label: '运行错误优先级',
    status: 'wired',
    evidence: 'hasError、runtime errors 进入 has_problem；auth_error、ip_mac_conflict、not_responding、last_error 只有在未 ready/未 ok_link 时才进入问题态，避免 ACK 后残留错误覆盖成功态。',
    manualCheck: 'Supernode 无响应、IP/MAC 冲突或认证失败且未连通时，所有页面应提示去诊断；ACK/PONG 已确认后不应被旧错误误判为异常。',
  },
  {
    id: 'server-before-invite-gate',
    label: '服务端缺失拦截',
    status: 'wired',
    evidence: 'requiresServer=true 且 server.running=false 时进入 server_missing，canInvite=false。',
    manualCheck: 'Terraria/专用服务端游戏未监听端口时，推荐页应先提示启动服务端。',
  },
  {
    id: 'friend-slot-before-invite-gate',
    label: '好友 IP 缺失拦截',
    status: 'wired',
    evidence: 'LAN 邀请显式传入 hasFriendSlot=false 时，状态中心保持 network_ready 但 canInvite=false，并提示先分配好友虚拟 IP。',
    manualCheck: '房主还没给好友分配虚拟 IP 时，不应直接生成可用的 LAN 邀请包。',
  },
  {
    id: 'non-lan-route-guard',
    label: '非 LAN 路线不套 n2n 邀请',
    status: 'wired',
    evidence: '推荐页根据 adapterRoute.canCreateLanInvite 区分 LAN 邀请和远程同屏/Steam/官方服说明。',
    manualCheck: 'Cuphead、本地同屏、Steam P2P、官方服限定路线应复制对应说明，不应要求好友虚拟 IP。',
  },
  {
    id: 'diagnostic-context-boundary',
    label: '诊断上下文不覆盖基础状态',
    status: 'wired',
    evidence: '邀请失败、房主失败和高级工具复盘只作为诊断上下文；n2n 基础状态仍由 statusCenter 决定。',
    manualCheck: '从诊断页返回后，Header/首页状态不应因为旧失败记录而永久显示异常；必须以实时 runtime 为准。',
  },
  {
    id: 'copyable-state-recap',
    label: '状态自检可复制',
    status: 'wired',
    evidence: '诊断页提供“复制状态一致性自检”，可把当前状态、场景样例、上下文边界和下一风险发给开发者/管理员。',
    manualCheck: '发布前遇到状态混乱时，不再靠截图猜测，而是复制自检文本复盘。',
  },
];

function expectedToString(expected: ProductStateScenario['expected']) {
  return Object.entries(expected)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('，');
}

function actualToString(actual: ProductStatusCenter) {
  return [
    `stage=${actual.stage}`,
    `tone=${actual.tone}`,
    `canInvite=${String(actual.canInvite)}`,
    `needsNetwork=${String(actual.needsNetwork)}`,
    `needsServer=${String(actual.needsServer)}`,
    `label=${actual.label}`,
  ].join('，');
}

function runScenario(scenario: ProductStateScenario): ProductStateScenarioResult {
  const actual = resolveProductStatusCenter(scenario.input);
  const mismatch = Object.entries(scenario.expected)
    .filter(([key, value]) => actual[key as keyof Pick<ProductStatusCenter, 'stage' | 'tone' | 'canInvite' | 'needsNetwork' | 'needsServer'>] !== value)
    .map(([key, value]) => `${key}: 期望 ${String(value)}，实际 ${String(actual[key as keyof Pick<ProductStatusCenter, 'stage' | 'tone' | 'canInvite' | 'needsNetwork' | 'needsServer'>])}`);

  return {
    id: scenario.id,
    label: scenario.label,
    passed: mismatch.length === 0,
    expected: expectedToString(scenario.expected),
    actual: actualToString(actual),
    mismatch,
  };
}

function hasPageCoverage(input: ProductStateConsistencyAuditInput) {
  return ['home', 'header', 'network', 'recommendation'].every((page) => input.pageCoverage[page as ProductStateCoveragePage]);
}

function scenarioPassed(results: ProductStateScenarioResult[], id: string) {
  return Boolean(results.find((result) => result.id === id)?.passed);
}

function markObserved(
  item: ProductStateConsistencyAuditItem,
  input: ProductStateConsistencyAuditInput,
  scenarios: ProductStateScenarioResult[],
): ProductStateConsistencyAuditItem {
  const allScenariosPassed = scenarios.every((scenario) => scenario.passed);
  if (item.id === 'status-center-scenario-matrix' && allScenariosPassed) return { ...item, status: 'observed' };
  if (item.id === 'shared-status-center-pages' && hasPageCoverage(input)) return { ...item, status: 'observed' };
  if (item.id === 'busy-overrides-actions' && scenarioPassed(scenarios, 'busy-priority')) return { ...item, status: input.busy ? 'observed' : 'wired' };
  if (item.id === 'runtime-loading-guard' && scenarioPassed(scenarios, 'runtime-not-loaded')) return { ...item, status: input.runtimeLoaded ? 'wired' : 'observed' };
  if (item.id === 'runtime-error-priority' && scenarioPassed(scenarios, 'runtime-error-priority')) return { ...item, status: (input.network.hasError || input.runtimeErrorCount > 0) ? 'observed' : 'wired' };
  if (item.id === 'server-before-invite-gate' && scenarioPassed(scenarios, 'server-required-before-invite')) return { ...item, status: input.productStatus.stage === 'server_missing' ? 'observed' : 'wired' };
  if (item.id === 'friend-slot-before-invite-gate' && scenarioPassed(scenarios, 'friend-slot-required-before-lan-invite')) return { ...item, status: 'observed' };
  if (item.id === 'non-lan-route-guard' && input.routeUsesLanInvite === false) return { ...item, status: 'observed' };
  if (item.id === 'diagnostic-context-boundary' && (input.hasReport || input.hasInviteDiagnosticContext || input.hasHostDiagnosticContext || input.hasLatestAdvancedToolFix)) return { ...item, status: 'observed' };
  if (item.id === 'copyable-state-recap') return { ...item, status: 'observed' };
  return item;
}

export function buildProductStateConsistencyAudit(input: ProductStateConsistencyAuditInput) {
  const scenarios = STATIC_SCENARIOS.map(runScenario);
  const items = STATIC_AUDIT_ITEMS.map((item) => markObserved(item, input, scenarios));
  const observedCount = items.filter((item) => item.status === 'observed').length;
  const scenarioFailures = scenarios.filter((scenario) => !scenario.passed);
  const coveredPages = Object.entries(input.pageCoverage)
    .filter(([, covered]) => covered)
    .map(([page]) => page);
  const missingPages = (['home', 'header', 'network', 'recommendation'] as ProductStateCoveragePage[])
    .filter((page) => !input.pageCoverage[page]);

  return {
    items,
    scenarios,
    wiredCount: items.length,
    observedCount,
    scenarioFailures,
    coveredPages,
    missingPages,
    currentStage: input.productStatus.stage as ProductConnectionStage,
    currentTone: input.productStatus.tone as ProductStatusTone,
    summary: `已固化 ${items.length} 项发布级状态一致性守卫；状态中心样例 ${scenarios.length - scenarioFailures.length}/${scenarios.length} 通过，当前页面状态为 ${input.productStatus.label} / ${input.productStatus.stage}。`,
    nextRisk: scenarioFailures.length
      ? '先修复状态中心样例失败，避免前端继续显示矛盾状态。'
      : missingPages.length
        ? `还有页面未纳入统一状态中心：${missingPages.join('、')}。`
        : input.busy
          ? '当前有真实耗时操作，等待完成后再判断是否可邀请。'
          : input.productStatus.stage === 'has_problem'
            ? '当前 runtime 存在问题，应优先进入诊断修复中心。'
            : input.productStatus.stage === 'server_missing'
              ? '当前缺少游戏服务端或端口监听，先启动服务端再邀请好友。'
              : input.routeUsesLanInvite === false
                ? '当前路线不是 LAN 邀请，继续确认复制的是路线说明而不是 n2n 邀请包。'
                : '继续用真实 exe 做 Header、首页、组网中心、推荐页之间的状态同步测试。',
  };
}

export function formatProductStateConsistencyAuditReport(input: ProductStateConsistencyAuditInput) {
  const audit = buildProductStateConsistencyAudit(input);
  return [
    '[联机助手发布级状态一致性自检]',
    audit.summary,
    '',
    '当前状态：',
    `- 状态标签：${input.productStatus.label}`,
    `- 阶段：${input.productStatus.stage}`,
    `- 语气：${input.productStatus.tone}`,
    `- 可邀请：${input.productStatus.canInvite ? '是' : '否'}`,
    `- 需要组网：${input.productStatus.needsNetwork ? '是' : '否'}`,
    `- 需要服务端：${input.productStatus.needsServer ? '是' : '否'}`,
    `- 下一步：${input.productStatus.nextAction}`,
    `- runtime 已读取：${input.runtimeLoaded ? '是' : '否'}`,
    `- busy：${input.busy || '空闲'}`,
    `- n2n running/ready/error：${input.network.running ? '是' : '否'} / ${input.network.ready ? '是' : '否'} / ${input.network.hasError ? '是' : '否'}`,
    `- 虚拟 IP：${input.network.virtualIp || '未读取'}`,
    `- Supernode：${input.network.supernode || '未读取'}`,
    `- runtime 错误数：${input.runtimeErrorCount}`,
    `- 诊断报告：${input.hasReport ? '有' : '无'}`,
    `- 邀请失败上下文：${input.hasInviteDiagnosticContext ? '有' : '无'}`,
    `- 房主失败上下文：${input.hasHostDiagnosticContext ? '有' : '无'}`,
    `- 高级工具复盘：${input.hasLatestAdvancedToolFix ? '有' : '无'}`,
    `- 当前路线：${input.routeTitle || '未绑定'} / ${input.routeKind || 'unknown'} / ${input.routeUsesLanInvite === false ? '非 LAN 邀请' : input.routeUsesLanInvite === true ? 'LAN 邀请' : '未判断'}`,
    `- 覆盖页面：${audit.coveredPages.join('、') || '无'}`,
    `- 缺失页面：${audit.missingPages.join('、') || '无'}`,
    `- 下一风险：${audit.nextRisk}`,
    '',
    '状态中心样例：',
    ...audit.scenarios.map((scenario, index) => [
      `${index + 1}. ${scenario.label} [${scenario.passed ? 'PASS' : 'FAIL'}]`,
      `   期望：${scenario.expected}`,
      `   实际：${scenario.actual}`,
      scenario.mismatch.length ? `   差异：${scenario.mismatch.join('；')}` : '   差异：无',
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
