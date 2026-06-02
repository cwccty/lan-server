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
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>();
  const [networkPreset, setNetworkPreset] = useState<NetworkSetupPreset | undefined>();

  useEffect(() => {
    scanGames().then(setGames).catch(() => setGames([]));
  }, []);

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {page === 'home' && <HomePage onNavigate={setPage} />}
      {page === 'wizard' && <MultiplayerWizardPage />}
      {page === 'scan' && (
        <GameScanPage
          games={games}
          onAdapterCreated={async () => {
            const nextGames = await scanGames().catch(() => []);
            setGames(nextGames);
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
      {page === 'diagnostics' && <DiagnosticsPage />}
    </Layout>
  );
}
