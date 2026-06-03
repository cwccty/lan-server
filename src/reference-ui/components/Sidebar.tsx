import { AppTab } from '../types';
import {
  Home,
  Library,
  Target,
  ShieldCheck,
  Globe,
  Wand2,
  Activity,
  Settings,
  RefreshCw,
  User,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  status: string;
  onShowVersion: () => void;
}

interface MenuItem {
  id: AppTab;
  label: string;
  icon: any;
  badge?: string;
  alert?: boolean;
}

export default function Sidebar({ currentTab, onChangeTab, status, onShowVersion }: SidebarProps) {
  const menuItems: readonly MenuItem[] = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'solutions', label: '方案库', icon: Library },
    { id: 'games', label: '游戏扫描', icon: Target },
    { id: 'protocol', label: '推荐方案', icon: ShieldCheck },
    { id: 'network', label: '通用组网中心', icon: Globe },
    { id: 'terraria', label: 'Terraria 向导', icon: Wand2, badge: 'New' },
    { id: 'diagnostics', label: '诊断报告', icon: Activity, alert: true },
    { id: 'settings', label: '设置与帮助', icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-slate-50 border-r border-[#eeeef0] flex flex-col justify-between py-6 px-4 z-50 shadow-sm">
      {/* Brand Header */}
      <div className="px-4 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shadow-sm">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold text-slate-800 tracking-tight leading-none">联机助手</h1>
          <p className="font-sans text-xs text-slate-400 mt-1">高级局域网联机工具</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto pr-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 text-left relative ${
                isActive
                  ? 'bg-amber-500/10 text-amber-700 font-medium scale-[0.98]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="text-[14px]">{item.label}</span>
              </div>
              
              {/* Optional Active Left Bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-amber-500 rounded-r-full" />
              )}

              {/* Badges/Alerts */}
              {item.badge && (
                <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full uppercase scale-90">
                  {item.badge}
                </span>
              )}
              {item.alert && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Nav */}
      <div className="mt-auto border-t border-[#eeeef0] pt-4 flex flex-col gap-1">
        <button
          onClick={onShowVersion}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-left text-sm"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
          <span>版本更新</span>
          <span className="bg-emerald-500/10 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded ml-auto">V2.4.1</span>
        </button>
        <div className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 rounded-lg text-sm bg-slate-100/50">
          <User className="w-4 h-4 text-slate-400" />
          <div className="truncate flex-1">
            <p className="text-xs font-semibold text-slate-700 truncate leading-tight">cwccty@gmail.com</p>
            <p className="text-[10px] text-slate-400">高级订阅会员</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
