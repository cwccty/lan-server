import { NetworkStatus } from '../types';
import { Bell, UserCircle, Activity, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  netStatus: NetworkStatus;
  latency: number;
  onToggleNetwork: () => void;
  onOpenDiagnostics: () => void;
  onTabChange: (tab: any) => void;
}

export default function Header({
  netStatus,
  latency,
  onToggleNetwork,
  onOpenDiagnostics,
  onTabChange
}: HeaderProps) {
  const isOnline = netStatus === 'online';
  const isConnecting = netStatus === 'connecting';
  const isWarning = netStatus === 'warning';
  const isIdle = netStatus === 'idle';

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-260px)] h-16 bg-white/70 backdrop-blur-lg border-b border-[#eeeef0] flex justify-between items-center px-8 z-45 shadow-sm">
      {/* Navigation Headers */}
      <div className="flex items-center gap-6">
        <nav className="flex gap-6 font-sans text-sm font-medium">
          <button 
            onClick={() => onTabChange('home')}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            本心特性
          </button>
          <button 
            onClick={() => onTabChange('settings')}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            支持中心
          </button>
        </nav>
      </div>

      {/* Control Triggers */}
      <div className="flex items-center gap-4">
        {isOnline && (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 text-xs px-3 py-1 rounded-full border border-emerald-100 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{latency > 0 ? `已连接: ${latency}ms` : '已连接'}</span>
          </div>
        )}

        {isConnecting && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-800 text-xs px-3 py-1 rounded-full border border-amber-100 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            <span>网络连接中...</span>
          </div>
        )}

        {isWarning && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-800 text-xs px-3 py-1 rounded-full border border-amber-100 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>需要诊断</span>
          </div>
        )}

        {isIdle && (
          <div className="flex items-center gap-2 bg-slate-50 text-slate-600 text-xs px-3 py-1 rounded-full border border-slate-200 font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>待诊断</span>
          </div>
        )}

        {/* Global Diagnostic Button */}
        <button
          onClick={onOpenDiagnostics}
          className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg font-sans text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        >
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          打开诊断
        </button>

        {/* Start Connection Button */}
        <button
          onClick={onToggleNetwork}
          disabled={isConnecting}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 shadow-sm ${
            isOnline
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-amber-500 text-amber-950 hover:bg-amber-450 hover:scale-[1.02]'
          }`}
        >
          {isOnline ? (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              停止组网
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5" />
              启动组网
            </>
          )}
        </button>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* Profile notification cluster */}
        <div className="flex items-center gap-1">
          <button className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
          </button>
          <button className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors">
            <UserCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
