import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  CloudDownload,
  ClipboardCopy,
  Download,
  FileJson,
  Link2,
  RefreshCw,
  Save,
  Search,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  exportGameAdapterJson,
  importGameAdapterJson,
  listGameAdapters,
  saveGameAdapter,
  syncAdapterRegistry,
  syncLocalAdapterRegistryExample,
  type AdapterRegistrySyncResult,
} from '../api/tauri';
import type { GameAdapter, GameNetworkType } from '../types/game';
import {
  getReferenceAdapterSyncResult,
  setReferenceAdapterSyncResult,
} from '../reference-adapter/adapterSyncResult';

interface ProductSolutionsViewProps {
  onTriggerToast: (msg: string) => void;
  solutionsUrl: string;
  onUpdateSolutionsUrl: (url: string) => void;
}

const DEFAULT_REGISTRY_URL = 'https://cwccty.github.io/lan-server/adapter-registry/index.json';

const emptyEditor = {
  game_id: '',
  display_name: '',
  steam_appid: '',
  executables: '',
  default_ports: '7777',
  network_type: 'lan_ip_direct' as GameNetworkType,
  can_convert_to_lan: true,
  notes: '通过虚拟局域网或端口工具转换为局域网联机体验。',
};

function statusLabel(status: string) {
  const map: Record<string, string> = {
    created: '新增',
    updated: '更新',
    skipped: '跳过',
    hash_failed: '哈希失败',
    parse_failed: '解析失败',
    fetch_failed: '拉取失败',
    validation_failed: '校验失败',
    write_failed: '写入失败',
  };
  return map[status] ?? status;
}

function networkTypeText(type?: string) {
  const map: Record<string, string> = {
    lan_ip_direct: '局域网/IP 直连',
    dedicated_server: '专用服务端',
    tcp_port_proxy_needed: '需要 TCP 端口代理',
    udp_broadcast_needed: '需要 UDP 广播桥',
    steam_lobby_direct_possible: 'Steam 大厅可直连',
    steam_relay_plugin: '预留 Steam 中继插件入口',
    mod_required: '需要 Mod/补丁',
    official_only: '仅官方服',
    not_supported: '暂不支持',
    unknown_need_review: '待人工确认',
  };
  return type ? map[type] ?? type : '未标注';
}

function buildAdapter(form: typeof emptyEditor): GameAdapter {
  const ports = form.default_ports
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return {
    game_id: form.game_id.trim(),
    display_name: form.display_name.trim(),
    steam_appid: form.steam_appid.trim() || null,
    capabilities: ['lan', 'ip_join'],
    multiplayer_conversion: {
      capability: 'native_lan_ip',
      methods: ['virtual_lan'],
      can_convert_to_lan: form.can_convert_to_lan,
      risk_level: 'low',
      notes: form.notes.split('\n').map((item) => item.trim()).filter(Boolean),
      required_components: ['n2n edge', '虚拟网卡'],
    },
    network_type: form.network_type,
    connection_plan: {
      summary: form.notes.trim() || '使用虚拟局域网后，在游戏内通过虚拟 IP 和端口加入。',
      host_role: '房主启动游戏/服务端，并保持虚拟局域网在线。',
      join_role: '好友使用同一组网配置加入后，连接房主虚拟 IP。',
      default_join_host: '10.0.8.1',
      default_join_port: ports[0] ?? 7777,
      requires_virtual_lan: true,
      requires_tcp_port_proxy: form.network_type === 'tcp_port_proxy_needed',
      requires_udp_broadcast_bridge: form.network_type === 'udp_broadcast_needed',
      requires_dedicated_server: form.network_type === 'dedicated_server',
      invite_template: ['游戏：{game}', '房主虚拟 IP：{host_ip}', '端口：{port}'],
      troubleshooting: ['确认双方处于同一 n2n 房间', '确认防火墙允许游戏端口'],
    },
    adapter_source: 'custom',
    executables: form.executables.split(',').map((item) => item.trim()).filter(Boolean),
    default_ports: ports.length > 0 ? ports : [7777],
    launch_profiles: [],
  };
}

