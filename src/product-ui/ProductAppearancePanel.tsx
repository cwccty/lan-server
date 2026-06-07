import { useEffect, useState } from 'react';
import { Image, Palette, RotateCcw, Save } from 'lucide-react';
import type { AppearanceBackgroundMode, AppearanceSettings, AppearanceTheme } from '../types/settings';
import {
  accentPresets,
  backgroundHelpText,
  customBackgroundWarning,
  defaultAppearance,
  onAppearanceUpdated,
  readAppearance,
  resetAppearance,
  saveAppearance,
  safeCustomBackgroundUrl,
} from './accountAppearance';

interface ProductAppearancePanelProps {
  onTriggerToast: (msg: string) => void;
}

const themes: { id: AppearanceTheme; label: string; detail: string }[] = [
  { id: 'system', label: '跟随系统', detail: '使用系统明暗偏好。' },
  { id: 'light', label: '浅色', detail: '白天或明亮环境更清楚。' },
  { id: 'dark', label: '深色', detail: '夜间开服时更护眼。' },
  { id: 'warm', label: '暖色', detail: '柔和背景，减少冷感。' },
];

const backgrounds: { id: AppearanceBackgroundMode; label: string; detail: string }[] = [
  { id: 'default', label: '默认背景', detail: '最稳定，适合所有电脑。' },
  { id: 'gradient', label: '渐变背景', detail: '使用强调色生成轻量渐变。' },
  { id: 'custom', label: '自定义图片', detail: '填写图片 URL 或本机完整路径。' },
];

