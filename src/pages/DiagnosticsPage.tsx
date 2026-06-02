import { useState } from 'react';
import { generateDiagnosticReport } from '../api/tauri';
import { LoadingOverlay } from '../components/LoadingOverlay';
import type { DiagnosticIssue, DiagnosticReport } from '../types/diagnostics';

const fixedChecks = [
  ['后端服务可用性', '等待检测', 'Tauri 后端命令是否正常响应'],
  ['n2n edge 文件检测', '等待检测', 'edge.exe / n2n.exe 是否存在'],
  ['edge 进程状态', '等待检测', '是否存在运行中或重复实例'],
  ['supernode 响应', '等待检测', '公网协调节点是否可达'],
  ['虚拟网卡存在', '等待检测', 'cfw-tap / n2n / edge 网卡是否存在'],
  ['虚拟 IP 分配', '等待检测', '10.x 虚拟地址是否正确分配'],
  ['TCP 端口代理自测', '等待检测', '代理是否能真实转发字节'],
  ['Terraria 服务端监听', '等待检测', '7777 等端口是否稳定监听'],
  ['适配器 hash 校验', '等待检测', 'registry / custom / builtin 是否可信'],
  ['registry index 同步', '等待检测', '共享库更新时间与同步结果']
];

function issueClass(issue?: DiagnosticIssue | null) {
  if (!issue) return 'result-idle';
  if (issue.severity === 'error') return 'result-bad';
  if (issue.severity === 'warn') return 'result-idle';
  return 'result-ok';
}

function severityLabel(severity: string) {
  if (severity === 'error') return '阻断';
  if (severity === 'warn') return '警告';
  return '提示';
}

function IssueCard({ issue }: { issue: DiagnosticIssue }) {
  return (
    <article className={issueClass(issue)}>
      <div className="feature-card-title">
        <h4>{issue.title}</h4>
        <span className={issue.severity === 'error' ? 'badge bad' : issue.severity === 'warn' ? 'badge warn' : 'badge'}>
          {severityLabel(issue.severity)}
        </span>
      </div>
      <p>{issue.detail}</p>
      {issue.next_actions.length > 0 && (
        <>
          <h5>下一步建议</h5>
          <ol>
            {issue.next_actions.map((action) => <li key={action}>{action}</li>)}
          </ol>
        </>
      )}
      {issue.evidence.length > 0 && (
        <details>
          <summary>查看证据</summary>
          <pre className="console-panel">{issue.evidence.join('\n')}</pre>
        </details>
      )}
    </article>
  );
}

