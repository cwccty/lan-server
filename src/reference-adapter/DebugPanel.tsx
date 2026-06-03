import React, { useEffect, useMemo, useState } from 'react';
import { REFERENCE_RUNTIME_EVENT } from './bootstrap';
import { snapshotForDebug, summarizeReferenceRuntime } from './mappers';
import type { ReferenceRuntimeSnapshot } from './types';

function readCurrentSnapshot() {
  return window.__LAN_HELPER_REFERENCE_RUNTIME__ ?? null;
}

export function ReferenceRuntimeDebugPanel() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ReferenceRuntimeSnapshot | null>(() => readCurrentSnapshot());

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setOpen((value) => !value);
        setSnapshot(readCurrentSnapshot());
      }
    };

    const handleSnapshot = (event: Event) => {
      const custom = event as CustomEvent<ReferenceRuntimeSnapshot>;
      setSnapshot(custom.detail ?? readCurrentSnapshot());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(REFERENCE_RUNTIME_EVENT, handleSnapshot as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(REFERENCE_RUNTIME_EVENT, handleSnapshot as EventListener);
    };
  }, []);

  const debug = useMemo(() => (snapshot ? snapshotForDebug(snapshot) : null), [snapshot]);
  const summary = useMemo(() => (snapshot ? summarizeReferenceRuntime(snapshot) : null), [snapshot]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-4xl max-h-[82vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div>
            <div className="text-sm font-bold">Reference Runtime Debug</div>
            <div className="text-xs text-slate-400">隐藏调试面板，不属于用户默认界面。快捷键 Ctrl+Shift+D 关闭。</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            关闭
          </button>
        </div>

        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          <div className="border-b border-slate-800 p-5 text-xs md:border-b-0 md:border-r">
            <div className="mb-3 font-semibold text-amber-400">摘要</div>
            {summary ? (
              <div className="space-y-2 font-mono text-[11px] leading-relaxed text-slate-300">
                <div>network: {summary.network_label}</div>
                <div>running: {String(summary.network_running)}</div>
                <div>ready: {String(summary.network_ready)}</div>
                <div>virtual_ip: {summary.virtual_ip || '--'}</div>
                <div>supernode: {summary.supernode || '--'}</div>
                <div>terraria: {String(summary.terraria_running)} / {String(summary.terraria_ready)}</div>
                <div>games: {summary.game_count}</div>
                <div>adapters: {summary.adapter_count}</div>
                <div>release_ready: {String(summary.release_ready)}</div>
                {summary.short_error && <div className="text-rose-300">error: {summary.short_error}</div>}
              </div>
            ) : (
              <div className="text-xs text-slate-400">尚无 runtime 快照。请等待后台桥接层轮询。</div>
            )}
          </div>

          <div className="max-h-[68vh] overflow-auto p-5">
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-300">
              {JSON.stringify(debug ?? { message: 'no snapshot yet' }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
