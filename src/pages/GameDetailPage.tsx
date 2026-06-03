import { useEffect, useState } from 'react';
import { analyzeGame } from '../api/tauri';
import { LoadingOverlay } from '../components/LoadingOverlay';
import type { GameAnalysis } from '../types/game';

const sourceLabels: Record<string, string> = {
  builtin: '内置适配器',
  registry: '共享库适配器',
  custom: '本地自定义适配器',
  steam_scan: 'Steam 自动扫描'
};

export function GameDetailPage({ gameId, onNext }: { gameId?: string; onNext: () => void }) {
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gameId) {
      setAnalysis(null);
      setError('');
      setLoading(false);
      return;
    }
    let disposed = false;
    setLoading(true);
    setError('');
    analyzeGame(gameId)
      .then((next) => {
        if (!disposed) setAnalysis(next);
      })
      .catch((err) => {
        if (!disposed) {
          setAnalysis(null);
          setError(err instanceof Error ? err.message : String(err || '分析游戏失败'));
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [gameId]);

  if (!gameId) {
    return (
      <section className="page-stack modern-content-page game-detail-page">
        <div className="content-hero game-detail-hero">
          <div>
            <span className="eyebrow">GAME DETAIL</span>
            <h2>游戏详情</h2>
            <p className="muted">选择游戏后，这里会读取真实适配器分析结果。</p>
          </div>
        </div>
        <article className="card empty-state">
          <h3>请先选择游戏</h3>
          <p className="muted">进入游戏扫描页，选择一个游戏后再查看详情。</p>
        </article>
      </section>
    );
  }

  const conversion = analysis?.multiplayer_conversion;
  const canContinue = Boolean(analysis && !loading);

  return (
    <section className="page-stack modern-content-page game-detail-page">
      <LoadingOverlay visible={loading} title="正在分析游戏" message="正在读取游戏适配器、扫描结果和联机能力，请稍等。" />
      <div className="content-hero game-detail-hero">
        <div>
          <span className="eyebrow">GAME DETAIL</span>
          <h2>{analysis?.display_name ?? gameId}</h2>
          <p className="muted">{loading ? '正在读取真实分析结果。' : analysis?.detected_path ?? '未检测到本机安装路径'}</p>
        </div>
        {analysis?.adapter_source && (
          <span className={`badge source-${analysis.adapter_source}`}>
            {sourceLabels[analysis.adapter_source] ?? analysis.adapter_source}
          </span>
        )}
        <div className="hero-mini-stats">
          <article><span>分析状态</span><strong>{loading ? '读取中' : error ? '失败' : analysis ? '已完成' : '未完成'}</strong></article>
          <article><span>适配器来源</span><strong>{analysis?.adapter_source ? sourceLabels[analysis.adapter_source] ?? analysis.adapter_source : '-'}</strong></article>
        </div>
      </div>

      {error && <div className="error-card"><strong>分析失败：</strong>{error}</div>}

      <article className={conversion?.can_convert_to_lan ? 'card content-panel conversion-card game-analysis-panel' : 'card content-panel game-analysis-panel'}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ANALYSIS</span>
            <h3>能力摘要</h3>
            <p className="muted">这里展示的是后端 `analyze_game` 返回的适配器判断，不是点击后已经联机。</p>
          </div>
          <span className={conversion?.can_convert_to_lan ? 'badge good' : analysis ? 'badge warn' : 'badge'}>{conversion?.can_convert_to_lan ? '可按方案尝试' : analysis ? '需确认' : '未读取'}</span>
        </div>
        <div className="badge-row">
          {(analysis?.capabilities ?? []).map((capability) => <span className="badge" key={capability}>{capability}</span>)}
        </div>
        {!analysis && !loading && !error && <p className="muted">尚未拿到游戏分析结果。</p>}
        <p>可信度：<strong>{analysis?.confidence ?? 'unknown'}</strong></p>
        {conversion && (
          <>
            <p>转换类型：<strong>{conversion.capability}</strong></p>
            <p>{conversion.can_convert_to_lan ? '该游戏当前可按推荐流程转换成本地联机。' : '该游戏暂不承诺转换成本地联机。'}</p>
          </>
        )}
      </article>

      <button onClick={onNext} disabled={!canContinue}>继续配置网络</button>
    </section>
  );
}
