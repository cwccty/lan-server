import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  CloudDownload,
  ClipboardCopy,
  Database,
  Download,
  FileJson,
  Link2,
  Network,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldQuestion,
  Upload,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  exportGameAdapterJson,
  importGameAdapterJson,
  listAdapterBackups,
  listAdapterConflicts,
  listGameAdapters,
  pinActiveAdapterAsCustom,
  publishAdaptersToLocalRegistry,
  previewAdapterRegistrySync,
  promoteRegistryAdapterToCustom,
  restoreAdapterBackup,
  saveGameAdapter,
  syncAdapterRegistry,
  syncLocalAdapterRegistryExample,
  type AdapterBackupEntry,
  type AdapterChangeDiffField,
  type AdapterConflictReport,
  type AdapterRegistryLocalPublishResult,
  type AdapterRegistrySyncPreview,
  type AdapterRegistrySyncResult,
} from '../api/tauri';
import type { AdapterVerificationStatus, ConversionMethod, GameAdapter, GameCapability, GameNetworkType, MultiplayerCapability } from '../types/game';
import {
  getReferenceAdapterSyncResult,
  setReferenceAdapterSyncResult,
} from '../reference-adapter/adapterSyncResult';
import {
  adapterVersionLabel,
  buildApplicabilityList,
  compactPlanSummary,
  conversionMethodsFor,
  deriveAdapterCategory,
  gameCapabilityLabel,
  multiplayerSummary,
  networkTypeLabel,
  registryVersionLabel,
  sourceLabel,
  summarizeAdapterInventory,
  type AdapterCategoryId,
} from './adapterPresentation';
import {
  clearAdapterCreationIntent,
  readAdapterCreationIntent,
  type AdapterCreationIntent,
} from './adapterCreationIntent';
import {
  buildAdapterContributionPackage,
  contributionNetworkTypeOptions,
  contributionPackageToForm,
  createEmptyAdapterContributionForm,
  parseAdapterContributionInput,
  type AdapterContributionBuildResult,
  type AdapterContributionForm,
  type AdapterContributionReviewResult,
} from './adapterContribution';
import {
  buildAdapterRegistrySubmitPackage,
  type AdapterRegistrySubmitPackage,
} from './adapterRegistrySubmit';
import {
  buildAdapterRegistryClosureAudit,
  formatAdapterRegistryClosureAuditReport,
} from './adapterRegistryClosureAudit';
import {
  auditAdapterForPublish,
  summarizePublishAudits,
} from './adapterPublishAudit';
import {
  buildAdapterQualityScore,
  summarizeAdapterQuality,
} from './adapterQualityScore';
import {
  buildAdapterEditorPresetFromDecision,
  connectionCapabilityMatrix,
  decisionRowForNetworkType,
} from './connectionCapabilityMatrix';
import {
  buildConversionAssessmentValidationReport,
  validateConversionAssessmentSamples,
} from './conversionAssessmentSamples';
import {
  buildConversionEngineClosureAudit,
  formatConversionEngineClosureAuditReport,
} from './conversionEngineClosureAudit';

import { ProductBusyOverlay } from './ProductBusyOverlay';

interface ProductSolutionsViewProps {
  onTriggerToast: (msg: string) => void;
  solutionsUrl: string;
  onUpdateSolutionsUrl: (url: string) => void;
}

interface SavedAdapterReview {
  adapter: GameAdapter;
  diffFields: AdapterChangeDiffField[];
  savedAt: string;
  sourceContributionId?: string;
  sourceContributionStatus?: ContributionReviewQueueStatus;
}

type ReviewWorkbenchFilter = 'all' | 'high_confidence' | 'needs_review' | 'missing_evidence' | 'submit_ready';

const DEFAULT_REGISTRY_URL = 'https://cwccty.github.io/lan-server/adapter-registry/index.json';
const SUBMIT_QUEUE_STORAGE_KEY = 'lan-helper.adapterSubmitQueue';
const CONTRIBUTION_REVIEW_QUEUE_STORAGE_KEY = 'lan-helper.adapterContributionReviewQueue';

interface AdapterSubmitQueueSnapshot {
  gameIds: string[];
  batchText: string;
  updatedAt: string;
}

type ContributionReviewQueueStatus = 'pending' | 'needs_more_evidence' | 'drafted' | 'rejected';

interface ContributionReviewQueueItem {
  id: string;
  status: ContributionReviewQueueStatus;
  review: AdapterContributionReviewResult;
  addedAt: string;
  updatedAt: string;
}

const emptyEditor = {
  game_id: '',
  display_name: '',
  steam_appid: '',
  executables: '',
  default_ports: '7777',
  network_type: 'lan_ip_direct' as GameNetworkType,
  can_convert_to_lan: true,
  verification_status: 'unverified' as AdapterVerificationStatus,
  tested_versions: '',
  tested_platforms: 'Steam',
  supported_os: 'Windows',
  network_conditions: '同一虚拟局域网；防火墙允许游戏端口',
  known_limitations: '',
  port_protocols: 'TCP 7777',
  evidence_items: '',
  test_steps: '房主启动组网\n房主启动游戏/服务端\n好友加入同一组网\n好友连接房主虚拟 IP 和端口',
  last_verified_at: '',
  notes: '通过虚拟局域网或端口工具转换为局域网联机体验。',
};

type AdapterEditorState = typeof emptyEditor;

function executableFromPath(path?: string | null) {
  if (!path) return '';
  return path.split(/[\\/]/).pop() || '';
}

function editorFromIntent(intent: AdapterCreationIntent, previous: AdapterEditorState): AdapterEditorState {
  const displayName = intent.display_name || intent.game_id || previous.display_name;
  const gameId = intent.game_id || previous.game_id;
  const isConversionAssessment = intent.reason === 'conversion_assessment';
  const networkType = intent.network_type || (isConversionAssessment ? 'unknown_need_review' : 'unknown_need_review');
  const notes = [
    `${isConversionAssessment ? '转换评估来源' : '诊断来源'}：${intent.note || '当前游戏缺少 adapter，需要人工确认联机类型。'}`,
    gameId ? `目标 game_id：${gameId}` : '',
    displayName ? `游戏名称：${displayName}` : '',
    intent.game_type ? `评估类型：${intent.game_type}` : '',
    intent.original_capability ? `原始多人能力：${intent.original_capability}` : '',
    intent.recommended_plan ? `推荐方案：${intent.recommended_plan}` : '',
    intent.conversion_verdict ? `转换结论：${intent.conversion_verdict}` : '',
    typeof intent.can_become_lan === 'boolean' ? `是否可转 LAN：${intent.can_become_lan ? '是' : '否'}` : '',
    intent.boundaries?.length ? `边界说明：${intent.boundaries.join('；')}` : '',
    '请先判断游戏属于：原生 LAN / 专用服务端 / UDP 广播发现 / 本地同屏远程游玩 / Steam P2P / 官方服限定。',
    '确认后修改“联机类型”和端口，再保存为本地 custom adapter。'
  ].filter(Boolean).join('\n');

  return {
    ...previous,
    game_id: gameId,
    display_name: displayName,
    steam_appid: intent.steam_appid || previous.steam_appid,
    executables: executableFromPath(intent.detected_path) || previous.executables,
    default_ports: intent.default_port ? String(intent.default_port) : previous.default_ports,
    network_type: networkType as GameNetworkType,
    can_convert_to_lan: Boolean(intent.can_become_lan),
    evidence_items: intent.admin_evidence?.length ? intent.admin_evidence.join('\n') : previous.evidence_items,
    test_steps: intent.user_steps?.length ? intent.user_steps.join('\n') : previous.test_steps,
    known_limitations: intent.boundaries?.length ? intent.boundaries.join('\n') : previous.known_limitations,
    notes,
  };
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    created: '新增',
    updated: '更新',
    skipped: '跳过',
    skipped_hash_failed: '哈希失败',
    skipped_parse_failed: '解析失败',
    skipped_fetch_failed: '拉取失败',
    skipped_validation_failed: '校验失败',
    skipped_write_failed: '写入失败',
    hash_failed: '哈希失败',
    parse_failed: '解析失败',
    fetch_failed: '拉取失败',
    validation_failed: '校验失败',
    write_failed: '写入失败',
  };
  return map[status] ?? status;
}

function splitStructuredList(value: string) {
  return value
    .split(/\r?\n|[；;]/)
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function verificationStatusLabel(status?: AdapterVerificationStatus | string | null) {
  const map: Record<string, string> = {
    unverified: '未实测',
    self_tested: '本机自测',
    friend_tested: '好友实测',
    community_verified: '社区验证',
  };
  return status ? (map[status] ?? status) : '未填写';
}

function formatAdapterApplicability(adapter?: GameAdapter | null) {
  if (!adapter?.applicability) return '未结构化';
  const profile = adapter.applicability;
  return [
    `验证：${verificationStatusLabel(profile.verification_status)}`,
    profile.tested_versions?.length ? `版本：${profile.tested_versions.join('、')}` : '',
    profile.tested_platforms?.length ? `平台：${profile.tested_platforms.join('、')}` : '',
    profile.supported_os?.length ? `系统：${profile.supported_os.join('、')}` : '',
    profile.network_conditions?.length ? `条件：${profile.network_conditions.join('、')}` : '',
    profile.known_limitations?.length ? `边界：${profile.known_limitations.join('、')}` : '',
  ].filter(Boolean).join('；') || '未结构化';
}

function formatAdapterEvidence(adapter?: GameAdapter | null) {
  if (!adapter?.evidence) return '未结构化';
  const evidence = adapter.evidence;
  return [
    evidence.port_protocols?.length ? `端口协议：${evidence.port_protocols.join('、')}` : '',
    evidence.proof_items?.length ? `证据：${evidence.proof_items.join('、')}` : '',
    evidence.test_steps?.length ? `步骤：${evidence.test_steps.join(' / ')}` : '',
    evidence.last_verified_at ? `最近验证：${evidence.last_verified_at}` : '',
  ].filter(Boolean).join('；') || '未结构化';
}

function adapterHasStructuredApplicability(adapter: GameAdapter) {
  const profile = adapter.applicability;
  return Boolean(profile && (
    profile.verification_status !== 'unverified'
    || profile.tested_versions?.length
    || profile.tested_platforms?.length
    || profile.supported_os?.length
    || profile.network_conditions?.length
    || profile.known_limitations?.length
  ));
}

function adapterHasStructuredEvidence(adapter: GameAdapter) {
  const evidence = adapter.evidence;
  return Boolean(evidence && (
    evidence.port_protocols?.length
    || evidence.proof_items?.length
    || evidence.test_steps?.length
    || evidence.last_verified_at
  ));
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function emptyAdapterSubmitQueueSnapshot(): AdapterSubmitQueueSnapshot {
  return {
    gameIds: [],
    batchText: '',
    updatedAt: '',
  };
}

function safeLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeSubmitQueueGameIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)));
}

