import { useState, useEffect } from 'react';
import { NetworkStatus } from '../types';
import {
  Laptop,
  Network,
  CheckCircle2,
  Lock,
  PlusCircle,
  Users,
  Terminal,
  Activity,
  Globe,
  Settings,
  HelpCircle,
  Copy,
  ChevronRight
} from 'lucide-react';

interface HomeViewProps {
  netStatus: NetworkStatus;
  role: 'host' | 'joiner';
  onRoleChange: (role: 'host' | 'joiner') => void;
  onNavigateTab: (tab: any) => void;
  onTriggerToast: (msg: string) => void;
  localIp: string;
  latency?: number;
  supernode?: string;
  backendHint?: string;
}

export default function HomeView({
  netStatus,
  role,
  onRoleChange,
  onNavigateTab,
  onTriggerToast,
  localIp,
  latency = 0,
  supernode = '',
  backendHint = ''
}: HomeViewProps) {
  const readinessProgress = netStatus === 'online' ? 100 : netStatus === 'connecting' ? 45 : netStatus === 'warning' ? 30 : 0;
  const [hasSentInvite, setHasSentInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('tr-connect://dGVzdGdyb3VwMTMyNDpzdXBlcm5vZGU=');
  const isOnline = netStatus === 'online';
  const isConnecting = netStatus === 'connecting';
  const isWarning = netStatus === 'warning';
  const statusLabel = isOnline ? '组网已连接' : isConnecting ? '组网连接中' : isWarning ? '需要诊断' : '等待真实检测';

  // SVG parameters for circular progress
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (readinessProgress / 100) * circumference;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteCode);
    onTriggerToast('邀请码已成功复制到剪贴板！');
  };

  return (
    <div className="space-y-6">
      {/* Page description */}
      <div className="mb-4">
        <h2 className="font-heading text-2xl font-bold text-slate-800">桌面大厅</h2>
        <p className="font-sans text-sm text-slate-500 mt-1">确定您在网络拓扑中的角色，并优化连接性能。</p>
      </div>

      {/* Hero Section: Role Switch & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Role Selection Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between col-span-1 lg:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-[240px] h-[240px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-800 mb-2">选择联机角色</h3>
            <p className="font-sans text-xs text-slate-500 mb-6">主机负责启动游戏自建服务器；加入者通过主机的虚拟网段接入。</p>
            
            {/* Toggle tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 mb-8 w-fit">
              <button
                onClick={() => {
                  onRoleChange('host');
                  onTriggerToast('已切换至 [我是主机] 角色');
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
                  onTriggerToast('已切换至 [我是加入者] 角色');
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
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-lg font-sans text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            >
              配置本地网桥
            </button>
            <button
              onClick={() => onNavigateTab('games')}
              className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-sans text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              扫描本地游戏
            </button>
          </div>
        </div>

        {/* Readiness Ring */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
          <h3 className="font-heading text-sm font-bold text-slate-800 mb-6 w-full text-left">就绪进度</h3>
          
          <div className="relative w-32 h-32 mb-4 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background Circle */}
              <circle
                className="text-slate-100"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
                r={radius}
                cx="50"
                cy="50"
              />
              {/* Progress Circle */}
              <circle
                className="text-amber-500 transition-all duration-500"
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
            <div className="absolute flex flex-col items-center justify-center">
              <span className="font-heading text-2xl font-bold text-slate-800">{readinessProgress}%</span>
              <span className="font-sans text-[10px] text-slate-400 font-medium">{statusLabel}</span>
            </div>
          </div>

          <p className="font-sans text-xs text-slate-400 mt-2">
            {backendHint || '尚未读取到真实诊断结果。请先进入通用组网中心填写 supernode 并启动 n2n。'}
          </p>
        </div>

      </div>

      {/* Bottom Section: Topology & Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Topology Diagram */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm col-span-1 lg:col-span-2 relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-heading text-sm font-bold text-slate-800">网络拓扑状态</h3>
            <span className={`${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50' : isWarning ? 'bg-amber-50 text-amber-700 border-amber-100/50' : 'bg-slate-50 text-slate-500 border-slate-200'} px-3 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 font-mono`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-slate-400'}`} />
              {statusLabel}
            </span>
          </div>

          {/* Simple Visual Topology Mesh */}
          <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-8 flex items-center justify-center min-h-[200px]">
            <div className="flex items-center gap-4 md:gap-8 w-full max-w-lg mx-auto relative justify-between">
              
              {/* Host Component */}
              <div className="flex flex-col items-center gap-2 cursor-pointer transition-transform hover:scale-105" onClick={() => onTriggerToast('您当前的虚拟网卡：Tap-Windows Adapter V9')}>
                <div className={`w-14 h-14 rounded-full shadow-sm bg-white flex items-center justify-center border-2 ${
                  role === 'host' ? 'border-amber-500' : 'border-slate-200'
                }`}>
                  <Laptop className={`w-6 h-6 ${role === 'host' ? 'text-amber-600' : 'text-slate-400'}`} />
                </div>
                <span className="font-sans text-xs text-slate-600 font-semibold">{role === 'host' ? '本机 (主机)' : '本机 (加入者)'}</span>
                <span className="font-mono text-[10px] text-slate-400">{localIp || '10.0.8.1'}</span>
              </div>

              {/* Connecting line 1 */}
              <div className="flex-1 h-[2px] bg-amber-500/30 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-transparent animate-pulse" />
              </div>

              {/* Supernode Router Component */}
              <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => onNavigateTab('network')}>
                <div className="w-16 h-16 bg-slate-800 rounded-xl shadow-md flex items-center justify-center text-white relative transition-transform group-hover:scale-105">
                  <Network className="w-7 h-7" />
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-amber-950 font-bold text-[9px] px-1.5 py-0.5 rounded-md">
                    {isOnline ? (latency > 0 ? `${latency}ms` : 'ACK') : '待测'}
                  </span>
                </div>
                <span className="font-sans text-xs text-slate-500 font-medium">超级节点 (Supernode)</span>
                <span className="font-mono text-[10px] text-slate-400">{supernode || '未配置 supernode'}</span>
              </div>

              {/* Connecting line 2 */}
              <div className="flex-1 h-[2px] border-t border-dashed border-slate-300" />

              {/* Friend components */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" onClick={() => onTriggerToast('等待好友加入房间。点击右上角“复制好友邀请包”以快速联机')}>
                  <Users className="w-5 h-5" />
                </div>
                <span className="font-sans text-xs text-slate-500">联机好友群组</span>
                <span className="font-sans text-[10px] text-slate-400">等待加入...</span>
              </div>

            </div>
          </div>
        </div>

        {/* Checklist & Actions */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <h3 className="font-heading text-sm font-bold text-slate-800 mb-4">主面板检查单</h3>
          
          <div className="space-y-4 mb-6 flex-1">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-sans text-xs text-slate-700 font-semibold">虚拟局域网网卡</p>
                <p className="font-sans text-[10px] text-slate-400">{localIp ? `当前虚拟 IP：${localIp}` : '等待后端检测网卡。'}</p>
              </div>
            </div>
            <div className="w-full h-px bg-slate-100" />
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-sans text-xs text-slate-700 font-semibold">supernode 配置</p>
                <p className="font-sans text-[10px] text-slate-400">{supernode || '未配置，请进入通用组网中心填写。'}</p>
              </div>
            </div>
            <div className="w-full h-px bg-slate-100" />
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-sans text-xs text-slate-700 font-semibold">超级节点响应</p>
                <p className="font-sans text-[10px] text-slate-400">{isOnline ? '已检测到 ACK/PONG。' : backendHint || '等待真实诊断。'}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-center justify-between">
              <span className="font-mono text-[11px] text-amber-900 truncate mr-2">{inviteCode}</span>
              <button
                onClick={handleCopyInvite}
                className="p-1 px-2.5 rounded bg-amber-100 text-amber-800 font-sans text-[10px] font-semibold hover:bg-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                复制
              </button>
            </div>
            <button
              onClick={() => onNavigateTab('protocol')}
              className="w-full border border-slate-200 hover:bg-slate-50 hover:text-slate-800 py-3 rounded-lg font-sans text-xs font-semibold text-slate-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              填写局域网接入码
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
