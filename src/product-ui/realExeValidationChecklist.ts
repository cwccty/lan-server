export type RealExeValidationStatus = 'wired' | 'observed' | 'manual_check';
export type RealExeManualValidationStatus = 'PASS' | 'FAIL' | 'PENDING';

export interface RealExeValidationItem {
  id: string;
  label: string;
  status: RealExeValidationStatus;
  evidence: string;
  manualCheck: string;
}

export interface RealExeManualValidationResult {
  itemId: string;
  status: RealExeManualValidationStatus;
  note: string;
  updatedAt: string;
}

export type RealExeManualValidationResults = Record<string, RealExeManualValidationResult>;

export interface RealExeValidationPublishGate {
  status: 'ready' | 'pending' | 'blocked';
  summary: string;
  criticalPassed: number;
  criticalTotal: number;
  criticalPending: string[];
  criticalFailed: string[];
  allPendingCount: number;
  allFailedCount: number;
}

export interface RealExeValidationCacheSnapshot {
  gameScanCache: boolean;
  recommendationCache: boolean;
  networkFormCache: boolean;
  terrariaFormCache: boolean;
}

export interface RealExeValidationInput {
  appVersion: string;
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
  terraria: {
    running: boolean;
    ready: boolean;
    message?: string;
  };
  hasReport: boolean;
  issueCount: number;
  requiredPassed: number;
  requiredTotal: number;
  hasInviteDiagnosticContext: boolean;
  hasHostDiagnosticContext: boolean;
  hasLatestAdvancedToolFix: boolean;
  fixHistoryCount: number;
  routeUsesLanInvite?: boolean | null;
  routeKind?: string;
  routeTitle?: string;
  cacheSnapshot: RealExeValidationCacheSnapshot;
}

const REAL_EXE_VALIDATION_ITEMS: RealExeValidationItem[] = [
  {
    id: 'release-exe-entry',
    label: '真实 EXE 入口',
    status: 'wired',
    evidence: 'release_preflight 确认 EXE 强制 Product Mode、产品运行桥接已挂载、参考页 patcher 不进入发布入口。',
    manualCheck: '从 src-tauri/target/release/lan-helper.exe 启动，而不是只看 npm dev 页面。',
  },
  {
    id: 'startup-window-clean',
    label: '启动窗口干净',
    status: 'manual_check',
    evidence: '需要人工观察主窗口、命令框和透明残留窗口，自动化 preflight 不能替代真实桌面观察。',
    manualCheck: '启动后不应出现额外白色命令框、透明框或难以关闭的后台窗口；关闭客户端后进程应退出或按策略清理。',
  },
  {
    id: 'page-reentry-cache',
    label: '二次进入不卡顿',
    status: 'wired',
    evidence: '游戏扫描、推荐方案、组网中心、Terraria 向导均有页面缓存；二次进入先显示上次真实结果或表单，再由用户主动刷新/后台刷新。',
    manualCheck: '连续切换游戏扫描 → 组网中心 → 推荐方案 → Terraria → 诊断页两轮，确认没有明显整页卡死。',
  },
  {
    id: 'n2n-vps-ack-pong',
    label: 'n2n / Supernode 链路',
    status: 'manual_check',
    evidence: '需要真实 supernode、edge 日志和 ACK/PONG；仅有地址文本不能证明链路可用。',
    manualCheck: 'VPS 上 supernode 正在监听；客户端启动 n2n 后看到 ACK/PONG 或诊断报告中的链路通过。',
  },
  {
    id: 'invite-one-click-join',
    label: '邀请包加入闭环',
    status: 'wired',
    evidence: '通用组网中心和首页支持粘贴邀请包、仅填入参数、保存并启动 n2n、失败带入诊断、成功复制游戏内连接说明。',
    manualCheck: '用房主生成的邀请包在本机或第二台电脑粘贴，确认加入结果卡片、失败分类和复制给房主文本都可用。',
  },
  {
    id: 'host-room-wizard',
    label: '房主开房向导',
    status: 'wired',
    evidence: '推荐方案页包含选择游戏、启动组网、启动服务端/游戏、检测端口、分配好友 IP、生成邀请包的步骤条。',
    manualCheck: '以 Terraria 为例按步骤执行，未启动服务端或未分配好友 IP 时不应直接复制不完整 LAN 邀请。',
  },
  {
    id: 'terraria-30s-stability',
    label: 'Terraria 30 秒稳定性',
    status: 'manual_check',
    evidence: '需要真实 TerrariaServer.exe、世界文件、端口监听和 30 秒日志稳定；UI 文案不能代替稳定性测试。',
    manualCheck: '启动 Terraria 服务端后等待 30 秒，确认 7777 监听、日志无崩溃、诊断报告能看到服务端状态。',
  },
  {
    id: 'advanced-tools-self-test',
    label: '高级工具自测',
    status: 'wired',
    evidence: 'TCP 端口代理、UDP 单播代理和 UDP 广播桥均有真实后端实例、自测、复盘回流诊断页。',
    manualCheck: '分别启动 TCP/UDP/广播桥自测；失败时参数错误应被阻止或写入诊断复盘。',
  },
  {
    id: 'adapter-registry-sync',
    label: '共享方案库同步',
    status: 'wired',
    evidence: '方案库支持本地示例库、GitHub Pages/VPS 远程库、同步预检、冲突、备份、差异、提交包和共享库自检。',
    manualCheck: '恢复默认共享库地址后同步一次；再同步本地示例库，确认 index.json、hash、创建/更新/跳过/失败明细正常。',
  },
  {
    id: 'non-lan-route-boundary',
    label: '非 LAN 路线边界',
    status: 'wired',
    evidence: '转换引擎把本地同屏、Steam P2P、官方服限定和未知待复核从 LAN 邀请中分离，推荐远程同屏/Steam/说明/复核。',
    manualCheck: '选择 Cuphead 或本地同屏样例时，应复制 Remote Play / Sunshine 说明，不应要求 n2n 好友虚拟 IP。',
  },
  {
    id: 'diagnostic-repair-center',
    label: '诊断修复中心',
    status: 'wired',
    evidence: '诊断页支持问题分类、一键修复、手动命令、自动复测、修复历史、邀请/房主上下文、路线纠错和复制报告。',
    manualCheck: '制造 edge.exe 缺失、Supernode 无响应或端口未监听场景，确认诊断给出对应动作而不是泛泛报错。',
  },
  {
    id: 'game-internal-join',
    label: '游戏内加入验证',
    status: 'manual_check',
    evidence: '最终可玩性只能由真实游戏内 Join via IP、服务端大厅或远程同屏体验确认。',
    manualCheck: 'Terraria 用 Join via IP 连接房主虚拟 IP 与端口；本地同屏游戏用远程同屏邀请实际进入。',
  },
];

