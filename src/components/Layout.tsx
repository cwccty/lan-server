import type { ReactNode } from 'react';

type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';

const navItems: Array<{ id: Page; label: string; hint: string }> = [
  { id: 'home', label: '首页', hint: '产品总览' },
  { id: 'network', label: '通用组网中心', hint: 'n2n / LAN' },
  { id: 'wizard', label: 'Terraria 向导', hint: '游戏辅助层示例' },
  { id: 'scan', label: '游戏扫描', hint: '匹配适配器' },
  { id: 'recommendation', label: '推荐方案', hint: '转换判断' },
  { id: 'adapters', label: '适配器管理', hint: '管理员功能' },
  { id: 'diagnostics', label: '诊断报告', hint: '真实检测项' }
];

const futureItems = ['发布验证页', 'Mod 管理', 'Steam Relay 插件', 'supernode 管理', 'adapter 审核后台'];

export function Layout({ currentPage, onNavigate, children }: { currentPage: Page; onNavigate: (page: Page) => void; children: ReactNode; }) {
  return (
    <div className="app-shell"><aside className="sidebar"><div className="brand-block"><div className="brand-mark">联</div><div><h1>联机助手</h1><p>游戏联机能力转换平台</p></div></div><nav className="side-nav" aria-label="主导航">{navItems.map((item) => <button key={item.id} className={currentPage === item.id ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(item.id)}><span>{item.label}</span><small>{item.hint}</small></button>)}</nav><div className="future-box"><p className="future-title">未来功能入口</p><div className="future-chip-grid">{futureItems.map((item) => <span key={item} className="future-chip">{item}</span>)}</div></div><div className="sidebar-footer"><span className="badge source-registry">共享适配器库</span><p>组网层、游戏辅助层、适配器层、诊断层分离；不做房间聊天。</p></div></aside><main className="page-main">{children}</main></div>
  );
}
