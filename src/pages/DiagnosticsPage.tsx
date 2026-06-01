import { useState } from 'react';
import { generateDiagnosticReport } from '../api/tauri';
import type { DiagnosticReport } from '../types/diagnostics';

export function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const reportText = report ? JSON.stringify(report, null, 2) : '';

  return (
    <section>
      <h2>诊断报告</h2>
      <button onClick={() => generateDiagnosticReport().then(setReport)}>生成诊断报告</button>
      {report && (
        <>
          <button onClick={() => navigator.clipboard.writeText(reportText)}>复制报告</button>
          <pre>{reportText}</pre>
        </>
      )}
    </section>
  );
}
