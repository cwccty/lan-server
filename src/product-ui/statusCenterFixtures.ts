import type { ReferenceRuntimeSnapshot } from '../reference-adapter/types';
import type { N2nDiagnostics, NetworkConfig } from '../types/network';
import { resolveProductStatusCenter, type ProductStatusCenterInput } from './statusCenter';

const CONFIGURED_N2N: NetworkConfig = {
  room_name: 'Terraria_Night_Squad',
  secret: 'fixture-secret',
  supernode: '203.0.113.10:7777',
  local_ip: '10.10.10.2',
};

function n2nFixture(partial: Partial<N2nDiagnostics>): N2nDiagnostics {
  return {
    running: false,
    supernode_configured: true,
    supernode: CONFIGURED_N2N.supernode,
    virtual_ip: CONFIGURED_N2N.local_ip,
    ack: false,
    pong: false,
    ok_link: false,
    auth_error: false,
    ip_mac_conflict: false,
    not_responding: false,
    tap_error: false,
    last_error: null,
    summary: '组网信息已保存，但还没有检测到运行中的组网程序；请点击启动组网。',
    log_path: 'tools/n2n/edge.log',
    recent_logs: [],
    executable_found: true,
    recorded_pid: null,
    recorded_pid_running: false,
    connection_state: 'configured_not_started',
    manual_start_command: 'edge.exe -c Terraria_Night_Squad -k <room-key> -l 203.0.113.10:7777 -v -a static:10.10.10.2/24',
    ...partial,
  };
}

function snapshot(n2n: N2nDiagnostics): ReferenceRuntimeSnapshot {
  return {
    source: 'tauri',
    loaded_at: 'fixture',
    n2n,
    n2n_last_config: CONFIGURED_N2N,
    backends: [],
    games: [],
    adapters: [],
    server_session: null,
    port_proxies: [],
    udp_proxies: [],
    udp_broadcast_bridges: [],
    diagnostic_report: null,
    errors: [],
  };
}

function inputFor(n2n: N2nDiagnostics): ProductStatusCenterInput {
  return {
    loaded: true,
    snapshot: snapshot(n2n),
    network: {
      running: n2n.running,
      ready: n2n.ok_link,
      hasError: false,
      label: n2n.summary,
      virtualIp: n2n.virtual_ip || '',
      supernode: n2n.supernode || '',
    },
    n2nConfig: CONFIGURED_N2N,
  };
}

export const STATUS_CENTER_N2N_FIXTURE_SCENARIOS = [
  {
    id: 'configured_not_started',
    input: inputFor(n2nFixture({})),
    expected: { stage: 'configured_not_started', labelIncludes: '已配置未启动' },
  },
  {
    id: 'running_without_ack',
    input: inputFor(n2nFixture({
      running: true,
      recorded_pid: 4242,
      recorded_pid_running: true,
      connection_state: 'waiting_for_ack',
      summary: '组网程序已启动，但尚未收到中继确认；请核对中继地址、房间名、密钥和联机地址。',
      recent_logs: ['[manager] n2n edge started, pid=4242'],
    })),
    expected: { stage: 'starting', labelIncludes: '中继尚未确认' },
  },
  {
    id: 'supernode_not_responding',
    input: inputFor(n2nFixture({
      running: true,
      recorded_pid: 4242,
      recorded_pid_running: true,
      not_responding: true,
      connection_state: 'supernode_not_responding',
      summary: '中继地址暂无响应；请核对地址和端口，或确认中继服务器已启动且端口放行。',
      last_error: 'supernode not responding, timeout',
      recent_logs: ['supernode not responding, timeout'],
    })),
    expected: { stage: 'has_problem', detailIncludes: '中继地址暂无响应' },
  },
  {
    id: 'tap_error',
    input: inputFor(n2nFixture({
      running: true,
      recorded_pid: 4242,
      recorded_pid_running: true,
      tap_error: true,
      connection_state: 'tap_error',
      summary: '组网网卡无法打开或未安装，请尝试管理员运行，并检查 TAP/Wintun 虚拟网卡。',
      last_error: 'ERROR: Cannot find TAP device',
      recent_logs: ['ERROR: Cannot find TAP device'],
    })),
    expected: { stage: 'has_problem', detailIncludes: '虚拟网卡' },
  },
  {
    id: 'auth_error',
    input: inputFor(n2nFixture({
      running: true,
      recorded_pid: 4242,
      recorded_pid_running: true,
      auth_error: true,
      connection_state: 'auth_error',
      summary: '房间名或密钥不一致，中继拒绝加入；请确认双方填写完全一致。',
      last_error: 'authentication error',
      recent_logs: ['authentication error'],
    })),
    expected: { stage: 'has_problem', detailIncludes: '房间名或密钥' },
  },
  {
    id: 'ip_mac_conflict',
    input: inputFor(n2nFixture({
      running: true,
      recorded_pid: 4242,
      recorded_pid_running: true,
      ip_mac_conflict: true,
      connection_state: 'ip_mac_conflict',
      summary: '联机地址可能已被占用；请让每个人使用不同的虚拟 IP 后重新启动组网。',
      last_error: 'MAC or IP address already in use',
      recent_logs: ['MAC or IP address already in use'],
    })),
    expected: { stage: 'has_problem', detailIncludes: '联机地址' },
  },
];

export function runStatusCenterN2nFixtureScenarios() {
  return STATUS_CENTER_N2N_FIXTURE_SCENARIOS.map((scenario) => {
    const actual = resolveProductStatusCenter(scenario.input);
    const passed = actual.stage === scenario.expected.stage &&
      (!scenario.expected.labelIncludes || actual.label.includes(scenario.expected.labelIncludes)) &&
      (!scenario.expected.detailIncludes || actual.detail.includes(scenario.expected.detailIncludes));
    return {
      id: scenario.id,
      passed,
      expected: scenario.expected,
      actual: {
        stage: actual.stage,
        label: actual.label,
        detail: actual.detail,
        nextAction: actual.nextAction,
        evidence: actual.evidence,
      },
    };
  });
}
