import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, RefreshCw, Server } from 'lucide-react';
import {
  preflightGenericServerSession,
  readServerSession,
  startGenericServerSession,
  testConnectivity,
} from '../api/tauri';
import type { GenericServerPreflightReport, ServerSessionStatus } from '../types/serverSession';
import type { AppTab } from '../reference-ui/types';
import {
  consumeOneClickServerProfileRoute,
  ONE_CLICK_SERVER_PROFILE_EVENT,
} from './adapterCategoryRoute';

type OneClickServerGameId = 'palworld' | 'minecraft_java';
type OneClickPreflightLevel = 'ok' | 'warn' | 'block';

interface OneClickServerProfile {
  id: OneClickServerGameId;
  name: string;
  shortName: string;
  badge: string;
  statusLabel: string;
  routeLabel: string;
  fileHint: string;
  defaultPort: number;
  protocol: 'tcp' | 'udp';
  serverFileLabel: string;
  defaultArgs: string;
  recommendedMemoryMb?: number;
  routeTags: string[];
  fileTypes: string[];
  configFiles: string[];
  portCheckHint: string;
  inviteAddressHint: string;
  repairSuggestions: string[];
  preflightNotes: string[];
  hostSteps: string[];
  joinSteps: string[];
}

interface OneClickPreflightItem {
  level: OneClickPreflightLevel;
  title: string;
  detail: string;
}

interface ProductOneClickServerMvpProps {
  busy: string;
  setBusy: (value: string) => void;
  onTriggerToast: (msg: string) => void;
  onNavigateTab?: (tab: AppTab) => void;
}

const ONE_CLICK_SERVER_PROFILES: Record<OneClickServerGameId, OneClickServerProfile> = {
  palworld: {
    id: 'palworld',
    name: 'Palworld / 幻兽帕鲁',
    shortName: 'Palworld',
    badge: '待实机验证',
    statusLabel: '专用服务端 / UDP 8211',
    routeLabel: '服务端 + 组网地址；Steam Relay 可作为复杂网络的补充路线',
    fileHint: '例如 C:\\SteamLibrary\\steamapps\\common\\PalServer\\PalServer.exe 或启动脚本 .bat/.cmd',
    defaultPort: 8211,
    protocol: 'udp',
    serverFileLabel: 'PalServer.exe / 启动脚本',
    defaultArgs: '-port=8211',
    routeTags: ['服务端', 'UDP 8211', '可配合 Steam Relay/P2P'],
    fileTypes: ['PalServer.exe', '.bat', '.cmd'],
    configFiles: ['服务端配置里的端口需要和这里一致', '防火墙需要允许 PalServer 入站'],
    portCheckHint: 'UDP 8211 的本机检测只能作为线索，最终仍要看好友能否在游戏里加入。',
    inviteAddressHint: '邀请里使用联机助手提供的房主联机地址，格式类似 房主联机地址:8211。',
    repairSuggestions: [
      '核对 Palworld 客户端和服务端版本是否一致。',
      '确认服务端端口和这里填写的 UDP 端口一致。',
      'Windows 防火墙放行 PalServer.exe 或你的启动脚本。',
    ],
    preflightNotes: [
      '确认双方游戏版本一致，房主已安装 Palworld Dedicated Server。',
      'UDP 端口无法像 TCP 一样完全自动证明远端可用，最终仍以好友游戏内加入为准。',
      '如果服务端有自定义端口，请把这里的端口改成服务端配置里的端口。',
    ],
    hostSteps: [
      '选择 PalServer.exe 或你已经写好的启动脚本。',
      '确认端口和服务端配置一致，默认 UDP 8211。',
      '点击启动服务端，或先手动启动后点击检测端口。',
      '复制邀请给好友，好友在 Palworld 专用服务器地址里输入房主联机地址和端口。',
    ],
    joinSteps: [
      '先粘贴房主给的联机助手邀请包并加入同一组网。',
      '打开 Palworld，多人游戏中选择专用服务器入口。',
      '输入邀请里的房主联机地址和端口，例如 房主联机地址:8211。',
      '如果进不去，把诊断报告发给房主核对端口、防火墙和服务端日志。',
    ],
  },
  minecraft_java: {
    id: 'minecraft_java',
    name: 'Minecraft Java',
    shortName: 'Minecraft',
    badge: '待实机验证',
    statusLabel: 'Java 服务端 / TCP 25565',
    routeLabel: 'server.jar 托管；开放到局域网时以游戏显示端口为准',
    fileHint: '例如 D:\\MinecraftServer\\server.jar，也可以选择已有 .bat/.cmd 启动脚本',
    defaultPort: 25565,
    protocol: 'tcp',
    serverFileLabel: 'server.jar / 启动脚本',
    defaultArgs: 'nogui',
    recommendedMemoryMb: 2048,
    routeTags: ['服务端', 'TCP 25565', '可复制 IP:端口邀请'],
    fileTypes: ['server.jar', '.bat', '.cmd'],
    configFiles: ['server.properties', 'eula.txt'],
    portCheckHint: 'TCP 25565 能检测本机监听；如果是“开放到局域网”，请改成游戏聊天框显示的端口。',
    inviteAddressHint: '好友在多人游戏里选择直接连接，输入 联机地址:端口，例如 组网地址:25565。',
    repairSuggestions: [
      '确认 Java 可用，server.jar 首次启动后处理 eula.txt。',
      '核对双方 Minecraft 版本、模组、白名单和正版登录状态。',
      'Windows 防火墙放行 Java 或你的启动脚本。',
    ],
    preflightNotes: [
      '如果选择 server.jar，需要本机已经安装 Java，并能在命令行运行 java。',
      '首次启动 Minecraft 服务端通常会生成 eula.txt，需要你确认 eula=true 后再启动。',
      '如果你只是游戏内“开放到局域网”，请把端口改成游戏聊天框显示的端口，不要固定用 25565。',
    ],
    hostSteps: [
      '选择已有 server.jar 或你已经写好的启动脚本。',
      '确认 Java 可用，并已按 Mojang 要求处理 eula.txt。',
      '点击启动服务端，或手动启动后回到这里检测 TCP 端口。',
      '复制邀请给好友，好友在多人游戏里直接连接房主联机地址和端口。',
    ],
    joinSteps: [
      '先粘贴房主给的联机助手邀请包并加入同一组网。',
      '打开 Minecraft Java，进入多人游戏。',
      '选择直接连接，输入邀请里的房主联机地址和端口。',
      '如果失败，核对版本、模组、白名单、正版登录、防火墙和端口。',
    ],
  },
};

