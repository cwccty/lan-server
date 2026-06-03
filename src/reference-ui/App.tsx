import { useState, useEffect } from 'react';
import { AppState, AppTab, NetworkStatus } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import HomeView from './components/HomeView';
import SolutionsView from './components/SolutionsView';
import GameScanView from './components/GameScanView';
import RecommendProtocolView from './components/RecommendProtocolView';
import UniversalNetworkView from './components/UniversalNetworkView';
import TerrariaGuideView from './components/TerrariaGuideView';
import DiagnosticsView from './components/DiagnosticsView';
import SettingsView from './components/SettingsView';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Gift, CheckCircle } from 'lucide-react';
import {
  getN2nDiagnostics,
  getN2nLastConfig,
  listNetworkBackends,
  readServerSession,
  setupNetwork,
  startNetwork,
  stopNetwork
} from '../api/tauri';
import type { N2nDiagnostics, NetworkConfig } from '../types/network';

function statusFromN2n(diagnostics: N2nDiagnostics | null): NetworkStatus {
  if (!diagnostics) return 'idle';
  if (diagnostics.ok_link) return 'online';
  if (diagnostics.running && (diagnostics.not_responding || diagnostics.auth_error || diagnostics.ip_mac_conflict)) return 'warning';
  if (diagnostics.running) return 'connecting';
  return 'idle';
}

