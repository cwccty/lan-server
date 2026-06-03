import { useEffect, useState } from 'react';
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
import { generateDiagnosticReport, getN2nDiagnostics } from '../../api/tauri';
import type { DiagnosticReport } from '../../types/diagnostics';
import type { N2nDiagnostics } from '../../types/network';

interface DiagnosticsViewProps {
  onTriggerToast: (msg: string) => void;
}

export default function DiagnosticsView({ onTriggerToast }: DiagnosticsViewProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [n2nDiagnostics, setN2nDiagnostics] = useState<N2nDiagnostics | null>(null);

  // Feature 10: Cache support
  const [lastDiagnosisTime, setLastDiagnosisTime] = useState('尚未生成真实诊断');

  const mapReportToDiagnostics = (nextReport: DiagnosticReport): DiagnosticItem[] => {
    const releaseItems: DiagnosticItem[] = nextReport.release_checks.map((item) => ({
      id: item.id,
      name: item.label,
      status: item.ok ? 'normal' : item.required_for_mvp ? 'error' : 'warning',
      detail: item.detail
    }));
    const issueItems: DiagnosticItem[] = nextReport.issues.map((issue) => ({
      id: issue.id,
      name: issue.title,
      status: issue.severity === 'error' || issue.severity === 'critical' ? 'error' : 'warning',
      detail: issue.detail
    }));
    return [...releaseItems, ...issueItems];
  };

  const mapReportToTimeline = (nextReport: DiagnosticReport, nextN2n: N2nDiagnostics | null): TimelineEvent[] => {
    const now = new Date(nextReport.generated_at || Date.now()).toLocaleTimeString();
    const items: TimelineEvent[] = [
      {
        time: now,
        title: nextReport.release_ready ? '发布级检查通过' : '发布级检查存在阻断项',
        details: `${nextReport.summary}，必需项 ${nextReport.required_passed}/${nextReport.required_total}`,
        status: nextReport.release_ready ? 'success' : 'info'
      }
    ];
    if (nextN2n) {
      items.push({
        time: new Date().toLocaleTimeString(),
        title: 'n2n 实时状态采样',
        details: nextN2n.summary,
        status: nextN2n.ok_link ? 'success' : nextN2n.running ? 'info' : 'timeout'
      });
    }
    nextReport.next_actions.slice(0, 5).forEach((action, index) => {
      items.push({
        time: `建议 ${index + 1}`,
        title: '下一步动作',
        details: action,
        status: 'info'
      });
    });
    return items;
  };

  const handleStartDiagnosis = async () => {
    setIsDiagnosing(true);
    onTriggerToast('正在生成真实诊断报告，请稍候...');
    try {
      const [nextReport, nextN2n] = await Promise.all([
        generateDiagnosticReport(),
        getN2nDiagnostics().catch(() => null)
      ]);
      setReport(nextReport);
      setN2nDiagnostics(nextN2n);
      setDiagnostics(mapReportToDiagnostics(nextReport));
      setTimeline(mapReportToTimeline(nextReport, nextN2n));
      setIsDiagnosing(false);
      setLastDiagnosisTime(new Date(nextReport.generated_at || Date.now()).toLocaleString());
      onTriggerToast(nextReport.release_ready ? '真实诊断完成：发布必需项已通过。' : '真实诊断完成：存在需要处理的问题。');
    } catch (error) {
      setIsDiagnosing(false);
      onTriggerToast(error instanceof Error ? error.message : String(error || '生成诊断报告失败'));
    }
  };

  const handleExportJson = () => {
    const json = JSON.stringify({ report, n2n: n2nDiagnostics }, null, 2);
    navigator.clipboard.writeText(json);
    onTriggerToast(report ? '真实 JSON 诊断报告已复制到剪贴板。' : '尚未生成真实诊断，已复制空报告结构。');
  };

  const handleFixWarning = async (id: string, name: string) => {
    setActiveActionId(id);
    setTimeline((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        title: `处理建议：${name}`,
        details: '当前版本不会伪造“一键修复成功”。请根据下方真实报告的 next_actions 到对应页面处理，然后重新诊断。',
        status: 'info'
      },
      ...prev
    ]);
    onTriggerToast('已记录处理建议。请到通用组网中心或 Terraria 向导按真实提示处理，再重新诊断。');
    setActiveActionId(null);
  };

  useEffect(() => {
    void handleStartDiagnosis();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">网络诊断与链路性能</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-1.5 h-1.5 rounded-full ${report?.release_ready ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <p className="font-sans text-sm text-slate-500">读取真实运行状态、n2n 日志与发布检查项，不再伪造修复成功。</p>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-1">上次真实诊断: <strong className="text-slate-600">{lastDiagnosisTime}</strong> ｜ 结果会在再次打开页面时保留到当前前端会话</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleStartDiagnosis}
            disabled={isDiagnosing}
            className="bg-slate-800 hover:bg-slate-900 text-white font-sans text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
            {isDiagnosing ? '正在真实诊断...' : '重新生成诊断报告'}
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
                          disabled={activeActionId === item.id}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-450 text-amber-950 font-semibold rounded shadow-sm transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          {activeActionId === item.id ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              处理中...
                            </>
                          ) : (
                            '查看处理建议'
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
                  【证据分类 A】n2n 未响应或未注册
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  <strong>诊断证据:</strong> 以真实报告中的 <code>not_responding / ok_link / recent_logs</code> 为准，不再使用固定示例。
                </p>
                <div className="text-[11px] text-slate-500 font-sans border-t border-amber-200/20 pt-2">
                  <strong>行动路径:</strong> 进入“通用组网中心”，确认 Supernode、Room、Key、本机虚拟 IP，然后重新启动 edge。
                </div>
              </div>

              <div className="p-4 bg-rose-500/5 rounded-xl border border-rose-500/15 space-y-2">
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-900 border border-rose-500/10 text-[10px] font-bold">
                  【证据分类 B】游戏端口或服务端未就绪
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  <strong>诊断证据:</strong> Terraria 后台会话、TCP LISTEN 表和端口检测结果显示服务端未监听或未稳定 30 秒。
                </p>
                <div className="text-[11px] text-slate-500 font-sans border-t border-rose-200/20 pt-2">
                  <strong>行动路径:</strong> 进入“Terraria 向导”重新启动服务端，等待 ready，再进行本机和好友虚拟 IP 检测。
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
                <span className="text-slate-400">n2n 链路状态</span>
                <span className={`font-mono font-bold ${n2nDiagnostics?.ok_link ? 'text-emerald-400' : n2nDiagnostics?.running ? 'text-amber-400' : 'text-slate-400'}`}>
                  {n2nDiagnostics?.ok_link ? 'ACK/PONG OK' : n2nDiagnostics?.running ? '运行但待确认' : '未运行'}
                </span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div className={`h-1.5 rounded-full ${n2nDiagnostics?.ok_link ? 'bg-emerald-500 w-full animate-pulse' : n2nDiagnostics?.running ? 'bg-amber-500 w-1/2' : 'bg-slate-700 w-[8%]'}`} />
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-[10px] text-slate-400">ACK</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5 font-mono">{n2nDiagnostics?.ack ? 'true' : 'false'}</div>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-[10px] text-slate-400">PONG</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5 font-mono">{n2nDiagnostics?.pong ? 'true' : 'false'}</div>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-[10px] text-slate-400">虚拟 IP</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5 font-mono">{n2nDiagnostics?.virtual_ip || '--'}</div>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  <div className="text-[10px] text-slate-400">配置</div>
                  <div className="text-sm font-bold text-amber-500 mt-0.5 font-mono">{n2nDiagnostics?.supernode_configured ? '已配置' : '未配置'}</div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg text-[10px] text-slate-400 font-mono space-y-1">
                <div>运行状态: {n2nDiagnostics?.running ? 'running' : 'stopped'}</div>
                <div>超级节点: {n2nDiagnostics?.supernode || '未配置'}</div>
                <div>摘要: {n2nDiagnostics?.summary || '尚无真实 n2n 采样'}</div>
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
                <pre>{JSON.stringify({ report, n2n: n2nDiagnostics }, null, 2)}</pre>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <span className="font-sans text-[11px] text-slate-400">检测来源: generateDiagnosticReport + getN2nDiagnostics</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