function parsePort(value: string, fallback: number) {
  const port = Number(value);
  return Number.isFinite(port) && port > 0 && port <= 65535 ? Math.round(port) : fallback;
}

function fileExtension(value: string) {
  const clean = value.trim().replace(/^['"]|['"]$/g, '');
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? '';
}

function buildPreflight(
  profile: OneClickServerProfile,
  serverPath: string,
  portText: string,
  minecraftEulaAccepted: boolean,
) {
  const items: OneClickPreflightItem[] = [];
  const pathValue = serverPath.trim();
  const port = Number(portText);
  const ext = fileExtension(pathValue);
  const allowed = ['exe', 'bat', 'cmd', 'jar'];

  if (!pathValue) {
    items.push({
      level: 'block',
      title: '还没选择服务端文件',
      detail: `请选择已有的 ${profile.serverFileLabel}。联机助手不会自动下载商业或官方服务端。`,
    });
  } else if (!allowed.includes(ext)) {
    items.push({
      level: 'block',
      title: '服务端文件类型不支持',
      detail: '当前 MVP 只托管 .exe / .bat / .cmd / .jar。请改选服务端程序或启动脚本。',
    });
  } else {
    items.push({
      level: 'ok',
      title: '服务端文件已填写',
      detail: '启动时后端会继续检查文件是否存在、工作目录是否可用。',
    });
  }

  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    items.push({
      level: 'block',
      title: '端口需要修正',
      detail: `请输入 1-65535 之间的端口。${profile.shortName} 常用端口是 ${profile.defaultPort}。`,
    });
  } else {
    items.push({
      level: 'ok',
      title: '端口格式正确',
      detail: `${profile.shortName} 将按 ${profile.protocol.toUpperCase()} ${Math.round(port)} 检测。`,
    });
  }

  if (profile.id === 'minecraft_java') {
    if (ext === 'jar') {
      items.push({
        level: 'warn',
        title: '需要确认 Java',
        detail: '选择 server.jar 时，需要本机 java 命令可用；如果启动失败，请先安装 Java 或改用启动脚本。',
      });
    }
    items.push({
      level: minecraftEulaAccepted ? 'ok' : 'warn',
      title: minecraftEulaAccepted ? 'EULA 已确认' : '首次启动可能需要处理 eula.txt',
      detail: minecraftEulaAccepted
        ? '你已确认 eula.txt；如果服务端仍退出，请查看服务端日志。'
        : 'Minecraft 服务端首次启动后通常会要求把 eula.txt 改成 eula=true。未确认时可以先启动一次生成文件。',
    });
  }

  if (profile.id === 'palworld') {
    items.push({
      level: 'warn',
      title: 'UDP 需要游戏内最终确认',
      detail: '联机助手能检查本机 UDP 监听线索，但好友能否进入仍以 Palworld 游戏内加入结果为准。',
    });
  }

  profile.preflightNotes.forEach((detail) => items.push({ level: 'warn', title: '开服提示', detail }));
  const blocker = items.find((item) => item.level === 'block');
  return {
    ok: !blocker,
    items,
    nextAction: blocker?.detail ?? '预检没有阻塞项。可以启动服务端，或手动启动后点击检测端口。',
  };
}

function inviteText(profile: OneClickServerProfile, port: number) {
  return [
    `[联机助手 ${profile.shortName} 联机邀请]`,
    '',
    `游戏：${profile.name}`,
    `路线：${profile.routeLabel}`,
    `端口：${profile.protocol.toUpperCase()} ${port}`,
    '房主联机地址：请使用联机助手邀请包里的房主地址或虚拟局域网地址',
    '',
    '房主步骤：',
    ...profile.hostSteps.map((item, index) => `${index + 1}. ${item}`),
    '',
    '加入者步骤：',
    ...profile.joinSteps.map((item, index) => `${index + 1}. ${item}`),
    '',
    '如果连接失败：复制诊断报告给房主，一起核对服务端是否仍在运行、端口是否一致、防火墙是否放行、双方游戏版本是否一致。',
  ].join('\n');
}

function diagnosticText(input: {
  profile: OneClickServerProfile;
  serverPath: string;
  port: number;
  args: string;
  preflight: ReturnType<typeof buildPreflight>;
  backendPreflight: GenericServerPreflightReport | null;
  serverStatus: ServerSessionStatus | null;
  portCheck: string;
}) {
  const { profile, serverPath, port, args, preflight, backendPreflight, serverStatus, portCheck } = input;
  return [
    `[联机助手 ${profile.shortName} 一键开服诊断]`,
    `生成时间：${new Date().toLocaleString()}`,
    `游戏：${profile.name}`,
    `路线：${profile.routeLabel}`,
    `服务端文件：${serverPath.trim() || '未填写'}`,
    `启动参数：${args.trim() || '未填写'}`,
    `端口：${profile.protocol.toUpperCase()} ${port}`,
    '',
    '预检：',
    ...preflight.items.map((item) => `- ${item.level.toUpperCase()} ${item.title}：${item.detail}`),
    `下一步：${preflight.nextAction}`,
    '',
    '后端预检：',
    backendPreflight
      ? `ok=${backendPreflight.ok}; can_start=${backendPreflight.can_start}; summary=${backendPreflight.summary}`
      : '尚未运行后端文件预检。',
    ...(backendPreflight?.checks.map((item) => `- ${item.level.toUpperCase()} ${item.label}：${item.detail}`) ?? []),
    '',
    '服务端状态：',
    serverStatus
      ? `running=${serverStatus.running}; ready=${serverStatus.ready}; pid=${serverStatus.pid ?? '-'}; message=${serverStatus.message || '-'}`
      : '尚未由本面板启动或刷新服务端状态。',
    `端口检测：${portCheck || '尚未检测'}`,
    '',
    '最近日志：',
    ...(serverStatus?.logs?.slice(-8) ?? ['无']),
  ].join('\n');
}

async function copyText(text: string) {
  const clipboard = navigator.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    await clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('剪贴板不可用');
  } finally {
    document.body.removeChild(textarea);
  }
}

