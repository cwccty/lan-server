import { useState } from 'react';
import { generateDiagnosticReport } from '../api/tauri';
import type { DiagnosticReport } from '../types/diagnostics';

const fixedChecks = [
  ['???????', '????', 'Tauri ??????????'],
  ['n2n edge ????', '????', 'edge.exe / n2n.exe ????'],
  ['edge ????', '????', '????????????'],
  ['supernode ??', '????', '??????????'],
  ['??????', '????', 'cfw-tap / n2n / edge ??????'],
  ['?? IP ??', '????', '10.x ??????????'],
  ['???? PID', '????', '?????????????'],
  ['Terraria ?????', '????', '7777 ?????????'],
  ['??? hash ??', '????', 'registry / custom / builtin ????'],
  ['registry index ??', '????', '????????????']
];

export function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [busy, setBusy] = useState(false);
  const reportText = report ? JSON.stringify(report, null, 2) : '';
  const requiredChecks = report?.release_checks.filter((item) => item.required_for_mvp) ?? [];
  const passedRequiredChecks = requiredChecks.filter((item) => item.ok).length;
  const failedRequiredChecks = requiredChecks.length - passedRequiredChecks;
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

  const summary = report
    ? `?????????${mvpReady ? '??????' : '??????'}?MVP ??? ${report.required_passed ?? passedRequiredChecks} / ${report.required_total ?? requiredChecks.length} ???${report.summary}`
    : '?????????';

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">DIAGNOSTICS</span>
          <h2>????</h2>
          <p className="muted">??????????????????????? false?</p>
        </div>
        <span className={mvpReady ? 'badge good' : report ? 'badge bad' : 'badge warn'}>
          {report ? (mvpReady ? '????' : '????') : '???'}
        </span>
      </div>

      <div className="status-grid">
        <article className="status-tile"><span>????</span><strong>{report ? (mvpReady ? '???' : '???') : '???'}</strong><small>??????</small></article>
        <article className="status-tile"><span>??????</span><strong>{report?.generated_at ?? '-'}</strong><small>??????</small></article>
        <article className="status-tile"><span>?????</span><strong>{report ? failedRequiredChecks : '-'}</strong><small>MVP ???</small></article>
        <article className="status-tile"><span>?????</span><strong>{report?.next_actions.length ?? '-'}</strong><small>?? next_actions</small></article>
      </div>

      <article className="card toolbar-card">
        <div className="actions">
          <button onClick={createReport} disabled={busy}>{busy ? '????...' : '????'}</button>
          {report && <button className="secondary" onClick={() => navigator.clipboard.writeText(reportText)}>??????</button>}
          {report && <button className="secondary" onClick={() => navigator.clipboard.writeText(summary)}>????</button>}
          {report && <button className="secondary" onClick={() => setReport(null)}>????</button>}
        </div>
      </article>

      <div className="content-with-aside">
        <div className="page-stack">
          <article className="card">
            <h3>??????</h3>
            {report ? (
              <ul className="diagnostic-list">
                {report.release_checks.map((item) => (
                  <li key={item.id} className={item.ok ? 'check-ok' : 'check-bad'}>
                    <strong>{item.ok ? '??' : '??'} ? {item.label}</strong>
                    {item.required_for_mvp && <span className="badge warn">MVP ??</span>}
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="diagnostic-list">
                {fixedChecks.map(([name, state, detail]) => (
                  <li key={name} className="check-idle">
                    <strong>{state} ? {name}</strong>
                    <p>{detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {report && (
            <article className="card">
              <h3>????</h3>
              <p className="muted">?????????????????????</p>
              <pre className="console-panel">{report.details.join('\n\n')}</pre>
            </article>
          )}
        </div>

        <aside className="right-panel">
          <h3>????</h3>
          <div className={report && !mvpReady ? 'result-bad' : 'result-idle'}>
            <p>{report ? (mvpReady ? '???? MVP ????' : '????????????? MVP ????') : '?????????????????'}</p>
          </div>

          <h3>????</h3>
          <p className="muted">??????????????</p>
          <pre>{summary}</pre>

          <h3>??????</h3>
          <div className="filter-list">
            <span className="future-chip">???? n2n</span>
            <span className="future-chip">??????</span>
            <span className="future-chip">??????</span>
            <span className="future-chip">?? Terraria ??</span>
          </div>

          <h3>????</h3>
          <div className="filter-list">
            <span className="future-chip">???????</span>
            <span className="future-chip">???????</span>
            <span className="future-chip">????</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
