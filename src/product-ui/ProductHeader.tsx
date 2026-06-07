import { useState } from 'react';
import { Activity, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { refreshReferenceRuntime, startReferenceN2n, stopReferenceN2n } from '../reference-adapter/actions';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';
import { productStatusDotClasses, productStatusToneClasses, resolveProductStatusCenter } from './statusCenter';
import { ProductAccountPanel } from './ProductAccountPanel';

interface ProductHeaderProps {
  onOpenDiagnostics: () => void;
  onTabChange: (tab: any) => void;
  onTriggerToast: (msg: string) => void;
}

export function ProductHeader({ onOpenDiagnostics, onTabChange, onTriggerToast }: ProductHeaderProps) {
  const runtime = useReferenceRuntime();
  const [busy, setBusy] = useState(false);
  const status = resolveProductStatusCenter({
    loaded: runtime.loaded,
    snapshot: runtime.snapshot,
    network: runtime.network,
    errors: runtime.errors,
    busy: busy ? '处理中' : ''
  });

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
      onTriggerToast(result.ok ? '状态已刷新。' : `刷新失败：${result.message}`);
    } catch (error) {
      onTriggerToast(`刷新失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const actionIsStop = runtime.network.running || runtime.network.ready;

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-276px)] h-16 bg-white/70 backdrop-blur-lg border-b border-[#eeeef0] flex justify-between items-center px-8 z-45 shadow-sm">
      <div className="flex items-center gap-6">
        <nav className="flex gap-6 font-sans text-sm font-medium">
          <button
            onClick={() => onTabChange('home')}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            首页
          </button>
          <button
            onClick={() => onTabChange('settings')}
            className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            设置
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <ProductAccountPanel compact onTriggerToast={onTriggerToast} />

        <button
          onClick={refreshStatus}
          disabled={busy}
          className={`flex items-center gap-2 text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-60 ${productStatusToneClasses(status.tone)}`}
          title={status.detail || runtime.network.label || '刷新状态'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${productStatusDotClasses(status.tone)}`} />
          <span>{busy ? '处理中...' : `状态：${status.label}`}</span>
        </button>

        <button
          onClick={onOpenDiagnostics}
          className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg font-sans text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        >
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          排查问题
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
              停止组网
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5" />
              启动组网
            </>
          )}
        </button>

        <button
          onClick={refreshStatus}
          disabled={busy}
          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-60"
          title="刷新状态"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
}