export function ProductOneClickServerMvp({
  busy,
  setBusy,
  onTriggerToast,
  onNavigateTab,
}: ProductOneClickServerMvpProps) {
  const [gameId, setGameId] = useState<OneClickServerGameId>('palworld');
  const [serverPath, setServerPath] = useState('');
  const [portText, setPortText] = useState(String(ONE_CLICK_SERVER_PROFILES.palworld.defaultPort));
  const [argsText, setArgsText] = useState(ONE_CLICK_SERVER_PROFILES.palworld.defaultArgs);
  const [minecraftEulaAccepted, setMinecraftEulaAccepted] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerSessionStatus | null>(null);
  const [backendPreflight, setBackendPreflight] = useState<GenericServerPreflightReport | null>(null);
  const [portCheck, setPortCheck] = useState('');

  const profile = ONE_CLICK_SERVER_PROFILES[gameId];
  const parsedPort = parsePort(portText, profile.defaultPort);
  const preflight = useMemo(
    () => buildPreflight(profile, serverPath, portText, minecraftEulaAccepted),
    [minecraftEulaAccepted, portText, profile, serverPath],
  );

  const switchGame = (next: OneClickServerGameId) => {
    const nextProfile = ONE_CLICK_SERVER_PROFILES[next];
    setGameId(next);
    setPortText(String(nextProfile.defaultPort));
    setArgsText(nextProfile.defaultArgs);
    setServerStatus(null);
    setBackendPreflight(null);
    setPortCheck('');
    onTriggerToast(`已切换到 ${nextProfile.shortName} 开服闭环。`);
  };

  useEffect(() => {
    const isOneClickServerGameId = (value: string | undefined): value is OneClickServerGameId =>
      value === 'palworld' || value === 'minecraft_java';
    const applyProfileRoute = (detail: { profileId: OneClickServerGameId; reason?: string } | null) => {
      if (!detail) return;
      const nextProfile = ONE_CLICK_SERVER_PROFILES[detail.profileId];
      if (!nextProfile) return;
      setGameId(detail.profileId);
      setPortText(String(nextProfile.defaultPort));
      setArgsText(nextProfile.defaultArgs);
      setServerStatus(null);
      setBackendPreflight(null);
      setPortCheck('');
      onTriggerToast(detail.reason || `已按分类入口切换到 ${nextProfile.shortName} 开服向导。`);
    };

    const pendingRoute = consumeOneClickServerProfileRoute();
    if (isOneClickServerGameId(pendingRoute?.profileId)) {
      applyProfileRoute({ profileId: pendingRoute.profileId, reason: pendingRoute.reason });
    }
    const onProfileRoute = (event: Event) => {
      const detail = (event as CustomEvent<{ profileId?: string; reason?: string }>).detail;
      if (isOneClickServerGameId(detail?.profileId)) {
        applyProfileRoute({ profileId: detail.profileId, reason: detail.reason });
      }
    };
    window.addEventListener(ONE_CLICK_SERVER_PROFILE_EVENT, onProfileRoute);
    return () => window.removeEventListener(ONE_CLICK_SERVER_PROFILE_EVENT, onProfileRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyInvite = async () => {
    try {
      await copyText(inviteText(profile, parsedPort));
      onTriggerToast(`${profile.shortName} 邀请说明已复制。`);
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const copyDiagnostic = async () => {
    try {
      await copyText(diagnosticText({
        profile,
        serverPath,
        port: parsedPort,
        args: argsText,
        preflight,
        backendPreflight,
        serverStatus,
        portCheck,
      }));
      onTriggerToast(`${profile.shortName} 开服诊断已复制。`);
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const refreshStatus = async () => {
    setBusy('刷新服务端状态');
    try {
      const status = await readServerSession();
      setServerStatus(status);
      onTriggerToast(status.running ? '服务端状态已刷新：正在运行。' : '服务端状态已刷新：未运行。');
    } catch (error) {
      onTriggerToast(`刷新服务端状态失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const runBackendPreflight = async () => {
    setBusy(`检查 ${profile.shortName} 服务端文件`);
    try {
      const report = await preflightGenericServerSession({
        game_name: profile.name,
        executable_path: serverPath.trim(),
        port: parsedPort,
        raw_args: argsText.trim() || null,
        jar_memory_mb: profile.id === 'minecraft_java' ? profile.recommendedMemoryMb ?? 2048 : null,
      });
      setBackendPreflight(report);
      onTriggerToast(report.summary);
      return report;
    } catch (error) {
      const message = `后端预检失败：${error instanceof Error ? error.message : String(error)}`;
      setBackendPreflight({
        ok: false,
        can_start: false,
        executable_path: serverPath.trim(),
        executable_kind: 'unknown',
        port: parsedPort,
        summary: message,
        checks: [{ id: 'backend_preflight_error', level: 'block', label: '后端预检失败', detail: message }],
      });
      onTriggerToast(message);
      return null;
    } finally {
      setBusy('');
    }
  };

  const startManagedServer = async () => {
    if (!preflight.ok) {
      onTriggerToast(`还不能启动：${preflight.nextAction}`);
      return;
    }
    const report = await runBackendPreflight();
    if (!report?.can_start) {
      onTriggerToast(report?.summary || '后端预检未通过，暂不启动服务端。');
      return;
    }
    setBusy(`启动 ${profile.shortName} 服务端`);
    try {
      const status = await startGenericServerSession({
        game_name: profile.name,
        executable_path: serverPath.trim(),
        port: parsedPort,
        raw_args: argsText.trim() || null,
        jar_memory_mb: profile.id === 'minecraft_java' ? profile.recommendedMemoryMb ?? 2048 : null,
      });
      setServerStatus(status);
      onTriggerToast(status.running ? `${profile.shortName} 服务端已启动，继续检测端口。` : `服务端启动返回：${status.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setServerStatus(null);
      setPortCheck(`启动失败：${message}`);
      onTriggerToast(`启动服务端失败：${message}`);
    } finally {
      setBusy('');
    }
  };

  const testPort = async () => {
    setBusy(`检测 ${profile.shortName} 端口`);
    try {
      const report = await testConnectivity({
        host: '127.0.0.1',
        ports: [parsedPort],
        protocol: profile.protocol,
        mode: 'local_game_port',
        timeout_ms: 1800,
      });
      const portLine = report.ports.map((item) => `${item.port}=${item.reachable ? '可用' : item.error || '未监听'}`).join('；');
      const summary = report.reachable
        ? `已检测到本机 ${profile.protocol.toUpperCase()} ${parsedPort} 可用。${portLine}`
        : `暂未确认端口可用。${portLine || '请确认服务端已启动且端口一致。'}`;
      setPortCheck(summary);
      onTriggerToast(summary);
    } catch (error) {
      const message = `端口检测失败：${error instanceof Error ? error.message : String(error)}`;
      setPortCheck(message);
      onTriggerToast(message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-one-click-server-roadmap="v031-mvp" tabIndex={-1}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">一键开服向导</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">更多游戏马上呈现</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">不自动下载服务端</span>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700">本机预检 ≠ 游戏内通过</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">Palworld / Minecraft 开服闭环</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            先把最容易卡住的两类服务端做成普通用户能照着走的闭环：选择已有服务端文件，做启动前检查，启动或手动启动后检测端口，再复制邀请和诊断。未实测的游戏不会标成“已通过”。
          </p>
          <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/80 p-3 text-xs leading-relaxed text-sky-900">
            <p className="font-bold">当前这块先帮你少走弯路，不伪装成已经实机通过。</p>
            <p className="mt-1">
              “检查文件”和“启动服务端”只能证明本机文件、进程和端口线索；最终能不能联机，仍要以好友在游戏里成功加入为准。完成真实回归前，按钮和卡片只显示“待实机验证”。
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(Object.values(ONE_CLICK_SERVER_PROFILES) as OneClickServerProfile[]).map((item) => {
              const active = item.id === gameId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchGame(item.id)}
                  className={`rounded-2xl border p-4 text-left transition ${active ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-black ${active ? 'text-white' : 'text-slate-900'}`}>{item.name}</p>
                      <p className={`mt-1 text-xs leading-relaxed ${active ? 'text-slate-200' : 'text-slate-600'}`}>{item.statusLabel}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${active ? 'bg-white text-slate-900' : 'bg-white text-slate-600'}`}>{item.badge}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.routeTags.map((tag) => (
                      <span key={tag} className={`rounded-full px-2 py-1 text-[10px] font-bold ${active ? 'bg-white/15 text-white' : 'bg-white text-slate-500'}`}>{tag}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{profile.shortName} 启动前检查</h4>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">{profile.routeLabel}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${preflight.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                {preflight.ok ? '可尝试启动' : '还有阻塞项'}
              </span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
              <label className="text-[11px] font-bold text-slate-600">
                {profile.serverFileLabel}
                <input
                  value={serverPath}
                  onChange={(event) => setServerPath(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-400"
                  placeholder={profile.fileHint}
                />
              </label>
              <label className="text-[11px] font-bold text-slate-600">
                游戏端口
                <input
                  value={portText}
                  onChange={(event) => setPortText(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-400"
                  placeholder={String(profile.defaultPort)}
                />
              </label>
              <label className="text-[11px] font-bold text-slate-600 lg:col-span-2">
                启动参数，可留空
                <input
                  value={argsText}
                  onChange={(event) => setArgsText(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-slate-400"
                  placeholder={profile.defaultArgs || '可留空'}
                />
              </label>
              {profile.id === 'minecraft_java' ? (
                <label className="flex items-start gap-2 rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs leading-relaxed text-amber-900 lg:col-span-2">
                  <input
                    type="checkbox"
                    checked={minecraftEulaAccepted}
                    onChange={(event) => setMinecraftEulaAccepted(event.target.checked)}
                    className="mt-1"
                  />
                  <span>我已确认 Minecraft 服务端 EULA。首次启动如果退出，请到服务端目录把 eula.txt 改成 eula=true 后再启动。</span>
                </label>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs leading-relaxed text-slate-600">
                <p className="font-bold text-slate-900">需要准备</p>
                <p className="mt-1">{profile.fileTypes.join(' / ')}</p>
                <p className="mt-1 text-[11px] text-slate-500">{profile.configFiles.join('；')}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs leading-relaxed text-slate-600">
                <p className="font-bold text-slate-900">端口检测说明</p>
                <p className="mt-1">{profile.portCheckHint}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs leading-relaxed text-slate-600">
                <p className="font-bold text-slate-900">邀请怎么填</p>
                <p className="mt-1">{profile.inviteAddressHint}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {preflight.items.slice(0, 6).map((item) => (
                <div
                  key={`${item.title}-${item.detail}`}
                  className={`rounded-xl border p-3 text-xs leading-relaxed ${item.level === 'ok' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : item.level === 'block' ? 'border-rose-100 bg-rose-50 text-rose-800' : 'border-amber-100 bg-amber-50 text-amber-900'}`}
                >
                  <p className="font-bold">{item.title}</p>
                  <p className="mt-1">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={startManagedServer} disabled={Boolean(busy) || !preflight.ok} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
                <Server className="h-4 w-4" />启动服务端
              </button>
              <button onClick={testPort} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" />检测端口
              </button>
              <button onClick={runBackendPreflight} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" />检查文件
              </button>
              <button onClick={refreshStatus} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw className="h-4 w-4" />刷新状态
              </button>
              <button onClick={copyInvite} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                <ClipboardCopy className="h-4 w-4" />复制邀请
              </button>
              <button onClick={copyDiagnostic} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50">
                <ClipboardCopy className="h-4 w-4" />复制诊断
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-white p-3 text-xs text-slate-600">
                服务端状态<br />
                <span className="font-bold text-slate-900">{serverStatus ? (serverStatus.running ? '运行中' : '未运行') : '未刷新'}</span>
              </div>
              <div className="rounded-xl bg-white p-3 text-xs text-slate-600">
                端口检测<br />
                <span className="font-bold text-slate-900">{portCheck || '尚未检测'}</span>
              </div>
              <div className="rounded-xl bg-white p-3 text-xs text-slate-600">
                下一步<br />
                <span className="font-bold text-slate-900">{preflight.nextAction}</span>
              </div>
            </div>
            {backendPreflight ? (
              <div className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${backendPreflight.can_start ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-rose-100 bg-rose-50 text-rose-800'}`}>
                <p className="font-bold">{backendPreflight.can_start ? '后端预检通过' : '后端预检未通过'}</p>
                <p className="mt-1">{backendPreflight.summary}</p>
                <ul className="mt-2 space-y-1">
                  {backendPreflight.checks.slice(0, 5).map((item) => (
                    <li key={item.id}>• {item.label}：{item.detail}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <details className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
              <summary className="cursor-pointer text-xs font-bold text-slate-800">失败时先查什么</summary>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
                {profile.repairSuggestions.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </details>
          </div>
        </div>

        <aside className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <h4 className="text-sm font-bold text-slate-900">后续游戏扩展方式</h4>
          <p className="mt-2 text-xs leading-relaxed text-amber-900">
            以后新增游戏不再另做散乱入口，而是补一个开服档案：服务端文件、默认端口、协议、启动参数、预检项、端口检测和邀请模板。
          </p>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-amber-900">
            <li>• Palworld：优先验证 UDP 8211 和游戏内加入。</li>
            <li>• Minecraft：优先验证 Java、eula.txt、TCP 25565 或游戏显示端口。</li>
            <li>• Stardew / Cuphead：保持远程同屏或原生邀请边界，不误标为一键开服。</li>
          </ul>
          <button
            onClick={() => onNavigateTab?.('protocol')}
            className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            去开房邀请
          </button>
        </aside>
      </div>
    </section>
  );
}
