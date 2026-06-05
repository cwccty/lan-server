import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  Gamepad2,
  Link2,
  MonitorPlay,
  Play,
  RefreshCw,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wifi
} from 'lucide-react';
import {
  getN2nLastConfig,
  launchProfile,
  readServerSession,
  recommendPlans,
  scanGames,
  startGameServerSession,
  testConnectivity
} from '../api/tauri';
import type { GameSummary } from '../types/game';
import type { NetworkConfig } from '../types/network';
import type { Recommendation } from '../types/recommendation';
import type { ServerSessionStatus } from '../types/serverSession';
import {
  listReferenceFriendAllocationsBackendFirst,
  removeReferenceFriendAllocationBackendFirst,
  selectReferenceFriendAllocationBackendFirst,
  updateReferenceFriendCheckBackendFirst,
  upsertReferenceFriendAllocationBackendFirst,
  type ReferenceFriendAllocation
} from '../reference-adapter/friendAllocations';
import { getReferenceSelectedGame, setReferenceSelectedGame, type ReferenceSelectedGame } from '../reference-adapter/selectedGame';
import { refreshReferenceRuntime, startReferenceN2n } from '../reference-adapter/actions';
import {
  buildLanInvitePacket,
  formatLanInviteMissingFields,
  validateLanInvitePacket,
  type LanInvitePacket
} from './invitePacket';
import { productStatusDotClasses, productStatusToneClasses, resolveProductStatusCenter } from './statusCenter';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';
import {
  buildAdapterRecommendationRoute,
  buildNonLanRouteInvite,
  type AdapterRecommendationRoute,
} from './adapterRecommendationRoute';
import { buildAdapterQualityScore } from './adapterQualityScore';
import {
  buildConnectionMethodGuide,
  methodsForAdapterRoute,
  type ConnectionMethodEntry,
} from './connectionMethodCatalog';
import {
  buildRemoteCoopFriendGuide,
  buildRemoteCoopLatencyTips,
  buildRemoteCoopSteps,
  checklistProgress,
  remoteCoopModeLabel,
  remoteCoopQualityPresets,
  type RemoteCoopChecklist,
  type RemoteCoopMode,
  type RemoteCoopQualityPreset,
} from './remoteCoopGuide';
import {
  buildGameConversionAssessment,
  buildGameConversionAssessmentReport,
} from './conversionAssessmentEngine';
import { writeAdapterCreationIntent } from './adapterCreationIntent';
import { writeAdvancedToolIntent } from './advancedToolIntent';
import {
  buildHostRoomClosureAudit,
  formatHostRoomClosureAuditReport,
} from './hostRoomClosureAudit';
import {
  buildHostDiagnosticContext,
  clearHostDiagnosticContext,
  formatHostDiagnosticContext,
  readHostDiagnosticContext,
  writeHostDiagnosticContext,
  type HostDiagnosticContext,
  type HostDiagnosticContextSource,
  type HostDiagnosticNextActionKind,
} from './hostDiagnosticContext';
import { readProductPageCache, writeProductPageCache } from './productPageCache';

import { ProductBusyOverlay } from './ProductBusyOverlay';

interface ProductRecommendationViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

const RECOMMENDATION_CACHE_KEY = 'lan-helper.product.recommendation.cache.v1';

interface RecommendationPageCache {
  games: GameSummary[];
  selectedGame: ReferenceSelectedGame | null;
  recommendations: Recommendation[];
  n2nConfig: NetworkConfig | null;
  server: ServerSessionStatus | null;
  friends: ReferenceFriendAllocation[];
  port: string;
  lastCheck: string;
  hostPortCheck: string;
}

function selectedFriendOf(friends: ReferenceFriendAllocation[]) {
  return friends.find((item) => item.status === 'selected') ?? friends[0] ?? null;
}

function defaultPort(game: GameSummary | null) {
  return game?.connection_plan?.default_join_port ?? 7777;
}

type HostStepState = 'done' | 'active' | 'pending' | 'warning';

interface HostWizardStep {
  id: string;
  title: string;
  detail: string;
  state: HostStepState;
  actionLabel: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
}

function stepTone(state: HostStepState) {
  if (state === 'done') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (state === 'active') return 'border-amber-100 bg-amber-50 text-amber-700';
  if (state === 'warning') return 'border-rose-100 bg-rose-50 text-rose-700';
  return 'border-slate-100 bg-slate-50 text-slate-500';
}

function conversionToneClasses(tone: string) {
  if (tone === 'good') return 'border-emerald-100 bg-emerald-50/80 text-emerald-800';
  if (tone === 'warn') return 'border-violet-100 bg-violet-50/80 text-violet-800';
  if (tone === 'blocked') return 'border-rose-100 bg-rose-50/80 text-rose-800';
  return 'border-amber-100 bg-amber-50/80 text-amber-800';
}

function conversionBadgeClasses(tone: string) {
  if (tone === 'good') return 'bg-emerald-100 text-emerald-700';
  if (tone === 'warn') return 'bg-violet-100 text-violet-700';
  if (tone === 'blocked') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
}

