import type { DiagnosticIssue } from '../types/diagnostics';
import type { AppTab } from '../reference-ui/types';

export type DiagnosticIssueType =
  | 'n2n_missing'
  | 'n2n_not_running'
  | 'supernode'
  | 'n2n_auth_or_ip_conflict'
  | 'n2n_virtual_ip'
  | 'game_port_or_proxy'
  | 'server_runtime'
  | 'adapter_missing'
  | 'firewall_or_permission'
  | 'version_mismatch'
  | 'general';

export interface ProductFixAction {
  id: string;
  label: string;
  description: string;
  kind: 'navigate' | 'copy' | 'refresh' | 'backend';
  targetTab?: AppTab;
  copyText?: string;
  operation?: DiagnosticBackendFixOperation;
}

export type DiagnosticBackendFixOperation =
  | 'detect_edge_path'
  | 'start_n2n_last_config'
  | 'restart_n2n_last_config'
  | 'refresh_runtime'
  | 'test_local_game_port';

export interface ProductDiagnosticFixGroup {
  id: DiagnosticIssueType;
  title: string;
  summary: string;
  severity: string;
  issueCount: number;
  affectedIssueIds: string[];
  evidence: string[];
  actions: ProductFixAction[];
}

const GROUP_META: Record<DiagnosticIssueType, { title: string; summary: string }> = {
  n2n_missing: {
    title: '组网程序缺失',
    summary: '客户端没有找到可用的组网程序，无法创建联机房间。'
  },
  n2n_not_running: {
    title: '组网未启动',
    summary: '组网服务尚未运行或未完成确认，好友无法进入同一个联机房间。'
  },
  supernode: {
    title: '中继地址连接异常',
    summary: '客户端没有收到联机确认，通常是中继地址、端口、防火墙或服务器状态问题。'
  },
  n2n_auth_or_ip_conflict: {
    title: '房间凭证或联机地址冲突',
    summary: '房间名、密钥或联机地址被判定冲突，需要统一信息或更换联机地址。'
  },
  n2n_virtual_ip: {
    title: '联机地址未生效',
    summary: '组网进程可能已启动，但系统网卡没有拿到可用于联机的地址。'
  },
  game_port_or_proxy: {
    title: '游戏端口或代理异常',
    summary: '游戏端口、自测代理或 UDP 广播桥未通过，局域网发现/直连可能失败。'
  },
  server_runtime: {
    title: '游戏服务端不稳定',
    summary: '服务端没有稳定运行到可联机状态，好友即使组网成功也可能连不上。'
  },
  adapter_missing: {
    title: '游戏方案缺失',
    summary: '当前游戏没有可靠方案，客户端无法判断应该使用哪种联机方式。'
  },
  firewall_or_permission: {
    title: '权限或防火墙风险',
    summary: '系统权限、防火墙或安全软件可能阻止组网程序、服务端或代理端口。'
  },
  version_mismatch: {
    title: '版本不匹配或组件版本风险',
    summary: '组网程序、服务端、游戏版本、方案测试版本或好友客户端版本不一致，可能导致已组网但仍无法加入。'
  },
  general: {
    title: '其他待处理问题',
    summary: '诊断报告里仍有未归类问题，请按报告证据逐项处理。'
  }
};

function issueText(issue: DiagnosticIssue) {
  return `${issue.id} ${issue.title} ${issue.detail} ${(issue.next_actions ?? []).join(' ')} ${(issue.evidence ?? []).join(' ')}`.toLowerCase();
}

function isOneOf(id: string, values: string[]) {
  return values.includes(id);
}