export function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reportText = report ? JSON.stringify(report, null, 2) : '';
  const requiredChecks = report?.release_checks.filter((item) => item.required_for_mvp) ?? [];
  const passedRequiredChecks = requiredChecks.filter((item) => item.ok).length;
  const failedRequiredChecks = requiredChecks.length - passedRequiredChecks;
  const mvpReady = report?.release_ready ?? (requiredChecks.length > 0 && passedRequiredChecks === requiredChecks.length);
  const mostLikely = report?.most_likely_cause;
  const issues = report?.issues ?? [];
  const createReport = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setReport(await generateDiagnosticReport());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err || '生成诊断报告失败'));
    } finally {
      setBusy(false);
    }
  };
  const summary = report
    ? [
        '联机助手诊断摘要：' + (mvpReady ? '核心检查通过' : '存在未通过项'),
        'MVP 必需项 ' + (report.required_passed ?? passedRequiredChecks) + ' / ' + (report.required_total ?? requiredChecks.length) + ' 通过。',
        mostLikely ? `最可能原因：${mostLikely.title}。${mostLikely.detail}` : '暂未发现明确失败分类。',
        report.summary
      ].join('\n')
    : '尚未生成诊断报告。';

  return (
    <section className="page-stack">
      <LoadingOverlay visible={busy} title="正在生成诊断报告" message="正在读取真实后端状态、进程、端口、n2n 日志和 TCP 代理自测，请稍等。" />
      <div className="page-header">
        <div>
          <span className="eyebrow">DIAGNOSTICS</span>
          <h2>诊断报告</h2>
          <p className="muted">把“不能联机”拆成可验证的检测项、失败分类和下一步修复建议，而不是只显示 false。</p>
        </div>
        <span className={mvpReady ? 'badge good' : report ? 'badge bad' : 'badge warn'}>{report ? (mvpReady ? '核心通过' : '存在问题') : '未检测'}</span>
      </div>

      {error && <div className="error-card"><strong>生成失败：</strong>{error}</div>}

      <div className="status-grid">
        <article className="status-tile"><span>总体状态</span><strong>{report ? (mvpReady ? '可发布' : '需处理') : '未检测'}</strong><small>来自后端报告</small></article>
        <article className="status-tile"><span>最近检测时间</span><strong>{report?.generated_at ?? '-'}</strong><small>真实生成时间</small></article>
        <article className="status-tile"><span>失败项数量</span><strong>{report ? failedRequiredChecks : '-'}</strong><small>MVP 必需项</small></article>
        <article className="status-tile"><span>失败分类</span><strong>{report ? issues.length : '-'}</strong><small>n2n / 代理 / 服务端</small></article>
      </div>

      <article className="card toolbar-card">
        <div className="actions">
          <button onClick={createReport} disabled={busy}>{busy ? '正在诊断...' : '开始诊断'}</button>
          {report && <button className="secondary" onClick={() => navigator.clipboard.writeText(reportText)}>复制完整报告</button>}
          {report && <button className="secondary" onClick={() => navigator.clipboard.writeText(summary)}>复制摘要</button>}
          {report && <button className="secondary" onClick={() => setReport(null)}>清空日志</button>}
        </div>
      </article>

      {report && (
        <article className="card">
          <h3>最可能原因</h3>
          {mostLikely ? <IssueCard issue={mostLikely} /> : <div className="result-ok"><p>暂未发现明确失败分类。若仍无法联机，请查看详细日志或复制报告给管理员。</p></div>}
        </article>
      )}

      <div className="content-with-aside">
        <div className="page-stack">
          <article className="card">
            <h3>失败分类</h3>
            {report ? (
              issues.length > 0 ? <div className="page-stack">{issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}</div> : <p className="muted">没有发现结构化失败分类。</p>
            ) : (
              <p className="muted">点击“开始诊断”后，这里会显示 n2n、TCP 端口代理、服务端等模块的失败分类。</p>
            )}
          </article>

          <article className="card">
            <h3>检测项时间线</h3>
            {report ? (
              <ul className="diagnostic-list">
                {report.release_checks.map((item) => (
                  <li key={item.id} className={item.ok ? 'check-ok' : 'check-bad'}>
                    <strong>{item.ok ? '通过' : '失败'} · {item.label}</strong>
                    {item.required_for_mvp && <span className="badge warn">MVP 必需</span>}
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="diagnostic-list">
                {fixedChecks.map(([name, state, detail]) => <li key={name} className="check-idle"><strong>{state} · {name}</strong><p>{detail}</p></li>)}
              </ul>
            )}
          </article>

          {report && <article className="card"><h3>详细日志</h3><p className="muted">这里展示检测命令摘要，不粘贴过长原始日志。</p><pre className="console-panel">{report.details.join('\n\n')}</pre></article>}
        </div>

        <aside className="right-panel">
          <h3>问题定位</h3>
          <div className={report && !mvpReady ? 'result-bad' : 'result-idle'}>
            <p>{report ? (mvpReady ? '暂未发现 MVP 阻塞项。' : mostLikely ? `优先处理：${mostLikely.title}` : '最可能原因请优先查看失败的 MVP 必需项。') : '点击“开始诊断”后显示最可能原因。'}</p>
          </div>
          <h3>报告摘要</h3>
          <p className="muted">可以把这段发给朋友或管理员。</p>
          <pre>{summary}</pre>
          <h3>下一步修复建议</h3>
          <div className="filter-list">
            {(report?.next_actions.length ? report.next_actions.slice(0, 8) : ['重新检测 n2n', '打开通用组网', '同步适配器库', '进入 Terraria 向导']).map((action) => (
              <span className="future-chip" key={action}>{action}</span>
            ))}
          </div>
          <h3>未来入口</h3>
          <div className="filter-list"><span className="future-chip">发布前检查向导</span><span className="future-chip">网络路径可视化</span><span className="future-chip">延迟图表</span></div>
        </aside>
      </div>
    </section>
  );
}
