import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  XCircle
} from 'lucide-react';
import {
  generateDiagnosticReport,
  generateDiagnosticReportForGame,
  listGameAdapters,
  scanGames
} from '../api/tauri';
import type { DiagnosticIssue, DiagnosticReport, ReleaseCheck } from '../types/diagnostics';
import type { GameSummary } from '../types/game';
import { getReferenceSelectedGame } from '../reference-adapter/selectedGame';
import { readReferenceRuntimeSnapshot } from '../reference-adapter/runtimeStore';
import { REFERENCE_RUNTIME_EVENT } from '../reference-adapter/bootstrap';
import { useReferenceRuntime } from '../reference-adapter/useReferenceRuntime';

interface ProductDiagnosticsViewProps {
  onTriggerToast: (msg: string) => void;
}

type DiagnosticTargetMode = 'global' | 'selected' | 'game';

interface DiagnosticRecord {
  target_mode: DiagnosticTargetMode;
  target_game_id?: string;
  target_label: string;
  generated_at: string;
  report: DiagnosticReport;
}

const TARGET_KEY = 'lan-helper.referenceDiagnosticTarget';
const RECORD_KEY = 'lan-helper.referenceDiagnosticRecord';

function normalizeTarget(value: unknown): { mode: DiagnosticTargetMode; game_id: string } {
  if (!value || typeof value !== 'object') return { mode: 'selected', game_id: '' };
  const record = value as Partial<{ mode: DiagnosticTargetMode; game_id: string }>;
  return {
    mode: record.mode === 'global' || record.mode === 'selected' || record.mode === 'game' ? record.mode : 'selected',
    game_id: String(record.game_id || '')
  };
}

function readTarget() {
  try {
    return normalizeTarget(JSON.parse(window.localStorage.getItem(TARGET_KEY) || 'null'));
  } catch {
    return normalizeTarget(null);
  }
}

function saveTarget(target: { mode: DiagnosticTargetMode; game_id: string }) {
  window.localStorage.setItem(TARGET_KEY, JSON.stringify(target));
}

