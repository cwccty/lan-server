import { useEffect, useState } from 'react';
import { analyzeGame } from '../api/tauri';
import type { GameAnalysis } from '../types/game';

export function GameDetailPage({ gameId, onNext }: { gameId?: string; onNext: () => void }) {
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);

  useEffect(() => {
    if (gameId) analyzeGame(gameId).then(setAnalysis).catch(() => setAnalysis(null));
  }, [gameId]);

  if (!gameId) {
    return (
      <section>
        <h2>游戏详情</h2>
        <p>请先选择游戏。</p>
      </section>
    );
  }

  return (
    <section>
      <h2>{analysis?.display_name ?? gameId}</h2>
      <p>能力：{analysis?.capabilities.join(', ')}</p>
      <p>检测路径：{analysis?.detected_path ?? '未检测到本机安装路径'}</p>
      <p>可信度：{analysis?.confidence}</p>
      <button onClick={onNext}>继续配置网络</button>
    </section>
  );
}
