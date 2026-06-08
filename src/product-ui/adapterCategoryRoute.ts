import type { AdvancedToolIntent } from './advancedToolIntent';
import type { AdapterCategoryId } from './adapterPresentation';

export type ProductRouteTab =
  | 'games'
  | 'protocol'
  | 'network'
  | 'advanced_tools'
  | 'solutions'
  | 'diagnostics'
  | 'settings';

export interface AdapterCategoryRoute {
  actionLabel: string;
  description: string;
  targetTab: ProductRouteTab;
  toast: string;
  intent?: Omit<AdvancedToolIntent, 'created_at'>;
  anchorSelector?: string;
  oneClickServerProfile?: {
    profileId: 'palworld' | 'minecraft_java';
    reason: string;
  };
}

const CATEGORY_ROUTE_ANCHOR_KEY = 'lan-helper:adapter-category-route-anchor';
const ONE_CLICK_SERVER_PROFILE_KEY = 'lan-helper:one-click-server-profile-route';
export const ADAPTER_CATEGORY_ROUTE_ANCHOR_EVENT = 'lan-helper:adapter-category-route-anchor-updated';
export const ONE_CLICK_SERVER_PROFILE_EVENT = 'lan-helper:one-click-server-profile-route-updated';

export function rememberAdapterCategoryRouteAnchor(route: AdapterCategoryRoute) {
  if (typeof window === 'undefined') return;
  if (route.anchorSelector) {
    window.sessionStorage.setItem(CATEGORY_ROUTE_ANCHOR_KEY, route.anchorSelector);
    window.dispatchEvent(new CustomEvent(ADAPTER_CATEGORY_ROUTE_ANCHOR_EVENT, {
      detail: { selector: route.anchorSelector },
    }));
  }
  if (route.oneClickServerProfile) {
    const detail = {
      profileId: route.oneClickServerProfile.profileId,
      reason: route.oneClickServerProfile.reason,
    };
    window.sessionStorage.setItem(ONE_CLICK_SERVER_PROFILE_KEY, JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent(ONE_CLICK_SERVER_PROFILE_EVENT, { detail }));
  }
}

export function consumeAdapterCategoryRouteAnchor() {
  if (typeof window === 'undefined') return null;
  const selector = window.sessionStorage.getItem(CATEGORY_ROUTE_ANCHOR_KEY);
  if (selector) window.sessionStorage.removeItem(CATEGORY_ROUTE_ANCHOR_KEY);
  return selector;
}

export function scrollToAdapterCategoryRouteAnchor(selector: string | null | undefined, delayMs = 120) {
  if (!selector || typeof window === 'undefined') return;
  window.setTimeout(() => {
    const target = document.querySelector(selector);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const top = Math.max(0, window.scrollY + rect.top - 104);
    window.scrollTo({ top, behavior: 'smooth' });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target instanceof HTMLElement) {
      window.setTimeout(() => target.focus(), 220);
    }
  }, delayMs);
}

export function consumeOneClickServerProfileRoute() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ONE_CLICK_SERVER_PROFILE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(ONE_CLICK_SERVER_PROFILE_KEY);
    const parsed = JSON.parse(raw) as { profileId?: string; reason?: string };
    if (parsed.profileId !== 'palworld' && parsed.profileId !== 'minecraft_java') return null;
    return {
      profileId: parsed.profileId,
      reason: parsed.reason || '来自分类入口',
    };
  } catch {
    return null;
  }
}

