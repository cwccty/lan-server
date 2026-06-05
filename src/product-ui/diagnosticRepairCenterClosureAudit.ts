import type {
  DiagnosticBackendFixOperation,
  DiagnosticIssueType,
  ProductDiagnosticFixGroup,
} from './errorActions';

export type DiagnosticRepairCenterClosureAuditStatus = 'wired' | 'observed' | 'manual_check';

export interface DiagnosticRepairCenterClosureAuditItem {
  id: string;
  label: string;
  status: DiagnosticRepairCenterClosureAuditStatus;
  evidence: string;
  manualCheck: string;
}

export interface DiagnosticRepairCenterClosureAuditInput {
  supportedIssueTypes: DiagnosticIssueType[];
  backendOperations: DiagnosticBackendFixOperation[];
  fixGroups: ProductDiagnosticFixGroup[];
  routePrimaryFixGroupCount: number;
  routeDeprioritizedFixGroupCount: number;
  hasReport: boolean;
  targetLabel: string;
  issueCount: number;
  requiredPassed: number;
  requiredTotal: number;
  hasFixRetestResult: boolean;
  fixHistoryCount: number;
  hasLatestAdvancedToolFix: boolean;
  hasInviteDiagnosticContext: boolean;
  hasHostDiagnosticContext: boolean;
  hasDiagnosticConversionAdvice: boolean;
  autoNextStepId: string;
  autoNextStepActionKind: string;
  runtimeLoaded: boolean;
  busy: string;
}

const REQUIRED_ISSUE_TYPES: DiagnosticIssueType[] = [
  'n2n_missing',
  'n2n_not_running',
  'supernode',
  'n2n_auth_or_ip_conflict',
  'n2n_virtual_ip',
  'game_port_or_proxy',
  'server_runtime',
  'firewall_or_permission',
  'version_mismatch',
  'adapter_missing',
];

const REQUIRED_BACKEND_OPERATIONS: DiagnosticBackendFixOperation[] = [
  'detect_edge_path',
  'start_n2n_last_config',
  'restart_n2n_last_config',
  'refresh_runtime',
  'test_local_game_port',
];

const STATIC_AUDIT_ITEMS: DiagnosticRepairCenterClosureAuditItem[] = [
  {
    id: 'issue-classification-complete',
    label: '问题分类完整',
    status: 'wired',
    evidence: 'errorActions 将 edge.exe 缺失、n2n 未启动、Supernode、IP/MAC 冲突、虚拟 IP、游戏端口/代理、服务端、防火墙/权限、版本不匹配、adapter 缺失映射为修复分组。',
    manualCheck: '制造或选择对应诊断问题时，诊断页应显示清晰的问题组，而不是只显示原始日志。',
  },
  {
    id: 'backend-one-click-fixes',
    label: '一键后端修复',
    status: 'wired',
    evidence: 'ProductDiagnosticsView.runBackendFix 支持重新检测 edge.exe、启动/重启 n2n、刷新 runtime、本机游戏端口检测。',
    manualCheck: '点击一键修复后，必须调用真实后端动作并自动复测，不允许只改文字。',
  },
  {
    id: 'manual-copy-commands',
    label: '手动命令可复制',
    status: 'wired',
    evidence: '各修复组提供复制给房主/管理员的命令或检查说明，例如 VPS supernode、虚拟网卡、防火墙、端口、版本核对。',
    manualCheck: '每个无法完全自动修的问题都应有可复制说明，用户可以发给好友或管理员。',
  },
  {
    id: 'grouped-fix-center-ui',
    label: '问题修复中心 UI',
    status: 'wired',
    evidence: 'ProductDiagnosticsView 将 issue 合并为 fixGroups，并在“问题修复中心”中按问题组展示原因、证据和动作。',
    manualCheck: '同类问题应合并，避免用户看到一堆重复日志；最上方应是优先处理项。',
  },
  {
    id: 'auto-retest-after-fix',
    label: '修复后自动复测',
    status: 'wired',
    evidence: 'autoRetestAfterFix + buildFixRetestResult 会在一键修复后重新生成诊断并比较修复前后问题数量。',
    manualCheck: '执行一键修复后应出现“修复后自动复测”，显示问题数、必需项、已解决/仍存在/新出现。',
  },
  {
    id: 'fix-history-recap',
    label: '修复历史与复盘',
    status: 'wired',
    evidence: 'FIX_HISTORY_KEY、copyFixHistoryEntry、copyAllFixHistory 保存最近修复和自测复盘，可复制给朋友/管理员。',
    manualCheck: '完成一键修复或高级工具自测后，历史区应出现条目，并能复制单条或全部复盘。',
  },
  {
    id: 'invite-failure-handoff',
    label: '邀请失败承接',
    status: 'wired',
    evidence: '诊断页读取 inviteDiagnosticContext，支持按邀请失败或 pending 状态生成诊断。',
    manualCheck: '好友粘贴邀请包失败后，诊断页应自动带入房间、Supernode、房主虚拟 IP、端口和失败分类。',
  },
  {
    id: 'host-failure-handoff',
    label: '房主失败承接',
    status: 'wired',
    evidence: '诊断页读取 hostDiagnosticContext，支持按房主失败生成诊断，并带参数进入高级工具。',
    manualCheck: '房主开房失败后，诊断页应展示失败原因、端口、路线和建议动作。',
  },
  {
    id: 'conversion-route-correction',
    label: '转换路线纠错',
    status: 'wired',
    evidence: 'diagnosticConversionAdvice 根据游戏转换路线调整修复优先级，避免本地同屏/Steam/官方服错误修 n2n。',
    manualCheck: '非 LAN 游戏出现问题时，诊断页应优先给远程同屏、Steam、官方入口或方案库建议。',
  },
  {
    id: 'advanced-tool-prefill-history',
    label: '高级工具闭环',
    status: 'wired',
    evidence: '诊断页能把端口代理/UDP 广播桥建议写入 AdvancedToolIntent，并接收高级工具自测历史。',
    manualCheck: '端口代理或广播桥问题应能“带参数去高级工具”，自测后回到诊断页可复制复盘。',
  },
  {
    id: 'auto-next-step-decision',
    label: '自动下一步决策',
    status: 'wired',
    evidence: 'buildDiagnosticAutoNextStepDecision 汇总报告、路线纠错、修复组、邀请/房主上下文和高级工具历史，生成一个主按钮。',
    manualCheck: '无报告时先生成诊断；有可执行修复时优先运行；路线错误时优先跳推荐/高级工具/方案库。',
  },
  {
    id: 'route-aware-n2n-deprioritized',
    label: '按路线降权 n2n',
    status: 'wired',
    evidence: 'data-diagnostic-n2n-fixes-deprioritized="route-aware" 将非 LAN 路线下的 n2n 修复移到低优先级区域。',
    manualCheck: '本地同屏、Steam P2P、官方服限定时，不应让用户第一反应去修 edge/supernode。',
  },
  {
    id: 'version-mismatch-guide',
    label: '版本风险处理',
    status: 'wired',
    evidence: 'version_mismatch 分组提供刷新 runtime、去方案库核对 adapter 测试版本、复制版本检查说明。',
    manualCheck: '游戏/服务端/adapter/n2n 版本不一致时，应提示核对版本，而不是只检查端口。',
  },
  {
    id: 'copyable-diagnostic-report',
    label: '诊断报告可复制导出',
    status: 'wired',
    evidence: 'copyReport、exportReport、formatDiagnosticRecord 支持复制和导出完整诊断报告。',
    manualCheck: '用户应能把完整报告发给朋友/管理员，不需要截图长日志。',
  },
];