export function ProductRecommendationView({ onTriggerToast, onNavigateTab }: ProductRecommendationViewProps) {
  const runtime = useReferenceRuntime();
  const initialCache = useMemo(() => readProductPageCache<RecommendationPageCache>(RECOMMENDATION_CACHE_KEY), []);
  const [games, setGames] = useState<GameSummary[]>(() => initialCache?.data.games ?? []);
  const [selectedGame, setSelectedGameState] = useState<ReferenceSelectedGame | null>(() => getReferenceSelectedGame() ?? initialCache?.data.selectedGame ?? null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(() => initialCache?.data.recommendations ?? []);
  const [n2nConfig, setN2nConfig] = useState<NetworkConfig | null>(() => initialCache?.data.n2nConfig ?? null);
  const [server, setServer] = useState<ServerSessionStatus | null>(() => initialCache?.data.server ?? null);
  const [friends, setFriends] = useState<ReferenceFriendAllocation[]>(() => initialCache?.data.friends ?? []);
  const [friendName, setFriendName] = useState('');
  const [friendIp, setFriendIp] = useState('10.0.8.2');
  const [port, setPort] = useState(() => initialCache?.data.port || '7777');
  const [busy, setBusy] = useState('');
  const [lastCheck, setLastCheck] = useState(() => initialCache?.data.lastCheck || '');
  const [hostPortCheck, setHostPortCheck] = useState(() => initialCache?.data.hostPortCheck || '');
  const [remoteCoopMode, setRemoteCoopMode] = useState<RemoteCoopMode>('steam_remote_play');
  const [remoteCoopPreset, setRemoteCoopPreset] = useState<RemoteCoopQualityPreset>('balanced');
  const [remoteCoopChecklist, setRemoteCoopChecklist] = useState<RemoteCoopChecklist>({
    gameLaunched: false,
    localCoopMode: false,
    friendInvited: false,
    inputEnabled: false
  });
  const [hostDiagnosticContext, setHostDiagnosticContext] = useState<HostDiagnosticContext | null>(() => readHostDiagnosticContext());

  const currentGame = useMemo(() => {
    if (selectedGame) return games.find((game) => game.game_id === selectedGame.game_id) ?? null;
    return games[0] ?? null;
  }, [games, selectedGame]);
  const adapterRoute = useMemo(() => buildAdapterRecommendationRoute(currentGame), [currentGame]);
  const conversionAssessment = useMemo(
    () => buildGameConversionAssessment(currentGame, adapterRoute),
    [adapterRoute, currentGame],
  );
  const qualityScore = useMemo(() => buildAdapterQualityScore(currentGame), [currentGame]);
  const routeMethods = useMemo(() => methodsForAdapterRoute(adapterRoute), [adapterRoute]);
  const remoteCoop = adapterRoute.kind === 'remote_coop';
  const usesSteamOnlyFlow = adapterRoute.kind === 'steam_p2p';
  const routeNeedsReview = adapterRoute.kind === 'needs_review';
  const routeOfficialOnly = adapterRoute.kind === 'official_only';
  const routeUsesLanInvite = adapterRoute.canCreateLanInvite;
  const shouldReviewQuality = qualityScore.level === 'low';
  const selectedFriend = selectedFriendOf(friends);
  const status = resolveProductStatusCenter({
    loaded: runtime.loaded,
    snapshot: runtime.snapshot,
    network: runtime.network,
    errors: runtime.errors,
    n2nConfig,
    server,
    requiresServer: routeUsesLanInvite && adapterRoute.requiresDedicatedServer,
    hasFriendSlot: !routeUsesLanInvite || Boolean(selectedFriend),
    busy
  });
  const lanInvitePacket: LanInvitePacket = {
    gameName: currentGame?.display_name || selectedGame?.display_name || '未选择',
    gameId: currentGame?.game_id || selectedGame?.game_id || '未选择',
    hostVirtualIp: n2nConfig?.local_ip || runtime.network.virtualIp || '',
    friendVirtualIp: selectedFriend?.ip,
    friendName: selectedFriend?.name,
    supernode: n2nConfig?.supernode,
    roomName: n2nConfig?.room_name,
    roomKey: n2nConfig?.secret,
    gamePort: Number(port) || defaultPort(currentGame),
    serverRunning: Boolean(server?.running),
    friendCheck: selectedFriend?.last_check_summary
  };
  const lanInviteValidation = validateLanInvitePacket(lanInvitePacket);
  const hostPortReady = hostPortCheck.includes('已监听');
  const lanInviteReady = routeUsesLanInvite && status.canInvite && lanInviteValidation.ok && hostPortReady;
  const lanInviteBlockers = routeUsesLanInvite
    ? Array.from(new Set([
        !status.canInvite ? (status.nextAction || status.detail || '先完成组网、服务端和好友 IP 分配。') : '',
        !lanInviteValidation.ok ? `邀请包缺少：${formatLanInviteMissingFields(lanInviteValidation.missing)}。` : '',
        !hostPortReady ? `先检测本机 ${Number(port) || defaultPort(currentGame)} 端口，确认游戏或服务端正在监听。` : '',
      ].filter(Boolean)))
    : [];
  const lanInviteBlockerText = lanInviteBlockers.join(' ');
  const lanInvite = buildLanInvitePacket({
    gameName: lanInvitePacket.gameName,
    gameId: lanInvitePacket.gameId,
    n2n: n2nConfig,
    hostVirtualIp: lanInvitePacket.hostVirtualIp,
    friendVirtualIp: lanInvitePacket.friendVirtualIp,
    friendName: lanInvitePacket.friendName,
    port: lanInvitePacket.gamePort || defaultPort(currentGame),
    serverRunning: lanInvitePacket.serverRunning,
    friendCheck: lanInvitePacket.friendCheck
  });
  const lanInvitePreview = lanInviteReady
    ? lanInvite
    : [
        '邀请包暂未生成完整正文',
        '',
        '为了避免好友复制半成品后加入失败，当前不会展示正式邀请包正文。',
        '请先补齐下面缺项；全部完成后，这里才会显示可复制的完整邀请包。',
        '',
        '待完成：',
        ...(lanInviteBlockers.length ? lanInviteBlockers.map((item) => `- ${item}`) : ['- 完成组网、端口检测和好友 IP 分配。']),
        '',
        `当前游戏：${lanInvitePacket.gameName}`,
        `房主虚拟 IP：${lanInvitePacket.hostVirtualIp || '未读取'}`,
        `好友预留 IP：${lanInvitePacket.friendVirtualIp || '未分配'}`,
        `游戏端口：${lanInvitePacket.gamePort || '未填写'}`,
      ].join('\n');
  const remoteCoopInvite = buildRemoteCoopFriendGuide({
    game: currentGame,
    mode: remoteCoopMode,
    preset: remoteCoopPreset,
    checklist: remoteCoopChecklist
  });
  const nonLanInvite = buildNonLanRouteInvite(adapterRoute, currentGame);
  const invite = remoteCoop ? remoteCoopInvite : routeUsesLanInvite ? lanInvite : nonLanInvite;
  const invitePreview = remoteCoop ? remoteCoopInvite : routeUsesLanInvite ? lanInvitePreview : nonLanInvite;
  const remoteCoopSteps = useMemo(() => buildRemoteCoopSteps(remoteCoopMode), [remoteCoopMode]);
  const remoteCoopLatencyTips = useMemo(() => buildRemoteCoopLatencyTips(remoteCoopPreset), [remoteCoopPreset]);
  const remoteCoopReady = checklistProgress(remoteCoopChecklist);
  const displayedStatus = routeUsesLanInvite ? status : {
    tone: routeOfficialOnly || routeNeedsReview ? 'warn' as const : 'good' as const,
    label: adapterRoute.title,
    detail: adapterRoute.summary,
    nextAction: routeNeedsReview ? '去方案库确认' : adapterRoute.inviteLabel,
    canInvite: !routeNeedsReview,
    needsNetwork: false,
    needsServer: false
  };

  const saveRecommendationCache = (patch: Partial<RecommendationPageCache> = {}) => {
    writeProductPageCache<RecommendationPageCache>(RECOMMENDATION_CACHE_KEY, {
      games,
      selectedGame,
      recommendations,
      n2nConfig,
      server,
      friends,
      port,
      lastCheck,
      hostPortCheck,
      ...patch,
    });
  };

  const load = async (label = '刷新推荐方案', options: { showBusy?: boolean; silent?: boolean } = {}) => {
    const showBusy = options.showBusy ?? true;
    if (showBusy) setBusy(label);
    try {
      const [nextGames, nextN2n, nextServer, nextFriends] = await Promise.all([
        scanGames().catch(() => []),
        getN2nLastConfig().catch(() => null),
        readServerSession().catch(() => null),
        listReferenceFriendAllocationsBackendFirst()
      ]);
      setGames(nextGames);
      setN2nConfig(nextN2n);
      setServer(nextServer);
      setFriends(nextFriends);
      const selected = getReferenceSelectedGame();
      const target = selected?.game_id || nextGames[0]?.game_id;
      const nextSelectedGame = selected ?? (nextGames[0] ? setReferenceSelectedGame(nextGames[0]) : null);
      setSelectedGameState(nextSelectedGame);
      const game = nextGames.find((item) => item.game_id === target) ?? nextGames[0] ?? null;
      const nextPort = game?.connection_plan?.default_join_port ? String(game.connection_plan.default_join_port) : port;
      if (game?.connection_plan?.default_join_port) setPort(nextPort);
      const nextRecommendations = game ? await recommendPlans(game.game_id).catch(() => []) : [];
      setRecommendations(nextRecommendations);
      saveRecommendationCache({
        games: nextGames,
        selectedGame: nextSelectedGame,
        recommendations: nextRecommendations,
        n2nConfig: nextN2n,
        server: nextServer,
        friends: nextFriends,
        port: nextPort,
      });
      await refreshReferenceRuntime(false).catch(() => undefined);
    } catch (error) {
      if (!options.silent) onTriggerToast(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (showBusy) setBusy('');
    }
  };

  useEffect(() => {
    if (initialCache?.data.games?.length) {
      load('后台刷新推荐方案', { showBusy: false, silent: true });
      return;
    }
    load('首次读取推荐方案');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseGame = async (gameId: string) => {
    const game = games.find((item) => item.game_id === gameId);
    if (!game) return;
    const selected = setReferenceSelectedGame(game);
    setSelectedGameState(selected);
    if (game.connection_plan?.default_join_port) setPort(String(game.connection_plan.default_join_port));
    setBusy('读取推荐方案');
    try {
      const nextRecommendations = await recommendPlans(game.game_id);
      setRecommendations(nextRecommendations);
      saveRecommendationCache({
        selectedGame: selected,
        recommendations: nextRecommendations,
        port: game.connection_plan?.default_join_port ? String(game.connection_plan.default_join_port) : port,
      });
      onTriggerToast(`已切换推荐目标：${game.display_name}`);
    } catch (error) {
      onTriggerToast(`读取推荐失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const addFriend = async () => {
    setBusy('分配好友 IP');
    try {
      const friend = await upsertReferenceFriendAllocationBackendFirst(friendName, friendIp);
      const nextFriends = await listReferenceFriendAllocationsBackendFirst();
      setFriends(nextFriends);
      saveRecommendationCache({ friends: nextFriends });
      onTriggerToast(`已分配好友席位：${friend.name} (${friend.ip})`);
    } catch (error) {
      onTriggerToast(`分配失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const selectFriend = async (friend: ReferenceFriendAllocation) => {
    await selectReferenceFriendAllocationBackendFirst(friend.name, friend.ip);
    const nextFriends = await listReferenceFriendAllocationsBackendFirst();
    setFriends(nextFriends);
    saveRecommendationCache({ friends: nextFriends });
    onTriggerToast(`当前邀请对象：${friend.name} (${friend.ip})`);
  };

  const removeFriend = async (friend: ReferenceFriendAllocation) => {
    await removeReferenceFriendAllocationBackendFirst(friend.name, friend.ip);
    const nextFriends = await listReferenceFriendAllocationsBackendFirst();
    setFriends(nextFriends);
    saveRecommendationCache({ friends: nextFriends });
    onTriggerToast(`已回收 ${friend.name} 的虚拟 IP。`);
  };

  const testFriend = async () => {
    if (!selectedFriend) {
      onTriggerToast('请先分配或选择好友席位。');
      return;
    }
    setBusy('检测好友连接');
    try {
      const targetPort = Number(port) || defaultPort(currentGame);
      const report = await testConnectivity({ host: selectedFriend.ip, ports: [targetPort], timeout_ms: 1200, mode: 'n2n_game_port' });
      const summary = `${selectedFriend.ip}:${targetPort} ${report.reachable ? '可连接' : '不可连接'}${report.notes.length ? `｜${report.notes.join('；')}` : ''}`;
      setLastCheck(summary);
      await updateReferenceFriendCheckBackendFirst(selectedFriend.ip, summary);
      const nextFriends = await listReferenceFriendAllocationsBackendFirst();
      setFriends(nextFriends);
      saveRecommendationCache({ friends: nextFriends, lastCheck: summary });
      if (!report.reachable) {
        writeHostFailureContext({
          source: 'host_friend_check_failure',
          reasonKind: 'friend_virtual_ip_unreachable',
          hostPortCheckOverride: hostPortCheck,
          friendCheckOverride: summary,
          nextActionKind: 'diagnostics',
          detail: `好友虚拟 IP ${selectedFriend.ip}:${targetPort} 暂不可连接，需要确认双方 n2n 状态、好友是否已加入邀请包、游戏端口是否监听。`,
        });
      }
      onTriggerToast(`好友连接检测完成：${summary}`);
    } catch (error) {
      writeHostFailureContext({
        source: 'host_friend_check_failure',
        reasonKind: 'friend_connectivity_test_error',
        error: error instanceof Error ? error.message : String(error),
        nextActionKind: 'diagnostics',
      });
      onTriggerToast(`检测失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copyInvite = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(invite);
      onTriggerToast(remoteCoop ? '远程同屏说明已复制。' : routeUsesLanInvite ? '真实 LAN 邀请包已复制。' : '联机路线说明已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyConnectionMethodGuide = async (method: ConnectionMethodEntry) => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(buildConnectionMethodGuide(method));
      onTriggerToast(`已复制${method.title}说明。`);
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyConversionAssessment = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(buildGameConversionAssessmentReport(conversionAssessment));
      onTriggerToast('非局域网转换评估已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openSolutionsWithConversionAssessment = () => {
    const assessmentReport = buildGameConversionAssessmentReport(conversionAssessment);
    writeAdapterCreationIntent({
      source: 'recommendation',
      reason: 'conversion_assessment',
      game_id: currentGame?.game_id || selectedGame?.game_id,
      display_name: currentGame?.display_name || selectedGame?.display_name,
      steam_appid: currentGame?.steam_appid,
      detected_path: currentGame?.detected_path,
      network_type: currentGame?.network_type || 'unknown_need_review',
      route_kind: conversionAssessment.routeKind,
      conversion_verdict: conversionAssessment.verdict,
      game_type: conversionAssessment.gameType,
      original_capability: conversionAssessment.originalCapability,
      recommended_plan: conversionAssessment.recommendedPlan,
      can_become_lan: conversionAssessment.canBecomeLan,
      default_port: currentGame?.connection_plan?.default_join_port || defaultPort(currentGame),
      admin_evidence: conversionAssessment.adminEvidence,
      user_steps: conversionAssessment.userSteps,
      boundaries: conversionAssessment.boundaries,
      adapter_signals: conversionAssessment.adapterSignals,
      assessment_report: assessmentReport,
      note: conversionAssessment.userConclusion,
    });
    onNavigateTab('solutions');
    onTriggerToast('已带着转换评估进入方案库，可直接预填贡献入口或管理员编辑器。');
  };

  const currentGamePort = () => Number(port) || defaultPort(currentGame);

  const writeHostFailureContext = (input: {
    source: HostDiagnosticContextSource;
    reasonKind: string;
    title?: string;
    detail?: string;
    nextAction?: string;
    nextActionKind?: HostDiagnosticNextActionKind;
    error?: string;
    hostPortCheckOverride?: string;
    friendCheckOverride?: string;
  }) => {
    const context = buildHostDiagnosticContext({
      source: input.source,
      reasonKind: input.reasonKind,
      title: input.title,
      detail: input.detail,
      nextAction: input.nextAction,
      nextActionKind: input.nextActionKind,
      error: input.error,
      game: currentGame,
      adapterRoute,
      routeUsesLanInvite,
      n2nConfig,
      runtime: {
        network: runtime.network,
        errors: runtime.errors,
      },
      server,
      selectedFriend,
      gamePort: currentGamePort(),
      hostPortCheck: input.hostPortCheckOverride ?? hostPortCheck,
      friendCheck: input.friendCheckOverride ?? lastCheck,
    });
    writeHostDiagnosticContext(context);
    setHostDiagnosticContext(context);
    return context;
  };

  type AdvancedToolKind = NonNullable<ConnectionMethodEntry['advancedToolKind']>;

  const openAdvancedToolsForHost = (
    reason: HostDiagnosticContextSource = 'host_advanced_tools_needed',
    preferredKind?: AdvancedToolKind
  ) => {
    const targetPort = currentGamePort();
    const toolKind = preferredKind || (adapterRoute.requiresUdpBroadcastBridge ? 'bridge' : 'tcp');
    const useBridge = toolKind === 'bridge';
    const useUdpProxy = toolKind === 'udp';
    const targetHost = selectedFriend?.ip
      || (currentGame?.connection_plan?.default_join_host && currentGame.connection_plan.default_join_host !== 'host virtual ip'
        ? currentGame.connection_plan.default_join_host
        : '10.0.8.2');
    writeAdvancedToolIntent({
      source: 'recommendation',
      reason: useBridge ? 'udp_broadcast_bridge' : 'port_proxy',
      kind: toolKind,
      game_id: currentGame?.game_id,
      display_name: currentGame?.display_name,
      listen_port: targetPort,
      target_host: targetHost,
      target_port: targetPort,
      note: `${adapterRoute.title}：${adapterRoute.summary}`,
      evidence: [
        `路线：${adapterRoute.kind}`,
        `端口：${targetPort}`,
        `房主虚拟 IP：${runtime.network.virtualIp || n2nConfig?.local_ip || '未读取'}`,
        selectedFriend ? `好友虚拟 IP：${selectedFriend.ip}` : '尚未选择好友虚拟 IP',
        hostPortCheck || '房主端口尚未检测',
      ],
    });
    writeHostFailureContext({
      source: reason,
      reasonKind: useBridge ? 'udp_broadcast_bridge_required' : useUdpProxy ? 'udp_port_proxy_required' : 'tcp_port_proxy_required',
      nextActionKind: 'advanced_tools',
      title: useBridge ? '当前开房路线需要 UDP 广播桥' : useUdpProxy ? '当前开房路线需要 UDP 代理' : '当前开房路线需要 TCP 端口代理',
      detail: `${adapterRoute.title} 不能只靠普通 n2n 按钮完成，已准备${useBridge ? 'UDP 广播桥' : useUdpProxy ? 'UDP 代理' : 'TCP 端口代理'}预填参数。`,
    });
    onNavigateTab('advanced_tools');
    onTriggerToast(`已带着当前游戏、端口和好友虚拟 IP 进入${useBridge ? 'UDP 广播桥' : useUdpProxy ? 'UDP 代理' : 'TCP 端口代理'}。`);
  };

  const openConnectionMethod = (method: ConnectionMethodEntry) => {
    if (method.advancedToolKind) {
      openAdvancedToolsForHost('host_advanced_tools_needed', method.advancedToolKind);
      return;
    }
    if (method.id === 'n2n') {
      onNavigateTab('network');
      return;
    }
    copyConnectionMethodGuide(method);
  };

  const toggleRemoteCoopCheck = (key: keyof RemoteCoopChecklist) => {
    setRemoteCoopChecklist((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const launch = async () => {
    const gameId = currentGame?.game_id || selectedGame?.game_id;
    if (!gameId) {
      onTriggerToast('没有可启动的推荐目标。');
      return;
    }
    const preferred = recommendations.find((item) => item.level === 'recommended' && item.launch_profile_id)
      ?? recommendations.find((item) => item.launch_profile_id);
    setBusy('启动推荐启动项');
    try {
      const result = await launchProfile(gameId, preferred?.launch_profile_id || 'client', { port: Number(port) || defaultPort(currentGame) });
      onTriggerToast(result.ok ? result.message : `启动失败：${result.message}`);
    } catch (error) {
      onTriggerToast(`启动失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const startHostNetwork = async () => {
    if (!n2nConfig?.room_name || !n2nConfig?.secret || !n2nConfig?.supernode) {
      writeHostFailureContext({
        source: 'host_config_missing',
        reasonKind: 'n2n_config_missing',
        nextActionKind: 'network',
      });
      onTriggerToast('请先在通用组网中心保存房间名、密钥和 Supernode。');
      onNavigateTab('network');
      return;
    }
    setBusy('启动房主组网');
    try {
      const result = await startReferenceN2n(n2nConfig);
      if (!result.ok) throw new Error(result.message);
      await refreshReferenceRuntime(false);
      await load('刷新房主向导');
      onTriggerToast('房主组网已启动，等待 ACK/PONG 后即可继续。');
    } catch (error) {
      writeHostFailureContext({
        source: 'host_network_failure',
        reasonKind: 'start_n2n_failed',
        error: error instanceof Error ? error.message : String(error),
        nextActionKind: 'diagnostics',
      });
      onTriggerToast(`启动组网失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const testHostGamePort = async () => {
    setBusy('检测房主端口');
    try {
      const targetPort = Number(port) || defaultPort(currentGame);
      const report = await testConnectivity({ host: '127.0.0.1', ports: [targetPort], timeout_ms: 1200, mode: 'local_game_port' });
      const summary = `本机 127.0.0.1:${targetPort} ${report.reachable ? '已监听' : '未监听'}${report.notes.length ? `｜${report.notes.join('；')}` : ''}`;
      setHostPortCheck(summary);
      saveRecommendationCache({ hostPortCheck: summary });
      if (!report.reachable) {
        writeHostFailureContext({
          source: 'host_port_failure',
          reasonKind: 'local_game_port_not_listening',
          hostPortCheckOverride: summary,
          nextActionKind: adapterRoute.requiresTcpPortProxy || adapterRoute.requiresUdpBroadcastBridge ? 'advanced_tools' : 'diagnostics',
          detail: `本机 127.0.0.1:${targetPort} 未监听；需要先确认服务端/游戏房间已启动，再判断是否需要端口代理或 UDP 广播桥。`,
        });
      }
      onTriggerToast(`房主端口检测完成：${summary}`);
      return report.reachable;
    } catch (error) {
      const message = `检测失败：${error instanceof Error ? error.message : String(error)}`;
      setHostPortCheck(message);
      saveRecommendationCache({ hostPortCheck: message });
      writeHostFailureContext({
        source: 'host_port_failure',
        reasonKind: 'local_game_port_test_error',
        error: error instanceof Error ? error.message : String(error),
        hostPortCheckOverride: message,
        nextActionKind: 'diagnostics',
      });
      onTriggerToast(message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const launchHostEntity = async () => {
    const gameId = currentGame?.game_id || selectedGame?.game_id;
    if (!gameId) {
      onTriggerToast('请先选择要开房的游戏。');
      return;
    }
    const targetPort = Number(port) || defaultPort(currentGame);
    setBusy(adapterRoute.requiresDedicatedServer ? '启动房主服务端' : '启动房主游戏');
    try {
      if (remoteCoop) {
        const result = await launchProfile(gameId, 'client', {});
        if (!result.ok) {
          writeHostFailureContext({
            source: 'host_server_failure',
            reasonKind: 'remote_coop_launch_failed',
            error: result.message,
            nextActionKind: 'diagnostics',
          });
        }
        onTriggerToast(result.ok ? `${result.message}；请在游戏内进入本地双人模式后发起 Remote Play。` : `启动失败：${result.message}`);
        await load('刷新房主向导');
        return;
      }
      if (adapterRoute.requiresDedicatedServer) {
        const nextServer = await startGameServerSession(gameId, 'server', { port: targetPort });
        setServer(nextServer);
        saveRecommendationCache({ server: nextServer });
        if (!nextServer.running) {
          writeHostFailureContext({
            source: 'host_server_failure',
            reasonKind: 'dedicated_server_not_running',
            error: nextServer.message,
            nextActionKind: 'diagnostics',
            detail: `服务端启动后未保持运行：${nextServer.message || '无详细信息'}。需要查看服务端日志、端口和启动参数。`,
          });
        }
        onTriggerToast(nextServer.running ? '房主服务端已启动。' : `服务端启动返回：${nextServer.message}`);
      } else {
        const preferred = recommendations.find((item) => item.level === 'recommended' && item.launch_profile_id)
          ?? recommendations.find((item) => item.launch_profile_id);
        const result = await launchProfile(gameId, preferred?.launch_profile_id || 'client', { port: targetPort });
        if (!result.ok) {
          writeHostFailureContext({
            source: 'host_server_failure',
            reasonKind: 'host_game_launch_failed',
            error: result.message,
            nextActionKind: 'diagnostics',
          });
        }
        onTriggerToast(result.ok ? result.message : `启动失败：${result.message}`);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      await testHostGamePort();
      await load('刷新房主向导');
    } catch (error) {
      writeHostFailureContext({
        source: 'host_server_failure',
        reasonKind: 'launch_host_entity_error',
        error: error instanceof Error ? error.message : String(error),
        nextActionKind: 'diagnostics',
      });
      onTriggerToast(`启动失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const ensureFriendSlot = async () => {
    if (selectedFriend) {
      onTriggerToast(`已选择好友席位：${selectedFriend.name} (${selectedFriend.ip})`);
      return;
    }
    setBusy('分配好友席位');
    try {
      const friend = await upsertReferenceFriendAllocationBackendFirst(friendName || '好友1', friendIp || '10.0.8.2');
      await selectReferenceFriendAllocationBackendFirst(friend.name, friend.ip);
      setFriends(await listReferenceFriendAllocationsBackendFirst());
      onTriggerToast(`已分配并选择好友席位：${friend.name} (${friend.ip})`);
    } catch (error) {
      onTriggerToast(`分配好友席位失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copyHostInvite = async () => {
    if (!routeUsesLanInvite) {
      await copyInvite();
      return;
    }
    if (!selectedFriend) {
      await ensureFriendSlot();
      return;
    }
    if (!status.canInvite) {
      onTriggerToast(status.nextAction || '请先完成组网、服务端和好友 IP 分配。');
      return;
    }
    if (!lanInviteValidation.ok) {
      onTriggerToast(`邀请包不完整：${formatLanInviteMissingFields(lanInviteValidation.missing)}。请先补齐后再复制。`);
      return;
    }
    if (!hostPortReady) {
      const reachable = await testHostGamePort();
      if (!reachable) {
        onTriggerToast('本机游戏端口还未监听，暂不复制半成品邀请包。');
        return;
      }
    }
    await copyInvite();
  };

  const selectGameStep = (detailPrefix: string): HostWizardStep => ({
    id: 'select-game',
    title: '选择游戏',
    detail: currentGame ? `${detailPrefix}：${currentGame.display_name}` : '先扫描或选择要处理的游戏。',
    state: currentGame ? 'done' : 'active',
    actionLabel: currentGame ? '切换游戏' : '去扫描游戏',
    action: () => onNavigateTab('games')
  });

  const remoteHostSteps: HostWizardStep[] = [
    selectGameStep('当前远程同屏目标'),
    {
      id: 'launch-local',
      title: '启动游戏',
      detail: '房主启动游戏，进入本地双人/同屏合作模式。',
      state: currentGame ? 'active' : 'pending',
      actionLabel: '启动游戏',
      action: launchHostEntity,
      disabled: Boolean(busy) || !currentGame
    },
    {
      id: 'steam-remote-play',
      title: 'Steam Remote Play',
      detail: 'Steam 版本优先用好友列表邀请 Remote Play Together，并确认输入权限。',
      state: 'active',
      actionLabel: '复制邀请说明',
      action: copyInvite
    },
    {
      id: 'sunshine',
      title: 'Sunshine + Moonlight',
      detail: '非 Steam 版本或 Remote Play 不稳定时，用 Sunshine/Moonlight 串流。',
      state: 'pending',
      actionLabel: '打开说明',
      action: copyInvite
    },
    {
      id: 'share',
      title: '发给好友',
      detail: '远程同屏说明已根据当前游戏自动生成，可直接发给好友。',
      state: 'done',
      actionLabel: '一键复制',
      action: copyInvite
    }
  ];

  const steamHostSteps: HostWizardStep[] = [
    selectGameStep('当前 Steam 路线目标'),
    {
      id: 'steam-room',
      title: '创建 Steam 房间',
      detail: '按游戏原生 Steam 大厅、好友邀请或 P2P 流程创建房间。',
      state: currentGame ? 'active' : 'pending',
      actionLabel: '启动游戏',
      action: launchHostEntity,
      disabled: Boolean(busy) || !currentGame
    },
    {
      id: 'steam-relay',
      title: '保留 Relay/插件入口',
      detail: '如果该游戏后续支持 Steam Relay/P2P 插件，可在高级方案中扩展，不默认使用 n2n。',
      state: 'pending',
      actionLabel: '复制说明',
      action: copyInvite
    },
    {
      id: 'share',
      title: '发给好友',
      detail: '把 Steam 路线说明发给好友，避免好友误去连接虚拟 IP。',
      state: 'done',
      actionLabel: '一键复制',
      action: copyInvite
    }
  ];

  const reviewHostSteps: HostWizardStep[] = [
    selectGameStep(routeOfficialOnly ? '当前受限目标' : '当前待确认目标'),
    {
      id: 'adapter-review',
      title: routeOfficialOnly ? '查看限制原因' : '确认游戏类型',
      detail: routeOfficialOnly ? '该 adapter 不建议强转 LAN，优先保留官方入口。' : '先确认游戏属于 LAN、服务端、广播发现、同屏远程、Steam P2P 或官方服限定。',
      state: 'active',
      actionLabel: '去方案库',
      action: () => onNavigateTab('solutions')
    },
    {
      id: 'diagnostic',
      title: '生成诊断证据',
      detail: '需要时生成诊断报告，把缺少 adapter、端口或服务端证据交给管理员。',
      state: 'pending',
      actionLabel: '打开诊断',
      action: () => onNavigateTab('diagnostics')
    },
    {
      id: 'share',
      title: '复制说明',
      detail: routeOfficialOnly ? '复制官方路线/不支持转换说明。' : '复制待确认说明，避免用户误以为 n2n 一定可用。',
      state: 'pending',
      actionLabel: '复制说明',
      action: copyInvite
    }
  ];

  const advancedStep: HostWizardStep | null = adapterRoute.requiresTcpPortProxy || adapterRoute.requiresUdpBroadcastBridge ? {
    id: 'advanced-tools',
    title: adapterRoute.requiresUdpBroadcastBridge ? '配置 UDP 广播桥' : '配置端口代理',
    detail: adapterRoute.requiresUdpBroadcastBridge
      ? '该 adapter 需要 UDP 广播桥补齐局域网大厅发现；进入高级连接工具配置游戏 UDP 端口。'
      : '该 adapter 需要端口代理；进入高级连接工具把游戏监听端口暴露给虚拟网。',
    state: runtime.network.ready ? 'active' : 'pending',
    actionLabel: '打开高级工具',
    action: () => openAdvancedToolsForHost('host_advanced_tools_needed', adapterRoute.requiresUdpBroadcastBridge ? 'bridge' : 'tcp'),
    disabled: Boolean(busy)
  } : null;

  const lanHostSteps: HostWizardStep[] = [
    selectGameStep('当前开房目标'),
    {
      id: 'network',
      title: '启动组网',
      detail: runtime.network.ready ? `n2n 已连接：${runtime.network.virtualIp || n2nConfig?.local_ip || '已读取虚拟 IP'}` : status.detail,
      state: runtime.network.ready ? 'done' : runtime.network.running ? 'active' : n2nConfig?.supernode ? 'active' : 'warning',
      actionLabel: runtime.network.ready ? '刷新状态' : n2nConfig?.supernode ? '启动 n2n' : '配置组网',
      action: runtime.network.ready ? () => load('刷新房主向导') : n2nConfig?.supernode ? startHostNetwork : () => onNavigateTab('network'),
      disabled: Boolean(busy)
    },
    {
      id: 'host-entity',
      title: adapterRoute.requiresDedicatedServer ? '启动服务端' : '启动游戏',
      detail: adapterRoute.requiresDedicatedServer
        ? (server?.running ? `服务端运行中：${server.message || '已启动'}` : '当前 adapter 要求房主启动专用服务端，启动后再复制邀请。')
        : (hostPortCheck || '启动游戏后检测本机端口，确认好友可连接的目标端口。'),
      state: adapterRoute.requiresDedicatedServer
        ? (server?.running ? 'done' : runtime.network.ready ? 'active' : 'pending')
        : (hostPortCheck.includes('已监听') ? 'done' : runtime.network.ready ? 'active' : 'pending'),
      actionLabel: adapterRoute.requiresDedicatedServer
        ? (server?.running ? '检测端口' : '启动服务端')
        : (hostPortCheck.includes('已监听') ? '重新检测端口' : '启动并检测'),
      action: adapterRoute.requiresDedicatedServer && server?.running ? async () => { await testHostGamePort(); } : launchHostEntity,
      disabled: Boolean(busy) || !currentGame
    },
    ...(advancedStep ? [advancedStep] : []),
    {
      id: 'friend',
      title: '分配好友 IP',
      detail: selectedFriend ? `当前邀请对象：${selectedFriend.name} (${selectedFriend.ip})` : '给好友预留一个虚拟 IP，避免多人冲突。',
      state: selectedFriend ? 'done' : runtime.network.ready ? 'active' : 'pending',
      actionLabel: selectedFriend ? '更换好友' : '分配好友 IP',
      action: selectedFriend ? () => onTriggerToast('可在右侧好友 IP 分配区域选择或回收好友席位。') : ensureFriendSlot,
      disabled: Boolean(busy)
    },
    {
      id: 'invite',
      title: '生成邀请包',
      detail: lanInviteReady
        ? `完整邀请包已按“${adapterRoute.title}”路线生成，可复制给好友。`
        : (lanInviteBlockerText || '完成组网、端口检测和好友 IP 分配后即可复制邀请包。'),
      state: lanInviteReady ? 'done' : status.canInvite ? 'active' : 'pending',
      actionLabel: '复制邀请包',
      action: copyHostInvite,
      disabled: Boolean(busy)
    }
  ];

  const hostSteps: HostWizardStep[] = remoteCoop
    ? remoteHostSteps
    : usesSteamOnlyFlow
      ? steamHostSteps
      : routeNeedsReview || routeOfficialOnly
        ? reviewHostSteps
        : lanHostSteps;

  const firstPendingHostStep = hostSteps.find((step) => step.state !== 'done');
  const hostClosureAuditInput = {
    currentGame,
    adapterRoute,
    hostSteps,
    runtime: {
      loaded: runtime.loaded,
      network: runtime.network,
      errors: runtime.errors,
    },
    n2nConfig,
    server,
    selectedFriend,
    hostPortCheck,
    lastCheck,
    invite,
    routeUsesLanInvite,
  };
  const hostClosureAudit = buildHostRoomClosureAudit(hostClosureAuditInput);

  const copyHostClosureAudit = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatHostRoomClosureAuditReport(hostClosureAuditInput));
      onTriggerToast('房主开房闭环自检已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openHostFailureDiagnostic = () => {
    if (!hostDiagnosticContext) {
      onNavigateTab('diagnostics');
      return;
    }
    if (hostDiagnosticContext.nextActionKind === 'advanced_tools') {
      openAdvancedToolsForHost(hostDiagnosticContext.source);
      return;
    }
    onNavigateTab(hostDiagnosticContext.nextActionKind === 'network' ? 'network' : 'diagnostics');
    onTriggerToast(hostDiagnosticContext.nextActionKind === 'network' ? '已打开通用组网中心，请补齐房主组网参数。' : '已带着房主失败上下文进入诊断报告。');
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

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="recommendation">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在刷新推荐、启动组网/服务端、检测端口或分配好友 IP；请等待真实状态返回。" />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">推荐方案与向导</h2>
          <p className="mt-1 text-sm text-slate-500">按当前游戏给出开房步骤：先做缺的，再复制给好友。</p>
        </div>
        <button onClick={() => load('手动刷新推荐方案')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          {busy || '刷新真实推荐'}
        </button>
      </header>

      <section className={`rounded-2xl border p-4 ${productStatusToneClasses(displayedStatus.tone)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${productStatusDotClasses(displayedStatus.tone)}`} />
              <h3 className="text-sm font-bold">{displayedStatus.label}</h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{displayedStatus.detail}</p>
          </div>
          <button
            onClick={() => routeNeedsReview ? openSolutionsWithConversionAssessment() : displayedStatus.needsNetwork ? onNavigateTab('network') : displayedStatus.needsServer ? onNavigateTab('terraria') : routeUsesLanInvite ? copyHostInvite() : copyInvite()}
            disabled={Boolean(busy) || (!routeNeedsReview && !displayedStatus.canInvite && !displayedStatus.needsNetwork && !displayedStatus.needsServer)}
            className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {displayedStatus.nextAction}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-adapter-quality-confidence="recommendation">
        <div className="mb-4 flex items-center gap-2">
          <MonitorPlay className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm font-bold text-slate-800">联机方式选择器</h3>
        </div>
        <div
          className={`mb-4 rounded-2xl border p-4 ${conversionToneClasses(conversionAssessment.tone)}`}
          data-non-lan-conversion-engine="assessment"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${conversionBadgeClasses(conversionAssessment.tone)}`}>
                  非 LAN 转换评估
                </span>
                <span className="rounded-full bg-white/75 px-3 py-1 text-[11px] font-bold">
                  {conversionAssessment.gameType}
                </span>
                <span className="rounded-full bg-white/75 px-3 py-1 text-[11px] font-bold">
                  {conversionAssessment.canBecomeLan ? '可生成 LAN 邀请' : '不生成 LAN 邀请'}
                </span>
              </div>
              <h4 className="text-base font-black">
                {conversionAssessment.gameName}：{conversionAssessment.userConclusion}
              </h4>
              <p className="mt-2 text-xs leading-relaxed opacity-90">
                {conversionAssessment.reason}
              </p>
              <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed">
                {conversionAssessment.exampleHint}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={openSolutionsWithConversionAssessment}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/80 bg-white/80 px-4 py-2 text-xs font-bold text-slate-800 ring-1 ring-black/5 hover:bg-white"
                data-conversion-assessment-handoff="solutions"
              >
                <Send className="h-4 w-4" />
                带评估去方案库
              </button>
              <button
                onClick={copyConversionAssessment}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-800 ring-1 ring-black/5 hover:bg-slate-50"
              >
                <ClipboardCopy className="h-4 w-4" />
                复制评估
              </button>
              <button
                onClick={() => conversionAssessment.canBecomeLan
                  ? onNavigateTab('network')
                  : conversionAssessment.routeKind === 'remote_coop'
                    ? copyInvite()
                  : conversionAssessment.routeKind === 'needs_review'
                      ? openSolutionsWithConversionAssessment()
                      : copyInvite()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                {conversionAssessment.canBecomeLan ? '去启动组网' : conversionAssessment.routeKind === 'needs_review' ? '去方案库复核' : '复制对应说明'}
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl bg-white/75 p-3">
              <p className="text-[11px] font-bold opacity-70">推荐转换方案</p>
              <p className="mt-1 text-xs leading-relaxed">{conversionAssessment.recommendedPlan}</p>
              <p className="mt-2 text-[11px] leading-relaxed opacity-75">
                主要方式：{conversionAssessment.primaryMethods.join('、') || '待人工确认'}
              </p>
            </div>
            <div className="rounded-xl bg-white/75 p-3">
              <p className="text-[11px] font-bold opacity-70">用户应该怎么做</p>
              <ul className="mt-1 space-y-1 text-[11px] leading-relaxed">
                {conversionAssessment.userSteps.slice(0, 3).map((step) => <li key={step}>• {step}</li>)}
              </ul>
            </div>
            <div className="rounded-xl bg-white/75 p-3">
              <p className="text-[11px] font-bold opacity-70">边界与证据</p>
              <p className="mt-1 text-[11px] leading-relaxed">
                {conversionAssessment.boundaries[0] || '暂无额外边界。'}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed opacity-75">
                需补证据：{conversionAssessment.adminEvidence.slice(0, 2).join('、') || '暂无'}
              </p>
            </div>
          </div>
        </div>
        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">自动套用 adapter</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">{adapterRoute.badge}</span>
                <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${qualityScore.badgeClass}`}>
                  可信度：{qualityScore.label} {qualityScore.score}分
                </span>
              </div>
              <h4 className="mt-2 text-base font-bold text-slate-800">{adapterRoute.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{adapterRoute.summary}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {qualityScore.summary}
              </p>
              {shouldReviewQuality ? (
                <p className="mt-2 rounded-xl border border-rose-100 bg-white/75 p-3 text-[11px] leading-relaxed text-rose-700">
                  当前游戏方案可信度偏低，建议先去方案库补全或同步共享库，再用于开房邀请。
                </p>
              ) : null}
            </div>
            <button
              onClick={() => shouldReviewQuality
                ? openSolutionsWithConversionAssessment()
                : adapterRoute.requiresTcpPortProxy || adapterRoute.requiresUdpBroadcastBridge
                ? openAdvancedToolsForHost('host_advanced_tools_needed')
                : routeNeedsReview
                  ? openSolutionsWithConversionAssessment()
                  : adapterRoute.requiresDedicatedServer
                    ? launchHostEntity()
                    : adapterRoute.requiresVirtualLan
                      ? onNavigateTab('network')
                      : copyInvite()}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-800 ring-1 ring-black/5 hover:bg-slate-50"
            >
              {shouldReviewQuality ? '去方案库复核' : adapterRoute.primaryAction}
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {adapterRoute.steps.slice(0, 3).map((step) => (
              <div key={step.id} className="rounded-xl bg-white/75 p-3 text-xs leading-relaxed text-slate-600">
                <b className="text-slate-800">{step.title}</b>
                <p className="mt-1">{step.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {routeMethods.map((method) => (
              <div key={method.id} className="rounded-xl border border-white/70 bg-white/70 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <b className="text-xs text-slate-800">{method.shortLabel}</b>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{method.status}</span>
                </div>
                <p className="line-clamp-2 min-h-8 text-[11px] leading-relaxed text-slate-500">{method.summary}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => openConnectionMethod(method)}
                    className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
                  >
                    {method.advancedToolKind ? '去高级工具' : method.id === 'n2n' ? '去组网中心' : '复制引导'}
                  </button>
                  <button
                    onClick={() => copyConnectionMethodGuide(method)}
                    className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-black/5 hover:bg-slate-50"
                  >
                    说明
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {recommendations.length ? recommendations.slice(0, 4).map((item) => (
            <article key={item.id} className={`rounded-xl border p-3 ${item.level === 'recommended' ? 'border-emerald-100 bg-emerald-50' : item.level === 'unsupported' ? 'border-rose-100 bg-rose-50' : 'border-slate-100 bg-slate-50'}`}>
              <p className="text-xs font-bold text-slate-800">{item.title}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-500">{item.backend_id || 'manual'} · {item.level}</p>
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-600">{item.required_actions[0] || '按说明执行。'}</p>
            </article>
          )) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 md:col-span-2 xl:col-span-4">
              暂无可选联机方式。请先扫描并选择游戏。
            </div>
          )}
        </div>
      </section>

      {remoteCoop ? (
        <section className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5 shadow-sm" data-remote-coop-guide="steam-sunshine">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-violet-700">
                  本地同屏远程联机向导
                </span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${remoteCoopReady.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  准备 {remoteCoopReady.done}/{remoteCoopReady.total}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-800">{currentGame?.display_name || '当前游戏'} · {remoteCoopModeLabel(remoteCoopMode)}</h3>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
                这类游戏不创建 LAN 房间，而是把房主电脑上的本地同屏画面和好友输入通过远程同屏传输。适合茶杯头这类“只能一台电脑同屏”的游戏。
              </p>
            </div>
            <button
              onClick={copyInvite}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <ClipboardCopy className="h-4 w-4" />
              复制给好友
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="mb-3 text-xs font-bold text-slate-800">选择远程同屏方式</p>
                <div className="grid gap-2">
                  {(['steam_remote_play', 'sunshine_moonlight'] as RemoteCoopMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRemoteCoopMode(mode)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                        remoteCoopMode === mode ? 'border-violet-200 bg-violet-100 text-violet-800' : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <b>{remoteCoopModeLabel(mode)}</b>
                      <p className="mt-1 opacity-80">
                        {mode === 'steam_remote_play' ? 'Steam 版本优先，最快开始。' : '非 Steam / 需要更细码率控制时使用。'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="mb-3 text-xs font-bold text-slate-800">画质 / 延迟预设</p>
                <select
                  value={remoteCoopPreset}
                  onChange={(event) => setRemoteCoopPreset(event.target.value as RemoteCoopQualityPreset)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-violet-300"
                >
                  {Object.entries(remoteCoopQualityPresets).map(([id, preset]) => (
                    <option key={id} value={id}>{preset.label} · {preset.resolution} · {preset.bitrate}</option>
                  ))}
                </select>
                <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-slate-500">
                  {remoteCoopLatencyTips.slice(0, 5).map((tip) => <li key={tip}>• {tip}</li>)}
                </ul>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="mb-3 text-xs font-bold text-slate-800">房主准备检查</p>
                <div className="space-y-2">
                  {([
                    ['gameLaunched', '已启动游戏'] as const,
                    ['localCoopMode', '已进入本地同屏/合作模式'] as const,
                    ['friendInvited', remoteCoopMode === 'steam_remote_play' ? '已准备 Steam 邀请' : '已准备 Moonlight 配对'] as const,
                    ['inputEnabled', '已允许好友手柄/键鼠输入'] as const,
                  ]).map(([key, label]) => (
                    <label key={key} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={remoteCoopChecklist[key]}
                        onChange={() => toggleRemoteCoopCheck(key)}
                        className="mt-0.5"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="mb-3 text-xs font-bold text-slate-800">向导步骤</p>
                <div className="space-y-2">
                  {remoteCoopSteps.map((step, index) => (
                    <div key={step.id} className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                      <b className="text-slate-800">{index + 1}. {step.title}</b>
                      <p className="mt-1">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              房主开房向导
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              按顺序完成选择游戏、启动组网、启动服务端或游戏、分配好友 IP、复制邀请包。当前缺什么就点对应按钮处理。
            </p>
          </div>
          <button
            onClick={() => firstPendingHostStep?.action()}
            disabled={Boolean(busy) || !firstPendingHostStep}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Settings className="h-4 w-4" />
            {busy || firstPendingHostStep?.actionLabel || '开房准备完成'}
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-5">
          {hostSteps.map((step, index) => (
            <article key={step.id} className={`rounded-2xl border p-4 ${stepTone(step.state)}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="rounded-full bg-white/70 px-2 py-0.5 font-mono text-[10px] font-bold">{index + 1}</span>
                {step.state === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <span className={`mt-1 h-2 w-2 rounded-full ${step.state === 'active' ? 'bg-amber-500' : step.state === 'warning' ? 'bg-rose-500' : 'bg-slate-300'}`} />}
              </div>
              <h4 className="text-sm font-bold">{step.title}</h4>
              <p className="mt-2 min-h-12 text-xs leading-relaxed opacity-90">{step.detail}</p>
              <button
                onClick={() => step.action()}
                disabled={Boolean(busy) || step.disabled}
                className="mt-3 w-full rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-black/5 hover:bg-white disabled:opacity-50"
              >
                {step.actionLabel}
              </button>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <span className="font-bold text-slate-800">{routeUsesLanInvite ? 'n2n 自动检测：' : '推荐路线：'}</span>
            {routeUsesLanInvite
              ? (runtime.network.ready ? 'ACK/PONG 已通过。' : runtime.network.running ? 'edge 正在运行，等待 ACK/PONG。' : '尚未启动。')
              : adapterRoute.title}
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <span className="font-bold text-slate-800">{routeUsesLanInvite ? '游戏端口：' : '需要组件：'}</span>
            {routeUsesLanInvite
              ? (hostPortCheck || `等待检测 ${Number(port) || defaultPort(currentGame)} 端口。`)
              : adapterRoute.tools.join('、')}
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <span className="font-bold text-slate-800">{routeUsesLanInvite ? '邀请包：' : '是否强转 LAN：'}</span>
            {routeUsesLanInvite
              ? (lanInviteReady ? `已绑定 ${selectedFriend?.name || '好友'}，端口已确认，可复制给好友。` : (lanInviteBlockerText || '尚未分配好友 IP。'))
              : (adapterRoute.canCreateLanInvite ? '可以生成 LAN 邀请包。' : '不生成 LAN 邀请包，复制路线说明。')}
          </div>
        </div>

        <div
          className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4"
          data-host-room-closure-audit="checklist"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Host closure audit</p>
              <h4 className="mt-1 text-sm font-bold text-slate-900">房主开房闭环自检</h4>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-600">
                {hostClosureAudit.summary} 这张卡用于防止后续重构时只保留界面、丢失选择游戏、推荐方案、启动组网、端口检测、好友 IP 和邀请包复制这些真实路径。
              </p>
            </div>
            <button
              onClick={copyHostClosureAudit}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <ClipboardCopy className="h-4 w-4" />
              复制房主自检
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600">
              固化能力<br />
              <span className="text-lg font-black text-slate-900">{hostClosureAudit.wiredCount}</span>
              <span className="ml-1 text-[11px]">项</span>
            </div>
            <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600">
              当前已观察<br />
              <span className="text-lg font-black text-emerald-700">{hostClosureAudit.observedCount}</span>
              <span className="ml-1 text-[11px]">项</span>
            </div>
            <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600">
              路线防误导<br />
              <span className="font-bold text-slate-900">{hostClosureAudit.routeLabel}</span>
            </div>
            <div className="rounded-xl bg-white/80 p-3 text-xs text-slate-600">
              下一项<br />
              <span className="font-bold text-slate-900">{firstPendingHostStep?.title || '开房准备完成'}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {hostClosureAudit.items.slice(0, 6).map((item) => (
              <span
                key={item.id}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  item.status === 'observed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-white/80 text-slate-600'
                }`}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {hostDiagnosticContext ? (
          <div
            className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/80 p-4 text-rose-800"
            data-host-diagnostic-context="latest"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-rose-700">房主开房失败上下文</span>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">{hostDiagnosticContext.reasonKind}</span>
                  <span className="rounded-full bg-white/75 px-3 py-1 font-mono text-[11px] font-bold text-slate-500">
                    {new Date(hostDiagnosticContext.createdAt).toLocaleString()}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{hostDiagnosticContext.title}</h4>
                <p className="mt-1 text-xs leading-relaxed">{hostDiagnosticContext.detail}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <p className="rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                    游戏：{hostDiagnosticContext.gameName || '未知'}{hostDiagnosticContext.gameId ? `｜${hostDiagnosticContext.gameId}` : ''}
                  </p>
                  <p className="rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                    路线：{hostDiagnosticContext.routeTitle}
                  </p>
                  <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                    {hostDiagnosticContext.hostVirtualIp || '房主 IP 未读取'}:{hostDiagnosticContext.gamePort || '-'}
                  </p>
                  <p className="rounded-xl bg-white/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-600">
                    Supernode {hostDiagnosticContext.supernode || '-'}
                  </p>
                  <p className="rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                    服务端：{hostDiagnosticContext.serverRunning ? '运行中' : '未运行'}
                  </p>
                  <p className="rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                    端口：{hostDiagnosticContext.hostPortCheck || '未检测'}
                  </p>
                </div>
                <p className="mt-2 rounded-xl bg-white/75 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                  建议：{hostDiagnosticContext.nextAction}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button onClick={openHostFailureDiagnostic} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  {hostDiagnosticContext.nextActionKind === 'advanced_tools' ? '带参数去高级工具' : hostDiagnosticContext.nextActionKind === 'network' ? '回组网中心' : '带失败信息诊断'}
                </button>
                <button onClick={copyHostDiagnosticContext} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50">
                  复制失败上下文
                </button>
                <button onClick={clearHostFailureDiagnostic} className="rounded-lg border border-rose-100 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-rose-500 hover:bg-white">
                  清除
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 space-y-3">
              <div className="w-full min-w-0">
                <h3 className="flex w-full items-center gap-2 whitespace-nowrap text-sm font-bold text-slate-800">
                  <Gamepad2 className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>真实推荐目标</span>
                </h3>
                <p className="mt-1 block w-full text-xs leading-relaxed text-slate-500">来自游戏扫描页的当前选择；也可以在下方切换。</p>
              </div>
              <select value={currentGame?.game_id || ''} onChange={(event) => chooseGame(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400">
                {games.map((game) => <option key={game.game_id} value={game.game_id}>{game.display_name} ({game.game_id})</option>)}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">房主虚拟 IP<br /><span className="font-mono font-bold text-slate-800">{n2nConfig?.local_ip || '未读取'}</span></div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Supernode<br /><span className="font-mono font-bold text-slate-800">{n2nConfig?.supernode || '未读取'}</span></div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">服务端<br /><span className="font-bold text-slate-800">{server?.running ? '运行中' : '未运行'}</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Wifi className="h-4 w-4 text-amber-600" />真实推荐列表</h3>
            <div className="space-y-3">
              {recommendations.length ? recommendations.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">backend={item.backend_id || '-'}｜profile={item.launch_profile_id || '-'}｜latency={item.estimated_latency_ms ?? '-'}ms</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.level === 'recommended' ? 'bg-emerald-50 text-emerald-700' : item.level === 'unsupported' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{item.level}</span>
                  </div>
                  {item.required_actions.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">{item.required_actions.map((action) => <li key={action}>{action}</li>)}</ul> : null}
                </article>
              )) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">暂无真实推荐。请先扫描并选择游戏。</div>}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <input value={port} onChange={(event) => setPort(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
              <button onClick={launch} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60"><Play className="h-4 w-4" />立即启动本地游戏实体</button>
              <button onClick={() => onNavigateTab('network')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Link2 className="h-4 w-4" />通用组网中心</button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Users className="h-4 w-4 text-amber-600" />好友 IP 分配</h3>
            {!routeUsesLanInvite ? (
              <p className="mb-3 rounded-xl bg-violet-50 p-3 text-xs leading-relaxed text-violet-700">
                当前是“{adapterRoute.title}”，不需要好友虚拟 IP。这里保留给 n2n/LAN 游戏使用。
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-2">
              <input value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="好友昵称" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              <input value={friendIp} onChange={(event) => setFriendIp(event.target.value)} placeholder="10.x.x.x" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
              <button onClick={addFriend} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"><UserPlus className="h-4 w-4" />分配并生成推荐信</button>
            </div>
            <div className="mt-4 space-y-2">
              {friends.length ? friends.map((friend) => (
                <div key={friend.id} className={`rounded-xl border p-3 ${friend.status === 'selected' ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{friend.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{friend.ip}</p>
                    </div>
                    {friend.status === 'selected' ? <CheckCircle2 className="h-4 w-4 text-amber-600" /> : null}
                  </div>
                  {friend.last_check_summary ? <p className="mt-2 text-[11px] text-slate-500">{friend.last_check_summary}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => selectFriend(friend)} className="text-xs font-bold text-amber-700">生成邀请包</button>
                    <button onClick={() => removeFriend(friend)} className="inline-flex items-center gap-1 text-xs font-bold text-rose-600"><Trash2 className="h-3 w-3" />回收席位</button>
                  </div>
                </div>
              )) : <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">暂无好友席位。</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              {!routeUsesLanInvite ? <MonitorPlay className="h-4 w-4 text-amber-600" /> : <Server className="h-4 w-4 text-amber-600" />}
              {!routeUsesLanInvite ? '联机路线说明' : '邀请包与检测'}
            </h3>
            {routeUsesLanInvite && !lanInviteReady ? (
              <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                暂不建议复制半成品邀请包：{lanInviteBlockerText || '请先完成组网、端口检测和好友 IP 分配。'}
              </p>
            ) : null}
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-amber-100">{invitePreview}</pre>
            {lastCheck ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{lastCheck}</p> : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={testFriend} disabled={Boolean(busy) || !selectedFriend || !routeUsesLanInvite} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Send className="h-4 w-4" />{routeUsesLanInvite ? '检测好友连接' : '无需端口检测'}</button>
              <button onClick={copyHostInvite} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"><ClipboardCopy className="h-4 w-4" />{routeUsesLanInvite ? (lanInviteReady ? '复制完整邀请凭证包' : selectedFriend ? '补齐后复制邀请包' : '先分配好友 IP') : adapterRoute.inviteLabel}</button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
