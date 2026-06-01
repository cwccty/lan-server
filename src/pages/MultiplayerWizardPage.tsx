import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const pollingRef = useRef(false);
  const [session, setSession] = useState<ServerSessionStatus | null>(null);

  const localIp = role === 'host' ? hostIp : joinerIp;
  const isBusy = busyAction !== null;

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

    void poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [busyAction]);

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
    '\u6e38\u620f\uff1aTerraria',
    '\u8eab\u4efd\uff1a\u4f60\u662f\u52a0\u5165\u8005',
    `community\uff1a${roomName}`,
    `secret\uff1a${secret}`,
    `supernode\uff1a${supernode || '\u5f85\u586b\u5199'}`,
    `\u4f60\u7684\u672c\u673a\u865a\u62df IP\uff1a${joinerIp}`,
    `\u623f\u4e3b\u865a\u62df IP\uff1a${hostIp}`,
    `\u6e38\u620f\u7aef\u53e3\uff1a${gamePort}`,
    `Terraria \u52a0\u5165\u5730\u5740\uff1a${hostIp}:${gamePort}`,
    '\u64cd\u4f5c\uff1a\u6253\u5f00\u8054\u673a\u52a9\u624b -> \u8054\u673a\u5411\u5bfc -> \u6211\u662f\u52a0\u5165\u8005 -> \u6309\u4e0a\u9762\u4fe1\u606f\u586b\u5199 -> \u542f\u52a8 n2n edge -> Terraria \u91cc Join via IP\u3002'
  ].join('\n');

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    if (busyAction) {
      setStatusMessage(`\u6b63\u5728\u5904\u7406\uff1a${busyAction}\uff0c\u8bf7\u7a0d\u7b49...`);
      return;
    }

    try {
      setBusyAction(label);
      setStatusMessage(`\u6b63\u5728\u5904\u7406\uff1a${label}\uff0c\u8bf7\u7a0d\u7b49...`);
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

  const sendCommand = (command = serverCommand) =>
    runAction(`\u53d1\u9001\u547d\u4ee4\uff1a${command}`, async () => {
      const next = await sendServerCommand(command);
      setSession(next);
      setStatusMessage(next.message);
      setServerCommand('');
    });

  const copyInvite = () =>
    runAction('\u590d\u5236\u9080\u8bf7\u4fe1\u606f', async () => {
      await navigator.clipboard?.writeText(inviteText);
      setStatusMessage('\u9080\u8bf7\u4fe1\u606f\u5df2\u590d\u5236\u3002');
    });

  return (
    <section>
      <h2>&#32852;&#26426;&#21521;&#23548;</h2>
      <p className="muted">&#31532;&#19968;&#29256;&#20808;&#22260;&#32469; Terraria + n2n&#65292;&#25226;&#25151;&#20027;&#21644;&#21152;&#20837;&#32773;&#27969;&#31243;&#20018;&#25104;&#19968;&#26465;&#40857;&#12290;</p>

      {busyAction && <div className="busy-banner">&#27491;&#22312;&#22788;&#29702;&#65306;{busyAction}&#65292;&#35831;&#31245;&#31561;&#65292;&#19981;&#35201;&#37325;&#22797;&#28857;&#20987;&#12290;</div>}

      <article className="card">
        <h3>1. &#36873;&#25321;&#36523;&#20221;</h3>
        <div className="actions">
          <button className={role === 'host' ? 'active' : ''} onClick={() => setRole('host')} disabled={isBusy}>
            &#25105;&#26159;&#25151;&#20027;
          </button>
          <button className={role === 'joiner' ? 'active' : ''} onClick={() => setRole('joiner')} disabled={isBusy}>
            &#25105;&#26159;&#21152;&#20837;&#32773;
          </button>
        </div>
      </article>

      <article className="card">
        <h3>2. n2n &#25151;&#38388;&#37197;&#32622;</h3>
        <label>
          &#25151;&#38388;&#21517; / community
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} disabled={isBusy} />
        </label>
        <label>
          &#23494;&#38053;
          <input value={secret} onChange={(event) => setSecret(event.target.value)} disabled={isBusy} />
        </label>
        <label>
          supernode
          <input value={supernode} onChange={(event) => setSupernode(event.target.value)} placeholder="VPS_IP:7777" disabled={isBusy} />
        </label>
        <label>
          &#25151;&#20027;&#34394;&#25311; IP
          <input value={hostIp} onChange={(event) => setHostIp(event.target.value)} disabled={isBusy} />
        </label>
        <label>
          &#21152;&#20837;&#32773;&#34394;&#25311; IP
          <input value={joinerIp} onChange={(event) => setJoinerIp(event.target.value)} disabled={isBusy} />
        </label>
        <button onClick={saveAndStartN2n} disabled={isBusy}>&#20445;&#23384;&#37197;&#32622;&#24182;&#21551;&#21160; n2n edge</button>
      </article>

      {role === 'host' && (
        <article className="card">
          <h3>3. &#21551;&#21160; Terraria &#26381;&#21153;&#31471;</h3>
          <label>
            &#19990;&#30028;&#32534;&#21495;
            <input value={worldChoice} onChange={(event) => setWorldChoice(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            &#19990;&#30028;&#25991;&#20214;&#36335;&#24452;&#65292;&#21487;&#36873;
            <input value={worldPath} onChange={(event) => setWorldPath(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            &#26368;&#22823;&#20154;&#25968;
            <input value={maxPlayers} onChange={(event) => setMaxPlayers(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            &#28216;&#25103;&#31471;&#21475;
            <input value={gamePort} onChange={(event) => setGamePort(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            &#26381;&#21153;&#31471;&#23494;&#30721;&#65292;&#21487;&#31354;
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isBusy} />
          </label>
          <label>
            &#33258;&#21160;&#31471;&#21475;&#36716;&#21457; y/n
            <select value={autoForward} onChange={(event) => setAutoForward(event.target.value)} disabled={isBusy}>
              <option value="n">n</option>
              <option value="y">y</option>
            </select>
          </label>
          <div className="actions">
            <button onClick={startEmbeddedServer} disabled={isBusy}>&#22312;&#31243;&#24207;&#20869;&#21551;&#21160;&#26381;&#21153;&#31471;</button>
            <button onClick={stopEmbeddedServer} disabled={isBusy}>&#20572;&#27490;&#20869;&#23884;&#26381;&#21153;&#31471;</button>
          </div>
        </article>
      )}

      <article className="card">
        <h3>{role === 'host' ? '4. \u590d\u5236\u7ed9\u670b\u53cb' : '3. \u52a0\u5165\u6e38\u620f'}</h3>
        {role === 'host' ? (
          <>
            <p className="muted">&#25226;&#19979;&#38754;&#20869;&#23481;&#21457;&#32473;&#26379;&#21451;&#12290;</p>
            <pre>{inviteText}</pre>
            <button onClick={copyInvite} disabled={isBusy}>&#22797;&#21046;&#36992;&#35831;&#20449;&#24687;</button>
          </>
        ) : (
          <p>
            &#21551;&#21160; n2n &#21518;&#65292;&#25171;&#24320; Terraria - Multiplayer - Join via IP&#65292;&#36755;&#20837;&#25151;&#20027;&#34394;&#25311; IP&#65306;
            <strong>{hostIp}</strong>&#65292;&#31471;&#21475;&#65306;<strong>{gamePort}</strong>&#12290;
          </p>
        )}
      </article>

      <article className="card">
        <h3>&#20869;&#23884;&#26381;&#21153;&#31471;&#25511;&#21046;&#21488;</h3>
        <p className="muted">
          &#36825;&#37324;&#19981;&#26159;&#21333;&#29420;&#30340;&#30333;&#33394;&#21629;&#20196;&#26694;&#65292;&#32780;&#26159;&#30001;&#31243;&#24207;&#25176;&#31649;&#26381;&#21153;&#31471;&#36827;&#31243;&#24182;&#26174;&#31034;&#29366;&#24577;&#12290;&#27491;&#24120;&#24773;&#20917;&#19979;&#19981;&#20250;&#20877;&#24377;&#20986;&#21629;&#20196;&#31383;&#21475;&#12290;
        </p>
        {statusMessage && <pre>{statusMessage}</pre>}
        <div className={session?.ready || session?.running ? 'result-ok' : 'result-idle'}>
          <p>
            &#29366;&#24577;:
            {session?.ready
              ? `\u5df2\u5c31\u7eea${session.pid ? `\uff0cPID ${session.pid}` : ''}`
              : session?.running
                ? `\u8fd0\u884c\u4e2d\uff0cPID ${session.pid}`
                : '\u672a\u8fd0\u884c'}
          </p>
          <p>&#23601;&#32490;&#65306;{session?.ready ? '\u5df2\u76d1\u542c\u7aef\u53e3\uff0c\u53ef\u4ee5\u9080\u8bf7\u670b\u53cb\u52a0\u5165' : '\u5c1a\u672a\u76d1\u542c\u7aef\u53e3'}</p>
        </div>
        <div className="actions">
          <input
            value={serverCommand}
            onChange={(event) => setServerCommand(event.target.value)}
            placeholder="&#36755;&#20837;&#26381;&#21153;&#31471;&#21629;&#20196;&#65292;&#20363;&#22914; help / save / exit"
            disabled={isBusy}
          />
          <button onClick={() => sendCommand()} disabled={isBusy || !session?.running || !serverCommand.trim()}>
            &#21457;&#36865;&#21629;&#20196;
          </button>
          <button onClick={() => sendCommand('help')} disabled={isBusy || !session?.running}>
            help
          </button>
          <button onClick={() => sendCommand('save')} disabled={isBusy || !session?.running}>
            save
          </button>
          <button onClick={() => sendCommand('exit')} disabled={isBusy || !session?.running}>
            exit
          </button>
        </div>
        <pre className="console-panel">{session?.logs?.join('\n') || '\u6682\u65e0\u670d\u52a1\u7aef\u65e5\u5fd7\u3002'}</pre>
      </article>
    </section>
  );
}