function hasAll<T extends string>(values: T[], required: T[]) {
  const set = new Set(values);
  return required.every((item) => set.has(item));
}

function groupIds(input: DiagnosticRepairCenterClosureAuditInput) {
  return input.fixGroups.map((group) => group.id);
}

function hasBackendAction(input: DiagnosticRepairCenterClosureAuditInput) {
  return input.fixGroups.some((group) => group.actions.some((action) => action.kind === 'backend'));
}

function hasCopyAction(input: DiagnosticRepairCenterClosureAuditInput) {
  return input.fixGroups.some((group) => group.actions.some((action) => action.kind === 'copy'));
}

function markObserved(item: DiagnosticRepairCenterClosureAuditItem, input: DiagnosticRepairCenterClosureAuditInput): DiagnosticRepairCenterClosureAuditItem {
  const allTypes = hasAll(input.supportedIssueTypes, REQUIRED_ISSUE_TYPES);
  const allBackendOps = hasAll(input.backendOperations, REQUIRED_BACKEND_OPERATIONS);
  const ids = groupIds(input);

  if (item.id === 'issue-classification-complete' && allTypes) return { ...item, status: 'observed' };
  if (item.id === 'backend-one-click-fixes' && allBackendOps) return { ...item, status: hasBackendAction(input) ? 'observed' : 'wired' };
  if (item.id === 'manual-copy-commands' && allTypes) return { ...item, status: hasCopyAction(input) ? 'observed' : 'wired' };
  if (item.id === 'grouped-fix-center-ui' && input.hasReport) return { ...item, status: 'observed' };
  if (item.id === 'auto-retest-after-fix' && input.hasFixRetestResult) return { ...item, status: 'observed' };
  if (item.id === 'fix-history-recap' && input.fixHistoryCount > 0) return { ...item, status: 'observed' };
  if (item.id === 'invite-failure-handoff' && input.hasInviteDiagnosticContext) return { ...item, status: 'observed' };
  if (item.id === 'host-failure-handoff' && input.hasHostDiagnosticContext) return { ...item, status: 'observed' };
  if (item.id === 'conversion-route-correction' && input.hasDiagnosticConversionAdvice) return { ...item, status: 'observed' };
  if (item.id === 'advanced-tool-prefill-history' && input.hasLatestAdvancedToolFix) return { ...item, status: 'observed' };
  if (item.id === 'auto-next-step-decision' && input.autoNextStepId) return { ...item, status: 'observed' };
  if (item.id === 'route-aware-n2n-deprioritized' && input.routeDeprioritizedFixGroupCount > 0) return { ...item, status: 'observed' };
  if (item.id === 'version-mismatch-guide' && input.supportedIssueTypes.includes('version_mismatch')) return { ...item, status: ids.includes('version_mismatch') ? 'observed' : 'wired' };
  if (item.id === 'copyable-diagnostic-report' && input.hasReport) return { ...item, status: 'observed' };
  return item;
}