export const REAL_EXE_RELEASE_CRITICAL_ITEM_IDS = [
  'release-exe-entry',
  'startup-window-clean',
  'page-reentry-cache',
  'n2n-vps-ack-pong',
  'invite-one-click-join',
  'host-room-wizard',
  'diagnostic-repair-center',
] as const;

const CACHE_KEYS = {
  gameScanCache: 'lan-helper.product.gameScan.cache.v1',
  recommendationCache: 'lan-helper.product.recommendation.cache.v1',
  networkFormCache: 'lan-helper.product.network.form.cache.v1',
  terrariaFormCache: 'lan-helper.product.terraria.form.cache.v1',
} satisfies Record<keyof RealExeValidationCacheSnapshot, string>;

export const REAL_EXE_VALIDATION_RESULTS_KEY = 'lan-helper.product.realExeValidationResults.v1';

function hasLocalStorageKey(key: string) {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(key));
  } catch {
    return false;
  }
}

export function readRealExeValidationCacheSnapshot(): RealExeValidationCacheSnapshot {
  return {
    gameScanCache: hasLocalStorageKey(CACHE_KEYS.gameScanCache),
    recommendationCache: hasLocalStorageKey(CACHE_KEYS.recommendationCache),
    networkFormCache: hasLocalStorageKey(CACHE_KEYS.networkFormCache),
    terrariaFormCache: hasLocalStorageKey(CACHE_KEYS.terrariaFormCache),
  };
}

export function readRealExeValidationManualResults(): RealExeManualValidationResults {
  try {
    const raw = window.localStorage.getItem(REAL_EXE_VALIDATION_RESULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RealExeManualValidationResults;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => (
        value?.itemId
        && (value.status === 'PASS' || value.status === 'FAIL' || value.status === 'PENDING')
      )),
    );
  } catch {
    return {};
  }
}

export function writeRealExeValidationManualResult(
  itemId: string,
  status: RealExeManualValidationStatus,
  note = '',
): RealExeManualValidationResults {
  const next = {
    ...readRealExeValidationManualResults(),
    [itemId]: {
      itemId,
      status,
      note,
      updatedAt: new Date().toISOString(),
    },
  };
  window.localStorage.setItem(REAL_EXE_VALIDATION_RESULTS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('lan-helper:real-exe-validation-results-updated'));
  return next;
}

export function clearRealExeValidationManualResults(): RealExeManualValidationResults {
  window.localStorage.removeItem(REAL_EXE_VALIDATION_RESULTS_KEY);
  window.dispatchEvent(new CustomEvent('lan-helper:real-exe-validation-results-updated'));
  return {};
}

