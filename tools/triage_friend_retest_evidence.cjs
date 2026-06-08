#!/usr/bin/env node
const fs = require('fs');

const EXPECTED_ZIP_SHA = 'EE65491E725538DD482CCE96CD33F2A834A311A702DA6CB0691F2C5BDA9E2C96';
const EXPECTED_EXE_SHA = '75295FDB62187E75AB4A659647530F4F4A5F4824261ACAE49AC207C226645329';

function usage() {
  return `Usage:\n  npm run friend:retest:triage -- <friend-report.txt> [more-report.txt]\n  node tools/triage_friend_retest_evidence.cjs --self-test\n`;
}

function includesAny(text, values) {
  const lower = text.toLowerCase();
  return values.some((value) => lower.includes(value.toLowerCase()));
}

function fieldPresent(text, label) {
  return text.includes(`【${label}】`) || text.includes(`${label}：`) || text.includes(`${label}:`);
}

function classify(text) {
  const requiredFields = [
    '电脑身份',
    'Windows 版本',
    '网络环境',
    '是否管理员运行联机助手',
    '软件版本',
    'ZIP SHA256',
    'EXE SHA256',
    '页面状态',
    '中继地址',
    '房间名',
    '本机联机地址',
    '对方联机地址',
    '复制完整诊断报告',
    '复制手动启动命令',
    '复制组网日志',
  ];
  const missingFields = requiredFields.filter((field) => !fieldPresent(text, field));
  const hasZipSha = text.toUpperCase().includes(EXPECTED_ZIP_SHA);
  const hasExeSha = text.toUpperCase().includes(EXPECTED_EXE_SHA);
  const hasScreenshots = includesAny(text, ['【截图】', '组网页截图', '诊断报告页截图', '.png', '.jpg', '.jpeg']);

  const configuredNotStartedSignals = [
    '已配置未启动',
    'connection_state=configured_not_started',
    'connection_state=pid_stale_or_exited',
    'running=false',
    'recorded_pid_running=false',
    '启动后立即退出',
    '启动组网程序失败',
    'cannot find tap device',
    'unable to open tap',
    'failed to open tap',
  ];
  const waitingForAckSignals = [
    '中继尚未确认',
    '组网程序已启动，但中继尚未确认',
    'connection_state=waiting_for_ack',
    'running=true',
    'ok_link=false',
    'ack=false',
    'pong=false',
  ];
  const authSignals = ['auth_error=true', 'connection_state=auth_error', '房间名或密钥不一致', 'authentication error'];
  const conflictSignals = ['ip_mac_conflict=true', 'connection_state=ip_mac_conflict', '联机地址冲突', 'address already in use'];
  const tapSignals = ['tap_error=true', 'connection_state=tap_error', '虚拟网卡', 'tap/wintun', 'cannot find tap'];
  const supernodeSignals = ['not_responding=true', 'connection_state=supernode_not_responding', '中继地址暂无响应', 'supernode not responding', 'timeout'];

  const hits = {
    configured_not_started: includesAny(text, configuredNotStartedSignals),
    waiting_for_ack: includesAny(text, waitingForAckSignals),
    auth_error: includesAny(text, authSignals),
    ip_conflict: includesAny(text, conflictSignals),
    tap_error: includesAny(text, tapSignals),
    supernode_not_responding: includesAny(text, supernodeSignals),
  };

  let classification = 'needs_more_evidence';
  if (hits.auth_error) classification = 'auth_or_room_key_mismatch';
  else if (hits.ip_conflict) classification = 'lan_ip_conflict';
  else if (hits.tap_error) classification = 'local_adapter_or_permission_problem';
  else if (hits.configured_not_started) classification = 'configured_not_started_local_startup_problem';
  else if (hits.supernode_not_responding) classification = 'relay_or_udp_unreachable';
  else if (hits.waiting_for_ack) classification = 'running_but_relay_not_confirmed';

  const nextActions = [];
  if (!hasZipSha || !hasExeSha) nextActions.push('确认朋友使用最新 ZIP/EXE，不要混用旧包。');
  if (missingFields.length) nextActions.push(`补齐缺失字段：${missingFields.join('、')}。`);
  if (!hasScreenshots) nextActions.push('补组网页截图和诊断报告页截图。');
  if (classification === 'configured_not_started_local_startup_problem') {
    nextActions.push('优先查管理员权限、安全软件拦截、tools/n2n/edge.exe 路径、PID 是否秒退、TAP/Wintun。');
  } else if (classification === 'running_but_relay_not_confirmed' || classification === 'relay_or_udp_unreachable') {
    nextActions.push('优先核对中继地址/房间名/密钥/联机地址；再用手机热点或其他网络验证 UDP 出站是否被拦。');
  } else if (classification === 'auth_or_room_key_mismatch') {
    nextActions.push('重新复制同一份房间名和密钥，检查空格、全角字符和输入法替换。');
  } else if (classification === 'lan_ip_conflict') {
    nextActions.push('给两台电脑分配不同本机联机地址，例如 10.10.10.2 和 10.10.10.3。');
  } else if (classification === 'local_adapter_or_permission_problem') {
    nextActions.push('管理员运行并检查 TAP/Wintun/虚拟网卡是否存在、启用、未被安全软件阻止。');
  }
  if (!nextActions.length) nextActions.push('材料基本完整：按 classification 分流继续排查。');

  return {
    expected_zip_sha: EXPECTED_ZIP_SHA,
    expected_exe_sha: EXPECTED_EXE_SHA,
    has_expected_zip_sha: hasZipSha,
    has_expected_exe_sha: hasExeSha,
    has_screenshot_evidence: hasScreenshots,
    missing_fields: missingFields,
    hits,
    classification,
    next_actions: nextActions,
  };
}

