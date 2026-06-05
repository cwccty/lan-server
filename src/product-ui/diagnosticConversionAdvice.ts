import type { DiagnosticIssue } from '../types/diagnostics';
import type { GameSummary } from '../types/game';
import type { AdapterRecommendationRoute } from './adapterRecommendationRoute';
import type { GameConversionAssessment } from './conversionAssessmentEngine';
import { buildGameConversionAssessmentReport } from './conversionAssessmentEngine';

export type DiagnosticConversionAdviceTone = 'warning' | 'blocked' | 'info';

export interface DiagnosticConversionAdvice {
  id: string;
  tone: DiagnosticConversionAdviceTone;
  title: string;
  summary: string;
  routeHint: string;
  whyDiagnosticMatters: string;
  suggestedActions: string[];
  copyText: string;
  targetTab: 'protocol' | 'advanced_tools' | 'solutions';
  shouldShowAdvancedTools: boolean;
  shouldCreateAdapterIntent: boolean;
  shouldDeprioritizeN2nFixes: boolean;
}

function issueText(issues: DiagnosticIssue[]) {
  return issues.map((issue) => [
    issue.id,
    issue.title,
    issue.detail,
    ...(issue.next_actions ?? []),
    ...(issue.evidence ?? []),
  ].join(' ')).join(' ').toLowerCase();
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function buildAdviceCopyText(
  game: GameSummary,
  route: AdapterRecommendationRoute,
  assessment: GameConversionAssessment,
  title: string,
  suggestedActions: string[],
) {
  return [
    '[联机助手诊断路线纠错]',
    `游戏：${game.display_name} (${game.game_id})`,
    `当前路线：${route.title}`,
    `纠错结论：${title}`,
    `是否生成 LAN 邀请：${route.canCreateLanInvite ? '是' : '否'}`,
    '',
    '建议动作：',
    ...suggestedActions.map((item, index) => `${index + 1}. ${item}`),
    '',
    buildGameConversionAssessmentReport(assessment),
  ].join('\n');
}

export function buildDiagnosticConversionAdvice(
  game: GameSummary | null,
  route: AdapterRecommendationRoute,
  assessment: GameConversionAssessment,
  issues: DiagnosticIssue[],
): DiagnosticConversionAdvice | null {
  if (!game) return null;

  const text = issueText(issues);
  const hasN2nSymptoms = hasAny(text, ['n2n', 'edge', 'supernode', 'ack', 'pong', '虚拟 ip', 'virtual ip']);
  const hasPortSymptoms = hasAny(text, ['端口', 'port', 'proxy', '代理', 'listen', '监听']);
  const hasBroadcastSymptoms = hasAny(text, ['广播', 'broadcast', '大厅', 'lan 房间', '局域网列表']);

  if (route.kind === 'remote_coop') {
    const suggestedActions = [
      '停止把这个问题当作 n2n / 虚拟 IP 故障排查；这类游戏不需要好友连接虚拟 IP。',
      '回到推荐方案页，使用 Steam Remote Play Together；非 Steam 或需要更细控制时用 Sunshine + Moonlight。',
      '重点检查串流质量、输入权限、手柄/键鼠映射，而不是 Supernode 或游戏端口。',
    ];
    return {
      id: 'remote-coop-not-n2n',
      tone: hasN2nSymptoms ? 'warning' : 'info',
      title: '当前游戏更像本地同屏远程联机，不应优先修 n2n',
      summary: '诊断里即使出现 n2n / Supernode 问题，也不一定影响这类游戏联机；正确路线是远程同屏。',
      routeHint: route.summary,
      whyDiagnosticMatters: '避免用户在只能同屏的游戏上反复配置虚拟局域网，却仍无法在游戏内输入 IP 加入。',
      suggestedActions,
      copyText: buildAdviceCopyText(game, route, assessment, '本地同屏游戏不要优先修 n2n', suggestedActions),
      targetTab: 'protocol',
      shouldShowAdvancedTools: false,
      shouldCreateAdapterIntent: true,
      shouldDeprioritizeN2nFixes: true,
    };
  }

  if (route.kind === 'steam_p2p') {
    const suggestedActions = [
      '优先使用游戏原生 Steam 好友邀请 / Steam 大厅 / P2P 流程。',
      '不要把“虚拟 IP 端口不通”当成主要问题，除非管理员已经确认存在 Steam Relay / P2P 插件方案。',
      '如需插件化路线，先把评估和证据带到方案库，由管理员确认反作弊、账号和插件边界。',
    ];
    return {
      id: 'steam-p2p-not-virtual-ip',
      tone: hasN2nSymptoms || hasPortSymptoms ? 'warning' : 'info',
      title: '当前游戏优先走 Steam 大厅 / P2P，不应默认连接虚拟 IP',
      summary: 'Steam P2P 游戏的失败通常不靠 n2n 端口检测判断，应该先确认 Steam 原生邀请是否可用。',
      routeHint: route.summary,
      whyDiagnosticMatters: '避免用户看到端口检测失败后误以为 n2n 修好就能加入 Steam 大厅游戏。',
      suggestedActions,
      copyText: buildAdviceCopyText(game, route, assessment, 'Steam P2P 游戏优先保留 Steam 原生流程', suggestedActions),
      targetTab: 'protocol',
      shouldShowAdvancedTools: false,
      shouldCreateAdapterIntent: true,
      shouldDeprioritizeN2nFixes: true,
    };
  }

  if (route.kind === 'official_only') {
    const suggestedActions = [
      '不要继续生成 n2n 邀请包，也不要让好友连接虚拟 IP。',
      '使用游戏官方服务器、官方大厅或官方账号入口。',
      '把“官方服限定”的原因写入 adapter，避免其他用户继续尝试错误方案。',
    ];
    return {
      id: 'official-only-stop-conversion',
      tone: 'blocked',
      title: '当前游戏被标记为官方服限定，不建议转换成 LAN',
      summary: '诊断页应阻止用户继续把它当成局域网问题排查。',
      routeHint: route.summary,
      whyDiagnosticMatters: '官方账号、匹配或后端鉴权无法靠虚拟局域网替代；继续排查 n2n 会浪费时间。',
      suggestedActions,
      copyText: buildAdviceCopyText(game, route, assessment, '官方服限定不建议转换', suggestedActions),
      targetTab: 'solutions',
      shouldShowAdvancedTools: false,
      shouldCreateAdapterIntent: true,
      shouldDeprioritizeN2nFixes: true,
    };
  }

  if (route.kind === 'udp_broadcast_bridge') {
    const suggestedActions = [
      '保留 n2n 组网，但不要只看 ACK/PONG；这类游戏可能还需要 UDP 广播桥才能发现 LAN 大厅。',
      '进入高级连接工具，配置 UDP 广播桥和游戏大厅发现端口。',
      '如果支持手动 IP 直连，优先让好友连接房主虚拟 IP；否则复制诊断报告给管理员补充广播端口证据。',
    ];
    return {
      id: 'udp-broadcast-needs-bridge',
      tone: hasBroadcastSymptoms || hasPortSymptoms ? 'warning' : 'info',
      title: '当前路线需要 UDP 广播桥，单独 n2n 可能只能互通但看不到房间',
      summary: '局域网大厅发现类游戏需要把“组网成功”和“房间被发现”分开排查。',
      routeHint: route.summary,
      whyDiagnosticMatters: 'ACK/PONG 正常只证明虚拟网互通，不证明游戏 LAN 广播已经跨虚拟网转发。',
      suggestedActions,
      copyText: buildAdviceCopyText(game, route, assessment, 'UDP 广播发现游戏需要广播桥', suggestedActions),
      targetTab: 'advanced_tools',
      shouldShowAdvancedTools: true,
      shouldCreateAdapterIntent: false,
      shouldDeprioritizeN2nFixes: false,
    };
  }

  if (route.kind === 'tcp_port_proxy') {
    const suggestedActions = [
      '保留 n2n 组网，同时确认游戏端口监听地址、TCP/UDP 协议和目标虚拟 IP。',
      '进入高级连接工具，配置 TCP/UDP 端口代理，并先做本机端口检测。',
      '如果端口已监听但好友仍不可达，复制诊断报告和代理配置给管理员排查。',
    ];
    return {
      id: 'port-proxy-needed',
      tone: hasPortSymptoms ? 'warning' : 'info',
      title: '当前路线需要端口代理，端口不通时应去高级工具配置代理',
      summary: '这类游戏不是只启动 n2n 就一定可连，还要确认端口从本机暴露到虚拟网。',
      routeHint: route.summary,
      whyDiagnosticMatters: '端口代理配置错目标 IP 或协议时，会表现为“组网成功但游戏端口不通”。',
      suggestedActions,
      copyText: buildAdviceCopyText(game, route, assessment, '端口代理类游戏需要高级工具', suggestedActions),
      targetTab: 'advanced_tools',
      shouldShowAdvancedTools: true,
      shouldCreateAdapterIntent: false,
      shouldDeprioritizeN2nFixes: false,
    };
  }

  if (route.kind === 'needs_review') {
    const suggestedActions = [
      '先同步共享方案库，确认是否已有该游戏 adapter。',
      '仍缺方案时，把诊断和转换评估带到方案库，生成用户贡献包或管理员草稿。',
      '不要在证据不足时承诺可 LAN 联机。',
    ];
    return {
      id: 'needs-adapter-review',
      tone: 'warning',
      title: '当前游戏方案仍需复核，先不要按普通 LAN 流程排障',
      summary: '缺少可靠 adapter 时，诊断很难判断该修 n2n、广播桥、端口代理还是远程同屏。',
      routeHint: route.summary,
      whyDiagnosticMatters: '先确认游戏原始多人能力，才能避免“按钮很多但方向错误”。',
      suggestedActions,
      copyText: buildAdviceCopyText(game, route, assessment, '缺少 adapter 时先复核游戏类型', suggestedActions),
      targetTab: 'solutions',
      shouldShowAdvancedTools: false,
      shouldCreateAdapterIntent: true,
      shouldDeprioritizeN2nFixes: false,
    };
  }

  return null;
}
