import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listNetworkBackends,
  readServerSession,
  setupNetwork,
  startGameServerSession,
  startNetwork,
  stopServerSession,
  sendServerCommand,
  testConnectivity
} from '../api/tauri';
import { LoadingOverlay } from '../components/LoadingOverlay';
import type { BackendSummary, ConnectivityReport } from '../types/network';
import type { LaunchConfig } from '../types/recommendation';
import type { ServerSessionStatus } from '../types/serverSession';

type Role = 'host' | 'joiner';

type SelfCheckItem = {
  label: string;
  ok: boolean;
  detail: string;
};

type SelfCheckResult = {
  title: string;
  ok: boolean;
  items: SelfCheckItem[];
  notes: string[];
};

type TerrariaWizardCache = {
  supernode: string;
  session: ServerSessionStatus | null;
  loadedOnce: boolean;
  savedAt: number;
};

let terrariaWizardCache: TerrariaWizardCache | null = null;

function recentSupernodeFromBackends(backends: BackendSummary[]) {
  const n2n = backends.find((backend) => backend.id === 'n2n');
  const note = n2n?.notes.find((item) => item.startsWith('最近一次 supernode:') || item.startsWith('最近一次 supernode：'));
  return note?.replace(/^最近一次 supernode[:：]\s*/, '').trim() || '';
}

const t = {
  title: 'Terraria 向导',
  intro: '用于 Terraria 房主开服和加入说明。房主先启动组网，再在这里启动服务端；朋友使用房主虚拟 IP 加入。',
  busy: '\u6b63\u5728\u5904\u7406',
  wait: '\u8bf7\u7a0d\u7b49\uff0c\u4e0d\u8981\u91cd\u590d\u70b9\u51fb\u3002',
  role: '\u9009\u62e9\u8eab\u4efd',
  host: '\u6211\u662f\u623f\u4e3b',
  joiner: '\u6211\u662f\u52a0\u5165\u8005',
  roomConfig: 'n2n \u623f\u95f4\u914d\u7f6e',
  roomName: '\u623f\u95f4\u540d / community',
  secret: '\u5bc6\u94a5',
  hostIp: '\u623f\u4e3b\u865a\u62df IP',
  joinerIp: '\u52a0\u5165\u8005\u865a\u62df IP',
  saveStartN2n: '\u4fdd\u5b58\u914d\u7f6e\u5e76\u542f\u52a8 n2n edge',
  startServer: '\u542f\u52a8 Terraria \u670d\u52a1\u7aef',
  worldChoice: '\u4e16\u754c\u7f16\u53f7',
  worldPath: '\u4e16\u754c\u6587\u4ef6\u8def\u5f84\uff0c\u53ef\u9009',
  maxPlayers: '\u6700\u5927\u4eba\u6570',
  gamePort: '\u6e38\u620f\u7aef\u53e3',
  password: '\u670d\u52a1\u7aef\u5bc6\u7801\uff0c\u53ef\u7a7a',
  autoForward: '\u81ea\u52a8\u7aef\u53e3\u8f6c\u53d1 y/n',
  startInApp: '\u5728\u7a0b\u5e8f\u5185\u542f\u52a8\u670d\u52a1\u7aef',
  stopInApp: '\u505c\u6b62\u5185\u5d4c\u670d\u52a1\u7aef',
  copyToFriend: '\u590d\u5236\u7ed9\u670b\u53cb',
  joinGame: '\u52a0\u5165\u6e38\u620f',
  sendToFriend: '\u628a\u4e0b\u9762\u5185\u5bb9\u53d1\u7ed9\u670b\u53cb\u3002',
  copyInvite: '\u590d\u5236\u9080\u8bf7\u4fe1\u606f',
  console: '\u5185\u5d4c\u670d\u52a1\u7aef\u63a7\u5236\u53f0',
  consoleDesc: '\u8fd9\u91cc\u4e0d\u662f\u5355\u72ec\u7684\u767d\u8272\u547d\u4ee4\u6846\uff0c\u800c\u662f\u7531\u7a0b\u5e8f\u6258\u7ba1\u670d\u52a1\u7aef\u8fdb\u7a0b\u5e76\u663e\u793a\u72b6\u6001\u3002\u6b63\u5e38\u60c5\u51b5\u4e0b\u4e0d\u4f1a\u518d\u5f39\u51fa\u547d\u4ee4\u7a97\u53e3\u3002',
  status: '\u72b6\u6001',
  ready: '\u5c31\u7eea',
  readyText: '\u5df2\u76d1\u542c\u7aef\u53e3\uff0c\u53ef\u4ee5\u9080\u8bf7\u670b\u53cb\u52a0\u5165',
  notReadyText: '\u5c1a\u672a\u76d1\u542c\u7aef\u53e3',
  stopped: '\u672a\u8fd0\u884c',
  running: '\u8fd0\u884c\u4e2d',
  readyState: '\u5df2\u5c31\u7eea',
  consoleMvpNotice: '服务端会在后台运行；如果端口已经监听，就可以把邀请信息发给朋友。停止服务端时请优先使用本页按钮。',
  noLogs: '\u6682\u65e0\u670d\u52a1\u7aef\u65e5\u5fd7\u3002',
  selfCheck: '\u4e00\u952e\u81ea\u68c0',
  copyCheck: '\u590d\u5236\u81ea\u68c0\u7ed3\u679c',
  sendHelp: '发送 help',
  sendSave: '保存世界',
  sendExit: '发送 exit',
  selfCheckTitle: '\u623f\u4e3b\u4fa7\u81ea\u68c0',
  joinerCheckTitle: '\u52a0\u5165\u8005\u81ea\u68c0'
};

