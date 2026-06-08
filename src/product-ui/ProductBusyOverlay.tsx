import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ProductBusyOverlayProps {
  visible: boolean;
  label?: string;
  detail?: string;
  delayMs?: number;
}

export function ProductBusyOverlay({
  visible,
  label = '正在处理',
  detail = '请稍候，客户端正在处理当前操作。',
  delayMs = 280,
}: ProductBusyOverlayProps) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShouldShow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShouldShow(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, visible]);

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/18 px-4 backdrop-blur-[6px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-product-busy-overlay="visible"
    >
      <div className="w-full max-w-sm rounded-[28px] border border-white/70 bg-white/90 p-5 text-center shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/20">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <p className="text-base font-black text-slate-900">{label}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>
        <p className="mt-4 rounded-full bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-600">
          正在等待状态返回，请不要重复点击按钮
        </p>
      </div>
    </div>
  );
}
