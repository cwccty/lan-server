import type { GameAdapter } from '../types/game';

export type AdapterRegistryClosureAuditStatus = 'wired' | 'observed' | 'manual_check';

export interface AdapterRegistryClosureAuditItem {
  id: string;
  label: string;
  status: AdapterRegistryClosureAuditStatus;
  evidence: string;
  manualCheck: string;
}

export interface AdapterRegistryClosureAuditInput {
  adapters: GameAdapter[];
  filteredAdapterCount: number;
  syncResult: {
    ok?: boolean;
    registry_url?: string;
    created?: number;
    updated?: number;
    skipped?: number;
  } | null;
  syncPreview: {
    registry_url?: string;
    items?: unknown[];
    possible_conflicts?: number;
    would_affect_active?: number;
  } | null;
  syncPreviewRequiresConfirm: boolean;
  submitQueueGameIds: string[];
  submitQueueBatchText: string;
  contributionReviewQueueCount: number;
  contributionReviewStatuses: string[];
  hasContributionResult: boolean;
  hasContributionReview: boolean;
  hasSavedAdapterReview: boolean;
  savedAdapterGameId?: string;
  savedAdapterDisplayName?: string;
  adapterConflictCount: number;
  adapterBackupCount: number;
  submitReadyCount: number;
  needsReviewCount: number;
  missingEvidenceCount: number;
  highConfidenceCount: number;
  conversionSampleTotal: number;
  conversionSamplePassed: number;
  activeRegistryUrl: string;
  activeRegistryKind: string;
}