export function classifyDiagnosticIssueType(issue: DiagnosticIssue): DiagnosticIssueType {
  const id = issue.id;
  const text = issueText(issue);

  if (isOneOf(id, ['n2n_edge_missing'])) return 'n2n_missing';
  if (isOneOf(id, ['n2n_edge_not_running', 'n2n_waiting_for_ack'])) return 'n2n_not_running';
  if (isOneOf(id, ['n2n_supernode_missing', 'n2n_supernode_not_responding'])) return 'supernode';
  if (isOneOf(id, ['n2n_auth_error', 'n2n_ip_mac_conflict'])) return 'n2n_auth_or_ip_conflict';
  if (isOneOf(id, ['n2n_virtual_ip_missing'])) return 'n2n_virtual_ip';
  if (isOneOf(id, ['tcp_proxy_self_test_failed', 'udp_proxy_self_test_failed', 'udp_broadcast_bridge_self_test_failed'])) return 'game_port_or_proxy';
  if (isOneOf(id, ['terraria_server_not_stable'])) return 'server_runtime';
  if (isOneOf(id, ['selected_game_adapter_missing'])) return 'adapter_missing';

  if (text.includes('edge.exe') || text.includes('n2n edge 未找到') || text.includes('缺失')) return 'n2n_missing';
  if (text.includes('auth') || text.includes('认证') || text.includes('already in use') || text.includes('冲突')) return 'n2n_auth_or_ip_conflict';
  if (text.includes('supernode') || text.includes('not responding') || text.includes('无响应') || text.includes('ack') || text.includes('pong')) return 'supernode';
  if (text.includes('n2n') || text.includes('edge')) return 'n2n_not_running';
  if (text.includes('tap') || text.includes('虚拟 ip') || text.includes('virtual ip')) return 'n2n_virtual_ip';
  if (text.includes('端口') || text.includes('port') || text.includes('proxy') || text.includes('广播桥') || text.includes('broadcast')) return 'game_port_or_proxy';
  if (text.includes('服务端') || text.includes('server') || text.includes('terraria') || text.includes('崩溃')) return 'server_runtime';
  if (text.includes('adapter') || text.includes('适配器') || text.includes('方案缺失')) return 'adapter_missing';
  if (text.includes('防火墙') || text.includes('firewall') || text.includes('权限') || text.includes('permission')) return 'firewall_or_permission';
  if (text.includes('版本') || text.includes('version') || text.includes('不匹配') || text.includes('mismatch') || text.includes('build')) return 'version_mismatch';

  return 'general';
}

function issueDebugText(issue: DiagnosticIssue) {
  const lines = [
    `[${issue.severity}] ${issue.title}`,
    issue.detail,
    ...(issue.next_actions ?? []).map((item) => `下一步：${item}`),
    ...(issue.evidence ?? []).map((item) => `证据：${item}`)
  ];
  return lines.filter(Boolean).join('\n');
}

