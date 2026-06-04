import type { DiagnosticIssue } from '../types/diagnostics';
import type { AppTab } from '../reference-ui/types';

export interface ProductFixAction {
  id: string;
  label: string;
  description: string;
  kind: 'navigate' | 'copy' | 'refresh';
  targetTab?: AppTab;
  copyText?: string;
}

function issueText(issue: DiagnosticIssue) {
  return `${issue.id} ${issue.title} ${issue.detail} ${(issue.next_actions ?? []).join(' ')} ${(issue.evidence ?? []).join(' ')}`.toLowerCase();
}

export function classifyDiagnosticIssue(issue: DiagnosticIssue): ProductFixAction[] {
  const text = issueText(issue);
  const actions: ProductFixAction[] = [];

  if (text.includes('n2n') || text.includes('edge') || text.includes('ack') || text.includes('pong')) {
    actions.push({
      id: 'goto-network',
      label: '去启动组网',
      description: '打开通用组网中心，保存参数并启动 n2n。',
      kind: 'navigate',
      targetTab: 'network'
    });
  }

  if (text.includes('supernode') || text.includes('not responding') || text.includes('无响应')) {
    actions.push({
      id: 'copy-supernode-check',
      label: '复制 VPS 检查命令',
      description: '在 VPS 上确认 supernode 正在监听 UDP/TCP 端口。',
      kind: 'copy',
      copyText: 'ss -lunp | grep 7777 || ss -ltnp | grep 7777\nsudo systemctl status n2n-supernode --no-pager || ps aux | grep supernode'
    });
  }

  if (text.includes('ip') && (text.includes('冲突') || text.includes('conflict') || text.includes('already in use'))) {
    actions.push({
      id: 'goto-ip-fix',
      label: '更换虚拟 IP',
      description: '进入组网中心，把本机虚拟 IP 改成未被占用的地址。',
      kind: 'navigate',
      targetTab: 'network'
    });
  }

  if (text.includes('服务端') || text.includes('server') || text.includes('terraria')) {
    actions.push({
      id: 'goto-terraria',
      label: '启动服务端',
      description: '打开 Terraria 向导，启动服务端并等待 30 秒稳定检测。',
      kind: 'navigate',
      targetTab: 'terraria'
    });
  }

  if (text.includes('端口') || text.includes('port') || text.includes('connect')) {
    actions.push({
      id: 'goto-advanced',
      label: '检查端口工具',
      description: '如果游戏无法直连，尝试 TCP/UDP 代理或广播桥。',
      kind: 'navigate',
      targetTab: 'advanced_tools'
    });
  }

  actions.push({
    id: 'rerun-diagnostic',
    label: '重新诊断',
    description: '修复后重新生成报告，确认状态变化。',
    kind: 'refresh'
  });

  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  }).slice(0, 4);
}
