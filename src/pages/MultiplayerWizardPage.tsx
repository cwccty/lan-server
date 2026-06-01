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
    '[Lan Helper Invite]',
    'Game: Terraria',
    'Role: joiner',
    `community: ${roomName}`,
    `secret: ${secret}`,
    `supernode: ${supernode || 'TODO'}`,
    `your virtual IP: ${joinerIp}`,
    `host virtual IP: ${hostIp}`,
    `game port: ${gamePort}`,
    `Terraria join address: ${hostIp}:${gamePort}`,
    'Steps: open Lan Helper -> Multiplayer Wizard -> Joiner -> fill this info -> start n2n edge -> Terraria Join via IP.'
  ].join('\n');

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    if (busyAction) {
      setStatusMessage(`Processing: ${busyAction}. Please wait...`);
      return;
    }

    try {
      setBusyAction(label);
      setStatusMessage(`Processing: ${label}. Please wait...`);
      await action();
    } catch (error) {
      setStatusMessage(`${label} failed: ${String(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const saveAndStartN2n = () =>
    runAction('save n2n config and start edge', async () => {
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
    runAction('start embedded Terraria server', async () => {
      const next = await startGameServerSession('terraria', 'server', serverConfig);
      setSession(next);
      setStatusMessage(next.message);
    });

  const stopEmbeddedServer = () =>
    runAction('stop embedded server', async () => {
      const next = await stopServerSession();
      setSession(next);
      setStatusMessage(next.message);
    });

  const sendCommand = (command = serverCommand) =>
    runAction(`send command: ${command}`, async () => {
      const next = await sendServerCommand(command);
      setSession(next);
      setStatusMessage(next.message);
      setServerCommand('');
    });

  const copyInvite = () =>
    runAction('copy invite info', async () => {
      await navigator.clipboard?.writeText(inviteText);
      setStatusMessage('Invite copied.');
    });

  return (
    <section>
      <h2>&#32852;&#26426;&#21521;&#23548;</h2>
      <p className="muted">Terraria + n2n one-click host/join flow.</p>

      {busyAction && <div className="busy-banner">Processing: {busyAction}. Please wait and do not click repeatedly.</div>}

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
        <h3>{role === 'host' ? '4. Copy invite' : '3. Join game'}</h3>
        {role === 'host' ? (
          <>
            <p className="muted">Send this to your friend.</p>
            <pre>{inviteText}</pre>
            <button onClick={copyInvite} disabled={isBusy}>&#22797;&#21046;&#36992;&#35831;&#20449;&#24687;</button>
          </>
        ) : (
          <p>
            Start n2n, then open Terraria - Multiplayer - Join via IP. Host IP:
            <strong>{hostIp}</strong>, port: <strong>{gamePort}</strong>.
          </p>
        )}
      </article>

      <article className="card">
        <h3>&#20869;&#23884;&#26381;&#21153;&#31471;&#25511;&#21046;&#21488;</h3>
        <p className="muted">
          This is managed by the app instead of a separate white command window. The new build starts Terraria Server with a hidden Windows console.
        </p>
        {statusMessage && <pre>{statusMessage}</pre>}
        <div className={session?.ready || session?.running ? 'result-ok' : 'result-idle'}>
          <p>
            &#29366;&#24577;:
            {session?.ready
              ? `Ready${session.pid ? `, PID ${session.pid}` : ''}`
              : session?.running
                ? `Running, PID ${session.pid}`
                : 'Stopped'}
          </p>
          <p>Ready: {session?.ready ? 'Port is listening. You can invite friends.' : 'Port is not listening yet.'}</p>
        </div>
        <div className="actions">
          <input
            value={serverCommand}
            onChange={(event) => setServerCommand(event.target.value)}
            placeholder="help / save / exit"
            disabled={isBusy}
          />
          <button onClick={() => sendCommand()} disabled={isBusy || !session?.running || !serverCommand.trim()}>
            send
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
        <pre className="console-panel">{session?.logs?.join('\n') || 'No server logs yet.'}</pre>
      </article>
    </section>
  );
}
