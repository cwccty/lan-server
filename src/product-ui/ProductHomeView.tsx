import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Globe,
  Laptop,
  LogIn,
  Network,
  RefreshCw,
  Search,
  Settings,
  Users,
  XCircle
} from 'lucide-react';
import { refreshReferenceRuntime, saveReferenceN2nConfig } from '../reference-adapter/actions';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';
import {
  formatLanInviteMissingFields,
  invitePacketToNetworkConfig,
  parseLanInvitePacket,
  validateLanInvitePacket,
  type LanInvitePacket
} from './invitePacket';
import {
  buildInviteJoinErrorText,
  classifyJoinFailure,
  inviteResultTone,
  joinFromInvitePacket,
  validateInviteNetworkConfig,
  type InviteJoinResult,
} from './inviteJoinFlow';
import { resolveProductStatusCenter } from './statusCenter';
import { toProductSafeMessage } from './productSafeMessage';
import {
  getReferenceSelectedGame,
  subscribeReferenceSelectedGame,
  type ReferenceSelectedGame,
} from '../reference-adapter/selectedGame';

interface ProductHomeViewProps {
  role: 'host' | 'joiner';
  onRoleChange: (role: 'host' | 'joiner') => void;
  onNavigateTab: (tab: any) => void;
  onTriggerToast: (msg: string) => void;
}

function statusProgress(stage: ReturnType<typeof resolveProductStatusCenter>['stage']) {
  if (stage === 'network_ready' || stage === 'ready_to_invite') return 100;
  if (stage === 'starting') return 70;
  if (stage === 'has_problem') return 35;
  if (stage === 'server_missing') return 75;
  return 0;
}

function statusTone(tone: ReturnType<typeof resolveProductStatusCenter>['tone']) {
  if (tone === 'good') return 'text-emerald-700';
  if (tone === 'warn') return 'text-amber-700';
  if (tone === 'danger') return 'text-rose-700';
  return 'text-slate-600';
}

function networkBadge(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (!runtime.loaded) return '正在读取状态';
  if (runtime.network.ready) return '组网已连接';
  if (runtime.network.running) return '组网服务正在运行';
  if (runtime.network.hasError) return '需要诊断';
  return '尚未启动组网';
}

function shortError(runtime: ReturnType<typeof useReferenceRuntime>) {
  return toProductSafeMessage(runtime.errors[0] || runtime.network.label || '');
}

function buildInviteSummary(runtime: ReturnType<typeof useReferenceRuntime>) {
  const lines = [
    '联机助手邀请摘要',
    `状态：${networkBadge(runtime)}`,
    `房主联机地址：${runtime.network.virtualIp || '未读取到'}`,
    `中继地址：${runtime.network.supernode || '未配置'}`,
    `说明：好友需要使用同一邀请包，再在游戏内连接房主联机地址。`
  ];
  return lines.join('\n');
}

