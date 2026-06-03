import { useState, useEffect, FormEvent } from 'react';
import {
  Check,
  CheckCircle,
  Clock,
  Copy,
  Share2,
  ArrowRight,
  RefreshCw,
  Terminal,
  Activity,
  PlayCircle,
  Gamepad2,
  Settings,
  HelpCircle,
  UserCheck,
  ShieldCheck,
  Sliders,
  Play
} from 'lucide-react';

interface RecommendProtocolViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

interface GameProfile {
  id: string;
  name: string;
  networkType: string;
  canConvertToLan: string;
  riskLevel: '低 (Low)' | '中 (Medium)' | '高 (High)';
  adapterSource: string;
  requiresVirtualLan: boolean;
  requiresCustomServer: boolean;
  requiresTcpUdpProxy: boolean;
  requiresUdpBroadcastBridge: boolean;
  hostInstructions: string;
  joinInstructions: string;
  defaultPort: string;
  defaultPath: string;
  defaultIp: string;
  argsTemplate: string;
}

const GAME_PROFILES: Record<string, GameProfile> = {
  palworld: {
    id: 'palworld',
    name: '幻兽帕鲁 (Palworld)',
    networkType: '专用伺服服务端分权架构 (Dedicated Server)',
    canConvertToLan: '可完美转换为局域网直通联机',
    riskLevel: '低 (Low)',
    adapterSource: '联机助手官方云端固化库 (Official Cloud)',
    requiresVirtualLan: true,
    requiresCustomServer: true,
    requiresTcpUdpProxy: true,
    requiresUdpBroadcastBridge: false,
    hostInstructions: '1. 拉起本机帕鲁服务端，默认监听端口为 8211 (UDP)；\n2. 点击联机助手「通用组网中心」加入虚拟房间取得并网 IP；\n3. 启动帕鲁客户端游戏，在专用服地址栏中直连您本机的 10.0.8.* 虚拟网卡 IP；',
    joinInstructions: '1. 复制好友房主发给您的特邀密信；\n2. 载入并网设置后启动游戏，点击「加入多人游戏(专用服务器)」；\n3. 输入房主的 10.0.8.* IP 地址，尾部跟上端口 :8211 即可飞速秒连加入！',
    defaultPort: '8211',
    defaultPath: 'D:/PalServer/Pal/Binaries/Win64/PalServer-Win64-Shipping.exe',
    defaultIp: '10.0.8.1',
    argsTemplate: '-port=8211 -players=16 -useperfthreads -NoSteam'
  },
  terraria: {
    id: 'terraria',
    name: '泰拉瑞亚 (Terraria V1.4)',
    networkType: 'P2P 局域网大厅/单独伺服混合体系 (Host-Client P2P)',
    canConvertToLan: '支持虚拟网卡一键强转局域网大厅可见',
    riskLevel: '中 (Medium)',
    adapterSource: '联机助手官方专属优化示例 (Example Guide)',
    requiresVirtualLan: true,
    requiresCustomServer: false,
    requiresTcpUdpProxy: false,
    requiresUdpBroadcastBridge: true,
    hostInstructions: '1. 打开 Terraria 游戏，选择角色后，点击「多人游戏」->「开机并托管游戏」；\n2. 设置世界密码（可选）与游戏端口：默认 7777；\n3. 通过联机助手分配好友专属 IP 保护连通概率；',
    joinInstructions: '1. 复制房主 Terraria 特邀序列密信，加入虚拟网网；\n2. 在游戏主面板点击「多人游戏」->「通过 IP 加入世界」；\n3. 连接目标输入 10.0.8.* 以及端口 7777 即可痛快并网。',
    defaultPort: '7777',
    defaultPath: 'C:/Program Files/Steam/steamapps/common/Terraria/Terraria.exe',
    defaultIp: '10.0.8.1',
    argsTemplate: '-port 7777 -players 8 -autocreate 3 -config serverconfig.txt'
  },
  minecraft: {
    id: 'minecraft',
    name: '我的世界 (Minecraft 局域网广播版)',
    networkType: '本地 ARP 监听与 SSDP 大厅反射架构 (LAN Broadcast)',
    canConvertToLan: '需要 UDP 广播重排列才可在好友列表显示大厅游戏',
    riskLevel: '低 (Low)',
    adapterSource: '共享库同步注册节点 (Shared Registry Cache)',
    requiresVirtualLan: true,
    requiresCustomServer: false,
    requiresTcpUdpProxy: false,
    requiresUdpBroadcastBridge: true,
    hostInstructions: '1. 进入您的 Minecraft 单人世界，点击 ESC 键唤出选项菜单并选择「对局域网开放」；\n2. 记住游戏系统左下角随即输出生成的本地动态端口 (例如 53215)；\n3. 在「高级连接工具」中开启对应本地端口的 UDP 桥接注入转发。',
    joinInstructions: '1. 使用联机助手一键并网并开启 Broadcast Bridge 网桥监听信号；\n2. 全程免输入 IP：开启客户端游戏并点击「多人游戏」，大厅底部房源区会自动刷新出现您的局域网大厅主机！；\n3. 双击直接瞬间并入世界游戏！',
    defaultPort: '25565',
    defaultPath: 'C:/Minecraft/HMCL.exe',
    defaultIp: '10.0.8.1',
    argsTemplate: '--p2p-redirect-port 25565 --multicast-ttl 3 --aggressive-broadcast'
  }
};