export default function App() {
  // Global States
  const [state, setState] = useState<AppState>({
    currentTab: 'home',
    netStatus: 'idle',
    role: 'host',
    latency: 0,
    packetLoss: 0.0,
    localVirtualIp: '10.10.10.2',
    friendVirtualIp: '10.10.10.3',
    
    roomName: 'Terraria_Night_Squad',
    roomKey: 'lan-helper-secret',
    supernode: '',
    virtualIpInput: '10.10.10.2',
    gamePort: '7777',
    
    tcpProxy: false,
    udpProxy: false,
    udpBroadcastBridge: false,
    
    terrariaWorld: 'World_1 (大型 / 腐化 / 专家)',
    terrariaPort: 7777,
    terrariaPasswordInput: '',
    terrariaMaxPlayers: 8,
    terrariaRunning: false,
    terrariaLogs: [],
    
    edgePath: 'C:/Program Files/N2N/edge.exe',
    supernode_default: 'backup.supernode.me:7778',
    solutions_url: 'https://api.lianjizhushou.com/solutions/shared/v2'
  });

  // UI States
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [n2nDiagnostics, setN2nDiagnostics] = useState<N2nDiagnostics | null>(null);
  const [lastBackendError, setLastBackendError] = useState('');

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleTriggerToast = (msg: string) => {
    setToastMessage(msg);
  };

  const updateStateValue = (key: string, value: any) => {
    setState((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const refreshRuntimeState = async (showToast = false) => {
    try {
      const [diagnostics, backends, lastConfig, serverSession] = await Promise.all([
        getN2nDiagnostics().catch(() => null),
        listNetworkBackends().catch(() => []),
        getN2nLastConfig().catch(() => null),
        readServerSession().catch(() => null)
      ]);
      const n2nBackend = backends.find((backend) => backend.id === 'n2n');
      const nextVirtualIp = diagnostics?.virtual_ip || n2nBackend?.virtual_ip || lastConfig?.local_ip || state.localVirtualIp;
      const nextSupernode = diagnostics?.supernode || lastConfig?.supernode || state.supernode;
      setN2nDiagnostics(diagnostics);
      setLastBackendError('');
      setState((prev) => ({
        ...prev,
        netStatus: statusFromN2n(diagnostics),
        latency: diagnostics?.ok_link ? prev.latency || 1 : 0,
        localVirtualIp: nextVirtualIp || prev.localVirtualIp,
        virtualIpInput: lastConfig?.local_ip || nextVirtualIp || prev.virtualIpInput,
        roomName: lastConfig?.room_name || prev.roomName,
        roomKey: lastConfig?.secret || prev.roomKey,
        supernode: nextSupernode || prev.supernode,
        terrariaRunning: Boolean(serverSession?.running),
        terrariaLogs: serverSession?.logs ?? prev.terrariaLogs
      }));
      if (showToast) {
        handleTriggerToast(diagnostics?.summary || '已刷新真实后端状态。');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '读取后端状态失败');
      setLastBackendError(message);
      setState((prev) => ({ ...prev, netStatus: 'idle', latency: 0 }));
      if (showToast) handleTriggerToast(message);
    }
  };

  useEffect(() => {
    void refreshRuntimeState(false);
    const timer = window.setInterval(() => void refreshRuntimeState(false), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const handleToggleNetwork = async () => {
    if (state.netStatus === 'online' || n2nDiagnostics?.running) {
      updateStateValue('netStatus', 'connecting');
      handleTriggerToast('正在停止 n2n edge...');
      try {
        const result = await stopNetwork('n2n');
        handleTriggerToast(result.message || 'n2n edge 已停止。');
      } catch (error) {
        handleTriggerToast(error instanceof Error ? error.message : String(error || '停止 n2n 失败'));
      } finally {
        await refreshRuntimeState(false);
      }
      return;
    }

    const config: NetworkConfig = {
      room_name: state.roomName,
      secret: state.roomKey,
      supernode: state.supernode,
      local_ip: state.virtualIpInput || state.localVirtualIp
    };

    if (!config.room_name || !config.secret || !config.supernode || !config.local_ip) {
      updateStateValue('currentTab', 'network');
      handleTriggerToast('请先在通用组网中心填写 community、密钥、supernode 和本机虚拟 IP。');
      return;
    }

    updateStateValue('netStatus', 'connecting');
    handleTriggerToast('正在保存 n2n 配置并启动 edge...');
    try {
      await setupNetwork('n2n', config);
      const result = await startNetwork('n2n');
      handleTriggerToast(result.message || 'n2n edge 已启动，正在等待 supernode ACK/PONG。');
    } catch (error) {
      updateStateValue('netStatus', 'warning');
      handleTriggerToast(error instanceof Error ? error.message : String(error || '启动 n2n 失败'));
    } finally {
      await refreshRuntimeState(false);
    }
  };

  const handleOpenDiagnostics = () => {
    updateStateValue('currentTab', 'diagnostics');
    handleTriggerToast('正在跳转配置，加载本地故障检查单...');
  };

  return (
    <div className="min-h-screen bg-slate-100/40 text-slate-700 font-sans selection:bg-amber-500/20 selection:text-amber-900 selection:antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={state.currentTab}
        onChangeTab={(tab) => {
          updateStateValue('currentTab', tab);
          handleTriggerToast(`切换至面板: ${
            tab === 'home' ? '首页' :
            tab === 'solutions' ? '方案库' :
            tab === 'games' ? '游戏扫描' :
            tab === 'protocol' ? '推荐方案' :
            tab === 'network' ? '通用组网中心' :
            tab === 'terraria' ? 'Terraria 向导' :
            tab === 'diagnostics' ? '诊断报告' : '设置与帮助'
          }`);
        }}
        status={state.netStatus}
        onShowVersion={() => setShowVersionModal(true)}
      />

      {/* Header Panel */}
      <Header
        netStatus={state.netStatus}
        latency={state.latency}
        onToggleNetwork={handleToggleNetwork}
        onOpenDiagnostics={handleOpenDiagnostics}
        onTabChange={(tab) => {
          updateStateValue('currentTab', tab);
        }}
      />

      {/* Main Content Render area */}
      <main className="ml-[260px] pt-24 px-8 pb-12 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-7xl mx-auto"
          >
            {state.currentTab === 'home' && (
              <HomeView
                netStatus={state.netStatus}
                role={state.role}
                onRoleChange={(role) => updateStateValue('role', role)}
                onNavigateTab={(tab) => updateStateValue('currentTab', tab)}
                onTriggerToast={handleTriggerToast}
                localIp={state.localVirtualIp}
                latency={state.latency}
                supernode={state.supernode}
                backendHint={lastBackendError || n2nDiagnostics?.summary || ''}
              />
            )}

            {state.currentTab === 'solutions' && (
              <SolutionsView
                onTriggerToast={handleTriggerToast}
                solutionsUrl={state.solutions_url}
                onUpdateSolutionsUrl={(url) => updateStateValue('solutions_url', url)}
              />
            )}

            {state.currentTab === 'games' && (
              <GameScanView
                onTriggerToast={handleTriggerToast}
                onNavigateTab={(tab) => updateStateValue('currentTab', tab)}
              />
            )}

            {state.currentTab === 'protocol' && (
              <RecommendProtocolView
                onTriggerToast={handleTriggerToast}
                onNavigateTab={(tab) => updateStateValue('currentTab', tab)}
              />
            )}

            {state.currentTab === 'network' && (
              <UniversalNetworkView
                onTriggerToast={handleTriggerToast}
                roomName={state.roomName}
                roomKey={state.roomKey}
                supernode={state.supernode}
                virtualIpInput={state.virtualIpInput}
                gamePort={state.gamePort}
                tcpProxy={state.tcpProxy}
                udpProxy={state.udpProxy}
                udpBroadcastBridge={state.udpBroadcastBridge}
                onUpdateState={updateStateValue}
              />
            )}

            {state.currentTab === 'terraria' && (
              <TerrariaGuideView
                onTriggerToast={handleTriggerToast}
                terrariaWorld={state.terrariaWorld}
                terrariaPort={state.terrariaPort}
                terrariaPasswordInput={state.terrariaPasswordInput}
                terrariaMaxPlayers={state.terrariaMaxPlayers}
                terrariaRunning={state.terrariaRunning}
                terrariaLogs={state.terrariaLogs}
                onUpdateState={updateStateValue}
                localIp={state.localVirtualIp}
              />
            )}

            {state.currentTab === 'diagnostics' && (
              <DiagnosticsView onTriggerToast={handleTriggerToast} />
            )}

            {state.currentTab === 'settings' && (
              <SettingsView
                onTriggerToast={handleTriggerToast}
                edgePath={state.edgePath}
                supernode_default={state.supernode_default}
                onUpdateState={updateStateValue}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global Interactive Float Toasts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-6 z-[600] bg-slate-900 border border-slate-800 text-white font-sans text-xs px-5 py-3 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex items-center gap-3 max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <span className="leading-normal font-sans pr-4">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white transition-colors ml-auto cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Version update announcement Overlay Modal */}
      <AnimatePresence>
        {showVersionModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVersionModal(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />

            {/* Modal Dialog Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden font-sans z-10"
            >
              {/* Top Banner decoration */}
              <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-amber-505/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shadow-sm">
                    <Sparkles className="w-5 h-5 animate-spin-slow" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-bold text-slate-800">联机助手 V2.4.1 版本更新</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">发布日期: 2026年6月3日</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVersionModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Version details accordion body */}
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                <div>
                  <h4 className="font-sans font-bold text-xs text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    【全新功能】泰拉拼星开服巫师正式上线
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                    基于 TShock 与 Vanilla 核心的一键配置局域网开服向导。免繁杂命令行，多玩家直连握手，高同步并网传输延迟低至 12ms。
                  </p>
                </div>

                <div className="h-px bg-slate-100" />

                <div>
                  <h4 className="font-sans font-bold text-xs text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    【网络穿透】UPnP 穿透映射与多超级中继池
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                    优化了 UDP 穿透率和 ARP 广播桥，支持复杂对称防火墙 P2P 智能中转，让局域网游戏大厅可见率跨市互联。
                  </p>
                </div>

                <div className="h-px bg-slate-100" />

                <div>
                  <h4 className="font-sans font-bold text-xs text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Gift className="w-3.5 h-3.5 text-amber-500" />
                    【系统自愈】自动化修复 TAP 虚拟适配器
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-5">
                    支持在诊断页面下「一键修复」适配器挂载超时与 IP 地址绑定挂载报错等传统老难疑痼疾。
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => {
                    setShowVersionModal(false);
                    handleTriggerToast('已开启最新内核下载流！详情参看系统主日志。');
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-sans text-xs font-semibold rounded-xl text-center transition-colors cursor-pointer"
                >
                  一键更新核心
                </button>
                <button
                  onClick={() => setShowVersionModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-sans text-xs font-semibold rounded-xl text-center transition-colors cursor-pointer"
                >
                  再想想
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
