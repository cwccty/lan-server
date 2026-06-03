import { useEffect, useState, type ReactNode } from 'react';

type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';

const navItems: Array<{ id: Page; label: string; hint: string; group: string; icon: string; alert?: boolean }> = [
  { id: 'home', label: '首页', hint: '总览与开始', group: '开始', icon: '⌘' },
  { id: 'adapters', label: '方案库', hint: '更新共享方案', group: '准备', icon: '▦' },
  { id: 'scan', label: '游戏扫描', hint: '找到本机游戏', group: '准备', icon: '◎' },
  { id: 'recommendation', label: '推荐方案', hint: '下一步怎么连', group: '执行', icon: '✓' },
  { id: 'network', label: '通用组网中心', hint: 'n2n / 代理 / 广播桥', group: '执行', icon: '◇' },
  { id: 'wizard', label: 'Terraria 向导', hint: '开服 / 加入', group: '执行', icon: '✦' },
  { id: 'diagnostics', label: '诊断报告', hint: '失败时查看', group: '排查', icon: '!', alert: true }
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
          <div className="brand-mark ios-brand-mark">联</div>
          <div>
            <h1>联机助手</h1>
            <p>小型游戏联机工具</p>
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
          <span className="insight-dot" />
          <div>
            <strong>建议路径</strong>
            <p>方案库 → 扫描游戏 → 推荐方案 → 通用组网</p>
          </div>
        </div>
      </aside>

      <main className="page-main premium-main ios-main">
        <div className="top-command-bar ios-command-bar">
          <div>
            <span>当前页面</span>
            <strong>{current.label}</strong>
            <small>{current.hint}</small>
          </div>
          <div className="top-command-actions">
            <span className="shell-status-pill"><span /> 待真实检测</span>
            <button type="button" className="secondary glass-button" onClick={() => navigateWithToast('diagnostics')}>打开诊断</button>
            <button type="button" onClick={() => navigateWithToast('network')}>打开组网</button>
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
