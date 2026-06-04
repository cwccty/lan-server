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
import { refreshReferenceRuntime } from '../reference-adapter/actions';

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

function buildInvite(input: {
  game: GameSummary | null;
  selectedGame: ReferenceSelectedGame | null;
  n2n: NetworkConfig | null;
  server: ServerSessionStatus | null;
  friend: ReferenceFriendAllocation | null;
  port: number;
}) {
  return [
    '[联机助手真实邀请包]',
    `游戏：${input.game?.display_name || input.selectedGame?.display_name || '未选择'}`,
    `游戏 ID：${input.game?.game_id || input.selectedGame?.game_id || '未选择'}`,
    `房主虚拟 IP：${input.n2n?.local_ip || input.game?.connection_plan?.default_join_host || '未读取'}`,
    `好友预留 IP：${input.friend ? `${input.friend.ip} (${input.friend.name})` : '未分配'}`,
    `Supernode：${input.n2n?.supernode || '未读取'}`,
    `房间名：${input.n2n?.room_name || '未读取'}`,
    `游戏端口：${input.port}`,
    `服务端状态：${input.server?.running ? '运行中' : '未运行'}`,
    `好友检测：${input.friend?.last_check_summary || '未检测'}`,
    '',
    '好友操作：使用同一 n2n 房间/密钥加入虚拟网后，在游戏内连接房主虚拟 IP 和端口。'
  ].join('\n');
}

export function ProductRecommendationView({ onTriggerToast, onNavigateTab }: ProductRecommendationViewProps) {
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

  const currentGame = useMemo(() => {
    if (selectedGame) return games.find((game) => game.game_id === selectedGame.game_id) ?? null;
    return games[0] ?? null;
  }, [games, selectedGame]);
  const selectedFriend = selectedFriendOf(friends);
  const invite = buildInvite({
    game: currentGame,
    selectedGame,
    n2n: n2nConfig,
    server,
    friend: selectedFriend,
    port: Number(port) || defaultPort(currentGame)
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

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="recommendation">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">推荐方案与向导</h2>
          <p className="mt-1 text-sm text-slate-500">正式 Product 页面，直接读取真实推荐、n2n 配置、服务端状态、好友席位和邀请包。</p>
        </div>
        <button onClick={() => load('手动刷新推荐方案')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          {busy || '刷新真实推荐'}
        </button>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Gamepad2 className="h-4 w-4 text-amber-600" />真实推荐目标</h3>
                <p className="mt-1 text-xs text-slate-500">来自游戏扫描页选中的真实游戏，也可在这里切换。</p>
              </div>
              <select value={currentGame?.game_id || ''} onChange={(event) => chooseGame(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400">
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
