import { useEffect, useState } from 'react';
import { analyzeGame } from '../api/tauri';
import type { GameAnalysis } from '../types/game';

const sourceLabels: Record<string, string> = {
  builtin: '内置适配器',
  registry: '共享库适配器',
  custom: '本地自定义适配器',
  steam_scan: 'Steam 自动扫描'
};

export function GameDetailPage({ gameId, onNext }: { gameId?: string; onNext: () => void }) {
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);

  useEffect(() => {
    if (gameId) analyzeGame(gameId).then(setAnalysis).catch(() => setAnalysis(null));
  }, [gameId]);

  if (!gameId) {
    return (
      <section className="page-stack">
        <div className="page-header">
          <h2>游戏详情</h2>
        </div>
        <article className="card empty-state">
          <h3>请先选择游戏</h3>
          <p className="muted">进入游戏扫描页，选择一个游戏后再查看详情。</p>
        </article>
      </section>
    );
  }

  const conversion = analysis?.multiplayer_conversion;

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">GAME DETAIL</span>
          <h2>{analysis?.display_name ?? gameId}</h2>
          <p className="muted">{analysis?.detected_path ?? '未检测到本机安装路径'}</p>
        </div>
        {analysis?.adapter_source && (
          <span className={`badge source-${analysis.adapter_source}`}>
            {sourceLabels[analysis.adapter_source] ?? analysis.adapter_source}
          </span>
        )}
      </div>

      <article className={conversion?.can_convert_to_lan ? 'card conversion-card' : 'card'}>
        <h3>能力摘要</h3>
        <div className="badge-row">
          {(analysis?.capabilities ?? []).map((capability) => <span className="badge" key={capability}>{capability}</span>)}
        </div>
        <p>可信度：<strong>{analysis?.confidence ?? 'unknown'}</strong></p>
        {conversion && (
          <>
            <p>转换类型：<strong>{conversion.capability}</strong></p>
            <p>{conversion.can_convert_to_lan ? '该游戏当前可按推荐流程转换成本地联机。' : '该游戏暂不承诺转换成本地联机。'}</p>
          </>
        )}
      </article>

      <button onClick={onNext}>继续配置网络</button>
    </section>
  );
}