function readRecord(): DiagnosticRecord | null {
  try {
    const raw = window.localStorage.getItem(RECORD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiagnosticRecord;
    return parsed?.report ? parsed : null;
  } catch {
    return null;
  }
}

function saveRecord(record: DiagnosticRecord) {
  window.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
}

function formatDiagnosticRecord(record: DiagnosticRecord) {
  const report = record.report;
  const issue = report.most_likely_cause ?? report.issues?.[0];
  const lines = [
    '# 联机助手真实诊断报告',
    '',
    `诊断目标: ${record.target_label}`,
    `目标模式: ${record.target_mode}`,
    record.target_game_id ? `游戏 ID: ${record.target_game_id}` : '',
    `报告生成时间: ${record.generated_at}`,
    `后端报告时间: ${report.generated_at}`,
    `应用版本: ${report.app_version}`,
    `系统: ${report.os}`,
    `发布检查: ${report.release_ready ? '通过' : '未通过'} (${report.required_passed}/${report.required_total})`,
    '',
    '## 摘要',
    report.summary || '无摘要',
    '',
    '## 最可能原因',
    issue ? `${issue.severity.toUpperCase()} / ${issue.title}\n${issue.detail}` : '暂无',
    '',
    '## 下一步动作',
    ...(report.next_actions?.length ? report.next_actions.map((item, index) => `${index + 1}. ${item}`) : ['暂无']),
    '',
    '## 问题列表',
    ...(report.issues?.length
      ? report.issues.flatMap((item, index) => [
          `${index + 1}. [${item.severity}] ${item.title}`,
          `   ${item.detail}`,
          ...(item.next_actions ?? []).map((action) => `   - ${action}`),
          ...(item.evidence ?? []).map((evidence) => `   evidence: ${evidence}`)
        ])
      : ['暂无']),
    '',
    '## 发布检查',
    ...(report.release_checks?.length
      ? report.release_checks.map((item) => `- ${item.ok ? 'PASS' : 'FAIL'} ${item.label}: ${item.detail}`)
      : ['暂无']),
    '',
    '## 详细信息',
    ...(report.details?.length ? report.details.map((item) => `- ${item}`) : ['暂无'])
  ].filter((line) => line !== '');
  return lines.join('\n');
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function severityTone(severity: string) {
  const value = severity.toLowerCase();
  if (value.includes('critical') || value.includes('error') || value.includes('high')) return 'border-rose-100 bg-rose-50 text-rose-700';
  if (value.includes('warn') || value.includes('medium')) return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-slate-100 bg-slate-50 text-slate-600';
}

function CheckRow({ check }: { check: ReleaseCheck }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3">
      {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 text-rose-500" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-800">{check.label}</p>
          {check.required_for_mvp ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">MVP 必需</span> : null}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{check.detail}</p>
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: DiagnosticIssue }) {
  return (
    <div className={`rounded-2xl border p-4 ${severityTone(issue.severity)}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-white/70 px-2 py-0.5 font-mono text-[10px] font-bold">{issue.severity}</span>
            <h4 className="text-sm font-bold">{issue.title}</h4>
          </div>
          <p className="text-xs leading-relaxed">{issue.detail}</p>
          {issue.next_actions?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
              {issue.next_actions.map((action) => <li key={action}>{action}</li>)}
            </ul>
          ) : null}
          {issue.evidence?.length ? (
            <pre className="mt-3 max-h-28 overflow-auto rounded-xl bg-white/70 p-2 text-[11px] leading-relaxed">{issue.evidence.join('\n')}</pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProductDiagnosticsView({ onTriggerToast }: ProductDiagnosticsViewProps) {
  const runtime = useReferenceRuntime();
  const [target, setTarget] = useState(() => readTarget());
  const [record, setRecord] = useState<DiagnosticRecord | null>(() => readRecord());
  const [games, setGames] = useState<GameSummary[]>([]);
  const [busy, setBusy] = useState('');

  const selectedGame = getReferenceSelectedGame();
  const report = record?.report ?? null;
  const issue = report?.most_likely_cause ?? report?.issues?.[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([scanGames().catch(() => []), listGameAdapters().catch(() => [])]).then(([scanned, adapters]) => {
      if (cancelled) return;
      const map = new Map<string, GameSummary>();
      scanned.forEach((game) => map.set(game.game_id, game));
      adapters.forEach((adapter) => {
        if (!map.has(adapter.game_id)) {
          map.set(adapter.game_id, {
            game_id: adapter.game_id,
            display_name: adapter.display_name,
            steam_appid: adapter.steam_appid,
            detected_path: '',
            capabilities: adapter.capabilities ?? [],
            network_type: adapter.network_type,
            connection_plan: adapter.connection_plan
          });
        }
      });
      setGames(Array.from(map.values()).sort((a, b) => a.display_name.localeCompare(b.display_name)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const targetLabel = useMemo(() => {
    if (target.mode === 'global') return '全局环境';
    const gameId = target.mode === 'selected' ? selectedGame?.game_id || target.game_id : target.game_id;
    if (!gameId) return '当前选中游戏未设置，回退全局环境';
    const game = games.find((item) => item.game_id === gameId);
    return `${game?.display_name || selectedGame?.display_name || gameId} (${gameId})`;
  }, [games, selectedGame?.display_name, selectedGame?.game_id, target.game_id, target.mode]);

  const updateTarget = (next: typeof target) => {
    setTarget(next);
    saveTarget(next);
  };

  const runDiagnostic = async () => {
    setBusy('生成真实诊断');
    try {
      const selected = getReferenceSelectedGame();
      const targetGameId =
        target.mode === 'global' ? ''
          : target.mode === 'selected' ? selected?.game_id || target.game_id
            : target.game_id;
      const currentLabel = targetGameId
        ? games.find((game) => game.game_id === targetGameId)?.display_name || selected?.display_name || targetGameId
        : target.mode === 'global' ? '全局环境' : '当前选中游戏未设置，已回退全局环境';
      const nextReport = targetGameId ? await generateDiagnosticReportForGame(targetGameId) : await generateDiagnosticReport();
      const nextRecord: DiagnosticRecord = {
        target_mode: target.mode,
        target_game_id: targetGameId || undefined,
        target_label: targetGameId ? `${currentLabel} (${targetGameId})` : currentLabel,
        generated_at: new Date().toISOString(),
        report: nextReport
      };
      saveRecord(nextRecord);
      setRecord(nextRecord);
      const snapshot = await readReferenceRuntimeSnapshot({ includeDiagnostics: true });
      window.__LAN_HELPER_REFERENCE_RUNTIME__ = snapshot;
      window.dispatchEvent(new CustomEvent(REFERENCE_RUNTIME_EVENT, { detail: snapshot }));
      onTriggerToast(`已生成 ${nextRecord.target_label} 的真实诊断报告。`);
    } catch (error) {
      onTriggerToast(`生成诊断失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const refreshGames = async () => {
    setBusy('刷新诊断目标');
    try {
      const next = await scanGames();
      setGames(next);
      onTriggerToast('诊断目标游戏列表已刷新。');
    } catch (error) {
      onTriggerToast(`刷新失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const copyReport = async () => {
    if (!record) {
      onTriggerToast('尚未生成真实诊断报告。');
      return;
    }
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('剪贴板不可用');
      await clipboard.writeText(formatDiagnosticRecord(record));
      onTriggerToast('真实诊断报告已复制到剪贴板。');
    } catch (error) {
      onTriggerToast(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const exportReport = () => {
    if (!record) {
      onTriggerToast('尚未生成真实诊断报告。');
      return;
    }
    const safeTarget = record.target_label.replace(/[^\u4e00-\u9fa5\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'diagnostic';
    const filename = `lan-helper-diagnostic-${safeTarget}-${new Date(record.generated_at).getTime() || Date.now()}.txt`;
    downloadText(filename, formatDiagnosticRecord(record));
    onTriggerToast(`真实诊断报告已导出：${filename}`);
  };

  return (
    <div className="space-y-6" data-lan-helper-product-controlled="diagnostics">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-slate-800">诊断报告</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            正式 Product 页面，直接生成真实后端诊断报告；不再使用参考页模拟进度和 DOM patcher 替换 JSON。
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${
          report?.release_ready ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : report ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}>
          {report?.release_ready ? <ShieldCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          {busy || (report ? `必需项 ${report.required_passed}/${report.required_total}` : '等待诊断')}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Target className="h-4 w-4 text-amber-600" />
              诊断目标
            </h3>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                目标模式
                <select
                  value={target.mode}
                  onChange={(event) => updateTarget({ ...target, mode: event.target.value as DiagnosticTargetMode })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400"
                >
                  <option value="selected">当前选中游戏</option>
                  <option value="game">指定游戏</option>
                  <option value="global">全局环境</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                指定游戏
                <select
                  value={target.game_id}
                  onChange={(event) => updateTarget({ ...target, game_id: event.target.value })}
                  disabled={target.mode === 'global'}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400 disabled:opacity-60"
                >
                  <option value="">未选择</option>
                  {games.map((game) => <option key={game.game_id} value={game.game_id}>{game.display_name} ({game.game_id})</option>)}
                </select>
              </label>
              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                当前目标：<span className="font-semibold text-slate-700">{targetLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={runDiagnostic} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                  <Search className="h-4 w-4" />
                  生成真实诊断
                </button>
                <button onClick={refreshGames} disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  <RefreshCw className={`h-4 w-4 ${busy === '刷新诊断目标' ? 'animate-spin' : ''}`} />
                  刷新目标
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800">真实 runtime 摘要</h3>
            <div className="space-y-2 text-xs text-slate-600">
              <p>n2n：{runtime.network.label || '暂无'}</p>
              <p>虚拟 IP：<span className="font-mono">{runtime.network.virtualIp || '-'}</span></p>
              <p>Supernode：<span className="font-mono">{runtime.network.supernode || '-'}</span></p>
              <p>Terraria：{runtime.terraria.message}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-800">报告操作</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copyReport} disabled={!record} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <ClipboardCopy className="h-4 w-4" />
                复制报告
              </button>
              <button onClick={exportReport} disabled={!record} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Download className="h-4 w-4" />
                导出文本
              </button>
            </div>
            {record ? <p className="mt-3 text-[11px] text-slate-400">最近报告：{new Date(record.generated_at).toLocaleString()}｜{record.target_label}</p> : null}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">真实诊断结论</h3>
                <p className="mt-1 text-xs text-slate-500">{report?.summary || '尚未生成诊断报告。'}</p>
              </div>
              {report ? (
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${report.release_ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {report.release_ready ? '发布检查通过' : '存在待处理项'}
                </span>
              ) : null}
            </div>

            {issue ? <IssueCard issue={issue} /> : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                点击“生成真实诊断”后，这里会显示后端返回的最可能原因和下一步动作。
              </div>
            )}
          </div>

          {report?.next_actions?.length ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">下一步动作</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
                {report.next_actions.map((action) => <li key={action}>{action}</li>)}
              </ol>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">发布检查</h3>
              <div className="space-y-2">
                {report?.release_checks?.length
                  ? report.release_checks.map((check) => <CheckRow key={check.id} check={check} />)
                  : <p className="text-sm text-slate-500">暂无发布检查结果。</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">问题列表</h3>
              <div className="space-y-2">
                {report?.issues?.length
                  ? report.issues.map((item) => <IssueCard key={item.id} issue={item} />)
                  : <p className="text-sm text-slate-500">暂无问题列表。</p>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-amber-200">报告原文预览</h3>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
              {record ? formatDiagnosticRecord(record) : '尚未生成真实诊断报告。'}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
