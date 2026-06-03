import { useEffect, useState, FormEvent } from 'react';
import {
  Settings,
  HelpCircle,
  Play,
  Square,
  RefreshCw,
  Cpu,
  Info,
  Save,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  getN2nDiagnostics,
  listPortProxies,
  listUdpBroadcastBridges,
  listUdpProxies,
  setupNetwork,
  startNetwork,
  startPortProxy,
  startUdpBroadcastBridge,
  startUdpProxy,
  stopNetwork,
  stopPortProxy,
  stopUdpBroadcastBridge,
  stopUdpProxy
} from '../../api/tauri';
import type { N2nDiagnostics, NetworkConfig } from '../../types/network';
import type { PortProxyStatus } from '../../types/portProxy';
import type { UdpProxyStatus } from '../../types/udpProxy';
import type { UdpBroadcastBridgeStatus } from '../../types/udpBroadcastBridge';

interface UniversalNetworkViewProps {
  onTriggerToast: (msg: string) => void;
  roomName: string;
  roomKey: string;
  supernode: string;
  virtualIpInput: string;
  gamePort: string;
  tcpProxy: boolean;
  udpProxy: boolean;
  udpBroadcastBridge: boolean;
  onUpdateState: (key: string, value: any) => void;
}

export default function UniversalNetworkView({
  onTriggerToast,
  roomName,
  roomKey,
  supernode,
  virtualIpInput,
  gamePort,
  tcpProxy,
  udpProxy,
  udpBroadcastBridge,
  onUpdateState
}: UniversalNetworkViewProps) {
  const [n2nDiagnostics, setN2nDiagnostics] = useState<N2nDiagnostics | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Feature 4: TCP proxy config rules list
  const [tcpRules, setTcpRules] = useState<Array<{id: string, listen: string, targetIp: string, targetPort: string, running?: boolean, lastError?: string}>>([]);
  const [tcpInput, setTcpInput] = useState({ listen: '', targetIp: '10.0.8.10', targetPort: '' });

  // Feature 5: UDP proxy config rules list
  const [udpRules, setUdpRules] = useState<Array<{id: string, listen: string, targetIp: string, targetPort: string, running?: boolean, lastError?: string}>>([]);
  const [udpInput, setUdpInput] = useState({ listen: '', targetIp: '10.0.8.10', targetPort: '' });
  const [broadcastRules, setBroadcastRules] = useState<UdpBroadcastBridgeStatus[]>([]);

  // Feature 6: UDP broadcast bridge custom inputs
  const [broadcastConfig, setBroadcastConfig] = useState({
    targetRange: '10.0.8.255',
    adapter: 'TAP-Windows Virtual Device V9 (10.0.8.1)',
    rateLimit: '350'
  });

  const isRunning = Boolean(n2nDiagnostics?.running);
  const n2nSummary = n2nDiagnostics?.summary || '尚未读取真实 n2n 状态。';

  const splitEndpoint = (value: string) => {
    const idx = value.lastIndexOf(':');
    if (idx < 0) return { host: value, port: '' };
    return { host: value.slice(0, idx), port: value.slice(idx + 1) };
  };

  const mapTcpStatus = (status: PortProxyStatus) => {
    const listen = splitEndpoint(status.listen);
    const target = splitEndpoint(status.target);
    return {
      id: status.id,
      listen: listen.port,
      targetIp: target.host,
      targetPort: target.port,
      running: status.running,
      lastError: status.last_error
    };
  };

  const mapUdpStatus = (status: UdpProxyStatus) => {
    const listen = splitEndpoint(status.listen);
    const target = splitEndpoint(status.target);
    return {
      id: status.id,
      listen: listen.port,
      targetIp: target.host,
      targetPort: target.port,
      running: status.running,
      lastError: status.last_error
    };
  };

  const refreshNetworkPanel = async (showToast = false) => {
    try {
      const [diagnostics, tcpStatuses, udpStatuses, bridgeStatuses] = await Promise.all([
        getN2nDiagnostics().catch(() => null),
        listPortProxies().catch(() => []),
        listUdpProxies().catch(() => []),
        listUdpBroadcastBridges().catch(() => [])
      ]);
      setN2nDiagnostics(diagnostics);
      setTcpRules(tcpStatuses.filter((item) => item.protocol === 'tcp').map(mapTcpStatus));
      setUdpRules(udpStatuses.map(mapUdpStatus));
      setBroadcastRules(bridgeStatuses);
      if (showToast) onTriggerToast(diagnostics?.summary || '已刷新真实组网状态。');
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '刷新组网状态失败'));
    }
  };

  useEffect(() => {
    void refreshNetworkPanel(false);
  }, []);

  const handleAddTcpRule = async (e: FormEvent) => {
    e.preventDefault();
    if (!tcpInput.listen || !tcpInput.targetIp || !tcpInput.targetPort) {
      onTriggerToast('请完整输入 TCP 监听端口、目标IP及转发端口！');
      return;
    }
    try {
      setIsBusy(true);
      const status = await startPortProxy({
        protocol: 'tcp',
        listen_host: '127.0.0.1',
        listen_port: Number(tcpInput.listen),
        target_host: tcpInput.targetIp,
        target_port: Number(tcpInput.targetPort),
        label: 'reference-ui tcp proxy'
      });
      onTriggerToast(status.running ? `TCP 端口代理已启动：${status.listen} -> ${status.target}` : `TCP 端口代理未能启动：${status.last_error || '请查看诊断报告'}`);
      setTcpInput({ listen: '', targetIp: '10.0.8.10', targetPort: '' });
      await refreshNetworkPanel(false);
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '启动 TCP 端口代理失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteTcpRule = async (id: string, listen: string) => {
    try {
      setIsBusy(true);
      await stopPortProxy(id);
      onTriggerToast(`已停止 TCP 映射端口：${listen}`);
      await refreshNetworkPanel(false);
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '停止 TCP 端口代理失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddUdpRule = async (e: FormEvent) => {
    e.preventDefault();
    if (!udpInput.listen || !udpInput.targetIp || !udpInput.targetPort) {
      onTriggerToast('请完整输入 UDP 监听端口、目标IP及转发端口！');
      return;
    }
    try {
      setIsBusy(true);
      const status = await startUdpProxy({
        listen_host: '0.0.0.0',
        listen_port: Number(udpInput.listen),
        target_host: udpInput.targetIp,
        target_port: Number(udpInput.targetPort),
        label: 'reference-ui udp proxy'
      });
      onTriggerToast(status.running ? `UDP 端口代理已启动：${status.listen} -> ${status.target}` : `UDP 端口代理未能启动：${status.last_error || '请查看诊断报告'}`);
      setUdpInput({ listen: '', targetIp: '10.0.8.10', targetPort: '' });
      await refreshNetworkPanel(false);
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '启动 UDP 端口代理失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteUdpRule = async (id: string, listen: string) => {
    try {
      setIsBusy(true);
      await stopUdpProxy(id);
      onTriggerToast(`已停止 UDP 分发端口绑定：${listen}`);
      await refreshNetworkPanel(false);
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '停止 UDP 端口代理失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleApplyBroadcastConfig = async () => {
    try {
      setIsBusy(true);
      const port = Number(gamePort || '7777');
      const status = await startUdpBroadcastBridge({
        listen_host: '0.0.0.0',
        listen_port: Number.isFinite(port) ? port : 7777,
        forward_targets: [broadcastConfig.targetRange],
        label: 'reference-ui udp broadcast bridge',
        allow_broadcast: true,
        duplicate_ttl_ms: Number(broadcastConfig.rateLimit || '350')
      });
      onTriggerToast(status.running ? `UDP 广播桥已启动：${status.listen} -> ${status.forward_targets.join(', ')}` : `UDP 广播桥未能启动：${status.last_error || '请查看诊断报告'}`);
      await refreshNetworkPanel(false);
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '启动 UDP 广播桥失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartEdge = async () => {
    if (isRunning) {
      onTriggerToast('n2n Edge 并网核心已经在运行中。');
      return;
    }
    const config: NetworkConfig = {
      room_name: roomName,
      secret: roomKey,
      supernode,
      local_ip: virtualIpInput
    };
    if (!config.room_name || !config.secret || !config.supernode || !config.local_ip) {
      onTriggerToast('请先填写 Room、Key、Supernode 和本机虚拟 IP，再启动 n2n Edge。');
      return;
    }
    try {
      setIsBusy(true);
      onTriggerToast('正在保存配置并启动 n2n Edge...');
      await setupNetwork('n2n', config);
      const status = await startNetwork('n2n');
      onTriggerToast(status.message || 'n2n Edge 已启动，等待 supernode ACK/PONG。');
      await refreshNetworkPanel(false);
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '启动 n2n Edge 失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleStopEdge = async () => {
    if (!isRunning) {
      onTriggerToast('n2n Edge 已经处于停止断网状态。');
      return;
    }
    try {
      setIsBusy(true);
      const status = await stopNetwork('n2n');
      onTriggerToast(status.message || '已停止 n2n 虚拟并网网络。');
      await refreshNetworkPanel(false);
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '停止 n2n Edge 失败'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveConfig = async () => {
    const config: NetworkConfig = {
      room_name: roomName,
      secret: roomKey,
      supernode,
      local_ip: virtualIpInput
    };
    if (!config.room_name || !config.secret || !config.supernode || !config.local_ip) {
      onTriggerToast('保存失败：Room、Key、Supernode、本机虚拟 IP 都不能为空。');
      return;
    }
    try {
      setIsBusy(true);
      const result = await setupNetwork('n2n', config);
      onTriggerToast(result.message || '基础联机参数已保存到真实 n2n 配置。');
      await refreshNetworkPanel(false);
    } catch (error) {
      onTriggerToast(error instanceof Error ? error.message : String(error || '保存 n2n 配置失败'));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-800">通用组网中心</h2>
        <p className="font-sans text-sm text-slate-500 mt-1">配置并管理 n2n 核心虚拟局域网络组网中叠和内网映射。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Status panel & Actions */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Status Panel Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center h-[200px] relative overflow-hidden">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {isRunning ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-sans text-[11px] text-emerald-700 font-bold">已连接</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300" />
                  </span>
                  <span className="font-sans text-[11px] text-slate-400 font-semibold">已下线</span>
                </>
              )}
            </div>

            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-4 shadow-sm">
              <Cpu className={`w-6 h-6 ${isRunning ? 'animate-pulse' : ''}`} />
            </div>
            
            <h3 className="font-heading text-base font-bold text-slate-800">
              {isRunning ? 'n2n Edge 并网核心运行中' : 'n2n Edge 处于离线状态'}
            </h3>
            
            {isRunning && (
              <p className="font-sans text-xs text-slate-400 mt-2 flex items-center gap-1 font-mono">
                {n2nDiagnostics?.ok_link ? 'Supernode 已确认' : '等待真实握手'} |
                <span className="text-slate-600 font-bold ml-1">{n2nSummary}</span>
              </p>
            )}
          </div>

          {/* Action List Buttons */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-2">
            <button
              onClick={handleStartEdge}
              disabled={isBusy}
              className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-sans text-xs font-semibold transition-colors flex justify-center items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              启动 n2n Edge
            </button>
            
            <button
              onClick={handleStopEdge}
              disabled={isBusy}
              className="w-full py-3 rounded-lg bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 font-sans text-xs font-semibold transition-colors flex justify-center items-center gap-2 border border-slate-200/60 cursor-pointer disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              停止 n2n Edge
            </button>
            
            <div className="h-px bg-slate-100 my-1" />
            
            <button
              onClick={() => void refreshNetworkPanel(true)}
              disabled={isBusy}
              className="w-full py-2.5 rounded-lg text-slate-400 hover:text-slate-700 font-sans text-xs font-semibold transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新真实状态
            </button>
          </div>

        </div>

        {/* Right Column: Configuration Forms */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Basic Form config */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h3 className="font-heading text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-500" />
              基准参数配置
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Field 1 */}
              <div className="flex flex-col gap-1">
                <label className="font-sans text-xs text-slate-400 font-medium pl-1">Room Name (社区大厅名)</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => onUpdateState('roomName', e.target.value)}
                  className="bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500/10 rounded-lg px-4 py-2.5 font-sans text-xs text-slate-700 outline-none transition-all"
                  placeholder="请输入共同约定的房间名称"
                />
              </div>

              {/* Field 2 */}
              <div className="flex flex-col gap-1">
                <label className="font-sans text-xs text-slate-400 font-medium pl-1">Key (通信共享密码)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={roomKey}
                    onChange={(e) => onUpdateState('roomKey', e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500/10 rounded-lg pl-4 pr-10 py-2.5 font-sans text-xs text-slate-700 outline-none transition-all"
                    placeholder="通信群组密码"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 3 */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="font-sans text-xs text-slate-400 font-medium pl-1">Supernode (超级节点公网地址)</label>
                <input
                  type="text"
                  value={supernode}
                  onChange={(e) => onUpdateState('supernode', e.target.value)}
                  className="bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500/10 rounded-lg px-4 py-2.5 font-sans text-xs text-slate-700 outline-none transition-all"
                  placeholder="supernode.n2n.edge.me:7777"
                />
              </div>

              {/* Field 4 */}
              <div className="flex flex-col gap-1">
                <label className="font-sans text-xs text-slate-400 font-medium pl-1">Virtual IP (期望分配的IP) - 选填</label>
                <input
                  type="text"
                  value={virtualIpInput}
                  onChange={(e) => onUpdateState('virtualIpInput', e.target.value)}
                  className="bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500/10 rounded-lg px-4 py-2.5 font-sans text-xs text-slate-700 outline-none transition-all font-mono"
                  placeholder="留空即由中继DHCP自动协商"
                />
              </div>

              {/* Field 5 */}
              <div className="flex flex-col gap-1">
                <label className="font-sans text-xs text-slate-400 font-medium pl-1">Game Port (本地游戏运行端口)</label>
                <input
                  type="text"
                  value={gamePort}
                  onChange={(e) => onUpdateState('gamePort', e.target.value)}
                  className="bg-slate-50/50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500/10 rounded-lg px-4 py-2.5 font-sans text-xs text-slate-700 outline-none transition-all font-mono"
                  placeholder="如: 7777"
                />
              </div>

            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveConfig}
                className="px-5 py-2.5 rounded-lg bg-amber-500 text-amber-950 font-sans text-xs font-bold hover:bg-amber-450 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                保存基础参数
              </button>
            </div>
          </div>

          {/* Advanced Configurations */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
            <h3 className="font-heading text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500 animate-pulse" />
              高级网络路由与代理选项
            </h3>

            <div className="space-y-6">
              
              {/* Feature 4: TCP 端口代理完整配置 */}
              <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-200/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-sans text-xs font-bold text-slate-800">TCP 端口代理 (TCP Proxy Forwarding)</h4>
                    <p className="font-sans text-[10px] text-slate-400 mt-0.5">高打通级自定义端口代理中继。支持在多点对称制沙盒NAT限制下，通过手动配置链路透传进行握手避封。</p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      checked={tcpProxy}
                      onChange={(e) => {
                        onUpdateState('tcpProxy', e.target.checked);
                        onTriggerToast(e.target.checked ? '已展开 TCP 端口代理配置。添加规则后才会启动真实代理。' : '已收起 TCP 端口代理配置，现有真实代理不会被自动停止。');
                      }}
                      className="mr-2 cursor-pointer w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {tcpProxy && (
                  <div className="border-t border-slate-200/50 pt-4 space-y-4 animate-fade-in text-xs">
                    {/* Inline Form */}
                    <form onSubmit={handleAddTcpRule} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-inner">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">本机监听端口</span>
                        <input 
                          type="text" 
                          value={tcpInput.listen} 
                          onChange={e => setTcpInput({ ...tcpInput, listen: e.target.value })}
                          placeholder="例如: 27015" 
                          className="px-2 py-1.5 border border-slate-200 rounded font-mono text-xs outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">目标联机友方虚拟IP</span>
                        <input 
                          type="text" 
                          value={tcpInput.targetIp} 
                          onChange={e => setTcpInput({ ...tcpInput, targetIp: e.target.value })}
                          placeholder="例如: 10.0.8.2" 
                          className="px-2 py-1.5 border border-slate-200 rounded font-mono text-xs outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">目标对应映射端口</span>
                        <input 
                          type="text" 
                          value={tcpInput.targetPort} 
                          onChange={e => setTcpInput({ ...tcpInput, targetPort: e.target.value })}
                          placeholder="例如: 27015" 
                          className="px-2 py-1.5 border border-slate-200 rounded font-mono text-xs outline-none"
                        />
                      </div>
                      <div className="flex items-end">
                        <button type="submit" className="w-full bg-slate-800 hover:bg-slate-950 text-white font-semibold py-1.5 rounded cursor-pointer transition-colors">
                          添加端口映射规则
                        </button>
                      </div>
                    </form>

                    {/* Rules List Table */}
                    <div className="bg-white rounded-lg border border-slate-150 overflow-hidden shadow-sm">
                      <div className="px-3 py-2 bg-slate-50 text-[10px] text-slate-500 font-bold border-b border-slate-150 flex justify-between">
                        <span>当前真实 TCP 代理隧道 (共 {tcpRules.length} 条)</span>
                        <span className="text-emerald-600">来自后端进程列表</span>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-100/40 text-[9.5px] text-slate-400 border-b border-slate-150">
                            <th className="py-1.5 px-3">本地端入口监听</th>
                            <th className="py-1.5 px-3">对端友邻代理节点 (目标)</th>
                            <th className="py-1.5 px-3 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {tcpRules.map(rule => (
                            <tr key={rule.id} className="hover:bg-amber-500/5">
                              <td className="py-1.5 px-3">127.0.0.1:{rule.listen}</td>
                              <td className="py-1.5 px-3 text-amber-700 font-bold">{rule.targetIp}:{rule.targetPort}</td>
                              <td className="py-1.5 px-3 text-right">
                                <button type="button" onClick={() => handleDeleteTcpRule(rule.id, rule.listen)} className="text-rose-600 hover:text-rose-800 underline cursor-pointer">
                                  卸载
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-slate-100" />

              {/* Feature 5: UDP 端口代理完整配置 */}
              <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-200/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-sans text-xs font-bold text-slate-800">UDP 端口代理 (UDP Speedup Proxy)</h4>
                    <p className="font-sans text-[10px] text-slate-400 mt-0.5">原生 UDP 极速中转对齐加速核心。游戏语音、对等包、动作流大包专属分层加速。</p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      checked={udpProxy}
                      onChange={(e) => {
                        onUpdateState('udpProxy', e.target.checked);
                        onTriggerToast(e.target.checked ? '已展开 UDP 端口代理配置。添加规则后才会启动真实代理。' : '已收起 UDP 端口代理配置，现有真实代理不会被自动停止。');
                      }}
                      className="mr-2 cursor-pointer w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {udpProxy && (
                  <div className="border-t border-slate-200/50 pt-4 space-y-4 animate-fade-in text-xs">
                    {/* UDP Inline Form */}
                    <form onSubmit={handleAddUdpRule} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-100 shadow-inner">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">本机监听UDP端口</span>
                        <input 
                          type="text" 
                          value={udpInput.listen} 
                          onChange={e => setUdpInput({ ...udpInput, listen: e.target.value })}
                          placeholder="例如: 8211" 
                          className="px-2 py-1.5 border border-slate-200 rounded font-mono text-xs outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">友邻虚拟网IP (转发目标)</span>
                        <input 
                          type="text" 
                          value={udpInput.targetIp} 
                          onChange={e => setUdpInput({ ...udpInput, targetIp: e.target.value })}
                          placeholder="例如: 10.0.8.3" 
                          className="px-2 py-1.5 border border-slate-200 rounded font-mono text-xs outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">友端入站接收端口</span>
                        <input 
                          type="text" 
                          value={udpInput.targetPort} 
                          onChange={e => setUdpInput({ ...udpInput, targetPort: e.target.value })}
                          placeholder="例如: 8211" 
                          className="px-2 py-1.5 border border-slate-200 rounded font-mono text-xs outline-none"
                        />
                      </div>
                      <div className="flex items-end">
                        <button type="submit" className="w-full bg-slate-850 hover:bg-slate-900 text-white font-semibold py-1.5 rounded cursor-pointer transition-colors">
                          激活UDP对口管道
                        </button>
                      </div>
                    </form>

                    {/* Rules List Table */}
                    <div className="bg-white rounded-lg border border-slate-150 overflow-hidden shadow-sm">
                      <div className="px-3 py-2 bg-slate-50 text-[10px] text-slate-500 font-bold border-b border-slate-150 flex justify-between">
                        <span>真实 UDP 直通映射条目集 (共 {udpRules.length} 条)</span>
                        <span className="text-amber-600">来自后端进程列表</span>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-100/40 text-[9.5px] text-slate-400 border-b border-slate-150">
                            <th className="py-1.5 px-3">本地UDP发射端口</th>
                            <th className="py-1.5 px-3">直面通道目标绑IP</th>
                            <th className="py-1.5 px-3 text-right">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {udpRules.map(rule => (
                            <tr key={rule.id} className="hover:bg-amber-500/5">
                              <td className="py-1.5 px-3">0.0.0.0:{rule.listen}</td>
                              <td className="py-1.5 px-3 text-slate-700">{rule.targetIp}:{rule.targetPort}</td>
                              <td className="py-1.5 px-3 text-right">
                                <button type="button" onClick={() => handleDeleteUdpRule(rule.id, rule.listen)} className="text-rose-600 hover:text-rose-800 underline mr-2 cursor-pointer">
                                  卸载
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-slate-100" />

              {/* Feature 6: UDP 广播桥完整配置 */}
              <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-200/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-sans text-xs font-bold text-slate-800">UDP 广播桥 (UDP Broadcast Bridge)</h4>
                    <p className="font-sans text-[10px] text-slate-400 mt-0.5">原ARP广播帧多级渗透桥接。打通虚拟网卡到真实电脑的广播直连，主要修复《我的世界(1.12及以下)》、《文明》主机大厅相互看不见的痛点。</p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      checked={udpBroadcastBridge}
                      onChange={(e) => {
                        onUpdateState('udpBroadcastBridge', e.target.checked);
                        onTriggerToast(e.target.checked ? '已展开 UDP 广播桥配置。点击应用后启动真实广播桥。' : '已收起 UDP 广播桥配置，现有真实广播桥不会被自动停止。');
                      }}
                      className="mr-2 cursor-pointer w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {udpBroadcastBridge && (
                  <div className="border-t border-slate-200/50 pt-4 space-y-4 animate-fade-in text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-100">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">广播通投目标网段范围</span>
                        <input 
                          type="text" 
                          value={broadcastConfig.targetRange}
                          onChange={e => setBroadcastConfig({ ...broadcastConfig, targetRange: e.target.value })}
                          className="px-2 py-1.5 border border-slate-200 rounded font-mono text-xs outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">承载并网网卡驱动名</span>
                        <select 
                          value={broadcastConfig.adapter}
                          onChange={e => setBroadcastConfig({ ...broadcastConfig, adapter: e.target.value })}
                          className="px-2 py-1.5 border border-slate-200 rounded text-xs outline-none bg-white font-sans text-slate-700 cursor-pointer"
                        >
                          <option value="TAP-Windows Virtual Device V9 (10.0.8.1)">TAP-Windows Adaptive V9 (10.0.8.1)</option>
                          <option value="Ethernet 0 (192.168.1.10)">Ethernet 0 真实物理适配器</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400">帧突发速率安全阈值 (pkts/sec)</span>
                        <input 
                          type="number" 
                          value={broadcastConfig.rateLimit}
                          onChange={e => setBroadcastConfig({ ...broadcastConfig, rateLimit: e.target.value })}
                          className="px-2 py-1.5 border border-slate-200 rounded font-mono text-xs outline-none animate-pulse-subtle"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-amber-500/5 border border-amber-300/20 p-3 rounded-lg">
                      <span className="text-[10.5px] text-amber-800">💡 提示：高突变帧速率有助于提高某些老游戏的“秒搜房”刷新率，但可能加剧部分校园网环境下防火墙的防御阻断报警。建议保持 350 下限。</span>
                      <button 
                        type="button" 
                        onClick={handleApplyBroadcastConfig}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-450 text-slate-900 font-bold font-sans rounded text-xs transition-colors cursor-pointer"
                      >
                        重新应用广播桥
                      </button>
                    </div>
                    {broadcastRules.length > 0 && (
                      <div className="bg-white rounded-lg border border-slate-150 overflow-hidden shadow-sm">
                        <div className="px-3 py-2 bg-slate-50 text-[10px] text-slate-500 font-bold border-b border-slate-150">
                          当前真实广播桥进程 (共 {broadcastRules.length} 条)
                        </div>
                        <div className="divide-y divide-slate-100">
                          {broadcastRules.map((rule) => (
                            <div key={rule.id} className="px-3 py-2 flex items-center justify-between font-mono text-[11px]">
                              <span>{rule.listen} {'->'} {rule.forward_targets.join(', ')}</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    setIsBusy(true);
                                    await stopUdpBroadcastBridge(rule.id);
                                    onTriggerToast(`已停止 UDP 广播桥：${rule.listen}`);
                                    await refreshNetworkPanel(false);
                                  } catch (error) {
                                    onTriggerToast(error instanceof Error ? error.message : String(error || '停止 UDP 广播桥失败'));
                                  } finally {
                                    setIsBusy(false);
                                  }
                                }}
                                className="text-rose-600 hover:text-rose-800 underline cursor-pointer"
                              >
                                停止
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}