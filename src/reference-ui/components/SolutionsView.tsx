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
  const [showSyncReport, setShowSyncReport] = useState(true);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorForm, setEditorForm] = useState({
    name: '',
    steamAppId: '',
    execFeature: '',
    version: '1.0.0',
    protocol: 'UDP-P2P',
    conversionProfile: 'Virtual LAN',
    listenPort: '7777',
    hostRole: '1. 运行本地游戏客户端或配置服务端；\n2. 开放对应端口并启动局域网联机服务；',
    joinRole: '1. 复制好友的特邀报文包；\n2. 开机一键并网并打开局域网搜索；',
    defaultJoinIp: '10.0.8.1',
    inviteTemplate: '[联机助手-特邀函]\n房间: Default_Room\n密钥: a8f9-2b4c-99e1',
    source: '自建方案库',
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
      source: `${editorForm.conversionProfile} (自建方案)`
    };
    setSolutions([newSolution, ...solutions]);
    onTriggerToast(`共享方案 [${editorForm.name}] 认定及映射配置成功！已固化保存至本地方案配置文件库。`);
    setEditorForm({
      name: '',
      steamAppId: '',
      execFeature: '',
      version: '1.0.0',
      protocol: 'UDP-P2P',
      conversionProfile: 'Virtual LAN',
      listenPort: '7777',
      hostRole: '1. 运行本地游戏客户端或配置服务端；\n2. 开放对应端口并启动局域网联机服务；',
      joinRole: '1. 复制好友的特邀报文包；\n2. 开机一键并网并打开局域网搜索；',
      defaultJoinIp: '10.0.8.1',
      inviteTemplate: '[联机助手-特邀函]\n房间: Default_Room\n密钥: a8f9-2b4c-99e1',
      source: '自建方案库',
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
        <form onSubmit={handleSaveEditor} className="bg-slate-900 text-slate-200 rounded-2xl p-6 border border-slate-800 shadow-md space-y-4 font-sans animate-fade-in text-xs">
          <div className="flex items-center justify-between border-b border-slate-850 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4.5 h-4.5 text-amber-500" />
              <h3 className="text-[13px] font-bold text-amber-500">
                高级游戏适配规则编辑器 (Adapter Schema Builder)
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">存储级别: 局域网本地 / 共享方案发布源</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Row 1 */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">游戏及方案名称</label>
              <input
                type="text"
                value={editorForm.name}
                onChange={(e) => setEditorForm({ ...editorForm, name: e.target.value })}
                placeholder="例如: 幻兽帕鲁 (Palworld)"
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 transition-colors"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">Steam 专属 AppID (可空)</label>
              <input
                type="text"
                value={editorForm.steamAppId}
                onChange={(e) => setEditorForm({ ...editorForm, steamAppId: e.target.value })}
                placeholder="例如: 105600"
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 font-mono transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">可执行程序拦截特征 (exe)</label>
              <input
                type="text"
                value={editorForm.execFeature}
                onChange={(e) => setEditorForm({ ...editorForm, execFeature: e.target.value })}
                placeholder="例如: terraria.exe"
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 font-mono transition-colors"
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

            {/* Row 2 */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">网络转换模式 (Conversion Profile)</label>
              <select
                value={editorForm.conversionProfile}
                onChange={(e) => setEditorForm({ ...editorForm, conversionProfile: e.target.value })}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none cursor-pointer focus:border-amber-500"
              >
                <option value="Virtual LAN">Virtual LAN (虚拟局域网络直透)</option>
                <option value="Dedicated Server Launcher">Dedicated Server Launcher (服务端专用拉起)</option>
                <option value="Broadcast Bridge">Broadcast Bridge (局域网大厅组播重组)</option>
                <option value="Port Proxy">Port Proxy (双向低延端口代理协议)</option>
                <option value="Steam Relay Plugin">Steam Relay Plugin (P2P中继插件载入)</option>
                <option value="Manual Link">Manual Link (手动组网自设端)</option>
                <option value="Official Servers Only">Official Servers Only (绕过直连官方网)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">传输底层协议</label>
              <select
                value={editorForm.protocol}
                onChange={(e) => setEditorForm({ ...editorForm, protocol: e.target.value })}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none cursor-pointer focus:border-amber-500"
              >
                <option value="UDP-P2P">UDP-P2P (最优极速直连)</option>
                <option value="TCP-Relay">TCP-Relay (回退安全中继隧道)</option>
                <option value="UPnP-Forward">UPnP-Forward (UPnP自动映射通路)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">游戏运行默认端口</label>
              <input
                type="text"
                value={editorForm.listenPort}
                onChange={(e) => setEditorForm({ ...editorForm, listenPort: e.target.value })}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 font-mono transition-colors"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">客户端默认加入地址 (Join IP)</label>
              <input
                type="text"
                value={editorForm.defaultJoinIp}
                onChange={(e) => setEditorForm({ ...editorForm, defaultJoinIp: e.target.value })}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 font-mono transition-colors"
              />
            </div>
          </div>

          {/* Row 3 - Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">
                房主/服务端配置行为指南 (connection_plan.host_role)
              </label>
              <textarea
                value={editorForm.hostRole}
                onChange={(e) => setEditorForm({ ...editorForm, hostRole: e.target.value })}
                rows={3}
                placeholder="请输入服务端操作指示..."
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 transition-colors font-sans resize-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-semibold pl-1">
                加入端/客机配置行为指南 (connection_plan.join_role)
              </label>
              <textarea
                value={editorForm.joinRole}
                onChange={(e) => setEditorForm({ ...editorForm, joinRole: e.target.value })}
                rows={3}
                placeholder="请输入并网客机客户端步骤..."
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 transition-colors font-sans resize-none"
              />
            </div>
          </div>

          {/* Row 4 - Invite Template */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 font-semibold pl-1">
              特邀邀请密信排版模板 (Invite Template)
            </label>
            <textarea
              value={editorForm.inviteTemplate}
              onChange={(e) => setEditorForm({ ...editorForm, inviteTemplate: e.target.value })}
              rows={2}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg outline-none focus:border-amber-500 transition-colors font-mono resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              取消编辑
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-450 text-slate-950 font-sans font-semibold rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              一键发布登记至共享适配器库
            </button>
          </div>
        </form>
      )}

      {/* Feature: Collapsible Database Sync Metrics Board (Item 3.10) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4.5 h-4.5 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
            <h3 className="text-sm font-bold text-slate-800">官方与社区共享方案库同步结果 (Registry Sync Details)</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowSyncReport(!showSyncReport)}
            className="text-xs text-amber-600 hover:text-amber-800 font-semibold cursor-pointer select-none"
          >
            {showSyncReport ? '收起同步明细表' : '展开同步明细表 (Show Details)'}
          </button>
        </div>

        {/* Sync Counters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-9 gap-3 mt-4 text-center">
          <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">总同步项</span>
            <span className="text-sm font-bold text-slate-700 mt-1 block">146</span>
          </div>
          <div className="p-2 bg-emerald-50 border border-emerald-100/60 rounded-xl">
            <span className="text-[10px] text-emerald-600 block font-semibold">本地新设</span>
            <span className="text-sm font-bold text-emerald-700 mt-1 block">12</span>
          </div>
          <div className="p-2 bg-indigo-50 border border-indigo-100/60 rounded-xl">
            <span className="text-[10px] text-indigo-600 block font-semibold">方案更新</span>
            <span className="text-sm font-bold text-indigo-700 mt-1 block">8</span>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">无变动跳过</span>
            <span className="text-sm font-bold text-slate-500 mt-1 block">125</span>
          </div>
          <div className="p-2 bg-red-50 border border-red-100/40 rounded-xl">
            <span className="text-[10px] text-red-600 block font-semibold">Hash 校验失败</span>
            <span className="text-sm font-bold text-red-700 mt-1 block">1</span>
          </div>
          <div className="p-2 bg-slate-50/50 border border-slate-100 rounded-xl opacity-60">
            <span className="text-[10px] text-slate-400 block">解析失败</span>
            <span className="text-sm font-bold text-slate-500 mt-1 block">0</span>
          </div>
          <div className="p-2 bg-slate-50/50 border border-slate-100 rounded-xl opacity-60">
            <span className="text-[10px] text-slate-400 block">拉取失败</span>
            <span className="text-sm font-bold text-slate-500 mt-1 block">0</span>
          </div>
          <div className="p-2 bg-slate-50/50 border border-slate-100 rounded-xl opacity-60">
            <span className="text-[10px] text-slate-400 block">格式违规</span>
            <span className="text-sm font-bold text-slate-500 mt-1 block">0</span>
          </div>
          <div className="p-2 bg-slate-50/50 border border-slate-100 rounded-xl opacity-60">
            <span className="text-[10px] text-slate-400 block">本地写故障</span>
            <span className="text-sm font-bold text-slate-500 mt-1 block">0</span>
          </div>
        </div>

        {/* Action Log sub-table details */}
        {showSyncReport && (
          <div className="mt-4 border border-slate-100 rounded-xl overflow-hidden shadow-inner">
            <table className="w-full text-left border-collapse text-[10.5px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-2.5 px-4 font-semibold text-slate-500">同步的联机游戏名</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-500">适配方案注册数据库 Endpoint</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-500">同步结果行为</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-500">校验详情 / 错误溯源</th>
                  <th className="py-2.5 px-4 font-semibold text-slate-500">本地固化路径</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="py-2 px-4 font-bold text-slate-700">幻兽帕鲁 (Palworld - Steam)</td>
                  <td className="py-2 px-4 font-mono text-slate-400 font-sans">/solutions/shared/v2/pal.json</td>
                  <td className="py-2 px-4">
                    <span className="text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-semibold text-[9px]">UPDATED (更新)</span>
                  </td>
                  <td className="py-2 px-4 text-slate-500 font-mono">MD5_Verified (3e41fb)</td>
                  <td className="py-2 px-4 text-slate-400 font-mono">~/AppData/cached_pal.json</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-bold text-slate-700">我的世界 (Minecraft Forge)</td>
                  <td className="py-2 px-4 font-mono text-slate-400 font-sans">/solutions/shared/v2/minecraft.json</td>
                  <td className="py-2 px-4">
                    <span className="text-slate-500 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded font-semibold text-[9px]">SKIPPED (跳过)</span>
                  </td>
                  <td className="py-2 px-4 text-slate-400 font-mono">Hash_Matches_Local</td>
                  <td className="py-2 px-4 text-slate-400 font-mono">~/AppData/cached_mc.json</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-bold text-slate-700">泰拉瑞亚 (Terraria V1.4)</td>
                  <td className="py-2 px-4 font-mono text-slate-400 font-sans">/solutions/shared/v2/terraria.json</td>
                  <td className="py-2 px-4">
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded font-semibold text-[9px]">CREATED (写入)</span>
                  </td>
                  <td className="py-2 px-4 text-slate-500 font-mono">MD5_Verified (8bfdd21)</td>
                  <td className="py-2 px-4 text-slate-400 font-mono">~/AppData/cached_terraria.json</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-bold text-slate-700">艾尔登法环 (Elden Ring 广域)</td>
                  <td className="py-2 px-4 font-mono text-slate-400 font-sans">/solutions/shared/v2/elden.json</td>
                  <td className="py-2 px-4">
                    <span className="text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-semibold text-[9px]">HASH_VERIFY_ERROR</span>
                  </td>
                  <td className="py-2 px-4 text-red-500 font-bold font-sans">SHA256 signature mismatched: expected pass but got mismatch!</td>
                  <td className="py-2 px-4 text-slate-350 font-mono">--- (未予固化安全写入)</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

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
