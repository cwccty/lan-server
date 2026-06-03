import React, { useEffect, useMemo, useState } from 'react';
import {
  generateReferenceDiagnostics,
  readReferenceTerrariaServer,
  refreshReferenceRuntime,
  stopReferenceN2n,
  stopReferenceTerrariaServer,
  type ReferenceActionResult
} from './actions';
import { REFERENCE_RUNTIME_EVENT } from './bootstrap';
import { snapshotForDebug, summarizeReferenceRuntime } from './mappers';
import type { ReferenceRuntimeSnapshot } from './types';

function readCurrentSnapshot() {
  return window.__LAN_HELPER_REFERENCE_RUNTIME__ ?? null;
}

export function ReferenceRuntimeDebugPanel() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ReferenceRuntimeSnapshot | null>(() => readCurrentSnapshot());
  const [busyAction, setBusyAction] = useState('');
  const [lastAction, setLastAction] = useState<ReferenceActionResult | null>(null);

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

  const runAction = async (label: string, action: () => Promise<ReferenceActionResult>) => {
    setBusyAction(label);
    try {
      const result = await action();
      setLastAction(result);
      if (result.snapshot) setSnapshot(result.snapshot);
    } finally {
      setBusyAction('');
    }
  };

  const debug = useMemo(() => (snapshot ? snapshotForDebug(snapshot) : null), [snapshot]);
  const summary = useMemo(() => (snapshot ? summarizeReferenceRuntime(snapshot) : null), [snapshot]);

  if (!open) return null;

  const disabled = Boolean(busyAction);

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-5xl max-h-[84vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
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

        <div className="grid gap-0 md:grid-cols-[320px_1fr]">
          <div className="max-h-[74vh] overflow-auto border-b border-slate-800 p-5 text-xs md:border-b-0 md:border-r">
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

            <div className="mt-5 border-t border-slate-800 pt-4">
              <div className="mb-2 font-semibold text-amber-400">安全动作</div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => runAction('刷新快照', () => refreshReferenceRuntime(false))}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  刷新快照
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => runAction('生成诊断', () => generateReferenceDiagnostics())}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  生成诊断报告
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => runAction('读取 Terraria', () => readReferenceTerrariaServer())}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  读取 Terraria 会话
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => runAction('停止 n2n', () => stopReferenceN2n())}
                  className="rounded-lg border border-rose-900/70 px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
                >
                  停止 n2n
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => runAction('停止 Terraria', () => stopReferenceTerrariaServer())}
                  className="rounded-lg border border-rose-900/70 px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
                >
                  停止 Terraria 服务端
                </button>
              </div>
              {busyAction && <div className="mt-3 text-[11px] text-amber-300">正在执行：{busyAction}</div>}
              {lastAction && (
                <div className={`mt-3 rounded-lg border px-3 py-2 text-[11px] ${lastAction.ok ? 'border-emerald-900/70 text-emerald-200' : 'border-rose-900/70 text-rose-200'}`}>
                  {lastAction.action}: {lastAction.message}
                </div>
              )}
            </div>
          </div>

          <div className="max-h-[74vh] overflow-auto p-5">
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-300">
              {JSON.stringify(debug ?? { message: 'no snapshot yet' }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
