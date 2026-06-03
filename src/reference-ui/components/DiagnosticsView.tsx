import { useState } from 'react';
import { INITIAL_DIAGNOSTICS, INITIAL_TIMELINE, RAW_JSON_REPORT } from '../data';
import { DiagnosticItem, TimelineEvent } from '../types';
import {
  Activity,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Terminal,
  RefreshCw,
  Cpu,
  ShieldAlert,
  Sliders,
  Copy
} from 'lucide-react';

interface DiagnosticsViewProps {
  onTriggerToast: (msg: string) => void;
}

export default function DiagnosticsView({ onTriggerToast }: DiagnosticsViewProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>(INITIAL_DIAGNOSTICS);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(INITIAL_TIMELINE);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [repairingId, setRepairingId] = useState<string | null>(null);

  // Feature 10: Cache support
  const [lastDiagnosisTime, setLastDiagnosisTime] = useState('2026-06-03 14:32:45');

  const handleStartDiagnosis = () => {
    setIsDiagnosing(true);
    onTriggerToast('正在部署底层测试套件进行本地链路和驱动安全核验并刷新缓存，请稍候...');

    // Simulate updating log steps
    setTimeout(() => {
      setTimeline((prev) => [
        {
          time: new Date().toLocaleTimeString(),
          title: '全面深度重新扫描...',
          details: '强制绕过本地缓存，真实拉取底层注册驱动和 Supernode 连接握手测试。',
          status: 'info'
        },
        ...prev
      ]);
    }, 500);

    setTimeout(() => {
      setIsDiagnosing(false);
      const now = new Date();
      setLastDiagnosisTime(now.toLocaleString());
      setTimeline((prev) => [
        {
          time: now.toLocaleTimeString(),
          title: '实时链路缓存重建就绪',
          details: '物理链路极速核减完成，本地虚拟网络适配器已完全对齐。',
          status: 'success'
        },
        ...prev
      ]);
      onTriggerToast('强制重扫及缓存重载自检完毕！链路连接良好。');
    }, 1500);
  };

  const handleExportJson = () => {
    navigator.clipboard.writeText(RAW_JSON_REPORT);
    onTriggerToast('JSON 异常诊断清单已完整拷入系统剪贴板！方便提供给技术社群或管理人员解析。');
  };

  const handleFixWarning = (id: string, name: string) => {
    setRepairingId(id);
    onTriggerToast(`正在重置并注入虚拟 TAP 地址，尝试修复 [${name}] 适配...`);

    setTimeout(() => {
      setDiagnostics((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'normal', detail: '修复完成。期望的局域网 IP 已成功强制绑定。' }
            : item
        )
      );
      setTimeline((prev) => [
        {
          time: '今天 14:35:12',
          title: `一键修复 [${name}]`,
          details: '强制解除原有 TAP 环路挂起状态，重新对齐局域网 IP 直通链路成功。',
          status: 'success'
        },
        ...prev
      ]);
      setRepairingId(null);
      onTriggerToast(`一键修复成功！[${name}] 配置现在处于最佳匹配就绪状态。`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">网络诊断与链路性能</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="font-sans text-sm text-slate-500">一键查找阻拦多人游戏并网连接的直接因素，并支持自动化智能修复。</p>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-1">上次自愈分析缓存: <strong className="text-slate-600">{lastDiagnosisTime}</strong> ｜ (当前直接呈现本地内存缓存数据)</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleStartDiagnosis}
            disabled={isDiagnosing}
            className="bg-slate-800 hover:bg-slate-900 text-white font-sans text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
            {isDiagnosing ? '正在深度重测试...' : '手动强制重扫 (刷新缓存)'}
          </button>

          <button
            onClick={handleExportJson}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-sans text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            备份 JSON 原始证据
          </button>
        </div>
      </div>

      {isDiagnosing && (
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200/60 font-sans">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-800 animate-pulse">正在解析本地并网协议与注册表驱动参数...</span>
            <span className="text-xs font-semibold text-amber-700">请稍候 (一般需要 2-3 秒)</span>
          </div>
          <div className="w-full bg-amber-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-500 h-1.5 rounded-full animate-progress-bar w-[65%]" />
          </div>
        </div>
      )}

      {/* Grid structure details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left column elements lists */}
        <div className="lg:col-span-8 space-y-6">

          {/* Main Item List */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h3 className="font-heading text-sm font-bold text-slate-800 mb-5">诊断明细表</h3>

            <div className="divide-y divide-slate-100">
              {diagnostics.map((item) => {
                const isError = item.status === 'error';
                const isWarning = item.status === 'warning';
                const isNormal = item.status === 'normal';

                return (
                  <div key={item.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {isNormal && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                        {isWarning && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                        {isError && <ShieldAlert className="w-5 h-5 text-rose-500" />}
                      </div>

                      <div>
                        <h4 className="font-heading text-sm font-bold text-slate-800">{item.name}</h4>
                        <p className="font-sans text-xs text-slate-500 mt-0.5">{item.detail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-sans text-xs">
                      {isNormal ? (
                        <span className="text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">
                          最优
                        </span>
                      ) : (
                        <button
                          onClick={() => handleFixWarning(item.id, item.name)}
                          disabled={repairingId === item.id}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-450 text-amber-950 font-semibold rounded shadow-sm transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          {repairingId === item.id ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              修复中...
                            </>
                          ) : (
                            '一键修复'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Timeline logs */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans">
            <h3 className="font-heading text-sm font-bold text-slate-800 mb-5">诊断执行事务流 (Timeline)</h3>

            <div className="relative border-l border-slate-200 pl-6 ml-1.5 space-y-6">
              {timeline.map((evt, i) => (
                <div key={i} className="relative">
                  {/* Dot status indicat */}
                  <div className={`absolute -left-[31px] rounded-full w-2.5 h-2.5 border-2 bg-white ${
                    evt.status === 'success' || evt.status === 'completed'
                      ? 'border-emerald-500'
                      : evt.status === 'timeout'
                      ? 'border-red-500'
                      : 'border-amber-400'
                  }`} />

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400 font-semibold">{evt.time}</span>
                      <h4 className="font-sans text-xs font-bold text-slate-700">{evt.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{evt.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature 9: Diagnostic failure classifications & constructive action recommendations */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm font-sans space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-heading text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                异常排查专家：核心失败证据与解决方案建议
              </h3>
              <p className="text-xs text-slate-400 mt-1">系统深入解析各种网络异常的直接技术证据并指导精确的修复行为。</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/15 space-y-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-900 border border-amber-500/10 text-[10px] font-bold">
                  【证据分类 A】TAP 网卡超时挂起
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  <strong>诊断证据:</strong> 驱动自检报错：<code>TAP_ERR_IP_ASSIGN</code> (本地DHCP服务或地址绑定未成功对齐)。
                </p>
                <div className="text-[11px] text-slate-500 font-sans border-t border-amber-200/20 pt-2">
                  <strong>行动路径:</strong> 立即点击上方模块的“一键修复”，或者右键以管理员方式重启网卡重写服务。
                </div>
              </div>

              <div className="p-4 bg-rose-500/5 rounded-xl border border-rose-500/15 space-y-2">
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-900 border border-rose-500/10 text-[10px] font-bold">
                  【证据分类 B】严格对称NAT打洞穿透超时
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  <strong>诊断证据:</strong> P2P直连握手丢包或无响应，本地防火墙显示有异常多点组播阻挡。
                </p>
                <div className="text-[11px] text-slate-500 font-sans border-t border-rose-200/20 pt-2">
                  <strong>行动路径:</strong> 请移步并推荐启用<strong>“TCP 端口代理”</strong>，通过部署的高抗防封云端节点安全透传回落链路。
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right column element: n2n Real-Time Diagnostic Card & JSON */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Feature 3: n2n Real-Time Diagnostic Card */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 shadow-md font-sans space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-500" />
                N2N 实时连通监测卡
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>

            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">网络通信带宽</span>
                <span className="font-mono text-emerald-400 font-bold">14.85 Mbps</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full w-3/4 animate-pulse" />
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-[10px] text-slate-400">传输时延 (Latency)</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5 font-mono">24.5 ms</div>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-[10px] text-slate-400">网络抖动 (Jitter)</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5 font-mono">1.22 ms</div>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-[10px] text-slate-400">平均丢包率 (Loss)</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5 font-mono">0.00 %</div>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-[10px] text-slate-400">MTU 自适应调校</div>
                  <div className="text-sm font-bold text-amber-500 mt-0.5 font-mono">1400 bytes</div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg text-[10px] text-slate-400 font-mono space-y-1">
                <div>运行客户端: n2n-edge v3.0 stable</div>
                <div>挂载超级节点: lianji-telecom-cn2</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex-1 flex flex-col justify-between">
            <div className="w-full">
              <h3 className="font-heading text-sm font-bold text-slate-800 mb-2">原始诊断报告清单 (JSON)</h3>
              <p className="font-sans text-xs text-slate-400 mb-4">异常事件触发对应的原始调试结构体代码，可打包提交系统运维校验。</p>

              <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-[#A6ACCD] leading-loose max-h-[300px] overflow-y-auto shadow-inner relative group select-all">
                <button
                  onClick={handleExportJson}
                  className="absolute top-2.5 right-2 inequalities p-1.5 bg-slate-800 border border-slate-700 rounded-lg hover:text-white transition-colors cursor-pointer text-slate-400"
                  title="复制代码"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <pre>{RAW_JSON_REPORT}</pre>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <span className="font-sans text-[11px] text-slate-400">检测代码: N2N_D_CODE_301XT</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}