export default function RecommendProtocolView({
  onTriggerToast,
  onNavigateTab
}: RecommendProtocolViewProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('palworld');
  const activeProfile = GAME_PROFILES[selectedProfileId] || GAME_PROFILES.palworld;

  // Custom launch profile states (Item 3.8)
  const [execPath, setExecPath] = useState(activeProfile.defaultPath);
  const [runArgs, setRunArgs] = useState(activeProfile.argsTemplate);
  const [maxPlayers, setMaxPlayers] = useState('16');
  const [silentMode, setSilentMode] = useState(false);

  // Sync state values when profile changes
  useEffect(() => {
    setExecPath(activeProfile.defaultPath);
    setRunArgs(activeProfile.argsTemplate);
  }, [selectedProfileId]);

  const [copiedPackage, setCopiedPackage] = useState(false);
  const [pingRecords, setPingRecords] = useState<string[]>([
    '> Ping 10.0.8.1',
    '> Reply from 10.0.8.1: bytes=32 time=12ms TTL=64',
    '> Reply from 10.0.8.1: bytes=32 time=14ms TTL=64',
    '> Reply from 10.0.8.1: bytes=32 time=11ms TTL=64',
    '> 延迟响应良好，抖动在 1ms 左右。'
  ]);
  const [isRunningPing, setIsRunningPing] = useState(false);

  // Friend list state
  const [friends, setFriends] = useState([
    { id: 'f1', name: '老高 (TShock管理员)', ip: '10.0.8.2', status: 'online' },
    { id: 'f2', name: '阿炜 (群主力推神射手)', ip: '10.0.8.3', status: 'connecting' },
    { id: 'f3', name: '老章 (生存模组开拓者)', ip: '10.0.8.4', status: 'idle' }
  ]);
  const [friendNameInput, setFriendNameInput] = useState('');
  const [friendIpInput, setFriendIpInput] = useState('10.0.8.5');

  // Custom Invitation Text state
  const [activeInvitationText, setActiveInvitationText] = useState('');

  // Auto regenerate invite message when friends list or profile changes
  useEffect(() => {
    const inviteText = `[联机助手-专属特邀并网信]
游戏方案: ${activeProfile.name}
默认端口: ${activeProfile.defaultPort}
房主IP: 10.0.8.1 (直通分配端)
中继密钥: a8f9-2b4c-99e1

[用法指南]
房主端指示:\n${activeProfile.hostInstructions}\n
客方专属步骤:\n${activeProfile.joinInstructions}
--------------------
复制本报包直接在联机助手载入，一键并网穿透极速直连！`;
    setActiveInvitationText(inviteText);
  }, [selectedProfileId, friends]);

  const handleCopyInvitePackage = () => {
    navigator.clipboard.writeText(activeInvitationText);
    setCopiedPackage(true);
    onTriggerToast(`游戏 [${activeProfile.name}] 专属局域网特邀包成套拷贝成功！快发给群友吧🚀`);
    setTimeout(() => setCopiedPackage(false), 3000);
  };

  const handleAddFriendIp = (e: FormEvent) => {
    e.preventDefault();
    if (!friendNameInput.trim()) {
      onTriggerToast('请输入好友的联机昵称！');
      return;
    }
    if (!friendIpInput.startsWith('10.0.8.')) {
      onTriggerToast('虚拟IP必须处于 10.0.8.* 局域网段内！');
      return;
    }
    const isIpExists = friends.some(f => f.ip === friendIpInput);
    if (isIpExists) {
      onTriggerToast(`虚拟IP地址 ${friendIpInput} 已被分配，不可重复占用！`);
      return;
    }

    const newFriend = {
      id: `friend_${Date.now()}`,
      name: friendNameInput.trim(),
      ip: friendIpInput,
      status: 'connecting' as const
    };
    setFriends([...friends, newFriend]);
    
    // Auto increment IP
    const parts = friendIpInput.split('.');
    const lastNum = parseInt(parts[3]) || 5;
    setFriendIpInput(`10.0.8.${lastNum + 1}`);

    const customTxt = `[联机助手-个人直通特邀信]
收件友邻: ${newFriend.name}
适配方案: ${activeProfile.name}
专属直达 IP: ${newFriend.ip} (已在 Supernode 云端锁定预留)
公网握手密钥: a8f9-2b4c-99e1
房主IP地址: 10.0.8.1
目标游戏端口: ${activeProfile.defaultPort}
--------------------
联机用法：复制当前局域网报包在客户端一键载入，直联秒见大厅房源，无重发丢包困扰！`;
    
    setActiveInvitationText(customTxt);
    setFriendNameInput('');
    onTriggerToast(`已独家为 [${newFriend.name}] 锁定保留虚拟IP ${newFriend.ip}，定制特邀函就绪！`);
  };

  const handleDeleteFriend = (id: string, name: string) => {
    setFriends(friends.filter(f => f.id !== id));
    onTriggerToast(`已成功回收好友 [${name}] 占用的虚拟 IP，空闲归还池核心。`);
  };

  const handleSelectFriendInvite = (name: string, ip: string) => {
    const customTxt = `[联机助手-个人直通特邀信]
收件友邻: ${name}
适配方案: ${activeProfile.name}
专属直达 IP: ${ip} (已在 Supernode 云云端中继中留用)
公网握手密钥: a8f9-2b4c-99e1
房主虚拟IP: 10.0.8.1
连接对开端口: ${activeProfile.defaultPort}
--------------------
联机说明：复制这段专属报包一键加入并网。`;
    setActiveInvitationText(customTxt);
    onTriggerToast(`已载入好友 [${name}] 的个性化并网配置邀请凭证！`);
  };

  const handleRunPingTest = () => {
    if (isRunningPing) return;
    setIsRunningPing(true);
    onTriggerToast(`正在使用 N2N 二层协议探测网段 IP 握手延迟...`);
    setPingRecords(['> Ping 10.0.8.1 - 启动底层连通度探测...']);
    
    setTimeout(() => {
      setPingRecords(prev => [...prev, '> Reply from 10.0.8.1: bytes=32 time=9ms TTL=128']);
    }, 400);
    setTimeout(() => {
      setPingRecords(prev => [...prev, '> Reply from 10.0.8.2: bytes=32 time=13ms TTL=128 (直连P2P)']);
    }, 800);
    setTimeout(() => {
      setPingRecords(prev => [...prev, '> Reply from 10.0.8.3: bytes=32 time=21ms TTL=128 (中继Relay)', '> 探测结束。网段平均连通通透率 >= 99.7%。']);
      setIsRunningPing(false);
    }, 1200);
  };

  const handleLaunchGameSubprocess = () => {
    onTriggerToast('正在挂联并安全拉起联机应用运行环境...');
    setTimeout(() => {
      onTriggerToast(`[引擎拉起成功] 命令已向物理进程注入：\n${execPath} ${runArgs}`);
    }, 1000);
  };

  // Synthesize launch command live string
  const synthesizedCommand = `"${execPath}" ${runArgs} -maxplayers=${maxPlayers} ${silentMode ? '-headless -silent' : ''}`;

  return (
    <div className="space-y-6">
      {/* Header with Switcher option (Item 3.3) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">推荐方案与向导</h2>
          <p className="font-sans text-sm text-slate-500 mt-1">根据当前底层组网物理架构和拟联机的游戏分析，生成定制的联机策略。</p>
        </div>

        {/* Quick selector of Profiles */}
        <div className="flex items-center gap-2 font-sans text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
          <Gamepad2 className="w-4 h-4 text-amber-500 animate-pulse" />
          <span className="font-semibold text-slate-500">拟联机分析目标:</span>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
          >
            <option value="palworld">幻兽帕鲁 (Dedicated Server)</option>
            <option value="terraria">泰拉瑞亚 (Host-Client P2P)</option>
            <option value="minecraft">我的世界 (LAN Broadcast)</option>
          </select>
        </div>
      </div>

      {/* 4-Step Wizard */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center justify-between relative z-10 gap-6 sm:gap-0">
          <div className="flex flex-col items-center flex-1 text-center w-full">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center font-sans text-xs font-bold mb-2 shadow-sm">
              <Check className="w-4 h-4" />
            </div>
            <span className="font-sans text-xs text-slate-800 font-semibold">环境探测分析</span>
          </div>
          <div className="hidden sm:block flex-1 h-[2px] bg-amber-200 mx-4" />
          <div className="flex flex-col items-center flex-1 text-center w-full">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center font-sans text-xs font-bold mb-2 shadow-sm">
              <Check className="w-4 h-4" />
            </div>
            <span className="font-sans text-xs text-slate-800 font-semibold">自洽方案规划</span>
          </div>
          <div className="hidden sm:block flex-1 h-[2px] bg-amber-200 mx-4" />
          <div className="flex flex-col items-center flex-1 text-center w-full">
            <div className="w-8 h-8 rounded-full bg-white text-amber-600 border-2 border-amber-500 flex items-center justify-center font-heading text-xs font-bold mb-2 shadow-[0_0_15px_rgba(212,175,55,0.3)]">
              3
            </div>
            <span className="font-sans text-xs text-amber-600 font-bold">好友分流接入中</span>
          </div>
          <div className="hidden sm:block flex-1 h-[2px] bg-slate-100 mx-4" />
          <div className="flex flex-col items-center flex-1 text-center w-full">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center font-heading text-xs font-bold mb-2">
              4
            </div>
            <span className="font-sans text-xs text-slate-400 font-medium">开玩拉起联机</span>
          </div>
        </div>
      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Game analysis results and customization */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Card 1: Game network analysis profile (Item 3.3) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4 text-xs">
            <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
              <ShieldCheck className="w-4 h-4 text-amber-500 animate-pulse" />
              联机物理特征认定 (Recommend Profile)
            </h3>

            <div className="space-y-3 font-sans">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                <span className="text-slate-400">底层并网架构 (Network Type)</span>
                <span className="font-semibold text-slate-700">{activeProfile.networkType}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                <span className="text-slate-400">大厅穿透评级 (LAN Convertrability)</span>
                <span className="font-semibold text-emerald-600">{activeProfile.canConvertToLan}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                <span className="text-slate-400">防火墙兼容风险 (Risk Level)</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  activeProfile.riskLevel.includes('低') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>{activeProfile.riskLevel}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                <span className="text-slate-400">认定规则包来源 (Schema Source)</span>
                <span className="font-mono text-[10px] font-semibold text-slate-500">{activeProfile.adapterSource}</span>
              </div>
            </div>

            {/* Matrix of Requirements toggles */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className={`p-2 rounded-xl border text-center transition-all ${activeProfile.requiresVirtualLan ? 'border-amber-200 bg-amber-500/5 text-amber-900 font-bold' : 'border-slate-100 text-slate-350 opacity-50'}`}>
                虚拟局域网 (Virtual-LAN)
              </div>
              <div className={`p-2 rounded-xl border text-center transition-all ${activeProfile.requiresCustomServer ? 'border-amber-200 bg-amber-500/5 text-amber-900 font-bold' : 'border-slate-100 text-slate-350 opacity-50'}`}>
                专属服务端启动 (Server)
              </div>
              <div className={`p-2 rounded-xl border text-center transition-all ${activeProfile.requiresTcpUdpProxy ? 'border-amber-200 bg-amber-500/5 text-amber-900 font-bold' : 'border-slate-100 text-slate-350 opacity-50'}`}>
                TCP/UDP直通代理 (Proxy)
              </div>
              <div className={`p-2 rounded-xl border text-center transition-all ${activeProfile.requiresUdpBroadcastBridge ? 'border-amber-200 bg-amber-500/5 text-amber-900 font-bold' : 'border-slate-100 text-slate-350 opacity-50'}`}>
                组播广播网桥 (Bridge)
              </div>
            </div>
          </div>

          {/* Card 2: Launch customization inputs (Item 3.8) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4 text-xs font-sans">
            <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
              <Sliders className="w-4 h-4 text-amber-500" />
              游戏启动参数自调节 (launch_profile)
            </h3>

            <div className="space-y-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold pl-1">游戏客户端/服务端本地物理路径</label>
                <input 
                  type="text"
                  value={execPath}
                  onChange={(e) => setExecPath(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-3 py-2 text-[10.5px] font-mono outline-none text-slate-600 truncate"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-semibold pl-1">并网重定向命令行参数 (Launch Arguments)</label>
                <input 
                  type="text"
                  value={runArgs}
                  onChange={(e) => setRunArgs(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg px-3 py-2 text-[10.5px] font-mono outline-none text-slate-600"
                />
              </div>

              {/* Grid of helpers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-semibold pl-1">大厅最游玩人数上限</label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-sans cursor-pointer outline-none"
                  >
                    <option value="4">4人小队多人大厅</option>
                    <option value="8">8人中大型沙盒组</option>
                    <option value="16">16人官方标准服务器</option>
                    <option value="32">32人大型战区世界</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-4 pl-2 select-none">
                  <input
                    type="checkbox"
                    id="silent_mode"
                    checked={silentMode}
                    onChange={(e) => setSilentMode(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-450 border-slate-350 cursor-pointer"
                  />
                  <label htmlFor="silent_mode" className="text-slate-500 cursor-pointer text-[11px] font-semibold">无窗口静默并网</label>
                </div>
              </div>

              {/* Synthesized Output command terminal block */}
              <div className="space-y-1.5 pt-1">
                <span className="text-slate-400 pl-1 block font-bold text-[10px] uppercase tracking-wider">合成启动命令预览 (Raw Shell Command)</span>
                <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl font-mono text-[10px] text-indigo-300 break-all select-all shadow-inner leading-relaxed">
                  {synthesizedCommand}
                </div>
              </div>

              {/* Trigger local process simulator button */}
              <button
                onClick={handleLaunchGameSubprocess}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 text-slate-950 font-sans font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                立即启动本地游戏实体
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Connection Steps and Invitations */}
        <div className="lg:col-span-7 flex flex-col gap-6 font-sans text-xs">
          
          {/* Action Step Guidelines for Server and Clients (Item 3.3) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
              <UserCheck className="w-4.5 h-4.5 text-amber-500" />
              联机互通双向指南 (Connection Role Mapping)
            </h3>

            {/* Split layout: Host vs Partner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Server Role column */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                  您作为：房主 / 主控制服务端步骤 (Host Role)
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed font-sans whitespace-pre-line mt-2">
                  {activeProfile.hostInstructions}
                </p>
              </div>

              {/* Client Role column */}
              <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2">
                <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                  好友作为：加入端 / 客机步骤 (Guest Join Role)
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed font-sans whitespace-pre-line mt-2">
                  {activeProfile.joinInstructions}
                </p>
              </div>
            </div>
          </div>

          {/* Friend IP and invitation box */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-500" />
                虚拟网段与好友 IP 分配大厅
              </h3>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                虚拟网段: 10.0.8.x
              </span>
            </div>

            {/* Host IP card */}
            <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
              <div>
                <span className="text-[9.5px] text-slate-400 block font-semibold">本机并网虚拟 IP (作为联机根源节点)</span>
                <span className="font-mono text-sm font-bold text-slate-800">10.0.8.1</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('10.0.8.1');
                  onTriggerToast('本机虚拟组网 IP 已成功载入剪切板！');
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" />
                复制
              </button>
            </div>

            {/* Allocation Input Form */}
            <form onSubmit={handleAddFriendIp} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-amber-500/5 border border-amber-300/20 rounded-xl font-sans">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-amber-900 font-bold">联机好友昵称</span>
                <input 
                  type="text" 
                  value={friendNameInput}
                  onChange={e => setFriendNameInput(e.target.value)}
                  placeholder="例如: 隔壁老王" 
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-amber-900 font-bold">专属 IP 地址分配预留</span>
                <input 
                  type="text" 
                  value={friendIpInput}
                  onChange={e => setFriendIpInput(e.target.value)}
                  placeholder="例如: 10.0.8.5" 
                  className="px-2.5 py-1.5 bg-white border border-slate-200 font-mono rounded-lg text-xs text-slate-700 outline-none"
                />
              </div>
              <div className="flex items-end">
                <button 
                  type="submit" 
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg cursor-pointer transition-colors"
                >
                  分配并生成推荐信
                </button>
              </div>
            </form>

            {/* Friend IP items Grid list */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-3 py-2 bg-slate-50 text-[10px] text-slate-500 font-bold border-b border-slate-200 flex justify-between">
                <span>直连链路好友并网席数 (共 {friends.length} 人)</span>
                <span className="text-amber-600">已开通 N2N 云中继保障</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[140px] overflow-y-auto">
                {friends.map(friend => (
                  <div key={friend.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{friend.name}</span>
                      <span className="font-mono text-[10.5px] text-slate-500 mt-0.5">预留 IPv4: <strong className="text-slate-700">{friend.ip}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      {friend.status === 'online' && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold">活跃在线</span>
                      )}
                      {friend.status === 'connecting' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-amber-800 text-[10px] font-bold animate-pulse">握手自测</span>
                      )}
                      {friend.status === 'idle' && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px]">就绪等待</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSelectFriendInvite(friend.name, friend.ip)}
                        className="text-amber-600 hover:text-amber-800 font-semibold ml-2 text-[11px] cursor-pointer"
                      >
                        生存邀请包
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteFriend(friend.id, friend.name)}
                        className="text-rose-600 hover:text-rose-800 font-semibold text-[11px] cursor-pointer"
                      >
                        回收席位
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite Text card with pre content */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 relative group space-y-3.5 mt-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800 text-xs">大厅并网一键式特邀序列报盘包</h4>
                <button
                  onClick={handleCopyInvitePackage}
                  className="p-1.5 bg-white rounded-lg shadow-sm hover:text-amber-600 border border-slate-200 transition-colors cursor-pointer"
                  title="拷贝邀请文本"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <pre className="font-mono text-[11px] leading-relaxed text-slate-500 whitespace-pre-wrap select-all max-h-[140px] overflow-y-auto">
                {activeInvitationText}
              </pre>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleCopyInvitePackage}
                  className="py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  复制完整邀请凭证包
                </button>
                <button
                  onClick={() => onNavigateTab('network')}
                  className="py-2 bg-amber-500 hover:bg-amber-450 text-amber-950 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  开启通用并网中心
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Test console & Execution details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Execution list */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-2">
                <h4 className="font-bold text-slate-700 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-500 animate-pulse" />
                  局域网隧道状态监测 (Tunnel Monitor)
                </h4>
                <ul className="space-y-2 font-medium text-slate-500 leading-normal">
                  <li className="flex justify-between items-center py-1 border-b border-slate-150/40">
                    <span>N2N TAP 虚拟驱动设备</span> <span className="text-emerald-600 font-bold">CONNECTED 良好</span>
                  </li>
                  <li className="flex justify-between items-center py-1 border-b border-slate-150/40">
                    <span>P2P 穿透握手状态</span> <span className="text-emerald-600 font-bold">DIRECT 直连连通 (延迟 12ms)</span>
                  </li>
                  <li className="flex justify-between items-center py-1 border-b border-slate-150/40">
                    <span>阻抗抖动系数</span> <span className="text-emerald-600 font-bold">稳态达标 (0.8%)</span>
                  </li>
                </ul>
              </div>

              {/* Ping tool mini */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1">
                    <Terminal className="w-4 h-4 text-slate-400" />
                    延迟测试通道 (Ping Host)
                  </h4>
                  <button
                    onClick={handleRunPingTest}
                    disabled={isRunningPing}
                    className="text-[10px] text-amber-700 hover:text-amber-950 font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRunningPing ? 'animate-spin' : ''}`} />
                    探测
                  </button>
                </div>
                <div className="bg-slate-900 rounded-lg p-2 font-mono text-[10px] text-slate-200 leading-relaxed max-h-[85px] overflow-y-auto">
                  {pingRecords.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
