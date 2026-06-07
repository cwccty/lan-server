import { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  FolderOpen,
  HelpCircle,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { FAQS } from '../reference-ui/data';
import { getAppSettings, openPath, resetAppSettings, saveAppSettings, testEdgePath } from '../api/tauri';
import type { AppSettings, EdgePathCheck } from '../types/settings';
import { setReferenceProductMode } from '../reference-adapter/productMode';

import { ProductBusyOverlay } from './ProductBusyOverlay';
import { ProductAccountPanel } from './ProductAccountPanel';
import { ProductAppearancePanel } from './ProductAppearancePanel';
import { defaultAppearance } from './accountAppearance';

interface ProductSettingsViewProps {
  onTriggerToast: (msg: string) => void;
  showDeveloperValidation?: boolean;
  onToggleDeveloperValidation?: (visible: boolean) => void;
}

function emptySettings(): AppSettings {
  return {
    edge_path: '',
    supernode_default: '',
    adapter_registry_url: '',
    product_mode: true,
    appearance: defaultAppearance(),
    log_dir: '',
    tools_dir: '',
    updated_at: '',
  };
}

function edgeResultText(result: EdgePathCheck | null) {
  if (!result) return '尚未检测';
  return result.ok
    ? '已找到可用的组网程序。'
    : '没有找到可用的组网程序，请重新安装或在排查详情中设置路径。';
}

function edgeDetailText(result: EdgePathCheck | null) {
  if (!result) return '尚未检测';
  return result.message || edgeResultText(result);
}

export function ProductSettingsView({
  onTriggerToast,
  showDeveloperValidation = false,
  onToggleDeveloperValidation,
}: ProductSettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings>(() => emptySettings());
  const [edgeCheck, setEdgeCheck] = useState<EdgePathCheck | null>(null);
  const [busy, setBusy] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const load = async (label = '读取设置') => {
    setBusy(label);
    try {
      const result = await getAppSettings();
      setSettings(result);
      onTriggerToast('已读取设置。');
    } catch (error) {
      onTriggerToast(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const save = async () => {
    setBusy('保存设置');
    try {
      const saved = await saveAppSettings(settings);
      setSettings(saved);
      setReferenceProductMode(saved.product_mode);
      onTriggerToast('已保存应用设置。');
    } catch (error) {
      onTriggerToast(`保存设置失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const reset = async () => {
    setBusy('恢复默认设置');
    try {
      const next = await resetAppSettings();
      setSettings(next);
      setReferenceProductMode(next.product_mode);
      onTriggerToast('已恢复默认设置。');
    } catch (error) {
      onTriggerToast(`恢复默认失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const checkEdge = async () => {
    setBusy('检测组网程序');
    try {
      const result = await testEdgePath(settings.edge_path);
      setEdgeCheck(result);
      onTriggerToast(edgeResultText(result));
    } catch (error) {
      onTriggerToast(`检测组网程序失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const openMaybe = async (path: string | null | undefined, label: string) => {
    if (!path) {
      onTriggerToast(`${label}路径未设置。`);
      return;
    }
    try {
      await openPath(path);
      onTriggerToast(`已请求打开：${label}`);
    } catch (error) {
      onTriggerToast(`打开失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="space-y-6 font-sans text-xs" data-lan-helper-product-controlled="settings">
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在处理设置；请等待状态刷新。" />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">设置与帮助</h2>
          <p className="mt-1 text-sm text-slate-500">只改常用项；排查信息默认收起。</p>
          <p className="mt-1 text-xs text-slate-400">更新时间：{settings.updated_at || '尚未读取'} ｜ {busy || '空闲'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => load('手动刷新设置')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <Settings className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            刷新设置
          </button>
          <button onClick={reset} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 shadow-sm hover:bg-amber-50 disabled:opacity-60">
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </button>
          <button onClick={save} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">
            <Save className="h-4 w-4" />
            保存设置
          </button>
        </div>
      </header>

      <ProductAccountPanel onTriggerToast={onTriggerToast} />

      <ProductAppearancePanel onTriggerToast={onTriggerToast} />

      <section className="rounded-2xl border border-amber-100 bg-amber-50/80 p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div>
            <h3 className="text-base font-bold text-slate-900">常用设置</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-800">
              大多数用户只需要保存默认中继地址和方案库地址。更多路径和验证信息只在排查详情里显示。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                默认中继地址
                <input
                  value={settings.supernode_default ?? ''}
                  onChange={(event) => update({ supernode_default: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-4 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-amber-400"
                  placeholder="例如：中继地址:7777"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                默认方案库地址
                <input
                  value={settings.adapter_registry_url ?? ''}
                  onChange={(event) => update({ adapter_registry_url: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-amber-100 bg-white px-4 py-2.5 text-xs text-slate-700 outline-none focus:border-amber-400"
                  placeholder="默认共享库地址，可留空"
                />
              </label>
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-white/70 p-3 text-xs leading-relaxed text-slate-600">
              <input
                type="checkbox"
                checked={showDeveloperValidation}
                onChange={(event) => onToggleDeveloperValidation?.(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-bold text-slate-800">显示排查与验证详情</span>
                <span className="mt-1 block">默认关闭。只有需要排查问题或查看详细信息时再打开。</span>
              </span>
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={save}
              disabled={Boolean(busy)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              保存常用设置
            </button>
            <button
              onClick={checkEdge}
              disabled={Boolean(busy)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              检测组网程序
            </button>
            <button
              onClick={reset}
              disabled={Boolean(busy)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              恢复默认设置
            </button>
            <div className={`rounded-xl border p-3 text-xs leading-relaxed ${edgeCheck?.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : edgeCheck ? 'border-rose-100 bg-rose-50 text-rose-800' : 'border-white/80 bg-white/70 text-slate-600'}`}>
              <b>{edgeCheck?.ok ? '组网程序可用' : edgeCheck ? '组网程序需要处理' : '组网程序未检测'}</b>
              <p className="mt-1">{edgeResultText(edgeCheck)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-12" data-settings-technical-details="advanced">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3 font-heading text-sm font-bold text-slate-800">
              <Cpu className="h-4 w-4 text-amber-500" />
              本地程序设置
            </h3>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-1 block font-semibold text-slate-400">组网程序执行路径</span>
                <div className="flex flex-col gap-2 md:flex-row">
                  <input
                    value={settings.edge_path ?? ''}
                    onChange={(event) => update({ edge_path: event.target.value })}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-amber-400"
                    placeholder="例如：C:/Program Files/N2N/edge.exe"
                  />
                  <button onClick={checkEdge} disabled={Boolean(busy)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    检测
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-400">默认中继地址</span>
                <input
                  value={settings.supernode_default ?? ''}
                  onChange={(event) => update({ supernode_default: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-amber-400"
                  placeholder="例如：203.0.113.10:7777"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-400">默认共享方案库地址</span>
                <input
                  value={settings.adapter_registry_url ?? ''}
                  onChange={(event) => update({ adapter_registry_url: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-amber-400"
                  placeholder="方案库 index.json URL"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-400">日志目录</span>
                  <div className="flex gap-2">
                    <input value={settings.log_dir ?? ''} onChange={(event) => update({ log_dir: event.target.value })} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-amber-400" />
                    <button onClick={() => openMaybe(settings.log_dir, '日志目录')} className="rounded-xl border border-slate-200 px-3 text-slate-600 hover:bg-slate-50"><FolderOpen className="h-4 w-4" /></button>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block font-semibold text-slate-400">工具目录</span>
                  <div className="flex gap-2">
                    <input value={settings.tools_dir ?? ''} onChange={(event) => update({ tools_dir: event.target.value })} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-amber-400" />
                    <button onClick={() => openMaybe(settings.tools_dir, '工具目录')} className="rounded-xl border border-slate-200 px-3 text-slate-600 hover:bg-slate-50"><FolderOpen className="h-4 w-4" /></button>
                  </div>
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <input type="checkbox" checked={settings.product_mode} onChange={(event) => update({ product_mode: event.target.checked })} className="mt-1" />
                <span>
                  <span className="block font-bold text-slate-800">启用产品模式</span>
                  <span className="mt-1 block leading-relaxed text-slate-500">正式客户端会优先使用本机能力。此开关主要用于浏览器预览时保持一致行为。</span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <input
                  type="checkbox"
                  checked={showDeveloperValidation}
                  onChange={(event) => onToggleDeveloperValidation?.(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-bold text-slate-800">显示开发者验证信息</span>
                  <span className="mt-1 block leading-relaxed text-slate-500">
                    默认关闭。打开后才显示验证卡片、手动检查等排查信息。
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3 font-heading text-sm font-bold text-slate-800">
              <BookOpen className="h-4 w-4 text-slate-400" />
              常见组网障碍解答
            </h3>
            <div className="space-y-3">
              {FAQS.map((faq) => {
                const open = expandedFaq === faq.id;
                return (
                  <div key={faq.id} className="overflow-hidden rounded-xl border border-slate-100">
                    <button onClick={() => setExpandedFaq(open ? null : faq.id)} className="flex w-full items-center justify-between bg-slate-50/70 px-5 py-4 text-left font-heading font-semibold text-slate-700 hover:bg-slate-50">
                      <span>{faq.question}</span>
                      {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </button>
                    {open && <div className="border-t border-slate-100 bg-white px-5 py-4 leading-relaxed text-slate-500">{faq.answer}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-heading text-sm font-bold text-slate-800">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              组网程序检测结果
            </h3>
            <div className={`rounded-2xl border p-4 ${edgeCheck?.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : edgeCheck ? 'border-rose-100 bg-rose-50 text-rose-800' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
              <div className="mb-2 flex items-center gap-2 font-bold">
                {edgeCheck?.ok ? <CheckCircle2 className="h-5 w-5" /> : edgeCheck ? <XCircle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
                {edgeCheck?.ok ? '可用' : edgeCheck ? '需要处理' : '未检测'}
              </div>
              <p className="leading-relaxed">{edgeDetailText(edgeCheck)}</p>
            </div>
            {edgeCheck && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl bg-slate-50 p-3">存在：<b>{edgeCheck.exists ? '是' : '否'}</b></div>
                <div className="rounded-xl bg-slate-50 p-3">文件：<b>{edgeCheck.is_file ? '是' : '否'}</b></div>
                <div className="rounded-xl bg-slate-50 p-3">名称：<b>{edgeCheck.executable_name_ok ? '正确' : '异常'}</b></div>
                <div className="rounded-xl bg-slate-50 p-3">执行：<b>{edgeCheck.can_execute ? '可执行' : '不可执行'}</b></div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-heading text-sm font-bold text-slate-800">排查说明</h3>
            <ul className="space-y-3 leading-relaxed text-slate-500">
              <li>• 保存设置会写入本机应用配置。</li>
              <li>• 默认中继地址会被组网中心读取，减少重复输入。</li>
              <li>• 方案库地址会用于同步共享游戏方案。</li>
              <li>• 如果组网程序检测失败，应在诊断报告中继续定位。</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
