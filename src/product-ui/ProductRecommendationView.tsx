import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCopy,
  Gamepad2,
  Link2,
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
import { buildLanInvitePacket } from './invitePacket';
import { productStatusDotClasses, productStatusToneClasses, resolveProductStatusCenter } from './statusCenter';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';

interface ProductRecommendationViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

function selectedFriendOf(friends: ReferenceFriendAllocation[]) {
  return friends.find((item) => item.status === 'selected') ?? friends[0] ?? null;
}

function defaultPort(game: GameSummary | null) {
  return game?.connection_plan?.default_join_port ?? 7777;
}

function requiresDedicatedServer(game: GameSummary | null) {
  return Boolean(game?.connection_plan?.requires_dedicated_server || game?.capabilities?.includes('dedicated_server'));
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

export function ProductRecommendationView({ onTriggerToast, onNavigateTab }: ProductRecommendationViewProps) {
  const runtime = useReferenceRuntime();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGame, setSelectedGameState] = useState<ReferenceSelectedGame | null>(() => getReferenceSelectedGame());
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [n2nConfig, setN2nConfig] = useState<NetworkConfig | null>(null);
  const [server, setServer] = useState<ServerSessionStatus | null>(null);
  const [friends, setFriends] = useState<ReferenceFriendAllocation[]>([]);
  const [friendName, setFriendName] = useState('');
  const [friendIp, setFriendIp] = useState('10.0.8.2');
  const [port, setPort] = useState('7777');
  const [busy, setBusy] = useState('');
  const [lastCheck, setLastCheck] = useState('');
  const [hostPortCheck, setHostPortCheck] = useState('');

  const currentGame = useMemo(() => {
    if (selectedGame) return games.find((game) => game.game_id === selectedGame.game_id) ?? null;
    return games[0] ?? null;
  }, [games, selectedGame]);
  const selectedFriend = selectedFriendOf(friends);
  const status = resolveProductStatusCenter({
    loaded: runtime.loaded,
    snapshot: runtime.snapshot,
    network: runtime.network,
    errors: runtime.errors,
    n2nConfig,
    server,
    requiresServer: requiresDedicatedServer(currentGame),
    hasFriendSlot: Boolean(selectedFriend),
    busy
  });
  const invite = buildLanInvitePacket({
    gameName: currentGame?.display_name || selectedGame?.display_name || '未选择',
    gameId: currentGame?.game_id || selectedGame?.game_id || '未选择',
    n2n: n2nConfig,
    hostVirtualIp: n2nConfig?.local_ip || runtime.network.virtualIp || currentGame?.connection_plan?.default_join_host || '',
    friendVirtualIp: selectedFriend?.ip,
    friendName: selectedFriend?.name,
    port: Number(port) || defaultPort(currentGame),
    serverRunning: Boolean(server?.running),
    friendCheck: selectedFriend?.last_check_summary
  });

  const load = async (label = '刷新推荐方案') => {
    setBusy(label);
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
      setSelectedGameState(selected ?? (nextGames[0] ? setReferenceSelectedGame(nextGames[0]) : null));
      const game = nextGames.find((item) => item.game_id === target) ?? nextGames[0] ?? null;
      if (game?.connection_plan?.default_join_port) setPort(String(game.connection_plan.default_join_port));
      setRecommendations(game ? await recommendPlans(game.game_id).catch(() => []) : []);
      await refreshReferenceRuntime(false).catch(() => undefined);
    } catch (error) {
      onTriggerToast(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
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
      setRecommendations(await recommendPlans(game.game_id));
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
      setFriends(await listReferenceFriendAllocationsBackendFirst());
      onTriggerToast(`已分配好友席位：${friend.name} (${friend.ip})`);
    } catch (error) {
      onTriggerToast(`分配失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const selectFriend = async (friend: ReferenceFriendAllocation) => {
    await selectReferenceFriendAllocationBackendFirst(friend.name, friend.ip);
    setFriends(await listReferenceFriendAllocationsBackendFirst());
    onTriggerToast(`当前邀请对象：${friend.name} (${friend.ip})`);
  };

  const removeFriend = async (friend: ReferenceFriendAllocation) => {
    await removeReferenceFriendAllocationBackendFirst(friend.name, friend.ip);
    setFriends(await listReferenceFriendAllocationsBackendFirst());
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
      setFriends(await listReferenceFriendAllocationsBackendFirst());
      onTriggerToast(`好友连接检测完成：${summary}`);
    } catch (error) {
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
      onTriggerToast('真实邀请包已复制。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
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
      onTriggerToast(`房主端口检测完成：${summary}`);
      return report.reachable;
    } catch (error) {
      const message = `检测失败：${error instanceof Error ? error.message : String(error)}`;
      setHostPortCheck(message);
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
    setBusy(requiresDedicatedServer(currentGame) ? '启动房主服务端' : '启动房主游戏');
    try {
      if (requiresDedicatedServer(currentGame)) {
        const nextServer = await startGameServerSession(gameId, 'server', { port: targetPort });
        setServer(nextServer);
        onTriggerToast(nextServer.running ? '房主服务端已启动。' : `服务端启动返回：${nextServer.message}`);
      } else {
        const preferred = recommendations.find((item) => item.level === 'recommended' && item.launch_profile_id)
          ?? recommendations.find((item) => item.launch_profile_id);
        const result = await launchProfile(gameId, preferred?.launch_profile_id || 'client', { port: targetPort });
        onTriggerToast(result.ok ? result.message : `启动失败：${result.message}`);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      await testHostGamePort();
      await load('刷新房主向导');
    } catch (error) {
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
    if (!selectedFriend) {
      await ensureFriendSlot();
      return;
    }
    await copyInvite();
  };

  const hostSteps: HostWizardStep[] = [
    {
      id: 'select-game',
      title: '选择游戏',
      detail: currentGame ? `当前开房目标：${currentGame.display_name}` : '先扫描或选择要开房的游戏。',
      state: currentGame ? 'done' : 'active',
      actionLabel: currentGame ? '切换游戏' : '去扫描游戏',
      action: () => onNavigateTab('games')
    },
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
      title: requiresDedicatedServer(currentGame) ? '启动服务端' : '启动游戏',
      detail: requiresDedicatedServer(currentGame)
        ? (server?.running ? `服务端运行中：${server.message || '已启动'}` : '当前游戏需要专用服务端，启动后再复制邀请。')
        : (hostPortCheck || '启动游戏后检测本机端口，确认好友可连接的目标端口。'),
      state: requiresDedicatedServer(currentGame)
        ? (server?.running ? 'done' : runtime.network.ready ? 'active' : 'pending')
        : (hostPortCheck.includes('已监听') ? 'done' : runtime.network.ready ? 'active' : 'pending'),
      actionLabel: requiresDedicatedServer(currentGame)
        ? (server?.running ? '检测端口' : '启动服务端')
        : (hostPortCheck.includes('已监听') ? '重新检测端口' : '启动并检测'),
      action: requiresDedicatedServer(currentGame) && server?.running ? testHostGamePort : launchHostEntity,
      disabled: Boolean(busy) || !currentGame
    },
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
      detail: selectedFriend && n2nConfig?.supernode
        ? '邀请包已根据当前游戏、组网参数和好友席位自动生成。'
        : '完成组网和好友 IP 分配后即可复制邀请包。',
      state: selectedFriend && n2nConfig?.supernode ? 'done' : 'pending',
      actionLabel: '复制邀请包',
      action: copyHostInvite,
      disabled: Boolean(busy) || !n2nConfig?.supernode
    }
  ];

  const firstPendingHostStep = hostSteps.find((step) => step.state !== 'done');

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="recommendation">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">推荐方案与向导</h2>
          <p className="mt-1 text-sm text-slate-500">根据已扫描游戏、组网状态和服务端状态，生成可执行的联机方案。</p>
        </div>
        <button onClick={() => load('手动刷新推荐方案')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          {busy || '刷新真实推荐'}
        </button>
      </header>

      <section className={`rounded-2xl border p-4 ${productStatusToneClasses(status.tone)}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${productStatusDotClasses(status.tone)}`} />
              <h3 className="text-sm font-bold">{status.label}</h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{status.detail}</p>
          </div>
          <button
            onClick={() => status.needsNetwork ? onNavigateTab('network') : status.needsServer ? onNavigateTab('terraria') : copyInvite()}
            disabled={Boolean(busy) || (!status.canInvite && !status.needsNetwork && !status.needsServer)}
            className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {status.nextAction}
          </button>
        </div>
      </section>

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
            <span className="font-bold text-slate-800">n2n 自动检测：</span>
            {runtime.network.ready ? 'ACK/PONG 已通过。' : runtime.network.running ? 'edge 正在运行，等待 ACK/PONG。' : '尚未启动。'}
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <span className="font-bold text-slate-800">游戏端口：</span>
            {hostPortCheck || `等待检测 ${Number(port) || defaultPort(currentGame)} 端口。`}
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <span className="font-bold text-slate-800">邀请包：</span>
            {selectedFriend ? `已绑定 ${selectedFriend.name}，可复制给好友。` : '尚未分配好友 IP。'}
          </div>
        </div>
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
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Server className="h-4 w-4 text-amber-600" />邀请包与检测</h3>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-amber-100">{invite}</pre>
            {lastCheck ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{lastCheck}</p> : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={testFriend} disabled={Boolean(busy) || !selectedFriend} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Send className="h-4 w-4" />检测好友连接</button>
              <button onClick={copyInvite} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"><ClipboardCopy className="h-4 w-4" />复制完整邀请凭证包</button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
