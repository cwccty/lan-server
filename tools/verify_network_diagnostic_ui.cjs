const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const artifactDir = path.join(repoRoot, 'docs/acceptance-artifacts');
const outputPath = path.join(artifactDir, 'network-diagnostic-ui-gate-2026-06-08.json');
const legacyDomOutputPath = path.join(artifactDir, 'network-diagnostic-closure-dom-2026-06-08.json');
const previewPort = 4175;
const previewUrl = `http://127.0.0.1:${previewPort}`;
const chromeDebugPort = 9331;

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8').replace(/^\uFEFF/, '');
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function pushCheck(checks, id, passed, detail) {
  checks.push({ id, passed: Boolean(passed), detail });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function endpointReady(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHttp(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await endpointReady(url)) return true;
    await sleep(250);
  }
  throw new Error(`${label} not ready: ${url}`);
}

function killProcessTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function ensurePreview() {
  if (await endpointReady(previewUrl)) {
    return { child: null, startedByScript: false };
  }

  const child = spawn('npm.cmd', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(previewPort)], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    await waitForHttp(previewUrl, 30000, 'Vite preview');
    return { child, startedByScript: true, output: () => output };
  } catch (error) {
    killProcessTree(child);
    throw new Error(`${error.message}\npreview output:\n${output}`);
  }
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

class Cdp {
  constructor(wsUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.ws.close();
  }
}

async function evalJs(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  return result.result.value;
}

async function clickByText(cdp, text) {
  return evalJs(cdp, `(() => {
    const wanted = ${JSON.stringify(text)};
    const nodes = [...document.querySelectorAll('button, [role="button"], a')];
    const node = nodes.find((el) => (el.innerText || el.textContent || '').includes(wanted));
    if (!node) return false;
    node.click();
    return true;
  })()`);
}

async function screenshot(cdp, filename) {
  const out = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(path.join(artifactDir, filename), Buffer.from(out.data, 'base64'));
}

