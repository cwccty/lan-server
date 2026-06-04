import {
  Activity,
  Globe,
  Home,
  Library,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  User,
  Wand2,
} from 'lucide-react';
import { AppTab } from '../reference-ui/types';

interface ProductSidebarProps {
  currentTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  onShowVersion: () => void;
}

interface ProductMenuItem {
  id: AppTab;
  label: string;
  hint: string;
  icon: typeof Home;
  badge?: string;
  alert?: boolean;
}

interface ProductMenuGroup {
  title: string;
  items: readonly ProductMenuItem[];
}

const menuGroups: readonly ProductMenuGroup[] = [
  {
    title: '开始',
    items: [{ id: 'home', label: '首页', hint: '桌面大厅', icon: Home }],
  },
  {
    title: '准备',
    items: [
      { id: 'solutions', label: '方案库', hint: '共享适配', icon: Library },
      { id: 'games', label: '游戏扫描', hint: '本机游戏', icon: Target },
    ],
  },
  {
    title: '执行',
    items: [
      { id: 'protocol', label: '推荐方案', hint: '连接路径', icon: ShieldCheck },
      { id: 'network', label: '通用组网中心', hint: 'n2n / 代理', icon: Globe },
      { id: 'terraria', label: 'Terraria 向导', hint: '开服 / 加入', icon: Wand2, badge: 'New' },
    ],
  },
  {
    title: '高级工具',
    items: [
      { id: 'advanced_tools', label: '高级连接工具', hint: 'TCP / UDP / 广播桥', icon: Sliders },
    ],
  },
  {
    title: '排查',
    items: [{ id: 'diagnostics', label: '诊断报告', hint: '链路性能', icon: Activity, alert: true }],
  },
  {
    title: '系统',
    items: [{ id: 'settings', label: '设置与帮助', hint: '路径 / 默认值', icon: Settings }],
  },
];

export function ProductSidebar({ currentTab, onChangeTab, onShowVersion }: ProductSidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-[276px] flex-col justify-between border-r border-[#eeeef0] bg-slate-50 px-4 py-6 shadow-sm">
      <div className="mb-8 flex items-center gap-3 px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shadow-sm">
          <Sparkles className="h-6 w-6 animate-pulse" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold leading-none tracking-tight text-slate-800">联机助手</h1>
          <p className="mt-1 font-sans text-xs text-slate-400">高级局域网联机工具</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto pr-1" aria-label="主导航">
        {menuGroups.map((group) => (
          <section key={group.title} className="flex flex-col gap-1.5">
            <div className="px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              {group.title}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeTab(item.id)}
                  className={`relative flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left transition-all duration-200 ${
                    isActive
                      ? 'scale-[0.985] bg-white font-medium text-amber-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-amber-500/20'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
                    <span className="min-w-0">
                      <span className="block text-[14px] leading-tight">{item.label}</span>
                      <small className={`mt-0.5 block truncate text-[10px] leading-tight ${isActive ? 'text-amber-700/60' : 'text-slate-400'}`}>
                        {item.hint}
                      </small>
                    </span>
                  </div>

                  {isActive && (
                    <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-amber-500" />
                  )}

                  <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
                    {item.badge && (
                      <span className="scale-90 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                        {item.badge}
                      </span>
                    )}
                    {item.alert && (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </section>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-[#eeeef0] pt-4">
        <button
          onClick={onShowVersion}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <RefreshCw className="h-4 w-4 text-slate-400" />
          <span>版本更新</span>
          <span className="ml-auto rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700">V2.4.1</span>
        </button>
        <div className="flex w-full items-center gap-3 rounded-lg bg-slate-100/50 px-4 py-2 text-sm text-slate-500">
          <User className="h-4 w-4 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-slate-700">cwccty@gmail.com</p>
            <p className="text-[10px] text-slate-400">高级订阅会员</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
