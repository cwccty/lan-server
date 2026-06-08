import type { GameAdapter, GameSummary } from '../types/game';
import { buildAdapterCategoryRoute } from './adapterCategoryRoute';
import { deriveAdapterCategory, type AdapterCategoryId } from './adapterPresentation';

export type GameConnectionProfileId =
  | 'terraria'
  | 'palworld'
  | 'minecraft_java'
  | 'stardew_valley'
  | 'cuphead';

export interface GameConnectionProfile {
  id: GameConnectionProfileId;
  matchIds: string[];
  displayName: string;
  verificationLabel: string;
  verificationTone: 'supported' | 'pending' | 'manual';
  methodCategory: AdapterCategoryId;
  methodTags: string[];
  mainPath: string;
  hostFirstStep: string;
  guestFirstStep: string;
  prepare: string[];
  ports: string[];
  failureChecks: string[];
}

export const GAME_CONNECTION_PROFILES: GameConnectionProfile[] = [
  {
    id: 'terraria',
    matchIds: ['terraria'],
    displayName: 'Terraria',
    verificationLabel: '已有向导路径',
    verificationTone: 'supported',
    methodCategory: 'dedicated_server',
    methodTags: ['服务端开服', 'TCP 7777', '现有 Terraria 向导'],
    mainPath: '先用 Terraria 向导或服务端路线开房，再复制邀请给好友。',
    hostFirstStep: '房主先启动 Terraria 服务端或现有 Terraria 向导，确认端口和世界已加载。',
    guestFirstStep: '加入者先加入同一组网，再在游戏里输入房主联机地址和端口。',
    prepare: ['Terraria 服务端或游戏内开服入口', '默认 TCP 7777，按实际配置调整', 'Windows 防火墙放行游戏或服务端'],
    ports: ['TCP 7777'],
    failureChecks: ['先检测端口是否监听', '核对双方 Terraria 版本和模组', '检查防火墙和组网地址是否一致'],
  },
  {
    id: 'palworld',
    matchIds: ['palworld'],
    displayName: 'Palworld / 幻兽帕鲁',
    verificationLabel: '待实机验证',
    verificationTone: 'pending',
    methodCategory: 'dedicated_server',
    methodTags: ['服务端开服', 'UDP 8211', '可配合 Steam/P2P'],
    mainPath: '优先准备 Palworld Dedicated Server，本机预检通过后再让好友游戏内加入验证。',
    hostFirstStep: '房主先选择 PalServer.exe 或启动脚本，检查 UDP 8211，再复制邀请。',
    guestFirstStep: '加入者先加入同一组网，再在 Palworld 专用服务器入口输入房主联机地址和端口。',
    prepare: ['PalServer.exe 或启动脚本', 'UDP 8211 或服务端配置里的自定义端口', '必要时再使用 Steam/P2P 作为复杂网络补充'],
    ports: ['UDP 8211'],
    failureChecks: ['核对服务端端口和配置文件', '确认双方游戏版本一致', '防火墙放行 PalServer.exe'],
  },
  {
    id: 'minecraft_java',
    matchIds: ['minecraft_java', 'minecraft', 'minecraft java'],
    displayName: 'Minecraft Java',
    verificationLabel: '待实机验证',
    verificationTone: 'pending',
    methodCategory: 'dedicated_server',
    methodTags: ['服务端开服', 'TCP 25565', 'server.jar'],
    mainPath: '优先走 Java 服务端或已有启动脚本，确认 Java、eula.txt 和 TCP 25565。',
    hostFirstStep: '房主先选择 server.jar 或启动脚本，确认 eula.txt 后启动并检测端口。',
    guestFirstStep: '加入者加入同一组网后，在多人游戏里直接连接“房主联机地址:端口”。',
    prepare: ['server.jar 或 .bat/.cmd 启动脚本', 'Java 可用', 'eula.txt 已确认', 'TCP 25565 或游戏显示端口'],
    ports: ['TCP 25565'],
    failureChecks: ['先确认 Java 和 eula.txt', '核对版本、模组、白名单和正版登录', '检查防火墙是否放行 Java'],
  },
  {
    id: 'stardew_valley',
    matchIds: ['stardew_valley', 'stardew', '星露谷'],
    displayName: 'Stardew Valley / 星露谷物语',
    verificationLabel: '待双机回归',
    verificationTone: 'pending',
    methodCategory: 'native_lan',
    methodTags: ['组网直连', '游戏内邀请', '待双机证据'],
    mainPath: '优先使用游戏内合作入口和组网地址，不把未验证路线标成已通过。',
    hostFirstStep: '房主先开合作房间，确认游戏显示的加入方式，再复制联机助手邀请。',
    guestFirstStep: '加入者先加入同一组网，再按游戏内合作入口或房主给的地址加入。',
    prepare: ['双方同版本游戏', '游戏内合作房间', '必要时补充端口和截图证据'],
    ports: ['以游戏内显示为准'],
    failureChecks: ['核对版本和模组', '确认房主房间已开放', '若列表不可见再考虑房间发现或手动地址'],
  },
  {
    id: 'cuphead',
    matchIds: ['cuphead', '茶杯头'],
    displayName: 'Cuphead',
    verificationLabel: '远程同屏路线',
    verificationTone: 'manual',
    methodCategory: 'remote_coop',
    methodTags: ['远程同屏', '本地合作', '不强转局域网'],
    mainPath: '这类游戏优先按远程同屏处理，不伪装成局域网开服。',
    hostFirstStep: '房主先打开游戏本地合作，再用 Steam Remote Play 或 Sunshine/Moonlight 邀请好友。',
    guestFirstStep: '加入者接受远程同屏邀请，按手柄或键盘映射加入。',
    prepare: ['Steam Remote Play 或 Sunshine/Moonlight', '手柄/输入映射', '稳定上行网络'],
    ports: ['不走固定游戏服务端端口'],
    failureChecks: ['先确认远程同屏是否连通', '核对输入设备映射', '不要直接按局域网服务端路线排查'],
  },
];