export function ProductAppearancePanel({ onTriggerToast }: ProductAppearancePanelProps) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => defaultAppearance());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('外观设置会保存在本机，调整后立即生效。');

  const load = async () => {
    const next = await readAppearance();
    setAppearance(next);
  };

  useEffect(() => {
    load();
    return onAppearanceUpdated((next) => setAppearance(next));
  }, []);

  const update = (patch: Partial<AppearanceSettings>) => {
    setAppearance((previous) => {
      const next = { ...previous, ...patch };
      const warning = next.background_mode === 'custom' ? customBackgroundWarning(next.background_value) : '';
      if (warning) setNotice(warning);
      return next;
    });
  };

  const save = async (next = appearance, label = '外观设置已保存。') => {
    setBusy(true);
    try {
      const saved = await saveAppearance(next);
      setAppearance(saved);
      const warning = saved.background_mode === 'custom' ? customBackgroundWarning(saved.background_value) : '';
      const message = warning || label;
      setNotice(message);
      onTriggerToast(message);
    } catch (error) {
      const message = `保存外观失败：${error instanceof Error ? error.message : String(error)}`;
      setNotice(message);
      onTriggerToast(message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const next = await resetAppearance();
      setAppearance(next);
      setNotice('已恢复默认外观。');
      onTriggerToast('已恢复默认外观。');
    } catch (error) {
      const message = `恢复默认外观失败：${error instanceof Error ? error.message : String(error)}`;
      setNotice(message);
      onTriggerToast(message);
    } finally {
      setBusy(false);
    }
  };

  const previewBackgroundImage =
    appearance.background_mode === 'gradient'
      ? `linear-gradient(135deg, ${appearance.accent}33, #ffffff 46%, #f8fafc)`
      : appearance.background_mode === 'custom'
        ? safeCustomBackgroundUrl(appearance.background_value)
          ? `linear-gradient(rgba(255,255,255,.72), rgba(255,255,255,.72)), url("${safeCustomBackgroundUrl(appearance.background_value)}")`
          : undefined
        : undefined;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-appearance-panel="settings">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">个性化</span>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
              保存后立即生效
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900">外观偏好</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            这些设置只保存在本机。自定义背景建议使用 1920×1080 或更大的图片，避免使用包含隐私信息的照片。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            onClick={() => save()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            保存外观
          </button>
          <button
            onClick={reset}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
              <Palette className="h-4 w-4 text-amber-600" />
              主题风格
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    const next = { ...appearance, theme: theme.id };
                    setAppearance(next);
                    save(next, `已切换为${theme.label}。`);
                  }}
                  className={`rounded-xl border p-3 text-left text-xs transition ${
                    appearance.theme === theme.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-white'
                  }`}
                >
                  <b>{theme.label}</b>
                  <p className="mt-1 opacity-80">{theme.detail}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-700">强调色</p>
            <div className="flex flex-wrap gap-2">
              {accentPresets.map((accent) => (
                <button
                  key={accent.value}
                  onClick={() => {
                    const next = { ...appearance, accent: accent.value };
                    setAppearance(next);
                    save(next, `强调色已切换为${accent.label}。`);
                  }}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${
                    appearance.accent.toLowerCase() === accent.value.toLowerCase()
                      ? 'border-slate-900 bg-white text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: accent.value }} />
                  {accent.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
              <Image className="h-4 w-4 text-amber-600" />
              背景
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {backgrounds.map((background) => (
                <button
                  key={background.id}
                  onClick={() => {
                    const next = { ...appearance, background_mode: background.id };
                    if (background.id !== 'custom') next.background_value = '';
                    setAppearance(next);
                    save(next, `背景已切换为${background.label}。`);
                  }}
                  className={`rounded-xl border p-3 text-left text-xs transition ${
                    appearance.background_mode === background.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-white'
                  }`}
                >
                  <b>{background.label}</b>
                  <p className="mt-1 opacity-80">{background.detail}</p>
                </button>
              ))}
            </div>
            {appearance.background_mode === 'custom' ? (
              <label className="mt-3 block text-xs font-semibold text-slate-600">
                图片路径或 URL
                <input
                  value={appearance.background_value || ''}
                  onChange={(event) => update({ background_value: event.target.value })}
                  onBlur={() => save()}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400"
                  placeholder="例如 https://example.com/bg.jpg 或 C:\\Pictures\\bg.jpg"
                />
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                  {backgroundHelpText(appearance.background_value || '')}
                </span>
                {customBackgroundWarning(appearance.background_value) ? (
                  <span className="mt-2 block rounded-lg bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800 ring-1 ring-amber-100">
                    {customBackgroundWarning(appearance.background_value)}
                  </span>
                ) : null}
              </label>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              背景强度
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={appearance.background_strength}
                onChange={(event) => update({ background_strength: Number(event.target.value) })}
                onMouseUp={() => save()}
                onTouchEnd={() => save()}
                className="mt-2 w-full"
              />
              <span className="mt-1 block text-[11px] text-slate-500">{Math.round(appearance.background_strength * 100)}%</span>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              背景模糊
              <input
                type="range"
                min="0"
                max="24"
                step="1"
                value={appearance.background_blur}
                onChange={(event) => update({ background_blur: Number(event.target.value) })}
                onMouseUp={() => save()}
                onTouchEnd={() => save()}
                className="mt-2 w-full"
              />
              <span className="mt-1 block text-[11px] text-slate-500">{appearance.background_blur}px</span>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-bold text-slate-700">预览</p>
          <div
            className="overflow-hidden rounded-2xl border border-white bg-white shadow-sm"
            style={{
              backgroundColor: '#ffffff',
              backgroundImage: previewBackgroundImage,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <div className="p-4">
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ backgroundColor: appearance.accent }}>
                当前强调色
              </span>
              <h4 className="mt-4 text-sm font-bold text-slate-900">联机助手</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                登录本地账号后，这些外观偏好会保留在本机，刷新或重启后继续生效。
              </p>
              <button className="mt-4 rounded-xl px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: appearance.accent }}>
                示例按钮
              </button>
            </div>
          </div>
          <p
            className={`mt-3 rounded-xl p-3 text-[11px] leading-relaxed ${
              notice.includes('失败') || notice.includes('回退')
                ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-100'
                : 'bg-white text-slate-600 ring-1 ring-slate-100'
            }`}
            role={notice.includes('失败') || notice.includes('回退') ? 'alert' : 'status'}
          >
            {notice}
          </p>
        </div>
      </div>
    </section>
  );
}
