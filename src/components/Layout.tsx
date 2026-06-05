// Deprecated legacy layout.
// 当前发布入口使用 src/reference-ui/components/Sidebar.tsx 和最终参考前端 (3)。
// 本布局不是当前 EXE 的侧边栏来源，保留仅用于历史对照。
import { useEffect, useState, type ReactNode } from 'react';

type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';

const navItems: Array<{ id: Page; label: string; hint: string; group: string; icon: string; alert?: boolean }> = [
  { id: 'home', label: '首页', hint: '桌面大厅', group: '开始', icon: '⌂' },
  { id: 'adapters', label: '方案库', hint: '共享适配', group: '准备', icon: '▥' },
  { id: 'scan', label: '游戏扫描', hint: '本机游戏', group: '准备', icon: '◎' },
  { id: 'recommendation', label: '推荐方案', hint: '连接路径', group: '执行', icon: '◇' },
  { id: 'network', label: '通用组网中心', hint: 'n2n / 代理', group: '执行', icon: '◉' },
  { id: 'wizard', label: 'Terraria 向导', hint: '开服 / 加入', group: '执行', icon: '✣' },
  { id: 'diagnostics', label: '诊断报告', hint: '链路性能', group: '排查', icon: '⌁', alert: true }
];

const pageMeta: Record<Page, { label: string; hint: string }> = Object.fromEntries(
  navItems.map((item) => [item.id, { label: item.label, hint: item.hint }])
) as Record<Page, { label: string; hint: string }>;
const navGroups = Array.from(new Set(navItems.map((item) => item.group)));

export function Layout({
  currentPage,
  onNavigate,
  children
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  const current = pageMeta[currentPage];
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigateWithToast = (page: Page) => {
    onNavigate(page);
    setToast(`已切换到：${pageMeta[page].label}`);
  };

  return (
    <div className="app-shell premium-shell ios-shell">
      <aside className="sidebar premium-sidebar ios-sidebar">
        <div className="brand-block premium-brand ios-brand">
          <div className="brand-mark ios-brand-mark">✣</div>
          <div>
            <h1>联机助手</h1>
            <p>高级局域网联机工具</p>
          </div>
        </div>

        <nav className="side-nav premium-nav" aria-label="主导航">
          {navGroups.map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-group-title">{group}</span>
              {navItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    className={currentPage === item.id ? 'nav-item active ios-nav-item' : 'nav-item ios-nav-item'}
                    onClick={() => navigateWithToast(item.id)}
                  >
                    <span className="nav-item-main">
                      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                      <span>{item.label}</span>
                      {item.alert && <span className="nav-alert-dot" aria-hidden="true" />}
                    </span>
                    <small>{item.hint}</small>
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-insight ios-sidebar-insight">
          <div>
            <p className="sidebar-update-row"><span>↻ 版本更新</span><strong>V2.4.1</strong></p>
            <p className="sidebar-user-row"><span>♙</span><strong>本地玩家</strong><small>高级订阅会员</small></p>
          </div>
        </div>
      </aside>

      <main className="page-main premium-main ios-main">
        <div className="top-command-bar ios-command-bar">
          <div className="top-tabs">
            <button type="button" className="top-tab active">本心特性</button>
            <button type="button" className="top-tab">支持中心</button>
          </div>
          <div className="top-command-actions">
            <span className="shell-status-pill"><span /> 等待真实诊断</span>
            <button type="button" className="secondary glass-button" onClick={() => navigateWithToast('diagnostics')}>⌁ 打开诊断</button>
            <button type="button" className="danger disconnect-button" onClick={() => navigateWithToast('network')}>打开组网中心</button>
            <span className="top-icon-button">♢</span>
            <span className="top-icon-button">⊙</span>
          </div>
        </div>
        {children}
      </main>

      {toast && (
        <div className="global-toast" role="status" aria-live="polite">
          <span className="toast-icon">✓</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
