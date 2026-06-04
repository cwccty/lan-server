import { useState } from 'react';
import { Activity, Bell, RefreshCw, UserCircle, Wifi, WifiOff } from 'lucide-react';
import { refreshReferenceRuntime, startReferenceN2n, stopReferenceN2n } from '../reference-adapter/actions';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';

interface ProductHeaderProps {
  onOpenDiagnostics: () => void;
  onTabChange: (tab: any) => void;
  onTriggerToast: (msg: string) => void;
}

function statusLabel(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (!runtime.loaded) return '真实状态: 读取中';
  if (runtime.network.ready) return '真实状态: n2n 已连接';
  if (runtime.network.running) return '真实状态: n2n 运行中';
  if (runtime.network.hasError) return '真实状态: 需诊断';
  return '真实状态: 未组网';
}

function statusClasses(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (runtime.network.ready) return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  if (runtime.network.running) return 'bg-amber-50 text-amber-800 border-amber-100';
  if (runtime.network.hasError) return 'bg-rose-50 text-rose-800 border-rose-100';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function dotClasses(runtime: ReturnType<typeof useReferenceRuntime>) {
  if (runtime.network.ready) return 'bg-emerald-500 animate-pulse';
  if (runtime.network.running) return 'bg-amber-500 animate-pulse';
  if (runtime.network.hasError) return 'bg-rose-500';
  return 'bg-slate-400';
}

export function ProductHeader({ onOpenDiagnostics, onTabChange, onTriggerToast }: ProductHeaderProps) {
  const runtime = useReferenceRuntime();
  const [busy, setBusy] = useState(false);

  const runNetworkAction = async () => {
    setBusy(true);
    try {
      const result = runtime.network.running || runtime.network.ready
        ? await stopReferenceN2n()
        : await startReferenceN2n();
      onTriggerToast(result.ok ? result.message : `操作失败：${result.message}`);
    } catch (error) {
      onTriggerToast(`组网操作失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const refreshStatus = async () => {
    setBusy(true);
    try {
      const result = await refreshReferenceRuntime(false);
      onTriggerToast(result.ok ? '真实状态已刷新。' : `刷新失败：${result.message}`);
    } catch (error) {
      onTriggerToast(`刷新失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const actionIsStop = runtime.network.running || runtime.network.ready;

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-260px)] h-16 bg-white/70 backdrop-blur-lg border-b border-[#eeeef0] flex justify-between items-center px-8 z-45 shadow-sm">
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

      <div className="flex items-center gap-4">
        <button
          onClick={refreshStatus}
          disabled={busy}
          className={`flex items-center gap-2 text-xs px-3 py-1 rounded-full border font-mono transition-colors disabled:opacity-60 ${statusClasses(runtime)}`}
          title={runtime.network.label || '刷新真实后端状态'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dotClasses(runtime)}`} />
          <span>{busy ? '处理中...' : statusLabel(runtime)}</span>
        </button>

        <button
          onClick={onOpenDiagnostics}
          className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg font-sans text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        >
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          打开诊断
        </button>

        <button
          onClick={runNetworkAction}
          disabled={busy}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-wait ${
            actionIsStop
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-amber-500 text-amber-950 hover:bg-amber-400 hover:scale-[1.02]'
          }`}
        >
          {actionIsStop ? (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              停止 n2n
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5" />
              启动 n2n
            </>
          )}
        </button>

        <button
          onClick={refreshStatus}
          disabled={busy}
          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-60"
          title="刷新真实状态"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
        </button>

        <div className="w-px h-6 bg-slate-200 mx-1" />

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
