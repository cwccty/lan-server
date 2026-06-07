import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Wrench,
  XCircle
} from 'lucide-react';
import {
  generateDiagnosticReport,
  generateDiagnosticReportForGame,
  listGameAdapters,
  openPath,
  scanGames
} from '../api/tauri';
import type { DiagnosticIssue, DiagnosticReport, ReleaseCheck } from '../types/diagnostics';
import type { GameSummary } from '../types/game';
import { getReferenceSelectedGame, setReferenceSelectedGame } from '../reference-adapter/selectedGame';
import { readReferenceRuntimeSnapshot } from '../reference-adapter/runtimeStore';
import { REFERENCE_RUNTIME_EVENT } from '../reference-adapter/bootstrap';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';
import {
  readReferenceN2nLastConfig,
  refreshReferenceRuntime,
  startReferenceN2n,
  stopReferenceN2n,
  testReferenceConnectivity,
  testReferenceEdgePath
} from '../reference-adapter/actions';
import type { AppTab } from '../reference-ui/types';
import { writeAdapterCreationIntent } from './adapterCreationIntent';
import {
  buildDiagnosticFixGroups,
  classifyDiagnosticIssue,
  type DiagnosticBackendFixOperation,
  type DiagnosticIssueType,
  type ProductDiagnosticFixGroup,
  type ProductFixAction,
} from './errorActions';
import { buildAdapterRecommendationRoute } from './adapterRecommendationRoute';
import { buildGameConversionAssessment, buildGameConversionAssessmentReport } from './conversionAssessmentEngine';
import { buildDiagnosticConversionAdvice, type DiagnosticConversionAdvice } from './diagnosticConversionAdvice';
import { writeAdvancedToolIntent } from './advancedToolIntent';
import {
  clearInviteDiagnosticContext,
  formatInviteDiagnosticContext,
  INVITE_DIAGNOSTIC_CONTEXT_UPDATED_EVENT,
  readInviteDiagnosticContext,
  type InviteDiagnosticContext,
} from './inviteDiagnosticContext';
import {
  clearHostDiagnosticContext,
  formatHostDiagnosticContext,
  HOST_DIAGNOSTIC_CONTEXT_KEY,
  HOST_DIAGNOSTIC_CONTEXT_UPDATED_EVENT,
  readHostDiagnosticContext,
  targetFromHostDiagnosticContext,
  type HostDiagnosticContext,
} from './hostDiagnosticContext';
import {
  buildDiagnosticRepairCenterClosureAudit,
  formatDiagnosticRepairCenterClosureAuditReport,
} from './diagnosticRepairCenterClosureAudit';
import {
  buildProductStateConsistencyAudit,
  formatProductStateConsistencyAuditReport,
} from './productStateConsistencyAudit';
import {
  buildRealExeValidationChecklist,
  buildRealExeValidationPublishGate,
  clearRealExeValidationManualResults,
  formatRealExeValidationChecklistReport,
  readRealExeValidationCacheSnapshot,
  readRealExeValidationManualResults,
  summarizeRealExeManualValidationResults,
  writeRealExeValidationManualResult,
  type RealExeManualValidationStatus,
} from './realExeValidationChecklist';
import {
  formatRealExeManualValidationGuideQuickCopy,
  REAL_EXE_MANUAL_VALIDATION_GUIDE_PACKAGE_PATH,
  REAL_EXE_MANUAL_VALIDATION_GUIDE_REPO_PATH,
} from './realExeManualValidationGuide';
import { resolveProductStatusCenter } from './statusCenter';

import { ProductBusyOverlay } from './ProductBusyOverlay';

interface ProductDiagnosticsViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: AppTab) => void;
}

type DiagnosticTargetMode = 'global' | 'selected' | 'game';

interface DiagnosticRecord {
  target_mode: DiagnosticTargetMode;
  target_game_id?: string;
  target_label: string;
  generated_at: string;
  report: DiagnosticReport;
}

interface DiagnosticFixRetestResult {
  actionLabel: string;
  actionMessage: string;
  beforeIssueCount: number;
  afterIssueCount: number;
  beforeRequiredPassed: number;
  afterRequiredPassed: number;
  requiredTotal: number;
  resolvedIssueIds: string[];
  newIssueIds: string[];
  remainingIssueIds: string[];
  summary: string;
  generatedAt: string;
}

interface DiagnosticFixHistoryEntry extends DiagnosticFixRetestResult {
  id: string;
  targetLabel: string;
  targetGameId?: string;
  beforeIssueIds: string[];
  afterIssueIds: string[];
  reportSummary: string;
}

interface DiagnosticAutoNextStepDecision {
  id: string;
  tone: 'idle' | 'info' | 'warning' | 'danger' | 'success';
  title: string;
  summary: string;
  primaryLabel: string;
  actionKind:
    | 'generate_diagnostic'
    | 'open_recommendation'
    | 'open_advanced_tools'
    | 'open_solutions'
    | 'copy_report'
    | 'copy_advanced_recap'
    | 'run_fix_action'
    | 'none';
  fixAction?: ProductFixAction;
  evidence: string[];
}

const TARGET_KEY = 'lan-helper.referenceDiagnosticTarget';
const RECORD_KEY = 'lan-helper.referenceDiagnosticRecord';
const FIX_HISTORY_KEY = 'lan-helper.referenceDiagnosticFixHistory';
const FIX_HISTORY_UPDATED_EVENT = 'lan-helper:diagnostic-fix-history-updated';

const DIAGNOSTIC_REPAIR_SUPPORTED_ISSUE_TYPES: DiagnosticIssueType[] = [
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
  'general',
];

const DIAGNOSTIC_REPAIR_BACKEND_OPERATIONS: DiagnosticBackendFixOperation[] = [
  'detect_edge_path',
  'start_n2n_last_config',
  'restart_n2n_last_config',
  'refresh_runtime',
  'test_local_game_port',
];

function normalizeTarget(value: unknown): { mode: DiagnosticTargetMode; game_id: string } {
  if (!value || typeof value !== 'object') return { mode: 'selected', game_id: '' };
  const record = value as Partial<{ mode: DiagnosticTargetMode; game_id: string }>;
  return {
    mode: record.mode === 'global' || record.mode === 'selected' || record.mode === 'game' ? record.mode : 'selected',
    game_id: String(record.game_id || '')
  };
}

function readTarget() {
  try {
    return normalizeTarget(JSON.parse(window.localStorage.getItem(TARGET_KEY) || 'null'));
  } catch {
    return normalizeTarget(null);
  }
}

function saveTarget(target: { mode: DiagnosticTargetMode; game_id: string }) {
  window.localStorage.setItem(TARGET_KEY, JSON.stringify(target));
}

