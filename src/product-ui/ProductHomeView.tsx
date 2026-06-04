import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Copy,
  Globe,
  Laptop,
  Network,
  Search,
  Settings,
  Users,
  XCircle
} from 'lucide-react';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';

interface ProductHomeViewProps {
  role: 'host' | 'joiner';
  onRoleChange: (role: 'host' | 'joiner') => void;
  onNavigateTab: (tab: any) => void;
  onTriggerToast: (msg: string) => void;
}

function statusText(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (!runtime.loaded) return '读取中';
  if (runtime.network.ready) return '已连接';
  if (runtime.network.running) return '运行中';
  if (runtime.network.hasError) return '需诊断';
  return '待配置';
}

function statusProgress(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (!runtime.loaded) return 16;
  if (runtime.network.ready) return 100;
  if (runtime.network.running) return 70;
  if (runtime.network.hasError) return 35;
  if (runtime.network.supernode || runtime.network.virtualIp) return 45;
  return 20;
}

function statusTone(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (!runtime.loaded) return 'text-slate-500';
  if (runtime.network.ready) return 'text-emerald-700';
  if (runtime.network.running) return 'text-amber-700';
  if (runtime.network.hasError) return 'text-rose-700';
  return 'text-slate-600';
}

function networkBadge(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (!runtime.loaded) return '正在读取真实状态';
  if (runtime.network.ready) return '虚拟组网已连接';
  if (runtime.network.running) return 'n2n 正在运行';
  if (runtime.network.hasError) return '需要诊断';
  return '尚未启动组网';
}

function shortError(runtime: ReturnType<typeof useReferenceRuntime>) {
  return runtime.errors[0] || runtime.network.label || '';
}

function buildInviteSummary(runtime: ReturnType<typeof useReferenceRuntime>) {
  const lines = [
    '联机助手邀请摘要',
    `状态：${networkBadge(runtime)}`,
    `房主虚拟 IP：${runtime.network.virtualIp || '未读取到'}`,
    `Supernode：${runtime.network.supernode || '未配置'}`,
    `说明：好友需要进入同一房间/密钥后，再在游戏内连接房主虚拟 IP 或邀请包指定地址。`
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
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = statusProgress(runtime);
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const currentStatus = statusText(runtime);
  const inviteSummary = buildInviteSummary(runtime);
  const hasNetworkIdentity = Boolean(runtime.network.virtualIp || runtime.network.supernode);

  const copyInviteSummary = async () => {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(inviteSummary);
      onTriggerToast('已复制真实联机摘要。更完整的好友邀请包请到“推荐方案”生成。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const checks = [
    {
      title: '虚拟局域网状态',
      ok: runtime.network.ready || runtime.network.running,
      detail: runtime.network.label || '尚未读取到 n2n 运行状态。'
    },
    {
      title: '虚拟 IP',
      ok: Boolean(runtime.network.virtualIp),
      detail: runtime.network.virtualIp ? `当前真实虚拟 IP：${runtime.network.virtualIp}` : '未读取到虚拟 IP，先到通用组网中心保存并启动。'
    },
    {
      title: 'Supernode',
      ok: Boolean(runtime.network.supernode),
      detail: runtime.network.supernode ? `当前 Supernode：${runtime.network.supernode}` : '未配置或未读取到 Supernode。'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="font-heading text-2xl font-bold text-slate-800">桌面大厅</h2>
        <p className="font-sans text-sm text-slate-500 mt-1">
          这里显示真实后端状态，不再展示参考图中的模拟延迟、模拟进度或固定节点。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between col-span-1 lg:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-[240px] h-[240px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-lg font-bold text-slate-800 mb-2">选择联机角色</h3>
                <p className="font-sans text-xs text-slate-500 mb-6">
                  主机负责启动游戏房间或服务端；加入者通过主机的虚拟 IP 接入。当前状态来自 Tauri 后端快照。
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${runtime.network.ready ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : runtime.network.hasError ? 'border-rose-100 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                {networkBadge(runtime)}
              </span>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 mb-8 w-fit">
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
                我是主机 (Host)
              </button>
              <button
                onClick={() => {
                  onRoleChange('joiner');
                  onTriggerToast('已切换至“我是加入者”。请向房主索要邀请包或虚拟 IP。');
                }}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-sans text-xs font-semibold transition-all cursor-pointer ${
                  role === 'joiner'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Users className="w-4 h-4" />
                我是加入者 (Joiner)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => onNavigateTab('network')}
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-sans text-xs font-semibold transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              打开通用组网中心
            </button>
            <button
              onClick={() => onNavigateTab('games')}
              className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-sans text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              扫描本地游戏
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
          <h3 className="font-heading text-sm font-bold text-slate-800 mb-6 w-full text-left">真实就绪状态</h3>

          <div className="relative w-32 h-32 mb-4 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle className="text-slate-100" strokeWidth="8" stroke="currentColor" fill="transparent" r={radius} cx="50" cy="50" />
              <circle
                className={`${runtime.network.ready ? 'text-emerald-500' : runtime.network.hasError ? 'text-rose-500' : 'text-amber-500'} transition-all duration-500`}
                strokeWidth="8"
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
            <div className="absolute flex flex-col items-center justify-center px-2">
              <span className={`font-heading text-xl font-bold ${statusTone(runtime)}`}>{currentStatus}</span>
              <span className="font-sans text-[10px] text-slate-400 font-medium">后端状态</span>
            </div>
          </div>

          <p className="font-sans text-xs text-slate-500 mt-2 leading-relaxed">
            {runtime.loaded ? shortError(runtime) || '真实后端状态已读取。' : '正在读取 n2n、服务端和代理状态。'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <span className="font-mono text-[10px] text-slate-400">{runtime.network.virtualIp || '未读取到虚拟 IP'}</span>
              </div>

              <div className={`flex-1 h-[2px] ${runtime.network.running ? 'bg-amber-500/30' : 'bg-slate-200'} relative`}>
                {runtime.network.running && <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-transparent animate-pulse" />}
              </div>

              <button className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => onNavigateTab('network')}>
                <div className="w-16 h-16 bg-slate-800 rounded-xl shadow-md flex items-center justify-center text-white relative transition-transform group-hover:scale-105">
                  <Network className="w-7 h-7" />
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-amber-950 font-bold text-[9px] px-1.5 py-0.5 rounded-md">
                    {runtime.network.ready ? 'ACK' : runtime.network.running ? 'RUN' : '待测'}
                  </span>
                </div>
                <span className="font-sans text-xs text-slate-500 font-medium">超级节点 (Supernode)</span>
                <span className="font-mono text-[10px] text-slate-400">{runtime.network.supernode || '未配置 Supernode'}</span>
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
          <h3 className="font-heading text-sm font-bold text-slate-800 mb-4">真实检查单</h3>

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
                {hasNetworkIdentity ? '复制真实联机摘要' : '先完成组网后再复制摘要'}
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
