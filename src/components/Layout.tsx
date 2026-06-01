import type { ReactNode } from 'react';

type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics';

export function Layout({
  currentPage,
  onNavigate,
  children
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  const items: Array<[Page, string]> = [
    ['home', '首页'],
    ['network', '通用组网中心'],
    ['wizard', 'Terraria 向导'],
    ['scan', '游戏扫描'],
    ['recommendation', '推荐方案'],
    ['diagnostics', '诊断报告']
  ];

  return (
    <div className="app-shell">
      <aside>
        <h1>联机助手</h1>
        {items.map(([id, label]) => (
          <button key={id} className={currentPage === id ? 'active' : ''} onClick={() => onNavigate(id)}>
            {label}
          </button>
        ))}
      </aside>
      <main>{children}</main>
    </div>
  );
}