function sourceChecks() {
  const productNetwork = read('src/product-ui/ProductNetworkView.tsx');
  const productDiagnostics = read('src/product-ui/ProductDiagnosticsView.tsx');
  const statusCenter = read('src/product-ui/statusCenter.ts');
  const n2nBackend = read('src-tauri/src/network/n2n_backend.rs');
  const networkTypes = read('src/types/network.ts');
  const gateScript = read('tools/run_v0_3_1_release_gate.ps1');
  const checks = [];

  pushCheck(
    checks,
    'status-running-without-ready-label',
    statusCenter.includes("label: '组网程序已启动，但中继尚未确认'") && !statusCenter.includes("label: '启动中'"),
    'running && !ready 必须显示“组网程序已启动，但中继尚未确认”，不能退回单纯“启动中”。',
  );
  pushCheck(
    checks,
    'status-running-without-ready-actions',
    includesAll(statusCenter, ['中继地址', '房间名', '密钥', '联机地址', '手动启动命令', '组网日志', '管理员权限', 'UDP 出站', '校园网/公司网', '安全软件']),
    '无中继确认时，普通用户下一步必须包含核对参数、复制命令/日志、管理员运行和非防火墙网络排查。',
  );
  pushCheck(
    checks,
    'status-prioritizes-specific-n2n-problems',
    includesAll(statusCenter, ['auth_error', 'ip_mac_conflict', 'tap_error', 'supernode_not_responding', 'pid_stale_or_exited']),
    '密钥错误、IP 冲突、虚拟网卡、中继无响应和 PID 失效必须优先显示明确问题。',
  );
  pushCheck(
    checks,
    'network-page-user-actions-and-sop',
    includesAll(productNetwork, [
      'data-network-user-diagnostic-actions="visible"',
      'data-network-n2n-diagnostic-closure="actions"',
      'data-network-stuck-two-machine-sop="visible"',
      'NETWORK_STUCK_USER_SOP',
      '复制完整诊断报告',
      '复制手动启动命令',
      '复制组网日志',
      '注册修复',
      '管理员权限',
    ]),
    '加入与组网页必须有三类复制入口、两机 SOP 和注册修复无效后的下一步。',
  );
  pushCheck(
    checks,
    'network-page-observability-fields-visible',
    includesAll(productNetwork, ['组网程序文件', '组网程序路径', '记录 PID', '存活', 'ACK/PONG', '日志路径', '中继确认', '联机地址']),
    '组网页排查卡必须显示程序文件路径、PID、ACK/PONG、日志路径等可观测字段。',
  );
  pushCheck(
    checks,
    'network-full-report-fields',
    includesAll(productNetwork, [
      '组网程序文件',
      '组网程序路径',
      '记录 PID',
      '记录 PID 是否存活',
      '连接状态',
      'ACK',
      'PONG',
      '中继地址',
      '房间名',
      '本机联机地址',
      '最后错误',
      '日志路径',
      '手动启动命令',
      '两台电脑对照步骤',
      'UDP 出站',
    ]),
    '完整诊断报告文本必须包含区分未启动/中继未确认的关键字段、两机对照步骤和 UDP/网络排查。',
  );
  pushCheck(
    checks,
    'diagnostics-page-copy-actions',
    includesAll(productDiagnostics, [
      'data-diagnostic-n2n-copy-actions="visible"',
      '复制报告',
      '复制手动命令',
      '复制组网日志',
      '已配置未启动',
      '中继尚未确认',
      'UDP 出站',
    ]) && !productDiagnostics.includes('复制 edge 日志'),
    '诊断报告页必须有同等级复制入口，普通按钮文案使用“组网日志”。',
  );
  pushCheck(
    checks,
    'backend-observability-fields',
    includesAll(networkTypes, ['executable_found', 'executable_path', 'recorded_pid', 'recorded_pid_running', 'connection_state', 'manual_start_command', 'tap_error']) &&
      includesAll(n2nBackend, ['executable_path', 'manual_start_command', 'waiting_for_ack', 'configured_not_started', 'supernode_not_responding', 'tap_error', 'auth_error', 'ip_mac_conflict', 'pid_stale_or_exited']),
    '后端和前端类型必须暴露程序文件路径、PID、连接状态、手动命令、TAP 错误等字段。',
  );
  pushCheck(
    checks,
    'gate-integrated',
    gateScript.includes('network stuck diagnostic UI gate') && gateScript.includes('network:diagnostic:verify'),
    'v0.3.1 专用门禁必须执行该 UI 防回退检查。',
  );
  pushCheck(
    checks,
    'no-old-wait-only-copy',
    !statusCenter.includes('等待 10 到 20 秒后刷新状态') &&
      !productNetwork.includes('复制 edge 日志') &&
      !productDiagnostics.includes('复制 edge 日志') &&
      !statusCenter.includes('edge 日志'),
    '普通用户主路径不能继续只建议等待刷新或复制 edge 日志。',
  );

  return checks;
}

