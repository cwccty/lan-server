import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  FileText,
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
import type { ConnectivityTarget, NetworkConfig } from '../types/network';
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

type ConnectivityProtocol = NonNullable<ConnectivityTarget['protocol']>;

function portCheckProtocolForGame(game: GameSummary | null): ConnectivityProtocol {
  const gameId = game?.game_id?.toLowerCase() || '';
  if (gameId.includes('palworld')) return 'udp';
  if (gameId.includes('stardew')) return 'tcp_udp';

  const directProtocolHints = (game?.evidence?.port_protocols ?? []).join(' ').toLowerCase();
  if (directProtocolHints) {
    const directMentionsUdp = directProtocolHints.includes('udp');
    const directMentionsTcp = directProtocolHints.includes('tcp');
    if (directMentionsUdp && directMentionsTcp) return 'tcp_udp';
    if (directMentionsUdp) return 'udp';
    if (directMentionsTcp) return 'tcp';
  }

  const protocolHints = [
    ...(game?.multiplayer_conversion?.required_components ?? []),
    ...(game?.connection_plan?.troubleshooting ?? []),
  ].join(' ').toLowerCase();

  const mentionsUdp = protocolHints.includes('udp');
  const mentionsTcp = protocolHints.includes('tcp');
  if (mentionsUdp && mentionsTcp) return 'tcp_udp';
  if (mentionsUdp) return 'udp';
  return 'tcp';
}

function protocolUserLabel(protocol: ConnectivityProtocol) {
  if (protocol === 'udp') return 'UDP 游戏端口';
  if (protocol === 'tcp_udp') return 'TCP/UDP 自动判断';
  return 'TCP 游戏端口';
}

