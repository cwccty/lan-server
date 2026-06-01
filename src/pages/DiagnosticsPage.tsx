import { useState } from 'react';
import { generateDiagnosticReport } from '../api/tauri';
import type { DiagnosticReport } from '../types/diagnostics';

export function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [busy, setBusy] = useState(false);
  const reportText = report ? JSON.stringify(report, null, 2) : '';

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