export function summarizeRealExeManualValidationResults(results: RealExeManualValidationResults) {
  const values = Object.values(results);
  return {
    pass: values.filter((item) => item.status === 'PASS').length,
    fail: values.filter((item) => item.status === 'FAIL').length,
    pending: values.filter((item) => item.status === 'PENDING').length,
    total: values.length,
  };
}

export function buildRealExeValidationPublishGate(
  items: RealExeValidationItem[],
  results: RealExeManualValidationResults,
): RealExeValidationPublishGate {
  const itemById = Object.fromEntries(items.map((item) => [item.id, item]));
  const criticalPending = REAL_EXE_RELEASE_CRITICAL_ITEM_IDS
    .filter((itemId) => results[itemId]?.status !== 'PASS' && results[itemId]?.status !== 'FAIL')
    .map((itemId) => itemById[itemId]?.label || itemId);
  const criticalFailed = REAL_EXE_RELEASE_CRITICAL_ITEM_IDS
    .filter((itemId) => results[itemId]?.status === 'FAIL')
    .map((itemId) => itemById[itemId]?.label || itemId);
  const allPendingCount = items.filter((item) => !results[item.id] || results[item.id].status === 'PENDING').length;
  const allFailedCount = items.filter((item) => results[item.id]?.status === 'FAIL').length;
  const criticalPassed = REAL_EXE_RELEASE_CRITICAL_ITEM_IDS.length - criticalPending.length - criticalFailed.length;
  const status = criticalFailed.length > 0 ? 'blocked' : criticalPending.length > 0 ? 'pending' : 'ready';
  const summary = status === 'ready'
    ? '核心发布门禁已通过；仍需在 Release 文案中保留未做完的双机/更多游戏验证边界。'
    : status === 'blocked'
      ? `发现 ${criticalFailed.length} 个核心失败项，发布前应先修复或在 v0.1 中降级说明。`
      : `还有 ${criticalPending.length} 个核心项未记录 PASS，发布前请先完成真实 EXE 人工验证。`;
  return {
    status,
    summary,
    criticalPassed,
    criticalTotal: REAL_EXE_RELEASE_CRITICAL_ITEM_IDS.length,
    criticalPending,
    criticalFailed,
    allPendingCount,
    allFailedCount,
  };
}

function cacheCount(snapshot: RealExeValidationCacheSnapshot) {
  return Object.values(snapshot).filter(Boolean).length;
}

function markObserved(item: RealExeValidationItem, input: RealExeValidationInput): RealExeValidationItem {
  if (item.id === 'release-exe-entry') return { ...item, status: 'observed' };
  if (item.id === 'page-reentry-cache' && cacheCount(input.cacheSnapshot) >= 2) return { ...item, status: 'observed' };
  if (item.id === 'n2n-vps-ack-pong' && input.network.ready && !input.network.hasError) return { ...item, status: 'observed' };
  if (item.id === 'invite-one-click-join' && input.hasInviteDiagnosticContext) return { ...item, status: 'observed' };
  if (item.id === 'host-room-wizard' && input.hasHostDiagnosticContext) return { ...item, status: 'observed' };
  if (item.id === 'terraria-30s-stability' && input.terraria.ready) return { ...item, status: 'observed' };
  if (item.id === 'advanced-tools-self-test' && input.hasLatestAdvancedToolFix) return { ...item, status: 'observed' };
  if (item.id === 'non-lan-route-boundary' && input.routeUsesLanInvite === false) return { ...item, status: 'observed' };
  if (item.id === 'diagnostic-repair-center' && (input.hasReport || input.fixHistoryCount > 0)) return { ...item, status: 'observed' };
  return item;
}

export function buildRealExeValidationChecklist(input: RealExeValidationInput) {
  const items = REAL_EXE_VALIDATION_ITEMS.map((item) => markObserved(item, input));
  const observedCount = items.filter((item) => item.status === 'observed').length;
  const manualCount = items.filter((item) => item.status === 'manual_check').length;
  const cacheReadyCount = cacheCount(input.cacheSnapshot);
  return {
    items,
    observedCount,
    manualCount,
    wiredCount: items.length,
    cacheReadyCount,
    summary: `已整理 ${items.length} 项真实 EXE 人工验证清单；当前已观察 ${observedCount} 项，仍需人工确认 ${manualCount} 项，页面缓存命中 ${cacheReadyCount}/4。`,
    nextRisk: !input.runtimeLoaded
      ? '先启动真实 EXE 并等 runtime 读取完成。'
      : input.busy
        ? '当前仍有操作执行中，等待完成后再记录验证结果。'
        : input.network.hasError
          ? '当前组网存在错误，先进入诊断修复中心。'
          : cacheReadyCount < 4
            ? '先分别打开游戏扫描、推荐方案、组网中心和 Terraria 向导一次，确认二次进入缓存。'
            : !input.hasReport
              ? '先生成一次真实诊断报告，作为人工验证基线。'
              : '继续执行 VPS、双机和游戏内加入测试，并把结果复制到发布验证日志。',
  };
}