function selfTest() {
  const sampleA = `【电脑身份】房主\n【Windows 版本】Windows 11\n【网络环境】家用宽带\n【是否管理员运行联机助手】是\n【软件版本】v0.3.1\n【ZIP SHA256】${EXPECTED_ZIP_SHA}\n【EXE SHA256】${EXPECTED_EXE_SHA}\n【页面状态】已配置未启动\n【中继地址】1.2.3.4:7777\n【房间名】room\n【本机联机地址】10.10.10.2\n【对方联机地址】10.10.10.3\n【复制完整诊断报告】connection_state=configured_not_started\n【复制手动启动命令】edge.exe -c room\n【复制组网日志】启动组网程序失败\n【截图】a.png`;
  const sampleB = sampleA.replace(/已配置未启动/g, '中继尚未确认').replace(/connection_state=configured_not_started/g, 'connection_state=waiting_for_ack').replace(/启动组网程序失败/g, 'running=true ok_link=false ack=false pong=false');
  const a = classify(sampleA);
  const b = classify(sampleB);
  if (a.classification !== 'configured_not_started_local_startup_problem') throw new Error(`self-test A failed: ${a.classification}`);
  if (b.classification !== 'running_but_relay_not_confirmed') throw new Error(`self-test B failed: ${b.classification}`);
  return { passed: true, samples: [a.classification, b.classification] };
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error(usage());
  process.exit(2);
}
if (args.includes('--self-test')) {
  console.log(JSON.stringify(selfTest(), null, 2));
  process.exit(0);
}

const reports = args.map((file) => {
  const text = fs.readFileSync(file, 'utf8');
  return { file, ...classify(text) };
});
const summary = {
  generated_at: new Date().toISOString(),
  report_count: reports.length,
  reports,
  pair_ready_for_next_debug: reports.length >= 2 && reports.every((item) => item.missing_fields.length === 0 && item.has_expected_zip_sha && item.has_expected_exe_sha),
};
console.log(JSON.stringify(summary, null, 2));
if (reports.some((item) => item.missing_fields.length || !item.has_expected_zip_sha || !item.has_expected_exe_sha)) process.exit(1);