const STATIC_AUDIT_ITEMS: AdapterRegistryClosureAuditItem[] = [
  {
    id: 'game-scan-to-adapter-match',
    label: '扫描游戏匹配 adapter',
    status: 'wired',
    evidence: '游戏扫描页通过 scanGames / analyzeGame 识别游戏，方案库通过 listGameAdapters 提供可复用 adapter，推荐页用 buildAdapterRecommendationRoute 自动套用路线。',
    manualCheck: '扫描到游戏后，推荐方案页应能按 game_id 找到 adapter，并显示对应联机路线，而不是要求用户每次手动配置。',
  },
  {
    id: 'capability-decision-matrix',
    label: '游戏能力识别决策表',
    status: 'wired',
    evidence: 'connectionCapabilityMatrix / buildAdapterEditorPresetFromDecision 用于把游戏类型映射到 LAN、服务端、广播桥、本地同屏、Steam P2P、官方服限定等路线。',
    manualCheck: '管理员编辑 adapter 时，应能按游戏原始多人能力套用正确 network_type 和转换边界。',
  },
  {
    id: 'admin-create-adapter',
    label: '管理员创建适配器',
    status: 'wired',
    evidence: 'ProductSolutionsView 的自建适配器编辑器调用 saveGameAdapter，保存前有真实预览和差异字段。',
    manualCheck: '填写 game_id、游戏名称、端口、network_type、证据后，必须先确认保存预览，才能写入 custom adapter。',
  },
  {
    id: 'user-contribution-package',
    label: '用户提交适配方案',
    status: 'wired',
    evidence: 'adapterContribution 支持非 JSON 表单生成贡献包，管理员可粘贴贡献包并进入审核队列。',
    manualCheck: '普通用户应能填写游戏现象、端口、测试步骤和证据，生成可复制贡献包。',
  },
  {
    id: 'contribution-to-admin-review',
    label: '贡献包进入管理员审核',
    status: 'wired',
    evidence: '贡献包解析后会形成 review queue，接受后能转成 adapter 草稿，并保留 sourceContributionId / sourceContributionStatus。',
    manualCheck: '管理员接受贡献包后，应能看到来源身份，并能继续保存复核或加入提交队列。',
  },
  {
    id: 'local-adapter-library',
    label: '本地适配器库',
    status: 'wired',
    evidence: 'listGameAdapters / saveGameAdapter / importGameAdapterJson / exportGameAdapterJson 支持本地读取、保存、导入和导出 adapter。',
    manualCheck: '自建或导入 adapter 后，刷新方案库应仍能看到该游戏，并能导出 JSON。',
  },
  {
    id: 'remote-registry-sync',
    label: '远程共享库同步',
    status: 'wired',
    evidence: 'syncAdapterRegistry / previewAdapterRegistrySync 支持 GitHub Pages、VPS 或本地示例库 index.json 同步。',
    manualCheck: '输入共享库地址后，应先做同步前预检；有冲突/影响当前方案时必须确认后才能写入。',
  },
  {
    id: 'registry-version-source',
    label: '版本、来源和适用条件',
    status: 'wired',
    evidence: 'adapterPresentation 显示 source、adapter_version、applicability、evidence、tested_platforms、network_conditions 和 known_limitations。',
    manualCheck: '每个 adapter 卡片应显示来源、版本、验证状态、适用条件、端口协议和已知限制。',
  },
  {
    id: 'quality-and-publish-audit',
    label: '质量评分与发布审核',
    status: 'wired',
    evidence: 'adapterQualityScore / adapterPublishAudit 会给出可信度、缺失项、风险、可提交/需复核/不完整/已同步状态。',
    manualCheck: '缺证据或低可信 adapter 不应被轻易加入共享库提交队列。',
  },
  {
    id: 'version-conflict-workflow',
    label: '版本冲突处理',
    status: 'wired',
    evidence: 'listAdapterConflicts / promoteRegistryAdapterToCustom / pinActiveAdapterAsCustom 支持发现多来源冲突、保留自建或用共享库覆盖。',
    manualCheck: '同一 game_id 有 builtin/custom/registry 多来源时，应能复制冲突报告并选择保留或覆盖。',
  },
  {
    id: 'backup-restore-workflow',
    label: '备份与恢复',
    status: 'wired',
    evidence: 'listAdapterBackups / restoreAdapterBackup 展示 backups/adapters 历史，覆盖、导入、同步和恢复前都会保留旧 JSON。',
    manualCheck: '误操作后应能在备份历史里复制记录，并恢复某个 adapter 旧版本。',
  },
  {
    id: 'change-diff-summary',
    label: '变更差异摘要',
    status: 'wired',
    evidence: 'AdapterChangeDiffField / buildLocalAdapterDiffFields 展示 network_type、端口、转换方法、路线 flags 和是否影响推荐。',
    manualCheck: '保存、导入或同步前后，应能看到哪些字段改变，以及是否会影响推荐路线。',
  },
  {
    id: 'registry-submit-package',
    label: '共享库提交包',
    status: 'wired',
    evidence: 'adapterRegistrySubmit 生成 adapter JSON、sha256、index.json 片段、GitHub Pages/VPS 提交说明和批量提交队列。',
    manualCheck: '可提交 adapter 应能生成完整提交包，并可加入批量队列供 GitHub Desktop 或 VPS 发布。',
  },
  {
    id: 'conversion-sample-validation',
    label: '转换方案样例验证',
    status: 'wired',
    evidence: 'conversionAssessmentSamples 覆盖本地同屏、原生 LAN、UDP 广播发现、Steam P2P、官方服限定五类样例。',
    manualCheck: '方案库应显示小样本验证结果，确认非 LAN 游戏不会被误生成 LAN 邀请。',
  },
];

function markObserved(item: AdapterRegistryClosureAuditItem, input: AdapterRegistryClosureAuditInput): AdapterRegistryClosureAuditItem {
  if (item.id === 'game-scan-to-adapter-match' && input.adapters.length > 0) return { ...item, status: 'observed' };
  if (item.id === 'capability-decision-matrix') return { ...item, status: 'observed' };
  if (item.id === 'admin-create-adapter' && input.hasSavedAdapterReview) return { ...item, status: 'observed' };
  if (item.id === 'user-contribution-package' && input.hasContributionResult) return { ...item, status: 'observed' };
  if (item.id === 'contribution-to-admin-review' && (input.hasContributionReview || input.contributionReviewQueueCount > 0)) return { ...item, status: 'observed' };
  if (item.id === 'local-adapter-library' && input.adapters.length > 0) return { ...item, status: 'observed' };
  if (item.id === 'remote-registry-sync' && (input.syncPreview || input.syncResult)) return { ...item, status: 'observed' };
  if (item.id === 'registry-version-source' && input.adapters.some((adapter) => adapter.adapter_source || adapter.applicability || adapter.evidence)) return { ...item, status: 'observed' };
  if (item.id === 'quality-and-publish-audit' && (input.highConfidenceCount > 0 || input.needsReviewCount > 0 || input.missingEvidenceCount > 0 || input.submitReadyCount > 0)) return { ...item, status: 'observed' };
  if (item.id === 'version-conflict-workflow' && input.adapterConflictCount >= 0) return { ...item, status: input.adapterConflictCount > 0 ? 'observed' : 'wired' };
  if (item.id === 'backup-restore-workflow' && input.adapterBackupCount > 0) return { ...item, status: 'observed' };
  if (item.id === 'change-diff-summary' && (input.syncPreview?.items?.length || input.hasSavedAdapterReview)) return { ...item, status: 'observed' };
  if (item.id === 'registry-submit-package' && (input.submitQueueGameIds.length > 0 || input.submitQueueBatchText.trim())) return { ...item, status: 'observed' };
  if (item.id === 'conversion-sample-validation' && input.conversionSampleTotal > 0 && input.conversionSamplePassed === input.conversionSampleTotal) return { ...item, status: 'observed' };
  return item;
}

