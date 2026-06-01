import { GameCard } from '../components/GameCard';
import type { GameSummary } from '../types/game';

export function GameScanPage({
  games,
  onSelectGame
}: {
  games: GameSummary[];
  onSelectGame: (id: string) => void;
}) {
  return (
    <section>
      <h2>游戏扫描</h2>
      {games.length === 0 ? (
        <p>未发现游戏，当前显示适配库占位数据可能为空。</p>
      ) : (
        games.map((game) => <GameCard key={game.game_id} game={game} onSelect={() => onSelectGame(game.game_id)} />)
      )}
    </section>
  );
}
