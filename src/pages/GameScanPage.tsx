import { GameCard } from '../components/GameCard';
import { saveGameAdapter } from '../api/tauri';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useState } from 'react';
import type { GameAdapter, GameSummary } from '../types/game';

const capabilityFilters = ['原生 LAN', '隐藏专用服务端', '广播发现', '端口代理可能', '社区 Mod', '官方服务器限定', '未知'];
const sourceFilters = ['builtin', 'registry', 'custom', 'steam_scan'];

function adapterDraftFromGame(game: GameSummary): GameAdapter {
  return {
    game_id: game.game_id,
    display_name: game.display_name,
    steam_appid: game.steam_appid,
    capabilities: game.capabilities.length ? game.capabilities : ['unknown'],
    adapter_source: 'custom',
    executables: [],
    default_ports: [],
    launch_profiles: [{ id: 'docs', name: '查看连接说明', type: 'docs' }],
    multiplayer_conversion: {
      capability: 'unknown',
      methods: ['manual_guide'],
      can_convert_to_lan: false,
      risk_level: 'high',
      notes: [
        '该游戏由扫描页生成本地草稿，尚未完成管理员认定。',
        game.detected_path ? `扫描路径：${game.detected_path}` : '未记录扫描路径。'
      ],
      required_components: ['人工适配']
    },
    network_type: 'unknown_need_review',
    connection_plan: {
      summary: '尚未认定游戏联机类型，需要管理员或高级用户测试后沉淀方案。',
      host_role: '待确认：请测试该游戏是否支持 LAN/IP、专用服务端、端口代理、UDP 广播发现、Mod 或仅官方联机。',
      join_role: '待确认：管理员认定后填写好友加入步骤。',
      default_join_host: '房主虚拟 IP',
      default_join_port: undefined,
      requires_virtual_lan: true,
      requires_tcp_port_proxy: false,
      requires_udp_broadcast_bridge: false,
      requires_dedicated_server: false,
      invite_template: ['该游戏尚未完成适配，请先人工确认联机方式。'],
      troubleshooting: ['确认游戏是否支持 LAN/IP/专用服务端/广播发现/Mod。']
    }
  };
}

export function GameScanPage({
  games,
  loading,
  error,
  loadedAt,
  onRefreshGames,
  onSelectGame,
  onAdapterCreated,
  onOpenAdapters
}: {
  games: GameSummary[];
  loading?: boolean;
  error?: string;
  loadedAt?: number | null;
  onRefreshGames?: () => Promise<void> | void;
  onSelectGame: (id: string) => void;
  onAdapterCreated?: () => Promise<void> | void;
  onOpenAdapters?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const matchedCount = games.filter((game) => game.multiplayer_conversion && game.connection_plan && game.network_type !== 'unknown_need_review').length;
  const manualCount = games.filter((game) => !game.multiplayer_conversion || !game.connection_plan || game.network_type === 'unknown_need_review').length;

  const createDraft = async (game: GameSummary) => {
    setBusy(true);
    setMessage('');
    try {
      const saved = await saveGameAdapter(adapterDraftFromGame(game));
      await onAdapterCreated?.();
      setMessage(`已为 ${saved.display_name} 创建本地适配器草稿。下一步进入“适配器管理”认定游戏类型并补齐 connection_plan。`);
    } catch (error) {
      setMessage(`创建适配器草稿失败：${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const refreshing = Boolean(loading);
  const scanTime = loadedAt ? new Date(loadedAt).toLocaleString() : '尚未完成扫描';

  return (
    <section className="page-stack scan-page modern-content-page">
      <LoadingOverlay
        visible={busy || refreshing}
        title={busy ? '正在创建适配器草稿' : '正在扫描游戏'}
        message={busy ? '正在写入本地 custom adapter，请稍等。' : '正在读取本机游戏与适配器信息，首次扫描可能需要几秒钟。'}
      />

      <div className="scan-page-title">
        <div>
          <h2>游戏扫描</h2>
          <p>智能扫描当前电脑中安装的局域网游戏，并调配最佳联机设置。</p>
          <small>上次全盘检索缓存：{scanTime}　数据状态：本地快照缓存已就绪</small>
        </div>
        <div className="scan-title-actions">
          <span className="future-chip">手动重扫目录：未来能力</span>
          <button type="button" className="secondary" disabled={refreshing || busy} onClick={() => onRefreshGames?.()}>
            强同步 Steam 自适应映射
          </button>
        </div>
      </div>

      {error && (
        <div className="error-card">
          <strong>扫描失败：</strong>{error}
          <div className="actions">
            <button type="button" onClick={() => onRefreshGames?.()} disabled={refreshing || busy}>重新扫描</button>
          </div>
        </div>
      )}

      {message && (
        <div className="status-banner">
          {message}
          <div className="actions">
            {onOpenAdapters && <button type="button" className="secondary" onClick={onOpenAdapters}>进入适配器管理继续认定</button>}
          </div>
        </div>
      )}

      <article className="scan-command-card">
        <div className="scan-search-box">
          <span>⌕</span>
          <input readOnly value="" placeholder="搜索您电脑中的联机游戏名称..." />
        </div>
        <div className="scan-quick-filter" aria-label="快速分类">
          <span>快速分类：</span>
          <button type="button" className="active">全部</button>
          <button type="button" className="secondary">已配置</button>
          <button type="button" className="secondary">未配置</button>
        </div>
      </article>

      <div className="scan-toolbar-row">
        <button disabled={refreshing || busy} onClick={() => onRefreshGames?.()}>
          {refreshing ? '正在扫描...' : '开始扫描'}
        </button>
        {onOpenAdapters ? (
          <button type="button" className="secondary" disabled={refreshing || busy} onClick={onOpenAdapters}>
            去同步共享方案库
          </button>
        ) : (
          <button className="secondary" disabled>去同步共享方案库</button>
        )}
        <p className="muted">当前扫描来源：Steam 库、内置适配器、共享库和本地 custom adapter。手动选择任意目录尚未接入后端。</p>
      </div>

      <div className="scan-stat-strip">
        <article><span>已发现</span><strong>{games.length}</strong></article>
        <article><span>已配置</span><strong>{matchedCount}</strong></article>
        <article><span>需人工适配</span><strong>{manualCount}</strong></article>
        <article><span>状态</span><strong>{refreshing ? '扫描中' : error ? '失败' : '已缓存'}</strong></article>
      </div>

      {games.length === 0 && !refreshing && !error ? (
        <article className="card empty-state">
          <h3>暂未发现游戏</h3>
          <p className="muted">可以先同步共享适配器库，或者到适配器管理中导入/创建游戏适配器。</p>
          <p>管理员认定游戏类型并生成适配器后，其他用户之后遇到这个游戏就可以复用。</p>
        </article>
      ) : (
        <div className="scan-game-grid">
          {games.map((game) => (
            <GameCard
              key={game.game_id}
              game={game}
              onSelect={() => onSelectGame(game.game_id)}
              onCreateAdapterDraft={() => createDraft(game)}
            />
          ))}
        </div>
      )}

      <aside className="scan-filter-drawer">
        <h3>筛选与未来能力</h3>
        <h4>能力类型</h4>
        <div className="filter-list">{capabilityFilters.map((item) => <span className="badge" key={item}>{item}</span>)}</div>
        <h4>适配器来源</h4>
        <div className="filter-list">{sourceFilters.map((item) => <span className={'badge source-' + item} key={item}>{item}</span>)}</div>
      </aside>
    </section>
  );
}