export function buildAdapterCategoryRoute(categoryId: AdapterCategoryId | 'all'): AdapterCategoryRoute {
  if (categoryId === 'native_lan') {
    return {
      actionLabel: '按虚拟局域网继续',
      description: '适合能输入房主地址或能看到局域网房间的游戏。下一步先选择游戏，再生成开房邀请。',
      targetTab: 'protocol',
      toast: '已切到开房邀请。请选择游戏并按推荐步骤继续。',
    };
  }

  if (categoryId === 'dedicated_server') {
    return {
      actionLabel: '查看开服向导',
      description: '适合需要房主启动服务端的游戏。下一步查看一键开服或通用服务端入口。',
      targetTab: 'solutions',
      anchorSelector: '[data-one-click-server-roadmap="v031-mvp"]',
      oneClickServerProfile: {
        profileId: 'minecraft_java',
        reason: '来自“服务端”分类：未指定具体游戏时，先选 Minecraft Java，并提示也可以切换 Palworld。',
      },
      toast: '已定位到开服闭环，并先选 Minecraft Java。也可以切换 Palworld 后继续。',
      intent: {
        source: 'manual',
        reason: 'generic_server',
        kind: 'tcp',
        preferred_card: 'generic_server',
        note: '来自联机方式分类：服务端路线。先准备官方或游戏自带服务端文件，再启动和检测端口。',
        evidence: ['分类入口：服务端', '下一步：选择服务端文件', '边界：本机预检不等于好友已能加入'],
      },
    };
  }

  if (categoryId === 'bridge_or_proxy') {
    return {
      actionLabel: '打开桥接工具',
      description: '适合“房间看不到”或“地址端口连不上”的游戏。下一步先判断：有地址端口就走端口代理，看不到房间列表就走广播桥。',
      targetTab: 'advanced_tools',
      anchorSelector: '[data-bridge-route-choice="selector"]',
      toast: '已切到特殊连接工具。请先在桥接工具二选一里选择“地址+端口”或“房间列表”。',
      intent: {
        source: 'manual',
        reason: 'bridge_or_proxy_choice',
        kind: 'tcp',
        note: '来自联机方式分类：桥接工具。请先选：有房主地址和端口，用端口代理；好友看不到局域网房间列表，用 UDP 广播桥。',
        evidence: ['分类入口：桥接工具', '选择一：地址 + 端口', '选择二：房间列表看不到'],
      },
    };
  }

  if (categoryId === 'steam_or_remote') {
    return {
      actionLabel: '打开 Steam/P2P',
      description: '适合依赖 Steam 邀请、Steam 大厅或 P2P 的游戏。下一步检查 Steam 连接工具文件夹，再按房主/加入者步骤操作。',
      targetTab: 'advanced_tools',
      anchorSelector: '[data-steam-helper-directory="input"]',
      toast: '已切到 Steam Relay / P2P，并定位到 Steam 连接工具文件夹。请先检测后再创建或加入房间。',
      intent: {
        source: 'manual',
        reason: 'steam_relay_p2p',
        kind: 'tcp',
        preferred_card: 'steam_relay',
        note: '来自联机方式分类：Steam/P2P。联机助手只负责检查、启动和诊断，真实 Steam 通道由用户自备 Steam 连接工具完成。',
        evidence: ['分类入口：Steam/P2P', '需要 Steam 已登录', '需要双方连接工具与游戏环境'],
      },
    };
  }

  if (categoryId === 'remote_coop') {
    return {
      actionLabel: '查看远程同屏路线',
      description: '适合本地同屏或本地合作游戏。下一步查看开房邀请里的远程同屏建议，不强行转换为局域网。',
      targetTab: 'protocol',
      toast: '已切到开房邀请。远程同屏类游戏优先按 Steam Remote Play 或 Sunshine + Moonlight 操作。',
    };
  }

  if (categoryId === 'official_or_limited') {
    return {
      actionLabel: '查看限制说明',
      description: '这类游戏通常只能走官方服务或暂不建议转换。下一步先看方案库限制，再决定是否反馈补充证据。',
      targetTab: 'solutions',
      toast: '当前路线受限。请先查看方案库说明，不要直接按局域网开房。',
    };
  }

  if (categoryId === 'needs_review') {
    return {
      actionLabel: '补充方案证据',
      description: '适配信息不足。下一步在方案库补端口、联机入口、测试步骤和适用边界。',
      targetTab: 'solutions',
      toast: '当前路线需要补证据。请在方案库维护具体游戏方案后再交给普通用户使用。',
    };
  }

  return {
    actionLabel: '先选择游戏',
    description: '还没确定联机方式。先扫描并选择游戏，联机助手会按方案库给出推荐路线。',
    targetTab: 'games',
    toast: '请先选择游戏，再按推荐路线继续。',
  };
}