async function runtimeChecks() {
  const preview = await ensurePreview();
  const chromeCandidates = [
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1223/chrome-win64/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1200/chrome-win64/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1181/chrome-win64/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ];
  const chromePath = chromeCandidates.find((item) => fs.existsSync(item));
  if (!chromePath) throw new Error('Chrome/Edge executable not found');

  const userDataDir = path.join(artifactDir, 'chrome-network-diagnostic-profile');
  fs.mkdirSync(userDataDir, { recursive: true });
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${chromeDebugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  const keepAlive = setInterval(() => undefined, 1000);

  try {
    await waitForHttp(`http://127.0.0.1:${chromeDebugPort}/json/version`, 10000, 'Chrome CDP endpoint');
    const pages = await getJson(`http://127.0.0.1:${chromeDebugPort}/json`);
    const cdp = new Cdp(pages[0].webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: previewUrl });
    await sleep(2500);

    const networkClicked = await clickByText(cdp, '加入与组网');
    await sleep(1200);
    const networkDom = await evalJs(cdp, `(() => {
      const text = document.body.innerText;
      const plainStartingElements = [...document.querySelectorAll('span,p,h1,h2,h3,button,div')]
        .map((el) => (el.textContent || '').trim())
        .filter((value) => value === '启动中');
      return {
        clicked: ${JSON.stringify(networkClicked)},
        hasNetworkPage: text.includes('加入与组网'),
        hasUserDiagnosticActions: Boolean(document.querySelector('[data-network-user-diagnostic-actions="visible"]')),
        hasTwoMachineSop: Boolean(document.querySelector('[data-network-stuck-two-machine-sop="visible"]')),
        hasCopyReport: text.includes('复制完整诊断报告'),
        hasCopyManualCommand: text.includes('复制手动启动命令'),
        hasCopyNetworkLogs: text.includes('复制组网日志'),
        hasTwoMachineReportStep: text.includes('两台电脑都复制完整诊断报告'),
        hasDifferentLanIpHint: text.includes('联机地址不同'),
        hasConfiguredNotStartedHint: text.includes('已配置未启动'),
        hasRelayNotConfirmedHint: text.includes('中继尚未确认'),
        hasExecutableField: text.includes('组网程序文件'),
        hasExecutablePathField: text.includes('组网程序路径'),
        hasPidField: text.includes('记录 PID'),
        hasAckPongField: text.includes('ACK/PONG'),
        hasLogPathField: text.includes('日志路径'),
        hasRegisterRepairFallback: text.includes('注册修复') && text.includes('管理员权限'),
        hasUdpNonFirewallHint: text.includes('UDP 出站') && text.includes('校园网/公司网') && text.includes('安全软件'),
        hasOldEdgeLogCopy: text.includes('复制 edge 日志'),
        hasOldWaitingRefresh: text.includes('等待 10 到 20 秒后刷新状态'),
        hasPlainStartingLabel: plainStartingElements.length > 0,
        plainStartingElements,
      };
    })()`);
    await screenshot(cdp, 'network-diagnostic-closure-actions-2026-06-08.png');

    const diagnosticClicked = await clickByText(cdp, '诊断报告');
    await sleep(1200);
    const diagnosticsDom = await evalJs(cdp, `(() => {
      const text = document.body.innerText;
      const plainStartingElements = [...document.querySelectorAll('span,p,h1,h2,h3,button,div')]
        .map((el) => (el.textContent || '').trim())
        .filter((value) => value === '启动中');
      return {
        clicked: ${JSON.stringify(diagnosticClicked)},
        hasDiagnosticsPage: text.includes('报告工具条') || text.includes('诊断报告'),
        hasToolbarActions: Boolean(document.querySelector('[data-diagnostic-n2n-copy-actions="visible"]')),
        hasCopyReport: text.includes('复制报告'),
        hasCopyManualCommand: text.includes('复制手动命令'),
        hasCopyNetworkLogs: text.includes('复制组网日志'),
        hasUdpNonFirewallHint: text.includes('UDP 出站') && text.includes('校园网/公司网') && text.includes('安全软件'),
        hasOldEdgeLogCopy: text.includes('复制 edge 日志'),
        hasOldWaitingRefresh: text.includes('等待 10 到 20 秒后刷新状态'),
        hasPlainStartingLabel: plainStartingElements.length > 0,
        plainStartingElements,
      };
    })()`);
    await screenshot(cdp, 'diagnostics-n2n-copy-actions-2026-06-08.png');
    cdp.close();

    return {
      preview_url: previewUrl,
      preview_started_by_script: preview.startedByScript,
      networkDom,
      diagnosticsDom,
      screenshots: [
        'docs/acceptance-artifacts/network-diagnostic-closure-actions-2026-06-08.png',
        'docs/acceptance-artifacts/diagnostics-n2n-copy-actions-2026-06-08.png',
      ],
    };
  } finally {
    chrome.kill();
    clearInterval(keepAlive);
    if (preview.startedByScript) killProcessTree(preview.child);
  }
}

