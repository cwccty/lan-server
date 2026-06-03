import { GameScan, SyncSolution, TimelineEvent, DiagnosticItem } from './types';

export const INITIAL_GAMES: GameScan[] = [
  {
    id: 'palworld',
    name: '幻兽帕鲁 (Palworld)',
    coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDnOSPaDyHly3KIXWXsWRv2AuRhHr-XVyqazT5Y-uK1Dl_1E-T-H5BdlKp1mUvp4rSwAIqYYgbGa9baE8Gl_Az1MxWr1OA2xJTfHsCFubyDJ__skBsf7UEAQMCPPdEUfyjQw4lA8CkkJfB2jW9G-jfG0-B9ZZJ77asSvpxvK62QM6r-_Lp6NklYTHv_n-jNC-6Q8Q35pAq5hMeeK84mRbIvhXEal0BjZUHrfw7Y1g-c1HdYXgVIf4k1qOIUs79OlGfAjEcuLNMwKBk',
    lastPlayed: '昨天',
    status: 'ready'
  },
  {
    id: 'minecraft',
    name: '我的世界 (Minecraft)',
    coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqWVN2RTHHwdqSV2A8NCWHLKRwEOEvNzmLi3D3BF3EyhgJoM--KflVsTvBwdo7d_kSEn24LFRfUJ285oXS_7PT3kVchQ7bvRAPe3E_-hs6Y0WTI9kVtN_M_yHOZZx0METp-QsVWmmwn6nt1SbHnk1iRHlMXasn0dhoAuJDhQKOyQIAHiopJ1ob_AK1SJM-vkb2AlCkSm8wRQthoNOICCPSsyhOR12zBBzUZgBbipAlG2VN7ApT1icJZPEQsHFPa1r4FM8QEXZ9EFc',
    lastPlayed: '3天前',
    status: 'needs_optimize'
  },
  {
    id: 'terraria',
    name: '泰拉瑞亚 (Terraria)',
    lastPlayed: '未发现游玩记录',
    status: 'unconfigured'
  },
  {
    id: 'stellaris',
    name: '群星 (Stellaris)',
    coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBEJP_CIGGAvBw_ciDEm96eWWqSHiSjZJDshQe5VdoNLovkdegIuGQjn5bA9fl-gx1ULU3m-eYvzQqgFrlZrZY2RRunLX3hq_Phf4Uyf9k1DbgaFMYer6Tm4QG-0g_hdUOBKs9DcLm2JXgQ83HhWRJDOxURydbdA5Zh_U9ygDXOZL6nsmObYDEwm0wxyFGuGEFOWIUHCD1bmXzW-0S8UaBverqtVlGHbNBwW_aTYh-SUZCy3RXPoc8nY60vftc3Xm52GxUOe5RzIWk',
    lastPlayed: '1周前',
    status: 'ready'
  }
];

export const INITIAL_SOLUTIONS: SyncSolution[] = [
  {
    id: 'sol_palworld',
    name: '幻兽帕鲁 (Palworld)',
    status: 'updated',
    version: 'v1.2.4',
    source: '共享库'
  },
  {
    id: 'sol_terraria',
    name: '泰拉瑞亚 (Terraria)',
    status: 'synced',
    version: 'v1.4.4.9',
    source: '本地实例'
  },
  {
    id: 'sol_lethal',
    name: '致命公司 (Lethal Company)',
    status: 'update_available',
    version: 'v45.0 → v47.0',
    source: '共享库'
  },
  {
    id: 'sol_dst',
    name: '饥荒联机版 (Don\'t Starve Together)',
    status: 'updated',
    version: 'v2.1.0',
    source: '共享库'
  }
];

export const INITIAL_DIAGNOSTICS: DiagnosticItem[] = [
  {
    id: 'edge_core',
    name: 'N2N Edge 核心',
    status: 'normal',
    detail: '运行正常 (v3.0.0)'
  },
  {
    id: 'supernode',
    name: 'Supernode 连接',
    status: 'normal',
    detail: '已连接 (延迟 24ms)'
  },
  {
    id: 'udp_port',
    name: 'UDP 端口映射',
    status: 'normal',
    detail: '端口 56441 (开放)'
  },
  {
    id: 'virtual_nic',
    name: '虚拟网卡 (TAP)',
    status: 'warning',
    detail: '配置 IP 地址超时 (TAP_ERR_IP_ASSIGN)'
  }
];

export const INITIAL_TIMELINE: TimelineEvent[] = [
  {
    time: '14:32:45',
    title: '诊断完成',
    details: '生成报告并标记了 1 个警告。',
    status: 'completed'
  },
  {
    time: '14:32:42',
    title: '检查虚拟网卡',
    details: '配置 IP 地址超时。',
    status: 'timeout'
  },
  {
    time: '14:32:40',
    title: '连接 Supernode',
    details: '握手成功，延迟 24ms。',
    status: 'success'
  },
  {
    time: '14:32:38',
    title: '启动网络测试',
    details: '检测本地端口及 NAT 类型。',
    status: 'success'
  },
  {
    time: '14:32:35',
    title: '初始化诊断程序',
    details: '收集系统信息。',
    status: 'info'
  }
];

export const RAW_JSON_REPORT = `{
  "timestamp": "2023-10-27T14:32:45Z",
  "os_info": "Windows 11 (10.0.22621)",
  "app_version": "v2.4.1",
  "diagnosis": {
    "edge_core": { "status": "ok", "pid": 4512 },
    "supernode": { "status": "connected", "latency_ms": 24.5 },
    "network": { "udp_port_open": true, "nat_type": "Symmetric" },
    "virtual_nic": {
      "status": "warning",
      "error_code": "TAP_ERR_IP_ASSIGN",
      "details": "Failed to set IP 10.0.0.5 on interface 'Local Area Connection 2'"
    }
  }
}`;

export const FAQS = [
  {
    id: 'faq_1',
    question: '什么是 Edge 和 Supernode?',
    answer: 'Edge（边缘节点）是运行在您本地机器上的客户端程序，负责虚拟网卡的创建和数据加密。Supernode（超级节点）是公网服务器，帮助 Edge 节点互相发现并在必要时中继流量。'
  },
  {
    id: 'faq_2',
    question: 'TCP 与 UDP 连接的区别？',
    answer: 'UDP 提供更低的延迟，是游戏联机的首选。TCP 提供可靠的传输，在严格的防火墙环境（如校园网）下穿透率更高。助手默认尝试 UDP，失败后回退至 TCP。'
  },
  {
    id: 'faq_3',
    question: '为什么需要开启 Bridge（桥接）？',
    answer: '某些老旧游戏依赖以太网广播包（局域网大厅可见性）。开启 Bridge 模式允许虚拟网卡与真实物理网卡桥接，确保这类游戏的联机房能被正确扫描到。'
  }
];

export const FUTURE_PLANS = [
  {
    id: 'fp_1',
    title: '智能路由切换',
    description: '基于延迟自动选择最优超级节点，实现无缝故障转移。',
    iconName: 'Router'
  },
  {
    id: 'fp_2',
    title: '多级网桥支持',
    description: '拓展局域网广播穿透能力，支持更复杂的物理网络拓扑。',
    iconName: 'Hub'
  },
  {
    id: 'fp_3',
    title: '社区云端配置分发',
    description: '一键导入针对特定游戏的网络优化参数集。',
    iconName: 'CloudDownload',
    status: '规划中'
  }
];

export const TERRARIA_WORLDS = [
  'World_1 (大型 / 腐化 / 专家)',
  'NewWorld (中型 / 猩红 / 普通)',
  'TestMap (小型 / 腐化 / 大师)'
];