export function ProductSolutionsView({
  onTriggerToast,
  solutionsUrl,
  onUpdateSolutionsUrl,
}: ProductSolutionsViewProps) {
  const [adapters, setAdapters] = useState<GameAdapter[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [syncResult, setSyncResult] = useState<AdapterRegistrySyncResult | null>(() => getReferenceAdapterSyncResult()?.result ?? null);
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState(emptyEditor);

  const filteredAdapters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return adapters.filter((adapter) => {
      if (!needle) return true;
      return adapter.display_name.toLowerCase().includes(needle) || adapter.game_id.toLowerCase().includes(needle);
    });
  }, [adapters, query]);

  const loadAdapters = async (label = '读取真实方案库') => {
    setBusy(label);
    try {
      const result = await listGameAdapters();
      setAdapters(result);
      onTriggerToast(`已读取 ${result.length} 个本地真实适配方案。`);
    } catch (error) {
      onTriggerToast(`${label}失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    loadAdapters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncRemote = async () => {
    const registryUrl = solutionsUrl.trim() || DEFAULT_REGISTRY_URL;
    setBusy('同步共享方案库');
    try {
      const result = await syncAdapterRegistry(registryUrl);
      setReferenceAdapterSyncResult('remote', result);
      setSyncResult(result);
      await loadAdapters('刷新同步后的方案库');
      onTriggerToast(`共享库同步完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}。`);
    } catch (error) {
      onTriggerToast(`同步共享库失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const syncLocalExample = async () => {
    setBusy('同步本地示例方案库');
    try {
      const result = await syncLocalAdapterRegistryExample();
      setReferenceAdapterSyncResult('local', result);
      setSyncResult(result);
      await loadAdapters('刷新本地示例');
      onTriggerToast(`本地 adapter-registry 示例同步完成：新增 ${result.created}，更新 ${result.updated}。`);
    } catch (error) {
      onTriggerToast(`同步本地示例失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const importAdapter = async () => {
    if (!importText.trim()) {
      onTriggerToast('请先粘贴 adapter JSON。');
      return;
    }
    setBusy('导入 adapter JSON');
    try {
      const adapter = await importGameAdapterJson(importText);
      setImportText('');
      await loadAdapters('刷新导入结果');
      onTriggerToast(`已导入真实适配器：${adapter.display_name}`);
    } catch (error) {
      onTriggerToast(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const exportAdapter = async (adapter: GameAdapter) => {
    setBusy(`导出 ${adapter.display_name}`);
    try {
      const content = await exportGameAdapterJson(adapter.game_id);
      setExportText(content);
      onTriggerToast(`已导出 ${adapter.display_name}，内容已放入下方文本框，请按需手动复制。`);
    } catch (error) {
      onTriggerToast(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copyExportText = () => {
    if (!navigator.clipboard) {
      onTriggerToast('当前环境不支持自动复制，请手动复制文本框内容。');
      return;
    }
    navigator.clipboard
      .writeText(exportText)
      .then(() => onTriggerToast('已复制导出 JSON。'))
      .catch(() => onTriggerToast('复制失败，请手动复制。'));
  };

  const saveEditor = async () => {
    if (!editor.game_id.trim() || !editor.display_name.trim()) {
      onTriggerToast('请填写 game_id 和游戏名称。');
      return;
    }
    setBusy('保存自建适配器');
    try {
      const adapter = await saveGameAdapter(buildAdapter(editor));
      setEditor(emptyEditor);
      setEditorOpen(false);
      await loadAdapters('刷新自建方案');
      onTriggerToast(`已保存真实自建适配器：${adapter.display_name}`);
    } catch (error) {
      onTriggerToast(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="solutions">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">方案库</h2>
          <p className="mt-1 text-sm text-slate-500">同步共享适配器，或保存你确认过的游戏联机方案。</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">当前真实适配器：{adapters.length} 个 ｜ {busy || '空闲'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => loadAdapters('手动刷新方案库')} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            刷新本地方案
          </button>
          <button onClick={syncRemote} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">
            <CloudDownload className="h-4 w-4" />
            同步共享库
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-8">
          <div className="mb-3 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800">共享方案库地址</h3>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              value={solutionsUrl}
              onChange={(event) => onUpdateSolutionsUrl(event.target.value)}
              placeholder={DEFAULT_REGISTRY_URL}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-amber-400"
            />
            <button onClick={() => onUpdateSolutionsUrl(DEFAULT_REGISTRY_URL)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              恢复默认地址
            </button>
            <button onClick={syncLocalExample} disabled={Boolean(busy)} className="rounded-xl border border-amber-200 px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-60">
              同步本地示例
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800">自建方案</h3>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">管理员确认某游戏类型后，可把转换方案保存为 adapter，后续用户遇到同一游戏时直接复用。</p>
          <button onClick={() => setEditorOpen((value) => !value)} className="w-full rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 shadow-sm hover:bg-amber-400">
            {editorOpen ? '关闭编辑器' : '打开自建适配器编辑器'}
          </button>
        </div>
      </section>

      {editorOpen && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-xs text-slate-200 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileJson className="h-4 w-4 text-amber-400" />
            <h3 className="font-bold text-amber-400">真实 Adapter Schema Builder</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input value={editor.game_id} onChange={(e) => setEditor({ ...editor, game_id: e.target.value })} placeholder="game_id，例如 terraria" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <input value={editor.display_name} onChange={(e) => setEditor({ ...editor, display_name: e.target.value })} placeholder="游戏名称" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <input value={editor.steam_appid} onChange={(e) => setEditor({ ...editor, steam_appid: e.target.value })} placeholder="Steam AppID，可空" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <input value={editor.executables} onChange={(e) => setEditor({ ...editor, executables: e.target.value })} placeholder="exe 特征，逗号分隔" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <input value={editor.default_ports} onChange={(e) => setEditor({ ...editor, default_ports: e.target.value })} placeholder="默认端口，逗号分隔" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
            <select value={editor.network_type} onChange={(e) => setEditor({ ...editor, network_type: e.target.value as GameNetworkType })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400">
              <option value="lan_ip_direct">局域网/IP 直连</option>
              <option value="dedicated_server">专用服务端</option>
              <option value="tcp_port_proxy_needed">需要 TCP 端口代理</option>
              <option value="udp_broadcast_needed">需要 UDP 广播桥</option>
              <option value="steam_relay_plugin">Steam 中继插件入口</option>
              <option value="official_only">仅官方服</option>
              <option value="unknown_need_review">待人工确认</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
              <input type="checkbox" checked={editor.can_convert_to_lan} onChange={(e) => setEditor({ ...editor, can_convert_to_lan: e.target.checked })} />
              可转换为局域网体验
            </label>
            <button onClick={saveEditor} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-60">
              <Save className="h-4 w-4" />
              保存真实适配器
            </button>
          </div>
          <textarea value={editor.notes} onChange={(e) => setEditor({ ...editor, notes: e.target.value })} className="mt-3 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-800">本地真实适配器列表</h3>
            <label className="relative w-64 max-w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索游戏或 game_id" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-amber-400" />
            </label>
          </div>
          <div className="space-y-2">
            {filteredAdapters.map((adapter) => (
              <article key={adapter.game_id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{adapter.display_name}</h4>
                    <p className="font-mono text-[11px] text-slate-400">{adapter.game_id} ｜ {adapter.adapter_source || 'unknown'} ｜ {networkTypeText(adapter.network_type)}</p>
                    <p className="mt-1 text-xs text-slate-500">端口：{adapter.default_ports?.join(', ') || '未设置'} ｜ exe：{adapter.executables?.join(', ') || '未设置'}</p>
                  </div>
                  <button onClick={() => exportAdapter(adapter)} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    <Download className="h-4 w-4" />
                    导出 JSON
                  </button>
                </div>
              </article>
            ))}
            {filteredAdapters.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">暂无适配器，请同步共享库或导入 JSON。</div>}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Upload className="h-5 w-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800">导入单个 Adapter JSON</h3>
            </div>
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="粘贴 adapter JSON 内容" className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs outline-none focus:border-amber-400" />
            <button onClick={importAdapter} disabled={Boolean(busy)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
              <Upload className="h-4 w-4" />
              导入并写入本地方案库
            </button>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">最近同步报告</h3>
              {syncResult?.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : syncResult ? <XCircle className="h-5 w-5 text-rose-500" /> : null}
            </div>
            {syncResult ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">新增 <b>{syncResult.created}</b></div>
                  <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700">更新 <b>{syncResult.updated}</b></div>
                  <div className="rounded-xl bg-slate-50 p-3 text-slate-700">跳过 <b>{syncResult.skipped}</b></div>
                  <div className="rounded-xl bg-rose-50 p-3 text-rose-700">拉取失败 <b>{syncResult.fetch_failed}</b></div>
                  <div className="rounded-xl bg-rose-50 p-3 text-rose-700">校验失败 <b>{syncResult.validation_failed}</b></div>
                  <div className="rounded-xl bg-rose-50 p-3 text-rose-700">写入失败 <b>{syncResult.write_failed}</b></div>
                </div>
                <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-slate-100 text-[11px]">
                  {syncResult.items.slice(0, 12).map((item, index) => (
                    <div key={`${item.game_id}-${index}`} className="border-b border-slate-100 p-2 last:border-b-0">
                      <b>{item.display_name || item.game_id}</b>：{statusLabel(item.status)} ｜ {item.reason}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">尚未执行同步。同步结果会保存在本地并在下次打开时恢复。</p>
            )}
          </div>

          {exportText && (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">导出内容</h3>
                <button onClick={copyExportText} className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                  <ClipboardCopy className="h-4 w-4" />
                  复制
                </button>
              </div>
              <textarea readOnly value={exportText} className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-600" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