export function MultiplayerWizardPage() {
  const [role, setRole] = useState<Role>('host');
  const [roomName, setRoomName] = useState('terraria-room-001');
  const [secret, setSecret] = useState('lan-helper-secret');
  const [supernode, setSupernode] = useState(terrariaWizardCache?.supernode ?? '');
  const [hostIp, setHostIp] = useState('10.10.10.2');
  const [joinerIp, setJoinerIp] = useState('10.10.10.3');
  const [gamePort, setGamePort] = useState('7777');
  const [worldChoice, setWorldChoice] = useState('1');
  const [worldPath, setWorldPath] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('8');
  const [password, setPassword] = useState('');
  const [autoForward, setAutoForward] = useState('n');
  const [statusMessage, setStatusMessage] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(!terrariaWizardCache?.loadedOnce);
  const [selfCheck, setSelfCheck] = useState<SelfCheckResult | null>(null);
  const pollingRef = useRef(false);
  const [session, setSession] = useState<ServerSessionStatus | null>(terrariaWizardCache?.session ?? null);

  const localIp = role === 'host' ? hostIp : joinerIp;
  const portNumber = Number.parseInt(gamePort, 10) || 7777;
  const isBusy = busyAction !== null || initialLoading;

  const refreshWizardState = async (showBusy = true) => {
    if (showBusy) {
      setBusyAction('刷新 Terraria 向导状态');
    }
    try {
      const [items, nextSession] = await Promise.all([
        listNetworkBackends(),
        readServerSession().catch(() => null)
      ]);
      const recentSupernode = recentSupernodeFromBackends(items);
      setSupernode((current) => {
        const nextSupernode = current.trim() ? current : recentSupernode;
        terrariaWizardCache = {
          supernode: nextSupernode,
          session: nextSession,
          loadedOnce: true,
          savedAt: Date.now()
        };
        return nextSupernode;
      });
      if (nextSession) {
        setSession(nextSession);
      }
      if (showBusy) {
        setStatusMessage('Terraria 向导状态已刷新。');
      }
    } catch (error) {
      if (showBusy) {
        setStatusMessage(`刷新 Terraria 向导状态失败：${String(error)}`);
      }
    } finally {
      setInitialLoading(false);
      if (showBusy) {
        setBusyAction(null);
      }
    }
  };

  useEffect(() => {
    if (terrariaWizardCache?.loadedOnce) {
      setInitialLoading(false);
      setStatusMessage(`已显示上次向导状态：${new Date(terrariaWizardCache.savedAt).toLocaleString()}。如需重新读取，请点击“刷新向导状态”。`);
      return;
    }
    void refreshWizardState(false);
  }, []);

  useEffect(() => {
    let disposed = false;

    const poll = async () => {
      if (disposed || busyAction || pollingRef.current) {
        return;
      }
      pollingRef.current = true;
      try {
        const next = await readServerSession();
        if (!disposed) {
          setSession(next);
        }
      } catch {
        // Keep the current panel stable when a transient backend query fails.
      } finally {
        pollingRef.current = false;
      }
    };

    if (session?.running || busyAction) {
      void poll();
    }
    const timer = window.setInterval(poll, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [busyAction, session?.running]);

  useEffect(() => {
    if (!terrariaWizardCache?.loadedOnce && !session) return;
    terrariaWizardCache = {
      supernode,
      session,
      loadedOnce: terrariaWizardCache?.loadedOnce ?? true,
      savedAt: Date.now()
    };
  }, [supernode, session]);

  const serverConfig: LaunchConfig = useMemo(
    () => ({
      world_choice: worldChoice,
      world_path: worldPath,
      max_players: maxPlayers,
      port: gamePort,
      auto_forward: autoForward,
      password
    }),
    [worldChoice, worldPath, maxPlayers, gamePort, autoForward, password]
  );

  const inviteText = [
    '\u3010\u8054\u673a\u52a9\u624b\u9080\u8bf7\u3011',
    '',
    '\u6e38\u620f\uff1aTerraria',
    '\u4f60\u9009\u62e9\uff1a\u6211\u662f\u52a0\u5165\u8005',
    '',
    '\u8bf7\u586b\u5199\uff1a',
    `community\uff1a${roomName}`,
    `secret\uff1a${secret}`,
    `supernode\uff1a${supernode || '\u5f85\u586b\u5199'}`,
    `\u4f60\u7684\u865a\u62df IP\uff1a${joinerIp}`,
    `\u623f\u4e3b\u865a\u62df IP\uff1a${hostIp}`,
    `\u7aef\u53e3\uff1a${gamePort}`,
    '',
    '\u64cd\u4f5c\uff1a',
    '1. \u6253\u5f00\u8054\u673a\u52a9\u624b',
    '2. \u8fdb\u5165\u8054\u673a\u5411\u5bfc',
    '3. \u9009\u62e9\u201c\u6211\u662f\u52a0\u5165\u8005\u201d',
    '4. \u6309\u4e0a\u9762\u4fe1\u606f\u586b\u5199',
    '5. \u70b9\u51fb\u201c\u4fdd\u5b58\u914d\u7f6e\u5e76\u542f\u52a8 n2n edge\u201d',
    `6. Terraria \u9009\u62e9 Join via IP\uff0cIP \u586b ${hostIp}\uff0c\u7aef\u53e3\u586b ${gamePort}`
  ].join('\n');

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    if (busyAction) {
      setStatusMessage(`${t.busy}\uff1a${busyAction}\uff0c\u8bf7\u7a0d\u7b49...`);
      return;
    }

    try {
      setBusyAction(label);
      setStatusMessage(`${t.busy}\uff1a${label}\uff0c\u8bf7\u7a0d\u7b49...`);
      await action();
    } catch (error) {
      setStatusMessage(`${label}\u5931\u8d25\uff1a${String(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const saveAndStartN2n = () =>
    runAction('\u4fdd\u5b58 n2n \u914d\u7f6e\u5e76\u542f\u52a8 edge', async () => {
      const setup = await setupNetwork('n2n', {
        room_name: roomName,
        secret,
        supernode,
        local_ip: localIp
      });
      const started = await startNetwork('n2n');
      setStatusMessage(`${setup.message}\n${started.message}`);
    });

  const startEmbeddedServer = () =>
    runAction('\u542f\u52a8\u5185\u5d4c Terraria \u670d\u52a1\u7aef', async () => {
      const next = await startGameServerSession('terraria', 'server', serverConfig);
      setSession(next);
      setStatusMessage(next.message);
    });

  const stopEmbeddedServer = () =>
    runAction('\u505c\u6b62\u5185\u5d4c\u670d\u52a1\u7aef', async () => {
      const next = await stopServerSession();
      setSession(next);
      setStatusMessage(next.message);
    });

  const copyInvite = () =>
    runAction('\u590d\u5236\u9080\u8bf7\u4fe1\u606f', async () => {
      if (!navigator.clipboard) throw new Error('剪贴板不可用');
      await navigator.clipboard.writeText(inviteText);
      setStatusMessage('\u9080\u8bf7\u4fe1\u606f\u5df2\u590d\u5236\u3002');
    });

  const sendConsoleCommand = (command: string, label: string) =>
    runAction(label, async () => {
      const next = await sendServerCommand(command);
      setSession(next);
      setStatusMessage(`已向 Terraria 服务端发送命令：${command}`);
    });

  const runSelfCheck = () =>
    runAction(t.selfCheck, async () => {
      const [latestSession, backends] = await Promise.all([readServerSession(), listNetworkBackends()]);
      const n2n = backends.find((item) => item.id === 'n2n');
      const localReport = role === 'host' ? await safeConnectivity('127.0.0.1', 'local_game_port') : null;
      const targetHost = role === 'host' ? hostIp : hostIp;
      const virtualReport = await safeConnectivity(targetHost, 'n2n_game_port');
      const result = buildSelfCheckResult(role, latestSession, n2n, localReport, virtualReport);
      setSession(latestSession);
      setSelfCheck(result);
      setStatusMessage(result.ok ? '\u81ea\u68c0\u901a\u8fc7\uff1a\u5f53\u524d\u914d\u7f6e\u53ef\u4ee5\u7ee7\u7eed\u9080\u8bf7/\u52a0\u5165\u3002' : '\u81ea\u68c0\u672a\u5b8c\u5168\u901a\u8fc7\uff0c\u8bf7\u6309\u4e0b\u65b9\u63d0\u793a\u5904\u7406\u3002');
    });

  const safeConnectivity = async (host: string, mode: 'local_game_port' | 'n2n_game_port') => {
    try {
      return await testConnectivity({ host, ports: [portNumber], timeout_ms: 1200, mode });
    } catch (error) {
      return {
        target_host: host,
        reachable: false,
        ports: [{ port: portNumber, reachable: false, error: String(error) }],
        notes: [`\u68c0\u6d4b\u5931\u8d25\uff1a${String(error)}`]
      } as ConnectivityReport;
    }
  };

  const buildSelfCheckResult = (
    currentRole: Role,
    latestSession: ServerSessionStatus,
    n2n: BackendSummary | undefined,
    localReport: ConnectivityReport | null,
    virtualReport: ConnectivityReport
  ): SelfCheckResult => {
    const virtualIp = n2n?.virtual_ip || '';
    const expectedLocalIp = currentRole === 'host' ? hostIp : joinerIp;
    const virtualIpOk = virtualIp === expectedLocalIp;
    const hostServerReady = Boolean(latestSession.running && (latestSession.ready || localReport?.reachable || virtualReport.reachable));
    const items: SelfCheckItem[] = [
      {
        label: 'supernode',
        ok: Boolean(supernode.trim()),
        detail: supernode.trim() ? `\u5df2\u586b\u5199\uff1a${supernode}` : '\u8fd8\u6ca1\u6709\u586b\u5199 supernode\u3002'
      },
      {
        label: 'n2n edge',
        ok: Boolean(n2n?.available),
        detail: n2n?.available ? '\u5df2\u68c0\u6d4b\u5230 edge.exe\u3002' : '\u672a\u68c0\u6d4b\u5230 edge.exe\u3002'
      },
      {
        label: '\u672c\u673a\u865a\u62df IP',
        ok: virtualIpOk,
        detail: virtualIp ? `\u5f53\u524d\u68c0\u6d4b\u5230 ${virtualIp}\uff0c\u671f\u671b ${expectedLocalIp}\u3002` : `\u672a\u68c0\u6d4b\u5230 n2n \u865a\u62df IP\uff0c\u671f\u671b ${expectedLocalIp}\u3002`
      }
    ];

    if (currentRole === 'host') {
      items.push(
        {
          label: 'Terraria \u670d\u52a1\u7aef',
          ok: hostServerReady,
          detail: hostServerReady
            ? `已就绪，PID ${latestSession.pid || '-'}，端口 ${portNumber} 可连接。`
            : latestSession.exit_code != null || latestSession.ever_ready
              ? `服务端已退出，退出码 ${latestSession.exit_code ?? '未知'}，曾经监听端口：${latestSession.ever_ready ? '是' : '否'}。`
              : '服务端尚未就绪。'
        },
        {
          label: `127.0.0.1:${portNumber}`,
          ok: Boolean(localReport?.reachable),
          detail: localReport?.reachable ? '\u672c\u673a\u7aef\u53e3\u53ef\u8fde\u63a5\u3002' : '\u672c\u673a\u7aef\u53e3\u4e0d\u53ef\u8fde\u63a5\uff0c\u8bf7\u5148\u542f\u52a8\u670d\u52a1\u7aef\u3002'
        },
        {
          label: `${hostIp}:${portNumber}`,
          ok: virtualReport.reachable,
          detail: virtualReport.reachable ? '\u865a\u62df IP \u7aef\u53e3\u53ef\u8fde\u63a5\u3002' : '\u865a\u62df IP \u7aef\u53e3\u4e0d\u53ef\u8fde\u63a5\uff0c\u8bf7\u68c0\u67e5 n2n \u6216\u9632\u706b\u5899\u3002'
        }
      );
    } else {
      items.push({
        label: `${hostIp}:${portNumber}`,
        ok: virtualReport.reachable,
        detail: virtualReport.reachable ? '\u53ef\u4ee5\u8fde\u5230\u623f\u4e3b\u6e38\u620f\u7aef\u53e3\u3002' : '\u8fd8\u4e0d\u80fd\u8fde\u5230\u623f\u4e3b\u6e38\u620f\u7aef\u53e3\u3002'
      });
    }

    const ok = items.every((item) => item.ok);
    const notes = ok
      ? [currentRole === 'host' ? '\u623f\u4e3b\u4fa7\u5df2\u51c6\u5907\u597d\uff0c\u53ef\u4ee5\u628a\u9080\u8bf7\u4fe1\u606f\u53d1\u7ed9\u670b\u53cb\u3002' : '\u52a0\u5165\u8005\u4fa7\u5df2\u51c6\u5907\u597d\uff0c\u53ef\u4ee5\u6253\u5f00 Terraria \u52a0\u5165\u3002']
      : [
          '\u5982\u679c\u53ea\u6709\u4e00\u53f0\u7535\u8111\uff0c\u623f\u4e3b\u81ea\u68c0\u901a\u8fc7\u5c31\u8bf4\u660e\u623f\u4e3b\u4fa7\u57fa\u672c\u53ef\u7528\u3002',
          '\u670b\u53cb\u662f\u5426\u80fd\u52a0\u5165\uff0c\u8fd8\u9700\u8981\u670b\u53cb\u7535\u8111\u542f\u52a8 n2n \u5e76\u6d4b\u8bd5\u8fde\u63a5\u3002'
        ];

    return {
      title: currentRole === 'host' ? t.selfCheckTitle : t.joinerCheckTitle,
      ok,
      items,
      notes
    };
  };

  const selfCheckText = selfCheck
    ? [
        `\u3010${selfCheck.title}\u3011`,
        `\u7ed3\u8bba\uff1a${selfCheck.ok ? '\u901a\u8fc7' : '\u672a\u5b8c\u5168\u901a\u8fc7'}`,
        '',
        ...selfCheck.items.map((item) => `${item.ok ? '\u2705' : '\u274c'} ${item.label}\uff1a${item.detail}`),
        '',
        ...selfCheck.notes
      ].join('\n')
    : '';

  const copySelfCheck = () =>
    runAction(t.copyCheck, async () => {
      if (!navigator.clipboard) throw new Error('剪贴板不可用');
      await navigator.clipboard.writeText(selfCheckText);
      setStatusMessage('\u81ea\u68c0\u7ed3\u679c\u5df2\u590d\u5236\u3002');
    });

  return (
    <section className="page-stack modern-content-page terraria-page">
      <LoadingOverlay visible={isBusy} title={initialLoading ? '正在读取 Terraria 向导状态' : `${t.busy}：${busyAction ?? ''}`} message={initialLoading ? '正在读取最近 supernode 和服务端会话；后续再次进入会优先显示缓存。' : t.wait} />
      <div className="content-hero terraria-hero">
        <div>
          <span className="eyebrow">TERRARIA GUIDE</span>
          <h2>{t.title}</h2>
          <p className="muted">{t.intro}</p>
        </div>
        <div className="hero-mini-stats">
          <article><span>当前身份</span><strong>{role === 'host' ? '房主' : '加入者'}</strong></article>
          <article><span>服务端</span><strong>{session?.ready ? '已就绪' : session?.running ? '运行中' : '未运行'}</strong></article>
          <article><span>游戏端口</span><strong>{gamePort}</strong></article>
          <article><span>虚拟 IP</span><strong>{localIp}</strong></article>
        </div>
      </div>

      {busyAction && <div className="busy-banner">{t.busy}：{busyAction}，{t.wait}</div>}

      <article className="card content-panel role-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ROLE</span>
            <h3>1. {t.role}</h3>
          </div>
          <span className="badge warn">真实配置</span>
        </div>
        <div className="actions">
          <button className={role === 'host' ? 'active' : ''} onClick={() => setRole('host')} disabled={isBusy}>
            {t.host}
          </button>
          <button className={role === 'joiner' ? 'active' : ''} onClick={() => setRole('joiner')} disabled={isBusy}>
            {t.joiner}
          </button>
          <button className="secondary" onClick={() => refreshWizardState(true)} disabled={isBusy}>
            刷新向导状态
          </button>
        </div>
      </article>

      <article className="card content-panel terraria-room-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">NETWORK ROOM</span>
            <h3>2. {t.roomConfig}</h3>
            <p className="muted">房主和朋友必须使用同一个 community、secret、supernode，每个人使用不同虚拟 IP。</p>
          </div>
        </div>
        <label>
          {t.roomName}
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} disabled={isBusy} />
        </label>
        <label>
          {t.secret}
          <input value={secret} onChange={(event) => setSecret(event.target.value)} disabled={isBusy} />
        </label>
        <label>
          supernode
          <input value={supernode} onChange={(event) => setSupernode(event.target.value)} placeholder="VPS_IP:7777" disabled={isBusy} />
        </label>
        <label>
          {t.hostIp}
          <input value={hostIp} onChange={(event) => setHostIp(event.target.value)} disabled={isBusy} />
        </label>
        <label>
          {t.joinerIp}
          <input value={joinerIp} onChange={(event) => setJoinerIp(event.target.value)} disabled={isBusy} />
        </label>
        <div className="actions">
          <button onClick={saveAndStartN2n} disabled={isBusy}>{t.saveStartN2n}</button>
          <button onClick={runSelfCheck} disabled={isBusy}>{t.selfCheck}</button>
          <button onClick={copySelfCheck} disabled={isBusy || !selfCheck}>{t.copyCheck}</button>
        </div>
      </article>

      {role === 'host' && (
        <article className="card content-panel terraria-server-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">GAME SERVER</span>
              <h3>3. {t.startServer}</h3>
              <p className="muted">这里启动真实 Terraria 服务端进程，不模拟成功状态。</p>
            </div>
            <span className={session?.ready ? 'badge good' : session?.running ? 'badge warn' : 'badge'}>
              {session?.ready ? '端口已监听' : session?.running ? '启动中' : '未运行'}
            </span>
          </div>
          <label>
            {t.worldChoice}
            <input value={worldChoice} onChange={(event) => setWorldChoice(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            {t.worldPath}
            <input value={worldPath} onChange={(event) => setWorldPath(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            {t.maxPlayers}
            <input value={maxPlayers} onChange={(event) => setMaxPlayers(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            {t.gamePort}
            <input value={gamePort} onChange={(event) => setGamePort(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            {t.password}
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            {t.autoForward}
            <select value={autoForward} onChange={(event) => setAutoForward(event.target.value)} disabled={isBusy}>
              <option value="n">n</option>
              <option value="y">y</option>
            </select>
          </label>
          <div className="actions">
            <button onClick={startEmbeddedServer} disabled={isBusy}>{t.startInApp}</button>
            <button className="secondary" onClick={stopEmbeddedServer} disabled={isBusy}>{t.stopInApp}</button>
          </div>
        </article>
      )}

      {selfCheck && (
        <article className="card content-panel self-check-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">SELF CHECK</span>
              <h3>{selfCheck.title}</h3>
            </div>
            <span className={selfCheck.ok ? 'badge good' : 'badge bad'}>{selfCheck.ok ? '通过' : '需处理'}</span>
          </div>
          <div className={selfCheck.ok ? 'result-ok' : 'result-bad'}>
            <p>{selfCheck.ok ? '\u7ed3\u8bba\uff1a\u901a\u8fc7' : '\u7ed3\u8bba\uff1a\u672a\u5b8c\u5168\u901a\u8fc7'}</p>
          </div>
          <ul>
            {selfCheck.items.map((item) => (
              <li key={item.label}>
                <strong>{item.ok ? '\u2705' : '\u274c'} {item.label}</strong>：{item.detail}
              </li>
            ))}
          </ul>
          <pre>{selfCheck.notes.join('\n')}</pre>
        </article>
      )}

      <article className="card content-panel invite-output-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">INVITE</span>
            <h3>{role === 'host' ? `4. ${t.copyToFriend}` : `3. ${t.joinGame}`}</h3>
          </div>
        </div>
        {role === 'host' ? (
          <>
            <p className="muted">{t.sendToFriend}</p>
            <pre>{inviteText}</pre>
            <button onClick={copyInvite} disabled={isBusy}>{t.copyInvite}</button>
          </>
        ) : (
          <p>
            {'\u542f\u52a8 n2n \u540e\uff0c\u6253\u5f00 Terraria - Multiplayer - Join via IP\uff0c\u8f93\u5165\u623f\u4e3b\u865a\u62df IP\uff1a'}
            <strong>{hostIp}</strong>{'\uff0c\u7aef\u53e3\uff1a'}<strong>{gamePort}</strong>{'\u3002'}
          </p>
        )}
      </article>

      <article className="card content-panel server-console-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">CONSOLE</span>
            <h3>{t.console}</h3>
          </div>
          <span className={session?.ready ? 'badge good' : session?.running ? 'badge warn' : session?.ever_ready || session?.exit_code != null ? 'badge bad' : 'badge'}>
            {session?.ready ? '已就绪' : session?.running ? '运行中' : '未运行'}
          </span>
        </div>
        <p className="muted">{t.consoleDesc}</p>
        {statusMessage && <pre>{statusMessage}</pre>}
        <div className="actions console-actions">
          <button className="secondary" onClick={() => sendConsoleCommand('help', t.sendHelp)} disabled={isBusy || !session?.running}>{t.sendHelp}</button>
          <button className="secondary" onClick={() => sendConsoleCommand('save', t.sendSave)} disabled={isBusy || !session?.running}>{t.sendSave}</button>
          <button className="danger" onClick={() => sendConsoleCommand('exit', t.sendExit)} disabled={isBusy || !session?.running}>{t.sendExit}</button>
        </div>
        <div className={session?.ready ? 'result-ok' : session?.running ? 'result-idle' : session?.ever_ready || session?.exit_code != null ? 'result-bad' : 'result-idle'}>
          <p>
            {t.status}：
            {session?.ready
              ? `${t.readyState}${session.pid ? `\uff0cPID ${session.pid}` : ''}`
              : session?.running
                ? `${t.running}，PID ${session.pid}`
                : t.stopped}
          </p>
          <p>{t.ready}：{session?.ready ? t.readyText : t.notReadyText}</p>
          {session?.running && <p>运行时长：{session.uptime_seconds ?? 0} 秒{session.ready && (session.uptime_seconds ?? 0) >= 30 ? '，30 秒稳定性已通过' : ''}</p>}
          {session && !session.running && (session.ever_ready || session.exit_code != null) && (
            <p>退出诊断：退出码 {session.exit_code ?? '未知'}，曾经监听端口：{session.ever_ready ? '是' : '否'}。</p>
          )}
        </div>
        <p className="muted">{t.consoleMvpNotice}</p>
        <pre className="console-panel">{session?.logs?.join('\n') || t.noLogs}</pre>
      </article>
    </section>
  );
}
