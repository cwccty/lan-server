import { useEffect, useMemo, useState } from 'react';
import {
  readServerSession,
  sendServerCommand,
  setupNetwork,
  startGameServerSession,
  startNetwork,
  stopServerSession
} from '../api/tauri';
import type { LaunchConfig } from '../types/recommendation';
import type { ServerSessionStatus } from '../types/serverSession';

type Role = 'host' | 'joiner';

export function MultiplayerWizardPage() {
  const [role, setRole] = useState<Role>('host');
  const [roomName, setRoomName] = useState('terraria-room-001');
  const [secret, setSecret] = useState('lan-helper-secret');
  const [supernode, setSupernode] = useState('');
  const [hostIp, setHostIp] = useState('10.10.10.2');
  const [joinerIp, setJoinerIp] = useState('10.10.10.3');
  const [gamePort, setGamePort] = useState('7777');
  const [worldChoice, setWorldChoice] = useState('1');
  const [worldPath, setWorldPath] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('8');
  const [password, setPassword] = useState('');
  const [autoForward, setAutoForward] = useState('n');
  const [serverCommand, setServerCommand] = useState('help');
  const [statusMessage, setStatusMessage] = useState('');
  const [session, setSession] = useState<ServerSessionStatus | null>(null);

  const localIp = role === 'host' ? hostIp : joinerIp;

  useEffect(() => {
    const timer = window.setInterval(() => {
      readServerSession().then(setSession).catch(() => undefined);
    }, 1500);
    readServerSession().then(setSession).catch(() => undefined);
    return () => window.clearInterval(timer);
  }, []);

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
    '【联机助手邀请】',
    '游戏：Terraria',
    '身份：你是加入者',
    `community：${roomName}`,
    `secret：${secret}`,
    `supernode：${supernode || '待填写'}`,
    `你的本机虚拟 IP：${joinerIp}`,
    `房主虚拟 IP：${hostIp}`,
    `游戏端口：${gamePort}`,
    `Terraria 加入地址：${hostIp}:${gamePort}`,
    '操作：打开联机助手 → 联机向导 → 我是加入者 → 按上面信息填写 → 启动 n2n edge → Terraria 里 Join via IP。'
  ].join('\n');

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      setStatusMessage(`${label}...`);
      await action();
    } catch (error) {
      setStatusMessage(`${label}失败：${String(error)}`);
    }
  };

  const saveAndStartN2n = () =>
    runAction('正在保存 n2n 配置并启动 edge', async () => {
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
    runAction('正在启动内嵌 Terraria 服务端', async () => {
      const next = await startGameServerSession('terraria', 'server', serverConfig);
      setSession(next);
      setStatusMessage(next.message);
    });

  const stopEmbeddedServer = () =>
    runAction('正在停止内嵌服务端', async () => {
      const next = await stopServerSession();
      setSession(next);
      setStatusMessage(next.message);
    });

  const sendCommand = (command = serverCommand) =>
    runAction(`正在发送命令：${command}`, async () => {
      const next = await sendServerCommand(command);
      setSession(next);
      setStatusMessage(next.message);
      setServerCommand('');
    });

  const copyInvite = () =>
    runAction('正在复制邀请信息', async () => {
      await navigator.clipboard?.writeText(inviteText);
      setStatusMessage('邀请信息已复制。');
    });

  return (
    <section>
      <h2>联机向导</h2>
      <p className="muted">第一版先围绕 Terraria + n2n，把房主和加入者流程串成一条龙。</p>

      <article className="card">
        <h3>1. 选择身份</h3>
        <div className="actions">
          <button className={role === 'host' ? 'active' : ''} onClick={() => setRole('host')}>
            我是房主
          </button>
          <button className={role === 'joiner' ? 'active' : ''} onClick={() => setRole('joiner')}>
            我是加入者
          </button>
        </div>
      </article>

      <article className="card">
        <h3>2. n2n 房间配置</h3>
        <label>
          房间名 / community
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
        </label>
        <label>
          密钥
          <input value={secret} onChange={(event) => setSecret(event.target.value)} />
        </label>
        <label>
          supernode
          <input value={supernode} onChange={(event) => setSupernode(event.target.value)} placeholder="VPS_IP:7777" />
        </label>
        <label>
          房主虚拟 IP
          <input value={hostIp} onChange={(event) => setHostIp(event.target.value)} />
        </label>
        <label>
          加入者虚拟 IP
          <input value={joinerIp} onChange={(event) => setJoinerIp(event.target.value)} />
        </label>
        <button onClick={saveAndStartN2n}>保存配置并启动 n2n edge</button>
      </article>

      {role === 'host' && (
        <article className="card">
          <h3>3. 启动 Terraria 服务端</h3>
          <label>
            世界编号
            <input value={worldChoice} onChange={(event) => setWorldChoice(event.target.value)} />
          </label>
          <label>
            世界文件路径，可选
            <input value={worldPath} onChange={(event) => setWorldPath(event.target.value)} />
          </label>
          <label>
            最大人数
            <input value={maxPlayers} onChange={(event) => setMaxPlayers(event.target.value)} />
          </label>
          <label>
            游戏端口
            <input value={gamePort} onChange={(event) => setGamePort(event.target.value)} />
          </label>
          <label>
            服务端密码，可空
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            自动端口转发 y/n
            <select value={autoForward} onChange={(event) => setAutoForward(event.target.value)}>
              <option value="n">n</option>
              <option value="y">y</option>
            </select>
          </label>
          <div className="actions">
            <button onClick={startEmbeddedServer}>在程序内启动服务端</button>
            <button onClick={stopEmbeddedServer}>停止内嵌服务端</button>
          </div>
        </article>
      )}

      <article className="card">
        <h3>{role === 'host' ? '4. 复制给朋友' : '3. 加入游戏'}</h3>
        {role === 'host' ? (
          <>
            <p className="muted">把下面内容发给朋友。</p>
            <pre>{inviteText}</pre>
            <button onClick={copyInvite}>复制邀请信息</button>
          </>
        ) : (
          <p>
            启动 n2n 后，打开 Terraria → Multiplayer → Join via IP，输入房主虚拟 IP：
            <strong>{hostIp}</strong>，端口：<strong>{gamePort}</strong>。
          </p>
        )}
      </article>

      <article className="card">
        <h3>内嵌服务端控制台</h3>
        <p className="muted">
          这里不是嵌入系统白色命令框，而是由程序托管服务端进程并显示日志。正常情况下不会再弹出第二个 Terraria Server 窗口；
          如果仍弹出，请确认没有使用旧的“推荐方案启动项”或旧版本客户端。
        </p>
        {statusMessage && <pre>{statusMessage}</pre>}
        <div className={session?.ready || session?.running ? 'result-ok' : 'result-idle'}>
          <p>
            状态：
            {session?.ready
              ? `已就绪${session.pid ? `，PID ${session.pid}` : ''}`
              : session?.running
                ? `运行中，PID ${session.pid}`
                : '未运行'}
          </p>
          <p>就绪：{session?.ready ? '已监听端口，可以邀请朋友加入' : '尚未识别到 Listening/Server started'}</p>
        </div>
        <div className="actions">
          <input
            value={serverCommand}
            onChange={(event) => setServerCommand(event.target.value)}
            placeholder="输入服务端命令，例如 help / save / exit"
          />
          <button onClick={() => sendCommand()} disabled={!session?.running || !serverCommand.trim()}>
            发送命令
          </button>
          <button onClick={() => sendCommand('help')} disabled={!session?.running}>
            help
          </button>
          <button onClick={() => sendCommand('save')} disabled={!session?.running}>
            save
          </button>
          <button onClick={() => sendCommand('exit')} disabled={!session?.running}>
            exit
          </button>
        </div>
        <pre className="console-panel">{session?.logs?.join('\n') || '暂无服务端日志。'}</pre>
      </article>
    </section>
  );
}