function readRecord(): DiagnosticRecord | null {
  try {
    const raw = window.localStorage.getItem(RECORD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiagnosticRecord;
    return parsed?.report ? parsed : null;
  } catch {
    return null;
  }
}

function saveRecord(record: DiagnosticRecord) {
  window.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
}

function readFixHistory(): DiagnosticFixHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(FIX_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.actionLabel).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveFixHistory(history: DiagnosticFixHistoryEntry[]) {
  window.localStorage.setItem(FIX_HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
  window.dispatchEvent(new CustomEvent(FIX_HISTORY_UPDATED_EVENT));
}

function isAdvancedToolHistoryEntry(entry: DiagnosticFixHistoryEntry) {
  const joinedIds = [
    ...entry.resolvedIssueIds,
    ...entry.remainingIssueIds,
    ...entry.newIssueIds,
    ...entry.beforeIssueIds,
    ...entry.afterIssueIds,
  ].join(' ');
  const joinedText = `${entry.actionLabel} ${entry.actionMessage} ${entry.summary} ${entry.reportSummary}`;
  return joinedIds.includes('advanced_tool_self_test') || /高级工具|端口代理|广播桥|advanced tool/i.test(joinedText);
}

function isFailedAdvancedToolHistoryEntry(entry: DiagnosticFixHistoryEntry) {
  const joinedIds = [...entry.remainingIssueIds, ...entry.newIssueIds, ...entry.afterIssueIds].join(' ');
  const text = `${entry.actionMessage} ${entry.summary} ${entry.reportSummary}`;
  return entry.afterIssueCount > 0 || joinedIds.includes('advanced_tool_self_test_failed') || /失败|未通过|仍需处理/i.test(text);
}

function targetFromInviteDiagnosticContext(context: InviteDiagnosticContext | null): { mode: DiagnosticTargetMode; game_id: string } | null {
  if (!context) return null;
  const gameId = context.packet.gameId?.trim();
  return gameId ? { mode: 'game', game_id: gameId } : { mode: 'global', game_id: '' };
}

function preferredFixAction(group: ProductDiagnosticFixGroup) {
  return group.actions.find((action) => action.kind === 'backend')
    ?? group.actions.find((action) => action.kind === 'navigate')
    ?? group.actions.find((action) => action.kind === 'copy')
    ?? group.actions[0];
}

function buildDiagnosticAutoNextStepDecision(input: {
  report: DiagnosticReport | null;
  routePrimaryFixGroups: ProductDiagnosticFixGroup[];
  diagnosticConversionAdvice: DiagnosticConversionAdvice | null;
  latestAdvancedToolFix: DiagnosticFixHistoryEntry | null;
  inviteDiagnosticContext: InviteDiagnosticContext | null;
  hostDiagnosticContext: HostDiagnosticContext | null;
}): DiagnosticAutoNextStepDecision {
  if (input.inviteDiagnosticContext && !input.report) {
    const isPendingInvite = input.inviteDiagnosticContext.source === 'invite_join_pending' || input.inviteDiagnosticContext.phase === 'pending';
    return {
      id: isPendingInvite ? 'invite-pending-generate-diagnostic' : 'invite-failure-generate-diagnostic',
      tone: 'warning',
      title: isPendingInvite ? '先按邀请等待状态生成诊断' : '先按邀请加入失败生成诊断',
      summary: isPendingInvite
        ? '检测到好友加入后还在等待确认，已带入房主联机地址、房间名和端口。'
        : '检测到好友加入失败，已带入房主联机地址、房间名和端口。',
      primaryLabel: isPendingInvite ? '按等待状态生成诊断' : '按邀请包生成诊断',
      actionKind: 'generate_diagnostic',
      evidence: [
        `状态：${isPendingInvite ? '等待确认' : '加入失败'}`,
        `房主联机地址：${input.inviteDiagnosticContext.packet.hostVirtualIp || input.inviteDiagnosticContext.connectHost || '未读取'}`,
        `端口：${input.inviteDiagnosticContext.packet.gamePort || input.inviteDiagnosticContext.gamePort || '未读取'}`,
      ],
    };
  }

  if (input.hostDiagnosticContext && !input.report) {
    const openAdvanced = input.hostDiagnosticContext.nextActionKind === 'advanced_tools';
    return {
      id: openAdvanced ? 'host-failure-open-advanced-tools' : 'host-failure-generate-diagnostic',
      tone: openAdvanced ? 'warning' : 'danger',
      title: openAdvanced ? '房主路线需要先配置高级工具' : '先按房主开房失败信息生成诊断',
      summary: openAdvanced
        ? '检测到当前游戏需要端口代理或房间发现辅助，已带入游戏、端口和好友联机地址。'
        : '检测到房主开房失败，已带入当前游戏、推荐方式、端口和服务端状态。',
      primaryLabel: openAdvanced ? '带信息去高级工具' : '按房主失败生成诊断',
      actionKind: openAdvanced ? 'open_advanced_tools' : 'generate_diagnostic',
      evidence: [
        `推荐方式：${input.hostDiagnosticContext.routeTitle}`,
        `端口：${input.hostDiagnosticContext.gamePort || '未读取'}`,
      ],
    };
  }

  if (!input.report) {
    return {
      id: 'generate-first-diagnostic',
      tone: 'idle',
      title: '先生成诊断',
      summary: '还没有诊断报告，无法判断应该修组网、端口、服务端还是游戏方案。',
      primaryLabel: '生成诊断',
      actionKind: 'generate_diagnostic',
      evidence: ['诊断页会读取当前组网、游戏端口和游戏方案状态。'],
    };
  }

  const latestAdvancedFailed = input.latestAdvancedToolFix ? isFailedAdvancedToolHistoryEntry(input.latestAdvancedToolFix) : false;

  if (input.diagnosticConversionAdvice?.shouldShowAdvancedTools) {
    return {
      id: latestAdvancedFailed ? 'continue-failed-advanced-tool' : 'open-advanced-tool-route',
      tone: latestAdvancedFailed ? 'danger' : 'warning',
      title: latestAdvancedFailed ? '高级工具检查未通过，先继续调整连接信息' : '当前方式需要高级工具，先带信息过去',
      summary: latestAdvancedFailed
        ? '最近一次端口代理 / 房间发现辅助检查仍失败，先确认监听端口、目标联机地址和目标端口。'
        : input.diagnosticConversionAdvice.summary,
      primaryLabel: '带信息去高级工具',
      actionKind: 'open_advanced_tools',
      evidence: [
        input.diagnosticConversionAdvice.title,
        input.diagnosticConversionAdvice.routeHint,
        latestAdvancedFailed ? input.latestAdvancedToolFix?.summary || '' : input.diagnosticConversionAdvice.whyDiagnosticMatters,
      ].filter(Boolean),
    };
  }

  if (input.diagnosticConversionAdvice?.shouldDeprioritizeN2nFixes) {
    const goSolutions = input.diagnosticConversionAdvice.targetTab === 'solutions' && input.diagnosticConversionAdvice.shouldCreateAdapterIntent;
    return {
      id: goSolutions ? 'route-needs-solution-review' : 'route-not-n2n-open-recommendation',
      tone: input.diagnosticConversionAdvice.tone === 'blocked' ? 'danger' : 'warning',
      title: input.diagnosticConversionAdvice.title,
      summary: '当前游戏可能不适合优先修通用组网，先回到正确联机方式，避免继续连接错误地址。',
      primaryLabel: goSolutions ? '带建议去方案库' : '打开推荐方案',
      actionKind: goSolutions ? 'open_solutions' : 'open_recommendation',
      evidence: [
        input.diagnosticConversionAdvice.routeHint,
        input.diagnosticConversionAdvice.whyDiagnosticMatters,
        ...input.diagnosticConversionAdvice.suggestedActions.slice(0, 1),
      ],
    };
  }

  if (latestAdvancedFailed && input.latestAdvancedToolFix) {
    return {
      id: 'advanced-tool-failed-without-route-advice',
      tone: 'danger',
      title: '最近高级工具检查仍失败',
      summary: '端口辅助或房间发现辅助还没通过检查，建议先回高级工具调整连接信息，再重新诊断。',
      primaryLabel: '继续调整高级工具',
      actionKind: 'open_advanced_tools',
      evidence: [input.latestAdvancedToolFix.summary],
    };
  }

  const firstGroup = input.routePrimaryFixGroups[0];
  const firstAction = firstGroup ? preferredFixAction(firstGroup) : null;
  if (firstGroup && firstAction) {
    return {
      id: `fix-group-${firstGroup.id}`,
      tone: firstAction.kind === 'backend' ? 'warning' : 'info',
      title: `优先处理：${firstGroup.title}`,
      summary: firstGroup.summary,
      primaryLabel: firstAction.label,
      actionKind: 'run_fix_action',
      fixAction: firstAction,
      evidence: [
        `${firstGroup.issueCount} 个相关问题`,
        ...firstGroup.evidence.slice(0, 2),
      ],
    };
  }

  if (input.report.issues?.length) {
    return {
      id: 'copy-report-for-admin',
      tone: 'info',
      title: '还有问题但没有可自动执行动作',
      summary: '当前问题不适合直接一键处理，请复制完整诊断报告给房主或管理员确认。',
      primaryLabel: '复制完整报告',
      actionKind: 'copy_report',
      evidence: input.report.issues.slice(0, 2).map((issue) => `${issue.id}: ${issue.title}`),
    };
  }

  return {
    id: 'diagnostic-clear',
    tone: input.report.release_ready ? 'success' : 'info',
    title: input.report.release_ready ? '当前诊断没有明确阻断项' : '当前没有明确问题',
    summary: input.report.release_ready
      ? '如果好友仍无法加入，下一步重点确认游戏内连接地址和端口。'
      : '报告没有发现明确问题，可继续复制报告给朋友确认。',
    primaryLabel: '复制完整报告',
    actionKind: 'copy_report',
    evidence: [
      `检查项 ${input.report.required_passed}/${input.report.required_total}`,
      input.report.summary || '无额外摘要',
    ],
  };
}

function autoNextStepToneClass(tone: DiagnosticAutoNextStepDecision['tone']) {
  if (tone === 'danger') return 'border-rose-100 bg-rose-50/85 text-rose-800';
  if (tone === 'warning') return 'border-amber-100 bg-amber-50/85 text-amber-800';
  if (tone === 'success') return 'border-emerald-100 bg-emerald-50/85 text-emerald-800';
  if (tone === 'idle') return 'border-slate-100 bg-slate-50 text-slate-700';
  return 'border-sky-100 bg-sky-50/85 text-sky-800';
}

function formatFixHistoryEntry(entry: DiagnosticFixHistoryEntry) {
  return [
    '[联机助手诊断修复复盘]',
    `目标：${entry.targetLabel}`,
    entry.targetGameId ? `游戏 ID：${entry.targetGameId}` : '',
    `处理时间：${new Date(entry.generatedAt).toLocaleString()}`,
    `执行动作：${entry.actionLabel}`,
    `执行结果：${entry.actionMessage}`,
    '',
    '复测摘要：',
    entry.summary,
    '',
    `问题数量：${entry.beforeIssueCount} -> ${entry.afterIssueCount}`,
    `必需项通过：${entry.beforeRequiredPassed} -> ${entry.afterRequiredPassed}/${entry.requiredTotal || '-'}`,
    '',
    `修复前 issue：${entry.beforeIssueIds.join(', ') || '无'}`,
    `修复后 issue：${entry.afterIssueIds.join(', ') || '无'}`,
    `已解决：${entry.resolvedIssueIds.join(', ') || '无'}`,
    `仍存在：${entry.remainingIssueIds.join(', ') || '无'}`,
    `新出现：${entry.newIssueIds.join(', ') || '无'}`,
    '',
    `最新报告摘要：${entry.reportSummary || '无'}`,
    '',
    '建议：如果仍存在问题，请把这段复盘和完整诊断报告一起发给房主/管理员。'
  ].filter(Boolean).join('\n');
}

function formatDiagnosticRecord(record: DiagnosticRecord) {
  const report = record.report;
  const issue = report.most_likely_cause ?? report.issues?.[0];
  const lines = [
    '# 联机助手诊断报告',
    '',
    `诊断目标: ${record.target_label}`,
    `目标模式: ${record.target_mode}`,
    record.target_game_id ? `游戏 ID: ${record.target_game_id}` : '',
    `报告生成时间: ${record.generated_at}`,
    `后端报告时间: ${report.generated_at}`,
    `应用版本: ${report.app_version}`,
    `系统: ${report.os}`,
    `发布检查: ${report.release_ready ? '通过' : '未通过'} (${report.required_passed}/${report.required_total})`,
    '',
    '## 摘要',
    report.summary || '无摘要',
    '',
    '## 最可能原因',
    issue ? `${issue.severity.toUpperCase()} / ${issue.title}\n${issue.detail}` : '暂无',
    '',
    '## 下一步动作',
    ...(report.next_actions?.length ? report.next_actions.map((item, index) => `${index + 1}. ${item}`) : ['暂无']),
    '',
    '## 问题列表',
    ...(report.issues?.length
      ? report.issues.flatMap((item, index) => [
          `${index + 1}. [${item.severity}] ${item.title}`,
          `   ${item.detail}`,
          ...(item.next_actions ?? []).map((action) => `   - ${action}`),
          ...(item.evidence ?? []).map((evidence) => `   evidence: ${evidence}`)
        ])
      : ['暂无']),
    '',
    '## 发布检查',
    ...(report.release_checks?.length
      ? report.release_checks.map((item) => `- ${item.ok ? 'PASS' : 'FAIL'} ${item.label}: ${item.detail}`)
      : ['暂无']),
    '',
    '## 详细信息',
    ...(report.details?.length ? report.details.map((item) => `- ${item}`) : ['暂无'])
  ].filter((line) => line !== '');
  return lines.join('\n');
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function severityTone(severity: string) {
  const value = severity.toLowerCase();
  if (value.includes('critical') || value.includes('error') || value.includes('high')) return 'border-rose-100 bg-rose-50 text-rose-700';
  if (value.includes('warn') || value.includes('medium')) return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-slate-100 bg-slate-50 text-slate-600';
}

function simplifyText(text: string) {
  return text
    .replace(/^处理\s+/, '')
    .replace(/Terraria 服务端尚未证明 30 秒稳定运行：/g, 'Terraria：')
    .replace(/n2n edge 未运行：/g, '组网服务：')
    .replace(/n2n edge 运行状态：/g, '组网服务：')
    .replace(/有游戏方案需要专用服务端，但当前没有观察到服务端会话：/g, '服务端：')
    .replace(/当前游戏需要专用服务端，但未观察到服务端运行：/g, '服务端：')
    .replace(/处理 内嵌服务端托管状态可观察：/g, '服务端：')
    .replace(/如果服务端退出，查看内嵌控制台的最后日志和 exit_code。/g, '查看服务端最后日志。')
    .replace(/等待至少 30 秒后重新生成诊断报告。/g, '等待 30 秒后重新诊断。')
    .replace(/在通用组网中心点击“启动 n2n edge”。/g, '在组网中心启动组网服务。')
    .replace(/启动后等待 10-20 秒，再查看是否出现 ACK\/PONG。/g, '等待 10-20 秒后刷新状态。')
    .replace(/尚未检测到正在运行的 n2n edge；发布前需要启动一次并确认 supernode 注册成功。/g, '启动组网服务并等待联机确认。')
    .replace(/检测到联机助手记录或系统中正在运行的 n2n edge。/g, '组网服务正在运行。')
    .replace(/已从 edge 日志看到 supernode ACK\/PONG，supernode 响应正常。/g, '联机确认正常。')
    .replace(/ACK\/PONG/g, '联机确认')
    .replace(/Supernode/g, '中继地址')
    .replace(/supernode/g, '中继地址')
    .replace(/n2n edge/g, '组网服务')
    .replace(/n2n/g, '组网')
    .replace(/edge\.exe/g, '组网程序')
    .replace(/edge/g, '组网程序')
    .replace(/adapter-registry/g, '共享方案库')
    .replace(/adapter/g, '游戏方案')
    .replace(/runtime/g, '运行状态')
    .replace(/后端/g, '本机服务')
    .replace(/发布检查/g, '检查项')
    .replace(/真实诊断/g, '诊断')
    .replace(/真实 EXE/g, '客户端')
    .replace(/LAN 邀请/g, '本地联机邀请')
    .replace(/\bLAN\b/g, '本地联机')
    .replace(/\bissue\b/gi, '问题')
    .replace(/\bMVP\b/g, '必需')
    .replace(/虚拟 IP/g, '联机地址')
    .replace(/虚拟IP/g, '联机地址')
    .replace(/virtual IP/gi, '联机地址')
    .trim();
}

function severityLabel(severity: string) {
  const value = severity.toLowerCase();
  if (value.includes('critical') || value.includes('error') || value.includes('high')) return '需要处理';
  if (value.includes('warn') || value.includes('medium')) return '注意';
  return '提示';
}

function uniqueShortList(items: string[] | undefined, limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items ?? []) {
    const text = simplifyText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function inferDiagnosticPort(record: DiagnosticRecord | null, games: GameSummary[], selectedGame?: { game_id?: string } | null) {
  const allText = [
    record?.target_label,
    record?.report?.summary,
    record?.report?.most_likely_cause?.detail,
    ...(record?.report?.details ?? []),
    ...(record?.report?.issues ?? []).flatMap((issue) => [
      issue.detail,
      ...(issue.evidence ?? []),
      ...(issue.next_actions ?? [])
    ])
  ].filter(Boolean).join('\n');
  const portMatch = allText.match(/(?:port|端口|LocalPort)\s*[:=：]?\s*(\d{2,5})/i)
    ?? allText.match(/(?:127\.0\.0\.1|localhost|10(?:\.\d{1,3}){3})[:：](\d{2,5})/i);
  const parsed = portMatch ? Number(portMatch[1]) : 0;
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65535) return parsed;

  const targetGameId = record?.target_game_id || selectedGame?.game_id || '';
  const game = games.find((item) => item.game_id === targetGameId);
  const planPort = game?.connection_plan?.default_join_port;
  if (typeof planPort === 'number' && planPort > 0) return planPort;
  const defaultPorts = (game as GameSummary & { default_ports?: number[] } | undefined)?.default_ports;
  if (defaultPorts?.[0]) return defaultPorts[0];
  return 7777;
}

function issueIds(record: DiagnosticRecord | null | undefined) {
  return (record?.report?.issues ?? []).map((issue) => issue.id);
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildFixRetestResult(
  action: ProductFixAction,
  actionMessage: string,
  beforeRecord: DiagnosticRecord | null,
  afterRecord: DiagnosticRecord,
): DiagnosticFixRetestResult {
  const beforeIds = uniqueIds(issueIds(beforeRecord));
  const afterIds = uniqueIds(issueIds(afterRecord));
  const afterSet = new Set(afterIds);
  const beforeSet = new Set(beforeIds);
  const resolvedIssueIds = beforeIds.filter((id) => !afterSet.has(id));
  const newIssueIds = afterIds.filter((id) => !beforeSet.has(id));
  const remainingIssueIds = afterIds.filter((id) => beforeSet.has(id));
  const beforeIssueCount = beforeRecord?.report?.issues?.length ?? 0;
  const afterIssueCount = afterRecord.report.issues?.length ?? 0;
  const beforeRequiredPassed = beforeRecord?.report?.required_passed ?? 0;
  const afterRequiredPassed = afterRecord.report.required_passed ?? 0;
  const requiredTotal = afterRecord.report.required_total || beforeRecord?.report?.required_total || 0;

  const summary = beforeRecord
    ? afterIssueCount < beforeIssueCount
      ? `问题数从 ${beforeIssueCount} 降到 ${afterIssueCount}，有改善。`
      : afterIssueCount === beforeIssueCount && resolvedIssueIds.length > 0
        ? `问题总数未变，但已解决 ${resolvedIssueIds.length} 项，同时出现 ${newIssueIds.length} 个新项。`
        : afterIssueCount === beforeIssueCount
          ? '问题数暂未变化，建议继续查看剩余证据。'
          : `问题数从 ${beforeIssueCount} 增加到 ${afterIssueCount}，需要查看新问题。`
    : `已生成复测报告，当前问题数 ${afterIssueCount}。`;

  return {
    actionLabel: action.label,
    actionMessage,
    beforeIssueCount,
    afterIssueCount,
    beforeRequiredPassed,
    afterRequiredPassed,
    requiredTotal,
    resolvedIssueIds,
    newIssueIds,
    remainingIssueIds,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

function CheckRow({ check }: { check: ReleaseCheck }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-white p-3">
      {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 text-rose-500" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-800">{check.label}</p>
          {check.required_for_mvp ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">MVP 必需</span> : null}
        </div>
        <p className="mt-1 break-words text-[11px] leading-relaxed text-slate-500">{simplifyText(check.detail)}</p>
      </div>
    </div>
  );
}

function IssueCard({
  issue,
  onRunFix
}: {
  issue: DiagnosticIssue;
  onRunFix?: (action: ProductFixAction) => void;
}) {
  const actions = uniqueShortList(issue.next_actions, 2);
  const evidence = uniqueShortList(issue.evidence, 2);
  const fixActions = classifyDiagnosticIssue(issue);
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${severityTone(issue.severity)}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">{severityLabel(issue.severity)}</span>
            <h4 className="min-w-0 break-words text-sm font-bold">{simplifyText(issue.title)}</h4>
          </div>
          <p className="break-words text-xs leading-relaxed">{simplifyText(issue.detail)}</p>
          {actions.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
              {actions.map((action) => <li className="break-words" key={action}>{action}</li>)}
            </ul>
          ) : null}
          {evidence.length ? (
            <pre
              className="mt-3 max-h-24 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white/70 p-2 text-[11px] leading-relaxed"
              data-diagnostic-technical-details="advanced"
            >
              {evidence.join('\n')}
            </pre>
          ) : null}
          {onRunFix ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {fixActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onRunFix(action)}
                  className="rounded-lg bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 ring-1 ring-black/5 hover:bg-white"
                  title={action.description}
                >
                  {simplifyText(action.label)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function fixGroupTone(severity: string) {
  const value = severity.toLowerCase();
  if (value.includes('critical') || value.includes('error') || value.includes('high')) {
    return 'border-rose-100 bg-rose-50/70 text-rose-800';
  }
  if (value.includes('warn') || value.includes('medium')) {
    return 'border-amber-100 bg-amber-50/70 text-amber-800';
  }
  return 'border-emerald-100 bg-emerald-50/70 text-emerald-800';
}

function FixGroupCard({
  group,
  onRunFix
}: {
  group: ProductDiagnosticFixGroup;
  onRunFix: (action: ProductFixAction) => void;
}) {
  const evidence = uniqueShortList(group.evidence, 3);
  return (
    <article className={`min-w-0 rounded-2xl border p-4 ${fixGroupTone(group.severity)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">影响 {group.issueCount} 项</span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 font-mono text-[10px] font-bold" data-diagnostic-technical-details="advanced">{group.affectedIssueIds.join(', ')}</span>
          </div>
          <h4 className="mt-2 text-sm font-bold">{simplifyText(group.title)}</h4>
          <p className="mt-1 text-xs leading-relaxed">{simplifyText(group.summary)}</p>
        </div>
        <Wrench className="mt-1 h-4 w-4 shrink-0" />
      </div>

      {evidence.length ? (
        <div className="mt-3 rounded-xl bg-white/70 p-3 text-[11px] leading-relaxed" data-diagnostic-technical-details="advanced">
          <p className="mb-1 font-bold">关键证据</p>
          <ul className="list-disc space-y-1 pl-4">
            {evidence.map((item) => <li className="break-words" key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {group.actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onRunFix(action)}
            className="rounded-lg bg-white/85 px-3 py-1.5 text-[11px] font-bold text-slate-700 ring-1 ring-black/5 hover:bg-white"
            title={simplifyText(action.description)}
          >
            {simplifyText(action.label)}
          </button>
        ))}
      </div>
    </article>
  );
}

export function ProductDiagnosticsView({ onTriggerToast, onNavigateTab }: ProductDiagnosticsViewProps) {
  const runtime = useReferenceRuntime();
  const [target, setTarget] = useState(() => readTarget());
  const [record, setRecord] = useState<DiagnosticRecord | null>(() => readRecord());
  const [games, setGames] = useState<GameSummary[]>([]);
  const [busy, setBusy] = useState('');
  const [lastFixResult, setLastFixResult] = useState('');
  const [fixRetestResult, setFixRetestResult] = useState<DiagnosticFixRetestResult | null>(null);
  const [fixHistory, setFixHistory] = useState<DiagnosticFixHistoryEntry[]>(() => readFixHistory());
  const [inviteDiagnosticContext, setInviteDiagnosticContext] = useState<InviteDiagnosticContext | null>(() => readInviteDiagnosticContext());
  const [hostDiagnosticContext, setHostDiagnosticContext] = useState<HostDiagnosticContext | null>(() => readHostDiagnosticContext());
  const [realExeManualResults, setRealExeManualResults] = useState(() => readRealExeValidationManualResults());
  const inviteDiagnosticContextIsPending = inviteDiagnosticContext?.source === 'invite_join_pending' || inviteDiagnosticContext?.phase === 'pending';

  const selectedGame = getReferenceSelectedGame();
  const report = record?.report ?? null;
  const issue = report?.most_likely_cause ?? report?.issues?.[0] ?? null;
  const compactNextActions = uniqueShortList(report?.next_actions, 6);
  const compactReleaseChecks = (report?.release_checks ?? [])
    .filter((check) => check.required_for_mvp || !check.ok)
    .slice(0, 8);
  const compactIssues = (report?.issues ?? []).slice(0, 5);
  const fixGroups = useMemo(() => buildDiagnosticFixGroups(report?.issues ?? []), [report?.issues]);
  const advancedToolFixHistory = useMemo(() => fixHistory.filter(isAdvancedToolHistoryEntry), [fixHistory]);
  const latestAdvancedToolFix = advancedToolFixHistory[0] ?? null;
  const diagnosticGameId = record?.target_game_id || (target.mode === 'selected' ? selectedGame?.game_id || target.game_id : target.game_id);
  const diagnosticGame = useMemo(() => {
    if (!diagnosticGameId) return null;
    return games.find((game) => game.game_id === diagnosticGameId) ?? null;
  }, [diagnosticGameId, games]);
  const diagnosticAdapterRoute = useMemo(
    () => buildAdapterRecommendationRoute(diagnosticGame),
    [diagnosticGame],
  );
  const diagnosticConversionAssessment = useMemo(
    () => buildGameConversionAssessment(diagnosticGame, diagnosticAdapterRoute),
    [diagnosticAdapterRoute, diagnosticGame],
  );
  const diagnosticConversionAdvice = useMemo(
    () => report ? buildDiagnosticConversionAdvice(diagnosticGame, diagnosticAdapterRoute, diagnosticConversionAssessment, report.issues ?? []) : null,
    [diagnosticAdapterRoute, diagnosticConversionAssessment, diagnosticGame, report],
  );
  const n2nFixGroupIds: ProductDiagnosticFixGroup['id'][] = [
    'n2n_missing',
    'n2n_not_running',
    'supernode',
    'n2n_auth_or_ip_conflict',
    'n2n_virtual_ip',
  ];
  const routePrimaryFixGroups = diagnosticConversionAdvice?.shouldDeprioritizeN2nFixes
    ? fixGroups.filter((group) => !n2nFixGroupIds.includes(group.id))
    : fixGroups;
  const routeDeprioritizedFixGroups = diagnosticConversionAdvice?.shouldDeprioritizeN2nFixes
    ? fixGroups.filter((group) => n2nFixGroupIds.includes(group.id))
    : [];
  const diagnosticAutoNextStep = useMemo(
    () => buildDiagnosticAutoNextStepDecision({
      report,
      routePrimaryFixGroups,
      diagnosticConversionAdvice,
      latestAdvancedToolFix,
      inviteDiagnosticContext,
      hostDiagnosticContext,
    }),
    [diagnosticConversionAdvice, hostDiagnosticContext, inviteDiagnosticContext, latestAdvancedToolFix, report, routePrimaryFixGroups],
  );
  const productStatus = useMemo(
    () => resolveProductStatusCenter({
      loaded: runtime.loaded,
      snapshot: runtime.snapshot,
      network: runtime.network,
      errors: runtime.errors,
      busy,
    }),
    [busy, runtime.errors, runtime.loaded, runtime.network, runtime.snapshot],
  );
  const productStateConsistencyAuditInput = useMemo(() => ({
    productStatus,
    runtimeLoaded: runtime.loaded,
    busy,
    network: runtime.network,
    runtimeErrorCount: runtime.errors.length,
    hasReport: Boolean(report),
    hasInviteDiagnosticContext: Boolean(inviteDiagnosticContext),
    hasHostDiagnosticContext: Boolean(hostDiagnosticContext),
    hasLatestAdvancedToolFix: Boolean(latestAdvancedToolFix),
    routeUsesLanInvite: diagnosticAdapterRoute.canCreateLanInvite,
    routeKind: diagnosticAdapterRoute.kind,
    routeTitle: diagnosticAdapterRoute.title,
    pageCoverage: {
      home: true,
      header: true,
      network: true,
      recommendation: true,
      diagnostics: true,
      advanced_tools: true,
    },
  }), [
    busy,
    diagnosticAdapterRoute.canCreateLanInvite,
    diagnosticAdapterRoute.kind,
    diagnosticAdapterRoute.title,
    hostDiagnosticContext,
    inviteDiagnosticContext,
    latestAdvancedToolFix,
    productStatus,
    report,
    runtime.errors.length,
    runtime.loaded,
    runtime.network,
  ]);
  const productStateConsistencyAudit = useMemo(
    () => buildProductStateConsistencyAudit(productStateConsistencyAuditInput),
    [productStateConsistencyAuditInput],
  );
  const realExeValidationCacheSnapshot = useMemo(() => readRealExeValidationCacheSnapshot(), [busy, report, fixHistory.length]);
  const realExeValidationChecklistInput = useMemo(() => ({
    appVersion: report?.app_version || 'v0.1',
    runtimeLoaded: runtime.loaded,
    busy,
    network: runtime.network,
    terraria: {
      running: runtime.terraria.running,
      ready: runtime.terraria.ready,
      message: runtime.terraria.message,
    },
    hasReport: Boolean(report),
    issueCount: report?.issues?.length ?? 0,
    requiredPassed: report?.required_passed ?? 0,
    requiredTotal: report?.required_total ?? 0,
    hasInviteDiagnosticContext: Boolean(inviteDiagnosticContext),
    hasHostDiagnosticContext: Boolean(hostDiagnosticContext),
    hasLatestAdvancedToolFix: Boolean(latestAdvancedToolFix),
    fixHistoryCount: fixHistory.length,
    routeUsesLanInvite: diagnosticAdapterRoute.canCreateLanInvite,
    routeKind: diagnosticAdapterRoute.kind,
    routeTitle: diagnosticAdapterRoute.title,
    cacheSnapshot: realExeValidationCacheSnapshot,
  }), [
    busy,
    diagnosticAdapterRoute.canCreateLanInvite,
    diagnosticAdapterRoute.kind,
    diagnosticAdapterRoute.title,
    fixHistory.length,
    hostDiagnosticContext,
    inviteDiagnosticContext,
    latestAdvancedToolFix,
    realExeValidationCacheSnapshot,
    report,
    runtime.loaded,
    runtime.network,
    runtime.terraria.message,
    runtime.terraria.ready,
    runtime.terraria.running,
  ]);
  const realExeValidationChecklist = useMemo(
    () => buildRealExeValidationChecklist(realExeValidationChecklistInput),
    [realExeValidationChecklistInput],
  );
  const realExeManualSummary = useMemo(
    () => summarizeRealExeManualValidationResults(realExeManualResults),
    [realExeManualResults],
  );
  const realExePublishGate = useMemo(
    () => buildRealExeValidationPublishGate(realExeValidationChecklist.items, realExeManualResults),
    [realExeManualResults, realExeValidationChecklist.items],
  );
  const diagnosticRepairCenterClosureAuditInput = useMemo(() => ({
    supportedIssueTypes: DIAGNOSTIC_REPAIR_SUPPORTED_ISSUE_TYPES,
    backendOperations: DIAGNOSTIC_REPAIR_BACKEND_OPERATIONS,
    fixGroups,
    routePrimaryFixGroupCount: routePrimaryFixGroups.length,
    routeDeprioritizedFixGroupCount: routeDeprioritizedFixGroups.length,
    hasReport: Boolean(report),
    targetLabel: record?.target_label || selectedGame?.display_name || target.game_id || '全局诊断',
    issueCount: report?.issues?.length ?? 0,
    requiredPassed: report?.required_passed ?? 0,
    requiredTotal: report?.required_total ?? 0,
    hasFixRetestResult: Boolean(fixRetestResult),
    fixHistoryCount: fixHistory.length,
    hasLatestAdvancedToolFix: Boolean(latestAdvancedToolFix),
    hasInviteDiagnosticContext: Boolean(inviteDiagnosticContext),
    hasHostDiagnosticContext: Boolean(hostDiagnosticContext),
    hasDiagnosticConversionAdvice: Boolean(diagnosticConversionAdvice),
    autoNextStepId: diagnosticAutoNextStep.id,
    autoNextStepActionKind: diagnosticAutoNextStep.actionKind,
    runtimeLoaded: runtime.loaded,
    busy,
  }), [
    busy,
    diagnosticAutoNextStep.actionKind,
    diagnosticAutoNextStep.id,
    diagnosticConversionAdvice,
    fixGroups,
    fixHistory.length,
    fixRetestResult,
    hostDiagnosticContext,
    inviteDiagnosticContext,
    latestAdvancedToolFix,
    record?.target_label,
    report,
    routeDeprioritizedFixGroups.length,
    routePrimaryFixGroups.length,
    runtime.loaded,
    selectedGame?.display_name,
    target.game_id,
  ]);
  const diagnosticRepairCenterClosureAudit = useMemo(
    () => buildDiagnosticRepairCenterClosureAudit(diagnosticRepairCenterClosureAuditInput),
    [diagnosticRepairCenterClosureAuditInput],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([scanGames().catch(() => []), listGameAdapters().catch(() => [])]).then(([scanned, adapters]) => {
      if (cancelled) return;
      const map = new Map<string, GameSummary>();
      scanned.forEach((game) => map.set(game.game_id, game));
      adapters.forEach((adapter) => {
        if (!map.has(adapter.game_id)) {
          map.set(adapter.game_id, {
            game_id: adapter.game_id,
            display_name: adapter.display_name,
            steam_appid: adapter.steam_appid,
            detected_path: '',
            capabilities: adapter.capabilities ?? [],
            multiplayer_conversion: adapter.multiplayer_conversion,
            network_type: adapter.network_type,
            connection_plan: adapter.connection_plan,
            applicability: adapter.applicability,
            evidence: adapter.evidence,
            adapter_source: adapter.adapter_source
          });
        }
      });
      setGames(Array.from(map.values()).sort((a, b) => a.display_name.localeCompare(b.display_name)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refreshFixHistory = () => {
      setFixHistory(readFixHistory());
    };
    const refreshFixHistoryFromStorage = (event: StorageEvent) => {
      if (event.key === FIX_HISTORY_KEY) refreshFixHistory();
    };
    window.addEventListener(FIX_HISTORY_UPDATED_EVENT, refreshFixHistory);
    window.addEventListener('focus', refreshFixHistory);
    window.addEventListener('storage', refreshFixHistoryFromStorage);
    return () => {
      window.removeEventListener(FIX_HISTORY_UPDATED_EVENT, refreshFixHistory);
      window.removeEventListener('focus', refreshFixHistory);
      window.removeEventListener('storage', refreshFixHistoryFromStorage);
    };
  }, []);

  useEffect(() => {
    const refreshRealExeManualResults = () => setRealExeManualResults(readRealExeValidationManualResults());
    const refreshRealExeManualResultsFromStorage = (event: StorageEvent) => {
      if (event.key === 'lan-helper.product.realExeValidationResults.v1') refreshRealExeManualResults();
    };
    window.addEventListener('lan-helper:real-exe-validation-results-updated', refreshRealExeManualResults);
    window.addEventListener('focus', refreshRealExeManualResults);
    window.addEventListener('storage', refreshRealExeManualResultsFromStorage);
    return () => {
      window.removeEventListener('lan-helper:real-exe-validation-results-updated', refreshRealExeManualResults);
      window.removeEventListener('focus', refreshRealExeManualResults);
      window.removeEventListener('storage', refreshRealExeManualResultsFromStorage);
    };
  }, []);

  useEffect(() => {
    const refreshInviteDiagnosticContext = () => {
      const context = readInviteDiagnosticContext();
      setInviteDiagnosticContext(context);
      const inviteTarget = targetFromInviteDiagnosticContext(context);
      if (inviteTarget) {
        setTarget(inviteTarget);
        saveTarget(inviteTarget);
      }
    };
    const refreshInviteDiagnosticContextFromStorage = (event: StorageEvent) => {
      if (event.key === 'lan-helper.inviteDiagnosticContext') refreshInviteDiagnosticContext();
    };
    window.addEventListener(INVITE_DIAGNOSTIC_CONTEXT_UPDATED_EVENT, refreshInviteDiagnosticContext);
    window.addEventListener('focus', refreshInviteDiagnosticContext);
    window.addEventListener('storage', refreshInviteDiagnosticContextFromStorage);
    if (inviteDiagnosticContext) {
      const inviteTarget = targetFromInviteDiagnosticContext(inviteDiagnosticContext);
      if (inviteTarget) {
        setTarget(inviteTarget);
        saveTarget(inviteTarget);
      }
    }
    return () => {
      window.removeEventListener(INVITE_DIAGNOSTIC_CONTEXT_UPDATED_EVENT, refreshInviteDiagnosticContext);
      window.removeEventListener('focus', refreshInviteDiagnosticContext);
      window.removeEventListener('storage', refreshInviteDiagnosticContextFromStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refreshHostDiagnosticContext = () => {
      const context = readHostDiagnosticContext();
      setHostDiagnosticContext(context);
      const hostTarget = targetFromHostDiagnosticContext(context);
      if (hostTarget) {
        setTarget(hostTarget);
        saveTarget(hostTarget);
      }
    };
    const refreshHostDiagnosticContextFromStorage = (event: StorageEvent) => {
      if (event.key === HOST_DIAGNOSTIC_CONTEXT_KEY) refreshHostDiagnosticContext();
    };
    window.addEventListener(HOST_DIAGNOSTIC_CONTEXT_UPDATED_EVENT, refreshHostDiagnosticContext);
    window.addEventListener('focus', refreshHostDiagnosticContext);
    window.addEventListener('storage', refreshHostDiagnosticContextFromStorage);
    if (hostDiagnosticContext) {
      const hostTarget = targetFromHostDiagnosticContext(hostDiagnosticContext);
      if (hostTarget) {
        setTarget(hostTarget);
        saveTarget(hostTarget);
      }
    }
    return () => {
      window.removeEventListener(HOST_DIAGNOSTIC_CONTEXT_UPDATED_EVENT, refreshHostDiagnosticContext);
      window.removeEventListener('focus', refreshHostDiagnosticContext);
      window.removeEventListener('storage', refreshHostDiagnosticContextFromStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetLabel = useMemo(() => {
    if (target.mode === 'global') return '全局环境';
    const gameId = target.mode === 'selected' ? selectedGame?.game_id || target.game_id : target.game_id;
    if (!gameId) return '当前选中游戏未设置，回退全局环境';
    const game = games.find((item) => item.game_id === gameId);
    return `${game?.display_name || selectedGame?.display_name || gameId} (${gameId})`;
  }, [games, selectedGame?.display_name, selectedGame?.game_id, target.game_id, target.mode]);

  const updateTarget = (next: typeof target) => {
    setTarget(next);
    saveTarget(next);
  };

  const generateAndStoreDiagnosticRecord = async (overrideTarget = target) => {
    const selected = getReferenceSelectedGame();
    const targetGameId =
      overrideTarget.mode === 'global' ? ''
        : overrideTarget.mode === 'selected' ? selected?.game_id || overrideTarget.game_id
          : overrideTarget.game_id;
    const currentLabel = targetGameId
      ? games.find((game) => game.game_id === targetGameId)?.display_name || selected?.display_name || targetGameId
      : overrideTarget.mode === 'global' ? '全局环境' : '当前选中游戏未设置，已回退全局环境';
    const nextReport = targetGameId ? await generateDiagnosticReportForGame(targetGameId) : await generateDiagnosticReport();
    const nextRecord: DiagnosticRecord = {
      target_mode: overrideTarget.mode,
      target_game_id: targetGameId || undefined,
      target_label: targetGameId ? `${currentLabel} (${targetGameId})` : currentLabel,
      generated_at: new Date().toISOString(),
      report: nextReport
    };
    saveRecord(nextRecord);
    setRecord(nextRecord);
    const snapshot = await readReferenceRuntimeSnapshot({ includeDiagnostics: true });
    window.__LAN_HELPER_REFERENCE_RUNTIME__ = snapshot;
    window.dispatchEvent(new CustomEvent(REFERENCE_RUNTIME_EVENT, { detail: snapshot }));
    return nextRecord;
  };

  const runDiagnostic = async (overrideTarget = target) => {
    setBusy('生成诊断');
    try {
      const nextRecord = await generateAndStoreDiagnosticRecord(overrideTarget);
      onTriggerToast(`已生成 ${nextRecord.target_label} 的诊断报告。`);
      return nextRecord;
    } catch (error) {
      onTriggerToast(`生成诊断失败：${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      setBusy('');
    }
  };

  const refreshGames = async () => {
    setBusy('刷新诊断目标');
    try {
      const next = await scanGames();
      setGames(next);
      onTriggerToast('诊断目标游戏列表已刷新。');
    } catch (error) {
      onTriggerToast(`刷新失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copyReport = async () => {
    if (!record) {
      onTriggerToast('尚未生成诊断报告。');
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatDiagnosticRecord(record));
      onTriggerToast('诊断报告已复制到剪贴板。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyDiagnosticRepairCenterClosureAudit = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatDiagnosticRepairCenterClosureAuditReport(diagnosticRepairCenterClosureAuditInput));
      onTriggerToast('诊断修复检查已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyProductStateConsistencyAudit = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatProductStateConsistencyAuditReport(productStateConsistencyAuditInput));
      onTriggerToast('状态一致性检查已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyRealExeValidationChecklist = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatRealExeValidationChecklistReport(realExeValidationChecklistInput, realExeManualResults));
      onTriggerToast('真实 EXE 验证清单已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyRealExeManualValidationGuide = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatRealExeManualValidationGuideQuickCopy());
      onTriggerToast('真实 EXE 人工验证指南已复制。');
    } catch (error) {
      onTriggerToast(`复制指南失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openRealExeManualValidationGuide = async () => {
    try {
      await openPath(REAL_EXE_MANUAL_VALIDATION_GUIDE_REPO_PATH);
      onTriggerToast('已打开仓库内真实 EXE 人工验证指南。');
    } catch {
      try {
        await openPath(REAL_EXE_MANUAL_VALIDATION_GUIDE_PACKAGE_PATH);
        onTriggerToast('已打开发布包内真实 EXE 人工验证指南。');
      } catch (packageError) {
        onTriggerToast(
          `打开指南失败：${packageError instanceof Error ? packageError.message : String(packageError)}；可先点击“复制人工验证指南”。`,
        );
      }
    }
  };

  const markRealExeValidationResult = (itemId: string, status: RealExeManualValidationStatus) => {
    const item = realExeValidationChecklist.items.find((candidate) => candidate.id === itemId);
    const next = writeRealExeValidationManualResult(itemId, status, item?.manualCheck || '');
    setRealExeManualResults(next);
    onTriggerToast(`已记录 ${item?.label || itemId}：${status}`);
  };

  const clearRealExeValidationResults = () => {
    const next = clearRealExeValidationManualResults();
    setRealExeManualResults(next);
    onTriggerToast('已清空本轮真实 EXE 人工验证记录。');
  };

  const exportRealExeValidationChecklist = () => {
    const filename = `lan-helper-real-exe-validation-${Date.now()}.txt`;
    downloadText(filename, formatRealExeValidationChecklistReport(realExeValidationChecklistInput, realExeManualResults));
    onTriggerToast(`真实 EXE 验证记录已导出：${filename}`);
  };

  const exportReport = () => {
    if (!record) {
      onTriggerToast('尚未生成诊断报告。');
      return;
    }
    const safeTarget = record.target_label.replace(/[^\u4e00-\u9fa5\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'diagnostic';
    const filename = `lan-helper-diagnostic-${safeTarget}-${new Date(record.generated_at).getTime() || Date.now()}.txt`;
    downloadText(filename, formatDiagnosticRecord(record));
    onTriggerToast(`诊断报告已导出：${filename}`);
  };

  const copyFixHistoryEntry = async (entry: DiagnosticFixHistoryEntry) => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatFixHistoryEntry(entry));
      onTriggerToast('诊断修复复盘已复制，可发送给房主/管理员。');
    } catch (error) {
      onTriggerToast(`复制复盘失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyAllFixHistory = async () => {
    if (!fixHistory.length) {
      onTriggerToast('暂无诊断修复历史。');
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(fixHistory.map(formatFixHistoryEntry).join('\n\n==========\n\n'));
      onTriggerToast('最近诊断修复历史已复制。');
    } catch (error) {
      onTriggerToast(`复制历史失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearFixHistory = () => {
    saveFixHistory([]);
    setFixHistory([]);
    onTriggerToast('诊断修复历史已清空。');
  };

  const copyInviteDiagnosticContext = async () => {
    if (!inviteDiagnosticContext) {
      onTriggerToast('暂无邀请加入失败上下文。');
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatInviteDiagnosticContext(inviteDiagnosticContext));
      onTriggerToast('邀请加入上下文已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearInviteFailureDiagnostic = () => {
    clearInviteDiagnosticContext();
    setInviteDiagnosticContext(null);
    onTriggerToast('已清除邀请加入上下文。');
  };

  const runInviteFailureDiagnostic = async () => {
    const inviteTarget = targetFromInviteDiagnosticContext(inviteDiagnosticContext) ?? target;
    setTarget(inviteTarget);
    saveTarget(inviteTarget);
    await runDiagnostic(inviteTarget);
  };

  const copyHostDiagnosticContext = async () => {
    if (!hostDiagnosticContext) {
      onTriggerToast('暂无房主开房失败上下文。');
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatHostDiagnosticContext(hostDiagnosticContext));
      onTriggerToast('房主开房失败上下文已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearHostFailureDiagnostic = () => {
    clearHostDiagnosticContext();
    setHostDiagnosticContext(null);
    onTriggerToast('已清除房主开房失败上下文。');
  };

  const runHostFailureDiagnostic = async () => {
    const hostTarget = targetFromHostDiagnosticContext(hostDiagnosticContext) ?? target;
    setTarget(hostTarget);
    saveTarget(hostTarget);
    await runDiagnostic(hostTarget);
  };

  const copyDiagnosticConversionAdvice = async () => {
    if (!diagnosticConversionAdvice) {
      onTriggerToast('当前诊断目标暂无转换路线纠错建议。');
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(diagnosticConversionAdvice.copyText);
      onTriggerToast('转换路线纠错建议已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openRecommendationWithDiagnosticGame = () => {
    if (diagnosticGame) {
      setReferenceSelectedGame(diagnosticGame);
    }
    onNavigateTab('protocol');
    onTriggerToast('已打开推荐方案页，请按转换评估路线继续。');
  };

  const openSolutionsWithDiagnosticAssessment = () => {
    if (!diagnosticGame) {
      onNavigateTab('solutions');
      return;
    }
    writeAdapterCreationIntent({
      source: 'diagnostics',
      reason: 'conversion_assessment',
      game_id: diagnosticGame.game_id,
      display_name: diagnosticGame.display_name,
      steam_appid: diagnosticGame.steam_appid,
      detected_path: diagnosticGame.detected_path,
      network_type: diagnosticGame.network_type || 'unknown_need_review',
      route_kind: diagnosticConversionAssessment.routeKind,
      conversion_verdict: diagnosticConversionAssessment.verdict,
      game_type: diagnosticConversionAssessment.gameType,
      original_capability: diagnosticConversionAssessment.originalCapability,
      recommended_plan: diagnosticConversionAssessment.recommendedPlan,
      can_become_lan: diagnosticConversionAssessment.canBecomeLan,
      default_port: diagnosticGame.connection_plan?.default_join_port || null,
      admin_evidence: diagnosticConversionAssessment.adminEvidence,
      user_steps: diagnosticConversionAssessment.userSteps,
      boundaries: diagnosticConversionAssessment.boundaries,
      adapter_signals: diagnosticConversionAssessment.adapterSignals,
      assessment_report: buildGameConversionAssessmentReport(diagnosticConversionAssessment),
      issue_ids: report?.issues?.map((item) => item.id).slice(0, 8),
      note: diagnosticConversionAdvice?.title || diagnosticConversionAssessment.userConclusion,
    });
    onNavigateTab('solutions');
    onTriggerToast('已把诊断路线纠错建议带入方案库。');
  };

  const openAdvancedToolsWithHostContext = () => {
    if (!hostDiagnosticContext) {
      onNavigateTab('advanced_tools');
      return;
    }
    const useBridge = hostDiagnosticContext.requiresUdpBroadcastBridge || hostDiagnosticContext.routeKind === 'udp_broadcast_bridge';
    const port = hostDiagnosticContext.gamePort || inferDiagnosticPort(record, games, selectedGame);
    writeAdvancedToolIntent({
      source: 'diagnostics',
      reason: useBridge ? 'udp_broadcast_bridge' : 'port_proxy',
      kind: useBridge ? 'bridge' : 'tcp',
      game_id: hostDiagnosticContext.gameId,
      display_name: hostDiagnosticContext.gameName,
      listen_port: port,
      target_host: hostDiagnosticContext.friendVirtualIp || '10.0.8.2',
      target_port: port,
      note: `${hostDiagnosticContext.title}：${hostDiagnosticContext.nextAction}`,
      evidence: [
        `房主失败分类：${hostDiagnosticContext.reasonKind}`,
        `路线：${hostDiagnosticContext.routeTitle}`,
        `房主联机地址：${hostDiagnosticContext.hostVirtualIp || '未读取'}`,
        `好友联机地址：${hostDiagnosticContext.friendVirtualIp || '未选择'}`,
        `端口检测：${hostDiagnosticContext.hostPortCheck || '未检测'}`,
      ],
    });
    onNavigateTab('advanced_tools');
    onTriggerToast('已把房主失败信息预填到高级工具，请核对好友联机地址和端口。');
  };

  const openAdvancedToolsWithDiagnosticIntent = () => {
    if (!diagnosticConversionAdvice || !diagnosticGame) {
      onNavigateTab('advanced_tools');
      return;
    }
    const port = diagnosticGame.connection_plan?.default_join_port || inferDiagnosticPort(record, games, selectedGame);
    const reason = diagnosticAdapterRoute.kind === 'udp_broadcast_bridge' ? 'udp_broadcast_bridge' : 'port_proxy';
    const targetHost = diagnosticGame.connection_plan?.default_join_host && diagnosticGame.connection_plan.default_join_host !== 'host virtual ip'
      ? diagnosticGame.connection_plan.default_join_host
      : runtime.network.virtualIp || '10.0.8.2';
    writeAdvancedToolIntent({
      source: 'diagnostics',
      reason,
      kind: diagnosticAdapterRoute.kind === 'udp_broadcast_bridge' ? 'bridge' : 'tcp',
      game_id: diagnosticGame.game_id,
      display_name: diagnosticGame.display_name,
      listen_port: port,
      target_host: targetHost,
      target_port: port,
      note: diagnosticConversionAdvice.title,
      evidence: [
        diagnosticConversionAdvice.routeHint,
        diagnosticConversionAdvice.whyDiagnosticMatters,
        ...(report?.issues ?? []).slice(0, 3).map((item) => `${item.id}: ${item.title}`),
      ],
    });
    onNavigateTab('advanced_tools');
    onTriggerToast('已把诊断建议和端口信息带入高级工具，请核对目标联机地址。');
  };

  const runBackendFix = async (action: ProductFixAction) => {
    if (!action.operation) throw new Error('缺少修复操作。');

    if (action.operation === 'detect_edge_path') {
      const result = await testReferenceEdgePath();
      const check = result.data;
      return check?.exists
        ? `组网程序检测通过：${check.path}`
        : `仍未找到组网程序：${result.message}`;
    }

    if (action.operation === 'start_n2n_last_config') {
      const configResult = await readReferenceN2nLastConfig();
      if (!configResult.ok || !configResult.data) throw new Error(configResult.message || '没有最近保存的组网配置。');
      const startResult = await startReferenceN2n(configResult.data);
      if (!startResult.ok) throw new Error(startResult.message);
      return `已按最近配置启动组网服务：${startResult.data?.message || startResult.message}`;
    }

    if (action.operation === 'restart_n2n_last_config') {
      const configResult = await readReferenceN2nLastConfig();
      if (!configResult.ok || !configResult.data) throw new Error(configResult.message || '没有最近保存的组网配置。');
      await stopReferenceN2n();
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const startResult = await startReferenceN2n(configResult.data);
      if (!startResult.ok) throw new Error(startResult.message);
      return `已重启组网服务并重新确认：${startResult.data?.message || startResult.message}`;
    }

    if (action.operation === 'refresh_runtime') {
      const result = await refreshReferenceRuntime(true);
      if (!result.ok) throw new Error(result.message);
      return '已刷新状态，请重新生成诊断确认问题是否仍存在。';
    }

    if (action.operation === 'test_local_game_port') {
      const port = inferDiagnosticPort(record, games, selectedGame);
      const result = await testReferenceConnectivity({
        host: '127.0.0.1',
        ports: [port],
        timeout_ms: 1200,
        mode: 'local_game_port'
      });
      if (!result.ok || !result.data) throw new Error(result.message);
      return `本机端口检测：127.0.0.1:${port} ${result.data.reachable ? '已监听' : '未监听'}${result.data.notes.length ? `｜${result.data.notes.join('；')}` : ''}`;
    }

    throw new Error(`未知修复操作：${action.operation}`);
  };

  const autoRetestAfterFix = async (
    action: ProductFixAction,
    actionMessage: string,
    beforeRecord: DiagnosticRecord | null,
  ) => {
    setBusy('等待自动复测');
    setLastFixResult(`${action.label}：${actionMessage}。正在等待 2 秒后自动复测...`);
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    setBusy('自动复测诊断');
    const afterRecord = await generateAndStoreDiagnosticRecord();
    const retest = buildFixRetestResult(action, actionMessage, beforeRecord, afterRecord);
    const historyEntry: DiagnosticFixHistoryEntry = {
      ...retest,
      id: `${Date.now()}-${action.id}`,
      targetLabel: afterRecord.target_label,
      targetGameId: afterRecord.target_game_id,
      beforeIssueIds: uniqueIds(issueIds(beforeRecord)),
      afterIssueIds: uniqueIds(issueIds(afterRecord)),
      reportSummary: afterRecord.report.summary || '',
    };
    setFixRetestResult(retest);
    setFixHistory((previous) => {
      const next = [historyEntry, ...previous].slice(0, 12);
      saveFixHistory(next);
      return next;
    });
    setLastFixResult(`${action.label}：${actionMessage}。自动复测完成：${retest.summary}`);
    return retest;
  };

  const runFixAction = async (action: ProductFixAction) => {
    if (action.kind === 'navigate' && action.targetTab) {
      if (action.targetTab === 'solutions') {
        const targetGameId = record?.target_game_id || selectedGame?.game_id || target.game_id || '';
        const matchedGame = games.find((game) => game.game_id === targetGameId);
        const targetName = targetGameId
          ? matchedGame?.display_name || selectedGame?.display_name || record?.target_label?.replace(/\s*\([^)]*\)\s*$/, '') || targetGameId
          : selectedGame?.display_name || record?.target_label || '';
        writeAdapterCreationIntent({
          source: 'diagnostics',
          reason: 'missing_adapter',
          game_id: targetGameId || undefined,
          display_name: targetName || undefined,
          steam_appid: matchedGame?.steam_appid || null,
          detected_path: matchedGame?.detected_path || null,
          issue_ids: (report?.issues ?? []).filter((item) => item.id === 'selected_game_adapter_missing').map((item) => item.id),
          note: '诊断报告发现当前游戏缺少可用方案。请先同步共享库；若仍缺失，由管理员确认游戏联机类型后保存自建方案。'
        });
      }
      onNavigateTab(action.targetTab);
      onTriggerToast(action.description);
      return;
    }
    if (action.kind === 'backend') {
      const beforeRecord = record;
      setBusy(action.label);
      try {
        const message = await runBackendFix(action);
        const retest = await autoRetestAfterFix(action, message, beforeRecord);
        onTriggerToast(`一键处理并自动复测完成：${retest.summary}`);
      } catch (error) {
        const message = `${action.label}失败：${error instanceof Error ? error.message : String(error)}`;
        setLastFixResult(message);
        onTriggerToast(message);
      } finally {
        setBusy('');
      }
      return;
    }
    if (action.kind === 'copy' && action.copyText) {
      try {
        const clipboard = navigator.clipboard;
        if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
        await clipboard.writeText(action.copyText);
        onTriggerToast('已复制修复命令。');
      } catch (error) {
        onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (action.kind === 'refresh') {
      await runDiagnostic();
    }
  };

  const runDiagnosticAutoNextStep = async () => {
    const decision = diagnosticAutoNextStep;
    if (decision.actionKind === 'generate_diagnostic') {
      if (inviteDiagnosticContext) {
        await runInviteFailureDiagnostic();
        return;
      }
      if (hostDiagnosticContext) {
        await runHostFailureDiagnostic();
        return;
      }
      await runDiagnostic();
      return;
    }
    if (decision.actionKind === 'open_recommendation') {
      openRecommendationWithDiagnosticGame();
      return;
    }
    if (decision.actionKind === 'open_advanced_tools') {
      if (hostDiagnosticContext && decision.id.startsWith('host-')) {
        openAdvancedToolsWithHostContext();
        return;
      }
      openAdvancedToolsWithDiagnosticIntent();
      return;
    }
    if (decision.actionKind === 'open_solutions') {
      openSolutionsWithDiagnosticAssessment();
      return;
    }
    if (decision.actionKind === 'copy_report') {
      await copyReport();
      return;
    }
    if (decision.actionKind === 'copy_advanced_recap' && latestAdvancedToolFix) {
      await copyFixHistoryEntry(latestAdvancedToolFix);
      return;
    }
    if (decision.actionKind === 'run_fix_action' && decision.fixAction) {
      await runFixAction(decision.fixAction);
      return;
    }
    onTriggerToast('当前诊断没有需要立即执行的自动下一步。');
  };

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="diagnostics">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在生成诊断、执行一键修复或自动复测；完成前请不要重复触发操作。" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">诊断报告</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            出问题时先来这里：生成报告、按建议修复，再自动复测。
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${
          report?.release_ready ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : report ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}>
          {report?.release_ready ? <ShieldCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          {busy || (report ? `检查项 ${report.required_passed}/${report.required_total}` : '等待诊断')}
        </div>
      </div>

      <section className={`rounded-2xl border p-5 shadow-sm ${autoNextStepToneClass(diagnosticAutoNextStep.tone)}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-700">先做这一步</span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">
                {report ? `${report.issues?.length ?? 0} 个待处理` : '还没有诊断'}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{simplifyText(diagnosticAutoNextStep.title)}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed">{simplifyText(diagnosticAutoNextStep.summary)}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <button
              onClick={runDiagnosticAutoNextStep}
              disabled={Boolean(busy)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {report ? <Wrench className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              {simplifyText(diagnosticAutoNextStep.primaryLabel)}
            </button>
            {record ? (
              <button
                onClick={copyReport}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <ClipboardCopy className="h-4 w-4" />
                复制报告给朋友
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">报告工具条</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-500">
              先看上面的结论和下一步。需要分享给朋友或回到开房流程时，再用这里的按钮，不再让小操作面板占住整列空间。
            </p>
            {record ? (
              <p className="mt-2 break-words text-[11px] text-slate-400">
                最近报告：{new Date(record.generated_at).toLocaleString()} ｜ {record.target_label}
              </p>
            ) : null}
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:w-auto">
            <button onClick={() => runDiagnostic()} disabled={Boolean(busy)} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
              <Search className="h-4 w-4 shrink-0" />
              重新检测
            </button>
            <button onClick={copyReport} disabled={!record} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <ClipboardCopy className="h-4 w-4 shrink-0" />
              复制报告
            </button>
            <button onClick={exportReport} disabled={!record} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Download className="h-4 w-4 shrink-0" />
              保存文本
            </button>
            <button onClick={() => onNavigateTab('protocol')} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Target className="h-4 w-4 shrink-0" />
              回到开房
            </button>
            <button onClick={() => onNavigateTab('settings')} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Wrench className="h-4 w-4 shrink-0" />
              打开设置
            </button>
          </div>
        </div>
      </section>

      <section
        className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 shadow-sm"
        data-diagnostic-repair-center-closure-audit="checklist"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-indigo-700">诊断问题修复中心最终审计</span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                {diagnosticRepairCenterClosureAudit.observedCount}/{diagnosticRepairCenterClosureAudit.wiredCount} 已观察
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">
                修复组 {fixGroups.length} 类
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">把诊断页从“看报告”固化为“定位问题 → 修复 → 自动复测 → 复制复盘”。</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
              {diagnosticRepairCenterClosureAudit.summary}
              下一风险：{diagnosticRepairCenterClosureAudit.nextRisk}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">一键处理动作</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{diagnosticRepairCenterClosureAudit.backendActionCount} 个</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">手动/复制说明</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{diagnosticRepairCenterClosureAudit.copyActionCount} 个</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">自动复测</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{fixRetestResult ? '已有结果' : '待执行'}</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">复盘历史</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{fixHistory.length} 条</p>
              </div>
            </div>
          </div>
          <button
            onClick={copyDiagnosticRepairCenterClosureAudit}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
          >
            <ClipboardCopy className="h-4 w-4" />
            复制诊断修复检查
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {diagnosticRepairCenterClosureAudit.items.slice(0, 10).map((item) => (
            <span
              key={item.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                item.status === 'observed'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-white/85 text-slate-600'
              }`}
            >
              {item.label}
            </span>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm"
        data-product-state-consistency-audit="checklist"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">发布级状态一致性审计</span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                {productStateConsistencyAudit.observedCount}/{productStateConsistencyAudit.wiredCount} 已观察
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">
                样例 {productStateConsistencyAudit.scenarios.length - productStateConsistencyAudit.scenarioFailures.length}/{productStateConsistencyAudit.scenarios.length}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">把 Header、首页、组网中心、推荐方案和诊断页的真实状态固定为同一套判断。</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
              {productStateConsistencyAudit.summary}
              下一风险：{productStateConsistencyAudit.nextRisk}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">当前阶段</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{productStatus.label} / {productStatus.stage}</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">是否可邀请</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{productStatus.canInvite ? '可以' : '不可以'}</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">运行状态</p>
                <p className="mt-1 text-xs font-bold text-slate-700">
                  {runtime.network.running ? '组网运行中' : '组网未启动'} / {runtime.network.ready ? '确认通过' : '等待确认'}
                </p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">失败上下文</p>
                <p className="mt-1 text-xs font-bold text-slate-700">
                  {inviteDiagnosticContext || hostDiagnosticContext || latestAdvancedToolFix ? '已有上下文' : '暂无'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={copyProductStateConsistencyAudit}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
          >
            <ClipboardCopy className="h-4 w-4" />
            复制状态一致性检查
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {productStateConsistencyAudit.items.slice(0, 10).map((item) => (
            <span
              key={item.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                item.status === 'observed'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-white/85 text-slate-600'
              }`}
            >
              {item.label}
            </span>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm"
        data-real-exe-validation-checklist="checklist"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-emerald-700">真实 EXE 人工验证</span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                {realExeValidationChecklist.observedCount}/{realExeValidationChecklist.wiredCount} 已观察
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">
                页面缓存 {realExeValidationChecklist.cacheReadyCount}/4
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-emerald-700">
                PASS {realExeManualSummary.pass}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-rose-700">
                FAIL {realExeManualSummary.fail}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">
                PENDING {realExeManualSummary.pending}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  realExePublishGate.status === 'ready'
                    ? 'bg-emerald-600 text-white'
                    : realExePublishGate.status === 'blocked'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                }`}
                data-real-exe-publish-gate={realExePublishGate.status}
              >
                发布门禁 {realExePublishGate.criticalPassed}/{realExePublishGate.criticalTotal}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">用打包后的 exe 复测核心链路，不再只看开发环境是否能跑。</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
              {realExeValidationChecklist.summary}
              下一风险：{realExeValidationChecklist.nextRisk}
              发布门禁：{realExePublishGate.summary}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">组网链路</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{runtime.network.ready ? 'ACK/PONG 已通过' : runtime.network.running ? '等待 ACK/PONG' : '未启动'}</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">诊断报告</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{report ? `${report.required_passed}/${report.required_total}` : '未生成'}</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Terraria</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{runtime.terraria.ready ? '已就绪' : runtime.terraria.running ? '运行中' : '未运行'}</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">人工项</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{realExeValidationChecklist.manualCount} 项待确认</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button
              onClick={openRealExeManualValidationGuide}
              className="inline-flex justify-center gap-2 rounded-xl border border-emerald-200 bg-white/90 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-white"
              data-real-exe-manual-validation-guide="open"
            >
              <FileText className="h-4 w-4" />
              打开人工验证指南
            </button>
            <button
              onClick={copyRealExeManualValidationGuide}
              className="inline-flex justify-center gap-2 rounded-xl border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-white"
              data-real-exe-manual-validation-guide="copy"
            >
              <ClipboardCopy className="h-4 w-4" />
              复制人工验证指南
            </button>
            <button
              onClick={copyRealExeValidationChecklist}
              className="inline-flex justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
            >
              <ClipboardCopy className="h-4 w-4" />
              复制真实 EXE 验证清单
            </button>
            <button
              onClick={clearRealExeValidationResults}
              className="inline-flex justify-center rounded-xl border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-white"
            >
              清空本轮记录
            </button>
            <button
              onClick={exportRealExeValidationChecklist}
              className="inline-flex justify-center gap-2 rounded-xl border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-white"
            >
              <Download className="h-4 w-4" />
              导出验证记录
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3" data-real-exe-validation-results="manual-recorder">
          {realExeValidationChecklist.items.slice(0, 12).map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/70 bg-white/75 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                item.status === 'observed'
                  ? 'bg-emerald-100 text-emerald-700'
                  : item.status === 'manual_check'
                    ? 'bg-white/85 text-amber-700'
                    : 'bg-white/85 text-slate-600'
              }`}
                >
                  {item.label}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  realExeManualResults[item.id]?.status === 'PASS'
                    ? 'bg-emerald-100 text-emerald-700'
                    : realExeManualResults[item.id]?.status === 'FAIL'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                }`}>
                  {realExeManualResults[item.id]?.status || 'PENDING'}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{item.manualCheck}</p>
              <div className="mt-3 grid grid-cols-3 gap-1">
                {(['PASS', 'FAIL', 'PENDING'] as RealExeManualValidationStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => markRealExeValidationResult(item.id, status)}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                      status === 'PASS'
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : status === 'FAIL'
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-diagnostic-technical-details="advanced">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Target className="h-4 w-4 text-amber-600" />
              诊断目标
            </h3>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                目标模式
                <select
                  value={target.mode}
                  onChange={(event) => updateTarget({ ...target, mode: event.target.value as DiagnosticTargetMode })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400"
                >
                  <option value="selected">当前选中游戏</option>
                  <option value="game">指定游戏</option>
                  <option value="global">全局环境</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                指定游戏
                <select
                  value={target.game_id}
                  onChange={(event) => updateTarget({ ...target, game_id: event.target.value })}
                  disabled={target.mode === 'global'}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400 disabled:opacity-60"
                >
                  <option value="">未选择</option>
                  {games.map((game) => <option key={game.game_id} value={game.game_id}>{game.display_name} ({game.game_id})</option>)}
                </select>
              </label>
              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                当前目标：<span className="font-semibold text-slate-700">{targetLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => runDiagnostic()} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  <Search className="h-4 w-4" />
                  生成诊断
                </button>
                <button onClick={refreshGames} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  <RefreshCw className={`h-4 w-4 ${busy === '刷新诊断目标' ? 'animate-spin' : ''}`} />
                  刷新目标
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-diagnostic-technical-details="advanced">
            <h3 className="mb-4 text-sm font-bold text-slate-800">运行状态摘要</h3>
            <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
              <p className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 leading-relaxed">组网：<span className="break-words">{runtime.network.label || '暂无'}</span></p>
              <p className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 leading-relaxed">联机地址：<span className="break-words font-mono">{runtime.network.virtualIp || '-'}</span></p>
              <p className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 leading-relaxed">中继地址：<span className="break-words font-mono">{runtime.network.supernode || '-'}</span></p>
              <p className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 leading-relaxed">Terraria：<span className="break-words">{runtime.terraria.message}</span></p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-800">诊断结论</h3>
                <p className="mt-1 max-w-4xl break-words text-xs leading-relaxed text-slate-500">{report?.summary ? simplifyText(report.summary) : '尚未生成诊断报告。'}</p>
              </div>
              {report ? (
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${report.release_ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {report.release_ready ? '检查通过' : '存在待处理项'}
                </span>
              ) : null}
            </div>

            {issue ? <IssueCard issue={issue} onRunFix={runFixAction} /> : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                点击“生成诊断”后，这里会显示最可能原因和下一步动作。
              </div>
            )}
            {inviteDiagnosticContext ? (
              <div
                className={`mt-4 rounded-2xl border p-4 ${
                  inviteDiagnosticContextIsPending
                    ? 'border-amber-100 bg-amber-50/80 text-amber-800'
                    : 'border-rose-100 bg-rose-50/80 text-rose-800'
                }`}
                data-diagnostic-invite-failure-context="latest"
                data-diagnostic-invite-join-context={inviteDiagnosticContextIsPending ? 'pending' : 'failed'}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold ${inviteDiagnosticContextIsPending ? 'text-amber-700' : 'text-rose-700'}`}>
                        {inviteDiagnosticContextIsPending ? '邀请等待确认' : '邀请加入失败'}
                      </span>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white" data-diagnostic-context-technical="details">{inviteDiagnosticContext.reasonKind}</span>
                      <span className="rounded-full bg-white/75 px-3 py-1 font-mono text-[11px] font-bold text-slate-500">
                        {new Date(inviteDiagnosticContext.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{inviteDiagnosticContext.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed">{inviteDiagnosticContext.detail}</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <p className="rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                        游戏：{inviteDiagnosticContext.packet.gameName || '未知'}{inviteDiagnosticContext.packet.gameId ? `｜${inviteDiagnosticContext.packet.gameId}` : ''}
                      </p>
                      <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                        房主 {inviteDiagnosticContext.packet.hostVirtualIp || inviteDiagnosticContext.connectHost || '-'}:{inviteDiagnosticContext.packet.gamePort || inviteDiagnosticContext.gamePort || '-'}
                      </p>
                      <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                        我的联机地址 {inviteDiagnosticContext.packet.friendVirtualIp || inviteDiagnosticContext.localIp || '-'}
                      </p>
                      <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600" data-diagnostic-context-technical="details">
                        中继地址 {inviteDiagnosticContext.packet.supernode || inviteDiagnosticContext.supernode || '-'}
                      </p>
                    </div>
                    <p className="mt-2 rounded-xl bg-white/75 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                      建议：{inviteDiagnosticContext.nextAction}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button onClick={runInviteFailureDiagnostic} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                      {inviteDiagnosticContextIsPending ? '按等待状态生成诊断' : '按邀请包生成诊断'}
                    </button>
                    <button onClick={copyInviteDiagnosticContext} className={`rounded-lg border bg-white px-3 py-1.5 text-[11px] font-bold ${inviteDiagnosticContextIsPending ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-rose-200 text-rose-700 hover:bg-rose-50'}`}>
                      {inviteDiagnosticContextIsPending ? '复制等待信息' : '复制失败信息'}
                    </button>
                    <button onClick={clearInviteFailureDiagnostic} className="rounded-lg border border-rose-100 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-rose-500 hover:bg-white">
                      清除
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {hostDiagnosticContext ? (
              <div
                className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/80 p-4 text-rose-800"
                data-diagnostic-host-failure-context="latest"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-rose-700">房主开房失败</span>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white" data-diagnostic-context-technical="details">{hostDiagnosticContext.reasonKind}</span>
                      <span className="rounded-full bg-white/75 px-3 py-1 font-mono text-[11px] font-bold text-slate-500">
                        {new Date(hostDiagnosticContext.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{hostDiagnosticContext.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed">{hostDiagnosticContext.detail}</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <p className="rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                        游戏：{hostDiagnosticContext.gameName || '未知'}{hostDiagnosticContext.gameId ? `｜${hostDiagnosticContext.gameId}` : ''}
                      </p>
                      <p className="rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                        推荐方式：{hostDiagnosticContext.routeTitle}
                      </p>
                      <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                        房主联机地址 {hostDiagnosticContext.hostVirtualIp || '-'}:{hostDiagnosticContext.gamePort || '-'}
                      </p>
                      <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                        好友联机地址 {hostDiagnosticContext.friendVirtualIp || '-'}
                      </p>
                      <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600" data-diagnostic-context-technical="details">
                        中继地址 {hostDiagnosticContext.supernode || '-'}
                      </p>
                      <p className="rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                        端口检测：{hostDiagnosticContext.hostPortCheck || '未检测'}
                      </p>
                    </div>
                    <p className="mt-2 rounded-xl bg-white/75 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                      建议：{hostDiagnosticContext.nextAction}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button onClick={runHostFailureDiagnostic} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                      按房主失败生成诊断
                    </button>
                    {hostDiagnosticContext.nextActionKind === 'advanced_tools' || hostDiagnosticContext.requiresTcpPortProxy || hostDiagnosticContext.requiresUdpBroadcastBridge ? (
                      <button onClick={openAdvancedToolsWithHostContext} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50">
                        带信息去高级工具
                      </button>
                    ) : null}
                    <button onClick={copyHostDiagnosticContext} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50">
                      复制失败信息
                    </button>
                    <button onClick={clearHostFailureDiagnostic} className="rounded-lg border border-rose-100 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-rose-500 hover:bg-white">
                      清除
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div
              className={`mt-4 rounded-2xl border p-4 ${autoNextStepToneClass(diagnosticAutoNextStep.tone)}`}
              data-diagnostic-auto-next-step="decision"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-700">自动下一步</span>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">最短修复路径</span>
                    <span className="rounded-full bg-white/75 px-3 py-1 font-mono text-[11px] font-bold text-slate-500" data-diagnostic-technical-details="advanced">
                      {diagnosticAutoNextStep.id}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{simplifyText(diagnosticAutoNextStep.title)}</h4>
                  <p className="mt-1 text-xs leading-relaxed">{simplifyText(diagnosticAutoNextStep.summary)}</p>
                  {diagnosticAutoNextStep.evidence.length ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {diagnosticAutoNextStep.evidence.slice(0, 4).map((item) => (
                        <p key={item} className="rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                          {simplifyText(item)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={runDiagnosticAutoNextStep}
                  disabled={Boolean(busy)}
                  className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {simplifyText(diagnosticAutoNextStep.primaryLabel)}
                </button>
              </div>
            </div>
          </div>

          {report ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                    <Wrench className="h-4 w-4 text-amber-600" />
                    问题修复中心
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    已按问题类型合并重复项。优先处理最上方卡片；一键处理会等待 2 秒并自动复测，手动修复后也可点击“重新诊断”。
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {fixGroups.length ? `${fixGroups.length} 类问题` : '暂无待修复'}
                </span>
              </div>
              {lastFixResult ? (
                <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600" data-diagnostic-one-click-fix-result="latest">
                  <span className="font-bold text-slate-800">最近一键处理：</span>
                  {simplifyText(lastFixResult)}
                </div>
              ) : null}
              {diagnosticConversionAdvice ? (
                <div
                  className={`mb-4 rounded-2xl border p-4 ${
                    diagnosticConversionAdvice.tone === 'blocked'
                      ? 'border-rose-100 bg-rose-50/80'
                      : diagnosticConversionAdvice.tone === 'warning'
                        ? 'border-amber-100 bg-amber-50/80'
                        : 'border-sky-100 bg-sky-50/80'
                  }`}
                  data-diagnostic-conversion-advice="route-correction"
                >
                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-700">联机方式提示</span>
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">{simplifyText(diagnosticAdapterRoute.title)}</span>
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">
                          {diagnosticAdapterRoute.canCreateLanInvite ? '会生成邀请' : '不生成邀请'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">{simplifyText(diagnosticConversionAdvice.title)}</h4>
                      <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">{simplifyText(diagnosticConversionAdvice.summary)}</p>
                      <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                        {simplifyText(diagnosticConversionAdvice.whyDiagnosticMatters)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button onClick={openRecommendationWithDiagnosticGame} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
                        打开推荐方案
                      </button>
                      {diagnosticConversionAdvice.shouldShowAdvancedTools ? (
                        <button onClick={openAdvancedToolsWithDiagnosticIntent} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50">
                          带信息去高级工具
                        </button>
                      ) : null}
                      {diagnosticConversionAdvice.shouldCreateAdapterIntent ? (
                        <button onClick={openSolutionsWithDiagnosticAssessment} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          带建议去方案库
                        </button>
                      ) : null}
                      <button onClick={copyDiagnosticConversionAdvice} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        复制纠错说明
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {diagnosticConversionAdvice.suggestedActions.slice(0, 3).map((action) => (
                      <div key={action} className="rounded-xl bg-white/75 p-3 text-[11px] leading-relaxed text-slate-600">
                        {simplifyText(action)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {fixRetestResult ? (
                <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4" data-diagnostic-auto-retest="summary">
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-800">修复后自动复测</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-emerald-700">{fixRetestResult.summary}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/80 px-3 py-1 font-mono text-[11px] font-bold text-emerald-700">
                      {new Date(fixRetestResult.generatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="grid gap-2 text-[11px] md:grid-cols-3">
                    <div className="rounded-xl bg-white/80 p-3 text-slate-600">
                      <p className="font-bold text-slate-800">问题数量</p>
                      <p className="mt-1 font-mono">修复前 {fixRetestResult.beforeIssueCount} → 修复后 {fixRetestResult.afterIssueCount}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 text-slate-600">
                      <p className="font-bold text-slate-800">必需项通过</p>
                      <p className="mt-1 font-mono">{fixRetestResult.beforeRequiredPassed} → {fixRetestResult.afterRequiredPassed}/{fixRetestResult.requiredTotal || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 text-slate-600">
                      <p className="font-bold text-slate-800">本次动作</p>
                      <p className="mt-1">{fixRetestResult.actionLabel}</p>
                    </div>
                  </div>
                   <div className="mt-2 grid gap-2 text-[11px] md:grid-cols-3" data-diagnostic-auto-retest-technical="details">
                    <div className="rounded-xl bg-white/70 p-3 text-slate-600">
                      <p className="font-bold text-emerald-700">已解决</p>
                      <p className="mt-1 break-words font-mono">{fixRetestResult.resolvedIssueIds.join(', ') || '暂无'}</p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-3 text-slate-600">
                      <p className="font-bold text-amber-700">仍存在</p>
                      <p className="mt-1 break-words font-mono">{fixRetestResult.remainingIssueIds.join(', ') || '暂无'}</p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-3 text-slate-600">
                      <p className="font-bold text-rose-700">新出现</p>
                      <p className="mt-1 break-words font-mono">{fixRetestResult.newIssueIds.join(', ') || '暂无'}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              {latestAdvancedToolFix ? (
                <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50/80 p-4" data-diagnostic-advanced-tool-self-test-history="latest">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-amber-700">高级工具自测回流</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          latestAdvancedToolFix.afterIssueCount === 0 && latestAdvancedToolFix.remainingIssueIds.length === 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {latestAdvancedToolFix.afterIssueCount === 0 && latestAdvancedToolFix.remainingIssueIds.length === 0 ? '自测通过' : '仍需处理'}
                        </span>
                        <span className="rounded-full bg-white/70 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-500">
                          {new Date(latestAdvancedToolFix.generatedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800">{simplifyText(latestAdvancedToolFix.actionLabel)}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-amber-800">{simplifyText(latestAdvancedToolFix.summary)}</p>
                      <p className="mt-2 font-mono text-[11px] text-amber-700">
                        问题 {latestAdvancedToolFix.beforeIssueCount} → {latestAdvancedToolFix.afterIssueCount}
                        ｜已解决 {latestAdvancedToolFix.resolvedIssueIds.length}
                        ｜仍存在 {latestAdvancedToolFix.remainingIssueIds.length}
                        ｜新出现 {latestAdvancedToolFix.newIssueIds.length}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button onClick={() => onNavigateTab('advanced_tools')} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800">
                        继续调整高级工具
                      </button>
                      <button onClick={() => copyFixHistoryEntry(latestAdvancedToolFix)} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50">
                        复制高级工具复盘
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              {fixHistory.length ? (
                <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4" data-diagnostic-fix-history="timeline">
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">诊断修复历史</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        保留最近 {Math.min(fixHistory.length, 12)} 次一键处理和自动复测结果，可复制给朋友/管理员远程协助排障。
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button onClick={copyAllFixHistory} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                        复制全部复盘
                      </button>
                      <button onClick={clearFixHistory} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50">
                        清空历史
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {fixHistory.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">{new Date(entry.generatedAt).toLocaleString()}</span>
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">{simplifyText(entry.actionLabel)}</span>
                            </div>
                            <p className="mt-2 text-xs font-bold text-slate-800">{entry.targetLabel}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{simplifyText(entry.summary)}</p>
                            <p className="mt-1 font-mono text-[11px] text-slate-500">
                              问题 {entry.beforeIssueCount} → {entry.afterIssueCount} ｜ 已解决 {entry.resolvedIssueIds.length} ｜ 仍存在 {entry.remainingIssueIds.length} ｜ 新出现 {entry.newIssueIds.length}
                            </p>
                          </div>
                          <button onClick={() => copyFixHistoryEntry(entry)} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                            复制复盘
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {fixGroups.length ? (
                <div className="space-y-3">
                  {routePrimaryFixGroups.length ? (
                    <div className="grid gap-3 xl:grid-cols-2">
                      {routePrimaryFixGroups.map((group) => <FixGroupCard key={group.id} group={group} onRunFix={runFixAction} />)}
                    </div>
                  ) : diagnosticConversionAdvice?.shouldDeprioritizeN2nFixes ? (
                    <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-xs leading-relaxed text-violet-700">
                      当前游戏优先处理远程同屏 / Steam / 官方入口方向，通用组网相关修复已移到低优先级区域，避免误点。
                    </div>
                  ) : null}
                  {routeDeprioritizedFixGroups.length ? (
                    <details className="rounded-2xl border border-slate-100 bg-slate-50 p-4" data-diagnostic-n2n-fixes-deprioritized="route-aware">
                      <summary className="cursor-pointer text-xs font-bold text-slate-600">
                        低优先级组网排查（当前联机方式可能不需要） · {routeDeprioritizedFixGroups.length} 类
                      </summary>
                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        {routeDeprioritizedFixGroups.map((group) => <FixGroupCard key={group.id} group={group} onRunFix={runFixAction} />)}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                  当前报告没有发现明确问题。若好友仍无法进入，请复制报告或继续检查游戏内连接地址。
                </div>
              )}
            </div>
          ) : null}

          {compactNextActions.length ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">下一步动作</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
                {compactNextActions.map((action) => <li className="break-words" key={action}>{simplifyText(action)}</li>)}
              </ol>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2" data-diagnostic-technical-details="advanced">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">发布检查</h3>
              <div className="space-y-2">
                {compactReleaseChecks.length
                  ? compactReleaseChecks.map((check) => <CheckRow key={check.id} check={check} />)
                  : <p className="text-sm text-slate-500">暂无发布检查结果。</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">问题列表</h3>
              <div className="space-y-2">
                {compactIssues.length
                  ? compactIssues.map((item) => <IssueCard key={item.id} issue={item} onRunFix={runFixAction} />)
                  : <p className="text-sm text-slate-500">暂无问题列表。</p>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-sm" data-diagnostic-technical-details="advanced">
            <h3 className="mb-3 text-sm font-bold text-amber-200">报告原文预览</h3>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
              {record ? formatDiagnosticRecord(record) : '尚未生成真实诊断报告。'}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