export function buildAdapterRegistryClosureAudit(input: AdapterRegistryClosureAuditInput) {
  const items = STATIC_AUDIT_ITEMS.map((item) => markObserved(item, input));
  const observedCount = items.filter((item) => item.status === 'observed').length;
  const wiredCount = items.length;
  const registryStatus = input.syncResult
    ? `${input.syncResult.ok ? '同步成功' : '同步异常'}：新增 ${input.syncResult.created ?? 0}，更新 ${input.syncResult.updated ?? 0}，跳过 ${input.syncResult.skipped ?? 0}`
    : input.syncPreview
      ? `已有同步预检：${input.syncPreview.items?.length ?? 0} 项，潜在冲突 ${input.syncPreview.possible_conflicts ?? 0}`
      : '尚未执行本次同步';
  return {
    items,
    wiredCount,
    observedCount,
    registryStatus,
    summary: `已固化 ${wiredCount} 项适配器共享库闭环能力；当前界面状态已观察到 ${observedCount} 项。`,
    nextRisk: input.missingEvidenceCount > 0
      ? '优先补齐缺失证据，再提交共享库。'
      : input.adapterConflictCount > 0
        ? '优先处理版本冲突，避免共享库覆盖自建方案。'
        : input.submitReadyCount > 0
          ? '可继续生成提交包并发布到 GitHub Pages 或 VPS。'
          : '继续通过贡献包或管理员编辑器沉淀更多游戏方案。',
  };
}

export function formatAdapterRegistryClosureAuditReport(input: AdapterRegistryClosureAuditInput) {
  const audit = buildAdapterRegistryClosureAudit(input);
  return [
    '[联机助手适配器共享库闭环自检]',
    audit.summary,
    '',
    '当前状态：',
    `- 本地 adapter：${input.adapters.length} 个，当前筛选 ${input.filteredAdapterCount} 个`,
    `- 共享库地址：${input.activeRegistryUrl}`,
    `- 共享库类型：${input.activeRegistryKind}`,
    `- 同步状态：${audit.registryStatus}`,
    `- 同步预检需确认：${input.syncPreviewRequiresConfirm ? '是' : '否'}`,
    `- 高可信：${input.highConfidenceCount}，需复核：${input.needsReviewCount}，缺证据：${input.missingEvidenceCount}，可提交：${input.submitReadyCount}`,
    `- 版本冲突：${input.adapterConflictCount}，备份数量：${input.adapterBackupCount}`,
    `- 提交队列：${input.submitQueueGameIds.length} 个，批量文本：${input.submitQueueBatchText.trim() ? '已生成' : '未生成'}`,
    `- 贡献审核队列：${input.contributionReviewQueueCount} 个，状态：${input.contributionReviewStatuses.join('、') || '无'}`,
    input.hasSavedAdapterReview ? `- 最近保存复核：${input.savedAdapterDisplayName || input.savedAdapterGameId || '已生成'}` : '- 最近保存复核：无',
    `- 转换样例验证：${input.conversionSamplePassed}/${input.conversionSampleTotal}`,
    `- 下一风险：${audit.nextRisk}`,
    '',
    '自检清单：',
    ...audit.items.map((item, index) => [
      `${index + 1}. ${item.label} [${item.status}]`,
      `   证据：${item.evidence}`,
      `   人工验证：${item.manualCheck}`,
    ].join('\n')),
  ].join('\n');
}
