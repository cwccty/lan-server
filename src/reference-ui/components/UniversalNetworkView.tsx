import { useState } from 'react';
import {
  Settings,
  HelpCircle,
  Play,
  Square,
  RefreshCw,
  Cpu,
  Save,
  Eye,
  EyeOff,
  Zap,
  ArrowRight,
  Layers
} from 'lucide-react';

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
  const [isRunning, setIsRunning] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedBackend, setSelectedBackend] = useState<'n2n' | 'radmin' | 'manual_lan'>('n2n');
  const [activeN2nErrorCode, setActiveN2nErrorCode] = useState<string | null>(null);

  const handleStartEdge = () => {
    if (isRunning) {
      onTriggerToast('n2n Edge 并网核心已经在运行中。');
      return;
    }
    onTriggerToast('正在连接超级节点，配置局域网 TAP 虚拟环形通路...');
    setTimeout(() => {
      setIsRunning(true);
      onTriggerToast('n2n Edge 通信客户端启动成功！[延迟：24ms]');
    }, 1000);
  };

  const handleStopEdge = () => {
    if (!isRunning) {
      onTriggerToast('n2n Edge 已经处于停止断网状态。');
      return;
    }
    setIsRunning(false);
    onTriggerToast('已安全停止 n2n 虚拟并网对等网络。');
  };

  const handleSaveConfig = () => {
    onTriggerToast('基础联机参数已成功固化到本地 edge_options.config 配置文件中！');
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
                数据吞吐正常 | 
                <span className="text-slate-600 font-bold ml-1">延迟: 24ms</span>
              </p>
            )}
          </div>

          {/* Action List Buttons */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col gap-2">
            <button
              onClick={handleStartEdge}
              className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-sans text-xs font-semibold transition-colors flex justify-center items-center gap-2 shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start n2n Edge
            </button>
            
            <button
              onClick={handleStopEdge}
              className="w-full py-3 rounded-lg bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 font-sans text-xs font-semibold transition-colors flex justify-center items-center gap-2 border border-slate-200/60 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop n2n Edge
            </button>
            
            <div className="h-px bg-slate-100 my-1" />
            
            <button
              onClick={() => {
                onTriggerToast('正在实时探测超级中继节点延迟评测列表...');
              }}
              className="w-full py-2.5 rounded-lg text-slate-400 hover:text-slate-700 font-sans text-xs font-semibold transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Node Status
            </button>
          </div>

        </div>

        {/* Right Column: Configuration Forms */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Basic Form config (Item 3.5 & Item 3.6 integrated) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-3">
              <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-500" />
                虚拟网并网底层核心技术架构 & 接口设定
              </h3>

              {/* Selector of connection tech block (Item 3.5) */}
              <select
                value={selectedBackend}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setSelectedBackend(val);
                  onTriggerToast(`底层技术内核切换成功：使用 ${
                    val === 'n2n' ? 'n2n Edge (高速对等P2P中继)' :
                    val === 'radmin' ? 'Radmin VPN (大型中继专网)' : '手动局域网/局域网IP直接访问'
                  } 模式配合联机。`);
                }}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-800 font-sans font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer"
              >
                <option value="n2n">n2n Edge v3.0 (首选极速打孔对等网)</option>
                <option value="radmin">Radmin VPN (传统 Windows 主机中继网)</option>
                <option value="manual_lan">手动直连 / 同房/宿区局域网物理网直接访问</option>
              </select>
            </div>

            {/* Conditionally render forms based on selected network backend */}
            {selectedBackend === 'n2n' && (
              <div className="space-y-4 animate-fade-in text-xs font-sans">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1">
                    <label className="font-sans text-[10.5px] text-slate-400 font-bold pl-1">Room Name (n2n 专属大厅社区名)</label>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => onUpdateState('roomName', e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-4 py-2.5 text-xs text-slate-700 outline-none transition-all"
                      placeholder="共同约定的社区名称"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-sans text-[10.5px] text-slate-400 font-bold pl-1">Key (大厅并网通信共享密码)</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={roomKey}
                        onChange={(e) => onUpdateState('roomKey', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg pl-4 pr-10 py-2.5 text-xs text-slate-700 outline-none transition-all"
                        placeholder="通信授权密码"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-750 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="font-sans text-[10.5px] text-slate-400 font-bold pl-1">Supernode Server (超级节点握手服务器地址)</label>
                    <input
                      type="text"
                      value={supernode}
                      onChange={(e) => onUpdateState('supernode', e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-4 py-2.5 font-mono text-xs text-slate-700 outline-none transition-all"
                      placeholder="例如: supernode.n2n.edge.me:7777"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-sans text-[10.5px] text-slate-400 font-bold pl-1">Virtual IPv4 Expectation (期望分配的对口IP) - 选填</label>
                    <input
                      type="text"
                      value={virtualIpInput}
                      onChange={(e) => onUpdateState('virtualIpInput', e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-4 py-2.5 font-mono text-xs text-slate-700 outline-none transition-all"
                      placeholder="未输入时自动进行 DHCP 协商获取"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-sans text-[10.5px] text-slate-400 font-bold pl-1">Base Game Port (拟代理游戏本机启动端口)</label>
                    <input
                      type="text"
                      value={gamePort}
                      onChange={(e) => onUpdateState('gamePort', e.target.value)}
                      className="bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-4 py-2.5 font-mono text-xs text-slate-700 outline-none transition-all"
                      placeholder="如 7777"
                    />
                  </div>
                </div>

                {/* N2N Interactive error codes dashboard (Item 3.6 - Core n2n failures categories) */}
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3.5 mt-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 flex items-center gap-1">
                      <Cpu className="w-4 h-4 text-amber-500" />
                      n2n 失败分类与异常秒修复诊台 (n2n Diagnostic Lookup)
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">请点击对应异常代码：</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveN2nErrorCode('tap_driver')}
                      className={`py-1.5 px-1 rounded-lg border transition-all cursor-pointer ${activeN2nErrorCode === 'tap_driver' ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}
                    >
                      -d (TAP网卡错误)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveN2nErrorCode('key_mismatch')}
                      className={`py-1.5 px-1 rounded-lg border transition-all cursor-pointer ${activeN2nErrorCode === 'key_mismatch' ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}
                    >
                      -k (共享密钥冲突)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveN2nErrorCode('room_invalid')}
                      className={`py-1.5 px-1 rounded-lg border transition-all cursor-pointer ${activeN2nErrorCode === 'room_invalid' ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}
                    >
                      -c (房间大厅名不合规)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveN2nErrorCode('supernode_offline')}
                      className={`py-1.5 px-1 rounded-lg border transition-all cursor-pointer ${activeN2nErrorCode === 'supernode_offline' ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}
                    >
                      -l (中继宿主未响应)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveN2nErrorCode('dhcp_failed')}
                      className={`py-1.5 px-1 rounded-lg border transition-all cursor-pointer ${activeN2nErrorCode === 'dhcp_failed' ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}
                    >
                      -a (IP被锁占用)
                    </button>
                  </div>

                  {activeN2nErrorCode && (
                    <div className="bg-white border border-slate-150 p-3 rounded-lg text-[11px] text-slate-600 leading-relaxed font-sans relative animate-fade-in">
                      <button
                        type="button"
                        onClick={() => setActiveN2nErrorCode(null)}
                        className="absolute top-1 right-2 hover:text-slate-900 font-bold text-slate-400 text-xs"
                      >
                        ×
                      </button>
                      {activeN2nErrorCode === 'tap_driver' && (
                        <div>
                          <strong className="text-red-700 font-bold">[诊断报错] TAP-Windows Virtual Device setup failed / cannot find NIC interfaces</strong>
                          <p className="text-slate-500 mt-1">
                            <span className="font-bold text-slate-700">根源原因：</span> 本机缺少虚拟局域网 TAP 网卡驱动程序，或者现存旧适配器被其他加速软件强行锁定。
                          </p>
                          <p className="text-slate-500">
                            <span className="font-bold text-amber-600">极速修复法：</span> 重新运行本软件的 <strong>-d 安装驱动极速一键通</strong>，或者在设备管理器中卸载并重装 TAP 核心适配器，确保本地网络连接中有名为 『LianJi』的虚拟仿真网卡。
                          </p>
                        </div>
                      )}
                      {activeN2nErrorCode === 'key_mismatch' && (
                        <div>
                          <strong className="text-red-700 font-bold">[诊断报错] Cipher verification failed / packet frame decryption mismatch</strong>
                          <p className="text-slate-500 mt-1">
                            <span className="font-bold text-slate-700">根源原因：</span> 您与好友输入的「大厅并网通信共享密码 (Key)」不一致，导致 N2N Edge 二层隧道在解密报包时因散列校验不符合而主动丢包断网。
                          </p>
                          <p className="text-slate-500">
                            <span className="font-bold text-amber-600">极速修复法：</span> 复制房主统一生成的特邀密码哈希，覆盖您本地设定中 Key 栏，确保全员大小写、减号完全对齐。
                          </p>
                        </div>
                      )}
                      {activeN2nErrorCode === 'room_invalid' && (
                        <div>
                          <strong className="text-red-700 font-bold">[诊断报错] Supernode reject: group name exceeds 16-byte limit / invalid characters detected</strong>
                          <p className="text-slate-500 mt-1">
                            <span className="font-bold text-slate-700">根源原因：</span> N2N 的社区账户房间参数最大仅允许 16 字节（且不可存储中文字符）。
                          </p>
                          <p className="text-slate-500">
                            <span className="font-bold text-amber-600">极速修复法：</span> 请将「Room Name」缩短到 4-12 位纯英文数字，不可带特殊标点或中文全角。
                          </p>
                        </div>
                      )}
                      {activeN2nErrorCode === 'supernode_offline' && (
                        <div>
                          <strong className="text-red-700 font-bold">[诊断报错] Resolve host timeout / cannot handshake on supernode port UDP</strong>
                          <p className="text-slate-500 mt-1">
                            <span className="font-bold text-slate-700">根源原因：</span> 底层中继节点超级握手站故障，或者被本机第三方防毒安全大管家阻断了对应的 UDP 出站端口。
                          </p>
                          <p className="text-slate-500">
                            <span className="font-bold text-amber-600">极速修复法：</span> 请退回「设置」面板，将超级中继节点地址换为备份端，例如 <code>backup.supernode.me:7778</code>，或者切入防火墙单列程序许可白放行。
                          </p>
                        </div>
                      )}
                      {activeN2nErrorCode === 'dhcp_failed' && (
                        <div>
                          <strong className="text-red-700 font-bold">[诊断报错] Subnet IP pool exhausted / requested virtual IPv4 exists with other nodes</strong>
                          <p className="text-slate-500 mt-1">
                            <span className="font-bold text-slate-700">根源原因：</span> 您手动分配的期望分配 IP（例如 <code>10.0.8.2</code>）目前正被该大厅中的其他玩家好友占用。
                          </p>
                          <p className="text-slate-500">
                            <span className="font-bold text-amber-600">极速修复法：</span> 请在「期望分配的 IP (Virtual IP)」框中留空。下一次连接时，系统会完美启用 DHCP 专属机制自动挑选无损的空闲 IP 分流绑定。
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedBackend === 'radmin' && (
              <div className="space-y-4 animate-fade-in text-xs font-sans">
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl">
                  <span className="font-bold text-indigo-700 block mb-1">💡 传统 Radmin VPN 大厅并嵌说明：</span>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    Radmin VPN 组网依赖于 Windows 特有服务控制栈。切换到此模式，联机助手前端将完美与您电脑上已运行的 Radmin VPN 后台服务代理钩子建立 API 对开。所有的 IP 会自动落入经典的 <strong>26.x.x.x 网域段</strong>（Radmin 的宿主物理绑定网卡段）。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1">
                    <label className="font-sans text-[10.5px] text-slate-400 font-bold pl-1">Radmin 网域虚拟大厅 ID (UUID / 房间名)</label>
                    <input
                      type="text"
                      className="bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-4 py-2.5 text-xs text-slate-700 outline-none transition-all font-mono"
                      defaultValue="c8e03b9f-8a21-4f99-9ea2-2b498f3cbb42"
                      placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-sans text-[10.5px] text-slate-400 font-bold pl-1">Radmin 房间进入通行密码</label>
                    <input
                      type="password"
                      className="bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-4 py-2.5 text-xs text-slate-700 outline-none transition-all"
                      defaultValue="123456"
                      placeholder="请输入房间密码"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedBackend === 'manual_lan' && (
              <div className="space-y-4 animate-fade-in text-xs font-sans">
                <div className="p-4 bg-amber-500/5 border border-amber-300/20 rounded-xl">
                  <strong className="text-amber-800 block mb-1">🛡️ 手动物理局域网网关免代理极速开联说明：</strong>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    当您与好友身处同一个<strong>真实局域网段下</strong>（如同一路由器、校园网宿舍同一路由器、或网吧处于相同交换机同子网 <code>192.168.1.x</code>）时，<strong>彻底无须任何 Edge / Radmin / 中继代理转发服务</strong>。
                    由于减少了虚拟 TAP 网卡的数据复制开销，联机延迟将达到可怕的 0.1ms ~ 1ms 本地传输极限！
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1">
                    <label className="font-sans text-[10.5px] text-slate-400 pr-1 pl-1">本机网卡真实局域网 IPv4 地址 (检测分配)</label>
                    <input
                      type="text"
                      readOnly
                      defaultValue="192.168.1.135"
                      className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 font-mono text-xs text-slate-500 outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-sans text-[10.5px] text-slate-400 pr-1 pl-1">指定局域网网卡接口直连绑定</label>
                    <select
                      className="bg-slate-50 border border-slate-200 text-xs text-slate-800 font-sans px-3 py-2.5 rounded-lg outline-none cursor-pointer"
                    >
                      <option>WiFi 无线模块：Intel Wi-Fi 6E AX211</option>
                      <option>有限网络主控：Realtek PCIe 2.5GbE Family Controller</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSaveConfig}
                className="px-5 py-2.5 rounded-lg bg-amber-500 text-amber-950 font-sans text-xs font-bold hover:bg-amber-450 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                保存基础参数
              </button>
            </div>
          </div>

          {/* 高级连接增强 */}
          <div className="bg-gradient-to-br from-slate-50 to-amber-50/20 rounded-2xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
              <Zap className="w-5 h-5 text-amber-500 animate-pulse" />
              <h4 className="font-heading text-sm font-bold text-slate-800">高级连接自愈与端口映射增强 (联机兼容修复)</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 text-xs">
              <div className="bg-white p-4 rounded-xl border border-slate-150/60 flex flex-col gap-2 shadow-sm transition-all hover:shadow-md">
                <span className="text-[10px] text-indigo-600 font-bold tracking-wider uppercase font-mono">游戏搜不到房间？</span>
                <p className="font-sans text-xs font-bold text-slate-800">推荐 UDP 广播桥</p>
                <p className="font-sans text-[11px] text-slate-500 leading-relaxed">
                  适用于《我的世界 (1.12及以下)》、《文明》、《红警》、《饥荒》等依赖 ARP 局域网组播的游戏，确保主机在联网大厅直接秒刷显示。
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-150/60 flex flex-col gap-2 shadow-sm transition-all hover:shadow-md">
                <span className="text-[10px] text-amber-600 font-bold tracking-wider uppercase font-mono">端口无法访问？</span>
                <p className="font-sans text-xs font-bold text-slate-800">推荐 TCP/UDP 端口代理</p>
                <p className="font-sans text-[11px] text-slate-500 leading-relaxed">
                  针对部分校园网络对 UDP 对称型 NAT 防火墙的主机丢包阻断，通过建立本机 127.0.0.1 映射管道进行高速打洞。
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-150/60 flex flex-col gap-2 shadow-sm transition-all hover:shadow-md">
                <span className="text-[10px] text-emerald-600 font-bold tracking-wider uppercase font-mono">不知道选哪个？</span>
                <p className="font-sans text-xs font-bold text-slate-800">去高级连接自测</p>
                <p className="font-sans text-[11px] text-slate-500 leading-relaxed">
                  提供一键链路探通测试、实时通过流量统计监控、以及完整的控制台日志调试流，秒级判断代理实例状况。
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white border border-slate-150 rounded-xl gap-4">
              <div className="flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-700 block">网络核心概念说明：</span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    <span className="font-semibold text-slate-700">通用组网中心</span> 旨在帮助您与异地好友成功搭建并运行一个基础局域网段；而 <span className="font-semibold text-slate-700">高级连接工具</span> 负责进一步对口修复特定联机游戏由于机制而造成的种种不兼容。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onUpdateState('currentTab', 'advanced_tools');
                  onTriggerToast('已跳转至 [高级连接工具] 自定代理及网桥网关面板');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-sans text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 self-end sm:self-center cursor-pointer shadow-sm shrink-0"
              >
                打开高级连接工具
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
