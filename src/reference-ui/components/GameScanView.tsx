import { useState } from 'react';
import { INITIAL_GAMES } from '../data';
import { GameScan } from '../types';
import {
  FolderOpen,
  RefreshCw,
  Search,
  Filter,
  Gamepad2,
  AlertCircle,
  CheckCircle,
  Eye,
  FileEdit,
  PlusCircle
} from 'lucide-react';

interface GameScanViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

export default function GameScanView({ onTriggerToast, onNavigateTab }: GameScanViewProps) {
  const [games, setGames] = useState<GameScan[]>(INITIAL_GAMES);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'configured' | 'unconfigured'>('all');
  const [isScanning, setIsScanning] = useState(false);

  // Feature 10: Cache and Manual Refresh states
  const [lastScanTime, setLastScanTime] = useState('2026-06-03 14:15:22');

  // Feature 2: Game Details modal state
  const [selectedGame, setSelectedGame] = useState<GameScan | null>(null);

  const handleScanGames = () => {
    setIsScanning(true);
    onTriggerToast('正在检索本地 Steam, Epic, GoG 常用注册表，并重试刷新文件缓存...');
    setTimeout(() => {
      setIsScanning(false);
      const now = new Date();
      setLastScanTime(now.toLocaleString());
      onTriggerToast('全盘重扫完成！发现 4 款可同步局域网游戏，已同步刷新诊断快照。');
    }, 1500);
  };

  const handleRefreshSteam = () => {
    setIsScanning(true);
    onTriggerToast('正在连接本地 Steam Client Socket (强制同步最新缓存并获取库详情)...');
    setTimeout(() => {
      const now = new Date();
      setLastScanTime(now.toLocaleString());
      setIsScanning(false);
      onTriggerToast('Steam 游戏云端状态与本地运行环境强配就绪！最新缓存已固化。');
    }, 1200);
  };

  const handleCreateScheme = (name: string, id: string) => {
    onTriggerToast(`正在为 [${name}] 生成网络代理方案...`);
    if (id === 'terraria') {
      onNavigateTab('terraria');
    } else {
      onNavigateTab('network');
    }
  };

  const handleOpenGameDetails = (game: GameScan) => {
    setSelectedGame(game);
    onTriggerToast(`加载 [${game.name}] 多源连通分析数据中...`);
  };

  const filteredGames = games.filter((game) => {
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'configured') {
      return matchesSearch && game.status !== 'unconfigured';
    }
    if (activeFilter === 'unconfigured') {
      return matchesSearch && game.status === 'unconfigured';
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">游戏扫描</h2>
          <p className="font-sans text-sm text-slate-500 mt-1">智能扫描当前电脑中安装的局域网游戏，并调配最佳联机设置。</p>
          <p className="text-[11px] text-slate-400 font-mono mt-1">上次全盘检索缓存: <strong className="text-slate-600">{lastScanTime}</strong> ｜ 数据状态: 本地快照缓存已就绪</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleScanGames}
            disabled={isScanning}
            className="bg-white border border-amber-200 hover:bg-slate-50 text-slate-700 flex items-center gap-2 px-4 py-2 rounded-lg font-sans text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <FolderOpen className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? '正在扫描磁盘并重刷...' : '手动重扫以刷新缓存'}
          </button>
          <button
            onClick={handleRefreshSteam}
            className="bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-2 px-4 py-2 rounded-lg font-sans text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            强同步 Steam 自适应映射
          </button>
        </div>
      </header>

      {/* Search and Category Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 outline-none transition-all"
            placeholder="搜索您盘中的联机游戏名称..."
          />
        </div>

        <div className="h-6 w-px bg-slate-200 hidden md:block" />

        <div className="flex items-center gap-2 w-full md:w-auto justify-between sm:justify-start">
          <span className="text-slate-400 text-xs font-sans flex items-center gap-1">
            <Filter className="w-3 h-3" />
            快速分类:
          </span>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 text-xs font-semibold">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setActiveFilter('configured')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeFilter === 'configured' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              已配置
            </button>
            <button
              onClick={() => setActiveFilter('unconfigured')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeFilter === 'unconfigured' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              未配置
            </button>
          </div>
        </div>
      </div>

      {/* Bento Grid layout representing Game cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredGames.map((game) => (
          <article
            key={game.id}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-amber-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group"
          >
            {/* Background shimmer */}
            <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-slate-500/5 rounded-full blur-2xl group-hover:bg-amber-500/5 pointer-events-none transition-all duration-500" />
            
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200/30 overflow-hidden flex items-center justify-center text-2xl relative shadow-sm">
                {game.coverUrl ? (
                  <img
                    src={game.coverUrl}
                    alt={game.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Gamepad2 className="w-6 h-6 text-slate-400" />
                )}
              </div>

              {/* Config Status Tags */}
              {game.status === 'ready' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-100 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  环境就绪
                </span>
              )}
              {game.status === 'needs_optimize' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-100 flex items-center gap-1 animate-pulse">
                  <span className="w-1 h-1 bg-amber-500 rounded-full" />
                  需优化
                </span>
              )}
              {game.status === 'unconfigured' && (
                <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 text-[10px] font-bold border border-slate-200/50 flex items-center gap-1">
                  <span className="w-1 h-1 bg-slate-400 rounded-full" />
                  未配置
                </span>
              )}
            </div>

            <div className="mb-6">
              <h3 className="font-heading text-sm font-bold text-slate-800 truncate leading-snug group-hover:text-amber-700 transition-colors">
                {game.name}
              </h3>
              <p className="font-sans text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                上次游玩: {game.lastPlayed}
              </p>
            </div>

            <div className="flex flex-col gap-1.5 mt-auto pt-4 border-t border-slate-100">
              {game.status === 'unconfigured' ? (
                <button
                  onClick={() => handleCreateScheme(game.name, game.id)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-sans text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  创建网络方案
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleOpenGameDetails(game)}
                    className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 font-sans text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-600" />
                    查看分析与推荐方案
                  </button>
                  <button
                    onClick={() => handleCreateScheme(game.name, game.id)}
                    className="w-full py-2 bg-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-800 font-sans text-xs font-semibold rounded-lg border border-slate-200/60 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    创建局域网组网草稿
                  </button>
                </>
              )}
            </div>
          </article>
        ))}

        {filteredGames.length === 0 && (
          <div className="col-span-12 py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-sans text-xs text-slate-500 font-medium">未在本机磁盘或Steam中匹配到符合该分类的游戏</p>
            <button
              onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
            >
              清除过滤条件
            </button>
          </div>
        )}
      </div>

      {/* Feature 2: Game Details / Analysis Results Modal Slideover */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-slate-100 shadow-2xl flex flex-col font-sans">
            <div className="bg-slate-900 p-6 text-white relative">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-slate-850 overflow-hidden flex items-center justify-center border border-slate-700 font-bold text-xl">
                  {selectedGame.coverUrl ? (
                    <img src={selectedGame.coverUrl} alt={selectedGame.name} className="w-full h-full object-cover" />
                  ) : '🕹️'}
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold text-amber-400">{selectedGame.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">上次扫描时间: {lastScanTime}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedGame(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Analysis Indicators Grid */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">联机环境评级</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 text-xs font-bold border border-emerald-500/20">
                    A+ 极佳穿透
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">建议组网通道</span>
                  <span className="text-xs text-slate-700 font-mono font-bold">N2N Direct (P2P 直连模式)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">网络适配器要求</span>
                  <span className="text-xs text-slate-700 font-bold">TUN 虚拟网卡 (正常运转)</span>
                </div>
              </div>

              {/* Game Specific Port Requirements */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">🔥 核心网络端口与协议需求</h4>
                <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">自建大厅监听端口</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                      {selectedGame.id === 'terraria' ? '7777 (UDP)' : 
                       selectedGame.id === 'palworld' ? '8211 (UDP/TCP)' : 
                       selectedGame.id === 'minecraft' ? '25565 / 19132 (UDP)' : '27015 (UDP)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    诊断证据: 本地未发现大厅占用冲突，安全。局域网主机需要将该端口加入防火墙入站例外规则，才能帮助被直连好友感知。
                  </div>
                </div>
              </div>

              {/* Action Suggestions */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">💡 专家一键式优化建议</h4>
                <ul className="text-xs text-slate-600 space-y-2 pl-3 list-disc">
                  <li>开启<strong>“UDP 广播桥”</strong>以确保好友在大厅能直接“秒扫”出房间列表，无需输入IP。</li>
                  <li>在极严格对称NAT网络下，请按推荐配置勾选<strong>“TCP 端口代理”</strong>以提供备用打洞。</li>
                  <li>虚拟局域网建立后，邀请好友在<strong>“推荐方案”</strong>页生成专属直连秘信。</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button 
                onClick={() => setSelectedGame(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
              >
                关闭
              </button>
              <button 
                onClick={() => {
                  setSelectedGame(null);
                  onTriggerToast(`正在为 [${selectedGame.name}] 极速加载调配推荐方案...`);
                  onNavigateTab('protocol');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                查看推荐配置方案
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