function protocolUserHint(protocol: ConnectivityProtocol) {
  if (protocol === 'udp') {
    return '适合 Palworld 等 UDP 服务端；软件能检查房主电脑是否已经开出端口，好友侧最终以游戏内加入结果为准。';
  }
  if (protocol === 'tcp_udp') {
    return '适合端口协议不固定的游戏；软件会先测常见连接方式，再检查本机是否有 UDP 端口。';
  }
  return '适合 Minecraft/Terraria 这类常见服务端端口；软件会检查房主电脑是否已经开始监听。';
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

function userRouteLabel(route: AdapterRecommendationRoute) {
  if (route.kind === 'remote_coop') return '远程同屏';
  if (route.kind === 'steam_p2p') return 'Steam 邀请';
  if (route.kind === 'official_only') return '官方入口';
  if (route.kind === 'needs_review') return '待确认游戏方案';
  if (route.kind === 'tcp_port_proxy' || route.kind === 'udp_broadcast_bridge') return '高级局域网开房';
  return '局域网开房';
}

function userRouteSummary(route: AdapterRecommendationRoute) {
  if (route.kind === 'remote_coop') return '这个游戏不创建局域网房间，建议用远程同屏邀请好友。';
  if (route.kind === 'steam_p2p') return '建议使用 Steam 好友邀请或游戏内大厅。';
  if (route.kind === 'official_only') return '建议使用官方服务器、官方大厅或官方好友入口。';
  if (route.kind === 'needs_review') return '还没有可靠开房方案，先去方案库确认后再引导用户。';
  if (route.kind === 'dedicated_server') return '需要房主先启动游戏服务端，再把邀请包发给好友。';
  if (route.kind === 'tcp_port_proxy' || route.kind === 'udp_broadcast_bridge') return '需要先按向导打开高级连接工具，再把邀请包发给好友。';
  return '按向导启动组网并检测端口后，就可以把邀请包发给好友。';
}

function userInviteMissingFields(missing: string[]) {
  const labels: Record<string, string> = {
    Supernode: '中继地址',
    '好友预留 IP': '好友地址',
    '房主虚拟 IP': '房主地址',
  };
  return missing.map((item) => labels[item] || item).join('、') || '无';
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
  const routeLabel = userRouteLabel(adapterRoute);
  const currentPortProtocol = portCheckProtocolForGame(currentGame);
  const currentPlan = currentGame?.connection_plan;
  const routeNeedsAdvancedHelper = adapterRoute.requiresTcpPortProxy || adapterRoute.requiresUdpBroadcastBridge;
  const shouldReviewQuality = qualityScore.level === 'low';
  const selectedFriend = selectedFriendOf(friends);
  const targetGamePort = Number(port) || defaultPort(currentGame);
  const hostPortReady = hostPortCheck.includes('已监听');
  const dedicatedServerSatisfied = !adapterRoute.requiresDedicatedServer || Boolean(server?.running) || hostPortReady;
  const status = resolveProductStatusCenter({
    loaded: runtime.loaded,
    snapshot: runtime.snapshot,
    network: runtime.network,
    errors: runtime.errors,
    n2nConfig,
    server,
    requiresServer: routeUsesLanInvite && !dedicatedServerSatisfied,
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
    gamePort: targetGamePort,
    serverRunning: Boolean(server?.running || hostPortReady),
    friendCheck: selectedFriend?.last_check_summary
  };
  const lanInviteValidation = validateLanInvitePacket(lanInvitePacket);
  const lanInviteReady = routeUsesLanInvite && status.canInvite && lanInviteValidation.ok && hostPortReady;
  const lanInviteBlockers = routeUsesLanInvite
    ? Array.from(new Set([
        !status.canInvite ? (status.nextAction || status.detail || '先完成组网、服务端和添加好友。') : '',
        !lanInviteValidation.ok ? `邀请还缺少：${userInviteMissingFields(lanInviteValidation.missing)}。` : '',
        !hostPortReady ? `先检测游戏端口 ${targetGamePort}，确认游戏或服务端已经启动。` : '',
      ].filter(Boolean)))
    : [];
  const lanInviteBlockerText = lanInviteBlockers.join(' ');
  const hostPortUserText = hostPortReady
    ? `游戏端口 ${targetGamePort} 已准备好。`
    : hostPortCheck
      ? `游戏端口 ${targetGamePort} 还没确认，请重新检测。`
      : `等待检测游戏端口 ${targetGamePort}。`;
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
        '邀请包还不能复制',
        '',
        '待完成：',
        ...(lanInviteBlockers.length ? lanInviteBlockers.map((item) => `- ${item}`) : ['- 完成组网、端口检测和添加好友。']),
        '',
        '完成后这里会显示可发给好友的邀请内容。',
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
    label: routeLabel,
    detail: userRouteSummary(adapterRoute),
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
    setBusy('添加好友');
    try {
      const friend = await upsertReferenceFriendAllocationBackendFirst(friendName, friendIp);
      const nextFriends = await listReferenceFriendAllocationsBackendFirst();
      setFriends(nextFriends);
      saveRecommendationCache({ friends: nextFriends });
      onTriggerToast(`已添加好友：${friend.name} (${friend.ip})`);
    } catch (error) {
      onTriggerToast(`添加失败：${error instanceof Error ? error.message : String(error)}`);
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
    onTriggerToast(`已删除 ${friend.name} 的好友地址。`);
  };

  const testFriend = async () => {
    if (!selectedFriend) {
      onTriggerToast('请先添加或选择好友。');
      return;
    }
    setBusy('检测好友连接');
    try {
      const targetPort = Number(port) || defaultPort(currentGame);
      const protocol = portCheckProtocolForGame(currentGame);
      if (protocol === 'udp') {
        const summary = `${selectedFriend.ip}:${targetPort} 需要在游戏内实测加入；UDP 远端端口无法像 TCP 一样自动可靠判定。`;
        setLastCheck(summary);
        await updateReferenceFriendCheckBackendFirst(selectedFriend.ip, summary);
        const nextFriends = await listReferenceFriendAllocationsBackendFirst();
        setFriends(nextFriends);
        saveRecommendationCache({ friends: nextFriends, lastCheck: summary });
        onTriggerToast('UDP 游戏请让好友按邀请包在游戏内加入；软件已记录提醒。');
        return;
      }
      const report = await testConnectivity({ host: selectedFriend.ip, ports: [targetPort], timeout_ms: 1200, mode: 'n2n_game_port', protocol });
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
          detail: `好友地址 ${selectedFriend.ip}:${targetPort} 暂不可连接，需要确认双方是否已启动组网、好友是否已导入邀请包、游戏端口是否监听。`,
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
      onTriggerToast(remoteCoop ? '远程同屏说明已复制。' : routeUsesLanInvite ? '本地联机邀请包已复制。' : '联机路线说明已复制。');
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
    onTriggerToast('已带着当前游戏建议进入方案库，可继续补全或复核方案。');
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
    const protocol = portCheckProtocolForGame(currentGame);
    const toolKind = preferredKind || (adapterRoute.requiresUdpBroadcastBridge ? 'bridge' : protocol === 'udp' ? 'udp' : 'tcp');
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
        `房主联机地址：${runtime.network.virtualIp || n2nConfig?.local_ip || '未读取'}`,
        selectedFriend ? `好友联机地址：${selectedFriend.ip}` : '尚未选择好友联机地址',
        hostPortCheck || '房主端口尚未检测',
      ],
    });
    writeHostFailureContext({
      source: reason,
      reasonKind: useBridge ? 'udp_broadcast_bridge_required' : useUdpProxy ? 'udp_port_proxy_required' : 'tcp_port_proxy_required',
      nextActionKind: 'advanced_tools',
      title: useBridge ? '当前开房路线需要 UDP 广播桥' : useUdpProxy ? '当前开房路线需要 UDP 代理' : '当前开房路线需要 TCP 端口代理',
      detail: `${adapterRoute.title} 不能只靠普通组网按钮完成，已准备${useBridge ? 'UDP 广播桥' : useUdpProxy ? 'UDP 代理' : 'TCP 端口代理'}连接信息。`,
    });
    onNavigateTab('advanced_tools');
    onTriggerToast(`已带着当前游戏、端口和好友联机地址 进入${useBridge ? 'UDP 广播桥' : useUdpProxy ? 'UDP 代理' : 'TCP 端口代理'}。`);
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
        title: '开房信息还没准备好',
        detail: '房间名、房间密钥或中继地址缺失，暂时不能启动组网。请先到“加入与组网”页查看上次保存的信息；如果没有，就重新填写并保存，再回到本页检测房间和复制邀请。',
        nextAction: '去“加入与组网”页确认三项信息：房间名、房间密钥、中继地址。保存后回到“推荐方案”页，点击“启动组网”和“检测端口”。邀请包生成后，直接复制给好友；如果想换一组房间信息，请在加入与组网页重新填写并保存。',
      });
      onTriggerToast('请先在加入与组网页保存房间名、密钥和中继地址。');
      onNavigateTab('network');
      return;
    }
    setBusy('启动房主组网');
    try {
      const result = await startReferenceN2n(n2nConfig);
      if (!result.ok) throw new Error(result.message);
      await refreshReferenceRuntime(false);
      await load('刷新房主向导');
      onTriggerToast('房主组网已启动，连接确认后即可继续。');
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
      const report = await testConnectivity({ host: '127.0.0.1', ports: [targetPort], timeout_ms: 1200, mode: 'local_game_port', protocol: portCheckProtocolForGame(currentGame) });
      const summary = `本机 127.0.0.1:${targetPort} ${report.reachable ? '已监听' : '未监听'}${report.notes.length ? `｜${report.notes.join('；')}` : ''}`;
      setHostPortCheck(summary);
      saveRecommendationCache({ hostPortCheck: summary });
      if (!report.reachable) {
        writeHostFailureContext({
          source: 'host_port_failure',
          reasonKind: 'local_game_port_not_listening',
          hostPortCheckOverride: summary,
          nextActionKind: adapterRoute.requiresTcpPortProxy || adapterRoute.requiresUdpBroadcastBridge ? 'advanced_tools' : 'diagnostics',
          title: '还没有检测到游戏房间',
          detail: `本机 ${targetPort} 端口还没有响应。普通处理顺序是：先确认组网已启动，再打开游戏或专用服务端，在游戏里创建房间或开启服务器，然后回到这里重新检测。`,
          nextAction: '如果你还没打开游戏，请先启动游戏并创建多人房间；如果这个游戏需要专用服务端，请先启动服务端。完成后点击“重新检测端口”。仍失败时打开诊断报告，按修复建议处理。',
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
      onTriggerToast(`已选择好友：${selectedFriend.name} (${selectedFriend.ip})`);
      return;
    }
    setBusy('添加好友');
    try {
      const friend = await upsertReferenceFriendAllocationBackendFirst(friendName || '好友1', friendIp || '10.0.8.2');
      await selectReferenceFriendAllocationBackendFirst(friend.name, friend.ip);
      setFriends(await listReferenceFriendAllocationsBackendFirst());
      onTriggerToast(`已添加并选择好友：${friend.name} (${friend.ip})`);
    } catch (error) {
      onTriggerToast(`添加好友失败：${error instanceof Error ? error.message : String(error)}`);
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
      onTriggerToast(status.nextAction || '请先完成组网、服务端和添加好友。');
      return;
    }
    if (!lanInviteValidation.ok) {
      onTriggerToast(`邀请还缺少：${userInviteMissingFields(lanInviteValidation.missing)}。请先补齐后再复制。`);
      return;
    }
    if (!hostPortReady) {
      const reachable = await testHostGamePort();
      if (!reachable) {
        onTriggerToast('游戏端口还没准备好，暂不能复制邀请包。');
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
      detail: '如果该游戏后续支持 Steam Relay/P2P 插件，可在高级方案中扩展，不默认使用通用组网。',
      state: 'pending',
      actionLabel: '复制说明',
      action: copyInvite
    },
    {
      id: 'share',
      title: '发给好友',
      detail: '把 Steam 路线说明发给好友，避免好友连接错误地址。',
      state: 'done',
      actionLabel: '一键复制',
      action: copyInvite
    }
  ];

  const reviewHostSteps: HostWizardStep[] = [
    selectGameStep(routeOfficialOnly ? '当前受限目标' : '当前待确认目标'),
    {
      id: 'adapter-review',
      title: routeOfficialOnly ? '查看限制原因' : '选择正确联机方式',
      detail: routeOfficialOnly ? '该游戏更适合使用官方入口，不建议强行改成联机房间。' : '先看游戏是输入地址加入、服务端、房间列表、远程同屏，还是官方/Steam 邀请；不要盲目开组网。',
      state: 'active',
      actionLabel: '去方案库',
      action: () => onNavigateTab('solutions')
    },
    {
      id: 'diagnostic',
      title: '记录问题信息',
      detail: '需要时生成诊断报告，把缺少的游戏方案、端口或服务端信息记录下来，方便后续补方案。',
      state: 'pending',
      actionLabel: '打开诊断',
      action: () => onNavigateTab('diagnostics')
    },
    {
      id: 'share',
      title: '复制说明',
      detail: routeOfficialOnly ? '复制官方路线/不支持转换说明。' : '复制待确认说明，避免好友误以为普通组网一定可用。',
      state: 'pending',
      actionLabel: '复制说明',
      action: copyInvite
    }
  ];

  const advancedStep: HostWizardStep | null = adapterRoute.requiresTcpPortProxy || adapterRoute.requiresUdpBroadcastBridge ? {
    id: 'advanced-tools',
    title: adapterRoute.requiresUdpBroadcastBridge ? '配置 UDP 广播桥' : '配置端口代理',
    detail: adapterRoute.requiresUdpBroadcastBridge
      ? '该游戏方案需要 UDP 广播桥补齐局域网大厅发现；进入高级连接工具配置游戏 UDP 端口。'
      : '该游戏方案需要端口代理；进入高级连接工具把游戏监听端口暴露给虚拟网。',
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
      detail: runtime.network.ready ? `组网已连接：${runtime.network.virtualIp || n2nConfig?.local_ip || '已读取联机地址'}` : status.detail,
      state: runtime.network.ready ? 'done' : runtime.network.running ? 'active' : n2nConfig?.supernode ? 'active' : 'warning',
      actionLabel: runtime.network.ready ? '刷新状态' : n2nConfig?.supernode ? '启动组网' : '配置组网',
      action: runtime.network.ready ? () => load('刷新房主向导') : n2nConfig?.supernode ? startHostNetwork : () => onNavigateTab('network'),
      disabled: Boolean(busy)
    },
    {
      id: 'host-entity',
      title: adapterRoute.requiresDedicatedServer ? '启动服务端' : '检测游戏房间',
      detail: adapterRoute.requiresDedicatedServer
        ? (server?.running
          ? `服务端运行中：${server.message || '已启动'}`
          : hostPortReady
            ? '已检测到游戏端口监听；如果服务端是手动启动的，也可以继续复制邀请。'
            : '当前游戏需要先启动专用服务端。可以点“启动服务端”，也可以自己打开服务端后再点检测。')
        : (hostPortCheck || '先打开游戏，在游戏里创建多人房间或开始主持，然后回到这里点检测端口。这里不会替你创建游戏内房间。'),
      state: adapterRoute.requiresDedicatedServer
        ? (server?.running || hostPortReady ? 'done' : runtime.network.ready ? 'active' : 'pending')
        : (hostPortCheck.includes('已监听') ? 'done' : runtime.network.ready ? 'active' : 'pending'),
      actionLabel: adapterRoute.requiresDedicatedServer
        ? (server?.running || hostPortReady ? '重新检测端口' : '启动服务端')
        : (hostPortCheck.includes('已监听') ? '重新检测端口' : '检测端口'),
      action: adapterRoute.requiresDedicatedServer
        ? (server?.running || hostPortReady ? async () => { await testHostGamePort(); } : launchHostEntity)
        : async () => { await testHostGamePort(); },
      disabled: Boolean(busy) || !currentGame
    },
    ...(advancedStep ? [advancedStep] : []),
    {
      id: 'friend',
      title: '添加好友',
      detail: selectedFriend ? `当前邀请对象：${selectedFriend.name} (${selectedFriend.ip})` : '给好友预留一个地址，避免多人冲突。',
      state: selectedFriend ? 'done' : runtime.network.ready ? 'active' : 'pending',
      actionLabel: selectedFriend ? '更换好友' : '添加好友',
      action: selectedFriend ? () => onTriggerToast('可在下方好友区域选择或删除好友。') : ensureFriendSlot,
      disabled: Boolean(busy)
    },
    {
      id: 'invite',
      title: '生成邀请包',
      detail: lanInviteReady
        ? '完整邀请包已生成，可复制给好友。'
        : (lanInviteBlockerText || '完成组网、端口检测和添加好友后即可复制邀请包。'),
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
  const hostUserFlowSteps = [
    {
      title: '选择游戏',
      detail: currentGame ? `当前：${currentGame.display_name}` : '先从游戏扫描页选择要和朋友玩的游戏。',
      done: Boolean(currentGame),
      actionLabel: '去游戏扫描',
      action: () => onNavigateTab('games'),
    },
    {
      title: '启动或确认组网',
      detail: runtime.network.ready ? `已连接，房主联机地址：${runtime.network.virtualIp || n2nConfig?.local_ip || '已读取'}` : '先启动组网，让你和好友进入同一个联机环境。',
      done: Boolean(runtime.network.ready || !routeUsesLanInvite),
      actionLabel: runtime.network.ready ? '刷新状态' : '去加入与组网',
      action: runtime.network.ready ? () => load('刷新房主向导') : () => onNavigateTab('network'),
    },
    {
      title: adapterRoute.requiresDedicatedServer ? '启动专用服务端' : '打开游戏',
      detail: adapterRoute.requiresDedicatedServer ? '服务端要保持运行，好友才能连接。' : '进入游戏主菜单或多人游戏入口。',
      done: Boolean(server?.running || !adapterRoute.requiresDedicatedServer),
      actionLabel: adapterRoute.requiresDedicatedServer ? '启动服务端' : '启动游戏',
      action: launchHostEntity,
    },
    {
      title: '在游戏里创建房间',
      detail: adapterRoute.requiresDedicatedServer ? '服务端运行后等待世界加载完成。' : '在游戏内选择主持、开房、创建世界或开启服务器。',
      done: hostPortReady,
      actionLabel: '我已创建，检测端口',
      action: testHostGamePort,
    },
    {
      title: '回到这里检测房间',
      detail: hostPortReady ? hostPortUserText : `检测 ${targetGamePort} 端口，确认游戏房间真的开起来。`,
      done: hostPortReady,
      actionLabel: hostPortReady ? '重新检测' : '检测游戏房间',
      action: testHostGamePort,
    },
    {
      title: '生成邀请并发给好友',
      detail: lanInviteReady ? '邀请已准备好，可以复制给好友。' : '检测通过并添加好友后，邀请按钮会变成可复制。',
      done: lanInviteReady || !routeUsesLanInvite,
      actionLabel: '复制邀请',
      action: copyHostInvite,
    },
    {
      title: '好友按邀请加入',
      detail: '好友在“加入与组网”页粘贴邀请，保存并启动组网，再按邀请里的地址和端口进游戏。',
      done: false,
      actionLabel: '复制给好友',
      action: copyHostInvite,
    },
    {
      title: '失败就按诊断修复',
      detail: '如果检测或加入失败，打开诊断报告，按“先做这一步”和修复建议处理。',
      done: Boolean(!hostDiagnosticContext && lanInviteReady),
      actionLabel: '打开诊断报告',
      action: () => onNavigateTab('diagnostics'),
    },
  ];
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
      onTriggerToast('房主开房自检已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openHostFailureDiagnostic = () => {
    onNavigateTab('diagnostics');
    onTriggerToast(hostDiagnosticContext ? '已带着房主开房失败信息进入诊断报告。' : '已打开诊断报告。');
  };

  const openHostFailureNextAction = () => {
    if (!hostDiagnosticContext) {
      onNavigateTab('diagnostics');
      return;
    }
    if (hostDiagnosticContext.nextActionKind === 'advanced_tools') {
      openAdvancedToolsForHost(hostDiagnosticContext.source);
      return;
    }
    if (hostDiagnosticContext.nextActionKind === 'network') {
      onNavigateTab('network');
      onTriggerToast('已打开加入与组网页，请补齐房间名、密钥和中继地址。');
      return;
    }
    onNavigateTab('diagnostics');
  };

  const copyHostDiagnosticContext = async () => {
    if (!hostDiagnosticContext) {
      onTriggerToast('暂无房主开房失败信息。');
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatHostDiagnosticContext(hostDiagnosticContext));
      onTriggerToast('房主开房失败信息已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearHostFailureDiagnostic = () => {
    clearHostDiagnosticContext();
    setHostDiagnosticContext(null);
    onTriggerToast('已清除房主开房失败信息。');
  };

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="recommendation">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在刷新方案、启动组网或检测游戏端口；请等待状态返回。" />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">开房邀请</h2>
          <p className="mt-1 text-sm text-slate-500">房主按步骤开房，完成后把邀请包发给好友。</p>
        </div>
        <button onClick={() => load('手动刷新推荐方案')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          {busy || '刷新方案'}
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

      <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm" data-user-connection-closure="guide">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">普通玩家说明</span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">{routeLabel}</span>
              {routeUsesLanInvite ? (
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-slate-600">{protocolUserLabel(currentPortProtocol)}</span>
              ) : null}
            </div>
            <h3 className="text-base font-black text-slate-900">
              {currentGame?.display_name || '当前游戏'}怎么联机
            </h3>
            <p className="mt-2 max-w-4xl text-xs leading-relaxed text-slate-700">
              {currentPlan?.summary || adapterRoute.summary}
            </p>
          </div>
          <button
            onClick={() => firstPendingHostStep?.action()}
            disabled={Boolean(busy) || !firstPendingHostStep}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Settings className="h-4 w-4" />
            {busy || firstPendingHostStep?.actionLabel || '已准备好'}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-1 font-bold text-slate-900">1. 房主做什么</p>
            <p>{currentPlan?.host_role || firstPendingHostStep?.detail || '按下方向导把房间开好。'}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-1 font-bold text-slate-900">2. 好友怎么加入</p>
            <p>{currentPlan?.join_role || (routeUsesLanInvite ? '好友收到邀请后，按里面的房主地址和端口加入游戏。' : userRouteSummary(adapterRoute))}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-1 font-bold text-slate-900">3. 软件帮你省什么</p>
            <p>
              {routeUsesLanInvite
                ? '自动整理组网信息、游戏端口、好友地址和邀请文本，缺哪一步就提示哪一步。'
                : remoteCoop
                  ? '自动生成远程同屏说明，避免好友去填无效的联机地址。'
                  : '自动判断是否该走官方/Steam/人工确认路线，避免错误开房。'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
            <p className="mb-1 font-bold text-slate-900">4. 出问题先看这里</p>
            <p>
              {routeNeedsAdvancedHelper
                ? '如果提示需要连接工具，先点“打开高级工具”，挂载成功后再回游戏加入。'
                : routeUsesLanInvite
                  ? protocolUserHint(currentPortProtocol)
                  : userRouteSummary(adapterRoute)}
            </p>
          </div>
        </div>

        {routeUsesLanInvite ? (
          <div className="mt-4 rounded-2xl border border-white/80 bg-white/85 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">游戏端口</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  如果游戏画面显示了端口，先把这里改成游戏显示的数字，再检测端口和复制邀请。{protocolUserHint(currentPortProtocol)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={port}
                  onChange={(event) => setPort(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-bold text-slate-800 outline-none focus:border-amber-400 sm:w-32"
                />
                <button
                  onClick={testHostGamePort}
                  disabled={Boolean(busy) || !currentGame}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  检测端口
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
                  联机方式评估
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
                带建议去方案库
              </button>
              <button
                onClick={copyConversionAssessment}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-800 ring-1 ring-black/5 hover:bg-slate-50"
              >
                <ClipboardCopy className="h-4 w-4" />
                复制建议
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
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-amber-700">自动套用游戏方案</span>
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
                这类游戏不创建局域网房间，而是把房主电脑上的本地同屏画面和好友输入通过远程同屏传输。适合茶杯头这类“只能一台电脑同屏”的游戏。
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
              按顺序完成选择游戏、启动组网、启动服务端或游戏、确认端口、添加好友、复制邀请包。缺什么就点对应按钮。
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

        <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-800">普通开房步骤</h4>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                按这 8 步走。哪一步失败，就先点该步骤按钮；仍不行再打开诊断报告，不需要自己判断技术原因。
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('diagnostics')}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              打开诊断报告
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {hostUserFlowSteps.map((step, index) => (
              <article key={step.title} className={`min-w-0 rounded-xl border p-3 ${step.done ? 'border-emerald-100 bg-white text-emerald-800' : index === hostUserFlowSteps.findIndex((item) => !item.done) ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-slate-100 bg-white text-slate-600'}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{index + 1}</span>
                  <h5 className="min-w-0 text-xs font-bold">{step.title}</h5>
                </div>
                <p className="min-h-10 break-words text-[11px] leading-relaxed opacity-90">{step.detail}</p>
                <button
                  onClick={() => step.action()}
                  disabled={Boolean(busy)}
                  className="mt-3 w-full rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 ring-1 ring-black/5 hover:bg-slate-50 disabled:opacity-50"
                >
                  {step.actionLabel}
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
            <span className="font-bold text-slate-800">{routeUsesLanInvite ? '组网：' : '当前方式：'}</span>
            {routeUsesLanInvite
              ? (runtime.network.ready ? `已连接${runtime.network.virtualIp || n2nConfig?.local_ip ? `：${runtime.network.virtualIp || n2nConfig?.local_ip}` : '。'}` : runtime.network.running ? '正在连接，稍等后刷新。' : '尚未启动。')
              : routeLabel}
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <span className="font-bold text-slate-800">{routeUsesLanInvite ? '游戏端口：' : '推荐做法：'}</span>
            {routeUsesLanInvite
              ? hostPortUserText
              : userRouteSummary(adapterRoute)}
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <span className="font-bold text-slate-800">{routeUsesLanInvite ? '邀请包：' : '邀请内容：'}</span>
            {routeUsesLanInvite
              ? (lanInviteReady ? `已绑定 ${selectedFriend?.name || '好友'}，可以复制给好友。` : (lanInviteBlockerText || '还没有添加好友。'))
              : '复制说明给好友，不显示局域网邀请包。'}
          </div>
        </div>

        <div
          className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4"
          data-host-room-closure-audit="checklist"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Host closure audit</p>
              <h4 className="mt-1 text-sm font-bold text-slate-900">房主开房自检</h4>
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
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-rose-700">开房遇到问题</span>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white" data-host-diagnostic-technical="details">{hostDiagnosticContext.reasonKind}</span>
                  <span className="rounded-full bg-white/75 px-3 py-1 font-mono text-[11px] font-bold text-slate-500">
                    {new Date(hostDiagnosticContext.createdAt).toLocaleString()}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{hostDiagnosticContext.title}</h4>
                <p className="mt-1 text-xs leading-relaxed">{hostDiagnosticContext.detail}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-3" data-host-diagnostic-technical="details">
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
                    中继地址 {hostDiagnosticContext.supernode || '-'}
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
                {hostDiagnosticContext.reasonKind === 'n2n_config_missing' ? (
                  <div className="mt-3 rounded-xl border border-amber-100 bg-white/80 p-3 text-[11px] leading-relaxed text-slate-700">
                    <p className="font-bold text-slate-900">怎么修复：</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-4">
                      <li>点“去补齐组网信息”，到“加入与组网”页查看房间名、房间密钥和中继地址。</li>
                      <li>如果为空，重新填写一组房间名和密钥，保存后启动组网。</li>
                      <li>回到“推荐方案”，重新检测游戏房间。</li>
                      <li>邀请准备好后点“复制邀请”，把整段内容发给好友，让好友粘贴加入。</li>
                    </ol>
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button onClick={openHostFailureDiagnostic} disabled={Boolean(busy)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  打开诊断报告
                </button>
                {hostDiagnosticContext.nextActionKind === 'network' ? (
                  <button onClick={openHostFailureNextAction} disabled={Boolean(busy)} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-60">
                    去补齐组网信息
                  </button>
                ) : null}
                {hostDiagnosticContext.nextActionKind === 'advanced_tools' ? (
                  <button onClick={openHostFailureNextAction} disabled={Boolean(busy)} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-60">
                    去高级工具
                  </button>
                ) : null}
                <button onClick={copyHostDiagnosticContext} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50">
                  复制失败信息
                </button>
                <button onClick={clearHostFailureDiagnostic} className="rounded-lg border border-rose-100 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-rose-500 hover:bg-white">
                  关闭
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4" data-recommendation-technical-details="details">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 space-y-3">
              <div className="w-full min-w-0">
                <h3 className="flex w-full items-center gap-2 whitespace-nowrap text-sm font-bold text-slate-800">
                  <Gamepad2 className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>当前游戏</span>
                </h3>
                <p className="mt-1 block w-full text-xs leading-relaxed text-slate-500">来自游戏扫描页的当前选择；也可以在下方切换。</p>
              </div>
              <select value={currentGame?.game_id || ''} onChange={(event) => chooseGame(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400">
                {games.map((game) => <option key={game.game_id} value={game.game_id}>{game.display_name} ({game.game_id})</option>)}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">房主联机地址<br /><span className="font-mono font-bold text-slate-800">{n2nConfig?.local_ip || '未读取'}</span></div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">中继地址<br /><span className="font-mono font-bold text-slate-800">{n2nConfig?.supernode || '未读取'}</span></div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">服务端<br /><span className="font-bold text-slate-800">{server?.running ? '运行中' : '未运行'}</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Wifi className="h-4 w-4 text-amber-600" />方案详情</h3>
            <div className="space-y-3">
              {recommendations.length ? recommendations.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">来源={item.backend_id || '手动'}｜启动项={item.launch_profile_id || '-'}｜预估延迟={item.estimated_latency_ms ?? '-'}ms</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.level === 'recommended' ? 'bg-emerald-50 text-emerald-700' : item.level === 'unsupported' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{item.level}</span>
                  </div>
                  {item.required_actions.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">{item.required_actions.map((action) => <li key={action}>{action}</li>)}</ul> : null}
                </article>
              )) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">暂无推荐。请先扫描并选择游戏。</div>}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <input value={port} onChange={(event) => setPort(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
              <button onClick={launch} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60"><Play className="h-4 w-4" />立即启动本地游戏实体</button>
              <button onClick={() => onNavigateTab('network')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Link2 className="h-4 w-4" />加入与组网</button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Users className="h-4 w-4 text-amber-600" />添加好友</h3>
            {!routeUsesLanInvite ? (
              <p className="mb-3 rounded-xl bg-violet-50 p-3 text-xs leading-relaxed text-violet-700">
                当前方式不需要为好友预留地址。这里保留给局域网开房使用。
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-2">
              <input value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="好友昵称" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              <input value={friendIp} onChange={(event) => setFriendIp(event.target.value)} placeholder="10.x.x.x" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400" />
              <button onClick={addFriend} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"><UserPlus className="h-4 w-4" />添加好友</button>
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
                  {friend.last_check_summary ? (
                    <p className="mt-2 text-[11px] text-slate-500" data-recommendation-technical-details="details">
                      {friend.last_check_summary}
                    </p>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => selectFriend(friend)} className="text-xs font-bold text-amber-700">选择此好友</button>
                    <button onClick={() => removeFriend(friend)} className="inline-flex items-center gap-1 text-xs font-bold text-rose-600"><Trash2 className="h-3 w-3" />删除</button>
                  </div>
                </div>
              )) : <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">还没有添加好友。</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              {!routeUsesLanInvite ? <MonitorPlay className="h-4 w-4 text-amber-600" /> : <Server className="h-4 w-4 text-amber-600" />}
              {!routeUsesLanInvite ? '复制给好友' : '复制邀请'}
            </h3>
            {routeUsesLanInvite && !lanInviteReady ? (
              <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">
                邀请还没准备好：{lanInviteBlockerText || '请先完成组网、端口检测和添加好友。'}
              </p>
            ) : null}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              {routeUsesLanInvite ? (
                selectedFriend ? (
                  <>
                    <p className="font-bold text-slate-800">已选择好友：{selectedFriend.name}</p>
                    <p className="mt-1">确认邀请准备好后，直接复制给好友粘贴加入。</p>
                    <p className="mt-2 font-mono text-[11px] text-slate-500">好友联机地址：{selectedFriend.ip}</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-slate-800">还没有添加好友</p>
                    <p className="mt-1">先在上方填入好友昵称和联机地址，再复制邀请包。</p>
                  </>
                )
              ) : (
                <>
                  <p className="font-bold text-slate-800">当前游戏不使用局域网邀请包</p>
                  <p className="mt-1">复制这条联机说明发给好友，按对应方式进入游戏。</p>
                </>
              )}
            </div>
            <div className="mt-3 grid gap-2" data-recommendation-technical-details="details">
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-amber-100">{invitePreview}</pre>
              {lastCheck ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{lastCheck}</p> : null}
              <button onClick={testFriend} disabled={Boolean(busy) || !selectedFriend || !routeUsesLanInvite} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Send className="h-4 w-4" />{routeUsesLanInvite ? '检测好友连接' : '无需端口检测'}</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button onClick={copyHostInvite} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"><ClipboardCopy className="h-4 w-4" />{routeUsesLanInvite ? (lanInviteReady ? '复制邀请包' : selectedFriend ? '补齐后复制邀请包' : '先添加好友') : adapterRoute.inviteLabel}</button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
