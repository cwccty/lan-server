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
    <header className="fixed top-0 right-0 z-45 flex h-16 w-[calc(100%-276px)] items-center justify-between gap-3 border-b border-[#eeeef0] bg-white/70 px-4 shadow-sm backdrop-blur-lg xl:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <nav className="hidden gap-5 whitespace-nowrap font-sans text-sm font-medium xl:flex">
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

      <div className="ml-auto flex min-w-0 items-center gap-2 xl:gap-4">
        <ProductAccountPanel compact onTriggerToast={onTriggerToast} />

        <button
          onClick={refreshStatus}
          disabled={busy}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${productStatusToneClasses(status.tone)}`}
          title={status.detail || runtime.network.label || '刷新状态'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${productStatusDotClasses(status.tone)}`} />
          <span className="hidden whitespace-nowrap md:inline">{busy ? '处理中...' : `状态：${status.label}`}</span>
        </button>

        <button
          onClick={onOpenDiagnostics}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-sans text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 xl:px-4"
          title="排查问题"
        >
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden whitespace-nowrap lg:inline">排查问题</span>
        </button>

        <button
          onClick={runNetworkAction}
          disabled={busy}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200 disabled:cursor-wait disabled:opacity-60 xl:px-4 ${
            actionIsStop
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-amber-500 text-amber-950 hover:bg-amber-400 hover:scale-[1.02]'
          }`}
        >
          {actionIsStop ? (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">停止组网</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">启动组网</span>
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