export function ProductHomeView({
  role,
  onRoleChange,
  onNavigateTab,
  onTriggerToast
}: ProductHomeViewProps) {
  const runtime = useReferenceRuntime();
  const productStatus = resolveProductStatusCenter({
    loaded: runtime.loaded,
    snapshot: runtime.snapshot,
    network: runtime.network,
    errors: runtime.errors
  });
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = statusProgress(productStatus.stage);
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const currentStatus = productStatus.label;
  const inviteSummary = buildInviteSummary(runtime);
  const hasNetworkIdentity = Boolean(runtime.network.virtualIp || runtime.network.supernode);
  const [homeInviteText, setHomeInviteText] = useState('');
  const [homeInvite, setHomeInvite] = useState<LanInvitePacket | null>(null);
  const [homeInviteResult, setHomeInviteResult] = useState<InviteJoinResult | null>(null);
  const [homeInviteBusy, setHomeInviteBusy] = useState(false);
  const [selectedGame, setSelectedGame] = useState<ReferenceSelectedGame | null>(() => getReferenceSelectedGame());
  const homeInviteValidation = homeInvite ? validateLanInvitePacket(homeInvite) : null;
  const homeInviteMissingText = homeInviteValidation && !homeInviteValidation.ok
    ? formatLanInviteMissingFields(homeInviteValidation.missing)
    : '';
  const homeInviteActionDisabled = homeInviteBusy || !homeInviteValidation?.ok;
  const hasSelectedGame = Boolean(selectedGame?.game_id);

  useEffect(() => subscribeReferenceSelectedGame(setSelectedGame), []);

  const copyInviteSummary = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(inviteSummary);
      onTriggerToast('已复制联机摘要。更完整的好友邀请包请到“开房邀请”生成。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleHomeInviteText = (value: string) => {
    setHomeInviteText(value);
    if (!value.trim()) {
      setHomeInvite(null);
      setHomeInviteResult(null);
      return;
    }

    const packet = parseLanInvitePacket(value);
    setHomeInvite(packet);
    if (packet) {
      const validation = validateLanInvitePacket(packet);
      if (!validation.ok) {
        const reason = classifyJoinFailure(`邀请包缺少：${formatLanInviteMissingFields(validation.missing)}`);
        setHomeInviteResult({
          phase: 'failed',
          title: '检测到邀请包，但信息不完整',
          detail: `${reason.detail} 缺少：${formatLanInviteMissingFields(validation.missing)}。`,
          packet,
          error: `missing_fields=${validation.missing.join(',')}`,
          reason
        });
        return;
      }
      setHomeInviteResult({
        phase: 'idle',
        title: '检测到邀请包',
        detail: '可以先只填入信息，也可以直接保存并加入。',
        packet
      });
    } else if (value.trim()) {
      setHomeInvite(null);
      setHomeInviteResult(null);
    }
  };

  const fillInviteParameters = async () => {
    if (!homeInvite) {
      onTriggerToast('没有检测到可用邀请包。');
      return;
    }
    setHomeInviteBusy(true);
    try {
      const config = invitePacketToNetworkConfig(homeInvite);
      const missing = validateInviteNetworkConfig(config);
      if (missing.length) {
        throw new Error(`邀请包缺少：${formatLanInviteMissingFields(missing)}`);
      }
      const saved = await saveReferenceN2nConfig(config);
      if (!saved.ok) throw new Error(saved.message);
      await refreshReferenceRuntime(false);
      setHomeInviteResult({
        phase: 'filled',
        title: '邀请信息已保存',
        detail: '已把邀请信息保存到本机，但尚未启动组网。',
        packet: homeInvite
      });
      onTriggerToast('已保存邀请信息；如需确认可打开加入与组网页。');
    } catch (error) {
      const reason = classifyJoinFailure(error, runtime.network.label);
      setHomeInviteResult({
        phase: 'failed',
        title: reason.title,
        detail: reason.detail,
        packet: homeInvite,
        error: error instanceof Error ? error.message : String(error),
        reason
      });
      onTriggerToast(`保存邀请信息失败：${reason.title}`);
    } finally {
      setHomeInviteBusy(false);
    }
  };

  const startHomeInvite = async () => {
    if (!homeInvite) {
      onTriggerToast('没有检测到可用邀请包。');
      return;
    }
    setHomeInviteBusy(true);
    setHomeInviteResult({
      phase: 'joining',
      title: '正在加入好友房间',
      detail: '正在保存邀请信息并启动组网，请等待状态确认。',
      packet: homeInvite
    });
    try {
      const result = await joinFromInvitePacket(homeInvite, {
        connectHost: homeInvite.hostVirtualIp,
        localIp: homeInvite.friendVirtualIp,
        supernode: homeInvite.supernode,
        roomName: homeInvite.roomName,
        gamePort: homeInvite.gamePort,
        runtimeLabel: runtime.network.label,
        runtimeErrors: runtime.errors
      });
      setHomeInviteResult(result);
      if (result.phase === 'joined') onTriggerToast('已加入好友房间。请在游戏内连接房主联机地址和端口。');
      else if (result.phase === 'pending') onTriggerToast('组网已启动，正在等待中继确认。');
      else if (result.phase === 'failed') onTriggerToast(`加入失败：${result.title}`);
    } catch (error) {
      const reason = classifyJoinFailure(error, runtime.network.label);
      setHomeInviteResult({
        phase: 'failed',
        title: reason.title,
        detail: reason.detail,
        packet: homeInvite,
        error: error instanceof Error ? error.message : String(error),
        reason
      });
      onTriggerToast(`加入失败：${reason.title}`);
    } finally {
      setHomeInviteBusy(false);
    }
  };

  const copyHomeInviteError = async () => {
    if (!homeInviteResult) return;
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(buildInviteJoinErrorText(homeInviteResult, {
        connectHost: homeInvite?.hostVirtualIp,
        localIp: homeInvite?.friendVirtualIp,
        supernode: homeInvite?.supernode,
        roomName: homeInvite?.roomName,
        gamePort: homeInvite?.gamePort,
        runtimeLabel: runtime.network.label,
        runtimeErrors: runtime.errors
      }));
      onTriggerToast('已复制加入状态信息，可发给房主。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const checks = [
    {
      title: '组网状态',
      ok: runtime.network.ready || runtime.network.running,
      detail: runtime.network.label || '尚未读取到组网状态。'
    },
    {
      title: '联机地址',
      ok: Boolean(runtime.network.virtualIp),
      detail: runtime.network.virtualIp ? `当前联机地址：${runtime.network.virtualIp}` : '未读取到联机地址，先到加入与组网页保存并启动。'
    },
    {
      title: '中继地址',
      ok: Boolean(runtime.network.supernode),
      detail: runtime.network.supernode ? `当前中继地址：${runtime.network.supernode}` : '未配置或未读取到中继地址。'
    }
  ];

  const focusHomeInviteInput = () => {
    const input = document.getElementById('home-invite-packet') as HTMLTextAreaElement | null;
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus();
  };

  const hostPrimarySteps = [
    {
      title: '选游戏',
      detail: selectedGame ? `已选择：${selectedGame.display_name}` : '扫描本机游戏，套用已有方案。',
      action: selectedGame ? '切换游戏' : '扫描游戏',
      onClick: () => onNavigateTab('games'),
      done: hasSelectedGame,
    },
    {
      title: '启动组网',
      detail: runtime.network.ready ? '组网已连接，可以继续开房。' : '保存邀请信息并启动组网。',
      action: runtime.network.ready ? '查看组网' : '启动组网',
      onClick: () => onNavigateTab('network'),
      done: runtime.network.ready,
    },
    {
      title: '复制邀请',
      detail: hasSelectedGame && runtime.network.ready ? '进入开房邀请，检测游戏房间后复制。' : '先选游戏并确认组网，再生成邀请。',
      action: '开房邀请',
      onClick: () => onNavigateTab('protocol'),
      done: productStatus.canInvite && hasSelectedGame,
    },
  ];

  const joinerPrimarySteps = [
    {
      title: '粘贴邀请',
      detail: homeInvite ? '已识别邀请包。' : '把房主发来的完整邀请包粘贴到下方。',
      action: '粘贴邀请',
      onClick: focusHomeInviteInput,
      done: Boolean(homeInvite),
    },
    {
      title: '启动组网',
      detail: homeInviteResult?.phase === 'joined' ? '组网已连接。' : '识别邀请后保存并加入。',
      action: '保存并加入',
      onClick: startHomeInvite,
      done: runtime.network.ready || homeInviteResult?.phase === 'joined',
    },
    {
      title: '进入游戏',
      detail: homeInvite?.hostVirtualIp
        ? `连接 ${homeInvite.hostVirtualIp}:${homeInvite.gamePort || 7777}`
        : '组网成功后连接房主联机地址。',
      action: '查看状态',
      onClick: () => onNavigateTab(runtime.network.hasError ? 'diagnostics' : 'network'),
      done: homeInviteResult?.phase === 'joined',
    },
  ];

  const primarySteps = role === 'host' ? hostPrimarySteps : joinerPrimarySteps;
  const roleGuide = role === 'host'
    ? {
      title: '房主路径',
      summary: '先选游戏和启动组网，再打开游戏或专用服务端创建房间，最后复制完整邀请包发给好友。',
      steps: ['选择游戏方案', '启动组网服务', '打开游戏或服务端并创建房间', '检测端口后复制邀请包'],
      button: '打开开房邀请',
      tab: 'protocol' as const,
    }
    : {
      title: '加入者路径',
      summary: '先粘贴房主发来的完整邀请包，保存并加入组网，组网成功后再打开游戏连接提示里的地址。',
      steps: ['粘贴完整邀请包', '保存并加入组网', '打开游戏的局域网/IP 直连入口', '连接房主联机地址和端口'],
      button: '粘贴邀请包',
      tab: 'network' as const,
    };
  const topologySteps = [
    { label: '本机', detail: runtime.network.virtualIp || '等待联机地址', state: runtime.loaded ? '已读取' : '读取中' },
    { label: '组网服务/中继', detail: runtime.network.supernode || '尚未配置中继', state: runtime.network.running || runtime.network.ready ? '运行中' : '未开始' },
    { label: role === 'host' ? '好友/房间' : '房主/房间', detail: role === 'host' ? '复制邀请后等待好友加入' : '加入后在游戏内连接房主', state: runtime.network.ready ? '可继续' : '待组网' },
  ];
  const solutionCategories = [
    ['虚拟局域网', '适合 IP 直连、专用服务端、局域网房间'],
    ['一键开服', 'Terraria 已接入，更多游戏逐步补齐'],
    ['桥接工具', '端口代理、UDP 广播桥用于特殊发现或端口转发'],
    ['远程同屏', 'Steam Remote Play、Sunshine/Moonlight 适合本地合作游戏'],
    ['Steam 中继/P2P', 'v0.3.0 ConnectTool 兼容模式，可检测并启动用户自备 helper'],
  ];

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="home">
      <div className="mb-4">
        <h2 className="font-heading text-2xl font-bold text-slate-800">开始联机</h2>
        <p className="font-sans text-sm text-slate-500 mt-1">
          选择“我要开房”或“我要加入”，按当前卡片里的下一步操作即可。
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr]" data-home-user-overview="v020">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">{roleGuide.title}，现在该做什么</h3>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">{roleGuide.summary}</p>
            </div>
            <button
              onClick={() => roleGuide.tab === 'protocol' ? onNavigateTab('protocol') : focusHomeInviteInput()}
              className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              {roleGuide.button}
            </button>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {roleGuide.steps.map((step, index) => (
              <div key={step} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-black text-slate-700 shadow-sm">{index + 1}</span>
                <p className="text-xs font-bold text-slate-800">{step}</p>
              </div>
            ))}
          </div>
          {homeInviteValidation && !homeInviteValidation.ok ? (
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">
              邀请信息不完整：缺少 {homeInviteMissingText}。请让房主重新复制完整邀请包；房主也可以检查组网设置后重新生成邀请。
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">网络拓扑状态</h3>
            <button onClick={() => onNavigateTab(runtime.network.hasError ? 'diagnostics' : 'network')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
              {runtime.network.hasError ? '去诊断修复' : '查看组网'}
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {topologySteps.map((item, index) => (
              <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 1 && runtime.network.hasError ? 'bg-rose-100 text-rose-700' : runtime.network.ready || index === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">{item.label}</p>
                  <p className="truncate text-[11px] text-slate-500">{item.detail}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">{item.state}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-home-solution-overview="summary">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">有哪些联机方式可选</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">普通用户看推荐方式即可；排查时再展开特殊工具和方案库详情。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onNavigateTab('solutions')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">查看方案库</button>
            <button onClick={() => onNavigateTab('advanced_tools')} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">多联机方式</button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {solutionCategories.map(([title, detail]) => (
            <div key={title} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-800">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm flex min-h-[420px] flex-col justify-between col-span-1 lg:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-[240px] h-[240px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-lg font-bold text-slate-800 mb-2">你现在要做什么？</h3>
                <p className="font-sans text-xs text-slate-500 mb-5">
                  房主负责开房并发邀请，加入者只需要粘贴邀请包。
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${runtime.network.ready ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : runtime.network.hasError ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                {networkBadge(runtime)}
              </span>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 mb-5 w-fit">
              <button
                onClick={() => {
                  onRoleChange('host');
                  onTriggerToast('已切换至“我是主机”。请先完成组网，再启动游戏房间或服务端。');
                }}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-sans text-xs font-semibold transition-all cursor-pointer ${
                  role === 'host'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Laptop className="w-4 h-4" />
                我要开房
              </button>
              <button
                onClick={() => {
                  onRoleChange('joiner');
                  onTriggerToast('已切换至“我是加入者”。请向房主索要邀请包或联机地址。');
                }}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-sans text-xs font-semibold transition-all cursor-pointer ${
                  role === 'joiner'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Users className="w-4 h-4" />
                我要加入
              </button>
            </div>

            {role === 'host' ? (
              <div className={`mb-4 rounded-2xl border p-4 ${hasSelectedGame ? 'border-emerald-100 bg-emerald-50/70' : 'border-amber-100 bg-amber-50/70'}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${hasSelectedGame ? 'bg-emerald-500 text-white' : 'bg-white text-amber-700 ring-1 ring-amber-100'}`}>
                      {hasSelectedGame ? <CheckCircle2 className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {hasSelectedGame ? `已选择游戏：${selectedGame?.display_name}` : '还没有选择游戏'}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {hasSelectedGame ? '可以继续启动组网，然后到“开房邀请”里检测游戏房间并复制邀请包。' : '先选择要联机的游戏，首页才会把第一步标记为完成。'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigateTab('games')}
                    className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 ring-1 ring-black/5 hover:bg-slate-50"
                  >
                    {hasSelectedGame ? '重新选择' : '去选择游戏'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              {primarySteps.map((step, index) => (
                <div key={step.title} className={`rounded-xl border p-4 ${step.done ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-100 bg-slate-50/80'}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${step.done ? 'bg-emerald-500 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>
                      {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{step.title}</span>
                  </div>
                  <p className="min-h-[44px] text-[11px] leading-relaxed text-slate-500">{step.detail}</p>
                  <button
                    onClick={step.onClick}
                    disabled={role === 'joiner' && step.title === '启动组网' && homeInviteActionDisabled}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {step.action}
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            {role === 'host' ? (
              <>
                <button
                  onClick={() => onNavigateTab('games')}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-sans text-xs font-semibold transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  扫描本地游戏
                </button>
                <button
                  onClick={() => onNavigateTab('network')}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-sans text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  {runtime.network.ready ? '查看组网' : '启动组网'}
                </button>
                <button
                  onClick={() => onNavigateTab('protocol')}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-sans text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  开房邀请
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={focusHomeInviteInput}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-sans text-xs font-semibold transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  粘贴邀请包
                </button>
                <button
                  onClick={startHomeInvite}
                  disabled={homeInviteActionDisabled}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-sans text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Settings className="w-4 h-4" />
                  保存并加入
                </button>
                <button
                  onClick={() => onNavigateTab(runtime.network.hasError ? 'diagnostics' : 'network')}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-sans text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Activity className="w-4 h-4" />
                  {runtime.network.hasError ? '打开诊断' : '查看状态'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm flex min-h-[420px] flex-col items-center justify-center text-center relative overflow-hidden">
          <h3 className="font-heading text-sm font-bold text-slate-800 mb-5 w-full text-left">当前状态</h3>

          <div className="relative w-44 h-44 mb-4 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle className="text-slate-100" strokeWidth="7" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
              <circle
                className={`${runtime.network.ready ? 'text-emerald-500' : runtime.network.hasError ? 'text-rose-500' : 'text-amber-500'} transition-all duration-500`}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r={radius}
                cx="50"
                cy="50"
              />
            </svg>
            <div className="absolute flex max-w-[108px] flex-col items-center justify-center px-2">
              <span className={`whitespace-nowrap font-heading text-lg font-bold leading-tight ${statusTone(productStatus.tone)}`}>{currentStatus}</span>
              <span className="font-sans text-[10px] text-slate-400 font-medium">本地检测</span>
            </div>
          </div>

          <p className="font-sans text-xs text-slate-500 mt-2 leading-relaxed">
            {productStatus.detail || (runtime.loaded ? shortError(runtime) || '本地状态已读取。' : '正在读取本地联机状态。')}
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className={`rounded-2xl border p-5 shadow-sm ${role === 'host' && hasSelectedGame ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${role === 'host' && hasSelectedGame ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {role === 'host' && hasSelectedGame ? <CheckCircle2 className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{role === 'host' ? '当前游戏' : '邀请包'}</p>
              <p className="mt-1 truncate text-xs text-slate-500">
                {role === 'host'
                  ? (selectedGame?.display_name || '未选择')
                  : (homeInvite?.gameName || '等待房主邀请包')}
              </p>
            </div>
          </div>
          <button
            onClick={() => role === 'host' ? onNavigateTab('games') : focusHomeInviteInput()}
            className="mt-4 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {role === 'host' ? (hasSelectedGame ? '切换游戏' : '选择游戏') : '粘贴邀请包'}
          </button>
        </div>

        <div className={`rounded-2xl border p-5 shadow-sm ${runtime.network.ready ? 'border-emerald-100 bg-emerald-50/70' : 'border-amber-100 bg-amber-50/60'}`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${runtime.network.ready ? 'bg-emerald-500 text-white' : 'bg-white text-amber-700 ring-1 ring-amber-100'}`}>
              <Network className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">组网状态</p>
              <p className="mt-1 text-xs text-slate-500">{runtime.network.ready ? '已连接，可以继续下一步。' : '未连接时先启动组网。'}</p>
              <p className="mt-2 truncate font-mono text-[11px] text-slate-500">{runtime.network.virtualIp || '联机地址暂未读取'}</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('network')}
            className="mt-4 w-full rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {runtime.network.ready ? '查看组网' : '启动组网'}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              {role === 'host' ? <Globe className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">下一步</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {role === 'host'
                  ? (hasSelectedGame && runtime.network.ready ? '进入开房邀请，检测游戏房间并复制邀请包。' : '先完成选游戏和组网。')
                  : (homeInvite ? '保存并加入后，进入游戏连接房主地址。' : '先粘贴房主发来的邀请包。')}
              </p>
            </div>
          </div>
          <button
            onClick={() => role === 'host' ? onNavigateTab('protocol') : (homeInvite ? startHomeInvite() : focusHomeInviteInput())}
            disabled={role === 'joiner' && homeInviteActionDisabled && Boolean(homeInvite)}
            className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {role === 'host' ? '打开开房邀请' : homeInvite ? '保存并加入' : '粘贴邀请'}
          </button>
        </div>
      </section>

      {role === 'joiner' ? (
        <section className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-amber-950">
                <LogIn className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">好友邀请包一键加入</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  粘贴房主发来的邀请包。识别成功后可以先保存信息，或直接保存并加入。
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('network')}
              className="w-fit rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-white"
            >
              打开详细组网中心
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <textarea
              id="home-invite-packet"
              value={homeInviteText}
              onChange={(event) => handleHomeInviteText(event.target.value)}
              placeholder="粘贴房主发来的完整邀请包 ..."
              className="min-h-36 w-full resize-y rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700 outline-none focus:border-amber-400"
            />

            <div className="space-y-3">
              {homeInvite ? (
                <div className="rounded-xl border border-amber-200 bg-white p-3 text-xs text-slate-600">
                  <p className="font-bold text-slate-800">已检测到邀请</p>
                  <p className="mt-1 leading-relaxed">
                    {homeInvite.gameName || '未知游戏'}<br />
                    房主联机地址：<span className="font-mono">{homeInvite.hostVirtualIp || '-'}</span> · 端口：<span className="font-mono">{homeInvite.gamePort || 7777}</span><br />
                    我的联机地址：<span className="font-mono">{homeInvite.friendVirtualIp || '-'}</span>
                  </p>
                  {!homeInviteValidation?.ok ? (
                    <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-2 text-[11px] leading-relaxed text-rose-700">
                      信息不完整：缺少 {homeInviteMissingText}。请让房主重新复制邀请包，或到组网页手动补齐后再启动。
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={fillInviteParameters}
                      disabled={homeInviteActionDisabled}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      只填入信息
                    </button>
                    <button
                      onClick={startHomeInvite}
                      disabled={homeInviteActionDisabled}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {homeInviteBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                      {homeInviteBusy ? '处理中...' : '保存并加入'}
                    </button>
                  </div>
                </div>
              ) : homeInviteText.trim() ? (
                <div className="rounded-xl border border-amber-200 bg-white/80 p-3 text-xs leading-relaxed text-amber-700">
                  暂未识别到邀请包。请确认你粘贴的是房主复制的完整内容。
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-amber-200 bg-white/60 p-3 text-xs leading-relaxed text-slate-500">
                  等待粘贴邀请包。你不需要手动理解房间名、密钥或中继地址。
                </div>
              )}

              {homeInviteResult ? (
                <div className={`rounded-xl border p-3 text-xs ${inviteResultTone(homeInviteResult.phase)}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-80">加入结果</span>
                  </div>
                  <div className="flex items-start gap-2">
                    {homeInviteResult.phase === 'joined' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : homeInviteResult.phase === 'failed' ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <RefreshCw className={`mt-0.5 h-4 w-4 shrink-0 ${homeInviteResult.phase === 'joining' ? 'animate-spin' : ''}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{homeInviteResult.title}</p>
                      <p className="mt-1 leading-relaxed">{homeInviteResult.detail}</p>
                      {homeInviteResult.reason ? <p className="mt-1 text-[11px]">下一步：{homeInviteResult.reason.nextAction}</p> : null}
                    </div>
                  </div>
                  {homeInviteResult.phase === 'failed' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => onNavigateTab('diagnostics')} className="rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-100 hover:bg-white">
                        进入诊断
                      </button>
                      <button onClick={copyHomeInviteError} className="rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-100 hover:bg-white">
                        复制错误给房主
                      </button>
                    </div>
                  ) : homeInviteResult.phase === 'pending' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => onNavigateTab('diagnostics')} className="rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-100 hover:bg-white">
                        等待中诊断
                      </button>
                      <button onClick={copyHomeInviteError} className="rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-100 hover:bg-white">
                        复制状态给房主
                      </button>
                    </div>
                  ) : homeInviteResult.phase === 'joined' ? (
                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-emerald-800 ring-1 ring-emerald-100">
                        下一步：打开游戏的局域网/IP 直连入口，连接房主联机地址
                        <span className="font-mono"> {homeInvite?.hostVirtualIp || '未读取'} </span>
                        和端口 <span className="font-mono">{homeInvite?.gamePort || 7777}</span>。
                      </div>
                      <button onClick={() => onNavigateTab('network')} className="w-full rounded-lg bg-white/80 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 hover:bg-white">
                        查看组网状态
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {role === 'host' ? (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-home-secondary-guide="host">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">房主开房向导</h3>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                按“选游戏 → 启动组网 → 启动服务端/游戏 → 添加好友 → 复制邀请包”的顺序走，缺什么会在推荐方案页直接提示。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onNavigateTab('protocol')}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                打开开房向导
              </button>
              <button
                onClick={() => onNavigateTab('network')}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                先配置组网
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-5">
            {[
              ['1', '选择游戏', '从扫描结果套用游戏方案'],
              ['2', '启动组网', runtime.network.ready ? '组网已连接' : '等待中继确认'],
              ['3', '启动游戏实体', '服务端或房主游戏进程'],
              ['4', '好友地址', '为好友预留联机地址'],
              ['5', '邀请包', '复制给好友一键加入'],
            ].map(([step, title, detail]) => (
              <div key={step} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-700 shadow-sm">{step}</div>
                <p className="text-xs font-bold text-slate-800">{title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-home-technical-status="topology">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm col-span-1 lg:col-span-2 relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-heading text-sm font-bold text-slate-800">网络拓扑状态</h3>
            <span className={`px-3 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 font-mono ${
              runtime.network.ready
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50'
                : runtime.network.hasError
                  ? 'bg-rose-50 text-rose-700 border-rose-100/50'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${runtime.network.ready ? 'bg-emerald-500 animate-pulse' : runtime.network.hasError ? 'bg-rose-500' : 'bg-slate-400'}`} />
              {networkBadge(runtime)}
            </span>
          </div>

          <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-8 flex items-center justify-center min-h-[200px]">
            <div className="flex items-center gap-4 md:gap-8 w-full max-w-lg mx-auto relative justify-between">
              <div className="flex flex-col items-center gap-2">
                <div className={`w-14 h-14 rounded-full shadow-sm bg-white flex items-center justify-center border-2 ${role === 'host' ? 'border-amber-500' : 'border-slate-200'}`}>
                  <Laptop className={`w-6 h-6 ${role === 'host' ? 'text-amber-600' : 'text-slate-400'}`} />
                </div>
                <span className="font-sans text-xs text-slate-600 font-semibold">{role === 'host' ? '本机 (主机)' : '本机 (加入者)'}</span>
                <span className="font-mono text-[10px] text-slate-400">{runtime.network.virtualIp || '未读取到联机地址'}</span>
              </div>

              <div className={`flex-1 h-[2px] ${runtime.network.running ? 'bg-amber-500/30' : 'bg-slate-200'} relative`}>
                {runtime.network.running && <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-transparent animate-pulse" />}
              </div>

              <button className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => onNavigateTab('network')}>
                <div className="w-16 h-16 bg-slate-800 rounded-xl shadow-md flex items-center justify-center text-white relative transition-transform group-hover:scale-105">
                  <Network className="w-7 h-7" />
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-amber-950 font-bold text-[9px] px-1.5 py-0.5 rounded-md">
                    {runtime.network.ready ? '已确认' : runtime.network.running ? '连接中' : '待确认'}
                  </span>
                </div>
                <span className="font-sans text-xs text-slate-500 font-medium">中继地址</span>
                <span className="font-mono text-[10px] text-slate-400">{runtime.network.supernode || '未配置中继地址'}</span>
              </button>

              <div className="flex-1 h-[2px] border-t border-dashed border-slate-300" />

              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400">
                  <Users className="w-5 h-5" />
                </div>
                <span className="font-sans text-xs text-slate-500">联机好友群组</span>
                <span className="font-sans text-[10px] text-slate-400">等待邀请包...</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <h3 className="font-heading text-sm font-bold text-slate-800 mb-4">排查检查单</h3>

          <div className="space-y-4 mb-6 flex-1">
            {checks.map((item) => (
              <div key={item.title}>
                <div className="flex items-start gap-3">
                  {item.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />}
                  <div>
                    <p className="font-sans text-xs text-slate-700 font-semibold">{item.title}</p>
                    <p className="font-sans text-[10px] text-slate-400 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
                <div className="w-full h-px bg-slate-100 mt-4" />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={copyInviteSummary}
              disabled={!hasNetworkIdentity}
              className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-left disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-between gap-3"
            >
              <span className="font-mono text-[11px] text-amber-900 truncate">
                {hasNetworkIdentity ? '复制联机摘要' : '先完成组网后再复制摘要'}
              </span>
              <Copy className="w-3.5 h-3.5 text-amber-700" />
            </button>
            <button
              onClick={() => onNavigateTab(runtime.network.hasError ? 'diagnostics' : 'protocol')}
              className="w-full border border-slate-200 hover:bg-slate-50 hover:text-slate-800 py-3 rounded-lg font-sans text-xs font-semibold text-slate-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              {runtime.network.hasError ? (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  打开诊断报告
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  进入推荐方案
                </>
              )}
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