export function findGameConnectionProfile(game: Pick<GameSummary | GameAdapter, 'game_id' | 'display_name'> | null | undefined) {
  if (!game) return null;
  const id = game.game_id.toLowerCase();
  const name = game.display_name.toLowerCase();
  return GAME_CONNECTION_PROFILES.find((profile) =>
    profile.matchIds.some((match) => id.includes(match) || name.includes(match))
  ) ?? null;
}

export function buildFallbackGameConnectionProfile(game: GameSummary | GameAdapter): GameConnectionProfile {
  const category = deriveAdapterCategory(game);
  const route = buildAdapterCategoryRoute(category.id);
  const verified = game.applicability?.verification_status === 'friend_tested'
    || game.applicability?.verification_status === 'community_verified';
  return {
    id: 'minecraft_java',
    matchIds: [game.game_id],
    displayName: game.display_name,
    verificationLabel: verified ? '有回归证据' : '待实机验证',
    verificationTone: verified ? 'supported' : 'pending',
    methodCategory: category.id,
    methodTags: [category.shortLabel, route.actionLabel],
    mainPath: route.description,
    hostFirstStep: game.connection_plan?.host_role || `房主先按“${route.actionLabel}”继续。`,
    guestFirstStep: game.connection_plan?.join_role || '加入者先加入同一组网，再按房主给的地址或游戏内邀请操作。',
    prepare: game.evidence?.port_protocols?.length ? game.evidence.port_protocols : ['按方案库记录准备游戏入口、端口和必要工具'],
    ports: 'default_ports' in game && game.default_ports?.length
      ? game.default_ports.map((port) => String(port))
      : game.evidence?.port_protocols?.length ? game.evidence.port_protocols : ['以方案或游戏内显示为准'],
    failureChecks: game.connection_plan?.troubleshooting?.length ? game.connection_plan.troubleshooting : ['先生成诊断报告', '核对端口、游戏版本、防火墙和组网状态'],
  };
}

export function getGameConnectionProfile(game: GameSummary | GameAdapter | null | undefined) {
  if (!game) return null;
  return findGameConnectionProfile(game) ?? buildFallbackGameConnectionProfile(game);
}

export function gameProfileToneClass(profile: GameConnectionProfile) {
  if (profile.verificationTone === 'supported') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (profile.verificationTone === 'manual') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}