function runtimeCheckRows(runtime) {
  const checks = [];
  pushCheck(checks, 'runtime-network-page-clicked', runtime.networkDom.clicked, '运行时能进入“加入与组网”页面。');
  pushCheck(checks, 'runtime-network-page-visible', runtime.networkDom.hasNetworkPage, '运行时组网页可见。');
  pushCheck(checks, 'runtime-network-user-actions-visible', runtime.networkDom.hasUserDiagnosticActions, '运行时组网页显示用户诊断操作。');
  pushCheck(checks, 'runtime-network-two-machine-sop-visible', runtime.networkDom.hasTwoMachineSop, '运行时组网页显示两机对照 SOP。');
  pushCheck(checks, 'runtime-network-copy-actions', runtime.networkDom.hasCopyReport && runtime.networkDom.hasCopyManualCommand && runtime.networkDom.hasCopyNetworkLogs, '运行时组网页有报告、手动命令、组网日志三类复制入口。');
  pushCheck(checks, 'runtime-network-key-hints', runtime.networkDom.hasTwoMachineReportStep && runtime.networkDom.hasDifferentLanIpHint && runtime.networkDom.hasConfiguredNotStartedHint && runtime.networkDom.hasRelayNotConfirmedHint, '运行时组网页能区分两机报告、联机地址、已配置未启动和中继未确认。');
  pushCheck(checks, 'runtime-network-observability-fields', runtime.networkDom.hasExecutableField && runtime.networkDom.hasExecutablePathField && runtime.networkDom.hasPidField && runtime.networkDom.hasAckPongField && runtime.networkDom.hasLogPathField, '运行时组网页显示程序文件路径、PID、ACK/PONG、日志路径。');
  pushCheck(checks, 'runtime-network-register-repair-fallback', runtime.networkDom.hasRegisterRepairFallback, '运行时组网页显示注册修复无效后的管理员权限提示。');
  pushCheck(checks, 'runtime-network-udp-non-firewall-hint', runtime.networkDom.hasUdpNonFirewallHint, '运行时组网页提示关闭防火墙后仍需检查 UDP 出站、校园网/公司网和安全软件。');
  pushCheck(checks, 'runtime-network-no-old-copy', !runtime.networkDom.hasOldEdgeLogCopy && !runtime.networkDom.hasOldWaitingRefresh && !runtime.networkDom.hasPlainStartingLabel, '运行时组网页不出现旧 edge 日志、等待刷新和纯“启动中”。');
  pushCheck(checks, 'runtime-diagnostics-page-clicked', runtime.diagnosticsDom.clicked, '运行时能进入诊断报告页。');
  pushCheck(checks, 'runtime-diagnostics-page-visible', runtime.diagnosticsDom.hasDiagnosticsPage, '运行时诊断报告页可见。');
  pushCheck(checks, 'runtime-diagnostics-copy-actions', runtime.diagnosticsDom.hasToolbarActions && runtime.diagnosticsDom.hasCopyReport && runtime.diagnosticsDom.hasCopyManualCommand && runtime.diagnosticsDom.hasCopyNetworkLogs, '运行时诊断页有报告、手动命令、组网日志复制入口。');
  pushCheck(checks, 'runtime-diagnostics-udp-non-firewall-hint', runtime.diagnosticsDom.hasUdpNonFirewallHint, '运行时诊断页提示关闭防火墙后仍需检查 UDP 出站、校园网/公司网和安全软件。');
  pushCheck(checks, 'runtime-diagnostics-no-old-copy', !runtime.diagnosticsDom.hasOldEdgeLogCopy && !runtime.diagnosticsDom.hasOldWaitingRefresh && !runtime.diagnosticsDom.hasPlainStartingLabel, '运行时诊断页不出现旧 edge 日志、等待刷新和纯“启动中”。');
  return checks;
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const source = sourceChecks();
  const runtime = await runtimeChecks();
  const runtimeRows = runtimeCheckRows(runtime);
  const checks = [...source, ...runtimeRows];
  const output = {
    generated_at: new Date().toISOString(),
    mode: 'source-and-runtime-ui-contract',
    passed: checks.every((item) => item.passed),
    checks,
    runtime,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  fs.writeFileSync(legacyDomOutputPath, `${JSON.stringify({
    generated_at: output.generated_at,
    preview_url: runtime.preview_url,
    preview_started_by_script: runtime.preview_started_by_script,
    networkDom: runtime.networkDom,
    diagnosticsDom: runtime.diagnosticsDom,
    issues: checks.filter((item) => !item.passed).map((item) => item.id),
    passed: output.passed,
    screenshots: runtime.screenshots,
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(output, null, 2));
  if (!output.passed) process.exit(1);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
