import type { ReactNode } from 'react';

type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';

const navItems: Array<{ id: Page; label: string; hint: string; group: string }> = [
  { id: 'home', label: '首页', hint: '总览与开始', group: '开始' },
  { id: 'adapters', label: '方案库', hint: '更新游戏方案', group: '准备' },
  { id: 'scan', label: '游戏扫描', hint: '找到本机游戏', group: '准备' },
  { id: 'recommendation', label: '推荐方案', hint: '下一步怎么连', group: '执行' },
  { id: 'network', label: '通用组网中心', hint: 'n2n / LAN', group: '执行' },
  { id: 'wizard', label: 'Terraria 向导', hint: '开服 / 加入', group: '执行' },
  { id: 'diagnostics', label: '诊断报告', hint: '失败时查看', group: '排查' }
];

const pageMeta: Record<Page, { label: string; hint: string }> = Object.fromEntries(navItems.map((item) => [item.id, { label: item.label, hint: item.hint }])) as Record<Page, { label: string; hint: string }>;
const navGroups = Array.from(new Set(navItems.map((item) => item.group)));

export function Layout({ currentPage, onNavigate, children }: { currentPage: Page; onNavigate: (page: Page) => void; children: ReactNode; }) {
  const current = pageMeta[currentPage];

  return (
    <div className="app-shell premium-shell">
      <aside className="sidebar premium-sidebar">
        <div className="brand-block premium-brand">
          <div className="brand-mark">联</div>
          <div>
            <h1>联机助手</h1>
            <p>把复杂联机流程变成可执行步骤</p>
          </div>
        </div>

        <nav className="side-nav premium-nav" aria-label="主导航">
          {navGroups.map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-group-title">{group}</span>
              {navItems.filter((item) => item.group === group).map((item) => (
                <button key={item.id} className={currentPage === item.id ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(item.id)}>
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-insight">
          <span className="insight-dot" />
          <div>
            <strong>建议路径</strong>
            <p>方案库 → 扫描游戏 → 推荐方案 → 通用组网</p>
          </div>
        </div>
      </aside>

      <main className="page-main premium-main">
        <div className="top-command-bar">
          <div>
            <span>当前页面</span>
            <strong>{current.label}</strong>
            <small>{current.hint}</small>
          </div>
          <div className="top-command-actions">
            <button type="button" className="secondary" onClick={() => onNavigate('diagnostics')}>打开诊断</button>
            <button type="button" onClick={() => onNavigate('network')}>启动组网</button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
