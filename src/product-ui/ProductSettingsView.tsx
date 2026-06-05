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

interface ProductSettingsViewProps {
  onTriggerToast: (msg: string) => void;
}

function emptySettings(): AppSettings {
  return {
    edge_path: '',
    supernode_default: '',
    adapter_registry_url: '',
    product_mode: true,
    log_dir: '',
    tools_dir: '',
    updated_at: '',
  };
}

function edgeResultText(result: EdgePathCheck | null) {
  if (!result) return '尚未检测';
  return result.message || (result.ok ? 'edge.exe 可用' : 'edge.exe 不可用');
}

export function ProductSettingsView({ onTriggerToast }: ProductSettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings>(() => emptySettings());
  const [edgeCheck, setEdgeCheck] = useState<EdgePathCheck | null>(null);
  const [busy, setBusy] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const load = async (label = '读取真实设置') => {
    setBusy(label);
    try {
      const result = await getAppSettings();
      setSettings(result);
      onTriggerToast('已读取真实 settings.json。');
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
    setBusy('保存真实设置');
    try {
      const saved = await saveAppSettings(settings);
      setSettings(saved);
      setReferenceProductMode(saved.product_mode);
      onTriggerToast('已保存真实应用设置。');
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
      onTriggerToast('已恢复默认设置并写入真实配置。');
    } catch (error) {
      onTriggerToast(`恢复默认失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const checkEdge = async () => {
    setBusy('检测 edge.exe');
    try {
      const result = await testEdgePath(settings.edge_path);
      setEdgeCheck(result);
      onTriggerToast(result.message);
    } catch (error) {
      onTriggerToast(`检测 edge.exe 失败：${error instanceof Error ? error.message : String(error)}`);
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
      <ProductBusyOverlay visible={Boolean(busy)} label={busy || '正在处理'} detail="正在读取、保存、恢复设置或检测 edge.exe；请等待设置状态刷新。" />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">设置与帮助</h2>
          <p className="mt-1 text-sm text-slate-500">配置本地工具路径、默认 supernode 和共享方案库地址。</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">更新时间：{settings.updated_at || '尚未读取'} ｜ {busy || '空闲'}</p>
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
            保存真实设置
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3 font-heading text-sm font-bold text-slate-800">
              <Cpu className="h-4 w-4 text-amber-500" />
              本地内核参数
            </h3>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-1 block font-semibold text-slate-400">edge.exe 物理执行路径</span>
                <div className="flex flex-col gap-2 md:flex-row">
                  <input
                    value={settings.edge_path ?? ''}
                    onChange={(event) => update({ edge_path: event.target.value })}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-amber-400"
                    placeholder="例如：C:/Program Files/N2N/edge.exe"
                  />
                  <button onClick={checkEdge} disabled={Boolean(busy)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    联机自测
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-400">默认 Supernode</span>
                <input
                  value={settings.supernode_default ?? ''}
                  onChange={(event) => update({ supernode_default: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-amber-400"
                  placeholder="例如：154.64.231.137:7777"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-400">默认共享方案库地址</span>
                <input
                  value={settings.adapter_registry_url ?? ''}
                  onChange={(event) => update({ adapter_registry_url: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-amber-400"
                  placeholder="adapter-registry/index.json URL"
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
                  <span className="block font-bold text-slate-800">启用 Product Mode</span>
                  <span className="mt-1 block leading-relaxed text-slate-500">EXE 环境会强制使用真实产品接入，避免旧 localStorage 把发布包退回参考展示模式。此开关主要用于浏览器预览。</span>
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
              edge.exe 检测结果
            </h3>
            <div className={`rounded-2xl border p-4 ${edgeCheck?.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : edgeCheck ? 'border-rose-100 bg-rose-50 text-rose-800' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
              <div className="mb-2 flex items-center gap-2 font-bold">
                {edgeCheck?.ok ? <CheckCircle2 className="h-5 w-5" /> : edgeCheck ? <XCircle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
                {edgeCheck?.ok ? '可用' : edgeCheck ? '需要处理' : '未检测'}
              </div>
              <p className="leading-relaxed">{edgeResultText(edgeCheck)}</p>
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
            <h3 className="mb-3 font-heading text-sm font-bold text-slate-800">发布级说明</h3>
            <ul className="space-y-3 leading-relaxed text-slate-500">
              <li>• 设置页不再使用参考页的模拟 toast，保存会调用真实 `save_app_settings`。</li>
              <li>• 默认 Supernode 会被组网中心读取，减少用户重复输入。</li>
              <li>• 方案库地址会用于共享 adapter-registry 同步。</li>
              <li>• 如果 edge.exe 检测失败，应在诊断报告中继续分类定位。</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
