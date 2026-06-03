import { useState, FormEvent } from 'react';
import { INITIAL_SOLUTIONS } from '../data';
import { SyncSolution } from '../types';
import {
  Link,
  RotateCcw,
  CloudDownload,
  Download,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  BookOpen
} from 'lucide-react';

interface SolutionsViewProps {
  onTriggerToast: (msg: string) => void;
  solutionsUrl: string;
  onUpdateSolutionsUrl: (url: string) => void;
}

export default function SolutionsView({
  onTriggerToast,
  solutionsUrl,
  onUpdateSolutionsUrl
}: SolutionsViewProps) {
  const [solutions, setSolutions] = useState<SyncSolution[]>(INITIAL_SOLUTIONS);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cache and refresh states
  const [lastSyncTime, setLastSyncTime] = useState('2026-06-03 14:32:15');
  const [isSyncing, setIsSyncing] = useState(false);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorForm, setEditorForm] = useState({
    name: '',
    version: '1.0.0',
    protocol: 'UDP-P2P',
    listenPort: '7777',
    source: '社区云',
    optimizeType: '直连透传加速'
  });

  const handleRestoreDefault = () => {
    onUpdateSolutionsUrl('https://api.lianjizhushou.com/solutions/shared/v2');
    onTriggerToast('共享方案库地址已重置为系统默认URL！');
  };

  const handleUpdateClick = (id: string, name: string) => {
    setSolutions((prev) =>
      prev.map((sol) => (sol.id === id ? { ...sol, status: 'synced', version: 'v47.0' } : sol))
    );
    onTriggerToast(`游戏方案 [${name}] 已成功更新至最新高稳定版本！`);
  };

  const handleCloudUpdateAll = () => {
    setIsSyncing(true);
    onTriggerToast('正在连接云端共享数据库并同步全网规则包...');
    setTimeout(() => {
      setSolutions((prev) => prev.map((sol) => ({ ...sol, status: 'synced' })));
      const now = new Date();
      setLastSyncTime(now.toLocaleString());
      setIsSyncing(false);
      onTriggerToast('全网 146 个热门主机联机规则一键更新及缓存对齐完成！');
    }, 1200);
  };

  const handleManualRefresh = () => {
    setIsSyncing(true);
    onTriggerToast('正在强制绕过本地DNS与配置缓存，拉取最新社区组网方案规则...');
    setTimeout(() => {
      const now = new Date();
      setLastSyncTime(now.toLocaleString());
      setIsSyncing(false);
      onTriggerToast('共享方案缓存强制手动刷新成功！已对齐云上最佳匹配。');
    }, 1000);
  };

  const handleImportConfig = () => {
    onTriggerToast('在本地选择 JSON 单体配置文件导入成功 (1 组游戏规则增加)。');
  };

  const handleExportConfig = () => {
    onTriggerToast('方案备份导出成功！LianJi_Solutions_Backup_2026.json 已经保存。');
  };

  // Submit new solution
  const handleSaveEditor = (e: FormEvent) => {
    e.preventDefault();
    if (!editorForm.name.trim()) {
      onTriggerToast('请输入游戏及方案名称！');
      return;
    }
    const newSolution: SyncSolution = {
      id: `sol_custom_${Date.now()}`,
      name: `${editorForm.name} (${editorForm.optimizeType})`,
      status: 'updated',
      version: `v${editorForm.version}`,
      source: `自建(${editorForm.protocol}:${editorForm.listenPort})`
    };
    setSolutions([newSolution, ...solutions]);
    onTriggerToast(`共享方案 [${editorForm.name}] 自建并发布成功！已持久保存至本地方案库。`);
    setEditorForm({
      name: '',
      version: '1.0.0',
      protocol: 'UDP-P2P',
      listenPort: '7777',
      source: '社区云',
      optimizeType: '直连透传加速'
    });
    setIsEditorOpen(false);
  };

  const filteredSolutions = solutions.filter((sol) =>
    sol.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-800">方案库</h2>
        <p className="font-sans text-sm text-slate-500 mt-1">管理并云端实时同步局域网游戏联机配置文件规则。</p>
      </div>

      {/* Control Panel Bento Style Grid */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Sync Address Setup Form Card */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <Link className="w-5 h-5 text-amber-500" />
            <h3 className="font-heading text-sm font-bold text-slate-800">共享方案库地址</h3>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={solutionsUrl}
              onChange={(e) => onUpdateSolutionsUrl(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500/20 rounded-lg px-4 py-2 text-xs font-mono text-slate-700 outline-none transition-all"
              placeholder="请输入自定义的解决方案数据库 URL"
            />
            <button
              onClick={handleRestoreDefault}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-4 py-2 font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              恢复默认
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={handleCloudUpdateAll}
              className="bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-5 py-2.5 font-sans text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <CloudDownload className="w-4 h-4" />
              一键更新共享方案
            </button>
            <button
              onClick={() => setIsEditorOpen(!isEditorOpen)}
              className="border border-amber-300 text-amber-800 bg-amber-500/5 hover:bg-amber-500/10 rounded-lg px-5 py-2.5 font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-amber-600 animate-pulse" />
              {isEditorOpen ? '关闭方案编辑器' : '自建共享方案编辑器'}
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={isSyncing}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-5 py-2.5 font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${isSyncing ? 'animate-spin' : ''}`} />
              手动强制刷新
            </button>
          </div>
        </div>

        {/* Import & Export Backup */}
        <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-amber-500" />
              <h3 className="font-heading text-sm font-bold text-slate-800">本地导入导出</h3>
            </div>
            <p className="font-sans text-xs text-slate-400 mb-4">备份您精心测试后的专用方案，或加载社区群文件下载的世界规则。</p>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleImportConfig}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg py-2 font-sans text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CloudDownload className="w-3.5 h-3.5 text-slate-400" />
              导入方案
            </button>
            <button
              onClick={handleExportConfig}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg py-2 font-sans text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              导出备份
            </button>
          </div>
        </div>

      </div>

      {/* Feature 1: Shared Game Solution Editor Section */}
      {isEditorOpen && (
        <form onSubmit={handleSaveEditor} className="bg-slate-900 text-slate-200 rounded-2xl p-6 border border-slate-800 shadow-md space-y-4 font-sans animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-850 pb-3">
            <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              共享游戏联机方案自建编辑器
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">存储级别: 局域网本地 / 云端发布通道</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">游戏及方案名称</label>
              <input
                type="text"
                value={editorForm.name}
                onChange={(e) => setEditorForm({ ...editorForm, name: e.target.value })}
                placeholder="例如: 艾尔登法环 (Elden Ring)"
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 transition-colors"
                required
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">针对版本范围</label>
              <input
                type="text"
                value={editorForm.version}
                onChange={(e) => setEditorForm({ ...editorForm, version: e.target.value })}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 transition-colors"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">网络传输协议</label>
              <select
                value={editorForm.protocol}
                onChange={(e) => setEditorForm({ ...editorForm, protocol: e.target.value })}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none cursor-pointer focus:border-amber-500"
              >
                <option value="UDP-P2P">UDP-P2P (最优极速直连)</option>
                <option value="TCP-Relay">TCP-Relay (回退防封网络)</option>
                <option value="UPnP-Forward">UPnP-Forward (端口映射直通)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">默认监听/代理端口</label>
              <input
                type="text"
                value={editorForm.listenPort}
                onChange={(e) => setEditorForm({ ...editorForm, listenPort: e.target.value })}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 font-mono transition-colors"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">自动配置预设</label>
              <select
                value={editorForm.optimizeType}
                onChange={(e) => setEditorForm({ ...editorForm, optimizeType: e.target.value })}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none cursor-pointer focus:border-amber-500"
              >
                <option value="直连透传加速">直连透传加速 (延迟小于15ms)</option>
                <option value="广播大厅增强">广播大厅增强 (我的世界/多人可用)</option>
                <option value="极速端口转发">极速端口转发 (自建专属服务)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-450 text-slate-950 font-sans text-xs font-bold py-2 px-4 rounded-lg transition-all cursor-pointer shadow-sm text-center"
              >
                保存并发布该方案
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Sync Table Details */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-2">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-bold text-slate-800">同步列表结果</h3>
            <span className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-slate-200/50">
              共 {filteredSolutions.length} 个规则集
            </span>
          </div>

          {/* Search Table */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-amber-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="搜索方案名称..."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#eeeef0] bg-slate-100/30">
                <th className="py-3 px-6 text-[11px] font-semibold text-slate-400">游戏名称</th>
                <th className="py-3 px-6 text-[11px] font-semibold text-slate-400">配置状态</th>
                <th className="py-3 px-6 text-[11px] font-semibold text-slate-400">适配版本</th>
                <th className="py-3 px-6 text-[11px] font-semibold text-slate-400">同步来源</th>
                <th className="py-3 px-6 text-[11px] font-semibold text-slate-400 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eeeef0]">
              {filteredSolutions.map((sol) => (
                <tr key={sol.id} className="hover:bg-amber-50/10 transition-colors">
                  <td className="py-4 px-6 font-sans text-xs font-semibold text-slate-700 flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200/40 flex items-center justify-center text-slate-500">
                      🕹️
                    </div>
                    {sol.name}
                  </td>
                  <td className="py-4 px-6">
                    {sol.status === 'updated' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        已更新至最新
                      </span>
                    )}
                    {sol.status === 'synced' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        已同步
                      </span>
                    )}
                    {sol.status === 'update_available' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        检测到新版本
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-sans text-xs text-slate-500">{sol.version}</td>
                  <td className="py-4 px-6 font-sans text-xs text-slate-500">{sol.source}</td>
                  <td className="py-4 px-6 text-right">
                    {sol.status === 'update_available' ? (
                      <button
                        onClick={() => handleUpdateClick(sol.id, sol.name)}
                        className="text-amber-600 hover:text-amber-800 font-sans text-xs font-semibold cursor-pointer"
                      >
                        一键更新
                      </button>
                    ) : (
                      <button
                        onClick={() => onTriggerToast(`正在查阅游戏方案 details of ${sol.name}...`)}
                        className="text-slate-400 hover:text-slate-700 font-sans text-xs font-semibold cursor-pointer"
                      >
                        详情
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredSolutions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-xs">
                    没有找到符合检索的游戏配置方案
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/20 text-slate-400 text-[11px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>检测缓存时间: <strong className="font-mono text-slate-600">{lastSyncTime}</strong> (已缓存绕过)</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleManualRefresh}
              disabled={isSyncing}
              className="text-[10.5px] text-amber-700 hover:text-amber-900 font-semibold underline cursor-pointer"
            >
              {isSyncing ? '强制刷新中...' : '手动刷新此缓存'}
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-[10px]">协议对齐自洽率: 100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
