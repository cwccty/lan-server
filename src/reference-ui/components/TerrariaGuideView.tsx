import { useState, useEffect, useRef } from 'react';
import { TERRARIA_WORLDS } from '../data';
import {
  Wand2,
  Server,
  Play,
  Square,
  Activity,
  Copy,
  ChevronDown,
  Terminal,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import {
  readServerSession,
  sendServerCommand,
  startGameServerSession,
  stopServerSession,
  testConnectivity
} from '../../api/tauri';
import type { ServerSessionStatus } from '../../types/serverSession';

interface TerrariaGuideViewProps {
  onTriggerToast: (msg: string) => void;
  terrariaWorld: string;
  terrariaPort: number;
  terrariaPasswordInput: string;
  terrariaMaxPlayers: number;
  terrariaRunning: boolean;
  terrariaLogs: string[];
  onUpdateState: (key: string, value: any) => void;
  localIp: string;
}

export default function TerrariaGuideView({
  onTriggerToast,
  terrariaWorld,
  terrariaPort,
  terrariaPasswordInput,
  terrariaMaxPlayers,
  terrariaRunning,
  terrariaLogs,
  onUpdateState,
  localIp
}: TerrariaGuideViewProps) {
  const [role, setRole] = useState<'host' | 'joiner'>('host');
  const [showPassword, setShowPassword] = useState(false);
  const [logs, setLogs] = useState<string[]>(terrariaLogs);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const [consoleInput, setConsoleInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerSessionStatus | null>(null);

  const applyServerStatus = (status: ServerSessionStatus) => {
    setServerStatus(status);
    setLogs(status.logs);
    onUpdateState('terrariaRunning', status.running);
    onUpdateState('terrariaLogs', status.logs);
  };

  const refreshServerStatus = async (showToast = false) => {
    try {
      const status = await readServerSession();
      applyServerStatus(status);
      if (showToast) onTriggerToast(status.message || '已刷新 Terraria 服务端状态。');
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '读取 Terraria 服务端状态失败'));
    }
  };

  const handleSendConsoleCommand = async () => {
    const cmd = consoleInput.trim();
    if (!cmd) return;

    if (!terrariaRunning) {
      onTriggerToast('请先激活启动泰拉服主服务器，再运行服务端控制台命令！');
      return;
    }

    try {
      setIsBusy(true);
      const status = await sendServerCommand(cmd);
      applyServerStatus(status);
      onTriggerToast(status.message || '命令已发送。若后台模式没有 stdin，日志会显示原因。');
      setConsoleInput('');
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '发送服务端命令失败'));
    } finally {
      setIsBusy(false);
    }
  };

  // Auto-scroll the terminal console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    void refreshServerStatus(false);
    const timer = window.setInterval(() => void refreshServerStatus(false), 3000);
    return () => window.clearInterval(timer);
  }, []);

  const handleStartServer = async () => {
    if (terrariaRunning) {
      onTriggerToast('泰拉服务器已在后台稳定运行。');
      return;
    }

    try {
      setIsBusy(true);
      onTriggerToast('正在后台启动 Terraria 服务端，不会弹出白色命令框...');
      const status = await startGameServerSession('terraria', 'server', {
        world_choice: 1,
        port: terrariaPort,
        password: terrariaPasswordInput,
        max_players: terrariaMaxPlayers,
        auto_forward: false
      });
      applyServerStatus(status);
      onTriggerToast(status.message || 'Terraria 服务端已提交后台启动。');
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '启动 Terraria 服务端失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleStopServer = async () => {
    if (!terrariaRunning) {
      onTriggerToast('服务器尚未运行。');
      return;
    }
    try {
      setIsBusy(true);
      const status = await stopServerSession();
      applyServerStatus(status);
      onTriggerToast(status.message || 'Terraria 服务端已停止。');
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '停止 Terraria 服务端失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSelfCheck = async () => {
    onTriggerToast('正在进行真实端口检测...');
    try {
      setIsBusy(true);
      const report = await testConnectivity({
        host: localIp || '127.0.0.1',
        ports: [terrariaPort],
        timeout_ms: 1200,
        mode: 'local_game_port'
      });
      const noteLines = [
        `[Diagnostic] ${new Date().toLocaleTimeString()} - 目标：${report.target_host}:${terrariaPort}`,
        `[Diagnostic] - 端口检测：${report.reachable ? '可达' : '不可达'}`,
        ...report.ports.map((item) => `[Diagnostic] - port ${item.port}: ${item.reachable ? `reachable ${item.latency_ms ?? ''}ms` : item.error || 'failed'}`),
        ...report.notes.map((note) => `[Diagnostic] - ${note}`)
      ];
      setLogs((prev) => {
        const next = [...prev, ...noteLines];
        onUpdateState('terrariaLogs', next);
        return next;
      });
      onTriggerToast(report.reachable ? '真实端口检测通过。' : '端口暂不可达，请查看诊断报告或确认服务端是否已经 ready。');
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || 'Terraria 自检失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const clearLogsConsole = () => {
    setLogs([]);
    onUpdateState('terrariaLogs', []);
    onTriggerToast('终端屏幕已清空。');
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-amber-500" />
            Terraria 联机向导
          </h2>
          <p className="font-sans text-sm text-slate-500 mt-1">一键配对泰拉瑞亚服务器与虚拟组网，打通大型Mod联机高墙。</p>
        </div>
        
        {/* Role Selector */}
        <div className="bg-slate-100 p-1 rounded-lg border border-slate-200/60 flex items-center shadow-sm w-fit font-sans text-xs">
          <button
            onClick={() => { setRole('host'); onTriggerToast('已切换至 [我是服主]'); }}
            className={`px-4 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              role === 'host' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            我是服主
          </button>
          <button
            onClick={() => { setRole('joiner'); onTriggerToast('已切换至 [我是玩家]'); }}
            className={`px-4 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              role === 'joiner' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            我是玩家
          </button>
        </div>
      </div>

      {role === 'host' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Left Column: Form setup */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Base Server Config */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <Server className="w-5 h-5 text-amber-500" />
                <h3 className="font-heading text-sm font-bold text-slate-800">服务器基础配置</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* World map selection dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="font-sans text-xs text-slate-400 font-medium">选择要开启的世界地图</label>
                  <div className="relative">
                    <select
                      value={terrariaWorld}
                      onChange={(e) => onUpdateState('terrariaWorld', e.target.value)}
                      className="w-full bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white text-slate-700 rounded-lg px-4 py-2.5 font-sans text-xs outline-none cursor-pointer appearance-none pr-10"
                    >
                      {TERRARIA_WORLDS.map((w, index) => (
                        <option key={index} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Port */}
                <div className="flex flex-col gap-1">
                  <label className="font-sans text-xs text-slate-400 font-medium">服务物理端口 (Port)</label>
                  <input
                    type="number"
                    value={terrariaPort}
                    onChange={(e) => onUpdateState('terrariaPort', parseInt(e.target.value) || 7777)}
                    className="w-full bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white text-slate-700 rounded-lg px-4 py-2.5 font-sans text-xs font-semibold outline-none transition-all font-mono"
                  />
                </div>

                {/* Password entry */}
                <div className="flex flex-col gap-1">
                  <label className="font-sans text-xs text-slate-400 font-medium">进入加密锁 (选填 / 防止被炸图)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={terrariaPasswordInput}
                      onChange={(e) => onUpdateState('terrariaPasswordInput', e.target.value)}
                      placeholder="留空代表无锁，任何人都可接入"
                      className="w-full bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white text-slate-700 rounded-lg pl-4 pr-10 py-2.5 font-sans text-xs outline-none transition-all"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Max players */}
                <div className="flex flex-col gap-1">
                  <label className="font-sans text-xs text-slate-400 font-medium">最大玩家承载额</label>
                  <input
                    type="number"
                    value={terrariaMaxPlayers}
                    onChange={(e) => onUpdateState('terrariaMaxPlayers', parseInt(e.target.value) || 8)}
                    className="w-full bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white text-slate-700 rounded-lg px-4 py-2.5 font-sans text-xs outline-none transition-all font-mono"
                    min="2"
                    max="255"
                  />
                </div>

              </div>
            </div>

            {/* n2n Config Subset */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                <Sliders className="w-5 h-5 text-amber-500" />
                <h3 className="font-heading text-sm font-bold text-slate-800">虚拟局域网 (n2n) 高级开服调优</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-sans text-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-medium">中继 Supernode 节点选择</label>
                  <select className="w-full bg-slate-50/50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 outline-none cursor-pointer">
                    <option>自适应分配 (延迟最优 - 推荐)</option>
                    <option>cn-beijing.n2n.helper:7654 (北京联通)</option>
                    <option>cn-shanghai.n2n.helper:7654 (上海电信)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-medium">局域网 IP 自主分配模式</label>
                  <select className="w-full bg-slate-50/50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 outline-none cursor-pointer">
                    <option>DHCP (自动极速下发地址)</option>
                    <option>静态指定</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Actions controls & Status info */}
          <div className="lg:col-span-4 flex flex-col gap-6 font-sans">
            
            {/* Control Panel */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
              <h3 className="font-heading text-slate-800 font-bold text-sm">开服控制台</h3>
              
              <button
                onClick={handleStartServer}
                disabled={isBusy}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBusy ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Play className="w-4 h-4 fill-current text-white" />}
                {isBusy ? '正在处理...' : '启动自建服务'}
              </button>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleStopServer}
                  disabled={isBusy}
                  className="py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer bg-white disabled:opacity-50"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  停止服务
                </button>
                <button
                  onClick={handleSelfCheck}
                  disabled={isBusy}
                  className="py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer bg-white disabled:opacity-50"
                >
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                  一键自检
                </button>
              </div>

              <div className="w-full h-px bg-slate-100 my-2" />

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">好友直连联机码</span>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-hidden shadow-inner">
                  <span className="font-mono text-xs text-slate-500 truncate pl-1 flex-1">tr-connect://terraria_world_gaming_night</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('tr-connect://terraria_world_gaming_night');
                      onTriggerToast('局域网直连联机码已成功复制到剪贴板！');
                    }}
                    className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500 text-amber-800 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                    title="复制联机码"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Network Status Info */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-heading text-sm font-bold text-slate-800 mb-4">并网链路状态</h3>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${terrariaRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                <span className="text-xs text-slate-700 font-semibold">
                      {terrariaRunning ? (serverStatus?.ready ? '服务端端口已监听' : '服务端启动中') : '服务端未运行'}
                    </span>
                  </div>
                  <span className="font-sans text-xs font-bold text-slate-500">{localIp || '10.0.0.1'}</span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${serverStatus?.ready ? 'bg-amber-500 w-full' : terrariaRunning ? 'bg-amber-500 w-1/2' : 'bg-slate-200 w-0'}`}
                  />
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 mt-4 pt-4 border-t border-slate-100 font-mono">
                <span>运行时长: {serverStatus?.uptime_seconds ? `${serverStatus.uptime_seconds}s` : '--'}</span>
                <span>PID: {serverStatus?.pid || '--'}</span>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* Player / Joiner View screen */
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-w-xl">
          <h3 className="font-heading text-slate-800 font-bold text-sm mb-2">一键加入好友的主机服务器</h3>
          <p className="font-sans text-xs text-slate-400 mb-6">您无需充当服主，直接在下方粘贴好友发送给您的“直连联机码”或“邀请密信”一键拼合世界！</p>
          
          <div className="space-y-4 font-sans text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 pl-1">输入或粘贴联机码</label>
              <textarea
                rows={3}
                placeholder="例如粘贴：tr-connect://dGVzdGdyb3VwMTMyNDp..."
                className="w-full bg-slate-50/50 border border-slate-200 focus:border-amber-500 rounded-lg p-3 outline-none focus:ring-1 focus:ring-amber-500/20 font-mono tracking-tight"
              />
            </div>
            <button
              onClick={() => {
                onTriggerToast('加入端第一版不会伪造连接成功：请先用邀请包内的 n2n 参数启动组网，再用好友虚拟 IP 进入游戏。');
              }}
              className="px-6 py-2.5 bg-amber-500 text-amber-950 hover:bg-amber-450 rounded-lg font-bold transition-all shadow-sm cursor-pointer"
            >
              一键并网开始游戏
            </button>
          </div>
        </div>
      )}

      {/* Embedded Live Logger Console Terminal */}
      <div className="bg-slate-900 rounded-2xl overflow-hidden flex flex-col mt-auto border border-slate-800/80 shadow-md">
        <div className="bg-slate-950 flex items-center justify-between px-4 py-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
            <span className="font-mono text-xs text-slate-400">运行日志实时监视屏 (Game Server Terminal Output)</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearLogsConsole}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              title="清除屏幕"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        <div className="p-4 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed text-[#A9B1D6] scroll-smooth space-y-1">
          {logs.length === 0 ? (
            <p className="text-slate-500 text-center py-12">控制台为空。开启并网开服服务后将在此处实时透出世界渲染运行日志...</p>
          ) : (
            logs.map((line, index) => {
              let lineClass = 'text-[#C0CAF5]';
              if (line.includes('[Warn]')) lineClass = 'text-amber-400 opacity-90';
              if (line.includes('[Server]')) lineClass = 'text-[#BB9AF7]';
              if (line.includes('[Diagnostic]')) lineClass = 'text-teal-400';
              if (line.includes('[Console Input]')) lineClass = 'text-amber-500 font-bold';
              return (
                <div key={index} className={`font-mono text-xs ${lineClass}`}>
                  {line}
                </div>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </div>

        {/* Command Input Console bar */}
        <div className="bg-slate-950 border-t border-slate-800/80 px-4 py-2 flex items-center gap-2">
          <span className="font-mono text-xs text-amber-500 font-bold">&gt;_</span>
          <input
            type="text"
            value={consoleInput}
            onChange={(e) => setConsoleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendConsoleCommand();
            }}
            placeholder="输入服务端指令 help, save, exit 或广播 msg [内容] ..."
            className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-700 text-xs font-mono outline-none border-none pl-1"
          />
          <button
            type="button"
            onClick={handleSendConsoleCommand}
            disabled={isBusy}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold rounded text-[11px] font-sans transition-colors cursor-pointer disabled:opacity-50"
          >
            执行命令
          </button>
        </div>
      </div>
    </div>
  );
}
