import type { GameSummary } from '../types/game';

export function GameCard({ game, onSelect }: { game: GameSummary; onSelect: () => void }) {
  return (
    <article className="card">
      <h3>{game.display_name}</h3>
      <p>{game.capabilities.join(', ')}</p>
      <button onClick={onSelect}>分析</button>
    </article>
  );
}
