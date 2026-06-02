import { GameCard } from '../components/GameCard';
import type { GameSummary } from '../types/game';

const capabilityFilters = ['?? LAN', '???????', '????', '??????', '?? Mod', '???????', '??'];
const sourceFilters = ['builtin', 'registry', 'custom', 'steam_scan'];

export function GameScanPage({
  games,
  onSelectGame
}: {
  games: GameSummary[];
  onSelectGame: (id: string) => void;
}) {
  const matchedCount = games.filter((game) => game.multiplayer_conversion).length;
  const manualCount = games.filter((game) => !game.multiplayer_conversion).length;

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">GAME SCAN</span>
          <h2>????</h2>
          <p className="muted">?????????????/????????????????????????</p>
        </div>
        <span className="badge">{games.length} ???</span>
      </div>

      <article className="card toolbar-card">
        <div className="actions">
          <button>????</button>
          <button className="secondary">????</button>
          <button className="secondary">?? Steam ??</button>
          <button className="secondary">?????</button>
        </div>
        <p className="muted">??????????????? ? ?????builtin / registry / custom</p>
      </article>

      <div className="status-grid">
        <article className="status-tile"><span>??????</span><strong>Steam / ????</strong><small>??????</small></article>
        <article className="status-tile"><span>???</span><strong>{games.length}</strong><small>??????</small></article>
        <article className="status-tile"><span>???</span><strong>{matchedCount}</strong><small>?????</small></article>
        <article className="status-tile"><span>?????</span><strong>{manualCount}</strong><small>???????</small></article>
      </div>

      <div className="content-with-aside">
        <div className="page-stack">
          {games.length === 0 ? (
            <article className="card empty-state">
              <h3>??????</h3>
              <p className="muted">???????????????????????/????????</p>
              <p>???????????????????????????????????</p>
            </article>
          ) : (
            <div className="feature-grid two">
              {games.map((game) => <GameCard key={game.game_id} game={game} onSelect={() => onSelectGame(game.game_id)} />)}
            </div>
          )}
        </div>

        <aside className="right-panel">
          <h3>??</h3>
          <h4>????</h4>
          <div className="filter-list">{capabilityFilters.map((item) => <span className="badge" key={item}>{item}</span>)}</div>
          <h4>?????</h4>
          <div className="filter-list">{sourceFilters.map((item) => <span className={`badge source-${item}`} key={item}>{item}</span>)}</div>
          <h4>????</h4>
          <div className="filter-list">
            <span className="future-chip">??????</span>
            <span className="future-chip">??????</span>
            <span className="future-chip">??????</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