function readAdapterSubmitQueueSnapshot(): AdapterSubmitQueueSnapshot {
  const storage = safeLocalStorage();
  if (!storage) return emptyAdapterSubmitQueueSnapshot();
  try {
    const raw = storage.getItem(SUBMIT_QUEUE_STORAGE_KEY);
    if (!raw) return emptyAdapterSubmitQueueSnapshot();
    const parsed = JSON.parse(raw) as Partial<AdapterSubmitQueueSnapshot>;
    return {
      gameIds: normalizeSubmitQueueGameIds(parsed.gameIds),
      batchText: typeof parsed.batchText === 'string' ? parsed.batchText : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return emptyAdapterSubmitQueueSnapshot();
  }
}

function saveAdapterSubmitQueueSnapshot(snapshot: AdapterSubmitQueueSnapshot) {
  const storage = safeLocalStorage();
  if (!storage) return;
  const normalized = {
    gameIds: normalizeSubmitQueueGameIds(snapshot.gameIds),
    batchText: snapshot.batchText || '',
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
  };
  try {
    if (normalized.gameIds.length === 0 && !normalized.batchText.trim()) {
      storage.removeItem(SUBMIT_QUEUE_STORAGE_KEY);
      return;
    }
    storage.setItem(SUBMIT_QUEUE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // 本地存储不可用时不阻塞方案库功能，队列仍保留在当前页面状态中。
  }
}

function clearAdapterSubmitQueueSnapshot() {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(SUBMIT_QUEUE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function formatSubmitQueueSnapshotTime(value?: string) {
  if (!value) return '未保存';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function isContributionReviewQueueStatus(value: unknown): value is ContributionReviewQueueStatus {
  return value === 'pending' || value === 'needs_more_evidence' || value === 'drafted' || value === 'rejected';
}

function readContributionReviewQueue(): ContributionReviewQueueItem[] {
  const storage = safeLocalStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(CONTRIBUTION_REVIEW_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<ContributionReviewQueueItem>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ContributionReviewQueueItem => Boolean(
        item
        && typeof item.id === 'string'
        && isContributionReviewQueueStatus(item.status)
        && item.review?.package?.contribution_id
        && typeof item.addedAt === 'string'
        && typeof item.updatedAt === 'string'
      ))
      .slice(0, 50);
  } catch {
    return [];
  }
}

function saveContributionReviewQueue(queue: ContributionReviewQueueItem[]) {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    const normalized = queue.slice(0, 50);
    if (normalized.length === 0) {
      storage.removeItem(CONTRIBUTION_REVIEW_QUEUE_STORAGE_KEY);
      return;
    }
    storage.setItem(CONTRIBUTION_REVIEW_QUEUE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // 本地存储不可用时不阻塞贡献审核，队列仍保留在当前页面状态中。
  }
}

function contributionReviewQueueStatusLabel(status: ContributionReviewQueueStatus) {
  const map: Record<ContributionReviewQueueStatus, string> = {
    pending: '待处理',
    needs_more_evidence: '待补证',
    drafted: '已转草稿',
    rejected: '已驳回',
  };
  return map[status];
}

function buildContributionQueueReport(queue: ContributionReviewQueueItem[]) {
  return [
    '[联机助手贡献包审核队列]',
    `生成时间：${new Date().toLocaleString()}`,
    `队列数量：${queue.length}`,
    '',
    ...queue.map((item, index) => [
      `${index + 1}. ${item.review.package.game.display_name} (${item.review.package.game.game_id})`,
      `   状态：${contributionReviewQueueStatusLabel(item.status)}`,
      `   贡献 ID：${item.review.package.contribution_id}`,
      `   类型：${item.review.package.observed_multiplayer.network_type_label}`,
      `   结论：${item.review.summary}`,
      `   缺失：${item.review.missing.join('、') || '无'}`,
      `   风险：${item.review.warnings.slice(0, 3).join('；') || '无'}`,
      `   更新时间：${formatSubmitQueueSnapshotTime(item.updatedAt)}`,
    ].join('\n')),
  ].join('\n');
}

function adapterDefaultsForNetworkType(type: GameNetworkType, canConvert: boolean) {
  const defaults: {
    capabilities: GameCapability[];
    capability: MultiplayerCapability;
    methods: ConversionMethod[];
    canConvert: boolean;
    risk: 'low' | 'medium' | 'high';
    components: string[];
  } = {
    capabilities: ['lan', 'ip_join'],
    capability: 'native_lan_ip',
    methods: ['virtual_lan', 'manual_guide'],
    canConvert,
    risk: 'low',
    components: ['n2n edge', '虚拟网卡'],
  };

  if (type === 'dedicated_server') {
    return {
      ...defaults,
      capabilities: ['lan', 'ip_join', 'dedicated_server'] as GameCapability[],
      capability: 'hidden_dedicated_server' as MultiplayerCapability,
      methods: ['virtual_lan', 'dedicated_server_launcher'] as ConversionMethod[],
      components: ['n2n edge', '虚拟网卡', '游戏服务端'],
    };
  }
  if (type === 'tcp_port_proxy_needed') {
    return {
      ...defaults,
      capability: 'tcp_udp_proxy_possible' as MultiplayerCapability,
      methods: ['virtual_lan', 'port_proxy'] as ConversionMethod[],
      risk: 'medium' as const,
      components: ['n2n edge', 'TCP/UDP 端口代理'],
    };
  }
  if (type === 'udp_broadcast_needed') {
    return {
      ...defaults,
      capability: 'lan_discovery_broadcast' as MultiplayerCapability,
      methods: ['virtual_lan', 'broadcast_bridge'] as ConversionMethod[],
      risk: 'medium' as const,
      components: ['n2n edge', 'UDP 广播桥'],
    };
  }
  if (type === 'local_coop_remote_play') {
    return {
      capabilities: ['local_coop', 'remote_play_together'] as GameCapability[],
      capability: 'local_coop_remote_play' as MultiplayerCapability,
      methods: ['steam_remote_play', 'sunshine_moonlight', 'manual_guide'] as ConversionMethod[],
      canConvert: false,
      risk: 'low' as const,
      components: ['Steam Remote Play Together', 'Sunshine + Moonlight'],
    };
  }
  if (type === 'steam_p2p_only' || type === 'steam_relay_plugin' || type === 'steam_lobby_direct_possible') {
    return {
      capabilities: ['steam_lobby', 'steam_p2p'] as GameCapability[],
      capability: 'steam_p2p_lobby' as MultiplayerCapability,
      methods: ['steam_relay_plugin', 'manual_guide'] as ConversionMethod[],
      canConvert: false,
      risk: 'medium' as const,
      components: ['Steam 大厅/好友邀请', '可选 Steam Relay 插件'],
    };
  }
  if (type === 'official_only' || type === 'not_supported') {
    return {
      capabilities: ['official_server'] as GameCapability[],
      capability: type === 'not_supported' ? 'unsupported' as MultiplayerCapability : 'official_only' as MultiplayerCapability,
      methods: ['not_supported', 'manual_guide'] as ConversionMethod[],
      canConvert: false,
      risk: 'high' as const,
      components: ['官方联机流程'],
    };
  }
  if (type === 'unknown_need_review') {
    return {
      capabilities: ['unknown'] as GameCapability[],
      capability: 'unknown' as MultiplayerCapability,
      methods: ['manual_guide'] as ConversionMethod[],
      canConvert: false,
      risk: 'high' as const,
      components: ['管理员人工确认', '多人能力证据'],
    };
  }
  if (type === 'mod_required') {
    return {
      capabilities: ['unknown'] as GameCapability[],
      capability: 'community_mod' as MultiplayerCapability,
      methods: ['mod_installer', 'manual_guide'] as ConversionMethod[],
      canConvert: false,
      risk: 'high' as const,
      components: ['社区插件或 Mod', '管理员人工确认'],
    };
  }
  return defaults;
}

function buildAdapter(form: typeof emptyEditor): GameAdapter {
  const ports = form.default_ports
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  const defaults = adapterDefaultsForNetworkType(form.network_type, form.can_convert_to_lan);
  const remoteCoop = form.network_type === 'local_coop_remote_play';
  const steamOnly = form.network_type === 'steam_p2p_only' || form.network_type === 'steam_relay_plugin' || form.network_type === 'steam_lobby_direct_possible';
  const officialOnly = form.network_type === 'official_only' || form.network_type === 'not_supported';
  const requiresVirtualLan = !remoteCoop && !steamOnly && !officialOnly;
  return {
    game_id: form.game_id.trim(),
    display_name: form.display_name.trim(),
    steam_appid: form.steam_appid.trim() || null,
    adapter_version: '1.0.0',
    description: form.notes.trim() || `${form.display_name.trim() || form.game_id.trim()} 联机方案适配器。`,
    capabilities: defaults.capabilities,
    multiplayer_conversion: {
      capability: defaults.capability,
      methods: defaults.methods,
      can_convert_to_lan: defaults.canConvert,
      risk_level: defaults.risk,
      notes: form.notes.split('\n').map((item) => item.trim()).filter(Boolean),
      required_components: defaults.components,
    },
    network_type: form.network_type,
    connection_plan: {
      summary: form.notes.trim() || (remoteCoop
        ? '房主启动本地同屏游戏，通过 Steam Remote Play 或 Sunshine + Moonlight 邀请好友。'
        : steamOnly
          ? '保留 Steam 大厅/P2P 入口，按游戏原生邀请流程加入。'
          : officialOnly
            ? '当前仅建议使用官方服务器或官方联机入口。'
            : '使用虚拟局域网后，在游戏内通过虚拟 IP 和端口加入。'),
      host_role: remoteCoop
        ? '房主启动游戏并进入本地同屏/本地合作模式，然后发起远程同屏邀请。'
        : steamOnly
          ? '房主使用游戏原生 Steam 大厅/好友邀请创建房间。'
          : officialOnly
            ? '使用游戏官方服务器或官方大厅。'
            : '房主启动游戏/服务端，并保持虚拟局域网在线。',
      join_role: remoteCoop
        ? '好友接受 Steam Remote Play 邀请，或使用 Moonlight 连接房主 Sunshine。'
        : steamOnly
          ? '好友通过 Steam 邀请或游戏官方大厅加入。'
          : officialOnly
            ? '按官方入口加入，不使用本地转换。'
            : '好友使用同一组网配置加入后，连接房主虚拟 IP。',
      default_join_host: remoteCoop ? 'Steam Remote Play / Moonlight 会话' : steamOnly ? 'Steam 大厅/官方邀请' : '10.0.8.1',
      default_join_port: remoteCoop || steamOnly || officialOnly ? null : ports[0] ?? 7777,
      requires_virtual_lan: requiresVirtualLan,
      requires_tcp_port_proxy: form.network_type === 'tcp_port_proxy_needed',
      requires_udp_broadcast_bridge: form.network_type === 'udp_broadcast_needed',
      requires_dedicated_server: form.network_type === 'dedicated_server',
      invite_template: remoteCoop
        ? ['房主启动本地同屏模式', '通过 Steam Remote Play 或 Sunshine + Moonlight 邀请好友', '确认好友输入权限']
        : steamOnly
          ? ['使用 Steam/官方大厅邀请好友', '如需插件方案请先人工确认']
          : ['游戏：{game}', '房主虚拟 IP：{host_ip}', '端口：{port}'],
      troubleshooting: remoteCoop
        ? ['检查远程同屏输入权限', '降低串流分辨率或码率', '不要用 n2n 端口检测判断同屏游戏']
        : steamOnly
          ? ['确认 Steam 好友邀请可用', '涉及反作弊或官方账号时保持官方流程']
          : ['确认双方处于同一 n2n 房间', '确认防火墙允许游戏端口'],
    },
    applicability: {
      verification_status: form.verification_status,
      tested_versions: splitStructuredList(form.tested_versions),
      tested_platforms: splitStructuredList(form.tested_platforms),
      supported_os: splitStructuredList(form.supported_os),
      network_conditions: splitStructuredList(form.network_conditions),
      known_limitations: splitStructuredList(form.known_limitations),
    },
    evidence: {
      port_protocols: splitStructuredList(form.port_protocols),
      proof_items: splitStructuredList(form.evidence_items),
      test_steps: splitStructuredList(form.test_steps),
      last_verified_at: form.last_verified_at.trim() || null,
    },
    adapter_source: 'custom',
    executables: form.executables.split(',').map((item) => item.trim()).filter(Boolean),
    default_ports: ports.length > 0 ? ports : [7777],
    launch_profiles: [],
  };
}

export function ProductSolutionsView({
  onTriggerToast,
  solutionsUrl,
  onUpdateSolutionsUrl,
}: ProductSolutionsViewProps) {
  const [initialSubmitQueue] = useState(() => readAdapterSubmitQueueSnapshot());
  const [adapters, setAdapters] = useState<GameAdapter[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [syncResult, setSyncResult] = useState<AdapterRegistrySyncResult | null>(() => getReferenceAdapterSyncResult()?.result ?? null);
  const [syncPreview, setSyncPreview] = useState<AdapterRegistrySyncPreview | null>(null);
  const [syncPreviewRequiresConfirm, setSyncPreviewRequiresConfirm] = useState(false);
  const [adapterConflicts, setAdapterConflicts] = useState<AdapterConflictReport[]>([]);
  const [adapterBackups, setAdapterBackups] = useState<AdapterBackupEntry[]>([]);
  const [adapterDiffPanel, setAdapterDiffPanel] = useState<{
    title: string;
    subtitle: string;
    fields: AdapterChangeDiffField[];
  } | null>(null);
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [submitPackage, setSubmitPackage] = useState<AdapterRegistrySubmitPackage | null>(null);
  const [submitQueueGameIds, setSubmitQueueGameIds] = useState<string[]>(initialSubmitQueue.gameIds);
  const [submitQueueBatchText, setSubmitQueueBatchText] = useState(initialSubmitQueue.batchText);
  const [submitQueueRestoredAt, setSubmitQueueRestoredAt] = useState(initialSubmitQueue.updatedAt);
  const [submitQueueSavedAt, setSubmitQueueSavedAt] = useState(initialSubmitQueue.updatedAt);
  const [submitQueuePublishResult, setSubmitQueuePublishResult] = useState<AdapterRegistryLocalPublishResult | null>(null);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [contributionForm, setContributionForm] = useState<AdapterContributionForm>(() => createEmptyAdapterContributionForm());
  const [contributionResult, setContributionResult] = useState<AdapterContributionBuildResult | null>(null);
  const [contributionImportText, setContributionImportText] = useState('');
  const [contributionReview, setContributionReview] = useState<AdapterContributionReviewResult | null>(null);
  const [contributionReviewQueue, setContributionReviewQueue] = useState<ContributionReviewQueueItem[]>(() => readContributionReviewQueue());
  const [pendingContributionDraftId, setPendingContributionDraftId] = useState<string | null>(null);
  const [savedAdapterReview, setSavedAdapterReview] = useState<SavedAdapterReview | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState(emptyEditor);
  const [editorPreviewConfirmed, setEditorPreviewConfirmed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | AdapterCategoryId>('all');
  const [reviewWorkbenchFilter, setReviewWorkbenchFilter] = useState<ReviewWorkbenchFilter>('all');
  const [adapterIntent, setAdapterIntent] = useState<AdapterCreationIntent | null>(() => readAdapterCreationIntent());
  const [adapterIntentApplied, setAdapterIntentApplied] = useState(false);

  const filteredAdapters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return adapters.filter((adapter) => {
      const matchesQuery = !needle || adapter.display_name.toLowerCase().includes(needle) || adapter.game_id.toLowerCase().includes(needle);
      const matchesCategory = categoryFilter === 'all' || deriveAdapterCategory(adapter).id === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [adapters, categoryFilter, query]);

  const inventory = useMemo(() => summarizeAdapterInventory(adapters), [adapters]);
  const publishAuditSummary = useMemo(
    () => summarizePublishAudits(adapters, syncResult),
    [adapters, syncResult],
  );
  const conflictByGameId = useMemo(() => {
    const map = new Map<string, AdapterConflictReport>();
    adapterConflicts.forEach((conflict) => map.set(conflict.game_id, conflict));
    return map;
  }, [adapterConflicts]);
  const adapterQualitySummary = useMemo(() => {
    const scores = adapters.map((adapter) => buildAdapterQualityScore(adapter, {
      hasConflict: conflictByGameId.get(adapter.game_id)?.has_conflict,
      conflictSummary: conflictByGameId.get(adapter.game_id)?.summary,
    }));
    return summarizeAdapterQuality(scores);
  }, [adapters, conflictByGameId]);
  const adapterReviewWorkbenchItems = useMemo(() => adapters.map((adapter) => {
    const conflict = conflictByGameId.get(adapter.game_id);
    const quality = buildAdapterQualityScore(adapter, {
      hasConflict: conflict?.has_conflict,
      conflictSummary: conflict?.summary,
    });
    const audit = auditAdapterForPublish(adapter, syncResult);
    const missingEvidence = !adapterHasStructuredApplicability(adapter) || !adapterHasStructuredEvidence(adapter);
    const reasons = uniqueText([
      ...quality.risks,
      ...quality.missing.map((item) => `缺少：${item}`),
      ...audit.review,
      ...audit.warnings,
      conflict?.has_conflict ? `版本冲突：${conflict.summary}` : '',
    ]);
    const needsReview = audit.state === 'needs_review'
      || audit.state === 'incomplete'
      || quality.level !== 'high'
      || missingEvidence
      || Boolean(conflict?.has_conflict);
    const recommendation = audit.state === 'registry_synced'
      ? '已来自共享库，通常无需重复提交；若本地仍有冲突，先处理版本来源。'
      : missingEvidence
        ? '先补齐结构化适用条件和验证证据，再生成共享库提交包。'
        : audit.canSubmit
          ? '可以生成提交包，但提交前仍需人工核对证据和适用边界。'
          : '暂不建议提交；先处理缺失字段或待复核原因。';
    return { adapter, quality, audit, conflict, missingEvidence, needsReview, reasons, recommendation };
  }), [adapters, conflictByGameId, syncResult]);
  const filteredReviewWorkbenchItems = useMemo(() => adapterReviewWorkbenchItems.filter((item) => {
    if (reviewWorkbenchFilter === 'high_confidence') return item.quality.level === 'high' && !item.missingEvidence;
    if (reviewWorkbenchFilter === 'needs_review') return item.needsReview;
    if (reviewWorkbenchFilter === 'missing_evidence') return item.missingEvidence;
    if (reviewWorkbenchFilter === 'submit_ready') return item.audit.canSubmit && item.audit.state !== 'incomplete' && !item.missingEvidence;
    return true;
  }), [adapterReviewWorkbenchItems, reviewWorkbenchFilter]);
  const reviewWorkbenchStats = useMemo(() => ({
    total: adapterReviewWorkbenchItems.length,
    highConfidence: adapterReviewWorkbenchItems.filter((item) => item.quality.level === 'high' && !item.missingEvidence).length,
    needsReview: adapterReviewWorkbenchItems.filter((item) => item.needsReview).length,
    missingEvidence: adapterReviewWorkbenchItems.filter((item) => item.missingEvidence).length,
    submitReady: adapterReviewWorkbenchItems.filter((item) => item.audit.canSubmit && item.audit.state !== 'incomplete' && !item.missingEvidence).length,
  }), [adapterReviewWorkbenchItems]);
  const submitQueueAdapters = useMemo(() => submitQueueGameIds
    .map((gameId) => adapters.find((adapter) => adapter.game_id === gameId))
    .filter((adapter): adapter is GameAdapter => Boolean(adapter)),
  [adapters, submitQueueGameIds]);
  const savedAdapterReviewQuality = useMemo(() => savedAdapterReview
    ? buildAdapterQualityScore(savedAdapterReview.adapter, {
      hasConflict: conflictByGameId.get(savedAdapterReview.adapter.game_id)?.has_conflict,
      conflictSummary: conflictByGameId.get(savedAdapterReview.adapter.game_id)?.summary,
    })
    : null,
  [conflictByGameId, savedAdapterReview]);
  const savedAdapterReviewAudit = useMemo(() => savedAdapterReview
    ? auditAdapterForPublish(savedAdapterReview.adapter, syncResult)
    : null,
  [savedAdapterReview, syncResult]);
  const conflictSummary = useMemo(() => {
    const conflicts = adapterConflicts.filter((item) => item.has_conflict).length;
    const multiSource = adapterConflicts.filter((item) => item.variants.length > 1).length;
    const pinnedCustom = adapterConflicts.filter((item) => item.active_source === 'custom').length;
    const registryActive = adapterConflicts.filter((item) => item.active_source === 'registry').length;
    return { conflicts, multiSource, pinnedCustom, registryActive, total: adapterConflicts.length };
  }, [adapterConflicts]);
  const activeRegistryUrl = solutionsUrl.trim() || DEFAULT_REGISTRY_URL;
  const activeRegistryKind = activeRegistryUrl === DEFAULT_REGISTRY_URL
    ? 'GitHub Pages 默认库'
    : activeRegistryUrl.includes('github.io')
      ? 'GitHub Pages 自建库'
      : 'VPS / 静态服务器库';
  const syncPreviewDiffSummary = useMemo(() => {
    if (!syncPreview) {
      return {
        changedItems: 0,
        recommendationImpact: 0,
        protectedItems: 0,
        failedItems: 0,
        changedLabels: [] as string[],
      };
    }
    const changedItems = syncPreview.items.filter((item) => item.diff_fields?.some((field) => field.changed)).length;
    const recommendationImpact = syncPreview.items.filter((item) =>
      item.diff_fields?.some((field) => field.changed && field.affects_recommendation)
    ).length;
    const protectedItems = syncPreview.items.filter((item) => item.has_custom || item.conflict_with_custom || item.status === 'custom_protected').length;
    const failedItems = syncPreview.items.filter((item) => item.status.startsWith('skipped_')).length;
    const changedLabels = uniqueText(syncPreview.items.flatMap((item) =>
      item.diff_fields?.filter((field) => field.changed).map((field) => field.label) ?? []
    )).slice(0, 6);
    return { changedItems, recommendationImpact, protectedItems, failedItems, changedLabels };
  }, [syncPreview]);
  const syncResultAfterSummary = useMemo(() => {
    if (!syncResult) {
      return {
        changed: 0,
        failed: 0,
        unchanged: 0,
        source: '尚未同步',
        nextAction: '先选择 GitHub Pages、VPS 或本地示例库，再执行同步前预检。',
      };
    }
    const changed = syncResult.created + syncResult.updated;
    const failed = syncResult.hash_failed + syncResult.parse_failed + syncResult.fetch_failed + syncResult.validation_failed + syncResult.write_failed;
    const unchanged = syncResult.items.filter((item) => item.status === 'skipped' || item.status === 'unchanged').length;
    const source = syncResult.registry_url.includes('adapter-registry\\index.json') || syncResult.registry_url.includes('adapter-registry/index.json')
      ? (syncResult.registry_url.startsWith('http') ? '远程共享库' : '本地示例库')
      : '远程共享库';
    const nextAction = failed > 0
      ? '先复制同步报告给管理员，处理拉取/哈希/写入失败。'
      : changed > 0
        ? '同步后重新打开推荐页或游戏扫描页，确认新 adapter 是否被自动套用。'
        : '没有写入变化；如果游戏仍缺方案，进入自建适配器编辑器补充。';
    return { changed, failed, unchanged, source, nextAction };
  }, [syncResult]);
  const conversionAssessmentValidationResults = useMemo(
    () => validateConversionAssessmentSamples(),
    [],
  );
  const conversionAssessmentValidationSummary = useMemo(() => ({
    total: conversionAssessmentValidationResults.length,
    passed: conversionAssessmentValidationResults.filter((item) => item.passed).length,
    lanInvite: conversionAssessmentValidationResults.filter((item) => item.canCreateLanInvite).length,
    nonLan: conversionAssessmentValidationResults.filter((item) => !item.canCreateLanInvite).length,
  }), [conversionAssessmentValidationResults]);
  const adapterIntentMatch = useMemo(() => {
    if (!adapterIntent?.game_id) return null;
    return adapters.find((adapter) => adapter.game_id === adapterIntent.game_id) ?? null;
  }, [adapterIntent?.game_id, adapters]);
  const activeCapabilityDecision = useMemo(
    () => decisionRowForNetworkType(editor.network_type),
    [editor.network_type],
  );
  const adapterIntentIsConversionAssessment = adapterIntent?.reason === 'conversion_assessment';
  const adapterRegistryClosureAuditInput = useMemo(() => ({
    adapters,
    filteredAdapterCount: filteredAdapters.length,
    syncResult,
    syncPreview,
    syncPreviewRequiresConfirm,
    submitQueueGameIds,
    submitQueueBatchText,
    contributionReviewQueueCount: contributionReviewQueue.length,
    contributionReviewStatuses: Array.from(new Set(contributionReviewQueue.map((item) => contributionReviewQueueStatusLabel(item.status)))),
    hasContributionResult: Boolean(contributionResult),
    hasContributionReview: Boolean(contributionReview),
    hasSavedAdapterReview: Boolean(savedAdapterReview),
    savedAdapterGameId: savedAdapterReview?.adapter.game_id,
    savedAdapterDisplayName: savedAdapterReview?.adapter.display_name,
    adapterConflictCount: conflictSummary.conflicts,
    adapterBackupCount: adapterBackups.length,
    submitReadyCount: reviewWorkbenchStats.submitReady,
    needsReviewCount: reviewWorkbenchStats.needsReview,
    missingEvidenceCount: reviewWorkbenchStats.missingEvidence,
    highConfidenceCount: reviewWorkbenchStats.highConfidence,
    conversionSampleTotal: conversionAssessmentValidationSummary.total,
    conversionSamplePassed: conversionAssessmentValidationSummary.passed,
    activeRegistryUrl,
    activeRegistryKind,
  }), [
    activeRegistryKind,
    activeRegistryUrl,
    adapterBackups.length,
    adapters,
    conflictSummary.conflicts,
    contributionResult,
    contributionReview,
    contributionReviewQueue,
    conversionAssessmentValidationSummary.passed,
    conversionAssessmentValidationSummary.total,
    filteredAdapters.length,
    reviewWorkbenchStats.highConfidence,
    reviewWorkbenchStats.missingEvidence,
    reviewWorkbenchStats.needsReview,
    reviewWorkbenchStats.submitReady,
    savedAdapterReview,
    submitQueueBatchText,
    submitQueueGameIds,
    syncPreview,
    syncPreviewRequiresConfirm,
    syncResult,
  ]);
  const adapterRegistryClosureAudit = useMemo(
    () => buildAdapterRegistryClosureAudit(adapterRegistryClosureAuditInput),
    [adapterRegistryClosureAuditInput],
  );
  const conversionEngineClosureAuditInput = useMemo(() => ({
    sampleResults: conversionAssessmentValidationResults,
    activeDecision: activeCapabilityDecision,
    adapterIntent,
    adapterIntentIsConversionAssessment,
    adapterCount: adapters.length,
    editorNetworkType: editor.network_type,
    activeRegistryUrl,
  }), [
    activeCapabilityDecision,
    activeRegistryUrl,
    adapterIntent,
    adapterIntentIsConversionAssessment,
    adapters.length,
    conversionAssessmentValidationResults,
    editor.network_type,
  ]);
  const conversionEngineClosureAudit = useMemo(
    () => buildConversionEngineClosureAudit(conversionEngineClosureAuditInput),
    [conversionEngineClosureAuditInput],
  );

  const applyAdapterIntent = (intent: AdapterCreationIntent) => {
    setPendingContributionDraftId(null);
    setEditor((previous) => editorFromIntent(intent, previous));
    setEditorOpen(true);
    setQuery(intent.game_id || intent.display_name || '');
  };

  const prefillContributionFromIntent = (intent?: AdapterCreationIntent | null) => {
    if (!intent) return;
    const isConversionAssessment = intent.reason === 'conversion_assessment';
    setContributionForm((previous) => ({
      ...previous,
      display_name: intent.display_name || previous.display_name,
      game_id: intent.game_id || previous.game_id,
      steam_appid: intent.steam_appid || previous.steam_appid,
      executable_hint: executableFromPath(intent.detected_path) || previous.executable_hint,
      network_type: intent.network_type || previous.network_type,
      default_ports: intent.default_port ? String(intent.default_port) : previous.default_ports,
      observed_flow: previous.observed_flow || [
        isConversionAssessment ? `转换评估：${intent.note || '需要确认游戏原始多人能力。'}` : (intent.note || '当前诊断提示缺少 adapter，需要补充游戏联机现象和测试步骤。'),
        intent.game_type ? `游戏类型：${intent.game_type}` : '',
        intent.original_capability ? `原始能力：${intent.original_capability}` : '',
        intent.recommended_plan ? `推荐方案：${intent.recommended_plan}` : '',
      ].filter(Boolean).join('\n'),
      test_steps: intent.user_steps?.length ? intent.user_steps.join('\n') : previous.test_steps,
      proof_items: intent.admin_evidence?.length
        ? intent.admin_evidence.map((item) => `待补充证据：${item}`).join('\n')
        : previous.proof_items,
      known_limitations: intent.boundaries?.length ? intent.boundaries.join('\n') : previous.known_limitations,
      extra_notes: previous.extra_notes || [
        isConversionAssessment ? '来源：推荐页非 LAN 转换评估' : '来源：诊断缺 adapter 引导',
        intent.adapter_signals?.length ? `adapter 信号：${intent.adapter_signals.join('；')}` : '',
        intent.assessment_report ? `评估报告：\n${intent.assessment_report}` : '',
      ].filter(Boolean).join('\n'),
    }));
    setContributionOpen(true);
    setContributionResult(null);
    onTriggerToast(isConversionAssessment ? '已把转换评估填入用户贡献入口。' : '已把诊断信息填入用户贡献入口。');
  };

  const updateContributionField = (field: keyof AdapterContributionForm, value: string) => {
    setContributionForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setContributionResult(null);
  };

  const applyCapabilityDecisionToEditor = (decisionId: string) => {
    const row = connectionCapabilityMatrix.find((item) => item.id === decisionId);
    if (!row) {
      onTriggerToast('未找到对应的游戏类型决策。');
      return;
    }
    const preset = buildAdapterEditorPresetFromDecision(row);
    setEditor((previous) => ({
      ...previous,
      network_type: preset.network_type,
      can_convert_to_lan: preset.can_convert_to_lan,
      evidence_items: row.evidenceToCollect.join('\n'),
      known_limitations: row.riskNote,
      notes: preset.notes,
    }));
    onTriggerToast(`已按“${row.gameType}”套用决策表，端口和游戏标识保持不变。`);
  };

  const loadAdapters = async (label = '读取真实方案库') => {
    setBusy(label);
    try {
      const result = await listGameAdapters();
      setAdapters(result);
      try {
        const conflicts = await listAdapterConflicts();
        setAdapterConflicts(conflicts);
      } catch (conflictError) {
        setAdapterConflicts([]);
        onTriggerToast(`适配器版本状态读取失败：${conflictError instanceof Error ? conflictError.message : String(conflictError)}`);
      }
      try {
        const backups = await listAdapterBackups();
        setAdapterBackups(backups);
      } catch (backupError) {
        setAdapterBackups([]);
        onTriggerToast(`适配器备份历史读取失败：${backupError instanceof Error ? backupError.message : String(backupError)}`);
      }
      onTriggerToast(`已读取 ${result.length} 个本地真实适配方案。`);
      return result;
    } catch (error) {
      onTriggerToast(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    loadAdapters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!adapterIntent || adapterIntentApplied) return;
    applyAdapterIntent(adapterIntent);
    setAdapterIntentApplied(true);
    onTriggerToast('已根据诊断预填自建适配器草稿。请先同步共享库，再决定是否保存。');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapterIntent, adapterIntentApplied]);

  useEffect(() => {
    const updatedAt = new Date().toISOString();
    saveAdapterSubmitQueueSnapshot({
      gameIds: submitQueueGameIds,
      batchText: submitQueueBatchText,
      updatedAt,
    });
    setSubmitQueueSavedAt(submitQueueGameIds.length > 0 || submitQueueBatchText.trim() ? updatedAt : '');
  }, [submitQueueBatchText, submitQueueGameIds]);

  useEffect(() => {
    saveContributionReviewQueue(contributionReviewQueue);
  }, [contributionReviewQueue]);

  useEffect(() => {
    setEditorPreviewConfirmed(false);
  }, [editor]);

  const syncPreviewHasRisk = (preview: AdapterRegistrySyncPreview) =>
    preview.possible_conflicts > 0 || preview.would_affect_active > 0 || preview.skipped > 0;

  const previewStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      custom_conflict: '自建冲突',
      will_create_registry: '将新增',
      will_update_registry: '将更新',
      unchanged_registry: '无变化',
      custom_protected: '自建保护',
      skipped_hash_failed: '哈希失败',
      skipped_parse_failed: '解析失败',
      skipped_fetch_failed: '拉取失败',
      skipped_validation_failed: '校验失败',
    };
    return map[status] ?? status;
  };

  const buildSyncPreviewReportText = (preview: AdapterRegistrySyncPreview) => [
    '[联机助手共享库同步预检]',
    `地址：${preview.registry_url}`,
    `统计：新增 ${preview.will_create}，更新 ${preview.will_update}，不变 ${preview.unchanged}，自建保护 ${preview.custom_protected}，影响当前 ${preview.would_affect_active}，潜在冲突 ${preview.possible_conflicts}，跳过 ${preview.skipped}`,
    '',
    ...preview.items.map((item) => [
      `- ${item.display_name || item.game_id}：${previewStatusLabel(item.status)}`,
      `  原因：${item.reason}`,
      `  本地来源：${item.local_sources.join(', ') || '无'}；当前生效：${sourceLabel(item.active_source)}`,
      `  将写入：${item.saved_path || '-'}`,
      `  关键差异：${item.diff_fields?.filter((field) => field.changed).map((field) => `${field.label}${field.affects_recommendation ? '(影响推荐)' : ''}`).join('、') || '无'}`,
    ].join('\n')),
  ].join('\n');

  const copySyncPreviewReport = () => {
    if (!syncPreview) {
      onTriggerToast('暂无同步预检报告。');
      return;
    }
    copyText(buildSyncPreviewReportText(syncPreview), '同步预检报告');
  };

  const runRemoteSyncNow = async (registryUrl: string) => {
    setBusy('同步共享方案库');
    try {
      const result = await syncAdapterRegistry(registryUrl);
      setReferenceAdapterSyncResult('remote', result);
      setSyncResult(result);
      setSyncPreviewRequiresConfirm(false);
      const nextAdapters = await loadAdapters('刷新同步后的方案库');
      const matched = adapterIntent?.game_id ? nextAdapters?.find((adapter) => adapter.game_id === adapterIntent.game_id) : null;
      onTriggerToast(matched
        ? `共享库同步完成，并已找到 ${matched.display_name} 的方案。`
        : `共享库同步完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}。`);
    } catch (error) {
      onTriggerToast(`同步共享库失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const syncRemote = async (confirmed = false, explicitRegistryUrl?: string) => {
    const registryUrl = explicitRegistryUrl?.trim() || activeRegistryUrl;
    if (explicitRegistryUrl?.trim()) {
      onUpdateSolutionsUrl(registryUrl);
    }
    if (confirmed) {
      await runRemoteSyncNow(registryUrl);
      return;
    }
    setBusy('同步前预检共享库');
    try {
      const preview = await previewAdapterRegistrySync(registryUrl);
      setSyncPreview(preview);
      const hasRisk = syncPreviewHasRisk(preview);
      setSyncPreviewRequiresConfirm(hasRisk);
      if (hasRisk) {
        onTriggerToast(`同步前预检发现 ${preview.possible_conflicts} 个潜在冲突、${preview.would_affect_active} 个会影响当前生效方案，请确认后再同步。`);
        return;
      }
      onTriggerToast('同步前预检通过，未发现自建冲突或高风险更新，开始同步。');
      await runRemoteSyncNow(registryUrl);
    } catch (error) {
      onTriggerToast(`同步前预检失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const syncDefaultGithubRegistry = () => syncRemote(false, DEFAULT_REGISTRY_URL);
  const syncCurrentRemoteRegistry = () => syncRemote(false, activeRegistryUrl);

  const syncLocalExample = async () => {
    setBusy('同步本地示例方案库');
    try {
      const result = await syncLocalAdapterRegistryExample();
      setReferenceAdapterSyncResult('local', result);
      setSyncResult(result);
      const nextAdapters = await loadAdapters('刷新本地示例');
      const matched = adapterIntent?.game_id ? nextAdapters?.find((adapter) => adapter.game_id === adapterIntent.game_id) : null;
      onTriggerToast(matched
        ? `本地示例同步完成，并已找到 ${matched.display_name} 的方案。`
        : `本地 adapter-registry 示例同步完成：新增 ${result.created}，更新 ${result.updated}。`);
    } catch (error) {
      onTriggerToast(`同步本地示例失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const importAdapter = async () => {
    if (!importText.trim()) {
      onTriggerToast('请先粘贴 adapter JSON。');
      return;
    }
    setBusy('导入 adapter JSON');
    try {
      const pendingAdapter = JSON.parse(importText) as GameAdapter;
      const previousAdapter = adapters.find((item) => item.game_id === pendingAdapter.game_id);
      const diffFields = buildLocalAdapterDiffFields(previousAdapter, pendingAdapter);
      const adapter = await importGameAdapterJson(importText);
      setImportText('');
      showAdapterDiff(
        `${adapter.display_name} 导入差异`,
        previousAdapter ? '对比导入前当前生效方案与导入后的自建方案。' : '本地原本没有同 game_id 方案，本次导入将创建新方案。',
        diffFields,
      );
      await loadAdapters('刷新导入结果');
      onTriggerToast(`已导入真实适配器：${adapter.display_name}`);
    } catch (error) {
      onTriggerToast(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const exportAdapter = async (adapter: GameAdapter) => {
    setBusy(`导出 ${adapter.display_name}`);
    try {
      const content = await exportGameAdapterJson(adapter.game_id);
      setExportText(content);
      const pack = await buildAdapterRegistrySubmitPackage(content, solutionsUrl.trim() || DEFAULT_REGISTRY_URL);
      setSubmitPackage(pack);
      onTriggerToast(`已导出 ${adapter.display_name}，并生成共享库提交包。`);
    } catch (error) {
      onTriggerToast(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(text);
      onTriggerToast(`${label}已复制。`);
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyAdapterRegistryClosureAudit = () =>
    copyText(formatAdapterRegistryClosureAuditReport(adapterRegistryClosureAuditInput), '适配器共享库闭环自检');

  const copyConversionAssessmentValidationReport = () =>
    copyText(buildConversionAssessmentValidationReport(conversionAssessmentValidationResults), '转换评估小样本验证清单');

  const copyConversionEngineClosureAudit = () =>
    copyText(formatConversionEngineClosureAuditReport(conversionEngineClosureAuditInput), '非局域网转换引擎闭环自检');

  const generateContributionPackage = () => {
    const result = buildAdapterContributionPackage(contributionForm);
    setContributionResult(result);
    if (result.ok) {
      onTriggerToast(`已生成 ${result.package.game.display_name} 的用户贡献包。`);
    } else {
      onTriggerToast(`贡献包仍缺少：${result.missing.join('、')}。可以先补齐后再复制。`);
    }
  };

  const copyContributionPackage = () => {
    const result = contributionResult ?? buildAdapterContributionPackage(contributionForm);
    setContributionResult(result);
    copyText(result.text, '用户贡献包');
  };

  const applyContributionPackageToEditor = (
    pkg: AdapterContributionBuildResult['package'],
    sourceNote = '由用户贡献包预填，保存前必须由管理员复核。',
  ) => {
    const form = contributionPackageToForm(pkg);
    const ports = pkg.observed_multiplayer.default_ports.join(', ') || form.default_ports || '7777';
    setEditor((previous) => ({
      ...previous,
      game_id: pkg.game.game_id || previous.game_id,
      display_name: pkg.game.display_name || previous.display_name,
      steam_appid: pkg.game.steam_appid || previous.steam_appid,
      executables: pkg.game.executable_hint || previous.executables,
      default_ports: ports,
      network_type: pkg.observed_multiplayer.network_type,
      port_protocols: pkg.evidence.port_protocols.join('\n') || previous.port_protocols,
      tested_versions: pkg.game.game_version || previous.tested_versions,
      tested_platforms: pkg.game.platform || previous.tested_platforms,
      supported_os: pkg.game.os || previous.supported_os,
      network_conditions: pkg.evidence.network_conditions.join('\n') || previous.network_conditions,
      evidence_items: pkg.evidence.proof_items.join('\n') || previous.evidence_items,
      test_steps: pkg.evidence.test_steps.join('\n') || previous.test_steps,
      known_limitations: pkg.evidence.known_limitations.join('\n') || previous.known_limitations,
      notes: [
        sourceNote,
        `观察现象：${pkg.observed_multiplayer.observed_flow}`,
        `管理员建议：${pkg.admin_review.suggested_route}`,
        ...pkg.evidence.extra_notes.map((note) => `备注：${note}`),
      ].join('\n'),
    }));
    setPendingContributionDraftId(pkg.contribution_id);
    setEditorOpen(true);
    setContributionOpen(false);
  };

  const applyContributionToEditor = () => {
    const result = contributionResult ?? buildAdapterContributionPackage(contributionForm);
    setContributionResult(result);
    applyContributionPackageToEditor(result.package);
    onTriggerToast('已把贡献包内容转入自建适配器编辑器，请管理员复核后再保存。');
  };

  const parseContributionImport = () => {
    try {
      const review = parseAdapterContributionInput(contributionImportText);
      setContributionReview(review);
      setContributionForm(contributionPackageToForm(review.package));
      setContributionResult(null);
      upsertContributionReviewQueue(review);
      onTriggerToast(`已解析 ${review.package.game.display_name} 的贡献包。`);
    } catch (error) {
      setContributionReview(null);
      onTriggerToast(`解析贡献包失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const upsertContributionReviewQueue = (
    review: AdapterContributionReviewResult,
    nextStatus?: ContributionReviewQueueStatus,
  ) => {
    const now = new Date().toISOString();
    const id = review.package.contribution_id;
    setContributionReviewQueue((previous) => {
      const existing = previous.find((item) => item.id === id);
      const status = nextStatus || existing?.status || (review.ok ? 'pending' : 'needs_more_evidence');
      const nextItem: ContributionReviewQueueItem = {
        id,
        status,
        review,
        addedAt: existing?.addedAt || now,
        updatedAt: now,
      };
      return [nextItem, ...previous.filter((item) => item.id !== id)].slice(0, 50);
    });
  };

  const updateContributionQueueStatus = (id: string, status: ContributionReviewQueueStatus) => {
    const now = new Date().toISOString();
    setContributionReviewQueue((previous) => previous.map((item) =>
      item.id === id ? { ...item, status, updatedAt: now } : item
    ));
  };

  const openContributionQueueItem = (item: ContributionReviewQueueItem) => {
    setContributionReview(item.review);
    setContributionForm(contributionPackageToForm(item.review.package));
    setContributionImportText(JSON.stringify(item.review.package, null, 2));
    setContributionOpen(true);
    onTriggerToast(`已打开贡献包：${item.review.package.game.display_name}`);
  };

  const removeContributionQueueItem = (id: string) => {
    setContributionReviewQueue((previous) => previous.filter((item) => item.id !== id));
    onTriggerToast('已从贡献审核队列移除。');
  };

  const clearContributionReviewQueue = () => {
    setContributionReviewQueue([]);
    onTriggerToast('已清空贡献审核队列。');
  };

  const copyContributionQueueReport = () => {
    if (contributionReviewQueue.length === 0) {
      onTriggerToast('贡献审核队列为空。');
      return;
    }
    copyText(buildContributionQueueReport(contributionReviewQueue), '贡献审核队列');
  };

  const copyContributionReview = () => {
    if (!contributionReview) {
      onTriggerToast('暂无贡献包审核意见。');
      return;
    }
    copyText(contributionReview.reviewText, '贡献包审核意见');
  };

  const requestContributionEvidence = () => {
    if (!contributionReview) {
      onTriggerToast('请先解析贡献包。');
      return;
    }
    const lines = [
      `[联机助手贡献包补充请求] ${contributionReview.package.game.display_name}`,
      contributionReview.missing.length
        ? `请补充：${contributionReview.missing.join('、')}`
        : '关键字段基本完整，但仍需要更多实测证据。',
      contributionReview.warnings.length ? `注意：${contributionReview.warnings.join('；')}` : '',
      '请重新生成并发送贡献包，或补充截图/日志/端口检测结果。',
    ].filter(Boolean);
    updateContributionQueueStatus(contributionReview.package.contribution_id, 'needs_more_evidence');
    copyText(lines.join('\n'), '补充证据请求');
  };

  const applyContributionReviewToEditor = () => {
    if (!contributionReview) {
      onTriggerToast('请先解析贡献包。');
      return;
    }
    applyContributionPackageToEditor(contributionReview.package, '由导入的用户贡献包预填，保存前必须由管理员复核。');
    updateContributionQueueStatus(contributionReview.package.contribution_id, 'drafted');
    onTriggerToast('已把导入贡献包转入管理员编辑器，请复核后再保存。');
  };

  const buildAdapterReviewOpinion = (item: typeof adapterReviewWorkbenchItems[number]) => [
    `[联机助手共享库审核意见] ${item.adapter.display_name} (${item.adapter.game_id})`,
    `来源：${sourceLabel(item.adapter.adapter_source)}`,
    `联机类型：${networkTypeLabel(item.adapter.network_type)}`,
    `质量评分：${item.quality.label} ${item.quality.score} 分`,
    `发布审核：${item.audit.label}；${item.audit.summary}`,
    `结构化适用条件：${formatAdapterApplicability(item.adapter)}`,
    `结构化验证证据：${formatAdapterEvidence(item.adapter)}`,
    `提交建议：${item.recommendation}`,
    item.conflict?.has_conflict ? `版本冲突：${item.conflict.summary}` : '',
    '',
    '需要处理：',
    ...(item.reasons.length > 0 ? item.reasons.slice(0, 8).map((reason) => `- ${reason}`) : ['- 暂无明显阻断项，提交前做一次人工核对即可。']),
  ].filter(Boolean).join('\n');

  const copyAdapterReviewOpinion = (item: typeof adapterReviewWorkbenchItems[number]) =>
    copyText(buildAdapterReviewOpinion(item), '单个 adapter 审核意见');

  const copyReviewWorkbenchReport = () => {
    const title = reviewWorkbenchFilter === 'all'
      ? '全部 adapter'
      : reviewWorkbenchFilter === 'high_confidence'
        ? '高可信 adapter'
        : reviewWorkbenchFilter === 'needs_review'
          ? '需复核 adapter'
          : reviewWorkbenchFilter === 'missing_evidence'
            ? '缺证据 adapter'
            : '可提交 adapter';
    const lines = [
      '[联机助手共享库审核工作台]',
      `筛选：${title}`,
      `统计：总数 ${reviewWorkbenchStats.total}；高可信 ${reviewWorkbenchStats.highConfidence}；需复核 ${reviewWorkbenchStats.needsReview}；缺证据 ${reviewWorkbenchStats.missingEvidence}；可提交 ${reviewWorkbenchStats.submitReady}`,
      '',
      ...(filteredReviewWorkbenchItems.length > 0
        ? filteredReviewWorkbenchItems.slice(0, 20).map(buildAdapterReviewOpinion)
        : ['当前筛选下没有 adapter。']),
    ];
    copyText(lines.join('\n\n'), '共享库审核工作台报告');
  };

  const addAdapterToSubmitQueue = (adapter: GameAdapter) => {
    if (submitQueueGameIds.includes(adapter.game_id)) {
      onTriggerToast(`${adapter.display_name} 已在共享库提交队列中。`);
      return;
    }
    setSubmitQueueGameIds((previous) => {
      if (previous.includes(adapter.game_id)) return previous;
      return [...previous, adapter.game_id];
    });
    onTriggerToast(`已加入提交队列：${adapter.display_name}`);
  };

  const removeAdapterFromSubmitQueue = (gameId: string) => {
    setSubmitQueueGameIds((previous) => previous.filter((item) => item !== gameId));
  };

  const addSubmitReadyItemsToQueue = (items: typeof adapterReviewWorkbenchItems, label: string) => {
    const readyIds = items
      .filter((item) => item.audit.canSubmit && item.audit.state !== 'incomplete' && !item.missingEvidence)
      .map((item) => item.adapter.game_id);
    if (readyIds.length === 0) {
      onTriggerToast(`${label}中没有可提交且证据完整的 adapter。`);
      return;
    }
    setSubmitQueueGameIds((previous) => Array.from(new Set([...previous, ...readyIds])));
    onTriggerToast(`已把 ${readyIds.length} 个 adapter 加入提交队列。`);
  };

  const buildSubmitQueueBatch = async () => {
    if (submitQueueAdapters.length === 0) {
      onTriggerToast('提交队列为空，请先加入可提交 adapter。');
      return;
    }
    setBusy('批量生成共享库提交队列');
    try {
      const registryUrl = solutionsUrl.trim() || DEFAULT_REGISTRY_URL;
      const packs: AdapterRegistrySubmitPackage[] = [];
      for (const adapter of submitQueueAdapters) {
        const content = await exportGameAdapterJson(adapter.game_id);
        packs.push(await buildAdapterRegistrySubmitPackage(content, registryUrl));
      }
      const indexEntriesJson = JSON.stringify(packs.map((pack) => pack.indexEntry), null, 2);
      const bundleJson = JSON.stringify({
        generated_at: new Date().toISOString(),
        registry_url: registryUrl,
        adapter_count: packs.length,
        adapters: packs.map((pack) => ({
          game_id: pack.adapter.game_id,
          display_name: pack.adapter.display_name,
          file_name: pack.fileName,
          adapter_path: pack.adapterPath,
          adapter_url: pack.adapterUrl,
          sha256: pack.sha256,
          adapter: JSON.parse(pack.normalizedJson) as GameAdapter,
        })),
        index_entries: packs.map((pack) => pack.indexEntry),
      }, null, 2);
      const report = [
        '[联机助手共享库批量提交队列]',
        `生成时间：${new Date().toLocaleString()}`,
        `共享库地址：${registryUrl}`,
        `adapter 数量：${packs.length}`,
        '',
        '文件清单：',
        ...packs.map((pack) => `- ${pack.adapter.display_name} (${pack.adapter.game_id}) -> ${pack.adapterPath} ｜ sha256=${pack.sha256}`),
        '',
        'index.json games 数组条目：',
        indexEntriesJson,
        '',
        'GitHub Pages 批量流程：',
        '1. 逐个保存下方 bundle 中 adapters[].adapter 到对应 adapter_path。',
        '2. 把 index_entries 合并进 adapter-registry/index.json 的 games 数组；同 game_id 使用新 sha256 覆盖旧条目。',
        '3. 提交并 push 到 GitHub，等待 Pages 刷新。',
        '4. 客户端在方案库中同步共享库地址并观察同步预检结果。',
        '',
        'VPS / 静态服务器批量流程：',
        '1. 上传所有 adapter JSON 到 adapter-registry/games/。',
        '2. 更新 adapter-registry/index.json 中对应 games 条目。',
        '3. 确认浏览器能访问 index.json 和每个 games/*.json。',
        '4. 客户端填写 VPS index.json URL 后执行同步前预检。',
        '',
        '批量导出 bundle JSON：',
        bundleJson,
      ].join('\n');
      setSubmitQueueBatchText(report);
      onTriggerToast(`已生成 ${packs.length} 个 adapter 的批量提交说明。`);
    } catch (error) {
      onTriggerToast(`批量生成提交队列失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copySubmitQueueBatch = () => {
    if (!submitQueueBatchText.trim()) {
      onTriggerToast('暂无批量提交说明。');
      return;
    }
    copyText(submitQueueBatchText, '批量提交说明');
  };

  const buildLocalRegistryPublishReport = (result: AdapterRegistryLocalPublishResult) => [
    '[联机助手共享库本地发布结果]',
    `生成时间：${new Date().toLocaleString()}`,
    `本地共享库目录：${result.registry_dir}`,
    `adapter 目录：${result.games_dir}`,
    `index.json：${result.index_path}`,
    `队列数量：${result.total}`,
    `写入：${result.written}，新增：${result.created}，更新：${result.updated}，未变化：${result.unchanged}`,
    `index 条目数：${result.index_game_count}`,
    `校验：${result.verified ? '通过' : '未通过'}`,
    '',
    '写入清单：',
    ...result.entries.map((entry) => `- ${entry.display_name} (${entry.game_id})：${entry.status} -> ${entry.adapter_url} sha256=${entry.sha256}`),
    '',
    '下一步：',
    '1. 检查 adapter-registry/games/*.json 和 adapter-registry/index.json。',
    '2. GitHub Pages：git add adapter-registry && git commit && git push。',
    '3. VPS/静态服务器：上传整个 adapter-registry 目录，确保 index.json 可通过 HTTP/HTTPS 访问。',
    '4. 客户端把共享库地址填为 https://你的域名/adapter-registry/index.json 后点击同步。',
    '',
    '后端校验消息：',
    ...result.messages.map((message) => `- ${message}`),
  ].join('\n');

  const publishSubmitQueueToLocalRegistry = async () => {
    if (submitQueueAdapters.length === 0) {
      onTriggerToast('提交队列为空，请先加入可提交 adapter。');
      return;
    }
    setBusy('写入本地共享库示例');
    try {
      const result = await publishAdaptersToLocalRegistry(submitQueueAdapters.map((adapter) => adapter.game_id));
      setSubmitQueuePublishResult(result);
      const report = buildLocalRegistryPublishReport(result);
      setSubmitQueueBatchText((previous) => previous.trim()
        ? `${previous}\n\n${report}`
        : report);
      onTriggerToast(`已写入本地共享库示例：新增 ${result.created}，更新 ${result.updated}，未变化 ${result.unchanged}。`);
    } catch (error) {
      onTriggerToast(`写入本地共享库示例失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copyLocalRegistryPublishReport = () => {
    if (!submitQueuePublishResult) {
      onTriggerToast('暂无本地发布结果。');
      return;
    }
    copyText(buildLocalRegistryPublishReport(submitQueuePublishResult), '本地共享库发布结果');
  };

  const clearSubmitQueue = () => {
    setSubmitQueueGameIds([]);
    setSubmitQueueBatchText('');
    setSubmitQueuePublishResult(null);
    clearAdapterSubmitQueueSnapshot();
    setSubmitQueueRestoredAt('');
    setSubmitQueueSavedAt('');
    onTriggerToast('已清空提交队列和本地队列记录。');
  };

  const clearSubmitQueueSavedRecord = () => {
    clearAdapterSubmitQueueSnapshot();
    setSubmitQueueRestoredAt('');
    setSubmitQueueSavedAt('');
    onTriggerToast('已清除本地队列记录，当前页面队列仍保留。');
  };

  const copyExportText = () => copyText(exportText, '导出 JSON');

  const makeAdapterDiffField = (
    field: string,
    label: string,
    before: string,
    after: string,
    affectsRecommendation: boolean,
  ): AdapterChangeDiffField => ({
    field,
    label,
    before,
    after,
    changed: before !== after,
    affects_recommendation: affectsRecommendation,
  });

  const formatAdapterPorts = (adapter?: GameAdapter | null) =>
    adapter ? (adapter.default_ports?.join(', ') || '未设置') : '无本地方案';

  const formatAdapterMethods = (adapter?: GameAdapter | null) =>
    adapter ? (adapter.multiplayer_conversion?.methods?.join(', ') || '未标注') : '无本地方案';

  const formatAdapterPlan = (adapter?: GameAdapter | null) =>
    adapter ? (adapter.connection_plan?.summary || '未填写') : '无本地方案';

  const formatAdapterRouteFlags = (adapter?: GameAdapter | null) => {
    if (!adapter) return '无本地方案';
    const plan = adapter.connection_plan;
    if (!plan) return '未设置';
    return [
      `virtual_lan=${plan.requires_virtual_lan}`,
      `tcp_proxy=${plan.requires_tcp_port_proxy}`,
      `udp_bridge=${plan.requires_udp_broadcast_bridge}`,
      `dedicated_server=${plan.requires_dedicated_server}`,
    ].join(', ');
  };

  const buildLocalAdapterDiffFields = (before: GameAdapter | undefined, after: GameAdapter): AdapterChangeDiffField[] => [
    makeAdapterDiffField('network_type', '联机类型', before ? networkTypeLabel(before.network_type) : '无本地方案', networkTypeLabel(after.network_type), true),
    makeAdapterDiffField('default_ports', '默认端口', formatAdapterPorts(before), formatAdapterPorts(after), true),
    makeAdapterDiffField('capabilities', '游戏能力', before ? before.capabilities.join(', ') || '未标注' : '无本地方案', after.capabilities.join(', ') || '未标注', true),
    makeAdapterDiffField('conversion_methods', '转换方式', formatAdapterMethods(before), formatAdapterMethods(after), true),
    makeAdapterDiffField('can_convert_to_lan', '是否可转局域网体验', before ? String(Boolean(before.multiplayer_conversion?.can_convert_to_lan)) : '无本地方案', String(Boolean(after.multiplayer_conversion?.can_convert_to_lan)), true),
    makeAdapterDiffField('connection_summary', '方案摘要', formatAdapterPlan(before), formatAdapterPlan(after), false),
    makeAdapterDiffField('route_flags', '路线开关', formatAdapterRouteFlags(before), formatAdapterRouteFlags(after), true),
    makeAdapterDiffField('applicability', '适用条件', formatAdapterApplicability(before), formatAdapterApplicability(after), true),
    makeAdapterDiffField('evidence', '验证证据', formatAdapterEvidence(before), formatAdapterEvidence(after), true),
  ];

  const showAdapterDiff = (title: string, subtitle: string, fields: AdapterChangeDiffField[]) => {
    setAdapterDiffPanel({ title, subtitle, fields });
  };

  const copyAdapterDiffReport = () => {
    if (!adapterDiffPanel) {
      onTriggerToast('暂无 adapter 变更差异。');
      return;
    }
    const changed = adapterDiffPanel.fields.filter((field) => field.changed);
    const lines = [
      '[联机助手 adapter 变更差异]',
      adapterDiffPanel.title,
      adapterDiffPanel.subtitle,
      '',
      ...(changed.length > 0 ? changed : adapterDiffPanel.fields).map((field) => [
        `- ${field.label}${field.affects_recommendation ? '（影响推荐路线）' : ''}`,
        `  旧：${field.before}`,
        `  新：${field.after}`,
      ].join('\n')),
    ];
    copyText(lines.join('\n'), 'adapter 变更差异');
  };

  const editorPreviewAdapter = buildAdapter(editor);
  const editorPreviewPreviousAdapter = editor.game_id.trim()
    ? adapters.find((item) => item.game_id === editor.game_id.trim())
    : undefined;
  const editorPreviewDiffFields = buildLocalAdapterDiffFields(editorPreviewPreviousAdapter, editorPreviewAdapter);
  const editorPreviewChangedFields = editorPreviewDiffFields.filter((field) => field.changed);
  const editorPreviewPlan = editorPreviewAdapter.connection_plan;
  const editorWillGenerateLanInvite = Boolean(
    editorPreviewAdapter.multiplayer_conversion?.can_convert_to_lan &&
    editorPreviewPlan?.requires_virtual_lan &&
    editorPreviewPlan?.default_join_port,
  );
  const editorRequiredAdvancedTools = [
    editorPreviewPlan?.requires_tcp_port_proxy ? 'TCP/UDP 端口代理' : '',
    editorPreviewPlan?.requires_udp_broadcast_bridge ? 'UDP 广播桥' : '',
    editorPreviewPlan?.requires_dedicated_server ? '游戏服务端/内置开服' : '',
  ].filter((item): item is string => Boolean(item));
  const editorPreviewWarnings = [
    editorPreviewAdapter.network_type === 'unknown_need_review' ? '当前方案仍需确认：请先补充端口、联机方式或实测证据，再用于开房邀请。' : '',
    editorPreviewAdapter.network_type === 'local_coop_remote_play' ? '本地同屏远程不是 LAN：不会生成虚拟 IP 邀请包，应走 Remote Play / Sunshine。' : '',
    editorPreviewAdapter.network_type === 'steam_p2p_only' || editorPreviewAdapter.network_type === 'steam_relay_plugin' || editorPreviewAdapter.network_type === 'steam_lobby_direct_possible'
      ? 'Steam 大厅/P2P 默认保留原生邀请，不要误导用户使用 n2n 连接虚拟 IP。'
      : '',
    editorPreviewAdapter.network_type === 'official_only' || editorPreviewAdapter.network_type === 'not_supported'
      ? '官方服/暂不支持不会转换为 LAN，只能给限制说明。'
      : '',
    editorRequiredAdvancedTools.length > 0 ? `保存后推荐页会提示额外工具：${editorRequiredAdvancedTools.join('、')}。` : '',
  ].filter((item): item is string => Boolean(item));

  const buildConflictReportText = (conflict: AdapterConflictReport) => {
    const lines = [
      `[联机助手 adapter 版本冲突报告]`,
      `游戏：${conflict.display_name} (${conflict.game_id})`,
      `当前生效来源：${sourceLabel(conflict.active_source)}`,
      `当前指纹：${conflict.active_fingerprint}`,
      `结论：${conflict.summary}`,
      `建议：${conflict.recommendation}`,
      '',
      '来源版本：',
      ...conflict.variants.map((variant) => [
        `- ${variant.is_active ? '[生效] ' : ''}${sourceLabel(variant.source)} / ${variant.short_fingerprint}`,
        `  路径：${variant.path}`,
        `  类型：${networkTypeLabel(variant.network_type || undefined)}；端口：${variant.default_ports?.join(', ') || '未设置'}`,
      ].join('\n')),
    ];
    return lines.join('\n');
  };

  const copyConflictReport = (conflict: AdapterConflictReport) => copyText(buildConflictReportText(conflict), '版本冲突报告');

  const pinCurrentAdapter = async (adapter: GameAdapter) => {
    setBusy(`保留 ${adapter.display_name} 当前方案`);
    try {
      const saved = await pinActiveAdapterAsCustom(adapter.game_id);
      await loadAdapters('刷新保留结果');
      onTriggerToast(`已把 ${saved.display_name} 当前生效版本固定为自建方案。`);
    } catch (error) {
      onTriggerToast(`保留当前方案失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const useRegistryVersion = async (adapter: GameAdapter) => {
    setBusy(`用共享库覆盖 ${adapter.display_name}`);
    try {
      const saved = await promoteRegistryAdapterToCustom(adapter.game_id);
      await loadAdapters('刷新覆盖结果');
      onTriggerToast(`已用共享库版本覆盖 ${saved.display_name} 的自建方案。`);
    } catch (error) {
      onTriggerToast(`共享库覆盖失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const backupReasonLabel = (reason: string) => {
    const map: Record<string, string> = {
      save_custom_adapter: '保存/导入自建方案前',
      sync_remote_registry: '远程共享库同步前',
      sync_local_registry: '本地示例同步前',
      restore_before_overwrite: '恢复备份覆盖前',
    };
    return map[reason] ?? reason;
  };

  const formatBackupTime = (createdAt: string) => {
    const seconds = Number(createdAt);
    if (!Number.isFinite(seconds) || seconds <= 0) return createdAt;
    return new Date(seconds * 1000).toLocaleString();
  };

  const buildBackupReportText = (backup: AdapterBackupEntry) => [
    '[联机助手 adapter 备份记录]',
    `游戏：${backup.display_name} (${backup.game_id})`,
    `来源：${sourceLabel(backup.source)}`,
    `原因：${backupReasonLabel(backup.reason)}`,
    `时间：${formatBackupTime(backup.created_at)}`,
    `指纹：${backup.fingerprint}`,
    `原路径：${backup.original_path}`,
    `备份路径：${backup.backup_path}`,
  ].join('\n');

  const copyBackupReport = (backup: AdapterBackupEntry) => copyText(buildBackupReportText(backup), '备份记录');

  const restoreBackup = async (backup: AdapterBackupEntry) => {
    setBusy(`恢复 ${backup.display_name} 备份`);
    try {
      const restored = await restoreAdapterBackup(backup.id);
      await loadAdapters('刷新恢复结果');
      onTriggerToast(`已恢复 ${restored.display_name} 的 adapter 备份。`);
    } catch (error) {
      onTriggerToast(`恢复备份失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const generateSubmitPackageFromExport = async () => {
    if (!exportText.trim()) {
      onTriggerToast('请先导出 adapter JSON。');
      return;
    }
    setBusy('生成共享库提交包');
    try {
      const pack = await buildAdapterRegistrySubmitPackage(exportText, solutionsUrl.trim() || DEFAULT_REGISTRY_URL);
      setExportText(pack.normalizedJson);
      setSubmitPackage(pack);
      onTriggerToast(`已生成 ${pack.adapter.display_name} 的共享库提交包。`);
    } catch (error) {
      onTriggerToast(`生成提交包失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const buildSavedAdapterReviewReport = () => {
    if (!savedAdapterReview || !savedAdapterReviewQuality || !savedAdapterReviewAudit) return '';
    const changed = savedAdapterReview.diffFields.filter((field) => field.changed);
    return [
      '[联机助手 adapter 保存后复核]',
      `时间：${savedAdapterReview.savedAt}`,
      `游戏：${savedAdapterReview.adapter.display_name} (${savedAdapterReview.adapter.game_id})`,
      ...(savedAdapterReview.sourceContributionId ? [
        `来源：用户贡献包 ${savedAdapterReview.sourceContributionId}`,
        `贡献队列状态：${contributionReviewQueueStatusLabel(savedAdapterReview.sourceContributionStatus || 'drafted')}`,
      ] : []),
      `联机类型：${networkTypeLabel(savedAdapterReview.adapter.network_type)}`,
      `质量评分：${savedAdapterReviewQuality.label} ${savedAdapterReviewQuality.score} 分`,
      `质量摘要：${savedAdapterReviewQuality.summary}`,
      `发布审核：${savedAdapterReviewAudit.label}`,
      `发布建议：${savedAdapterReviewAudit.summary}`,
      `是否建议生成提交包：${savedAdapterReviewAudit.canSubmit ? '是' : '否'}`,
      `同步状态：${savedAdapterReviewAudit.syncStatus}`,
      `适用条件：${formatAdapterApplicability(savedAdapterReview.adapter)}`,
      `验证证据：${formatAdapterEvidence(savedAdapterReview.adapter)}`,
      '',
      '关键差异：',
      ...((changed.length > 0 ? changed : savedAdapterReview.diffFields.slice(0, 3)).map((field) => (
        `- ${field.label}${field.affects_recommendation ? '（影响推荐）' : ''}：${field.changed ? `${field.before} -> ${field.after}` : '无变化'}`
      ))),
      '',
      '风险/缺失：',
      ...[
        ...savedAdapterReviewQuality.risks,
        ...savedAdapterReviewQuality.missing.map((item) => `缺少：${item}`),
        ...savedAdapterReviewAudit.review,
        ...savedAdapterReviewAudit.warnings,
      ].slice(0, 10).map((item) => `- ${item}`),
    ].join('\n');
  };

  const copySavedAdapterReviewReport = () => {
    const text = buildSavedAdapterReviewReport();
    if (!text) {
      onTriggerToast('暂无保存后复核报告。');
      return;
    }
    copyText(text, '保存后复核报告');
  };

  const addSavedAdapterReviewToSubmitQueue = () => {
    if (!savedAdapterReview || !savedAdapterReviewAudit) {
      onTriggerToast('暂无刚保存的 adapter 复核结果。');
      return;
    }
    if (!savedAdapterReviewAudit.canSubmit) {
      onTriggerToast('当前 adapter 暂不建议加入共享库提交队列，请先补齐证据或处理复核项。');
      return;
    }
    addAdapterToSubmitQueue(savedAdapterReview.adapter);
  };

  const exportSavedAdapterSubmitPackage = async () => {
    if (!savedAdapterReview) {
      onTriggerToast('暂无刚保存的 adapter。');
      return;
    }
    await exportAdapter(savedAdapterReview.adapter);
  };

  const saveEditor = async () => {
    if (!editor.game_id.trim() || !editor.display_name.trim()) {
      onTriggerToast('请填写 game_id 和游戏名称。');
      return;
    }
    if (!editorPreviewConfirmed) {
      onTriggerToast('请先查看保存前真实预览，并勾选确认后再保存。');
      return;
    }
    const previewForSave = editorPreviewAdapter;
    const previousForSave = editorPreviewPreviousAdapter;
    const diffForSave = editorPreviewDiffFields;
    const sourceContributionId = pendingContributionDraftId || undefined;
    const sourceContributionStatus = sourceContributionId
      ? contributionReviewQueue.find((item) => item.id === sourceContributionId)?.status || 'drafted'
      : undefined;
    setBusy('保存自建适配器');
    try {
      const adapter = await saveGameAdapter(previewForSave);
      setEditor(emptyEditor);
      setEditorPreviewConfirmed(false);
      setEditorOpen(false);
      if (adapterIntent && (!adapterIntent.game_id || adapterIntent.game_id === adapter.game_id)) {
        clearAdapterCreationIntent();
        setAdapterIntent(null);
      }
      const nextAdapters = await loadAdapters('刷新自建方案');
      const latestAdapter = nextAdapters?.find((item) => item.game_id === adapter.game_id) ?? adapter;
      setSavedAdapterReview({
        adapter: latestAdapter,
        diffFields: diffForSave.length > 0 ? diffForSave : buildLocalAdapterDiffFields(previousForSave, latestAdapter),
        savedAt: new Date().toLocaleString(),
        sourceContributionId,
        sourceContributionStatus,
      });
      setPendingContributionDraftId(null);
      onTriggerToast(`已保存真实自建适配器：${adapter.display_name}，请查看保存后复核。`);
    } catch (error) {
      onTriggerToast(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const dismissAdapterIntent = () => {
    clearAdapterCreationIntent();
    setAdapterIntent(null);
    setAdapterIntentApplied(false);
    onTriggerToast('已关闭诊断创建适配器引导。');
  };

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="solutions">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在同步共享库、导入导出 adapter、保存方案或生成提交包；请等待操作完成。" />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">方案库</h2>
          <p className="mt-1 text-sm text-slate-500">优先同步 adapter-registry 共享库，再保存你确认过的自建方案。</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">当前真实适配器：{adapters.length} 个 ｜ {busy || '空闲'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => loadAdapters('手动刷新方案库')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            刷新本地方案
          </button>
          <button onClick={() => syncRemote()} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">
            <CloudDownload className="h-4 w-4" />
            同步共享库
          </button>
        </div>
      </header>

      <section
        className="rounded-2xl border border-sky-100 bg-sky-50/80 p-5 shadow-sm"
        data-adapter-registry-closure-audit="checklist"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-sky-700">Adapter registry audit</span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">共享方案库闭环</span>
              <span className="rounded-full bg-white/75 px-3 py-1 font-mono text-[11px] font-bold text-slate-500">
                {activeRegistryKind}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">游戏适配器与共享库最终审计</h3>
            <p className="mt-2 max-w-4xl text-xs leading-relaxed text-slate-600">
              {adapterRegistryClosureAudit.summary} 这张卡把扫描游戏、匹配 adapter、推荐路线、用户贡献、管理员审核、本地/远程共享库、版本冲突、备份恢复、提交包串成一条可验收路径。
            </p>
          </div>
          <button
            onClick={copyAdapterRegistryClosureAudit}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            <ClipboardCopy className="h-4 w-4" />
            复制共享库自检
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600">
            固化能力<br />
            <span className="text-lg font-black text-slate-900">{adapterRegistryClosureAudit.wiredCount}</span>
            <span className="ml-1 text-[11px]">项</span>
          </div>
          <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600">
            当前已观察<br />
            <span className="text-lg font-black text-emerald-700">{adapterRegistryClosureAudit.observedCount}</span>
            <span className="ml-1 text-[11px]">项</span>
          </div>
          <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600">
            同步状态<br />
            <span className="font-bold text-slate-900">{adapterRegistryClosureAudit.registryStatus}</span>
          </div>
          <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600">
            下一风险<br />
            <span className="font-bold text-slate-900">{adapterRegistryClosureAudit.nextRisk}</span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-white/80 bg-white/70 p-3 text-xs text-slate-600">
            本地 adapter<br /><b className="text-slate-900">{adapters.length}</b>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 p-3 text-xs text-slate-600">
            需复核<br /><b className="text-amber-700">{reviewWorkbenchStats.needsReview}</b>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 p-3 text-xs text-slate-600">
            可提交<br /><b className="text-emerald-700">{reviewWorkbenchStats.submitReady}</b>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 p-3 text-xs text-slate-600">
            贡献队列<br /><b className="text-sky-700">{contributionReviewQueue.length}</b>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 p-3 text-xs text-slate-600">
            提交队列<br /><b className="text-sky-700">{submitQueueGameIds.length}</b>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {adapterRegistryClosureAudit.items.slice(0, 8).map((item) => (
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

      {adapterIntent ? (
        <section className={`rounded-2xl border p-5 shadow-sm ${
          adapterIntentMatch ? 'border-emerald-100 bg-emerald-50/80' : 'border-amber-100 bg-amber-50/80'
        }`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  adapterIntentMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  {adapterIntentIsConversionAssessment ? '转换评估已带入方案库' : '诊断建议创建适配器'}
                </span>
                {adapterIntentIsConversionAssessment ? (
                  <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-slate-600">
                    {adapterIntent.game_type || adapterIntent.route_kind || '待复核路线'}
                  </span>
                ) : null}
                {adapterIntent.issue_ids?.length ? (
                  <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-[11px] font-bold text-slate-500">
                    {adapterIntent.issue_ids.join(', ')}
                  </span>
                ) : null}
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {adapterIntent.display_name || adapterIntent.game_id || '未知游戏'}
                {adapterIntentIsConversionAssessment ? ' 的转换评估需要沉淀为方案' : ' 缺少可复用联机方案'}
              </h3>
              <p className="mt-2 max-w-4xl text-xs leading-relaxed text-slate-600">
                {adapterIntentIsConversionAssessment
                  ? '这是从推荐页非 LAN 转换评估带来的创建意图。正确路径是：先同步共享库查找同款游戏；如果仍缺失，再把评估结论、缺失证据和边界说明转成用户贡献包或管理员 custom adapter。'
                  : '这是从诊断页带来的创建意图。正确路径是：先同步共享库查找同款游戏；如果仍然缺失，再由管理员确认游戏类型、端口和适用条件，保存为本地 custom adapter，后续同一游戏会自动套用方案。'}
              </p>
              {adapterIntentIsConversionAssessment ? (
                <div className="mt-3 grid gap-2 text-[11px] text-slate-600 md:grid-cols-3" data-conversion-assessment-handoff="solutions-intent">
                  <div className="rounded-xl bg-white/70 p-3">
                    <b className="text-slate-800">评估结论</b>
                    <p className="mt-1">{adapterIntent.note || '需要确认是否可转换。'}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-3">
                    <b className="text-slate-800">推荐方案</b>
                    <p className="mt-1">{adapterIntent.recommended_plan || '待管理员确认。'}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 p-3">
                    <b className="text-slate-800">需补证据</b>
                    <p className="mt-1">{adapterIntent.admin_evidence?.slice(0, 2).join('、') || '暂无。'}</p>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 grid gap-2 text-[11px] text-slate-600 md:grid-cols-3">
                <div className="rounded-xl bg-white/70 p-3">
                  <b className="text-slate-800">1. 先同步</b>
                  <p className="mt-1">避免重复创建已有共享方案。</p>
                </div>
                <div className="rounded-xl bg-white/70 p-3">
                  <b className="text-slate-800">2. 判定类型</b>
                  <p className="mt-1">LAN、广播发现、专用服务端、同屏远程或 Steam P2P。</p>
                </div>
                <div className="rounded-xl bg-white/70 p-3">
                  <b className="text-slate-800">3. 保存复用</b>
                  <p className="mt-1">保存后推荐页和诊断页会按 adapter 给出方案。</p>
                </div>
              </div>
              {adapterIntentMatch ? (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-white/80 p-3 text-xs text-emerald-700">
                  <b>已找到本地方案：</b>{adapterIntentMatch.display_name} ｜ {networkTypeLabel(adapterIntentMatch.network_type)}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <button onClick={() => syncRemote()} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                <CloudDownload className="h-4 w-4" />
                同步共享库查找
              </button>
              <button onClick={() => applyAdapterIntent(adapterIntent)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                <FileJson className="h-4 w-4" />
                {adapterIntentIsConversionAssessment ? '用评估预填编辑器' : '打开预填编辑器'}
              </button>
              <button onClick={() => prefillContributionFromIntent(adapterIntent)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50">
                <Upload className="h-4 w-4" />
                {adapterIntentIsConversionAssessment ? '用评估生成贡献包' : '生成用户贡献包'}
              </button>
              <button onClick={dismissAdapterIntent} className="inline-flex items-center justify-center rounded-xl border border-transparent px-4 py-2 text-xs font-bold text-slate-500 hover:bg-white/60">
                关闭引导
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/70 p-5 shadow-sm"
        data-conversion-engine-closure-audit="checklist"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-fuchsia-700">非局域网转换引擎最终审计</span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                {conversionEngineClosureAudit.observedCount}/{conversionEngineClosureAudit.wiredCount} 已观察
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">
                样本 {conversionEngineClosureAudit.passedSamples}/{conversionEngineClosureAudit.sampleTotal} 通过
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">把“能不能转 LAN”作为产品边界，而不是把所有游戏都硬塞进 n2n。</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
              {conversionEngineClosureAudit.summary}
              下一风险：{conversionEngineClosureAudit.nextRisk}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">生成 LAN 邀请</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{conversionEngineClosureAudit.lanInviteSamples} 类</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">非 LAN / 不生成</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{conversionEngineClosureAudit.nonLanSamples} 类</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">当前编辑器类型</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{networkTypeLabel(editor.network_type)}</p>
              </div>
              <div className="rounded-xl bg-white/75 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">缺失样本</p>
                <p className="mt-1 text-xs font-bold text-slate-700">{conversionEngineClosureAudit.missingSamples.join('、') || '无'}</p>
              </div>
            </div>
          </div>
          <button
            onClick={copyConversionEngineClosureAudit}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
          >
            <ClipboardCopy className="h-4 w-4" />
            复制转换引擎自检
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {conversionEngineClosureAudit.items.slice(0, 10).map((item) => (
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
        className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5 shadow-sm"
        data-conversion-assessment-sample-validation="checklist"
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-violet-700">转换评估小样本验证</span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                {conversionAssessmentValidationSummary.passed}/{conversionAssessmentValidationSummary.total} 通过
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">
                LAN {conversionAssessmentValidationSummary.lanInvite} / 非 LAN {conversionAssessmentValidationSummary.nonLan}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">八类样例守住“能不能转 LAN”的产品边界</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
              这里用真实转换评估引擎跑 LAN/IP 直连、专用服务端、UDP 广播发现、端口代理、Cuphead 本地同屏、Steam P2P、官方服限定、未知待复核八类样例。
              目的不是模拟用户游戏库，而是防止后续重构把本地同屏、Steam 或官方服错误生成 n2n 邀请包。
            </p>
          </div>
          <button
            onClick={copyConversionAssessmentValidationReport}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-800 ring-1 ring-black/5 hover:bg-slate-50"
          >
            <ClipboardCopy className="h-4 w-4" />
            复制验证清单
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {conversionAssessmentValidationResults.map((result) => (
            <article key={result.sample.id} className="rounded-2xl border border-white/80 bg-white/80 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">{result.sample.title}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">{result.sample.id}</p>
                </div>
                {result.passed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
              </div>
              <p className="min-h-16 text-[11px] leading-relaxed text-slate-500">{result.sample.purpose}</p>
              <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-slate-600">
                <p><b>路线：</b>{result.routeKind}</p>
                <p><b>LAN 邀请：</b>{result.canCreateLanInvite ? '生成' : '不生成'}</p>
                <p><b>结论：</b>{result.assessment.userConclusion}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-8">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">共享方案库优先</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  先从共享库拉取经过校验的 adapter，再扫描本机游戏；自建方案仅用于补充或覆盖确认过的游戏。
                </p>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[11px] text-slate-500">
              {registryVersionLabel(syncResult)}
            </span>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              value={solutionsUrl}
              onChange={(event) => onUpdateSolutionsUrl(event.target.value)}
              placeholder={DEFAULT_REGISTRY_URL}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-amber-400"
            />
            <button onClick={() => onUpdateSolutionsUrl(DEFAULT_REGISTRY_URL)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              恢复默认地址
            </button>
            <button onClick={syncLocalExample} disabled={Boolean(busy)} className="rounded-xl border border-amber-200 px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-60">
              同步本地示例
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <Link2 className="h-3.5 w-3.5" />
            <span className="truncate">当前地址：{activeRegistryUrl} ｜ 当前入口：{activeRegistryKind}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3" data-adapter-sync-source-guide="cards">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <CloudDownload className="h-4 w-4 text-emerald-600" />
                <b className="text-xs text-emerald-800">GitHub Pages 默认库</b>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-700">
                普通用户优先选择。地址固定为项目公开共享库，适合直接拉取社区已经整理好的 adapter。
              </p>
              <button
                onClick={syncDefaultGithubRegistry}
                disabled={Boolean(busy)}
                className="mt-3 w-full rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                使用默认库并预检
              </button>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Server className="h-4 w-4 text-sky-600" />
                <b className="text-xs text-sky-800">VPS / 自建静态库</b>
              </div>
              <p className="text-[11px] leading-relaxed text-sky-700">
                管理员把 adapter-registry 上传到 VPS 或静态站点后，在上方填入 index.json URL，再先预检差异。
              </p>
              <button
                onClick={syncCurrentRemoteRegistry}
                disabled={Boolean(busy)}
                className="mt-3 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-[11px] font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
              >
                预检当前远程地址
              </button>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Database className="h-4 w-4 text-amber-600" />
                <b className="text-xs text-amber-800">本地示例库</b>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-700">
                开发/管理员测试用。读取项目内 adapter-registry/index.json，不需要联网，用于验证刚写入的本地共享库。
              </p>
              <button
                onClick={syncLocalExample}
                disabled={Boolean(busy)}
                className="mt-3 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
              >
                同步本地示例库
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800">自建方案</h3>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">管理员确认某游戏类型后，可把转换方案保存为 adapter，后续用户遇到同一游戏时直接复用。</p>
          <button onClick={() => setEditorOpen((value) => !value)} className="w-full rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 shadow-sm hover:bg-amber-400">
            {editorOpen ? '关闭编辑器' : '打开自建适配器编辑器'}
          </button>
          <button onClick={() => setContributionOpen((value) => !value)} className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50">
            {contributionOpen ? '关闭用户贡献入口' : '打开用户贡献入口'}
          </button>
        </div>
      </section>

      {contributionOpen ? (
        <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm" data-adapter-user-contribution="wizard">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-amber-700">用户贡献入口</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">贡献包 v1</span>
              </div>
              <h3 className="text-sm font-bold text-slate-800">不懂 adapter JSON 也可以提交游戏线索</h3>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
                普通用户只需要描述游戏联机现象、端口、测试步骤和证据。系统会生成可复制的贡献包，管理员再据此复核并转成正式 adapter。
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button onClick={generateContributionPackage} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                生成贡献包
              </button>
              <button onClick={copyContributionPackage} className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50">
                复制贡献包
              </button>
              <button onClick={applyContributionToEditor} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                转入管理员编辑器
              </button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <label className="text-[11px] font-bold text-slate-600">
              游戏名称 *
              <input value={contributionForm.display_name} onChange={(event) => updateContributionField('display_name', event.target.value)} className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-400" placeholder="例如 Cuphead" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              game_id / 识别名
              <input value={contributionForm.game_id} onChange={(event) => updateContributionField('game_id', event.target.value)} className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="不填会按游戏名生成" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              Steam AppID
              <input value={contributionForm.steam_appid} onChange={(event) => updateContributionField('steam_appid', event.target.value)} className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="可选" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              游戏版本
              <input value={contributionForm.game_version} onChange={(event) => updateContributionField('game_version', event.target.value)} className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="例如 v1.4.4 / Build ID" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              平台
              <input value={contributionForm.platform} onChange={(event) => updateContributionField('platform', event.target.value)} className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="Steam / Epic / GOG" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              系统
              <input value={contributionForm.os} onChange={(event) => updateContributionField('os', event.target.value)} className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="Windows / Linux" />
            </label>
            <label className="text-[11px] font-bold text-slate-600 lg:col-span-2">
              联机类型 *
              <select value={contributionForm.network_type} onChange={(event) => updateContributionField('network_type', event.target.value)} className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400">
                {contributionNetworkTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label} - {option.help}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              端口
              <input value={contributionForm.default_ports} onChange={(event) => updateContributionField('default_ports', event.target.value)} className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="例如 7777, 27015" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              端口协议
              <textarea value={contributionForm.port_protocols} onChange={(event) => updateContributionField('port_protocols', event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="例如 TCP 7777；UDP 27015" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              网络条件
              <textarea value={contributionForm.network_conditions} onChange={(event) => updateContributionField('network_conditions', event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="例如 双方同一 n2n 房间；防火墙已放行" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              可执行文件特征
              <textarea value={contributionForm.executable_hint} onChange={(event) => updateContributionField('executable_hint', event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="例如 game.exe / server.exe" />
            </label>
            <label className="text-[11px] font-bold text-slate-600 lg:col-span-3">
              观察到的联机现象 *
              <textarea value={contributionForm.observed_flow} onChange={(event) => updateContributionField('observed_flow', event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="例如 游戏内可以输入 IP；只能 Steam 邀请；只能本地双人同屏；局域网大厅看不到房间等" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              测试步骤 *
              <textarea value={contributionForm.test_steps} onChange={(event) => updateContributionField('test_steps', event.target.value)} className="mt-1 min-h-28 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="每行一步：房主怎么开，好友怎么加，是否成功" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              截图 / 日志 / 证据
              <textarea value={contributionForm.proof_items} onChange={(event) => updateContributionField('proof_items', event.target.value)} className="mt-1 min-h-28 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="例如 截图名称、日志片段、端口检测结果" />
            </label>
            <label className="text-[11px] font-bold text-slate-600">
              已知限制 / 备注
              <textarea value={`${contributionForm.known_limitations}${contributionForm.extra_notes ? `\n${contributionForm.extra_notes}` : ''}`} onChange={(event) => {
                const [first, ...rest] = event.target.value.split(/\r?\n/);
                updateContributionField('known_limitations', first || '');
                setContributionForm((previous) => ({ ...previous, extra_notes: rest.join('\n') }));
              }} className="mt-1 min-h-28 w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400" placeholder="例如 只测过 Steam 版；需要关闭防火墙；无法和非同版本联机" />
            </label>
          </div>
          {contributionResult ? (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-white/90 p-4" data-adapter-user-contribution="package">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${contributionResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {contributionResult.ok ? '关键字段已完整' : `缺少 ${contributionResult.missing.length} 项`}
                </span>
                {contributionResult.warnings.slice(0, 3).map((warning) => (
                  <span key={warning} className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{warning}</span>
                ))}
              </div>
              <textarea readOnly value={contributionResult.text} className="min-h-48 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-600" />
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl border border-slate-100 bg-white/90 p-4" data-adapter-user-contribution="import-review">
            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">管理员导入 / 审核用户贡献包</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  管理员可以粘贴用户发来的完整贡献包文本或 JSON。解析后先显示缺失项、风险和复核清单，再决定转为 adapter 草稿或要求用户补充证据。
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button onClick={parseContributionImport} className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-800">
                  解析贡献包
                </button>
                <button onClick={copyContributionReview} disabled={!contributionReview} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  复制审核意见给用户
                </button>
                <button onClick={requestContributionEvidence} disabled={!contributionReview} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                  要求补充证据
                </button>
              </div>
            </div>
            <textarea
              value={contributionImportText}
              onChange={(event) => setContributionImportText(event.target.value)}
              className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-600 outline-none focus:border-amber-400"
              placeholder="粘贴用户贡献包完整文本，或只粘贴 JSON 部分"
            />
            {contributionReview ? (
              <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-4" data-adapter-user-contribution="review">
                <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${contributionReview.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {contributionReview.ok ? '可转草稿' : '需补充证据'}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 font-mono text-[10px] font-bold text-slate-500">
                        {contributionReview.package.contribution_id}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {contributionReview.package.game.display_name} ｜ {contributionReview.package.observed_multiplayer.network_type_label}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{contributionReview.summary}</p>
                  </div>
                  <button onClick={applyContributionReviewToEditor} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                    转为 adapter 草稿
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">缺失项</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-rose-700">
                      {contributionReview.missing.join('、') || '暂无关键缺失'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">风险提示</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                      {contributionReview.warnings.slice(0, 4).join('；') || '暂无明显风险'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">建议路线</p>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                      {contributionReview.package.admin_review.suggested_route}
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-white p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">管理员复核清单</p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-slate-600">
                    {contributionReview.package.admin_review.required_checks.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <textarea readOnly value={contributionReview.reviewText} className="mt-3 min-h-32 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-600" />
              </div>
            ) : null}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-white/90 p-4" data-adapter-user-contribution="review-queue">
            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">贡献包审核历史 / 本地待处理队列</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  已解析的贡献包会保存到本地队列，方便管理员连续处理多个用户提交。队列仅保存在当前客户端，不会自动上传。
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button onClick={copyContributionQueueReport} disabled={contributionReviewQueue.length === 0} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  复制队列摘要
                </button>
                <button onClick={clearContributionReviewQueue} disabled={contributionReviewQueue.length === 0} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                  清空队列
                </button>
              </div>
            </div>
            {contributionReviewQueue.length > 0 ? (
              <div className="max-h-80 overflow-auto rounded-xl border border-slate-100 bg-slate-50/70">
                {contributionReviewQueue.map((item) => (
                  <article key={item.id} className="grid gap-3 border-b border-slate-100 bg-white/80 p-3 last:border-b-0 lg:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <b className="text-sm text-slate-800">{item.review.package.game.display_name}</b>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">{item.review.package.game.game_id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.status === 'drafted'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.status === 'needs_more_evidence'
                              ? 'bg-amber-50 text-amber-700'
                              : item.status === 'rejected'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-sky-50 text-sky-700'
                        }`}>
                          {contributionReviewQueueStatusLabel(item.status)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {item.review.package.observed_multiplayer.network_type_label}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600">{item.review.summary}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        加入：{formatSubmitQueueSnapshotTime(item.addedAt)} ｜ 更新：{formatSubmitQueueSnapshotTime(item.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <button onClick={() => openContributionQueueItem(item)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800">
                        打开审核
                      </button>
                      <button onClick={() => updateContributionQueueStatus(item.id, 'needs_more_evidence')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100">
                        标记补证
                      </button>
                      <button onClick={() => updateContributionQueueStatus(item.id, 'rejected')} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100">
                        驳回
                      </button>
                      <button onClick={() => removeContributionQueueItem(item.id)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50">
                        移除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-[11px] text-slate-500">
                队列为空。解析用户贡献包后会自动加入这里。
              </p>
            )}
          </div>
        </section>
      ) : null}

      {syncPreview ? (
        <section className={`rounded-2xl border p-5 shadow-sm ${
          syncPreviewRequiresConfirm ? 'border-amber-100 bg-amber-50/80' : 'border-emerald-100 bg-emerald-50/70'
        }`} data-adapter-sync-preflight="preview">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  syncPreviewRequiresConfirm ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  共享库同步前预检
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 font-mono text-[10px] font-bold text-slate-500">
                  {syncPreview.total} 个条目
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {syncPreviewRequiresConfirm ? '发现需要确认的同步影响' : '预检通过，可以安全同步'}
              </h3>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
                同步预检只读取远程 index 和 adapter 内容，不写入本地文件。真正同步前会先告诉你将新增、将更新、可能冲突、是否影响当前生效方案；自建 custom 仍然保持最高优先级。
              </p>
              <div className="mt-3 grid gap-2 text-xs md:grid-cols-6">
                <div className="rounded-xl bg-white/80 p-3 text-sky-700">将新增 <b>{syncPreview.will_create}</b></div>
                <div className="rounded-xl bg-white/80 p-3 text-indigo-700">将更新 <b>{syncPreview.will_update}</b></div>
                <div className="rounded-xl bg-white/80 p-3 text-emerald-700">不变 <b>{syncPreview.unchanged}</b></div>
                <div className="rounded-xl bg-white/80 p-3 text-amber-700">自建保护 <b>{syncPreview.custom_protected}</b></div>
                <div className="rounded-xl bg-white/80 p-3 text-rose-700">潜在冲突 <b>{syncPreview.possible_conflicts}</b></div>
                <div className="rounded-xl bg-white/80 p-3 text-slate-700">跳过 <b>{syncPreview.skipped}</b></div>
              </div>
              <div className="mt-3 rounded-xl border border-white/80 bg-white/80 p-3" data-adapter-sync-diff-summary="preflight">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">同步前后差异摘要</span>
                  <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">有字段变化 {syncPreviewDiffSummary.changedItems} 个</span>
                  <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">影响推荐 {syncPreviewDiffSummary.recommendationImpact} 个</span>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">自建保护 {syncPreviewDiffSummary.protectedItems} 个</span>
                  <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600">异常跳过 {syncPreviewDiffSummary.failedItems} 个</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  变更字段：{syncPreviewDiffSummary.changedLabels.length ? syncPreviewDiffSummary.changedLabels.join('、') : '暂无字段差异'}。
                  {syncPreviewDiffSummary.recommendationImpact > 0
                    ? '存在会影响推荐路线的 adapter 变更，建议点单条“查看差异”后再确认同步。'
                    : '没有发现影响推荐路线的字段变化。'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              {syncPreviewRequiresConfirm ? (
                <button onClick={() => syncRemote(true, syncPreview.registry_url)} disabled={Boolean(busy)} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  确认同步共享库
                </button>
              ) : null}
              <button onClick={copySyncPreviewReport} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                复制预检报告
              </button>
              <button onClick={() => { setSyncPreview(null); setSyncPreviewRequiresConfirm(false); }} className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold text-slate-500 hover:bg-white/60">
                清除预检
              </button>
            </div>
          </div>
          <div className="mt-4 max-h-56 overflow-auto rounded-xl border border-white/70 bg-white/70 text-[11px]">
            {syncPreview.items.slice(0, 16).map((item, index) => (
              <div key={`${item.game_id}-${index}`} className="grid gap-2 border-b border-slate-100 p-3 last:border-b-0 md:grid-cols-[120px_1fr]">
                <div>
                  <span className={`rounded-full px-2 py-1 font-bold ${
                    item.conflict_with_custom || item.status.startsWith('skipped_')
                      ? 'bg-rose-50 text-rose-700'
                      : item.would_affect_active
                        ? 'bg-amber-50 text-amber-700'
                        : item.would_write_registry
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {previewStatusLabel(item.status)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{item.display_name || item.game_id}</p>
                  <p className="mt-1 leading-relaxed text-slate-600">{item.reason}</p>
                  {item.diff_fields?.some((field) => field.changed) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-700">
                        {item.diff_fields.filter((field) => field.changed).length} 项变更
                      </span>
                      {item.diff_fields.some((field) => field.changed && field.affects_recommendation) ? (
                        <span className="rounded-full bg-rose-50 px-2 py-1 font-bold text-rose-700">
                          影响推荐路线
                        </span>
                      ) : null}
                      <button
                        onClick={() => showAdapterDiff(
                          `${item.display_name || item.game_id} 同步差异`,
                          `来源：${previewStatusLabel(item.status)}；${item.reason}`,
                          item.diff_fields,
                        )}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-slate-600 hover:bg-slate-50"
                      >
                        查看差异
                      </button>
                    </div>
                  ) : null}
                  <p className="mt-1 break-all font-mono text-slate-400">
                    本地来源：{item.local_sources.join(', ') || '无'} ｜ 当前生效：{sourceLabel(item.active_source)} ｜ 写入：{item.saved_path || '-'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {adapterDiffPanel ? (
        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-sm" data-adapter-change-diff="panel">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-indigo-700">adapter 变更差异查看</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold text-white">
                  {adapterDiffPanel.fields.filter((field) => field.changed).length} 项变更
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-800">{adapterDiffPanel.title}</h3>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">{adapterDiffPanel.subtitle}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button onClick={copyAdapterDiffReport} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                复制差异报告
              </button>
              <button onClick={() => setAdapterDiffPanel(null)} className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold text-slate-500 hover:bg-white/60">
                关闭差异
              </button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {adapterDiffPanel.fields.filter((field) => field.changed).map((field) => (
              <div key={field.field} className="rounded-xl border border-white/80 bg-white/80 p-3 text-xs">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <b className="text-slate-800">{field.label}</b>
                  {field.affects_recommendation ? (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">影响推荐路线</span>
                  ) : null}
                </div>
                <p className="break-all text-[11px] text-slate-500"><b>旧：</b>{field.before}</p>
                <p className="mt-1 break-all text-[11px] text-slate-700"><b>新：</b>{field.after}</p>
              </div>
            ))}
            {adapterDiffPanel.fields.every((field) => !field.changed) ? (
              <div className="rounded-xl border border-white/80 bg-white/80 p-4 text-xs text-slate-500">
                未发现 network_type、default_ports、connection_plan 或 conversion methods 等关键字段变化。
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {editorOpen && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-xs text-slate-200 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileJson className="h-4 w-4 text-amber-400" />
            <h3 className="font-bold text-amber-400">真实 Adapter Schema Builder</h3>
          </div>
          <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4" data-adapter-editor-decision-matrix="preset">
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <label className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-300">按游戏类型套用决策表</span>
                <select
                  value={activeCapabilityDecision?.id ?? ''}
                  onChange={(event) => applyCapabilityDecisionToEditor(event.target.value)}
                  className="w-full rounded-xl border border-amber-400/30 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-300"
                >
                  <option value="">选择游戏类型并自动填入 adapter 字段</option>
                  {connectionCapabilityMatrix.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.gameType} ｜ {row.verdictLabel}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  选择后会真实写入 network_type、是否可转 LAN 和说明文案；game_id、名称、端口不会被覆盖。
                </p>
              </label>
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3">
                {activeCapabilityDecision ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">推荐结果</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{activeCapabilityDecision.userFacingResult}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">需要证据</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{activeCapabilityDecision.evidenceToCollect.join('；')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">风险边界</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{activeCapabilityDecision.riskNote}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    如果扫描到新游戏，先判断它属于哪类多人能力，再套用决策表。这样后续保存的 adapter 会同时驱动推荐页、邀请包、诊断页和高级工具入口。
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={editor.game_id} onChange={(e) => setEditor({ ...editor, game_id: e.target.value })} placeholder="game_id，例如 terraria" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <input value={editor.display_name} onChange={(e) => setEditor({ ...editor, display_name: e.target.value })} placeholder="游戏名称" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <input value={editor.steam_appid} onChange={(e) => setEditor({ ...editor, steam_appid: e.target.value })} placeholder="Steam AppID，可空" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <input value={editor.executables} onChange={(e) => setEditor({ ...editor, executables: e.target.value })} placeholder="exe 特征，逗号分隔" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <input value={editor.default_ports} onChange={(e) => setEditor({ ...editor, default_ports: e.target.value })} placeholder="默认端口，逗号分隔" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <select value={editor.network_type} onChange={(e) => setEditor({ ...editor, network_type: e.target.value as GameNetworkType })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400">
              <option value="lan_ip_direct">局域网/IP 直连</option>
              <option value="dedicated_server">专用服务端</option>
              <option value="tcp_port_proxy_needed">需要 TCP 端口代理</option>
              <option value="udp_broadcast_needed">需要 UDP 广播桥</option>
              <option value="steam_relay_plugin">Steam 中继插件入口</option>
              <option value="steam_p2p_only">仅 Steam P2P/大厅</option>
              <option value="local_coop_remote_play">本地同屏远程联机</option>
              <option value="official_only">仅官方服</option>
              <option value="not_supported">暂不支持</option>
              <option value="unknown_need_review">待人工确认</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
              <input type="checkbox" checked={editor.can_convert_to_lan} onChange={(e) => setEditor({ ...editor, can_convert_to_lan: e.target.checked })} />
              可转换为局域网体验
            </label>
            <button onClick={saveEditor} disabled={Boolean(busy) || !editorPreviewConfirmed} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60">
              <Save className="h-4 w-4" />
              确认后保存
            </button>
          </div>
          <textarea value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} className="mt-3 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/80 p-4" data-adapter-structured-evidence="editor">
            <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-100">适用条件与验证证据</h4>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  这些字段会写入 adapter JSON，供共享库审核、质量评分和远程同步判断使用；不要只把证据塞进 notes。
                </p>
              </div>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">验证状态</span>
                <select
                  value={editor.verification_status}
                  onChange={(e) => setEditor({ ...editor, verification_status: e.target.value as AdapterVerificationStatus })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-amber-400"
                >
                  <option value="unverified">未实测</option>
                  <option value="self_tested">本机自测</option>
                  <option value="friend_tested">好友实测</option>
                  <option value="community_verified">社区验证</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <textarea value={editor.tested_versions} onChange={(e) => setEditor({ ...editor, tested_versions: e.target.value })} placeholder="测试过的游戏版本，例如 v1.4.4.9 / Steam build 123456" className="min-h-20 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
              <textarea value={editor.tested_platforms} onChange={(e) => setEditor({ ...editor, tested_platforms: e.target.value })} placeholder="平台/商店版本，例如 Steam；GOG；Epic" className="min-h-20 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
              <textarea value={editor.supported_os} onChange={(e) => setEditor({ ...editor, supported_os: e.target.value })} placeholder="适用系统，例如 Windows；Linux；Steam Deck" className="min-h-20 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
              <textarea value={editor.network_conditions} onChange={(e) => setEditor({ ...editor, network_conditions: e.target.value })} placeholder="适用网络条件，例如 同一虚拟局域网；防火墙允许端口" className="min-h-20 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
              <textarea value={editor.known_limitations} onChange={(e) => setEditor({ ...editor, known_limitations: e.target.value })} placeholder="不适用边界/风险，例如 官方服限定；不能虚拟 IP 加入" className="min-h-20 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
              <textarea value={editor.port_protocols} onChange={(e) => setEditor({ ...editor, port_protocols: e.target.value })} placeholder="端口协议证据，例如 TCP 7777；UDP 27015 广播发现" className="min-h-20 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
              <textarea value={editor.evidence_items} onChange={(e) => setEditor({ ...editor, evidence_items: e.target.value })} placeholder="证据项，例如 多人菜单截图；服务端日志；端口监听截图；好友加入截图" className="min-h-20 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
              <textarea value={editor.test_steps} onChange={(e) => setEditor({ ...editor, test_steps: e.target.value })} placeholder="实测步骤，每行一步" className="min-h-20 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
              <input value={editor.last_verified_at} onChange={(e) => setEditor({ ...editor, last_verified_at: e.target.value })} placeholder="最近验证时间，例如 2026-06-05，可空" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/90 p-4" data-adapter-save-preview="editor">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-300">保存前真实预览</span>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                    editorWillGenerateLanInvite ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {editorWillGenerateLanInvite ? '会生成 LAN 邀请包' : '不会生成 LAN 邀请包'}
                  </span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-bold text-slate-300">
                    {networkTypeLabel(editorPreviewAdapter.network_type)}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100">
                  {editorPreviewAdapter.display_name || '未填写游戏名称'} 写入后会怎样生效
                </h4>
                <p className="mt-1 max-w-4xl text-[11px] leading-relaxed text-slate-400">
                  这里展示的是 buildAdapter(editor) 真实结果。确认后保存会写入本地 custom adapter，并驱动游戏扫描、推荐方案、邀请包、诊断页和高级工具入口。
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-200">
                <input
                  type="checkbox"
                  checked={editorPreviewConfirmed}
                  onChange={(event) => setEditorPreviewConfirmed(event.target.checked)}
                />
                已确认预览，允许保存
              </label>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">能力与转换方式</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                  能力：{editorPreviewAdapter.capabilities.map(gameCapabilityLabel).join('、') || '未标注'}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                  方法：{editorPreviewAdapter.multiplayer_conversion?.methods?.join('、') || '未生成'}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                  可转 LAN：{editorPreviewAdapter.multiplayer_conversion?.can_convert_to_lan ? '是' : '否'} ｜ 风险：{editorPreviewAdapter.multiplayer_conversion?.risk_level || '-'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">连接计划</p>
                <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-300">
                  {editorPreviewPlan?.summary || '未生成摘要'}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  加入目标：{editorPreviewPlan?.default_join_host || '-'}{editorPreviewPlan?.default_join_port ? `:${editorPreviewPlan.default_join_port}` : ''}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">路线开关</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    editorPreviewPlan?.requires_virtual_lan ? '需要虚拟局域网' : '不需要虚拟局域网',
                    editorPreviewPlan?.requires_tcp_port_proxy ? '需要端口代理' : '',
                    editorPreviewPlan?.requires_udp_broadcast_bridge ? '需要 UDP 广播桥' : '',
                    editorPreviewPlan?.requires_dedicated_server ? '需要服务端' : '',
                  ].filter(Boolean).map((item) => (
                    <span key={item} className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-300">
                      {item}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  必需组件：{editorPreviewAdapter.multiplayer_conversion?.required_components?.join('、') || '无'}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">结构化适用条件</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{formatAdapterApplicability(editorPreviewAdapter)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">结构化验证证据</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{formatAdapterEvidence(editorPreviewAdapter)}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  保存差异 {editorPreviewPreviousAdapter ? `｜覆盖 ${sourceLabel(editorPreviewPreviousAdapter.adapter_source)}` : '｜新增 custom'}
                </p>
                <div className="mt-2 space-y-1">
                  {(editorPreviewChangedFields.length > 0 ? editorPreviewChangedFields : editorPreviewDiffFields.slice(0, 3)).slice(0, 5).map((field) => (
                    <p key={field.field} className="break-all text-[11px] leading-relaxed text-slate-400">
                      <b className={field.affects_recommendation ? 'text-amber-300' : 'text-slate-300'}>{field.label}：</b>
                      {field.changed ? `${field.before} → ${field.after}` : '无变化'}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">风险确认</p>
                {editorPreviewWarnings.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-amber-200">
                    {editorPreviewWarnings.map((warning) => <li key={warning}>• {warning}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] leading-relaxed text-emerald-300">
                    暂无明显路线风险；仍建议保存前确认端口、游戏内加入方式和好友实际操作步骤。
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {savedAdapterReview && savedAdapterReviewQuality && savedAdapterReviewAudit ? (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-5 shadow-sm" data-adapter-post-save-review="summary">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-emerald-700">保存后自动复核</span>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${savedAdapterReviewQuality.badgeClass}`}>
                  质量评分：{savedAdapterReviewQuality.label} {savedAdapterReviewQuality.score}分
                </span>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${savedAdapterReviewAudit.badgeClass}`}>
                  发布审核状态：{savedAdapterReviewAudit.label}
                </span>
                {savedAdapterReview.sourceContributionId ? (
                  <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700">
                    来源：用户贡献包
                  </span>
                ) : null}
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {savedAdapterReview.adapter.display_name} 已保存为本地 custom adapter
              </h3>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
                保存时间：{savedAdapterReview.savedAt}。下面展示保存后的质量评分、发布审核状态、推荐路线影响和共享库提交建议，避免保存完成后还要到多个区域手动查。
              </p>
              {savedAdapterReview.sourceContributionId ? (
                <p className="mt-2 max-w-4xl rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-sky-700">
                  来源：用户贡献包 {savedAdapterReview.sourceContributionId}，当前贡献队列状态为
                  {contributionReviewQueueStatusLabel(savedAdapterReview.sourceContributionStatus || 'drafted')}。
                  已完成“贡献包 → adapter 草稿 → 保存复核”，下一步可按发布审核结果加入共享库提交队列。
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button onClick={exportSavedAdapterSubmitPackage} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                <Download className="h-4 w-4" />
                一键生成共享库提交包
              </button>
              <button
                onClick={addSavedAdapterReviewToSubmitQueue}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold ${
                  savedAdapterReviewAudit.canSubmit
                    ? 'border border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200'
                    : 'border border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Upload className="h-4 w-4" />
                {submitQueueGameIds.includes(savedAdapterReview.adapter.game_id) ? '已在提交队列' : '加入共享库提交队列'}
              </button>
              <button onClick={copySavedAdapterReviewReport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                <ClipboardCopy className="h-4 w-4" />
                复制复核报告
              </button>
              <button onClick={() => setSavedAdapterReview(null)} className="rounded-xl border border-transparent px-4 py-2 text-xs font-bold text-slate-500 hover:bg-white/60">
                关闭复核
              </button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-white/80 bg-white/80 p-3">
              <p className="text-[11px] font-bold text-slate-500">质量评分</p>
              <p className="mt-2 text-2xl font-black text-slate-800">{savedAdapterReviewQuality.score}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{savedAdapterReviewQuality.summary}</p>
              <p className="mt-2 text-[11px] font-bold text-slate-700">
                直接使用：{savedAdapterReviewQuality.canUseDirectly ? '可以按向导执行' : '建议先复核'}
              </p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/80 p-3">
              <p className="text-[11px] font-bold text-slate-500">发布审核状态</p>
              <p className="mt-2 text-sm font-bold text-slate-800">{savedAdapterReviewAudit.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{savedAdapterReviewAudit.summary}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                提交建议：{savedAdapterReviewAudit.canSubmit ? '可以生成提交包，提交前仍需人工核对。' : '暂不建议提交共享库。'}
              </p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/80 p-3">
              <p className="text-[11px] font-bold text-slate-500">推荐路线影响</p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-700">
                {networkTypeLabel(savedAdapterReview.adapter.network_type)} ｜ {savedAdapterReview.adapter.multiplayer_conversion?.methods?.join('、') || '未标注转换方式'}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {savedAdapterReview.adapter.connection_plan?.summary || '暂无方案摘要'}
              </p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/80 p-3">
              <p className="text-[11px] font-bold text-slate-500">下一步动作</p>
              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-600">
                <li>• {savedAdapterReviewAudit.canSubmit ? '生成提交包，或直接加入共享库提交队列。' : '先补齐缺失项或复核风险，再考虑提交。'}</li>
                <li>• 在推荐页选择该游戏，确认是否按 adapter 自动切换路线。</li>
                <li>• 若是 LAN 类方案，至少做一次端口检测和邀请包测试。</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-white/80 bg-white/80 p-3">
              <p className="mb-2 text-[11px] font-bold text-slate-500">保存差异</p>
              <div className="space-y-1">
                {(savedAdapterReview.diffFields.filter((field) => field.changed).length > 0
                  ? savedAdapterReview.diffFields.filter((field) => field.changed)
                  : savedAdapterReview.diffFields.slice(0, 4)
                ).slice(0, 6).map((field) => (
                  <p key={field.field} className="break-all text-[11px] leading-relaxed text-slate-600">
                    <b className={field.affects_recommendation ? 'text-amber-700' : 'text-slate-700'}>{field.label}：</b>
                    {field.changed ? `${field.before} → ${field.after}` : '无变化'}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/80 p-3">
              <p className="mb-2 text-[11px] font-bold text-slate-500">风险 / 缺失 / 复核项</p>
              <div className="grid gap-2 md:grid-cols-3">
                <p className="text-[11px] leading-relaxed text-amber-700">
                  <b>风险：</b>{savedAdapterReviewQuality.risks.slice(0, 3).join('；') || '暂无明显风险'}
                </p>
                <p className="text-[11px] leading-relaxed text-rose-700">
                  <b>缺失：</b>{[...savedAdapterReviewQuality.missing, ...savedAdapterReviewAudit.missing].slice(0, 3).join('、') || '无必要字段缺失'}
                </p>
                <p className="text-[11px] leading-relaxed text-sky-700">
                  <b>复核：</b>{savedAdapterReviewAudit.review.slice(0, 3).join('；') || '暂无额外复核项'}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">adapter 分类总览</h3>
            <p className="mt-1 text-xs text-slate-500">
              当前库内 {inventory.total} 个方案，其中 {inventory.convertible} 个可作为局域网/直连转换候选，{inventory.registry} 个来自共享库。
            </p>
          </div>
          <button
            onClick={() => setCategoryFilter('all')}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
              categoryFilter === 'all'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            查看全部
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {inventory.counts.map((category) => {
            const selected = categoryFilter === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setCategoryFilter(category.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  selected ? category.panelClass : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-white ${category.iconBgClass}`}>
                    {category.id === 'dedicated_server' ? <Server className="h-4 w-4" /> : category.id === 'bridge_or_proxy' ? <Wrench className="h-4 w-4" /> : category.id === 'needs_review' ? <ShieldQuestion className="h-4 w-4" /> : <Network className="h-4 w-4" />}
                  </span>
                  <b className="text-lg text-slate-800">{category.count}</b>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-800">{category.shortLabel}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{category.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-adapter-quality-confidence="summary">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">适配器质量评分与推荐可信度</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              质量评分不等于“能否强转 LAN”。它会综合联机类型、连接方案、端口、邀请模板、排障说明、来源和版本冲突，告诉普通用户这个推荐是否可以直接照做。
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-500">
            可直接照做 {adapterQualitySummary.direct}/{adapterQualitySummary.total}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
            <p className="text-[11px] font-bold text-emerald-600">高可信</p>
            <p className="mt-2 text-2xl font-black text-emerald-800">{adapterQualitySummary.high}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-700">字段完整、来源明确、无冲突，可按当前向导执行。</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
            <p className="text-[11px] font-bold text-amber-600">中可信</p>
            <p className="mt-2 text-2xl font-black text-amber-800">{adapterQualitySummary.medium}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-700">可以参考，但建议管理员复核端口、步骤或适用边界。</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/80 p-4">
            <p className="text-[11px] font-bold text-rose-600">低可信</p>
            <p className="mt-2 text-2xl font-black text-rose-800">{adapterQualitySummary.low}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-700">缺字段、待确认或有冲突时，不应直接误导用户开房。</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold text-slate-600">评分规则</p>
            <p className="mt-2 text-xs font-bold text-slate-800">质量 ≠ 可转换</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">官方服限定或同屏远程也可以是高可信，只是不会生成 LAN 邀请包。</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-adapter-publish-audit="summary">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">共享库发布审核状态</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              这里不会盲目把所有自建方案标成“可发”。系统会检查必要字段、适用边界、同步来源和最近同步结果，帮助管理员判断哪些 adapter 可以提交共享库，哪些仍需复核或补全。
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[11px] text-slate-500">
            共 {publishAuditSummary.total} 个 adapter
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <button
            onClick={() => setCategoryFilter('all')}
            className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 text-left transition hover:border-sky-200 hover:bg-sky-50"
          >
            <p className="text-[11px] font-bold text-sky-600">可提交</p>
            <p className="mt-2 text-2xl font-black text-sky-800">{publishAuditSummary.ready}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-sky-700">字段完整，可生成共享库提交包。</p>
          </button>
          <button
            onClick={() => setCategoryFilter('all')}
            className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-left transition hover:border-amber-200 hover:bg-amber-50"
          >
            <p className="text-[11px] font-bold text-amber-600">需复核</p>
            <p className="mt-2 text-2xl font-black text-amber-800">{publishAuditSummary.needsReview}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-700">适用边界、Steam/P2P 或同屏方案需人工确认。</p>
          </button>
          <button
            onClick={() => setCategoryFilter('all')}
            className="rounded-2xl border border-rose-100 bg-rose-50/80 p-4 text-left transition hover:border-rose-200 hover:bg-rose-50"
          >
            <p className="text-[11px] font-bold text-rose-600">草稿不完整</p>
            <p className="mt-2 text-2xl font-black text-rose-800">{publishAuditSummary.incomplete}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-700">缺少关键字段，不建议提交给其他用户。</p>
          </button>
          <button
            onClick={() => setCategoryFilter('all')}
            className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
          >
            <p className="text-[11px] font-bold text-emerald-600">已在共享库</p>
            <p className="mt-2 text-2xl font-black text-emerald-800">{publishAuditSummary.registrySynced}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-700">来自 registry，同步后无需重复提交。</p>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-adapter-review-workbench="queue">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">共享库审核工作台</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-500">
                当前筛选 {filteredReviewWorkbenchItems.length}/{reviewWorkbenchStats.total}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">批量复核待提交 adapter</h3>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-500">
              按可信度、发布审核状态和结构化证据筛选 adapter，批量查看待处理项，并复制审核意见给管理员或共享库维护者。
            </p>
          </div>
          <button onClick={copyReviewWorkbenchReport} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
            <ClipboardCopy className="h-4 w-4" />
            复制当前筛选审核意见
          </button>
        </div>
        <div className="mb-4 grid gap-2 md:grid-cols-5">
          {[
            { id: 'all' as ReviewWorkbenchFilter, label: '全部', count: reviewWorkbenchStats.total, tone: 'slate' },
            { id: 'high_confidence' as ReviewWorkbenchFilter, label: '高可信', count: reviewWorkbenchStats.highConfidence, tone: 'emerald' },
            { id: 'needs_review' as ReviewWorkbenchFilter, label: '需复核', count: reviewWorkbenchStats.needsReview, tone: 'amber' },
            { id: 'missing_evidence' as ReviewWorkbenchFilter, label: '缺证据', count: reviewWorkbenchStats.missingEvidence, tone: 'rose' },
            { id: 'submit_ready' as ReviewWorkbenchFilter, label: '可提交', count: reviewWorkbenchStats.submitReady, tone: 'sky' },
          ].map((filter) => {
            const selected = reviewWorkbenchFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setReviewWorkbenchFilter(filter.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  selected
                    ? filter.tone === 'emerald'
                      ? 'border-emerald-200 bg-emerald-50'
                      : filter.tone === 'amber'
                        ? 'border-amber-200 bg-amber-50'
                        : filter.tone === 'rose'
                          ? 'border-rose-200 bg-rose-50'
                          : filter.tone === 'sky'
                            ? 'border-sky-200 bg-sky-50'
                            : 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white'
                }`}
              >
                <p className={`text-[11px] font-bold ${selected && filter.tone === 'slate' ? 'text-white' : 'text-slate-600'}`}>{filter.label}</p>
                <p className={`mt-1 text-2xl font-black ${selected && filter.tone === 'slate' ? 'text-white' : 'text-slate-800'}`}>{filter.count}</p>
              </button>
            );
          })}
        </div>
        <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4" data-adapter-submit-queue="batch-export">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-sky-700">共享库提交队列</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                  已选择 {submitQueueAdapters.length} 个
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-800">批量导出可提交 adapter</h4>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">
                从审核工作台把可提交且证据完整的 adapter 加入队列，一次生成文件清单、sha256、index.json 条目、GitHub Pages/VPS 流程和批量 bundle JSON。
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full border border-sky-100 bg-white/80 px-2 py-1">
                  已恢复上次队列：{submitQueueRestoredAt ? `${initialSubmitQueue.gameIds.length} 个条目` : '无'}
                </span>
                <span className="rounded-full border border-sky-100 bg-white/80 px-2 py-1">
                  本地保存时间：{formatSubmitQueueSnapshotTime(submitQueueSavedAt)}
                </span>
                <button
                  onClick={clearSubmitQueueSavedRecord}
                  className="rounded-full border border-transparent px-2 py-1 font-bold text-slate-500 hover:border-slate-200 hover:bg-white"
                >
                  清除本地队列记录
                </button>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={() => addSubmitReadyItemsToQueue(filteredReviewWorkbenchItems, '当前筛选')}
                className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-[11px] font-bold text-sky-700 hover:bg-sky-50"
              >
                加入当前筛选可提交项
              </button>
              <button
                onClick={() => addSubmitReadyItemsToQueue(adapterReviewWorkbenchItems, '全部 adapter')}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                加入全部可提交项
              </button>
              <button
                onClick={buildSubmitQueueBatch}
                disabled={Boolean(busy) || submitQueueAdapters.length === 0}
                className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                批量生成提交说明
              </button>
              <button
                onClick={publishSubmitQueueToLocalRegistry}
                disabled={Boolean(busy) || submitQueueAdapters.length === 0}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              >
                写入本地共享库示例
              </button>
            </div>
          </div>
          {submitQueueAdapters.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {submitQueueAdapters.map((adapter) => (
                <span key={adapter.game_id} className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-700">
                  {adapter.display_name}
                  <button onClick={() => removeAdapterFromSubmitQueue(adapter.game_id)} className="text-slate-400 hover:text-rose-600">×</button>
                </span>
              ))}
              <button onClick={clearSubmitQueue} className="rounded-full border border-transparent px-3 py-1 text-[11px] font-bold text-slate-500 hover:bg-white/70">
                清空队列
              </button>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-slate-500">队列为空。可以从下方单条加入，或点击“加入全部可提交项”。</p>
          )}
          {submitQueuePublishResult ? (
            <div className="mt-3 rounded-xl border border-emerald-100 bg-white/90 p-3" data-adapter-local-registry-publish="result">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">本地共享库发布结果</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    已把队列写入 <b>adapter-registry/games</b>，并重建 <b>adapter-registry/index.json</b>。这一步不会直接推送远程，只是准备好 GitHub Pages / VPS 可上传的静态目录。
                  </p>
                </div>
                <button onClick={copyLocalRegistryPublishReport} className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  复制发布结果
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                {[
                  ['写入', submitQueuePublishResult.written],
                  ['新增', submitQueuePublishResult.created],
                  ['更新', submitQueuePublishResult.updated],
                  ['未变化', submitQueuePublishResult.unchanged],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold text-slate-400">{label}</p>
                    <p className="mt-1 text-lg font-black text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                <p><b>index.json：</b>{submitQueuePublishResult.index_path}</p>
                <p><b>adapter 目录：</b>{submitQueuePublishResult.games_dir}</p>
                <p><b>校验：</b>{submitQueuePublishResult.verified ? '通过，sha256 与 index.json 匹配' : '未通过，请查看后端消息'}</p>
                <p><b>下一步：</b>检查 adapter-registry 后，用 GitHub Desktop 提交并 Push；或把 adapter-registry 整个目录上传到 VPS/静态站点。</p>
              </div>
            </div>
          ) : null}
          {submitQueueBatchText ? (
            <div className="mt-3 rounded-xl border border-sky-100 bg-white/90 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-800">批量提交说明 / bundle JSON</p>
                <button onClick={copySubmitQueueBatch} className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700">
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  复制批量提交说明
                </button>
              </div>
              <textarea readOnly value={submitQueueBatchText} className="min-h-40 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-600" />
            </div>
          ) : null}
        </div>
        <div className="max-h-96 overflow-auto rounded-2xl border border-slate-100 bg-slate-50/70">
          {filteredReviewWorkbenchItems.slice(0, 24).map((item) => (
            <article key={item.adapter.game_id} className="grid gap-3 border-b border-slate-100 bg-white/80 p-4 last:border-b-0 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <b className="text-sm text-slate-800">{item.adapter.display_name}</b>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">{item.adapter.game_id}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.quality.badgeClass}`}>
                    {item.quality.label} {item.quality.score}分
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.audit.badgeClass}`}>
                    {item.audit.label}
                  </span>
                  {item.missingEvidence ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">缺结构化证据</span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">证据已结构化</span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {networkTypeLabel(item.adapter.network_type)} ｜ {item.recommendation}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                  适用条件：{formatAdapterApplicability(item.adapter)}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                  验证证据：{formatAdapterEvidence(item.adapter)}
                </p>
                {item.reasons.length > 0 ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                    待处理：{item.reasons.slice(0, 3).join('；')}{item.reasons.length > 3 ? ` 等 ${item.reasons.length} 项` : ''}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2 lg:justify-end">
                <button onClick={() => copyAdapterReviewOpinion(item)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                  复制审核意见
                </button>
                <button onClick={() => { setQuery(item.adapter.game_id); setCategoryFilter('all'); }} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-50">
                  定位列表
                </button>
                {submitQueueGameIds.includes(item.adapter.game_id) ? (
                  <button onClick={() => removeAdapterFromSubmitQueue(item.adapter.game_id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 hover:bg-slate-50">
                    移出队列
                  </button>
                ) : (
                  <button
                    onClick={() => addAdapterToSubmitQueue(item.adapter)}
                    disabled={!item.audit.canSubmit || item.audit.state === 'incomplete' || item.missingEvidence}
                    className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-[11px] font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                  >
                    加入提交队列
                  </button>
                )}
                <button onClick={() => exportAdapter(item.adapter)} disabled={Boolean(busy)} className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  {item.audit.canSubmit ? '生成提交包' : '导出草稿'}
                </button>
              </div>
            </article>
          ))}
          {filteredReviewWorkbenchItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              当前筛选下没有 adapter。可以切换筛选或先同步/创建更多方案。
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-adapter-version-conflicts="summary">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">适配器版本与冲突处理</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              同一个 game_id 可能同时存在内置方案、共享库方案和管理员自建方案。当前真实优先级为 custom &gt; registry &gt; builtin；如果不同来源内容不一致，这里会提示先备份，再选择保留当前或用共享库覆盖。
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
            conflictSummary.conflicts > 0
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}>
            {conflictSummary.conflicts > 0 ? `${conflictSummary.conflicts} 个冲突` : '暂无冲突'}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
            <p className="text-[11px] font-bold text-rose-600">版本冲突</p>
            <p className="mt-2 text-2xl font-black text-rose-800">{conflictSummary.conflicts}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-700">同一游戏多个来源指纹不同，需要人工决策。</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold text-slate-600">多来源游戏</p>
            <p className="mt-2 text-2xl font-black text-slate-800">{conflictSummary.multiSource}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">存在内置/共享库/自建任意两个来源。</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
            <p className="text-[11px] font-bold text-amber-600">已固定自建</p>
            <p className="mt-2 text-2xl font-black text-amber-800">{conflictSummary.pinnedCustom}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-700">当前生效来源是 custom，后续同步不会直接覆盖。</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
            <p className="text-[11px] font-bold text-emerald-600">共享库生效</p>
            <p className="mt-2 text-2xl font-black text-emerald-800">{conflictSummary.registryActive}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-700">当前按 registry 方案进入推荐流程。</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-adapter-backup-history="restore">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">适配器变更历史 / 备份恢复</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              保存自建方案、导入 adapter、用共享库覆盖、同步共享库或恢复备份前，后端会先把旧 JSON 保存到 backups/adapters。这里用于查看最近备份，并在误操作后恢复旧方案。
            </p>
          </div>
          <button
            onClick={() => loadAdapters('刷新备份历史')}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            刷新备份历史
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold text-slate-500">当前备份数量</p>
            <p className="mt-2 text-3xl font-black text-slate-800">{adapterBackups.length}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              备份只保存 adapter JSON，不包含用户隐私或运行日志。恢复时会先备份当前文件，再覆盖回原路径。
            </p>
          </div>
          <div className="max-h-64 overflow-auto rounded-2xl border border-slate-100 bg-slate-50/60">
            {adapterBackups.slice(0, 12).map((backup) => (
              <div key={backup.id} className="grid gap-3 border-b border-slate-100 bg-white/70 p-3 last:border-b-0 md:grid-cols-[1fr_auto]">
                <div className="min-w-0 text-xs">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <b className="text-slate-800">{backup.display_name}</b>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{sourceLabel(backup.source)}</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{backupReasonLabel(backup.reason)}</span>
                    <span className="font-mono text-[10px] text-slate-400">{backup.short_fingerprint}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{formatBackupTime(backup.created_at)} ｜ {backup.size_bytes} bytes</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{backup.backup_path}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <button onClick={() => copyBackupReport(backup)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                    复制备份记录
                  </button>
                  <button onClick={() => restoreBackup(backup)} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                    恢复此备份
                  </button>
                </div>
              </div>
            ))}
            {adapterBackups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                暂无 adapter 备份。后续发生覆盖、导入或同步更新时会自动生成。
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-800">本地真实适配器列表</h3>
            <label className="relative w-64 max-w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索游戏或 game_id" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-amber-400" />
            </label>
          </div>
          <div className="space-y-2">
            {filteredAdapters.map((adapter) => {
              const category = deriveAdapterCategory(adapter);
              const audit = auditAdapterForPublish(adapter, syncResult);
              const conflict = conflictByGameId.get(adapter.game_id);
              const qualityScore = buildAdapterQualityScore(adapter, {
                hasConflict: conflict?.has_conflict,
                conflictSummary: conflict?.summary,
              });
              const methods = conversionMethodsFor(adapter);
              const conditions = buildApplicabilityList(adapter, 3);
              return (
                <article key={adapter.game_id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-800">{adapter.display_name}</h4>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${category.badgeClass}`}>
                          {category.label}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {sourceLabel(adapter.adapter_source)}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${audit.badgeClass}`}>
                          {audit.label}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${qualityScore.badgeClass}`}>
                          可信度：{qualityScore.label} {qualityScore.score}分
                        </span>
                        {conflict ? (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            conflict.has_conflict
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : conflict.variants.length > 1
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-500'
                          }`}>
                            {conflict.has_conflict ? '版本冲突' : conflict.variants.length > 1 ? '来源一致' : '单一来源'}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">
                        {adapter.game_id} ｜ {networkTypeLabel(adapter.network_type)} ｜ {adapterVersionLabel(adapter, syncResult)}
                      </p>
                      {adapter.description ? (
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">{adapter.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs font-medium text-slate-700">{multiplayerSummary(adapter)}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{compactPlanSummary(adapter.connection_plan)}</p>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        推荐可信度：{qualityScore.summary} ｜ 发布审核：{audit.summary} ｜ {audit.syncStatus}
                      </p>
                    </div>
                    <button onClick={() => exportAdapter(adapter)} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                      <Download className="h-4 w-4" />
                      {audit.canSubmit ? '生成提交包' : '导出草稿'}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-100 bg-white p-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">转换方式</p>
                      <div className="flex flex-wrap gap-1.5">
                        {methods.map((method) => (
                          <span key={method} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                            {method}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        能力：{adapter.capabilities.map(gameCapabilityLabel).join('、') || '未标注'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">适用条件</p>
                      <ul className="space-y-1 text-[11px] leading-relaxed text-slate-600">
                        {conditions.map((condition) => <li key={condition}>• {condition}</li>)}
                      </ul>
                      <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-500">
                        结构化：{formatAdapterApplicability(adapter)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                        证据：{formatAdapterEvidence(adapter)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">可信度</p>
                      <div className="space-y-1 text-[11px] leading-relaxed text-slate-600">
                        <p><b className={qualityScore.level === 'high' ? 'text-emerald-600' : qualityScore.level === 'medium' ? 'text-amber-600' : 'text-rose-600'}>{qualityScore.label}：</b>{qualityScore.score} 分</p>
                        <p><b className={qualityScore.canUseDirectly ? 'text-emerald-600' : 'text-amber-600'}>直接使用：</b>{qualityScore.canUseDirectly ? '可按向导执行' : '建议先复核'}</p>
                        <p><b className="text-emerald-600">优点：</b>{qualityScore.strengths.slice(0, 2).join('、') || '暂无'}</p>
                        <p><b className={qualityScore.risks.length ? 'text-amber-600' : 'text-emerald-600'}>风险：</b>{qualityScore.risks.slice(0, 2).join('；') || '暂无明显风险'}</p>
                        <p><b className={qualityScore.missing.length ? 'text-rose-600' : 'text-emerald-600'}>缺失：</b>{qualityScore.missing.slice(0, 2).join('、') || '无'}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">发布检查</p>
                      <div className="space-y-1 text-[11px] leading-relaxed text-slate-600">
                        {audit.missing.length > 0 ? (
                          <p><b className="text-rose-600">缺失：</b>{audit.missing.slice(0, 3).join('、')}{audit.missing.length > 3 ? ` 等 ${audit.missing.length} 项` : ''}</p>
                        ) : (
                          <p><b className="text-emerald-600">缺失：</b>无必要字段缺失</p>
                        )}
                        {audit.warnings.length > 0 ? (
                          <p><b className="text-amber-600">提醒：</b>{audit.warnings.slice(0, 2).join('；')}{audit.warnings.length > 2 ? ` 等 ${audit.warnings.length} 项` : ''}</p>
                        ) : (
                          <p><b className="text-emerald-600">提醒：</b>未发现明显字段提醒</p>
                        )}
                        {audit.review.length > 0 ? (
                          <p><b className="text-sky-600">复核：</b>{audit.review.slice(0, 2).join('；')}{audit.review.length > 2 ? ` 等 ${audit.review.length} 项` : ''}</p>
                        ) : (
                          <p><b className="text-emerald-600">复核：</b>暂无额外复核项</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>端口：{adapter.default_ports?.join(', ') || '未设置'}</span>
                    <span>exe：{adapter.executables?.join(', ') || '未设置'}</span>
                    <span>Steam AppID：{adapter.steam_appid || '-'}</span>
                  </div>

                  {conflict && conflict.variants.length > 1 ? (
                    <div className={`mt-3 rounded-xl border p-3 ${
                      conflict.has_conflict ? 'border-rose-100 bg-rose-50/70' : 'border-emerald-100 bg-emerald-50/60'
                    }`}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${conflict.has_conflict ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {conflict.has_conflict ? '检测到 adapter 版本冲突' : '多个来源内容一致'}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{conflict.summary}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{conflict.recommendation}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button onClick={() => exportAdapter(adapter)} disabled={Boolean(busy)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                            导出当前备份
                          </button>
                          <button onClick={() => pinCurrentAdapter(adapter)} disabled={Boolean(busy)} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-60">
                            保留当前为自建
                          </button>
                          {conflict.variants.some((variant) => variant.source === 'registry') ? (
                            <button onClick={() => useRegistryVersion(adapter)} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                              用共享库覆盖
                            </button>
                          ) : null}
                          <button onClick={() => copyConflictReport(conflict)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                            复制冲突报告
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {conflict.variants.map((variant) => (
                          <div key={`${variant.source}-${variant.path}`} className="rounded-lg border border-white/70 bg-white/80 p-2 text-[11px] text-slate-600">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-800">{sourceLabel(variant.source)}</span>
                              {variant.is_active ? <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">当前生效</span> : null}
                              <span className="font-mono text-slate-400">{variant.short_fingerprint}</span>
                            </div>
                            <p>类型：{networkTypeLabel(variant.network_type || undefined)} ｜ 端口：{variant.default_ports?.join(', ') || '未设置'}</p>
                            <p className="mt-1 break-all font-mono text-slate-400">{variant.path}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {filteredAdapters.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">暂无适配器，请同步共享库或导入 JSON。</div>}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Upload className="h-5 w-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800">导入单个 Adapter JSON</h3>
            </div>
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴 adapter JSON 内容" className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs outline-none focus:border-amber-400" />
            <button onClick={importAdapter} disabled={Boolean(busy)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
              <Upload className="h-4 w-4" />
              导入并写入本地方案库
            </button>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">最近同步报告</h3>
              {syncResult?.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : syncResult ? <XCircle className="h-5 w-5 text-rose-500" /> : null}
            </div>
            {syncResult ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">新增 <b>{syncResult.created}</b></div>
                  <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700">更新 <b>{syncResult.updated}</b></div>
                  <div className="rounded-xl bg-slate-50 p-3 text-slate-700">跳过 <b>{syncResult.skipped}</b></div>
                  <div className="rounded-xl bg-rose-50 p-3 text-rose-700">拉取失败 <b>{syncResult.fetch_failed}</b></div>
                  <div className="rounded-xl bg-rose-50 p-3 text-rose-700">校验失败 <b>{syncResult.validation_failed}</b></div>
                  <div className="rounded-xl bg-rose-50 p-3 text-rose-700">写入失败 <b>{syncResult.write_failed}</b></div>
                </div>
                <p className="mt-3 truncate font-mono text-[11px] text-slate-400">
                  {registryVersionLabel(syncResult)} ｜ {syncResult.registry_url}
                </p>
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3" data-adapter-sync-diff-summary="result">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600">来源：{syncResultAfterSummary.source}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">写入变化 {syncResultAfterSummary.changed}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">未变化 {syncResultAfterSummary.unchanged}</span>
                    <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">失败 {syncResultAfterSummary.failed}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    同步后动作：{syncResultAfterSummary.nextAction}
                  </p>
                </div>
                <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-slate-100 text-[11px]">
                  {syncResult.items.slice(0, 12).map((item, index) => (
                    <div key={`${item.game_id}-${index}`} className="border-b border-slate-100 p-2 last:border-b-0">
                      <b>{item.display_name || item.game_id}</b>：{statusLabel(item.status)} ｜ {item.reason}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">尚未执行同步。同步结果会保存在本地并在下次打开时恢复。</p>
            )}
          </div>

          {exportText && (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">导出内容</h3>
                <div className="flex gap-2">
                  <button onClick={generateSubmitPackageFromExport} disabled={Boolean(busy)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 disabled:opacity-50">
                    <FileJson className="h-4 w-4" />
                    生成提交包
                  </button>
                  <button onClick={copyExportText} className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                    <ClipboardCopy className="h-4 w-4" />
                    复制 JSON
                  </button>
                </div>
              </div>
              <textarea readOnly value={exportText} className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-600" />
            </div>
          )}

          {submitPackage ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm" data-adapter-submit-wizard="registry-package">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">共享库提交向导</span>
                    <span className="rounded-full bg-slate-900 px-3 py-1 font-mono text-[10px] font-bold text-white">{submitPackage.fileName}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">{submitPackage.adapter.display_name} 提交包</h3>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                    {submitPackage.adapterPath}
                  </p>
                </div>
                <button
                  onClick={() => copyText(submitPackage.guideText, '完整提交说明')}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <ClipboardCopy className="h-4 w-4" />
                  复制完整提交说明
                </button>
              </div>

              <div className="grid gap-3 text-xs md:grid-cols-3">
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="mb-1 font-bold text-slate-800">adapter 文件路径</p>
                  <p className="break-all font-mono text-[11px] text-slate-600">{submitPackage.adapterPath}</p>
                  <button onClick={() => copyText(submitPackage.adapterPath, 'adapter 文件路径')} className="mt-2 text-[11px] font-bold text-amber-700">复制路径</button>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="mb-1 font-bold text-slate-800">SHA256</p>
                  <p className="break-all font-mono text-[11px] text-slate-600">{submitPackage.sha256}</p>
                  <button onClick={() => copyText(submitPackage.sha256, 'SHA256')} className="mt-2 text-[11px] font-bold text-amber-700">复制哈希</button>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="mb-1 font-bold text-slate-800">发布地址</p>
                  <p className="break-all font-mono text-[11px] text-slate-600">{solutionsUrl.trim() || DEFAULT_REGISTRY_URL}</p>
                  <button onClick={() => copyText(submitPackage.adapterUrl, 'adapter_url')} className="mt-2 text-[11px] font-bold text-amber-700">复制 adapter_url</button>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-white/80 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800">index.json 片段</p>
                  <button onClick={() => copyText(submitPackage.indexEntryJson, 'index.json 片段')} className="text-[11px] font-bold text-amber-700">
                    复制片段
                  </button>
                </div>
                <pre className="max-h-40 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-amber-100">{submitPackage.indexEntryJson}</pre>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="mb-2 text-xs font-bold text-slate-800">GitHub Pages 流程</p>
                  <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-600">
                    {submitPackage.githubSteps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="mb-2 text-xs font-bold text-slate-800">VPS / 静态服务器流程</p>
                  <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-slate-600">
                    {submitPackage.vpsSteps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-amber-100 bg-white/80 p-3">
                <p className="mb-2 text-xs font-bold text-slate-800">提交前审核清单</p>
                <ul className="space-y-1 text-[11px] leading-relaxed text-slate-600">
                  {submitPackage.reviewChecklist.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