function getBaseActions(type: DiagnosticIssueType): ProductFixAction[] {
  if (type === 'n2n_missing') {
    return [
      {
        id: 'detect-edge-path',
        label: '重新检测组网程序',
        description: '重新检测当前配置和默认目录中的组网程序，刷新诊断依据。',
        kind: 'backend',
        operation: 'detect_edge_path'
      },
      {
        id: 'goto-network',
        label: '去配置组网',
        description: '打开加入与组网页，检查组网程序检测状态与组网信息。',
        kind: 'navigate',
        targetTab: 'network'
      },
      {
        id: 'copy-edge-check',
        label: '复制本机检查命令',
        description: '复制 PowerShell 命令，检查内置工具目录里是否存在组网程序。',
        kind: 'copy',
        copyText: 'Get-ChildItem -Path .\\src-tauri, .\\resources, .\\tools -Recurse -Filter edge.exe -ErrorAction SilentlyContinue | Select-Object FullName\nwhere.exe edge'
      }
    ];
  }

  if (type === 'n2n_not_running') {
    return [
      {
        id: 'start-n2n-last-config',
        label: '一键启动组网',
        description: '读取最近保存的组网信息并直接启动，适合已经保存过中继地址、房间名和密钥的情况。',
        kind: 'backend',
        operation: 'start_n2n_last_config'
      },
      {
        id: 'goto-network',
        label: '去启动组网',
        description: '打开加入与组网页，保存信息并启动组网。',
        kind: 'navigate',
        targetTab: 'network'
      },
      {
        id: 'copy-n2n-manual-start',
        label: '复制手动启动命令',
        description: '复制 PowerShell 手动检查和启动组网程序的命令，便于用户或管理员在终端复现启动问题。',
        kind: 'copy',
        copyText: '请确认双方填写同一个中继地址、房间名、房间密钥；双方联机地址不能相同。启动后等待 10-20 秒，看到联机确认后再进游戏。\n\n# PowerShell：按实际路径和信息替换后执行\nGet-Process edge -ErrorAction SilentlyContinue\nGet-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "10.*" -or $_.InterfaceAlias -match "cfw|tap|n2n|edge" } | Format-Table InterfaceAlias,IPAddress\n.\\edge.exe -d edge0 -a 10.0.0.2 -c <room-name> -k <room-key> -l <supernode-host>:<port>'
      }
    ];
  }

  if (type === 'supernode') {
    return [
      {
        id: 'restart-n2n-registration',
        label: '一键重启注册',
        description: '停止并重新启动组网服务，强制重新向中继地址注册，适合联机确认长时间不出现的情况。',
        kind: 'backend',
        operation: 'restart_n2n_last_config'
      },
      {
        id: 'goto-network',
        label: '检查中继地址',
        description: '打开加入与组网页，确认中继地址和端口。',
        kind: 'navigate',
        targetTab: 'network'
      },
      {
        id: 'copy-supernode-check',
        label: '复制中继检查命令',
        description: '在中继服务器上确认服务正在监听 UDP/TCP 端口。',
        kind: 'copy',
        copyText: 'sudo ss -lunp | grep 7777 || sudo ss -ltnp | grep 7777\nsudo systemctl status n2n-supernode --no-pager || ps aux | grep supernode\nsudo ufw status || true'
      }
    ];
  }

  if (type === 'n2n_auth_or_ip_conflict') {
    return [
      {
        id: 'restart-after-conflict-release',
        label: '一键重启注册',
        description: '先停止再重新启动组网，用于刚改过房间信息或等待中继释放旧注册后的复测。',
        kind: 'backend',
        operation: 'restart_n2n_last_config'
      },
      {
        id: 'goto-ip-fix',
        label: '更换联机地址',
        description: '进入加入与组网页，把本机联机地址改成未被占用的地址。',
        kind: 'navigate',
        targetTab: 'network'
      },
      {
        id: 'copy-ip-conflict-check',
        label: '复制地址/密钥冲突检查',
        description: '复制给房主/好友，用于核对房间密钥、联机地址分配和本机 10.x 地址占用情况。',
        kind: 'copy',
        copyText: '组网注册被拒绝：请确认房间名和房间密钥完全一致；每个玩家使用不同联机地址；如果刚退出过，等待中继释放旧注册后再启动。\n\n# PowerShell：本机检查联机地址 / MAC 是否重复或被旧网卡占用\nGet-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "10.*" } | Format-Table InterfaceAlias,IPAddress,PrefixLength\nGet-NetAdapter | Where-Object { $_.InterfaceDescription -match "tap|n2n|edge|wintun|cfw" -or $_.Name -match "tap|n2n|edge|cfw" } | Format-Table Name,Status,MacAddress,InterfaceDescription\n# 和好友核对：每个人的联机地址必须唯一，房间名/密钥必须逐字一致。'
      }
    ];
  }

  if (type === 'n2n_virtual_ip') {
    return [
      {
        id: 'restart-n2n-for-virtual-ip',
        label: '一键重启组网',
        description: '停止并重新启动组网服务，让网卡重新获取 10.x 联机地址。',
        kind: 'backend',
        operation: 'restart_n2n_last_config'
      },
      {
        id: 'goto-network',
        label: '刷新组网状态',
        description: '打开加入与组网页，停止后重新启动组网，并检查联机地址。',
        kind: 'navigate',
        targetTab: 'network'
      },
      {
        id: 'copy-virtual-ip-check',
        label: '复制网卡检查命令',
        description: '复制 PowerShell 命令，确认组联网卡是否拿到 10.x 联机地址。',
        kind: 'copy',
        copyText: 'Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "10.*" -or $_.InterfaceAlias -match "cfw|tap|n2n|edge" } | Format-Table InterfaceAlias,IPAddress,PrefixLength'
      }
    ];
  }

  if (type === 'game_port_or_proxy') {
    return [
      {
        id: 'test-local-game-port',
        label: '一键检测本机端口',
        description: '按诊断目标或游戏方案默认端口检测 127.0.0.1 是否正在监听游戏端口。',
        kind: 'backend',
        operation: 'test_local_game_port'
      },
      {
        id: 'goto-advanced',
        label: '打开高级工具',
        description: '检查 TCP/UDP 代理或 UDP 广播桥自测结果。',
        kind: 'navigate',
        targetTab: 'advanced_tools'
      },
      {
        id: 'copy-game-port-proxy-check',
        label: '复制端口/代理检查命令',
        description: '复制本机监听、连通性和代理自测排查命令，便于确认游戏端口或 TCP/UDP 代理问题。',
        kind: 'copy',
        copyText: '请先确认游戏服务端已经启动，并把 7777 替换成当前游戏端口。\n\n# PowerShell：本机端口监听与 TCP 连通性\nGet-NetTCPConnection -LocalPort 7777 -State Listen -ErrorAction SilentlyContinue\nTest-NetConnection 127.0.0.1 -Port 7777\nTest-NetConnection <friend-lan-helper-ip> -Port 7777\n\n# 如果使用 UDP/广播桥，请回到高级工具执行 UDP 代理或 UDP 广播桥测试，并把测试结果复制给房主/管理员。'
      }
    ];
  }

  if (type === 'server_runtime') {
    return [
      {
        id: 'test-server-port',
        label: '一键检测服务端端口',
        description: '检测本机服务端端口是否已监听，帮助确认服务端是否真的可连接。',
        kind: 'backend',
        operation: 'test_local_game_port'
      },
      {
        id: 'goto-terraria',
        label: '启动/查看服务端',
        description: '打开 Terraria 向导，启动服务端并等待 30 秒稳定检测。',
        kind: 'navigate',
        targetTab: 'terraria'
      },
      {
        id: 'copy-server-check',
        label: '复制端口检测命令',
        description: '复制 PowerShell 命令，确认本机游戏端口是否监听。',
        kind: 'copy',
        copyText: 'Test-NetConnection 127.0.0.1 -Port 7777\nGet-NetTCPConnection -LocalPort 7777 -State Listen -ErrorAction SilentlyContinue'
      }
    ];
  }

  if (type === 'adapter_missing') {
    return [
      {
        id: 'goto-solutions',
        label: '去方案库',
        description: '同步共享方案库，或创建当前游戏的自建方案。',
        kind: 'navigate',
        targetTab: 'solutions'
      },
      {
        id: 'goto-games',
        label: '回游戏扫描',
        description: '从游戏扫描页重新选择游戏并查看推荐方案。',
        kind: 'navigate',
        targetTab: 'games'
      },
      {
        id: 'copy-adapter-missing-hint',
        label: '复制方案缺失说明',
        description: '复制给管理员或方案维护者，说明当前游戏缺少可用方案，需要补齐方案。',
        kind: 'copy',
        copyText: '当前游戏没有可用联机方案：请确认游戏名称、版本、平台、启动路径和联机方式；如是新游戏或新版本，请在方案库创建/同步游戏方案，并补充测试版本、端口、启动方式和已知限制。'
      }
    ];
  }

  if (type === 'firewall_or_permission') {
    return [
      {
        id: 'refresh-runtime-after-permission',
        label: '一键刷新运行状态',
        description: '重新读取运行、组网、服务端和端口状态，确认是否只是状态缓存未刷新。',
        kind: 'backend',
        operation: 'refresh_runtime'
      },
      {
        id: 'goto-network',
        label: '检查组网',
        description: '打开加入与组网页确认组网状态，再检查防火墙放行。',
        kind: 'navigate',
        targetTab: 'network'
      },
      {
        id: 'copy-firewall-hint',
        label: '复制防火墙命令',
        description: '复制给用户/管理员，用于以管理员 PowerShell 放行组网程序、游戏服务端和代理端口。',
        kind: 'copy',
        copyText: '请检查 Windows 防火墙/安全软件是否放行组网程序、游戏服务端进程，以及当前游戏端口。必要时以管理员权限运行联机助手后重试。\n\n# 示例：以管理员 PowerShell 执行，按实际 edge.exe 路径和游戏端口修改\nnetsh advfirewall firewall add rule name=\"Lan Helper Network\" dir=in action=allow program=\"C:\\\\Path\\\\To\\\\edge.exe\" enable=yes\nnetsh advfirewall firewall add rule name=\"Lan Helper Game TCP 7777\" dir=in action=allow protocol=TCP localport=7777\nnetsh advfirewall firewall add rule name=\"Lan Helper Game UDP 7777\" dir=in action=allow protocol=UDP localport=7777'
      }
    ];
  }

  if (type === 'version_mismatch') {
    return [
      {
        id: 'refresh-runtime-after-version-check',
        label: '一键刷新运行状态',
        description: '重新读取运行状态和游戏方案状态，确认版本风险是否仍存在。',
        kind: 'backend',
        operation: 'refresh_runtime'
      },
      {
        id: 'goto-solutions-version',
        label: '去方案库核对版本',
        description: '打开方案库，检查游戏方案的测试版本、适用条件和已知限制。',
        kind: 'navigate',
        targetTab: 'solutions'
      },
      {
        id: 'copy-version-manual-check',
        label: '复制版本手动核对清单',
        description: '复制给好友/管理员，用于手动核对组网、游戏、服务端和游戏方案测试版本。',
        kind: 'copy',
        copyText: '请双方核对：1) 游戏版本/平台是否一致；2) 服务端版本是否匹配客户端；3) 组网程序和中继版本是否兼容；4) 当前游戏方案的 tested_versions / tested_platforms 是否覆盖本次环境；5) 如刚更新游戏，请重新扫描并同步共享方案库。\n\n# 可复制给管理员的手动核对项\n- 游戏客户端版本 / 平台 / Mod 列表：<填写>\n- 服务端版本 / 启动参数：<填写>\n- 联机助手版本：<填写>\n- 组网程序 / 中继版本：<填写>\n- 当前游戏方案名称与 tested_versions/tested_platforms：<填写>'
      }
    ];
  }

  return [
    {
      id: 'copy-general-diagnostic',
      label: '复制问题摘要',
      description: '复制诊断摘要给管理员或开发者进一步判断。',
      kind: 'copy',
      copyText: '诊断报告仍有未归类问题，请复制完整报告给管理员查看。'
    }
  ];
}

