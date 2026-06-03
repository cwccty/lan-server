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
  PlayCircle
} from 'lucide-react';

interface RecommendProtocolViewProps {
  onTriggerToast: (msg: string) => void;
  onNavigateTab: (tab: any) => void;
}

export default function RecommendProtocolView({
  onTriggerToast,
  onNavigateTab
}: RecommendProtocolViewProps) {
  const [copiedPackage, setCopiedPackage] = useState(false);
  const [pingRecords, setPingRecords] = useState<string[]>([
    '> Ping 192.168.100.1',
    '> Reply from 192.168.100.1: bytes=32 time=12ms TTL=64',
    '> Reply from 192.168.100.1: bytes=32 time=14ms TTL=64',
    '> Reply from 192.168.100.1: bytes=32 time=11ms TTL=64',
    '> 延迟稳定，适合游戏。'
  ]);
  const [isRunningPing, setIsRunningPing] = useState(false);

  // Feature 7: Friend IP allocations & custom inviters state
  const [friends, setFriends] = useState([
    { id: 'f1', name: '老高 (TShock管理员)', ip: '10.0.8.2', status: 'online' },
    { id: 'f2', name: '阿炜 (群主力推神射手)', ip: '10.0.8.3', status: 'connecting' },
    { id: 'f3', name: '老章 (泰拉生存开拓者)', ip: '10.0.8.4', status: 'idle' }
  ]);
  const [friendNameInput, setFriendNameInput] = useState('');
  const [friendIpInput, setFriendIpInput] = useState('10.0.8.5');

  const [activeInvitationText, setActiveInvitationText] = useState(
    `[联机助手-邀请函]
网络名称: Terraria_Night_Squad
指定成员: 全员
分配虚拟 IP: 自动DHCP握手
群组通道密钥: a8f9-2b4c-99e1
--------------------
复制本邀请文本，在联机客户端一键并网加入游戏！`
  );

  const handleCopyInvitePackage = () => {
    navigator.clipboard.writeText(activeInvitationText);
    setCopiedPackage(true);
    onTriggerToast('游戏邀请凭证包已成功打包复制！快去发送给好友吧 🚀');
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
    
    // Auto increment IP for convenience
    const parts = friendIpInput.split('.');
    const lastNum = parseInt(parts[3]) || 5;
    setFriendIpInput(`10.0.8.${lastNum + 1}`);

    // Generate custom invitation text
    const customTxt = `[联机助手-专属密信邀请包]
收件友邻: ${newFriend.name}
分配专属虚拟 IP: ${newFriend.ip} (已在 Supernode 直通保留)
局域网内厅名: Terraria_Night_Squad
共享通道密钥: a8f9-2b4c-99e1
--------------------
用法: 复制此专属报包在客户端一键载入，直联成功率增加 99.8%！`;
    setActiveInvitationText(customTxt);
    setFriendNameInput('');
    onTriggerToast(`成功为 [${newFriend.name}] 独家分配直连虚拟IP: ${newFriend.ip}，已自适应定制专属邀请包！`);
  };

  const handleDeleteFriend = (id: string, name: string) => {
    setFriends(friends.filter(f => f.id !== id));
    onTriggerToast(`已成功回收好友 [${name}] 占用的局域网 IP 回落公池。`);
  };

  const handleSelectFriendInvite = (name: string, ip: string) => {
    const customTxt = `[联机助手-专属密信邀请包]
收件友邻: ${name}
分配专属虚拟 IP: ${ip} (已在 Supernode 直通保留)
局域网内厅名: Terraria_Night_Squad
共享通道密钥: a8f9-2b4c-99e1
--------------------
用法: 复制此专属报包在客户端一键载入，直联成功率增加 99.8%！`;
    setActiveInvitationText(customTxt);
    onTriggerToast(`已调取[${name}]的专属并网预流密码包，点击下方复制即可发送！`);
  };

  const handleRunPingTest = () => {
    if (isRunningPing) return;
    setIsRunningPing(true);
    onTriggerToast('正在实时连通测试本机与虚拟网桥对端延迟...');
    setPingRecords(['> Ping 192.168.100.1 - 启动新探测...']);
    
    setTimeout(() => {
      setPingRecords(prev => [...prev, '> Reply from 192.168.100.1: bytes=32 time=10ms TTL=64']);
    }, 400);
    setTimeout(() => {
      setPingRecords(prev => [...prev, '> Reply from 192.168.100.1: bytes=32 time=9ms TTL=64 (直连极速)']);
    }, 800);
    setTimeout(() => {
      setPingRecords(prev => [...prev, '> Reply from 192.168.100.1: bytes=32 time=12ms TTL=64', '> 探测结束。推荐开启UDP直连模式。']);
      setIsRunningPing(false);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div>
        <h2 className="font-heading text-2xl font-bold text-slate-800">推荐方案</h2>
        <p className="font-sans text-sm text-slate-500 mt-1">根据当前网络及防火墙环境，为您自适应定制的最优直连方案系统。</p>
      </div>

      {/* 4-Step Wizard */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
        {/* Shimmer background */}
        <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center justify-between relative z-10 gap-6 sm:gap-0">
          
          {/* Step 1 */}
          <div className="flex flex-col items-center flex-1 text-center w-full">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center font-sans text-xs font-bold mb-2 shadow-sm">
              <Check className="w-4 h-4" />
            </div>
            <span className="font-sans text-xs text-slate-800 font-semibold">环境检测</span>
          </div>

          {/* Divider line 1 */}
          <div className="hidden sm:block flex-1 h-[2px] bg-amber-200 mx-4" />

          {/* Step 2 */}
          <div className="flex flex-col items-center flex-1 text-center w-full">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center font-sans text-xs font-bold mb-2 shadow-sm">
              <Check className="w-4 h-4" />
            </div>
            <span className="font-sans text-xs text-slate-800 font-semibold">协议分配</span>
          </div>

          {/* Divider line 2 */}
          <div className="hidden sm:block flex-1 h-[2px] bg-amber-200 mx-4" />

          {/* Step 3 (Active) */}
          <div className="flex flex-col items-center flex-1 text-center w-full">
            <div className="w-8 h-8 rounded-full bg-white text-amber-600 border-2 border-amber-500 flex items-center justify-center font-heading text-xs font-bold mb-2 shadow-[0_0_15px_rgba(212,175,55,0.3)]">
              3
            </div>
            <span className="font-sans text-xs text-amber-600 font-bold">好友接入</span>
          </div>

          {/* Divider line 3 */}
          <div className="hidden sm:block flex-1 h-[2px] bg-slate-100 mx-4" />

          {/* Step 4 */}
          <div className="flex flex-col items-center flex-1 text-center w-full">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center font-heading text-xs font-bold mb-2">
              4
            </div>
            <span className="font-sans text-xs text-slate-400 font-medium">启动联机</span>
          </div>

        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Flow check status list */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Execution Checklist */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-amber-500" />
                执行状态
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-sans text-xs text-slate-700 font-medium">虚拟网卡初始化</span>
                  </div>
                  <span className="font-sans text-[11px] text-slate-400">完成</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-sans text-xs text-slate-700 font-medium">P2P 穿透尝试</span>
                  </div>
                  <span className="font-sans text-[11px] text-slate-400">成功 (直连)</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border-l-2 border-amber-500">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-amber-500 text-amber-600 flex items-center justify-center animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin-slow" />
                    </div>
                    <span className="font-sans text-xs text-amber-700 font-semibold">等待对端物理网接入</span>
                  </div>
                  <span className="font-sans text-[11px] text-amber-600 font-bold">进行中</span>
                </div>
              </div>
            </div>
          </div>

          {/* Connection Test Console */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-400" />
                虚拟网通透度测试
              </h3>
              <button
                onClick={handleRunPingTest}
                disabled={isRunningPing}
                className="text-[11px] text-amber-600 hover:text-amber-800 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRunningPing ? 'animate-spin' : ''}`} />
                重新测试
              </button>
            </div>
            
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-slate-200 leading-relaxed min-h-[120px] overflow-hidden relative shadow-inner">
              <div className="space-y-1.5">
                {pingRecords.map((line, i) => (
                  <p key={i} className={line.startsWith('>') && line.includes('Ping') ? 'text-amber-400 font-bold' : (line.includes('延迟稳定') || line.includes('直连') ? 'text-emerald-400' : 'text-slate-300')}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Node details & Credential package info */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Feature 7: 好友 IP 分配与邀请包 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-500 lg:animate-pulse" />
                虚拟网段与好友 IP 分配大厅
              </h3>
              <span className="bg-emerald-50 text-emerald-800 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                10.0.8.x 网桥
              </span>
            </div>

            {/* Local Host Row */}
            <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl justify-between items-start sm:items-center">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">我的并网虚拟 IP (服主主机)</span>
                <span className="font-mono text-sm font-bold text-slate-800">10.0.8.1 (直连主控入站)</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('10.0.8.1');
                  onTriggerToast('本机虚拟组网 IP 已成功载入剪切板！');
                }}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded text-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                复制主IP
              </button>
            </div>

            {/* Friend IP Allocation Add Form */}
            <form onSubmit={handleAddFriendIp} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-amber-500/5 border border-amber-300/20 rounded-xl">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-amber-900 font-bold">联机好友昵称</span>
                <input 
                  type="text" 
                  value={friendNameInput}
                  onChange={e => setFriendNameInput(e.target.value)}
                  placeholder="例如: 老王" 
                  className="px-2 py-1 bg-white border border-slate-200 rounded font-sans text-xs text-slate-700 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-amber-900 font-bold">独家直连 IP 预留</span>
                <input 
                  type="text" 
                  value={friendIpInput}
                  onChange={e => setFriendIpInput(e.target.value)}
                  placeholder="例如: 10.0.8.5" 
                  className="px-2 py-1 bg-white border border-slate-200 font-mono rounded text-xs text-slate-700 outline-none"
                />
              </div>
              <div className="flex items-end">
                <button 
                  type="submit" 
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 rounded text-xs cursor-pointer transition-colors"
                >
                  分配专属IP&包
                </button>
              </div>
            </form>

            {/* Friend IPs Allocation Grid list */}
            <div className="bg-white rounded-xl border border-slate-150 overflow-hidden shadow-sm">
              <div className="px-3 py-2 bg-slate-50 text-[10px] text-slate-500 font-bold border-b border-slate-150 flex justify-between">
                <span>分流中 of 友邻专属链路 (共 {friends.length} 人)</span>
                <span className="text-amber-600">双向对通阻抗良好</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[160px] overflow-y-auto">
                {friends.map(friend => (
                  <div key={friend.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{friend.name}</span>
                      <span className="font-mono text-[11px] text-slate-500 mt-0.5">分配IP: <strong className="text-slate-700">{friend.ip}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      {friend.status === 'online' && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[#0f5132] text-[10px] font-bold">在线</span>
                      )}
                      {friend.status === 'connecting' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-[#664d03] text-[10px] font-bold animate-pulse">测试中</span>
                      )}
                      {friend.status === 'idle' && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-150 text-slate-550 text-[10px]">就绪离线</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSelectFriendInvite(friend.name, friend.ip)}
                        className="text-amber-600 hover:text-amber-800 underline font-semibold ml-2 cursor-pointer"
                      >
                        生成包
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteFriend(friend.id, friend.name)}
                        className="text-rose-600 hover:text-rose-800 underline font-semibold cursor-pointer"
                      >
                        回收
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Invitation package info */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-heading text-sm font-bold text-slate-800">游戏网络邀请凭证包 (当前活动密信)</h3>
                <span className="text-[10.5px] text-slate-400 font-mono">MD5_ENC_SAD889</span>
              </div>
              
              <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 relative group min-h-[140px]">
                <button
                  onClick={handleCopyInvitePackage}
                  className="absolute top-2.5 right-2.5 p-2 bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 hover:text-amber-600 transition-all border border-slate-200 cursor-pointer"
                  title="复制凭证文本"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <pre className="font-mono text-xs leading-loose text-slate-600 select-all whitespace-pre-wrap">
                  {activeInvitationText}
                </pre>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <button
                onClick={handleCopyInvitePackage}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-sans text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                一键拷制专属密信包
              </button>
              <button
                onClick={() => onNavigateTab('network')}
                className="w-full py-3 bg-amber-500 hover:bg-amber-450 text-amber-950 rounded-lg font-sans text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                进入通用组网中心
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
