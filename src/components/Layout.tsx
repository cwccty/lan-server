import type { ReactNode } from 'react';

type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';

const navItems: Array<{ id: Page; label: string; hint: string }> = [
  { id: 'home', label: '??', hint: '????' },
  { id: 'network', label: '??????', hint: 'n2n / LAN' },
  { id: 'wizard', label: 'Terraria ??', hint: '???????' },
  { id: 'scan', label: '????', hint: '?????' },
  { id: 'recommendation', label: '????', hint: '????' },
  { id: 'adapters', label: '?????', hint: '?????' },
  { id: 'diagnostics', label: '????', hint: '?????' }
];

const futureItems = ['????', 'UDP ???', 'Mod ??', 'Steam Relay ??', 'supernode ??'];

export function Layout({
  currentPage,
  onNavigate,
  children
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">?</div>
          <div>
            <h1>????</h1>
            <p>??????????</p>
          </div>
        </div>

        <nav className="side-nav" aria-label="???">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={currentPage === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => onNavigate(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </nav>

        <div className="future-box">
          <p className="future-title">??????</p>
          <div className="future-chip-grid">
            {futureItems.map((item) => <span key={item} className="future-chip">{item}</span>)}
          </div>
        </div>

        <div className="sidebar-footer">
          <span className="badge source-registry">??????</span>
          <p>????????????????????????????</p>
        </div>
      </aside>
      <main className="page-main">{children}</main>
    </div>
  );
}
