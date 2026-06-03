import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { GameScanPage } from './pages/GameScanPage';
import { GameDetailPage } from './pages/GameDetailPage';
import { NetworkSetupPage } from './pages/NetworkSetupPage';
import { RecommendationPage } from './pages/RecommendationPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { MultiplayerWizardPage } from './pages/MultiplayerWizardPage';
import { AdapterManagerPage } from './pages/AdapterManagerPage';
import { scanGames } from './api/tauri';
import type { GameSummary } from './types/game';
import type { NetworkSetupPreset } from './types/networkPreset';

type Page = 'home' | 'wizard' | 'scan' | 'detail' | 'network' | 'recommendation' | 'diagnostics' | 'adapters';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [games, setGames] = useState<GameSummary[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState('');
  const [gamesLoadedAt, setGamesLoadedAt] = useState<number | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>();
  const [networkPreset, setNetworkPreset] = useState<NetworkSetupPreset | undefined>();

  const refreshGames = async () => {
    setGamesLoading(true);
    setGamesError('');
    try {
      const nextGames = await scanGames();
      setGames(nextGames);
      setGamesLoadedAt(Date.now());
    } catch (error) {
      setGames([]);
      setGamesError(error instanceof Error ? error.message : String(error || '扫描游戏失败'));
    } finally {
      setGamesLoading(false);
    }
  };

  useEffect(() => {
    void refreshGames();
  }, []);

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {page === 'home' && <HomePage onNavigate={setPage} />}
      {page === 'wizard' && <MultiplayerWizardPage />}
      {page === 'scan' && (
        <GameScanPage
          games={games}
          loading={gamesLoading}
          error={gamesError}
          loadedAt={gamesLoadedAt}
          onRefreshGames={refreshGames}
          onAdapterCreated={async () => {
            await refreshGames();
          }}
          onOpenAdapters={() => setPage('adapters')}
          onSelectGame={(id) => {
            setSelectedGameId(id);
            setPage('detail');
          }}
        />
      )}
      {page === 'detail' && <GameDetailPage gameId={selectedGameId} onNext={() => setPage('network')} />}
      {page === 'network' && <NetworkSetupPage preset={networkPreset} onNext={() => setPage('recommendation')} />}
      {page === 'recommendation' && (
        <RecommendationPage
          gameId={selectedGameId}
          onOpenNetwork={(preset) => {
            setNetworkPreset(preset);
            setPage('network');
          }}
        />
      )}
      {page === 'adapters' && <AdapterManagerPage />}
      {page === 'diagnostics' && <DiagnosticsPage selectedGame={games.find((game) => game.game_id === selectedGameId)} />}
    </Layout>
  );
}
