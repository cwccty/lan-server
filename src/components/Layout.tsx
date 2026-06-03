import type { ReactNode } from 'react';

type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';

const navItems: Array<{ id: Page; label: string; hint: string }> = [
  { id: 'home', label: '首页', hint: '产品总览' },
  { id: 'network', label: '通用组网中心', hint: 'n2n / LAN' },
  { id: 'wizard', label: 'Terraria 向导', hint: '开服 / 加入' },
  { id: 'scan', label: '游戏扫描', hint: '找到本机游戏' },
  { id: 'recommendation', label: '推荐方案', hint: '下一步怎么连' },
  { id: 'adapters', label: '方案库', hint: '更新游戏方案' },
  { id: 'diagnostics', label: '诊断报告', hint: '失败时查看' }
];

const futureItems = ['更多游戏方案', '自动下载组件', 'supernode 管理', '平台联机方案'];

export function Layout({ currentPage, onNavigate, children }: { currentPage: Page; onNavigate: (page: Page) => void; children: ReactNode; }) {
  return (
    <div className="app-shell"><aside className="sidebar"><div className="brand-block"><div className="brand-mark">联</div><div><h1>联机助手</h1><p>小型游戏联机工具</p></div></div><nav className="side-nav" aria-label="主导航">{navItems.map((item) => <button key={item.id} className={currentPage === item.id ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(item.id)}><span>{item.label}</span><small>{item.hint}</small></button>)}</nav><div className="future-box"><p className="future-title">后续计划</p><div className="future-chip-grid">{futureItems.map((item) => <span key={item} className="future-chip">{item}</span>)}</div></div><div className="sidebar-footer"><span className="badge source-registry">提示</span><p>先完成组网，再按游戏说明连接房主虚拟 IP。</p></div></aside><main className="page-main">{children}</main></div>
  );
}
