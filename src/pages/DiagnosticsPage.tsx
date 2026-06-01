import { useState } from 'react';
import { generateDiagnosticReport } from '../api/tauri';
import type { DiagnosticReport } from '../types/diagnostics';

export function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [busy, setBusy] = useState(false);
  const reportText = report ? JSON.stringify(report, null, 2) : '';
  const requiredChecks = report?.release_checks.filter((item) => item.required_for_mvp) ?? [];
  const passedRequiredChecks = requiredChecks.filter((item) => item.ok).length;
  const mvpReady = report?.release_ready ?? (requiredChecks.length > 0 && passedRequiredChecks === requiredChecks.length);

  const createReport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setReport(await generateDiagnosticReport());
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2>诊断报告</h2>
      <p className="muted">
        诊断报告用于发布前自检和用户反馈排查，会汇总网络后端、n2n 状态、Steam 扫描、内嵌服务端退出码和最后日志。
      </p>
      <div className="actions">
        <button onClick={createReport} disabled={busy}>{busy ? '正在生成...' : '生成诊断报告'}</button>
        {report && <button onClick={() => navigator.clipboard.writeText(reportText)}>复制报告</button>}
      </div>
      {report && (
        <article className="card">
          <h3>发布前检查</h3>
          <div className={mvpReady ? 'result-ok' : 'result-bad'}>
            <p>{mvpReady ? 'MVP 必需项已全部通过。' : `MVP 必需项 ${report.required_passed ?? passedRequiredChecks} / ${report.required_total ?? requiredChecks.length} 通过。`}</p>
          </div>
          {!mvpReady && report.next_actions.length > 0 && (
            <>
              <h4>下一步处理</h4>
              <ol>
                {report.next_actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ol>
            </>
          )}
          <ul>
            {report.release_checks.map((item) => (
              <li key={item.id}>
                <strong>{item.ok ? '✅' : '❌'} {item.label}</strong>
                {item.required_for_mvp ? '（MVP 必需）' : ''}：{item.detail}
              </li>
            ))}
          </ul>

          <h3>报告摘要</h3>
          <p>生成时间：{report.generated_at}</p>
          <p>版本：{report.app_version}</p>
          <p>系统：{report.os}</p>
          <p>{report.summary}</p>
          <pre>{report.details.join('\n\n')}</pre>
        </article>
      )}
    </section>
  );
}
