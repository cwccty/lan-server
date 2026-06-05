import type { LanInvitePacket } from './invitePacket';
import type { InviteJoinResult } from './inviteJoinFlow';
import type { InviteJoinSuccessRecord } from './inviteJoinSuccess';

export type InviteJoinClosureAuditStatus = 'wired' | 'observed' | 'manual_check';

export interface InviteJoinClosureAuditItem {
  id: string;
  label: string;
  status: InviteJoinClosureAuditStatus;
  evidence: string;
  manualCheck: string;
}

export interface InviteJoinClosureAuditInput {
  detectedInvite: LanInvitePacket | null;
  inviteJoinResult: InviteJoinResult | null;
  successHistory: InviteJoinSuccessRecord[];
}

const STATIC_AUDIT_ITEMS: InviteJoinClosureAuditItem[] = [
  {
    id: 'paste-detect-invite',
    label: '粘贴邀请包并检测',
    status: 'wired',
    evidence: 'ProductNetworkView 使用 parseLanInvitePacket 识别 [联机助手真实邀请包]。',
    manualCheck: '粘贴房主邀请包后，应出现“检测到其他玩家的邀请，是否进入？”。',
  },
  {
    id: 'fill-only-parameters',
    label: '仅填入参数',
    status: 'wired',
    evidence: 'enterInvite 会把房间名、密钥、Supernode、好友预留 IP、房主虚拟 IP 和端口写入表单。',
    manualCheck: '点击“仅填入参数”后，表单字段应被邀请包内容填充，但不会启动 n2n。',
  },
  {
    id: 'save-and-start-n2n',
    label: '保存并启动 n2n',
    status: 'wired',
    evidence: 'startFromInvite 调用 joinFromInvitePacket，内部保存配置并启动 startReferenceN2n。',
    manualCheck: '点击“保存并启动 n2n”后，应进入 joining/pending/joined/failed 之一，不应无反馈。',
  },
  {
    id: 'join-result-card',
    label: '加入结果卡片',
    status: 'wired',
    evidence: 'inviteJoinResult 统一驱动 idle/filled/joining/joined/pending/failed 结果卡。',
    manualCheck: '结果卡应显示标题、说明和房主虚拟 IP:端口。',
  },
  {
    id: 'failure-classification',
    label: '失败原因分类',
    status: 'wired',
    evidence: 'classifyJoinFailure 覆盖 auth、ip_conflict、supernode、edge_missing、permission、config_missing、not_ready。',
    manualCheck: '制造错误密钥、IP 冲突或 Supernode 不通时，失败标题应对应具体原因。',
  },
  {
    id: 'failure-diagnostics-handoff',
    label: '失败进入诊断',
    status: 'wired',
    evidence: 'writeInviteDiagnosticContext 会把失败邀请上下文写入诊断页，诊断页显示 data-diagnostic-invite-failure-context。',
    manualCheck: '点击“带失败信息诊断”后，诊断页应显示邀请加入失败卡片和自动下一步。',
  },
  {
    id: 'copy-error-to-host',
    label: '复制错误给房主',
    status: 'wired',
    evidence: 'buildInviteJoinErrorText 会复制失败分类、错误、房主 IP、好友 IP、Supernode、房间名、端口和 runtime 错误。',
    manualCheck: '点击“复制错误给房主”后，剪贴板文本应可直接发给房主/管理员。',
  },
  {
    id: 'pending-auto-retest',
    label: 'pending 自动复测',
    status: 'wired',
    evidence: 'scheduleInvitePendingAutoRetest 会在 pending 后等待 15 秒自动刷新 ACK/PONG，并写入 pending/failed 上下文。',
    manualCheck: '进入 pending 后，应看到自动复测提示；15 秒后应自动变成 joined、继续 pending 或 failed。',
  },
  {
    id: 'success-game-instruction',
    label: '成功后提示游戏内连接',
    status: 'wired',
    evidence: 'joined 卡片显示房主虚拟 IP:端口，并提供复制游戏内连接说明。',
    manualCheck: 'joined 后应明确提示去游戏内连接房主虚拟 IP 和端口。',
  },
  {
    id: 'host-port-confirmation',
    label: '成功后检测房主游戏端口',
    status: 'wired',
    evidence: 'testInviteHostGamePort 使用 testConnectivity(mode=n2n_game_port) 检测房主虚拟 IP + 游戏端口。',
    manualCheck: 'joined 后点击“检测房主游戏端口”，应显示可连接/不可连接结果。',
  },
  {
    id: 'success-history',
    label: '最近加入成功记录',
    status: 'wired',
    evidence: 'inviteJoinSuccessHistory 保存最近 8 条成功加入记录和端口检测摘要。',
    manualCheck: 'joined 后应出现最近加入成功记录，能看到房主地址和端口。',
  },
];

export function buildInviteJoinClosureAudit(input: InviteJoinClosureAuditInput) {
  const runtimeItems = STATIC_AUDIT_ITEMS.map((item) => {
    if (item.id === 'paste-detect-invite' && input.detectedInvite) return { ...item, status: 'observed' as const };
    if (item.id === 'join-result-card' && input.inviteJoinResult) return { ...item, status: 'observed' as const };
    if (item.id === 'success-history' && input.successHistory.length) return { ...item, status: 'observed' as const };
    if (item.id === 'success-game-instruction' && input.inviteJoinResult?.phase === 'joined') return { ...item, status: 'observed' as const };
    return item;
  });
  const observedCount = runtimeItems.filter((item) => item.status === 'observed').length;
  return {
    items: runtimeItems,
    wiredCount: runtimeItems.length,
    observedCount,
    summary: `已固化 ${runtimeItems.length} 项邀请加入闭环能力；本次界面状态已观察到 ${observedCount} 项。`,
  };
}

export function formatInviteJoinClosureAuditReport(input: InviteJoinClosureAuditInput) {
  const audit = buildInviteJoinClosureAudit(input);
  return [
    '[联机助手邀请加入闭环自检]',
    audit.summary,
    '',
    '当前状态：',
    `- 已检测邀请：${input.detectedInvite ? '是' : '否'}`,
    `- 加入结果：${input.inviteJoinResult?.phase || '暂无'}`,
    `- 最近成功记录：${input.successHistory.length} 条`,
    '',
    '自检清单：',
    ...audit.items.map((item, index) => [
      `${index + 1}. ${item.label} [${item.status}]`,
      `   证据：${item.evidence}`,
      `   人工验证：${item.manualCheck}`,
    ].join('\n')),
  ].join('\n');
}