function withRerun(actions: ProductFixAction[]) {
  return dedupeActions([
    ...actions,
    {
      id: 'rerun-diagnostic',
      label: '重新诊断',
      description: '修复后重新生成报告，确认状态变化。',
      kind: 'refresh'
    }
  ]);
}

function dedupeActions(actions: ProductFixAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

export function classifyDiagnosticIssue(issue: DiagnosticIssue): ProductFixAction[] {
  return withRerun(getBaseActions(classifyDiagnosticIssueType(issue))).slice(0, 4);
}

function severityRank(severity: string) {
  const value = severity.toLowerCase();
  if (value.includes('critical') || value.includes('error') || value.includes('high')) return 3;
  if (value.includes('warn') || value.includes('medium')) return 2;
  return 1;
}

function severityFromIssues(issues: DiagnosticIssue[]) {
  return issues.reduce((best, issue) => (severityRank(issue.severity) > severityRank(best) ? issue.severity : best), issues[0]?.severity ?? 'info');
}

function compactEvidence(issues: DiagnosticIssue[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const issue of issues) {
    for (const item of [issue.detail, ...(issue.evidence ?? [])]) {
      const text = item.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      result.push(text);
      if (result.length >= 4) return result;
    }
  }
  return result;
}

export function buildDiagnosticFixGroups(issues: DiagnosticIssue[]): ProductDiagnosticFixGroup[] {
  const buckets = new Map<DiagnosticIssueType, DiagnosticIssue[]>();
  for (const issue of issues) {
    const type = classifyDiagnosticIssueType(issue);
    buckets.set(type, [...(buckets.get(type) ?? []), issue]);
  }

  return Array.from(buckets.entries())
    .map(([type, bucket]) => {
      const meta = GROUP_META[type];
      const copySummaryAction: ProductFixAction = {
        id: `copy-${type}-summary`,
        label: '复制问题给房主/管理员',
        description: '复制该类问题的简要证据，便于对方协助确认。',
        kind: 'copy',
        copyText: [
          `问题类型：${meta.title}`,
          `影响项：${bucket.length}`,
          '',
          ...bucket.map(issueDebugText)
        ].join('\n---\n')
      };
      return {
        id: type,
        title: meta.title,
        summary: meta.summary,
        severity: severityFromIssues(bucket),
        issueCount: bucket.length,
        affectedIssueIds: bucket.map((issue) => issue.id),
        evidence: compactEvidence(bucket),
        actions: withRerun([...getBaseActions(type), copySummaryAction]).slice(0, 5)
      };
    })
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.issueCount - a.issueCount);
}
