import type { GameSummary } from '../types/game';

const sourceLabels: Record<string, string> = {
  builtin: '内置',
  registry: '共享库',
  custom: '本地自定义',
  steam_scan: 'Steam 扫描'
};

export function GameCard({
  game,
  onSelect,
  onCreateAdapterDraft
}: {
  game: GameSummary;
  onSelect: () => void;
  onCreateAdapterDraft?: () => void;
}) {
  const conversion = game.multiplayer_conversion;
  const needsReview = !conversion || game.network_type === 'unknown_need_review' || !game.connection_plan;
  return (
    <article className="card game-card">
      <div className="feature-card-title">
        <div>
          <h3>{game.display_name}</h3>
          <p className="muted">{game.game_id}</p>
        </div>
        <span className={`badge source-${game.adapter_source ?? 'unknown'}`}>
          {sourceLabels[game.adapter_source ?? ''] ?? game.adapter_source ?? '未知'}
        </span>
      </div>
      <div className="badge-row">
        {game.capabilities.map((capability) => <span className="badge" key={capability}>{capability}</span>)}
      </div>
      {conversion && (
        <p className="muted">
          {conversion.can_convert_to_lan ? '可转换成本地联机' : '暂不承诺转换'} · {conversion.capability}
        </p>
      )}
      <div className="actions">
        <button onClick={onSelect}>查看转换判断</button>
        {needsReview && onCreateAdapterDraft && (
          <button type="button" className="secondary" onClick={onCreateAdapterDraft}>创建适配器草稿</button>
        )}
      </div>
    </article>
  );
}