export function formatRealExeValidationChecklistReport(
  input: RealExeValidationInput,
  manualResults: RealExeManualValidationResults = {},
) {
  const checklist = buildRealExeValidationChecklist(input);
  const resultSummary = summarizeRealExeManualValidationResults(manualResults);
  const publishGate = buildRealExeValidationPublishGate(checklist.items, manualResults);
  return [
    '[联机助手真实 EXE 人工验证清单]',
    checklist.summary,
    '',
    '当前快照：',
    `- 版本：${input.appVersion || 'unknown'}`,
    `- runtime 已读取：${input.runtimeLoaded ? '是' : '否'}`,
    `- busy：${input.busy || '空闲'}`,
    `- n2n running/ready/error：${input.network.running ? '是' : '否'} / ${input.network.ready ? '是' : '否'} / ${input.network.hasError ? '是' : '否'}`,
    `- n2n 状态：${input.network.label || '暂无'}`,
    `- 虚拟 IP：${input.network.virtualIp || '未读取'}`,
    `- Supernode：${input.network.supernode || '未读取'}`,
    `- Terraria：${input.terraria.running ? '运行中' : '未运行'} / ${input.terraria.ready ? '已就绪' : '未就绪'} / ${input.terraria.message || '无消息'}`,
    `- 诊断报告：${input.hasReport ? `有，问题 ${input.issueCount} 个，必需项 ${input.requiredPassed}/${input.requiredTotal || '-'}` : '无'}`,
    `- 邀请失败上下文：${input.hasInviteDiagnosticContext ? '有' : '无'}`,
    `- 房主失败上下文：${input.hasHostDiagnosticContext ? '有' : '无'}`,
    `- 高级工具复盘：${input.hasLatestAdvancedToolFix ? '有' : '无'}`,
    `- 修复历史：${input.fixHistoryCount} 条`,
    `- 当前路线：${input.routeTitle || '未绑定'} / ${input.routeKind || 'unknown'} / ${input.routeUsesLanInvite === false ? '非 LAN 邀请' : input.routeUsesLanInvite === true ? 'LAN 邀请' : '未判断'}`,
    `- 页面缓存：游戏扫描=${input.cacheSnapshot.gameScanCache ? '有' : '无'}，推荐方案=${input.cacheSnapshot.recommendationCache ? '有' : '无'}，组网表单=${input.cacheSnapshot.networkFormCache ? '有' : '无'}，Terraria=${input.cacheSnapshot.terrariaFormCache ? '有' : '无'}`,
    `- 人工记录：PASS=${resultSummary.pass}，FAIL=${resultSummary.fail}，PENDING=${resultSummary.pending}，已记录=${resultSummary.total}`,
    `- 发布门禁：${publishGate.status.toUpperCase()}，核心 ${publishGate.criticalPassed}/${publishGate.criticalTotal}，全部待确认 ${publishGate.allPendingCount}，全部失败 ${publishGate.allFailedCount}`,
    `- 门禁说明：${publishGate.summary}`,
    publishGate.criticalPending.length ? `- 核心待确认：${publishGate.criticalPending.join('、')}` : '',
    publishGate.criticalFailed.length ? `- 核心失败：${publishGate.criticalFailed.join('、')}` : '',
    `- 下一风险：${checklist.nextRisk}`,
    '',
    '验证清单：',
    ...checklist.items.map((item, index) => {
      const manual = manualResults[item.id];
      return [
      `${index + 1}. ${item.label} [${item.status}]`,
      `   当前记录：${manual ? `${manual.status} / ${manual.updatedAt}${manual.note ? ` / ${manual.note}` : ''}` : 'PENDING / 尚未人工记录'}`,
      `   证据：${item.evidence}`,
      `   人工验证：${item.manualCheck}`,
    ].join('\n');
    }),
    '',
    '记录建议：',
    '- 每完成一项，在 docs/RELEASE_VALIDATION_LOG.md 记录日期、版本、环境、通过/失败、失败截图或复制报告。',
    '- 如果失败，不要只改 UI 文案；先用诊断报告、自检文本和真实日志定位内部状态。'
  ].join('\n');
}