export function buildDiagnosticRepairCenterClosureAudit(input: DiagnosticRepairCenterClosureAuditInput) {
  const items = STATIC_AUDIT_ITEMS.map((item) => markObserved(item, input));
  const observedCount = items.filter((item) => item.status === 'observed').length;
  const missingIssueTypes = REQUIRED_ISSUE_TYPES.filter((type) => !input.supportedIssueTypes.includes(type));
  const missingBackendOperations = REQUIRED_BACKEND_OPERATIONS.filter((operation) => !input.backendOperations.includes(operation));
  const backendActionCount = input.fixGroups.reduce((total, group) => total + group.actions.filter((action) => action.kind === 'backend').length, 0);
  const copyActionCount = input.fixGroups.reduce((total, group) => total + group.actions.filter((action) => action.kind === 'copy').length, 0);

  return {
    items,
    wiredCount: items.length,
    observedCount,
    missingIssueTypes,
    missingBackendOperations,
    backendActionCount,
    copyActionCount,
    summary: `已固化 ${items.length} 项诊断修复中心闭环能力；当前报告问题 ${input.issueCount} 个，修复组 ${input.fixGroups.length} 类，一键后端动作 ${backendActionCount} 个，复制/手动说明 ${copyActionCount} 个。`,
    nextRisk: missingIssueTypes.length || missingBackendOperations.length
      ? '先补齐问题类型或后端修复操作守卫。'
      : !input.hasReport
        ? '先生成真实诊断报告，再验证修复中心是否按问题分类给出动作。'
        : input.fixGroups.length > 0 && !input.hasFixRetestResult
          ? '建议执行一个一键修复，确认自动复测和复盘写入。'
          : input.fixHistoryCount === 0
            ? '建议复制/保存一次修复复盘，验证远程协助链路。'
            : '继续用真实失败场景验证每个问题组的修复效果。',
  };
}

export function formatDiagnosticRepairCenterClosureAuditReport(input: DiagnosticRepairCenterClosureAuditInput) {
  const audit = buildDiagnosticRepairCenterClosureAudit(input);
  return [
    '[联机助手诊断页问题修复中心闭环自检]',
    audit.summary,
    '',
    '当前状态：',
    `- 诊断目标：${input.targetLabel || '未选择'}`,
    `- 报告：${input.hasReport ? '已生成' : '未生成'}`,
    `- 必需项：${input.requiredPassed}/${input.requiredTotal || '-'}`,
    `- 路线优先修复组：${input.routePrimaryFixGroupCount}`,
    `- 路线降权 n2n 修复组：${input.routeDeprioritizedFixGroupCount}`,
    `- 修复后自动复测：${input.hasFixRetestResult ? '已有' : '暂无'}`,
    `- 修复历史：${input.fixHistoryCount} 条`,
    `- 邀请失败上下文：${input.hasInviteDiagnosticContext ? '有' : '无'}`,
    `- 房主失败上下文：${input.hasHostDiagnosticContext ? '有' : '无'}`,
    `- 转换路线纠错：${input.hasDiagnosticConversionAdvice ? '有' : '无'}`,
    `- 高级工具复盘：${input.hasLatestAdvancedToolFix ? '有' : '无'}`,
    `- 自动下一步：${input.autoNextStepId || '无'} / ${input.autoNextStepActionKind || 'none'}`,
    `- runtime 已读取：${input.runtimeLoaded ? '是' : '否'}`,
    `- 当前忙碌状态：${input.busy || '空闲'}`,
    `- 缺失问题类型：${audit.missingIssueTypes.join('、') || '无'}`,
    `- 缺失后端操作：${audit.missingBackendOperations.join('、') || '无'}`,
    `- 下一风险：${audit.nextRisk}`,
    '',
    '当前修复组：',
    ...(input.fixGroups.length
      ? input.fixGroups.map((group) => [
        `- ${group.title} (${group.id})`,
        `  影响：${group.issueCount} 项｜严重度：${group.severity}`,
        `  动作：${group.actions.map((action) => `${action.label}/${action.kind}`).join('；')}`,
      ].join('\n'))
      : ['- 当前没有修复组。']),
    '',
    '自检清单：',
    ...audit.items.map((item, index) => [
      `${index + 1}. ${item.label} [${item.status}]`,
      `   证据：${item.evidence}`,
      `   人工验证：${item.manualCheck}`,
    ].join('\n')),
  ].join('\n');
}
