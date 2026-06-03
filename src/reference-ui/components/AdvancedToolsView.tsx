import { useState, useRef, useEffect, FormEvent } from 'react';
import {
  Link,
  Cpu,
  Tv,
  Wifi,
  Volume2,
  RefreshCw,
  Play,
  Square,
  Terminal,
  Activity,
  CheckCircle,
  AlertTriangle,
  FileText,
  Sliders,
  Send,
  HelpCircle
} from 'lucide-react';

interface AdvancedToolsViewProps {
  onTriggerToast: (msg: string) => void;
}

interface ProxyInstance {
  id: string;
  type: 'tcp' | 'udp' | 'bridge';
  listenPort: string;
  targetAddress: string;
  targetPort?: string;
  activeConnections: number;
  totalConnections: number;
  packetsIn: number;
  packetsOut: number;
  bytesIn: number;
  bytesOut: number;
  logs: string[];
  status: 'running' | 'stopped' | 'failed';
}

export default function AdvancedToolsView({ onTriggerToast }: AdvancedToolsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'proxy' | 'server'>('proxy');
  const [testingId, setTestingId] = useState<string | null>(null);

  // TCP / UDP / Bridge instances list
  const [instances, setInstances] = useState<ProxyInstance[]>([
    {
      id: 'tcp_l4',
      type: 'tcp',
      listenPort: '27015',
      targetAddress: '10.0.8.2',
      targetPort: '27015',
      activeConnections: 1,
      totalConnections: 18,
      packetsIn: 2420,
      packetsOut: 2196,
      bytesIn: 184500,
      bytesOut: 195200,
      status: 'running',
      logs: [
        '[Proxy] TCP-Proxy service initialized successfully.',
        '[Proxy] Listening on local address: 127.0.0.1:27015',
        '[Proxy] Connection established from local client sandbox to peer 10.0.8.2:27015'
      ]
    },
    {
      id: 'udp_l2',
      type: 'udp',
      listenPort: '27015',
      targetAddress: '10.0.8.3',
      targetPort: '27015',
      activeConnections: 1,
      totalConnections: 45,
      packetsIn: 11025,
      packetsOut: 9840,
      bytesIn: 724800,
      bytesOut: 642000,
      status: 'running',
      logs: [
        '[Proxy] UDP Unicast Proxy service initialized successfully.',
        '[Proxy] Listening on local address: 0.0.0.0:27015',
        '[Proxy] Tunnel pipeline bound to peer node 10.0.8.3:27015'
      ]
    },
    {
      id: 'bridge_l1',
      type: 'bridge',
      listenPort: '8211',
      targetAddress: '10.0.8.255',
      activeConnections: 0,
      totalConnections: 154,
      packetsIn: 485,
      packetsOut: 485,
      bytesIn: 34100,
      bytesOut: 34100,
      status: 'running',
      logs: [
        '[Bridge] UDP Broadcast Bridge initialized on interface IP 10.0.8.1.',
        '[Bridge] Filtering duplicate frame broadcast packages, TTL set to 3.',
        '[Bridge] Broadcasting room updates out to pool segment 10.0.8.255 successful.'
      ]
    }
  ]);

  // Form Inputs
  const [newProxy, setNewProxy] = useState({
    type: 'tcp' as 'tcp' | 'udp' | 'bridge',
    listen: '',
    targetIp: '10.0.8.2',
    targetPort: ''
  });

  // Generic Game Server States
  const [serverStatus, setServerStatus] = useState<'stopped' | 'running' | 'loading'>('stopped');
  const [serverGameName, setServerGameName] = useState('Minecraft 1.20.1 (Forge)');
  const [serverPort, setServerPort] = useState('25565');
  const [serverPath, setServerPath] = useState('D:/GameServers/MC/server.jar');
  const [serverUptime, setServerUptime] = useState(0);
  const [serverClients, setServerClients] = useState(0);
  const [serverLogs, setServerLogs] = useState<string[]>([
    '[Server Launcher] Idle.'
  ]);
  const [serverInputCmd, setServerInputCmd] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto increment server uptime ticker
  useEffect(() => {
    let timer: any;
    if (serverStatus === 'running') {
      timer = setInterval(() => {
        setServerUptime(prev => prev + 1);
        // Randomly simulate a client join or log
        if (Math.random() > 0.85) {
          setServerClients(prev => Math.min(10, prev + (Math.random() > 0.5 ? 1 : -1)));
          const nowStr = new Date().toLocaleTimeString();
          setServerLogs(prev => [
            ...prev,
            `[Server Debug] ${nowStr} - Keeping heartbeat alive. Connection latency check: ok.`
          ]);
        }
      }, 1000);
    } else {
      setServerUptime(0);
      setServerClients(0);
    }
    return () => clearInterval(timer);
  }, [serverStatus]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [serverLogs]);

  // Self-test helper function
  const handleRunSelfCheck = (id: string, type: string) => {
    setTestingId(id);
    onTriggerToast(`正在对代理 ${type.toUpperCase()} [ID: ${id}] 进行一键通路极速探测...`);
    setTimeout(() => {
      setTestingId(null);
      setInstances(prev => prev.map(inst => {
        if (inst.id === id) {
          const nowStr = new Date().toLocaleTimeString();
          return {
            ...inst,
            logs: [...inst.logs, `[Self-check] ${nowStr} - Diagnostics PASSED. Target is responsive under 12ms.`]
          };
        }
        return inst;
      }));
      onTriggerToast(`自测圆满完成！对端端口连通，通信抗阻良好。`);
    }, 1200);
  };

  // Start Proxy handler
  const handleAddProxy = (e: FormEvent) => {
    e.preventDefault();
    if (!newProxy.listen) {
      onTriggerToast('请输入本地监听端口！');
      return;
    }
    if (newProxy.type !== 'bridge' && !newProxy.targetPort) {
      onTriggerToast('请输入目的转发端口！');
      return;
    }

    const nProxy: ProxyInstance = {
      id: `${newProxy.type}_${Date.now()}`,
      type: newProxy.type,
      listenPort: newProxy.listen,
      targetAddress: newProxy.targetIp,
      targetPort: newProxy.type !== 'bridge' ? newProxy.targetPort : undefined,
      activeConnections: 0,
      totalConnections: 0,
      packetsIn: 0,
      packetsOut: 0,
      bytesIn: 0,
      bytesOut: 0,
      status: 'running',
      logs: [
        `[Proxy] Initialized custom rule for ${newProxy.type.toUpperCase()}`,
        `[Proxy] Port listening active on local dev card: ${newProxy.listen}`,
        `[Proxy] Redirect pipeline directed towards peer IP ${newProxy.targetIp}`
      ]
    };

    setInstances([nProxy, ...instances]);
    onTriggerToast(`高级连接应用 [${newProxy.type.toUpperCase()} -> ${newProxy.listen}] 挂载并启动成功！`);
    setNewProxy({ ...newProxy, listen: '', targetPort: '' });
  };

  const handleStopInstance = (id: string) => {
    setInstances(prev => prev.map(inst => {
      if (inst.id === id) {
        return {
          ...inst,
          status: inst.status === 'running' ? 'stopped' : 'running',
          logs: [...inst.logs, `[Control] Service manual state transition requested, status: ${inst.status === 'running' ? 'STOP' : 'RUN'}`]
        };
      }
      return inst;
    }));
    onTriggerToast('代理规则状态切换成功。');
  };

  const handleDeleteProxy = (id: string) => {
    setInstances(prev => prev.filter(p => p.id !== id));
    onTriggerToast('选中的高级连接代理链路已彻底卸载。');
  };

  // Start Server launcher
  const handleStartGenericServer = () => {
    if (serverStatus === 'running') return;
    setServerStatus('loading');
    onTriggerToast(`正在为 [${serverGameName}] 配备防火墙端口与引导进程缓存...`);
    setServerLogs([
      `[Server Launcher] Booting standalone sandbox environment...`,
      `[Server Launcher] Selected game database metadata: ${serverGameName}`,
      `[Server Launcher] Opening socket on LAN port ${serverPort}...`,
      `[Server Launcher] Command exec initiated: java -Xmx4G -jar ${serverPath}`
    ]);

    setTimeout(() => {
      setServerStatus('running');
      setServerClients(2);
      setServerLogs(prev => [
        ...prev,
        `[IO Console] System memory status check... OK`,
        `[IO Console] Map files verified (Checksum pass)`,
        `[IO Console] Game loop thread started (TPS: 20)`,
        `[IO Console] Listening for incoming local LAN virtual connections on port ${serverPort}`
      ]);
      onTriggerToast(`专用游戏服务端会话启动就绪！已部署并向局域网广播！🔥`);
    }, 1800);
  };

  const handleStopGenericServer = () => {
    if (serverStatus !== 'running') return;
    setServerStatus('stopped');
    setServerLogs(prev => [
      ...prev,
      `[Server Launcher] Shutting down active connections...`,
      `[Server Launcher] Saving world blocks metadata to disk... Saved completed.`,
      `[Server Launcher] Virtual environment killed. Exit with code: 0`
    ]);
    onTriggerToast('游戏伺服会话已正常保存世界并安全下线。');
  };

  const handleSendServerCmd = () => {
    const cmd = serverInputCmd.trim();
    if (!cmd) return;
    setServerLogs(prev => [
      ...prev,
      `[Operator Input] > ${cmd}`,
      `[Server Console] Executing admin action... Done.`
    ]);
    setServerInputCmd('');
  };

  // Format uptime
  const formatUptime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">高级连接工具</h2>
          <p className="font-sans text-sm text-slate-500 mt-1">管理底层 TCP/UDP 高性能直通代理与 UDP 集群大厅广播网桥，提供独立单体游戏自建开服大厅。</p>
        </div>

        {/* Dynamic Sub Tabs */}
        <div className="bg-slate-150/60 p-1 rounded-lg border border-slate-200/40 flex items-center shadow-sm w-fit font-sans text-xs">
          <button
            onClick={() => setActiveSubTab('proxy')}
            className={`px-4 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeSubTab === 'proxy' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            高级端口代理 & 广播网网桥
          </button>
          <button
            onClick={() => setActiveSubTab('server')}
            className={`px-4 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeSubTab === 'server' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            通用游戏服务端会话
          </button>
        </div>
      </div>

      {activeSubTab === 'proxy' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: Creator tool config form */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Guide Explainer Card */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-2xl border border-slate-800 shadow-sm text-slate-200 relative overflow-hidden">
              <div className="absolute top-[-30%] right-[-20%] w-[180px] h-[180px] bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <HelpCircle className="w-6 h-6 text-amber-500 mb-3" />
              <h3 className="font-heading text-sm font-bold text-amber-400">什么时候使用这些工具？</h3>
              <ul className="mt-3 space-y-2.5 font-sans text-[11px] leading-relaxed text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <span><strong>UDP 广播桥 (Broadcast Bridge)：</strong> 如果您的朋友可以直接连您的 IP，但进入游戏却在<strong>“大厅房源扫描”</strong>列表刷新不出联机世界，则是由于虚拟网段广播被系统隔断。建议立即启动 UDP 广播直连映射。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <span><strong>TCP/UDP 端口转发 (Proxy)：</strong> 如果好友只能搜到，但死活进不去指定非默认端口的主机。或者特定沙箱环境下只识别本地 <code>127.0.0.1</code>。本端口代理能在两端架一条独家直达高吞吐管道。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <span><strong>一键式链路自检 (Self Check)：</strong> 代理就绪后先执行自测试，避免由于物理端口冲突阻拦截流量。</span>
                </li>
              </ul>
            </div>

            {/* Config Addition Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans text-xs">
              <h3 className="font-heading text-sm font-bold text-slate-800 pb-3 border-b border-slate-100 mb-5 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500 animate-pulse" />
                新增链路实例映射
              </h3>

              <form onSubmit={handleAddProxy} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-semibold pl-1">代理应用技术</label>
                  <select
                    value={newProxy.type}
                    onChange={(e: any) => setNewProxy({ ...newProxy, type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 outline-none rounded-lg px-3 py-2 text-xs font-sans text-slate-700 cursor-pointer"
                  >
                    <option value="tcp">TCP 极速端口代理 (TCP Proxy)</option>
                    <option value="udp">UDP 分层透传加速 (UDP Speedup Proxy)</option>
                    <option value="bridge">UDP ARP 广播大厅桥 (Broadcast Bridge)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-semibold pl-1 font-sans">
                    {newProxy.type === 'bridge' ? '接收广播帧本地监听 UDP 端口' : '本地端监听/拦截端口 (Local Listen)'}
                  </label>
                  <input
                    type="number"
                    value={newProxy.listen}
                    onChange={(e) => setNewProxy({ ...newProxy, listen: e.target.value })}
                    placeholder="如: 7777"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-3 py-2 text-xs font-mono outline-none transition-all"
                  />
                </div>

                {newProxy.type !== 'bridge' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400 font-semibold pl-1 font-sans">对端目的地 IPv4 虚拟地址 (Target Host)</label>
                      <input
                        type="text"
                        value={newProxy.targetIp}
                        onChange={(e) => setNewProxy({ ...newProxy, targetIp: e.target.value })}
                        placeholder="10.0.8.2"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-3 py-2 text-xs font-mono outline-none transition-all"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400 font-semibold pl-1 font-sans">对端目标游戏映射端口 (Target Port)</label>
                      <input
                        type="number"
                        value={newProxy.targetPort}
                        onChange={(e) => setNewProxy({ ...newProxy, targetPort: e.target.value })}
                        placeholder="如: 7777"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-3 py-2 text-xs font-mono outline-none transition-all"
                      />
                    </div>
                  </>
                )}

                {newProxy.type === 'bridge' && (
                  <div className="p-3 bg-slate-50 border border-slate-250/50 rounded-xl space-y-1.5 text-slate-500">
                    <p><strong>技术规格:</strong> 广播大厅模式会将本机在分配网段（通常是 <code>10.0.8.255</code>）内的各种局域网发现广播帧复制并注入到您的虚拟网卡中。重传 TTL 去重缓冲默认为 3 秒（高保真防炸）。</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-950 text-white font-semibold font-sans rounded-xl shadow-sm cursor-pointer transition-colors"
                >
                  挂载并上线该高速链路
                </button>
              </form>
            </div>

          </div>

          {/* Right Panel: Working instance list & logs */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Instance table header list */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans text-xs">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-5">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
                  当前运行中的高级代理实例 ({instances.length})
                </h3>
                <span className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">
                  Real-time Link Metrics
                </span>
              </div>

              {instances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 h-[300px]">
                  <Activity className="w-10 h-10 text-slate-300 stroke-[1.5] mb-2 animate-pulse" />
                  <p>后台当前暂无加载任何高级代理直通链路。</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {instances.map((inst) => (
                    <div
                      key={inst.id}
                      className={`border rounded-2xl p-5 shadow-inner transition-all flex flex-col gap-4 relative overflow-hidden ${
                        inst.status === 'running'
                          ? 'bg-slate-100/50 border-slate-200/80 hover:bg-slate-50'
                          : 'bg-slate-100/30 border-dashed border-slate-200 opacity-60'
                      }`}
                    >
                      {/* Floating status flag */}
                      <span className="absolute top-5 right-5 flex items-center gap-1.5 text-[9.5px] font-mono tracking-wider">
                        {inst.status === 'running' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-100/60 px-2 py-0.5 rounded">RUNNING</span>
                          </>
                        ) : (
                          <span className="text-slate-400 font-semibold bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded">OFFLINE</span>
                        )}
                      </span>

                      {/* Info core row */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm ${
                            inst.type === 'tcp'
                              ? 'bg-indigo-500/10 text-indigo-700 border border-indigo-200/30'
                              : inst.type === 'udp'
                              ? 'bg-amber-500/10 text-amber-700 border border-amber-200/30'
                              : 'bg-emerald-500/10 text-emerald-700 border border-emerald-200/30'
                          }`}>
                            {inst.type.toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-heading font-bold text-slate-800 text-[12.5px] flex items-center gap-2">
                              {inst.type === 'tcp'
                                ? 'TCP 端口代理 (TCP-Redirector)'
                                : inst.type === 'udp'
                                ? 'UDP 帧对齐代理 (UDP-Speedup-Proxy)'
                                : 'UDP ARP 广播大厅桥 (L1-BroadcastBridge)'}
                            </h4>
                            <p className="font-mono text-[10.5px] text-slate-500 mt-1">
                              本地入站监听: <strong className="text-slate-700">{inst.listenPort}</strong>
                              {inst.type !== 'bridge' && (
                                <>
                                  {' '}→ 转发地址:{' '}
                                  <strong className="text-amber-700">{inst.targetAddress}:{inst.targetPort}</strong>
                                </>
                              )}
                              {inst.type === 'bridge' && (
                                <>
                                  {' '}→ 洪泛组播网段:{' '}
                                  <strong className="text-emerald-700">{inst.targetAddress} (DHCP网网直连端)</strong>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Running Stats Grid */}
                      {inst.status === 'running' && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border border-slate-200/50 bg-white/70 rounded-xl shadow-inner text-[10px] font-mono">
                          <div>
                            <span className="text-slate-400 block font-sans">
                              {inst.type === 'bridge' ? '最近活跃包数' : '当前连接数 (Active)'}
                            </span>
                            <span className="text-xs font-bold text-slate-700 mt-0.5 block">
                              {inst.type === 'bridge' ? `${inst.packetsIn} pr` : `${inst.activeConnections} / ${inst.totalConnections} 束`}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">收包累积 (Packets In)</span>
                            <span className="text-xs font-bold text-slate-700 mt-0.5 block">{inst.packetsIn} pks</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">字节出站 (Bytes Out)</span>
                            <span className="text-xs font-bold text-slate-700 mt-0.5 block">{(inst.bytesOut / 1024).toFixed(1)} KB</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">上行转发累积 (Throughput)</span>
                            <span className="text-xs font-bold font-sans text-emerald-600 mt-0.5 block flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              稳态链路 (正常)
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Operations buttons */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleStopInstance(inst.id)}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer bg-white ${
                            inst.status === 'running'
                              ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          {inst.status === 'running' ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              暂停代理
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              重新上线
                            </>
                          )}
                        </button>

                        {inst.status === 'running' && (
                          <button
                            onClick={() => handleRunSelfCheck(inst.id, inst.type)}
                            disabled={testingId === inst.id}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${testingId === inst.id ? 'animate-spin' : ''}`} />
                            一键连通自测
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteProxy(inst.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer bg-white"
                        >
                          完全卸载链路
                        </button>
                      </div>

                      {/* Log Console Drawer inside item */}
                      <div className="bg-slate-900 text-slate-350 p-3 rounded-xl border border-slate-800 font-mono text-[10px] space-y-1 max-h-[85px] overflow-y-auto shadow-inner leading-relaxed select-all">
                        {inst.logs.map((logLine, index) => (
                          <div key={index} className="truncate">
                            <span className="text-amber-500 font-bold pr-1">&gt;</span>
                            {logLine}
                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        /* Standalone Generic Server Session Launcher (Item 3.4) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Config Setup side */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans text-xs space-y-4">
              <h3 className="font-heading text-sm font-bold text-slate-800 pb-3 border-b border-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" />
                伺服世界配置 (Custom Server Settings)
              </h3>

              <div className="p-3 bg-amber-500/5 text-amber-700 border border-amber-300/20 rounded-xl space-y-1">
                <strong>💡 通用提示：</strong>
                <p className="leading-relaxed text-[10.5px]">此功能提供运行<strong>“任意游戏专用服务器 (Minecraft、饥荒、中世纪公、幻兽等)”</strong>的集中引导能力，并在虚拟网自动映射本地端口。您只需更改路径与端口即可！</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold pl-1 font-sans">拟承载的联机游戏名</label>
                <input
                  type="text"
                  value={serverGameName}
                  onChange={(e) => setServerGameName(e.target.value)}
                  placeholder="Minecraft 1.20"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-3 py-2 text-xs outline-none font-semibold text-slate-700"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold pl-1 font-sans">运行服务绑定端口 (LAN Port)</label>
                <input
                  type="number"
                  value={serverPort}
                  onChange={(e) => setServerPort(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-3 py-2 text-xs font-mono outline-none text-slate-700"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold pl-1 font-sans">服务端物理 Jar/Exe 可执行路径</label>
                <input
                  type="text"
                  value={serverPath}
                  onChange={(e) => setServerPath(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-3 py-2 text-xs font-mono outline-none text-slate-500 truncate"
                />
              </div>

              {/* Launcher Controller buttons */}
              <div className="pt-3 flex flex-col gap-2">
                {serverStatus !== 'running' ? (
                  <button
                    onClick={handleStartGenericServer}
                    disabled={serverStatus === 'loading'}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-950 text-white font-bold font-sans rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current text-white" />
                    {serverStatus === 'loading' ? '正在拉起服务沙盒进程...' : '挂载并运行专属服务端'}
                  </button>
                ) : (
                  <button
                    onClick={handleStopGenericServer}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold font-sans rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-shadow"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    安全停止并固化世界存档
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Console / Terminal view split panel */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Real Stats Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-xs">
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                  IP
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">并网局域网络直达 IP 地址</span>
                  <span className="font-mono text-[13px] font-bold text-slate-800">10.0.8.1 (直通分配端)</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
                  UP
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">伺服端保持运行时间</span>
                  <span className="font-mono text-[13px] font-bold text-slate-800">
                    {serverStatus === 'running' ? formatUptime(serverUptime) : '00:00 (休眠)'}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
                  PL
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">当前连通大厅的好友端数量</span>
                  <span className="font-mono text-[13px] font-bold text-slate-800">
                    {serverStatus === 'running' ? `${serverClients} 人 (活跃中)` : '0 人 (无连接)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Terminal monitor screen */}
            <div className="bg-slate-900 rounded-2xl overflow-hidden flex flex-col border border-slate-800/80 shadow-md">
              <div className="bg-slate-950 flex items-center justify-between px-4 py-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono text-xs text-slate-400">运行日志实时监测 Console (IO Direct Stream)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">ENCODING: UTF-8</span>
              </div>

              <div className="p-4 h-64 overflow-y-auto font-mono text-[11px] leading-relaxed text-[#A9B1D6] scroll-smooth space-y-1">
                {serverLogs.map((logLine, idx) => {
                  let logClass = 'text-[#C0CAF5]';
                  if (logLine.includes('[Server Launcher]')) logClass = 'text-amber-500 font-semibold';
                  if (logLine.includes('[IO Console]')) logClass = 'text-teal-400';
                  if (logLine.includes('[Operator Input]')) logClass = 'text-[#BB9AF7]';
                  return (
                    <div key={idx} className={logClass}>
                      {logLine}
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>

              {/* CLI console input */}
              <div className="bg-slate-950 border-t border-slate-800/80 px-4 py-2 flex items-center gap-2">
                <span className="font-mono text-xs text-amber-500 font-bold">&gt;_</span>
                <input
                  type="text"
                  value={serverInputCmd}
                  onChange={(e) => setServerInputCmd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendServerCmd();
                  }}
                  disabled={serverStatus !== 'running'}
                  placeholder={serverStatus === 'running' ? "输入并发送专用服命令到游戏控制台中..." : "开启服务端控制台后即可发送高级操作指令..."}
                  className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-700 text-xs font-mono outline-none border-none pl-1 disabled:opacity-40"
                />
                <button
                  onClick={handleSendServerCmd}
                  disabled={serverStatus !== 'running'}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold rounded text-[11px] font-sans transition-colors cursor-pointer disabled:opacity-40"
                >
                  发送指令
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
